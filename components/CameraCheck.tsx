"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/buttons";
import {
  analyzeHand,
  checkLetter,
  measureHand,
  describeReading,
  LETTER_SPECS,
  letterConfidence,
  letterMatches,
  matchIsSure,
  type HandReading,
  type Point,
} from "@/lib/handshape";
import { guessFist } from "@/lib/fist";
import fistModel from "@/data/fist-model.json";
import { cameraProblem, cameraUnavailable, HAND_LINES, loadHandTracker, NoGraphicsError } from "@/lib/tracker";

// A letter counts once the hand has matched continuously for this long, over at least a few
// frames. Using time as well as frames keeps it fair on slow devices and fast ones alike.
const MATCH_FOR_MS = 350;
const MATCH_MIN_FRAMES = 2;
// The tracker sometimes loses the hand for a frame or two. A short gap doesn't restart the hold;
// a hand that is in view but wrong does.
const MATCH_GRACE_MS = 450;

type Status = "idle" | "loading" | "running" | "error";
type Source = "camera" | "file";

function Mark({ ok }: { ok: boolean }) {
  return (
    <span
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-charcoal text-charcoal ${ok ? "bg-fern" : "bg-cream"}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none">
        <path
          d={ok ? "M5 12.5l4.5 4.5L19 7.5" : "M7 7l10 10M17 7L7 17"}
          stroke="currentColor"
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

// Watches the camera (or a video file you pick) with hand tracking and tells you how close your
// hand is to a fingerspelled letter. It runs entirely in the browser: the video is never recorded
// or sent anywhere. It is practice feedback, not a grade, so it never blocks anything.
export default function CameraCheck({
  letter,
  onMatch,
}: {
  letter: string;
  // certain is false for letters the camera can't reliably tell apart from others.
  onMatch?: (result: { certain: boolean }) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const fileUrlRef = useRef<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [source, setSource] = useState<Source | null>(null);
  const [message, setMessage] = useState("");
  const [reading, setReading] = useState<HandReading | null>(null);
  // The letter that was matched. Matched means it was for the letter showing now, so changing
  // the letter starts fresh without resetting state in an effect.
  const [matchedLetter, setMatchedLetter] = useState<string | null>(null);
  const [matchedSure, setMatchedSure] = useState(false);
  const matched = matchedLetter === letter;

  // The animation loop reads these through refs so it always sees the current letter.
  const letterRef = useRef(letter);
  const onMatchRef = useRef(onMatch);
  const streakRef = useRef(0);
  const streakSinceRef = useRef(0);
  const lastPassAtRef = useRef(0);
  const matchedRef = useRef(false);
  const lastTimeRef = useRef(-1);
  const lastSignatureRef = useRef("");
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    letterRef.current = letter;
    onMatchRef.current = onMatch;
  });
  useEffect(() => {
    streakRef.current = 0;
    streakSinceRef.current = 0;
    matchedRef.current = false;
  }, [letter]);

  const spec = LETTER_SPECS[letter.toUpperCase()];
  const confidence = letterConfidence(letter);
  const checks = useMemo(() => (reading ? checkLetter(letter, reading) : []), [reading, letter]);
  const nextFix = checks.find((check) => !check.ok);

  function clearCanvas() {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  }

  function stop() {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
    fileUrlRef.current = null;
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
      video.removeAttribute("src");
      video.load();
    }
    clearCanvas();
    setReading(null);
    setSource(null);
    setStatus("idle");
    setMessage("");
    // A new session starts fresh: nothing left over from an earlier one, or the checklist would
    // stay hidden until the hand changed shape.
    matchedRef.current = false;
    streakRef.current = 0;
    lastSignatureRef.current = "";
    lastUpdateRef.current = 0;
    lastPassAtRef.current = 0;
    setMatchedLetter(null);
    setMatchedSure(false);
  }

  // Stop everything when the learner leaves.
  useEffect(() => stop, []); // eslint-disable-line react-hooks/exhaustive-deps

  function draw(points: { x: number; y: number }[] | undefined, good: boolean) {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
    if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!points) return;
    context.lineCap = "round";
    context.lineWidth = Math.max(3, canvas.width / 150);
    context.strokeStyle = good ? "#768e78" : "#fcc88a";
    for (const [from, to] of HAND_LINES) {
      context.beginPath();
      context.moveTo(points[from].x * canvas.width, points[from].y * canvas.height);
      context.lineTo(points[to].x * canvas.width, points[to].y * canvas.height);
      context.stroke();
    }
    context.fillStyle = "#faf8f5";
    context.strokeStyle = "#252c26";
    context.lineWidth = Math.max(2, canvas.width / 300);
    for (const point of points) {
      context.beginPath();
      context.arc(point.x * canvas.width, point.y * canvas.height, Math.max(4, canvas.width / 110), 0, Math.PI * 2);
      context.fill();
      context.stroke();
    }
  }

  async function begin(from: Source) {
    const video = videoRef.current;
    if (!video) return;
    setStatus("loading");
    setMessage("Loading hand tracking (about 20 MB, only the first time)…");
    let tracker;
    try {
      tracker = await loadHandTracker();
    } catch (error) {
      stop();
      setStatus("error");
      setMessage(
        error instanceof NoGraphicsError
          ? "This browser can't run hand tracking because graphics acceleration is turned off or missing. Try another browser or device."
          : "Hand tracking couldn't load. Check your connection and try again.",
      );
      return;
    }
    setSource(from);
    setStatus("running");
    setMessage("");
    lastTimeRef.current = -1;
    streakRef.current = 0;

    const tick = () => {
      frameRef.current = requestAnimationFrame(tick);
      if (video.readyState < 2 || video.paused || video.videoWidth === 0) return;
      if (video.currentTime === lastTimeRef.current) return;
      lastTimeRef.current = video.currentTime;

      let result;
      try {
        result = tracker.detectForVideo(video, performance.now());
      } catch {
        // The tracker failed mid-session (for example the graphics context was lost).
        stop();
        setStatus("error");
        setMessage("Hand tracking stopped working. Try again, or use another browser.");
        return;
      }
      const world = result.worldLandmarks[0] as Point[] | undefined;
      const found = result.landmarks[0];
      if (!world || !found) {
        draw(undefined, false);
        if (performance.now() - lastPassAtRef.current > MATCH_GRACE_MS) streakRef.current = 0;
        if (lastSignatureRef.current !== "none") {
          lastSignatureRef.current = "none";
          setReading(null);
        }
        return;
      }
      const now = analyzeHand(world);
      // The fist letters differ only in where the thumb sits, which the finger rules can't see.
      if (LETTER_SPECS[letterRef.current.toUpperCase()]?.fist && Object.values(now.fingers).every((state) => state === "bent")) {
        const guess = guessFist(found as Point[], video.videoWidth / video.videoHeight, fistModel);
        now.fist = { letter: guess.letter, share: Math.floor(guess.share * 20) / 20 };
      }
      // The latest raw measurements, for tuning and the automated tests. Not shown to learners.
      if (boxRef.current) boxRef.current.dataset.cameraMeasures = JSON.stringify(measureHand(world));
      const pass = letterMatches(checkLetter(letterRef.current, now));
      if (boxRef.current) boxRef.current.dataset.cameraPass = String(pass);
      draw(found, pass);
      const clock = performance.now();
      if (!pass) {
        streakRef.current = 0;
      } else {
        if (streakRef.current === 0) streakSinceRef.current = clock;
        streakRef.current += 1;
        lastPassAtRef.current = clock;
      }
      if (
        pass &&
        streakRef.current >= MATCH_MIN_FRAMES &&
        clock - streakSinceRef.current >= MATCH_FOR_MS &&
        !matchedRef.current
      ) {
        matchedRef.current = true;
        const sure = matchIsSure(letterRef.current, now);
        setMatchedLetter(letterRef.current);
        setMatchedSure(sure);
        onMatchRef.current?.({ certain: sure });
      }
      // Only redraw the checklist when something changed, and at most about 8 times a second.
      const signature = JSON.stringify(now);
      const time = performance.now();
      if (signature !== lastSignatureRef.current && time - lastUpdateRef.current > 120) {
        lastSignatureRef.current = signature;
        lastUpdateRef.current = time;
        setReading(now);
      }
    };
    frameRef.current = requestAnimationFrame(tick);
  }

  async function startCamera() {
    const video = videoRef.current;
    if (!video) return;
    setStatus("loading");
    setMessage("Asking for your camera…");
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setMessage(cameraUnavailable());
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();
      await begin("camera");
    } catch (error) {
      stop();
      setStatus("error");
      setMessage(cameraProblem(error));
    }
  }

  async function loadFile(file: File) {
    const video = videoRef.current;
    if (!video) return;
    stop();
    fileUrlRef.current = URL.createObjectURL(file);
    video.src = fileUrlRef.current;
    video.loop = true;
    try {
      await video.play();
      await begin("file");
    } catch {
      stop();
      setStatus("error");
      setMessage("That video couldn't be played. Try an MP4 or MOV file.");
    }
  }

  const running = status === "running";

  return (
    <div
      ref={boxRef}
      data-camera-status={status}
      data-camera-hand={running ? String(reading !== null) : "false"}
      data-camera-reading={reading ? JSON.stringify(reading) : ""}
      data-camera-matched={String(matched)}
      className="rounded-[28px] bg-fennel p-4"
    >
      <div className={`relative overflow-hidden rounded-2xl bg-charcoal ${running || status === "loading" ? "" : "hidden"}`}>
        {/* Camera video is shown like a mirror, so your right hand is on the right. */}
        <div className={source === "camera" ? "-scale-x-100" : ""}>
          <video ref={videoRef} muted playsInline className="aspect-[4/3] w-full object-cover" aria-label="Your camera" />
          <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full object-cover" aria-hidden="true" />
        </div>
        {running && !reading && (
          <p className="absolute inset-x-3 bottom-3 rounded-full bg-cream/90 px-3 py-1.5 text-center text-sm font-semibold text-charcoal">
            Show your hand to the camera
          </p>
        )}
      </div>

      {status === "idle" && (
        <div>
          <p className="font-display text-xl font-bold text-ink">Check your hand with the camera</p>
          <p className="mt-1 text-sm text-muted">
            Your video stays on this device. Nothing is recorded or sent anywhere.
          </p>
        </div>
      )}

      {message && (
        <p
          role="status"
          className={`mt-3 text-sm font-semibold ${status === "error" ? "text-peony-dark" : "text-charcoal"}`}
        >
          {message}
        </p>
      )}

      {running && (
        <div className="mt-4">
          {matched && !matchedSure ? (
            <p
              className="rounded-2xl border-2 border-charcoal bg-honey px-4 py-2 font-display text-lg font-bold text-charcoal"
              data-camera-success
              data-camera-confidence="unsure"
            >
              The finger shape fits {letter.toUpperCase()}, but the camera can&apos;t be sure
            </p>
          ) : matched ? (
            <p
              className="rounded-2xl border-2 border-charcoal bg-fern px-4 py-2 font-display text-lg font-bold text-charcoal"
              data-camera-success
              data-camera-confidence={confidence}
            >
              That looks like {letter.toUpperCase()}!
            </p>
          ) : nextFix ? (
            <p className="font-display text-lg font-bold text-ink">{nextFix.tip}</p>
          ) : reading ? (
            <p className="font-display text-lg font-bold text-ink">Hold it there…</p>
          ) : null}
          {checks.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {checks.map((check) => (
                <li key={check.label} className="flex items-center gap-2 text-sm font-semibold text-charcoal">
                  <Mark ok={check.ok} />
                  {check.label}
                </li>
              ))}
            </ul>
          )}
          {reading && (
            <p className="mt-3 text-xs text-muted">
              The camera sees: {describeReading(reading).join(" · ")}
            </p>
          )}
        </div>
      )}

      {spec?.tricky && (
        <p className="mt-3 rounded-2xl bg-cream px-3 py-2 text-xs text-muted" data-camera-note="tricky">
          <span className="font-bold text-charcoal">A tricky one for the camera.</span> {spec.tricky} It can
          only check the finger shape, so compare your hand with the drawing too.
        </p>
      )}
      {confidence === "learned" && (
        <p className="mt-3 rounded-2xl bg-cream px-3 py-2 text-xs text-muted" data-camera-note="learned">
          <span className="font-bold text-charcoal">The fist letters are close cousins.</span> The camera
          tells them apart by where your thumb sits, and in testing on real hands it picked the right one
          about 9 times in 10. M and N are the easiest to mix up, so compare with the drawing too.
        </p>
      )}
      {confidence === "unconfirmed" && (
        <p className="mt-3 rounded-2xl bg-cream px-3 py-2 text-xs text-muted" data-camera-note="unconfirmed">
          <span className="font-bold text-charcoal">Not yet checked against real hands.</span> The rules for
          this letter make sense, so treat the camera as a guide.
          {letter.toUpperCase() === "J" && " J also moves, which the camera doesn't check."}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {running ? (
          <button type="button" onClick={stop} className={SECONDARY_BUTTON}>
            Stop
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={startCamera}
              disabled={status === "loading"}
              className={`${PRIMARY_BUTTON} disabled:border-line-strong disabled:bg-line disabled:text-muted`}
            >
              {status === "loading" ? "Starting…" : "Start camera"}
            </button>
            <label className={`${SECONDARY_BUTTON} cursor-pointer`}>
              Use a video file
              <input
                type="file"
                accept="video/*"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void loadFile(file);
                }}
              />
            </label>
          </>
        )}
      </div>
    </div>
  );
}

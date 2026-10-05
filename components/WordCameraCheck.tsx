"use client";

import { useEffect, useRef, useState } from "react";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/buttons";
import { getSign } from "@/lib/content";
import { cameraProblem, cameraUnavailable, HAND_LINES, loadHandTracker, NoGraphicsError } from "@/lib/tracker";
import { HINT_TEXT, judgeAttempt, type Judgement, type Sample, type WordRefs } from "@/lib/wordsign";
import wordRefs from "@/data/word-refs.json";

const REFS = wordRefs as WordRefs;

// Whether the camera can check this word sign, and which words it can.
export const canCheckWord = (signId: string) => signId in REFS.signs;
export const checkableWordIds = () => Object.keys(REFS.signs);

// An attempt is the stretch of video in which a hand is in view. It ends when the hand has been gone this long.
const GONE_MS = 600;
// Shorter than this, or with fewer samples, is too brief to judge. Longer is cut off and judged.
const MIN_MS = 400;
const MIN_SAMPLES = 8;
const MAX_MS = 10_000;

type Status = "idle" | "loading" | "running" | "error";
type Source = "camera" | "file";

export default function WordCameraCheck({
  signId,
  word,
  onMatch,
}: {
  signId: string;
  word: string;
  onMatch?: (result: { certain: boolean }) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const fileUrlRef = useRef<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [source, setSource] = useState<Source | null>(null);
  const [message, setMessage] = useState("");
  const [handInView, setHandInView] = useState(false);
  const [result, setResult] = useState<Judgement | null>(null);

  const signIdRef = useRef(signId);
  const onMatchRef = useRef(onMatch);
  const samplesRef = useRef<Sample[]>([]);
  const lastSeenRef = useRef(0);
  const lastTimeRef = useRef(-1);
  const handRef = useRef(false);
  useEffect(() => {
    signIdRef.current = signId;
    onMatchRef.current = onMatch;
  });

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
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    // A new session starts fresh: nothing left over from an earlier one.
    samplesRef.current = [];
    lastTimeRef.current = -1;
    handRef.current = false;
    setHandInView(false);
    setResult(null);
    setSource(null);
    setStatus("idle");
    setMessage("");
  }

  // Stop everything when the learner leaves.
  useEffect(() => stop, []);

  function draw(points: { x: number; y: number }[] | undefined) {
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
    context.strokeStyle = "#fcc88a";
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

  // Judges the attempt collected so far, then starts over.
  function finishAttempt() {
    const samples = samplesRef.current;
    samplesRef.current = [];
    if (samples.length < MIN_SAMPLES || samples[samples.length - 1].t - samples[0].t < MIN_MS) {
      setMessage("That was too quick to see. Sign it a little slower, with your hand in view the whole time.");
      return;
    }
    const judged = judgeAttempt(samples, signIdRef.current, REFS);
    if (!judged) return;
    setMessage("");
    setResult(judged);
    if (judged.verdict !== "not-yet") onMatchRef.current?.({ certain: judged.verdict === "match" });
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
    samplesRef.current = [];

    const tick = () => {
      frameRef.current = requestAnimationFrame(tick);
      if (video.readyState < 2 || video.paused || video.videoWidth === 0) return;
      if (video.currentTime === lastTimeRef.current) return;
      // A video file loops: a jump back in time ends the attempt in progress.
      const looped = from === "file" && video.currentTime < lastTimeRef.current;
      lastTimeRef.current = video.currentTime;
      // Video files are timed by the video's own clock, so slowed-down playback still gives the real sign timing.
      const now = from === "file" ? video.currentTime * 1000 : performance.now();
      if (looped && samplesRef.current.length > 0) finishAttempt();

      let detected;
      try {
        detected = tracker.detectForVideo(video, performance.now());
      } catch {
        stop();
        setStatus("error");
        setMessage("Hand tracking stopped working. Try again, or use another browser.");
        return;
      }
      const world = detected.worldLandmarks[0];
      const found = detected.landmarks[0];
      draw(found);
      const seen = Boolean(world && found);
      if (seen !== handRef.current) {
        handRef.current = seen;
        setHandInView(seen);
      }
      if (seen) {
        // A new attempt begins: forget the last verdict.
        if (samplesRef.current.length === 0) setResult(null);
        samplesRef.current.push({ t: now, world });
        lastSeenRef.current = now;
        if (now - samplesRef.current[0].t > MAX_MS) finishAttempt();
      } else if (samplesRef.current.length > 0 && now - lastSeenRef.current > GONE_MS) {
        finishAttempt();
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
  const closestWord = result ? (getSign(result.closest)?.word ?? result.closest) : "";
  const upper = word.toUpperCase();

  return (
    <div
      data-word-status={status}
      data-word-hand={running ? String(handInView) : "false"}
      data-word-result={result?.verdict ?? ""}
      data-word-distance={result ? result.distance.toFixed(2) : ""}
      data-word-closest={result?.closest ?? ""}
      className="rounded-[28px] bg-fennel p-4"
    >
      <div className={`relative overflow-hidden rounded-2xl bg-charcoal ${running || status === "loading" ? "" : "hidden"}`}>
        {/* Camera video is shown like a mirror, so your right hand is on the right. */}
        <div className={source === "camera" ? "-scale-x-100" : ""}>
          <video ref={videoRef} muted playsInline className="aspect-[4/3] w-full object-cover" aria-label="Your camera" />
          <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full object-cover" aria-hidden="true" />
        </div>
        {running && !handInView && !result && (
          <p className="absolute inset-x-3 bottom-3 rounded-full bg-cream/90 px-3 py-1.5 text-center text-sm font-semibold text-charcoal">
            Show your hand, sign {upper} once, then lower it
          </p>
        )}
      </div>

      {status === "idle" && (
        <div>
          <p className="font-display text-xl font-bold text-ink">Check your sign with the camera</p>
          <p className="mt-1 text-sm text-muted">Your video stays on this device. Nothing is recorded or sent anywhere.</p>
        </div>
      )}

      {message && (
        <p role="status" className={`mt-3 text-sm font-semibold ${status === "error" ? "text-peony-dark" : "text-charcoal"}`}>
          {message}
        </p>
      )}

      {running && result && (
        <div className="mt-4" data-word-verdict={result.verdict}>
          {result.verdict === "match" ? (
            <p className="rounded-2xl border-2 border-charcoal bg-fern px-4 py-2 font-display text-lg font-bold text-charcoal" data-word-success>
              That matches {upper}!
            </p>
          ) : (
            <div className="rounded-2xl border-2 border-charcoal bg-honey px-4 py-2 text-charcoal" data-word-success>
              <p className="font-display text-lg font-bold">
                {result.verdict === "close" ? "Close!" : "Not yet."}
                {result.closest !== signId && ` That looked more like ${closestWord.toUpperCase()}.`}
              </p>
              <p className="mt-1 text-sm font-semibold">
                {HINT_TEXT[result.hint]}. Watch the video again, then try once more.
              </p>
            </div>
          )}
          <p className="mt-2 text-xs text-muted">Sign it again whenever you like. Each try is judged on its own.</p>
        </div>
      )}
      {running && !result && handInView && (
        <p className="mt-4 font-display text-lg font-bold text-ink">Keep going, then lower your hand when you finish…</p>
      )}

      <p className="mt-3 rounded-2xl bg-cream px-3 py-2 text-xs text-muted" data-word-note>
        <span className="font-bold text-charcoal">A practice guide, not a grade.</span> The camera checks your hand shape and
        which way your hand turns during the sign. It can&apos;t see where your hand is on your body or how it travels, so
        compare with the video too.
      </p>

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

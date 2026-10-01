"use client";

import { useEffect, useRef, useState } from "react";
import type { Sign } from "@/components/SignCard";

// A sign's video, played like a GIF: silent, looping, in a fixed 16:9 frame that never crops.
// Tap to pause or play. It starts paused for people who have asked their device to reduce motion.
// interactive=false is for videos inside buttons (answer choices), where the button takes the tap.
export default function SignVideo({
  sign,
  label,
  credit = "none",
  interactive = true,
  className = "",
}: {
  sign: Sign;
  label: string;
  // "link" credits the source with a link to the sign's page. "text" shows the credit without
  // the link, for quiz questions where the linked page would name the answer.
  credit?: "link" | "text" | "none";
  interactive?: boolean;
  className?: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video.current?.pause();
    }
  }, []);

  function toggle() {
    const element = video.current;
    if (!element) return;
    if (element.paused) void element.play();
    else element.pause();
  }

  if (!sign.video) return null;

  return (
    <figure className={className}>
      <div className="relative overflow-hidden rounded-2xl bg-charcoal">
        <video
          ref={video}
          src={sign.video}
          aria-label={label}
          className={`hand-mirror aspect-video w-full object-contain ${interactive ? "cursor-pointer" : "pointer-events-none"}`}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          onClick={interactive ? toggle : undefined}
          onPause={() => setPaused(true)}
          onPlay={() => setPaused(false)}
        />
        {interactive && paused && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-charcoal/30">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cream">
              <svg viewBox="0 0 24 24" className="ml-0.5 h-6 w-6 fill-charcoal" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </span>
        )}
      </div>
      {credit !== "none" && sign.videoCredit && (
        <figcaption className="mt-1 text-right text-xs text-muted">
          Video:{" "}
          {credit === "link" ? (
            <a
              href={sign.videoCredit.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-charcoal"
            >
              {sign.videoCredit.label}
            </a>
          ) : (
            sign.videoCredit.label
          )}
        </figcaption>
      )}
    </figure>
  );
}

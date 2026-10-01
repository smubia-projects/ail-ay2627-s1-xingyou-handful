import Image from "next/image";

export type SignLocation = "forehead" | "chin" | "chest" | "mouth" | "space";

// How the hand moves, drawn as an arrow on the body diagram.
export const MOTIONS = [
  "outward",
  "forward-down",
  "circle",
  "down",
  "up",
  "nod",
  "side-to-side",
  "tap",
  "twist",
  "wiggle",
  "across",
  "hook",
  "zigzag",
] as const;
export type Motion = (typeof MOTIONS)[number];

export type Sign = {
  id: string;
  word: string;
  handshape: string;
  location: SignLocation;
  movement: string;
  tip: string;
  // Optional until filmed. See docs/VIDEO_GUIDELINES.md.
  video?: string;
  signer?: string;
  // True once a Deaf ASL signer has checked the description (required before release).
  reviewed?: boolean;
  // A letter (A-Z) or number (1-9) whose drawing in public/handshapes matches the handshape.
  handshapeImage?: string;
  motion?: Motion;
  // Facial expression or head movement that is part of the sign. In ASL the face carries grammar
  // (for example, lowered eyebrows mark who/what/where questions).
  face?: string;
};

// Path to a handshape drawing. See docs/CREDITS.md for where the drawings come from.
export function handshapeSrc(key: string): string {
  return /^[1-9]$/.test(key)
    ? `/handshapes/number-${key}.jpg`
    : `/handshapes/letter-${key.toLowerCase()}.svg`;
}

export const LOCATION_LABELS: Record<SignLocation, string> = {
  forehead: "Forehead",
  mouth: "Mouth",
  chin: "Chin",
  chest: "Chest",
  space: "In front of the body",
};

// Dot position for each location, in the body diagram's 200x200 viewBox.
const LOCATION_POINTS: Record<SignLocation, { x: number; y: number }> = {
  forehead: { x: 100, y: 38 },
  mouth: { x: 100, y: 72 },
  chin: { x: 100, y: 86 },
  chest: { x: 100, y: 140 },
  space: { x: 100, y: 176 },
};

// Arrow (or tap marks) for each motion, drawn relative to the location dot at (x, y).
function motionPath(motion: Motion, x: number, y: number): { d: string; heads: "end" | "both" | "none" } {
  switch (motion) {
    case "outward":
      return { d: `M${x + 16} ${y} C${x + 36} ${y - 6} ${x + 50} ${y - 6} ${x + 62} ${y}`, heads: "end" };
    case "forward-down":
      return { d: `M${x + 14} ${y + 4} Q${x + 42} ${y + 8} ${x + 44} ${y + 38}`, heads: "end" };
    case "circle":
      return { d: `M${x + 24} ${y} A24 24 0 1 1 ${x + 17} ${y - 17}`, heads: "end" };
    case "down":
      return { d: `M${x + 26} ${y - 6} L${x + 26} ${y + 36}`, heads: "end" };
    case "up":
      return { d: `M${x + 26} ${y + 10} L${x + 26} ${y - 34}`, heads: "end" };
    case "nod":
      return { d: `M${x + 30} ${y - 16} L${x + 30} ${y + 16}`, heads: "both" };
    case "side-to-side":
      return { d: `M${x - 30} ${y - 30} L${x + 30} ${y - 30}`, heads: "both" };
    case "tap":
      return {
        d: `M${x + 18} ${y - 10} Q${x + 24} ${y} ${x + 18} ${y + 10} M${x + 27} ${y - 15} Q${x + 35} ${y} ${x + 27} ${y + 15}`,
        heads: "none",
      };
    case "twist":
      return { d: `M${x - 22} ${y - 24} Q${x} ${y - 44} ${x + 22} ${y - 24}`, heads: "both" };
    case "wiggle":
      return {
        d: `M${x - 24} ${y - 30} q6 -9 12 0 t12 0 t12 0 t12 0`,
        heads: "none",
      };
    case "across":
      return { d: `M${x - 34} ${y - 2} L${x + 34} ${y - 2}`, heads: "end" };
    case "hook":
      return { d: `M${x + 26} ${y - 36} L${x + 26} ${y - 8} Q${x + 26} ${y + 6} ${x + 10} ${y + 2}`, heads: "end" };
    case "zigzag":
      return {
        d: `M${x - 20} ${y - 40} L${x + 20} ${y - 40} L${x - 20} ${y - 14} L${x + 20} ${y - 14}`,
        heads: "end",
      };
  }
}

export function BodyDiagram({
  location,
  motion,
  className = "h-40 w-40",
}: {
  location: SignLocation;
  motion?: Motion;
  className?: string;
}) {
  const dot = LOCATION_POINTS[location];
  const arrow = motion ? motionPath(motion, dot.x, dot.y) : null;
  const markerId = `arrowhead-${location}-${motion ?? "none"}`;
  return (
    <svg
      viewBox="0 0 200 200"
      className={`hand-mirror ${className}`}
      role="img"
      aria-label={`Body outline marking the sign location: ${LOCATION_LABELS[location].toLowerCase()}${motion ? `, with a ${motion.replace(/-/g, " ")} movement arrow` : ""}`}
    >
      <g className="fill-none stroke-line-strong" strokeWidth={4} strokeLinecap="round">
        {/* Head */}
        <ellipse cx={100} cy={55} rx={30} ry={36} />
        {/* Neck */}
        <path d="M88 90 V104 M112 90 V104" />
        {/* Shoulders and torso */}
        <path d="M88 104 C60 106 40 112 30 130 V200 M112 104 C140 106 160 112 170 130 V200" />
      </g>
      {location === "space" ? (
        // Signing space in front of the body: a dashed zone rather than a spot on the body.
        <ellipse
          cx={dot.x}
          cy={dot.y}
          rx={52}
          ry={20}
          strokeWidth={3}
          strokeDasharray="6 6"
          className="fill-coral/20 stroke-coral-dark"
        />
      ) : (
        <circle cx={dot.x} cy={dot.y} r={16} className="fill-coral/35" />
      )}
      <circle cx={dot.x} cy={dot.y} r={8} className="fill-coral-dark" />
      {arrow && (
        <>
          <defs>
            <marker
              id={markerId}
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="4"
              markerHeight="4"
              orient="auto-start-reverse"
            >
              <path d="M0 0 L10 5 L0 10 z" className="fill-charcoal" />
            </marker>
          </defs>
          <path
            d={arrow.d}
            fill="none"
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-charcoal"
            markerEnd={arrow.heads !== "none" ? `url(#${markerId})` : undefined}
            markerStart={arrow.heads === "both" ? `url(#${markerId})` : undefined}
          />
        </>
      )}
    </svg>
  );
}

// The handshape drawing for a sign, if one matches exactly.
// mirror=false keeps it as drawn even in left-handed mode (for reading other people's signing).
export function HandshapeImage({
  sign,
  className = "h-36 w-28",
  mirror = true,
}: {
  sign: Sign;
  className?: string;
  mirror?: boolean;
}) {
  if (!sign.handshapeImage) return null;
  return (
    <Image
      src={handshapeSrc(sign.handshapeImage)}
      alt={`Handshape: ${sign.handshape}`}
      width={160}
      height={200}
      unoptimized
      // Small files, often the main thing on screen, so load them straight away.
      loading="eager"
      // Multiply blends the drawings' white backgrounds into the panel behind them.
      className={`object-contain mix-blend-multiply ${mirror ? "hand-mirror" : ""} ${className}`}
    />
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm font-semibold text-muted">{label}</dt>
      <dd className="mt-0.5 font-semibold text-ink">{children}</dd>
    </div>
  );
}

export default function SignCard({ sign, label = "New sign" }: { sign: Sign; label?: string }) {
  return (
    <article className="w-full rounded-[28px] bg-fennel p-5">
      <span className="inline-block rounded-full bg-bluebell px-3 py-1 text-sm font-semibold text-charcoal">
        {label}
      </span>
      <h2 className="mt-2 font-display text-4xl font-bold text-ink">{sign.word}</h2>

      {/* Every video shows in the same 16:9 frame, never cropped. */}
      {sign.video ? (
        <video
          src={sign.video}
          aria-label={`Video of the sign for ${sign.word}`}
          className="mt-4 aspect-video w-full rounded-2xl bg-surface object-contain"
          controls
          loop
          muted
          playsInline
          preload="metadata"
        />
      ) : (
        <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong bg-cream py-2 text-xs font-semibold text-muted">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cream">
            <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5 fill-brand" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
          Video coming soon
        </div>
      )}

      <div className="mt-3 flex items-end justify-center gap-3 rounded-2xl bg-cream p-3">
        {sign.handshapeImage && (
          <figure className="flex flex-col items-center gap-1">
            <HandshapeImage sign={sign} className="h-32 w-24" />
            <figcaption className="text-xs font-semibold text-muted">Handshape</figcaption>
          </figure>
        )}
        <figure className="flex flex-col items-center gap-1">
          <BodyDiagram location={sign.location} motion={sign.motion} className="h-32 w-32" />
          <figcaption className="text-xs font-semibold text-muted">
            {LOCATION_LABELS[sign.location]}
            {sign.motion ? " · how it moves" : ""}
          </figcaption>
        </figure>
      </div>

      <div className="mt-4">
        <dl className="space-y-2">
          <Detail label="Handshape">{sign.handshape}</Detail>
          <Detail label="Movement">{sign.movement}</Detail>
          {sign.face && <Detail label="Face">{sign.face}</Detail>}
        </dl>
      </div>

      <div className="mt-4 rounded-3xl bg-honey px-4 py-3">
        <p className="text-sm font-semibold text-ink/70">
          Memory tip
        </p>
        <p className="font-display text-lg font-bold text-ink">{sign.tip}</p>
      </div>
    </article>
  );
}

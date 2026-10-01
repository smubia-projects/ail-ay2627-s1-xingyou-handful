export type SignLocation = "forehead" | "chin" | "chest" | "mouth" | "space";

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
};

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

export function BodyDiagram({
  location,
  className = "h-40 w-40",
}: {
  location: SignLocation;
  className?: string;
}) {
  const dot = LOCATION_POINTS[location];
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      role="img"
      aria-label={`Body outline marking the sign location: ${LOCATION_LABELS[location].toLowerCase()}`}
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
    </svg>
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
    <article className="w-full rounded-[28px] bg-white p-6 ring-1 ring-line">
      <span className="inline-block rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand">
        {label}
      </span>
      <h2 className="mt-3 font-display text-5xl font-bold text-ink">{sign.word}</h2>

      {/* Every video shows in the same 16:9 frame, never cropped. */}
      {sign.video ? (
        <video
          src={sign.video}
          aria-label={`Video of the sign for ${sign.word}`}
          className="mt-5 aspect-video w-full rounded-2xl bg-surface object-contain"
          controls
          loop
          muted
          playsInline
          preload="metadata"
        />
      ) : (
        <div className="mt-5 flex items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-line-strong bg-surface py-4 text-sm font-semibold text-muted">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
            <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5 fill-brand" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
          Video coming soon
        </div>
      )}

      <div className="mt-5 grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="flex justify-center rounded-2xl bg-surface p-3">
          <BodyDiagram location={sign.location} />
        </div>
        <dl className="space-y-3">
          <Detail label="Handshape">{sign.handshape}</Detail>
          <Detail label="Location">
            {LOCATION_LABELS[sign.location]}
          </Detail>
          <Detail label="Movement">{sign.movement}</Detail>
        </dl>
      </div>

      <div className="mt-5 rounded-3xl bg-lime-soft p-4">
        <p className="text-sm font-semibold text-ink/70">
          Memory tip
        </p>
        <p className="mt-1 font-display text-xl font-bold text-ink">{sign.tip}</p>
      </div>
    </article>
  );
}

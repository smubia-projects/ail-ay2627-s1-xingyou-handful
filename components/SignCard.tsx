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
};

// Dot position for each location, in the body diagram's 200x200 viewBox.
const LOCATION_POINTS: Record<SignLocation, { x: number; y: number }> = {
  forehead: { x: 100, y: 38 },
  mouth: { x: 100, y: 72 },
  chin: { x: 100, y: 86 },
  chest: { x: 100, y: 150 },
  space: { x: 165, y: 110 },
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
      aria-label={`Body outline with the sign location at the ${location}`}
    >
      <g className="fill-none stroke-sand-dark" strokeWidth={4} strokeLinecap="round">
        {/* Head */}
        <ellipse cx={100} cy={55} rx={30} ry={36} />
        {/* Neck */}
        <path d="M88 90 V104 M112 90 V104" />
        {/* Shoulders and torso */}
        <path d="M88 104 C60 106 40 112 30 130 V200 M112 104 C140 106 160 112 170 130 V200" />
      </g>
      <circle cx={dot.x} cy={dot.y} r={16} className="fill-peach/35" />
      <circle cx={dot.x} cy={dot.y} r={8} className="fill-peach-dark" />
    </svg>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-extrabold uppercase tracking-widest text-muted">{label}</dt>
      <dd className="mt-0.5 font-semibold text-ink">{children}</dd>
    </div>
  );
}

export default function SignCard({ sign }: { sign: Sign }) {
  return (
    <article className="w-full rounded-3xl bg-white p-6 shadow-[0_12px_32px_-16px_rgba(59,52,44,0.35)] ring-1 ring-sand">
      <span className="inline-block rounded-full bg-peach-light px-3 py-1 text-xs font-extrabold uppercase tracking-widest text-ink">
        New sign
      </span>
      <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-ink">{sign.word}</h2>

      {/* Every video shows in the same 16:9 frame, never cropped. */}
      {sign.video ? (
        <video
          src={sign.video}
          aria-label={`Video of the sign for ${sign.word}`}
          className="mt-5 aspect-video w-full rounded-2xl bg-cream object-contain"
          controls
          loop
          muted
          playsInline
          preload="metadata"
        />
      ) : (
        <div className="mt-5 flex aspect-video flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-sand-dark bg-cream text-sm font-semibold text-muted">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
            <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5 fill-sage" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
          Video coming soon
        </div>
      )}

      <div className="mt-5 grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="flex justify-center rounded-2xl bg-cream p-3">
          <BodyDiagram location={sign.location} />
        </div>
        <dl className="space-y-3">
          <Detail label="Handshape">{sign.handshape}</Detail>
          <Detail label="Location">
            <span className="capitalize">{sign.location}</span>
          </Detail>
          <Detail label="Movement">{sign.movement}</Detail>
        </dl>
      </div>

      <div className="mt-5 rounded-2xl bg-peach-light p-4">
        <p className="text-xs font-extrabold uppercase tracking-widest text-muted">
          Memory tip
        </p>
        <p className="mt-1 font-semibold text-ink">{sign.tip}</p>
      </div>
    </article>
  );
}

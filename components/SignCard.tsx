export type SignLocation = "forehead" | "chin" | "chest" | "mouth" | "space";

export type Sign = {
  id: string;
  word: string;
  handshape: string;
  location: SignLocation;
  movement: string;
  tip: string;
};

// Dot position for each location, in the body diagram's 200x200 viewBox.
const LOCATION_POINTS: Record<SignLocation, { x: number; y: number }> = {
  forehead: { x: 100, y: 38 },
  mouth: { x: 100, y: 72 },
  chin: { x: 100, y: 86 },
  chest: { x: 100, y: 150 },
  space: { x: 165, y: 110 },
};

function BodyDiagram({ location }: { location: SignLocation }) {
  const dot = LOCATION_POINTS[location];
  return (
    <svg
      viewBox="0 0 200 200"
      className="h-48 w-48"
      role="img"
      aria-label={`Body outline with the sign location at the ${location}`}
    >
      <g className="fill-none stroke-zinc-400" strokeWidth={3} strokeLinecap="round">
        {/* Head */}
        <ellipse cx={100} cy={55} rx={30} ry={36} />
        {/* Neck */}
        <path d="M88 90 V104 M112 90 V104" />
        {/* Shoulders and torso */}
        <path d="M88 104 C60 106 40 112 30 130 V200 M112 104 C140 106 160 112 170 130 V200" />
      </g>
      <circle cx={dot.x} cy={dot.y} r={9} className="fill-emerald-500" />
    </svg>
  );
}

export default function SignCard({ sign }: { sign: Sign }) {
  return (
    <article className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-center text-3xl font-bold text-zinc-900">{sign.word}</h2>

      <div className="mt-4 flex h-40 items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-100 text-sm text-zinc-500">
        Video coming soon
      </div>

      <div className="mt-4 flex justify-center">
        <BodyDiagram location={sign.location} />
      </div>

      <dl className="mt-4 space-y-3 text-zinc-700">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Handshape</dt>
          <dd>{sign.handshape}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Location</dt>
          <dd className="capitalize">{sign.location}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Movement</dt>
          <dd>{sign.movement}</dd>
        </div>
      </dl>

      <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-emerald-800">💡 {sign.tip}</p>
    </article>
  );
}

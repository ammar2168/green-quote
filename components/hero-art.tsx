/**
 * A sunset over a rooftop solar array, drawn rather than photographed so the
 * auth pages ship without an image asset. Fills its box like `object-cover`.
 */

const TOP_LEFT = { x: -40, y: 590 };
const TOP_RIGHT = { x: 840, y: 450 };
const BOTTOM = 1000;

/** y of the array's top edge at a given x. */
function topEdgeY(x: number): number {
  const slope = (TOP_RIGHT.y - TOP_LEFT.y) / (TOP_RIGHT.x - TOP_LEFT.x);

  return TOP_LEFT.y + (x - TOP_LEFT.x) * slope;
}

// Rows get taller toward the viewer, which is what sells the perspective.
const rowOffsets = Array.from({ length: 7 }, (_, i) => 58 * i * (1 + i * 0.16));

// Columns fan outward from the vanishing side of the roof.
const columnXs = Array.from({ length: 14 }, (_, i) => -40 + i * 68);

export function HeroArt({ className }: { className?: string }) {
  const arrayOutline = `${TOP_LEFT.x},${TOP_LEFT.y} ${TOP_RIGHT.x},${TOP_RIGHT.y} ${TOP_RIGHT.x},${BOTTOM} ${TOP_LEFT.x},${BOTTOM}`;

  return (
    <svg
      viewBox="0 0 800 1000"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="hero-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5f86b8" />
          <stop offset="0.22" stopColor="#9fb4cc" />
          <stop offset="0.38" stopColor="#e9c48f" />
          <stop offset="0.46" stopColor="#f2a65a" />
          <stop offset="0.56" stopColor="#d9783a" />
        </linearGradient>
        <radialGradient id="hero-sun-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff7d6" stopOpacity="1" />
          <stop offset="0.18" stopColor="#ffe29a" stopOpacity="0.9" />
          <stop offset="0.5" stopColor="#f7b25c" stopOpacity="0.35" />
          <stop offset="1" stopColor="#f08a3c" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hero-panel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b3f58" />
          <stop offset="1" stopColor="#0c1622" />
        </linearGradient>
        <radialGradient
          id="hero-reflection"
          cx="0.62"
          cy="0.12"
          r="0.6"
          gradientUnits="objectBoundingBox"
        >
          <stop offset="0" stopColor="#ffd38a" stopOpacity="0.85" />
          <stop offset="0.35" stopColor="#f29a4a" stopOpacity="0.35" />
          <stop offset="1" stopColor="#f29a4a" stopOpacity="0" />
        </radialGradient>
        <filter id="hero-soft" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
        <clipPath id="hero-array">
          <polygon points={arrayOutline} />
        </clipPath>
      </defs>

      <rect width="800" height="1000" fill="url(#hero-sky)" />

      <g filter="url(#hero-soft)" fill="#fff4e3">
        <ellipse cx="180" cy="190" rx="170" ry="16" opacity="0.55" />
        <ellipse cx="420" cy="240" rx="210" ry="12" opacity="0.45" />
        <ellipse cx="650" cy="140" rx="140" ry="12" opacity="0.4" />
        <ellipse cx="300" cy="310" rx="230" ry="10" opacity="0.5" />
      </g>

      <circle cx="520" cy="410" r="230" fill="url(#hero-sun-glow)" />
      <circle cx="520" cy="410" r="30" fill="#fffbea" />

      <path
        d="M0 450 C 120 410 220 435 330 418 S 560 435 650 410 S 760 420 800 405 V 530 H 0 Z"
        fill="#5b4a52"
        opacity="0.75"
      />
      <path
        d="M0 490 C 90 465 170 480 260 462 S 420 488 520 470 S 700 480 800 460 V 590 H 0 Z"
        fill="#2c2b36"
      />

      <polygon points={arrayOutline} fill="url(#hero-panel)" />

      <g clipPath="url(#hero-array)">
        <rect
          x={TOP_LEFT.x}
          y={TOP_RIGHT.y}
          width={TOP_RIGHT.x - TOP_LEFT.x}
          height={BOTTOM - TOP_RIGHT.y}
          fill="url(#hero-reflection)"
        />
        <g stroke="#9db2c8" strokeOpacity="0.4" strokeWidth="2.5">
          {rowOffsets.map((offset) => (
            <line
              key={offset}
              x1={TOP_LEFT.x}
              y1={TOP_LEFT.y + offset}
              x2={TOP_RIGHT.x}
              y2={TOP_RIGHT.y + offset}
            />
          ))}
          {columnXs.map((x) => (
            <line
              key={x}
              x1={x}
              y1={topEdgeY(x)}
              x2={400 + (x - 400) * 1.7}
              y2={BOTTOM}
            />
          ))}
        </g>
      </g>

      <line
        x1={TOP_LEFT.x}
        y1={TOP_LEFT.y}
        x2={TOP_RIGHT.x}
        y2={TOP_RIGHT.y}
        stroke="#d8e2ec"
        strokeOpacity="0.7"
        strokeWidth="4"
      />
    </svg>
  );
}

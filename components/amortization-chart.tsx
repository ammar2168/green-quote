"use client";

import { useState } from "react";

import type { AmortizationRow } from "@/lib/amortization";
import { formatCents } from "@/lib/money";

const WIDTH = 440;
const HEIGHT = 260;
const PLOT = { left: 44, right: 4, top: 10, bottom: 44 };
/** Surface-coloured space between a bar's two segments. */
const GAP = 2;
const RADIUS = 4;

/**
 * Each year's payments as one bar, split into principal and interest. Plain
 * SVG: one chart with two series does not need a charting library. The table
 * beside it carries the same numbers for anyone who cannot see the chart.
 */
export function AmortizationChart({ years }: { years: AmortizationRow[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const max = niceCeiling(Math.max(...years.map((year) => year.paidCents)));
  const plotWidth = WIDTH - PLOT.left - PLOT.right;
  const plotHeight = HEIGHT - PLOT.top - PLOT.bottom;
  const slot = plotWidth / years.length;
  const barWidth = Math.min(32, slot * 0.55);
  const y = (cents: number) => PLOT.top + plotHeight * (1 - cents / max);
  const ticks = [0, max / 2, max];
  const hoveredYear = hovered === null ? undefined : years[hovered];

  return (
    <figure className="min-w-0">
      <figcaption className="flex items-center gap-5 text-sm text-muted">
        <LegendKey className="bg-principal" label="Principal" />
        <LegendKey className="bg-interest" label="Interest" />
      </figcaption>

      <div className="relative mt-3">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          role="img"
          aria-label="Principal and interest paid in each year of the loan. The table lists the same figures."
          onMouseLeave={() => setHovered(null)}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PLOT.left}
                x2={WIDTH - PLOT.right}
                y1={y(tick)}
                y2={y(tick)}
                className="stroke-line"
              />
              <text
                x={PLOT.left - 8}
                y={y(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-subtle text-[12px]"
              >
                {compactDollars(tick)}
              </text>
            </g>
          ))}

          {years.map((year, index) => {
            const x = PLOT.left + slot * index + (slot - barWidth) / 2;
            const principalTop = y(year.principalCents);
            const interestTop = y(year.paidCents);

            return (
              <g
                key={year.period}
                opacity={hovered === null || hovered === index ? 1 : 0.45}
                className="transition-opacity"
              >
                <rect
                  x={x}
                  y={principalTop}
                  width={barWidth}
                  height={y(0) - principalTop}
                  className="fill-principal"
                />
                <path
                  d={roundedTopBar(
                    x,
                    interestTop,
                    barWidth,
                    principalTop - GAP - interestTop,
                  )}
                  className="fill-interest"
                />
                <text
                  x={x + barWidth / 2}
                  y={HEIGHT - PLOT.bottom + 18}
                  textAnchor="middle"
                  className="fill-subtle text-[12px]"
                >
                  {year.period}
                </text>
                {/* A hit area the full height and width of the slot. */}
                <rect
                  x={PLOT.left + slot * index}
                  y={PLOT.top}
                  width={slot}
                  height={plotHeight}
                  fill="transparent"
                  onMouseEnter={() => setHovered(index)}
                />
              </g>
            );
          })}

          <text
            x={PLOT.left + plotWidth / 2}
            y={HEIGHT - 4}
            textAnchor="middle"
            className="fill-muted text-[12px]"
          >
            Year of the loan
          </text>
        </svg>

        {hoveredYear && hovered !== null && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 z-10 w-44 -translate-x-1/2 rounded-control border border-line bg-surface px-3 py-2 text-xs shadow-lift"
            style={{
              left: `${((PLOT.left + slot * (hovered + 0.5)) / WIDTH) * 100}%`,
            }}
          >
            <p className="font-semibold text-ink">Year {hoveredYear.period}</p>
            <TooltipRow
              className="bg-principal"
              label="Principal"
              cents={hoveredYear.principalCents}
            />
            <TooltipRow
              className="bg-interest"
              label="Interest"
              cents={hoveredYear.interestCents}
            />
            <p className="mt-1 flex justify-between border-t border-line pt-1 text-muted">
              Balance{" "}
              <span className="text-ink tabular-nums">
                {formatCents(hoveredYear.balanceCents, { wholeDollars: true })}
              </span>
            </p>
          </div>
        )}
      </div>
    </figure>
  );
}

function LegendKey({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden="true" className={`size-3 rounded-sm ${className}`} />
      {label}
    </span>
  );
}

function TooltipRow({
  className,
  label,
  cents,
}: {
  className: string;
  label: string;
  cents: number;
}) {
  return (
    <p className="mt-1 flex items-center justify-between gap-2 text-muted">
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className={`size-2 rounded-sm ${className}`} />
        {label}
      </span>
      <span className="text-ink tabular-nums">
        {formatCents(cents, { wholeDollars: true })}
      </span>
    </p>
  );
}

/** A bar whose top corners are rounded and whose bottom sits square. */
function roundedTopBar(x: number, top: number, width: number, height: number) {
  if (height <= 0) return "";

  const r = Math.min(RADIUS, height, width / 2);

  return [
    `M${x},${top + height}`,
    `V${top + r}`,
    `Q${x},${top} ${x + r},${top}`,
    `H${x + width - r}`,
    `Q${x + width},${top} ${x + width},${top + r}`,
    `V${top + height}`,
    "Z",
  ].join(" ");
}

/** The smallest round number at or above the value, for the top of the axis. */
function niceCeiling(cents: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(cents));

  // Half steps keep the top close to the tallest bar: $1.2K tops out at
  // $1.5K, not $2K.
  for (const step of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (step * magnitude >= cents) return step * magnitude;
  }

  return 10 * magnitude;
}

/** `800000` cents → `"$8K"`. */
function compactDollars(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
  });
}

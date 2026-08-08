/**
 * Soft white dot that travels the fixture tile perimeter at constant linear
 * speed. Sized from the tile (ResizeObserver) so mobile and desktop match.
 * Avoids SVG filters — they often break or stutter on mobile WebKit.
 */
import React, { useEffect, useRef, useState } from "react";

type Props = {
  color: string;
};

const RX = 12; // Tailwind rounded-xl
const PAD = 1.5;
/** Tiny dash + round caps → glowing dot, not a line. */
const DOT_LEN = 0.8;
const LOOP_S = 2.8;

export default function ChipPerimeterBeam({ color }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const parent = svgRef.current?.parentElement;
    if (!parent) return;

    const update = () => {
      const { width, height } = parent.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      setSize((prev) =>
        prev.w === width && prev.h === height ? prev : { w: width, h: height },
      );
    };

    update();
    const raf = requestAnimationFrame(update);
    const ro = new ResizeObserver(update);
    ro.observe(parent);
    window.addEventListener("orientationchange", update);
    window.addEventListener("resize", update);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("orientationchange", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const w = Math.max(0, size.w - PAD * 2);
  const h = Math.max(0, size.h - PAD * 2);
  const rx = Math.min(RX, w / 2, h / 2);
  const dash = `${DOT_LEN} ${100 - DOT_LEN}`;

  return (
    <svg
      ref={svgRef}
      className="pointer-events-none absolute inset-0 z-[1] h-full w-full overflow-visible"
      width={size.w || "100%"}
      height={size.h || "100%"}
      aria-hidden
    >
      {w > 0 && h > 0 && (
        <>
          <rect
            x={PAD}
            y={PAD}
            width={w}
            height={h}
            rx={rx}
            ry={rx}
            pathLength={100}
            fill="none"
            stroke={color}
            strokeWidth={2}
            opacity={0.9}
          />

          {/* Soft halo */}
          <rect
            x={PAD}
            y={PAD}
            width={w}
            height={h}
            rx={rx}
            ry={rx}
            pathLength={100}
            fill="none"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth={6.5}
            strokeLinecap="round"
            strokeDasharray={dash}
            strokeDashoffset={0}
            className="chip-perimeter-beam"
            style={{ animationDuration: `${LOOP_S}s` }}
          />

          {/* Bright core */}
          <rect
            x={PAD}
            y={PAD}
            width={w}
            height={h}
            rx={rx}
            ry={rx}
            pathLength={100}
            fill="none"
            stroke="#ffffff"
            strokeWidth={3.25}
            strokeLinecap="round"
            strokeDasharray={dash}
            strokeDashoffset={0}
            className="chip-perimeter-beam"
            style={{ animationDuration: `${LOOP_S}s` }}
          />
        </>
      )}
    </svg>
  );
}

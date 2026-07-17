import React, { useState } from "react";
import { Target } from "lucide-react";

interface SportTileGraphicProps {
  sport: "football" | "rugby";
  className?: string;
}

const SPORT_IMAGES = {
  football: "/penalty-kick.png",
  rugby: "/rugby-pitch.png",
} as const;

const GLOW_CLASS = {
  football:
    "group-hover:drop-shadow-[0_0_14px_rgba(59,130,246,0.7)] group-active:drop-shadow-[0_0_14px_rgba(59,130,246,0.7)]",
  rugby:
    "group-hover:drop-shadow-[0_0_14px_rgba(245,158,11,0.7)] group-active:drop-shadow-[0_0_14px_rgba(245,158,11,0.7)]",
} as const;

export default function SportTileGraphic({
  sport,
  className = "",
}: SportTileGraphicProps) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div
      className={`relative flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 shrink-0 ${className}`}
    >
      {imageFailed ? (
        <Target
          className={`w-8 h-8 text-white/80 ${GLOW_CLASS[sport]}`}
          aria-hidden
        />
      ) : (
        <img
          src={SPORT_IMAGES[sport]}
          alt=""
          aria-hidden
          draggable={false}
          onError={() => setImageFailed(true)}
          className={`w-full h-full object-contain brightness-0 invert transition-all duration-300 ease-out scale-100 group-hover:scale-110 group-active:scale-110 ${GLOW_CLASS[sport]}`}
        />
      )}
    </div>
  );
}

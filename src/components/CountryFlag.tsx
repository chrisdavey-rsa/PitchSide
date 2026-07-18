import React, { useState } from "react";
import { Globe } from "lucide-react";

interface CountryFlagProps {
  /** Lowercase flagcdn code (e.g. `gb`, `gb-eng`, `nz`). */
  code?: string | null;
  alt?: string;
  /** Pixel width hint for flagcdn `w40` assets. */
  size?: number;
  className?: string;
}

/**
 * High-availability flag via flagcdn.com with Globe fallback on load failure.
 */
export default function CountryFlag({
  code,
  alt = "Flag",
  size = 20,
  className = "",
}: CountryFlagProps) {
  const [failed, setFailed] = useState(false);
  const normalized = (code || "").trim().toLowerCase();

  if (!normalized || failed) {
    return (
      <Globe
        className={`shrink-0 text-slate-500 ${className}`}
        style={{ width: size, height: size }}
        aria-label={alt}
      />
    );
  }

  return (
    <img
      src={`https://flagcdn.com/w40/${normalized}.png`}
      width={size}
      height={Math.round(size * 0.75)}
      alt={alt}
      className={`rounded-sm object-cover select-none inline-block align-middle shrink-0 ${className}`}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

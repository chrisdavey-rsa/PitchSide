/**
 * Side-profile F1 helmet glyph tinted with constructor colour.
 */

import React from 'react';

type Props = {
  colorHex?: string | null;
  className?: string;
  title?: string;
};

export default function F1HelmetIcon({
  colorHex = '#94a3b8',
  className = 'h-8 w-8',
  title,
}: Props) {
  const fill = colorHex || '#94a3b8';
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M10 34c2-14 14-24 28-24 12 0 22 8 24 20 1 6-2 12-8 15H18c-5-2-9-6-8-11z"
        fill={fill}
        opacity="0.95"
      />
      <path
        d="M18 42h28c2 0 4 2 4 4v2c0 2-2 4-4 4H18c-2 0-4-2-4-4v-2c0-2 2-4 4-4z"
        fill={fill}
      />
      <path
        d="M22 28c6-2 14-2 20 0 1 3-1 6-4 7H26c-3-1-5-4-4-7z"
        fill="#0f172a"
        opacity="0.85"
      />
      <path
        d="M12 36h8l2 8H14l-2-8z"
        fill="#0f172a"
        opacity="0.35"
      />
    </svg>
  );
}

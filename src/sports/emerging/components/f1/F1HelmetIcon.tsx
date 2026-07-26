/**
 * F1 helmet icon — local public-folder .png photos via <img>, with chip fallback.
 * Always prefers HELMET_MAP by constructor id; ignores remote helmet URLs.
 */

import React, { useEffect, useState } from 'react';
import { HELMET_MAP } from '../../f1HelmetAssets';

type ConstructorLike = { id?: string | null } | null | undefined;

type Props = {
  /** Constructor id (mclaren, racing_bulls, …). */
  constructorId?: string | null;
  /** Snake-case variant from DB-shaped objects. */
  constructor_id?: string | null;
  /** Nested constructor object with an `id` field. */
  constructor?: ConstructorLike;
  /**
   * Ignored — remote/DB helmet URLs must not override local HELMET_MAP assets.
   * Kept optional so call sites can still pass the prop without breaking.
   */
  imageUrl?: string | null;
  /** Accent colour for the load-failure fallback chip. */
  colorHex?: string | null;
  className?: string;
  title?: string;
  /** Override lazy loading for above-the-fold / drag overlay icons. */
  loading?: 'lazy' | 'eager';
};

export default function F1HelmetIcon({
  constructorId,
  constructor_id,
  constructor,
  colorHex = '#94a3b8',
  className = 'h-6 w-6 sm:h-8 sm:w-8',
  title,
  loading = 'lazy',
}: Props) {
  const rawId = constructorId || constructor_id || constructor?.id || '';
  const safeId = rawId.toLowerCase().trim();
  const finalId = safeId === 'rb' ? 'racing_bulls' : safeId;
  const imagePath = HELMET_MAP[finalId];
  // Always use local map — never remote helmet_image_url / helmetImageUrl.
  const photoSrc = imagePath ? encodeURI(imagePath) : null;

  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [finalId]);

  if (photoSrc && !hasError) {
    return (
      <img
        src={photoSrc}
        alt={title || ''}
        title={title || undefined}
        aria-hidden={title ? undefined : true}
        draggable={false}
        loading={loading}
        decoding="async"
        onError={() => setHasError(true)}
        className={`object-contain object-center shrink-0 select-none ${className}`}
      />
    );
  }

  // Legacy colored chip fallback when mapping is missing or the asset fails.
  const accent = colorHex || '#94a3b8';
  return (
    <span
      title={title || undefined}
      aria-hidden={title ? undefined : true}
      className={`inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-950 shrink-0 ${className}`}
      style={{ boxShadow: `inset 0 0 0 2px ${accent}55` }}
    >
      <span
        className="block h-2 w-2 rounded-full"
        style={{ backgroundColor: accent }}
      />
    </span>
  );
}

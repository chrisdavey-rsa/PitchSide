/**
 * Public-folder F1 constructor helmet photos (.png).
 * Filenames must match uploaded assets exactly (spelling, casing, spaces).
 */

/** Exact constructor id → public path map (11 teams). */
export const HELMET_MAP: Record<string, string> = {
  racing_bulls: '/racing bulls racing helmet.png',
  red_bull: '/Red bull racing helmet.png',
  williams: '/williams racing helment.png',
  alpine: '/alpine racing helmet.png',
  aston_martin: '/aston martin racing helmet.png',
  audi: '/audi racing helmet.png',
  cadillac: '/cadillac racing helmet.png',
  ferrari: '/ferrari racing helmet.png',
  haas: '/haas racing helmet.png',
  mclaren: '/mclaren racing helmet.png',
  mercedes: '/mercedes racing helmet.png',
};

/** Canonical full display names — never abbreviate (e.g. RB → Racing Bulls). */
export const F1_CONSTRUCTOR_DISPLAY_NAME: Record<string, string> = {
  racing_bulls: 'Racing Bulls',
  rb: 'Racing Bulls',
  red_bull: 'Red Bull Racing',
  williams: 'Williams',
  alpine: 'Alpine',
  aston_martin: 'Aston Martin',
  audi: 'Audi',
  cadillac: 'Cadillac',
  ferrari: 'Ferrari',
  haas: 'Haas',
  mclaren: 'McLaren',
  mercedes: 'Mercedes',
};

/** Normalize constructor id and resolve legacy `rb` → `racing_bulls`. */
export function normalizeConstructorId(
  constructorId?: string | null,
): string {
  const safeId = (constructorId || '').toLowerCase().trim();
  return safeId === 'rb' ? 'racing_bulls' : safeId;
}

export function helmetSrcForConstructor(
  constructorId?: string | null,
): string | null {
  const finalId = normalizeConstructorId(constructorId);
  if (!finalId) return null;
  const path = HELMET_MAP[finalId];
  // encodeURI keeps spaces/casing intact while making the URL browser-safe.
  return path ? encodeURI(path) : null;
}

/** Prefer full legal/team name; never leave "RB" as the UI label. */
export function displayConstructorName(
  constructorId?: string | null,
  rawName?: string | null,
): string {
  const finalId = normalizeConstructorId(constructorId);
  if (finalId && F1_CONSTRUCTOR_DISPLAY_NAME[finalId]) {
    return F1_CONSTRUCTOR_DISPLAY_NAME[finalId];
  }
  if (constructorId && F1_CONSTRUCTOR_DISPLAY_NAME[constructorId]) {
    return F1_CONSTRUCTOR_DISPLAY_NAME[constructorId];
  }
  const trimmed = (rawName || '').trim();
  if (!trimmed || /^rb$/i.test(trimmed) || /^r\.?b\.?r?$/i.test(trimmed)) {
    return 'Racing Bulls';
  }
  return trimmed;
}

import React, { useMemo, useState } from "react";

const PALETTE = [
  "bg-emerald-600",
  "bg-sky-600",
  "bg-violet-600",
  "bg-amber-600",
  "bg-rose-600",
  "bg-teal-600",
  "bg-indigo-600",
  "bg-orange-600",
] as const;

function hashHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h % PALETTE.length;
}

export function getInitials(
  nickname?: string | null,
  firstName?: string | null,
  surname?: string | null,
): string {
  const fromNames = `${(firstName || "").trim().charAt(0)}${(surname || "").trim().charAt(0)}`;
  if (fromNames.trim()) return fromNames.toUpperCase();
  const nick = (nickname || "").trim();
  if (nick.length >= 2) return nick.slice(0, 2).toUpperCase();
  if (nick.length === 1) return nick.toUpperCase();
  return "?";
}

type InitialsAvatarProps = {
  nickname?: string | null;
  firstName?: string | null;
  surname?: string | null;
  /** Optional Google / OAuth photo URL — falls back to initials when missing or broken. */
  photoUrl?: string | null;
  sizeClassName?: string;
  className?: string;
  title?: string;
};

/**
 * Colored initials circle with optional photo overlay.
 * Used when Google profile pictures are missing.
 */
export default function InitialsAvatar({
  nickname,
  firstName,
  surname,
  photoUrl,
  sizeClassName = "w-7 h-7 text-[10px]",
  className = "",
  title,
}: InitialsAvatarProps) {
  const initials = useMemo(
    () => getInitials(nickname, firstName, surname),
    [nickname, firstName, surname],
  );
  const seed = nickname || `${firstName ?? ""}${surname ?? ""}` || initials;
  const bg = PALETTE[hashHue(seed)];
  const [imgFailed, setImgFailed] = useState(false);
  const showPhoto = Boolean(photoUrl) && !imgFailed;

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold text-white ${bg} ${sizeClassName} ${className}`}
      title={title ?? nickname ?? undefined}
      aria-hidden={!title}
    >
      {showPhoto ? (
        <img
          src={photoUrl!}
          alt=""
          className="absolute inset-0 h-full w-full rounded-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        initials
      )}
    </span>
  );
}

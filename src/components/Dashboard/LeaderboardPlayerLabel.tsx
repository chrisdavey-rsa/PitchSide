import React from "react";
import InitialsAvatar from "../ui/InitialsAvatar";

/** Compact real-name line under a leaderboard nickname. */
export function formatPlayerRealName(
  firstName?: string | null,
  surname?: string | null,
): string {
  return [firstName, surname]
    .map((part) => (part || "").trim())
    .filter(Boolean)
    .join(" ");
}

type LeaderboardPlayerLabelProps = {
  nickname: string;
  firstName?: string | null;
  surname?: string | null;
  photoUrl?: string | null;
  showAvatar?: boolean;
  /** Nickname colour / weight classes (without truncate — applied on both lines' container). */
  nicknameClassName?: string;
  /** Optional class on the stacked column wrapper. */
  className?: string;
};

/**
 * Username on top, first + surname underneath in smaller refined type.
 * Truncates within the parent width — does not widen rows.
 */
export default function LeaderboardPlayerLabel({
  nickname,
  firstName,
  surname,
  photoUrl,
  showAvatar = true,
  nicknameClassName = "text-slate-100",
  className = "",
}: LeaderboardPlayerLabelProps) {
  const realName = formatPlayerRealName(firstName, surname);

  return (
    <span className={`flex min-w-0 items-center gap-2 ${className}`}>
      {showAvatar ? (
        <InitialsAvatar
          nickname={nickname}
          firstName={firstName}
          surname={surname}
          photoUrl={photoUrl}
          sizeClassName="w-7 h-7 text-[10px]"
        />
      ) : null}
      <span className="flex min-w-0 flex-col leading-tight">
        <span className={`truncate font-semibold ${nicknameClassName}`}>
          {nickname}
        </span>
        {realName ? (
          <span
            className="truncate text-[9px] font-light tracking-[0.04em] text-slate-500"
            title={realName}
          >
            {realName}
          </span>
        ) : null}
      </span>
    </span>
  );
}

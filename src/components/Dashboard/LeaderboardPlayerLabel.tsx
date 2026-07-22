import React from "react";

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
  nicknameClassName = "text-slate-100",
  className = "",
}: LeaderboardPlayerLabelProps) {
  const realName = formatPlayerRealName(firstName, surname);

  return (
    <span className={`flex min-w-0 flex-col leading-tight ${className}`}>
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
  );
}

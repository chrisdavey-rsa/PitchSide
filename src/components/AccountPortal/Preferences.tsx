/**
 * Account Preferences — friend activity notification control.
 * Mounted inside GeneralSettings (Account Portal → Preferences).
 */

import React from "react";

export type FriendActivityToggleProps = {
  enabled: boolean;
  /** Global push / notifications gate. */
  globalNotificationsEnabled: boolean;
  busy?: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
};

export function FriendActivityToggle({
  enabled,
  globalNotificationsEnabled,
  busy = false,
  disabled = false,
  onChange,
}: FriendActivityToggleProps) {
  const locked = !globalNotificationsEnabled || disabled || busy;

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <h4 className="text-xs font-bold text-slate-200">
          Follow Friends&apos; Activity (Notify when friends make picks)
        </h4>
        <p className="text-[10px] text-slate-400 mt-1">
          Get alerted when players you follow submit predictions.
        </p>
        {!globalNotificationsEnabled ? (
          <p className="text-[10px] text-amber-400/90 mt-1">
            Global notifications must be enabled to receive friend alerts.
          </p>
        ) : null}
      </div>
      <label
        className={`relative inline-flex items-center ${locked ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <input
          type="checkbox"
          className="sr-only peer"
          checked={enabled && globalNotificationsEnabled}
          disabled={locked}
          onChange={(e) => onChange(e.target.checked)}
          aria-label="Follow friends activity notifications"
        />
        <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 peer-disabled:opacity-40" />
      </label>
    </div>
  );
}

export default FriendActivityToggle;

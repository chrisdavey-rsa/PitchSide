/**
 * Shared centered modal overlay — fits within the viewport (no page scroll),
 * uses dynamic viewport height, and standardizes mobile padding.
 */

import React from "react";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";

type AppModalShellProps = {
  open?: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  /** Panel max-width utility, e.g. max-w-sm / max-w-md */
  maxWidthClass?: string;
  /** Extra classes on the panel (border, bg, rounded). */
  panelClassName?: string;
  /** z-index utility, default z-[80] */
  zClass?: string;
  /**
   * When true (default), clip tall content inside 90dvh without growing the page.
   * Set false when a tooltip must escape the panel (caller handles fit).
   */
  clipPanel?: boolean;
  /** Allow vertical scroll inside the panel when content exceeds 90dvh. */
  scrollBody?: boolean;
  role?: string;
  "aria-labelledby"?: string;
  "aria-modal"?: boolean | "true" | "false";
};

export default function AppModalShell({
  open = true,
  onClose,
  children,
  maxWidthClass = "max-w-md",
  panelClassName = "rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl",
  zClass = "z-[80]",
  clipPanel = true,
  scrollBody = false,
  role = "dialog",
  "aria-labelledby": ariaLabelledBy,
  "aria-modal": ariaModal = true,
}: AppModalShellProps) {
  useBodyScrollLock(open);
  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 ${zClass} flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm`}
      role={role}
      aria-modal={ariaModal}
      aria-labelledby={ariaLabelledBy}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className={`relative w-full ${maxWidthClass} max-h-[90dvh] flex flex-col ${
          clipPanel ? "overflow-hidden" : "overflow-visible"
        } ${panelClassName}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`min-h-0 flex-1 ${
            scrollBody ? "overflow-y-auto overflow-x-hidden overscroll-contain" : "overflow-visible"
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

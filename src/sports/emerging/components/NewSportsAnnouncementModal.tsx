/**
 * Announcement modal for existing users when Golf / F1 unlock globally.
 */

import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Sparkles, X } from 'lucide-react';
import { EMERGING_SPORT_META, type EmergingSportKey } from '../types';
import { SportIcon } from '../sportIcons';

export type NewSportsAnnouncementModalProps = {
  open: boolean;
  unlockedSports?: EmergingSportKey[];
  onClose: () => void;
  onGoToSettings: () => void;
};

export default function NewSportsAnnouncementModal({
  open,
  unlockedSports = ['golf', 'formula1'],
  onClose,
  onGoToSettings,
}: NewSportsAnnouncementModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="emerging-sports-announce-title"
            initial={{ y: 24, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-violet-500/30 bg-slate-950 shadow-2xl overflow-hidden"
          >
            <div className="relative p-5 sm:p-6">
              <button
                type="button"
                onClick={onClose}
                className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-500 hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-violet-300">
                <Sparkles className="h-3 w-3" />
                New sports unlocked
              </div>

              <h2
                id="emerging-sports-announce-title"
                className="mt-3 text-xl font-semibold text-white"
              >
                Golf & Formula 1 are here
              </h2>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Add them to your preferred sports in profile settings to unlock
                prediction screens and onboarding.
              </p>

              <ul className="mt-4 space-y-2">
                {unlockedSports.map((key) => {
                  const meta = EMERGING_SPORT_META[key];
                  return (
                    <li
                      key={key}
                      className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2.5"
                    >
                      <SportIcon sport={key} colored className="h-6 w-6" />
                      <span className="text-sm font-semibold text-slate-200">
                        {meta.label}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-5 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={onGoToSettings}
                  className="flex-1 rounded-xl bg-violet-600 hover:bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Open profile settings
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-300 hover:text-white"
                >
                  Later
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

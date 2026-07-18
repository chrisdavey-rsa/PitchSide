/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X, ArrowRight, ArrowLeft, Sparkles } from "lucide-react";

export interface TourStep {
  /** id of the DOM element to spotlight. If it isn't mounted, the step is shown as a centered card. */
  targetId: string;
  title: string;
  description: string;
  /** Prefer tooltip above/below the target (auto picks based on space). */
  placement?: "auto" | "above" | "below";
  onEnter?: () => void;
  onExit?: () => void;
}

interface OnboardingTourProps {
  steps: TourStep[];
  onComplete: () => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const SPOTLIGHT_PADDING = 8;

export default function OnboardingTour({ steps, onComplete }: OnboardingTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const isFirst = stepIndex === 0;

  const measure = useCallback(() => {
    if (!step) return;
    const el = document.getElementById(step.targetId);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) {
      setRect(null);
      return;
    }
    setRect({
      top: r.top - SPOTLIGHT_PADDING,
      left: r.left - SPOTLIGHT_PADDING,
      width: r.width + SPOTLIGHT_PADDING * 2,
      height: r.height + SPOTLIGHT_PADDING * 2,
    });
  }, [step]);

  useLayoutEffect(() => {
    const el = step ? document.getElementById(step.targetId) : null;
    if (el) {
      // Bottom-nav targets: keep them pinned; avoid scrolling the page under the bar.
      const nearBottom =
        el.getBoundingClientRect().bottom > window.innerHeight - 140;
      if (!nearBottom) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
    measure();
    const t = window.setTimeout(measure, 400);
    return () => window.clearTimeout(t);
  }, [step, measure]);

  useEffect(() => {
    if (!step) return;
    step.onEnter?.();
    return () => {
      step.onExit?.();
    };
  }, [step]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onComplete();
      if (e.key === "ArrowRight") setStepIndex((i) => Math.min(steps.length - 1, i + 1));
      if (e.key === "ArrowLeft") setStepIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onComplete, steps.length]);

  if (!step) return null;

  const goNext = () => (isLast ? onComplete() : setStepIndex((i) => i + 1));
  const goBack = () => setStepIndex((i) => Math.max(0, i - 1));

  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800;
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1200;
  const tooltipWidth = Math.min(340, viewportWidth - 32);

  let tooltipStyle: React.CSSProperties;
  if (rect) {
    const spaceBelow = viewportHeight - (rect.top + rect.height);
    const spaceAbove = rect.top;
    const nearBottom = rect.top + rect.height > viewportHeight - 160;

    let placeBelow: boolean;
    if (step.placement === "above") placeBelow = false;
    else if (step.placement === "below") placeBelow = true;
    else if (nearBottom) placeBelow = false;
    else placeBelow = spaceBelow > 220 || spaceBelow >= spaceAbove;

    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    left = Math.max(16, Math.min(left, viewportWidth - tooltipWidth - 16));

    if (placeBelow) {
      const top = Math.min(rect.top + rect.height + 12, viewportHeight - 220);
      tooltipStyle = { top: Math.max(12, top), left, width: tooltipWidth };
    } else {
      // Prefer CSS bottom so tooltips sit cleanly above the bottom nav.
      const bottomGap = viewportHeight - rect.top + 12;
      tooltipStyle = {
        bottom: Math.max(12, Math.min(bottomGap, viewportHeight - 80)),
        left,
        width: tooltipWidth,
      };
    }
  } else {
    tooltipStyle = {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: tooltipWidth,
    };
  }

  const overlay = (
    <div className="fixed inset-0 z-[200] font-sans">
      <div className="absolute inset-0" />

      <AnimatePresence mode="wait">
        {rect ? (
          <motion.div
            key={`spotlight-${stepIndex}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute rounded-2xl pointer-events-none border-2 border-emerald-400/70"
            style={{
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              boxShadow:
                "0 0 0 9999px rgba(2, 6, 23, 0.82), 0 0 30px rgba(16, 185, 129, 0.35)",
            }}
          />
        ) : (
          <motion.div
            key="dim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/82"
          />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.div
          key={`tooltip-${stepIndex}`}
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ type: "spring", damping: 24, stiffness: 320 }}
          className="fixed z-[201] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-5"
          style={tooltipStyle}
        >
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="bg-emerald-500/15 border border-emerald-500/30 p-1.5 rounded-lg shrink-0">
                <Sparkles className="w-4 h-4 text-emerald-400" />
              </div>
              <h4 className="text-sm font-bold font-display text-white uppercase tracking-wide truncate">
                {step.title}
              </h4>
            </div>
            <button
              type="button"
              onClick={onComplete}
              className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer shrink-0"
              title="Skip tour"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">{step.description}</p>

          <div className="flex items-center justify-between mt-5 gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              {steps.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === stepIndex ? "w-5 bg-emerald-400" : "w-1.5 bg-slate-700"
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-wider shrink-0">
              {!isFirst && (
                <button
                  type="button"
                  onClick={goBack}
                  className="flex items-center gap-1 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={goNext}
                className="flex items-center gap-1 text-white bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded-lg cursor-pointer transition-colors shadow-md shadow-emerald-950/40"
              >
                {isLast ? "Finish" : "Next"}
                {!isLast && <ArrowRight className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onComplete}
            className="mt-3 w-full text-center text-[10px] font-mono uppercase tracking-widest text-slate-600 hover:text-slate-400 transition-colors cursor-pointer"
          >
            Skip tour
          </button>
        </motion.div>
      </AnimatePresence>
    </div>
  );

  return createPortal(overlay, document.body);
}

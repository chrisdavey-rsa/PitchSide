import React from 'react';
import { motion } from 'motion/react';

interface PitchSideLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  autoplay?: boolean;
}

/**
 * The PitchSide wordmark. Renders "PitchSide" plus the signature colour-cycling
 * dot in a single, stable layout — the whole mark reveals in place so it never
 * reflows or clips while animating in.
 */
export default function PitchSideLogo({ size = 'md', autoplay = true }: PitchSideLogoProps) {
  const dotColors = ['#3b82f6', '#22c55e', '#ffffff', '#ef4444', '#3b82f6'];

  const sizes = {
    sm: { text: 'text-lg font-bold', dotSize: 6, gap: 'ml-0.5', dip: 4 },
    md: { text: 'text-2xl font-bold tracking-tight', dotSize: 8, gap: 'ml-0.5', dip: 5 },
    lg: { text: 'text-4xl font-extrabold tracking-tight md:text-5xl', dotSize: 12, gap: 'ml-1', dip: 6 },
    xl: { text: 'text-6xl font-black tracking-tight md:text-7xl', dotSize: 16, gap: 'ml-1', dip: 8 },
  };

  const currentSize = sizes[size];

  const wordReveal = autoplay
    ? {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
      }
    : { initial: false as const };

  const dotReveal = autoplay
    ? { delay: 0.45, type: 'spring' as const, stiffness: 400, damping: 18 }
    : { duration: 0 };

  return (
    <div className="flex items-end justify-center font-display select-none whitespace-nowrap leading-none">
      <motion.span className={`text-white ${currentSize.text}`} {...wordReveal}>
        PitchSide
      </motion.span>
      <motion.span
        initial={autoplay ? { scale: 0, opacity: 0 } : false}
        animate={{
          scale: 1,
          opacity: 1,
          backgroundColor: dotColors,
          boxShadow: dotColors.map((c) => `0 0 16px ${c}`),
        }}
        transition={{
          scale: dotReveal,
          opacity: dotReveal,
          backgroundColor: { duration: 6, ease: 'linear', repeat: Infinity, delay: autoplay ? 0.6 : 0 },
          boxShadow: { duration: 6, ease: 'linear', repeat: Infinity, delay: autoplay ? 0.6 : 0 },
        }}
        className={`rounded-full ${currentSize.gap} shrink-0`}
        style={{ width: currentSize.dotSize, height: currentSize.dotSize, marginBottom: currentSize.dip }}
      />
    </div>
  );
}

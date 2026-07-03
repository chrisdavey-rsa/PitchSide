import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';

interface PitchSideLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  autoplay?: boolean;
}

export default function PitchSideLogo({ size = 'md', autoplay = true }: PitchSideLogoProps) {
  const [complete, setComplete] = useState(!autoplay);

  // Define colors for the keyframe animation
  const dotColors = ['#3b82f6', '#22c55e', '#ffffff', '#ef4444', '#3b82f6'];

  useEffect(() => {
    if (autoplay) {
      const timer = setTimeout(() => setComplete(true), 1680);
      return () => clearTimeout(timer);
    }
  }, [autoplay]);

  const sizes = {
    sm: { text: 'text-lg font-bold', ballSize: 'w-4 h-4', dotSize: 6 },
    md: { text: 'text-2xl font-bold tracking-tight', ballSize: 'w-6 h-6', dotSize: 8 },
    lg: { text: 'text-4xl font-extrabold tracking-tight md:text-5xl', ballSize: 'w-12 h-12', dotSize: 12 },
    xl: { text: 'text-6xl font-black tracking-tight md:text-7xl', ballSize: 'w-16 h-16', dotSize: 16 },
  };

  const currentSize = sizes[size];

  if (!complete) {
    return (
      <div className={`relative h-10 w-full max-w-lg mx-auto flex items-center justify-start overflow-hidden bg-slate-950/20 rounded-xl px-4`}>
        <motion.div
          initial={{ x: -60, scale: 1.5, rotate: 0 }}
          animate={{ x: 280, scale: 0.3, rotate: 720, opacity: 0 }}
          transition={{ duration: 1.68, ease: [0.34, 1.56, 0.64, 1] }}
          className={`absolute rounded-full bg-linear-to-r from-blue-500 via-green-400 to-red-500 shadow-[0_0_20px_rgba(59,130,246,0.8)] flex items-center justify-center`}
          style={{ width: currentSize.ballSize, height: currentSize.ballSize }}
        >
          <div className="w-full h-full border border-dashed rounded-full border-white/40 scale-75 rotate-45" />
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0, duration: 0.4 }}
          className={`ml-[40px] ${currentSize.text} text-white font-display`}
        >
          PitchSide
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center font-display select-none">
      <div className="flex items-end">
        <span className={`text-white transition-all duration-300 ${currentSize.text}`}>
          PitchSide
        </span>
        <motion.span
          animate={{
            backgroundColor: dotColors,
            boxShadow: dotColors.map(c => `0 0 20px ${c}`)
          }}
          transition={{
            duration: 6,
            ease: 'linear',
            repeat: Infinity
          }}
          className="rounded-full ml-0.5 mb-[6px] shrink-0"
          style={{ width: currentSize.dotSize, height: currentSize.dotSize }}
        />
      </div>
    </div>
  );
}
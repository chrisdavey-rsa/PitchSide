import React from 'react';
import { motion } from 'motion/react';
import { Check, Zap } from 'lucide-react';
import CountryFlag from '../CountryFlag';
import { getCountryCode } from '../AccountPortal/data';

export const getCountryFlag = (countryName?: string): React.ReactNode => {
  return (
    <CountryFlag
      code={getCountryCode(countryName)}
      alt={countryName || 'Flag'}
      size={16}
    />
  );
};

export function MetallicTickWithLightning() {
  return (
    <div
      className="relative flex items-center justify-center w-6 h-6 shrink-0 bg-linear-to-b from-slate-800 to-emerald-950 border border-emerald-450 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.6)] overflow-hidden"
      title="Prediction Saved (Locked)"
    >
      <motion.div
        animate={{ left: ['-100%', '200%'] }}
        transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut', repeatDelay: 1 }}
        className="absolute top-0 bottom-0 w-3 bg-linear-to-r from-transparent via-white/45 to-transparent skew-x-12"
      />
      <motion.div
        animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
        transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
        className="absolute inset-0 border border-emerald-400 rounded-full blur-xs"
      />
      <div className="absolute inset-0 bg-emerald-500/5" />
      <div className="relative flex items-center justify-center">
        <Check className="w-3.5 h-3.5 text-emerald-405 stroke-[4px] relative drop-shadow-[0_0_6px_rgba(16,185,129,0.8)] text-emerald-400" />
        <motion.div
          animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.6, 1, 0.6] }}
          transition={{ repeat: Infinity, duration: 0.6, ease: 'easeInOut' }}
          className="absolute -top-1.5 -right-1 z-20"
        >
          <Zap className="w-2.5 h-2.5 text-yellow-450 fill-yellow-400 drop-shadow-[0_0_4px_rgba(234,179,8,0.9)]" />
        </motion.div>
      </div>
    </div>
  );
}

import React from 'react';
import { motion } from 'motion/react';
import { Check, Zap } from 'lucide-react';

export const getCountryFlag = (countryName?: string): React.ReactNode => {
  const getCountryCode = (name?: string): string => {
    if (!name) return 'gb';
    const c = name.toLowerCase().trim();
    if (c === 'uk' || c === 'united kingdom' || c === 'gb' || c === 'england') return 'gb';
    if (c === 'za' || c === 'south africa') return 'za';
    if (c === 'nz' || c === 'new zealand') return 'nz';
    if (c === 'au' || c === 'australia') return 'au';
    if (c === 'ie' || c === 'ireland') return 'ie';
    if (c === 'fr' || c === 'france') return 'fr';
    if (c === 'it' || c === 'italy') return 'it';
    if (c === 'jp' || c === 'japan') return 'jp';
    if (c === 'ar' || c === 'argentina' || c === 'los pumas') return 'ar';
    if (c === 'es' || c === 'spain') return 'es';
    if (c === 'de' || c === 'germany') return 'de';
    if (c === 'br' || c === 'brazil') return 'br';
    if (c === 'us' || c === 'united states' || c === 'usa') return 'us';
    if (c === 'ca' || c === 'canada') return 'ca';
    if (c === 'nl' || c === 'netherlands') return 'nl';
    if (c === 'pt' || c === 'portugal') return 'pt';
    if (c === 'in' || c === 'india') return 'in';
    if (c === 'ch' || c === 'switzerland') return 'ch';
    if (c === 'be' || c === 'belgium') return 'be';
    if (c === 'se' || c === 'sweden') return 'se';
    if (c === 'no' || c === 'norway') return 'no';
    if (c === 'fi' || c === 'finland') return 'fi';
    if (c === 'dk' || c === 'denmark') return 'dk';
    if (c === 'fiji' || c === 'fj') return 'fj';
    if (c === 'samoa' || c === 'ws') return 'ws';
    if (c === 'wales') return 'gb-wls';
    if (c === 'scotland') return 'gb-sct';
    return 'gb';
  };

  return (
    <img
      src={`https://flagcdn.com/16x12/${getCountryCode(countryName)}.png`}
      width="16"
      height="12"
      alt={countryName || 'GB'}
      className="rounded-xs object-cover select-none inline-block align-middle"
      referrerPolicy="no-referrer"
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

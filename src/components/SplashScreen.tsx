/**
 * Full-screen brand gate shown until platform initialization completes.
 */

import { motion } from 'motion/react';
import PitchSideLogo from './PitchSideLogo';
import PitchSideMark from './PitchSideMark';

export default function SplashScreen() {
  return (
    <motion.div
      key="splash"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.03 }}
      transition={{ duration: 0.55, ease: 'easeInOut' }}
      className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center z-50 p-6 text-center overflow-hidden"
    >
      <div className="absolute w-[520px] h-[520px] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] rounded-full bg-blue-500/5 blur-[100px] pointer-events-none" />

      <div className="relative flex flex-col items-center gap-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="drop-shadow-[0_12px_40px_rgba(16,185,129,0.25)]"
        >
          <PitchSideMark size={132} animate={true} />
        </motion.div>

        <PitchSideLogo size="xl" autoplay={true} />

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.5 }}
          className="text-[10px] text-slate-500 font-mono tracking-[0.35em] uppercase"
        >
          Play. Predict. Prevail.
        </motion.div>
      </div>
    </motion.div>
  );
}

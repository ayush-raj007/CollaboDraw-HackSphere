import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1000),
      setTimeout(() => setPhase(3), 3000), // exit
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center z-10"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, y: -50 }}
      transition={{ duration: 0.8 }}
    >
      <motion.h2 
        className="text-[4.5vw] font-black mb-[10vh] text-center"
        style={{ fontFamily: 'var(--font-display)' }}
        initial={{ opacity: 0, y: -20 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
      >
        Every Tool You Need.
      </motion.h2>

      <div className="flex gap-[4vw]">
        {['Freehand', 'Shapes', 'Stickies', 'Export'].map((tool, i) => (
          <motion.div 
            key={tool}
            className="flex flex-col items-center gap-4"
            initial={{ opacity: 0, y: 50 }}
            animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20, delay: phase >= 2 ? i * 0.15 : 0 }}
          >
            <div className="w-[8vw] h-[8vw] rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-2xl">
              <div className="w-[4vw] h-[4vw] rounded-full bg-gradient-to-br from-primary to-accent opacity-80" />
            </div>
            <span className="text-[1.5vw] font-medium text-white/80">{tool}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
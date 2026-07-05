import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 3500), // exit
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center z-10"
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.8 }}
    >
      <motion.div 
        className="w-[12vw] h-[12vw] rounded-3xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center shadow-[0_0_50px_rgba(139,92,246,0.5)] mb-[4vh]"
        initial={{ rotate: -90, scale: 0 }}
        animate={phase >= 1 ? { rotate: 0, scale: 1 } : { rotate: -90, scale: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        <svg width="5vw" height="5vw" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L2 22L12 18L22 22L12 2Z" fill="white"/>
        </svg>
      </motion.div>

      <motion.h1 
        className="text-[5vw] font-black tracking-tighter"
        style={{ fontFamily: 'var(--font-display)' }}
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6 }}
      >
        CollaboDraw
      </motion.h1>
      
      <motion.p 
        className="text-[1.5vw] text-white/60 mt-4 tracking-widest uppercase font-semibold"
        initial={{ opacity: 0 }}
        animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        Start Drawing Now
      </motion.p>
    </motion.div>
  );
}
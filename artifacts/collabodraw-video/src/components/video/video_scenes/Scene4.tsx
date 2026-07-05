import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 3500), // exit
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div className="absolute inset-0 flex items-center justify-center z-10"
      initial={{ opacity: 0, clipPath: 'circle(0% at 50% 50%)' }}
      animate={{ opacity: 1, clipPath: 'circle(150% at 50% 50%)' }}
      exit={{ opacity: 0, filter: 'blur(20px)' }}
      transition={{ duration: 1.2, ease: [0.76, 0, 0.24, 1] }}
    >
      <div className="absolute inset-0 z-0">
        <motion.img 
          src={`${import.meta.env.BASE_URL}images/team.png`}
          className="w-full h-full object-cover opacity-50 mix-blend-luminosity"
          initial={{ scale: 1.2 }}
          animate={{ scale: 1 }}
          transition={{ duration: 5, ease: "easeOut" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-bg-dark via-bg-dark/50 to-transparent" />
      </div>

      <div className="relative z-10 text-center">
        <motion.h2 
          className="text-[6vw] font-black tracking-tight"
          style={{ fontFamily: 'var(--font-display)' }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={phase >= 1 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.8 }}
        >
          Built for Teams.
        </motion.h2>
        <motion.p 
          className="text-[2vw] text-white/80 mt-4"
          initial={{ opacity: 0 }}
          animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.8 }}
        >
          Share links. Set permissions. Collaborate.
        </motion.p>
      </div>
    </motion.div>
  );
}
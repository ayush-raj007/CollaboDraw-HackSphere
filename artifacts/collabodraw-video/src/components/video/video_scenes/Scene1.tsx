import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2000),
      setTimeout(() => setPhase(4), 3500), // exit
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div className="absolute inset-0 flex items-center justify-center z-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
      transition={{ duration: 0.8 }}
    >
      <div className="text-center">
        <motion.h1 
          className="text-[8vw] font-black tracking-tighter leading-none"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {'COLLABODRAW'.split('').map((char, i) => (
            <motion.span 
              key={i} 
              style={{ display: 'inline-block' }}
              initial={{ opacity: 0, y: 50, scale: 0.8 }}
              animate={phase >= 1 ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 50, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20, delay: phase >= 1 ? i * 0.05 : 0 }}
              className={i < 7 ? "text-white" : "text-gradient"}
            >
              {char}
            </motion.span>
          ))}
        </motion.h1>
        
        <motion.p 
          className="text-[2vw] text-white/80 mt-6 tracking-wide font-medium"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          Brainstorm together, in real time.
        </motion.p>
      </div>
    </motion.div>
  );
}
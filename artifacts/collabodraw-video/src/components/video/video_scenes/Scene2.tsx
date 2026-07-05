import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 800),
      setTimeout(() => setPhase(3), 1500),
      setTimeout(() => setPhase(4), 3000), // exit
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div className="absolute inset-0 flex items-center justify-start px-[10vw] z-10"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="max-w-[40vw]">
        <motion.h2 
          className="text-[5vw] font-black tracking-tight leading-[1.1] mb-6"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          <motion.span 
            className="block"
            initial={{ opacity: 0, y: 30 }}
            animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.6 }}
          >
            Live Cursors.
          </motion.span>
          <motion.span 
            className="block text-gradient"
            initial={{ opacity: 0, y: 30 }}
            animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.6 }}
          >
            Zero Latency.
          </motion.span>
        </motion.h2>
      </div>
      
      {/* Abstract cursors flying around */}
      <div className="absolute right-[15vw] top-1/2 -translate-y-1/2 w-[30vw] h-[30vw]">
        {[
          { color: '#ec4899', delay: 0, path: [0, -100, 50, -50] },
          { color: '#3b82f6', delay: 0.2, path: [100, 50, -50, 100] },
          { color: '#10b981', delay: 0.4, path: [-50, 150, 100, -20] }
        ].map((cursor, i) => (
          <motion.div key={i} className="absolute"
            initial={{ opacity: 0, scale: 0 }}
            animate={phase >= 3 ? { opacity: 1, scale: 1, x: cursor.path, y: cursor.path.reverse() } : { opacity: 0, scale: 0 }}
            transition={{ 
              opacity: { duration: 0.4 },
              scale: { type: 'spring', stiffness: 300, damping: 20 },
              x: { duration: 3, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" },
              y: { duration: 4, ease: "easeInOut", repeat: Infinity, repeatType: "mirror", delay: 0.5 }
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 4L9.5 22L13.5 15.5L21 11.5L4 4Z" fill={cursor.color} stroke="white" strokeWidth="2" strokeLinejoin="round"/>
            </svg>
            <div className="mt-2 px-3 py-1 rounded-full text-xs font-bold text-white shadow-lg" style={{ backgroundColor: cursor.color }}>
              User {i+1}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
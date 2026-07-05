// Video Template - Main Video Entry
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';

export const SCENE_DURATIONS = {
  scene1: 4000,
  scene2: 3500,
  scene3: 3500,
  scene4: 4000,
  scene5: 4500
};

const SCENE_COMPONENTS: Record<string, React.ComponentType> = {
  scene1: Scene1,
  scene2: Scene2,
  scene3: Scene3,
  scene4: Scene4,
  scene5: Scene5,
};

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentSceneKey } = useVideoPlayer({ durations, loop });
  useEffect(() => { onSceneChange?.(currentSceneKey); }, [currentSceneKey, onSceneChange]);

  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '');
  const sceneIndex = Object.keys(SCENE_DURATIONS).indexOf(baseSceneKey);
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];

  return (
    <div className="w-full h-screen overflow-hidden relative bg-[#020617]">
      
      {/* Persistent Background Layer */}
      <div className="absolute inset-0 z-0">
        <video 
          src={`${import.meta.env.BASE_URL}videos/bg-liquid.mp4`}
          autoPlay 
          muted 
          loop 
          playsInline
          className="w-full h-full object-cover opacity-30 mix-blend-screen"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#020617]/80 to-transparent" />
      </div>

      {/* Persistent Midground Abstract Shapes */}
      <motion.div
        className="absolute w-[40vw] h-[40vw] rounded-full bg-[#8b5cf6]/20 blur-[100px] z-0 pointer-events-none"
        animate={{
          x: ['-10vw', '50vw', '10vw', '80vw', '50vw'][sceneIndex] ?? '50vw',
          y: ['-10vh', '40vh', '10vh', '60vh', '50vh'][sceneIndex] ?? '50vh',
          scale: [1, 1.5, 0.8, 1.2, 1][sceneIndex] ?? 1,
        }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute w-[30vw] h-[30vw] rounded-full bg-[#ec4899]/20 blur-[80px] z-0 pointer-events-none"
        animate={{
          x: ['60vw', '10vw', '70vw', '20vw', '50vw'][sceneIndex] ?? '50vw',
          y: ['50vh', '10vh', '60vh', '20vh', '50vh'][sceneIndex] ?? '50vh',
          scale: [1.2, 0.9, 1.4, 0.8, 1][sceneIndex] ?? 1,
        }}
        transition={{ duration: 2, ease: "easeInOut" }}
      />

      {/* Scene Content */}
      <AnimatePresence mode="popLayout">
        {SceneComponent && <SceneComponent key={currentSceneKey} />}
      </AnimatePresence>
    </div>
  );
}
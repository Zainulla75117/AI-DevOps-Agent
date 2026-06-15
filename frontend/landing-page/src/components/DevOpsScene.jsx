import { Suspense, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import InfinityLogo from './InfinityLogo';
import DevOpsLabels from './DevOpsLabels';
import Particles from './Particles';
import { useTheme } from '../contexts/ThemeContext';

// Camera controller for smooth mouse parallax
function CameraController() {
  const { camera } = useThree();
  const mouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMouseMove = (e) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', onMouseMove);
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, []);

  useFrame(() => {
    const targetX = mouse.current.x * 1.5;
    const targetY = mouse.current.y * 1.5;
    camera.position.x += (targetX - camera.position.x) * 0.02;
    camera.position.y += (targetY - camera.position.y) * 0.02;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

export default function DevOpsScene() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="w-full h-full relative pointer-events-auto">
      <Canvas
        camera={{ position: [0, 0, 16], fov: 45 }}
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2
        }}
      >
        <fogExp2 attach="fog" args={[isDark ? '#050816' : '#f8fafc', 0.025]} />

        {/* Lights based on reference code */}
        <ambientLight intensity={0.5} color="#ffffff" />
        <pointLight position={[-6, 6, 6]} intensity={200} distance={50} color="#3b82f6" />
        <pointLight position={[6, -6, -4]} intensity={200} distance={50} color="#10b981" />
        <directionalLight position={[0, 10, -10]} intensity={3} color="#ffffff" />
        <directionalLight position={[0, 0, 10]} intensity={1.5} color="#ffffff" />

        {/* Environment Map generated from colored boxes like reference code */}
        <Environment key={theme} frames={1} resolution={256}>
          <color attach="background" args={[isDark ? '#050816' : '#ffffff']} />
          {/* Blue box */}
          <Lightformer form="box" intensity={2} color="#3b82f6" position={[10, 10, 10]} scale={[4, 4, 4]} />
          {/* Green box */}
          <Lightformer form="box" intensity={2} color="#10b981" position={[-10, -10, -10]} scale={[4, 4, 4]} />
          {/* White box */}
          <Lightformer form="box" intensity={2} color="#ffffff" position={[0, 10, -10]} scale={[4, 4, 4]} />
        </Environment>

        <Suspense fallback={null}>
          <InfinityLogo />
          <Particles count={600} />

          <EffectComposer disableNormalPass>
            <Bloom
              luminanceThreshold={0.3}
              mipmapBlur
              intensity={1.2}
              radius={0.6}
            />
          </EffectComposer>
        </Suspense>

        <CameraController />
      </Canvas>
    </div>
  );
}

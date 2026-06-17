import { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { curveInstance } from './InfinityLogo';

const labels = [
  'PLAN', 'CODE', 'BUILD', 'TEST', 
  'RELEASE', 'DEPLOY', 'OPERATE', 'MONITOR'
];

function Label({ text, t }) {
  const groupRef = useRef();
  const divRef = useRef();
  const { camera } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);

  const position = useMemo(() => curveInstance.getPoint(t), [t]);

  useFrame((state) => {
    if (!groupRef.current || !divRef.current) return;
    
    // Get the world position of this specific point on the curve
    groupRef.current.getWorldPosition(target);
    const distance = camera.position.distanceTo(target);
    
    // Reference math
    // distance ~14 -> scale 1, opacity 1
    // distance ~18 -> scale 0.6, opacity 0.3
    const scale = Math.max(0.5, 1 - (distance - 14) / 5);
    const baseOpacity = Math.max(0.2, 1 - (distance - 14) / 4);
    
    // Initial fade in
    const fadeMultiplier = Math.min(1, state.clock.elapsedTime * 1.5);
    const finalOpacity = baseOpacity * fadeMultiplier;

    // Apply styles directly to bypass React renders for performance
    divRef.current.style.opacity = finalOpacity.toString();
    divRef.current.style.transform = `scale(${scale})`;
    
    if (scale > 0.85) {
      divRef.current.classList.add('active');
      divRef.current.style.zIndex = '10';
    } else {
      divRef.current.classList.remove('active');
      divRef.current.style.zIndex = '1';
    }
  });

  return (
    <group ref={groupRef} position={position}>
      <Html center>
        <div 
          ref={divRef}
          className="px-4 py-2 text-xs font-sans font-bold tracking-[0.2em] rounded-full border border-white/10 shadow-lg whitespace-nowrap bg-[#0f172a]/90 text-white will-change-transform"
        >
          {text}
        </div>
      </Html>
    </group>
  );
}

export default function DevOpsLabels() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Defer label rendering to prioritize the 3D scene's first paint.
    // Each <Html> portal is expensive DOM work; delaying them lets the
    // infinity logo render smoothly first.
    const id = setTimeout(() => setReady(true), 1500);
    return () => clearTimeout(id);
  }, []);

  if (!ready) return null;

  return (
    <group>
      {labels.map((label, index) => {
        // Offset by 0.0625 (1/16th) to prevent labels like 'PLAN' and 'RELEASE' 
        // from being permanently stuck at the exact center (t=0 and t=0.5),
        // which is the rotation pivot. This allows them to orbit properly.
        const t = (index / labels.length + 0.0625) % 1;
        return <Label key={label} text={label} t={t} />;
      })}
    </group>
  );
}

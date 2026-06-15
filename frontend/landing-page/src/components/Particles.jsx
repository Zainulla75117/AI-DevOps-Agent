import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export default function Particles({ count = 600 }) {
  const pointsRef = useRef();
  
  const [positions, colors] = useMemo(() => {
    const posArray = new Float32Array(count * 3);
    const colorArray = new Float32Array(count * 3);

    const colorBlue = new THREE.Color(0x3b82f6);
    const colorGreen = new THREE.Color(0x10b981); // Emerald green to match the brand

    for (let i = 0; i < count * 3; i += 3) {
      // Distribute particles in a large volume
      posArray[i] = (Math.random() - 0.5) * 35; // x
      posArray[i + 1] = (Math.random() - 0.5) * 35; // y
      posArray[i + 2] = (Math.random() - 0.5) * 20 - 5; // z

      // Mix blue and green
      const mixedColor = Math.random() > 0.6 ? colorBlue : colorGreen;
      colorArray[i] = mixedColor.r;
      colorArray[i + 1] = mixedColor.g;
      colorArray[i + 2] = mixedColor.b;
    }

    return [posArray, colorArray];
  }, [count]);

  useFrame((state) => {
    const elapsedTime = state.clock.getElapsedTime();
    if (pointsRef.current) {
      pointsRef.current.rotation.y = elapsedTime * 0.03;
      pointsRef.current.position.y = Math.sin(elapsedTime * 0.2) * 0.5;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute 
          attach="attributes-position" 
          count={positions.length / 3} 
          array={positions} 
          itemSize={3} 
        />
        <bufferAttribute 
          attach="attributes-color" 
          count={colors.length / 3} 
          array={colors} 
          itemSize={3} 
        />
      </bufferGeometry>
      <pointsMaterial 
        size={0.08}
        vertexColors={true}
        transparent={true}
        opacity={0.8}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

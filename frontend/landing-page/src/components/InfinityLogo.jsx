import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import DevOpsLabels from './DevOpsLabels';

class InfinityCurve extends THREE.Curve {
  constructor(scale = 1) {
    super();
    this.scale = scale;
  }
  getPoint(t, optionalTarget = new THREE.Vector3()) {
    const p = optionalTarget || new THREE.Vector3();
    const u = t * Math.PI * 2;
    // The mathematical formula for a 3D figure-eight
    const x = Math.sin(u) * 4.5;
    const y = Math.sin(u) * Math.cos(u) * 4.5;
    // Adding depth to twist it
    const z = Math.sin(u * 2) * 1.5;

    return p.set(x, y, z).multiplyScalar(this.scale);
  }
}

export const curveInstance = new InfinityCurve(1.1);

export default function InfinityLogo() {
  const meshRef = useRef();
  const { viewport } = useThree();

  useFrame((state) => {
    const elapsedTime = state.clock.getElapsedTime();
    if (meshRef.current) {
      // 1. Mesh Animation Continuous rotation
      meshRef.current.rotation.y = elapsedTime * 0.2;
      meshRef.current.rotation.z = Math.sin(elapsedTime * 0.3) * 0.15;

      // Gentle floating + responsive positioning
      const floatY = Math.sin(elapsedTime * 0.8) * 0.2;

      const isDesktop = window.innerWidth > 1024;

      // Position Y: Vertically center on desktop, move down/up on mobile
      meshRef.current.position.y = (isDesktop ? 0 : 2) + floatY;

      // Position X: Automatically center it perfectly on the right half of the screen
      // viewport.width gives the total width in 3D units at z=0. 
      // Dividing by 4 puts it exactly in the middle of the right side.
      // Offset slightly to the left if it's too far right, e.g., viewport.width / 4.5
      meshRef.current.position.x = isDesktop ? viewport.width / 4.5 : 0;
    }
  });

  return (
    <mesh ref={meshRef}>
      <tubeGeometry args={[curveInstance, 250, 0.45, 36, true]} />
      {/* Premium Metallic Chrome PBR Material */}
      <meshPhysicalMaterial
        color={0xffffff}
        metalness={1.0}
        roughness={0.15}
        clearcoat={1.0}
        clearcoatRoughness={0.1}
        envMapIntensity={2.0}
      />
      <DevOpsLabels />
    </mesh>
  );
}

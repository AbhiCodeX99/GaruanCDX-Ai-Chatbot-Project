import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sphere, MeshDistortMaterial, Float, Stars, PerspectiveCamera, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

const Earth = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.002;
      meshRef.current.rotation.x += 0.001;
    }
    if (coreRef.current) {
      coreRef.current.rotation.y -= 0.005;
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
      <group>
        {/* Outer Data Shell */}
        <mesh ref={meshRef}>
          <sphereGeometry args={[1.5, 64, 64]} />
          <meshStandardMaterial 
            color="#3b82f6" 
            wireframe 
            transparent 
            opacity={0.2} 
            emissive="#3b82f6"
            emissiveIntensity={0.5}
          />
        </mesh>
        {/* Inner Core */}
        <mesh ref={coreRef}>
          <sphereGeometry args={[1.2, 64, 64]} />
          <MeshDistortMaterial
            color="#1d4ed8"
            attach="material"
            distort={0.4}
            speed={3}
            roughness={0.1}
            metalness={1}
            emissive="#1e40af"
            emissiveIntensity={0.2}
          />
        </mesh>
        {/* Atmosphere Glow */}
        <mesh>
          <sphereGeometry args={[1.6, 64, 64]} />
          <meshBasicMaterial color="#3b82f6" transparent opacity={0.05} side={THREE.BackSide} />
        </mesh>
      </group>
    </Float>
  );
};

const Robot = () => {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.15;
    }
    if (headRef.current) {
      headRef.current.rotation.x = Math.sin(state.clock.elapsedTime) * 0.05;
    }
  });

  return (
    <Float speed={3} rotationIntensity={0.5} floatIntensity={0.8}>
      <group ref={groupRef}>
        {/* Head Unit */}
        <group position={[0, 0.6, 0]} ref={headRef}>
          <mesh>
            <boxGeometry args={[0.7, 0.7, 0.7]} />
            <meshStandardMaterial color="#1e293b" metalness={1} roughness={0.1} />
          </mesh>
          {/* Visor */}
          <mesh position={[0, 0.1, 0.36]}>
            <boxGeometry args={[0.5, 0.15, 0.05]} />
            <meshBasicMaterial color="#3b82f6" />
          </mesh>
          {/* Neural Glow */}
          <pointLight position={[0, 0.1, 0.4]} intensity={2} color="#3b82f6" distance={2} />
        </group>

        {/* Torso */}
        <mesh position={[0, -0.2, 0]}>
          <boxGeometry args={[1, 1.2, 0.6]} />
          <meshStandardMaterial color="#0f172a" metalness={1} roughness={0.1} />
        </mesh>

        {/* Shoulders */}
        <mesh position={[-0.6, 0.3, 0]}>
          <sphereGeometry args={[0.2, 32, 32]} />
          <meshStandardMaterial color="#334155" metalness={1} roughness={0.1} />
        </mesh>
        <mesh position={[0.6, 0.3, 0]}>
          <sphereGeometry args={[0.2, 32, 32]} />
          <meshStandardMaterial color="#334155" metalness={1} roughness={0.1} />
        </mesh>

        {/* Data Rings */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}>
          <torusGeometry args={[0.8, 0.02, 16, 100]} />
          <meshBasicMaterial color="#3b82f6" transparent opacity={0.3} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0.2, 0]} position={[0, -0.2, 0]}>
          <torusGeometry args={[0.9, 0.01, 16, 100]} />
          <meshBasicMaterial color="#3b82f6" transparent opacity={0.1} />
        </mesh>
      </group>
    </Float>
  );
};

export const Scene = ({ mode = 'earth' }: { mode?: 'earth' | 'robot' }) => {
  return (
    <div className="w-full h-full">
      <Canvas>
        <PerspectiveCamera makeDefault position={[0, 0, 5]} />
        <OrbitControls enableZoom={false} autoRotate />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} intensity={1} />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        {mode === 'earth' ? <Earth /> : <Robot />}
      </Canvas>
    </div>
  );
};

/**
 * Procedural Background Component
 * Provides randomizable floor and background textures for domain randomization
 */

import React, { useMemo } from 'react';
import * as THREE from 'three';
import type { ProceduralTextureConfig } from '../../lib/domainRandomization';

interface ProceduralFloorProps {
  textureConfig?: ProceduralTextureConfig;
  size?: number;
}

/**
 * Generate a noise texture procedurally
 */
function generateNoiseTexture(baseColor: string, _secondaryColor: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Fill base color
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 256, 256);

  // Add noise
  const imageData = ctx.getImageData(0, 0, 256, 256);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 40;
    imageData.data[i] = Math.max(0, Math.min(255, imageData.data[i] + noise));
    imageData.data[i + 1] = Math.max(0, Math.min(255, imageData.data[i + 1] + noise));
    imageData.data[i + 2] = Math.max(0, Math.min(255, imageData.data[i + 2] + noise));
  }
  ctx.putImageData(imageData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return texture;
}

/**
 * Generate a checker pattern texture
 */
function generateCheckerTexture(color1: string, color2: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const tileSize = 32;

  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? color1 : color2;
      ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}

/**
 * Generate wood grain texture procedurally
 */
function generateWoodTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Base wood color
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(0, 0, 256, 256);

  // Add wood grain lines
  ctx.strokeStyle = '#A0522D';
  ctx.lineWidth = 2;
  for (let i = 0; i < 40; i++) {
    const y = i * 6 + Math.random() * 4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x < 256; x += 20) {
      ctx.lineTo(x, y + Math.sin(x * 0.05) * 3);
    }
    ctx.stroke();
  }

  // Add some noise
  const imageData = ctx.getImageData(0, 0, 256, 256);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 20;
    imageData.data[i] = Math.max(0, Math.min(255, imageData.data[i] + noise));
    imageData.data[i + 1] = Math.max(0, Math.min(255, imageData.data[i + 1] + noise));
    imageData.data[i + 2] = Math.max(0, Math.min(255, imageData.data[i + 2] + noise));
  }
  ctx.putImageData(imageData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return texture;
}

/**
 * Generate concrete texture procedurally
 */
function generateConcreteTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Base concrete color
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);

  // Add speckles and noise for concrete texture
  const imageData = ctx.getImageData(0, 0, 256, 256);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 60;
    const val = imageData.data[i] + noise;
    imageData.data[i] = Math.max(60, Math.min(180, val));
    imageData.data[i + 1] = Math.max(60, Math.min(180, val));
    imageData.data[i + 2] = Math.max(60, Math.min(180, val));
  }
  ctx.putImageData(imageData, 0, 0);

  // Add some darker spots
  ctx.fillStyle = 'rgba(50, 50, 50, 0.1)';
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const r = Math.random() * 10 + 5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  return texture;
}

/**
 * Generate metal texture procedurally
 */
function generateMetalTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Base metal gradient
  const gradient = ctx.createLinearGradient(0, 0, 256, 256);
  gradient.addColorStop(0, '#708090');
  gradient.addColorStop(0.5, '#A9A9A9');
  gradient.addColorStop(1, '#778899');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);

  // Add brushed metal lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 100; i++) {
    const y = Math.random() * 256;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y + Math.random() * 4 - 2);
    ctx.stroke();
  }

  // Subtle noise
  const imageData = ctx.getImageData(0, 0, 256, 256);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 15;
    imageData.data[i] = Math.max(0, Math.min(255, imageData.data[i] + noise));
    imageData.data[i + 1] = Math.max(0, Math.min(255, imageData.data[i + 1] + noise));
    imageData.data[i + 2] = Math.max(0, Math.min(255, imageData.data[i + 2] + noise));
  }
  ctx.putImageData(imageData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}

/**
 * Main Procedural Floor Component
 */
export const ProceduralFloor: React.FC<ProceduralFloorProps> = ({
  textureConfig,
  size = 0.5,
}) => {
  const floorMaterial = useMemo(() => {
    if (!textureConfig?.floor) {
      return { color: '#334155', roughness: 0.8, metalness: 0.2, map: undefined };
    }

    const { type, baseColor, secondaryColor, roughness, metalness } = textureConfig.floor;

    switch (type) {
      case 'noise':
        return {
          map: generateNoiseTexture(baseColor, secondaryColor || baseColor),
          roughness,
          metalness,
          color: undefined,
        };
      case 'checker':
        return {
          map: generateCheckerTexture(baseColor, secondaryColor || '#ffffff'),
          roughness,
          metalness,
          color: undefined,
        };
      case 'wood':
        return {
          map: generateWoodTexture(),
          roughness,
          metalness,
          color: undefined,
        };
      case 'concrete':
        return {
          map: generateConcreteTexture(),
          roughness,
          metalness,
          color: undefined,
        };
      case 'metal':
        return {
          map: generateMetalTexture(),
          roughness,
          metalness,
          color: undefined,
        };
      case 'solid':
      default:
        return {
          color: baseColor,
          roughness,
          metalness,
          map: undefined,
        };
    }
  }, [textureConfig]);

  return (
    <group>
      {/* Main floor surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial
          map={floorMaterial.map}
          color={floorMaterial.color}
          roughness={floorMaterial.roughness}
          metalness={floorMaterial.metalness}
        />
      </mesh>

      {/* Grid overlay */}
      <gridHelper args={[size, 20, '#3a4a5f', '#2a3a4f']} position={[0, 0.001, 0]} />
    </group>
  );
};

/**
 * Background gradient/solid component
 */
export const ProceduralBackground: React.FC<{
  config?: ProceduralTextureConfig;
}> = ({ config: _config }) => {
  // Background is handled by Canvas scene.background
  // This component can render additional background elements if needed
  return null;
};

/**
 * Combined background component with floor and optional background elements
 */
interface RandomizableBackgroundProps {
  textureConfig?: ProceduralTextureConfig;
  floorSize?: number;
}

export const RandomizableBackground: React.FC<RandomizableBackgroundProps> = ({
  textureConfig,
  floorSize = 0.5,
}) => {
  return (
    <group>
      <ProceduralFloor textureConfig={textureConfig} size={floorSize} />
    </group>
  );
};

export default RandomizableBackground;

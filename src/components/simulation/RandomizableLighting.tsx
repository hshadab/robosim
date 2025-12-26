/**
 * Randomizable Lighting Component
 * Lighting that can be controlled via domain randomization for sim-to-real transfer
 */

import React from 'react';
import { ContactShadows } from '@react-three/drei';
import type { LightingConfig, ShadowConfig } from '../../lib/domainRandomization';

interface RandomizableLightingProps {
  lighting?: LightingConfig;
  shadowConfig?: ShadowConfig;
  robotPosition?: [number, number, number];
}

/**
 * Default lighting configuration
 */
const DEFAULT_LIGHTING: LightingConfig = {
  keyLightIntensity: 2.0,
  keyLightColor: '#ffffff',
  keyLightX: 5,
  keyLightY: 8,
  keyLightZ: 5,
  fillLightIntensity: 0.8,
  fillLightColor: '#a0c4ff',
  rimLightIntensity: 0.6,
  rimLightColor: '#ffd6a5',
  ambientIntensity: 0.15,
  ambientColor: '#ffffff',
};

/**
 * Default shadow configuration
 */
const DEFAULT_SHADOW: ShadowConfig = {
  opacity: 0.5,
  blur: 2,
  far: 0.5,
  resolution: 256,
};

export const RandomizableLighting: React.FC<RandomizableLightingProps> = ({
  lighting = DEFAULT_LIGHTING,
  shadowConfig = DEFAULT_SHADOW,
  robotPosition = [0, 0, 0],
}) => {
  return (
    <group>
      {/* Key light - main directional with shadows */}
      <directionalLight
        position={[lighting.keyLightX, lighting.keyLightY, lighting.keyLightZ]}
        intensity={lighting.keyLightIntensity}
        color={lighting.keyLightColor}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0001}
      >
        <orthographicCamera attach="shadow-camera" args={[-1, 1, 1, -1, 0.1, 20]} />
      </directionalLight>

      {/* Fill light - softer, from opposite side */}
      <directionalLight
        position={[-3, 4, -2]}
        intensity={lighting.fillLightIntensity}
        color={lighting.fillLightColor}
      />

      {/* Rim light - creates edge definition */}
      <directionalLight
        position={[0, 3, -5]}
        intensity={lighting.rimLightIntensity}
        color={lighting.rimLightColor}
      />

      {/* Ambient light - fills shadows */}
      <ambientLight
        intensity={lighting.ambientIntensity}
        color={lighting.ambientColor}
      />

      {/* Contact shadows with randomizable properties */}
      <ContactShadows
        position={[robotPosition[0], 0, robotPosition[2]]}
        opacity={shadowConfig.opacity}
        blur={shadowConfig.blur}
        far={shadowConfig.far}
        resolution={shadowConfig.resolution}
        color="#000000"
      />
    </group>
  );
};

export default RandomizableLighting;

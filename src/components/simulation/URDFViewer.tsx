/**
 * URDF Viewer Component
 * Renders robots from URDF files
 */

import React, { useMemo, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  URDFParser,
  urdfGeometryToThree,
  urdfOriginToMatrix,
  urdfMaterialToThree,
  type URDFRobot,
  type URDFLink,
  type URDFJoint,
} from '../../lib/urdfParser';

interface URDFViewer3DProps {
  urdf: URDFRobot;
  jointValues?: Record<string, number>;
  scale?: number;
}

// Build kinematic tree from URDF
const buildKinematicTree = (
  robot: URDFRobot
): Map<string, { link: URDFLink; joint?: URDFJoint; parent?: string }> => {
  const tree = new Map<string, { link: URDFLink; joint?: URDFJoint; parent?: string }>();

  // First, add all links
  robot.links.forEach((link) => {
    tree.set(link.name, { link });
  });

  // Then, connect them via joints
  robot.joints.forEach((joint) => {
    const childNode = tree.get(joint.child);
    if (childNode) {
      childNode.joint = joint;
      childNode.parent = joint.parent;
    }
  });

  return tree;
};

// Find root link (no parent)
const findRootLink = (
  tree: Map<string, { link: URDFLink; joint?: URDFJoint; parent?: string }>
): string | null => {
  const childLinks = new Set<string>();

  tree.forEach((node) => {
    if (node.joint) {
      childLinks.add(node.link.name);
    }
  });

  for (const [name] of tree) {
    if (!childLinks.has(name)) {
      return name;
    }
  }

  return null;
};

// Recursive link renderer
const URDFLinkMesh: React.FC<{
  robot: URDFRobot;
  linkName: string;
  tree: Map<string, { link: URDFLink; joint?: URDFJoint; parent?: string }>;
  jointValues: Record<string, number>;
  scale: number;
}> = ({ robot, linkName, tree, jointValues, scale }) => {
  const node = useMemo(() => tree.get(linkName), [tree, linkName]);

  const childLinks = useMemo(
    () => robot.joints.filter((j) => j.parent === linkName).map((j) => j.child),
    [robot.joints, linkName]
  );

  // Calculate joint transformation
  const jointMatrix = useMemo(() => {
    const jointRef = node?.joint;
    if (!jointRef) return new THREE.Matrix4();

    const originMatrix = urdfOriginToMatrix(jointRef.origin);

    // Apply joint rotation if it's a revolute/continuous joint
    if ((jointRef.type === 'revolute' || jointRef.type === 'continuous') && jointRef.axis) {
      const angle = jointValues[jointRef.name] || 0;
      const axis = new THREE.Vector3(...jointRef.axis).normalize();
      const rotation = new THREE.Matrix4().makeRotationAxis(axis, angle);
      originMatrix.multiply(rotation);
    }

    // Apply prismatic joint translation
    if (jointRef.type === 'prismatic' && jointRef.axis) {
      const distance = jointValues[jointRef.name] || 0;
      const axis = new THREE.Vector3(...jointRef.axis).normalize();
      const translation = new THREE.Matrix4().makeTranslation(
        axis.x * distance,
        axis.y * distance,
        axis.z * distance
      );
      originMatrix.multiply(translation);
    }

    return originMatrix;
  }, [node?.joint, jointValues]);

  // Extract position and rotation from matrix
  const position = useMemo(() => {
    const pos = new THREE.Vector3();
    jointMatrix.decompose(pos, new THREE.Quaternion(), new THREE.Vector3());
    return [pos.x * scale, pos.y * scale, pos.z * scale] as [number, number, number];
  }, [jointMatrix, scale]);

  const rotation = useMemo(() => {
    const quat = new THREE.Quaternion();
    jointMatrix.decompose(new THREE.Vector3(), quat, new THREE.Vector3());
    const euler = new THREE.Euler().setFromQuaternion(quat);
    return [euler.x, euler.y, euler.z] as [number, number, number];
  }, [jointMatrix]);

  if (!node) return null;

  const { link } = node;

  return (
    <group position={position} rotation={rotation}>
      {/* Render visuals */}
      {link.visual?.map((visual, i) => {
        const visualMatrix = urdfOriginToMatrix(visual.origin);
        const pos = new THREE.Vector3();
        const quat = new THREE.Quaternion();
        const scl = new THREE.Vector3();
        visualMatrix.decompose(pos, quat, scl);

        const euler = new THREE.Euler().setFromQuaternion(quat);
        const material = urdfMaterialToThree(visual.material);

        return (
          <group
            key={i}
            position={[pos.x * scale, pos.y * scale, pos.z * scale]}
            rotation={[euler.x, euler.y, euler.z]}
          >
            <mesh>
              <primitive object={urdfGeometryToThree(visual.geometry)} attach="geometry" />
              <primitive object={material} attach="material" />
            </mesh>
          </group>
        );
      })}

      {/* Render children */}
      {childLinks.map((childName) => (
        <URDFLinkMesh
          key={childName}
          robot={robot}
          linkName={childName}
          tree={tree}
          jointValues={jointValues}
          scale={scale}
        />
      ))}
    </group>
  );
};

// Main URDF viewer component
export const URDFViewer3D: React.FC<URDFViewer3DProps> = ({
  urdf,
  jointValues = {},
  scale = 1,
}) => {
  const tree = useMemo(() => buildKinematicTree(urdf), [urdf]);
  const rootLink = useMemo(() => findRootLink(tree), [tree]);

  if (!rootLink) {
    console.warn('No root link found in URDF');
    return null;
  }

  return (
    <group>
      <URDFLinkMesh
        robot={urdf}
        linkName={rootLink}
        tree={tree}
        jointValues={jointValues}
        scale={scale}
      />
    </group>
  );
};

// File upload component for importing URDF
interface URDFImporterProps {
  onImport: (robot: URDFRobot) => void;
  onError?: (error: Error) => void;
}

export const URDFImporter: React.FC<URDFImporterProps> = ({ onImport, onError }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const parser = new URDFParser();
        const robot = parser.parse(text);
        setFileName(file.name);
        onImport(robot);
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    },
    [onImport, onError]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith('.urdf') || file.name.endsWith('.xml'))) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
        isDragging
          ? 'border-blue-500 bg-blue-500/10'
          : 'border-slate-600 hover:border-slate-500'
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept=".urdf,.xml"
        onChange={handleFileInput}
        className="hidden"
        id="urdf-file-input"
      />
      <label htmlFor="urdf-file-input" className="cursor-pointer">
        <div className="text-slate-400 mb-2">
          {fileName ? (
            <span className="text-green-400">{fileName}</span>
          ) : (
            <>Drop URDF file here or click to browse</>
          )}
        </div>
        <div className="text-xs text-slate-500">Supports .urdf and .xml files</div>
      </label>
    </div>
  );
};

// Sample URDF for testing
export const SAMPLE_URDF = `<?xml version="1.0"?>
<robot name="simple_arm">
  <material name="blue">
    <color rgba="0.2 0.4 0.8 1"/>
  </material>
  <material name="gray">
    <color rgba="0.5 0.5 0.5 1"/>
  </material>

  <link name="base_link">
    <visual>
      <geometry>
        <cylinder radius="0.05" length="0.02"/>
      </geometry>
      <material name="gray"/>
    </visual>
  </link>

  <link name="link1">
    <visual>
      <origin xyz="0 0 0.05" rpy="0 0 0"/>
      <geometry>
        <box size="0.04 0.04 0.1"/>
      </geometry>
      <material name="blue"/>
    </visual>
  </link>

  <link name="link2">
    <visual>
      <origin xyz="0 0 0.04" rpy="0 0 0"/>
      <geometry>
        <box size="0.03 0.03 0.08"/>
      </geometry>
      <material name="blue"/>
    </visual>
  </link>

  <joint name="joint1" type="revolute">
    <parent link="base_link"/>
    <child link="link1"/>
    <origin xyz="0 0 0.01" rpy="0 0 0"/>
    <axis xyz="0 0 1"/>
    <limit lower="-3.14" upper="3.14" effort="10" velocity="1"/>
  </joint>

  <joint name="joint2" type="revolute">
    <parent link="link1"/>
    <child link="link2"/>
    <origin xyz="0 0 0.1" rpy="0 0 0"/>
    <axis xyz="0 1 0"/>
    <limit lower="-1.57" upper="1.57" effort="10" velocity="1"/>
  </joint>
</robot>`;

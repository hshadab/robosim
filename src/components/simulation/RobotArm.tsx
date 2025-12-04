import React from 'react';
import type { JointState } from '../../types';

interface RobotArmProps {
  joints: JointState;
}

// Shared color palette for the SVG arm illustration
const ROBOT_COLORS = {
  aluminum: '#C8CED6',
  aluminumDark: '#9BA4B0',
  aluminumLight: '#E0E4EA',
  aluminumEdge: '#A8B0BC',
  servoBlue: '#1E5FAB',
  servoBlueDark: '#164785',
  servoBlueLight: '#2B74C4',
  servoBlueAccent: '#3D8BE0',
  servoHorn: '#1A1A1A',
  servoLabel: '#E8E8E8',
  basePlate: '#1A1A1A',
  baseRing: '#2D2D2D',
  bearing: '#3D3D3D',
  bearingInner: '#505050',
  gripperMetal: '#4A4A4A',
  gripperPad: '#E65C00',
  gripperPadDark: '#CC5200',
  screw: '#6B6B6B',
  screwHead: '#888888',
  cable: '#1A1A1A',
};

type ServoProps = {
  x: number;
  y: number;
  rotation?: number;
  size?: number;
  showHorn?: boolean;
};

const Servo: React.FC<ServoProps> = ({ x, y, rotation = 0, size = 1, showHorn = true }) => (
  <g transform={`translate(${x}, ${y}) rotate(${rotation})`}>
    <rect
      x={-14 * size}
      y={-20 * size}
      width={28 * size}
      height={40 * size}
      rx={2}
      fill={ROBOT_COLORS.servoBlue}
      stroke={ROBOT_COLORS.servoBlueDark}
      strokeWidth={1}
    />
    <rect
      x={-12 * size}
      y={-18 * size}
      width={24 * size}
      height={4 * size}
      rx={1}
      fill={ROBOT_COLORS.servoBlueLight}
      opacity={0.6}
    />
    <line
      x1={-14 * size}
      y1={-8 * size}
      x2={-14 * size}
      y2={12 * size}
      stroke={ROBOT_COLORS.servoBlueDark}
      strokeWidth={1}
    />
    <line
      x1={14 * size}
      y1={-8 * size}
      x2={14 * size}
      y2={12 * size}
      stroke={ROBOT_COLORS.servoBlueDark}
      strokeWidth={1}
    />
    <rect
      x={-10 * size}
      y={-4 * size}
      width={20 * size}
      height={12 * size}
      rx={1}
      fill={ROBOT_COLORS.servoBlueDark}
      opacity={0.5}
    />
    <text
      x={0}
      y={4 * size}
      textAnchor="middle"
      fill={ROBOT_COLORS.servoLabel}
      fontSize={7 * size}
      fontWeight="bold"
      fontFamily="Arial, sans-serif"
    >
      LX-15D
    </text>
    {showHorn && (
      <>
        <circle
          cx={0}
          cy={-20 * size}
          r={8 * size}
          fill={ROBOT_COLORS.servoHorn}
          stroke={ROBOT_COLORS.servoBlueDark}
          strokeWidth={1}
        />
        <circle cx={0} cy={-20 * size} r={4 * size} fill={ROBOT_COLORS.screw} />
        <circle cx={0} cy={-20 * size} r={2 * size} fill={ROBOT_COLORS.screwHead} />
      </>
    )}
    <rect
      x={-16 * size}
      y={14 * size}
      width={6 * size}
      height={6 * size}
      rx={1}
      fill={ROBOT_COLORS.servoBlue}
      stroke={ROBOT_COLORS.servoBlueDark}
      strokeWidth={0.5}
    />
    <rect
      x={10 * size}
      y={14 * size}
      width={6 * size}
      height={6 * size}
      rx={1}
      fill={ROBOT_COLORS.servoBlue}
      stroke={ROBOT_COLORS.servoBlueDark}
      strokeWidth={0.5}
    />
    <circle cx={-13 * size} cy={17 * size} r={1.5 * size} fill={ROBOT_COLORS.servoBlueDark} />
    <circle cx={13 * size} cy={17 * size} r={1.5 * size} fill={ROBOT_COLORS.servoBlueDark} />
  </g>
);

type BracketProps = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width?: number;
  hasHoles?: boolean;
};

const Bracket: React.FC<BracketProps> = ({ x1, y1, x2, y2, width = 24, hasHoles = true }) => {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

  return (
    <g transform={`translate(${x1}, ${y1}) rotate(${(angle * 180) / Math.PI})`}>
      <rect
        x={0}
        y={-width / 2}
        width={length}
        height={width}
        rx={3}
        fill={ROBOT_COLORS.aluminum}
        stroke={ROBOT_COLORS.aluminumDark}
        strokeWidth={1.5}
      />
      <rect
        x={2}
        y={-width / 2 + 1}
        width={length - 4}
        height={3}
        rx={1}
        fill={ROBOT_COLORS.aluminumLight}
        opacity={0.7}
      />
      <rect
        x={2}
        y={width / 2 - 4}
        width={length - 4}
        height={3}
        rx={1}
        fill={ROBOT_COLORS.aluminumDark}
        opacity={0.3}
      />
      {hasHoles && length > 50 && (
        <>
          <ellipse
            cx={length * 0.35}
            cy={0}
            rx={Math.min(14, length * 0.12)}
            ry={5}
            fill={ROBOT_COLORS.aluminumDark}
            opacity={0.4}
          />
          <ellipse
            cx={length * 0.65}
            cy={0}
            rx={Math.min(14, length * 0.12)}
            ry={5}
            fill={ROBOT_COLORS.aluminumDark}
            opacity={0.4}
          />
        </>
      )}
      <circle cx={4} cy={-width / 3} r={2} fill={ROBOT_COLORS.screw} />
      <circle cx={4} cy={width / 3} r={2} fill={ROBOT_COLORS.screw} />
      <circle cx={length - 4} cy={-width / 3} r={2} fill={ROBOT_COLORS.screw} />
      <circle cx={length - 4} cy={width / 3} r={2} fill={ROBOT_COLORS.screw} />
    </g>
  );
};

export const RobotArm: React.FC<RobotArmProps> = ({ joints }) => {
  // Dimensions based on real xArm 1S proportions (154×140×426mm)
  const scale = 1.3;
  const baseHeight = 40;
  const shoulderHeight = 50;
  const upperArmLength = 96;
  const forearmLength = 84;
  const wristLength = 42;

  // Joint angles in radians
  const shoulderRad = (joints.shoulder * Math.PI) / 180;
  const elbowRad = ((joints.shoulder + joints.elbow) * Math.PI) / 180;
  const wristRad =
    ((joints.shoulder + joints.elbow + joints.wrist) * Math.PI) / 180;

  // Calculate positions (forward kinematics)
  const origin = { x: 280, y: 420 };
  const baseTop = { x: origin.x, y: origin.y - baseHeight * scale };
  const shoulderJoint = {
    x: baseTop.x,
    y: baseTop.y - shoulderHeight * scale * 0.5,
  };

  const elbowJoint = {
    x: shoulderJoint.x + upperArmLength * scale * Math.sin(shoulderRad),
    y: shoulderJoint.y - upperArmLength * scale * Math.cos(shoulderRad),
  };

  const wristJoint = {
    x: elbowJoint.x + forearmLength * scale * Math.sin(elbowRad),
    y: elbowJoint.y - forearmLength * scale * Math.cos(elbowRad),
  };

  const gripperBase = {
    x: wristJoint.x + wristLength * scale * Math.sin(wristRad),
    y: wristJoint.y - wristLength * scale * Math.cos(wristRad),
  };

  const colors = ROBOT_COLORS;

  // Gripper calculation
  const gripAngle = wristRad;
  const openAmount = 10 + (joints.gripper / 100) * 16;
  const fingerLength = 38;

  const dx = Math.sin(gripAngle);
  const dy = -Math.cos(gripAngle);
  const perpX = Math.cos(gripAngle);
  const perpY = Math.sin(gripAngle);

  const leftBase = {
    x: gripperBase.x + perpX * openAmount,
    y: gripperBase.y + perpY * openAmount,
  };
  const rightBase = {
    x: gripperBase.x - perpX * openAmount,
    y: gripperBase.y - perpY * openAmount,
  };
  const leftTip = {
    x: leftBase.x + dx * fingerLength,
    y: leftBase.y + dy * fingerLength,
  };
  const rightTip = {
    x: rightBase.x + dx * fingerLength,
    y: rightBase.y + dy * fingerLength,
  };

  return (
    <svg
      viewBox="0 0 560 500"
      className="w-full h-full"
      style={{
        background: 'linear-gradient(180deg, #0F172A 0%, #1E293B 100%)',
      }}
    >
      {/* Definitions */}
      <defs>
        <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
          <path
            d="M 30 0 L 0 0 0 30"
            fill="none"
            stroke="#334155"
            strokeWidth="0.5"
            opacity="0.4"
          />
        </pattern>
        <linearGradient id="tableGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#475569" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>
        <linearGradient id="baseGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#2D2D2D" />
          <stop offset="100%" stopColor="#1A1A1A" />
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="2" dy="4" stdDeviation="4" floodOpacity="0.4" />
        </filter>
        <filter id="softShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="1" dy="2" stdDeviation="2" floodOpacity="0.3" />
        </filter>
      </defs>

      <rect width="560" height="500" fill="url(#grid)" />

      {/* Table surface */}
      <rect x="0" y="420" width="560" height="80" fill="url(#tableGrad)" />
      <line x1="0" y1="420" x2="560" y2="420" stroke="#64748B" strokeWidth="2" />

      {/* Shadow under base */}
      <ellipse
        cx={origin.x}
        cy={origin.y + 8}
        rx={65}
        ry={14}
        fill="black"
        opacity="0.4"
      />

      {/* === BASE ASSEMBLY === */}
      <g filter="url(#shadow)">
        {/* Base plate (black plastic) */}
        <ellipse
          cx={origin.x}
          cy={origin.y}
          rx={58}
          ry={12}
          fill={colors.basePlate}
        />
        <ellipse
          cx={origin.x}
          cy={origin.y - 2}
          rx={55}
          ry={10}
          fill={colors.baseRing}
        />

        {/* Bearing ring */}
        <ellipse
          cx={origin.x}
          cy={origin.y - 6}
          rx={48}
          ry={8}
          fill={colors.bearing}
          stroke={colors.aluminum}
          strokeWidth={2}
        />
        <ellipse
          cx={origin.x}
          cy={origin.y - 9}
          rx={42}
          ry={6}
          fill={colors.bearingInner}
        />

        {/* Rotating platform */}
        <ellipse
          cx={origin.x}
          cy={origin.y - 12}
          rx={38}
          ry={5}
          fill={colors.aluminum}
          stroke={colors.aluminumDark}
          strokeWidth={1}
        />

        {/* Base tower */}
        <path
          d={`M ${origin.x - 32} ${origin.y - 15}
              L ${origin.x - 28} ${baseTop.y + 8}
              L ${origin.x - 28} ${baseTop.y - 5}
              Q ${origin.x} ${baseTop.y - 15} ${origin.x + 28} ${baseTop.y - 5}
              L ${origin.x + 28} ${baseTop.y + 8}
              L ${origin.x + 32} ${origin.y - 15} Z`}
          fill={colors.aluminum}
          stroke={colors.aluminumDark}
          strokeWidth={1.5}
        />

        {/* Base tower highlight */}
        <path
          d={`M ${origin.x - 26} ${origin.y - 18}
              L ${origin.x - 24} ${baseTop.y + 5}
              L ${origin.x + 24} ${baseTop.y + 5}
              L ${origin.x + 26} ${origin.y - 18}`}
          fill={colors.aluminumLight}
          opacity={0.3}
        />

        {/* Base servo (25kg torque) */}
        <rect
          x={origin.x - 22}
          y={origin.y - 52}
          width={44}
          height={38}
          rx={3}
          fill={colors.servoBlue}
          stroke={colors.servoBlueDark}
          strokeWidth={1.5}
        />
        <rect
          x={origin.x - 18}
          y={origin.y - 48}
          width={36}
          height={4}
          rx={1}
          fill={colors.servoBlueLight}
          opacity={0.5}
        />
        <text
          x={origin.x}
          y={origin.y - 30}
          textAnchor="middle"
          fill={colors.servoLabel}
          fontSize="8"
          fontWeight="bold"
          fontFamily="Arial, sans-serif"
        >
          LX-225
        </text>
        <text
          x={origin.x}
          y={origin.y - 22}
          textAnchor="middle"
          fill={colors.servoLabel}
          fontSize="6"
          opacity={0.7}
          fontFamily="Arial, sans-serif"
        >
          25KG
        </text>

        {/* Base rotation indicator */}
        <g transform={`rotate(${-joints.base}, ${origin.x}, ${origin.y - 9})`}>
          <polygon
            points={`${origin.x},${origin.y - 28} ${origin.x - 4},${origin.y - 18} ${origin.x + 4},${origin.y - 18}`}
            fill={colors.gripperPad}
          />
        </g>
      </g>

      {/* === SHOULDER MOUNT === */}
      <g filter="url(#shadow)">
        {/* U-bracket for shoulder */}
        <rect
          x={origin.x - 30}
          y={baseTop.y - 50}
          width={60}
          height={55}
          rx={4}
          fill={colors.aluminum}
          stroke={colors.aluminumDark}
          strokeWidth={1.5}
        />
        <rect
          x={origin.x - 26}
          y={baseTop.y - 46}
          width={52}
          height={6}
          rx={2}
          fill={colors.aluminumLight}
          opacity={0.5}
        />
        {/* Mounting screws */}
        <circle cx={origin.x - 20} cy={baseTop.y - 35} r={2} fill={colors.screwHead} />
        <circle cx={origin.x + 20} cy={baseTop.y - 35} r={2} fill={colors.screwHead} />
        <circle cx={origin.x - 20} cy={baseTop.y - 10} r={2} fill={colors.screwHead} />
        <circle cx={origin.x + 20} cy={baseTop.y - 10} r={2} fill={colors.screwHead} />

        {/* Shoulder servo */}
        <Servo x={origin.x} y={shoulderJoint.y + 18} rotation={0} size={1.1} />
      </g>

      {/* === UPPER ARM === */}
      <g filter="url(#softShadow)">
        <Bracket
          x1={shoulderJoint.x}
          y1={shoulderJoint.y}
          x2={elbowJoint.x}
          y2={elbowJoint.y}
          width={26}
        />

        {/* Shoulder joint cap */}
        <circle
          cx={shoulderJoint.x}
          cy={shoulderJoint.y}
          r={16}
          fill={colors.servoBlue}
          stroke={colors.servoBlueDark}
          strokeWidth={2}
        />
        <circle
          cx={shoulderJoint.x}
          cy={shoulderJoint.y}
          r={10}
          fill={colors.servoBlueDark}
        />
        <circle
          cx={shoulderJoint.x}
          cy={shoulderJoint.y}
          r={4}
          fill={colors.screwHead}
        />
      </g>

      {/* === ELBOW SERVO === */}
      <g filter="url(#softShadow)">
        <g
          transform={`translate(${elbowJoint.x}, ${elbowJoint.y}) rotate(${joints.shoulder + joints.elbow})`}
        >
          <Servo x={0} y={0} rotation={0} size={1} showHorn={false} />
        </g>

        {/* Elbow joint cover */}
        <circle
          cx={elbowJoint.x}
          cy={elbowJoint.y}
          r={12}
          fill={colors.aluminum}
          stroke={colors.aluminumDark}
          strokeWidth={1.5}
        />
        <circle
          cx={elbowJoint.x}
          cy={elbowJoint.y}
          r={5}
          fill={colors.screwHead}
        />
      </g>

      {/* === FOREARM === */}
      <g filter="url(#softShadow)">
        <Bracket
          x1={elbowJoint.x}
          y1={elbowJoint.y}
          x2={wristJoint.x}
          y2={wristJoint.y}
          width={22}
        />
      </g>

      {/* === WRIST SERVO === */}
      <g filter="url(#softShadow)">
        <g
          transform={`translate(${wristJoint.x}, ${wristJoint.y}) rotate(${joints.shoulder + joints.elbow + joints.wrist})`}
        >
          <Servo x={0} y={0} rotation={0} size={0.85} showHorn={false} />
        </g>

        <circle
          cx={wristJoint.x}
          cy={wristJoint.y}
          r={10}
          fill={colors.aluminum}
          stroke={colors.aluminumDark}
          strokeWidth={1}
        />
        <circle cx={wristJoint.x} cy={wristJoint.y} r={4} fill={colors.screwHead} />
      </g>

      {/* === WRIST LINK === */}
      <g filter="url(#softShadow)">
        <Bracket
          x1={wristJoint.x}
          y1={wristJoint.y}
          x2={gripperBase.x}
          y2={gripperBase.y}
          width={16}
          hasHoles={false}
        />
      </g>

      {/* === GRIPPER === */}
      <g filter="url(#softShadow)">
        {/* Gripper servo mount */}
        <g
          transform={`translate(${gripperBase.x}, ${gripperBase.y}) rotate(${joints.shoulder + joints.elbow + joints.wrist})`}
        >
          <rect
            x={-14}
            y={-10}
            width={28}
            height={20}
            rx={3}
            fill={colors.gripperMetal}
            stroke={colors.aluminumDark}
            strokeWidth={1}
          />
          <rect
            x={-10}
            y={-6}
            width={20}
            height={12}
            rx={2}
            fill={colors.servoBlue}
            stroke={colors.servoBlueDark}
            strokeWidth={0.5}
          />
        </g>

        {/* Left finger */}
        <line
          x1={leftBase.x}
          y1={leftBase.y}
          x2={leftTip.x}
          y2={leftTip.y}
          stroke={colors.gripperMetal}
          strokeWidth={10}
          strokeLinecap="round"
        />
        <line
          x1={leftBase.x}
          y1={leftBase.y}
          x2={leftTip.x}
          y2={leftTip.y}
          stroke={colors.aluminum}
          strokeWidth={6}
          strokeLinecap="round"
        />
        {/* Orange rubber grip pad */}
        <circle cx={leftTip.x} cy={leftTip.y} r={7} fill={colors.gripperPad} />
        <circle cx={leftTip.x} cy={leftTip.y} r={5} fill={colors.gripperPadDark} />
        <circle cx={leftTip.x} cy={leftTip.y} r={2} fill={colors.gripperPad} opacity={0.7} />

        {/* Right finger */}
        <line
          x1={rightBase.x}
          y1={rightBase.y}
          x2={rightTip.x}
          y2={rightTip.y}
          stroke={colors.gripperMetal}
          strokeWidth={10}
          strokeLinecap="round"
        />
        <line
          x1={rightBase.x}
          y1={rightBase.y}
          x2={rightTip.x}
          y2={rightTip.y}
          stroke={colors.aluminum}
          strokeWidth={6}
          strokeLinecap="round"
        />
        {/* Orange rubber grip pad */}
        <circle cx={rightTip.x} cy={rightTip.y} r={7} fill={colors.gripperPad} />
        <circle cx={rightTip.x} cy={rightTip.y} r={5} fill={colors.gripperPadDark} />
        <circle cx={rightTip.x} cy={rightTip.y} r={2} fill={colors.gripperPad} opacity={0.7} />
      </g>

      {/* Cable routing hints */}
      <g opacity={0.6}>
        <path
          d={`M ${origin.x + 15} ${origin.y - 45}
              Q ${shoulderJoint.x + 20} ${shoulderJoint.y + 30}
                ${shoulderJoint.x + 18} ${shoulderJoint.y}`}
          stroke={colors.cable}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
        />
      </g>

      {/* Title and branding */}
      <text x="15" y="28" fill="#E2E8F0" fontSize="16" fontWeight="bold">
        Hiwonder xArm 1S
      </text>
      <text x="15" y="46" fill="#94A3B8" fontSize="11">
        6-DOF Intelligent Bus Servo Robot Arm
      </text>
      <text x="15" y="62" fill="#64748B" fontSize="9">
        LX-15D / LX-225 Servos • 500g Payload
      </text>

      {/* Joint readout panel */}
      <g transform="translate(15, 450)">
        <rect
          x="-5"
          y="-12"
          width="200"
          height="44"
          rx="6"
          fill="#1E293B"
          stroke="#334155"
          strokeWidth="1"
        />
        <text x="5" y="3" fill="#64748B" fontSize="9" fontWeight="bold">
          JOINT POSITIONS
        </text>
        <text x="5" y="18" fill="#94A3B8" fontSize="10" fontFamily="monospace">
          Base: {joints.base.toFixed(0).padStart(4)}° | Shoulder: {joints.shoulder.toFixed(0).padStart(3)}°
        </text>
        <text x="5" y="30" fill="#94A3B8" fontSize="10" fontFamily="monospace">
          Elbow: {joints.elbow.toFixed(0).padStart(4)}° | Wrist: {joints.wrist.toFixed(0).padStart(4)}°
        </text>
      </g>

      {/* Gripper status */}
      <g transform="translate(400, 450)">
        <rect
          x="-5"
          y="-12"
          width="100"
          height="44"
          rx="6"
          fill="#1E293B"
          stroke="#334155"
          strokeWidth="1"
        />
        <text x="5" y="3" fill="#64748B" fontSize="9" fontWeight="bold">
          GRIPPER
        </text>
        <text x="5" y="20" fill={colors.gripperPad} fontSize="14" fontWeight="bold" fontFamily="monospace">
          {joints.gripper.toFixed(0)}%
        </text>
        <text x="5" y="30" fill="#64748B" fontSize="8">
          {joints.gripper < 20 ? 'CLOSED' : joints.gripper > 80 ? 'OPEN' : 'PARTIAL'}
        </text>
      </g>
    </svg>
  );
};

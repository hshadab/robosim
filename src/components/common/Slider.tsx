import React from 'react';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  unit?: string;
  color?: string;
  disabled?: boolean;
}

export const Slider: React.FC<SliderProps> = ({
  label,
  value,
  min,
  max,
  onChange,
  unit = '°',
  color = '#3b82f6',
  disabled = false,
}) => {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className={`mb-3 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex justify-between items-center text-xs mb-1.5">
        <span className="text-slate-300 font-medium">{label}</span>
        <span className="text-slate-400 font-mono bg-slate-800 px-2 py-0.5 rounded">
          {value.toFixed(0)}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        disabled={disabled}
        className="w-full h-2 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed"
        style={{
          background: `linear-gradient(to right, ${color} 0%, ${color} ${percentage}%, #1e293b ${percentage}%, #1e293b 100%)`,
        }}
      />
      <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
};

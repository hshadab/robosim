import React from 'react';
import { Header } from './Header';
import { SimulationViewport, SensorPanel } from '../simulation';
import { CodeEditor, ConsolePanel } from '../editor';
import { ChatPanel } from '../chat';
import { JointControls, PresetButtons, EnvironmentSelector, ChallengePanel, RobotSelector } from '../controls';
import { RealTimePlot } from '../visualization';

export const MainLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 flex flex-col">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="flex-1 p-4 overflow-hidden">
        <div className="h-full grid grid-cols-12 gap-4">
          {/* Left Column: Simulation + Environment + Sensors */}
          <div className="col-span-5 flex flex-col gap-4">
            {/* Simulation Viewport */}
            <div className="flex-1 min-h-0">
              <SimulationViewport />
            </div>

            {/* Bottom Row: Environment + Sensors */}
            <div className="grid grid-cols-2 gap-4">
              <EnvironmentSelector />
              <SensorPanel />
            </div>

            {/* Real-time Plot */}
            <RealTimePlot mode="joints" height={120} />
          </div>

          {/* Middle Column: Robot Selector + Manual Control + Code Editor + Console */}
          <div className="col-span-4 flex flex-col gap-4">
            <RobotSelector />
            <JointControls />
            <div className="flex-[2] min-h-0">
              <CodeEditor />
            </div>
            <div className="flex-1 min-h-0 max-h-40">
              <ConsolePanel />
            </div>
            <PresetButtons />
          </div>

          {/* Right Column: Chat + Challenges */}
          <div className="col-span-3 flex flex-col gap-4">
            <div className="flex-[2] min-h-0">
              <ChatPanel />
            </div>
            <div className="flex-1 min-h-0 max-h-64 overflow-hidden">
              <ChallengePanel />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

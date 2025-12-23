# RoboSim - AI-Native Robotics Simulation Platform

## Overview
RoboSim is an AI-native robotics simulation platform built with React, TypeScript, and Vite. It allows users to build robot skills directly in the browser without requiring ROS, MuJoCo, or GPU. The platform features AI chat control, voice commands, HuggingFace integration, and synthetic data generation.

## Tech Stack
- **Frontend**: React 19 with TypeScript
- **Build Tool**: Vite 7
- **3D Rendering**: Three.js with React Three Fiber
- **Physics**: React Three Rapier
- **Styling**: Tailwind CSS 4
- **State Management**: Zustand
- **ML Libraries**: HuggingFace Transformers, ONNX Runtime, MediaPipe
- **Code Editor**: Monaco Editor
- **Database**: Supabase (optional, runs in offline mode without config)

## Project Structure
```
├── src/
│   ├── components/    # React components
│   ├── config/        # Configuration files
│   ├── hooks/         # Custom React hooks
│   ├── lib/           # Utility libraries
│   ├── stores/        # Zustand state stores
│   ├── types/         # TypeScript type definitions
│   ├── App.tsx        # Main application component
│   └── main.tsx       # Entry point
├── public/            # Static assets
├── api/               # API-related code
├── stl_data/          # 3D model data
├── tests/             # Playwright tests
└── docs/              # Documentation
```

## Development
- **Dev Server**: `npm run dev` (runs on port 5000)
- **Build**: `npm run build`
- **Test**: `npm run test`
- **Lint**: `npm run lint`

## Environment Variables (Optional)
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key

## Deployment
Configured for static deployment. Build outputs to `dist/` directory.

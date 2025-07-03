# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React-based face parts manipulation application that allows users to upload images, detect faces, and manipulate individual facial features (eyes, mouth, nose). The app uses face-api.js for face detection and landmark extraction. Note: Image warping functionality with Fabric.js is planned but not yet implemented.

## Development Commands

- `npm run dev` - Start development server with Vite
- `npm run build` - Build production app (TypeScript compilation + Vite build)
- `npm run lint` - Run ESLint on all files
- `npm run preview` - Preview production build locally

## Project Structure

```
src/
├── components/
│   ├── layout/          # Layout components
│   │   └── MainLayout.tsx
│   ├── ui/              # Reusable UI components
│   │   ├── ImageUpload.tsx
│   │   ├── ImagePreview.tsx
│   │   └── ParameterControl.tsx
│   └── panels/          # Control panels
│       ├── ControlPanel.tsx
│       ├── EyeControls.tsx
│       ├── MouthControls.tsx
│       └── NoseControls.tsx
├── features/            # Feature modules (future expansion)
│   ├── face-detection/
│   ├── image-warping/
│   └── image-export/
├── hooks/              # Custom React hooks
├── stores/             # Zustand state management
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
├── styles/             # CSS files
│   └── globals.css
└── assets/             # Static resources
```

## Architecture

### State Management
- **Zustand store** (`src/stores/faceStore.ts`): Centralized state management for:
  - Original and processed image data
  - Face detection results and landmarks
  - Face manipulation parameters for each part (eyes, mouth, nose)
  - Loading/processing states and error handling

### Face Detection Pipeline
1. **Model Loading** (`src/utils/faceDetection.ts`): Loads face-api.js models from `/public/models/`
2. **Detection** (`src/hooks/useFaceDetection.ts`): Detects faces and extracts 68 facial landmarks
3. **Processing**: Converts landmarks to part-specific coordinates and calculates centers/bounds

### Component Organization
- **Layout** (`src/components/layout/`): Main application layout
- **UI Components** (`src/components/ui/`): Reusable components like image upload, preview, and parameter controls
- **Control Panels** (`src/components/panels/`): Face part manipulation controls organized by feature

### Key Data Types
- **FaceParams**: Hierarchical structure containing parameters for each facial part
- **FaceLandmarks**: 68-point facial landmark coordinates grouped by part
- **FaceDetectionResult**: Complete detection result with confidence, bounds, and centers

### Face Manipulation Parameters
- **Eyes**: size (0.5-2.0), positionX/Y (-20 to +20)
- **Mouth**: width/height (0.5-2.0), positionX/Y (-30 to +30)  
- **Nose**: width/height (0.7-1.5), positionX/Y (-15 to +15)

## Technology Stack

- **Frontend**: React 19 + TypeScript + Vite
- **UI**: Material-UI (MUI) with Emotion styling
- **Face Detection**: face-api.js with TinyFaceDetector + 68-point landmarks
- **Image Manipulation**: Fabric.js for canvas operations (planned, not implemented)
- **State Management**: Zustand for global state
- **Build Tools**: Vite, TypeScript, ESLint

## Development Status

### ✅ Completed Features (Phase 1-3)
- Project foundation (React + TypeScript + Vite setup)
- Face detection using face-api.js (68-point landmark extraction)
- UI component structure with Material-UI
- State management with Zustand
- Image upload with validation
- Control panels for face part parameter adjustment
- Real-time landmark visualization

### ⏳ Pending Features (Phase 4+)
- **Image warping implementation** (highest priority)
- Real-time face manipulation using facial parameters
- Image export functionality
- Performance optimization
- Enhanced error handling

## Important Notes

- Face detection models are loaded from `/public/models/` and must be present for the app to function
- The app supports single-face detection only (uses first detected face if multiple found)
- All facial part parameters have defined ranges and step values in `PARAM_LIMITS`
- The store provides granular update methods for each face part to optimize re-renders
- Error handling includes validation for model loading, face detection confidence, and image processing
- **Core functionality (image warping) is not yet implemented** - currently only shows face detection visualization

## Code Organization Guidelines

- Use absolute imports from `src/` root when referencing across different module categories
- Components are organized by responsibility: `layout/`, `ui/`, `panels/`
- Future features should be implemented in `src/features/` with their own subdirectories
- All CSS should be placed in `src/styles/` directory
- Type definitions should be comprehensive and placed in `src/types/`
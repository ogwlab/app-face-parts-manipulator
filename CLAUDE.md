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

### ✅ Completed Features (Phase 1-5.0)
- Project foundation (React + TypeScript + Vite setup)
- Face detection using face-api.js (68-point landmark extraction)
- UI component structure with Material-UI
- State management with Zustand
- Image upload with validation
- Control panels for face part parameter adjustment
- Real-time landmark visualization
- Canvas display size unification (Phase 3.5)
- **Image warping implementation** (Phase 4-4.8)
  - TPS (Thin Plate Spline) based transformation system
  - Adaptive warping with quality controls
  - Horizontal noise elimination through sampling improvements
  - Feature point overlay toggle for original image
  - Expanded parameter limits for creative transformations
  - **Neck area deformation prevention** (Phase 4.6)
  - **Advanced eye control system** (Phase 4.7-4.8)
    - Pupil center fixing (no movement during scaling)
    - Iris shape preservation (perfect circle maintenance)
    - 3-layer eye control (contour, center, iris boundary)
- **Complete parts movement functionality** (Phase 5.0)
  - Unified movement multipliers (1.0x for all parts)
  - Consistent control point weights
  - Eye movement with iris shape preservation
  - UI-accurate movement values

### ✅ All Major Issues Resolved
- ~~Horizontal noise/striping~~ → **SOLVED** (Phase 4.1)
- ~~Neck area deformation~~ → **SOLVED** (Phase 4.6)
- ~~Eye pupil distortion~~ → **SOLVED** (Phase 4.7-4.8)
- ~~Feature point visualization~~ → **SOLVED** (Phase 4.2)
- ~~Parts movement functionality~~ → **SOLVED** (Phase 5.0)

### ⏳ Future Enhancement Opportunities (Phase 6+)
- Image export functionality
- Performance optimization for high-resolution images
- Additional facial feature controls (eyebrows, cheeks)
- Batch processing capabilities
- Advanced lighting and shadow adjustments
- GPU acceleration for real-time processing
- Machine learning-based facial feature suggestions
- Multi-face support
- Video processing capabilities

## Important Notes

- Face detection models are loaded from `/public/models/` and must be present for the app to function
- The app supports single-face detection only (uses first detected face if multiple found)
- All facial part parameters have defined ranges and step values in `PARAM_LIMITS`
- The store provides granular update methods for each face part to optimize re-renders
- Error handling includes validation for model loading, face detection confidence, and image processing
- Canvas display sizes are unified between original and edited image areas for consistent UI design
- **Core functionality (image warping) is fully implemented and optimized** with advanced anatomical constraints
- **Independent System** provides feature-point based transformations with part-specific controls
- **3-layer eye control** ensures anatomically accurate eye transformations

## Implementation History & Lessons Learned

### Phase 4 Implementation Journey (Image Warping)

#### ✅ Problems Successfully Solved:
1. **Horizontal Noise/Striping (Critical)**
   - **Problem**: Adaptive sampling with left-pixel copying caused horizontal band artifacts
   - **Root Cause**: `if (Math.random() > samplingDensity)` with fallback to left pixel
   - **Solution**: Disabled adaptive sampling, implemented full pixel processing
   - **Files Modified**: `src/features/image-warping/adaptiveWarping.ts:347-353`

2. **Feature Point Overlay Toggle**
   - **Problem**: User needed to visualize face landmarks on original image
   - **Solution**: Added toggle button in ImagePreview component
   - **Files Modified**: `src/components/ui/ImagePreview.tsx`

3. **Parameter Range Expansion**
   - **Problem**: Limited creative freedom with small parameter ranges
   - **Solution**: Expanded all limits significantly (e.g., eye size: 0.5-2.0 → 0.2-4.0)
   - **Files Modified**: `src/types/face.ts` PARAM_LIMITS

#### ⚠️ Current Active Problem:
**Neck Area Deformation**
- **Problem**: "目の大きさを少し変えると首回りまで変形してしまう"
- **Root Cause**: Influence radius too large (150px in traditional system)
- **User Requirement**: "変化した部位の周辺のみに影響を限定してほしい"
- **User Clarification**: Inter-part interaction loss is acceptable

#### 🔧 System Architecture Status:
- **Traditional System**: Currently active (deformationMode: 'traditional')
  - Location: `src/features/image-warping/adaptiveWarping.ts`
  - Influence radius: 150px (line 372)
  - Status: ✅ Working but needs localization

- **Independent System**: Implemented but disabled
  - Location: `src/features/image-warping/independentDeformation.ts`
  - Features: Part-specific segmentation, barrier system
  - Status: ⚠️ Complex, needs debugging

#### ✅ **SOLVED: Neck Area Deformation (Phase 4.6)**
**Implementation Date**: 2025-07-03
**Solution**: Hybrid Approach - Part-specific influence radii in Traditional System

**Changes Made**:
1. **New Function**: `getPartInfluenceRadius()` in `adaptiveWarping.ts:213-226`
   ```typescript
   function getPartInfluenceRadius(partType: string): number {
     switch (partType) {
       case 'eye': return 60;    // 150px → 60px (60% reduction)
       case 'mouth': return 70;  // 150px → 70px
       case 'nose': return 50;   // 150px → 50px (minimum)
       case 'stabilizer': return 60;
       default: return 60;
     }
   }
   ```

2. **Modified Line 390**: Dynamic part-specific radius instead of fixed 150px
   ```typescript
   const maxInfluence = cp.influenceRadius || getPartInfluenceRadius(cp.partType || 'eye');
   ```

**Results**:
- ✅ **Neck deformation eliminated**: Eye transformations no longer affect neck/collar area
- ✅ **Simple implementation**: Minimal changes to proven Traditional System
- ✅ **Preserved compatibility**: Existing quality settings and gradient processing intact
- ✅ **User requirement met**: "変化した部位の周辺のみに影響を限定してほしい"

**Technical Details**:
- **System Used**: Traditional System (deformationMode: 'traditional')
- **Build Status**: ✅ Successfully compiles
- **Performance**: No degradation expected
- **User Acceptance**: Inter-part interaction loss is acceptable per user clarification

#### ✅ **SOLVED: Eye Pupil Deformation Issues (Phase 4.7-4.8)**
**Implementation Date**: 2025-07-03
**Problem**: "目を一定以上に大きくしたときに黒目が不自然になる"
**Solution**: Advanced Eye Control System with Iris Shape Preservation

**Phase 4.7 - Pupil Center Control**:
1. **Pupil Center Control Points** in `independentDeformation.ts:132-148`
   ```typescript
   // 瞳孔中心制御点を追加（黒目の自然な変形のため）
   controlPoints.push({
     original: center,
     target: eyeCenterTarget,
     weight: 1.5, // 高い重みで瞳孔中心を強制
     influenceRadius: Math.min(region.influenceRadius * 0.6, 30)
   });
   ```

**Phase 4.8 - Iris Shape Preservation & Center Fixing**:
1. **Iris Radius Calculation** in `independentDeformation.ts:310-313`
   ```typescript
   function calculateIrisRadius(eyeLandmarks: Point[]): number {
     const eyeWidth = Math.max(...eyeLandmarks.map(p => p.x)) - Math.min(...eyeLandmarks.map(p => p.x));
     return eyeWidth * 0.35; // 典型的な虹彩比率
   }
   ```

2. **Circular Control Points Generation** in `independentDeformation.ts:318-328`
   ```typescript
   function generateCircularControlPoints(center: Point, radius: number, count: number): Point[]
   ```

3. **3-Layer Control System**:
   - **Eye Contour Control** (weight: 1.0) - Natural eye outline expansion
   - **Pupil Center Fixing** (weight: 2.0) - Complete position lock: `target = center`
   - **Iris Boundary Control** (weight: 1.2) - 8-direction circular constraints

**Results**:
- ✅ **Iris maintains perfect circular shape** during scaling
- ✅ **Pupil center completely fixed** (no movement)
- ✅ **Anatomically accurate eye transformation**
- ✅ **Black eye deformation completely eliminated**
- ✅ **User satisfaction**: "いいですね" - significant improvement confirmed

**Technical Details**:
- **System Used**: Independent System (deformationMode: 'independent')
- **Iris Control**: 8 circular control points at 35% eye width radius
- **Center Constraint**: Weight 2.0 with 20px influence radius
- **Build Status**: ✅ Successfully compiles and functions

#### ✅ **SOLVED: Parts Movement Functionality (Phase 5.0)**
**Implementation Date**: 2025-07-04
**Version**: 5.0.0 - パーツ移動機能完全修正版
**Problem**: パーツ移動がUI設定値通りに動作しない（大幅減衰）

**Root Cause Analysis**:
1. **Movement Multiplier Inconsistency**:
   - Eyes: `positionX * 0.5` (50% attenuation)
   - Nose: `positionX * 0.4` (60% attenuation)  
   - Mouth: `positionX * 0.3` (70% attenuation)
2. **Control Point Weight Inconsistency**:
   - Eyes: weight 1.0, Nose: weight 0.9, Mouth: weight 0.8
3. **Eye Movement Contradiction**:
   - Pupil center completely fixed with weight 2.0
   - Contour control points had movement calculation but were overridden

**Solution: Unified Movement System**:
```typescript
// 1. Unified Movement Multipliers (1.0x for all parts)
目/鼻/口: positionX * 1.0  // 100% UI value application

// 2. Unified Control Point Weights
目輪郭/鼻/口: weight: 1.0  // Standard weight
瞳孔中心: weight: 1.5      // Slightly higher for shape preservation
虹彩境界: weight: 1.2      // Higher for circular preservation

// 3. Eye Movement with Iris Preservation
const newCenter = {
  x: center.x + faceParams.leftEye.positionX * 1.0,
  y: center.y + faceParams.leftEye.positionY * 1.0
};
// All control points use newCenter for consistent movement
```

**Results**:
- ✅ **UI-accurate movement**: 25px setting → 25px actual movement
- ✅ **Consistent behavior**: All parts move with same precision
- ✅ **Eye movement restoration**: Movement works with iris shape preservation
- ✅ **Improved UX**: Intuitive control response

**Technical Details**:
- **Modified Files**: `independentDeformation.ts`
- **Movement Multipliers**: Unified to 1.0x across all parts
- **Control Weights**: Balanced for functionality and shape preservation
- **Eye System**: 3-layer control with movement support
- **Version Management**: HTML title and version display added

### ✅ Version 5.2.0 Complete - Triangle Mesh Forward Mapping (2025-01-04)
**Implementation Date**: 2025-01-04
**Branch**: `feature/v5.2-triangle-mesh-forward-mapping`
**Major Achievement**: Complete transition to triangle mesh-based forward mapping system

**Key Features**:
1. **Delaunay Triangulation**: Face-optimized mesh generation with 68 landmarks + 28 boundary points
2. **Forward Mapping**: Eliminated residual artifacts from backward mapping
3. **Coordinate Scaling**: Fixed image-to-canvas coordinate transformation
4. **Performance**: Efficient triangle rendering with barycentric interpolation

**Technical Details**:
- Source mesh: 96 vertices (68 landmarks + 28 boundary), 163 triangles
- Unified point array approach for consistent indexing
- Proper scaling from image space (1180×787) to canvas space (448×298)
- All triangles now process correctly without index errors
- Default deformation mode set to 'mesh' for high quality
- Debug mesh visualization removed (not needed with perfect rendering)

**Fixed Issues**:
- ✅ Boundary point index errors resolved
- ✅ Coordinate system mismatch fixed
- ✅ Triangle rendering counter bugs fixed
- ✅ Screen boundary detection corrected


#### ✅ **RESOLVED: Boundary Point Index Issue (Version 5.2.0)**
**Implementation Date**: 2025-07-04
**Problem**: Triangle indices 109-162 caused "インデックスが範囲外" errors
**Root Cause**: Source mesh had 96 points (68 landmarks + 28 boundary) but target mesh only had 68 points

**Solution**: Unified Point Array Approach
1. **Export Boundary Generator** (`delaunay.ts:289`):
   ```typescript
   export function generateBoundaryPoints(width: number, height: number): Point[]
   ```

2. **Import in MeshDeformation** (`meshDeformation.ts:8`):
   ```typescript
   import { createFaceOptimizedTriangulation, generateBoundaryPoints } from '../triangulation/delaunay';
   ```

3. **Unified Point Array Creation** (`meshDeformation.ts:217-221`):
   ```typescript
   const boundaryPoints = generateBoundaryPoints(imageWidth, imageHeight);
   const allDeformedPoints = [...deformedPoints, ...boundaryPoints];
   // landmarks=68, boundary=28, total=96 points
   ```

4. **Index Consistency** (`meshDeformation.ts:236-251`):
   ```typescript
   // All triangles now reference valid indices 0-95
   const deformedVertices = [
     allDeformedPoints[idx0], allDeformedPoints[idx1], allDeformedPoints[idx2]
   ];
   ```

**Results**:
- ✅ **All 163 triangles processed**: No more index out of range errors
- ✅ **Boundary stability**: Fixed boundary points ensure natural edge transitions
- ✅ **Version 5.2.0 complete**: Triangle mesh forward mapping system fully functional

**Technical Details**:
- **Boundary behavior**: Fixed points (no deformation) for natural edge convergence
- **Performance**: Minimal impact (28 additional points only)
- **Triangle count**: Full 163 triangles now processed correctly

#### 🔧 **RESOLVED: Security Permission Issue**
**Implementation Date**: 2025-07-04  
**Issue**: CodeRabbit flagged overly broad `"Bash(grep:*)"` permission
**Solution**: Removed unused `grep` permission from `.claude/settings.local.json`
**Result**: ✅ Security risk eliminated, no functional impact

#### 🔧 **RESOLVED: CodeRabbit Robustness Improvements**
**Implementation Date**: 2025-07-04
**Issues**: CodeRabbit flagged 3 robustness issues in triangulation system
**Solutions**:
1. **Degenerate Triangle Handling** (`delaunay.ts:178-185`):
   - Changed from `radius: Infinity` to `radius: Number.MAX_SAFE_INTEGER`
   - Added warning logging for degenerate triangles
   - Return triangle centroid instead of (0,0) for better stability

2. **Super Triangle Indexing** (`delaunay.ts:241-253`):
   - Changed from fixed `-999` to `-1` for super triangle vertices
   - Added warning logging for unknown points
   - Improved documentation for better maintenance

3. **Barycentric Coordinate Safety** (`affineTransform.ts:245-250`):
   - Added `isFinite(invDenom)` check before division
   - Return safe fallback `{u:0, v:0, w:1}` for degenerate triangles
   - Prevents division by zero in collinear vertex cases

**Result**: ✅ Enhanced numerical stability and error handling in mesh system

## Code Organization Guidelines

- Use absolute imports from `src/` root when referencing across different module categories
- Components are organized by responsibility: `layout/`, `ui/`, `panels/`
- Future features should be implemented in `src/features/` with their own subdirectories
- All CSS should be placed in `src/styles/` directory
- Type definitions should be comprehensive and placed in `src/types/`
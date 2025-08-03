# Face Parts Manipulator API リファレンス

## 目次

1. [コンポーネントAPI](#1-コンポーネントapi)
2. [カスタムフック](#2-カスタムフック)
3. [ストア (Zustand)](#3-ストア-zustand)
4. [ユーティリティ関数](#4-ユーティリティ関数)
5. [型定義](#5-型定義)

---

## 1. コンポーネントAPI

### 1.1 ImageUpload

**インポート**
```typescript
import ImageUpload from '@/components/ui/ImageUpload';
```

**使用例**
```tsx
<ImageUpload />
```

**Props**: なし（Zustandストアを直接使用）

**機能**
- ドラッグ&ドロップ対応
- ファイル検証（形式、サイズ、解像度）
- エラーメッセージ表示

---

### 1.2 ImagePreview

**インポート**
```typescript
import ImagePreview from '@/components/ui/ImagePreview';
```

**使用例**
```tsx
<ImagePreview />
```

**内部状態**
```typescript
const [imageLoaded, setImageLoaded] = useState(false);
const [canvasSize, setCanvasSize] = useState<{width: number, height: number} | null>(null);
const [warpingQuality, setWarpingQuality] = useState<'fast' | 'medium' | 'high'>('high');
const [showLandmarks, setShowLandmarks] = useState<boolean>(true);
```

---

### 1.3 ParameterControl

**インポート**
```typescript
import ParameterControl from '@/components/ui/ParameterControl';
```

**Props**
```typescript
interface ParameterControlProps {
  label: string;              // パラメータのラベル
  value: number;              // 現在の値
  min: number;                // 最小値
  max: number;                // 最大値
  step: number;               // ステップ値
  unit?: string;              // 単位（オプション）
  onChange: (value: number) => void;  // 値変更時のコールバック
  onReset?: () => void;       // リセット時のコールバック（オプション）
  disabled?: boolean;         // 無効化フラグ（オプション）
}
```

**使用例**
```tsx
<ParameterControl
  label="大きさ"
  value={eyeParams.size}
  min={0.2}
  max={4.0}
  step={0.01}
  unit="倍"
  onChange={(value) => updateEyeParams('left', { size: value })}
  onReset={() => updateEyeParams('left', { size: 1.0 })}
/>
```

---

### 1.4 SaveButton

**インポート**
```typescript
import SaveButton from '@/components/ui/SaveButton';
```

**Props**
```typescript
interface SaveButtonProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}
```

**使用例**
```tsx
const canvasRef = useRef<HTMLCanvasElement>(null);
<SaveButton canvasRef={canvasRef} />
```

---

### 1.5 ControlPanel

**インポート**
```typescript
import ControlPanel from '@/components/panels/ControlPanel';
```

**使用例**
```tsx
<ControlPanel />
```

**タブ構成**
- Tab 0: 目の調整 (EyeControls)
- Tab 1: 口の調整 (MouthControls)  
- Tab 2: 鼻の調整 (NoseControls)
- Tab 3: 🆕 輪郭の調整 (ContourControls)

---

### 1.6 ContourControls

**インポート**
```typescript
import ContourControls from '@/components/panels/ContourControls';
```

**使用例**
```tsx
<ContourControls />
```

**Props**: なし（Zustandストアを直接使用）

**機能**
- 顔の輪郭形状制御
- 5つのパラメータスライダー
- リアルタイムプレビュー
- 個別・全体リセット機能

**パラメータ詳細**
```typescript
interface ContourParams {
  roundness: number;      // -1.0〜1.0 (負: 角張り, 正: 丸み)
  jawWidth: number;       // 0.7〜1.3 (顎の幅)
  cheekFullness: number;  // 0.7〜1.3 (頬の膨らみ)
  chinHeight: number;     // 0.8〜1.2 (顎の長さ)
  smoothness: number;     // 0.0〜1.0 (輪郭の滑らかさ)
}
```

**ストアアクション**
```typescript
const { updateContourParams } = useFaceStore();

// 個別パラメータ更新
updateContourParams({ roundness: 0.5 });

// 複数パラメータ更新
updateContourParams({ 
  jawWidth: 1.2, 
  cheekFullness: 0.8 
});
```

---

### 1.7 RenderModeSelector

**インポート**
```typescript
import RenderModeSelector from '@/components/panels/RenderModeSelector';
```

**使用例**
```tsx
<RenderModeSelector />
```

**選択肢**
- `forward`: 高速モード (~100ms)
- `hybrid`: バランスモード (~300ms)
- `backward`: 高品質モード (~2000ms)

---

## 2. カスタムフック

### 2.1 useFaceDetection

**インポート**
```typescript
import { useFaceDetection } from '@/hooks/useFaceDetection';
```

**シグネチャ**
```typescript
function useFaceDetection(imageUrl: string | null): void
```

**使用例**
```typescript
const { originalImage } = useFaceStore();
useFaceDetection(originalImage?.url || null);
```

**動作**
1. face-api.jsモデルの読み込み
2. 顔検出の実行
3. 68点特徴点の抽出
4. ストアへの結果保存

---

### 2.2 useImageWarping

**インポート**
```typescript
import { useImageWarping } from '@/hooks/useImageWarping';
```

**戻り値**
```typescript
interface UseImageWarpingReturn {
  initializeCanvas: (
    canvas: HTMLCanvasElement, 
    width: number, 
    height: number
  ) => void;
}
```

**使用例**
```typescript
const { initializeCanvas } = useImageWarping();

useEffect(() => {
  if (canvasRef.current && canvasSize) {
    initializeCanvas(canvasRef.current, canvasSize.width, canvasSize.height);
  }
}, [canvasSize, initializeCanvas]);
```

---

## 3. ストア (Zustand)

### 3.1 FaceStore

**インポート**
```typescript
import { useFaceStore } from '@/stores/faceStore';
```

**ストア構造**
```typescript
interface FaceStore {
  // 画像データ
  originalImage: ImageData | null;
  processedImageUrl: string | null;
  
  // 顔検出
  faceDetection: FaceDetectionResult | null;
  isDetecting: boolean;
  
  // パラメータ
  faceParams: FaceParams;
  
  // 処理状態
  isProcessing: boolean;
  renderMode: 'forward' | 'backward' | 'hybrid';
  
  // エクスポート設定
  exportSettings: {
    format: 'png' | 'jpg';
    jpgQuality: number;
  };
  
  // アクション
  setOriginalImage: (imageData: ImageData) => void;
  setProcessedImageUrl: (url: string | null) => void;
  setFaceDetection: (result: FaceDetectionResult | null) => void;
  setIsDetecting: (isDetecting: boolean) => void;
  setIsProcessing: (isProcessing: boolean) => void;
  updateEyeParams: (eye: 'left' | 'right', params: Partial<EyeParams>) => void;
  updateMouthParams: (params: Partial<MouthParams>) => void;
  updateNoseParams: (params: Partial<NoseParams>) => void;
  resetParams: () => void;
  resetPartParams: (part: 'leftEye' | 'rightEye' | 'mouth' | 'nose') => void;
  resetAll: () => void;
  setRenderMode: (mode: 'forward' | 'backward' | 'hybrid') => void;
  setExportSettings: (settings: Partial<ExportSettings>) => void;
}
```

**使用例**
```typescript
// 値の取得
const { faceParams, isProcessing } = useFaceStore();

// アクションの使用
const updateEyeParams = useFaceStore((state) => state.updateEyeParams);
updateEyeParams('left', { size: 1.5 });

// 複数の値とアクションを取得
const { 
  originalImage, 
  setOriginalImage, 
  resetAll 
} = useFaceStore();
```

---

## 4. ユーティリティ関数

### 4.1 顔検出関連

**loadModels**
```typescript
async function loadModels(): Promise<void>
```
face-api.jsのモデルを読み込みます。

**detectFace**
```typescript
async function detectFace(
  imageUrl: string
): Promise<FaceDetectionResult | null>
```
画像から顔を検出し、68点の特徴点を返します。

---

### 4.2 ファイル名生成

**generateFileName**
```typescript
function generateFileName(options: FileNameOptions): string

interface FileNameOptions {
  format: 'png' | 'jpg';
  prefix?: string;
  includeTimestamp?: boolean;
  includeParams?: boolean;
  faceParams?: FaceParams;
}
```

**使用例**
```typescript
const fileName = generateFileName({
  format: 'png',
  includeTimestamp: true,
  includeParams: true,
  faceParams: currentFaceParams
});
// 結果: "face-edit-20250104-153045-eye2.0x-mouth1.5x.png"
```

---

### 4.3 画像変形関数

**deformImageWithTriangleMesh**
```typescript
function deformImageWithTriangleMesh(
  sourceCanvas: HTMLCanvasElement,
  targetCanvas: HTMLCanvasElement,
  sourceLandmarks: Point[],
  deformedLandmarks: Point[],
  imageWidth: number,
  imageHeight: number,
  renderMode: 'forward' | 'backward' | 'hybrid' = 'forward'
): void
```

**delaunayTriangulation**
```typescript
function delaunayTriangulation(points: Point[]): Triangle[]
```

**computeAffineTransform**
```typescript
function computeAffineTransform(
  src: Triangle,
  dst: Triangle
): AffineTransform
```

---

## 5. 型定義

### 5.1 基本型

```typescript
// 座標点
interface Point {
  x: number;
  y: number;
}

// 三角形
interface Triangle {
  vertices: [Point, Point, Point];
}

// アフィン変換
interface AffineTransform {
  a: number;  // x軸のスケールと回転
  b: number;  // x軸のせん断
  c: number;  // x軸の平行移動
  d: number;  // y軸のせん断
  e: number;  // y軸のスケールと回転
  f: number;  // y軸の平行移動
}
```

### 5.2 顔関連の型

```typescript
// 顔パラメータ
interface FaceParams {
  leftEye: EyeParams;
  rightEye: EyeParams;
  mouth: MouthParams;
  nose: NoseParams;
  contour: ContourParams; // 🆕 輪郭パラメータ
}

// 目のパラメータ
interface EyeParams {
  size: number;      // 0.2-4.0
  positionX: number; // -50 to +50
  positionY: number; // -50 to +50
}

// 口のパラメータ
interface MouthParams {
  width: number;     // 0.2-4.0
  height: number;    // 0.2-4.0
  positionX: number; // -80 to +80
  positionY: number; // -80 to +80
}

// 鼻のパラメータ
interface NoseParams {
  width: number;     // 0.3-3.0
  height: number;    // 0.3-3.0
  positionX: number; // -40 to +40
  positionY: number; // -40 to +40
}

// 🆕 輪郭のパラメータ
interface ContourParams {
  roundness: number;      // -1.0〜1.0 (負: 角張り, 正: 丸み)
  jawWidth: number;       // 0.7〜1.3 (顎の幅)
  cheekFullness: number;  // 0.7〜1.3 (頬の膨らみ)
  chinHeight: number;     // 0.8〜1.2 (顎の長さ)
  smoothness: number;     // 0.0〜1.0 (輪郭の滑らかさ)
}
```

### 5.3 顔検出結果

```typescript
// 顔検出結果
interface FaceDetectionResult {
  isDetected: boolean;
  confidence: number;
  landmarks: FaceLandmarks;
  bounds: FaceBounds;
  centers: FaceCenters;
}

// 顔の特徴点
interface FaceLandmarks {
  jawline: Point[];      // 17点
  leftEyebrow: Point[];  // 5点
  rightEyebrow: Point[]; // 5点
  nose: Point[];         // 9点
  leftEye: Point[];      // 6点
  rightEye: Point[];     // 6点
  mouth: Point[];        // 20点
  all: Point[];          // 68点
}

// 顔の境界
interface FaceBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// 各パーツの中心点
interface FaceCenters {
  leftEye: Point;
  rightEye: Point;
  nose: Point;
  mouth: Point;
}
```

### 5.4 画像データ

```typescript
// 画像データ
interface ImageData {
  url: string;
  file: File;
  width: number;
  height: number;
}

// エクスポート設定
interface ExportSettings {
  format: 'png' | 'jpg';
  jpgQuality: number;  // 0.0-1.0
}
```

### 5.5 制御点

```typescript
// 制御点（ワーピング用）
interface ControlPoint {
  original: Point;           // 元の座標
  target: Point;             // 変形後の座標
  weight: number;            // 影響の重み
  influenceRadius: number;   // 影響半径
  partType?: string;         // パーツタイプ
}
```

---

## 使用例: 完全なコンポーネント

```tsx
import React, { useEffect } from 'react';
import { useFaceStore } from '@/stores/faceStore';
import { useFaceDetection } from '@/hooks/useFaceDetection';
import ImageUpload from '@/components/ui/ImageUpload';
import ImagePreview from '@/components/ui/ImagePreview';
import ControlPanel from '@/components/panels/ControlPanel';

function App() {
  const { originalImage } = useFaceStore();
  
  // 顔検出の実行
  useFaceDetection(originalImage?.url || null);
  
  return (
    <div className="app">
      {!originalImage ? (
        <ImageUpload />
      ) : (
        <div className="editor">
          <ImagePreview />
          <ControlPanel />
        </div>
      )}
    </div>
  );
}
```

---

最終更新日: 2025年1月4日
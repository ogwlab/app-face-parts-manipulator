# Face Parts Manipulator 技術仕様書

## 目次

1. [システム概要](#1-システム概要)
2. [アーキテクチャ](#2-アーキテクチャ)
3. [技術スタック](#3-技術スタック)
4. [ディレクトリ構造](#4-ディレクトリ構造)
5. [主要コンポーネント](#5-主要コンポーネント)
6. [顔検出システム](#6-顔検出システム)
7. [画像変形アルゴリズム](#7-画像変形アルゴリズム)
8. [状態管理](#8-状態管理)
9. [UIコンポーネント](#9-uiコンポーネント)
10. [ビルド・デプロイ](#10-ビルドデプロイ)

---

## 1. システム概要

### 1.1 プロジェクト基本情報
- **プロジェクト名**: Face Parts Manipulator
- **バージョン**: 5.2.2
- **目的**: 顔画像の各パーツ（目・口・鼻）を個別に拡大・縮小・移動する
- **対象ユーザー**: 一般ユーザー、写真編集愛好者

### 1.2 主要機能
1. **顔検出**: face-api.jsによる68点顔特徴点検出
2. **画像変形**: Triangle Mesh Forward Mappingによる自然な変形
3. **リアルタイムプレビュー**: パラメータ変更の即時反映
4. **画像保存**: PNG/JPG形式でのエクスポート
5. **レンダリングモード**: Forward/Hybrid/Backward の3モード

### 1.3 動作要件
- **ブラウザ**: Chrome 90+, Firefox 88+, Safari 14+
- **画面解像度**: 1280x720以上推奨
- **メモリ**: 4GB以上推奨

---

## 2. アーキテクチャ

### 2.1 全体構成
```
┌─────────────────────────────────────────────────────────┐
│                     ユーザーインターフェース                │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ImageUpload  │  │ImagePreview  │  │ControlPanel   │  │
│  └─────────────┘  └──────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────┐
│                        状態管理層                         │
│                    Zustand (faceStore)                   │
└─────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────┐
│                       ビジネスロジック層                   │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │Face Detection│  │Image Warping │  │File Export    │  │
│  └─────────────┘  └──────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 2.2 データフロー
1. **画像アップロード** → faceStore → 顔検出 → 特徴点抽出
2. **パラメータ変更** → faceStore → ワーピング処理 → Canvas更新
3. **画像保存** → Canvas → Blob変換 → ダウンロード

---

## 3. 技術スタック

### 3.1 フロントエンド
```json
{
  "react": "^19.0.0",
  "typescript": "~5.6.2",
  "vite": "^7.0.0",
  "@mui/material": "^6.3.1",
  "@emotion/react": "^11.14.0",
  "@emotion/styled": "^11.14.0"
}
```

### 3.2 画像処理
```json
{
  "face-api.js": "^0.22.2"
}
```

### 3.3 状態管理
```json
{
  "zustand": "^5.0.2"
}
```

### 3.4 開発ツール
```json
{
  "@vitejs/plugin-react": "^4.3.4",
  "eslint": "^9.17.0",
  "@types/react": "^19.0.6",
  "@types/react-dom": "^19.0.2"
}
```

---

## 4. ディレクトリ構造

```
src/
├── components/          # UIコンポーネント
│   ├── layout/         # レイアウト関連
│   │   └── MainLayout.tsx
│   ├── panels/         # コントロールパネル
│   │   ├── ControlPanel.tsx
│   │   ├── EyeControls.tsx
│   │   ├── MouthControls.tsx
│   │   ├── NoseControls.tsx
│   │   └── RenderModeSelector.tsx
│   └── ui/             # 汎用UIコンポーネント
│       ├── ImagePreview.tsx
│       ├── ImageUpload.tsx
│       ├── ParameterControl.tsx
│       └── SaveButton.tsx
├── features/           # 機能別モジュール
│   └── image-warping/  # 画像変形機能
│       ├── adaptiveWarping.ts
│       ├── anatomicalConstraints.ts
│       ├── canvasManager.ts
│       ├── forwardMapping/
│       │   ├── affineTransform.ts
│       │   ├── backwardRenderer.ts
│       │   ├── hybridRenderer.ts
│       │   ├── meshDeformation.ts
│       │   └── triangleRenderer.ts
│       ├── independentDeformation.ts
│       └── triangulation/
│           ├── delaunay.ts
│           └── types.ts
├── hooks/              # カスタムフック
│   ├── useFaceDetection.ts
│   └── useImageWarping.ts
├── stores/             # 状態管理
│   └── faceStore.ts
├── types/              # 型定義
│   └── face.ts
└── utils/              # ユーティリティ
    ├── faceDetection.ts
    └── fileNameGenerator.ts
```

---

## 5. 主要コンポーネント

### 5.1 ImageUpload コンポーネント
**ファイル**: `src/components/ui/ImageUpload.tsx`

**機能**:
- ドラッグ&ドロップによる画像アップロード
- ファイル形式検証 (JPG/PNG)
- ファイルサイズ検証 (8MB以下)
- 解像度検証 (1920px以下)

**主要Props**: なし（Zustandストアを直接参照）

**状態管理**:
```typescript
const { setOriginalImage, resetAll } = useFaceStore();
```

### 5.2 ImagePreview コンポーネント
**ファイル**: `src/components/ui/ImagePreview.tsx`

**機能**:
- 元画像と編集後画像の並列表示
- Canvas要素の管理
- 特徴点の可視化（トグル可能）
- 品質設定の選択

**Canvas管理**:
```typescript
const originalCanvasRef = useRef<HTMLCanvasElement>(null);
const fabricCanvasRef = useRef<HTMLCanvasElement>(null);
```

### 5.3 ControlPanel コンポーネント
**ファイル**: `src/components/panels/ControlPanel.tsx`

**機能**:
- タブによるパーツ切り替え（目・口・鼻）
- 全体リセットボタン
- レンダリングモード選択
- 操作説明の表示

**タブ構成**:
- Tab 0: 目の調整
- Tab 1: 口の調整  
- Tab 2: 鼻の調整

---

## 6. 顔検出システム

### 6.1 face-api.js 初期化
**ファイル**: `src/utils/faceDetection.ts`

**モデル読み込み**:
```typescript
await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
```

**必要なモデルファイル**:
- `tiny_face_detector_model-shard1`
- `tiny_face_detector_model-weights_manifest.json`
- `face_landmark_68_model-shard1`
- `face_landmark_68_model-weights_manifest.json`

### 6.2 顔検出処理
**検出オプション**:
```typescript
const options = new faceapi.TinyFaceDetectorOptions({
  inputSize: 416,
  scoreThreshold: 0.5
});
```

### 6.3 特徴点の分類
68個の特徴点を以下のように分類:
- **顎ライン**: 0-16 (17点)
- **左眉毛**: 17-21 (5点)
- **右眉毛**: 22-26 (5点)
- **鼻筋**: 27-30 (4点)
- **鼻下部**: 31-35 (5点)
- **左目**: 36-41 (6点)
- **右目**: 42-47 (6点)
- **口外側**: 48-59 (12点)
- **口内側**: 60-67 (8点)

---

## 7. 画像変形アルゴリズム

### 7.1 Triangle Mesh Forward Mapping
**ファイル**: `src/features/image-warping/forwardMapping/meshDeformation.ts`

**処理フロー**:
1. Delaunay三角分割による顔メッシュ生成
2. 制御点の生成と移動計算
3. アフィン変換による三角形単位の変形
4. スキャンライン法によるレンダリング

### 7.2 Delaunay三角分割
**ファイル**: `src/features/image-warping/triangulation/delaunay.ts`

**アルゴリズム**:
```typescript
export function delaunayTriangulation(points: Point[]): Triangle[] {
  // 1. スーパートライアングルの作成
  // 2. 点の逐次挿入
  // 3. Bowyer-Watson アルゴリズム
  // 4. スーパートライアングルの除去
}
```

**最適化**:
- 68個の顔特徴点 + 28個の境界点 = 96点
- 約163個の三角形を生成

### 7.3 制御点システム
**目の制御** (3層構造):
1. **輪郭制御点** (weight: 1.0) - 目の外形
2. **瞳孔中心固定** (weight: 1.5) - 完全固定
3. **虹彩境界制御** (weight: 1.2) - 円形保持

**パラメータ範囲**:
```typescript
const PARAM_LIMITS = {
  eye: {
    size: { min: 0.2, max: 4.0, step: 0.01, default: 1.0 },
    positionX: { min: -50, max: 50, step: 1, default: 0 },
    positionY: { min: -50, max: 50, step: 1, default: 0 }
  },
  mouth: {
    width: { min: 0.2, max: 4.0, step: 0.01, default: 1.0 },
    height: { min: 0.2, max: 4.0, step: 0.01, default: 1.0 },
    positionX: { min: -80, max: 80, step: 1, default: 0 },
    positionY: { min: -80, max: 80, step: 1, default: 0 }
  },
  nose: {
    width: { min: 0.3, max: 3.0, step: 0.01, default: 1.0 },
    height: { min: 0.3, max: 3.0, step: 0.01, default: 1.0 },
    positionX: { min: -40, max: 40, step: 1, default: 0 },
    positionY: { min: -40, max: 40, step: 1, default: 0 }
  }
};
```

### 7.4 レンダリングモード

#### Forward Rendering (高速)
```typescript
// ソース三角形 → ターゲット三角形への直接マッピング
// 処理時間: ~100ms
```

#### Backward Rendering (高品質)
```typescript
// ターゲットピクセル → ソースピクセルへの逆算
// 処理時間: ~2000ms
```

#### Hybrid Rendering (バランス型)
```typescript
// エッジ部分のみBackward、内部はForward
// 処理時間: ~300ms
// エッジ幅: 20px (デフォルト)
```

---

## 8. 状態管理

### 8.1 Zustand Store構造
**ファイル**: `src/stores/faceStore.ts`

```typescript
interface FaceStore {
  // 画像関連
  originalImage: ImageData | null;
  processedImageUrl: string | null;
  
  // 顔検出関連
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
  setFaceDetection: (result: FaceDetectionResult | null) => void;
  updateEyeParams: (eye: 'left' | 'right', params: Partial<EyeParams>) => void;
  updateMouthParams: (params: Partial<MouthParams>) => void;
  updateNoseParams: (params: Partial<NoseParams>) => void;
  resetParams: () => void;
  resetAll: () => void;
}
```

### 8.2 パラメータ更新の最適化
```typescript
// 部分更新による再レンダリング最小化
updateEyeParams: (eye, params) => set((state) => ({
  faceParams: {
    ...state.faceParams,
    [eye === 'left' ? 'leftEye' : 'rightEye']: {
      ...state.faceParams[eye === 'left' ? 'leftEye' : 'rightEye'],
      ...params
    }
  }
}))
```

---

## 9. UIコンポーネント

### 9.1 ParameterControl
**共通スライダーコンポーネント**

Props:
```typescript
interface ParameterControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
  onReset?: () => void;
  disabled?: boolean;
}
```

機能:
- スライダーと数値入力の連動
- リセットボタン（オプション）
- 値の検証とクランプ

### 9.2 SaveButton
**画像保存機能**

処理フロー:
1. Canvas要素からBlobを生成
2. ファイル名の自動生成（タイムスタンプ+パラメータ）
3. ダウンロードリンクの作成と自動クリック
4. Snackbarによる完了通知

ファイル名形式:
```
face-edit-YYYYMMDD-HHMMSS-[eye2.0x]-[mouth1.5x].png
```

### 9.3 RenderModeSelector
**レンダリングモード選択**

選択肢:
- Forward (最速): ~100ms
- Hybrid (推奨): ~300ms  
- Backward (最高品質): ~2000ms

---

## 10. ビルド・デプロイ

### 10.1 開発環境
```bash
# 依存関係のインストール
npm install

# 開発サーバー起動
npm run dev  # http://localhost:5173

# TypeScriptチェック
npm run tsc
```

### 10.2 プロダクションビルド
```bash
# ビルド実行
npm run build

# 出力先: dist/
# - index.html
# - assets/
#   - index-[hash].js
#   - index-[hash].css
# - models/ (face-api.jsモデル)
```

### 10.3 環境要件
- Node.js: 18.0.0以上
- npm: 9.0.0以上

### 10.4 デプロイ設定
静的ホスティングサービスで配信可能:
- Vercel
- Netlify  
- GitHub Pages
- AWS S3 + CloudFront

**重要**: `/models/` ディレクトリへのアクセスを許可する必要があります。

---

## 付録A: 主要な型定義

```typescript
// 顔パラメータ
interface FaceParams {
  leftEye: EyeParams;
  rightEye: EyeParams;
  mouth: MouthParams;
  nose: NoseParams;
}

// パーツ別パラメータ
interface EyeParams {
  size: number;      // 0.2-4.0
  positionX: number; // -50 to +50
  positionY: number; // -50 to +50
}

interface MouthParams {
  width: number;     // 0.2-4.0
  height: number;    // 0.2-4.0
  positionX: number; // -80 to +80
  positionY: number; // -80 to +80
}

interface NoseParams {
  width: number;     // 0.3-3.0
  height: number;    // 0.3-3.0
  positionX: number; // -40 to +40
  positionY: number; // -40 to +40
}

// 顔検出結果
interface FaceDetectionResult {
  isDetected: boolean;
  confidence: number;
  landmarks: FaceLandmarks;
  bounds: FaceBounds;
  centers: FaceCenters;
}

// 三角形メッシュ
interface Triangle {
  vertices: [Point, Point, Point];
}

interface Point {
  x: number;
  y: number;
}
```

---

## 付録B: パフォーマンス最適化

### メモリ使用量削減
1. Canvas要素の適切なサイズ設定
2. 不要な再レンダリングの防止
3. 画像データのキャッシュ管理

### 処理速度向上
1. バウンディングボックスによる処理範囲限定
2. スキャンライン法による効率的なラスタライズ
3. Web Workersの活用（将来実装）

### バンドルサイズ最適化
1. Tree-shakingによる未使用コード削除
2. 動的インポート検討（将来実装）
3. 画像アセットの最適化

---

この仕様書は Version 5.2.2 時点の情報に基づいています。
最終更新日: 2025年1月4日
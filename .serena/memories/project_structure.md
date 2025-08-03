# Face Parts Manipulator プロジェクト構造

## ディレクトリ構造
```
/
├── src/                          # ソースコード
│   ├── components/               # Reactコンポーネント
│   │   ├── TopLevelTabs.tsx    # メインタブ（標準化/パーツ操作）
│   │   ├── layout/             # レイアウトコンポーネント
│   │   │   └── MainLayout.tsx
│   │   ├── ui/                 # 再利用可能UIコンポーネント
│   │   │   ├── ImageUpload.tsx
│   │   │   ├── ImagePreview.tsx
│   │   │   ├── ParameterControl.tsx
│   │   │   ├── SaveButton.tsx
│   │   │   ├── UnifiedQualitySelector.tsx
│   │   │   ├── SettingsButtons.tsx
│   │   │   ├── StandardizationControls.tsx
│   │   │   └── ParameterHelpDialog.tsx
│   │   └── panels/             # コントロールパネル
│   │       ├── ControlPanel.tsx
│   │       ├── StandardizationPanel.tsx
│   │       ├── EyeControls.tsx
│   │       ├── MouthControls.tsx
│   │       └── NoseControls.tsx
│   ├── features/               # 機能モジュール
│   │   ├── face-standardization/  # 顔標準化機能
│   │   │   ├── eyeDistanceCalculator.ts
│   │   │   ├── eyeDistanceNormalizer.ts
│   │   │   ├── affineStandardizer.ts
│   │   │   ├── canvasStandardizer.ts
│   │   │   └── imageTransformer.ts
│   │   └── image-warping/      # 画像ワーピング機能
│   │       ├── adaptiveWarping.ts
│   │       ├── independentDeformation.ts
│   │       ├── forwardMapping/
│   │       └── triangulation/
│   ├── hooks/                  # カスタムReactフック
│   ├── stores/                 # Zustand状態管理
│   ├── types/                  # TypeScript型定義
│   ├── utils/                  # ユーティリティ関数
│   └── styles/                 # CSSスタイル
├── public/                     # 静的ファイル
│   └── models/                 # face-api.jsモデル
├── docs/                       # ドキュメント
└── deploy/                     # デプロイメント関連

## 主要ファイル
- `src/App.tsx`: メインアプリケーションコンポーネント
- `src/main.tsx`: エントリーポイント
- `src/stores/faceStore.ts`: 顔検出・操作の状態管理
- `src/stores/standardizationStore.ts`: 標準化機能の状態管理
- `src/types/face.ts`: 主要な型定義
- `package.json`: 依存関係とスクリプト
- `vite.config.ts`: Vite設定
- `tsconfig.json`: TypeScript設定
- `CLAUDE.md`: AI開発支援用ドキュメント
# 開発者向けドキュメント

## プロジェクト概要

React + TypeScript + Viteで構築された顔パーツ操作アプリケーション。@vladmandic/face-apiによる顔検出と、Triangle Mesh Forward Mappingによる自然な画像変形を実現。

## 開発コマンド

```bash
npm run dev      # 開発サーバー起動
npm run build    # プロダクションビルド
npm run lint     # ESLint実行
npm run preview  # ビルド結果プレビュー
```

## アーキテクチャ

### 状態管理
- **Zustand store** (`src/stores/faceStore.ts`)
- 画像データ、顔検出結果、操作パラメータを管理

### 顔検出パイプライン
1. **モデル読み込み**: `/public/models/`から face-api.js モデルを読み込み
2. **顔検出**: 68点顔特徴点を抽出
3. **変形処理**: Triangle Mesh による自然な画像変形

### 主要コンポーネント

#### レイアウト
- `src/components/layout/MainLayout.tsx`

#### UI コンポーネント
- `src/components/ui/ImageUpload.tsx` - 画像アップロード
- `src/components/ui/ImagePreview.tsx` - 画像プレビュー
- `src/components/ui/ParameterControl.tsx` - パラメータ制御
- `src/components/ui/SaveButton.tsx` - 保存機能

#### 制御パネル
- `src/components/panels/ControlPanel.tsx` - メイン制御パネル
- `src/components/panels/EyeControls.tsx` - 目の制御
- `src/components/panels/MouthControls.tsx` - 口の制御
- `src/components/panels/NoseControls.tsx` - 鼻の制御

### 画像変形アルゴリズム

#### Triangle Mesh Forward Mapping
- **場所**: `src/features/image-warping/forwardMapping/`
- **主要ファイル**:
  - `meshDeformation.ts` - メッシュ変形処理
  - `triangleRenderer.ts` - 三角形レンダリング
  - `affineTransform.ts` - アフィン変換
  - `hybridRenderer.ts` - ハイブリッドレンダリング

#### 三角分割
- **場所**: `src/features/image-warping/triangulation/`
- **実装**: Delaunay三角分割による自然な変形

### 顔パーツ操作パラメータ

#### 目（Eyes）
- **サイズ**: 0.2-4.0 (線形倍率%)
- **位置**: X/Y ±25% (顔領域比)
- **特徴**: 虹彩形状保持、瞳孔中心固定

#### 口（Mouth）
- **幅/高さ**: 0.2-4.0 (線形倍率%)
- **位置**: X/Y ±30% (顔領域比)

#### 鼻（Nose）
- **幅/高さ**: 0.3-3.0 (線形倍率%)
- **位置**: X/Y ±25% (顔領域比)

### 品質設定

#### 3つのレンダリングモード
1. **High-Speed Preview**: 高速プレビュー (~50-100ms)
2. **Balanced**: バランス型 (~150-300ms, 推奨)
3. **Highest Quality**: 最高品質 (~1000-2000ms)

## 技術スタック

- **Frontend**: React 19 + TypeScript + Vite
- **UI**: Material-UI (MUI) + Emotion
- **顔検出**: @vladmandic/face-api (68点特徴点)
- **状態管理**: Zustand
- **画像処理**: Canvas API + Triangle Mesh

## 重要な設計決定

### 解剖学的制約
- 首部変形防止システム
- 虹彩形状保持機能
- 瞳孔中心固定機能

### パフォーマンス最適化
- 段階的品質設定
- メモリ効率的な画像処理
- リアルタイムプレビュー

### エラーハンドリング
- 包括的エラー検出・回復
- ブラウザ互換性対応
- メモリ管理・リソース監視

## 開発時の注意点

1. **顔検出モデル**: `/public/models/`に必要なモデルファイルを配置
2. **単一顔検出**: 複数顔検出時は最初の顔のみ処理
3. **パラメータ範囲**: `PARAM_LIMITS`で定義された範囲内での操作
4. **キャンバス統一**: 原画像と編集画像で表示サイズを統一

## ビルド・デプロイ

```bash
# 依存関係チェック
npm audit --production

# プロダクションビルド
npm run build

# ビルド結果確認
npm run preview
```

## ライセンス

MIT License - 詳細は [LICENSE](./LICENSE) を参照
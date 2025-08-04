# Face Parts Manipulator

顔パーツを個別に操作できるWebアプリケーション

## 概要

Face Parts Manipulatorは、アップロードした顔画像の各パーツ（目・口・鼻・輪郭）を個別に操作できるWebアプリケーションです。@vladmandic/face-apiによる高精度な顔検出と、Triangle Mesh Forward Mappingによる自然な画像変形を実現しています。エンタープライズ級のエラーハンドリングと包括的なセキュリティ対策により、安全なWeb公開に対応しています。

## 主な機能

- 🎯 **高精度な顔検出** - @vladmandic/face-apiによる68点顔特徴点検出
- 👁️ **目の操作** - 左右の目を個別に拡大・縮小・移動（虹彩形状保持）
- 👄 **口の操作** - 幅・高さの調整と位置移動
- 👃 **鼻の操作** - 幅・高さの調整と位置移動
- 🔷 **輪郭操作** - 顔形状・顎の幅・頬の膨らみ・顎の長さ・滑らかさの調整
- 📌 **顎先固定** - メントン（顎先）を固定したまま輪郭を変形
- 🖼️ **リアルタイムプレビュー** - 編集結果を即座に確認
- 💾 **画像保存** - PNG/JPG形式で編集後の画像をダウンロード
- 🎨 **レンダリングモード選択** - Forward/Hybrid/Backward の3つのモードから選択可能
- 📝 **高度なファイル名生成** - 日付先頭 + 元ファイル名 + 全変形記録システム
- 🛡️ **エンタープライズ級セキュリティ** - 包括的な脆弱性対策とセキュリティヘッダー
- ⚡ **堅牢なエラーハンドリング** - メモリ管理・並行処理安全性・自動復旧機能

## 技術スタック

- **Frontend**: React 19 + TypeScript + Vite
- **UI**: Material-UI (MUI)
- **顔検出**: @vladmandic/face-api
- **画像処理**: Canvas API + 独自のTriangle Mesh変形アルゴリズム
- **状態管理**: Zustand

## インストール方法

```bash
# リポジトリのクローン
git clone https://github.com/ogwlab/app-face-parts-manipulator.git
cd app-face-parts-manipulator

# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev
```

## 使用方法

1. **画像のアップロード**
   - ドラッグ&ドロップまたはクリックで顔画像をアップロード
   - 対応形式: JPG, PNG
   - 推奨サイズ: 1920px以下

2. **顔パーツの編集**
   - 右側のコントロールパネルで各パーツを調整
   - スライダーまたは数値入力で細かく調整可能

3. **画像の保存**
   - 編集後の画像右上の「保存」ボタンをクリック
   - PNG（高品質）またはJPG（軽量）形式を選択

## ビルド方法

```bash
# プロダクションビルド
npm run build

# ビルドのプレビュー
npm run preview
```

## 開発者向け情報

詳細な開発情報は [DEVELOPMENT.md](./DEVELOPMENT.md) を参照してください。

## 技術的特徴

- **高度な顔検出**: 68点顔特徴点による正確な顔パーツ識別
- **Triangle Mesh変形**: Delaunay三角分割による自然な画像変形
- **リアルタイム処理**: 高速Forward Mapping & Hybrid Renderingによる即座のプレビュー
- **解剖学的制約**: 虹彩形状保持・首部変形防止など自然な変形制御
- **エンタープライズ対応**: 包括的エラーハンドリング・メモリ管理・セキュリティ対策

## ライセンス

MIT License

## 作者

ogwlab

## 謝辞

- [@vladmandic/face-api](https://github.com/vladmandic/face-api) - 顔検出ライブラリ
- [Material-UI](https://mui.com/) - UIコンポーネント
# Face Parts Manipulator

顔パーツを個別に操作できるWebアプリケーション

## 概要

Face Parts Manipulatorは、アップロードした顔画像の各パーツ（目・口・鼻）を個別に拡大・縮小・移動できるWebアプリケーションです。face-api.jsによる高精度な顔検出と、Triangle Mesh Forward Mappingによる自然な画像変形を実現しています。

## 主な機能

- 🎯 **高精度な顔検出** - face-api.jsによる68点顔特徴点検出
- 👁️ **目の操作** - 左右の目を個別に拡大・縮小・移動（虹彩形状保持）
- 👄 **口の操作** - 幅・高さの調整と位置移動
- 👃 **鼻の操作** - 幅・高さの調整と位置移動
- 🖼️ **リアルタイムプレビュー** - 編集結果を即座に確認
- 💾 **画像保存** - PNG/JPG形式で編集後の画像をダウンロード
- 🎨 **レンダリングモード選択** - Forward/Hybrid/Backward の3つのモードから選択可能
- 📝 **高度なファイル名生成** - 日付先頭 + 元ファイル名 + 全変形記録システム

## 技術スタック

- **Frontend**: React 19 + TypeScript + Vite
- **UI**: Material-UI (MUI)
- **顔検出**: face-api.js
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

詳細な開発情報は [CLAUDE.md](./CLAUDE.md) を参照してください。

## ライセンス

MIT License

## 作者

ogwlab

## 謝辞

- [face-api.js](https://github.com/justadudewhohacks/face-api.js) - 顔検出ライブラリ
- [Material-UI](https://mui.com/) - UIコンポーネント
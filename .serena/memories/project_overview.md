# Face Parts Manipulator プロジェクト概要

## プロジェクトの目的
顔画像の各パーツ（目・口・鼻）を個別に拡大・縮小・移動できるWebアプリケーション。@vladmandic/face-apiによる高精度な顔検出と、Triangle Mesh Forward Mappingによる自然な画像変形を実現。

## 主な機能
- 68点顔特徴点検出による高精度な顔検出
- 目・口・鼻の個別操作（拡大・縮小・移動）
- リアルタイムプレビュー
- PNG/JPG形式での画像保存
- 3つのレンダリングモード（Forward/Hybrid/Backward）
- 顔の標準化機能（目の間隔を基準とした正規化）
- 設定の保存と復元（LocalStorage使用）
- エンタープライズ級のエラーハンドリング

## 技術スタック
- **Frontend**: React 19 + TypeScript + Vite
- **UI**: Material-UI (MUI)
- **顔検出**: @vladmandic/face-api
- **画像処理**: Canvas API + 独自のTriangle Mesh変形アルゴリズム
- **状態管理**: Zustand

## アーキテクチャ
- **コンポーネント構造**: layout/, ui/, panels/で責任分離
- **機能モジュール**: features/で画像ワーピングと顔標準化を実装
- **状態管理**: Zustandで顔検出結果とパラメータを一元管理
- **型定義**: TypeScriptで厳密な型管理

## 現在のバージョン
Version 7.0.0 (2025-07-11) - 本番環境にデプロイ済み
- URL: https://ogwlab.org/face-parts-manipulator/
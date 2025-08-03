# Face Parts Manipulator コーディング規約

## TypeScript/React規約
- **TypeScript**: 厳密な型定義を使用
- **React**: 関数コンポーネント + フックを使用
- **命名規則**:
  - コンポーネント: PascalCase (例: ImageUpload.tsx)
  - 関数: camelCase (例: calculateEyeDistance)
  - 定数: UPPER_SNAKE_CASE (例: PARAM_LIMITS)
  - 型: PascalCase (例: FaceParams, FaceLandmarks)

## ファイル構造
- **コンポーネント**: src/components/に配置、責任別にサブディレクトリ化
- **機能モジュール**: src/features/に配置、機能ごとにディレクトリ分離
- **ユーティリティ**: src/utils/に配置
- **型定義**: src/types/に集約
- **カスタムフック**: src/hooks/に配置

## インポート規則
- 絶対パス使用: `src/`からの相対パスで記述
- 例: `import { FaceParams } from 'src/types/face'`

## コメント規約
- **日本語コメント**: 主要な処理説明に使用
- **英語**: 変数名・関数名・型名
- **JSDoc**: 複雑な関数には型情報付きコメント

## エラーハンドリング
- try-catchで適切にエラーを捕捉
- エラーはconsole.errorでログ出力
- ユーザー向けメッセージは日本語で表示

## パフォーマンス考慮
- React.memoで不要な再レンダリング防止
- useCallbackで関数の再生成防止
- 画像処理は非同期で実行

## セキュリティ
- 機密情報はGitに含めない
- 画像アップロードはサイズ制限を設定
- XSS対策のためユーザー入力は適切にサニタイズ
# Face Parts Manipulator 開発コマンド一覧

## 開発関連コマンド
```bash
# 開発サーバー起動
npm run dev

# プロダクションビルド
npm run build

# ビルドのプレビュー
npm run preview

# ESLintでコードチェック
npm run lint
```

## デプロイメントコマンド
```bash
# 本番環境へのデプロイ (ogwlab.xsrv.jpサーバー)
rsync -avz --progress --delete \
  -e "ssh -i ~/.ssh/ogwlab_nopass.key -p 10022" \
  dist/ ogwlab@ogwlab.xsrv.jp:~/ogwlab.org/public_html/face-parts-manipulator/

# デプロイ確認
curl -I https://ogwlab.org/face-parts-manipulator/
```

## システムコマンド (Darwin/macOS)
```bash
# ファイル一覧
ls -la

# ディレクトリ移動
cd [directory]

# ファイル内容確認
cat [file]

# プロセス確認
ps aux | grep node

# ポート使用状況確認
lsof -i :5173

# Git操作
git status
git add .
git commit -m "message"
git push origin main
```

## 開発時の実行順序
1. `npm run dev` - 開発サーバー起動
2. `npm run lint` - コード品質チェック
3. `npm run build` - ビルド実行
4. `npm run preview` - ビルド結果確認
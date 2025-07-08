# セキュリティデプロイガイド

Face Parts Manipulator v6.0.0 のセキュアなデプロイメントガイドです。

## 🔒 セキュリティチェックリスト

### 1. 依存関係セキュリティ

```bash
# デプロイ前に実行
npm audit --production
npm update
```

**既知の問題**:
- `node-fetch` の脆弱性: クライアントサイドアプリのため影響なし
- 定期的な依存関係チェックを推奨

### 2. 環境変数設定

#### 開発環境
```apache
# .htaccess または仮想ホスト設定
# 環境変数を設定しない（デフォルト: 開発モード）
```

#### 本番環境
```apache
# .htaccess または仮想ホスト設定
SetEnv PRODUCTION 1

# または仮想ホスト設定で
<VirtualHost *:443>
    SetEnv PRODUCTION 1
    # ...
</VirtualHost>
```

### 3. HTTPS設定

```apache
# 必須: HTTPS の強制
RewriteEngine On
RewriteCond %{HTTPS} !=on
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
```

### 4. セキュリティヘッダー確認

デプロイ後、以下のツールでセキュリティヘッダーを確認:

```bash
# Mozilla Observatory
curl -s https://http-observatory.mozilla.org/api/v1/analyze?host=yourdomain.com

# Security Headers
curl -I https://yourdomain.com
```

### 5. CSP（Content Security Policy）調整

#### face-api.js エラーが発生する場合

```apache
# .htaccess で以下に変更
Header always set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; upgrade-insecure-requests"
```

#### より安全な設定（推奨）

```apache
# face-api.js が動作することを確認後
Header always set Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; upgrade-insecure-requests"
```

## 🚀 デプロイ手順

### 1. ビルド実行

```bash
# セキュリティチェック
npm audit --production

# プロダクションビルド
npm run build

# ビルド結果確認
ls -la dist/
```

### 2. セキュリティ設定ファイル生成

```bash
# .htaccess 生成
cd deploy
./utils.sh && generate_htaccess /your-app-path/

# または手動で
sed 's|{{BASE_PATH}}|/your-app-path/|g' templates/.htaccess.template > ../dist/.htaccess
```

### 3. アップロード前チェック

```bash
# 機密ファイルが含まれていないことを確認
find dist/ -name "*.env*" -o -name "*.key" -o -name "*.pem"

# .htaccess の確認
cat dist/.htaccess
```

### 4. デプロイ実行

```bash
# rsync を使用（推奨）
rsync -avz --delete dist/ user@server:/path/to/webroot/

# または FTP/SFTP を使用
```

### 5. デプロイ後検証

```bash
# セキュリティヘッダー確認
curl -I https://yourdomain.com

# CSP 動作確認
# ブラウザの開発者ツールでコンソールエラーをチェック

# アプリケーション動作確認
# - 画像アップロード
# - 顔検出
# - パーツ操作
# - 画像保存
```

## ⚠️ セキュリティ注意事項

### 1. ファイルアップロード
- ✅ 既に適切な検証が実装済み
- ✅ ファイルタイプ・サイズ制限あり
- ✅ 悪意のあるファイル検出機能あり

### 2. データ保存
- ✅ すべての処理はクライアントサイド
- ✅ サーバーにデータ保存なし
- ✅ プライバシー保護済み

### 3. 外部通信
- ✅ face-api.js モデルファイルのみ
- ✅ CDN からの読み込みなし（ローカル配置）
- ✅ 不要な外部通信なし

### 4. 定期メンテナンス

```bash
# 月次実行推奨
npm audit
npm update

# 四半期実行推奨
npm audit fix --force  # breaking changes に注意
```

## 🔧 トラブルシューティング

### CSP エラーが発生する場合

1. ブラウザコンソールでエラー内容を確認
2. face-api.js で `'unsafe-eval'` が必要な場合は CSP を調整
3. 段階的に制限を緩和してテスト

### CORS エラーが発生する場合

1. 本番環境で `PRODUCTION` 環境変数が設定されているか確認
2. モデルファイルが適切に配置されているか確認
3. ブラウザの開発者ツールでネットワークタブを確認

### HTTPS 関連エラー

1. SSL 証明書の有効性確認
2. Mixed Content エラーの確認
3. HSTS ヘッダーの動作確認

## 📊 セキュリティスコア目標

- **Mozilla Observatory**: A+ ランク
- **Security Headers**: A ランク  
- **OWASP ZAP**: 脆弱性 0件
- **npm audit**: 脆弱性 0件（high/critical）

本ガイドに従ってデプロイすることで、エンタープライズ級のセキュリティレベルを達成できます。
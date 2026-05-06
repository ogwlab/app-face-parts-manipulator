# セキュリティデプロイガイド

Face Parts Manipulator v6.0.0 のセキュアなデプロイメントガイドです。

## 🔒 セキュリティチェックリスト

### 1. 依存関係セキュリティ

```bash
# デプロイ前に実行
npm audit --omit=dev
```

**運用方針**:
- `npm update` はデプロイ手順に含めず、依存更新PRとして分離する
- `npm audit --omit=dev` で high / critical が残る場合はデプロイを止める

### 2. CSP設定

生成される `.htaccess` は本番向けCSPを固定で出力します。`unsafe-eval` や広いCORS許可は、本番テンプレートには入れないでください。

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

#### 本番設定

```apache
Header always set Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'self'; upgrade-insecure-requests"
```

## 🚀 デプロイ手順

### 1. ビルド実行

```bash
# セキュリティチェック
npm audit --omit=dev

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
npm audit --omit=dev

# 四半期実行推奨
# 依存更新は別PRで実施し、build/lint/動作確認を通す
```

## 🔧 トラブルシューティング

### CSP エラーが発生する場合

1. ブラウザコンソールでエラー内容を確認
2. モデルファイルとバンドルが同一オリジンで配信されているか確認
3. 厳格CSPを維持したまま、必要なディレクティブだけを追加

### CORS エラーが発生する場合

1. モデルファイルがアプリと同一オリジンに配置されているか確認
2. 不要な `Access-Control-Allow-Origin` が残っていないか確認
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

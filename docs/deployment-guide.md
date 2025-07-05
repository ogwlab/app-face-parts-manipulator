# Face Parts Manipulator デプロイメントガイド

## 目次

1. [概要](#1-概要)
2. [事前準備](#2-事前準備)
3. [rsyncを使用したデプロイ](#3-rsyncを使用したデプロイ)
4. [サーバー設定](#4-サーバー設定)
5. [自動デプロイスクリプト](#5-自動デプロイスクリプト)
6. [トラブルシューティング](#6-トラブルシューティング)
7. [その他のデプロイ方法](#7-その他のデプロイ方法)

---

## 1. 概要

Face Parts Manipulatorは静的ファイル（HTML, CSS, JS）で構成されているため、一般的なWebサーバーで簡単に公開できます。このガイドでは主にrsyncを使用したデプロイ方法を説明します。

### 必要なファイル
- `index.html` - メインHTMLファイル
- `assets/` - CSS、JavaScript、画像ファイル
- `models/` - face-api.jsの学習済みモデル（必須）

---

## 2. 事前準備

### 2.1 プロダクションビルドの作成

```bash
# プロジェクトルートディレクトリで実行
cd /path/to/face-parts-manipulator

# 依存関係のインストール（初回のみ）
npm install

# プロダクションビルドの作成
npm run build

# ビルド結果の確認
ls -la dist/
```

ビルドが成功すると `dist/` フォルダに以下のファイルが生成されます：
```
dist/
├── index.html
├── assets/
│   ├── index-[hash].css
│   └── index-[hash].js
├── models/
│   ├── face_landmark_68_model-shard1
│   ├── face_landmark_68_model-weights_manifest.json
│   ├── tiny_face_detector_model-shard1
│   └── tiny_face_detector_model-weights_manifest.json
└── vite.svg
```

### 2.2 サーバー情報の確認

デプロイ前に以下の情報を確認してください：

- **サーバーアドレス**: `your-server.com` または `123.456.789.0`
- **ユーザー名**: SSH/SFTPアクセス用のユーザー名
- **公開ディレクトリ**: `/var/www/html/`, `/public_html/`, `/www/` など
- **SSHポート**: 通常は22番、カスタムの場合は指定されたポート

---

## 3. rsyncを使用したデプロイ

### 3.1 基本的なrsyncコマンド

```bash
# 基本構文
rsync [オプション] ローカルパス リモートパス

# 実際の例
rsync -avz --progress dist/ username@your-server.com:/var/www/html/face-manipulator/
```

### 3.2 オプションの説明

| オプション | 説明 |
|-----------|------|
| `-a` | アーカイブモード（権限、タイムスタンプを保持） |
| `-v` | 詳細出力（ファイル名を表示） |
| `-z` | 圧縮転送（転送速度向上） |
| `--progress` | 転送進捗を表示 |
| `--delete` | ローカルに存在しないファイルをリモートから削除 |
| `--dry-run` | 実際の転送を行わずテスト実行 |

### 3.3 初回デプロイ

```bash
# テスト実行（実際には転送しない）
rsync -avz --progress --dry-run dist/ username@your-server.com:/var/www/html/face-manipulator/

# 実際のデプロイ
rsync -avz --progress dist/ username@your-server.com:/var/www/html/face-manipulator/
```

### 3.4 更新デプロイ

```bash
# 新しいビルドを作成
npm run build

# 差分のみ転送（高速）
rsync -avz --progress --delete dist/ username@your-server.com:/var/www/html/face-manipulator/
```

### 3.5 カスタムSSHポートの場合

```bash
# ポート2222を使用する場合
rsync -avz --progress -e "ssh -p 2222" dist/ username@your-server.com:/var/www/html/face-manipulator/
```

### 3.6 秘密鍵を使用する場合

```bash
# 秘密鍵ファイルを指定
rsync -avz --progress -e "ssh -i ~/.ssh/your-key.pem" dist/ username@your-server.com:/var/www/html/face-manipulator/
```

---

## 4. サーバー設定

### 4.1 .htaccessファイルの作成（Apache）

SPAとして動作させるため、.htaccessファイルが必要です：

```bash
# .htaccessファイルをdistフォルダに作成
cat > dist/.htaccess << 'EOF'
# SPAルーティング対応
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /face-manipulator/
    
    # 存在するファイルは直接提供
    RewriteCond %{REQUEST_FILENAME} -f
    RewriteRule ^.*$ - [NC,L]
    
    # 存在するディレクトリは直接提供
    RewriteCond %{REQUEST_FILENAME} -d
    RewriteRule ^.*$ - [NC,L]
    
    # その他は全てindex.htmlにリダイレクト
    RewriteRule ^.*$ index.html [NC,L]
</IfModule>

# MIMEタイプ設定
AddType application/json .json
AddType application/javascript .js
AddType application/wasm .wasm

# セキュリティヘッダー
<IfModule mod_headers.c>
    # CORS設定（モデルファイル用）
    <FilesMatch "\.(json|wasm)$">
        Header set Access-Control-Allow-Origin "*"
        Header set Access-Control-Allow-Methods "GET, POST, OPTIONS"
        Header set Access-Control-Allow-Headers "Content-Type"
    </FilesMatch>
    
    # セキュリティヘッダー
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-XSS-Protection "1; mode=block"
</IfModule>

# キャッシュ設定
<IfModule mod_expires.c>
    ExpiresActive On
    
    # 静的アセット（1年）
    ExpiresByType text/css "access plus 1 year"
    ExpiresByType application/javascript "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/jpeg "access plus 1 year"
    ExpiresByType image/svg+xml "access plus 1 year"
    
    # HTMLファイル（1時間）
    ExpiresByType text/html "access plus 1 hour"
    
    # モデルファイル（1ヶ月）
    ExpiresByType application/json "access plus 1 month"
</IfModule>

# 圧縮設定
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html
    AddOutputFilterByType DEFLATE text/css
    AddOutputFilterByType DEFLATE application/javascript
    AddOutputFilterByType DEFLATE application/json
</IfModule>
EOF
```

### 4.2 nginx設定（参考）

nginxサーバーの場合の設定例：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/html/face-manipulator;
    index index.html;

    # メインアプリケーション
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静的アセット
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # モデルファイル
    location /models/ {
        expires 1M;
        add_header Cache-Control "public";
        add_header Access-Control-Allow-Origin "*";
    }

    # gzip圧縮
    gzip on;
    gzip_types text/css application/javascript application/json;
}
```

---

## 5. 自動デプロイスクリプト

### 5.1 改善されたデプロイスクリプト（推奨）

**注意**: CodeRabbitの指摘を反映し、.htaccessテンプレートの重複を解消した改善版です。

#### テンプレートベースのアプローチ

```bash
# deploy.sh を作成
cat > deploy.sh << 'EOF'
#!/bin/bash

# 共通ユーティリティの読み込み
source deploy/utils.sh

# 設定変数
SERVER="your-server.com"
USERNAME="your-username"
REMOTE_PATH="/var/www/html/face-manipulator"
BASE_PATH="/face-manipulator/"

echo "🚀 Face Parts Manipulator Deployment Script"
echo "=================================================="

# プロジェクトのビルド
if ! build_project; then
    exit 1
fi

# .htaccessファイルの生成（テンプレートから）
if ! generate_htaccess "${BASE_PATH}"; then
    exit 1
fi

# rsyncでデプロイ
log_info "Deploying to server..."
if rsync -avz --progress --delete dist/ ${USERNAME}@${SERVER}:${REMOTE_PATH}/; then
    log_success "Deployment successful!"
    log_success "🌐 Your app is now live at: https://${SERVER}${BASE_PATH}"
else
    log_error "Deployment failed"
    exit 1
fi

echo "=================================================="
log_success "🎉 Deployment completed successfully!"
EOF

# スクリプトに実行権限を付与
chmod +x deploy.sh
```

#### 従来の方式（インライン .htaccess）

レガシー環境や簡単な用途向け：

```bash
# simple-deploy.sh を作成
cat > simple-deploy.sh << 'EOF'
#!/bin/bash

# 設定変数
SERVER="your-server.com"
USERNAME="your-username"
REMOTE_PATH="/var/www/html/face-manipulator"
LOCAL_PATH="dist"

# 色付きの出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Face Parts Manipulator Simple Deployment${NC}"
echo "=================================================="

# ビルドの実行
echo -e "${YELLOW}📦 Building project...${NC}"
if npm run build; then
    echo -e "${GREEN}✅ Build successful${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

# .htaccessファイルの追加（シンプル版）
echo -e "${YELLOW}📝 Adding .htaccess file...${NC}"
cat > ${LOCAL_PATH}/.htaccess << 'HTACCESS'
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /face-manipulator/
    RewriteCond %{REQUEST_FILENAME} -f
    RewriteRule ^.*$ - [NC,L]
    RewriteCond %{REQUEST_FILENAME} -d
    RewriteRule ^.*$ - [NC,L]
    RewriteRule ^.*$ index.html [NC,L]
</IfModule>
AddType application/json .json
AddType application/javascript .js
HTACCESS

# rsyncでデプロイ
echo -e "${YELLOW}🚀 Deploying to server...${NC}"
if rsync -avz --progress --delete ${LOCAL_PATH}/ ${USERNAME}@${SERVER}:${REMOTE_PATH}/; then
    echo -e "${GREEN}✅ Deployment successful!${NC}"
    echo -e "${GREEN}🌐 Your app is now live at: https://${SERVER}/face-manipulator/${NC}"
else
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi

echo "=================================================="
echo -e "${BLUE}🎉 Deployment completed successfully!${NC}"
EOF

chmod +x simple-deploy.sh
```

### 5.2 環境設定ファイル

```bash
# .env.deploy を作成（サーバー情報を管理）
cat > .env.deploy << 'EOF'
# デプロイ設定
DEPLOY_SERVER=your-server.com
DEPLOY_USERNAME=your-username
DEPLOY_PATH=/var/www/html/face-manipulator
DEPLOY_PORT=22
DEPLOY_KEY_PATH=  # 空の場合はSSHエージェントまたはデフォルトキーを使用

# アプリケーション設定
APP_URL=https://your-server.com/face-manipulator
APP_NAME="Face Parts Manipulator"
BASE_PATH=/face-manipulator/
EOF

# .gitignoreに追加（秘密情報を保護）
echo ".env.deploy" >> .gitignore
```

### 5.3 高度なデプロイスクリプト（SSH鍵対応・テンプレート使用）

**注意**: CodeRabbitの指摘を反映し、SSH鍵設定を修正し、テンプレートを使用する改善版です。

```bash
# advanced-deploy.sh を作成
cat > advanced-deploy.sh << 'EOF'
#!/bin/bash

# 共通ユーティリティの読み込み
source deploy/utils.sh

# 環境設定の読み込み
if ! validate_env_config ".env.deploy"; then
    exit 1
fi

source .env.deploy

# メイン関数
main() {
    echo "=========================================="
    echo "  ${APP_NAME} Advanced Deployment Script"
    echo "=========================================="
    
    # SSH設定の検証
    if ! validate_ssh_config "${DEPLOY_SERVER}" "${DEPLOY_USERNAME}" "${DEPLOY_KEY_PATH}" "${DEPLOY_PORT}"; then
        exit 1
    fi
    
    # バックアップ作成
    create_backup "${DEPLOY_USERNAME}" "${DEPLOY_SERVER}" "${DEPLOY_PATH}" "${DEPLOY_KEY_PATH}" "${DEPLOY_PORT}"
    
    # プロジェクトビルド
    if ! build_project; then
        exit 1
    fi
    
    # .htaccessファイルの生成（テンプレートから）
    if ! generate_htaccess "${BASE_PATH:-/}"; then
        exit 1
    fi
    
    # rsyncコマンドの構築と実行
    log_info "Deploying files to server..."
    local rsync_cmd=""
    
    # SSH鍵が指定されている場合の処理
    if [ -n "${DEPLOY_KEY_PATH}" ] && [ "${DEPLOY_KEY_PATH}" != "~/.ssh/id_rsa" ]; then
        if [ ! -f "${DEPLOY_KEY_PATH}" ]; then
            log_error "SSH key file not found: ${DEPLOY_KEY_PATH}"
            exit 1
        fi
        rsync_cmd="rsync -avz --progress --delete -e \"ssh -i ${DEPLOY_KEY_PATH} -p ${DEPLOY_PORT:-22}\" dist/ ${DEPLOY_USERNAME}@${DEPLOY_SERVER}:${DEPLOY_PATH}/"
    else
        rsync_cmd="rsync -avz --progress --delete -e \"ssh -p ${DEPLOY_PORT:-22}\" dist/ ${DEPLOY_USERNAME}@${DEPLOY_SERVER}:${DEPLOY_PATH}/"
    fi
    
    # rsync実行
    if eval "${rsync_cmd}"; then
        log_success "Files deployed successfully"
    else
        log_error "Deployment failed"
        exit 1
    fi
    
    # 権限設定
    set_permissions "${DEPLOY_USERNAME}" "${DEPLOY_SERVER}" "${DEPLOY_PATH}" "${DEPLOY_KEY_PATH}" "${DEPLOY_PORT}"
    
    # ヘルスチェック
    if [ -n "${APP_URL}" ]; then
        health_check "${APP_URL}"
    fi
    
    echo "=========================================="
    log_success "🎉 Deployment completed successfully!"
    echo "=========================================="
}

# スクリプト実行
main "$@"
EOF

# 実行権限を付与
chmod +x advanced-deploy.sh
```

#### 従来の高度なデプロイスクリプト（参考・レガシー）

```bash
# legacy-advanced-deploy.sh を作成
cat > legacy-advanced-deploy.sh << 'EOF'
#!/bin/bash

# 環境設定の読み込み
if [ -f .env.deploy ]; then
    source .env.deploy
else
    echo "❌ .env.deploy file not found"
    exit 1
fi

# 関数定義
log_info() {
    echo -e "\033[0;34m[INFO]\033[0m $1"
}

log_success() {
    echo -e "\033[0;32m[SUCCESS]\033[0m $1"
}

log_warning() {
    echo -e "\033[1;33m[WARNING]\033[0m $1"
}

log_error() {
    echo -e "\033[0;31m[ERROR]\033[0m $1"
}

# デプロイ前チェック
pre_deploy_check() {
    log_info "Pre-deployment checks..."
    
    # SSH接続テスト（修正版：SSH鍵を実際に使用）
    local ssh_cmd="ssh -o ConnectTimeout=10"
    
    if [ -n "${DEPLOY_KEY_PATH}" ] && [ "${DEPLOY_KEY_PATH}" != "~/.ssh/id_rsa" ]; then
        if [ ! -f "${DEPLOY_KEY_PATH}" ]; then
            log_error "SSH key file not found: ${DEPLOY_KEY_PATH}"
            exit 1
        fi
        ssh_cmd="${ssh_cmd} -i ${DEPLOY_KEY_PATH}"
    fi
    
    if [ -n "${DEPLOY_PORT}" ] && [ "${DEPLOY_PORT}" != "22" ]; then
        ssh_cmd="${ssh_cmd} -p ${DEPLOY_PORT}"
    fi
    
    if ! ${ssh_cmd} ${DEPLOY_USERNAME}@${DEPLOY_SERVER} exit 2>/dev/null; then
        log_error "Cannot connect to server"
        exit 1
    fi
    
    log_success "Pre-deployment checks passed"
}

# デプロイ実行（修正版：SSH鍵を実際に使用）
deploy_files() {
    log_info "Deploying files..."
    
    # .htaccessファイルの追加（インライン版）
    cat > dist/.htaccess << 'HTACCESS'
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /face-manipulator/
    RewriteCond %{REQUEST_FILENAME} -f
    RewriteRule ^.*$ - [NC,L]
    RewriteCond %{REQUEST_FILENAME} -d
    RewriteRule ^.*$ - [NC,L]
    RewriteRule ^.*$ index.html [NC,L]
</IfModule>
AddType application/json .json
AddType application/javascript .js
HTACCESS
    
    # rsync実行（修正版：SSH鍵を実際に使用）
    local rsync_opts="-avz --progress --delete"
    local ssh_opts=""
    
    if [ -n "${DEPLOY_KEY_PATH}" ] && [ "${DEPLOY_KEY_PATH}" != "~/.ssh/id_rsa" ]; then
        ssh_opts="-i ${DEPLOY_KEY_PATH}"
    fi
    
    if [ -n "${DEPLOY_PORT}" ] && [ "${DEPLOY_PORT}" != "22" ]; then
        ssh_opts="${ssh_opts} -p ${DEPLOY_PORT}"
    fi
    
    if [ -n "${ssh_opts}" ]; then
        rsync_opts="${rsync_opts} -e \"ssh ${ssh_opts}\""
    fi
    
    local rsync_cmd="rsync ${rsync_opts} dist/ ${DEPLOY_USERNAME}@${DEPLOY_SERVER}:${DEPLOY_PATH}/"
    
    if eval "${rsync_cmd}"; then
        log_success "Files deployed successfully"
    else
        log_error "Deployment failed"
        exit 1
    fi
}

# 他の関数は省略...

# メイン実行
main() {
    echo "=========================================="
    echo "  ${APP_NAME} Legacy Deployment Script"
    echo "=========================================="
    
    pre_deploy_check
    # build_project
    deploy_files
    # set_permissions
    # health_check
    
    echo "=========================================="
    echo "🎉 Deployment completed successfully!"
    echo "=========================================="
}

# スクリプト実行
main "$@"
EOF

chmod +x legacy-advanced-deploy.sh
```

---

## 6. トラブルシューティング

### 6.1 よくある問題と解決方法

#### 問題: Permission denied (publickey)
```bash
# 原因: SSH鍵認証の設定問題
# 解決方法:
ssh-copy-id username@your-server.com

# または手動で公開鍵をコピー
cat ~/.ssh/id_rsa.pub | ssh username@your-server.com "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

#### 問題: rsync: command not found
```bash
# rsyncのインストール
# Ubuntu/Debian
sudo apt-get install rsync

# CentOS/RHEL
sudo yum install rsync

# macOS
brew install rsync
```

#### 問題: モデルファイルが読み込めない
```bash
# サーバーでファイルの確認
ssh username@your-server.com
ls -la /var/www/html/face-manipulator/models/

# 権限の修正
chmod 644 /var/www/html/face-manipulator/models/*

# .htaccessでCORS設定を確認
cat /var/www/html/face-manipulator/.htaccess
```

#### 問題: 白いページが表示される
```bash
# ブラウザの開発者ツールでエラーを確認
# 多くの場合、パスの設定問題

# vite.config.tsでbaseパスを修正
# base: '/face-manipulator/' を設定
```

### 6.2 ログ確認

```bash
# Apacheエラーログ
sudo tail -f /var/log/apache2/error.log

# nginxエラーログ
sudo tail -f /var/log/nginx/error.log

# デプロイログの保存
rsync -avz --progress --log-file=deploy.log dist/ username@server:/path/
```

---

## 7. その他のデプロイ方法

### 7.1 SCP使用

```bash
# SCPで全体をコピー
scp -r dist/* username@your-server.com:/var/www/html/face-manipulator/

# 圧縮してからアップロード
tar -czf app.tar.gz -C dist .
scp app.tar.gz username@your-server.com:/tmp/
ssh username@your-server.com "cd /var/www/html/face-manipulator && tar -xzf /tmp/app.tar.gz"
```

### 7.2 Git Hook使用

```bash
# サーバー側でbare repositoryを作成
ssh username@your-server.com
git init --bare /var/git/face-manipulator.git

# post-receiveフックを作成
cat > /var/git/face-manipulator.git/hooks/post-receive << 'EOF'
#!/bin/bash
cd /var/www/html/face-manipulator
git --git-dir=/var/git/face-manipulator.git --work-tree=/var/www/html/face-manipulator checkout -f
npm run build
cp -r dist/* ./
EOF

chmod +x /var/git/face-manipulator.git/hooks/post-receive

# ローカルでリモートリポジトリを追加
git remote add production username@your-server.com:/var/git/face-manipulator.git

# デプロイ
git push production main
```

---

## 8. 継続的インテグレーション

### 8.1 GitHub Actionsでの自動デプロイ（改善版）

```yaml
# .github/workflows/deploy.yml
name: Deploy to Server

on:
  push:
    branches: [ main ]
  workflow_dispatch:  # 手動実行を許可

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build project
      run: npm run build
    
    - name: Generate .htaccess from template
      run: |
        mkdir -p dist
        sed "s|{{BASE_PATH}}|${{ secrets.BASE_PATH || '/face-manipulator/' }}|g" \
          deploy/templates/.htaccess.template > dist/.htaccess
    
    - name: Deploy to server
      uses: burnett01/rsync-deployments@6.0.0
      with:
        switches: -avzr --delete
        path: dist/
        remote_path: ${{ secrets.DEPLOY_PATH }}
        remote_host: ${{ secrets.DEPLOY_HOST }}
        remote_user: ${{ secrets.DEPLOY_USER }}
        remote_key: ${{ secrets.DEPLOY_KEY }}
        remote_port: ${{ secrets.DEPLOY_PORT || '22' }}
    
    - name: Health check
      run: |
        if [ -n "${{ secrets.APP_URL }}" ]; then
          sleep 10  # サーバーが更新されるまで待機
          HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${{ secrets.APP_URL }}" --max-time 30)
          if [ "${HTTP_STATUS}" = "200" ]; then
            echo "✅ Health check passed (HTTP ${HTTP_STATUS})"
            echo "🌐 Application is live at: ${{ secrets.APP_URL }}"
          else
            echo "⚠️ Health check returned HTTP ${HTTP_STATUS}"
            exit 1
          fi
        fi
```

### 8.2 必要なGitHub Secrets

GitHub リポジトリの Settings > Secrets and variables > Actions で以下を設定：

| Secret名 | 説明 | 例 |
|---------|------|-----|
| `DEPLOY_HOST` | サーバーのホスト名 | `ogwlab.org` |
| `DEPLOY_USER` | SSHユーザー名 | `username` |
| `DEPLOY_KEY` | SSH秘密鍵（内容全体） | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `DEPLOY_PATH` | リモートの配置パス | `/var/www/html/face-manipulator` |
| `DEPLOY_PORT` | SSHポート（オプション） | `22` |
| `BASE_PATH` | アプリのベースパス | `/face-manipulator/` |
| `APP_URL` | ヘルスチェック用URL | `https://ogwlab.org/face-manipulator/` |

---

## 9. ベストプラクティス

### 9.1 保守性向上のための設計原則

#### テンプレートの分離
- `.htaccess`設定は`deploy/templates/.htaccess.template`に集約
- スクリプトでの重複コードを排除
- 変更時は1箇所の修正で全体に反映

#### SSH設定の明確化
- `DEPLOY_KEY_PATH`が空の場合はSSHエージェントを使用
- 秘密鍵ファイルが指定されている場合は存在確認を実行
- ポート設定のデフォルト値（22）を明示

#### エラーハンドリング
- 各処理ステップでの適切な終了処理
- ログ出力による問題の特定支援
- 復旧可能なバックアップの自動作成

### 9.2 セキュリティ設定

#### 機密情報の管理
```bash
# .gitignoreに追加
echo ".env.deploy" >> .gitignore
echo "deploy/config/*.env" >> .gitignore

# ファイル権限の設定
chmod 600 .env.deploy
chmod 600 ~/.ssh/your-key.pem
```

#### SSH設定の強化
```bash
# ~/.ssh/config の例
Host production-server
    HostName ogwlab.org
    User your-username
    IdentityFile ~/.ssh/production-key.pem
    Port 22
    ServerAliveInterval 60
    ServerAliveCountMax 3
```

---

## 10. チェックリスト

### デプロイ前チェックリスト

- [ ] プロダクションビルドが成功する
- [ ] モデルファイルが含まれている（`dist/models/`）
- [ ] テンプレートファイルが存在する（`deploy/templates/.htaccess.template`）
- [ ] 環境設定ファイルが正しく設定されている（`.env.deploy`）
- [ ] SSH接続が可能である
- [ ] デプロイ先ディレクトリが存在する
- [ ] 必要な権限がある

### デプロイ後チェックリスト

- [ ] Webサイトが正常に表示される
- [ ] ファイルサイズが適切である（CSS/JSが圧縮されている）
- [ ] モデルファイルにアクセスできる
- [ ] 顔検出が動作する
- [ ] 画像アップロードが動作する
- [ ] パラメータ調整が動作する
- [ ] 画像保存が動作する
- [ ] レンダリングモード切り替えが動作する
- [ ] モバイルデバイスで動作する
- [ ] HTTPS接続が可能である（SSL証明書）

### CodeRabbit指摘事項のチェック

- [ ] .htaccessテンプレートの重複が解消されている
- [ ] SSH鍵設定が実際に使用されている
- [ ] 環境変数の定義と使用が一致している
- [ ] エラーハンドリングが適切に実装されている

---

最終更新日: 2025年1月5日
CodeRabbit対応バージョン: 1.1
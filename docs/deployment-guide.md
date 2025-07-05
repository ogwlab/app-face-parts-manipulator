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

### 5.1 基本デプロイスクリプト

```bash
# deploy.sh を作成
cat > deploy.sh << 'EOF'
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

echo -e "${BLUE}🚀 Face Parts Manipulator Deployment Script${NC}"
echo "=================================================="

# ビルドの実行
echo -e "${YELLOW}📦 Building project...${NC}"
if npm run build; then
    echo -e "${GREEN}✅ Build successful${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

# .htaccessファイルの追加
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

# ファイルサイズの確認
echo -e "${YELLOW}📊 Checking file sizes...${NC}"
TOTAL_SIZE=$(du -sh ${LOCAL_PATH} | cut -f1)
echo "Total size: ${TOTAL_SIZE}"

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

# スクリプトに実行権限を付与
chmod +x deploy.sh
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
DEPLOY_KEY_PATH=~/.ssh/id_rsa

# アプリケーション設定
APP_URL=https://your-server.com/face-manipulator
APP_NAME="Face Parts Manipulator"
EOF

# .gitignoreに追加（秘密情報を保護）
echo ".env.deploy" >> .gitignore
```

### 5.3 高度なデプロイスクリプト

```bash
# advanced-deploy.sh を作成
cat > advanced-deploy.sh << 'EOF'
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
    
    # Node.jsの確認
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    # package.jsonの確認
    if [ ! -f package.json ]; then
        log_error "package.json not found"
        exit 1
    fi
    
    # サーバー接続テスト
    if ! ssh -o ConnectTimeout=10 ${DEPLOY_USERNAME}@${DEPLOY_SERVER} exit 2>/dev/null; then
        log_error "Cannot connect to server"
        exit 1
    fi
    
    log_success "Pre-deployment checks passed"
}

# バックアップ作成
create_backup() {
    log_info "Creating backup..."
    BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"
    ssh ${DEPLOY_USERNAME}@${DEPLOY_SERVER} "cd $(dirname ${DEPLOY_PATH}) && cp -r $(basename ${DEPLOY_PATH}) ${BACKUP_NAME}"
    log_success "Backup created: ${BACKUP_NAME}"
}

# ビルド実行
build_project() {
    log_info "Building project..."
    if npm run build; then
        log_success "Build completed"
    else
        log_error "Build failed"
        exit 1
    fi
}

# デプロイ実行
deploy_files() {
    log_info "Deploying files..."
    
    # .htaccessファイルの追加
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
    
    # rsync実行
    if rsync -avz --progress --delete \
        -e "ssh -p ${DEPLOY_PORT:-22}" \
        dist/ ${DEPLOY_USERNAME}@${DEPLOY_SERVER}:${DEPLOY_PATH}/; then
        log_success "Files deployed successfully"
    else
        log_error "Deployment failed"
        exit 1
    fi
}

# 権限設定
set_permissions() {
    log_info "Setting file permissions..."
    ssh ${DEPLOY_USERNAME}@${DEPLOY_SERVER} "
        find ${DEPLOY_PATH} -type f -exec chmod 644 {} \;
        find ${DEPLOY_PATH} -type d -exec chmod 755 {} \;
        chmod 644 ${DEPLOY_PATH}/.htaccess
    "
    log_success "Permissions set"
}

# ヘルスチェック
health_check() {
    log_info "Performing health check..."
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${APP_URL}")
    
    if [ "${HTTP_STATUS}" = "200" ]; then
        log_success "Health check passed (HTTP ${HTTP_STATUS})"
        log_success "🌐 Application is live at: ${APP_URL}"
    else
        log_warning "Health check returned HTTP ${HTTP_STATUS}"
    fi
}

# メイン実行
main() {
    echo "=========================================="
    echo "  ${APP_NAME} Deployment Script"
    echo "=========================================="
    
    pre_deploy_check
    create_backup
    build_project
    deploy_files
    set_permissions
    health_check
    
    echo "=========================================="
    echo "🎉 Deployment completed successfully!"
    echo "=========================================="
}

# スクリプト実行
main "$@"
EOF

# 実行権限を付与
chmod +x advanced-deploy.sh
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

### 8.1 GitHub Actionsでの自動デプロイ

```yaml
# .github/workflows/deploy.yml
name: Deploy to Server

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build
      run: npm run build
    
    - name: Deploy to server
      uses: burnett01/rsync-deployments@5.2
      with:
        switches: -avzr --delete
        path: dist/
        remote_path: ${{ secrets.DEPLOY_PATH }}
        remote_host: ${{ secrets.DEPLOY_HOST }}
        remote_user: ${{ secrets.DEPLOY_USER }}
        remote_key: ${{ secrets.DEPLOY_KEY }}
```

---

## 9. チェックリスト

### デプロイ前チェックリスト

- [ ] プロダクションビルドが成功する
- [ ] モデルファイルが含まれている
- [ ] サーバー接続情報が正しい
- [ ] 公開ディレクトリのパスが正しい
- [ ] .htaccessファイルが設定されている

### デプロイ後チェックリスト

- [ ] Webサイトが正常に表示される
- [ ] 顔検出が動作する
- [ ] 画像アップロードが動作する
- [ ] パラメータ調整が動作する
- [ ] 画像保存が動作する
- [ ] モバイルデバイスで動作する

---

最終更新日: 2025年1月5日
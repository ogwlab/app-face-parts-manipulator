#!/bin/bash

# Face Parts Manipulator - Deployment Utilities
# Common functions used by deployment scripts

# 色付きの出力関数
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

quote_args() {
    local quoted=()
    local arg
    for arg in "$@"; do
        printf -v arg '%q' "$arg"
        quoted+=("$arg")
    done
    echo "${quoted[*]}"
}

# .htaccessファイルの生成
generate_htaccess() {
    local base_path="${1:-/}"
    local template_file="deploy/templates/.htaccess.template"
    local output_file="dist/.htaccess"

    if [ ! -f "${template_file}" ]; then
        log_error "Template file not found: ${template_file}"
        return 1
    fi

    log_info "Generating .htaccess from template..."

    # sedで安全にパスを置換（&文字をエスケープ）
    local safe_base_path
    safe_base_path=$(printf '%s' "${base_path}" | sed 's|&|\\&|g')

    sed "s|{{BASE_PATH}}|${safe_base_path}|g" "${template_file}" > "${output_file}"

    if [ $? -eq 0 ]; then
        log_success ".htaccess generated successfully"
        return 0
    else
        log_error "Failed to generate .htaccess"
        return 1
    fi
}

# SSH設定の検証
validate_ssh_config() {
    local server="$1"
    local username="$2"
    local key_path="$3"
    local port="${4:-22}"

    log_info "Validating SSH configuration..."

    # SSH接続テスト用のコマンド構築
    local ssh_cmd=(ssh)

    # 秘密鍵が指定されている場合
    if [ -n "${key_path}" ] && [ "${key_path}" != "~/.ssh/id_rsa" ]; then
        if [ ! -f "${key_path}" ]; then
            log_error "SSH key file not found: ${key_path}"
            return 1
        fi
        ssh_cmd+=(-i "${key_path}")
    fi

    # ポートの指定
    if [ "${port}" != "22" ]; then
        ssh_cmd+=(-p "${port}")
    fi

    # 接続テスト実行
    if "${ssh_cmd[@]}" -o ConnectTimeout=10 -o BatchMode=yes "${username}@${server}" exit 2>/dev/null; then
        log_success "SSH connection verified"
        return 0
    else
        log_error "SSH connection failed"
        log_info "Command used: $(quote_args "${ssh_cmd[@]}" "${username}@${server}")"
        return 1
    fi
}

# rsyncコマンドの構築
build_rsync_command() {
    local key_path="$1"
    local port="$2"
    local source="$3"
    local username="$4"
    local server="$5"
    local remote_path="$6"

    local rsync_cmd=(rsync -avz --progress --delete)
    local ssh_cmd=(ssh)

    # SSH オプションの構築
    if [ -n "${key_path}" ] && [ "${key_path}" != "~/.ssh/id_rsa" ]; then
        ssh_cmd+=(-i "${key_path}")
    fi

    if [ -n "${port}" ] && [ "${port}" != "22" ]; then
        ssh_cmd+=(-p "${port}")
    fi

    if [ ${#ssh_cmd[@]} -gt 1 ]; then
        rsync_cmd+=(-e "$(quote_args "${ssh_cmd[@]}")")
    fi

    rsync_cmd+=("${source}" "${username}@${server}:${remote_path}")

    quote_args "${rsync_cmd[@]}"
}

# プロジェクトのビルド
build_project() {
    log_info "Building project..."

    if [ ! -f "package.json" ]; then
        log_error "package.json not found. Are you in the project root?"
        return 1
    fi

    if npm run build; then
        log_success "Build completed successfully"

        # ビルドサイズの表示
        if [ -d "dist" ]; then
            local size=$(du -sh dist | cut -f1)
            log_info "Build size: ${size}"
        fi

        return 0
    else
        log_error "Build failed"
        return 1
    fi
}

# 環境設定の検証
validate_env_config() {
    local config_file="$1"

    if [ ! -f "${config_file}" ]; then
        log_error "Configuration file not found: ${config_file}"
        return 1
    fi

    log_info "Validating environment configuration..."

    # 必須変数のチェック
    local required_vars=("DEPLOY_SERVER" "DEPLOY_USERNAME" "DEPLOY_PATH")
    local missing_vars=()

    source "${config_file}"

    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("${var}")
        fi
    done

    if [ ${#missing_vars[@]} -gt 0 ]; then
        log_error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            log_error "  - ${var}"
        done
        return 1
    fi

    log_success "Environment configuration validated"
    return 0
}

# バックアップの作成
create_backup() {
    local username="$1"
    local server="$2"
    local remote_path="$3"
    local key_path="$4"
    local port="${5:-22}"

    log_info "Creating backup on server..."

    local backup_name="backup-$(date +%Y%m%d-%H%M%S)"
    local remote_path_expanded="${remote_path/#\~/"\$HOME"}"
    local parent_dir
    local app_dir
    parent_dir=$(dirname "${remote_path_expanded}")
    app_dir=$(basename "${remote_path_expanded}")

    # SSH コマンドの構築
    local ssh_cmd=(ssh)

    if [ -n "${key_path}" ] && [ "${key_path}" != "~/.ssh/id_rsa" ]; then
        ssh_cmd+=(-i "${key_path}")
    fi

    if [ "${port}" != "22" ]; then
        ssh_cmd+=(-p "${port}")
    fi

    # バックアップ実行
    if "${ssh_cmd[@]}" "${username}@${server}" bash -s -- "${parent_dir}" "${app_dir}" "${backup_name}" 2>/dev/null <<'REMOTE_BACKUP'
set -euo pipefail
parent_dir="$1"
app_dir="$2"
backup_name="$3"

cd "${parent_dir}"
if [ -d "${app_dir}" ]; then
    cp -r "${app_dir}" "${backup_name}"
else
    exit 1
fi
REMOTE_BACKUP
    then
        log_success "Backup created: ${backup_name}"
        return 0
    else
        log_warning "Backup creation failed or directory doesn't exist"
        return 1
    fi
}

# 権限設定
set_permissions() {
    local username="$1"
    local server="$2"
    local remote_path="$3"
    local key_path="$4"
    local port="${5:-22}"

    log_info "Setting file permissions..."
    local remote_path_expanded="${remote_path/#\~/"\$HOME"}"

    # SSH コマンドの構築
    local ssh_cmd=(ssh)

    if [ -n "${key_path}" ] && [ "${key_path}" != "~/.ssh/id_rsa" ]; then
        ssh_cmd+=(-i "${key_path}")
    fi

    if [ "${port}" != "22" ]; then
        ssh_cmd+=(-p "${port}")
    fi

    # 権限設定実行
    if "${ssh_cmd[@]}" "${username}@${server}" bash -s -- "${remote_path_expanded}" <<'REMOTE_PERMISSIONS'
set -euo pipefail
remote_path="$1"

find "${remote_path}" -type f -exec chmod 644 {} \; 2>/dev/null
find "${remote_path}" -type d -exec chmod 755 {} \; 2>/dev/null
if [ -f "${remote_path}/.htaccess" ]; then
    chmod 644 "${remote_path}/.htaccess"
fi
REMOTE_PERMISSIONS
    then
        log_success "Permissions set successfully"
        return 0
    else
        log_warning "Permission setting completed with some warnings"
        return 1
    fi
}

# ヘルスチェック
health_check() {
    local app_url="$1"

    if [ -z "${app_url}" ]; then
        log_warning "No URL provided for health check"
        return 1
    fi

    log_info "Performing health check..."

    # curlがインストールされているかチェック
    if ! command -v curl &> /dev/null; then
        log_warning "curl not found, skipping health check"
        return 1
    fi

    local http_status=$(curl -s -o /dev/null -w "%{http_code}" "${app_url}" --max-time 30)

    case "${http_status}" in
        "200")
            log_success "Health check passed (HTTP ${http_status})"
            log_success "🌐 Application is live at: ${app_url}"
            return 0
            ;;
        "000")
            log_error "Health check failed (Connection error)"
            return 1
            ;;
        *)
            log_warning "Health check returned HTTP ${http_status}"
            log_info "Application may still be accessible at: ${app_url}"
            return 1
            ;;
    esac
}

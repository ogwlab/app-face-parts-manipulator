/**
 * ファイル名生成ユーティリティ
 */

import type { FaceParams } from '../types/face';

/**
 * タイムスタンプを生成
 * @returns YYYYMMDD-HHMMSS形式の文字列
 */
function generateTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

/**
 * 元ファイル名から拡張子を除去し、ファイル名として安全な形式に変換
 * @param originalFileName 元ファイル名
 * @returns 安全な形式のファイル名（拡張子なし）
 */
function sanitizeOriginalFileName(originalFileName: string): string {
  // 拡張子を除去
  const nameWithoutExt = originalFileName.replace(/\.[^/.]+$/, '');
  
  // ファイル名として使用できない文字を置換
  const sanitized = nameWithoutExt
    .replace(/[<>:"/\\|?*]/g, '_')  // 無効な文字を_に置換
    .replace(/\s+/g, '_')          // 空白を_に置換
    .replace(/_{2,}/g, '_')        // 連続する_を単一に
    .replace(/^_|_$/g, '');        // 先頭と末尾の_を削除
  
  return sanitized || 'unnamed';
}

/**
 * 編集パラメータの詳細情報を生成（全変形記録）
 * @param faceParams 顔パラメータ
 * @returns パラメータの詳細文字列
 */
function generateParamsSummary(faceParams: FaceParams): string {
  const parts: string[] = [];
  
  // 左目の変更をチェック
  const leftEyeParams: string[] = [];
  if (faceParams.leftEye.size !== 1) {
    leftEyeParams.push(`S${Math.round(faceParams.leftEye.size * 100)}`);
  }
  if (faceParams.leftEye.positionX !== 0) {
    const xVal = Math.round(faceParams.leftEye.positionX);
    leftEyeParams.push(`X${xVal >= 0 ? xVal : xVal}`);
  }
  if (faceParams.leftEye.positionY !== 0) {
    const yVal = Math.round(faceParams.leftEye.positionY);
    leftEyeParams.push(`Y${yVal >= 0 ? yVal : yVal}`);
  }
  
  // 右目の変更をチェック
  const rightEyeParams: string[] = [];
  if (faceParams.rightEye.size !== 1) {
    rightEyeParams.push(`S${Math.round(faceParams.rightEye.size * 100)}`);
  }
  if (faceParams.rightEye.positionX !== 0) {
    const xVal = Math.round(faceParams.rightEye.positionX);
    rightEyeParams.push(`X${xVal >= 0 ? xVal : xVal}`);
  }
  if (faceParams.rightEye.positionY !== 0) {
    const yVal = Math.round(faceParams.rightEye.positionY);
    rightEyeParams.push(`Y${yVal >= 0 ? yVal : yVal}`);
  }
  
  // 両目が同じ変形の場合は統合表示
  if (leftEyeParams.length > 0 && rightEyeParams.length > 0 &&
      faceParams.leftEye.size === faceParams.rightEye.size &&
      faceParams.leftEye.positionX === faceParams.rightEye.positionX &&
      faceParams.leftEye.positionY === faceParams.rightEye.positionY) {
    parts.push(`BOTH_EYES_${leftEyeParams.join('_')}`);
  } else {
    if (leftEyeParams.length > 0) {
      parts.push(`LE_${leftEyeParams.join('_')}`);
    }
    if (rightEyeParams.length > 0) {
      parts.push(`RE_${rightEyeParams.join('_')}`);
    }
  }
  
  // 口の変更をチェック
  const mouthParams: string[] = [];
  if (faceParams.mouth.width !== 1) {
    mouthParams.push(`W${Math.round(faceParams.mouth.width * 100)}`);
  }
  if (faceParams.mouth.height !== 1) {
    mouthParams.push(`H${Math.round(faceParams.mouth.height * 100)}`);
  }
  if (faceParams.mouth.positionX !== 0) {
    const xVal = Math.round(faceParams.mouth.positionX);
    mouthParams.push(`X${xVal >= 0 ? xVal : xVal}`);
  }
  if (faceParams.mouth.positionY !== 0) {
    const yVal = Math.round(faceParams.mouth.positionY);
    mouthParams.push(`Y${yVal >= 0 ? yVal : yVal}`);
  }
  if (mouthParams.length > 0) {
    parts.push(`MO_${mouthParams.join('_')}`);
  }
  
  // 鼻の変更をチェック
  const noseParams: string[] = [];
  if (faceParams.nose.width !== 1) {
    noseParams.push(`W${Math.round(faceParams.nose.width * 100)}`);
  }
  if (faceParams.nose.height !== 1) {
    noseParams.push(`H${Math.round(faceParams.nose.height * 100)}`);
  }
  if (faceParams.nose.positionX !== 0) {
    const xVal = Math.round(faceParams.nose.positionX);
    noseParams.push(`X${xVal >= 0 ? xVal : xVal}`);
  }
  if (faceParams.nose.positionY !== 0) {
    const yVal = Math.round(faceParams.nose.positionY);
    noseParams.push(`Y${yVal >= 0 ? yVal : yVal}`);
  }
  if (noseParams.length > 0) {
    parts.push(`NO_${noseParams.join('_')}`);
  }
  
  return parts.length > 0 ? parts.join('-') : 'original';
}

export interface FileNameOptions {
  format: 'png' | 'jpg';
  originalFileName?: string;
  includeTimestamp?: boolean;
  includeParams?: boolean;
  faceParams?: FaceParams;
}

/**
 * ファイル名を生成（日付先頭 + 元ファイル名 + 変形記録）
 * @param options ファイル名生成オプション
 * @returns 生成されたファイル名
 */
export function generateFileName(options: FileNameOptions): string {
  const {
    format,
    originalFileName,
    includeTimestamp = true,
    includeParams = true,
    faceParams
  } = options;
  
  const parts: string[] = [];
  
  // タイムスタンプを先頭に追加
  if (includeTimestamp) {
    parts.push(generateTimestamp());
  }
  
  // 元ファイル名を追加
  if (originalFileName) {
    parts.push(sanitizeOriginalFileName(originalFileName));
  } else {
    parts.push('face-edit');
  }
  
  // パラメータサマリーを追加
  if (includeParams && faceParams) {
    const paramsSummary = generateParamsSummary(faceParams);
    parts.push(paramsSummary);
  }
  
  // 拡張子を追加
  return `${parts.join('-')}.${format}`;
}

/**
 * ユーザーフレンドリーな日時文字列を生成
 * @returns 例: "2025年1月4日 15時30分"
 */
export function generateReadableDateTime(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  
  return `${year}年${month}月${day}日 ${hours}時${minutes}分`;
}
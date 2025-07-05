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
 * 編集パラメータの概要を生成
 * @param faceParams 顔パラメータ
 * @returns パラメータの概要文字列
 */
function generateParamsSummary(faceParams: FaceParams): string {
  const parts: string[] = [];
  
  // 目の変更をチェック
  const leftEyeChanged = faceParams.leftEye.size !== 1 || 
                        faceParams.leftEye.positionX !== 0 || 
                        faceParams.leftEye.positionY !== 0;
  const rightEyeChanged = faceParams.rightEye.size !== 1 || 
                         faceParams.rightEye.positionX !== 0 || 
                         faceParams.rightEye.positionY !== 0;
  
  if (leftEyeChanged || rightEyeChanged) {
    // 両目が同じサイズの場合は統合表示
    if (faceParams.leftEye.size === faceParams.rightEye.size && 
        faceParams.leftEye.size !== 1) {
      parts.push(`eye${faceParams.leftEye.size.toFixed(1)}x`);
    } else {
      if (leftEyeChanged) parts.push(`leye${faceParams.leftEye.size.toFixed(1)}x`);
      if (rightEyeChanged) parts.push(`reye${faceParams.rightEye.size.toFixed(1)}x`);
    }
  }
  
  // 口の変更をチェック
  if (faceParams.mouth.width !== 1 || faceParams.mouth.height !== 1 ||
      faceParams.mouth.positionX !== 0 || faceParams.mouth.positionY !== 0) {
    if (faceParams.mouth.width === faceParams.mouth.height && faceParams.mouth.width !== 1) {
      parts.push(`mouth${faceParams.mouth.width.toFixed(1)}x`);
    } else {
      if (faceParams.mouth.width !== 1) parts.push(`mouthW${faceParams.mouth.width.toFixed(1)}`);
      if (faceParams.mouth.height !== 1) parts.push(`mouthH${faceParams.mouth.height.toFixed(1)}`);
    }
  }
  
  // 鼻の変更をチェック
  if (faceParams.nose.width !== 1 || faceParams.nose.height !== 1 ||
      faceParams.nose.positionX !== 0 || faceParams.nose.positionY !== 0) {
    if (faceParams.nose.width === faceParams.nose.height && faceParams.nose.width !== 1) {
      parts.push(`nose${faceParams.nose.width.toFixed(1)}x`);
    } else {
      if (faceParams.nose.width !== 1) parts.push(`noseW${faceParams.nose.width.toFixed(1)}`);
      if (faceParams.nose.height !== 1) parts.push(`noseH${faceParams.nose.height.toFixed(1)}`);
    }
  }
  
  return parts.length > 0 ? `-${parts.join('-')}` : '';
}

export interface FileNameOptions {
  format: 'png' | 'jpg';
  prefix?: string;
  includeTimestamp?: boolean;
  includeParams?: boolean;
  faceParams?: FaceParams;
}

/**
 * ファイル名を生成
 * @param options ファイル名生成オプション
 * @returns 生成されたファイル名
 */
export function generateFileName(options: FileNameOptions): string {
  const {
    format,
    prefix = 'face-edit',
    includeTimestamp = true,
    includeParams = false,
    faceParams
  } = options;
  
  const parts: string[] = [prefix];
  
  // タイムスタンプを追加
  if (includeTimestamp) {
    parts.push(generateTimestamp());
  }
  
  // パラメータサマリーを追加
  if (includeParams && faceParams) {
    const paramsSummary = generateParamsSummary(faceParams);
    if (paramsSummary) {
      parts.push(paramsSummary.substring(1)); // 先頭の'-'を除去
    }
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
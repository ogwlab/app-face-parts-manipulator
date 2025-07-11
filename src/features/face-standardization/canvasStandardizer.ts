import type { FaceLandmarks } from '../../types/face';
import type { 
  EyeDistanceNormalizationParams
} from './eyeDistanceNormalizer';
import { 
  performAffineStandardization,
  evaluateAffineStandardizationQuality
} from './affineStandardizer';

/**
 * 標準化結果（レガシー互換性のため）
 */
export interface StandardizationResult {
  canvas: HTMLCanvasElement;
  transformedLandmarks: FaceLandmarks;
  appliedTransform: {
    scale: number;
    rotation: number;
    translation: { x: number; y: number };
  };
}

/**
 * アフィン変換ベース顔標準化を実行する（新システム）
 * @param sourceImage - 元画像（HTMLImageElement）
 * @param landmarks - 顔のランドマーク
 * @param params - 標準化パラメータ
 * @param outputWidth - 出力画像の幅（オプション、元画像と同じ場合は省略）
 * @param outputHeight - 出力画像の高さ（オプション、元画像と同じ場合は省略）
 * @returns 標準化結果
 */
export const standardizeFaceImage = async (
  sourceImage: HTMLImageElement,
  landmarks: FaceLandmarks,
  params: EyeDistanceNormalizationParams,
  outputWidth?: number,
  outputHeight?: number
): Promise<StandardizationResult> => {
  console.log('🎯 アフィン変換ベース標準化実行開始:', {
    imageSize: { width: sourceImage.naturalWidth, height: sourceImage.naturalHeight },
    outputSize: { width: outputWidth, height: outputHeight },
    params
  });
  
  try {
    // アフィン変換ベース標準化を実行
    const result = await performAffineStandardization(
      sourceImage,
      landmarks,
      params
    );
    
    // 出力サイズが指定されている場合はリサイズ
    let finalCanvas = result.canvas;
    if (outputWidth && outputHeight && 
        (result.canvas.width !== outputWidth || result.canvas.height !== outputHeight)) {
      finalCanvas = resizeCanvas(result.canvas, outputWidth, outputHeight);
    }
    
    // 品質評価
    const targetEyeDistancePixels = sourceImage.naturalWidth * params.targetEyeDistanceRatio;
    const quality = evaluateAffineStandardizationQuality(
      result.transformedLandmarks,
      targetEyeDistancePixels
    );
    
    // レガシー形式に変換
    const legacyResult: StandardizationResult = {
      canvas: finalCanvas,
      transformedLandmarks: result.transformedLandmarks,
      appliedTransform: {
        scale: result.appliedTransform.scale,
        rotation: result.appliedTransform.rotation,
        translation: result.appliedTransform.translation
      }
    };
    
    console.log('✅ アフィン変換ベース標準化完了:', {
      quality: `${quality.toFixed(1)}%`,
      transform: result.appliedTransform
    });
    
    return legacyResult;
    
  } catch (error) {
    console.error('❌ アフィン変換ベース標準化エラー:', error);
    throw new Error(`顔標準化に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Canvasをリサイズする
 * @param sourceCanvas - 元のCanvas
 * @param width - 目標幅
 * @param height - 目標高さ
 * @returns リサイズされたCanvas
 */
const resizeCanvas = (sourceCanvas: HTMLCanvasElement, width: number, height: number): HTMLCanvasElement => {
  const resizedCanvas = document.createElement('canvas');
  resizedCanvas.width = width;
  resizedCanvas.height = height;
  
  const ctx = resizedCanvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get resized canvas 2D context');
  }
  
  // 高品質リサイズ設定
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  // 元のCanvasを新しいサイズで描画
  ctx.drawImage(sourceCanvas, 0, 0, width, height);
  
  return resizedCanvas;
};

/**
 * 標準化された画像をBlob形式で取得する
 * @param result - 標準化結果
 * @param format - 画像フォーマット（'image/png' | 'image/jpeg'）
 * @param quality - JPEG品質（0.0-1.0）
 * @returns Promise<Blob>
 */
export const getStandardizedImageBlob = (
  result: StandardizationResult,
  format: 'image/png' | 'image/jpeg' = 'image/png',
  quality: number = 0.9
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    result.canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob from canvas'));
        }
      },
      format,
      quality
    );
  });
};

/**
 * 標準化された画像をData URLとして取得する
 * @param result - 標準化結果
 * @param format - 画像フォーマット（'image/png' | 'image/jpeg'）
 * @param quality - JPEG品質（0.0-1.0）
 * @returns Data URL文字列
 */
export const getStandardizedImageDataURL = (
  result: StandardizationResult,
  format: 'image/png' | 'image/jpeg' = 'image/png',
  quality: number = 0.9
): string => {
  return result.canvas.toDataURL(format, quality);
};

/**
 * 2つの画像を並べて比較用のCanvasを作成する
 * @param originalImage - 元画像
 * @param standardizedResult - 標準化結果
 * @returns 比較用Canvas
 */
export const createComparisonCanvas = (
  originalImage: HTMLImageElement,
  standardizedResult: StandardizationResult
): HTMLCanvasElement => {
  const originalWidth = originalImage.naturalWidth;
  const originalHeight = originalImage.naturalHeight;
  const standardizedWidth = standardizedResult.canvas.width;
  const standardizedHeight = standardizedResult.canvas.height;
  
  // 比較Canvas作成（左右に並べる）
  const compCanvas = document.createElement('canvas');
  compCanvas.width = originalWidth + standardizedWidth + 20; // 間隔20px
  compCanvas.height = Math.max(originalHeight, standardizedHeight);
  
  const ctx = compCanvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get comparison canvas 2D context');
  }
  
  // 背景を白に
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, compCanvas.width, compCanvas.height);
  
  // 元画像を左側に描画
  ctx.drawImage(originalImage, 0, 0);
  
  // 標準化画像を右側に描画
  ctx.drawImage(
    standardizedResult.canvas, 
    originalWidth + 20, 
    0,
    standardizedWidth,
    standardizedHeight
  );
  
  // 境界線を描画
  ctx.strokeStyle = '#cccccc';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(originalWidth + 10, 0);
  ctx.lineTo(originalWidth + 10, compCanvas.height);
  ctx.stroke();
  
  return compCanvas;
};
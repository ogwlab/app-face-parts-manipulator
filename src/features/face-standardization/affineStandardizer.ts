import type { Point, FaceLandmarks } from '../../types/face';
import type { EyeDistanceNormalizationParams } from './eyeDistanceNormalizer';
import { getEyeCenters } from './eyeDistanceCalculator';

/**
 * アフィン変換ベースの顔標準化システム
 * 
 * Pythonの成功パターンに基づく、シンプルで効果的な顔標準化実装
 * 複雑なTPS変換を廃止し、基本的なアフィン変換で確実な結果を提供
 */

/**
 * アフィン変換行列（2x3形式）
 */
export interface AffineTransformMatrix {
  a: number; b: number; c: number; // [a b c]
  d: number; e: number; f: number; // [d e f]
}

/**
 * アフィン標準化結果
 */
export interface AffineStandardizationResult {
  canvas: HTMLCanvasElement;
  transformedLandmarks: FaceLandmarks;
  appliedTransform: {
    scale: number;
    rotation: number;
    translation: { x: number; y: number };
    matrix: AffineTransformMatrix;
  };
}

/**
 * 両眼中心線情報
 */
interface EyeCenterLineInfo {
  center: Point;      // 両眼中心線の中点
  angle: number;      // 中心線の角度（ラジアン）
  distance: number;   // 眼間距離
  leftEye: Point;     // 左目中心
  rightEye: Point;    // 右目中心
}

/**
 * 両眼中心線の詳細情報を計算する
 * @param landmarks - 顔のランドマーク
 * @returns 両眼中心線情報
 */
export const calculateEyeCenterLineInfo = (landmarks: FaceLandmarks): EyeCenterLineInfo => {
  const eyeCenters = getEyeCenters(landmarks);
  
  // 両眼中心線の中点（基準点）
  const center: Point = {
    x: (eyeCenters.leftEye.x + eyeCenters.rightEye.x) / 2,
    y: (eyeCenters.leftEye.y + eyeCenters.rightEye.y) / 2
  };
  
  // 両眼中心線の角度
  const angle = Math.atan2(
    eyeCenters.rightEye.y - eyeCenters.leftEye.y,
    eyeCenters.rightEye.x - eyeCenters.leftEye.x
  );
  
  // 眼間距離
  const distance = Math.sqrt(
    Math.pow(eyeCenters.rightEye.x - eyeCenters.leftEye.x, 2) +
    Math.pow(eyeCenters.rightEye.y - eyeCenters.leftEye.y, 2)
  );
  
  return {
    center,
    angle,
    distance,
    leftEye: eyeCenters.leftEye,
    rightEye: eyeCenters.rightEye
  };
};

/**
 * 標準化用アフィン変換行列を計算する
 * Python実装のcalculate_normalization_transformに相当
 * 
 * @param landmarks - 顔のランドマーク
 * @param imageWidth - 画像幅
 * @param imageHeight - 画像高さ
 * @param params - 標準化パラメータ
 * @returns アフィン変換行列
 */
export const calculateAffineStandardizationMatrix = (
  landmarks: FaceLandmarks,
  imageWidth: number,
  imageHeight: number,
  params: EyeDistanceNormalizationParams
): {
  matrix: AffineTransformMatrix;
  metadata: {
    scale: number;
    rotation: number;
    translation: Point;
  };
} => {
  // 現在の両眼中心線情報を取得
  const eyeLineInfo = calculateEyeCenterLineInfo(landmarks);
  
  // 目標眼間距離をピクセル値に変換
  const targetEyeDistancePixels = imageWidth * params.targetEyeDistanceRatio;
  
  // 変換パラメータの計算
  const scaleFactor = targetEyeDistancePixels / eyeLineInfo.distance;
  const rotationAngle = params.enableRotation ? 
    (params.rotationAngle || 0) - eyeLineInfo.angle : 0;
  
  // 目標位置（基準線中点が配置される位置）
  const targetCenter: Point = {
    x: imageWidth * params.baselineXPosition,
    y: imageHeight * params.baselineYPosition
  };
  
  console.log('🔧 アフィン変換計算（基準点固定版）:', {
    currentCenter: eyeLineInfo.center,
    targetCenter,
    currentAngle: `${(eyeLineInfo.angle * 180 / Math.PI).toFixed(1)}°`,
    rotationAngle: `${(rotationAngle * 180 / Math.PI).toFixed(1)}°`,
    scaleFactor: scaleFactor.toFixed(3),
    eyeDistance: `${eyeLineInfo.distance.toFixed(1)}px → ${targetEyeDistancePixels.toFixed(1)}px (${(params.targetEyeDistanceRatio * 100).toFixed(1)}%)`
  });
  
  // 基準点固定アフィン変換: R @ S @ T
  // 1. T: 基準線中点を目標位置に移動
  const T = createTranslationMatrix(
    targetCenter.x - eyeLineInfo.center.x,
    targetCenter.y - eyeLineInfo.center.y
  );
  
  // 2. S: 目標位置を中心としたスケーリング
  const S = createScaleAroundPointMatrix(scaleFactor, scaleFactor, targetCenter);
  
  // 3. R: 目標位置を中心とした回転
  const R = createRotationAroundPointMatrix(rotationAngle, targetCenter);
  
  // 行列の合成: R @ S @ T（基準点が固定される順序）
  let result = multiplyMatrix(T, S);
  result = multiplyMatrix(result, R);
  
  const translation: Point = {
    x: targetCenter.x - eyeLineInfo.center.x,
    y: targetCenter.y - eyeLineInfo.center.y
  };
  
  return {
    matrix: result,
    metadata: {
      scale: scaleFactor,
      rotation: rotationAngle,
      translation
    }
  };
};

/**
 * アフィン変換ベースの顔標準化を実行する
 * @param sourceImage - 元画像
 * @param landmarks - 顔のランドマーク
 * @param params - 標準化パラメータ
 * @returns 標準化結果
 */
export const performAffineStandardization = async (
  sourceImage: HTMLImageElement,
  landmarks: FaceLandmarks,
  params: EyeDistanceNormalizationParams
): Promise<AffineStandardizationResult> => {
  const startTime = performance.now();
  
  console.log('🎯 アフィン変換ベース標準化開始:', {
    imageSize: { width: sourceImage.naturalWidth, height: sourceImage.naturalHeight },
    params
  });
  
  try {
    // アフィン変換行列を計算
    const { matrix, metadata } = calculateAffineStandardizationMatrix(
      landmarks,
      sourceImage.naturalWidth,
      sourceImage.naturalHeight,
      params
    );
    
    // Canvas作成とアフィン変換実行
    const canvas = document.createElement('canvas');
    canvas.width = sourceImage.naturalWidth;
    canvas.height = sourceImage.naturalHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }
    
    // 高品質レンダリング設定
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // アフィン変換を適用して画像を描画
    ctx.setTransform(
      matrix.a, matrix.b, matrix.c, 
      matrix.d, matrix.e, matrix.f
    );
    ctx.drawImage(sourceImage, 0, 0);
    
    // 変換後のランドマークを計算
    const transformedLandmarks = transformLandmarksWithMatrix(landmarks, matrix);
    
    const endTime = performance.now();
    const renderTime = endTime - startTime;
    
    console.log('✅ アフィン変換ベース標準化完了:', {
      renderTime: `${renderTime.toFixed(1)}ms`,
      canvasSize: { width: canvas.width, height: canvas.height },
      metadata
    });
    
    return {
      canvas,
      transformedLandmarks,
      appliedTransform: {
        scale: metadata.scale,
        rotation: metadata.rotation,
        translation: metadata.translation,
        matrix
      }
    };
    
  } catch (error) {
    console.error('❌ アフィン変換ベース標準化エラー:', error);
    throw new Error(`アフィン標準化に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * アフィン変換行列でランドマークを変換する
 * @param landmarks - 元のランドマーク
 * @param matrix - アフィン変換行列
 * @returns 変換後のランドマーク
 */
const transformLandmarksWithMatrix = (
  landmarks: FaceLandmarks,
  matrix: AffineTransformMatrix
): FaceLandmarks => {
  const transformPoint = (point: Point): Point => {
    return {
      x: matrix.a * point.x + matrix.c * point.y + matrix.e,
      y: matrix.b * point.x + matrix.d * point.y + matrix.f
    };
  };
  
  return {
    leftEye: landmarks.leftEye.map(transformPoint),
    rightEye: landmarks.rightEye.map(transformPoint),
    mouth: landmarks.mouth.map(transformPoint),
    nose: landmarks.nose.map(transformPoint),
    jawline: landmarks.jawline.map(transformPoint),
    leftEyebrow: landmarks.leftEyebrow.map(transformPoint),
    rightEyebrow: landmarks.rightEyebrow.map(transformPoint)
  };
};

// ===== アフィン変換行列操作ユーティリティ =====

/**
 * 平行移動行列を作成する
 */
const createTranslationMatrix = (tx: number, ty: number): AffineTransformMatrix => ({
  a: 1, b: 0, c: 0,
  d: 1, e: tx, f: ty
});

/**
 * 回転行列を作成する
 */
const createRotationMatrix = (angle: number): AffineTransformMatrix => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    a: cos, b: sin, c: -sin,
    d: cos, e: 0, f: 0
  };
};

/**
 * スケール行列を作成する
 */
const createScaleMatrix = (sx: number, sy: number): AffineTransformMatrix => ({
  a: sx, b: 0, c: 0,
  d: sy, e: 0, f: 0
});

/**
 * 指定点を中心としたスケール行列を作成する
 */
const createScaleAroundPointMatrix = (sx: number, sy: number, center: Point): AffineTransformMatrix => {
  // T @ S @ T^-1 の組み合わせ
  // T^-1: 中心を原点に移動
  const T_inv = createTranslationMatrix(-center.x, -center.y);
  // S: スケーリング
  const S = createScaleMatrix(sx, sy);
  // T: 中心を元の位置に戻す
  const T = createTranslationMatrix(center.x, center.y);
  
  // 組み合わせ: T @ S @ T^-1 (右から左に適用)
  let result = multiplyMatrix(S, T_inv);
  return multiplyMatrix(T, result);
};

/**
 * 指定点を中心とした回転行列を作成する
 */
const createRotationAroundPointMatrix = (angle: number, center: Point): AffineTransformMatrix => {
  // T @ R @ T^-1 の組み合わせ
  // T^-1: 中心を原点に移動
  const T_inv = createTranslationMatrix(-center.x, -center.y);
  // R: 回転
  const R = createRotationMatrix(angle);
  // T: 中心を元の位置に戻す
  const T = createTranslationMatrix(center.x, center.y);
  
  // 組み合わせ: T @ R @ T^-1 (右から左に適用)
  let result = multiplyMatrix(R, T_inv);
  return multiplyMatrix(T, result);
};

/**
 * 2つのアフィン変換行列を乗算する
 */
const multiplyMatrix = (m1: AffineTransformMatrix, m2: AffineTransformMatrix): AffineTransformMatrix => {
  return {
    a: m1.a * m2.a + m1.c * m2.b,
    b: m1.b * m2.a + m1.d * m2.b,
    c: m1.a * m2.c + m1.c * m2.d,
    d: m1.b * m2.c + m1.d * m2.d,
    e: m1.a * m2.e + m1.c * m2.f + m1.e,
    f: m1.b * m2.e + m1.d * m2.f + m1.f
  };
};

/**
 * 標準化品質を評価する
 * @param transformedLandmarks - 変換後のランドマーク
 * @param targetEyeDistancePixels - 目標眼間距離（ピクセル）
 * @returns 品質スコア（0-100）
 */
export const evaluateAffineStandardizationQuality = (
  transformedLandmarks: FaceLandmarks,
  targetEyeDistancePixels: number
): number => {
  try {
    const eyeLineInfo = calculateEyeCenterLineInfo(transformedLandmarks);
    const actualDistance = eyeLineInfo.distance;
    const error = Math.abs(actualDistance - targetEyeDistancePixels);
    const errorPercentage = (error / targetEyeDistancePixels) * 100;
    
    // 1%以内の誤差で100%、誤差が大きくなるほど低下
    return Math.max(0, 100 - errorPercentage);
  } catch (error) {
    console.warn('⚠️ 品質評価エラー:', error);
    return 0;
  }
};
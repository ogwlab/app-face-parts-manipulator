import type { Point, FaceLandmarks } from '../../types/face';
import { calculateBaselineInfo } from './eyeDistanceCalculator';

/**
 * 眼間距離正規化パラメータ（％指定版）
 */
export interface EyeDistanceNormalizationParams {
  targetEyeDistanceRatio: number;  // 目標眼間距離（0.1-0.4、画像幅に対する比率）
  baselineYPosition: number;       // 基準線中点のY位置（0.0-1.0、画像高さに対する比率）
  baselineXPosition: number;       // 基準線中点のX位置（0.0-1.0、画像幅に対する比率）
  rotationAngle?: number;          // 基準線の目標角度（ラジアン、0=水平）
  enableRotation?: boolean;        // 回転機能を有効にするか
}

/**
 * デフォルトの正規化パラメータ（％指定版）
 */
export const DEFAULT_NORMALIZATION_PARAMS: EyeDistanceNormalizationParams = {
  targetEyeDistanceRatio: 0.25,  // 画像幅の25%
  baselineYPosition: 0.4,        // 画像高さの40%の位置
  baselineXPosition: 0.5,        // 画像幅の中央（50%）
  rotationAngle: 0,              // 水平（0ラジアン）
  enableRotation: true           // 回転機能を有効にする
};

/**
 * 特徴点変換情報
 */
export interface LandmarkTransformation {
  originalPoints: Point[];    // 元の制御点
  targetPoints: Point[];      // 目標制御点
  metadata: {
    originalEyeDistance: number;
    targetEyeDistanceRatio: number;
    targetEyeDistancePixels: number;
    scaleFactor: number;
    rotationAngle: number;
    translation: Point;
  };
}

/**
 * 眼間距離正規化のための特徴点変換を計算する
 * @param landmarks - 顔のランドマーク
 * @param imageWidth - 画像の幅
 * @param imageHeight - 画像の高さ
 * @param params - 正規化パラメータ
 * @returns 特徴点変換情報
 */
export const calculateEyeDistanceNormalization = (
  landmarks: FaceLandmarks,
  imageWidth: number,
  imageHeight: number,
  params: EyeDistanceNormalizationParams = DEFAULT_NORMALIZATION_PARAMS
): LandmarkTransformation => {
  // 現在の基準線情報を取得
  const baseline = calculateBaselineInfo(landmarks);
  
  // 目標眼間距離をピクセル値に変換
  const targetEyeDistancePixels = imageWidth * params.targetEyeDistanceRatio;
  
  // スケール比率を計算
  const scaleFactor = targetEyeDistancePixels / baseline.length;
  
  // 回転角度の計算
  const targetRotation = params.rotationAngle || 0;
  const currentRotation = baseline.angle;
  const rotationAngle = params.enableRotation ? (targetRotation - currentRotation) : 0;
  
  // 目標位置（基準線中点が配置される位置）
  const targetCenterX = imageWidth * params.baselineXPosition;
  const targetCenterY = imageHeight * params.baselineYPosition;
  
  // 移動量を計算
  const translation: Point = {
    x: targetCenterX - baseline.center.x,
    y: targetCenterY - baseline.center.y
  };
  
  // 制御点を生成（簡素化版）
  const { originalPoints, targetPoints } = generateSimpleControlPoints(
    landmarks,
    baseline,
    scaleFactor,
    rotationAngle,
    { x: targetCenterX, y: targetCenterY }
  );
  
  return {
    originalPoints,
    targetPoints,
    metadata: {
      originalEyeDistance: baseline.length,
      targetEyeDistanceRatio: params.targetEyeDistanceRatio,
      targetEyeDistancePixels,
      scaleFactor,
      rotationAngle: rotationAngle,
      translation
    }
  };
};

/**
 * 簡素化された制御点を生成する（移動・回転・スケール用）
 * @param landmarks - 顔のランドマーク
 * @param baseline - 基準線情報
 * @param scaleFactor - スケール比率
 * @param rotationAngle - 回転角度
 * @param targetCenter - 目標中心点
 * @returns 制御点ペア
 */
const generateSimpleControlPoints = (
  landmarks: FaceLandmarks,
  baseline: { center: Point; angle: number; length: number },
  scaleFactor: number,
  rotationAngle: number,
  targetCenter: Point
): {
  originalPoints: Point[];
  targetPoints: Point[];
} => {
  const originalPoints: Point[] = [];
  const targetPoints: Point[] = [];
  
  // 1. 眼の中心点（最重要）
  addEyeCenterPoints(landmarks, originalPoints, targetPoints, baseline, scaleFactor, rotationAngle, targetCenter);
  
  // 2. 顔の主要特徴点（最小限）
  addKeyFacePoints(landmarks, originalPoints, targetPoints, baseline, scaleFactor, rotationAngle, targetCenter);
  
  return { originalPoints, targetPoints };
};

/**
 * 眼の中心点を追加する（簡素化版）
 */
const addEyeCenterPoints = (
  landmarks: FaceLandmarks,
  originalPoints: Point[],
  targetPoints: Point[],
  baseline: { center: Point; angle: number; length: number },
  scaleFactor: number,
  rotationAngle: number,
  targetCenter: Point
): void => {
  // 左目の中心点
  const leftEyeCenter = landmarks.leftEye.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 }
  );
  leftEyeCenter.x /= landmarks.leftEye.length;
  leftEyeCenter.y /= landmarks.leftEye.length;
  
  // 右目の中心点
  const rightEyeCenter = landmarks.rightEye.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 }
  );
  rightEyeCenter.x /= landmarks.rightEye.length;
  rightEyeCenter.y /= landmarks.rightEye.length;
  
  // 目標眼間距離の半分
  const halfTargetDistance = (baseline.length * scaleFactor) / 2;
  
  // 左目の目標位置（回転・スケール・移動を適用）
  originalPoints.push(leftEyeCenter);
  const leftTargetOffset = applyTransform(
    { x: -halfTargetDistance, y: 0 },
    scaleFactor,
    rotationAngle
  );
  targetPoints.push({
    x: targetCenter.x + leftTargetOffset.x,
    y: targetCenter.y + leftTargetOffset.y
  });
  
  // 右目の目標位置（回転・スケール・移動を適用）
  originalPoints.push(rightEyeCenter);
  const rightTargetOffset = applyTransform(
    { x: halfTargetDistance, y: 0 },
    scaleFactor,
    rotationAngle
  );
  targetPoints.push({
    x: targetCenter.x + rightTargetOffset.x,
    y: targetCenter.y + rightTargetOffset.y
  });
};

/**
 * 主要な顔の特徴点を追加する（簡素化版）
 */
const addKeyFacePoints = (
  landmarks: FaceLandmarks,
  originalPoints: Point[],
  targetPoints: Point[],
  baseline: { center: Point; angle: number; length: number },
  scaleFactor: number,
  rotationAngle: number,
  targetCenter: Point
): void => {
  // 鼻先（鼻の最下部）
  if (landmarks.nose.length > 0) {
    const noseBottom = landmarks.nose[landmarks.nose.length - 1];
    originalPoints.push(noseBottom);
    
    const relativeToBaseline = {
      x: noseBottom.x - baseline.center.x,
      y: noseBottom.y - baseline.center.y
    };
    const transformedRelative = applyTransform(relativeToBaseline, scaleFactor, rotationAngle);
    
    targetPoints.push({
      x: targetCenter.x + transformedRelative.x,
      y: targetCenter.y + transformedRelative.y
    });
  }
  
  // 口の中心点
  if (landmarks.mouth.length > 0) {
    const mouthCenter = landmarks.mouth.reduce(
      (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
      { x: 0, y: 0 }
    );
    mouthCenter.x /= landmarks.mouth.length;
    mouthCenter.y /= landmarks.mouth.length;
    
    originalPoints.push(mouthCenter);
    
    const relativeToBaseline = {
      x: mouthCenter.x - baseline.center.x,
      y: mouthCenter.y - baseline.center.y
    };
    const transformedRelative = applyTransform(relativeToBaseline, scaleFactor, rotationAngle);
    
    targetPoints.push({
      x: targetCenter.x + transformedRelative.x,
      y: targetCenter.y + transformedRelative.y
    });
  }
  
  // 顎の中心点（顔の下部の安定化）
  if (landmarks.jawline.length > 8) {
    const jawCenter = landmarks.jawline[8]; // 顎の中央部
    originalPoints.push(jawCenter);
    
    const relativeToBaseline = {
      x: jawCenter.x - baseline.center.x,
      y: jawCenter.y - baseline.center.y
    };
    const transformedRelative = applyTransform(relativeToBaseline, scaleFactor, rotationAngle);
    
    targetPoints.push({
      x: targetCenter.x + transformedRelative.x,
      y: targetCenter.y + transformedRelative.y
    });
  }
};

/**
 * スケール・回転・移動変換を適用する
 * @param point - 変換する相対座標
 * @param scaleFactor - スケール比率
 * @param rotationAngle - 回転角度（ラジアン）
 * @returns 変換後の座標
 */
const applyTransform = (
  point: Point,
  scaleFactor: number,
  rotationAngle: number
): Point => {
  const cos = Math.cos(rotationAngle);
  const sin = Math.sin(rotationAngle);
  
  // スケール → 回転の順で変換
  const scaledX = point.x * scaleFactor;
  const scaledY = point.y * scaleFactor;
  
  return {
    x: scaledX * cos - scaledY * sin,
    y: scaledX * sin + scaledY * cos
  };
};


/**
 * 正規化結果を検証する
 * @param transformedLandmarks - 変換後のランドマーク
 * @param targetDistance - 目標眼間距離
 * @returns 検証結果
 */
export const validateNormalization = (
  transformedLandmarks: FaceLandmarks,
  targetDistance: number
): {
  isValid: boolean;
  actualDistance: number;
  error: number;
  errorPercentage: number;
} => {
  const baseline = calculateBaselineInfo(transformedLandmarks);
  const error = Math.abs(baseline.length - targetDistance);
  const errorPercentage = (error / targetDistance) * 100;
  
  // 3%以内の誤差を許容（特徴点ベース変形では高精度）
  const isValid = errorPercentage <= 3;
  
  return {
    isValid,
    actualDistance: baseline.length,
    error,
    errorPercentage
  };
};
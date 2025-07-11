import type { Point, FaceLandmarks } from '../../types/face';
import { calculateBaselineInfo } from './eyeDistanceCalculator';

/**
 * 標準化パラメータの設定
 */
export interface StandardizationParams {
  targetEyeDistance: number;  // 目標眼間距離（ピクセル）
  baselineYPosition: number;  // 基準線のY位置（0.0-1.0、画像高さに対する比率）
  centerXPosition: number;    // 基準線中心のX位置（0.0-1.0、画像幅に対する比率）
}

/**
 * デフォルトの標準化パラメータ
 */
export const DEFAULT_STANDARDIZATION_PARAMS: StandardizationParams = {
  targetEyeDistance: 150,     // 150ピクセル（より大きなデフォルト値）
  baselineYPosition: 0.4,     // 画像の40%の位置
  centerXPosition: 0.5        // 画像の中央
};

/**
 * アフィン変換行列（2x3形式）
 */
export interface AffineMatrix {
  a: number; // スケール・回転X成分
  b: number; // 回転・スキューY成分
  c: number; // 移動X成分
  d: number; // 回転・スキューX成分
  e: number; // スケール・回転Y成分
  f: number; // 移動Y成分
}

/**
 * 顔標準化のための変換情報を計算する
 * @param landmarks - 顔のランドマーク
 * @param imageWidth - 画像の幅
 * @param imageHeight - 画像の高さ
 * @param params - 標準化パラメータ
 * @returns 変換情報
 */
export const calculateStandardizationTransform = (
  landmarks: FaceLandmarks,
  imageWidth: number,
  imageHeight: number,
  params: StandardizationParams = DEFAULT_STANDARDIZATION_PARAMS
): {
  matrix: AffineMatrix;
  scale: number;
  rotation: number;
  translation: Point;
} => {
  // 現在の基準線情報を取得
  const baseline = calculateBaselineInfo(landmarks);
  
  // スケール比率を計算（目標眼間距離 / 現在の眼間距離）
  const scale = params.targetEyeDistance / baseline.length;
  
  // 回転角度（基準線を水平にするため、負の角度を適用）
  const rotation = -baseline.angle;
  
  // 目標位置を計算
  const targetX = imageWidth * params.centerXPosition;
  const targetY = imageHeight * params.baselineYPosition;
  
  // 変換行列を構築
  // 1. 基準線中心を原点に移動
  // 2. 回転とスケールを適用
  // 3. 目標位置に移動
  
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  
  // 合成変換行列 = T * S * R * T_inv
  // T_inv: 基準線中心を原点に移動
  const tx_inv = -baseline.center.x;
  const ty_inv = -baseline.center.y;
  
  // R * S: 回転 + スケール
  const a = scale * cos;
  const b = scale * -sin;
  const d = scale * sin;
  const e = scale * cos;
  
  // T: 目標位置に移動（R*S変換後の座標に対して）
  const c = targetX - (a * tx_inv + b * ty_inv);
  const f = targetY - (d * tx_inv + e * ty_inv);
  
  const matrix: AffineMatrix = { a, b, c, d, e, f };
  
  const translation: Point = { x: c, y: f };
  
  return {
    matrix,
    scale,
    rotation,
    translation
  };
};

/**
 * アフィン変換行列を適用して点を変換する
 * @param point - 変換する点
 * @param matrix - アフィン変換行列
 * @returns 変換後の点
 */
export const transformPoint = (point: Point, matrix: AffineMatrix): Point => {
  return {
    x: matrix.a * point.x + matrix.b * point.y + matrix.c,
    y: matrix.d * point.x + matrix.e * point.y + matrix.f
  };
};

/**
 * アフィン変換行列をCanvas 2D contextの形式に変換する
 * @param matrix - アフィン変換行列
 * @returns Canvas用の変換行列パラメータ [a, b, c, d, e, f]
 */
export const matrixToCanvasTransform = (matrix: AffineMatrix): [number, number, number, number, number, number] => {
  return [matrix.a, matrix.d, matrix.b, matrix.e, matrix.c, matrix.f];
};

/**
 * 標準化後の眼間距離を検証する
 * @param transformedLandmarks - 変換後のランドマーク
 * @param targetDistance - 目標眼間距離
 * @returns 検証結果
 */
export const validateStandardization = (
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
  
  // 5%以内の誤差を許容
  const isValid = errorPercentage <= 5;
  
  return {
    isValid,
    actualDistance: baseline.length,
    error,
    errorPercentage
  };
};
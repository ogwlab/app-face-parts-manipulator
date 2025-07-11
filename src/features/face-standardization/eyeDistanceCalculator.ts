import type { Point, FaceLandmarks } from '../../types/face';

/**
 * 眼の中心点を計算する
 * @param eyePoints - 眼の特徴点配列（6個の点）
 * @returns 眼の中心点座標
 */
export const calculateEyeCenter = (eyePoints: Point[]): Point => {
  if (eyePoints.length !== 6) {
    throw new Error('Eye points must contain exactly 6 landmarks');
  }
  
  const sum = eyePoints.reduce(
    (acc, point) => ({
      x: acc.x + point.x,
      y: acc.y + point.y
    }),
    { x: 0, y: 0 }
  );

  return {
    x: sum.x / eyePoints.length,
    y: sum.y / eyePoints.length
  };
};

/**
 * 両眼の虹彩中心間の距離（眼間距離）を計算する
 * @param landmarks - 顔のランドマーク
 * @returns 眼間距離（ピクセル単位）
 */
export const calculateEyeDistance = (landmarks: FaceLandmarks): number => {
  // 左目と右目の中心点を計算
  const leftEyeCenter = calculateEyeCenter(landmarks.leftEye);
  const rightEyeCenter = calculateEyeCenter(landmarks.rightEye);
  
  // ユークリッド距離を計算
  const distance = Math.sqrt(
    Math.pow(rightEyeCenter.x - leftEyeCenter.x, 2) + 
    Math.pow(rightEyeCenter.y - leftEyeCenter.y, 2)
  );
  
  return distance;
};

/**
 * 両眼の中心点を取得する
 * @param landmarks - 顔のランドマーク
 * @returns 左目と右目の中心点
 */
export const getEyeCenters = (landmarks: FaceLandmarks): {
  leftEye: Point;
  rightEye: Point;
} => {
  return {
    leftEye: calculateEyeCenter(landmarks.leftEye),
    rightEye: calculateEyeCenter(landmarks.rightEye)
  };
};

/**
 * 顔の標準化に使用する基準線の情報を計算する
 * @param landmarks - 顔のランドマーク
 * @returns 基準線の中点、角度、長さ
 */
export const calculateBaselineInfo = (landmarks: FaceLandmarks): {
  center: Point;
  angle: number;
  length: number;
} => {
  const eyeCenters = getEyeCenters(landmarks);
  
  // 基準線の中点（両目の中心を結ぶ線の中点）
  const center: Point = {
    x: (eyeCenters.leftEye.x + eyeCenters.rightEye.x) / 2,
    y: (eyeCenters.leftEye.y + eyeCenters.rightEye.y) / 2
  };
  
  // 基準線の角度（ラジアン）
  const angle = Math.atan2(
    eyeCenters.rightEye.y - eyeCenters.leftEye.y,
    eyeCenters.rightEye.x - eyeCenters.leftEye.x
  );
  
  // 基準線の長さ（眼間距離）
  const length = calculateEyeDistance(landmarks);
  
  return { center, angle, length };
};
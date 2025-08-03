/**
 * 顔輪郭変形アルゴリズム
 * jawline（顎の輪郭）を基準に、丸み⇔角張りを連続的に調整
 */

import type { Point, ContourParams, FaceLandmarks } from '../../types/face';

/**
 * 輪郭制御点の生成
 * jawlineをベースに、パラメータに応じて輪郭形状を変形
 */
export function generateContourControlPoints(
  landmarks: FaceLandmarks,
  params: ContourParams
): { original: Point[]; target: Point[] } {
  const { jawline } = landmarks;
  
  // jawlineの中心を計算
  const jawCenter = calculateCenter(jawline);
  
  // 顔の幅と高さを計算
  const bounds = calculateBounds(jawline);
  const faceWidth = bounds.maxX - bounds.minX;
  const faceHeight = bounds.maxY - bounds.minY;
  
  // 元の制御点（jawlineそのもの）
  const original = [...jawline];
  
  // 変形後の制御点を生成
  const target = jawline.map((point, index) => {
    // 顎の中心からの相対位置
    const relX = point.x - jawCenter.x;
    const relY = point.y - jawCenter.y;
    
    // 顎の下部かどうかを判定（インデックス3〜13あたりが顎下部）
    const isLowerJaw = index >= 3 && index <= 13;
    const isSideJaw = index >= 0 && index <= 4 || index >= 12 && index <= 16;
    const isCheekArea = index >= 1 && index <= 3 || index >= 13 && index <= 15;
    
    // 各パラメータの影響を計算
    let dx = 0;
    let dy = 0;
    
    // 1. roundness: 丸み⇔角張り
    if (params.roundness !== 0) {
      if (isLowerJaw) {
        // 顎下部は横方向に変形（角張り→狭く、丸み→広く）
        const roundnessEffect = params.roundness * 0.1; // -0.1〜0.1
        dx += relX * roundnessEffect;
        
        // 丸みの場合は顎先を少し上げる
        if (params.roundness > 0 && (index === 8 || index === 9)) {
          dy -= faceHeight * params.roundness * 0.02;
        }
      }
      
      if (isSideJaw) {
        // サイドは角度を調整（角張り→直線的、丸み→曲線的）
        const angle = Math.atan2(relY, relX);
        const roundnessEffect = params.roundness * 0.15;
        
        // 角張りの場合は外側に、丸みの場合は内側に
        dx += Math.cos(angle) * faceWidth * roundnessEffect * 0.5;
        dy += Math.sin(angle) * faceHeight * roundnessEffect * 0.3;
      }
    }
    
    // 2. jawWidth: 顎の幅
    if (params.jawWidth !== 1.0 && isSideJaw) {
      const widthEffect = (params.jawWidth - 1.0);
      dx += relX * widthEffect * 0.5;
    }
    
    // 3. cheekFullness: 頬の膨らみ
    if (params.cheekFullness !== 1.0 && isCheekArea) {
      const fullnessEffect = (params.cheekFullness - 1.0);
      // 頬は外側に膨らむ/へこむ
      dx += Math.sign(relX) * faceWidth * fullnessEffect * 0.1;
      // わずかに下方向にも影響
      dy += faceHeight * fullnessEffect * 0.02;
    }
    
    // 4. chinHeight: 顎の長さ
    if (params.chinHeight !== 1.0 && isLowerJaw) {
      const heightEffect = (params.chinHeight - 1.0);
      // 顎下部のY座標を調整
      const lowerJawRatio = (index - 3) / 10; // 0〜1の範囲
      const centerRatio = 1 - Math.abs(lowerJawRatio - 0.5) * 2; // 中央が最大
      dy += faceHeight * heightEffect * centerRatio * 0.15;
    }
    
    // 5. smoothness: 滑らかさ（後処理で適用）
    
    return {
      x: point.x + dx,
      y: point.y + dy
    };
  });
  
  // smoothnessパラメータによる平滑化
  if (params.smoothness > 0) {
    smoothContour(target, params.smoothness);
  }
  
  return { original, target };
}

/**
 * 輪郭線を平滑化
 */
function smoothContour(points: Point[], smoothness: number): void {
  const iterations = Math.round(smoothness * 5); // 0〜5回の平滑化
  
  for (let iter = 0; iter < iterations; iter++) {
    const smoothed = [...points];
    
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];
      
      // 3点の重み付き平均
      const weight = 0.25; // 隣接点の重み
      smoothed[i] = {
        x: curr.x * (1 - 2 * weight) + prev.x * weight + next.x * weight,
        y: curr.y * (1 - 2 * weight) + prev.y * weight + next.y * weight
      };
    }
    
    // 結果を元の配列にコピー
    for (let i = 1; i < points.length - 1; i++) {
      points[i] = smoothed[i];
    }
  }
}

/**
 * 中心点を計算
 */
function calculateCenter(points: Point[]): Point {
  const sum = points.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 }
  );
  
  return {
    x: sum.x / points.length,
    y: sum.y / points.length
  };
}

/**
 * 境界ボックスを計算
 */
function calculateBounds(points: Point[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys)
  };
}

/**
 * 輪郭変形用の追加制御点を生成
 * 頬や額の領域にも制御点を追加して、より自然な変形を実現
 */
export function generateAdditionalContourPoints(
  landmarks: FaceLandmarks,
  params: ContourParams
): { original: Point[]; target: Point[] } {
  const additional: { original: Point[]; target: Point[] } = {
    original: [],
    target: []
  };
  
  // 頬の制御点（目と顎の間）
  const leftEyeCenter = calculateCenter(landmarks.leftEye);
  const rightEyeCenter = calculateCenter(landmarks.rightEye);
  
  // 左頬
  const leftCheekPoint = {
    x: landmarks.jawline[2].x,
    y: (leftEyeCenter.y + landmarks.jawline[2].y) / 2
  };
  
  // 右頬
  const rightCheekPoint = {
    x: landmarks.jawline[14].x,
    y: (rightEyeCenter.y + landmarks.jawline[14].y) / 2
  };
  
  additional.original.push(leftCheekPoint, rightCheekPoint);
  
  // 頬の膨らみパラメータを適用
  const leftCheekTarget = { ...leftCheekPoint };
  const rightCheekTarget = { ...rightCheekPoint };
  
  if (params.cheekFullness !== 1.0) {
    const fullnessEffect = (params.cheekFullness - 1.0) * 20;
    leftCheekTarget.x -= fullnessEffect; // 左頬は左方向に
    rightCheekTarget.x += fullnessEffect; // 右頬は右方向に
  }
  
  additional.target.push(leftCheekTarget, rightCheekTarget);
  
  return additional;
}
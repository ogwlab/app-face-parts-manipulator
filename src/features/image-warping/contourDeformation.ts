/**
 * 顔輪郭変形アルゴリズム
 * jawline（顎の輪郭）を基準に、丸み⇔角張りを連続的に調整
 * Version 7.0.2 - 改善された顔形状制御
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
  
  // 解剖学的参照点を検出
  const anatomicalPoints = detectAnatomicalPoints(jawline);
  const mentonIndex = jawline.findIndex(p => p === anatomicalPoints.menton);
  
  // アーク長を計算（輪郭線に沿った距離）
  const originalArcLengths = calculateArcLengths(jawline);
  
  // 元の制御点（jawlineそのもの）
  const original = [...jawline];
  
  // 変形後の制御点を生成
  const target = jawline.map((point, index) => {
    // 顎の中心からの相対位置
    const relX = point.x - jawCenter.x;
    const relY = point.y - jawCenter.y;
    
    // 顎の下部かどうかを判定（インデックス3〜13あたりが顎下部）
    const isLowerJaw = index >= 3 && index <= 13;
    const isSideJaw = (index >= 0 && index <= 4) || (index >= 12 && index <= 16);
    const isCheekArea = (index >= 1 && index <= 3) || (index >= 13 && index <= 15);
    
    // 解剖学的参照点からの距離を計算
    const distToMenton = distance(point, anatomicalPoints.menton);
    const distToLeftGonion = distance(point, anatomicalPoints.leftGonion);
    const distToRightGonion = distance(point, anatomicalPoints.rightGonion);
    
    // 各パラメータの影響を計算
    let dx = 0;
    let dy = 0;
    
    // 1. faceShape: 丸み⇔角張り（改善版）
    if (params.faceShape !== 0) {
      // V軸投影アプローチを使用
      const aspectRatio = faceHeight / faceWidth; // 実際の顔のアスペクト比を使用
      
      if (isLowerJaw) {
        // 顎下部の変形
        if (params.faceShape > 0) {
          // 丸い顔: 楕円形に近づける
          const angle = Math.atan2(relY, relX);
          const targetRadius = Math.sqrt(relX * relX + relY * relY);
          
          // 楕円の方程式を使用（実際のアスペクト比を考慮）
          const ellipseX = jawCenter.x + Math.cos(angle) * targetRadius * (1 + params.faceShape * 0.1);
          const ellipseY = jawCenter.y + Math.sin(angle) * targetRadius * aspectRatio * (1 + params.faceShape * 0.05);
          
          dx = ellipseX - point.x;
          dy = ellipseY - point.y;
          
          // ガウシアン重み付けで滑らかな遷移
          const sigma = faceWidth * 0.2;
          let weight = gaussianWeight(distToMenton, sigma);
          
          // メントン固定時は重み付けを反転
          if (params.fixMenton) {
            weight = 1 - weight; // 遠いほど変形量大
          }
          
          dx *= weight;
          dy *= weight;
        } else {
          // 四角い顔: V軸に向かって投影
          const squareEffect = -params.faceShape; // 正の値に変換
          
          // 顎先から顎角への方向ベクトル
          const toLeftGonion = {
            x: anatomicalPoints.leftGonion.x - anatomicalPoints.menton.x,
            y: anatomicalPoints.leftGonion.y - anatomicalPoints.menton.y
          };
          const toRightGonion = {
            x: anatomicalPoints.rightGonion.x - anatomicalPoints.menton.x,
            y: anatomicalPoints.rightGonion.y - anatomicalPoints.menton.y
          };
          
          // どちらの顎角に近いか判定
          const isLeftSide = relX < 0;
          const targetDirection = isLeftSide ? toLeftGonion : toRightGonion;
          
          // V軸方向への投影
          const projectionStrength = squareEffect * 0.15;
          dx += targetDirection.x * projectionStrength;
          dy += targetDirection.y * projectionStrength * 0.7; // Y方向は控えめに
        }
      }
      
      if (isSideJaw) {
        // サイドの処理（ガウシアン重み付け）
        const angle = Math.atan2(relY, relX);
        const faceShapeEffect = params.faceShape * 0.12;
        
        // 解剖学的参照点への近さに基づいて重み付け
        const gonionWeight = Math.min(distToLeftGonion, distToRightGonion) < faceWidth * 0.3 ? 1.2 : 1.0;
        
        dx += Math.cos(angle) * faceWidth * faceShapeEffect * 0.5 * gonionWeight;
        dy += Math.sin(angle) * faceHeight * faceShapeEffect * 0.3 * gonionWeight;
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
    
    // 4. chinHeight: 顎の長さ（メントン固定時は無効）
    if (params.chinHeight !== 1.0 && isLowerJaw && !params.fixMenton) {
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
  
  // メントン固定処理
  if (params.fixMenton && mentonIndex >= 0) {
    // メントンの位置を元に戻す
    target[mentonIndex] = { ...original[mentonIndex] };
    
    // 隣接点の変形量を段階的に減衰
    const decayRange = 2;
    for (let i = 1; i <= decayRange; i++) {
      const decay = 1 - (i / (decayRange + 1)); // 1 → 0.67 → 0.33
      
      // 左側
      if (mentonIndex - i >= 0) {
        const leftIdx = mentonIndex - i;
        const dx = target[leftIdx].x - original[leftIdx].x;
        const dy = target[leftIdx].y - original[leftIdx].y;
        target[leftIdx] = {
          x: original[leftIdx].x + dx * decay,
          y: original[leftIdx].y + dy * decay
        };
      }
      
      // 右側
      if (mentonIndex + i < target.length) {
        const rightIdx = mentonIndex + i;
        const dx = target[rightIdx].x - original[rightIdx].x;
        const dy = target[rightIdx].y - original[rightIdx].y;
        target[rightIdx] = {
          x: original[rightIdx].x + dx * decay,
          y: original[rightIdx].y + dy * decay
        };
      }
    }
  }
  
  // アーク長を保持する調整（オプション）
  if (params.faceShape !== 0 && !params.fixMenton) {
    preserveArcLength(target, originalArcLengths);
  }
  
  // smoothnessパラメータによる平滑化
  if (params.smoothness > 0) {
    smoothContour(target, params.smoothness);
  }
  
  return { original, target };
}

/**
 * 解剖学的参照点を検出
 */
interface AnatomicalPoints {
  menton: Point;        // 顎先（メントン）
  leftGonion: Point;   // 左顎角（ゴニオン）
  rightGonion: Point;  // 右顎角（ゴニオン）
}

/**
 * 曲率を計算（3点を使用した離散曲率）
 */
function calculateCurvature(p1: Point, p2: Point, p3: Point): number {
  // 2つのベクトルを計算
  const v1 = { x: p2.x - p1.x, y: p2.y - p1.y };
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
  
  // 外積を計算（曲率の符号付き値）
  const crossProduct = v1.x * v2.y - v1.y * v2.x;
  
  // ベクトルの長さ
  const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
  
  // 曲率を計算（長さで正規化）
  if (len1 * len2 === 0) return 0;
  return crossProduct / (len1 * len2);
}

function detectAnatomicalPoints(jawline: Point[]): AnatomicalPoints {
  // 1. メントン: jawlineの中央付近で最も下（Y座標が最大）の点を検出
  const centerIndex = Math.floor(jawline.length / 2);
  const searchRange = 3; // 中央から±3の範囲で検索
  
  let mentonIndex = centerIndex;
  let maxY = jawline[centerIndex].y;
  
  for (let i = centerIndex - searchRange; i <= centerIndex + searchRange; i++) {
    if (i >= 0 && i < jawline.length && jawline[i].y > maxY) {
      maxY = jawline[i].y;
      mentonIndex = i;
    }
  }
  
  // 2. ゴニオン: 曲率の局所最大値を検出
  const curvatures: number[] = [];
  
  // 各点の曲率を計算（最初と最後の点を除く）
  for (let i = 1; i < jawline.length - 1; i++) {
    const curvature = calculateCurvature(
      jawline[i - 1],
      jawline[i],
      jawline[i + 1]
    );
    curvatures.push(Math.abs(curvature)); // 絶対値を使用
  }
  
  // 左側のゴニオン（インデックス1〜6の範囲で最大曲率）
  let leftGonionIndex = 3; // デフォルト値
  let maxLeftCurvature = 0;
  
  for (let i = 1; i <= 6 && i < curvatures.length; i++) {
    if (curvatures[i - 1] > maxLeftCurvature) {
      maxLeftCurvature = curvatures[i - 1];
      leftGonionIndex = i;
    }
  }
  
  // 右側のゴニオン（インデックス10〜15の範囲で最大曲率）
  let rightGonionIndex = 13; // デフォルト値
  let maxRightCurvature = 0;
  
  for (let i = 10; i <= 15 && i < curvatures.length + 1; i++) {
    if (curvatures[i - 1] > maxRightCurvature) {
      maxRightCurvature = curvatures[i - 1];
      rightGonionIndex = i;
    }
  }
  
  return {
    menton: jawline[mentonIndex],
    leftGonion: jawline[leftGonionIndex],
    rightGonion: jawline[rightGonionIndex]
  };
}

/**
 * jawlineのアーク長を計算
 */
function calculateArcLengths(points: Point[]): number[] {
  const arcLengths: number[] = [0];
  
  for (let i = 1; i < points.length; i++) {
    const dist = distance(points[i-1], points[i]);
    arcLengths.push(arcLengths[i-1] + dist);
  }
  
  return arcLengths;
}

/**
 * 2点間の距離を計算
 */
function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * ガウシアン重み付け関数
 */
function gaussianWeight(distance: number, sigma: number): number {
  return Math.exp(-(distance * distance) / (2 * sigma * sigma));
}

/**
 * アーク長を保持するように点を調整
 */
function preserveArcLength(points: Point[], originalArcLengths: number[]): void {
  if (points.length !== originalArcLengths.length) return;
  
  // 各点を調整
  for (let i = 1; i < points.length - 1; i++) {
    const targetArcLength = originalArcLengths[i];
    
    // 前の点からの方向ベクトル
    const prevPoint = points[i - 1];
    const currentPoint = points[i];
    const direction = {
      x: currentPoint.x - prevPoint.x,
      y: currentPoint.y - prevPoint.y
    };
    
    // 方向を正規化
    const dirLength = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
    if (dirLength > 0) {
      direction.x /= dirLength;
      direction.y /= dirLength;
      
      // 目標距離
      const targetDistance = targetArcLength - originalArcLengths[i - 1];
      
      // 新しい位置
      points[i] = {
        x: prevPoint.x + direction.x * targetDistance,
        y: prevPoint.y + direction.y * targetDistance
      };
    }
  }
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
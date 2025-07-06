/**
 * 密なランドマーク生成システム
 * 4層構造で目の領域を高密度にサンプリング
 */

import type { Point, EyeParams } from '../../types/face';
import { estimateIrisRadius, type IrisEstimationResult } from './irisRadiusEstimator';

/**
 * 密なランドマーク構造
 */
export interface DenseEyeLandmarks {
  // 第1層: オリジナル6点（互換性維持）
  original: Point[];
  
  // 第2層: まぶた補間点
  eyelidPoints: {
    upper: Point[];      // 上まぶた補間点
    lower: Point[];      // 下まぶた補間点
  };
  
  // 第3層: 虹彩領域
  irisPoints: {
    boundary: Point[];   // 虹彩境界（16点）
    inner: Point[];      // 内側円（12点）
    pupil: Point[];      // 瞳孔境界（8点）
  };
  
  // 第4層: 遷移領域
  transitionPoints: Point[];
  
  // メタデータ
  metadata: {
    irisRadius: number;
    irisCenter: Point;
    estimationResult: IrisEstimationResult;
    totalPoints: number;
  };
}

/**
 * 密ランドマーク生成オプション
 */
export interface DenseGenerationOptions {
  eyelidInterpolationPoints?: number;    // まぶた補間点数（デフォルト: 各10点）
  irisLayers?: {
    boundary?: number;      // 虹彩境界点数（デフォルト: 16）
    inner?: number;         // 内側円点数（デフォルト: 12）
    pupil?: number;         // 瞳孔点数（デフォルト: 8）
  };
  transitionDensity?: 'low' | 'medium' | 'high';  // 遷移領域密度
  adaptiveTransition?: boolean;          // 虹彩距離に応じた適応的配置
}

/**
 * メイン関数: 密なランドマークを生成
 */
export function generateDenseEyeLandmarks(
  canvas: HTMLCanvasElement,
  eyeLandmarks: Point[],
  eyeCenter: Point,
  _eyeParams: EyeParams,
  options: DenseGenerationOptions = {}
): DenseEyeLandmarks {
  console.log('🔍 [DenseEyeLandmarks] 密ランドマーク生成開始');
  
  // デフォルトオプション
  const opts = {
    eyelidInterpolationPoints: 10,
    irisLayers: {
      boundary: options.irisLayers?.boundary ?? 16,
      inner: options.irisLayers?.inner ?? 12,
      pupil: options.irisLayers?.pupil ?? 8
    },
    transitionDensity: 'medium' as const,
    adaptiveTransition: true,
    ...options
  };
  
  // 1. 虹彩半径を推定
  const irisEstimation = estimateIrisRadius(canvas, eyeLandmarks, eyeCenter);
  console.log('👁️ [DenseEyeLandmarks] 虹彩推定完了:', {
    radius: irisEstimation.radius.toFixed(2),
    method: irisEstimation.method,
    confidence: irisEstimation.confidence.toFixed(2)
  });
  
  // 2. 各層の点を生成
  const eyelidPoints = generateEyelidInterpolation(
    eyeLandmarks,
    opts.eyelidInterpolationPoints
  );
  
  const irisPoints = generateIrisLayerPoints(
    eyeCenter,
    irisEstimation.radius,
    opts.irisLayers as { boundary: number; inner: number; pupil: number }
  );
  
  const transitionPoints = generateTransitionPoints(
    eyeLandmarks,
    eyeCenter,
    irisEstimation.radius,
    {
      density: opts.transitionDensity,
      adaptive: opts.adaptiveTransition
    }
  );
  
  // 3. 総ポイント数を計算
  const totalPoints = 
    eyeLandmarks.length +
    eyelidPoints.upper.length +
    eyelidPoints.lower.length +
    irisPoints.boundary.length +
    irisPoints.inner.length +
    irisPoints.pupil.length +
    transitionPoints.length;
  
  console.log('✅ [DenseEyeLandmarks] 生成完了:', {
    totalPoints,
    breakdown: {
      original: eyeLandmarks.length,
      eyelid: eyelidPoints.upper.length + eyelidPoints.lower.length,
      iris: irisPoints.boundary.length + irisPoints.inner.length + irisPoints.pupil.length,
      transition: transitionPoints.length
    }
  });
  
  return {
    original: eyeLandmarks,
    eyelidPoints,
    irisPoints,
    transitionPoints,
    metadata: {
      irisRadius: irisEstimation.radius,
      irisCenter: eyeCenter,
      estimationResult: irisEstimation,
      totalPoints
    }
  };
}

/**
 * まぶたの補間点を生成
 */
function generateEyelidInterpolation(
  eyeLandmarks: Point[],
  pointsPerLid: number
): { upper: Point[]; lower: Point[] } {
  // face-api.jsの目ランドマーク順序:
  // 0: 外眼角, 1,2: 上まぶた, 3: 内眼角, 4,5: 下まぶた
  
  // 上まぶた: 0 → 1 → 2 → 3
  const upperControlPoints = [
    eyeLandmarks[0],  // 外眼角
    eyeLandmarks[1],  // 上まぶた1
    eyeLandmarks[2],  // 上まぶた2
    eyeLandmarks[3]   // 内眼角
  ];
  
  // 下まぶた: 3 → 4 → 5 → 0
  const lowerControlPoints = [
    eyeLandmarks[3],  // 内眼角
    eyeLandmarks[4],  // 下まぶた1
    eyeLandmarks[5],  // 下まぶた2
    eyeLandmarks[0]   // 外眼角
  ];
  
  const upperPoints = interpolateCubicBezier(upperControlPoints, pointsPerLid);
  const lowerPoints = interpolateCubicBezier(lowerControlPoints, pointsPerLid);
  
  return { upper: upperPoints, lower: lowerPoints };
}

/**
 * 虹彩領域の層状点配置
 */
function generateIrisLayerPoints(
  center: Point,
  radius: number,
  layers: { boundary: number; inner: number; pupil: number }
): { boundary: Point[]; inner: Point[]; pupil: Point[] } {
  return {
    boundary: generateCircularPoints(center, radius, layers.boundary),
    inner: generateCircularPoints(center, radius * 0.7, layers.inner),
    pupil: generateCircularPoints(center, radius * 0.3, layers.pupil)
  };
}

/**
 * 遷移領域の点を生成
 */
function generateTransitionPoints(
  eyeLandmarks: Point[],
  irisCenter: Point,
  irisRadius: number,
  options: { density: 'low' | 'medium' | 'high'; adaptive: boolean }
): Point[] {
  const transitionPoints: Point[] = [];
  
  // 密度に応じた基本間隔を決定
  const baseSpacing = {
    low: 12,
    medium: 8,
    high: 6
  }[options.density];
  
  // 目の境界ボックスを計算
  const bounds = calculateEyeBounds(eyeLandmarks);
  
  // グリッド状に候補点を生成
  for (let y = bounds.top; y <= bounds.bottom; y += baseSpacing) {
    for (let x = bounds.left; x <= bounds.right; x += baseSpacing) {
      const point = { x, y };
      
      // 目の領域内かチェック
      if (!isPointInEyeRegion(point, eyeLandmarks)) continue;
      
      const distanceToIris = Math.sqrt(
        Math.pow(point.x - irisCenter.x, 2) +
        Math.pow(point.y - irisCenter.y, 2)
      );
      
      // 虹彩領域内は除外
      if (distanceToIris <= irisRadius * 0.9) continue;
      
      // 適応的配置の場合、虹彩に近いほど密に
      if (options.adaptive) {
        const normalizedDistance = distanceToIris / (irisRadius * 2);
        const adaptiveSpacing = baseSpacing * Math.max(0.5, normalizedDistance);
        
        // 間引き判定
        if (Math.random() > (baseSpacing / adaptiveSpacing)) continue;
      }
      
      transitionPoints.push(point);
    }
  }
  
  console.log('🔗 [DenseEyeLandmarks] 遷移点生成:', {
    candidatePoints: transitionPoints.length,
    density: options.density,
    adaptive: options.adaptive
  });
  
  return transitionPoints;
}

/**
 * 3次ベジェ曲線による補間
 */
function interpolateCubicBezier(controlPoints: Point[], numSamples: number): Point[] {
  if (controlPoints.length < 4) {
    console.warn('⚠️ [DenseEyeLandmarks] ベジェ曲線には4点以上必要');
    return [];
  }
  
  const points: Point[] = [];
  const [p0, p1, p2, p3] = controlPoints;
  
  for (let i = 0; i <= numSamples; i++) {
    const t = i / numSamples;
    const point = cubicBezierPoint(p0, p1, p2, p3, t);
    points.push(point);
  }
  
  return points;
}

/**
 * 3次ベジェ曲線の点を計算
 */
function cubicBezierPoint(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  t: number
): Point {
  const invT = 1 - t;
  const invT2 = invT * invT;
  const invT3 = invT2 * invT;
  const t2 = t * t;
  const t3 = t2 * t;
  
  return {
    x: invT3 * p0.x + 3 * invT2 * t * p1.x + 3 * invT * t2 * p2.x + t3 * p3.x,
    y: invT3 * p0.y + 3 * invT2 * t * p1.y + 3 * invT * t2 * p2.y + t3 * p3.y
  };
}

/**
 * 円形の点を生成
 */
function generateCircularPoints(center: Point, radius: number, count: number): Point[] {
  const points: Point[] = [];
  
  for (let i = 0; i < count; i++) {
    const angle = (2 * Math.PI * i) / count;
    points.push({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle)
    });
  }
  
  return points;
}

/**
 * 虹彩移動を密ランドマークに適用
 */
export function applyIrisMovementToDenseLandmarks(
  denseLandmarks: DenseEyeLandmarks,
  irisOffset: { x: number; y: number },
  _eyeParams: EyeParams
): DenseEyeLandmarks {
  if (irisOffset.x === 0 && irisOffset.y === 0) {
    return denseLandmarks;
  }
  
  console.log('👁️ [DenseEyeLandmarks] 虹彩移動適用:', {
    offsetX: irisOffset.x.toFixed(3),
    offsetY: irisOffset.y.toFixed(3)
  });
  
  // 目の境界ボックスを取得
  const eyeBounds = calculateEyeBounds(denseLandmarks.original);
  
  // 実際の移動量を計算
  const actualMovement = {
    x: eyeBounds.width * irisOffset.x,
    y: eyeBounds.height * irisOffset.y
  };
  
  // 新しい虹彩中心を計算
  const newIrisCenter = {
    x: denseLandmarks.metadata.irisCenter.x + actualMovement.x,
    y: denseLandmarks.metadata.irisCenter.y + actualMovement.y
  };
  
  // 密ランドマークをコピーして変形
  const result: DenseEyeLandmarks = JSON.parse(JSON.stringify(denseLandmarks));
  
  // 第1層（オリジナル）: 変更なし（まぶたは固定）
  
  // 第2層（まぶた補間）: 変更なし
  
  // 第3層（虹彩）: 全て新しい中心に移動
  result.irisPoints.boundary = result.irisPoints.boundary.map(p => 
    movePointRelativeToCenter(p, denseLandmarks.metadata.irisCenter, newIrisCenter)
  );
  result.irisPoints.inner = result.irisPoints.inner.map(p => 
    movePointRelativeToCenter(p, denseLandmarks.metadata.irisCenter, newIrisCenter)
  );
  result.irisPoints.pupil = result.irisPoints.pupil.map(p => 
    movePointRelativeToCenter(p, denseLandmarks.metadata.irisCenter, newIrisCenter)
  );
  
  // 第4層（遷移）: 距離に応じて部分的に移動
  result.transitionPoints = result.transitionPoints.map(p => {
    const distanceToOriginalIris = Math.sqrt(
      Math.pow(p.x - denseLandmarks.metadata.irisCenter.x, 2) +
      Math.pow(p.y - denseLandmarks.metadata.irisCenter.y, 2)
    );
    
    // 虹彩から遠いほど影響を小さく
    const influence = Math.max(0, 1 - distanceToOriginalIris / (denseLandmarks.metadata.irisRadius * 2));
    
    return {
      x: p.x + actualMovement.x * influence,
      y: p.y + actualMovement.y * influence
    };
  });
  
  // メタデータを更新
  result.metadata.irisCenter = newIrisCenter;
  
  return result;
}

/**
 * 密ランドマークを平坦な配列に変換
 */
export function flattenDenseLandmarks(denseLandmarks: DenseEyeLandmarks): Point[] {
  const allPoints: Point[] = [];
  
  // 順序を維持（既存システムとの互換性のため）
  allPoints.push(...denseLandmarks.original);
  allPoints.push(...denseLandmarks.eyelidPoints.upper);
  allPoints.push(...denseLandmarks.eyelidPoints.lower);
  allPoints.push(...denseLandmarks.irisPoints.boundary);
  allPoints.push(...denseLandmarks.irisPoints.inner);
  allPoints.push(...denseLandmarks.irisPoints.pupil);
  allPoints.push(...denseLandmarks.transitionPoints);
  
  return allPoints;
}

/**
 * ユーティリティ関数群
 */
function calculateEyeBounds(eyeLandmarks: Point[]) {
  const xs = eyeLandmarks.map(p => p.x);
  const ys = eyeLandmarks.map(p => p.y);
  
  return {
    left: Math.min(...xs),
    top: Math.min(...ys),
    right: Math.max(...xs),
    bottom: Math.max(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys)
  };
}

function isPointInEyeRegion(point: Point, eyeLandmarks: Point[]): boolean {
  // 簡単な境界ボックスチェック
  const bounds = calculateEyeBounds(eyeLandmarks);
  const margin = 5;
  
  return point.x >= bounds.left - margin &&
         point.x <= bounds.right + margin &&
         point.y >= bounds.top - margin &&
         point.y <= bounds.bottom + margin;
}

function movePointRelativeToCenter(
  point: Point,
  oldCenter: Point,
  newCenter: Point
): Point {
  const relativeX = point.x - oldCenter.x;
  const relativeY = point.y - oldCenter.y;
  
  return {
    x: newCenter.x + relativeX,
    y: newCenter.y + relativeY
  };
}
/**
 * 虹彩半径の動的推定機能
 * 画像解析により個々の画像に最適な虹彩半径を推定
 */

import type { Point } from '../../types/face';

/**
 * 虹彩推定結果
 */
export interface IrisEstimationResult {
  radius: number;
  confidence: number;
  method: 'gradient' | 'color' | 'fallback';
  debugInfo?: {
    gradientRadius?: number;
    colorRadius?: number;
    fallbackRadius?: number;
    validSamples?: number;
  };
}

/**
 * 放射状プロファイル
 */
interface RadialProfile {
  angle: number;
  intensities: number[];
  distances: number[];
}

/**
 * グラデーション検出結果
 */
interface GradientPeak {
  distance: number;
  strength: number;
  isValid: boolean;
}

/**
 * 推定オプション
 */
interface EstimationOptions {
  numAngles?: number;          // サンプリング角度数
  maxRadius?: number;          // 最大検索半径
  minConfidence?: number;      // 最小信頼度
  fallbackRatio?: number;      // フォールバック時の標準比率
}

/**
 * メイン関数: 虹彩半径を推定
 */
export function estimateIrisRadius(
  canvas: HTMLCanvasElement,
  eyeLandmarks: Point[],
  eyeCenter: Point,
  options: EstimationOptions = {}
): IrisEstimationResult {
  console.log('🔍 [IrisEstimator] 虹彩半径推定開始');
  
  // デフォルトオプション
  const opts = {
    numAngles: 32,
    maxRadius: calculateMaxRadius(eyeLandmarks),
    minConfidence: 0.5,
    fallbackRatio: 0.35,
    ...options
  };
  
  const eyeWidth = calculateEyeWidth(eyeLandmarks);
  const fallbackRadius = eyeWidth * opts.fallbackRatio;
  
  try {
    // 目の領域を抽出
    const eyeRegion = extractEyeRegion(canvas, eyeLandmarks, eyeCenter);
    if (!eyeRegion) {
      console.warn('⚠️ [IrisEstimator] 目の領域抽出に失敗');
      return createFallbackResult(fallbackRadius);
    }
    
    // 輝度勾配による推定
    const gradientResult = estimateByGradientAnalysis(
      eyeRegion,
      eyeCenter,
      opts
    );
    
    console.log('📊 [IrisEstimator] 勾配解析結果:', {
      radius: gradientResult.radius?.toFixed(2),
      confidence: gradientResult.confidence?.toFixed(2),
      validSamples: gradientResult.validSamples
    });
    
    // 高信頼度なら採用
    if (gradientResult.confidence >= opts.minConfidence) {
      return {
        radius: gradientResult.radius,
        confidence: gradientResult.confidence,
        method: 'gradient',
        debugInfo: {
          gradientRadius: gradientResult.radius,
          fallbackRadius,
          validSamples: gradientResult.validSamples
        }
      };
    }
    
    // 色差分析でフォールバック
    const colorResult = estimateByColorAnalysis(
      eyeRegion,
      eyeCenter,
      opts
    );
    
    console.log('🎨 [IrisEstimator] 色解析結果:', {
      radius: colorResult.radius?.toFixed(2),
      confidence: colorResult.confidence?.toFixed(2)
    });
    
    if (colorResult.confidence >= 0.3) {
      return {
        radius: colorResult.radius,
        confidence: colorResult.confidence,
        method: 'color',
        debugInfo: {
          colorRadius: colorResult.radius,
          gradientRadius: gradientResult.radius,
          fallbackRadius
        }
      };
    }
    
    // 全て失敗した場合
    console.warn('⚠️ [IrisEstimator] 全ての推定手法が失敗、フォールバック値を使用');
    return createFallbackResult(fallbackRadius);
    
  } catch (error) {
    console.error('❌ [IrisEstimator] 推定中にエラー:', error);
    return createFallbackResult(fallbackRadius);
  }
}

/**
 * 輝度勾配による虹彩半径推定
 */
function estimateByGradientAnalysis(
  eyeRegion: { imageData: ImageData; localCenter: Point },
  _originalCenter: Point,
  options: EstimationOptions
): { radius: number; confidence: number; validSamples: number } {
  const { imageData, localCenter } = eyeRegion;
  
  // 放射状プロファイルを作成
  const profiles = createRadialProfiles(
    imageData,
    localCenter,
    options.numAngles || 32,
    options.maxRadius || 50
  );
  
  // 各プロファイルで勾配ピークを検出
  const gradientPeaks: GradientPeak[] = [];
  
  for (const profile of profiles) {
    const peak = findGradientPeak(profile);
    if (peak.isValid) {
      gradientPeaks.push(peak);
    }
  }
  
  if (gradientPeaks.length < 8) {
    console.warn('⚠️ [IrisEstimator] 有効な勾配ピークが不足:', gradientPeaks.length);
    return { radius: 0, confidence: 0, validSamples: gradientPeaks.length };
  }
  
  // ロバスト推定（外れ値除去）
  const radii = gradientPeaks.map(p => p.distance);
  const robustRadius = calculateRobustMean(radii);
  const confidence = calculateConfidence(gradientPeaks, robustRadius);
  
  return {
    radius: robustRadius,
    confidence,
    validSamples: gradientPeaks.length
  };
}

/**
 * 色差分析による虹彩半径推定
 */
function estimateByColorAnalysis(
  eyeRegion: { imageData: ImageData; localCenter: Point },
  _originalCenter: Point,
  options: EstimationOptions
): { radius: number; confidence: number } {
  const { imageData, localCenter } = eyeRegion;
  
  // 複数方向で色変化を検出
  const colorEdges: number[] = [];
  const numDirections = 16;
  
  for (let i = 0; i < numDirections; i++) {
    const angle = (2 * Math.PI * i) / numDirections;
    const edge = findColorEdge(imageData, localCenter, angle, options.maxRadius || 50);
    
    if (edge > 0) {
      colorEdges.push(edge);
    }
  }
  
  if (colorEdges.length < 6) {
    return { radius: 0, confidence: 0 };
  }
  
  const robustRadius = calculateRobustMean(colorEdges);
  const confidence = Math.min(colorEdges.length / numDirections * 2, 1.0);
  
  return { radius: robustRadius, confidence };
}

/**
 * 目の領域を抽出
 */
function extractEyeRegion(
  canvas: HTMLCanvasElement,
  eyeLandmarks: Point[],
  eyeCenter: Point
): { imageData: ImageData; localCenter: Point } | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  
  // 目の境界ボックスを計算
  const bounds = calculateEyeBounds(eyeLandmarks);
  const padding = 10;
  
  const region = {
    x: Math.max(0, bounds.left - padding),
    y: Math.max(0, bounds.top - padding),
    width: Math.min(canvas.width - (bounds.left - padding), bounds.width + padding * 2),
    height: Math.min(canvas.height - (bounds.top - padding), bounds.height + padding * 2)
  };
  
  try {
    const imageData = ctx.getImageData(region.x, region.y, region.width, region.height);
    
    // 目の中心をローカル座標に変換
    const localCenter = {
      x: eyeCenter.x - region.x,
      y: eyeCenter.y - region.y
    };
    
    return { imageData, localCenter };
  } catch (error) {
    console.error('❌ [IrisEstimator] 画像データ取得エラー:', error);
    return null;
  }
}

/**
 * 放射状プロファイルを作成
 */
function createRadialProfiles(
  imageData: ImageData,
  center: Point,
  numAngles: number,
  maxRadius: number
): RadialProfile[] {
  const profiles: RadialProfile[] = [];
  
  for (let i = 0; i < numAngles; i++) {
    const angle = (2 * Math.PI * i) / numAngles;
    const profile = sampleRadialLine(imageData, center, angle, maxRadius);
    profiles.push({ angle, ...profile });
  }
  
  return profiles;
}

/**
 * 放射状の線をサンプリング
 */
function sampleRadialLine(
  imageData: ImageData,
  center: Point,
  angle: number,
  maxRadius: number
): { intensities: number[]; distances: number[] } {
  const intensities: number[] = [];
  const distances: number[] = [];
  
  const cosAngle = Math.cos(angle);
  const sinAngle = Math.sin(angle);
  
  for (let r = 1; r < maxRadius; r++) {
    const x = Math.round(center.x + r * cosAngle);
    const y = Math.round(center.y + r * sinAngle);
    
    if (x >= 0 && x < imageData.width && y >= 0 && y < imageData.height) {
      const pixelIndex = (y * imageData.width + x) * 4;
      const gray = (
        imageData.data[pixelIndex] +
        imageData.data[pixelIndex + 1] +
        imageData.data[pixelIndex + 2]
      ) / 3;
      
      intensities.push(gray);
      distances.push(r);
    }
  }
  
  return { intensities, distances };
}

/**
 * 勾配ピークを検出
 */
function findGradientPeak(profile: RadialProfile): GradientPeak {
  const { intensities, distances } = profile;
  
  if (intensities.length < 5) {
    return { distance: 0, strength: 0, isValid: false };
  }
  
  // 勾配を計算
  const gradients: number[] = [];
  for (let i = 1; i < intensities.length - 1; i++) {
    const gradient = Math.abs(intensities[i + 1] - intensities[i - 1]) / 2;
    gradients.push(gradient);
  }
  
  // 最大勾配を検出
  let maxGradient = 0;
  let maxIndex = 0;
  
  for (let i = 0; i < gradients.length; i++) {
    if (gradients[i] > maxGradient) {
      maxGradient = gradients[i];
      maxIndex = i;
    }
  }
  
  // 有効性を判定
  const isValid = maxGradient > 10 && maxIndex > 2 && maxIndex < gradients.length - 2;
  
  return {
    distance: distances[maxIndex + 1], // インデックス調整
    strength: maxGradient,
    isValid
  };
}

/**
 * 色のエッジを検出
 */
function findColorEdge(
  imageData: ImageData,
  center: Point,
  angle: number,
  maxRadius: number
): number {
  const cosAngle = Math.cos(angle);
  const sinAngle = Math.sin(angle);
  
  let prevColor = { r: 0, g: 0, b: 0 };
  let hasValidStart = false;
  
  for (let r = 2; r < maxRadius; r++) {
    const x = Math.round(center.x + r * cosAngle);
    const y = Math.round(center.y + r * sinAngle);
    
    if (x >= 0 && x < imageData.width && y >= 0 && y < imageData.height) {
      const pixelIndex = (y * imageData.width + x) * 4;
      const color = {
        r: imageData.data[pixelIndex],
        g: imageData.data[pixelIndex + 1],
        b: imageData.data[pixelIndex + 2]
      };
      
      if (hasValidStart) {
        const colorDiff = Math.sqrt(
          Math.pow(color.r - prevColor.r, 2) +
          Math.pow(color.g - prevColor.g, 2) +
          Math.pow(color.b - prevColor.b, 2)
        );
        
        if (colorDiff > 30) {
          return r;
        }
      }
      
      prevColor = color;
      hasValidStart = true;
    }
  }
  
  return 0;
}

/**
 * ロバスト平均を計算
 */
function calculateRobustMean(values: number[]): number {
  if (values.length === 0) return 0;
  
  // 外れ値を除去（IQR方式）
  const sorted = [...values].sort((a, b) => a - b);
  const q1Index = Math.floor(sorted.length * 0.25);
  const q3Index = Math.floor(sorted.length * 0.75);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;
  
  const filtered = sorted.filter(v => 
    v >= (q1 - 1.5 * iqr) && v <= (q3 + 1.5 * iqr)
  );
  
  if (filtered.length === 0) return sorted[Math.floor(sorted.length / 2)];
  
  return filtered.reduce((sum, v) => sum + v, 0) / filtered.length;
}

/**
 * 信頼度を計算
 */
function calculateConfidence(peaks: GradientPeak[], robustRadius: number): number {
  if (peaks.length === 0) return 0;
  
  // 半径の一致度
  const radiusVariance = peaks.reduce((sum, peak) => {
    const diff = Math.abs(peak.distance - robustRadius);
    return sum + diff * diff;
  }, 0) / peaks.length;
  
  const radiusConsistency = Math.max(0, 1 - radiusVariance / (robustRadius * 0.2));
  
  // 強度の平均
  const avgStrength = peaks.reduce((sum, peak) => sum + peak.strength, 0) / peaks.length;
  const strengthScore = Math.min(avgStrength / 50, 1.0);
  
  // サンプル数
  const sampleScore = Math.min(peaks.length / 24, 1.0);
  
  return radiusConsistency * 0.5 + strengthScore * 0.3 + sampleScore * 0.2;
}

/**
 * ユーティリティ関数群
 */
function calculateEyeWidth(eyeLandmarks: Point[]): number {
  const xs = eyeLandmarks.map(p => p.x);
  return Math.max(...xs) - Math.min(...xs);
}

function calculateMaxRadius(eyeLandmarks: Point[]): number {
  const eyeWidth = calculateEyeWidth(eyeLandmarks);
  return eyeWidth * 0.5;
}

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

function createFallbackResult(radius: number): IrisEstimationResult {
  return {
    radius,
    confidence: 0.3,
    method: 'fallback',
    debugInfo: {
      fallbackRadius: radius
    }
  };
}
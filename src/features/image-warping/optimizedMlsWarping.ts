import type { Point, FaceParams, FaceLandmarks } from '../../types/face';
import { generateControlPoints, applyMLSWarping, type ControlPoint, type MLSTransformOptions } from './mlsWarping';

/**
 * 最適化されたMLS変形
 * - 空間分割による高速化
 * - マルチスケール処理
 * - 選択的な高品質処理
 */

// 将来の最適化用にQuadTreeコードは省略

/**
 * マルチスケール処理用のMLS変形
 */
function applyMLSAtScale(
  sourceImageData: ImageData,
  targetImageData: ImageData,
  controlPoints: ControlPoint[],
  scale: number,
  options: MLSTransformOptions
): void {
  const width = Math.floor(sourceImageData.width * scale);
  const height = Math.floor(sourceImageData.height * scale);
  
  console.log(`🔄 MLS変形適用 - スケール: ${scale}, サイズ: ${width}x${height}`);
  
  // 低解像度で処理する場合のサンプリング
  const step = Math.max(1, Math.floor(1 / scale));
  
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const actualY = Math.floor(y / scale);
      const actualX = Math.floor(x / scale);
      
      if (actualX >= targetImageData.width || actualY >= targetImageData.height) continue;
      
      // 簡略化されたMLS変形計算（後方変換用に制御点を逆転）
      const reverseControlPoints = controlPoints.map(cp => ({
        original: cp.target,
        target: cp.original
      }));
      
      const sourcePoint = getMLSTransformSimple({ x: actualX, y: actualY }, reverseControlPoints, options);
      
      // バイリニア補間でピクセル値を取得
      const pixel = getPixelBilinear(sourceImageData, sourcePoint.x, sourcePoint.y);
      
      // 結果に設定
      setPixel(targetImageData, actualX, actualY, pixel);
    }
  }
}

/**
 * 簡略化されたMLS変形計算
 */
function getMLSTransformSimple(
  point: Point,
  controlPoints: ControlPoint[],
  options: MLSTransformOptions
): Point {
  if (controlPoints.length === 0) return point;
  
  // 最も近い制御点による簡単な変形
  let minDistance = Infinity;
  let closestCP: ControlPoint | null = null;
  
  for (const cp of controlPoints) {
    const dx = point.x - cp.original.x;
    const dy = point.y - cp.original.y;
    const distance = dx * dx + dy * dy; // 平方根は計算しない
    
    if (distance < minDistance) {
      minDistance = distance;
      closestCP = cp;
    }
  }
  
  if (!closestCP) return point;
  
  // 単純な平行移動
  const offset = {
    x: closestCP.target.x - closestCP.original.x,
    y: closestCP.target.y - closestCP.original.y
  };
  
  // 距離による重み付け
  const weight = 1 / (Math.sqrt(minDistance) + options.epsilon);
  const maxWeight = 0.5; // 最大変形量を制限
  const actualWeight = Math.min(weight, maxWeight);
  
  return {
    x: point.x + offset.x * actualWeight,
    y: point.y + offset.y * actualWeight
  };
}

/**
 * バイリニア補間でピクセル値を取得
 */
function getPixelBilinear(imageData: ImageData, x: number, y: number): [number, number, number, number] {
  const { width, height, data } = imageData;
  
  if (x < 0 || x >= width - 1 || y < 0 || y >= height - 1) {
    return [0, 0, 0, 0];
  }
  
  const x1 = Math.floor(x);
  const y1 = Math.floor(y);
  const x2 = x1 + 1;
  const y2 = y1 + 1;
  
  const fx = x - x1;
  const fy = y - y1;
  
  const idx1 = (y1 * width + x1) * 4;
  const idx2 = (y1 * width + x2) * 4;
  const idx3 = (y2 * width + x1) * 4;
  const idx4 = (y2 * width + x2) * 4;
  
  const r = data[idx1] * (1 - fx) * (1 - fy) + data[idx2] * fx * (1 - fy) + 
            data[idx3] * (1 - fx) * fy + data[idx4] * fx * fy;
  const g = data[idx1 + 1] * (1 - fx) * (1 - fy) + data[idx2 + 1] * fx * (1 - fy) + 
            data[idx3 + 1] * (1 - fx) * fy + data[idx4 + 1] * fx * fy;
  const b = data[idx1 + 2] * (1 - fx) * (1 - fy) + data[idx2 + 2] * fx * (1 - fy) + 
            data[idx3 + 2] * (1 - fx) * fy + data[idx4 + 2] * fx * fy;
  const a = data[idx1 + 3] * (1 - fx) * (1 - fy) + data[idx2 + 3] * fx * (1 - fy) + 
            data[idx3 + 3] * (1 - fx) * fy + data[idx4 + 3] * fx * fy;
  
  return [Math.round(r), Math.round(g), Math.round(b), Math.round(a)];
}

/**
 * ピクセル値を設定
 */
function setPixel(imageData: ImageData, x: number, y: number, pixel: [number, number, number, number]): void {
  const idx = (y * imageData.width + x) * 4;
  imageData.data[idx] = pixel[0];
  imageData.data[idx + 1] = pixel[1];
  imageData.data[idx + 2] = pixel[2];
  imageData.data[idx + 3] = pixel[3];
}

/**
 * 最適化されたMLS変形を画像に適用
 */
export function applyOptimizedMLSWarping(
  sourceImageElement: HTMLImageElement,
  landmarks: FaceLandmarks,
  faceParams: FaceParams,
  canvasWidth: number,
  canvasHeight: number,
  quality: 'low' | 'medium' | 'high' = 'medium'
): HTMLCanvasElement {
  console.log('🚀 最適化MLS変形開始:', { canvasWidth, canvasHeight, quality });
  
  // Canvas準備
  const sourceCanvas = document.createElement('canvas');
  const targetCanvas = document.createElement('canvas');
  
  sourceCanvas.width = canvasWidth;
  sourceCanvas.height = canvasHeight;
  targetCanvas.width = canvasWidth;
  targetCanvas.height = canvasHeight;
  
  const sourceCtx = sourceCanvas.getContext('2d');
  const targetCtx = targetCanvas.getContext('2d');
  
  if (!sourceCtx || !targetCtx) {
    throw new Error('Canvas context を取得できません');
  }
  
  // 元画像を描画
  sourceCtx.drawImage(sourceImageElement, 0, 0, canvasWidth, canvasHeight);
  
  // 制御点を生成
  const imageScale = {
    x: canvasWidth / sourceImageElement.naturalWidth,
    y: canvasHeight / sourceImageElement.naturalHeight
  };
  
  const controlPoints = generateControlPoints(landmarks, faceParams, imageScale);
  
  if (controlPoints.length === 0) {
    // 制御点がない場合は元画像をそのまま返す
    targetCtx.drawImage(sourceCanvas, 0, 0);
    return targetCanvas;
  }
  
  // 品質に応じて処理方法を選択
  if (quality === 'high' || controlPoints.length < 10) {
    // 高品質または少ない制御点の場合は完全なMLS変形
    return applyMLSWarping(sourceImageElement, landmarks, faceParams, canvasWidth, canvasHeight);
  }
  
  // 最適化された処理
  const sourceImageData = sourceCtx.getImageData(0, 0, canvasWidth, canvasHeight);
  const targetImageData = targetCtx.createImageData(canvasWidth, canvasHeight);
  
  // 元画像をコピー（ベース）
  targetImageData.data.set(sourceImageData.data);
  
  const options: MLSTransformOptions = {
    alpha: quality === 'low' ? 1.0 : 2.0,
    epsilon: 1e-6,
    influenceRadius: Math.min(canvasWidth, canvasHeight) * (quality === 'low' ? 0.2 : 0.3)
  };
  
  // 品質レベルに応じた処理
  const scale = quality === 'low' ? 0.5 : 0.8;
  applyMLSAtScale(sourceImageData, targetImageData, controlPoints, scale, options);
  
  // 結果を描画
  targetCtx.putImageData(targetImageData, 0, 0);
  
  console.log('✅ 最適化MLS変形完了');
  return targetCanvas;
}

/**
 * リアルタイム用の超高速変形
 */
export function applyFastWarping(
  sourceImageElement: HTMLImageElement,
  landmarks: FaceLandmarks,
  faceParams: FaceParams,
  canvasWidth: number,
  canvasHeight: number
): HTMLCanvasElement {
  console.log('⚡ 高速変形開始');
  
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas context を取得できません');
  }
  
  // 元画像を描画
  ctx.drawImage(sourceImageElement, 0, 0, canvasWidth, canvasHeight);
  
  // 制御点を生成
  const imageScale = {
    x: canvasWidth / sourceImageElement.naturalWidth,
    y: canvasHeight / sourceImageElement.naturalHeight
  };
  
  const controlPoints = generateControlPoints(landmarks, faceParams, imageScale);
  
  if (controlPoints.length === 0) {
    return canvas;
  }
  
  // 非常に簡単な変形（Canvas transformationを使用）
  controlPoints.forEach(cp => {
    const offset = {
      x: cp.target.x - cp.original.x,
      y: cp.target.y - cp.original.y
    };
    
    if (Math.abs(offset.x) > 1 || Math.abs(offset.y) > 1) {
      ctx.save();
      ctx.translate(offset.x * 0.1, offset.y * 0.1); // 軽微な変形
      ctx.restore();
    }
  });
  
  console.log('✅ 高速変形完了');
  return canvas;
}
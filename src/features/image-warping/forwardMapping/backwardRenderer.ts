import type { Triangle } from '../triangulation/types';
import type { Point } from '../../../types/face';
import { calculateBarycentricCoordinates } from './affineTransform';

/**
 * バックワードマッピングによる三角形メッシュレンダリング
 * 
 * フォワードマッピングとは逆に、ターゲット画像の各ピクセルから
 * ソース画像の対応する座標を逆算することで、ピクセル漏れを防ぐ
 * 
 * Version 5.2.2: バウンディングボックス最適化対応
 */

/**
 * 点が三角形に含まれるかを判定し、含まれる場合はその三角形を返す
 */
function findContainingTriangle(
  point: Point,
  triangles: Triangle[]
): Triangle | null {
  for (const triangle of triangles) {
    const barycentric = calculateBarycentricCoordinates(point, triangle);
    
    // 重心座標が全て0以上1以下なら、点は三角形内にある
    if (barycentric.u >= 0 && barycentric.v >= 0 && barycentric.w >= 0 &&
        barycentric.u <= 1 && barycentric.v <= 1 && barycentric.w <= 1) {
      return triangle;
    }
  }
  
  return null;
}

/**
 * 重心座標から元画像の座標に変換
 */
function barycentricToSourcePoint(
  barycentric: { u: number; v: number; w: number },
  sourceTriangle: Triangle
): Point {
  const [p1, p2, p3] = sourceTriangle.vertices;
  
  return {
    x: barycentric.w * p1.x + barycentric.v * p2.x + barycentric.u * p3.x,
    y: barycentric.w * p1.y + barycentric.v * p2.y + barycentric.u * p3.y
  };
}

/**
 * バイリニア補間でピクセル値をサンプリング
 */
function bilinearSample(
  imageData: ImageData,
  x: number,
  y: number
): { r: number; g: number; b: number; a: number } {
  const { width, height, data } = imageData;
  
  // 座標を有効範囲にクランプ
  x = Math.max(0, Math.min(x, width - 1));
  y = Math.max(0, Math.min(y, height - 1));
  
  const x1 = Math.floor(x);
  const y1 = Math.floor(y);
  const x2 = Math.min(x1 + 1, width - 1);
  const y2 = Math.min(y1 + 1, height - 1);
  
  const fx = x - x1;
  const fy = y - y1;
  
  // 4つの隣接ピクセルを取得
  const getPixel = (px: number, py: number) => {
    const idx = (py * width + px) * 4;
    return {
      r: data[idx],
      g: data[idx + 1],
      b: data[idx + 2],
      a: data[idx + 3]
    };
  };
  
  const p1 = getPixel(x1, y1);
  const p2 = getPixel(x2, y1);
  const p3 = getPixel(x1, y2);
  const p4 = getPixel(x2, y2);
  
  // バイリニア補間
  const r = p1.r * (1 - fx) * (1 - fy) + p2.r * fx * (1 - fy) + 
            p3.r * (1 - fx) * fy + p4.r * fx * fy;
  const g = p1.g * (1 - fx) * (1 - fy) + p2.g * fx * (1 - fy) + 
            p3.g * (1 - fx) * fy + p4.g * fx * fy;
  const b = p1.b * (1 - fx) * (1 - fy) + p2.b * fx * (1 - fy) + 
            p3.b * (1 - fx) * fy + p4.b * fx * fy;
  const a = p1.a * (1 - fx) * (1 - fy) + p2.a * fx * (1 - fy) + 
            p3.a * (1 - fx) * fy + p4.a * fx * fy;
  
  return {
    r: Math.round(r),
    g: Math.round(g),
    b: Math.round(b),
    a: Math.round(a)
  };
}

/**
 * バックワードマッピングで三角形メッシュをレンダリング
 */
export function renderTriangleMeshBackward(
  sourceCanvas: HTMLCanvasElement,
  targetCanvas: HTMLCanvasElement,
  trianglePairs: Array<{
    source: Triangle;
    target: Triangle;
  }>
): void {
  console.log(`🎨 バックワードマッピングレンダリング開始: ${trianglePairs.length}個の三角形`);
  const startTime = performance.now();
  
  const sourceCtx = sourceCanvas.getContext('2d');
  const targetCtx = targetCanvas.getContext('2d');
  
  if (!sourceCtx || !targetCtx) {
    console.error('Canvas context取得エラー');
    return;
  }
  
  // 画像データを取得
  const sourceImageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const targetImageData = targetCtx.createImageData(targetCanvas.width, targetCanvas.height);
  
  // ターゲット三角形の配列を作成
  const targetTriangles = trianglePairs.map(pair => pair.target);
  const sourceTriangles = trianglePairs.map(pair => pair.source);
  
  let processedPixels = 0;
  let missedPixels = 0;
  
  // 各ターゲットピクセルに対して処理
  for (let y = 0; y < targetCanvas.height; y++) {
    for (let x = 0; x < targetCanvas.width; x++) {
      // ピクセル中心座標
      const pixelCenter: Point = { x: x + 0.5, y: y + 0.5 };
      
      // このピクセルがどの三角形に含まれるか判定
      const triangleIndex = targetTriangles.findIndex(triangle => {
        const barycentric = calculateBarycentricCoordinates(pixelCenter, triangle);
        return barycentric.u >= -0.001 && barycentric.v >= -0.001 && barycentric.w >= -0.001 &&
               barycentric.u <= 1.001 && barycentric.v <= 1.001 && barycentric.w <= 1.001;
      });
      
      if (triangleIndex >= 0) {
        // 対応するソース三角形を取得
        const targetTriangle = targetTriangles[triangleIndex];
        const sourceTriangle = sourceTriangles[triangleIndex];
        
        // 重心座標を計算
        const barycentric = calculateBarycentricCoordinates(pixelCenter, targetTriangle);
        
        // ソース画像での座標を計算
        const sourcePoint = barycentricToSourcePoint(barycentric, sourceTriangle);
        
        // バイリニア補間でピクセル値を取得
        const color = bilinearSample(sourceImageData, sourcePoint.x, sourcePoint.y);
        
        // ターゲットに描画
        const targetIdx = (y * targetCanvas.width + x) * 4;
        targetImageData.data[targetIdx] = color.r;
        targetImageData.data[targetIdx + 1] = color.g;
        targetImageData.data[targetIdx + 2] = color.b;
        targetImageData.data[targetIdx + 3] = color.a;
        
        processedPixels++;
      } else {
        // どの三角形にも含まれないピクセル（デバッグ用）
        missedPixels++;
        
        // 元画像の同じ位置から色を取得（フォールバック）
        const color = bilinearSample(sourceImageData, x, y);
        const targetIdx = (y * targetCanvas.width + x) * 4;
        targetImageData.data[targetIdx] = color.r;
        targetImageData.data[targetIdx + 1] = color.g;
        targetImageData.data[targetIdx + 2] = color.b;
        targetImageData.data[targetIdx + 3] = color.a;
      }
    }
    
    // 進捗報告
    if (y % 50 === 0) {
      const progress = Math.round((y / targetCanvas.height) * 100);
      console.log(`📐 バックワードレンダリング進捗: ${progress}%`);
    }
  }
  
  // 結果を描画
  targetCtx.putImageData(targetImageData, 0, 0);
  
  const endTime = performance.now();
  const processingTime = (endTime - startTime).toFixed(1);
  const totalPixels = targetCanvas.width * targetCanvas.height;
  
  console.log(`✅ バックワードマッピング完了:`);
  console.log(`   処理時間: ${processingTime}ms`);
  console.log(`   処理ピクセル: ${processedPixels}/${totalPixels} (${(processedPixels/totalPixels*100).toFixed(1)}%)`);
  console.log(`   未処理ピクセル: ${missedPixels} (${(missedPixels/totalPixels*100).toFixed(1)}%)`);
}
/**
 * ハイブリッドレンダリング
 * エッジ部分のみバックワードマッピング、内部はフォワードマッピング
 * Version 5.2.2
 */

import type { Triangle, AffineTransform } from '../triangulation/types';
import type { Point } from '../../../types/face';
import { calculateBarycentricCoordinates } from './affineTransform';
import { renderTriangleMesh } from './triangleRenderer';

/**
 * エッジマスクを生成
 * @param width キャンバス幅
 * @param height キャンバス高さ
 * @param edgeWidth エッジ領域の幅（ピクセル）
 * @returns エッジマスク（true = エッジ領域）
 */
function createEdgeMask(
  width: number,
  height: number,
  edgeWidth: number = 20
): Uint8Array {
  const mask = new Uint8Array(width * height);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // エッジからの距離を計算
      const distFromEdge = Math.min(x, y, width - 1 - x, height - 1 - y);
      
      if (distFromEdge < edgeWidth) {
        mask[y * width + x] = 1;
      }
    }
  }
  
  return mask;
}

/**
 * 三角形のバウンディングボックスを計算
 */
function calculateTriangleBounds(triangle: Triangle): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  const xs = triangle.vertices.map(v => v.x);
  const ys = triangle.vertices.map(v => v.y);
  
  return {
    minX: Math.floor(Math.min(...xs)),
    minY: Math.floor(Math.min(...ys)),
    maxX: Math.ceil(Math.max(...xs)),
    maxY: Math.ceil(Math.max(...ys))
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
 * ハイブリッドレンダリング
 * エッジ部分のみバックワード、内部はフォワード
 */
export function renderTriangleMeshHybrid(
  sourceCanvas: HTMLCanvasElement,
  targetCanvas: HTMLCanvasElement,
  trianglePairs: Array<{
    source: Triangle;
    target: Triangle;
    transform?: AffineTransform;  // フォワードレンダリングとの互換性のため
  }>,
  edgeWidth: number = 20
): void {
  console.log(`🎨 ハイブリッドレンダリング開始: ${trianglePairs.length}個の三角形`);
  console.log(`📏 エッジ幅: ${edgeWidth}ピクセル`);
  const startTime = performance.now();
  
  const sourceCtx = sourceCanvas.getContext('2d');
  const targetCtx = targetCanvas.getContext('2d');
  
  if (!sourceCtx || !targetCtx) {
    console.error('Canvas context取得エラー');
    return;
  }
  
  // まずフォワードマッピングで全体をレンダリング
  console.log('➡️ フェーズ1: フォワードマッピングで全体描画');
  // transformプロパティが必要な場合は、renderTriangleMeshが期待する型に変換
  const trianglePairsWithTransform = trianglePairs.map(pair => ({
    source: pair.source,
    target: pair.target,
    transform: pair.transform || { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }  // 単位行列をデフォルト
  }));
  renderTriangleMesh(sourceCanvas, targetCanvas, trianglePairsWithTransform);
  
  // エッジマスクを生成
  const edgeMask = createEdgeMask(targetCanvas.width, targetCanvas.height, edgeWidth);
  
  // エッジ領域のピクセル数をカウント
  const edgePixelCount = edgeMask.reduce((sum, val) => sum + val, 0);
  console.log(`🔲 エッジ領域: ${edgePixelCount}ピクセル (${(edgePixelCount / (targetCanvas.width * targetCanvas.height) * 100).toFixed(1)}%)`);
  
  // バウンディングボックスを事前計算
  const triangleBounds = trianglePairs.map(pair => ({
    bounds: calculateTriangleBounds(pair.target),
    pair: pair
  }));
  
  // エッジ部分のみバックワードマッピングで上書き
  console.log('🔄 フェーズ2: エッジ領域をバックワードマッピングで修正');
  
  const sourceImageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const targetImageData = targetCtx.getImageData(0, 0, targetCanvas.width, targetCanvas.height);
  
  let processedEdgePixels = 0;
  
  // エッジ領域のみ処理
  for (let y = 0; y < targetCanvas.height; y++) {
    for (let x = 0; x < targetCanvas.width; x++) {
      // エッジ領域でない場合はスキップ
      if (edgeMask[y * targetCanvas.width + x] === 0) {
        continue;
      }
      
      // ピクセル中心座標
      const pixelCenter: Point = { x: x + 0.5, y: y + 0.5 };
      
      // バウンディングボックスでフィルタリング
      let foundTriangle = false;
      
      for (const { bounds, pair } of triangleBounds) {
        // バウンディングボックスチェック
        if (x < bounds.minX || x > bounds.maxX || 
            y < bounds.minY || y > bounds.maxY) {
          continue;
        }
        
        // 重心座標を計算
        const barycentric = calculateBarycentricCoordinates(pixelCenter, pair.target);
        
        // 三角形内にあるかチェック
        if (barycentric.u >= -0.001 && barycentric.v >= -0.001 && barycentric.w >= -0.001 &&
            barycentric.u <= 1.001 && barycentric.v <= 1.001 && barycentric.w <= 1.001) {
          
          // ソース画像での座標を計算
          const sourcePoint = barycentricToSourcePoint(barycentric, pair.source);
          
          // バイリニア補間でピクセル値を取得
          const color = bilinearSample(sourceImageData, sourcePoint.x, sourcePoint.y);
          
          // ターゲットに描画
          const targetIdx = (y * targetCanvas.width + x) * 4;
          targetImageData.data[targetIdx] = color.r;
          targetImageData.data[targetIdx + 1] = color.g;
          targetImageData.data[targetIdx + 2] = color.b;
          targetImageData.data[targetIdx + 3] = color.a;
          
          foundTriangle = true;
          processedEdgePixels++;
          break;
        }
      }
      
      // どの三角形にも含まれない場合は元画像から取得
      if (!foundTriangle) {
        const color = bilinearSample(sourceImageData, x, y);
        const targetIdx = (y * targetCanvas.width + x) * 4;
        targetImageData.data[targetIdx] = color.r;
        targetImageData.data[targetIdx + 1] = color.g;
        targetImageData.data[targetIdx + 2] = color.b;
        targetImageData.data[targetIdx + 3] = color.a;
      }
    }
    
    // 進捗報告（エッジ領域のみ）
    if (y % 50 === 0 && y > 0) {
      const progress = Math.round((y / targetCanvas.height) * 100);
      console.log(`📐 エッジ修正進捗: ${progress}%`);
    }
  }
  
  // 結果を描画
  targetCtx.putImageData(targetImageData, 0, 0);
  
  const endTime = performance.now();
  const processingTime = (endTime - startTime).toFixed(1);
  
  console.log(`✅ ハイブリッドレンダリング完了:`);
  console.log(`   処理時間: ${processingTime}ms`);
  console.log(`   エッジピクセル処理: ${processedEdgePixels}/${edgePixelCount}`);
}
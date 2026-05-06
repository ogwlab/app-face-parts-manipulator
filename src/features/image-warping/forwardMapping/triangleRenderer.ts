/**
 * 三角形レンダリングの実装
 * Version 5.2.0
 */

import type { Point } from '../../../types/face';
import type { Triangle, AffineTransform } from '../triangulation/types';
import { calculateBarycentricCoordinates } from './affineTransform';

// デバッグ用のカウンター
let renderedTriangleCount = 0;

/**
 * 三角形の面積を計算（デバッグ用）
 */
function calculateTriangleArea(triangle: Triangle): number {
  const [p1, p2, p3] = triangle.vertices;
  return Math.abs(
    (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y)) / 2
  );
}

/**
 * 三角形をスキャンライン法でレンダリング
 */
export function renderTriangle(
  sourceCanvas: HTMLCanvasElement,
  targetCanvas: HTMLCanvasElement,
  sourceTriangle: Triangle,
  targetTriangle: Triangle,
  _transform: AffineTransform
): void {
  const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  const targetCtx = targetCanvas.getContext('2d', { willReadFrequently: true });
  
  if (!sourceCtx || !targetCtx) {
    console.error('Canvas context取得エラー');
    return;
  }
  
  const sourceImageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const targetImageData = targetCtx.getImageData(0, 0, targetCanvas.width, targetCanvas.height);
  
  renderTriangleToImageData(
    sourceImageData,
    targetImageData,
    sourceTriangle,
    targetTriangle,
    _transform
  );
  
  targetCtx.putImageData(targetImageData, 0, 0);
}

/**
 * 複数の三角形を一括レンダリング（最適化版）
 */
export function renderTriangleMesh(
  sourceCanvas: HTMLCanvasElement,
  targetCanvas: HTMLCanvasElement,
  trianglePairs: Array<{
    source: Triangle;
    target: Triangle;
    transform: AffineTransform;
  }>
): void {
  console.log(`🎨 三角形メッシュレンダリング開始: ${trianglePairs.length}個の三角形`);
  const startTime = performance.now();
  
  // デバッグ用カウンターをリセット
  renderedTriangleCount = 0;
  
  const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  const targetCtx = targetCanvas.getContext('2d', { willReadFrequently: true });
  
  if (!sourceCtx || !targetCtx) {
    console.error('Canvas context取得エラー');
    return;
  }
  
  // まず元画像をターゲットにコピー（背景として）
  targetCtx.drawImage(sourceCanvas, 0, 0, targetCanvas.width, targetCanvas.height);
  
  // 画像データを取得
  const sourceImageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const targetImageData = targetCtx.getImageData(0, 0, targetCanvas.width, targetCanvas.height);
  
  // デバッグ: 最初の三角形の詳細を表示
  if (trianglePairs.length > 0) {
    const firstPair = trianglePairs[0];
    console.log('🔍 最初の三角形ペア:', {
      source: firstPair.source.vertices.map(v => `(${v.x.toFixed(1)}, ${v.y.toFixed(1)})`),
      target: firstPair.target.vertices.map(v => `(${v.x.toFixed(1)}, ${v.y.toFixed(1)})`),
      transform: firstPair.transform
    });
  }
  
  // 各三角形をレンダリング
  let renderedTriangles = 0;
  let pixelsRendered = 0;
  
  for (const { source, target, transform } of trianglePairs) {
    const pixelCount = renderTriangleToImageData(
      sourceImageData,
      targetImageData,
      source,
      target,
      transform
    );
    renderedTriangles++;
    pixelsRendered += pixelCount;
    
    // 進捗報告
    if (renderedTriangles % 50 === 0 || renderedTriangles <= 5) {
      const progress = Math.round((renderedTriangles / trianglePairs.length) * 100);
      console.log(`📐 レンダリング進捗: ${progress}% (${renderedTriangles}/${trianglePairs.length}三角形, ${pixelsRendered}ピクセル)`);
    }
  }
  
  // 結果を描画
  targetCtx.putImageData(targetImageData, 0, 0);
  
  const endTime = performance.now();
  console.log(`✅ 三角形メッシュレンダリング完了: ${(endTime - startTime).toFixed(1)}ms, 総ピクセル数: ${pixelsRendered}`);
}

/**
 * ImageDataに直接三角形をレンダリング
 */
function renderTriangleToImageData(
  sourceImageData: ImageData,
  targetImageData: ImageData,
  sourceTriangle: Triangle,
  targetTriangle: Triangle,
  transform: AffineTransform
): number {
  void transform;
  const targetWidth = targetImageData.width;
  const targetHeight = targetImageData.height;
  let pixelCount = 0;
  
  // 三角形の境界ボックスを計算
  const bounds = getTriangleBounds(targetTriangle, targetWidth, targetHeight);
  
  // デバッグ: 最初の数個の三角形の境界を表示
  if (renderedTriangleCount < 5) {
    console.log(`🔺 三角形 ${renderedTriangleCount} の詳細:`, {
      境界: bounds,
      頂点: {
        v0: `(${targetTriangle.vertices[0].x.toFixed(1)}, ${targetTriangle.vertices[0].y.toFixed(1)})`,
        v1: `(${targetTriangle.vertices[1].x.toFixed(1)}, ${targetTriangle.vertices[1].y.toFixed(1)})`,
        v2: `(${targetTriangle.vertices[2].x.toFixed(1)}, ${targetTriangle.vertices[2].y.toFixed(1)})`
      },
      面積: calculateTriangleArea(targetTriangle),
      画面内: bounds.minX >= 0 && bounds.minY >= 0 && bounds.maxX < targetWidth && bounds.maxY < targetHeight
    });
  }
  
  // カウンターを常にインクリメント（デバッグログの外で）
  renderedTriangleCount++;
  
  // 境界チェック - 三角形が画面外の場合はスキップ
  if (bounds.maxX < 0 || bounds.maxY < 0 || bounds.minX >= targetWidth || bounds.minY >= targetHeight) {
    if (renderedTriangleCount <= 10) {
      console.log(`⚠️ 三角形 ${renderedTriangleCount - 1} は画面外`);
    }
    return pixelCount;
  }
  
  // 面積が極小の三角形はスキップ
  const area = calculateTriangleArea(targetTriangle);
  if (area < 0.5) {
    if (renderedTriangleCount <= 10) {
      console.log(`⚠️ 三角形 ${renderedTriangleCount - 1} は面積が極小: ${area.toFixed(2)}`);
    }
    return pixelCount;
  }
  
  // スキャンライン法で三角形内をレンダリング
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    const scanline = getScanlineIntersections(targetTriangle, y);
    if (scanline.length < 2) continue;
    
    const minX = Math.max(0, Math.floor(Math.min(scanline[0], scanline[1])));
    const maxX = Math.min(targetWidth - 1, Math.ceil(Math.max(scanline[0], scanline[1])));
    
    for (let x = minX; x <= maxX; x++) {
      const targetPoint: Point = { x, y };
      
      // 重心座標を計算
      const barycentric = calculateBarycentricCoordinates(targetPoint, targetTriangle);
      
      // 重心座標が有効な範囲内かチェック（浮動小数点誤差を考慮）
      if (barycentric.u >= -0.01 && barycentric.v >= -0.01 && barycentric.w >= -0.01 &&
          barycentric.u <= 1.01 && barycentric.v <= 1.01 && barycentric.w <= 1.01) {
        // 元画像での座標を計算
        const sourcePoint = barycentricToSourcePoint(barycentric, sourceTriangle);
        
        // バイリニア補間でピクセル値を取得
        const color = bilinearSample(sourceImageData, sourcePoint.x, sourcePoint.y);
        
        // ターゲットに描画
        const targetIdx = (y * targetWidth + x) * 4;
        targetImageData.data[targetIdx] = color.r;
        targetImageData.data[targetIdx + 1] = color.g;
        targetImageData.data[targetIdx + 2] = color.b;
        targetImageData.data[targetIdx + 3] = color.a;
        
        pixelCount++;
      }
    }
  }
  
  return pixelCount;
}

/**
 * 三角形の境界ボックスを計算
 */
function getTriangleBounds(
  triangle: Triangle,
  maxWidth: number,
  maxHeight: number
): { minX: number; minY: number; maxX: number; maxY: number } {
  const xs = triangle.vertices.map(v => v.x);
  const ys = triangle.vertices.map(v => v.y);
  
  return {
    minX: Math.max(0, Math.floor(Math.min(...xs))),
    minY: Math.max(0, Math.floor(Math.min(...ys))),
    maxX: Math.min(maxWidth - 1, Math.ceil(Math.max(...xs))),
    maxY: Math.min(maxHeight - 1, Math.ceil(Math.max(...ys)))
  };
}

/**
 * スキャンラインと三角形の交点を計算
 */
function getScanlineIntersections(triangle: Triangle, y: number): number[] {
  const intersections: number[] = [];
  const vertices = triangle.vertices;
  
  for (let i = 0; i < 3; i++) {
    const v1 = vertices[i];
    const v2 = vertices[(i + 1) % 3];
    
    // エッジがスキャンラインと交差するかチェック
    if ((v1.y <= y && v2.y > y) || (v1.y > y && v2.y <= y)) {
      // 交点のX座標を計算
      const t = (y - v1.y) / (v2.y - v1.y);
      const x = v1.x + t * (v2.x - v1.x);
      intersections.push(x);
    }
  }
  
  return intersections;
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
  
  // 境界チェック
  if (x < 0 || x >= width || y < 0 || y >= height) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  
  const x1 = Math.floor(x);
  const y1 = Math.floor(y);
  const x2 = Math.min(x1 + 1, width - 1);
  const y2 = Math.min(y1 + 1, height - 1);
  
  const fx = x - x1;
  const fy = y - y1;
  
  // 4つの隣接ピクセルを取得
  const getPixel = (px: number, py: number) => {
    // 追加の境界チェック
    px = Math.max(0, Math.min(px, width - 1));
    py = Math.max(0, Math.min(py, height - 1));
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
 * 三角形のエッジを描画（デバッグ用）
 */
export function drawTriangleEdges(
  canvas: HTMLCanvasElement,
  triangle: Triangle,
  color: string = 'red',
  lineWidth: number = 1
): void {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  
  const vertices = triangle.vertices;
  ctx.moveTo(vertices[0].x, vertices[0].y);
  ctx.lineTo(vertices[1].x, vertices[1].y);
  ctx.lineTo(vertices[2].x, vertices[2].y);
  ctx.closePath();
  
  ctx.stroke();
}

/**
 * メッシュ全体のエッジを描画（デバッグ用）
 */
export function drawMeshEdges(
  canvas: HTMLCanvasElement,
  triangles: Triangle[],
  color: string = 'rgba(255, 0, 0, 0.3)',
  lineWidth: number = 0.5
): void {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  
  for (const triangle of triangles) {
    ctx.beginPath();
    const vertices = triangle.vertices;
    ctx.moveTo(vertices[0].x, vertices[0].y);
    ctx.lineTo(vertices[1].x, vertices[1].y);
    ctx.lineTo(vertices[2].x, vertices[2].y);
    ctx.closePath();
    ctx.stroke();
  }
  
  ctx.restore();
}

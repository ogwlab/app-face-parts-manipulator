import type { Point, FaceParams, FaceLandmarks } from '../../types/face';

/**
 * Moving Least Squares (MLS) による高品質特徴点ベース変形
 * 
 * 理論:
 * - 各制御点に距離ベースの重みを付ける
 * - 重み付き最小二乗法でアフィン変換行列を計算
 * - 滑らかで自然な変形を実現
 */

export interface ControlPoint {
  original: Point;
  target: Point;
  weight?: number;
}

export interface MLSTransformOptions {
  alpha: number; // 重み関数のパラメータ (通常 1.0-2.0)
  epsilon: number; // 数値安定化パラメータ
  influenceRadius?: number; // 影響半径 (未指定時は無限)
}

/**
 * 2x2行列の操作
 */
class Matrix2x2 {
  public a: number;
  public b: number;
  public c: number;
  public d: number;

  constructor(a: number = 1, b: number = 0, c: number = 0, d: number = 1) {
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
  }

  static zero(): Matrix2x2 {
    return new Matrix2x2(0, 0, 0, 0);
  }

  add(other: Matrix2x2): Matrix2x2 {
    return new Matrix2x2(
      this.a + other.a, this.b + other.b,
      this.c + other.c, this.d + other.d
    );
  }

  multiply(scalar: number): Matrix2x2 {
    return new Matrix2x2(
      this.a * scalar, this.b * scalar,
      this.c * scalar, this.d * scalar
    );
  }

  determinant(): number {
    return this.a * this.d - this.b * this.c;
  }

  inverse(): Matrix2x2 | null {
    const det = this.determinant();
    if (Math.abs(det) < 1e-10) return null;
    
    return new Matrix2x2(
      this.d / det, -this.b / det,
      -this.c / det, this.a / det
    );
  }

  transform(point: Point): Point {
    return {
      x: this.a * point.x + this.b * point.y,
      y: this.c * point.x + this.d * point.y
    };
  }
}

/**
 * 重み関数: 逆距離重み付け
 */
function calculateWeight(
  point: Point, 
  controlPoint: Point, 
  alpha: number, 
  epsilon: number,
  influenceRadius?: number
): number {
  const dx = point.x - controlPoint.x;
  const dy = point.y - controlPoint.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // 影響半径外は重み0
  if (influenceRadius && distance > influenceRadius) {
    return 0;
  }
  
  // 制御点と同じ位置の場合は最大重み
  if (distance < epsilon) {
    return 1e6;
  }
  
  return 1 / Math.pow(distance + epsilon, alpha);
}

/**
 * 重心の計算
 */
function calculateCentroid(points: Point[], weights: number[]): Point {
  let totalWeight = 0;
  let sumX = 0;
  let sumY = 0;
  
  for (let i = 0; i < points.length; i++) {
    const w = weights[i];
    totalWeight += w;
    sumX += w * points[i].x;
    sumY += w * points[i].y;
  }
  
  if (totalWeight < 1e-10) {
    return { x: 0, y: 0 };
  }
  
  return {
    x: sumX / totalWeight,
    y: sumY / totalWeight
  };
}

/**
 * MLS アフィン変形の計算
 */
function calculateMLSTransform(
  point: Point,
  controlPoints: ControlPoint[],
  options: MLSTransformOptions
): { transform: Matrix2x2; translation: Point } {
  const { alpha, epsilon, influenceRadius } = options;
  
  // デバッグ: 最初の数ピクセルのみログ出力
  const shouldLog = (point.x < 5 && point.y < 5) || (point.x % 50 === 0 && point.y % 50 === 0);
  
  if (shouldLog) {
    console.log('🔧 MLS変換計算:', { point, controlPointsCount: controlPoints.length, options });
  }
  
  // 各制御点に対する重みを計算
  const weights = controlPoints.map(cp => 
    calculateWeight(point, cp.original, alpha, epsilon, influenceRadius)
  );
  
  if (shouldLog) {
    console.log('⚖️ 制御点重み:', weights.map((w, i) => ({ index: i, weight: w })));
  }
  
  // 重み付き重心を計算
  const originalPoints = controlPoints.map(cp => cp.original);
  const targetPoints = controlPoints.map(cp => cp.target);
  
  const pStar = calculateCentroid(originalPoints, weights);
  const qStar = calculateCentroid(targetPoints, weights);
  
  // 重心からの相対座標
  const pHats = originalPoints.map(p => ({ x: p.x - pStar.x, y: p.y - pStar.y }));
  const qHats = targetPoints.map(p => ({ x: p.x - qStar.x, y: p.y - qStar.y }));
  
  // 重み付き共分散行列の計算
  let M = Matrix2x2.zero();
  
  for (let i = 0; i < controlPoints.length; i++) {
    const w = weights[i];
    const ph = pHats[i];
    const qh = qHats[i];
    
    // M += w * pHat * qHat^T
    M = M.add(new Matrix2x2(
      w * ph.x * qh.x, w * ph.x * qh.y,
      w * ph.y * qh.x, w * ph.y * qh.y
    ));
  }
  
  // 正規化行列の計算
  let N = Matrix2x2.zero();
  
  for (let i = 0; i < controlPoints.length; i++) {
    const w = weights[i];
    const ph = pHats[i];
    
    // N += w * pHat * pHat^T
    N = N.add(new Matrix2x2(
      w * ph.x * ph.x, w * ph.x * ph.y,
      w * ph.y * ph.x, w * ph.y * ph.y
    ));
  }
  
  // 変形行列 A = M * N^(-1)
  const NInv = N.inverse();
  let A = Matrix2x2.zero();
  
  if (NInv) {
    A = new Matrix2x2(
      M.a * NInv.a + M.b * NInv.c, M.a * NInv.b + M.b * NInv.d,
      M.c * NInv.a + M.d * NInv.c, M.c * NInv.b + M.d * NInv.d
    );
  }
  
  // 平行移動ベクトル
  const pRelative = { x: point.x - pStar.x, y: point.y - pStar.y };
  const transformedRelative = A.transform(pRelative);
  const translation = {
    x: qStar.x + transformedRelative.x,
    y: qStar.y + transformedRelative.y
  };
  
  if (shouldLog) {
    console.log('📍 MLS変換結果:', {
      pStar, qStar,
      pRelative, transformedRelative,
      translation,
      matrix: { a: A.a, b: A.b, c: A.c, d: A.d },
      determinant: A.determinant()
    });
  }
  
  return { transform: A, translation };
}

/**
 * 顔パーツのパラメータから制御点を生成
 */
export function generateControlPoints(
  landmarks: FaceLandmarks,
  faceParams: FaceParams,
  imageScale: { x: number; y: number }
): ControlPoint[] {
  const controlPoints: ControlPoint[] = [];
  
  // 画像スケールを適用する関数
  const scalePoint = (p: Point): Point => ({
    x: p.x * imageScale.x,
    y: p.y * imageScale.y
  });
  
  // 左目の制御点
  if (faceParams.leftEye.size !== 1.0 || faceParams.leftEye.positionX !== 0 || faceParams.leftEye.positionY !== 0) {
    const eyePoints = landmarks.leftEye.map(scalePoint);
    const center = eyePoints.reduce((sum, p) => ({ x: sum.x + p.x, y: sum.y + p.y }), { x: 0, y: 0 });
    center.x /= eyePoints.length;
    center.y /= eyePoints.length;
    
    eyePoints.forEach(originalPoint => {
      // 中心からの相対位置
      const relative = { x: originalPoint.x - center.x, y: originalPoint.y - center.y };
      
      // スケーリング + 平行移動
      const targetPoint = {
        x: center.x + relative.x * faceParams.leftEye.size + faceParams.leftEye.positionX * 2,
        y: center.y + relative.y * faceParams.leftEye.size + faceParams.leftEye.positionY * 2
      };
      
      controlPoints.push({ original: originalPoint, target: targetPoint });
    });
  }
  
  // 右目の制御点
  if (faceParams.rightEye.size !== 1.0 || faceParams.rightEye.positionX !== 0 || faceParams.rightEye.positionY !== 0) {
    const eyePoints = landmarks.rightEye.map(scalePoint);
    const center = eyePoints.reduce((sum, p) => ({ x: sum.x + p.x, y: sum.y + p.y }), { x: 0, y: 0 });
    center.x /= eyePoints.length;
    center.y /= eyePoints.length;
    
    eyePoints.forEach(originalPoint => {
      const relative = { x: originalPoint.x - center.x, y: originalPoint.y - center.y };
      const targetPoint = {
        x: center.x + relative.x * faceParams.rightEye.size + faceParams.rightEye.positionX * 2,
        y: center.y + relative.y * faceParams.rightEye.size + faceParams.rightEye.positionY * 2
      };
      
      controlPoints.push({ original: originalPoint, target: targetPoint });
    });
  }
  
  // 口の制御点
  if (faceParams.mouth.width !== 1.0 || faceParams.mouth.height !== 1.0 || 
      faceParams.mouth.positionX !== 0 || faceParams.mouth.positionY !== 0) {
    const mouthPoints = landmarks.mouth.map(scalePoint);
    const center = mouthPoints.reduce((sum, p) => ({ x: sum.x + p.x, y: sum.y + p.y }), { x: 0, y: 0 });
    center.x /= mouthPoints.length;
    center.y /= mouthPoints.length;
    
    mouthPoints.forEach(originalPoint => {
      const relative = { x: originalPoint.x - center.x, y: originalPoint.y - center.y };
      const targetPoint = {
        x: center.x + relative.x * faceParams.mouth.width + faceParams.mouth.positionX * 1.5,
        y: center.y + relative.y * faceParams.mouth.height + faceParams.mouth.positionY * 1.5
      };
      
      controlPoints.push({ original: originalPoint, target: targetPoint });
    });
  }
  
  // 鼻の制御点
  if (faceParams.nose.width !== 1.0 || faceParams.nose.height !== 1.0 || 
      faceParams.nose.positionX !== 0 || faceParams.nose.positionY !== 0) {
    const nosePoints = landmarks.nose.map(scalePoint);
    const center = nosePoints.reduce((sum, p) => ({ x: sum.x + p.x, y: sum.y + p.y }), { x: 0, y: 0 });
    center.x /= nosePoints.length;
    center.y /= nosePoints.length;
    
    nosePoints.forEach(originalPoint => {
      const relative = { x: originalPoint.x - center.x, y: originalPoint.y - center.y };
      const targetPoint = {
        x: center.x + relative.x * faceParams.nose.width + faceParams.nose.positionX * 1.2,
        y: center.y + relative.y * faceParams.nose.height + faceParams.nose.positionY * 1.2
      };
      
      controlPoints.push({ original: originalPoint, target: targetPoint });
    });
  }
  
  console.log(`🎯 生成された制御点数: ${controlPoints.length}`);
  
  // 詳細デバッグ情報
  if (controlPoints.length > 0) {
    console.log('🔍 制御点詳細情報:');
    console.log('📐 画像スケール:', imageScale);
    console.log('🎛️ 顔パラメータ:', faceParams);
    
    controlPoints.forEach((cp, index) => {
      console.log(`制御点 ${index}:`, {
        original: cp.original,
        target: cp.target,
        offset: {
          x: cp.target.x - cp.original.x,
          y: cp.target.y - cp.original.y
        }
      });
    });
    
    // 制御点の範囲をチェック
    const xCoords = controlPoints.flatMap(cp => [cp.original.x, cp.target.x]);
    const yCoords = controlPoints.flatMap(cp => [cp.original.y, cp.target.y]);
    
    console.log('📊 制御点座標範囲:', {
      x: { min: Math.min(...xCoords), max: Math.max(...xCoords) },
      y: { min: Math.min(...yCoords), max: Math.max(...yCoords) },
      canvasSize: { width: imageScale.x, height: imageScale.y }
    });
  }
  return controlPoints;
}

/**
 * バイリニア補間
 */
function bilinearInterpolation(
  imageData: ImageData,
  x: number,
  y: number
): [number, number, number, number] {
  const { width, height, data } = imageData;
  
  // 境界チェック
  if (x < 0 || x >= width - 1 || y < 0 || y >= height - 1) {
    return [0, 0, 0, 0];
  }
  
  const x1 = Math.floor(x);
  const y1 = Math.floor(y);
  const x2 = x1 + 1;
  const y2 = y1 + 1;
  
  const fx = x - x1;
  const fy = y - y1;
  
  const getPixel = (px: number, py: number) => {
    const idx = (py * width + px) * 4;
    return [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
  };
  
  const [r1, g1, b1, a1] = getPixel(x1, y1);
  const [r2, g2, b2, a2] = getPixel(x2, y1);
  const [r3, g3, b3, a3] = getPixel(x1, y2);
  const [r4, g4, b4, a4] = getPixel(x2, y2);
  
  const r = r1 * (1 - fx) * (1 - fy) + r2 * fx * (1 - fy) + r3 * (1 - fx) * fy + r4 * fx * fy;
  const g = g1 * (1 - fx) * (1 - fy) + g2 * fx * (1 - fy) + g3 * (1 - fx) * fy + g4 * fx * fy;
  const b = b1 * (1 - fx) * (1 - fy) + b2 * fx * (1 - fy) + b3 * (1 - fx) * fy + b4 * fx * fy;
  const a = a1 * (1 - fx) * (1 - fy) + a2 * fx * (1 - fy) + a3 * (1 - fx) * fy + a4 * fx * fy;
  
  return [Math.round(r), Math.round(g), Math.round(b), Math.round(a)];
}

/**
 * MLS変形を画像に適用
 */
export function applyMLSWarping(
  sourceImageElement: HTMLImageElement,
  landmarks: FaceLandmarks,
  faceParams: FaceParams,
  canvasWidth: number,
  canvasHeight: number
): HTMLCanvasElement {
  console.log('🎨 MLS変形開始:', { canvasWidth, canvasHeight });
  
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
  const sourceImageData = sourceCtx.getImageData(0, 0, canvasWidth, canvasHeight);
  const targetImageData = targetCtx.createImageData(canvasWidth, canvasHeight);
  
  // 制御点を生成
  const imageScale = {
    x: canvasWidth / sourceImageElement.naturalWidth,
    y: canvasHeight / sourceImageElement.naturalHeight
  };
  
  console.log('🎯 MLS変形: 座標系情報:', {
    sourceImageSize: { width: sourceImageElement.naturalWidth, height: sourceImageElement.naturalHeight },
    canvasSize: { width: canvasWidth, height: canvasHeight },
    imageScale
  });
  
  const controlPoints = generateControlPoints(landmarks, faceParams, imageScale);
  
  if (controlPoints.length === 0) {
    // 制御点がない場合は元画像をそのまま返す
    targetCtx.drawImage(sourceCanvas, 0, 0);
    return targetCanvas;
  }
  
  // MLS変形オプション
  const options: MLSTransformOptions = {
    alpha: 2.0,
    epsilon: 1e-6,
    influenceRadius: Math.min(canvasWidth, canvasHeight) * 0.3
  };
  
  console.log('🔄 MLS変形計算中...');
  
  let outOfBoundsCount = 0;
  let extremeTransformCount = 0;
  
  // 各ピクセルに対してMLS変形を適用
  for (let y = 0; y < canvasHeight; y++) {
    for (let x = 0; x < canvasWidth; x++) {
      const targetPoint = { x, y };
      
      // MLS変形を計算（後方変換用に制御点を逆転）
      const reverseControlPoints = controlPoints.map(cp => ({
        original: cp.target,
        target: cp.original
      }));
      
      const { translation } = calculateMLSTransform(targetPoint, reverseControlPoints, options);
      
      // 座標範囲の検証
      if (translation.x < 0 || translation.x >= canvasWidth || 
          translation.y < 0 || translation.y >= canvasHeight) {
        outOfBoundsCount++;
      }
      
      // 極端な変形の検出
      const distance = Math.sqrt(
        Math.pow(translation.x - x, 2) + Math.pow(translation.y - y, 2)
      );
      if (distance > Math.min(canvasWidth, canvasHeight) * 0.1) {
        extremeTransformCount++;
      }
      
      // 元画像から対応するピクセル値を取得
      const [r, g, b, a] = bilinearInterpolation(sourceImageData, translation.x, translation.y);
      
      // 結果画像に設定
      const idx = (y * canvasWidth + x) * 4;
      targetImageData.data[idx] = r;
      targetImageData.data[idx + 1] = g;
      targetImageData.data[idx + 2] = b;
      targetImageData.data[idx + 3] = a;
    }
    
    // プログレス表示（10行ごと）
    if (y % 10 === 0) {
      console.log(`🔄 MLS変形進捗: ${Math.round((y / canvasHeight) * 100)}%`);
    }
  }
  
  // 結果を描画
  targetCtx.putImageData(targetImageData, 0, 0);
  
  console.log('✅ MLS変形完了 - 座標範囲分析:', {
    totalPixels: canvasWidth * canvasHeight,
    outOfBoundsCount,
    extremeTransformCount,
    outOfBoundsRate: (outOfBoundsCount / (canvasWidth * canvasHeight) * 100).toFixed(2) + '%',
    extremeTransformRate: (extremeTransformCount / (canvasWidth * canvasHeight) * 100).toFixed(2) + '%'
  });
  
  return targetCanvas;
}
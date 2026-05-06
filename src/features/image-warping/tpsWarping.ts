import type { Point, FaceParams, FaceLandmarks, EyeParams, MouthParams, NoseParams } from '../../types/face';
import { generateContourControlPoints } from './contourDeformation';

/**
 * Thin Plate Spline (TPS) による高品質特徴点ベース変形
 * 
 * 理論:
 * - 各特徴点を制御点として使用
 * - Thin Plate Spline で滑らかな非線形変形を実現
 * - 物理的に自然な変形（薄い金属板の曲げに相当）
 */

export interface TPSControlPoint {
  original: Point;
  target: Point;
  weight?: number;
  partType?: 'eye' | 'mouth' | 'nose' | 'stabilizer';
  influenceRadius?: number;
}

export interface TPSTransformOptions {
  regularization: number; // 正則化パラメータ (通常 0.1-1.0)
  localRigidity: number;  // 局所剛性パラメータ (0.0-1.0)
}

/**
 * TPS基底関数: |r|^2 * log(|r|)
 */
function tpsBasisFunction(r: number): number {
  if (r <= 0) return 0;
  return r * r * Math.log(r);
}

/**
 * 距離計算
 */
function distance(p1: Point, p2: Point): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * TPS変形パラメータを計算
 */
export function calculateTPSParams(
  controlPoints: TPSControlPoint[],
  options: TPSTransformOptions
): { weights: number[]; affine: { a: number; b: number; c: number; d: number; tx: number; ty: number } } {
  const n = controlPoints.length;
  
  if (n < 3) {
    // 制御点が少ない場合はアフィン変換のみ
    return {
      weights: new Array(n).fill(0),
      affine: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
    };
  }

  // K行列: TPS基底関数の値
  const K = new Array(n);
  for (let i = 0; i < n; i++) {
    K[i] = new Array(n);
    for (let j = 0; j < n; j++) {
      if (i === j) {
        K[i][j] = options.regularization;
      } else {
        const r = distance(controlPoints[i].original, controlPoints[j].original);
        K[i][j] = tpsBasisFunction(r);
      }
    }
  }

  // P行列: アフィン変換用
  const P = new Array(n);
  for (let i = 0; i < n; i++) {
    P[i] = [1, controlPoints[i].original.x, controlPoints[i].original.y];
  }

  // 拡張行列を構築
  const matrixSize = n + 3;
  const A = new Array(matrixSize);
  for (let i = 0; i < matrixSize; i++) {
    A[i] = new Array(matrixSize).fill(0);
  }

  // K行列部分を設定
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      A[i][j] = K[i][j];
    }
  }

  // P行列部分を設定
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < 3; j++) {
      A[i][n + j] = P[i][j];
      A[n + j][i] = P[i][j];
    }
  }

  // ターゲット座標ベクトル (X方向)
  const bX = new Array(matrixSize).fill(0);
  const bY = new Array(matrixSize).fill(0);
  
  for (let i = 0; i < n; i++) {
    bX[i] = controlPoints[i].target.x;
    bY[i] = controlPoints[i].target.y;
  }

  // 線形方程式を解く（簡略化版 - Gauss-Jordan法）
  const solveX = gaussJordan([...A.map(row => [...row])], [...bX]);
  const solveY = gaussJordan([...A.map(row => [...row])], [...bY]);

  if (!solveX || !solveY) {
    // 解けない場合はアイデンティティ変換
    return {
      weights: new Array(n).fill(0),
      affine: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
    };
  }

  return {
    weights: solveX.slice(0, n),
    affine: {
      a: 1 + solveX[n + 1] * options.localRigidity,
      b: solveX[n + 2] * options.localRigidity,
      c: solveY[n + 1] * options.localRigidity,
      d: 1 + solveY[n + 2] * options.localRigidity,
      tx: solveX[n],
      ty: solveY[n]
    }
  };
}

/**
 * Gauss-Jordan消去法による線形方程式の解法
 */
function gaussJordan(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  
  // 拡張行列を作成
  for (let i = 0; i < n; i++) {
    A[i].push(b[i]);
  }

  // 前進消去
  for (let i = 0; i < n; i++) {
    // ピボット選択
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) {
        maxRow = k;
      }
    }
    
    if (Math.abs(A[maxRow][i]) < 1e-10) {
      continue; // 特異行列の場合はスキップ
    }

    // 行の交換
    [A[i], A[maxRow]] = [A[maxRow], A[i]];

    // 対角要素を1にする
    const pivot = A[i][i];
    for (let j = 0; j <= n; j++) {
      A[i][j] /= pivot;
    }

    // 他の行を消去
    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = A[k][i];
        for (let j = 0; j <= n; j++) {
          A[k][j] -= factor * A[i][j];
        }
      }
    }
  }

  // 解を抽出
  const x = new Array(n);
  for (let i = 0; i < n; i++) {
    x[i] = A[i][n];
  }

  return x;
}

/**
 * TPS変形を適用して座標を変換
 */
export function applyTPSTransform(
  point: Point,
  controlPoints: TPSControlPoint[],
  params: { weights: number[]; affine: { a: number; b: number; c: number; d: number; tx: number; ty: number } }
): Point {
  const { weights, affine } = params;
  
  // アフィン変換部分
  let x = affine.a * point.x + affine.b * point.y + affine.tx;
  let y = affine.c * point.x + affine.d * point.y + affine.ty;

  // TPS非線形部分
  for (let i = 0; i < controlPoints.length; i++) {
    const r = distance(point, controlPoints[i].original);
    const basis = tpsBasisFunction(r);
    x += weights[i] * basis;
    y += weights[i] * basis;
  }

  return { x, y };
}

/**
 * 顔パラメータから制御点を生成（個別特徴点ベース）
 */
export function generateTPSControlPoints(
  landmarks: FaceLandmarks,
  faceParams: FaceParams,
  imageScale: { x: number; y: number },
  canvasSize: { width: number; height: number },
  faceBounds?: { width: number; height: number }
): TPSControlPoint[] {
  const controlPoints: TPSControlPoint[] = [];
  
  // 画像スケールを適用する関数
  const scalePoint = (p: Point): Point => ({
    x: p.x * imageScale.x,
    y: p.y * imageScale.y
  });

  // 顔全体の境界を推定（faceBoundsが提供されない場合）
  const estimatedFaceBounds = faceBounds || (() => {
    const allPoints = [
      ...landmarks.leftEye,
      ...landmarks.rightEye,
      ...landmarks.mouth,
      ...landmarks.nose,
      ...landmarks.jawline
    ];
    const xs = allPoints.map(p => p.x * imageScale.x);
    const ys = allPoints.map(p => p.y * imageScale.y);
    return {
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys)
    };
  })();

  // 画像コンテキスト
  const imageContext = {
    canvasSize,
    faceBounds: estimatedFaceBounds
  };

  // 左目の特徴点を個別に制御
  if (faceParams.leftEye.size !== 1.0 || faceParams.leftEye.positionX !== 0 || faceParams.leftEye.positionY !== 0) {
    const eyePoints = landmarks.leftEye.map(scalePoint);
    const center = calculateCenter(eyePoints);
    
    // 左目の境界を計算
    const eyeBounds = {
      width: Math.max(...eyePoints.map(p => p.x)) - Math.min(...eyePoints.map(p => p.x)),
      height: Math.max(...eyePoints.map(p => p.y)) - Math.min(...eyePoints.map(p => p.y))
    };
    
    // 適応型影響半径を計算
    const influenceRadius = calculateAdaptiveInfluenceRadius(
      'eye',
      eyeBounds,
      faceParams.leftEye,
      imageContext
    );
    
    eyePoints.forEach(originalPoint => {
      // 中心からの相対位置
      const relative = {
        x: originalPoint.x - center.x,
        y: originalPoint.y - center.y
      };
      
      // 個別特徴点の変形
      const targetPoint = {
        x: center.x + relative.x * faceParams.leftEye.size + faceParams.leftEye.positionX * 0.5,
        y: center.y + relative.y * faceParams.leftEye.size + faceParams.leftEye.positionY * 0.5
      };
      
      controlPoints.push({ 
        original: originalPoint, 
        target: targetPoint,
        weight: 1.0, // 目の特徴点は重要度高
        partType: 'eye',
        influenceRadius
      });
    });
  }

  // 右目の特徴点を個別に制御
  if (faceParams.rightEye.size !== 1.0 || faceParams.rightEye.positionX !== 0 || faceParams.rightEye.positionY !== 0) {
    const eyePoints = landmarks.rightEye.map(scalePoint);
    const center = calculateCenter(eyePoints);
    
    // 右目の境界を計算
    const eyeBounds = {
      width: Math.max(...eyePoints.map(p => p.x)) - Math.min(...eyePoints.map(p => p.x)),
      height: Math.max(...eyePoints.map(p => p.y)) - Math.min(...eyePoints.map(p => p.y))
    };
    
    // 適応型影響半径を計算
    const influenceRadius = calculateAdaptiveInfluenceRadius(
      'eye',
      eyeBounds,
      faceParams.rightEye,
      imageContext
    );
    
    eyePoints.forEach(originalPoint => {
      const relative = {
        x: originalPoint.x - center.x,
        y: originalPoint.y - center.y
      };
      
      const targetPoint = {
        x: center.x + relative.x * faceParams.rightEye.size + faceParams.rightEye.positionX * 0.5,
        y: center.y + relative.y * faceParams.rightEye.size + faceParams.rightEye.positionY * 0.5
      };
      
      controlPoints.push({ 
        original: originalPoint, 
        target: targetPoint,
        weight: 1.0,
        partType: 'eye',
        influenceRadius
      });
    });
  }

  // 口の特徴点を個別に制御
  if (faceParams.mouth.width !== 1.0 || faceParams.mouth.height !== 1.0 || 
      faceParams.mouth.positionX !== 0 || faceParams.mouth.positionY !== 0) {
    const mouthPoints = landmarks.mouth.map(scalePoint);
    const center = calculateCenter(mouthPoints);
    
    // 口の境界を計算
    const mouthBounds = {
      width: Math.max(...mouthPoints.map(p => p.x)) - Math.min(...mouthPoints.map(p => p.x)),
      height: Math.max(...mouthPoints.map(p => p.y)) - Math.min(...mouthPoints.map(p => p.y))
    };
    
    // 適応型影響半径を計算
    const influenceRadius = calculateAdaptiveInfluenceRadius(
      'mouth',
      mouthBounds,
      faceParams.mouth,
      imageContext
    );
    
    mouthPoints.forEach(originalPoint => {
      const relative = {
        x: originalPoint.x - center.x,
        y: originalPoint.y - center.y
      };
      
      const targetPoint = {
        x: center.x + relative.x * faceParams.mouth.width + faceParams.mouth.positionX * 0.3,
        y: center.y + relative.y * faceParams.mouth.height + faceParams.mouth.positionY * 0.3
      };
      
      controlPoints.push({ 
        original: originalPoint, 
        target: targetPoint,
        weight: 0.8, // 口は少し重要度を下げる
        partType: 'mouth',
        influenceRadius
      });
    });
  }

  // 鼻の特徴点を個別に制御
  if (faceParams.nose.width !== 1.0 || faceParams.nose.height !== 1.0 || 
      faceParams.nose.positionX !== 0 || faceParams.nose.positionY !== 0) {
    const nosePoints = landmarks.nose.map(scalePoint);
    const center = calculateCenter(nosePoints);
    
    // 鼻の境界を計算
    const noseBounds = {
      width: Math.max(...nosePoints.map(p => p.x)) - Math.min(...nosePoints.map(p => p.x)),
      height: Math.max(...nosePoints.map(p => p.y)) - Math.min(...nosePoints.map(p => p.y))
    };
    
    // 適応型影響半径を計算
    const influenceRadius = calculateAdaptiveInfluenceRadius(
      'nose',
      noseBounds,
      faceParams.nose,
      imageContext
    );
    
    nosePoints.forEach(originalPoint => {
      const relative = {
        x: originalPoint.x - center.x,
        y: originalPoint.y - center.y
      };
      
      const targetPoint = {
        x: center.x + relative.x * faceParams.nose.width + faceParams.nose.positionX * 0.4,
        y: center.y + relative.y * faceParams.nose.height + faceParams.nose.positionY * 0.4
      };
      
      controlPoints.push({ 
        original: originalPoint, 
        target: targetPoint,
        weight: 0.9,
        partType: 'nose',
        influenceRadius
      });
    });
  }

  // 輪郭の制御点を生成（contourパラメータが変更されている場合）
  if (faceParams.contour && 
      (faceParams.contour.faceShape !== 0 || 
       faceParams.contour.jawWidth !== 1.0 || 
       faceParams.contour.cheekFullness !== 1.0 || 
       faceParams.contour.chinHeight !== 1.0)) {
    
    const contourPoints = generateContourControlPoints(landmarks, faceParams.contour);
    
    // jawlineの各点に対して制御点を追加
    for (let i = 0; i < contourPoints.original.length; i++) {
      controlPoints.push({
        original: scalePoint(contourPoints.original[i]),
        target: scalePoint(contourPoints.target[i]),
        weight: 1.0,
        partType: 'mouth', // 既存のpartTypeを使用（contourは未定義なので）
        influenceRadius: 80
      });
    }
    
    console.log(`🔷 輪郭制御点追加: ${contourPoints.original.length}個`);
  }

  // 安定化のために周辺固定点を追加（実際のCanvasサイズを渡す）
  // 注意: この関数はapplyTPSWarpingから呼ばれる際にcanvasサイズが分からないため、
  // 呼び出し元で適切なサイズを渡すべき

  console.log(`🎯 TPS制御点生成完了: ${controlPoints.length}個の制御点`);
  return controlPoints;
}

/**
 * 中心点を計算
 */
function calculateCenter(points: Point[]): Point {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

/**
 * パーツ別係数定義
 */
const PART_MULTIPLIERS = {
  eye: 1.2,    // 目は控えめ（首への影響防止）
  mouth: 1.4,  // 口は少し広め
  nose: 0.6    // 鼻は最小限（他パーツへの影響防止）
} as const;

/**
 * 変形量を計算
 */
function calculateTransformMagnitude(params: EyeParams | MouthParams | NoseParams): number {
  if ('size' in params) {
    // 目のパラメータ
    return Math.sqrt(
      Math.pow(params.size - 1, 2) +
      Math.pow(params.positionX / 20, 2) +
      Math.pow(params.positionY / 20, 2)
    );
  } else if ('width' in params && 'height' in params) {
    // 口・鼻のパラメータ
    return Math.sqrt(
      Math.pow(params.width - 1, 2) +
      Math.pow(params.height - 1, 2) +
      Math.pow(params.positionX / 30, 2) +
      Math.pow(params.positionY / 30, 2)
    );
  }
  return 0;
}

/**
 * 適応型影響半径を計算
 */
function calculateAdaptiveInfluenceRadius(
  partType: 'eye' | 'mouth' | 'nose',
  partBounds: { width: number; height: number },
  transformParams: EyeParams | MouthParams | NoseParams,
  imageContext: {
    canvasSize: { width: number; height: number };
    faceBounds: { width: number; height: number };
  }
): number {
  // 1. パーツサイズ係数
  const partArea = partBounds.width * partBounds.height;
  const partSizeFactor = Math.sqrt(partArea);
  
  // 2. 顔全体サイズ係数
  const faceArea = imageContext.faceBounds.width * imageContext.faceBounds.height;
  const faceSizeFactor = Math.sqrt(faceArea) * 0.1;
  
  // 3. 変形量係数
  const transformFactor = calculateTransformMagnitude(transformParams);
  
  // 4. 画像解像度係数
  const resolutionFactor = Math.min(
    imageContext.canvasSize.width,
    imageContext.canvasSize.height
  ) * 0.08;
  
  // 複合計算（平均）
  const candidates = [
    partSizeFactor * PART_MULTIPLIERS[partType],
    faceSizeFactor,
    resolutionFactor
  ];
  
  const baseRadius = candidates.reduce((a, b) => a + b) / 3;
  
  // 変形量に応じた調整（最大1.3倍）
  const adjustedRadius = baseRadius * (1 + transformFactor * 0.2);
  
  // 階層的制限
  const imageConstrained = Math.min(
    adjustedRadius,
    Math.min(imageContext.canvasSize.width, imageContext.canvasSize.height) * 0.15
  );
  
  // 最終制限（最小20px、最大100px）
  let finalRadius = Math.max(20, Math.min(imageConstrained, 100));
  
  // 鼻の場合は特別に制限
  if (partType === 'nose') {
    finalRadius = Math.min(finalRadius, 40); // 鼻は最大40px
    
    // 鼻の変形量が大きい場合はさらに影響範囲を縮小
    if (transformFactor > 0.3) {
      const reductionFactor = Math.max(0.5, 1 - (transformFactor - 0.3));
      finalRadius *= reductionFactor;
    }
  }
  
  console.log(`📏 ${partType}影響半径: ${finalRadius.toFixed(1)}px (変形量: ${transformFactor.toFixed(2)})`);
  
  return finalRadius;
}

/**
 * TPS変形を画像に適用
 */
export function applyTPSWarping(
  sourceImageElement: HTMLImageElement,
  landmarks: FaceLandmarks,
  faceParams: FaceParams,
  canvasWidth: number,
  canvasHeight: number
): HTMLCanvasElement {
  console.log('🧮 TPS変形開始:', { canvasWidth, canvasHeight });
  
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
  
  const controlPoints = generateTPSControlPoints(landmarks, faceParams, imageScale, { width: canvasWidth, height: canvasHeight });
  
  if (controlPoints.length === 0) {
    // 制御点がない場合は元画像をそのまま返す
    targetCtx.drawImage(sourceCanvas, 0, 0);
    return targetCanvas;
  }
  
  // TPS変形パラメータを計算（現在未使用）
  // const tpsOptions: TPSTransformOptions = {
  //   regularization: 0.1,
  //   localRigidity: 0.8
  // };
  
  // const tpsParams = calculateTPSParams(controlPoints, tpsOptions);
  
  console.log('🔄 TPS変形適用中...');
  
  // 各ピクセルに対して改良されたTPS変形を適用（後方変換）
  for (let y = 0; y < canvasHeight; y++) {
    for (let x = 0; x < canvasWidth; x++) {
      // 改良された重み付き平均による変形計算
      let sourceX = x;
      let sourceY = y;
      
      if (controlPoints.length > 0) {
        let totalWeight = 0;
        let weightedOffsetX = 0;
        let weightedOffsetY = 0;
        
        for (const cp of controlPoints) {
          const dx = x - cp.target.x;
          const dy = y - cp.target.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // 制御点の個別影響半径を使用（デフォルト値として180を使用）
          const maxInfluence = cp.influenceRadius || 180;
          
          if (distance < maxInfluence) {
            // グラデーション境界処理（鼻は特別扱い）
            const isNose = cp.partType === 'nose';
            const coreZone = maxInfluence * (isNose ? 0.6 : 0.8); // 鼻は60%、他は80%
            const gradientZone = maxInfluence * (isNose ? 0.4 : 0.2); // 鼻は40%、他は20%
            
            let baseWeight: number;
            if (distance <= coreZone) {
              // コア領域：フル効果
              baseWeight = distance > 0 ? 1 / (distance + 1) : 1000;
            } else {
              // グラデーション領域：線形減衰
              const fadeRatio = (maxInfluence - distance) / gradientZone;
              baseWeight = fadeRatio * (distance > 0 ? 1 / (distance + 1) : 1000);
            }
            
            const effectiveWeight = baseWeight * (cp.weight || 1.0);
            
            // 後方変換: target -> original の逆方向オフセット
            const offset = {
              x: cp.original.x - cp.target.x,
              y: cp.original.y - cp.target.y
            };
            
            weightedOffsetX += offset.x * effectiveWeight;
            weightedOffsetY += offset.y * effectiveWeight;
            totalWeight += effectiveWeight;
          }
        }
        
        // 重み付き平均の適用
        if (totalWeight > 0) {
          const normalizedOffsetX = weightedOffsetX / totalWeight;
          const normalizedOffsetY = weightedOffsetY / totalWeight;
          
          // 変形の強度を制限（拡張範囲に対応）
          const maxOffset = Math.min(canvasWidth, canvasHeight) * 0.30;
          const offsetMagnitude = Math.sqrt(normalizedOffsetX * normalizedOffsetX + normalizedOffsetY * normalizedOffsetY);
          
          if (offsetMagnitude > maxOffset) {
            const scale = maxOffset / offsetMagnitude;
            sourceX += normalizedOffsetX * scale;
            sourceY += normalizedOffsetY * scale;
          } else {
            sourceX += normalizedOffsetX;
            sourceY += normalizedOffsetY;
          }
        }
      }
      
      // バイリニア補間でピクセル値を取得
      const [r, g, b, a] = bilinearInterpolation(sourceImageData, sourceX, sourceY);
      
      // 結果画像に設定
      const idx = (y * canvasWidth + x) * 4;
      targetImageData.data[idx] = r;
      targetImageData.data[idx + 1] = g;
      targetImageData.data[idx + 2] = b;
      targetImageData.data[idx + 3] = a;
    }
    
    // プログレス表示（20行ごと）
    if (y % 20 === 0) {
      console.log(`🔄 TPS変形進捗: ${Math.round((y / canvasHeight) * 100)}%`);
    }
  }
  
  // 結果を描画
  targetCtx.putImageData(targetImageData, 0, 0);
  
  console.log('✅ TPS変形完了');
  return targetCanvas;
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

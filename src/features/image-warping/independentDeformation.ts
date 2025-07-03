import type { Point, FaceParams, FaceLandmarks, EyeParams, MouthParams, NoseParams } from '../../types/face';
import type { TPSControlPoint } from './tpsWarping';
import { segmentFaceParts, type PartSegmentationResult, type PartRegion } from './partSegmentation';

/**
 * パーツ独立変形システム
 * 
 * 各顔パーツが他のパーツに影響を与えない独立した変形を実現
 * 例：鼻を下げても口の位置は変わらず、結果的に鼻と口の距離が変化
 */

export interface IndependentControlPoint extends TPSControlPoint {
  partId: string;
  region: PartRegion;
  isolationLevel: 'complete' | 'partial' | 'minimal';
  barrierStrength: number; // 他パーツへの影響防止強度
}

export interface IndependentDeformationResult {
  controlPoints: IndependentControlPoint[];
  segmentation: PartSegmentationResult;
  deformationMap: DeformationMap;
}

export interface DeformationMap {
  width: number;
  height: number;
  data: Float32Array; // [sourceX, sourceY] pairs for each pixel
}

/**
 * パーツ独立変形を生成
 */
export function generateIndependentDeformation(
  landmarks: FaceLandmarks,
  faceParams: FaceParams,
  imageScale: { x: number; y: number },
  canvasSize: { width: number; height: number }
): IndependentDeformationResult {
  console.log('🔧 パーツ独立変形システム開始');
  
  // 🔍 仮説2検証: パラメータ詳細確認
  console.log('🔍 [仮説2検証] generateIndependentDeformation受信パラメータ:', {
    faceParams,
    imageScale,
    canvasSize
  });

  // 1. パーツ領域をセグメンテーション
  const segmentation = segmentFaceParts(landmarks, imageScale, canvasSize);

  // 2. パーツごとの独立制御点を生成
  const controlPoints = generateIndependentControlPoints(
    landmarks,
    faceParams,
    imageScale,
    segmentation
  );

  // 3. 独立変形マップを生成
  const deformationMap = generateIndependentDeformationMap(
    controlPoints,
    segmentation,
    canvasSize
  );

  console.log(`✅ パーツ独立変形完了: ${controlPoints.length}制御点`);

  return {
    controlPoints,
    segmentation,
    deformationMap
  };
}

/**
 * パーツごとの独立制御点を生成
 */
function generateIndependentControlPoints(
  landmarks: FaceLandmarks,
  faceParams: FaceParams,
  imageScale: { x: number; y: number },
  segmentation: PartSegmentationResult
): IndependentControlPoint[] {
  const controlPoints: IndependentControlPoint[] = [];
  
  const scalePoint = (p: Point): Point => ({
    x: p.x * imageScale.x,
    y: p.y * imageScale.y
  });

  // 左目の独立制御点
  const leftEyeShouldCreate = shouldCreateControlPoints(faceParams.leftEye);
  console.log('🔍 [仮説2検証] 左目制御点生成判定:', {
    leftEyeParams: faceParams.leftEye,
    shouldCreate: leftEyeShouldCreate,
    size: faceParams.leftEye.size,
    positionX: faceParams.leftEye.positionX,
    positionY: faceParams.leftEye.positionY
  });
  
  if (leftEyeShouldCreate) {
    const region = segmentation.regions.get('leftEye')!;
    const eyePoints = landmarks.leftEye.map(scalePoint);
    const center = calculateCenter(eyePoints);
    
    // 目の輪郭制御点
    eyePoints.forEach(originalPoint => {
      const relative = {
        x: originalPoint.x - center.x,
        y: originalPoint.y - center.y
      };
      
      const targetPoint = {
        x: center.x + relative.x * faceParams.leftEye.size + faceParams.leftEye.positionX * 0.5,
        y: center.y + relative.y * faceParams.leftEye.size + faceParams.leftEye.positionY * 0.5
      };
      
      controlPoints.push({
        original: originalPoint,
        target: targetPoint,
        weight: 1.0,
        partType: 'eye',
        influenceRadius: region.influenceRadius,
        partId: 'leftEye',
        region,
        isolationLevel: 'complete',
        barrierStrength: 0.9
      });
    });

    // 瞳孔中心制御点を追加（完全固定）
    const eyeCenterTarget = {
      x: center.x, // 中心は移動しない（位置変更無効）
      y: center.y  // 中心は移動しない（位置変更無効）
    };
    
    controlPoints.push({
      original: center,
      target: eyeCenterTarget,
      weight: 2.0, // 最高重みで完全固定
      partType: 'eye',
      influenceRadius: 20, // 瞳孔中心領域
      partId: 'leftEye',
      region,
      isolationLevel: 'complete',
      barrierStrength: 1.0
    });

    // 虹彩境界制御点を追加（正円形状維持）
    const irisRadius = calculateIrisRadius(eyePoints);
    const irisControlPoints = generateCircularControlPoints(center, irisRadius, 8); // 8方向

    irisControlPoints.forEach(irisPoint => {
      const scaledIrisPoint = scalePointFromCenter(irisPoint, center, faceParams.leftEye.size);
      
      controlPoints.push({
        original: irisPoint,
        target: scaledIrisPoint,
        weight: 1.2, // 虹彩形状維持のための高重み
        partType: 'eye',
        influenceRadius: 15, // 虹彩境界周辺のみ
        partId: 'leftEye',
        region,
        isolationLevel: 'complete',
        barrierStrength: 0.8
      });
    });
    
    console.log('🔍 [仮説2検証] 左目制御点生成完了:', {
      generatedPoints: eyePoints.length,
      region: {
        partType: region.partType,
        center: region.center,
        influenceRadius: region.influenceRadius
      }
    });
  }

  // 右目の独立制御点
  if (shouldCreateControlPoints(faceParams.rightEye)) {
    const region = segmentation.regions.get('rightEye')!;
    const eyePoints = landmarks.rightEye.map(scalePoint);
    const center = calculateCenter(eyePoints);
    
    // 目の輪郭制御点
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
        influenceRadius: region.influenceRadius,
        partId: 'rightEye',
        region,
        isolationLevel: 'complete',
        barrierStrength: 0.9
      });
    });

    // 瞳孔中心制御点を追加（完全固定）
    const eyeCenterTarget = {
      x: center.x, // 中心は移動しない（位置変更無効）
      y: center.y  // 中心は移動しない（位置変更無効）
    };
    
    controlPoints.push({
      original: center,
      target: eyeCenterTarget,
      weight: 2.0, // 最高重みで完全固定
      partType: 'eye',
      influenceRadius: 20, // 瞳孔中心領域
      partId: 'rightEye',
      region,
      isolationLevel: 'complete',
      barrierStrength: 1.0
    });

    // 虹彩境界制御点を追加（正円形状維持）
    const irisRadius = calculateIrisRadius(eyePoints);
    const irisControlPoints = generateCircularControlPoints(center, irisRadius, 8); // 8方向

    irisControlPoints.forEach(irisPoint => {
      const scaledIrisPoint = scalePointFromCenter(irisPoint, center, faceParams.rightEye.size);
      
      controlPoints.push({
        original: irisPoint,
        target: scaledIrisPoint,
        weight: 1.2, // 虹彩形状維持のための高重み
        partType: 'eye',
        influenceRadius: 15, // 虹彩境界周辺のみ
        partId: 'rightEye',
        region,
        isolationLevel: 'complete',
        barrierStrength: 0.8
      });
    });
  }

  // 口の独立制御点
  if (shouldCreateControlPoints(faceParams.mouth)) {
    const region = segmentation.regions.get('mouth')!;
    const mouthPoints = landmarks.mouth.map(scalePoint);
    const center = calculateCenter(mouthPoints);
    
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
        weight: 0.8,
        partType: 'mouth',
        influenceRadius: region.influenceRadius,
        partId: 'mouth',
        region,
        isolationLevel: 'complete',
        barrierStrength: 0.8
      });
    });
  }

  // 鼻の独立制御点（最も厳密な分離）
  if (shouldCreateControlPoints(faceParams.nose)) {
    const region = segmentation.regions.get('nose')!;
    const nosePoints = landmarks.nose.map(scalePoint);
    const center = calculateCenter(nosePoints);
    
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
        influenceRadius: region.influenceRadius,
        partId: 'nose',
        region,
        isolationLevel: 'complete',
        barrierStrength: 1.0 // 最強の分離
      });
    });
  }

  console.log('🔍 [仮説2検証] 制御点生成最終結果:', {
    totalControlPoints: controlPoints.length,
    partBreakdown: {
      leftEye: controlPoints.filter(cp => cp.partId === 'leftEye').length,
      rightEye: controlPoints.filter(cp => cp.partId === 'rightEye').length,
      mouth: controlPoints.filter(cp => cp.partId === 'mouth').length,
      nose: controlPoints.filter(cp => cp.partId === 'nose').length
    }
  });
  
  return controlPoints;
}

/**
 * 制御点が必要かどうかを判定
 */
function shouldCreateControlPoints(params: EyeParams | MouthParams | NoseParams): boolean {
  if ('size' in params) {
    // 目のパラメータ
    return params.size !== 1.0 || params.positionX !== 0 || params.positionY !== 0;
  } else {
    // 口・鼻のパラメータ
    return params.width !== 1.0 || params.height !== 1.0 || 
           params.positionX !== 0 || params.positionY !== 0;
  }
}

/**
 * 中心点を計算
 */
function calculateCenter(points: Point[]): Point {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

/**
 * 虹彩半径を計算（目の幅の約35%）
 */
function calculateIrisRadius(eyeLandmarks: Point[]): number {
  const eyeWidth = Math.max(...eyeLandmarks.map(p => p.x)) - Math.min(...eyeLandmarks.map(p => p.x));
  return eyeWidth * 0.35; // 典型的な虹彩比率
}

/**
 * 円形制御点を生成（虹彩境界用）
 */
function generateCircularControlPoints(center: Point, radius: number, count: number): Point[] {
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
 * 中心からのスケール変換
 */
function scalePointFromCenter(point: Point, center: Point, scale: number): Point {
  return {
    x: center.x + (point.x - center.x) * scale,
    y: center.y + (point.y - center.y) * scale
  };
}

/**
 * 独立変形マップを生成
 */
function generateIndependentDeformationMap(
  controlPoints: IndependentControlPoint[],
  segmentation: PartSegmentationResult,
  canvasSize: { width: number; height: number }
): DeformationMap {
  console.log('🗺️ 独立変形マップ生成開始');

  const data = new Float32Array(canvasSize.width * canvasSize.height * 2);
  let processedPixels = 0;

  for (let y = 0; y < canvasSize.height; y++) {
    for (let x = 0; x < canvasSize.width; x++) {
      const pixelIndex = (y * canvasSize.width + x) * 2;
      const pixel = { x, y };
      
      // デフォルトは元の位置
      let sourceX = x;
      let sourceY = y;
      
      // 各パーツからの独立変形を計算
      const partInfluences = calculatePartInfluences(pixel, controlPoints, segmentation);
      
      if (partInfluences.length > 0) {
        // 最も影響力の強いパーツの変形を適用
        const dominantInfluence = partInfluences.reduce((prev, current) => 
          current.strength > prev.strength ? current : prev
        );
        
        sourceX += dominantInfluence.offsetX;
        sourceY += dominantInfluence.offsetY;
      }
      
      data[pixelIndex] = sourceX;
      data[pixelIndex + 1] = sourceY;
      processedPixels++;
    }
    
    // プログレス表示
    if (y % 50 === 0) {
      console.log(`🔄 変形マップ生成進捗: ${Math.round((y / canvasSize.height) * 100)}%`);
    }
  }

  console.log(`✅ 変形マップ生成完了: ${processedPixels}ピクセル処理`);
  
  // 🔍 仮説4検証: 変形マップの内容確認（サンプリング）
  const sampleIndices = [0, 1000, 5000, Math.floor(data.length/2)];
  const samples = sampleIndices.map(i => ({
    index: i,
    sourceX: data[i],
    sourceY: data[i + 1],
    changed: data[i] !== (i/2) % canvasSize.width || data[i + 1] !== Math.floor((i/2) / canvasSize.width)
  }));
  
  console.log('🔍 [仮説4検証] 変形マップサンプル:', {
    totalDataPoints: data.length,
    expectedDataPoints: canvasSize.width * canvasSize.height * 2,
    samples
  });

  return {
    width: canvasSize.width,
    height: canvasSize.height,
    data
  };
}

/**
 * 各パーツからの影響を計算（独立性を保持）
 */
function calculatePartInfluences(
  pixel: Point,
  controlPoints: IndependentControlPoint[],
  segmentation: PartSegmentationResult
): Array<{
  partId: string;
  strength: number;
  offsetX: number;
  offsetY: number;
}> {
  const influences: Array<{
    partId: string;
    strength: number;
    offsetX: number;
    offsetY: number;
  }> = [];

  // パーツごとにグループ化
  const partGroups = new Map<string, IndependentControlPoint[]>();
  for (const cp of controlPoints) {
    if (!partGroups.has(cp.partId)) {
      partGroups.set(cp.partId, []);
    }
    partGroups.get(cp.partId)!.push(cp);
  }

  // 各パーツの影響を独立して計算
  for (const [partId, partControlPoints] of partGroups) {
    const region = partControlPoints[0]?.region;
    if (!region) continue;

    // このピクセルがパーツの影響範囲内かチェック
    const distanceToCenter = Math.sqrt(
      Math.pow(pixel.x - region.center.x, 2) +
      Math.pow(pixel.y - region.center.y, 2)
    );

    if (distanceToCenter < region.influenceRadius) {
      // バリア効果を考慮
      // @ts-ignore - デバッグ用に保持
      const barrierEffect = calculatePixelBarrierEffect(pixel, region, segmentation.barriers);
      
      if (barrierEffect > 0.1) { // 最小閾値
        // パーツ内での変形を計算
        const { offsetX, offsetY, strength } = calculatePartDeformation(
          pixel,
          partControlPoints,
          region,
          barrierEffect
        );

        if (strength > 0.01) { // 最小影響閾値
          influences.push({
            partId,
            strength: strength * barrierEffect,
            offsetX,
            offsetY
          });
        }
      }
    }
  }

  return influences;
}

/**
 * パーツ内での変形を計算
 */
function calculatePartDeformation(
  pixel: Point,
  partControlPoints: IndependentControlPoint[],
  region: PartRegion,
  // @ts-ignore - 将来のバリア効果で使用予定
  barrierEffect: number
): { offsetX: number; offsetY: number; strength: number } {
  let totalWeight = 0;
  let weightedOffsetX = 0;
  let weightedOffsetY = 0;

  for (const cp of partControlPoints) {
    const dx = pixel.x - cp.target.x;
    const dy = pixel.y - cp.target.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < cp.influenceRadius!) {
      // 距離ベースの重み計算
      const weight = distance > 0 ? 1 / (distance + 1) : 1000;
      const effectiveWeight = weight * (cp.weight || 1.0);

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

  if (totalWeight > 0) {
    const normalizedOffsetX = weightedOffsetX / totalWeight;
    const normalizedOffsetY = weightedOffsetY / totalWeight;
    
    // 変形の強度制限
    const maxOffset = region.influenceRadius * 0.5;
    const offsetMagnitude = Math.sqrt(normalizedOffsetX * normalizedOffsetX + normalizedOffsetY * normalizedOffsetY);
    
    if (offsetMagnitude > maxOffset) {
      const scale = maxOffset / offsetMagnitude;
      return {
        offsetX: normalizedOffsetX * scale,
        offsetY: normalizedOffsetY * scale,
        strength: 1.0
      };
    } else {
      return {
        offsetX: normalizedOffsetX,
        offsetY: normalizedOffsetY,
        strength: 1.0
      };
    }
  }

  return { offsetX: 0, offsetY: 0, strength: 0 };
}

/**
 * ピクセルのバリア効果を計算
 */
function calculatePixelBarrierEffect(
  pixel: Point,
  region: PartRegion,
  barriers: any[]
): number {
  let effect = 1.0;

  for (const barrier of barriers) {
    if (barrier.affectedParts.includes(region.partType)) {
      // バリアラインとの距離を計算
      const distanceToBarrier = calculateDistanceToBarrierLine(pixel, barrier.barrierPoints);
      const barrierRadius = 30; // バリアの影響半径

      if (distanceToBarrier < barrierRadius) {
        const reduction = (1 - distanceToBarrier / barrierRadius) * barrier.strength;
        effect *= (1 - reduction);
      }
    }
  }

  return Math.max(0, effect);
}

/**
 * 点とバリアラインの距離を計算
 */
function calculateDistanceToBarrierLine(point: Point, linePoints: Point[]): number {
  if (linePoints.length < 2) return Infinity;

  let minDistance = Infinity;
  
  for (let i = 0; i < linePoints.length - 1; i++) {
    const p1 = linePoints[i];
    const p2 = linePoints[i + 1];
    
    const A = point.x - p1.x;
    const B = point.y - p1.y;
    const C = p2.x - p1.x;
    const D = p2.y - p1.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    
    if (lenSq === 0) {
      minDistance = Math.min(minDistance, Math.sqrt(A * A + B * B));
      continue;
    }

    let param = dot / lenSq;
    param = Math.max(0, Math.min(1, param));

    const xx = p1.x + param * C;
    const yy = p1.y + param * D;

    const dx = point.x - xx;
    const dy = point.y - yy;
    
    minDistance = Math.min(minDistance, Math.sqrt(dx * dx + dy * dy));
  }

  return minDistance;
}

/**
 * 独立変形マップを使用してCanvas変形を適用
 */
export function applyIndependentDeformation(
  sourceCanvas: HTMLCanvasElement,
  deformationMap: DeformationMap
): HTMLCanvasElement {
  console.log('🎨 独立変形適用開始');
  
  // 🔍 仮説5検証: 画像適用の入力確認
  console.log('🔍 [仮説5検証] 画像適用開始:', {
    sourceCanvasSize: { width: sourceCanvas.width, height: sourceCanvas.height },
    deformationMapSize: { width: deformationMap.width, height: deformationMap.height },
    dataLength: deformationMap.data.length
  });
  
  const targetCanvas = document.createElement('canvas');
  targetCanvas.width = sourceCanvas.width;
  targetCanvas.height = sourceCanvas.height;
  
  const sourceCtx = sourceCanvas.getContext('2d')!;
  const targetCtx = targetCanvas.getContext('2d')!;
  
  const sourceImageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const targetImageData = targetCtx.createImageData(sourceCanvas.width, sourceCanvas.height);
  
  for (let y = 0; y < deformationMap.height; y++) {
    for (let x = 0; x < deformationMap.width; x++) {
      const mapIndex = (y * deformationMap.width + x) * 2;
      const sourceX = deformationMap.data[mapIndex];
      const sourceY = deformationMap.data[mapIndex + 1];
      
      // バイリニア補間でピクセル値を取得
      const [r, g, b, a] = bilinearInterpolation(sourceImageData, sourceX, sourceY);
      
      // 結果画像に設定
      const targetIndex = (y * deformationMap.width + x) * 4;
      targetImageData.data[targetIndex] = r;
      targetImageData.data[targetIndex + 1] = g;
      targetImageData.data[targetIndex + 2] = b;
      targetImageData.data[targetIndex + 3] = a;
    }
  }
  
  targetCtx.putImageData(targetImageData, 0, 0);
  
  // 🔍 仮説5検証: 画像適用結果の確認
  const resultImageData = targetCtx.getImageData(0, 0, targetCanvas.width, targetCanvas.height);
  const changedPixels = [];
  for (let i = 0; i < Math.min(1000, resultImageData.data.length); i += 4) {
    if (resultImageData.data[i] !== 0 || resultImageData.data[i+1] !== 0 || 
        resultImageData.data[i+2] !== 0 || resultImageData.data[i+3] !== 0) {
      changedPixels.push(i/4);
      if (changedPixels.length >= 5) break; // 最初の5個のみ
    }
  }
  
  console.log('🔍 [仮説5検証] 画像適用結果:', {
    hasNonZeroPixels: changedPixels.length > 0,
    firstNonZeroPixels: changedPixels,
    targetCanvasSize: { width: targetCanvas.width, height: targetCanvas.height }
  });
  
  console.log('✅ 独立変形適用完了');
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
import type { Point, FaceParams, FaceLandmarks, EyeParams, MouthParams, NoseParams } from '../../types/face';
import type { TPSControlPoint } from './tpsWarping';
import { segmentFaceParts, type PartBarrier, type PartSegmentationResult, type PartRegion } from './partSegmentation';

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
  movementMask?: MovementMask;
}

export interface MovementMask {
  width: number;
  height: number;
  data: Float32Array; // 0-1 values indicating movement intensity
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
  console.log('🔧 [Version 5.1.7] パーツ独立変形システム開始');
  
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

  // 4. 移動マスクを生成（Version 5.1.5）
  const movementMask = generateMovementMask(
    controlPoints,
    canvasSize
  );

  console.log(`✅ パーツ独立変形完了: ${controlPoints.length}制御点`);

  return {
    controlPoints,
    segmentation,
    deformationMap,
    movementMask
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

  // 特徴点データ検証（Version 5.1.4）
  console.log('🔍 [Version 5.1.4] 特徴点データ検証:', {
    leftEyePoints: landmarks.leftEye.length,
    rightEyePoints: landmarks.rightEye.length,
    mouthPoints: landmarks.mouth.length,
    nosePoints: landmarks.nose.length,
    imageScale,
    faceParams
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
    // 目の影響半径も適切に制限
    region.influenceRadius = Math.min(region.influenceRadius, 40);
    const eyePoints = landmarks.leftEye.map(scalePoint);
    const center = calculateCenter(eyePoints);
    
    // 目の輪郭制御点（移動二重適用を修正）
    const leftEyeNewCenter = {
      x: center.x + faceParams.leftEye.positionX * 1.0,
      y: center.y + faceParams.leftEye.positionY * 1.0
    };
    
    eyePoints.forEach(originalPoint => {
      const relative = {
        x: originalPoint.x - center.x,
        y: originalPoint.y - center.y
      };
      
      const targetPoint = {
        x: leftEyeNewCenter.x + relative.x * faceParams.leftEye.size,
        y: leftEyeNewCenter.y + relative.y * faceParams.leftEye.size
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

    // 瞳孔中心制御点を追加（移動許可、形状保持）
    const eyeCenterTarget = {
      x: center.x + faceParams.leftEye.positionX * 1.0, // 移動許可
      y: center.y + faceParams.leftEye.positionY * 1.0  // 移動許可
    };
    
    controlPoints.push({
      original: center,
      target: eyeCenterTarget,
      weight: 1.5, // 形状保持のため適度に高い重み
      partType: 'eye',
      influenceRadius: 20, // 瞳孔中心領域
      partId: 'leftEye',
      region,
      isolationLevel: 'complete',
      barrierStrength: 1.0
    });

    // 虹彩境界制御点を追加（正円形状維持、移動対応）
    const irisRadius = calculateIrisRadius(eyePoints);
    const irisControlPoints = generateCircularControlPoints(center, irisRadius, 8); // 8方向

    irisControlPoints.forEach(irisPoint => {
      const scaledIrisPoint = scalePointFromCenter(irisPoint, leftEyeNewCenter, faceParams.leftEye.size);
      
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
      eyePointsCount: eyePoints.length,
      eyePointsSample: eyePoints.slice(0, 2).map(p => ({ x: Math.round(p.x), y: Math.round(p.y) })),
      controlPointsGenerated: {
        contour: eyePoints.length,
        pupilCenter: 1,
        irisPoints: irisControlPoints.length,
        total: eyePoints.length + 1 + irisControlPoints.length
      },
      region: {
        partType: region.partType,
        center: { x: Math.round(region.center.x), y: Math.round(region.center.y) },
        influenceRadius: region.influenceRadius
      }
    });
  }

  // 右目の独立制御点
  if (shouldCreateControlPoints(faceParams.rightEye)) {
    const region = segmentation.regions.get('rightEye')!;
    // 目の影響半径も適切に制限
    region.influenceRadius = Math.min(region.influenceRadius, 40);
    const eyePoints = landmarks.rightEye.map(scalePoint);
    const center = calculateCenter(eyePoints);
    
    // 目の輪郭制御点（移動二重適用を修正）
    const rightEyeNewCenter = {
      x: center.x + faceParams.rightEye.positionX * 1.0,
      y: center.y + faceParams.rightEye.positionY * 1.0
    };
    
    eyePoints.forEach(originalPoint => {
      const relative = {
        x: originalPoint.x - center.x,
        y: originalPoint.y - center.y
      };
      
      const targetPoint = {
        x: rightEyeNewCenter.x + relative.x * faceParams.rightEye.size,
        y: rightEyeNewCenter.y + relative.y * faceParams.rightEye.size
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

    // 瞳孔中心制御点を追加（移動許可、形状保持）
    const eyeCenterTarget = {
      x: center.x + faceParams.rightEye.positionX * 1.0, // 移動許可
      y: center.y + faceParams.rightEye.positionY * 1.0  // 移動許可
    };
    
    controlPoints.push({
      original: center,
      target: eyeCenterTarget,
      weight: 1.5, // 形状保持のため適度に高い重み
      partType: 'eye',
      influenceRadius: 20, // 瞳孔中心領域
      partId: 'rightEye',
      region,
      isolationLevel: 'complete',
      barrierStrength: 1.0
    });

    // 虹彩境界制御点を追加（正円形状維持、移動対応）
    const irisRadius = calculateIrisRadius(eyePoints);
    const irisControlPoints = generateCircularControlPoints(center, irisRadius, 8); // 8方向

    irisControlPoints.forEach(irisPoint => {
      const scaledIrisPoint = scalePointFromCenter(irisPoint, rightEyeNewCenter, faceParams.rightEye.size);
      
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
  const mouthShouldCreate = shouldCreateControlPoints(faceParams.mouth);
  console.log('🔍 [口移動デバッグ] 口制御点生成判定:', {
    mouthParams: faceParams.mouth,
    shouldCreate: mouthShouldCreate,
    width: faceParams.mouth.width,
    height: faceParams.mouth.height,
    positionX: faceParams.mouth.positionX,
    positionY: faceParams.mouth.positionY
  });
  
  if (mouthShouldCreate) {
    const region = segmentation.regions.get('mouth')!;
    // 影響半径を大幅に縮小してテスト
    region.influenceRadius = Math.min(region.influenceRadius, 30);
    const mouthPoints = landmarks.mouth.map(scalePoint);
    const center = calculateCenter(mouthPoints);
    
    // 口の制御点（移動二重適用を修正）
    const mouthNewCenter = {
      x: center.x + faceParams.mouth.positionX * 1.0,
      y: center.y + faceParams.mouth.positionY * 1.0
    };
    
    mouthPoints.forEach(originalPoint => {
      const relative = {
        x: originalPoint.x - center.x,
        y: originalPoint.y - center.y
      };
      
      const targetPoint = {
        x: mouthNewCenter.x + relative.x * faceParams.mouth.width,
        y: mouthNewCenter.y + relative.y * faceParams.mouth.height
      };
      
      controlPoints.push({
        original: originalPoint,
        target: targetPoint,
        weight: 1.0,
        partType: 'mouth',
        influenceRadius: region.influenceRadius,
        partId: 'mouth',
        region,
        isolationLevel: 'complete',
        barrierStrength: 0.8
      });
    });
    
    console.log('🔍 [口移動デバッグ] 口制御点生成完了:', {
      generatedPoints: mouthPoints.length,
      center: center,
      mouthNewCenter: mouthNewCenter,
      region: {
        partType: region.partType,
        center: region.center,
        influenceRadius: region.influenceRadius
      }
    });
  }

  // 鼻の独立制御点（最も厳密な分離）
  const noseShouldCreate = shouldCreateControlPoints(faceParams.nose);
  console.log('🔍 [鼻移動デバッグ] 鼻制御点生成判定:', {
    noseParams: faceParams.nose,
    shouldCreate: noseShouldCreate,
    width: faceParams.nose.width,
    height: faceParams.nose.height,
    positionX: faceParams.nose.positionX,
    positionY: faceParams.nose.positionY
  });
  
  if (noseShouldCreate) {
    const region = segmentation.regions.get('nose')!;
    // 影響半径を大幅に縮小してテスト
    region.influenceRadius = Math.min(region.influenceRadius, 25);
    const nosePoints = landmarks.nose.map(scalePoint);
    const center = calculateCenter(nosePoints);
    
    // 鼻の制御点（移動二重適用を修正）
    const noseNewCenter = {
      x: center.x + faceParams.nose.positionX * 1.0,
      y: center.y + faceParams.nose.positionY * 1.0
    };
    
    nosePoints.forEach(originalPoint => {
      const relative = {
        x: originalPoint.x - center.x,
        y: originalPoint.y - center.y
      };
      
      const targetPoint = {
        x: noseNewCenter.x + relative.x * faceParams.nose.width,
        y: noseNewCenter.y + relative.y * faceParams.nose.height
      };
      
      controlPoints.push({
        original: originalPoint,
        target: targetPoint,
        weight: 1.0,
        partType: 'nose',
        influenceRadius: region.influenceRadius,
        partId: 'nose',
        region,
        isolationLevel: 'complete',
        barrierStrength: 1.0 // 最強の分離
      });
    });
    
    console.log('🔍 [鼻移動デバッグ] 鼻制御点生成完了:', {
      generatedPoints: nosePoints.length,
      center: center,
      noseNewCenter: noseNewCenter,
      region: {
        partType: region.partType,
        center: region.center,
        influenceRadius: region.influenceRadius
      }
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
function shouldCreateControlPoints(
  params: EyeParams | MouthParams | NoseParams
): boolean {
  void params;
  // Version 5.1.4: 常に制御点を生成して基準状態を確立
  // これにより、変形なしでも正しい初期状態が保証される
  return true;
  
  // 以下は元のロジック（参考のため残す）
  // if ('size' in params) {
  //   // 目のパラメータ
  //   return params.size !== 1.0 || params.positionX !== 0 || params.positionY !== 0;
  // } else {
  //   // 口・鼻のパラメータ
  //   return params.width !== 1.0 || params.height !== 1.0 || 
  //          params.positionX !== 0 || params.positionY !== 0;
  // }
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
        // 全ての影響を重み付き平均でブレンド
        let totalWeight = 0;
        let weightedOffsetX = 0;
        let weightedOffsetY = 0;
        
        for (const influence of partInfluences) {
          weightedOffsetX += influence.offsetX * influence.strength;
          weightedOffsetY += influence.offsetY * influence.strength;
          totalWeight += influence.strength;
        }
        
        if (totalWeight > 0) {
          sourceX += weightedOffsetX / totalWeight;
          sourceY += weightedOffsetY / totalWeight;
        }
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
    
    // デバッグ: 複数のパーツの影響を受けているピクセルを検出
    if (distanceToCenter < region.influenceRadius && influences.length > 0 && Math.random() < 0.0001) {
      console.log('⚠️ [影響重複デバッグ] 複数パーツの影響を受けるピクセル:', {
        pixel: { x: Math.round(pixel.x), y: Math.round(pixel.y) },
        currentPart: partId,
        previousParts: influences.map(i => i.partId),
        distance: distanceToCenter.toFixed(2),
        radius: region.influenceRadius
      });
    }

    if (distanceToCenter < region.influenceRadius) {
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
  barrierEffect: number
): { offsetX: number; offsetY: number; strength: number } {
  void barrierEffect;
  let totalWeight = 0;
  let weightedOffsetX = 0;
  let weightedOffsetY = 0;

  for (const cp of partControlPoints) {
    const dx = pixel.x - cp.original.x;
    const dy = pixel.y - cp.original.y;
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
    
    // デバッグ: 大きな変形が発生している場合のみログ出力
    const offsetMagnitude = Math.sqrt(normalizedOffsetX * normalizedOffsetX + normalizedOffsetY * normalizedOffsetY);
    if (offsetMagnitude > 5 && Math.random() < 0.001) { // 0.1%の確率でサンプリング
      console.log('🔍 [変形デバッグ] 大きな変形検出:', {
        pixel: { x: Math.round(pixel.x), y: Math.round(pixel.y) },
        partType: region.partType,
        offsetMagnitude: offsetMagnitude.toFixed(2),
        offset: { x: normalizedOffsetX.toFixed(2), y: normalizedOffsetY.toFixed(2) }
      });
    }
    
    // 変形の強度制限
    const maxOffset = region.influenceRadius * 0.5;
    
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
  barriers: PartBarrier[]
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
 * 移動元領域のマスクを生成（Version 5.1.5）
 */
function generateMovementMask(
  controlPoints: IndependentControlPoint[],
  canvasSize: { width: number; height: number }
): MovementMask {
  console.log('🎭 [Version 5.1.7] フォワードマッピング付加版移動マスク生成開始');
  
  const data = new Float32Array(canvasSize.width * canvasSize.height);
  
  // パーツごとにグループ化して、より正確な移動元領域を特定
  const partGroups = new Map<string, IndependentControlPoint[]>();
  for (const cp of controlPoints) {
    if (!partGroups.has(cp.partId)) {
      partGroups.set(cp.partId, []);
    }
    partGroups.get(cp.partId)!.push(cp);
  }
  
  // 各パーツの移動元領域を特定
  for (const [, partCPs] of partGroups) {
    // パーツ全体の移動量を計算
    let totalMovementX = 0;
    let totalMovementY = 0;
    let movingPointCount = 0;
    
    for (const cp of partCPs) {
      const moveX = cp.target.x - cp.original.x;
      const moveY = cp.target.y - cp.original.y;
      const moveDist = Math.sqrt(moveX * moveX + moveY * moveY);
      
      if (moveDist > 1.0) { // より大きな閾値
        totalMovementX += moveX;
        totalMovementY += moveY;
        movingPointCount++;
      }
    }
    
    if (movingPointCount > 0) {
      const avgMoveX = totalMovementX / movingPointCount;
      const avgMoveY = totalMovementY / movingPointCount;
      const avgMoveDist = Math.sqrt(avgMoveX * avgMoveX + avgMoveY * avgMoveY);
      
      // 移動が検出された場合、元の位置周辺をマーク
      for (const cp of partCPs) {
        // 元の位置の周辺ピクセルを高強度でマーク
        const radius = cp.influenceRadius || 40;
        const centerX = Math.round(cp.original.x);
        const centerY = Math.round(cp.original.y);
        
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const px = centerX + dx;
            const py = centerY + dy;
            
            if (px >= 0 && px < canvasSize.width && py >= 0 && py < canvasSize.height) {
              const dist = Math.sqrt(dx * dx + dy * dy);
              
              if (dist <= radius) {
                const pixelIndex = py * canvasSize.width + px;
                // 距離に基づく強度（中心ほど強い）
                const distanceIntensity = 1 - (dist / radius);
                // 移動量に基づく強度（大きく動くほど強い）
                const movementIntensity = Math.min(avgMoveDist / 20, 1);
                // 最終的な強度
                const intensity = distanceIntensity * movementIntensity;
                
                data[pixelIndex] = Math.max(data[pixelIndex], intensity);
              }
            }
          }
        }
      }
    }
  }
  
  console.log('✅ [Version 5.1.7] フォワードマッピング付加版移動マスク生成完了');
  
  return {
    width: canvasSize.width,
    height: canvasSize.height,
    data
  };
}

/**
 * 独立変形マップを使用してCanvas変形を適用
 */
export function applyIndependentDeformation(
  sourceCanvas: HTMLCanvasElement,
  deformationMap: DeformationMap,
  movementMask?: MovementMask
): HTMLCanvasElement {
  console.log('🎨 [Version 5.1.7] フォワード補完付きハイブリッド変形適用開始');
  
  const targetCanvas = document.createElement('canvas');
  targetCanvas.width = sourceCanvas.width;
  targetCanvas.height = sourceCanvas.height;
  
  const sourceCtx = sourceCanvas.getContext('2d')!;
  const targetCtx = targetCanvas.getContext('2d')!;
  
  const sourceImageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const targetImageData = targetCtx.createImageData(sourceCanvas.width, sourceCanvas.height);
  
  // Phase 1: 移動元領域のクリア処理（Version 5.1.5）
  if (movementMask) {
    console.log('🧹 [Version 5.1.7] Phase 1: フォワードマッピング補完処理開始');
    
    // まず元画像をコピー
    for (let i = 0; i < sourceImageData.data.length; i++) {
      targetImageData.data[i] = sourceImageData.data[i];
    }
    
    // Version 5.1.7: より積極的な移動元領域のクリア
    // 第1段階: 高強度領域を完全にクリア
    for (let y = 0; y < movementMask.height; y++) {
      for (let x = 0; x < movementMask.width; x++) {
        const maskIndex = y * movementMask.width + x;
        const intensity = movementMask.data[maskIndex];
        
        if (intensity > 0.3) { // 高強度領域
          const pixelIndex = (y * movementMask.width + x) * 4;
          
          // 周辺ピクセルで完全に置き換え
          const [r, g, b, a] = getAverageOfSurroundingPixels(
            sourceImageData, 
            x, 
            y, 
            30 // 固定の大きなサンプリング半径
          );
          
          targetImageData.data[pixelIndex] = r;
          targetImageData.data[pixelIndex + 1] = g;
          targetImageData.data[pixelIndex + 2] = b;
          targetImageData.data[pixelIndex + 3] = a;
        }
      }
    }
    
    // 第2段階: 低強度領域をブレンド
    for (let y = 0; y < movementMask.height; y++) {
      for (let x = 0; x < movementMask.width; x++) {
        const maskIndex = y * movementMask.width + x;
        const intensity = movementMask.data[maskIndex];
        
        if (intensity > 0.05 && intensity <= 0.3) { // 低強度領域
          const pixelIndex = (y * movementMask.width + x) * 4;
          
          // 強化インペインティング
          const [r, g, b, a] = getAverageOfSurroundingPixels(
            targetImageData, // 既に処理済みの画像から取得
            x, 
            y, 
            20
          );
          
          // 強度に応じてブレンド
          const blendFactor = intensity * 2.0; // より強い効果
          targetImageData.data[pixelIndex] = Math.round(targetImageData.data[pixelIndex] * (1 - blendFactor) + r * blendFactor);
          targetImageData.data[pixelIndex + 1] = Math.round(targetImageData.data[pixelIndex + 1] * (1 - blendFactor) + g * blendFactor);
          targetImageData.data[pixelIndex + 2] = Math.round(targetImageData.data[pixelIndex + 2] * (1 - blendFactor) + b * blendFactor);
          targetImageData.data[pixelIndex + 3] = a;
        }
      }
    }
    
    console.log('✅ [Version 5.1.7] Phase 1完了');
  }
  
  // Phase 2: 変形後の画像を上書き（Version 5.1.5）
  console.log('🎨 [Version 5.1.7] Phase 2: 変形画像の適用開始');
  
  for (let y = 0; y < deformationMap.height; y++) {
    for (let x = 0; x < deformationMap.width; x++) {
      const mapIndex = (y * deformationMap.width + x) * 2;
      const sourceX = deformationMap.data[mapIndex];
      const sourceY = deformationMap.data[mapIndex + 1];
      
      // 変形がある場合のみ処理
      if (Math.abs(sourceX - x) > 0.1 || Math.abs(sourceY - y) > 0.1) {
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

/**
 * 周辺ピクセルの平均を取得（Version 5.1.5）
 */
function getAverageOfSurroundingPixels(
  imageData: ImageData,
  centerX: number,
  centerY: number,
  radius: number
): [number, number, number, number] {
  const { width, height, data } = imageData;
  let r = 0, g = 0, b = 0, a = 0;
  let count = 0;
  
  // 周辺ピクセルをサンプリング
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx === 0 && dy === 0) continue; // 中心は除外
      
      const x = centerX + dx;
      const y = centerY + dy;
      
      // 境界チェック
      if (x >= 0 && x < width && y >= 0 && y < height) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= radius) {
          const idx = (y * width + x) * 4;
          r += data[idx];
          g += data[idx + 1];
          b += data[idx + 2];
          a += data[idx + 3];
          count++;
        }
      }
    }
  }
  
  if (count === 0) {
    // 周辺ピクセルがない場合は元のピクセル値を返す
    const idx = (centerY * width + centerX) * 4;
    return [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
  }
  
  return [
    Math.round(r / count),
    Math.round(g / count),
    Math.round(b / count),
    Math.round(a / count)
  ];
}

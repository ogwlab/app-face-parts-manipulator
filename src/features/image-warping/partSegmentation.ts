import type { Point, FaceLandmarks } from '../../types/face';

/**
 * パーツ領域セグメンテーション
 * 
 * 各顔パーツの独立した変形領域を定義し、
 * パーツ間の相互影響を防ぐための境界制御を提供
 */

export interface PartRegion {
  partType: 'leftEye' | 'rightEye' | 'mouth' | 'nose';
  boundaryPoints: Point[];
  center: Point;
  bounds: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  };
  influenceRadius: number;
  exclusionZones: Point[][]; // 他パーツの除外領域
}

export interface PartSegmentationResult {
  regions: Map<string, PartRegion>;
  barriers: PartBarrier[];
  influenceMask: number[][]; // 各ピクセルの影響度（0-1）
}

export interface PartBarrier {
  id: string;
  barrierPoints: Point[];
  affectedParts: string[];
  strength: number; // バリア強度（0-1）
}

/**
 * 顔ランドマークからパーツ領域を自動セグメンテーション
 */
export function segmentFaceParts(
  landmarks: FaceLandmarks,
  imageScale: { x: number; y: number },
  canvasSize: { width: number; height: number }
): PartSegmentationResult {
  console.log('🗂️ パーツ領域セグメンテーション開始');
  
  const scalePoint = (p: Point): Point => ({
    x: p.x * imageScale.x,
    y: p.y * imageScale.y
  });

  const regions = new Map<string, PartRegion>();

  // 左目領域の生成
  const leftEyePoints = landmarks.leftEye.map(scalePoint);
  const leftEyeRegion = createPartRegion('leftEye', leftEyePoints, canvasSize);
  regions.set('leftEye', leftEyeRegion);

  // 右目領域の生成
  const rightEyePoints = landmarks.rightEye.map(scalePoint);
  const rightEyeRegion = createPartRegion('rightEye', rightEyePoints, canvasSize);
  regions.set('rightEye', rightEyeRegion);

  // 口領域の生成
  const mouthPoints = landmarks.mouth.map(scalePoint);
  const mouthRegion = createPartRegion('mouth', mouthPoints, canvasSize);
  regions.set('mouth', mouthRegion);

  // 鼻領域の生成
  const nosePoints = landmarks.nose.map(scalePoint);
  const noseRegion = createPartRegion('nose', nosePoints, canvasSize);
  regions.set('nose', noseRegion);

  // パーツ間のバリアを生成
  const barriers = generatePartBarriers(regions, landmarks, imageScale);

  // 影響マスクを生成
  const influenceMask = generateInfluenceMask(regions, barriers, canvasSize);

  console.log(`✅ パーツ領域セグメンテーション完了: ${regions.size}領域, ${barriers.length}バリア`);
  
  // 🔍 仮説3検証: セグメンテーション結果の詳細
  console.log('🔍 [仮説3検証] セグメンテーション結果:', {
    regionsCount: regions.size,
    regionDetails: Array.from(regions.entries()).map(([key, region]) => ({
      partType: key,
      center: region.center,
      influenceRadius: region.influenceRadius,
      bounds: region.bounds
    })),
    barriersCount: barriers.length,
    barriers: barriers.map(b => ({
      id: b.id,
      affectedParts: b.affectedParts,
      strength: b.strength
    }))
  });

  return {
    regions,
    barriers,
    influenceMask
  };
}

/**
 * パーツの特徴点から領域を生成
 */
function createPartRegion(
  partType: PartRegion['partType'],
  points: Point[],
  canvasSize: { width: number; height: number }
): PartRegion {
  // 境界計算
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  const width = right - left;
  const height = bottom - top;

  // 中心計算
  const center: Point = {
    x: xs.reduce((sum, x) => sum + x, 0) / xs.length,
    y: ys.reduce((sum, y) => sum + y, 0) / ys.length
  };

  // パーツタイプ別の影響半径計算
  const baseRadius = Math.sqrt(width * width + height * height) / 2;
  const influenceRadius = calculatePartInfluenceRadius(partType, baseRadius, canvasSize);

  // 境界点の拡張（影響範囲を含む）
  const expandedBoundaryPoints = expandBoundaryPoints(points, influenceRadius * 0.7);

  // 除外ゾーンの生成（他パーツとの重複防止）
  const exclusionZones = generateExclusionZones(partType, center, influenceRadius);

  return {
    partType,
    boundaryPoints: expandedBoundaryPoints,
    center,
    bounds: { left, top, right, bottom, width, height },
    influenceRadius,
    exclusionZones
  };
}

/**
 * パーツタイプ別の影響半径を計算
 */
function calculatePartInfluenceRadius(
  partType: PartRegion['partType'],
  baseRadius: number,
  canvasSize: { width: number; height: number }
): number {
  const minDimension = Math.min(canvasSize.width, canvasSize.height);
  
  // パーツ別係数（鼻は最小、口は標準、目は中程度）
  const multipliers = {
    nose: 0.4,      // 鼻は最小限の影響範囲
    leftEye: 0.6,   // 目は中程度
    rightEye: 0.6,  // 目は中程度
    mouth: 0.8      // 口は比較的広め
  };

  const multiplier = multipliers[partType] || 0.6;
  const radius = baseRadius * multiplier;

  // 最小・最大制限
  const minRadius = Math.max(15, minDimension * 0.02);
  const maxRadius = Math.min(100, minDimension * 0.15);

  return Math.max(minRadius, Math.min(radius, maxRadius));
}

/**
 * 境界点を拡張して影響領域を定義
 */
function expandBoundaryPoints(points: Point[], expansionRadius: number): Point[] {
  if (points.length < 3) return points;

  const expandedPoints: Point[] = [];
  
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const prev = points[(i - 1 + points.length) % points.length];
    const next = points[(i + 1) % points.length];

    // 法線ベクトルを計算
    const prevDir = { x: current.x - prev.x, y: current.y - prev.y };
    const nextDir = { x: next.x - current.x, y: next.y - current.y };
    
    // 平均法線
    const normal = {
      x: -(prevDir.y + nextDir.y) / 2,
      y: (prevDir.x + nextDir.x) / 2
    };
    
    // 正規化
    const length = Math.sqrt(normal.x * normal.x + normal.y * normal.y);
    if (length > 0) {
      normal.x /= length;
      normal.y /= length;
    }

    // 拡張点を追加
    expandedPoints.push({
      x: current.x + normal.x * expansionRadius,
      y: current.y + normal.y * expansionRadius
    });
  }

  return expandedPoints;
}

/**
 * 除外ゾーンの生成（他パーツとの重複防止）
 */
function generateExclusionZones(
  // @ts-ignore - 将来の実装で使用予定
  partType: PartRegion['partType'],
  // @ts-ignore - 将来の実装で使用予定
  center: Point,
  // @ts-ignore - 将来の実装で使用予定
  influenceRadius: number
): Point[][] {
  // 現在は簡略化実装
  // 実際の実装では他パーツの位置を考慮した除外ゾーンを生成
  return [];
}

/**
 * パーツ間のバリアを生成
 */
function generatePartBarriers(
  regions: Map<string, PartRegion>,
  landmarks: FaceLandmarks,
  imageScale: { x: number; y: number }
): PartBarrier[] {
  const barriers: PartBarrier[] = [];
  const scalePoint = (p: Point): Point => ({ x: p.x * imageScale.x, y: p.y * imageScale.y });

  // 鼻と口の間のバリア
  const noseRegion = regions.get('nose');
  const mouthRegion = regions.get('mouth');
  if (noseRegion && mouthRegion) {
    const noseTip = landmarks.nose[landmarks.nose.length - 1];
    const mouthTop = landmarks.mouth[13]; // 上唇中央
    
    const barrier: PartBarrier = {
      id: 'nose-mouth-barrier',
      barrierPoints: [
        scalePoint(noseTip),
        scalePoint(mouthTop)
      ],
      affectedParts: ['nose', 'mouth'],
      strength: 0.9 // 強いバリア
    };
    barriers.push(barrier);
  }

  // 目と鼻の間のバリア
  const leftEyeRegion = regions.get('leftEye');
  const rightEyeRegion = regions.get('rightEye');
  if (noseRegion && leftEyeRegion && rightEyeRegion) {
    // 左目-鼻バリア
    barriers.push({
      id: 'left-eye-nose-barrier',
      barrierPoints: [
        leftEyeRegion.center,
        noseRegion.center
      ],
      affectedParts: ['leftEye', 'nose'],
      strength: 0.7
    });

    // 右目-鼻バリア
    barriers.push({
      id: 'right-eye-nose-barrier',
      barrierPoints: [
        rightEyeRegion.center,
        noseRegion.center
      ],
      affectedParts: ['rightEye', 'nose'],
      strength: 0.7
    });
  }

  console.log(`🚧 生成されたバリア: ${barriers.length}個`);
  return barriers;
}

/**
 * 影響マスクを生成（各ピクセルがどのパーツに影響されるかを定義）
 */
function generateInfluenceMask(
  regions: Map<string, PartRegion>,
  barriers: PartBarrier[],
  canvasSize: { width: number; height: number }
): number[][] {
  const mask: number[][] = [];
  
  // マスクを初期化
  for (let y = 0; y < canvasSize.height; y++) {
    mask[y] = new Array(canvasSize.width).fill(0);
  }

  // 各ピクセルの影響度を計算
  for (let y = 0; y < canvasSize.height; y++) {
    for (let x = 0; x < canvasSize.width; x++) {
      const pixel = { x, y };
      let maxInfluence = 0;

      // 各パーツ領域からの影響を計算
      // @ts-ignore - デバッグ用に保持
      for (const [partId, region] of regions) {
        const distance = Math.sqrt(
          Math.pow(pixel.x - region.center.x, 2) +
          Math.pow(pixel.y - region.center.y, 2)
        );

        if (distance < region.influenceRadius) {
          // バリアの影響を考慮
          const barrierEffect = calculateBarrierEffect(pixel, region, barriers);
          const influence = (1 - distance / region.influenceRadius) * barrierEffect;
          maxInfluence = Math.max(maxInfluence, influence);
        }
      }

      mask[y][x] = maxInfluence;
    }
  }

  return mask;
}

/**
 * バリアの影響を計算
 */
function calculateBarrierEffect(
  pixel: Point,
  region: PartRegion,
  barriers: PartBarrier[]
): number {
  let effect = 1.0;

  for (const barrier of barriers) {
    if (barrier.affectedParts.includes(region.partType)) {
      // バリアラインとの距離を計算
      const distanceToBarrier = calculateDistanceToLine(pixel, barrier.barrierPoints);
      const barrierRadius = 20; // バリアの影響半径

      if (distanceToBarrier < barrierRadius) {
        const reduction = (1 - distanceToBarrier / barrierRadius) * barrier.strength;
        effect *= (1 - reduction);
      }
    }
  }

  return Math.max(0, effect);
}

/**
 * 点と線分の距離を計算
 */
function calculateDistanceToLine(point: Point, linePoints: Point[]): number {
  if (linePoints.length < 2) return Infinity;

  const [p1, p2] = linePoints;
  const A = point.x - p1.x;
  const B = point.y - p1.y;
  const C = p2.x - p1.x;
  const D = p2.y - p1.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  
  if (lenSq === 0) return Math.sqrt(A * A + B * B);

  let param = dot / lenSq;
  param = Math.max(0, Math.min(1, param));

  const xx = p1.x + param * C;
  const yy = p1.y + param * D;

  const dx = point.x - xx;
  const dy = point.y - yy;
  
  return Math.sqrt(dx * dx + dy * dy);
}
import type { Point, FaceParams, FaceLandmarks } from '../../types/face';
import { generateTPSControlPoints, type TPSControlPoint } from './tpsWarping';
import { generateAnatomicalConstraints, applyAnatomicalConstraints } from './anatomicalConstraints';
import { generateIndependentDeformation, applyIndependentDeformation } from './independentDeformation';
import { performMeshBasedDeformation } from './forwardMapping/meshDeformation';

/**
 * 適応的サンプリングによる高性能顔ワーピング
 * 
 * 特徴:
 * - 特徴点周辺は高密度サンプリング
 * - 背景領域は低密度サンプリング
 * - 品質とパフォーマンスの動的バランス
 */

export interface AdaptiveWarpingOptions {
  quality: 'fast' | 'medium' | 'high';
  enableConstraints: boolean;
  maxControlPoints: number;
  deformationMode: 'traditional' | 'independent' | 'mesh'; // メッシュモード追加
  samplingDensity: {
    foreground: number; // 顔領域のサンプリング密度 (1.0 = 全ピクセル)
    background: number; // 背景領域のサンプリング密度
    feature: number;    // 特徴点周辺のサンプリング密度
  };
}

export const DEFAULT_ADAPTIVE_OPTIONS: AdaptiveWarpingOptions = {
  quality: 'high', // デフォルトを高品質に変更（Version 5.2.0）
  enableConstraints: true,
  maxControlPoints: 100,
  deformationMode: 'mesh', // メッシュベースをデフォルトに（Version 5.2.0）
  samplingDensity: {
    foreground: 0.5,
    background: 0.1,
    feature: 1.0
  }
};

/**
 * 品質設定から適応オプションを生成
 */
export function getAdaptiveOptionsFromQuality(quality: 'fast' | 'medium' | 'high'): AdaptiveWarpingOptions {
  switch (quality) {
    case 'fast':
      return {
        quality,
        enableConstraints: false,
        maxControlPoints: 30,
        deformationMode: 'independent', // 高速処理のためindependentを使用
        samplingDensity: {
          foreground: 0.25,
          background: 0.05,
          feature: 0.5
        }
      };
      
    case 'medium':
      return {
        quality,
        enableConstraints: true,
        maxControlPoints: 60,
        deformationMode: 'mesh', // メッシュベース（Version 5.2.0）
        samplingDensity: {
          foreground: 0.5,
          background: 0.1,
          feature: 1.0
        }
      };
      
    case 'high':
      return {
        quality,
        enableConstraints: true,
        maxControlPoints: 120,
        deformationMode: 'mesh', // メッシュベース（Version 5.2.0）
        samplingDensity: {
          foreground: 1.0,
          background: 0.2,
          feature: 1.0
        }
      };
      
    default:
      return DEFAULT_ADAPTIVE_OPTIONS;
  }
}

/**
 * 顔領域マスクを生成
 */
// @ts-ignore - 未使用だがデバッグ用に保持
function generateFaceMask(
  landmarks: FaceLandmarks,
  imageScale: { x: number; y: number },
  canvasWidth: number,
  canvasHeight: number
): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Canvas context を取得できません');
  }
  
  // 顔の輪郭を描画
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  
  ctx.fillStyle = 'black';
  ctx.beginPath();
  
  // 顔の外側輪郭（顎のライン）
  landmarks.jawline.forEach((point, index) => {
    const x = point.x * imageScale.x;
    const y = point.y * imageScale.y;
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  
  // 額の部分（推定）
  const jawCenter = landmarks.jawline[8];
  const noseTop = landmarks.nose[0];
  const foreheadY = noseTop.y - (jawCenter.y - noseTop.y) * 0.3;
  
  ctx.lineTo(landmarks.jawline[0].x * imageScale.x, foreheadY * imageScale.y);
  ctx.lineTo(landmarks.jawline[16].x * imageScale.x, foreheadY * imageScale.y);
  ctx.closePath();
  ctx.fill();
  
  return ctx.getImageData(0, 0, canvasWidth, canvasHeight);
}

/**
 * 特徴点周辺の重要領域を特定
 */
// @ts-ignore - 未使用だがデバッグ用に保持
function identifyFeatureRegions(
  landmarks: FaceLandmarks,
  imageScale: { x: number; y: number }
): Point[] {
  const featureRegions: Point[] = [];
  
  // 重要な特徴点周辺を登録
  const importantPoints = [
    ...landmarks.leftEye,     // 左目
    ...landmarks.rightEye,    // 右目
    ...landmarks.mouth,       // 口
    ...landmarks.nose         // 鼻
  ];
  
  importantPoints.forEach(point => {
    featureRegions.push({
      x: point.x * imageScale.x,
      y: point.y * imageScale.y
    });
  });
  
  return featureRegions;
}

/**
 * 適応的サンプリングマップを生成
 */
// @ts-ignore - 未使用だがデバッグ用に保持
function generateSamplingMap(
  faceMask: ImageData,
  featureRegions: Point[],
  options: AdaptiveWarpingOptions,
  canvasWidth: number,
  canvasHeight: number
): Float32Array {
  const samplingMap = new Float32Array(canvasWidth * canvasHeight);
  
  for (let y = 0; y < canvasHeight; y++) {
    for (let x = 0; x < canvasWidth; x++) {
      const idx = y * canvasWidth + x;
      const maskIdx = (y * canvasWidth + x) * 4;
      
      // 基本サンプリング密度（顔領域 vs 背景）
      const isFaceRegion = faceMask.data[maskIdx] < 128; // 黒い部分が顔
      let density = isFaceRegion ? options.samplingDensity.foreground : options.samplingDensity.background;
      
      // 特徴点周辺はサンプリング密度を上げる
      const minFeatureDistance = Math.min(
        ...featureRegions.map(region => {
          const dx = x - region.x;
          const dy = y - region.y;
          return Math.sqrt(dx * dx + dy * dy);
        })
      );
      
      const featureRadius = 30; // 特徴点周辺の影響半径
      if (minFeatureDistance < featureRadius) {
        const featureWeight = 1 - (minFeatureDistance / featureRadius);
        density = Math.max(density, options.samplingDensity.feature * featureWeight);
      }
      
      samplingMap[idx] = density;
    }
  }
  
  return samplingMap;
}

/**
 * パーツ別影響半径を取得（首部変形防止）
 */
function getPartInfluenceRadius(partType: string): number {
  switch (partType) {
    case 'eye':
      return 60;    // 目: 大幅に縮小（150px → 60px）
    case 'mouth':
      return 70;    // 口: 中程度に縮小
    case 'nose':
      return 50;    // 鼻: 最小限の影響範囲
    case 'stabilizer':
      return 60;    // 安定化点: 標準
    default:
      return 60;    // デフォルト: 目と同等
  }
}

/**
 * 制御点を品質設定に応じて最適化
 */
function optimizeControlPoints(
  controlPoints: TPSControlPoint[],
  options: AdaptiveWarpingOptions
): TPSControlPoint[] {
  if (controlPoints.length <= options.maxControlPoints) {
    return controlPoints;
  }
  
  // 重要度による制御点の選択
  const sortedPoints = [...controlPoints].sort((a, b) => (b.weight || 1) - (a.weight || 1));
  
  console.log(`🎯 制御点最適化: ${controlPoints.length} → ${options.maxControlPoints}`);
  return sortedPoints.slice(0, options.maxControlPoints);
}

/**
 * 適応的TPSワーピングの実行
 */
export function applyAdaptiveTPSWarping(
  sourceImageElement: HTMLImageElement,
  landmarks: FaceLandmarks,
  faceParams: FaceParams,
  canvasWidth: number,
  canvasHeight: number,
  options: AdaptiveWarpingOptions = DEFAULT_ADAPTIVE_OPTIONS
): HTMLCanvasElement {
  console.log('🎨 適応的TPS変形開始:', { 
    quality: options.quality, 
    mode: options.deformationMode,
    canvasWidth, 
    canvasHeight 
  });
  
  // 🔍 仮説1検証: どのモードが選択されているかを明示
  console.log('🔍 [仮説1検証] 変形モード判定:', {
    deformationMode: options.deformationMode,
    isIndependent: options.deformationMode === 'independent',
    willUseIndependentSystem: options.deformationMode === 'independent'
  });
  
  const startTime = performance.now();

  // メッシュベース変形モードの処理（Version 5.2.0）
  if (options.deformationMode === 'mesh') {
    console.log('🔺 [Version 5.2.0] メッシュベース変形システムへ移行');
    // renderModeをdebugOptionsに渡す
    const meshRenderMode = (options as any).meshRenderMode || 'hybrid';
    return performMeshBasedDeformation(
      sourceImageElement,
      landmarks,
      faceParams,
      canvasWidth,
      canvasHeight,
      {
        enabled: false,
        drawTargetMesh: false,
        meshColor: 'rgba(255, 0, 0, 0.3)',
        meshLineWidth: 1,
        renderMode: meshRenderMode
      }
    );
  }

  // 独立変形モードの処理
  if (options.deformationMode === 'independent') {
    console.log('🔧 独立変形システムへ移行');
    return applyIndependentTPSWarping(
      sourceImageElement,
      landmarks,
      faceParams,
      canvasWidth,
      canvasHeight,
      options
    );
  }

  // 従来のTPS変形処理（traditionalモード）
  console.log('🔧 従来TPSシステムを使用');
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
  
  // 画像スケール
  const imageScale = {
    x: canvasWidth / sourceImageElement.naturalWidth,
    y: canvasHeight / sourceImageElement.naturalHeight
  };
  
  // 制御点を生成
  let controlPoints = generateTPSControlPoints(landmarks, faceParams, imageScale, { width: canvasWidth, height: canvasHeight });
  
  // 安定化のために周辺固定点を追加（実際のCanvasサイズを使用）
  const stabilizingPoints = [
    { x: 0, y: 0 },
    { x: canvasWidth, y: 0 },
    { x: canvasWidth, y: canvasHeight },
    { x: 0, y: canvasHeight },
    { x: canvasWidth / 2, y: canvasHeight / 2 }
  ];

  stabilizingPoints.forEach(point => {
    controlPoints.push({
      original: point,
      target: point, // 固定点なので変形しない
      weight: 0.1, // 低い重み
      partType: 'stabilizer',
      influenceRadius: getPartInfluenceRadius('stabilizer')
    });
  });
  
  // 制御点数を最適化
  controlPoints = optimizeControlPoints(controlPoints, options);
  
  // 解剖学的制約を適用（高品質モードのみ）
  if (options.enableConstraints && options.quality === 'high') {
    const constraints = generateAnatomicalConstraints(landmarks, imageScale);
    controlPoints = applyAnatomicalConstraints(controlPoints, constraints);
  }
  
  if (controlPoints.length === 0) {
    // 制御点がない場合は元画像をそのまま返す
    targetCtx.drawImage(sourceCanvas, 0, 0);
    return targetCanvas;
  }
  
  // 顔領域マスクと特徴点領域を生成（現在未使用）
  // const faceMask = generateFaceMask(landmarks, imageScale, canvasWidth, canvasHeight);
  // const featureRegions = identifyFeatureRegions(landmarks, imageScale);
  // const samplingMap = generateSamplingMap(faceMask, featureRegions, options, canvasWidth, canvasHeight);
  
  // TPS変形パラメータを計算（将来の完全実装用）
  // const tpsOptions = {
  //   regularization: options.quality === 'fast' ? 0.2 : 0.1,
  //   localRigidity: options.quality === 'fast' ? 0.9 : 0.8
  // };
  
  console.log('🔄 適応的TPS変形実行中...');
  
  // 全ピクセル処理（適応的サンプリングを無効化して水平ノイズを防止）
  let processedPixels = 0;
  const totalPixels = canvasWidth * canvasHeight;
  
  for (let y = 0; y < canvasHeight; y++) {
    for (let x = 0; x < canvasWidth; x++) {
      // 全ピクセルを処理（サンプリング密度チェックを無効化）
      
      // 改良されたTPS変形を適用
      let sourceX = x;
      let sourceY = y;
      
      // 制御点が存在する場合のみ変形処理
      if (controlPoints.length > 0) {
        // 重み付き平均による変形計算（TPS簡略版）
        let totalWeight = 0;
        let weightedOffsetX = 0;
        let weightedOffsetY = 0;
        
        for (const cp of controlPoints) {
          const dx = x - cp.target.x;
          const dy = y - cp.target.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // パーツ別影響半径を使用（首部変形防止）
          const maxInfluence = cp.influenceRadius || getPartInfluenceRadius(cp.partType || 'eye');
          
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
          
          // 変形の強度を制限（最大35%移動 - 拡張範囲）
          const maxOffset = Math.min(canvasWidth, canvasHeight) * 0.35;
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
      const pixelIdx = (y * canvasWidth + x) * 4;
      targetImageData.data[pixelIdx] = r;
      targetImageData.data[pixelIdx + 1] = g;
      targetImageData.data[pixelIdx + 2] = b;
      targetImageData.data[pixelIdx + 3] = a;
      
      processedPixels++;
    }
    
    // プログレス表示（品質に応じて頻度調整）
    const progressInterval = options.quality === 'fast' ? 50 : 20;
    if (y % progressInterval === 0) {
      const progress = Math.round((y / canvasHeight) * 100);
      console.log(`🔄 適応的変形進捗: ${progress}% (処理済み: ${processedPixels}/${totalPixels})`);
    }
  }
  
  // 結果を描画
  targetCtx.putImageData(targetImageData, 0, 0);
  
  const endTime = performance.now();
  const processingTime = (endTime - startTime).toFixed(1);
  const processingRatio = (processedPixels / totalPixels * 100).toFixed(1);
  
  console.log(`✅ 改良TPS変形完了: ${processingTime}ms, 処理率: ${processingRatio}%`);
  
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
 * 独立変形システムを使用したTPS変形
 */
function applyIndependentTPSWarping(
  sourceImageElement: HTMLImageElement,
  landmarks: FaceLandmarks,
  faceParams: FaceParams,
  canvasWidth: number,
  canvasHeight: number,
  // @ts-ignore - 将来の拡張で使用予定
  options: AdaptiveWarpingOptions
): HTMLCanvasElement {
  console.log('🔧 独立変形システム開始');
  
  // 🔍 仮説2検証: 顔パラメータの確認
  console.log('🔍 [仮説2検証] 受信した顔パラメータ:', {
    leftEye: faceParams.leftEye,
    rightEye: faceParams.rightEye,
    mouth: faceParams.mouth,
    nose: faceParams.nose
  });
  
  const startTime = performance.now();

  // 元画像をCanvasに描画
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = canvasWidth;
  sourceCanvas.height = canvasHeight;
  
  const sourceCtx = sourceCanvas.getContext('2d');
  if (!sourceCtx) {
    throw new Error('Canvas context を取得できません');
  }
  
  sourceCtx.drawImage(sourceImageElement, 0, 0, canvasWidth, canvasHeight);

  // 画像スケール
  const imageScale = {
    x: canvasWidth / sourceImageElement.naturalWidth,
    y: canvasHeight / sourceImageElement.naturalHeight
  };

  // 独立変形を生成
  const deformationResult = generateIndependentDeformation(
    landmarks,
    faceParams,
    imageScale,
    { width: canvasWidth, height: canvasHeight }
  );

  // 独立変形を適用（Version 5.1.5: movementMaskも渡す）
  const resultCanvas = applyIndependentDeformation(
    sourceCanvas,
    deformationResult.deformationMap,
    deformationResult.movementMask
  );

  const endTime = performance.now();
  const processingTime = (endTime - startTime).toFixed(1);

  console.log(`✅ 独立変形システム完了: ${processingTime}ms`);
  
  return resultCanvas;
}
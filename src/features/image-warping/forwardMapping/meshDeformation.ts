/**
 * メッシュ変形統合処理
 * Version 5.2.0
 */

import type { Point, FaceParams, FaceLandmarks } from '../../../types/face';
import type { Triangle, TriangleMesh, DeformedTrianglePair, MeshDeformationResult } from '../triangulation/types';
import { createFaceOptimizedTriangulation, generateBoundaryPoints } from '../triangulation/delaunay';
import { calculateAffineTransform } from './affineTransform';
import { renderTriangleMesh, drawMeshEdges } from './triangleRenderer';
import { renderTriangleMeshBackward } from './backwardRenderer';
import { renderTriangleMeshHybrid } from './hybridRenderer';
import { generateContourControlPoints } from '../contourDeformation';
import type { ContourParams } from '../../../types/face';
import { logger } from '../../../utils/logger';

/**
 * 特徴点ベース変形用の拡張されたメッシュ変形オプション
 */
export interface MeshDeformationOptions {
  quality: 'fast' | 'medium' | 'high';
  renderMode: 'forward' | 'hybrid' | 'backward';
  preserveFeatures: boolean;
  smoothBoundaries: boolean;
}

/**
 * 特徴点ベース変形結果
 */
export interface FeatureBasedMeshResult {
  canvas: HTMLCanvasElement;
  transformedLandmarks: FaceLandmarks;
  quality: {
    renderTime: number;
    triangleCount: number;
    controlPointCount: number;
  };
}

/**
 * 輪郭パラメータに変更があるかチェック
 */
function isContourChangeDetected(contour: ContourParams): boolean {
  return (
    contour.faceShape !== 0 ||
    contour.jawWidth !== 1.0 ||
    contour.cheekFullness !== 1.0 ||
    contour.chinHeight !== 1.0 ||
    contour.smoothness !== 0.5
  );
}

/**
 * 顔パラメータに基づいてランドマークを変形
 */
export function deformLandmarks(
  landmarks: FaceLandmarks,
  faceParams: FaceParams
): FaceLandmarks {
  console.log('🔄 ランドマーク変形開始');
  
  // ディープコピー
  const deformed: FaceLandmarks = JSON.parse(JSON.stringify(landmarks));
  
  // 顔全体の境界を計算
  const faceBounds = calculateFaceBounds(landmarks);
  console.log('📏 顔領域サイズ:', faceBounds);
  
  // 左目の変形
  if (faceParams.leftEye) {
    const leftEyeCenter = calculatePartCenter(landmarks.leftEye);
    console.log('👁️ 左目変形適用:', {
      size: faceParams.leftEye.size,
      positionX: faceParams.leftEye.positionX,
      positionY: faceParams.leftEye.positionY,
      center: leftEyeCenter
    });
    deformEye(
      deformed.leftEye,
      leftEyeCenter,
      faceParams.leftEye,
      faceBounds
    );
  }
  
  // 右目の変形
  if (faceParams.rightEye) {
    const rightEyeCenter = calculatePartCenter(landmarks.rightEye);
    console.log('👁️ 右目変形適用:', {
      size: faceParams.rightEye.size,
      positionX: faceParams.rightEye.positionX,
      positionY: faceParams.rightEye.positionY,
      center: rightEyeCenter
    });
    deformEye(
      deformed.rightEye,
      rightEyeCenter,
      faceParams.rightEye,
      faceBounds
    );
  }
  
  // 口の変形
  if (faceParams.mouth) {
    const mouthCenter = calculatePartCenter(landmarks.mouth);
    console.log('👄 口変形適用:', {
      width: faceParams.mouth.width,
      height: faceParams.mouth.height,
      positionX: faceParams.mouth.positionX,
      positionY: faceParams.mouth.positionY,
      center: mouthCenter
    });
    deformMouth(
      deformed.mouth,
      mouthCenter,
      faceParams.mouth,
      faceBounds
    );
  }
  
  // 鼻の変形
  if (faceParams.nose) {
    const noseCenter = calculatePartCenter(landmarks.nose);
    console.log('👃 鼻変形適用:', {
      width: faceParams.nose.width,
      height: faceParams.nose.height,
      positionX: faceParams.nose.positionX,
      positionY: faceParams.nose.positionY,
      center: noseCenter
    });
    deformNose(
      deformed.nose,
      noseCenter,
      faceParams.nose,
      faceBounds
    );
  }
  
  // 輪郭の変形（条件付き有効化）
  if (faceParams.contour && isContourChangeDetected(faceParams.contour)) {
    console.log('🔷 輪郭変形開始:', {
      faceShape: faceParams.contour.faceShape,
      jawWidth: faceParams.contour.jawWidth,
      cheekFullness: faceParams.contour.cheekFullness,
      chinHeight: faceParams.contour.chinHeight
    });
    
    const contourControlPoints = generateContourControlPoints(landmarks, faceParams.contour);
    
    // jawlineを変形
    for (let i = 0; i < deformed.jawline.length; i++) {
      deformed.jawline[i] = contourControlPoints.target[i];
    }
    
    console.log('🔷 輪郭変形適用完了:', {
      controlPointsCount: contourControlPoints.original.length
    });
  }
  
  console.log('✅ ランドマーク変形完了');
  return deformed;
}

/**
 * 目の変形
 */
function deformEye(
  eyePoints: Point[],
  center: Point,
  params: { size: number; positionX: number; positionY: number },
  faceBounds: { width: number; height: number }
): void {
  const scale = params.size;
  // 位置パラメータを顔領域サイズ比%として計算
  const dx = (params.positionX / 100) * faceBounds.width;
  const dy = (params.positionY / 100) * faceBounds.height;
  
  // 新しい中心位置
  const newCenter = {
    x: center.x + dx,
    y: center.y + dy
  };
  
  // 各点を変形
  for (let i = 0; i < eyePoints.length; i++) {
    const point = eyePoints[i];
    
    // 中心からの相対位置
    const relX = point.x - center.x;
    const relY = point.y - center.y;
    
    // スケールと移動を適用
    eyePoints[i] = {
      x: newCenter.x + relX * scale,
      y: newCenter.y + relY * scale
    };
  }
}

/**
 * 口の変形
 */
function deformMouth(
  mouthPoints: Point[],
  center: Point,
  params: { width: number; height: number; positionX: number; positionY: number },
  faceBounds: { width: number; height: number }
): void {
  const scaleX = params.width;
  const scaleY = params.height;
  // 位置パラメータを顔領域サイズ比%として計算
  const dx = (params.positionX / 100) * faceBounds.width;
  const dy = (params.positionY / 100) * faceBounds.height;
  
  // 新しい中心位置
  const newCenter = {
    x: center.x + dx,
    y: center.y + dy
  };
  
  // 各点を変形
  for (let i = 0; i < mouthPoints.length; i++) {
    const point = mouthPoints[i];
    
    // 中心からの相対位置
    const relX = point.x - center.x;
    const relY = point.y - center.y;
    
    // 非等方スケールと移動を適用
    mouthPoints[i] = {
      x: newCenter.x + relX * scaleX,
      y: newCenter.y + relY * scaleY
    };
  }
}

/**
 * 鼻の変形
 */
function deformNose(
  nosePoints: Point[],
  center: Point,
  params: { width: number; height: number; positionX: number; positionY: number },
  faceBounds: { width: number; height: number }
): void {
  const scaleX = params.width;
  const scaleY = params.height;
  // 位置パラメータを顔領域サイズ比%として計算
  const dx = (params.positionX / 100) * faceBounds.width;
  const dy = (params.positionY / 100) * faceBounds.height;
  
  // 新しい中心位置
  const newCenter = {
    x: center.x + dx,
    y: center.y + dy
  };
  
  // 各点を変形
  for (let i = 0; i < nosePoints.length; i++) {
    const point = nosePoints[i];
    
    // 中心からの相対位置
    const relX = point.x - center.x;
    const relY = point.y - center.y;
    
    // 非等方スケールと移動を適用
    nosePoints[i] = {
      x: newCenter.x + relX * scaleX,
      y: newCenter.y + relY * scaleY
    };
  }
}

/**
 * パーツの中心を計算
 */
function calculatePartCenter(points: Point[]): Point {
  const sum = points.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 }
  );
  
  return {
    x: sum.x / points.length,
    y: sum.y / points.length
  };
}

/**
 * 顔全体の境界を計算
 */
function calculateFaceBounds(landmarks: FaceLandmarks): { width: number; height: number } {
  // 顔の輪郭と眉毛から顔領域を計算
  const boundaryPoints = [
    ...landmarks.jawline,
    ...landmarks.leftEyebrow,
    ...landmarks.rightEyebrow
  ];
  
  const xs = boundaryPoints.map(p => p.x);
  const ys = boundaryPoints.map(p => p.y);
  
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  
  return {
    width: maxX - minX,
    height: maxY - minY
  };
}

/**
 * ランドマークをCanvas座標にスケール
 */
function scaleLandmarksToCanvas(
  landmarks: FaceLandmarks,
  scale: { x: number; y: number }
): FaceLandmarks {
  const scalePoints = (points: Point[]): Point[] => {
    return points.map(point => ({
      x: point.x * scale.x,
      y: point.y * scale.y
    }));
  };

  return {
    jawline: scalePoints(landmarks.jawline),
    leftEyebrow: scalePoints(landmarks.leftEyebrow),
    rightEyebrow: scalePoints(landmarks.rightEyebrow),
    nose: scalePoints(landmarks.nose),
    leftEye: scalePoints(landmarks.leftEye),
    rightEye: scalePoints(landmarks.rightEye),
    mouth: scalePoints(landmarks.mouth)
  };
}

/**
 * メッシュ変形を実行
 */
export function createMeshDeformation(
  originalLandmarks: FaceLandmarks,
  deformedLandmarks: FaceLandmarks,
  imageWidth: number,
  imageHeight: number
): MeshDeformationResult {
  console.log('🔺 メッシュ変形作成開始');
  
  // 1. 元の特徴点から三角形メッシュを作成
  const originalPoints = landmarksToPoints(originalLandmarks);
  console.log(`📍 元のランドマーク点数: ${originalPoints.length}`);
  
  const sourceMesh = createFaceOptimizedTriangulation(
    originalPoints,
    imageWidth,
    imageHeight
  );
  console.log(`📐 ソースメッシュ: 頂点数=${sourceMesh.vertices.length}, 三角形数=${sourceMesh.triangles.length}`);
  
  // 2. 変形後の特徴点配列を作成（同じ順序を保つ）
  const deformedPoints = landmarksToPoints(deformedLandmarks);
  console.log(`📍 変形後のランドマーク点数: ${deformedPoints.length}`);
  
  // 3. 境界点を追加（変形しない固定点として）
  const boundaryPoints = generateBoundaryPoints(imageWidth, imageHeight);
  const allDeformedPoints = [...deformedPoints, ...boundaryPoints];
  
  console.log(`🔧 ポイント数統一: landmarks=${deformedPoints.length}, boundary=${boundaryPoints.length}, total=${allDeformedPoints.length}`);
  
  // デバッグ: 最初の数点の座標を確認
  console.log('🔍 最初の5つの変形点:', deformedPoints.slice(0, 5).map((p, i) => 
    `Point ${i}: (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`
  ));
  
  // 4. 変形後のメッシュを作成（頂点数を統一）
  const targetMesh: TriangleMesh = {
    vertices: allDeformedPoints,
    triangles: sourceMesh.triangles.map((triangle, idx) => {
      // インデックスが有効かチェック
      if (!triangle.indices || triangle.indices.length !== 3) {
        console.error(`❌ 無効な三角形インデックス: triangle ${idx}`, triangle);
        return null;
      }
      
      const [idx0, idx1, idx2] = triangle.indices;
      
      // インデックスが範囲内かチェック（統一された配列サイズで）
      if (idx0 < 0 || idx0 >= allDeformedPoints.length ||
          idx1 < 0 || idx1 >= allDeformedPoints.length ||
          idx2 < 0 || idx2 >= allDeformedPoints.length) {
        console.error(`❌ インデックスが範囲外: triangle ${idx}`, {
          indices: triangle.indices,
          allDeformedPointsLength: allDeformedPoints.length
        });
        return null;
      }
      
      // 変形後の頂点を取得
      const deformedVertices: [Point, Point, Point] = [
        allDeformedPoints[idx0],
        allDeformedPoints[idx1],
        allDeformedPoints[idx2]
      ];
      
      // デバッグ: 最初の三角形の頂点座標を表示
      if (idx < 3) {
        console.log(`🔺 三角形 ${idx} の頂点:`, {
          v0: `(${deformedVertices[0].x.toFixed(2)}, ${deformedVertices[0].y.toFixed(2)})`,
          v1: `(${deformedVertices[1].x.toFixed(2)}, ${deformedVertices[1].y.toFixed(2)})`,
          v2: `(${deformedVertices[2].x.toFixed(2)}, ${deformedVertices[2].y.toFixed(2)})`
        });
      }
      
      return {
        vertices: deformedVertices,
        indices: triangle.indices
      };
    }).filter(triangle => triangle !== null) as Triangle[]
  };
  
  // targetMeshとsourceMeshの三角形数が異なる場合の警告
  if (targetMesh.triangles.length !== sourceMesh.triangles.length) {
    console.warn(`⚠️ 三角形数の不一致: source=${sourceMesh.triangles.length}, target=${targetMesh.triangles.length}`);
  }
  
  // 4. 三角形ペアとアフィン変換を計算
  const trianglePairs: DeformedTrianglePair[] = [];
  
  const minTriangleCount = Math.min(sourceMesh.triangles.length, targetMesh.triangles.length);
  
  for (let i = 0; i < minTriangleCount; i++) {
    const sourceTriangle = sourceMesh.triangles[i];
    const targetTriangle = targetMesh.triangles[i];
    
    // 三角形が無効な場合はスキップ
    if (!sourceTriangle || !targetTriangle || 
        !sourceTriangle.vertices || !targetTriangle.vertices ||
        sourceTriangle.vertices.length !== 3 || targetTriangle.vertices.length !== 3) {
      console.warn(`⚠️ 無効な三角形をスキップ: index=${i}`);
      continue;
    }
    
    const transform = calculateAffineTransform(sourceTriangle, targetTriangle);
    
    trianglePairs.push({
      source: sourceTriangle,
      target: targetTriangle,
      transform
    });
  }
  
  console.log(`✅ メッシュ変形作成完了: ${trianglePairs.length}個の三角形ペア`);
  
  return {
    sourceMesh,
    targetMesh,
    trianglePairs
  };
}

/**
 * ランドマークを点配列に変換
 */
function landmarksToPoints(landmarks: FaceLandmarks): Point[] {
  const points: Point[] = [];
  
  // 顔の輪郭
  points.push(...landmarks.jawline);
  
  // 左眉
  points.push(...landmarks.leftEyebrow);
  
  // 右眉
  points.push(...landmarks.rightEyebrow);
  
  // 鼻
  points.push(...landmarks.nose);
  
  // 左目
  points.push(...landmarks.leftEye);
  
  // 右目
  points.push(...landmarks.rightEye);
  
  // 口
  points.push(...landmarks.mouth);
  
  return points;
}

/**
 * メッシュ変形を適用
 * @param renderMode - 'forward' | 'backward' | 'hybrid' レンダリングモード
 */
export function applyMeshDeformation(
  sourceCanvas: HTMLCanvasElement,
  targetCanvas: HTMLCanvasElement,
  deformationResult: MeshDeformationResult,
  renderMode: 'forward' | 'backward' | 'hybrid' = 'hybrid'
): void {
  logger.debug(`🎨 メッシュ変形適用開始 (${renderMode}モード)`);
  const startTime = performance.now();
  
  // Canvasをクリア
  const targetCtx = targetCanvas.getContext('2d');
  if (!targetCtx) {
    logger.error('Target canvas context取得エラー');
    return;
  }
  
  targetCtx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
  
  // 三角形ペアを準備
  const trianglePairs = deformationResult.trianglePairs.map(pair => ({
    source: pair.source,
    target: pair.target
  }));
  
  // レンダリングモードに応じて処理を分岐
  switch (renderMode) {
    case 'backward':
      logger.debug('🔄 バックワードマッピングモードで実行');
      renderTriangleMeshBackward(
        sourceCanvas,
        targetCanvas,
        trianglePairs
      );
      break;
      
    case 'hybrid':
      logger.debug('🔀 ハイブリッドモードで実行');
      renderTriangleMeshHybrid(
        sourceCanvas,
        targetCanvas,
        deformationResult.trianglePairs
      );
      break;
      
    case 'forward':
    default:
      logger.debug('➡️ フォワードマッピングモードで実行');
      renderTriangleMesh(
        sourceCanvas,
        targetCanvas,
        deformationResult.trianglePairs
      );
      break;
  }
  
  const endTime = performance.now();
  logger.info(`✅ メッシュ変形適用完了: ${(endTime - startTime).toFixed(1)}ms`);
}

/**
 * デバッグオプション
 */
export interface MeshDebugOptions {
  enabled: boolean;
  drawSourceMesh?: boolean;
  drawTargetMesh?: boolean;
  meshColor?: string;
  meshLineWidth?: number;
  renderMode?: 'forward' | 'backward' | 'hybrid';  // レンダリングモード追加
}

/**
 * 統合された変形処理
 */
export function performMeshBasedDeformation(
  sourceImageElement: HTMLImageElement,
  landmarks: FaceLandmarks,
  faceParams: FaceParams,
  canvasWidth: number,
  canvasHeight: number,
  debugOptions: MeshDebugOptions = { enabled: false }
): HTMLCanvasElement {
  console.log('🚀 [Version 5.2.2] メッシュベース変形処理開始 - ハイブリッドレンダリング');
  
  // 受信パラメータのログ
  console.log('📥 受信したパラメータ:', {
    leftEye: faceParams.leftEye,
    rightEye: faceParams.rightEye,
    mouth: faceParams.mouth,
    nose: faceParams.nose,
    contour: faceParams.contour
  });
  
  // デバッグモードのログ
  if (debugOptions.enabled) {
    console.log('🐛 デバッグモード有効', debugOptions);
  }
  
  // 1. ソースCanvasを作成
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = canvasWidth;
  sourceCanvas.height = canvasHeight;
  const sourceCtx = sourceCanvas.getContext('2d');
  
  if (!sourceCtx) {
    throw new Error('Source canvas context取得エラー');
  }
  
  // 元画像を描画
  sourceCtx.drawImage(sourceImageElement, 0, 0, canvasWidth, canvasHeight);
  
  // 2. 画像スケール計算
  const imageScale = {
    x: canvasWidth / sourceImageElement.naturalWidth,
    y: canvasHeight / sourceImageElement.naturalHeight
  };
  
  // 3. ランドマークをCanvas座標にスケール
  const scaledLandmarks = scaleLandmarksToCanvas(landmarks, imageScale);
  console.log('📏 ランドマーク座標スケール:', {
    originalScale: `${sourceImageElement.naturalWidth}x${sourceImageElement.naturalHeight}`,
    canvasScale: `${canvasWidth}x${canvasHeight}`,
    imageScale
  });
  
  // 4. スケール済みランドマークを変形
  const deformedLandmarks = deformLandmarks(scaledLandmarks, faceParams);
  
  // デバッグ: パラメータと変形の確認
  console.log('🔍 変形パラメータ:', {
    leftEye: faceParams.leftEye,
    rightEye: faceParams.rightEye,
    mouth: faceParams.mouth,
    nose: faceParams.nose
  });
  
  // 5. メッシュ変形を作成
  const deformationResult = createMeshDeformation(
    scaledLandmarks,
    deformedLandmarks,
    canvasWidth,
    canvasHeight
  );
  
  // 5. ターゲットCanvasを作成
  const targetCanvas = document.createElement('canvas');
  targetCanvas.width = canvasWidth;
  targetCanvas.height = canvasHeight;
  
  // 6. 変形を適用（ハイブリッドマッピングをデフォルトに）
  const renderMode = debugOptions.renderMode || 'hybrid';
  applyMeshDeformation(sourceCanvas, targetCanvas, deformationResult, renderMode);
  
  // 7. デバッグ描画
  if (debugOptions.enabled) {
    const targetCtx = targetCanvas.getContext('2d');
    if (targetCtx) {
      // ソースメッシュの描画（別Canvasに）
      if (debugOptions.drawSourceMesh) {
        const debugCanvas = document.createElement('canvas');
        debugCanvas.width = canvasWidth;
        debugCanvas.height = canvasHeight;
        const debugCtx = debugCanvas.getContext('2d');
        if (debugCtx) {
          debugCtx.drawImage(sourceCanvas, 0, 0);
          drawMeshEdges(
            debugCanvas,
            deformationResult.sourceMesh.triangles,
            debugOptions.meshColor || 'rgba(0, 255, 0, 0.5)',
            debugOptions.meshLineWidth || 1
          );
          console.log('🐛 ソースメッシュ描画完了');
        }
      }
      
      // ターゲットメッシュの描画
      if (debugOptions.drawTargetMesh) {
        drawMeshEdges(
          targetCanvas,
          deformationResult.targetMesh.triangles,
          debugOptions.meshColor || 'rgba(255, 0, 0, 0.5)',
          debugOptions.meshLineWidth || 1
        );
        console.log('🐛 ターゲットメッシュ描画完了');
      }
    }
  }
  
  console.log(`✅ [Version 5.2.2] メッシュベース変形処理完了 (${renderMode}モード)`);
  return targetCanvas;
}

/**
 * 特徴点ベース変形専用のメッシュ変形処理
 * @param sourceImage - 元画像
 * @param landmarks - 顔のランドマーク  
 * @param originalPoints - 元の制御点
 * @param targetPoints - 目標制御点
 * @param options - 変形オプション
 * @returns 特徴点ベース変形結果
 */
export async function performFeatureBasedMeshDeformation(
  sourceImage: HTMLImageElement,
  landmarks: FaceLandmarks,
  originalPoints: Point[],
  targetPoints: Point[],
  options: MeshDeformationOptions
): Promise<FeatureBasedMeshResult> {
  const startTime = performance.now();
  
  console.log('🎯 特徴点ベースメッシュ変形開始:', {
    imageSize: { width: sourceImage.naturalWidth, height: sourceImage.naturalHeight },
    controlPoints: originalPoints.length,
    options
  });
  
  try {
    // 1. Canvas作成
    const canvas = document.createElement('canvas');
    canvas.width = sourceImage.naturalWidth;
    canvas.height = sourceImage.naturalHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas 2D context');
    }
    
    // 2. 高品質設定
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = options.quality === 'high' ? 'high' : 'medium';
    
    // 3. 背景をクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 4. 制御点から疑似FaceParamsを生成
    const pseudoFaceParams = generatePseudoFaceParams(originalPoints, targetPoints, landmarks);
    
    // 5. メッシュベース変形を実行（既存システムを活用）
    const resultCanvas = performMeshBasedDeformation(
      sourceImage,
      landmarks,
      pseudoFaceParams,
      canvas.width,
      canvas.height,
      {
        enabled: false,
        renderMode: options.renderMode
      }
    );
    
    // 6. 結果をメインCanvasにコピー
    ctx.drawImage(resultCanvas, 0, 0);
    
    // 7. 変換後ランドマークを計算（簡易版）
    const transformedLandmarks = calculateTransformedLandmarks(landmarks, originalPoints, targetPoints);
    
    const endTime = performance.now();
    const renderTime = endTime - startTime;
    
    return {
      canvas,
      transformedLandmarks,
      quality: {
        renderTime,
        triangleCount: 163, // 固定値（delaunayシステムの標準）
        controlPointCount: originalPoints.length
      }
    };
    
  } catch (error) {
    console.error('❌ 特徴点ベースメッシュ変形エラー:', error);
    throw new Error(`メッシュ変形に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 制御点から疑似FaceParamsを生成する
 * @param originalPoints - 元制御点
 * @param targetPoints - 目標制御点
 * @param landmarks - ランドマーク
 * @returns 疑似FaceParams
 */
const generatePseudoFaceParams = (
  originalPoints: Point[],
  targetPoints: Point[],
  landmarks: FaceLandmarks
): FaceParams => {
  // 制御点の変化から近似的なパラメータを計算
  const eyeIndices = findEyeControlPointIndices(originalPoints, landmarks);
  
  let leftEyeScale = 1.0;
  let rightEyeScale = 1.0;
  let leftEyePositionX = 0;
  let leftEyePositionY = 0;
  let rightEyePositionX = 0;
  let rightEyePositionY = 0;
  
  // 左目の制御点がある場合
  if (eyeIndices.leftEye.length > 0) {
    const originalLeftCenter = calculateCentroid(eyeIndices.leftEye.map(i => originalPoints[i]));
    const targetLeftCenter = calculateCentroid(eyeIndices.leftEye.map(i => targetPoints[i]));
    
    leftEyePositionX = targetLeftCenter.x - originalLeftCenter.x;
    leftEyePositionY = targetLeftCenter.y - originalLeftCenter.y;
    
    // スケールは距離の変化から推定
    const originalSpread = calculatePointSpread(eyeIndices.leftEye.map(i => originalPoints[i]));
    const targetSpread = calculatePointSpread(eyeIndices.leftEye.map(i => targetPoints[i]));
    leftEyeScale = originalSpread > 0 ? targetSpread / originalSpread : 1.0;
  }
  
  // 右目の制御点がある場合
  if (eyeIndices.rightEye.length > 0) {
    const originalRightCenter = calculateCentroid(eyeIndices.rightEye.map(i => originalPoints[i]));
    const targetRightCenter = calculateCentroid(eyeIndices.rightEye.map(i => targetPoints[i]));
    
    rightEyePositionX = targetRightCenter.x - originalRightCenter.x;
    rightEyePositionY = targetRightCenter.y - originalRightCenter.y;
    
    const originalSpread = calculatePointSpread(eyeIndices.rightEye.map(i => originalPoints[i]));
    const targetSpread = calculatePointSpread(eyeIndices.rightEye.map(i => targetPoints[i]));
    rightEyeScale = originalSpread > 0 ? targetSpread / originalSpread : 1.0;
  }
  
  return {
    leftEye: {
      size: leftEyeScale,
      positionX: leftEyePositionX,
      positionY: leftEyePositionY
    },
    rightEye: {
      size: rightEyeScale,
      positionX: rightEyePositionX,
      positionY: rightEyePositionY
    },
    mouth: {
      width: 1.0,
      height: 1.0,
      positionX: 0,
      positionY: 0
    },
    nose: {
      width: 1.0,
      height: 1.0,
      positionX: 0,
      positionY: 0
    },
    contour: {
      faceShape: 0,
      jawWidth: 1.0,
      cheekFullness: 1.0,
      chinHeight: 1.0,
      smoothness: 0.5,
      fixMenton: false
    }
  };
};

/**
 * 制御点から眼のインデックスを特定する
 * @param controlPoints - 制御点配列
 * @param landmarks - ランドマーク
 * @returns 眼の制御点インデックス
 */
const findEyeControlPointIndices = (
  controlPoints: Point[],
  landmarks: FaceLandmarks
): { leftEye: number[]; rightEye: number[] } => {
  const leftEyeIndices: number[] = [];
  const rightEyeIndices: number[] = [];
  
  // 左目の重心を計算
  const leftEyeCenter = landmarks.leftEye.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 }
  );
  leftEyeCenter.x /= landmarks.leftEye.length;
  leftEyeCenter.y /= landmarks.leftEye.length;
  
  // 右目の重心を計算
  const rightEyeCenter = landmarks.rightEye.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 }
  );
  rightEyeCenter.x /= landmarks.rightEye.length;
  rightEyeCenter.y /= landmarks.rightEye.length;
  
  // 制御点を眼の中心に近いものでグループ分け
  controlPoints.forEach((point, index) => {
    const leftDistance = Math.sqrt(
      Math.pow(point.x - leftEyeCenter.x, 2) + Math.pow(point.y - leftEyeCenter.y, 2)
    );
    const rightDistance = Math.sqrt(
      Math.pow(point.x - rightEyeCenter.x, 2) + Math.pow(point.y - rightEyeCenter.y, 2)
    );
    
    // 眼の周辺（50ピクセル以内）にある制御点を識別
    if (leftDistance < 50) {
      leftEyeIndices.push(index);
    }
    if (rightDistance < 50) {
      rightEyeIndices.push(index);
    }
  });
  
  return { leftEye: leftEyeIndices, rightEye: rightEyeIndices };
};

/**
 * 点群の重心を計算する
 * @param points - 点群
 * @returns 重心
 */
const calculateCentroid = (points: Point[]): Point => {
  if (points.length === 0) return { x: 0, y: 0 };
  
  const sum = points.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 }
  );
  
  return {
    x: sum.x / points.length,
    y: sum.y / points.length
  };
};

/**
 * 点群の広がりを計算する
 * @param points - 点群
 * @returns 広がり（標準偏差）
 */
const calculatePointSpread = (points: Point[]): number => {
  if (points.length === 0) return 0;
  
  const center = calculateCentroid(points);
  const distances = points.map(p => 
    Math.sqrt(Math.pow(p.x - center.x, 2) + Math.pow(p.y - center.y, 2))
  );
  
  const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
  return avgDistance;
};

/**
 * 変換後ランドマークを計算する（簡易版）
 * @param landmarks - 元のランドマーク
 * @param originalPoints - 元制御点
 * @param targetPoints - 目標制御点
 * @returns 変換後ランドマーク
 */
const calculateTransformedLandmarks = (
  landmarks: FaceLandmarks,
  originalPoints: Point[],
  targetPoints: Point[]
): FaceLandmarks => {
  // 簡易的な変換（最近傍制御点の変換を適用）
  const transformPoint = (point: Point): Point => {
    let minDistance = Infinity;
    let bestTransform = { x: 0, y: 0 };
    
    for (let i = 0; i < originalPoints.length; i++) {
      const distance = Math.sqrt(
        Math.pow(point.x - originalPoints[i].x, 2) + 
        Math.pow(point.y - originalPoints[i].y, 2)
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        bestTransform = {
          x: targetPoints[i].x - originalPoints[i].x,
          y: targetPoints[i].y - originalPoints[i].y
        };
      }
    }
    
    return {
      x: point.x + bestTransform.x,
      y: point.y + bestTransform.y
    };
  };
  
  return {
    leftEye: landmarks.leftEye.map(transformPoint),
    rightEye: landmarks.rightEye.map(transformPoint),
    mouth: landmarks.mouth.map(transformPoint),
    nose: landmarks.nose.map(transformPoint),
    jawline: landmarks.jawline.map(transformPoint),
    leftEyebrow: landmarks.leftEyebrow.map(transformPoint),
    rightEyebrow: landmarks.rightEyebrow.map(transformPoint)
  };
};
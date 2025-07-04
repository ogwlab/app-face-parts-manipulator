/**
 * メッシュ変形統合処理
 * Version 5.2.0
 */

import type { Point, FaceParams, FaceLandmarks } from '../../../types/face';
import type { Triangle, TriangleMesh, DeformedTrianglePair, MeshDeformationResult } from '../triangulation/types';
import { createFaceOptimizedTriangulation } from '../triangulation/delaunay';
import { calculateAffineTransform } from './affineTransform';
import { renderTriangleMesh } from './triangleRenderer';

/**
 * 顔パラメータに基づいてランドマークを変形
 */
export function deformLandmarks(
  landmarks: FaceLandmarks,
  faceParams: FaceParams,
  imageScale: { x: number; y: number }
): FaceLandmarks {
  console.log('🔄 ランドマーク変形開始');
  
  // ディープコピー
  const deformed: FaceLandmarks = JSON.parse(JSON.stringify(landmarks));
  
  // 左目の変形
  if (faceParams.leftEye) {
    const leftEyeCenter = calculatePartCenter(landmarks.leftEye);
    deformEye(
      deformed.leftEye,
      leftEyeCenter,
      faceParams.leftEye,
      imageScale
    );
  }
  
  // 右目の変形
  if (faceParams.rightEye) {
    const rightEyeCenter = calculatePartCenter(landmarks.rightEye);
    deformEye(
      deformed.rightEye,
      rightEyeCenter,
      faceParams.rightEye,
      imageScale
    );
  }
  
  // 口の変形
  if (faceParams.mouth) {
    const mouthCenter = calculatePartCenter(landmarks.mouth);
    deformMouth(
      deformed.mouth,
      mouthCenter,
      faceParams.mouth,
      imageScale
    );
  }
  
  // 鼻の変形
  if (faceParams.nose) {
    const noseCenter = calculatePartCenter(landmarks.nose);
    deformNose(
      deformed.nose,
      noseCenter,
      faceParams.nose,
      imageScale
    );
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
  imageScale: { x: number; y: number }
): void {
  const scale = params.size;
  const dx = params.positionX * imageScale.x;
  const dy = params.positionY * imageScale.y;
  
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
  imageScale: { x: number; y: number }
): void {
  const scaleX = params.width;
  const scaleY = params.height;
  const dx = params.positionX * imageScale.x;
  const dy = params.positionY * imageScale.y;
  
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
  imageScale: { x: number; y: number }
): void {
  const scaleX = params.width;
  const scaleY = params.height;
  const dx = params.positionX * imageScale.x;
  const dy = params.positionY * imageScale.y;
  
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
  const sourceMesh = createFaceOptimizedTriangulation(
    originalPoints,
    imageWidth,
    imageHeight
  );
  
  // 2. 変形後の特徴点配列を作成（同じ順序を保つ）
  const deformedPoints = landmarksToPoints(deformedLandmarks);
  
  // 3. 変形後のメッシュを作成（三角形の接続関係は同じ）
  const targetMesh: TriangleMesh = {
    vertices: deformedPoints,
    triangles: sourceMesh.triangles.map((triangle, idx) => {
      // インデックスが有効かチェック
      if (!triangle.indices || triangle.indices.length !== 3) {
        console.error(`❌ 無効な三角形インデックス: triangle ${idx}`, triangle);
        return null;
      }
      
      const [idx0, idx1, idx2] = triangle.indices;
      
      // インデックスが範囲内かチェック
      if (idx0 < 0 || idx0 >= deformedPoints.length ||
          idx1 < 0 || idx1 >= deformedPoints.length ||
          idx2 < 0 || idx2 >= deformedPoints.length) {
        console.error(`❌ インデックスが範囲外: triangle ${idx}`, {
          indices: triangle.indices,
          deformedPointsLength: deformedPoints.length
        });
        return null;
      }
      
      // 変形後の頂点を取得
      const deformedVertices: [Point, Point, Point] = [
        deformedPoints[idx0],
        deformedPoints[idx1],
        deformedPoints[idx2]
      ];
      
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
 */
export function applyMeshDeformation(
  sourceCanvas: HTMLCanvasElement,
  targetCanvas: HTMLCanvasElement,
  deformationResult: MeshDeformationResult
): void {
  console.log('🎨 メッシュ変形適用開始');
  const startTime = performance.now();
  
  // Canvasをクリア
  const targetCtx = targetCanvas.getContext('2d');
  if (!targetCtx) {
    console.error('Target canvas context取得エラー');
    return;
  }
  
  targetCtx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
  
  // 三角形メッシュをレンダリング
  renderTriangleMesh(
    sourceCanvas,
    targetCanvas,
    deformationResult.trianglePairs
  );
  
  const endTime = performance.now();
  console.log(`✅ メッシュ変形適用完了: ${(endTime - startTime).toFixed(1)}ms`);
}

/**
 * 統合された変形処理
 */
export function performMeshBasedDeformation(
  sourceImageElement: HTMLImageElement,
  landmarks: FaceLandmarks,
  faceParams: FaceParams,
  canvasWidth: number,
  canvasHeight: number
): HTMLCanvasElement {
  console.log('🚀 [Version 5.2.0] メッシュベース変形処理開始');
  
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
  
  // 3. ランドマークを変形
  const deformedLandmarks = deformLandmarks(landmarks, faceParams, imageScale);
  
  // 4. メッシュ変形を作成
  const deformationResult = createMeshDeformation(
    landmarks,
    deformedLandmarks,
    canvasWidth,
    canvasHeight
  );
  
  // 5. ターゲットCanvasを作成
  const targetCanvas = document.createElement('canvas');
  targetCanvas.width = canvasWidth;
  targetCanvas.height = canvasHeight;
  
  // 6. 変形を適用
  applyMeshDeformation(sourceCanvas, targetCanvas, deformationResult);
  
  console.log('✅ [Version 5.2.0] メッシュベース変形処理完了');
  return targetCanvas;
}
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
  console.log(`🎨 メッシュ変形適用開始 (${renderMode}モード)`);
  const startTime = performance.now();
  
  // Canvasをクリア
  const targetCtx = targetCanvas.getContext('2d');
  if (!targetCtx) {
    console.error('Target canvas context取得エラー');
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
      console.log('🔄 バックワードマッピングモードで実行');
      renderTriangleMeshBackward(
        sourceCanvas,
        targetCanvas,
        trianglePairs
      );
      break;
      
    case 'hybrid':
      console.log('🔀 ハイブリッドモードで実行');
      renderTriangleMeshHybrid(
        sourceCanvas,
        targetCanvas,
        deformationResult.trianglePairs
      );
      break;
      
    case 'forward':
    default:
      console.log('➡️ フォワードマッピングモードで実行');
      renderTriangleMesh(
        sourceCanvas,
        targetCanvas,
        deformationResult.trianglePairs
      );
      break;
  }
  
  const endTime = performance.now();
  console.log(`✅ メッシュ変形適用完了: ${(endTime - startTime).toFixed(1)}ms`);
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
  const deformedLandmarks = deformLandmarks(scaledLandmarks, faceParams, { x: 1, y: 1 }); // スケール済みなので1.0を使用
  
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
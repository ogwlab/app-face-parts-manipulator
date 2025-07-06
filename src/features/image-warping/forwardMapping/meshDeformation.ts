/**
 * メッシュ変形統合処理
 * Version 6.0.0 - 密ランドマーク対応
 */

import type { Point, FaceParams, FaceLandmarks, EyeParams } from '../../../types/face';
import type { UnifiedLandmarks } from '../../../types/unifiedLandmarks';
import type { Triangle, TriangleMesh, DeformedTrianglePair, MeshDeformationResult } from '../triangulation/types';
import { createFaceOptimizedTriangulation, generateBoundaryPoints } from '../triangulation/delaunay';
import { calculateAffineTransform } from './affineTransform';
import { renderTriangleMesh, drawMeshEdges } from './triangleRenderer';
import { renderTriangleMeshBackward } from './backwardRenderer';
import { renderTriangleMeshHybrid } from './hybridRenderer';
import { generateDenseEyeLandmarks, applyIrisMovementToDenseLandmarks, flattenDenseLandmarks } from '../../iris-control/denseEyeLandmarks';

// 虹彩オフセット制限値
const IRIS_OFFSET_LIMITS = {
  maxX: 0.3,  // 目の幅の30%
  maxY: 0.2   // 目の高さの20%
} as const;

// 削除: グローバル変数は不要（UnifiedLandmarksで管理）

/**
 * 顔パラメータに基づいてランドマークを変形（統一システム版）
 * 常に密ランドマークを生成し、モード切り替えによる不連続性を排除
 */
export function deformLandmarks(
  landmarks: FaceLandmarks,
  faceParams: FaceParams,
  imageScale: { x: number; y: number },
  sourceCanvas?: HTMLCanvasElement
): UnifiedLandmarks {
  console.log('🔄 [UnifiedSystem] ランドマーク変形開始（統一システム）');
  
  // ディープコピー
  const deformed: FaceLandmarks = JSON.parse(JSON.stringify(landmarks));
  
  // 統一ランドマーク構造を初期化
  const unifiedResult: UnifiedLandmarks = {
    standard: deformed,
    dense: {}
  };
  
  // 左目の変形（常に密ランドマークを生成）
  if (faceParams.leftEye) {
    const leftEyeCenter = calculatePartCenter(landmarks.leftEye);
    
    if (sourceCanvas) {
      // 密ランドマークを生成
      const denseLandmarks = generateDenseEyeLandmarks(
        sourceCanvas,
        landmarks.leftEye,
        leftEyeCenter,
        faceParams.leftEye
      );
      
      // 虹彩移動を適用
      const irisOffset = {
        x: faceParams.leftEye.irisOffsetX || 0,
        y: faceParams.leftEye.irisOffsetY || 0
      };
      
      const deformedDense = applyIrisMovementToDenseLandmarks(
        denseLandmarks,
        irisOffset,
        faceParams.leftEye
      );
      
      // 基本変形を適用
      const scaledPoints = flattenDenseLandmarks(deformedDense);
      applyEyeTransformation(
        scaledPoints,
        leftEyeCenter,
        faceParams.leftEye,
        imageScale
      );
      
      // 結果を保存
      unifiedResult.dense.leftEye = scaledPoints;
      unifiedResult.standard.leftEye = scaledPoints.slice(0, 6);
    } else {
      // Canvas無しの場合は従来の変形
      deformEye(
        unifiedResult.standard.leftEye,
        leftEyeCenter,
        faceParams.leftEye,
        imageScale,
        '左目'
      );
    }
  }
  
  // 右目の変形（常に密ランドマークを生成）
  if (faceParams.rightEye) {
    const rightEyeCenter = calculatePartCenter(landmarks.rightEye);
    
    if (sourceCanvas) {
      // 密ランドマークを生成
      const denseLandmarks = generateDenseEyeLandmarks(
        sourceCanvas,
        landmarks.rightEye,
        rightEyeCenter,
        faceParams.rightEye
      );
      
      // 虹彩移動を適用
      const irisOffset = {
        x: faceParams.rightEye.irisOffsetX || 0,
        y: faceParams.rightEye.irisOffsetY || 0
      };
      
      const deformedDense = applyIrisMovementToDenseLandmarks(
        denseLandmarks,
        irisOffset,
        faceParams.rightEye
      );
      
      // 基本変形を適用
      const scaledPoints = flattenDenseLandmarks(deformedDense);
      applyEyeTransformation(
        scaledPoints,
        rightEyeCenter,
        faceParams.rightEye,
        imageScale
      );
      
      // 結果を保存
      unifiedResult.dense.rightEye = scaledPoints;
      unifiedResult.standard.rightEye = scaledPoints.slice(0, 6);
    } else {
      // Canvas無しの場合は従来の変形
      deformEye(
        unifiedResult.standard.rightEye,
        rightEyeCenter,
        faceParams.rightEye,
        imageScale,
        '右目'
      );
    }
  }
  
  // 口の変形
  if (faceParams.mouth) {
    const mouthCenter = calculatePartCenter(landmarks.mouth);
    deformMouth(
      unifiedResult.standard.mouth,
      mouthCenter,
      faceParams.mouth,
      imageScale
    );
  }
  
  // 鼻の変形
  if (faceParams.nose) {
    const noseCenter = calculatePartCenter(landmarks.nose);
    deformNose(
      unifiedResult.standard.nose,
      noseCenter,
      faceParams.nose,
      imageScale
    );
  }
  
  console.log('✅ [UnifiedSystem] 変形完了:', {
    leftEye: unifiedResult.dense.leftEye?.length || 6,
    rightEye: unifiedResult.dense.rightEye?.length || 6
  });
  
  return unifiedResult;
}

/**
 * 密ランドマークに対して目の変形を適用
 */
function applyEyeTransformation(
  points: Point[],
  center: Point,
  eyeParams: EyeParams,
  imageScale: { x: number; y: number }
): void {
  const scaleX = eyeParams.size * imageScale.x;
  const scaleY = eyeParams.size * imageScale.y;
  const offsetX = eyeParams.positionX * 1.0;
  const offsetY = eyeParams.positionY * 1.0;
  
  // 各点に対して変形を適用
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    
    // 中心からの相対位置
    const relX = p.x - center.x;
    const relY = p.y - center.y;
    
    // スケーリングと移動を適用
    p.x = center.x + relX * scaleX + offsetX;
    p.y = center.y + relY * scaleY + offsetY;
  }
}

// [削除] 旧密ランドマーク変形関数群
// UnifiedLandmarksシステムに移行したため不要


/**
 * 虹彩オフセットを安全に取得
 * 注意: レイヤーベース虹彩制御が有効な場合は、変形システムでの虹彩処理を無効化
 */
function getIrisOffset(eyeParams: EyeParams): { x: number; y: number } {
  // レイヤーベース虹彩制御システムが有効な場合は、
  // 変形システムでの虹彩オフセットを無効化して目の形状変形を防ぐ
  const USE_LAYER_BASED_IRIS_CONTROL = false; // メッシュ変形システムの虹彩制御を使用
  
  const originalOffset = {
    x: eyeParams.irisOffsetX ?? 0,
    y: eyeParams.irisOffsetY ?? 0
  };
  
  if (USE_LAYER_BASED_IRIS_CONTROL) {
    console.log('🔍 [Mesh] 虹彩オフセット無効化:', {
      originalOffset,
      returnValue: { x: 0, y: 0 }
    });
    return { x: 0, y: 0 }; // 変形システムでは虹彩を動かさない
  }
  
  return originalOffset;
}

/**
 * 虹彩オフセットの制約を適用
 */
function constrainIrisOffset(offset: { x: number; y: number }): { x: number; y: number } {
  return {
    x: Math.max(-IRIS_OFFSET_LIMITS.maxX, Math.min(IRIS_OFFSET_LIMITS.maxX, offset.x)),
    y: Math.max(-IRIS_OFFSET_LIMITS.maxY, Math.min(IRIS_OFFSET_LIMITS.maxY, offset.y))
  };
}

/**
 * 虹彩境界ポイントを生成（円形近似）
 * TODO: Phase 3で使用予定
 */
// function generateIrisPoints(center: Point, radius: number, pointCount: number = 8): Point[] {
//   const points: Point[] = [];
//   for (let i = 0; i < pointCount; i++) {
//     const angle = (2 * Math.PI * i) / pointCount;
//     points.push({
//       x: center.x + radius * Math.cos(angle),
//       y: center.y + radius * Math.sin(angle)
//     });
//   }
//   return points;
// }

/**
 * 目の変形（虹彩オフセット対応版）
 */
function deformEye(
  eyePoints: Point[],
  center: Point,
  params: EyeParams,
  imageScale: { x: number; y: number },
  eyeType?: string
): void {
  const eye = eyeType || '目';
  
  console.log(`👁️ [Mesh] ${eye}の変形開始:`, {
    eyePointsCount: eyePoints.length,
    center: { x: center.x.toFixed(2), y: center.y.toFixed(2) },
    size: params.size,
    positionX: params.positionX,
    positionY: params.positionY,
    irisOffsetX: params.irisOffsetX,
    irisOffsetY: params.irisOffsetY
  });

  const scale = params.size;
  const dx = params.positionX * imageScale.x;
  const dy = params.positionY * imageScale.y;
  
  // 虹彩オフセットを取得・制約適用
  const irisOffset = getIrisOffset(params);
  const constrainedOffset = constrainIrisOffset(irisOffset);
  
  // 目全体の新しい中心位置
  const newEyeCenter = {
    x: center.x + dx,
    y: center.y + dy
  };
  
  // 目の境界ボックスを計算（虹彩オフセット計算用）
  const eyeBounds = {
    minX: Math.min(...eyePoints.map(p => p.x)),
    maxX: Math.max(...eyePoints.map(p => p.x)),
    minY: Math.min(...eyePoints.map(p => p.y)),
    maxY: Math.max(...eyePoints.map(p => p.y))
  };
  const eyeWidth = eyeBounds.maxX - eyeBounds.minX;
  const eyeHeight = eyeBounds.maxY - eyeBounds.minY;
  
  // 虹彩の新しい中心位置（目全体の移動 + 虹彩オフセット）
  const newIrisCenter = {
    x: newEyeCenter.x + (eyeWidth * constrainedOffset.x),
    y: newEyeCenter.y + (eyeHeight * constrainedOffset.y)
  };
  
  // デバッグログ
  if (constrainedOffset.x !== 0 || constrainedOffset.y !== 0) {
    console.log('👁️ [Mesh] 虹彩オフセット適用:');
    console.log('  元のオフセット:', `X=${irisOffset.x.toFixed(2)}, Y=${irisOffset.y.toFixed(2)}`);
    console.log('  制約後オフセット:', `X=${constrainedOffset.x.toFixed(2)}, Y=${constrainedOffset.y.toFixed(2)}`);
    console.log('  目のサイズ:', `幅=${eyeWidth.toFixed(2)}, 高さ=${eyeHeight.toFixed(2)}`);
    console.log('  目の新中心:', `(${newEyeCenter.x.toFixed(2)}, ${newEyeCenter.y.toFixed(2)})`);
    console.log('  虹彩の新中心:', `(${newIrisCenter.x.toFixed(2)}, ${newIrisCenter.y.toFixed(2)})`);
    console.log('  虹彩の移動量:', `X=${(newIrisCenter.x - newEyeCenter.x).toFixed(2)}, Y=${(newIrisCenter.y - newEyeCenter.y).toFixed(2)}`);
  }
  
  // 虹彩半径の近似（目の幅の35%）
  const irisRadius = eyeWidth * 0.35;
  
  // 3層制御による変形適用
  let irisPointCount = 0;
  let contourPointCount = 0;
  
  for (let i = 0; i < eyePoints.length; i++) {
    const point = eyePoints[i];
    
    // 中心からの相対位置
    const relX = point.x - center.x;
    const relY = point.y - center.y;
    const distanceFromCenter = Math.sqrt(relX * relX + relY * relY);
    
    if (distanceFromCenter <= irisRadius) {
      // 層1: 虹彩・瞳孔領域（虹彩中心に追従）
      eyePoints[i] = {
        x: newIrisCenter.x + relX * scale,
        y: newIrisCenter.y + relY * scale
      };
      irisPointCount++;
    } else {
      // 層2: 外側輪郭（目全体の中心に追従）
      eyePoints[i] = {
        x: newEyeCenter.x + relX * scale,
        y: newEyeCenter.y + relY * scale
      };
      contourPointCount++;
    }
  }
  
  // デバッグ: 点の分布
  const hasIrisOffset = constrainedOffset.x !== 0 || constrainedOffset.y !== 0;
  if (hasIrisOffset) {
    console.log('👁️ [Mesh] 3層制御適用結果:');
    console.log('  総ランドマーク数:', eyePoints.length);
    console.log('  虹彩領域の点数:', irisPointCount);
    console.log('  輪郭領域の点数:', contourPointCount);
    console.log('  虹彩半径:', `${irisRadius.toFixed(2)}px (目の幅の35%)`);
  }
  
  console.log('✅ [Mesh] 目の変形完了');
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
  originalLandmarks: FaceLandmarks | UnifiedLandmarks,
  deformedLandmarks: FaceLandmarks | UnifiedLandmarks,
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
  
  // 重要: ポイント数が一致しない場合はエラー
  if (originalPoints.length !== deformedPoints.length) {
    console.error(`❌ ポイント数不一致: original=${originalPoints.length}, deformed=${deformedPoints.length}`);
    // ポイント数を合わせるための処理
    while (deformedPoints.length < originalPoints.length) {
      // 不足分は最後の点を複製
      const lastPoint = deformedPoints[deformedPoints.length - 1];
      deformedPoints.push({ ...lastPoint });
    }
    while (deformedPoints.length > originalPoints.length) {
      // 余剰分を削除
      deformedPoints.pop();
    }
    console.log(`🔧 ポイント数を調整: ${deformedPoints.length}`);
  }
  
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
 * ランドマークを点配列に変換（UnifiedLandmarks対応版）
 */
function landmarksToPoints(landmarks: FaceLandmarks | UnifiedLandmarks): Point[] {
  const points: Point[] = [];
  
  // UnifiedLandmarksの場合はstandardを使用
  const standardLandmarks = 'standard' in landmarks ? landmarks.standard : landmarks;
  // const denseLandmarks = 'dense' in landmarks ? landmarks.dense : null; // 一時的に無効化
  
  // 顔の輪郭
  points.push(...standardLandmarks.jawline);
  
  // 左眉
  points.push(...standardLandmarks.leftEyebrow);
  
  // 右眉
  points.push(...standardLandmarks.rightEyebrow);
  
  // 鼻
  points.push(...standardLandmarks.nose);
  
  // 左目（一時的に密ランドマークを無効化）
  // TODO: 密ランドマークの点数を固定化する必要がある
  points.push(...standardLandmarks.leftEye);
  
  // 右目（一時的に密ランドマークを無効化）
  // TODO: 密ランドマークの点数を固定化する必要がある
  points.push(...standardLandmarks.rightEye);
  
  // 口
  points.push(...standardLandmarks.mouth);
  
  console.log(`📊 [landmarksToPoints] 総ランドマーク数: ${points.length}点`);
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
  
  console.log('🖼️ [MeshDeformation] Input確認:', {
    imageElement: {
      naturalWidth: sourceImageElement.naturalWidth,
      naturalHeight: sourceImageElement.naturalHeight,
      complete: sourceImageElement.complete
    },
    canvasSize: { width: canvasWidth, height: canvasHeight }
  });
  
  // 元画像を描画
  sourceCtx.drawImage(sourceImageElement, 0, 0, canvasWidth, canvasHeight);
  
  // デバッグ: 実際に描画された内容を保存
  const debugDataUrl = sourceCanvas.toDataURL('image/png');
  console.log('🎨 [MeshDeformation] ソースCanvasのDataURL:', debugDataUrl.substring(0, 100) + '...');
  
  // 描画確認 - 複数点をチェック
  const testPoints = [
    { x: 100, y: 100, label: 'top-left' },
    { x: canvasWidth / 2, y: canvasHeight / 2, label: 'center' },
    { x: canvasWidth - 100, y: canvasHeight - 100, label: 'bottom-right' }
  ];
  
  console.log('🎨 [MeshDeformation] ソース描画確認:');
  testPoints.forEach(point => {
    const data = sourceCtx.getImageData(Math.floor(point.x), Math.floor(point.y), 1, 1);
    console.log(`  ${point.label}: rgba(${data.data[0]}, ${data.data[1]}, ${data.data[2]}, ${data.data[3]})`);
  });
  
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
  
  // 4. スケール済みランドマークを変形（密ランドマーク対応）
  const unifiedDeformed = deformLandmarks(scaledLandmarks, faceParams, { x: 1, y: 1 }, sourceCanvas); // スケール済みなので1.0を使用
  
  // デバッグ: UnifiedLandmarks構造の確認
  console.log('🔍 [UnifiedLandmarks] 変形結果:', {
    hasStandard: 'standard' in unifiedDeformed,
    hasDense: 'dense' in unifiedDeformed,
    denseLeftEye: unifiedDeformed.dense?.leftEye?.length || 0,
    denseRightEye: unifiedDeformed.dense?.rightEye?.length || 0
  });
  
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
    unifiedDeformed,  // UnifiedLandmarksを直接渡す
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
  
  // デバッグ: 結果キャンバスの内容を確認
  const resultCtx = targetCanvas.getContext('2d');
  if (resultCtx) {
    const imageData = resultCtx.getImageData(0, 0, targetCanvas.width, targetCanvas.height);
    let pixelCount = 0;
    for (let i = 0; i < imageData.data.length; i += 4) {
      if (imageData.data[i+3] > 0) { // アルファ値が0より大きいピクセルをカウント
        pixelCount++;
      }
    }
    console.log('🖼️ [MeshDeformation] 結果キャンバス:', {
      width: targetCanvas.width,
      height: targetCanvas.height,
      totalPixels: (targetCanvas.width * targetCanvas.height),
      nonTransparentPixels: pixelCount,
      coverage: `${(pixelCount / (targetCanvas.width * targetCanvas.height) * 100).toFixed(1)}%`
    });
  }
  
  // [削除] グローバル変数は使用しない（UnifiedLandmarksで管理）
  
  return targetCanvas;
}
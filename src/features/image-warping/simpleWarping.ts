import type { Point, FaceParams, FaceLandmarks } from '../../types/face';

/**
 * 簡単な画像ワーピング処理（fabric.jsを使わない）
 */

/**
 * 顔パーツの境界ボックスを計算
 */
export function calculatePartBounds(points: Point[]): {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
} {
  if (points.length === 0) {
    throw new Error('点が指定されていません');
  }

  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);

  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);

  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
  };
}

/**
 * 単純な領域スケーリング変形
 */
function applySimplePartTransform(
  sourceCanvas: HTMLCanvasElement,
  targetCanvas: HTMLCanvasElement,
  partBounds: { left: number; top: number; right: number; bottom: number; centerX: number; centerY: number },
  scaleX: number,
  scaleY: number,
  offsetX: number,
  offsetY: number,
  padding: number = 20
): void {
  const sourceCtx = sourceCanvas.getContext('2d');
  const targetCtx = targetCanvas.getContext('2d');

  if (!sourceCtx || !targetCtx) {
    throw new Error('Canvas context を取得できません');
  }

  console.log('🎨 単純変形処理開始:', { partBounds, scaleX, scaleY, offsetX, offsetY });

  // 元画像をコピー
  targetCtx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
  targetCtx.drawImage(sourceCanvas, 0, 0);

  // 変形領域を計算（パディング付き）
  const regionLeft = Math.max(0, partBounds.left - padding);
  const regionTop = Math.max(0, partBounds.top - padding);
  const regionWidth = Math.min(
    partBounds.right - partBounds.left + padding * 2,
    sourceCanvas.width - regionLeft
  );
  const regionHeight = Math.min(
    partBounds.bottom - partBounds.top + padding * 2,
    sourceCanvas.height - regionTop
  );

  // 領域のピクセルデータを取得
  const imageData = sourceCtx.getImageData(regionLeft, regionTop, regionWidth, regionHeight);

  // 変形を適用
  targetCtx.save();
  
  // 変形の中心点を設定
  const centerX = partBounds.centerX + offsetX;
  const centerY = partBounds.centerY + offsetY;
  
  // 変形マトリックスを適用
  targetCtx.translate(centerX, centerY);
  targetCtx.scale(scaleX, scaleY);
  targetCtx.translate(-centerX, -centerY);

  // 一時的なCanvas を作成
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = regionWidth;
  tempCanvas.height = regionHeight;
  const tempCtx = tempCanvas.getContext('2d');

  if (tempCtx) {
    tempCtx.putImageData(imageData, 0, 0);
    targetCtx.drawImage(tempCanvas, regionLeft, regionTop);
  }

  targetCtx.restore();
  console.log('✅ 単純変形処理完了');
}

/**
 * 簡単な顔ワーピング処理
 */
export function applySimpleFaceWarping(
  sourceImageElement: HTMLImageElement,
  landmarks: FaceLandmarks,
  faceParams: FaceParams,
  canvasWidth: number,
  canvasHeight: number
): HTMLCanvasElement {
  console.log('🎨 簡単な顔ワーピング開始:', { faceParams, canvasWidth, canvasHeight });

  // Canvasを作成
  const sourceCanvas = document.createElement('canvas');
  const targetCanvas = document.createElement('canvas');
  
  sourceCanvas.width = canvasWidth;
  sourceCanvas.height = canvasHeight;
  targetCanvas.width = canvasWidth;
  targetCanvas.height = canvasHeight;

  const sourceCtx = sourceCanvas.getContext('2d');
  if (!sourceCtx) {
    throw new Error('Source canvas context を取得できません');
  }

  // 元画像を描画
  sourceCtx.drawImage(sourceImageElement, 0, 0, canvasWidth, canvasHeight);

  // 画像のスケールを計算
  const scaleX = canvasWidth / sourceImageElement.naturalWidth;
  const scaleY = canvasHeight / sourceImageElement.naturalHeight;

  console.log('📏 画像スケール:', { scaleX, scaleY });

  let currentCanvas = sourceCanvas;

  try {
    // 左目の変形
    if (faceParams.leftEye.size !== 1.0 || faceParams.leftEye.positionX !== 0 || faceParams.leftEye.positionY !== 0) {
      console.log('👁️ 左目変形適用');
      const eyeBounds = calculatePartBounds(landmarks.leftEye.map(p => ({
        x: p.x * scaleX,
        y: p.y * scaleY
      })));
      
      const newCanvas = document.createElement('canvas');
      newCanvas.width = canvasWidth;
      newCanvas.height = canvasHeight;
      
      applySimplePartTransform(
        currentCanvas,
        newCanvas,
        eyeBounds,
        faceParams.leftEye.size,
        faceParams.leftEye.size,
        faceParams.leftEye.positionX * 2,
        faceParams.leftEye.positionY * 2
      );
      currentCanvas = newCanvas;
    }

    // 右目の変形
    if (faceParams.rightEye.size !== 1.0 || faceParams.rightEye.positionX !== 0 || faceParams.rightEye.positionY !== 0) {
      console.log('👁️ 右目変形適用');
      const eyeBounds = calculatePartBounds(landmarks.rightEye.map(p => ({
        x: p.x * scaleX,
        y: p.y * scaleY
      })));
      
      const newCanvas = document.createElement('canvas');
      newCanvas.width = canvasWidth;
      newCanvas.height = canvasHeight;
      
      applySimplePartTransform(
        currentCanvas,
        newCanvas,
        eyeBounds,
        faceParams.rightEye.size,
        faceParams.rightEye.size,
        faceParams.rightEye.positionX * 2,
        faceParams.rightEye.positionY * 2
      );
      currentCanvas = newCanvas;
    }

    // 口の変形
    if (faceParams.mouth.width !== 1.0 || faceParams.mouth.height !== 1.0 || 
        faceParams.mouth.positionX !== 0 || faceParams.mouth.positionY !== 0) {
      console.log('👄 口変形適用');
      const mouthBounds = calculatePartBounds(landmarks.mouth.map(p => ({
        x: p.x * scaleX,
        y: p.y * scaleY
      })));
      
      const newCanvas = document.createElement('canvas');
      newCanvas.width = canvasWidth;
      newCanvas.height = canvasHeight;
      
      applySimplePartTransform(
        currentCanvas,
        newCanvas,
        mouthBounds,
        faceParams.mouth.width,
        faceParams.mouth.height,
        faceParams.mouth.positionX * 1.5,
        faceParams.mouth.positionY * 1.5
      );
      currentCanvas = newCanvas;
    }

    // 鼻の変形
    if (faceParams.nose.width !== 1.0 || faceParams.nose.height !== 1.0 || 
        faceParams.nose.positionX !== 0 || faceParams.nose.positionY !== 0) {
      console.log('👃 鼻変形適用');
      const noseBounds = calculatePartBounds(landmarks.nose.map(p => ({
        x: p.x * scaleX,
        y: p.y * scaleY
      })));
      
      const newCanvas = document.createElement('canvas');
      newCanvas.width = canvasWidth;
      newCanvas.height = canvasHeight;
      
      applySimplePartTransform(
        currentCanvas,
        newCanvas,
        noseBounds,
        faceParams.nose.width,
        faceParams.nose.height,
        faceParams.nose.positionX * 1.2,
        faceParams.nose.positionY * 1.2
      );
      currentCanvas = newCanvas;
    }

    console.log('✅ 簡単な顔ワーピング完了');
    return currentCanvas;

  } catch (error) {
    console.error('❌ 簡単な顔ワーピング失敗:', error);
    return sourceCanvas; // エラー時は元のCanvasを返す
  }
}
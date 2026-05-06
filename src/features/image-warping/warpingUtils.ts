import * as fabric from 'fabric';
import type { Point, FaceParams, FaceLandmarks } from '../../types/face';

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
 * 画像上の座標をCanvas座標に変換
 */
export function imageToCanvasCoordinates(
  imagePoint: Point,
  imageWidth: number,
  imageHeight: number,
  canvasImage: fabric.Image
): Point {
  const scaleX = canvasImage.scaleX || 1;
  const scaleY = canvasImage.scaleY || 1;
  const left = canvasImage.left || 0;
  const top = canvasImage.top || 0;

  // 画像の実際の表示サイズを計算
  const displayWidth = imageWidth * scaleX;
  const displayHeight = imageHeight * scaleY;

  // 画像の左上角の座標を計算
  const imageLeft = left - displayWidth / 2;
  const imageTop = top - displayHeight / 2;

  return {
    x: imageLeft + (imagePoint.x / imageWidth) * displayWidth,
    y: imageTop + (imagePoint.y / imageHeight) * displayHeight,
  };
}

/**
 * 局所座標系での変形マトリックスを生成
 */
export function createTransformMatrix(
  center: Point,
  scaleX: number,
  scaleY: number,
  translateX: number,
  translateY: number
): number[] {
  // アフィン変換マトリックス [a, b, c, d, e, f]
  // [x']   [a c e] [x]
  // [y'] = [b d f] [y]
  // [1 ]   [0 0 1] [1]
  
  return [
    scaleX,  // a: x方向のスケール
    0,       // b: y方向のスキュー
    0,       // c: x方向のスキュー  
    scaleY,  // d: y方向のスケール
    center.x + translateX - center.x * scaleX, // e: x方向の平行移動
    center.y + translateY - center.y * scaleY  // f: y方向の平行移動
  ];
}

/**
 * 顔パーツの変形領域を計算
 */
export function calculateWarpRegion(
  landmarks: Point[],
  padding: number = 10
): {
  bounds: { left: number; top: number; right: number; bottom: number };
  center: Point;
  width: number;
  height: number;
} {
  const bounds = calculatePartBounds(landmarks);
  
  return {
    bounds: {
      left: bounds.left - padding,
      top: bounds.top - padding,
      right: bounds.right + padding,
      bottom: bounds.bottom + padding,
    },
    center: {
      x: bounds.centerX,
      y: bounds.centerY,
    },
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2,
  };
}

/**
 * Canvas要素に特定領域の変形を適用
 */
function applyRegionTransform(
  sourceCanvas: HTMLCanvasElement,
  targetCanvas: HTMLCanvasElement,
  region: { bounds: { left: number; top: number; right: number; bottom: number }; center: Point },
  transform: number[]
): void {
  const sourceCtx = sourceCanvas.getContext('2d');
  const targetCtx = targetCanvas.getContext('2d');
  
  if (!sourceCtx || !targetCtx) {
    throw new Error('Canvas context を取得できません');
  }

  // 元の画像をコピー
  targetCtx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
  targetCtx.drawImage(sourceCanvas, 0, 0);

  // 変形領域のピクセルデータを取得
  const regionWidth = Math.ceil(region.bounds.right - region.bounds.left);
  const regionHeight = Math.ceil(region.bounds.bottom - region.bounds.top);
  
  const imageData = sourceCtx.getImageData(
    Math.max(0, Math.floor(region.bounds.left)),
    Math.max(0, Math.floor(region.bounds.top)),
    Math.min(regionWidth, sourceCanvas.width - Math.floor(region.bounds.left)),
    Math.min(regionHeight, sourceCanvas.height - Math.floor(region.bounds.top))
  );

  // 変形を適用
  targetCtx.save();
  targetCtx.setTransform(
    transform[0], transform[1], transform[2], 
    transform[3], transform[4], transform[5]
  );
  
  // 変形された領域を描画
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = imageData.width;
  tempCanvas.height = imageData.height;
  const tempCtx = tempCanvas.getContext('2d');
  
  if (tempCtx) {
    tempCtx.putImageData(imageData, 0, 0);
    targetCtx.drawImage(
      tempCanvas,
      region.bounds.left,
      region.bounds.top
    );
  }
  
  targetCtx.restore();
}

/**
 * 目のワーピング処理
 */
export function createEyeWarp(
  originalImage: fabric.Image,
  landmarks: FaceLandmarks,
  params: { size: number; positionX: number; positionY: number },
  isLeftEye: boolean
): fabric.Image {
  if (!originalImage.width || !originalImage.height) {
    throw new Error('画像のサイズが不正です');
  }

  const eyePoints = isLeftEye ? landmarks.leftEye : landmarks.rightEye;
  
  // 目の変形領域を計算
  const warpRegion = calculateWarpRegion(eyePoints, 15);
  
  // 変形パラメータの調整（UI値をピクセル値に変換）
  const pixelOffsetX = params.positionX * 2; // UIの1単位 = 2ピクセル
  const pixelOffsetY = params.positionY * 2;
  
  // 変形マトリックスを生成
  const transform = createTransformMatrix(
    warpRegion.center,
    params.size,    // X方向スケール
    params.size,    // Y方向スケール
    pixelOffsetX,   // X方向移動
    pixelOffsetY    // Y方向移動
  );

  // 元の画像要素を取得
  const sourceElement = originalImage.getElement() as HTMLImageElement | HTMLCanvasElement;
  
  // 新しいCanvas要素を作成
  const newCanvas = document.createElement('canvas');
  newCanvas.width = sourceElement.width || originalImage.width;
  newCanvas.height = sourceElement.height || originalImage.height;
  
  // 元の画像をCanvasに描画
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = newCanvas.width;
  sourceCanvas.height = newCanvas.height;
  const sourceCtx = sourceCanvas.getContext('2d');
  
  if (sourceCtx) {
    sourceCtx.drawImage(sourceElement, 0, 0);
    
    // 変形を適用
    applyRegionTransform(sourceCanvas, newCanvas, warpRegion, transform);
  }

  // 新しいfabric.Image を作成
  const warpedImage = new fabric.Image(newCanvas, {
    left: originalImage.left,
    top: originalImage.top,
    scaleX: originalImage.scaleX,
    scaleY: originalImage.scaleY,
    selectable: false,
    evented: false,
  });

  return warpedImage;
}

/**
 * 口のワーピング処理
 */
export function createMouthWarp(
  originalImage: fabric.Image,
  landmarks: FaceLandmarks,
  params: { width: number; height: number; positionX: number; positionY: number }
): fabric.Image {
  if (!originalImage.width || !originalImage.height) {
    throw new Error('画像のサイズが不正です');
  }

  const mouthPoints = landmarks.mouth;
  
  // 口の変形領域を計算（口は横長なので少し大きめのパディング）
  const warpRegion = calculateWarpRegion(mouthPoints, 20);
  
  // 変形パラメータの調整（UI値をピクセル値に変換）
  const pixelOffsetX = params.positionX * 1.5; // UIの1単位 = 1.5ピクセル
  const pixelOffsetY = params.positionY * 1.5;
  
  // 変形マトリックスを生成（幅と高さを個別に設定）
  const transform = createTransformMatrix(
    warpRegion.center,
    params.width,   // X方向スケール（幅）
    params.height,  // Y方向スケール（高さ）
    pixelOffsetX,   // X方向移動
    pixelOffsetY    // Y方向移動
  );

  // 元の画像要素を取得
  const sourceElement = originalImage.getElement() as HTMLImageElement | HTMLCanvasElement;
  
  // 新しいCanvas要素を作成
  const newCanvas = document.createElement('canvas');
  newCanvas.width = sourceElement.width || originalImage.width;
  newCanvas.height = sourceElement.height || originalImage.height;
  
  // 元の画像をCanvasに描画
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = newCanvas.width;
  sourceCanvas.height = newCanvas.height;
  const sourceCtx = sourceCanvas.getContext('2d');
  
  if (sourceCtx) {
    sourceCtx.drawImage(sourceElement, 0, 0);
    
    // 変形を適用
    applyRegionTransform(sourceCanvas, newCanvas, warpRegion, transform);
  }

  // 新しいfabric.Image を作成
  const warpedImage = new fabric.Image(newCanvas, {
    left: originalImage.left,
    top: originalImage.top,
    scaleX: originalImage.scaleX,
    scaleY: originalImage.scaleY,
    selectable: false,
    evented: false,
  });

  return warpedImage;
}

/**
 * 鼻のワーピング処理
 */
export function createNoseWarp(
  originalImage: fabric.Image,
  landmarks: FaceLandmarks,
  params: { width: number; height: number; positionX: number; positionY: number }
): fabric.Image {
  if (!originalImage.width || !originalImage.height) {
    throw new Error('画像のサイズが不正です');
  }

  const nosePoints = landmarks.nose;
  
  // 鼻の変形領域を計算（鼻は縦長なので適度なパディング）
  const warpRegion = calculateWarpRegion(nosePoints, 12);
  
  // 変形パラメータの調整（UI値をピクセル値に変換）
  const pixelOffsetX = params.positionX * 1.2; // UIの1単位 = 1.2ピクセル
  const pixelOffsetY = params.positionY * 1.2;
  
  // 変形マトリックスを生成（幅と高さを個別に設定）
  const transform = createTransformMatrix(
    warpRegion.center,
    params.width,   // X方向スケール（幅）
    params.height,  // Y方向スケール（高さ）
    pixelOffsetX,   // X方向移動
    pixelOffsetY    // Y方向移動
  );

  // 元の画像要素を取得
  const sourceElement = originalImage.getElement() as HTMLImageElement | HTMLCanvasElement;
  
  // 新しいCanvas要素を作成
  const newCanvas = document.createElement('canvas');
  newCanvas.width = sourceElement.width || originalImage.width;
  newCanvas.height = sourceElement.height || originalImage.height;
  
  // 元の画像をCanvasに描画
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = newCanvas.width;
  sourceCanvas.height = newCanvas.height;
  const sourceCtx = sourceCanvas.getContext('2d');
  
  if (sourceCtx) {
    sourceCtx.drawImage(sourceElement, 0, 0);
    
    // 変形を適用
    applyRegionTransform(sourceCanvas, newCanvas, warpRegion, transform);
  }

  // 新しいfabric.Image を作成
  const warpedImage = new fabric.Image(newCanvas, {
    left: originalImage.left,
    top: originalImage.top,
    scaleX: originalImage.scaleX,
    scaleY: originalImage.scaleY,
    selectable: false,
    evented: false,
  });

  return warpedImage;
}

/**
 * 単一パーツのワーピングを適用
 */
export function applySinglePartWarping(
  sourceImage: fabric.Image,
  landmarks: FaceLandmarks,
  partType: 'leftEye' | 'rightEye' | 'mouth' | 'nose',
  params: FaceParams['leftEye'] | FaceParams['rightEye'] | FaceParams['mouth'] | FaceParams['nose']
): fabric.Image {
  try {
    switch (partType) {
      case 'leftEye':
        return createEyeWarp(sourceImage, landmarks, params as FaceParams['leftEye'], true);
      case 'rightEye':
        return createEyeWarp(sourceImage, landmarks, params as FaceParams['rightEye'], false);
      case 'mouth':
        return createMouthWarp(sourceImage, landmarks, params as FaceParams['mouth']);
      case 'nose':
        return createNoseWarp(sourceImage, landmarks, params as FaceParams['nose']);
      default:
        return sourceImage;
    }
  } catch (error) {
    console.error(`${partType} ワーピング処理エラー:`, error);
    return sourceImage;
  }
}

/**
 * 全ての顔パーツのワーピングを適用（段階的）
 */
export function applyFaceWarping(
  originalImage: fabric.Image,
  landmarks: FaceLandmarks,
  faceParams: FaceParams
): fabric.Image {
  let currentImage = originalImage;

  try {
    console.log('🎨 顔ワーピング処理開始');

    // 各パーツを順番に適用（デフォルト値以外の場合のみ）
    if (faceParams.leftEye.size !== 1.0 || faceParams.leftEye.positionX !== 0 || faceParams.leftEye.positionY !== 0) {
      console.log('👁️ 左目ワーピング適用');
      currentImage = createEyeWarp(currentImage, landmarks, faceParams.leftEye, true);
    }

    if (faceParams.rightEye.size !== 1.0 || faceParams.rightEye.positionX !== 0 || faceParams.rightEye.positionY !== 0) {
      console.log('👁️ 右目ワーピング適用');
      currentImage = createEyeWarp(currentImage, landmarks, faceParams.rightEye, false);
    }

    if (faceParams.mouth.width !== 1.0 || faceParams.mouth.height !== 1.0 || faceParams.mouth.positionX !== 0 || faceParams.mouth.positionY !== 0) {
      console.log('👄 口ワーピング適用');
      currentImage = createMouthWarp(currentImage, landmarks, faceParams.mouth);
    }

    if (faceParams.nose.width !== 1.0 || faceParams.nose.height !== 1.0 || faceParams.nose.positionX !== 0 || faceParams.nose.positionY !== 0) {
      console.log('👃 鼻ワーピング適用');
      currentImage = createNoseWarp(currentImage, landmarks, faceParams.nose);
    }

    console.log('✅ 顔ワーピング処理完了');
    return currentImage;

  } catch (error) {
    console.error('❌ 顔ワーピング処理エラー:', error);
    return originalImage; // エラー時は元画像を返す
  }
}

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
  // 後の拡張のため特徴点を保持
  void eyePoints;

  // 新しい画像を作成（コピー）
  const warpedImage = new fabric.Image(originalImage.getElement(), {
    left: originalImage.left,
    top: originalImage.top,
    scaleX: originalImage.scaleX,
    scaleY: originalImage.scaleY,
  });

  // 変形パラメータを適用
  const scaleX = params.size;
  const scaleY = params.size;
  const offsetX = params.positionX;
  const offsetY = params.positionY;

  // TODO: 実際のワーピング処理を実装
  // 現在は基本的なスケーリングのみ
  warpedImage.set({
    scaleX: (originalImage.scaleX || 1) * scaleX,
    scaleY: (originalImage.scaleY || 1) * scaleY,
    left: (originalImage.left || 0) + offsetX,
    top: (originalImage.top || 0) + offsetY,
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

  // 後の拡張のため特徴点を保持（現在は未使用）
  void landmarks.mouth;

  // 新しい画像を作成（コピー）
  const warpedImage = new fabric.Image(originalImage.getElement(), {
    left: originalImage.left,
    top: originalImage.top,
    scaleX: originalImage.scaleX,
    scaleY: originalImage.scaleY,
  });

  // 変形パラメータを適用
  const scaleX = params.width;
  const scaleY = params.height;
  const offsetX = params.positionX;
  const offsetY = params.positionY;

  // TODO: 実際のワーピング処理を実装
  // 現在は基本的なスケーリングのみ
  warpedImage.set({
    scaleX: (originalImage.scaleX || 1) * scaleX,
    scaleY: (originalImage.scaleY || 1) * scaleY,
    left: (originalImage.left || 0) + offsetX,
    top: (originalImage.top || 0) + offsetY,
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

  // 後の拡張のため特徴点を保持（現在は未使用）
  void landmarks.nose;

  // 新しい画像を作成（コピー）
  const warpedImage = new fabric.Image(originalImage.getElement(), {
    left: originalImage.left,
    top: originalImage.top,
    scaleX: originalImage.scaleX,
    scaleY: originalImage.scaleY,
  });

  // 変形パラメータを適用
  const scaleX = params.width;
  const scaleY = params.height;
  const offsetX = params.positionX;
  const offsetY = params.positionY;

  // TODO: 実際のワーピング処理を実装
  // 現在は基本的なスケーリングのみ
  warpedImage.set({
    scaleX: (originalImage.scaleX || 1) * scaleX,
    scaleY: (originalImage.scaleY || 1) * scaleY,
    left: (originalImage.left || 0) + offsetX,
    top: (originalImage.top || 0) + offsetY,
  });

  return warpedImage;
}

/**
 * 全ての顔パーツのワーピングを適用
 */
export function applyFaceWarping(
  originalImage: fabric.Image,
  landmarks: FaceLandmarks,
  faceParams: FaceParams
): fabric.Image {
  let warpedImage = new fabric.Image(originalImage.getElement(), {
    left: originalImage.left,
    top: originalImage.top,
    scaleX: originalImage.scaleX,
    scaleY: originalImage.scaleY,
  });

  try {
    // 左目のワーピング
    warpedImage = createEyeWarp(warpedImage, landmarks, faceParams.leftEye, true);

    // 右目のワーピング
    warpedImage = createEyeWarp(warpedImage, landmarks, faceParams.rightEye, false);

    // 口のワーピング
    warpedImage = createMouthWarp(warpedImage, landmarks, faceParams.mouth);

    // 鼻のワーピング
    warpedImage = createNoseWarp(warpedImage, landmarks, faceParams.nose);

    return warpedImage;
  } catch (error) {
    console.error('顔ワーピング処理エラー:', error);
    return originalImage; // エラー時は元画像を返す
  }
}
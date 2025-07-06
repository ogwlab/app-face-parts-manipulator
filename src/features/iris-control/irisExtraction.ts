/**
 * 虹彩抽出・制御モジュール
 * レイヤーベースの視線制御を実現
 */

import type { Point } from '../../types/face';

// 虹彩サイズ計算用の定数
const IRIS_SIZE_RATIOS = {
  /** 虹彩の横半径 - 目の幅に対する比率 */
  RADIUS_X_RATIO: 0.25,
  /** 虹彩の縦半径 - 目の高さに対する比率（まぶたで隠れる分を考慮） */
  RADIUS_Y_RATIO: 0.40
} as const;

/**
 * 虹彩領域の定義
 */
export interface IrisRegion {
  center: Point;
  radiusX: number;  // 横方向の半径
  radiusY: number;  // 縦方向の半径
  angle: number;    // 楕円の回転角度
}

/**
 * 虹彩制御用のレイヤー
 */
export interface IrisLayer {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  originalPosition: Point;
  currentPosition: Point;
}

/**
 * 目の領域情報
 */
export interface EyeRegion {
  bounds: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  };
  center: Point;
  path: Path2D;  // まぶたの輪郭パス
}

/**
 * 目のランドマークから虹彩領域を推定
 */
export function estimateIrisRegion(eyeLandmarks: Point[], eyeCenter: Point): IrisRegion {
  // 目の幅と高さを計算
  const eyeWidth = Math.max(...eyeLandmarks.map(p => p.x)) - Math.min(...eyeLandmarks.map(p => p.x));
  const eyeHeight = Math.max(...eyeLandmarks.map(p => p.y)) - Math.min(...eyeLandmarks.map(p => p.y));
  
  // 虹彩サイズを定数を使用して計算
  const radiusX = eyeWidth * IRIS_SIZE_RATIOS.RADIUS_X_RATIO;
  const radiusY = eyeHeight * IRIS_SIZE_RATIOS.RADIUS_Y_RATIO;
  
  // 目の傾きを計算（外側コーナーと内側コーナーの角度）
  const leftCorner = eyeLandmarks[0];
  const rightCorner = eyeLandmarks[3];
  const angle = Math.atan2(rightCorner.y - leftCorner.y, rightCorner.x - leftCorner.x);
  
  return {
    center: eyeCenter,
    radiusX,
    radiusY,
    angle
  };
}

/**
 * 目の輪郭からクリッピングパスを作成
 */
export function createEyeClippingPath(eyeLandmarks: Point[]): Path2D {
  const path = new Path2D();
  
  // スムーズな曲線で目の輪郭を描画
  path.moveTo(eyeLandmarks[0].x, eyeLandmarks[0].y);
  
  // 上まぶた（ベジェ曲線で滑らかに）
  const topControl1 = {
    x: eyeLandmarks[1].x,
    y: eyeLandmarks[1].y - 5  // やや上に制御点
  };
  const topControl2 = {
    x: eyeLandmarks[2].x,
    y: eyeLandmarks[2].y - 5
  };
  path.bezierCurveTo(
    topControl1.x, topControl1.y,
    topControl2.x, topControl2.y,
    eyeLandmarks[3].x, eyeLandmarks[3].y
  );
  
  // 下まぶた（ベジェ曲線で滑らかに）
  const bottomControl1 = {
    x: eyeLandmarks[4].x,
    y: eyeLandmarks[4].y + 3  // やや下に制御点
  };
  const bottomControl2 = {
    x: eyeLandmarks[5].x,
    y: eyeLandmarks[5].y + 3
  };
  path.bezierCurveTo(
    bottomControl1.x, bottomControl1.y,
    bottomControl2.x, bottomControl2.y,
    eyeLandmarks[0].x, eyeLandmarks[0].y
  );
  
  path.closePath();
  return path;
}

/**
 * 虹彩領域を抽出してレイヤーを作成
 */
export function extractIrisLayer(
  sourceCanvas: HTMLCanvasElement,
  irisRegion: IrisRegion
): IrisLayer {
  console.log('🎨 [extractIrisLayer] 虹彩抽出開始:', {
    sourceSize: {
      width: sourceCanvas.width,
      height: sourceCanvas.height
    },
    irisRegion: {
      center: irisRegion.center,
      radiusX: irisRegion.radiusX,
      radiusY: irisRegion.radiusY,
      angle: irisRegion.angle
    }
  });
  
  // 虹彩サイズに合わせたキャンバスを作成
  const irisCanvas = document.createElement('canvas');
  const padding = 10;  // エッジブレンディング用の余白
  irisCanvas.width = (irisRegion.radiusX + padding) * 2;
  irisCanvas.height = (irisRegion.radiusY + padding) * 2;
  
  const irisCtx = irisCanvas.getContext('2d')!;
  
  // 虹彩領域をコピー
  irisCtx.save();
  irisCtx.translate(irisCanvas.width / 2, irisCanvas.height / 2);
  irisCtx.rotate(-irisRegion.angle);
  
  // 楕円形のクリッピング
  irisCtx.beginPath();
  irisCtx.ellipse(0, 0, irisRegion.radiusX, irisRegion.radiusY, 0, 0, Math.PI * 2);
  irisCtx.clip();
  
  // 元画像から虹彩部分をコピー
  irisCtx.drawImage(
    sourceCanvas,
    irisRegion.center.x - irisRegion.radiusX - padding,
    irisRegion.center.y - irisRegion.radiusY - padding,
    irisCanvas.width,
    irisCanvas.height,
    -irisCanvas.width / 2,
    -irisCanvas.height / 2,
    irisCanvas.width,
    irisCanvas.height
  );
  
  irisCtx.restore();
  
  return {
    canvas: irisCanvas,
    context: irisCtx,
    originalPosition: { ...irisRegion.center },
    currentPosition: { ...irisRegion.center }
  };
}

/**
 * 白目（強膜）でインペインティング
 */
export function fillWithSclera(
  ctx: CanvasRenderingContext2D,
  region: IrisRegion,
  _eyeBounds: EyeRegion['bounds']
): void {
  console.log('🎨 [fillWithSclera] 白目で埋める:', {
    center: region.center,
    radiusX: region.radiusX,
    radiusY: region.radiusY
  });
  
  // 虹彩があった場所を白目で埋める
  ctx.save();
  
  // 楕円形の領域を定義
  ctx.beginPath();
  ctx.ellipse(
    region.center.x,
    region.center.y,
    region.radiusX,
    region.radiusY,
    region.angle,
    0,
    Math.PI * 2
  );
  
  // グラデーションで自然な白目を作成
  const gradient = ctx.createRadialGradient(
    region.center.x,
    region.center.y,
    0,
    region.center.x,
    region.center.y,
    region.radiusX
  );
  
  // 白目の色（やや灰色がかった白）
  gradient.addColorStop(0, 'rgb(250, 250, 250)');
  gradient.addColorStop(0.7, 'rgb(245, 245, 245)');
  gradient.addColorStop(1, 'rgb(240, 240, 240)');
  
  ctx.fillStyle = gradient;
  ctx.fill();
  
  // エッジをぼかす
  ctx.filter = 'blur(2px)';
  ctx.globalCompositeOperation = 'source-over';
  ctx.stroke();
  
  ctx.restore();
}

/**
 * 虹彩レイヤーを新しい位置に描画
 */
export function drawIrisAtPosition(
  targetCtx: CanvasRenderingContext2D,
  irisLayer: IrisLayer,
  newPosition: Point,
  eyePath: Path2D
): void {
  console.log('🎨 [drawIrisAtPosition] 虹彩を新位置に描画:', {
    originalPos: irisLayer.originalPosition,
    newPos: newPosition,
    offset: {
      x: newPosition.x - irisLayer.originalPosition.x,
      y: newPosition.y - irisLayer.originalPosition.y
    },
    canvasSize: {
      width: irisLayer.canvas.width,
      height: irisLayer.canvas.height
    }
  });
  
  targetCtx.save();
  
  // まぶたでクリッピング
  targetCtx.clip(eyePath);
  
  // 虹彩を新しい位置に描画
  const offsetX = newPosition.x - irisLayer.originalPosition.x;
  const offsetY = newPosition.y - irisLayer.originalPosition.y;
  
  targetCtx.drawImage(
    irisLayer.canvas,
    irisLayer.originalPosition.x + offsetX - irisLayer.canvas.width / 2,
    irisLayer.originalPosition.y + offsetY - irisLayer.canvas.height / 2
  );
  
  targetCtx.restore();
  
  // 現在位置を更新
  irisLayer.currentPosition = { ...newPosition };
}

/**
 * 目の境界情報を取得
 */
export function getEyeRegion(eyeLandmarks: Point[]): EyeRegion {
  const xs = eyeLandmarks.map(p => p.x);
  const ys = eyeLandmarks.map(p => p.y);
  
  const bounds = {
    left: Math.min(...xs),
    top: Math.min(...ys),
    right: Math.max(...xs),
    bottom: Math.max(...ys),
    width: 0,
    height: 0
  };
  
  bounds.width = bounds.right - bounds.left;
  bounds.height = bounds.bottom - bounds.top;
  
  const center = {
    x: (bounds.left + bounds.right) / 2,
    y: (bounds.top + bounds.bottom) / 2
  };
  
  const path = createEyeClippingPath(eyeLandmarks);
  
  return { bounds, center, path };
}
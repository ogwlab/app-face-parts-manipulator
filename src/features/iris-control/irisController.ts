/**
 * 虹彩制御統合マネージャー
 * レイヤーベースの視線制御を管理
 */

import type { FaceLandmarks, FaceParams, Point } from '../../types/face';
import {
  estimateIrisRegion,
  extractIrisLayer,
  fillWithSclera,
  drawIrisAtPosition,
  getEyeRegion,
  type IrisLayer,
  type IrisRegion,
  type EyeRegion
} from './irisExtraction';

/**
 * 虹彩制御の状態
 */
export interface IrisControlState {
  leftEye: {
    region: EyeRegion | null;
    irisRegion: IrisRegion | null;
    irisLayer: IrisLayer | null;
  };
  rightEye: {
    region: EyeRegion | null;
    irisRegion: IrisRegion | null;
    irisLayer: IrisLayer | null;
  };
  isInitialized: boolean;
}

/**
 * 虹彩制御マネージャー
 */
export class IrisController {
  private state: IrisControlState;
  private workCanvas: HTMLCanvasElement;
  
  constructor() {
    this.workCanvas = document.createElement('canvas');
    
    this.state = {
      leftEye: {
        region: null,
        irisRegion: null,
        irisLayer: null
      },
      rightEye: {
        region: null,
        irisRegion: null,
        irisLayer: null
      },
      isInitialized: false
    };
  }
  
  /**
   * 初期化: 元画像から虹彩を抽出
   */
  initialize(
    sourceCanvas: HTMLCanvasElement,
    landmarks: FaceLandmarks,
    originalImageSize?: { width: number; height: number }
  ): void {
    console.log('🎯 [IrisController] 初期化開始');
    
    // 作業用キャンバスのサイズを合わせる
    this.workCanvas.width = sourceCanvas.width;
    this.workCanvas.height = sourceCanvas.height;
    
    // 座標スケールを計算（元画像座標系 → キャンバス座標系）
    if (originalImageSize && (originalImageSize.width <= 0 || originalImageSize.height <= 0)) {
      throw new Error('Original image dimensions must be positive');
    }
    const imageScale = originalImageSize ? {
      x: sourceCanvas.width / originalImageSize.width,
      y: sourceCanvas.height / originalImageSize.height
    } : { x: 1, y: 1 };
    console.log('📏 [IrisController] 座標スケール:', {
      originalSize: originalImageSize,
      canvasSize: { width: sourceCanvas.width, height: sourceCanvas.height },
      scale: imageScale
    });
    
    // ランドマークをキャンバス座標系に変換
    const scaleLandmarks = (points: Point[]): Point[] => 
      points.map(p => ({
        x: p.x * imageScale.x,
        y: p.y * imageScale.y
      }));
    
    const scaledLeftEye = scaleLandmarks(landmarks.leftEye);
    const scaledRightEye = scaleLandmarks(landmarks.rightEye);
    
    // 左目の処理
    const leftEyeCenter = this.calculateCenter(scaledLeftEye);
    this.state.leftEye.region = getEyeRegion(scaledLeftEye);
    this.state.leftEye.irisRegion = estimateIrisRegion(scaledLeftEye, leftEyeCenter);
    this.state.leftEye.irisLayer = extractIrisLayer(sourceCanvas, this.state.leftEye.irisRegion);
    
    // 右目の処理
    const rightEyeCenter = this.calculateCenter(scaledRightEye);
    this.state.rightEye.region = getEyeRegion(scaledRightEye);
    this.state.rightEye.irisRegion = estimateIrisRegion(scaledRightEye, rightEyeCenter);
    this.state.rightEye.irisLayer = extractIrisLayer(sourceCanvas, this.state.rightEye.irisRegion);
    
    this.state.isInitialized = true;
    
    console.log('✅ [IrisController] 初期化完了', {
      leftIrisSize: {
        radiusX: this.state.leftEye.irisRegion?.radiusX.toFixed(2),
        radiusY: this.state.leftEye.irisRegion?.radiusY.toFixed(2)
      },
      rightIrisSize: {
        radiusX: this.state.rightEye.irisRegion?.radiusX.toFixed(2),
        radiusY: this.state.rightEye.irisRegion?.radiusY.toFixed(2)
      }
    });
  }
  
  /**
   * 虹彩制御を適用
   */
  applyIrisControl(
    sourceCanvas: HTMLCanvasElement,
    faceParams: FaceParams,
    _landmarks: FaceLandmarks
  ): HTMLCanvasElement {
    console.log('🔍 [IrisController] applyIrisControl呼び出し:', {
      isInitialized: this.state.isInitialized,
      sourceCanvasSize: {
        width: sourceCanvas.width,
        height: sourceCanvas.height
      },
      leftEyeState: {
        hasRegion: !!this.state.leftEye.region,
        hasIrisRegion: !!this.state.leftEye.irisRegion,
        hasIrisLayer: !!this.state.leftEye.irisLayer
      },
      rightEyeState: {
        hasRegion: !!this.state.rightEye.region,
        hasIrisRegion: !!this.state.rightEye.irisRegion,
        hasIrisLayer: !!this.state.rightEye.irisLayer
      }
    });
    
    if (!this.state.isInitialized) {
      console.warn('⚠️ [IrisController] 未初期化のため処理をスキップ');
      return sourceCanvas;
    }
    
    console.log('🎨 [IrisController] 虹彩制御適用開始');
    
    // 結果用キャンバスを作成
    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = sourceCanvas.width;
    resultCanvas.height = sourceCanvas.height;
    const resultCtx = resultCanvas.getContext('2d')!;
    
    // 元画像をコピー
    resultCtx.drawImage(sourceCanvas, 0, 0);
    
    // 左目の処理
    if (this.state.leftEye.irisLayer) {
      this.processEye(
        resultCtx,
        this.state.leftEye,
        faceParams.leftEye,
        '左目'
      );
    }
    
    // 右目の処理
    if (this.state.rightEye.irisLayer) {
      this.processEye(
        resultCtx,
        this.state.rightEye,
        faceParams.rightEye,
        '右目'
      );
    }
    
    console.log('✅ [IrisController] 虹彩制御適用完了');
    return resultCanvas;
  }
  
  /**
   * 個別の目を処理
   */
  private processEye(
    ctx: CanvasRenderingContext2D,
    eyeState: IrisControlState['leftEye'],
    eyeParams: FaceParams['leftEye'],
    eyeName: string
  ): void {
    if (!eyeState.region || !eyeState.irisRegion || !eyeState.irisLayer) {
      console.warn(`⚠️ [IrisController] ${eyeName}の状態が未初期化`);
      return;
    }
    const { irisOffsetX, irisOffsetY } = eyeParams;
    
    // オフセットがない場合はスキップ
    if (irisOffsetX === 0 && irisOffsetY === 0) {
      return;
    }
    
    console.log(`👁️ [IrisController] ${eyeName}の処理:`, {
      offsetX: irisOffsetX.toFixed(2),
      offsetY: irisOffsetY.toFixed(2)
    });
    
    const { region, irisRegion, irisLayer } = eyeState;
    
    // 1. 元の虹彩位置を白目で埋める
    fillWithSclera(ctx, irisRegion, region.bounds);
    
    // 2. 新しい虹彩位置を計算
    const offsetX = region.bounds.width * irisOffsetX;
    const offsetY = region.bounds.height * irisOffsetY;
    const newIrisPosition = {
      x: irisRegion.center.x + offsetX,
      y: irisRegion.center.y + offsetY
    };
    
    console.log(`👁️ [IrisController] ${eyeName}の移動計算:`, {
      originalCenter: irisRegion.center,
      boundsWidth: region.bounds.width,
      boundsHeight: region.bounds.height,
      irisOffsetX,
      irisOffsetY,
      calculatedOffset: { x: offsetX, y: offsetY },
      newPosition: newIrisPosition
    });
    
    // 3. 虹彩を新しい位置に描画（まぶたでクリップ）
    drawIrisAtPosition(ctx, irisLayer, newIrisPosition, region.path);
    
    // デバッグ用: 虹彩の新しい位置に赤い円を描画
    if (Math.abs(offsetX) > 1 || Math.abs(offsetY) > 1) {
      ctx.save();
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(newIrisPosition.x, newIrisPosition.y, 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      console.log(`🔴 [IrisController] デバッグ円を描画: ${eyeName}`, newIrisPosition);
    }
  }
  
  /**
   * 中心点を計算
   */
  private calculateCenter(points: Point[]): Point {
    const sum = points.reduce(
      (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
      { x: 0, y: 0 }
    );
    return {
      x: sum.x / points.length,
      y: sum.y / points.length
    };
  }
  
  /**
   * リソースのクリーンアップ
   */
  dispose(): void {
    // キャンバスのクリア
    if (this.state.leftEye.irisLayer) {
      this.state.leftEye.irisLayer.canvas.width = 0;
      this.state.leftEye.irisLayer.canvas.height = 0;
    }
    if (this.state.rightEye.irisLayer) {
      this.state.rightEye.irisLayer.canvas.width = 0;
      this.state.rightEye.irisLayer.canvas.height = 0;
    }
    
    this.state.isInitialized = false;
  }
}
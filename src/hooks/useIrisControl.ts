/**
 * 虹彩制御用カスタムフック
 * レイヤーベースの視線制御を提供
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import { IrisController } from '../features/iris-control/irisController';
import type { FaceLandmarks, FaceParams } from '../types/face';

export interface UseIrisControlOptions {
  enabled?: boolean;
}

export interface UseIrisControlReturn {
  initializeIrisControl: (canvas: HTMLCanvasElement, landmarks: FaceLandmarks, originalImageSize?: { width: number; height: number }) => void;
  applyIrisControl: (canvas: HTMLCanvasElement, faceParams: FaceParams, landmarks: FaceLandmarks) => HTMLCanvasElement | null;
  isInitialized: boolean;
}

/**
 * 虹彩制御フック
 */
export function useIrisControl(options: UseIrisControlOptions = {}): UseIrisControlReturn {
  const { enabled = true } = options;
  const controllerRef = useRef<IrisController | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // コントローラーの初期化
  useEffect(() => {
    if (enabled && !controllerRef.current) {
      controllerRef.current = new IrisController();
      console.log('🎯 [useIrisControl] IrisController作成');
    }
    
    return () => {
      if (controllerRef.current) {
        controllerRef.current.dispose();
        controllerRef.current = null;
        setIsInitialized(false);
        console.log('🧹 [useIrisControl] IrisControllerクリーンアップ');
      }
    };
  }, [enabled]);
  
  /**
   * 虹彩制御の初期化
   */
  const initializeIrisControl = useCallback((
    canvas: HTMLCanvasElement,
    landmarks: FaceLandmarks,
    originalImageSize?: { width: number; height: number }
  ) => {
    if (!enabled || !controllerRef.current) {
      return;
    }
    
    try {
      controllerRef.current.initialize(canvas, landmarks, originalImageSize);
      setIsInitialized(true);
      console.log('✅ [useIrisControl] 初期化成功');
    } catch (error) {
      console.error('❌ [useIrisControl] 初期化エラー:', error);
      setIsInitialized(false);
    }
  }, [enabled]);
  
  /**
   * 虹彩制御の適用
   */
  const applyIrisControl = useCallback((
    canvas: HTMLCanvasElement,
    faceParams: FaceParams,
    landmarks: FaceLandmarks
  ): HTMLCanvasElement | null => {
    if (!enabled || !controllerRef.current || !isInitialized) {
      return null;
    }
    
    try {
      console.log('🔍 [useIrisControl] 適用前チェック:', {
        enabled,
        hasController: !!controllerRef.current,
        isInitialized,
        canvasSize: {
          width: canvas.width,
          height: canvas.height
        }
      });
      
      // 虹彩オフセットがある場合のみ処理
      const hasIrisOffset = 
        faceParams.leftEye.irisOffsetX !== 0 ||
        faceParams.leftEye.irisOffsetY !== 0 ||
        faceParams.rightEye.irisOffsetX !== 0 ||
        faceParams.rightEye.irisOffsetY !== 0;
      
      console.log('🔍 [useIrisControl] オフセット状態:', {
        hasIrisOffset,
        leftEye: {
          x: faceParams.leftEye.irisOffsetX,
          y: faceParams.leftEye.irisOffsetY
        },
        rightEye: {
          x: faceParams.rightEye.irisOffsetX,
          y: faceParams.rightEye.irisOffsetY
        }
      });
      
      if (!hasIrisOffset) {
        console.log('⏭️ [useIrisControl] 虹彩オフセットなし - スキップ');
        return null;
      }
      
      console.log('🎨 [useIrisControl] 虹彩制御適用開始');
      const result = controllerRef.current.applyIrisControl(canvas, faceParams, landmarks);
      console.log('🎨 [useIrisControl] 虹彩制御適用結果:', !!result);
      return result;
    } catch (error) {
      console.error('❌ [useIrisControl] 適用エラー:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return null;
    }
  }, [enabled, isInitialized]);
  
  return {
    initializeIrisControl,
    applyIrisControl,
    isInitialized
  };
}
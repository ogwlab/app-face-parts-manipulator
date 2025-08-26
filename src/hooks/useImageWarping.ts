import { useEffect, useCallback, useRef } from 'react';
import { useFaceStore } from '../stores/faceStore';
import { logger } from '../utils/logger';
import { canvasManager } from '../features/image-warping/canvasManager';
import { applyAdaptiveTPSWarping, getAdaptiveOptionsFromQuality } from '../features/image-warping/adaptiveWarping';

export interface UseImageWarpingReturn {
  initializeCanvas: (canvasElement: HTMLCanvasElement, width?: number, height?: number) => void;
  processImage: (quality?: 'fast' | 'medium' | 'high') => Promise<void>;
  exportImage: () => string | null;
  isProcessing: boolean;
  error: string | null;
}

export const useImageWarping = (quality: 'fast' | 'medium' | 'high' = 'high'): UseImageWarpingReturn => {
  const {
    originalImage,
    faceParams,
    renderMode,
    setProcessedImageUrl,
    setProcessing,
    setError,
    // 🚀 新機能: 統合ベースデータを使用
    currentBaseImageUrl,
    currentBaseLandmarks,
  } = useFaceStore();

  const isProcessingRef = useRef(false);

  // Canvas初期化
  const initializeCanvas = useCallback((canvasElement: HTMLCanvasElement, width?: number, height?: number) => {
    try {
      logger.debug('🎨 Canvas初期化開始:', { 
        canvasElement: !!canvasElement, 
        width, 
        height,
        elementWidth: canvasElement?.width,
        elementHeight: canvasElement?.height
      });
      
      canvasManager.initialize(canvasElement, width, height);
      
      logger.debug('✅ Canvas初期化成功:', {
        canvas: !!canvasManager.canvas,
        size: width ? `${width}x${height}` : 'デフォルト',
        canvasWidth: canvasManager.canvas?.getWidth(),
        canvasHeight: canvasManager.canvas?.getHeight()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Canvas初期化エラー';
      setError(errorMessage);
      logger.error('❌ Canvas初期化失敗:', error);
    }
  }, [setError]);

  // 🚀 統合画像読み込み（標準化対応）
  const loadCurrentBaseImage = useCallback(async () => {
    if (!currentBaseImageUrl || !canvasManager.canvas) return;

    try {
      setProcessing(true);
      setError(null);

      // Canvas managerに現在のベース画像を読み込む
      await canvasManager.loadImage(currentBaseImageUrl);
      
      console.log('✅ Current base image loaded to canvas:', { 
        isStandardized: currentBaseImageUrl !== originalImage?.url 
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '画像読み込みエラー';
      setError(errorMessage);
      console.error('❌ Image loading failed:', error);
    } finally {
      setProcessing(false);
    }
  }, [currentBaseImageUrl, originalImage, setProcessing, setError]);

  // 🚀 統合画像処理（標準化対応）
  const processImage = useCallback(async (quality: 'fast' | 'medium' | 'high' = 'high') => {
    if (
      !currentBaseImageUrl ||
      !currentBaseLandmarks ||
      isProcessingRef.current
    ) {
      console.log('⚠️ ワーピング処理スキップ - 前提条件不足:', {
        hasBaseImage: !!currentBaseImageUrl,
        hasBaseLandmarks: !!currentBaseLandmarks
      });
      return;
    }

    try {
      isProcessingRef.current = true;
      setProcessing(true);
      setError(null);

      console.log('🔄 統合ワーピング処理開始', { 
        faceParams, 
        quality, 
        renderMode,
        isStandardized: currentBaseImageUrl !== originalImage?.url
      });

      // 現在のベース画像を読み込む
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('画像の読み込みに失敗'));
        img.src = currentBaseImageUrl;
      });

      // Canvas サイズを取得
      const canvas = canvasManager.getCanvas();
      if (!canvas) {
        throw new Error('Canvas が初期化されていません');
      }

      const canvasWidth = canvas.getWidth();
      const canvasHeight = canvas.getHeight();

      // 品質設定からオプションを取得
      const options = getAdaptiveOptionsFromQuality(quality);
      // renderModeをオプションに反映
      options.deformationMode = 'mesh'; // メッシュベースを使用
      if (options.deformationMode === 'mesh') {
        // メッシュベースの場合、debugOptionsにrenderModeを設定
        (options as any).meshRenderMode = renderMode;
      }
      
      const warpedCanvas = applyAdaptiveTPSWarping(
        img,
        currentBaseLandmarks,
        faceParams,
        canvasWidth,
        canvasHeight,
        options
      );

      // 処理後の画像URLを生成
      const processedDataURL = warpedCanvas.toDataURL('image/png');
      setProcessedImageUrl(processedDataURL);

      console.log('✅ 統合ワーピング処理完了', { 
        quality, 
        renderMode, 
        isStandardized: currentBaseImageUrl !== originalImage?.url 
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '画像処理エラー';
      setError(errorMessage);
      console.error('❌ 統合ワーピング処理失敗:', error);
    } finally {
      isProcessingRef.current = false;
      setProcessing(false);
    }
  }, [currentBaseImageUrl, currentBaseLandmarks, faceParams, renderMode, originalImage, setProcessedImageUrl, setProcessing, setError]);

  // 画像エクスポート
  const exportImage = useCallback((): string | null => {
    try {
      return canvasManager.getCanvasDataURL();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '画像エクスポートエラー';
      setError(errorMessage);
      console.error('❌ Image export failed:', error);
      return null;
    }
  }, [setError]);

  // 🚀 統合ベース画像が変更された時の処理
  useEffect(() => {
    if (currentBaseImageUrl) {
      loadCurrentBaseImage();
    } else {
      // 画像がクリアされた場合
      setProcessedImageUrl(null);
    }
  }, [currentBaseImageUrl, loadCurrentBaseImage, setProcessedImageUrl]);

  // 🚀 統合パラメータ変更処理（標準化対応）
  useEffect(() => {
    console.log('🎛️ 統合パラメータ変更検出:', {
      faceParams,
      hasBaseImage: !!currentBaseImageUrl,
      hasBaseLandmarks: !!currentBaseLandmarks,
      canvasManager: !!canvasManager.canvas,
      isStandardized: currentBaseImageUrl !== originalImage?.url
    });

    if (currentBaseImageUrl && currentBaseLandmarks) {
      console.log('✅ 統合前提条件満たしている - ワーピング処理実行予定');
      
      // 少し遅延を入れてUIの応答性を保つ
      const timeoutId = setTimeout(() => {
        console.log('⏰ デバウンス完了 - 統合ワーピング処理開始');
        processImage(quality);
      }, 100);

      return () => {
        console.log('🚫 デバウンスキャンセル');
        clearTimeout(timeoutId);
      };
    } else {
      console.log('❌ 統合前提条件不足 - ワーピング処理スキップ');
    }
  }, [faceParams, renderMode, processImage, currentBaseImageUrl, currentBaseLandmarks, originalImage, quality]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      canvasManager.dispose();
    };
  }, []);

  return {
    initializeCanvas,
    processImage,
    exportImage,
    isProcessing: isProcessingRef.current,
    error: null, // エラーはstoreで管理
  };
};
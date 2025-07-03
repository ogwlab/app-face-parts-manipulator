import { useEffect, useCallback, useRef } from 'react';
import * as fabric from 'fabric';
import { useFaceStore } from '../stores/faceStore';
import { canvasManager } from '../features/image-warping/canvasManager';
import { applyFaceWarping } from '../features/image-warping/warpingUtils';

export interface UseImageWarpingReturn {
  initializeCanvas: (canvasElement: HTMLCanvasElement, width?: number, height?: number) => void;
  processImage: () => Promise<void>;
  exportImage: () => string | null;
  isProcessing: boolean;
  error: string | null;
}

export const useImageWarping = (): UseImageWarpingReturn => {
  const {
    originalImage,
    faceDetection,
    faceParams,
    setProcessedImageUrl,
    setProcessing,
    setError,
  } = useFaceStore();

  const isProcessingRef = useRef(false);
  const originalFabricImage = useRef<fabric.Image | null>(null);

  // Canvas初期化
  const initializeCanvas = useCallback((canvasElement: HTMLCanvasElement, width?: number, height?: number) => {
    try {
      console.log('🎨 Canvas初期化開始:', { 
        canvasElement: !!canvasElement, 
        width, 
        height,
        elementWidth: canvasElement?.width,
        elementHeight: canvasElement?.height
      });
      
      canvasManager.initialize(canvasElement, width, height);
      
      console.log('✅ Canvas初期化成功:', {
        canvas: !!canvasManager.canvas,
        size: width ? `${width}x${height}` : 'デフォルト',
        canvasWidth: canvasManager.canvas?.getWidth(),
        canvasHeight: canvasManager.canvas?.getHeight()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Canvas初期化エラー';
      setError(errorMessage);
      console.error('❌ Canvas初期化失敗:', error);
    }
  }, [setError]);

  // 画像読み込み
  const loadOriginalImage = useCallback(async () => {
    if (!originalImage || !canvasManager.canvas) return;

    try {
      setProcessing(true);
      setError(null);

      const fabricImage = await canvasManager.loadImage(originalImage.url);
      originalFabricImage.current = fabricImage;
      
      console.log('✅ Original image loaded to canvas');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '画像読み込みエラー';
      setError(errorMessage);
      console.error('❌ Image loading failed:', error);
    } finally {
      setProcessing(false);
    }
  }, [originalImage, setProcessing, setError]);

  // 画像処理（ワーピング適用）
  const processImage = useCallback(async () => {
    if (
      !originalFabricImage.current ||
      !faceDetection ||
      !faceDetection.landmarks ||
      isProcessingRef.current
    ) {
      console.log('⚠️ ワーピング処理スキップ - 前提条件不足');
      return;
    }

    try {
      isProcessingRef.current = true;
      setProcessing(true);
      setError(null);

      console.log('🔄 ワーピング処理開始', faceParams);

      // ワーピング処理を適用
      const warpedImage = applyFaceWarping(
        originalFabricImage.current,
        faceDetection.landmarks,
        faceParams
      );

      // Canvasを更新
      canvasManager.updateImage(warpedImage);

      // 処理後の画像URLを生成
      const processedDataURL = canvasManager.getCanvasDataURL();
      setProcessedImageUrl(processedDataURL);

      console.log('✅ ワーピング処理完了');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '画像処理エラー';
      setError(errorMessage);
      console.error('❌ ワーピング処理失敗:', error);
    } finally {
      isProcessingRef.current = false;
      setProcessing(false);
    }
  }, [faceDetection, faceParams, setProcessedImageUrl, setProcessing, setError]);

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

  // 元画像が変更された時の処理
  useEffect(() => {
    if (originalImage) {
      loadOriginalImage();
    } else {
      // 画像がクリアされた場合
      originalFabricImage.current = null;
      setProcessedImageUrl(null);
    }
  }, [originalImage, loadOriginalImage, setProcessedImageUrl]);

  // 顔パラメータが変更された時の処理（デバウンス付き）
  useEffect(() => {
    console.log('🎛️ パラメータ変更検出 - 詳細ログ:', {
      faceParams,
      hasOriginalImage: !!originalFabricImage.current,
      hasFaceDetection: !!faceDetection,
      hasLandmarks: !!(faceDetection && faceDetection.landmarks),
      canvasManager: !!canvasManager.canvas
    });

    if (originalFabricImage.current && faceDetection && faceDetection.landmarks) {
      console.log('✅ 前提条件満たしている - ワーピング処理実行予定');
      
      // 少し遅延を入れてUIの応答性を保つ
      const timeoutId = setTimeout(() => {
        console.log('⏰ デバウンス完了 - ワーピング処理開始');
        processImage();
      }, 100);

      return () => {
        console.log('🚫 デバウンスキャンセル');
        clearTimeout(timeoutId);
      };
    } else {
      console.log('❌ 前提条件不足 - ワーピング処理スキップ');
    }
  }, [faceParams, processImage, faceDetection]);

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
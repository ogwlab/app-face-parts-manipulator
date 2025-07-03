import { useEffect, useCallback, useRef } from 'react';
import * as fabric from 'fabric';
import { useFaceStore } from '../stores/faceStore';
import { canvasManager } from '../features/image-warping/canvasManager';
import { applyFaceWarping } from '../features/image-warping/warpingUtils';

export interface UseImageWarpingReturn {
  initializeCanvas: (canvasElement: HTMLCanvasElement) => void;
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
  const initializeCanvas = useCallback((canvasElement: HTMLCanvasElement) => {
    try {
      canvasManager.initialize(canvasElement);
      console.log('✅ Canvas initialized successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Canvas初期化エラー';
      setError(errorMessage);
      console.error('❌ Canvas initialization failed:', error);
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
      return;
    }

    try {
      isProcessingRef.current = true;
      setProcessing(true);
      setError(null);

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

      console.log('✅ Image warping applied successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '画像処理エラー';
      setError(errorMessage);
      console.error('❌ Image processing failed:', error);
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

  // 顔パラメータが変更された時の処理
  useEffect(() => {
    if (originalFabricImage.current && faceDetection) {
      processImage();
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
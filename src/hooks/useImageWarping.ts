import { useEffect, useCallback, useRef } from 'react';
import { useFaceStore } from '../stores/faceStore';
import { canvasManager } from '../features/image-warping/canvasManager';
import { applyAdaptiveTPSWarping, getAdaptiveOptionsFromQuality } from '../features/image-warping/adaptiveWarping';
// import { useIrisControl } from './useIrisControl';

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
    renderMode,
    setProcessedImageUrl,
    setProcessing,
    setError,
  } = useFaceStore();

  const isProcessingRef = useRef(false);
  
  // 虹彩制御フック（メッシュ変形システムに統合されたため無効化）
  // const { initializeIrisControl, applyIrisControl, isInitialized: isIrisControlInitialized } = useIrisControl();

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

      // Canvas managerに画像を読み込む
      await canvasManager.loadImage(originalImage.url);
      
      console.log('✅ Original image loaded to canvas');
      
      // 虹彩制御の初期化（メッシュ変形システムに統合されたため無効化）
      // if (faceDetection && faceDetection.landmarks && canvasManager.canvas) {
      //   const canvasElement = canvasManager.canvas.getElement();
      //   // 元画像のサイズを取得
      //   const img = new Image();
      //   img.src = originalImage.url;
      //   await new Promise<void>((resolve) => {
      //     if (img.complete) {
      //       resolve();
      //     } else {
      //       img.onload = () => resolve();
      //     }
      //   });
      //   
      //   const originalImageSize = {
      //     width: img.naturalWidth,
      //     height: img.naturalHeight
      //   };
      //   
      //   initializeIrisControl(canvasElement, faceDetection.landmarks, originalImageSize);
      //   console.log('👁️ Iris control initialized with image size:', originalImageSize);
      // }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '画像読み込みエラー';
      setError(errorMessage);
      console.error('❌ Image loading failed:', error);
    } finally {
      setProcessing(false);
    }
  }, [originalImage, setProcessing, setError, faceDetection]);

  // 画像処理（ワーピング適用）
  const processImage = useCallback(async () => {
    if (
      !originalImage ||
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

      // 元画像を読み込む
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          console.log('🖼️ [useImageWarping] 画像要素読み込み完了:', {
            naturalSize: `${img.naturalWidth}x${img.naturalHeight}`,
            displaySize: `${img.width}x${img.height}`,
            src: img.src.substring(0, 50) + '...',
            complete: img.complete
          });
          resolve();
        };
        img.onerror = () => reject(new Error('画像の読み込みに失敗'));
        img.src = originalImage.url;
      });

      // Canvas サイズを取得
      const canvas = canvasManager.getCanvas();
      if (!canvas) {
        throw new Error('Canvas が初期化されていません');
      }

      const canvasWidth = canvas.getWidth();
      const canvasHeight = canvas.getHeight();

      // レンダリングモードに応じたオプションを設定
      const options = getAdaptiveOptionsFromQuality('high');
      console.log('🔧 [useImageWarping] 変形オプション:', {
        deformationMode: options.deformationMode,
        renderMode
      });
      
      const warpedCanvas = applyAdaptiveTPSWarping(
        img,
        faceDetection.landmarks,
        faceParams,
        canvasWidth,
        canvasHeight,
        options
      );

      // 虹彩制御を適用（メッシュ変形システムに統合されたため削除）
      let finalCanvas = warpedCanvas;
      
      // デバッグ: キャンバスの内容を確認
      const ctx = finalCanvas.getContext('2d');
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, finalCanvas.width, finalCanvas.height);
        let hasContent = false;
        for (let i = 0; i < imageData.data.length; i += 4) {
          if (imageData.data[i] !== 0 || imageData.data[i+1] !== 0 || imageData.data[i+2] !== 0) {
            hasContent = true;
            break;
          }
        }
        console.log('🖼️ [Debug] Canvas content check:', {
          width: finalCanvas.width,
          height: finalCanvas.height,
          hasContent,
          firstPixel: `rgba(${imageData.data[0]}, ${imageData.data[1]}, ${imageData.data[2]}, ${imageData.data[3]})`
        });
      }

      // 処理後の画像URLを生成
      const processedDataURL = finalCanvas.toDataURL('image/png');
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
  }, [originalImage, faceDetection, faceParams, renderMode, setProcessedImageUrl, setProcessing, setError]);

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
      setProcessedImageUrl(null);
    }
  }, [originalImage, loadOriginalImage, setProcessedImageUrl]);

  // 顔パラメータが変更された時の処理（デバウンス付き）
  useEffect(() => {
    console.log('🎛️ パラメータ変更検出 - 詳細ログ:', {
      faceParams,
      hasOriginalImage: !!originalImage,
      hasFaceDetection: !!faceDetection,
      hasLandmarks: !!(faceDetection && faceDetection.landmarks),
      canvasManager: !!canvasManager.canvas
    });

    if (originalImage && faceDetection && faceDetection.landmarks) {
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
  }, [faceParams, renderMode, processImage, faceDetection, originalImage]);

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
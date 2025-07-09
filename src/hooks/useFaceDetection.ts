import { useState, useCallback } from 'react';
import { 
  detectFaceLandmarks, 
  extractFaceParts, 
  loadModels, 
  validateDetection,
  calculatePartCenter,
  calculatePartBounds,
  isModelsLoaded
} from '../utils/faceDetection';
import { useFaceStore } from '../stores/faceStore';
import type { FaceDetectionResult } from '../types/face';

export interface UseFaceDetectionReturn {
  isLoading: boolean;
  error: string | null;
  result: FaceDetectionResult | null;
  detectFace: (imageElement: HTMLImageElement) => Promise<void>;
  clearError: () => void;
  initializeModels: () => Promise<void>;
  isLoadingModels: boolean;
}

export const useFaceDetection = (): UseFaceDetectionReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FaceDetectionResult | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  
  const { setFaceDetection } = useFaceStore();

  // モデルの初期化
  const initializeModels = useCallback(async () => {
    try {
      setIsLoadingModels(true);
      setError(null);
      console.log('📦 face-api.jsモデル初期化開始...');
      await loadModels();
      console.log('✅ face-api.jsモデル初期化完了');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '不明なエラーが発生しました';
      setError(errorMessage);
      console.error('❌ face-api.jsモデル初期化エラー:', errorMessage);
    } finally {
      setIsLoadingModels(false);
    }
  }, []);

  // 顔検出の実行
  const detectFace = useCallback(async (imageElement: HTMLImageElement) => {
    console.log('🎯 useFaceDetection.detectFace 開始');
    try {
      setIsLoading(true);
      setError(null);
      setResult(null);

      // 初回モデルロード確認
      if (!isModelsLoaded()) {
        setIsLoadingModels(true);
        console.log('📦 初回モデルロード開始...');
      }

      console.log('🔄 detectFaceLandmarks 呼び出し前');
      // 顔検出を実行
      const detection = await detectFaceLandmarks(imageElement);
      
      // モデルロード完了
      if (isLoadingModels) {
        setIsLoadingModels(false);
        console.log('✅ モデルロード完了');
      }
      console.log('✅ detectFaceLandmarks 完了:', detection);
      
      // 検出結果の検証
      const warning = validateDetection(detection);
      
      // 特徴点の抽出
      const landmarks = extractFaceParts(detection.landmarks);
      
      // 各パーツの中心点を計算
      const centers = {
        leftEye: calculatePartCenter(landmarks.leftEye),
        rightEye: calculatePartCenter(landmarks.rightEye),
        mouth: calculatePartCenter(landmarks.mouth),
        nose: calculatePartCenter(landmarks.nose)
      };
      
      // 各パーツの境界ボックスを計算
      const bounds = {
        leftEye: calculatePartBounds(landmarks.leftEye),
        rightEye: calculatePartBounds(landmarks.rightEye),
        mouth: calculatePartBounds(landmarks.mouth),
        nose: calculatePartBounds(landmarks.nose)
      };

      // 結果をまとめる
      const detectionResult: FaceDetectionResult = {
        isDetected: true,
        landmarks: {
          leftEye: landmarks.leftEye,
          rightEye: landmarks.rightEye,
          mouth: landmarks.mouth,
          nose: landmarks.nose,
          jawline: landmarks.jawline,
          leftEyebrow: landmarks.leftEyebrow,
          rightEyebrow: landmarks.rightEyebrow
        },
        confidence: detection.detection.score,
        warning: warning || undefined,
        centers,
        bounds
      };

      setResult(detectionResult);
      
      // グローバル状態に保存
      setFaceDetection(detectionResult);

      console.log('✅ 顔検出完了:', {
        confidence: detection.detection.score,
        partsCount: {
          leftEye: landmarks.leftEye.length,
          rightEye: landmarks.rightEye.length,
          mouth: landmarks.mouth.length,
          nose: landmarks.nose.length
        }
      });

    } catch (err) {
      console.error('🚨 useFaceDetection.detectFace でエラー:', err);
      const errorMessage = err instanceof Error ? err.message : '顔検出でエラーが発生しました';
      console.error('🚨 エラーメッセージ:', errorMessage);
      setError(errorMessage);
      setResult(null);
      
      // エラー時もモデルロード状態をリセット
      if (isLoadingModels) {
        setIsLoadingModels(false);
      }
      
      // グローバル状態をリセット
      setFaceDetection({
        isDetected: false,
        confidence: 0,
        landmarks: {
          leftEye: [],
          rightEye: [],
          mouth: [],
          nose: [],
          jawline: [],
          leftEyebrow: [],
          rightEyebrow: []
        },
        centers: undefined,
        bounds: undefined
      });
      
      console.error('❌ 顔検出エラー:', errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [setFaceDetection, isLoadingModels]);

  // エラーのクリア
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isLoading,
    error,
    result,
    detectFace,
    clearError,
    initializeModels,
    isLoadingModels
  };
}; 
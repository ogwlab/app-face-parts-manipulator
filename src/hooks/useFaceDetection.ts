import { useState, useCallback } from 'react';
import { 
  detectFaceLandmarks, 
  extractFaceParts, 
  loadModels, 
  validateDetection,
  calculatePartCenter,
  calculatePartBounds 
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
}

export const useFaceDetection = (): UseFaceDetectionReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FaceDetectionResult | null>(null);
  
  const { setFaceDetection } = useFaceStore();

  // モデルの初期化
  const initializeModels = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await loadModels();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '不明なエラーが発生しました';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 顔検出の実行
  const detectFace = useCallback(async (imageElement: HTMLImageElement) => {
    try {
      setIsLoading(true);
      setError(null);
      setResult(null);

      // 顔検出を実行
      const detection = await detectFaceLandmarks(imageElement);
      
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
      const errorMessage = err instanceof Error ? err.message : '顔検出でエラーが発生しました';
      setError(errorMessage);
      setResult(null);
      
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
  }, [setFaceDetection]);

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
    initializeModels
  };
}; 
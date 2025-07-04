import { create } from 'zustand';
import type { 
  FaceParams, 
  ImageData, 
  FaceDetectionResult 
} from '../types/face';
import { 
  defaultFaceParams 
} from '../types/face';

interface FaceStore {
  // 画像データ
  originalImage: ImageData | null;
  processedImageUrl: string | null;
  
  // 顔検出結果
  faceDetection: FaceDetectionResult | null;
  
  // 顔パラメータ
  faceParams: FaceParams;
  
  // 処理状態
  isLoading: boolean;
  isProcessing: boolean;
  error: string | null;
  
  // デバッグ設定
  showDebugMesh: boolean;
  
  // アクション
  setOriginalImage: (image: ImageData | null) => void;
  setProcessedImageUrl: (url: string | null) => void;
  setFaceDetection: (result: FaceDetectionResult | null) => void;
  updateFaceParams: (params: Partial<FaceParams>) => void;
  updateLeftEye: (params: Partial<FaceParams['leftEye']>) => void;
  updateRightEye: (params: Partial<FaceParams['rightEye']>) => void;
  updateMouth: (params: Partial<FaceParams['mouth']>) => void;
  updateNose: (params: Partial<FaceParams['nose']>) => void;
  resetLeftEye: () => void;
  resetRightEye: () => void;
  resetMouth: () => void;
  resetNose: () => void;
  resetAllParams: () => void;
  setLoading: (loading: boolean) => void;
  setProcessing: (processing: boolean) => void;
  setError: (error: string | null) => void;
  toggleDebugMesh: () => void;
  clearAll: () => void;
}

export const useFaceStore = create<FaceStore>((set) => ({
  // 初期状態
  originalImage: null,
  processedImageUrl: null,
  faceDetection: null,
  faceParams: { ...defaultFaceParams },
  isLoading: false,
  isProcessing: false,
  error: null,
  showDebugMesh: false,

  // アクション
  setOriginalImage: (image) => set({ originalImage: image }),
  
  setProcessedImageUrl: (url) => set({ processedImageUrl: url }),
  
  setFaceDetection: (result) => set({ faceDetection: result }),
  
  updateFaceParams: (params) => set((state) => ({
    faceParams: { ...state.faceParams, ...params }
  })),
  
  updateLeftEye: (params) => set((state) => ({
    faceParams: {
      ...state.faceParams,
      leftEye: { ...state.faceParams.leftEye, ...params }
    }
  })),
  
  updateRightEye: (params) => set((state) => ({
    faceParams: {
      ...state.faceParams,
      rightEye: { ...state.faceParams.rightEye, ...params }
    }
  })),
  
  updateMouth: (params) => set((state) => ({
    faceParams: {
      ...state.faceParams,
      mouth: { ...state.faceParams.mouth, ...params }
    }
  })),
  
  updateNose: (params) => set((state) => ({
    faceParams: {
      ...state.faceParams,
      nose: { ...state.faceParams.nose, ...params }
    }
  })),
  
  resetLeftEye: () => set((state) => ({
    faceParams: {
      ...state.faceParams,
      leftEye: { ...defaultFaceParams.leftEye }
    }
  })),
  
  resetRightEye: () => set((state) => ({
    faceParams: {
      ...state.faceParams,
      rightEye: { ...defaultFaceParams.rightEye }
    }
  })),
  
  resetMouth: () => set((state) => ({
    faceParams: {
      ...state.faceParams,
      mouth: { ...defaultFaceParams.mouth }
    }
  })),
  
  resetNose: () => set((state) => ({
    faceParams: {
      ...state.faceParams,
      nose: { ...defaultFaceParams.nose }
    }
  })),
  
  resetAllParams: () => set({ faceParams: { ...defaultFaceParams } }),
  
  setLoading: (loading) => set({ isLoading: loading }),
  
  setProcessing: (processing) => set({ isProcessing: processing }),
  
  setError: (error) => set({ error }),
  
  toggleDebugMesh: () => set((state) => ({ showDebugMesh: !state.showDebugMesh })),
  
  clearAll: () => set({
    originalImage: null,
    processedImageUrl: null,
    faceDetection: null,
    faceParams: { ...defaultFaceParams },
    isLoading: false,
    isProcessing: false,
    error: null,
    showDebugMesh: false,
  }),
})); 
import React, { useCallback, useState } from 'react';
import {
  Box,
  Button,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useFaceStore } from '../../stores/faceStore';
import { useFaceDetection } from '../../hooks/useFaceDetection';
import type { ImageData } from '../../types/face';

const ImageUpload: React.FC = () => {
  const { setOriginalImage, setError, isLoading, setLoading } = useFaceStore();
  const [dragActive, setDragActive] = useState(false);
  const { detectFace, initializeModels, isLoading: faceDetectionLoading, error: faceDetectionError } = useFaceDetection();

  // ファイル検証の定数
  const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB
  const MAX_RESOLUTION = 1920; // 1920px
  const SUPPORTED_FORMATS = ['image/jpeg', 'image/png', 'image/jpg'];

  const validateFile = useCallback((file: File): Promise<ImageData> => {
    return new Promise((resolve, reject) => {
      // ファイル形式チェック
      if (!SUPPORTED_FORMATS.includes(file.type)) {
        reject(new Error('サポートされていないファイル形式です。JPEGまたはPNGファイルを選択してください。'));
        return;
      }

      // ファイルサイズチェック
      if (file.size > MAX_FILE_SIZE) {
        reject(new Error(`ファイルサイズが大きすぎます。${MAX_FILE_SIZE / 1024 / 1024}MB以下のファイルを選択してください。`));
        return;
      }

      // 画像の解像度チェック
      const img = new Image();
      const url = URL.createObjectURL(file);
      
      img.onload = () => {
        URL.revokeObjectURL(url);
        
        if (img.width > MAX_RESOLUTION || img.height > MAX_RESOLUTION) {
          reject(new Error(`画像の解像度が大きすぎます。${MAX_RESOLUTION}px以下の画像を選択してください。`));
          return;
        }

        resolve({
          file,
          url: URL.createObjectURL(file),
          width: img.width,
          height: img.height,
        });
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('画像ファイルの読み込みに失敗しました。'));
      };

      img.src = url;
    });
  }, [MAX_FILE_SIZE, MAX_RESOLUTION, SUPPORTED_FORMATS]);

  const handleFileSelect = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);

    try {
      // 画像の検証とアップロード
      const imageData = await validateFile(file);
      setOriginalImage(imageData);
      
      // 画像が正常にアップロードされたら顔検出を実行
      const img = new Image();
      img.onload = async () => {
        try {
          // モデルの初期化（必要に応じて）
          await initializeModels();
          
          // 顔検出の実行
          await detectFace(img);
        } catch (faceError) {
          const errorMessage = faceError instanceof Error ? faceError.message : '顔検出でエラーが発生しました。';
          setError(errorMessage);
          setOriginalImage(null); // エラー時に画像をクリア
        }
      };
      
      img.onerror = () => {
        setError('画像の読み込みに失敗しました。');
      };
      
      img.src = imageData.url;
      
    } catch (error) {
      setError(error instanceof Error ? error.message : '画像の処理中にエラーが発生しました。');
    } finally {
      setLoading(false);
    }
  }, [setOriginalImage, setError, setLoading, detectFace, initializeModels, validateFile]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileSelect(e.dataTransfer.files[0]);
      }
    },
    [handleFileSelect]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        handleFileSelect(e.target.files[0]);
      }
    },
    [handleFileSelect]
  );

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        minHeight: 300,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        border: 2,
        borderStyle: 'dashed',
        borderColor: dragActive ? 'primary.main' : 'grey.300',
        borderRadius: 2,
        backgroundColor: dragActive ? 'action.hover' : 'transparent',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        '&:hover': {
          borderColor: 'primary.main',
          backgroundColor: 'action.hover',
        },
      }}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input
        accept="image/*"
        style={{ display: 'none' }}
        id="raised-button-file"
        type="file"
        onChange={handleInputChange}
        disabled={isLoading}
      />
      <label htmlFor="raised-button-file">
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}
        >
          {isLoading ? (
            <CircularProgress size={60} />
          ) : (
            <Box
              sx={{
                fontSize: 60,
                color: 'text.secondary',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              📁
            </Box>
          )}
          
          <Typography variant="h6" component="div" textAlign="center">
            {isLoading ? '画像を処理中...' : 
             faceDetectionLoading ? '顔検出中...' : 
             '画像をアップロード'}
          </Typography>
          
          <Typography variant="body2" color="text.secondary" textAlign="center">
            JPEGまたはPNGファイルをドラッグ&ドロップ
            <br />
            または
          </Typography>
          
          <Button
            variant="contained"
            component="span"
            disabled={isLoading}
          >
            ファイルを選択
          </Button>
          
          <Typography variant="caption" color="text.secondary" textAlign="center">
            最大ファイルサイズ: 8MB
            <br />
            最大解像度: 1920px × 1920px
          </Typography>
        </Box>
      </label>
      
      {faceDetectionError && (
        <Alert severity="error" sx={{ mt: 2, width: '100%' }}>
          {faceDetectionError}
        </Alert>
      )}
    </Box>
  );
};

export default ImageUpload; 
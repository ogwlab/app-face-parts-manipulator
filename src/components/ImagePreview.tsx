import React, { useRef, useEffect, useState } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Paper,
  Divider,
} from '@mui/material';
import { useFaceStore } from '../stores/faceStore';

const ImagePreview: React.FC = () => {
  const { 
    originalImage, 
    processedImageUrl, 
    isProcessing, 
    faceDetection 
  } = useFaceStore();
  
  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  // originalImageが変更された時にimageLoadedをリセット
  useEffect(() => {
    setImageLoaded(false);
  }, [originalImage]);

  // 元画像を Canvas に描画
  useEffect(() => {
    if (!originalImage || !originalCanvasRef.current) return;

    const canvas = originalCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      // Canvas サイズを設定
      const maxWidth = 400;
      const maxHeight = 400;
      
      const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
      const displayWidth = img.width * scale;
      const displayHeight = img.height * scale;
      
      canvas.width = displayWidth;
      canvas.height = displayHeight;
      
      // 画像を描画
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, displayWidth, displayHeight);
      
      // 顔検出結果がある場合、特徴点を描画
      if (faceDetection) {
        drawLandmarks(ctx, faceDetection.landmarks, scale);
      }
      
      setImageLoaded(true);
    };
    
    img.src = originalImage.url;
  }, [originalImage, faceDetection]);

  // 編集後画像を Canvas に描画
  useEffect(() => {
    if (!processedImageUrl || !processedCanvasRef.current) return;

    const canvas = processedCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      // Canvas サイズを設定
      const maxWidth = 400;
      const maxHeight = 400;
      
      const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
      const displayWidth = img.width * scale;
      const displayHeight = img.height * scale;
      
      canvas.width = displayWidth;
      canvas.height = displayHeight;
      
      // 画像を描画
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, displayWidth, displayHeight);
    };
    
    img.src = processedImageUrl;
  }, [processedImageUrl]);

  // 特徴点を描画する関数
  const drawLandmarks = (
    ctx: CanvasRenderingContext2D,
    landmarks: any,
    scale: number
  ) => {
    if (!landmarks) return;

    // 目の特徴点を描画
    const drawPoints = (points: Array<{x: number, y: number}>, color: string) => {
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;

      points.forEach((point, index) => {
        const x = point.x * scale;
        const y = point.y * scale;
        
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, 2 * Math.PI);
        ctx.fill();
        
        // 番号を表示（デバッグ用）
        ctx.fillText(`${index}`, x + 3, y - 3);
      });
    };

    // 各パーツを異なる色で描画
    if (landmarks.leftEye) drawPoints(landmarks.leftEye, '#FF0000');      // 赤
    if (landmarks.rightEye) drawPoints(landmarks.rightEye, '#00FF00');    // 緑
    if (landmarks.mouth) drawPoints(landmarks.mouth, '#0000FF');          // 青
    if (landmarks.nose) drawPoints(landmarks.nose, '#FF00FF');            // マゼンタ
    if (landmarks.jawline) drawPoints(landmarks.jawline, '#FFFF00');      // 黄
    if (landmarks.leftEyebrow) drawPoints(landmarks.leftEyebrow, '#FF8800'); // オレンジ
    if (landmarks.rightEyebrow) drawPoints(landmarks.rightEyebrow, '#8800FF'); // 紫
  };

  if (!originalImage) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          minHeight: 300,
        }}
      >
        <Typography variant="body1" color="text.secondary">
          画像をアップロードしてください
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%' }}>
      <Box 
        sx={{ 
          display: 'flex', 
          gap: 2, 
          height: '100%',
          flexDirection: { xs: 'column', md: 'row' }
        }}
      >
        {/* 元画像 */}
        <Box sx={{ flex: 1 }}>
          <Paper elevation={2} sx={{ p: 2, height: '100%' }}>
            <Typography variant="subtitle1" gutterBottom>
              元画像
            </Typography>
            
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 'calc(100% - 40px)',
                minHeight: 300,
              }}
            >
              {!imageLoaded ? (
                <CircularProgress />
              ) : (
                <canvas
                  ref={originalCanvasRef}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    border: '1px solid #ddd',
                  }}
                />
              )}
            </Box>
          </Paper>
        </Box>

        {/* 区切り線 */}
        <Divider 
          orientation="vertical" 
          flexItem 
          sx={{ display: { xs: 'none', md: 'block' } }}
        />
        <Divider 
          orientation="horizontal" 
          flexItem 
          sx={{ display: { xs: 'block', md: 'none' } }}
        />

        {/* 編集後画像 */}
        <Box sx={{ flex: 1 }}>
          <Paper elevation={2} sx={{ p: 2, height: '100%' }}>
            <Typography variant="subtitle1" gutterBottom>
              編集後
            </Typography>
            
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 'calc(100% - 40px)',
                minHeight: 300,
              }}
            >
              {isProcessing ? (
                <Box sx={{ textAlign: 'center' }}>
                  <CircularProgress sx={{ mb: 2 }} />
                  <Typography variant="body2" color="text.secondary">
                    処理中...
                  </Typography>
                </Box>
              ) : processedImageUrl ? (
                <canvas
                  ref={processedCanvasRef}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    border: '1px solid #ddd',
                  }}
                />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  パラメータを調整してください
                </Typography>
              )}
            </Box>
          </Paper>
        </Box>
      </Box>

      {/* 画像情報 */}
      <Box sx={{ mt: 2 }}>
        <Typography variant="caption" color="text.secondary">
          画像サイズ: {originalImage.width} × {originalImage.height}
          {faceDetection && (
            <>
              　|　顔検出: 成功
              　|　信頼度: {(faceDetection.confidence * 100).toFixed(1)}%
            </>
          )}
        </Typography>
      </Box>
    </Box>
  );
};

export default ImagePreview; 
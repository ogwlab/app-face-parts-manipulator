import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Paper,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ToggleButton,
} from '@mui/material';
import { useFaceStore } from '../../stores/faceStore';
import { useImageWarping } from '../../hooks/useImageWarping';
import SaveButton from './SaveButton';
import type { FaceLandmarks } from '../../types/face';

const ImagePreview: React.FC = () => {
  const { 
    originalImage, 
    processedImageUrl,
    isProcessing, 
    faceDetection
  } = useFaceStore();
  
  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<HTMLCanvasElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [canvasSize, setCanvasSize] = useState<{width: number, height: number} | null>(null);
  const [warpingQuality, setWarpingQuality] = useState<'fast' | 'medium' | 'high'>('high');
  const [showLandmarks, setShowLandmarks] = useState<boolean>(true);
  
  const { initializeCanvas } = useImageWarping();

  // originalImageが変更された時にimageLoadedをリセット
  useEffect(() => {
    console.log('🖼️ originalImage changed:', originalImage ? 'あり' : 'なし');
    setImageLoaded(false);
  }, [originalImage]);

  // Fabric.js Canvas の初期化（canvasSizeが確定してから）
  useEffect(() => {
    console.log('🎨 Fabric.js Canvas 初期化チェック:', {
      hasFabricCanvas: !!fabricCanvasRef.current,
      hasOriginalImage: !!originalImage,
      hasCanvasSize: !!canvasSize,
      canvasSize
    });

    if (fabricCanvasRef.current && originalImage && canvasSize) {
      console.log('✅ Fabric.js Canvas 初期化実行 - サイズ:', canvasSize);
      initializeCanvas(fabricCanvasRef.current, canvasSize.width, canvasSize.height);
    } else {
      console.log('❌ Fabric.js Canvas 初期化スキップ - 条件不足');
    }
  }, [originalImage, canvasSize, initializeCanvas]);

  // Canvas サイズ計算の共通関数（シンプル版）
  const calculateCanvasSize = useCallback((container: HTMLElement | null, imageWidth: number, imageHeight: number, canvasType: string) => {
    if (!container) {
      console.warn(`⚠️ ${canvasType}: Container not found, using default size`);
      return { width: 400, height: 400, scale: 1 };
    }
    
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    console.log(`📐 ${canvasType} - Container size:`, { containerWidth, containerHeight });
    
    // パディングを考慮（左右合計20px）
    const availableWidth = containerWidth - 20;
    const availableHeight = containerHeight - 20;
    
    // アスペクト比を保持しながらスケールを計算
    const scale = Math.min(availableWidth / imageWidth, availableHeight / imageHeight);
    
    const width = Math.floor(imageWidth * scale);
    const height = Math.floor(imageHeight * scale);
    
    const result = { width, height, scale };
    
    console.log(`📐 ${canvasType} - Size calculation:`, {
      image: { width: imageWidth, height: imageHeight },
      available: { width: availableWidth, height: availableHeight },
      result
    });
    
    return result;
  }, []);

  // 元画像を Canvas に描画
  useEffect(() => {
    if (!originalImage || !originalCanvasRef.current) {
      console.log('⚠️ 画像またはCanvasが利用できません');
      return;
    }

    const canvas = originalCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('❌ Canvas context を取得できません');
      return;
    }

    console.log('🎨 画像描画開始:', originalImage.url);
    const img = new Image();
    
    img.onload = () => {
      console.log('✅ 画像読み込み成功:', img.width, 'x', img.height);
      
      // Canvas サイズを計算
      const container = canvas.parentElement;
      const { width, height, scale } = calculateCanvasSize(container, img.width, img.height, '元画像Canvas');
      
      // Canvas サイズを設定
      canvas.width = width;
      canvas.height = height;
      
      // Canvasサイズを保存（編集後Canvasと同期するため）
      setCanvasSize({ width, height });
      
      console.log(`🎨 元画像Canvas設定: ${width}x${height}, scale: ${scale}`);
      
      // 画像を描画
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      console.log('✅ Canvas に画像を描画しました');
      
      // 顔検出結果がある場合、特徴点を描画（表示フラグがオンの時のみ）
      if (faceDetection && faceDetection.isDetected && showLandmarks) {
        console.log('🎯 顔検出結果を描画');
        drawLandmarks(ctx, faceDetection.landmarks, scale);
      }
      
      setImageLoaded(true);
    };
    
    img.onerror = (error) => {
      console.error('❌ 画像読み込みエラー:', error);
      setImageLoaded(false);
    };
    
    img.src = originalImage.url;
  }, [originalImage, faceDetection, showLandmarks, calculateCanvasSize]);

  // 重複処理を削除 - useImageWarpingフックでワーピング処理を一本化
  // このuseEffectは削除され、すべてのワーピング処理はuseImageWarpingフックで管理されます
  
  // コメントアウトした重複処理:
  // - パラメータ変更時のワーピング処理
  // - デバウンス処理
  // - 品質別のワーピング処理
  // これらはすべてuseImageWarping.tsで実行されるため、ここでは不要です

  // 編集後画像の表示（ワーピング結果または元画像）
  useEffect(() => {
    if (fabricCanvasRef.current && canvasSize) {
      const canvas = fabricCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // ワーピング結果があればそれを、なければ元画像を表示
      const imageUrl = processedImageUrl || (originalImage?.url);
      
      if (imageUrl) {
        console.log(`🔄 編集後Canvas表示: ${canvasSize.width}x${canvasSize.height}`, processedImageUrl ? '(ワーピング済み)' : '(元画像)');
        
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
          ctx.drawImage(img, 0, 0, canvasSize.width, canvasSize.height);
          console.log('✅ 編集後Canvasに画像を描画');
        };
        img.onerror = (error) => {
          console.error('❌ 編集後画像の読み込みエラー:', error);
          // エラー時は元画像にフォールバック
          if (originalImage && imageUrl !== originalImage.url) {
            img.src = originalImage.url;
          }
        };
        img.src = imageUrl;
      }
    }
  }, [canvasSize, originalImage, processedImageUrl]);

  // 特徴点を描画する関数
  const drawLandmarks = (
    ctx: CanvasRenderingContext2D,
    landmarks: FaceLandmarks,
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
    <Box 
      sx={{ 
        display: 'flex', 
        gap: 2, 
        height: '100%',
        flexDirection: { xs: 'column', md: 'row' },
        position: 'relative'
      }}
    >
        {/* 元画像 */}
        <Paper elevation={2} sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle1" sx={{ flexShrink: 0 }}>
              元画像
            </Typography>
            
            <ToggleButton
              value="landmarks"
              selected={showLandmarks}
              onChange={() => setShowLandmarks(!showLandmarks)}
              size="small"
              sx={{ 
                py: 0.5, 
                px: 1, 
                fontSize: '0.75rem',
                minWidth: 'auto',
                '&.Mui-selected': {
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                  },
                },
              }}
            >
              👁️ 特徴点
            </ToggleButton>
          </Box>
          
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
              <canvas
                ref={originalCanvasRef}
                style={{
                  border: '1px solid #ddd',
                  display: imageLoaded ? 'block' : 'none',
                }}
              />
              {!imageLoaded && (
                <CircularProgress sx={{ position: 'absolute' }} />
              )}
          </Box>
        </Paper>

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
        <Paper elevation={2} sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle1" sx={{ flexShrink: 0 }}>
              編集後
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 1 }}>
              <FormControl size="small" sx={{ minWidth: 100 }}>
                <InputLabel>品質</InputLabel>
                <Select
                  value={warpingQuality}
                  label="品質"
                  onChange={(e) => setWarpingQuality(e.target.value as 'fast' | 'medium' | 'high')}
                >
                  <MenuItem value="fast">高速</MenuItem>
                  <MenuItem value="medium">標準</MenuItem>
                  <MenuItem value="high">高品質</MenuItem>
                </Select>
              </FormControl>
              
              {/* 保存ボタン */}
              {processedImageUrl && (
                <SaveButton canvasRef={fabricCanvasRef} />
              )}
            </Box>
          </Box>
          
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
              <canvas
                ref={fabricCanvasRef}
                style={{
                  border: '1px solid #ddd',
                  display: originalImage && !isProcessing ? 'block' : 'none',
                }}
              />
              {isProcessing && (
                <Box sx={{ textAlign: 'center', position: 'absolute' }}>
                  <CircularProgress sx={{ mb: 2 }} />
                  <Typography variant="body2" color="text.secondary">
                    処理中...
                  </Typography>
                </Box>
              )}
              {!originalImage && !isProcessing && (
                <Typography variant="body2" color="text.secondary">
                  パラメータを調整してください
                </Typography>
              )}
          </Box>
        </Paper>

    </Box>
  );
};

export default ImagePreview; 
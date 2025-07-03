import React from 'react';
import { 
  Box, 
  Container, 
  Stack, 
  Paper, 
  Typography,
  Alert
} from '@mui/material';
import { useFaceStore } from '../../stores/faceStore';
import ImageUpload from '../ui/ImageUpload';
import ImagePreview from '../ui/ImagePreview';
import ControlPanel from '../panels/ControlPanel';

const MainLayout: React.FC = () => {
  const { error, originalImage } = useFaceStore();

  return (
    <Container maxWidth="xl" sx={{ py: 2, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h4" component="h1" gutterBottom align="center" sx={{ flexShrink: 0 }}>
        顔パーツ操作アプリ
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2, flexShrink: 0 }}>
          {error}
        </Alert>
      )}
      
      <Stack 
        direction={{ xs: 'column', md: 'row' }} 
        spacing={3} 
        sx={{ 
          flex: 1,
          minHeight: 0, // 重要: flexアイテムが縮小できるようにする
          overflow: 'hidden'
        }}
      >
        {/* 画像エリア */}
        <Box sx={{ flex: { xs: 1, md: 2 }, minHeight: 0 }}>
          <Paper elevation={3} sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" gutterBottom sx={{ flexShrink: 0 }}>
              画像プレビュー
            </Typography>
            
            <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              {!originalImage ? (
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                  }}
                >
                  <ImageUpload />
                </Box>
              ) : (
                <ImagePreview />
              )}
            </Box>
          </Paper>
        </Box>

        {/* 制御パネル */}
        <Box sx={{ flex: 1, minHeight: 0, minWidth: { xs: '100%', md: 350 }, maxWidth: { md: 400 } }}>
          <Paper elevation={3} sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" gutterBottom sx={{ flexShrink: 0 }}>
              顔パーツ制御
            </Typography>
            
            <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
              {originalImage ? (
                <ControlPanel />
              ) : (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                  }}
                >
                  <Typography variant="body1" color="text.secondary">
                    画像をアップロードしてください
                  </Typography>
                </Box>
              )}
            </Box>
          </Paper>
        </Box>
      </Stack>
    </Container>
  );
};

export default MainLayout; 
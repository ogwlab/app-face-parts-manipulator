import React from 'react';
import { 
  Box, 
  Container, 
  Stack, 
  Paper, 
  Typography,
  Alert
} from '@mui/material';
import { useFaceStore } from '../stores/faceStore';
import ImageUpload from './ImageUpload';
import ImagePreview from './ImagePreview';
import ControlPanel from './ControlPanel';

const MainLayout: React.FC = () => {
  const { error, originalImage } = useFaceStore();

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom align="center">
        顔パーツ操作アプリ
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Stack 
        direction={{ xs: 'column', md: 'row' }} 
        spacing={3} 
        sx={{ minHeight: '80vh' }}
      >
        {/* 画像エリア */}
        <Box sx={{ flex: { xs: 1, md: 2 } }}>
          <Paper elevation={3} sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              画像プレビュー
            </Typography>
            
            {!originalImage ? (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  minHeight: 400,
                }}
              >
                <ImageUpload />
              </Box>
            ) : (
              <ImagePreview />
            )}
          </Paper>
        </Box>

        {/* 制御パネル */}
        <Box sx={{ flex: 1 }}>
          <Paper elevation={3} sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              顔パーツ制御
            </Typography>
            
            {originalImage ? (
              <ControlPanel />
            ) : (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  minHeight: 400,
                }}
              >
                <Typography variant="body1" color="text.secondary">
                  画像をアップロードしてください
                </Typography>
              </Box>
            )}
          </Paper>
        </Box>
      </Stack>
    </Container>
  );
};

export default MainLayout; 
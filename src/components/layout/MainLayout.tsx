import React, { useState } from 'react';
import { 
  Box, 
  Container, 
  Stack, 
  Paper, 
  Typography,
  Alert,
  IconButton,
  Tooltip
} from '@mui/material';
import { useFaceStore } from '../../stores/faceStore';
import ImageUpload from '../ui/ImageUpload';
import ImagePreview from '../ui/ImagePreview';
import ControlPanel from '../panels/ControlPanel';
import ParameterHelpDialog from '../ui/ParameterHelpDialog';

const MainLayout: React.FC = () => {
  const { error, originalImage } = useFaceStore();
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);

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
          <Paper elevation={3} sx={{ p: 2, pr: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" sx={{ flexShrink: 0 }}>
                顔パーツ制御
              </Typography>
              
              <Tooltip title="パラメータの説明">
                <IconButton
                  size="small"
                  onClick={() => setHelpDialogOpen(true)}
                  sx={{
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                  }}
                >
                  ❓
                </IconButton>
              </Tooltip>
            </Box>
            
            <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0, pr: 1 }}>
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
      
      {/* ヘルプダイアログ */}
      <ParameterHelpDialog
        open={helpDialogOpen}
        onClose={() => setHelpDialogOpen(false)}
      />
    </Container>
  );
};

export default MainLayout; 
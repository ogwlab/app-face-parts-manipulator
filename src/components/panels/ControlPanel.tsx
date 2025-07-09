import React, { useState } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Typography,
  Button,
  CircularProgress,
} from '@mui/material';
import EyeControls from './EyeControls';
import MouthControls from './MouthControls';
import NoseControls from './NoseControls';
import { useFaceStore } from '../../stores/faceStore';
import { useFaceDetection } from '../../hooks/useFaceDetection';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`control-tabpanel-${index}`}
      aria-labelledby={`control-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 2 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

const ControlPanel: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const { resetAllParams, faceDetection } = useFaceStore();
  const { isLoadingModels } = useFaceDetection();

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleResetAll = () => {
    resetAllParams();
  };

  if (!faceDetection) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          minHeight: 300,
          textAlign: 'center',
        }}
      >
        <Typography variant="h6" gutterBottom>
          顔検出が必要です
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          アップロードした画像から顔を検出してください
        </Typography>
        {isLoadingModels && (
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <CircularProgress size={24} sx={{ mb: 1 }} />
            <Typography variant="body2" color="primary.main">
              初回は顔検出モデルの読み込みに時間がかかります
            </Typography>
            <Typography variant="caption" color="text.secondary">
              しばらくお待ちください...
            </Typography>
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', height: '100%' }}>
      {/* タブヘッダー */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange}
          variant="fullWidth"
          aria-label="face control tabs"
        >
          <Tab 
            label="👁️ 目" 
            id="control-tab-0"
            aria-controls="control-tabpanel-0"
          />
          <Tab 
            label="👄 口" 
            id="control-tab-1"
            aria-controls="control-tabpanel-1"
          />
          <Tab 
            label="👃 鼻" 
            id="control-tab-2"
            aria-controls="control-tabpanel-2"
          />
        </Tabs>
        
      </Box>

      {/* タブコンテンツ */}
      <Box sx={{ flex: 1, overflow: 'auto', px: 1 }}>
        <TabPanel value={tabValue} index={0}>
          <EyeControls />
        </TabPanel>
        
        <TabPanel value={tabValue} index={1}>
          <MouthControls />
        </TabPanel>
        
        <TabPanel value={tabValue} index={2}>
          <NoseControls />
        </TabPanel>
      </Box>

      {/* リセットボタン */}
      <Box sx={{ borderTop: 1, borderColor: 'divider', p: 2 }}>
        <Button 
          variant="outlined" 
          color="secondary"
          fullWidth
          onClick={handleResetAll}
        >
          すべてリセット
        </Button>
      </Box>
      
    </Box>
  );
};

export default ControlPanel; 
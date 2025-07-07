import React, { useState } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Box,
  Chip,
  IconButton,
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import CloseIcon from '@mui/icons-material/Close';
import SpeedIcon from '@mui/icons-material/Speed';
import BalanceIcon from '@mui/icons-material/Balance';
import HighQualityIcon from '@mui/icons-material/HighQuality';

export type UnifiedQualityMode = 'fast-preview' | 'balanced' | 'high-quality';

interface QualityModeConfig {
  label: string;
  icon: React.ReactNode;
  description: string;
  processingTime: string;
  warpingQuality: 'fast' | 'medium' | 'high';
  renderMode: 'forward' | 'hybrid' | 'backward';
  color: 'success' | 'primary' | 'secondary';
}

const qualityModes: Record<UnifiedQualityMode, QualityModeConfig> = {
  'fast-preview': {
    label: '高速プレビュー',
    icon: <SpeedIcon sx={{ fontSize: 20 }} />,
    description: 'リアルタイム編集向け・最速処理',
    processingTime: '~50-100ms',
    warpingQuality: 'fast',
    renderMode: 'forward',
    color: 'success',
  },
  'balanced': {
    label: 'バランス',
    icon: <BalanceIcon sx={{ fontSize: 20 }} />,
    description: '品質と速度のバランス・推奨設定',
    processingTime: '~150-300ms',
    warpingQuality: 'medium',
    renderMode: 'hybrid',
    color: 'primary',
  },
  'high-quality': {
    label: '最高品質',
    icon: <HighQualityIcon sx={{ fontSize: 20 }} />,
    description: '最終出力向け・最高品質処理',
    processingTime: '~1000-2000ms',
    warpingQuality: 'high',
    renderMode: 'backward',
    color: 'secondary',
  },
};

interface UnifiedQualitySelectorProps {
  value: UnifiedQualityMode;
  onChange: (mode: UnifiedQualityMode) => void;
  onWarpingQualityChange: (quality: 'fast' | 'medium' | 'high') => void;
  onRenderModeChange: (mode: 'forward' | 'hybrid' | 'backward') => void;
}

export const UnifiedQualitySelector: React.FC<UnifiedQualitySelectorProps> = ({
  value,
  onChange,
  onWarpingQualityChange,
  onRenderModeChange,
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleChange = (newMode: UnifiedQualityMode) => {
    const config = qualityModes[newMode];
    onChange(newMode);
    onWarpingQualityChange(config.warpingQuality);
    onRenderModeChange(config.renderMode);
  };

  const handleOpenDialog = () => {
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
  };

  const currentConfig = qualityModes[value];

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>品質</InputLabel>
          <Select
            value={value}
            label="品質"
            onChange={(e) => handleChange(e.target.value as UnifiedQualityMode)}
            renderValue={(selectedValue) => (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {qualityModes[selectedValue].icon}
                {qualityModes[selectedValue].label}
              </Box>
            )}
          >
            {Object.entries(qualityModes).map(([key, config]) => (
              <MenuItem key={key} value={key}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                  {config.icon}
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="body2" fontWeight="medium">
                      {config.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {config.processingTime}
                    </Typography>
                  </Box>
                  <Chip
                    label={key === 'balanced' ? '推奨' : key === 'fast-preview' ? '最速' : '最高品質'}
                    size="small"
                    color={config.color}
                    sx={{ height: 20 }}
                  />
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        
        <IconButton size="small" onClick={handleOpenDialog} sx={{ color: 'text.secondary' }}>
          <InfoIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      <Dialog 
        open={dialogOpen} 
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { maxHeight: '80vh' }
        }}
      >
        <DialogTitle sx={{ m: 0, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" component="div">
            品質設定の詳細
          </Typography>
          <IconButton
            aria-label="close"
            onClick={handleCloseDialog}
            sx={{ color: (theme) => theme.palette.grey[500] }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        
        <DialogContent dividers>
          <Typography variant="subtitle1" gutterBottom fontWeight="medium">
            現在の設定: {currentConfig.label}
          </Typography>
          
          <Box sx={{ mb: 3 }}>
            {Object.entries(qualityModes).map(([key, config]) => (
              <Box
                key={key}
                sx={{
                  border: 1,
                  borderColor: value === key ? 'primary.main' : 'divider',
                  borderRadius: 1,
                  p: 2,
                  mb: 1.5,
                  transition: 'all 0.2s',
                  bgcolor: value === key ? 'action.selected' : 'transparent',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                  {config.icon}
                  <Typography variant="body1" fontWeight="medium">
                    {config.label}
                  </Typography>
                  <Chip
                    label={key === 'balanced' ? '推奨' : key === 'fast-preview' ? '最速' : '最高品質'}
                    size="small"
                    color={config.color}
                    sx={{ height: 20 }}
                  />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {config.description}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  処理時間: {config.processingTime} | 
                  変形処理: {config.warpingQuality} | 
                  描画方式: {config.renderMode}
                </Typography>
              </Box>
            ))}
          </Box>
          
          <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" gutterBottom fontWeight="medium">
              設定の説明
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
              • <strong>変形処理:</strong> 顔パーツ変形の精度（制御点数・サンプリング密度）<br />
              • <strong>描画方式:</strong> メッシュレンダリングの手法（forward/hybrid/backward）<br />
              • <strong>処理時間:</strong> 800×600画像での参考値
            </Typography>
          </Box>
        </DialogContent>
        
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleCloseDialog} variant="contained">
            閉じる
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
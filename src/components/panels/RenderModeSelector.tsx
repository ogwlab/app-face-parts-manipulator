import React from 'react';
import {
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Box,
  Typography,
  Chip,
} from '@mui/material';
import { useFaceStore } from '../../stores/faceStore';
import SpeedIcon from '@mui/icons-material/Speed';
import BalanceIcon from '@mui/icons-material/Balance';
import HighQualityIcon from '@mui/icons-material/HighQuality';

interface RenderModeOption {
  value: 'forward' | 'backward' | 'hybrid';
  label: string;
  description: string;
  icon: React.ReactNode;
  chip?: string;
}

const renderModeOptions: RenderModeOption[] = [
  {
    value: 'forward',
    label: '高速（Forward）',
    description: 'プレビュー向け・最速処理',
    icon: <SpeedIcon sx={{ fontSize: 20 }} />,
    chip: '最速',
  },
  {
    value: 'hybrid',
    label: 'バランス（Hybrid）',
    description: 'エッジ部分のみ高品質処理',
    icon: <BalanceIcon sx={{ fontSize: 20 }} />,
    chip: '推奨',
  },
  {
    value: 'backward',
    label: '高品質（Backward）',
    description: '最高品質・最終出力向け',
    icon: <HighQualityIcon sx={{ fontSize: 20 }} />,
    chip: '最高品質',
  },
];

export const RenderModeSelector: React.FC = () => {
  const { renderMode, setRenderMode } = useFaceStore();

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRenderMode(event.target.value as 'forward' | 'backward' | 'hybrid');
    console.log(`🎨 レンダリングモード変更: ${event.target.value}`);
  };

  return (
    <Box sx={{ mb: 3 }}>
      <FormControl component="fieldset" fullWidth>
        <FormLabel component="legend" sx={{ mb: 1.5, fontWeight: 'medium' }}>
          レンダリングモード
        </FormLabel>
        <RadioGroup
          value={renderMode}
          onChange={handleChange}
          sx={{ gap: 1 }}
        >
          {renderModeOptions.map((option) => (
            <Box
              key={option.value}
              sx={{
                border: 1,
                borderColor: renderMode === option.value ? 'primary.main' : 'divider',
                borderRadius: 1,
                p: 1.5,
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: 'action.hover',
                },
              }}
            >
              <FormControlLabel
                value={option.value}
                control={<Radio size="small" />}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {option.icon}
                    <Box sx={{ flexGrow: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" fontWeight="medium">
                          {option.label}
                        </Typography>
                        {option.chip && (
                          <Chip
                            label={option.chip}
                            size="small"
                            color={option.value === 'hybrid' ? 'primary' : 'default'}
                            sx={{ height: 20 }}
                          />
                        )}
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {option.description}
                      </Typography>
                    </Box>
                  </Box>
                }
                sx={{ m: 0, width: '100%' }}
              />
            </Box>
          ))}
        </RadioGroup>
      </FormControl>
      
      {/* パフォーマンス情報 */}
      <Box sx={{ mt: 2, p: 1.5, bgcolor: 'background.paper', borderRadius: 1 }}>
        <Typography variant="caption" color="text.secondary">
          <strong>参考処理時間（800×600画像）:</strong><br />
          • 高速: ~50-100ms<br />
          • バランス: ~150-300ms（エッジ20px）<br />
          • 高品質: ~1000-2000ms
        </Typography>
      </Box>
    </Box>
  );
};
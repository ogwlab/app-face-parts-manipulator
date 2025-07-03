import React from 'react';
import {
  Box,
  Typography,
  Slider,
  TextField,
  IconButton,
  Button,
} from '@mui/material';

interface ParameterControlProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  unit: string;
  onReset: () => void;
  resetOnly?: boolean;
  resetLabel?: string;
}

const ParameterControl: React.FC<ParameterControlProps> = ({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
  onReset,
  resetOnly = false,
  resetLabel = "🔄",
}) => {
  const handleSliderChange = (_event: Event, newValue: number | number[]) => {
    if (typeof newValue === 'number') {
      onChange(newValue);
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(event.target.value);
    if (!isNaN(newValue) && newValue >= min && newValue <= max) {
      onChange(newValue);
    }
  };

  // リセット専用の場合
  if (resetOnly) {
    return (
      <Button
        variant="outlined"
        size="small"
        onClick={onReset}
        sx={{ alignSelf: 'flex-start' }}
      >
        {resetLabel}
      </Button>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="body2" fontWeight="medium">
          {label}
        </Typography>
        <IconButton
          size="small"
          onClick={onReset}
          sx={{ 
            fontSize: '0.8rem', 
            minWidth: 'auto',
            width: 24,
            height: 24,
          }}
        >
          🔄
        </IconButton>
      </Box>
      
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {/* スライダー */}
        <Box sx={{ flex: 1 }}>
          <Slider
            value={value}
            onChange={handleSliderChange}
            min={min}
            max={max}
            step={step}
            size="small"
            valueLabelDisplay="auto"
            valueLabelFormat={(val) => `${val}${unit}`}
          />
        </Box>
        
        {/* 数値入力 */}
        <TextField
          size="small"
          type="number"
          value={value.toFixed(2)}
          onChange={handleInputChange}
          inputProps={{
            min,
            max,
            step,
            style: { textAlign: 'right' }
          }}
          sx={{ 
            width: 80,
            '& input': { 
              fontSize: '0.875rem',
              padding: '4px 8px'
            }
          }}
        />
        
        {/* 単位 */}
        {unit && (
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 20 }}>
            {unit}
          </Typography>
        )}
      </Box>
      
      {/* 値の範囲表示 */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          {min}{unit}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {max}{unit}
        </Typography>
      </Box>
    </Box>
  );
};

export default ParameterControl; 
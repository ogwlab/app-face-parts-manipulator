import React, { useState } from 'react';
import {
  Button,
  Menu,
  MenuItem,
  CircularProgress,
  Divider,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useFaceStore } from '../../stores/faceStore';

interface SaveButtonProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

const SaveButton: React.FC<SaveButtonProps> = ({ canvasRef }) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { exportSettings, setExportSettings } = useFaceStore();
  
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSave = async (format: 'png' | 'jpg') => {
    handleClose();
    
    if (!canvasRef.current) {
      console.error('Canvas reference not found');
      return;
    }

    setIsSaving(true);
    setExportSettings({ ...exportSettings, format });

    try {
      // TODO: Step 2で実装 - imageExporter.tsを呼び出す
      console.log(`Saving as ${format.toUpperCase()}`);
      
      // 仮の実装 - 実際の保存処理は次のステップで
      const canvas = canvasRef.current;
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            a.href = url;
            a.download = `face_edited_${timestamp}.${format}`;
            a.click();
            URL.revokeObjectURL(url);
          }
        },
        format === 'png' ? 'image/png' : 'image/jpeg',
        format === 'jpg' ? exportSettings.jpgQuality : undefined
      );
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Button
        id="save-button"
        aria-controls={open ? 'save-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        variant="contained"
        onClick={handleClick}
        startIcon={isSaving ? <CircularProgress size={20} /> : <SaveIcon />}
        endIcon={<ExpandMoreIcon />}
        disabled={isSaving}
        sx={{
          minWidth: 120,
        }}
      >
        {isSaving ? '保存中...' : '保存'}
      </Button>
      <Menu
        id="save-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          'aria-labelledby': 'save-button',
        }}
      >
        <MenuItem onClick={() => handleSave('png')}>
          PNG形式で保存
        </MenuItem>
        <MenuItem onClick={() => handleSave('jpg')}>
          JPG形式で保存
        </MenuItem>
        <Divider />
        <MenuItem disabled sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
          JPG品質: {Math.round(exportSettings.jpgQuality * 100)}%
        </MenuItem>
      </Menu>
    </>
  );
};

export default SaveButton;
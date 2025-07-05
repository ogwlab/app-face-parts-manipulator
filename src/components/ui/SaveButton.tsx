import React, { useState } from 'react';
import {
  Button,
  Menu,
  MenuItem,
  CircularProgress,
  Divider,
  Snackbar,
  Alert,
  Typography,
  Box,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useFaceStore } from '../../stores/faceStore';
import { generateFileName } from '../../utils/fileNameGenerator';

interface SaveButtonProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

const SaveButton: React.FC<SaveButtonProps> = ({ canvasRef }) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
  const { exportSettings, setExportSettings, faceParams } = useFaceStore();
  
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  const showNotification = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleSave = async (format: 'png' | 'jpg') => {
    handleClose();
    
    if (!canvasRef.current) {
      console.error('Canvas reference not found');
      showNotification('エラー: Canvas参照が見つかりません', 'error');
      return;
    }

    setIsSaving(true);
    setExportSettings({ ...exportSettings, format });

    try {
      // ファイル名を生成
      const fileName = generateFileName({
        format,
        includeTimestamp: true,
        includeParams: true,
        faceParams
      });
      
      console.log(`💾 保存開始: ${fileName}`);
      
      const canvas = canvasRef.current;
      canvas.toBlob(
        (blob) => {
          if (blob) {
            // ダウンロードリンクを作成
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            
            // ダウンロードを開始
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // URLを解放
            URL.revokeObjectURL(url);
            
            // 成功通知
            showNotification(`${fileName} を保存しました`);
            console.log(`✅ 保存完了: ${fileName}`);
          } else {
            showNotification('エラー: 画像の生成に失敗しました', 'error');
          }
        },
        format === 'png' ? 'image/png' : 'image/jpeg',
        format === 'jpg' ? exportSettings.jpgQuality : undefined
      );
    } catch (error) {
      console.error('Save error:', error);
      showNotification('エラー: 保存に失敗しました', 'error');
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
          <Box>
            <Typography variant="body2">PNG形式で保存</Typography>
            <Typography variant="caption" color="text.secondary">
              高品質・透過対応
            </Typography>
          </Box>
        </MenuItem>
        <MenuItem onClick={() => handleSave('jpg')}>
          <Box>
            <Typography variant="body2">JPG形式で保存</Typography>
            <Typography variant="caption" color="text.secondary">
              ファイルサイズ小・品質 {Math.round(exportSettings.jpgQuality * 100)}%
            </Typography>
          </Box>
        </MenuItem>
        <Divider />
        <MenuItem disabled>
          <Box>
            <Typography variant="caption" color="text.secondary">
              ファイル名例:
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
              {generateFileName({
                format: 'png',
                includeTimestamp: false,
                includeParams: true,
                faceParams
              }).slice(0, -4)}...
            </Typography>
          </Box>
        </MenuItem>
      </Menu>
      
      {/* 保存成功/エラー通知 */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleSnackbarClose} 
          severity={snackbarSeverity}
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </>
  );
};

export default SaveButton;
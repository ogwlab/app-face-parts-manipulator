import React, { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Alert,
  Snackbar,
} from '@mui/material';
import { useFaceStore } from '../../stores/faceStore';
import { useStandardizationStore } from '../../stores/standardizationStore';
import { 
  saveSettingsToStorage, 
  clearSettingsFromStorage,
  hasStoredSettings,
  getSettingsSummary 
} from '../../utils/settingsStorage';

interface SettingsButtonsProps {
  onSettingsSaved?: () => void;
  onSettingsCleared?: () => void;
}

const SettingsButtons: React.FC<SettingsButtonsProps> = ({
  onSettingsSaved,
  onSettingsCleared
}) => {
  const { faceParams, resetAllParams, clearStandardization: clearFaceStoreStandardization } = useFaceStore();
  const { 
    resetParams: resetStandardizationParams, 
    clearStandardization: clearStandardizationStore,
    setStandardizationEnabled 
  } = useStandardizationStore();
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'success'
  });

  // 設定保存ハンドラー
  const handleSaveSettings = () => {
    try {
      const success = saveSettingsToStorage(
        faceParams,
        'balanced', // デフォルト品質
        false       // 標準化設定（今後の拡張用）
      );

      if (success) {
        setSnackbar({
          open: true,
          message: '設定を保存しました',
          severity: 'success'
        });
        onSettingsSaved?.();
      } else {
        setSnackbar({
          open: true,
          message: '設定の保存に失敗しました',
          severity: 'error'
        });
      }
    } catch (error) {
      console.error('設定保存エラー:', error);
      setSnackbar({
        open: true,
        message: '設定の保存中にエラーが発生しました',
        severity: 'error'
      });
    }
  };

  // 設定クリア確認ダイアログを開く
  const handleOpenClearDialog = () => {
    setClearDialogOpen(true);
  };

  // 設定クリア実行
  const handleConfirmClear = () => {
    try {
      const success = clearSettingsFromStorage();
      
      if (success) {
        // 顔パーツパラメータをリセット
        resetAllParams();
        
        // 標準化設定もクリア
        resetStandardizationParams();
        clearStandardizationStore();
        clearFaceStoreStandardization();
        setStandardizationEnabled(false);
        
        setSnackbar({
          open: true,
          message: '保存された設定と標準化設定をクリアしました',
          severity: 'info'
        });
        onSettingsCleared?.();
      } else {
        setSnackbar({
          open: true,
          message: '設定のクリアに失敗しました',
          severity: 'error'
        });
      }
    } catch (error) {
      console.error('設定クリアエラー:', error);
      setSnackbar({
        open: true,
        message: '設定のクリア中にエラーが発生しました',
        severity: 'error'
      });
    }
    
    setClearDialogOpen(false);
  };

  // スナックバーを閉じる
  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  // 保存された設定の情報を取得
  const settingsSummary = getSettingsSummary();
  const hasSettings = hasStoredSettings();

  return (
    <>
      {/* 設定管理ボタン */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button 
          variant="contained" 
          size="small" 
          fullWidth
          onClick={handleSaveSettings}
          sx={{ fontSize: '0.75rem' }}
        >
          💾 設定を保存
        </Button>
        <Button 
          variant="outlined" 
          size="small" 
          fullWidth
          onClick={handleOpenClearDialog}
          disabled={!hasSettings}
          sx={{ fontSize: '0.75rem' }}
        >
          🗑️ 設定をクリア
        </Button>
      </Box>

      {/* 設定状態の表示（開発モード時のみ） */}
      {process.env.NODE_ENV === 'development' && settingsSummary.hasSettings && (
        <Typography 
          variant="caption" 
          color="text.secondary" 
          sx={{ 
            mt: 0.5, 
            fontSize: '0.65rem',
            textAlign: 'center',
            display: 'block'
          }}
        >
          最終保存: {settingsSummary.lastSaved?.toLocaleTimeString()}
        </Typography>
      )}

      {/* 設定クリア確認ダイアログ */}
      <Dialog
        open={clearDialogOpen}
        onClose={() => setClearDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          設定をクリア
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            保存された設定を完全に削除し、現在のパラメータと標準化設定もリセットされます。
          </Alert>
          <Typography variant="body2">
            この操作は元に戻せません。本当に実行しますか？
          </Typography>
          {settingsSummary.hasSettings && settingsSummary.lastSaved && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              最後の保存: {settingsSummary.lastSaved.toLocaleString()}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setClearDialogOpen(false)}
            variant="outlined"
          >
            キャンセル
          </Button>
          <Button 
            onClick={handleConfirmClear}
            variant="contained"
            color="warning"
          >
            クリア実行
          </Button>
        </DialogActions>
      </Dialog>

      {/* 通知スナックバー */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default SettingsButtons;
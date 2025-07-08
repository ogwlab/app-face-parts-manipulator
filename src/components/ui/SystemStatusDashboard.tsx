/**
 * システム状態監視ダッシュボードコンポーネント
 * 
 * アプリケーションの健全性、パフォーマンス、エラー状況をリアルタイムで監視・表示
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  LinearProgress,
  Chip,
  Stack,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  IconButton,
  Tooltip,
  Alert,
  AlertTitle,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Close as CloseIcon,
  Refresh as RefreshIcon,
  Memory as MemoryIcon,
  Speed as SpeedIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Computer as ComputerIcon,
  Storage as StorageIcon,
  NetworkCheck as NetworkIcon,
  Timeline as TimelineIcon,
  ExpandMore as ExpandMoreIcon,
  Download as DownloadIcon
} from '@mui/icons-material';

import { useErrorHandling } from '../../hooks/useErrorHandling';
import { globalSafeExecutor } from '../../utils/concurrency';
import { globalStateManager } from '../../utils/stateManagement';

interface SystemStatusDashboardProps {
  open: boolean;
  onClose: () => void;
}

interface SystemMetrics {
  memory: {
    used: number;
    total: number;
    percentage: number;
    isLow: boolean;
    isCritical: boolean;
  };
  performance: {
    score: number;
    loadTime: number;
    renderTime: number;
  };
  browser: {
    webGL: boolean;
    canvas: boolean;
    workers: boolean;
    storage: boolean;
  };
  errors: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    recent: any[];
  };
  operations: {
    active: number;
    completed: number;
    failed: number;
    queue: any[];
  };
  state: {
    version: number;
    snapshots: number;
    healthy: boolean;
    issues: any[];
  };
}

export const SystemStatusDashboard: React.FC<SystemStatusDashboardProps> = ({
  open,
  onClose
}) => {
  const {
    browserCapabilities,
    memoryInfo,
    errorHistory,
    getErrorStats,
    updateMemoryInfo,
    checkBrowserCapabilities
  } = useErrorHandling();

  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  /**
   * システムメトリクスを収集
   */
  const collectMetrics = useCallback(async () => {
    setLoading(true);
    
    try {
      // メモリ情報更新
      const memoryData = await updateMemoryInfo();
      
      // ブラウザ機能確認
      const browserData = await checkBrowserCapabilities();
      
      // エラー統計
      const errorStats = getErrorStats();
      const recentErrors = errorHistory.slice(-10);
      
      // 実行状況
      const executionStatus = globalSafeExecutor.getExecutionStatus();
      
      // 状態管理統計
      const stateStats = globalStateManager.getStatistics();
      const healthCheck = await globalStateManager.healthCheck({});
      
      // パフォーマンス測定
      const performanceData = measurePerformance();

      const systemMetrics: SystemMetrics = {
        memory: {
          used: memoryData?.usedJSHeapSize || 0,
          total: memoryData?.jsHeapSizeLimit || 0,
          percentage: memoryData?.usagePercentage || 0,
          isLow: memoryData?.isLowMemory || false,
          isCritical: memoryData?.isCriticalMemory || false
        },
        performance: performanceData,
        browser: {
          webGL: browserData?.webGL || false,
          canvas: browserData?.canvas || false,
          workers: browserData?.webWorkers || false,
          storage: browserData?.localStorage || false
        },
        errors: {
          total: errorHistory.length,
          critical: errorStats.CRITICAL,
          high: errorStats.HIGH,
          medium: errorStats.MEDIUM,
          low: errorStats.LOW,
          recent: recentErrors
        },
        operations: {
          active: executionStatus.processingQueue.currentlyProcessing,
          completed: executionStatus.processingQueue.processedCount,
          failed: executionStatus.processingQueue.errorCount,
          queue: executionStatus.activeOperations
        },
        state: {
          version: stateStats.logger.currentVersion,
          snapshots: stateStats.snapshots.count,
          healthy: healthCheck.isHealthy,
          issues: healthCheck.issues
        }
      };

      setMetrics(systemMetrics);
    } catch (error) {
      console.error('メトリクス収集エラー:', error);
    } finally {
      setLoading(false);
    }
  }, [updateMemoryInfo, checkBrowserCapabilities, getErrorStats, errorHistory]);

  /**
   * パフォーマンス測定
   */
  const measurePerformance = (): SystemMetrics['performance'] => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    return {
      score: browserCapabilities?.performanceScore || 50,
      loadTime: navigation ? navigation.loadEventEnd - navigation.navigationStart : 0,
      renderTime: navigation ? navigation.domContentLoadedEventEnd - navigation.navigationStart : 0
    };
  };

  /**
   * 自動リフレッシュの切り替え
   */
  const toggleAutoRefresh = useCallback(() => {
    if (autoRefresh) {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        setRefreshInterval(null);
      }
      setAutoRefresh(false);
    } else {
      const interval = setInterval(collectMetrics, 5000); // 5秒間隔
      setRefreshInterval(interval);
      setAutoRefresh(true);
    }
  }, [autoRefresh, refreshInterval, collectMetrics]);

  /**
   * レポートをダウンロード
   */
  const downloadReport = useCallback(() => {
    if (!metrics) return;

    const report = {
      timestamp: new Date().toISOString(),
      metrics,
      browserInfo: {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled
      },
      windowInfo: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio
      },
      url: window.location.href
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [metrics]);

  // 初期メトリクス収集
  useEffect(() => {
    if (open) {
      collectMetrics();
    }
  }, [open, collectMetrics]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [refreshInterval]);

  if (!metrics) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogContent>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
            <LinearProgress sx={{ width: '50%' }} />
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  const getHealthStatus = (isHealthy: boolean) => ({
    color: isHealthy ? 'success' : 'error',
    icon: isHealthy ? <CheckCircleIcon /> : <ErrorIcon />,
    label: isHealthy ? '正常' : '問題あり'
  });

  const getMemoryStatus = (percentage: number, isCritical: boolean, isLow: boolean) => {
    if (isCritical) return { color: 'error', label: '危険' };
    if (isLow) return { color: 'warning', label: '注意' };
    if (percentage > 50) return { color: 'info', label: '中程度' };
    return { color: 'success', label: '良好' };
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const systemHealth = getHealthStatus(metrics.state.healthy);
  const memoryStatus = getMemoryStatus(
    metrics.memory.percentage,
    metrics.memory.isCritical,
    metrics.memory.isLow
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{
        sx: { height: '90vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={2}>
            <ComputerIcon />
            <Typography variant="h6">システム状態監視</Typography>
            <Chip
              icon={systemHealth.icon}
              label={systemHealth.label}
              color={systemHealth.color as any}
              size="small"
            />
          </Box>
          <Box>
            <Tooltip title="レポートダウンロード">
              <IconButton onClick={downloadReport}>
                <DownloadIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title={autoRefresh ? "自動更新を停止" : "自動更新を開始"}>
              <IconButton onClick={toggleAutoRefresh} color={autoRefresh ? "primary" : "default"}>
                <TimelineIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="手動更新">
              <IconButton onClick={collectMetrics} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <IconButton onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Grid container spacing={3}>
          {/* メモリ使用量 */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader
                avatar={<MemoryIcon color={memoryStatus.color as any} />}
                title="メモリ使用量"
                subheader={`${formatBytes(metrics.memory.used)} / ${formatBytes(metrics.memory.total)}`}
                action={
                  <Chip label={memoryStatus.label} color={memoryStatus.color as any} size="small" />
                }
              />
              <CardContent>
                <LinearProgress
                  variant="determinate"
                  value={metrics.memory.percentage}
                  color={memoryStatus.color as any}
                  sx={{ height: 8, borderRadius: 4 }}
                />
                <Typography variant="body2" color="textSecondary" mt={1}>
                  {metrics.memory.percentage.toFixed(1)}% 使用中
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* パフォーマンス */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader
                avatar={<SpeedIcon color="primary" />}
                title="パフォーマンス"
                subheader={`スコア: ${metrics.performance.score}/100`}
              />
              <CardContent>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="body2" color="textSecondary">
                      読み込み時間: {metrics.performance.loadTime.toFixed(0)}ms
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(100, metrics.performance.loadTime / 50)}
                      color={metrics.performance.loadTime < 2000 ? "success" : "warning"}
                      sx={{ height: 4 }}
                    />
                  </Box>
                  <Box>
                    <Typography variant="body2" color="textSecondary">
                      レンダリング時間: {metrics.performance.renderTime.toFixed(0)}ms
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(100, metrics.performance.renderTime / 30)}
                      color={metrics.performance.renderTime < 1000 ? "success" : "warning"}
                      sx={{ height: 4 }}
                    />
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* ブラウザ機能 */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader
                avatar={<NetworkIcon color="info" />}
                title="ブラウザ機能"
              />
              <CardContent>
                <Stack spacing={1}>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">WebGL</Typography>
                    <Chip
                      label={metrics.browser.webGL ? "対応" : "非対応"}
                      color={metrics.browser.webGL ? "success" : "error"}
                      size="small"
                    />
                  </Box>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">Canvas</Typography>
                    <Chip
                      label={metrics.browser.canvas ? "対応" : "非対応"}
                      color={metrics.browser.canvas ? "success" : "error"}
                      size="small"
                    />
                  </Box>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">Web Workers</Typography>
                    <Chip
                      label={metrics.browser.workers ? "対応" : "非対応"}
                      color={metrics.browser.workers ? "success" : "warning"}
                      size="small"
                    />
                  </Box>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">ローカルストレージ</Typography>
                    <Chip
                      label={metrics.browser.storage ? "対応" : "非対応"}
                      color={metrics.browser.storage ? "success" : "warning"}
                      size="small"
                    />
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* エラー統計 */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader
                avatar={<ErrorIcon color="error" />}
                title="エラー統計"
                subheader={`合計: ${metrics.errors.total}件`}
              />
              <CardContent>
                <Stack spacing={1}>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">緊急</Typography>
                    <Chip label={metrics.errors.critical} color="error" size="small" />
                  </Box>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">重要</Typography>
                    <Chip label={metrics.errors.high} color="warning" size="small" />
                  </Box>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">中程度</Typography>
                    <Chip label={metrics.errors.medium} color="info" size="small" />
                  </Box>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">軽微</Typography>
                    <Chip label={metrics.errors.low} color="success" size="small" />
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* 処理状況 */}
          <Grid item xs={12}>
            <Card>
              <CardHeader
                avatar={<StorageIcon color="primary" />}
                title="処理状況"
              />
              <CardContent>
                <Grid container spacing={3}>
                  <Grid item xs={3}>
                    <Box textAlign="center">
                      <Typography variant="h4" color="primary">
                        {metrics.operations.active}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        実行中
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={3}>
                    <Box textAlign="center">
                      <Typography variant="h4" color="success.main">
                        {metrics.operations.completed}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        完了
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={3}>
                    <Box textAlign="center">
                      <Typography variant="h4" color="error.main">
                        {metrics.operations.failed}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        失敗
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={3}>
                    <Box textAlign="center">
                      <Typography variant="h4" color="warning.main">
                        {metrics.operations.queue.length}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        待機中
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* 詳細情報 */}
          <Grid item xs={12}>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">詳細情報</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={3}>
                  {/* 実行中の操作 */}
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle1" gutterBottom>
                      実行中の操作
                    </Typography>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>操作ID</TableCell>
                            <TableCell>コンテキスト</TableCell>
                            <TableCell>実行時間</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {metrics.operations.queue.slice(0, 5).map((op) => (
                            <TableRow key={op.operationId}>
                              <TableCell>
                                <Typography variant="caption" fontFamily="monospace">
                                  {op.operationId.slice(-8)}
                                </Typography>
                              </TableCell>
                              <TableCell>{op.context}</TableCell>
                              <TableCell>{op.duration.toFixed(0)}ms</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Grid>

                  {/* 最近のエラー */}
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle1" gutterBottom>
                      最近のエラー
                    </Typography>
                    <List>
                      {metrics.errors.recent.slice(0, 5).map((error, index) => (
                        <ListItem key={index} divider>
                          <ListItemIcon>
                            {error.severity === 'CRITICAL' ? <ErrorIcon color="error" /> : <WarningIcon color="warning" />}
                          </ListItemIcon>
                          <ListItemText
                            primary={error.userMessage || error.message}
                            secondary={new Date(error.timestamp).toLocaleString()}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Grid>

          {/* 状態の問題 */}
          {metrics.state.issues.length > 0 && (
            <Grid item xs={12}>
              <Alert severity="warning">
                <AlertTitle>状態の問題が検出されました</AlertTitle>
                <List>
                  {metrics.state.issues.map((issue, index) => (
                    <ListItem key={index}>
                      <ListItemText primary={issue.message} />
                    </ListItem>
                  ))}
                </List>
              </Alert>
            </Grid>
          )}
        </Grid>
      </DialogContent>

      <DialogActions>
        <Typography variant="caption" color="textSecondary" sx={{ mr: 'auto' }}>
          最終更新: {new Date().toLocaleTimeString()}
          {autoRefresh && " (自動更新中)"}
        </Typography>
        <Button onClick={onClose}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
};

export default SystemStatusDashboard;
import React, { useState } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Paper,
} from '@mui/material';
import ControlPanel from './panels/ControlPanel';
import StandardizationPanel from './panels/StandardizationPanel';
import ContourControls from './panels/ContourControls';
import SettingsButtons from './ui/SettingsButtons';

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
      id={`top-level-tabpanel-${index}`}
      aria-labelledby={`top-level-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ height: '100%' }}>
          {children}
        </Box>
      )}
    </div>
  );
};

const TopLevelTabs: React.FC = () => {
  const [value, setValue] = useState(0);

  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  return (
    <Paper elevation={3} sx={{ p: 2, pr: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 設定管理ボタン */}
      <Box sx={{ mb: 2 }}>
        <SettingsButtons />
      </Box>
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={value} onChange={handleChange} aria-label="top level tabs">
          <Tab label="🎨 標準化" id="top-level-tab-0" aria-controls="top-level-tabpanel-0" />
          <Tab label="✏️ パーツ操作" id="top-level-tab-1" aria-controls="top-level-tabpanel-1" />
          <Tab label="🔷 輪郭操作" id="top-level-tab-2" aria-controls="top-level-tabpanel-2" />
        </Tabs>
      </Box>
      
      <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        <TabPanel value={value} index={0}>
          <StandardizationPanel />
        </TabPanel>
        <TabPanel value={value} index={1}>
          <ControlPanel />
        </TabPanel>
        <TabPanel value={value} index={2}>
          <ContourControls />
        </TabPanel>
      </Box>
    </Paper>
  );
};

export default TopLevelTabs;
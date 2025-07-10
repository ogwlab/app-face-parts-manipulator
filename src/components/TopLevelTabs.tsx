import React, { useState } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Paper,
} from '@mui/material';
import ControlPanel from './panels/ControlPanel';
import StandardizationPanel from './panels/StandardizationPanel';

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
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={value} onChange={handleChange} aria-label="top level tabs">
          <Tab label="🎨 標準化" id="top-level-tab-0" aria-controls="top-level-tabpanel-0" />
          <Tab label="✏️ パーツ操作" id="top-level-tab-1" aria-controls="top-level-tabpanel-1" />
        </Tabs>
      </Box>
      
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <TabPanel value={value} index={0}>
          <StandardizationPanel />
        </TabPanel>
        <TabPanel value={value} index={1}>
          <ControlPanel />
        </TabPanel>
      </Box>
    </Paper>
  );
};

export default TopLevelTabs;
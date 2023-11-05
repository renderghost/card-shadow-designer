import React, { useState } from 'react';
import ControlPanel from './components/ControlPanel/ControlPanel';
import CardPreview from './components/CardPreview/CardPreview';
import CSSCodeBlock from './components/CSSCodeBlock/CSSCodeBlock';

function App() {
  const [shadowSettings, setShadowSettings] = useState({
    default: { offsetX: 5, offsetY: 5, blur: 10, spread: 2, color: '#000000' },
    hover: { offsetX: 10, offsetY: 10, blur: 15, spread: 3, color: '#000000' },
    active: { offsetX: 2, offsetY: 2, blur: 5, spread: 1, color: '#000000' }
  });

  // Function to update shadow settings for a specific state

  const updateShadowSettings = (stateKey, settingKey, value) => {
    setShadowSettings(prev => ({
      ...prev,
      [stateKey]: {
        ...prev[stateKey],
        [settingKey]: value
      }
    }));
  };

  // ... other logic

  return (
    <div className="App">
      <ControlPanel settings={shadowSettings} updateSettings={updateShadowSettings} />
      <CardPreview settings={shadowSettings} />
      <CSSCodeBlock settings={shadowSettings} />
    </div>
  );
}

export default App;
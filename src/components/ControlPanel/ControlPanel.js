import React from 'react';
import Slider from './Slider';
import ColorPicker from './ColorPicker';

function ControlPanel({ settings, updateSettings }) {
    // Function to handle changes for sliders and color picker
    const handleChange = (stateKey, settingKey) => (event) => {
        updateSettings(stateKey, settingKey, event.target.value);
    };

    return (
        <div className="ControlPanel">
            {Object.keys(settings).map(stateKey => (
                <div key={stateKey}>
                    <h2>{stateKey.charAt(0).toUpperCase() + stateKey.slice(1)} State</h2>
                    <Slider
                        label="Offset X"
                        value={settings[stateKey].offsetX}
                        min={-50}
                        max={50}
                        onChange={handleChange(stateKey, 'offsetX')}
                    />
                    <Slider
                        label="Offset Y"
                        value={settings[stateKey].offsetY}
                        min={-50}
                        max={50}
                        onChange={handleChange(stateKey, 'offsetY')}
                    />
                    {/* ... add other sliders for blur and spread */}
                    <ColorPicker
                        label="Color"
                        value={settings[stateKey].color}
                        onChange={handleChange(stateKey, 'color')}
                    />
                </div>
            ))}
        </div>
    );
}

export default ControlPanel;

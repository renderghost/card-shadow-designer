import React from 'react';
import Slider from './Slider';
import ColorPicker from './ColorPicker';

function ControlPanel() {
    return (
        <div className="ControlPanel">
            {/* Implement sliders and color pickers here */}
            <Slider />
            <ColorPicker />
        </div>
    );
}

export default ControlPanel;

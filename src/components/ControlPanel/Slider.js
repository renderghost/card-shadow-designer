// Slider.js

import React from 'react';

const Slider = ({ label, value, min, max, onChange }) => {
    return (
        <label>
            {label}:
            <input
                type="range"
                value={value}
                min={min}
                max={max}
                onChange={onChange}
            />
            <span>{value}</span>
        </label>
    );
};

export default Slider;

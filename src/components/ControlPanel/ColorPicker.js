// ColorPicker.js

import React from 'react';

const ColorPicker = ({ label, value, onChange }) => {
    return (
        <label>
            {label}:
            <input
                type="color"
                value={value}
                onChange={onChange}
            />
            <span>{value.toUpperCase()}</span>
        </label>
    );
};

export default ColorPicker;
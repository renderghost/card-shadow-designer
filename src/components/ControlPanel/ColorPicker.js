import React from 'react';

function ColorPicker({ label, value, onChange }) {
    return (
        <div className="ColorPicker">
            <label>{label}</label>
            <input type="color" value={value} onChange={onChange} />
        </div>
    );
}

export default ColorPicker;

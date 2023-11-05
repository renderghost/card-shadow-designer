// CardPreview.js

import React, { useState } from 'react';

function CardPreview({ settings }) {
    const [state, setState] = useState('default'); // This state will track the card's interaction state.

    // Function to generate the appropriate style based on interaction state
    const generateStyle = (state) => {
        return {
            boxShadow: `${settings[state].offsetX}px ${settings[state].offsetY}px ${settings[state].blur}px ${settings[state].spread}px ${settings[state].color}`,
            transition: 'box-shadow 0.3s ease', // Smooth transition for shadow changes
            cursor: 'pointer' // To indicate the card is interactive
        };
    };

    // Style based on the current interaction state
    const style = generateStyle(state);

    return (
        <div className="CardPreview">
            <div
                className="Card"
                style={style}
                onMouseEnter={() => setState('hover')} // When mouse enters the card area
                onMouseLeave={() => setState('default')} // When mouse leaves the card area
                onMouseDown={() => setState('active')} // When the mouse button is pressed
                onMouseUp={() => setState('hover')} // When the mouse button is released
            >
                {/* Content of the card */}
                Your content here
            </div>
        </div>
    );
}

export default CardPreview;

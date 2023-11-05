// CSSCodeBlock.js

import React from 'react';

function CSSCodeBlock({ settings }) {
    // Function to generate CSS code for shadow
    const generateCSS = (settings) => {
        const { offsetX, offsetY, blur, spread, color } = settings;
        return `box-shadow: ${offsetX}px ${offsetY}px ${blur}px ${spread}px ${color};`;
    };

    // CSS code for all states
    const defaultCSS = generateCSS(settings.default);
    const hoverCSS = generateCSS(settings.hover);
    const activeCSS = generateCSS(settings.active);

    return (
        <pre className="CSSCodeBlock">
            {`.card { ${defaultCSS} }\n.card:hover { ${hoverCSS} }\n.card:active { ${activeCSS} }`}
        </pre>
    );
}

export default CSSCodeBlock;
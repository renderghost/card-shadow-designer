import React from 'react';

function CSSCodeBlock({ cssCode }) {
    return (
        <pre className="CSSCodeBlock">
            {cssCode}
        </pre>
    );
}

export default CSSCodeBlock;

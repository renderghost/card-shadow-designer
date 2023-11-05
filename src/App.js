import React from 'react';
import ControlPanel from './components/ControlPanel/ControlPanel';
import CardPreview from './components/CardPreview/CardPreview';
import CSSCodeBlock from './components/CSSCodeBlock/CSSCodeBlock';

function App() {
  return (
    <div className="App">
      <ControlPanel />
      <CardPreview />
      <CSSCodeBlock />
    </div>
  );
}

export default App;

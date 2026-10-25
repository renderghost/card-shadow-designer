import { useMemo } from 'react';
import { tokenize } from '../lib/css';
import { CloseIcon, CodeIcon } from './icons';
import Tip from './Tip';

const OPTIONS = [
  ['rim', 'Rim light'],
  ['shading', 'Shading'],
  ['states', 'Hover & press'],
  ['notes', 'Comments'],
];

function Token({ type, text }) {
  if (type === 'color') {
    return (
      <span className="tok-color">
        <i style={{ background: text }} />
        {text}
      </span>
    );
  }
  return <span className={`tok-${type}`}>{text}</span>;
}

export default function CodePanel({ open, css, options, layerCount, floor, onToggle, onOption, onCopy, onCopyShadow, onShare }) {
  const lines = useMemo(() => css.split('\n').map(tokenize), [css]);

  return (
    <>
      <div className={`panel-toggle-host ${open ? 'hidden' : ''}`} data-ui>
        <Tip label="Show the CSS" shortcut="C" side="above-end">
          <button type="button" className="panel-toggle" onClick={onToggle} aria-expanded={open}>
            <CodeIcon /> CSS
          </button>
        </Tip>
      </div>

      <section className={`panel ${open ? 'open' : ''}`} data-ui aria-label="CSS export" aria-hidden={!open} inert={!open}>
        <header className="panel-head">
          <h2>CSS</h2>
          <span className="panel-meta">
            {layerCount} shadow layers · for a <i style={{ background: floor }} /> {floor} page
          </span>
          <Tip label="Hide the CSS" shortcut="C" side="below-end">
            <button type="button" className="icon-button" onClick={onToggle} aria-label="Hide CSS">
              <CloseIcon />
            </button>
          </Tip>
        </header>

        <div className="chips" role="group" aria-label="Export options">
          {OPTIONS.map(([key, label]) => (
            <button key={key} type="button" className="chip" aria-pressed={options[key]} onClick={() => onOption(key)}>
              {label}
            </button>
          ))}
        </div>

        <pre className="code" data-scroll>
          <code>
            {lines.map((tokens, i) => (
              <div className="line" key={i}>
                {tokens.map((t, j) => <Token key={j} {...t} />)}
              </div>
            ))}
          </code>
        </pre>

        <footer className="panel-foot">
          <button type="button" className="button primary" onClick={onCopy}>Copy CSS</button>
          <button type="button" className="button" onClick={onCopyShadow}>Copy box-shadow</button>
          <button type="button" className="button" onClick={onShare}>Copy link</button>
        </footer>
      </section>
    </>
  );
}

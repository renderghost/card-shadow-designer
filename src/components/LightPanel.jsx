import { useRef, useState } from 'react';
import {
  WORLD, clamp, constrainLight, kelvinName, kelvinToRgb, lightAngles, lightLimits, minDistance, withAngle, withDistance,
} from '../lib/physics';

const css = rgb => `rgb(${rgb.map(c => Math.round(c * 255)).join(' ')})`;
const WARMTH_TRACK = `linear-gradient(90deg, ${[1800, 2700, 3600, 4600, 5600, 6500, 8000, 10000, 12000]
  .map(k => css(kelvinToRgb(k)))
  .join(', ')})`;

/**
 * A number you can drag left or right (ew-resize) or click and type into.
 * `perPixel` is how much one pixel of horizontal drag changes the value.
 */
function ScrubField({ label, value, unit, min, max, perPixel, wrap, limit, onChange, children }) {
  const [draft, setDraft] = useState(null);
  const input = useRef(null);
  const scrub = useRef(null);
  const shown = wrap ? Math.round(value) % wrap : Math.round(value);

  const fit = v => (wrap ? ((v % wrap) + wrap) % wrap : clamp(v, min, max));

  const commit = () => {
    if (draft === null) return;
    const v = Number.parseFloat(draft);
    if (Number.isFinite(v)) onChange(fit(v));
    setDraft(null);
  };

  const onPointerDown = e => {
    if (e.button !== 0 || document.activeElement === input.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    scrub.current = { x: e.clientX, start: value, moved: false };
    document.documentElement.classList.add('scrubbing');
  };

  const onPointerMove = e => {
    const s = scrub.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    if (!s.moved && Math.abs(dx) < 3) return;
    s.moved = true;
    onChange(fit(s.start + dx * perPixel));
  };

  const onPointerUp = () => {
    const s = scrub.current;
    scrub.current = null;
    document.documentElement.classList.remove('scrubbing');
    if (s && !s.moved) {
      input.current.focus();
      input.current.select();
    }
  };

  const onKeyDown = e => {
    if (e.key === 'Enter') {
      commit();
      input.current.blur();
    } else if (e.key === 'Escape') {
      setDraft(null);
      input.current.blur();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const step = (e.shiftKey ? 10 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
      setDraft(null);
      onChange(fit(shown + step));
    }
  };

  return (
    <div
      className={`field ${limit ? 'limit' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <span className="field-label">{label}</span>
      <input
        ref={input}
        className="field-input"
        inputMode="numeric"
        aria-label={`${label} (${unit})`}
        value={draft ?? String(shown)}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
      />
      <span className="field-unit">{unit}</span>
      {children}
    </div>
  );
}

export default function LightPanel({ light, index, removable, onEdit, onRemove }) {
  if (!light) return null;
  const { distance, azimuth } = lightAngles(light);
  const limits = lightLimits(light);
  const rgb = kelvinToRgb(light.kelvin);
  const edit = fn => onEdit(light.id, l => constrainLight(fn(l)));
  const warmthAt = ((light.kelvin - WORLD.kelvin[0]) / (WORLD.kelvin[1] - WORLD.kelvin[0])) * 100;

  return (
    <section className="light-panel" data-ui aria-label={`Light ${index + 1}`}>
      <header className="light-panel-head">
        <i style={{ background: css(rgb), color: css(rgb) }} />
        <h2>Light {index + 1}</h2>
        <span>{kelvinName(light.kelvin)}</span>
        {removable && (
          <button type="button" className="button small" onClick={() => onRemove(light.id)}>
            Remove
          </button>
        )}
      </header>

      <div className="fields">
        <ScrubField
          label="Warmth" unit="K" value={light.kelvin} min={WORLD.kelvin[0]} max={WORLD.kelvin[1]} perPixel={20}
          limit={limits.kelvin} onChange={v => edit(l => ({ ...l, kelvin: v }))}
        >
          <span className="warmth-track" style={{ backgroundImage: WARMTH_TRACK }}>
            <b style={{ left: `${warmthAt}%` }} />
          </span>
        </ScrubField>
        <ScrubField
          label="Size" unit="px ⌀" value={light.size * 2} min={WORLD.size[0] * 2} max={WORLD.size[1] * 2} perPixel={2}
          limit={limits.size} onChange={v => edit(l => ({ ...l, size: v / 2 }))}
        />
        <ScrubField
          label="Distance" unit="px" value={distance} min={minDistance(light)} max={WORLD.maxRange} perPixel={2}
          limit={limits.distance} onChange={v => edit(l => withDistance(l, v))}
        />
        <ScrubField
          label="Angle" unit="°" value={azimuth} wrap={360} perPixel={1}
          onChange={v => edit(l => withAngle(l, v))}
        />
        <ScrubField
          label="Height" unit="px" value={light.z} min={WORLD.height[0]} max={WORLD.height[1]} perPixel={2}
          limit={limits.height} onChange={v => edit(l => ({ ...l, z: v }))}
        />
      </div>

      <p className="light-panel-foot">Drag a value left or right, or click it to type.</p>
    </section>
  );
}

import { useMemo } from 'react';
import { WORLD, THEMES, cardShading, kelvinName, shadowLayers } from '../lib/physics';
import { boxShadow, gradients } from '../lib/css';
import { CloseIcon } from './icons';
import Tip from './Tip';

const SCALE = 0.2;

function describe({ scene, createdAt }) {
  const lights = scene.lights.map(l => `${l.kelvin}K ${kelvinName(l.kelvin)}`).join(', ');
  const when = new Date(createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  return `${lights} · card ↑${scene.elevation}px · ${scene.theme} · ${when}`;
}

function Thumb({ sample }) {
  const style = useMemo(() => {
    const { scene, options } = sample;
    const layers = shadowLayers(scene, scene.elevation, options);
    return {
      width: WORLD.card.width * SCALE,
      height: WORLD.card.height * SCALE,
      borderRadius: WORLD.card.radius * SCALE,
      backgroundColor: THEMES[scene.theme].card,
      backgroundImage: options.shading ? gradients(cardShading(scene, scene.elevation), SCALE).join(', ') : 'none',
      boxShadow: boxShadow(layers, SCALE),
    };
  }, [sample]);
  return <span className="thumb-card" style={style} />;
}

export default function SampleTray({ samples, onSave, onLoad, onDelete }) {
  return (
    <section className="tray" data-ui aria-label="Saved samples">
      <Tip label="Save this look" shortcut="S" side="above-start">
        <button type="button" className="tray-save" onClick={onSave}>
          Save look
        </button>
      </Tip>
      {samples.length > 0 && (
        <ol className="tray-list" data-scroll>
          {samples.map(sample => (
            <li key={sample.id}>
              <button
                type="button"
                className="thumb"
                style={{ background: THEMES[sample.scene.theme].floor }}
                onClick={() => onLoad(sample)}
                title={describe(sample)}
                aria-label={`Load sample: ${describe(sample)}`}
              >
                <Thumb sample={sample} />
              </button>
              <button type="button" className="thumb-delete" onClick={() => onDelete(sample.id)} aria-label="Delete sample">
                <CloseIcon />
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

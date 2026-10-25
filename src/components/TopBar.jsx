import { WORLD, kelvinToRgb } from '../lib/physics';
import { ExpandIcon, LightsIcon, LightsOffIcon, MoonIcon, PlusIcon, SunIcon } from './icons';
import Tip from './Tip';

const css = rgb => `rgb(${rgb.map(c => Math.round(c * 255)).join(' ')})`;

export default function TopBar({
  scene, selectedId, openLightId, lightsHidden, onLight, onAdd, onLightsHidden, onTheme, onFullscreen, onHelp,
}) {
  return (
    <>
      <header className="brand" data-ui>
        <h1>Lumen</h1>
      </header>

      <nav className="toolbar" data-ui aria-label="Scene">
        <div className="lights" role="group" aria-label="Lights">
          {scene.lights.map((light, i) => (
            <button
              key={light.id}
              type="button"
              className={`light-chip ${light.id === selectedId ? 'selected' : ''}`}
              aria-expanded={light.id === openLightId}
              aria-label={`Light ${i + 1} settings`}
              onClick={() => onLight(light.id)}
            >
              <i style={{ background: css(kelvinToRgb(light.kelvin)) }} />
              {i + 1}
            </button>
          ))}
          {scene.lights.length < WORLD.maxLights && (
            <Tip label="Add a light">
              <button type="button" className="light-chip add" onClick={onAdd} aria-label="Add a light">
                <PlusIcon />
              </button>
            </Tip>
          )}
        </div>
        <span className="toolbar-sep" />
        <Tip label={lightsHidden ? 'Show lights and geometry' : 'Hide lights and geometry'} shortcut="L">
          <button
            type="button"
            className="icon-button"
            aria-pressed={lightsHidden}
            onClick={onLightsHidden}
            aria-label="Hide lights and geometry"
          >
            {lightsHidden ? <LightsOffIcon /> : <LightsIcon />}
          </button>
        </Tip>
        <Tip label={scene.theme === 'dark' ? 'Light mode' : 'Dark mode'}>
          <button type="button" className="icon-button" onClick={onTheme} aria-label="Toggle dark mode">
            {scene.theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </Tip>
        <Tip label="Full screen" shortcut="F">
          <button type="button" className="icon-button" onClick={onFullscreen} aria-label="Full screen">
            <ExpandIcon />
          </button>
        </Tip>
        <Tip label="Controls" shortcut="?" side="below-end">
          <button type="button" className="icon-button help-button" onClick={onHelp} aria-label="Controls">
            ?
          </button>
        </Tip>
      </nav>
    </>
  );
}

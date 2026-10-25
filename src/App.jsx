import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Stage, { orbRadius, radialCursor } from './components/Stage';
import CodePanel from './components/CodePanel';
import LightPanel from './components/LightPanel';
import SampleTray from './components/SampleTray';
import TopBar from './components/TopBar';
import { Help, Hint } from './components/Help';
import {
  THEMES, WORLD, clamp, constrainLight, perspective, shadowLayers, stateElevation, stateScale,
} from './lib/physics';
import { boxShadow, buildCss, cardStyle } from './lib/css';
import {
  DEFAULT_OPTIONS, decodeHash, defaultScene, encodeHash, loadSamples, loadSession, makeSample, saveSamples, saveSession,
} from './lib/storage';

const SPRING_KEYS = ['x', 'y', 'z', 'size', 'kelvin'];
// Settling thresholds per key; kelvin moves in much bigger numbers than px.
const SETTLE = { x: 0.05, y: 0.05, z: 0.05, size: 0.05, kelvin: 2 };
const EDGE_MARGIN = 44;
// The toolbar and logo sit along the top; samples and the CSS button along the bottom.
const BAR_MARGIN = 84;
// A press that moves less than this is a click.
const CLICK_SLOP = 4;

const media = query => typeof matchMedia === 'function' && matchMedia(query).matches;

/** Shift alone drags distance; Ctrl + Shift drags size. */
const modifierOf = e => (e.shiftKey ? (e.ctrlKey ? 'size' : 'distance') : null);

function initialState() {
  const session = loadSession();
  const fromLink = decodeHash(window.location.hash);
  const ui = {
    panelOpen: session?.panelOpen ?? false,
    hinted: session?.hinted ?? false,
    lightsHidden: session?.lightsHidden ?? false,
  };
  if (fromLink) return { ...fromLink, ...ui };
  if (session) return session;
  return { scene: defaultScene(media('(prefers-color-scheme: dark)') ? 'dark' : 'light'), options: DEFAULT_OPTIONS, ...ui };
}

function useViewport(ref) {
  const [viewport, setViewport] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useLayoutEffect(() => {
    const el = ref.current;
    const measure = () => {
      if (!el.clientWidth) return;
      setViewport(v => (v.w === el.clientWidth && v.h === el.clientHeight ? v : { w: el.clientWidth, h: el.clientHeight }));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return viewport;
}

/** One semi-implicit Euler step of a damped spring. */
function springStep(value, velocity, target, stiffness, damping, dt) {
  const v = velocity + (stiffness * (target - value) - damping * velocity) * dt;
  return [value + v * dt, v];
}

export default function App() {
  const [initial] = useState(initialState);
  const stageRef = useRef(null);
  const viewport = useViewport(stageRef);

  // The scene lives in a ref as well as state so that pointer and
  // animation-frame handlers always build on the latest version.
  const [scene, setSceneState] = useState(initial.scene);
  const sceneRef = useRef(initial.scene);
  const commit = useCallback(next => {
    sceneRef.current = next;
    setSceneState(next);
  }, []);

  const [options, setOptions] = useState(initial.options);
  const [selectedId, setSelectedId] = useState(initial.scene.lights[0].id);
  const [openLightId, setOpenLightId] = useState(null);
  const [panelOpen, setPanelOpen] = useState(initial.panelOpen);
  const [hinted, setHinted] = useState(initial.hinted);
  // Hides the lights and the geometry they cast, but never their light.
  const [lightsHidden, setLightsHidden] = useState(initial.lightsHidden);
  const [helpOpen, setHelpOpen] = useState(false);
  const [uiHidden, setUiHidden] = useState(false);
  const [samples, setSamples] = useState(loadSamples);
  const [liveElevation, setLiveElevation] = useState(initial.scene.elevation);
  const [activeId, setActiveId] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const [drag, setDrag] = useState(null);
  const [modifier, setModifier] = useState(null);
  const [toast, setToast] = useState(null);

  const selectedRef = useRef(selectedId);
  const optionsRef = useRef(options);
  const viewportRef = useRef(viewport);
  const cardStateRef = useRef('rest');
  const springs = useRef(new Map());
  const elevationSpring = useRef({ value: initial.scene.elevation, velocity: 0 });
  const dragRef = useRef(null);
  const timers = useRef({});

  useEffect(() => { optionsRef.current = options; }, [options]);
  useEffect(() => { viewportRef.current = viewport; }, [viewport]);

  const select = useCallback(id => {
    selectedRef.current = id;
    setSelectedId(id);
  }, []);

  const flash = useCallback(text => {
    setToast({ text, key: Date.now() });
    clearTimeout(timers.current.toast);
    timers.current.toast = setTimeout(() => setToast(null), 1800);
  }, []);

  /** Show a light's readout for a moment after it changes. */
  const touch = useCallback(id => {
    setActiveId(id);
    clearTimeout(timers.current.active);
    timers.current.active = setTimeout(() => setActiveId(null), 1400);
  }, []);

  const dismissHint = useCallback(() => {
    if (timers.current.hint) return;
    timers.current.hint = setTimeout(() => setHinted(true), 3500);
  }, []);

  /* --------------------------------------------------------- geometry -- */

  const centre = () => ({ x: viewportRef.current.w / 2, y: viewportRef.current.h / 2 });

  const screenOf = useCallback(light => {
    const c = centre();
    const s = perspective(light.z);
    return { x: c.x + light.x * s, y: c.y + light.y * s };
  }, []);

  /** Keep a light within range, its whole orb on screen and clear of the top and bottom bars. */
  const fit = useCallback(light => {
    const { w, h } = viewportRef.current;
    const l = constrainLight(light);
    const s = perspective(l.z);
    const r = orbRadius(l) + 8;
    const mx = Math.max(EDGE_MARGIN, r);
    const my = Math.max(BAR_MARGIN, r);
    const sx = clamp(w / 2 + l.x * s, mx, w - mx);
    const sy = clamp(h / 2 + l.y * s, my, h - my);
    return constrainLight({ ...l, x: (sx - w / 2) / s, y: (sy - h / 2) / s });
  }, []);

  const atScreen = useCallback((light, sx, sy) => {
    const c = centre();
    const s = perspective(light.z);
    return fit({ ...light, x: (sx - c.x) / s, y: (sy - c.y) / s });
  }, [fit]);

  /**
   * Shift-dragging a light slides it along its line to the card's centre. The
   * orb follows the pointer's projection onto that line on screen: with the
   * light at k × its starting position, its distance from the centre on
   * screen is s = k·r·C / (C − k·z), so k = s·C / (r·C + s·z).
   */
  const distanceDrag = useCallback((light, e) => {
    const c = centre();
    const orb = screenOf(light);
    const len = Math.hypot(orb.x - c.x, orb.y - c.y);
    const u = len > 8 ? { x: (orb.x - c.x) / len, y: (orb.y - c.y) / len } : null;
    const along = p => (p.clientX - c.x) * u.x + (p.clientY - c.y) * u.y;
    return { u, offset: u ? len - along(e) : 0, start: light, cursor: u ? radialCursor(orb, c) : 'ns-resize', along };
  }, [screenOf]);

  const distanceAt = useCallback((d, e) => {
    const { w, h } = viewportRef.current;
    const L = d.start;
    const r = Math.hypot(L.x, L.y);
    const C = WORLD.camera;
    let k;
    if (d.u) {
      const s = Math.max(1, d.along(e) + d.offset);
      k = (s * C) / (r * C + s * L.z);
      // Stop at the edge of the screen rather than bending off the line.
      const orbR = orbRadius(L) * 1.6;
      const mx = Math.max(EDGE_MARGIN, orbR);
      const my = Math.max(BAR_MARGIN, orbR);
      const edge = Math.min(
        d.u.x > 0 ? (w / 2 - mx) / d.u.x : d.u.x < 0 ? (mx - w / 2) / d.u.x : Infinity,
        d.u.y > 0 ? (h / 2 - my) / d.u.y : d.u.y < 0 ? (my - h / 2) / d.u.y : Infinity
      );
      k = Math.min(k, Math.max(1, (edge * C) / (r * C + edge * L.z)));
    } else {
      // Straight overhead there is no line on screen: drag up to go farther.
      k = Math.exp((d.startY - e.clientY) * 0.004);
    }
    const distance = Math.hypot(r, L.z);
    k = clamp(k, WORLD.height[0] / L.z, Math.min(WORLD.height[1] / L.z, WORLD.maxRange / distance));
    return { x: L.x * k, y: L.y * k, z: L.z * k };
  }, []);

  /* ------------------------------------------------------------ edits -- */

  const animateLight = useCallback((id, target, { stiffness = 170, damping = 22 } = {}) => {
    const existing = springs.current.get(id);
    springs.current.set(id, { target, velocity: existing?.velocity ?? {}, stiffness, damping });
  }, []);

  /** Change a light right now, and any animation target it is heading for. */
  const setLight = useCallback((id, fn) => {
    const s = sceneRef.current;
    const spring = springs.current.get(id);
    if (spring) spring.target = fn(spring.target);
    commit({ ...s, lights: s.lights.map(l => (l.id === id ? fn(l) : l)) });
  }, [commit]);

  /** Edits from the light panel land exactly, without animation. */
  const editLight = useCallback((id, fn) => {
    springs.current.delete(id);
    setLight(id, fn);
    touch(id);
  }, [setLight, touch]);

  const setElevation = useCallback(value => {
    const s = sceneRef.current;
    commit({ ...s, elevation: clamp(value, ...WORLD.elevation) });
  }, [commit]);

  const toggleLightPanel = useCallback(id => {
    select(id);
    setOpenLightId(open => (open === id ? null : id));
  }, [select]);

  const addLight = useCallback(() => {
    const s = sceneRef.current;
    if (s.lights.length >= WORLD.maxLights) return;
    const id = Math.max(...s.lights.map(l => l.id)) + 1;
    const used = s.lights.map(l => l.kelvin);
    const kelvin = [2700, 8000, 5600, 1900].find(k => used.every(u => Math.abs(u - k) > 400)) ?? 5600;
    const base = s.lights.find(l => l.id === selectedRef.current) ?? s.lights[0];
    const fresh = { id, x: 0, y: 0, z: base.z, size: 110, kelvin };
    // Rise out from behind the card and swing round to a third of a turn away.
    const angle = Math.atan2(base.y, base.x) + (2 * Math.PI) / 3;
    const r = Math.max(240, Math.hypot(base.x, base.y));
    commit({ ...s, lights: [...s.lights, fresh] });
    animateLight(id, fit({ ...fresh, x: Math.cos(angle) * r, y: Math.sin(angle) * r }));
    select(id);
    touch(id);
  }, [animateLight, commit, fit, select, touch]);

  const removeLight = useCallback(id => {
    const s = sceneRef.current;
    if (s.lights.length <= 1) return;
    const lights = s.lights.filter(l => l.id !== id);
    springs.current.delete(id);
    commit({ ...s, lights });
    select(lights[lights.length - 1].id);
    setOpenLightId(null);
  }, [commit, select]);

  const toggleTheme = useCallback(() => {
    const s = sceneRef.current;
    commit({ ...s, theme: s.theme === 'dark' ? 'light' : 'dark' });
  }, [commit]);

  const saveCurrent = useCallback(() => {
    setSamples(prev => [makeSample(sceneRef.current, optionsRef.current), ...prev].slice(0, 24));
    flash('Saved to your samples');
  }, [flash]);

  const loadSample = useCallback(sample => {
    const s = sceneRef.current;
    let nextId = Math.max(...s.lights.map(l => l.id)) + 1;
    const lights = sample.scene.lights.map((target, i) => {
      const current = s.lights[i];
      const id = current ? current.id : nextId++;
      animateLight(id, { ...target, id });
      return current ?? { ...target, id, x: 0, y: 0 };
    });
    for (const light of s.lights.slice(lights.length)) springs.current.delete(light.id);
    commit({ theme: sample.scene.theme, elevation: sample.scene.elevation, lights });
    setOptions(sample.options);
    if (!lights.some(l => l.id === selectedRef.current)) select(lights[0].id);
    setOpenLightId(open => (lights.some(l => l.id === open) ? open : null));
  }, [animateLight, commit, select]);

  const copy = useCallback((text, done) => {
    navigator.clipboard?.writeText(text).then(() => flash(done), () => flash('Could not reach the clipboard'));
  }, [flash]);

  const copyLink = useCallback(() => {
    const hash = encodeHash(sceneRef.current, optionsRef.current);
    window.history.replaceState(null, '', hash);
    copy(`${window.location.origin}${window.location.pathname}${hash}`, 'Link copied');
  }, [copy]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => flash('Full screen is not available here'));
  }, [flash]);

  /* -------------------------------------------------------- animation -- */

  useEffect(() => {
    const reduced = media('(prefers-reduced-motion: reduce)');
    let frame;
    let last = performance.now();

    const tick = now => {
      const dt = Math.min(1 / 30, (now - last) / 1000);
      last = now;

      if (springs.current.size) {
        const s = sceneRef.current;
        let changed = false;
        const lights = s.lights.map(light => {
          const spring = springs.current.get(light.id);
          if (!spring) return light;
          changed = true;
          const next = { ...light };
          let settled = true;
          for (const key of SPRING_KEYS) {
            if (reduced) {
              next[key] = spring.target[key];
              continue;
            }
            const [value, velocity] = springStep(
              light[key], spring.velocity[key] ?? 0, spring.target[key], spring.stiffness, spring.damping, dt
            );
            next[key] = value;
            spring.velocity[key] = velocity;
            if (Math.abs(spring.target[key] - value) > SETTLE[key] || Math.abs(velocity) > SETTLE[key]) settled = false;
          }
          if (settled) {
            Object.assign(next, spring.target);
            springs.current.delete(light.id);
          }
          return constrainLight(next);
        });
        for (const id of springs.current.keys()) {
          if (!s.lights.some(l => l.id === id)) springs.current.delete(id);
        }
        if (changed) commit({ ...s, lights });
      }

      const state = optionsRef.current.states ? cardStateRef.current : 'rest';
      const target = stateElevation(sceneRef.current.elevation, state);
      const e = elevationSpring.current;
      if (Math.abs(target - e.value) > 0.01 || Math.abs(e.velocity) > 0.01) {
        if (reduced) [e.value, e.velocity] = [target, 0];
        else [e.value, e.velocity] = springStep(e.value, e.velocity, target, 420, 28, dt);
        setLiveElevation(e.value);
      } else if (e.value !== target) {
        [e.value, e.velocity] = [target, 0];
        setLiveElevation(target);
      }

      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [commit]);

  /* ---------------------------------------------------------- pointer -- */

  const beginDrag = useCallback(d => {
    dragRef.current = d;
    setDrag({ mode: d.mode, id: d.id, cursor: d.cursor });
  }, []);

  /*
   * What a press does depends only on what is under the pointer and the keys
   * held when it starts. Lights only move when you take hold of them.
   *   light          drag moves it 1:1; a click opens its panel
   *   ⇧ light        distance, along its line to the card's centre
   *   ⌃⇧ light       size, dragging up or down
   *   card           press shows :active
   *   ⇧ card         elevation, dragging up or down
   *   anywhere else  nothing
   */
  const onPointerDown = useCallback(e => {
    // On a Mac, Ctrl-click can arrive as a secondary button.
    if ((e.button !== 0 && !(e.button === 2 && e.ctrlKey)) || e.target.closest('[data-ui]')) return;
    const orbEl = e.target.closest('[data-light]');
    const onCard = !orbEl && e.target.closest('.card');
    if (!orbEl && !onCard) return;
    const id = orbEl ? Number(orbEl.dataset.light) : selectedRef.current;
    const light = sceneRef.current.lights.find(l => l.id === id);
    if (!light) return;

    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const base = { id, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false };
    const modifier = modifierOf(e);

    if (orbEl) {
      select(id);
      springs.current.delete(id);
      if (modifier === 'size') beginDrag({ ...base, mode: 'size', start: light, cursor: 'ns-resize' });
      else if (modifier === 'distance') beginDrag({ ...base, mode: 'distance', ...distanceDrag(light, e) });
      else {
        const orb = screenOf(light);
        beginDrag({ ...base, mode: 'grab', offset: { x: orb.x - e.clientX, y: orb.y - e.clientY }, cursor: 'grabbing' });
      }
      touch(id);
    } else if (onCard && modifier) {
      beginDrag({ ...base, mode: 'elevation', start: sceneRef.current.elevation, cursor: 'ns-resize' });
    } else {
      cardStateRef.current = 'active';
      beginDrag({ ...base, mode: 'press', cursor: null });
    }
    dismissHint();
  }, [beginDrag, dismissHint, distanceDrag, screenOf, select, touch]);

  const onPointerMove = useCallback(e => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < CLICK_SLOP) return;
    d.moved = true;
    const dy = e.clientY - d.startY;

    switch (d.mode) {
      case 'grab':
        setLight(d.id, l => atScreen(l, e.clientX + d.offset.x, e.clientY + d.offset.y));
        break;
      case 'size':
        setLight(d.id, l => constrainLight({ ...l, size: d.start.size * Math.exp(-dy * 0.008) }));
        break;
      case 'distance': {
        const next = distanceAt(d, e);
        setLight(d.id, l => ({ ...l, ...next }));
        break;
      }
      case 'elevation':
        setElevation(d.start - dy * 0.12);
        return;
      default:
        return;
    }
    touch(d.id);
  }, [atScreen, distanceAt, setElevation, setLight, touch]);

  const onPointerUp = useCallback(e => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setDrag(null);
    if (d.mode === 'grab' && !d.moved) toggleLightPanel(d.id);
    if (d.mode === 'press') cardStateRef.current = 'hover';
    if (d.mode !== 'press' && d.mode !== 'elevation') touch(d.id);
  }, [toggleLightPanel, touch]);

  const onCardState = useCallback(state => {
    if (dragRef.current && state !== 'rest') return;
    cardStateRef.current = state;
  }, []);

  /* -------------------------------------------------------- modifiers -- */

  // Track Shift and Ctrl so lights and the card can show the right cursor
  // before a drag starts.
  useEffect(() => {
    const update = e => setModifier(modifierOf(e));
    const clear = () => setModifier(null);
    window.addEventListener('keydown', update);
    window.addEventListener('keyup', update);
    window.addEventListener('pointermove', update);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', update);
      window.removeEventListener('keyup', update);
      window.removeEventListener('pointermove', update);
      window.removeEventListener('blur', clear);
    };
  }, []);

  /* --------------------------------------------------------- keyboard -- */

  useEffect(() => {
    const onKey = e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target.closest?.('input, textarea, [contenteditable="true"]')) return;
      switch (e.key) {
        case 'c': case 'C': setPanelOpen(o => !o); break;
        case 's': case 'S': saveCurrent(); break;
        case 'l': case 'L': setLightsHidden(h => !h); break;
        case 'f': case 'F': toggleFullscreen(); break;
        case 'h': case 'H':
          setUiHidden(hidden => {
            if (!hidden) flash('Press H to bring the interface back');
            return !hidden;
          });
          break;
        case '?': case '/': setHelpOpen(o => !o); break;
        case 'Escape':
          if (helpOpen) setHelpOpen(false);
          else if (openLightId != null) setOpenLightId(null);
          else setPanelOpen(false);
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flash, helpOpen, openLightId, saveCurrent, toggleFullscreen]);

  /* ------------------------------------------------------ persistence -- */

  useEffect(() => {
    const t = setTimeout(() => saveSession({ scene, options, panelOpen, hinted, lightsHidden }), 250);
    return () => clearTimeout(t);
  }, [scene, options, panelOpen, hinted, lightsHidden]);

  useEffect(() => saveSamples(samples), [samples]);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = scene.theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEMES[scene.theme].floor);
  }, [scene.theme]);

  // Colour transitions only once the first frame is up, so a dark-mode load
  // does not fade in from light.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      document.documentElement.dataset.ready = '';
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const onHash = () => {
      const fromLink = decodeHash(window.location.hash);
      if (fromLink) loadSample(fromLink);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [loadSample]);

  /* ----------------------------------------------------------- render -- */

  const elevation = Math.max(0, liveElevation);
  const live = useMemo(() => cardStyle(scene, elevation, options), [scene, elevation, options]);
  const css = useMemo(() => (panelOpen ? buildCss(scene, options) : ''), [scene, options, panelOpen]);
  const lightDrag = drag && drag.mode !== 'press' && drag.mode !== 'elevation';
  const readoutId = lightDrag ? drag.id : activeId ?? hoverId;
  const elevationLimit =
    scene.elevation <= WORLD.elevation[0] ? 'min' : scene.elevation >= WORLD.elevation[1] ? 'max' : null;
  const openLight = scene.lights.find(l => l.id === openLightId);

  return (
    <div className={`app ${uiHidden ? 'ui-hidden' : ''} ${openLight ? 'light-panel-open' : ''}`}>
      <Stage
        ref={stageRef}
        scene={scene}
        viewport={viewport}
        elevation={elevation}
        elevationLimit={drag?.mode === 'elevation' ? elevationLimit : null}
        cardScale={stateScale(scene.elevation, elevation)}
        cardStyle={live}
        selectedId={selectedId}
        readoutId={readoutId}
        dragging={lightDrag}
        dragCursor={drag?.cursor}
        modifier={drag ? null : modifier}
        lightsHidden={lightsHidden}
        onCardState={onCardState}
        onLightHover={setHoverId}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />

      <TopBar
        scene={scene}
        selectedId={selectedId}
        openLightId={openLightId}
        lightsHidden={lightsHidden}
        onLight={toggleLightPanel}
        onAdd={addLight}
        onLightsHidden={() => setLightsHidden(h => !h)}
        onTheme={toggleTheme}
        onFullscreen={toggleFullscreen}
        onHelp={() => setHelpOpen(true)}
      />

      <LightPanel
        light={openLight}
        index={scene.lights.indexOf(openLight)}
        removable={scene.lights.length > 1}
        onEdit={editLight}
        onRemove={removeLight}
      />

      <SampleTray
        samples={samples}
        onSave={saveCurrent}
        onLoad={sample => {
          loadSample(sample);
          flash('Sample loaded');
        }}
        onDelete={id => setSamples(prev => prev.filter(s => s.id !== id))}
      />

      <CodePanel
        open={panelOpen}
        css={css}
        options={options}
        layerCount={live.layers.length}
        floor={THEMES[scene.theme].floor}
        onToggle={() => setPanelOpen(o => !o)}
        onOption={key => setOptions(o => ({ ...o, [key]: !o[key] }))}
        onCopy={() => copy(buildCss(scene, options), 'CSS copied')}
        onCopyShadow={() =>
          copy(`box-shadow: ${boxShadow(shadowLayers(scene, scene.elevation, options))};`, 'box-shadow copied')
        }
        onShare={copyLink}
      />

      <Hint visible={!hinted && !uiHidden} />
      <Help open={helpOpen} onClose={() => setHelpOpen(false)} />
      {toast && (
        <div className="toast" key={toast.key} role="status">
          {toast.text}
        </div>
      )}
    </div>
  );
}

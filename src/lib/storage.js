import { WORLD, constrainLight, clamp } from './physics';

const SESSION_KEY = 'lumen:session:v1';
const SAMPLES_KEY = 'lumen:samples:v1';
const MAX_SAMPLES = 24;

export const DEFAULT_OPTIONS = { rim: true, shading: true, states: true, notes: false };

export function defaultScene(theme = 'light') {
  return {
    theme,
    elevation: 16,
    lights: [{ id: 1, x: -300, y: -170, z: 380, size: 200, kelvin: 4600 }],
  };
}

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be full or blocked; the app works without it.
  }
}

const finite = v => typeof v === 'number' && Number.isFinite(v);

/** Validate anything that came from storage or a URL before it reaches the renderer. */
export function sanitizeScene(scene) {
  if (!scene || !Array.isArray(scene.lights) || scene.lights.length === 0) return null;
  const lights = scene.lights
    .slice(0, WORLD.maxLights)
    .filter(l => ['x', 'y', 'z', 'size', 'kelvin'].every(k => finite(l[k])))
    .map((l, i) => constrainLight({ id: i + 1, x: l.x, y: l.y, z: l.z, size: l.size, kelvin: l.kelvin }));
  if (lights.length === 0) return null;
  return {
    theme: scene.theme === 'dark' ? 'dark' : 'light',
    elevation: clamp(finite(scene.elevation) ? scene.elevation : 16, ...WORLD.elevation),
    lights,
  };
}

const sanitizeOptions = options => ({
  ...DEFAULT_OPTIONS,
  ...Object.fromEntries(Object.entries(options ?? {}).filter(([k, v]) => k in DEFAULT_OPTIONS && typeof v === 'boolean')),
});

const roundScene = scene => ({
  theme: scene.theme,
  elevation: Math.round(scene.elevation * 10) / 10,
  lights: scene.lights.map(({ id, x, y, z, size, kelvin }) => ({
    id, x: Math.round(x), y: Math.round(y), z: Math.round(z), size: Math.round(size), kelvin: Math.round(kelvin),
  })),
});

/* --------------------------------------------------------------- session -- */

export function loadSession() {
  const saved = read(SESSION_KEY);
  const scene = sanitizeScene(saved?.scene);
  if (!scene) return null;
  return {
    scene,
    options: sanitizeOptions(saved.options),
    panelOpen: !!saved.panelOpen,
    hinted: !!saved.hinted,
    lightsHidden: !!saved.lightsHidden,
  };
}

export const saveSession = ({ scene, options, panelOpen, hinted, lightsHidden }) =>
  write(SESSION_KEY, { scene: roundScene(scene), options, panelOpen, hinted, lightsHidden });

/* --------------------------------------------------------------- samples -- */

export function loadSamples() {
  const saved = read(SAMPLES_KEY);
  if (!Array.isArray(saved)) return [];
  return saved
    .map(s => ({ ...s, scene: sanitizeScene(s.scene), options: sanitizeOptions(s.options) }))
    .filter(s => s.scene && typeof s.id === 'string');
}

export const saveSamples = samples => write(SAMPLES_KEY, samples.slice(0, MAX_SAMPLES));

export function makeSample(scene, options) {
  return {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
    scene: roundScene(scene),
    options: { ...options },
  };
}

/* ----------------------------------------------------------------- links -- */

// #t=dark&e=16&l=-260_-300_440_140_4600~120_80_300_60_2700&o=rsSn
const OPTION_FLAGS = { rim: 'r', shading: 's', states: 'S', notes: 'n' };

export function encodeHash(scene, options) {
  const s = roundScene(scene);
  const lights = s.lights.map(l => [l.x, l.y, l.z, l.size, l.kelvin].join('_')).join('~');
  const flags = Object.entries(OPTION_FLAGS).filter(([k]) => options[k]).map(([, f]) => f).join('');
  return `#t=${s.theme}&e=${s.elevation}&l=${lights}&o=${flags || '-'}`;
}

export function decodeHash(hash) {
  try {
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    if (!params.has('l')) return null;
    const lights = params.get('l').split('~').map(part => {
      const [x, y, z, size, kelvin] = part.split('_').map(Number);
      return { x, y, z, size, kelvin };
    });
    const scene = sanitizeScene({ theme: params.get('t'), elevation: Number(params.get('e')), lights });
    if (!scene) return null;
    const flags = params.get('o') ?? '';
    const options = params.has('o')
      ? Object.fromEntries(Object.entries(OPTION_FLAGS).map(([k, f]) => [k, flags.includes(f)]))
      : DEFAULT_OPTIONS;
    return { scene, options };
  } catch {
    return null;
  }
}

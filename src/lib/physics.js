/**
 * Lighting model.
 *
 * World units are CSS pixels. The card's centre sits at the origin, the page is
 * the floor plane z = 0 and the card floats above it at z = elevation. A camera
 * looks straight down from z = WORLD.camera, so things closer to it (a raised
 * light, a lifted card) appear slightly larger on screen.
 *
 * Every light is a sphere of radius `size` at (x, y, z) with a colour
 * temperature in kelvin. The room adds a dim, uniform sky (ambient) light and
 * light bounced back off the floor.
 */

export const WORLD = {
  card: { width: 360, height: 232, radius: 18 },
  camera: 2000,
  maxRange: 820,
  height: [100, 760],
  size: [4, 360],
  elevation: [0, 48],
  kelvin: [1800, 12000],
  // Distance at which a light straight overhead delivers unit irradiance.
  falloff: 520,
  rimThickness: 1,
  maxLights: 3,
};

export const THEMES = {
  light: {
    floor: '#ebe9e4',
    card: '#ffffff',
    ambient: 0.62,
    ambientKelvin: 7000,
    rim: 0.9,
    rimShade: 0.1,
    glint: 0.55,
    pool: 0.11,
    shading: 0.3,
  },
  dark: {
    floor: '#111215',
    card: '#1c1d22',
    ambient: 0.14,
    ambientKelvin: 9500,
    rim: 1.1,
    rimShade: 0.25,
    glint: 0.2,
    pool: 0.34,
    shading: 0.45,
  },
};

export const KELVIN_PRESETS = [
  { kelvin: 1900, name: 'candle' },
  { kelvin: 2700, name: 'tungsten' },
  { kelvin: 3400, name: 'halogen' },
  { kelvin: 4600, name: 'warm white' },
  { kelvin: 5600, name: 'daylight' },
  { kelvin: 6500, name: 'overcast' },
  { kelvin: 8000, name: 'shade' },
  { kelvin: 10000, name: 'blue sky' },
];

/**
 * Sky occlusion under a floating plate falls off as (1 - x / √(x² + e²)) / 2,
 * a long-tailed curve no single Gaussian blur can match. Three stacked
 * box-shadows at different scales (blur as a multiple of elevation) fit it to
 * within 0.001 (least-max-error fit over 0–6 e).
 */
const AO_OCTAVES = [
  { weight: 0.44, blur: 1.06 },
  { weight: 0.46, blur: 2.4 },
  { weight: 0.1, blur: 7.8 },
];
// Light bouncing between floor and card fills in part of the occluded sky.
const AO_STRENGTH = 0.6;

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/* ---------------------------------------------------------------- colour -- */

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => v / 255);
}

const toLinear = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = c => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/** Black-body colour (Tanner Helland's fit), as sRGB 0–1 with max channel 1. */
export function kelvinToRgb(kelvin) {
  const t = clamp(kelvin, 1000, 40000) / 100;
  const r = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592;
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -0.0755148492;
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const rgb = [r, g, b].map(v => clamp(v, 0, 255) / 255);
  const max = Math.max(...rgb);
  return rgb.map(v => v / max);
}

/** Linear-light colour of an illuminant, normalised to unit luminance. */
function illuminant(kelvin) {
  const linear = kelvinToRgb(kelvin).map(toLinear);
  const y = luminance(linear);
  return linear.map(c => c / y);
}

export function kelvinName(kelvin) {
  return KELVIN_PRESETS.reduce((best, p) =>
    Math.abs(p.kelvin - kelvin) < Math.abs(best.kelvin - kelvin) ? p : best
  ).name;
}

/* -------------------------------------------------------------- geometry -- */

/** Screen magnification of a point at height z, seen by the overhead camera. */
export const perspective = z => WORLD.camera / (WORLD.camera - z);

/** How far from the card (horizontally) a light at height z may travel. */
export const reachAt = z => Math.sqrt(Math.max(0, WORLD.maxRange ** 2 - z ** 2));

export function constrainLight(light) {
  const z = clamp(light.z, ...WORLD.height);
  const reach = reachAt(z);
  const r = Math.hypot(light.x, light.y);
  const s = r > reach ? reach / r : 1;
  return {
    ...light,
    x: light.x * s,
    y: light.y * s,
    z,
    size: clamp(light.size, ...WORLD.size),
    kelvin: clamp(light.kelvin, ...WORLD.kelvin),
  };
}

export const isAtLimit = light => Math.hypot(light.x, light.y, light.z) >= WORLD.maxRange - 0.5;

export function lightAngles(light) {
  const r = Math.hypot(light.x, light.y);
  const altitude = (Math.atan2(light.z, r) * 180) / Math.PI;
  // Compass bearing from the card, 0° = up the screen, clockwise.
  const azimuth = ((Math.atan2(light.x, -light.y) * 180) / Math.PI + 360) % 360;
  return { altitude, azimuth, distance: Math.hypot(r, light.z) };
}

/** Closest the light can come along its current line to the card before it hits the floor limit. */
export const minDistance = light => (WORLD.height[0] * Math.hypot(light.x, light.y, light.z)) / light.z;

/** Move the light along the line to the card's centre, keeping its direction. */
export function withDistance(light, distance) {
  const d = Math.hypot(light.x, light.y, light.z);
  const k = clamp(distance / d, WORLD.height[0] / light.z, Math.min(WORLD.height[1] / light.z, WORLD.maxRange / d));
  return { ...light, x: light.x * k, y: light.y * k, z: light.z * k };
}

/** Swing the light round the card to a compass bearing, keeping its height and reach. */
export function withAngle(light, degrees) {
  const r = Math.hypot(light.x, light.y);
  const a = (degrees * Math.PI) / 180;
  return { ...light, x: r * Math.sin(a), y: -r * Math.cos(a) };
}

/** Which of a light's values sit at a minimum or maximum. */
export function lightLimits(light) {
  const at = (value, [min, max], eps) => (value <= min + eps ? 'min' : value >= max - eps ? 'max' : null);
  const distance = Math.hypot(light.x, light.y, light.z);
  return {
    kelvin: at(light.kelvin, WORLD.kelvin, 1),
    size: at(light.size, WORLD.size, 0.05),
    height: at(light.z, WORLD.height, 0.5),
    distance: distance >= WORLD.maxRange - 0.5 ? 'max' : light.z <= WORLD.height[0] + 0.5 ? 'min' : null,
  };
}

/** Elevation of the card in its interactive states. Pressing always sets it down 1px above the page. */
export function stateElevation(elevation, state) {
  if (state === 'hover') return elevation + Math.max(6, elevation * 0.6);
  if (state === 'active') return 1;
  return elevation;
}

/** Perspective growth of the card when it rises from `rest` to `elevation`. */
export const stateScale = (rest, elevation) => (WORLD.camera - rest) / (WORLD.camera - elevation);

/* -------------------------------------------------------------- lighting -- */

/** Irradiance on a horizontal surface at p: inverse square × Lambert cosine. */
export function irradiance(light, px = 0, py = 0, pz = 0) {
  const dx = light.x - px;
  const dy = light.y - py;
  const dz = Math.max(1, light.z - pz);
  const d2 = dx * dx + dy * dy + dz * dz;
  return (WORLD.falloff ** 2 / d2) * (dz / Math.sqrt(d2));
}

export function lighting(scene) {
  const theme = THEMES[scene.theme];
  const ambient = illuminant(theme.ambientKelvin).map(c => c * theme.ambient);
  const bounce = luminance(hexToRgb(theme.floor).map(toLinear)) * 0.5;
  const lights = scene.lights.map(light => ({
    light,
    intensity: irradiance(light),
    color: illuminant(light.kelvin),
  }));
  const total = ambient.map(
    (a, ch) => a + lights.reduce((sum, l) => sum + l.intensity * l.color[ch] * (1 + bounce), 0)
  );
  return { theme, ambient, bounce, lights, total };
}

/**
 * The rgba overlay that turns `floor` into the floor with the fraction
 * `removed` (per linear channel) of its light taken away. The maths runs in
 * linear light, but browsers blend shadows in sRGB, so the result is solved
 * back into sRGB. A white light gives a black shadow; a warm light leaves a
 * cool tint behind.
 */
export function shadowColor(floorHex, removed) {
  const floor = hexToRgb(floorHex);
  const target = floor.map((c, ch) => toSrgb(toLinear(c) * (1 - clamp(removed[ch], 0, 1))));
  const delta = floor.map((c, ch) => c - target[ch]);
  const alpha = Math.min(1, Math.max(0, ...floor.map((c, ch) => (c > 1e-4 ? delta[ch] / c : 0))));
  if (alpha < 1e-4) return { rgb: [0, 0, 0], alpha: 0 };
  return { rgb: floor.map((c, ch) => clamp(c - delta[ch] / alpha, 0, 1)), alpha };
}

/**
 * The stacked box-shadow layers for the scene with the card at `elevation`.
 * The count and order of layers depend only on the lights, never on the
 * elevation, so the browser can transition between card states.
 */
export function shadowLayers(scene, elevation, { rim = true } = {}) {
  const { theme, ambient, lights, total } = lighting(scene);
  const { width, height } = WORLD.card;
  const halfSize = (width + height) / 4;
  const totalLuminance = luminance(total);
  const layers = [];

  if (rim) {
    // The card's edges catch light on the side facing each light, and fall
    // into self-shadow on the far side. Grazing light lights them most.
    // Rim layers don't depend on elevation, so leaving out the invisible ones
    // keeps every state's layer list the same.
    lights.forEach(({ light, intensity }, index) => {
      const r = Math.hypot(light.x, light.y);
      const [ux, uy] = r > 0 ? [light.x / r, light.y / r] : [0, -1];
      const grazing = r / Math.hypot(r, light.z);
      const share = (intensity * grazing) / totalLuminance;
      const t = WORLD.rimThickness;
      const rimLayers = [
        {
          role: 'rim', light: index, inset: true, x: -ux * t, y: -uy * t, blur: 0, spread: 0,
          rgb: mix([1, 1, 1], kelvinToRgb(light.kelvin), 0.5),
          alpha: clamp(share * theme.rim, 0, 0.6),
        },
        {
          role: 'rim-shade', light: index, inset: true, x: ux * t, y: uy * t, blur: 0, spread: 0,
          rgb: [0, 0, 0],
          alpha: clamp(share * theme.rimShade, 0, 0.2),
        },
      ];
      layers.push(...rimLayers.filter(l => l.alpha >= 0.01));
    });
  }

  // Key shadows. A point on the card projects from the light onto the floor,
  // so the shadow is the card scaled by k = z / (z - e) about the light. With
  // f = k - 1 = e / (z - e): offset = -L·f, growth = half-size·f, and a
  // sphere of radius R leaves a penumbra of width 2R·f.
  lights.forEach(({ light, intensity, color }, index) => {
    const f = elevation / Math.max(1, light.z - elevation);
    const removed = color.map((c, ch) => (intensity * c) / total[ch]);
    const { rgb, alpha } = shadowColor(theme.floor, removed);
    layers.push({
      role: 'key', light: index, inset: false,
      x: -light.x * f, y: -light.y * f, blur: light.size * f, spread: halfSize * f,
      rgb, alpha,
    });
  });

  // Ambient occlusion: the card blocks part of the sky above the floor.
  const sky = shadowColor(theme.floor, ambient.map((c, ch) => (c / total[ch]) * AO_STRENGTH));
  AO_OCTAVES.forEach((octave, index) => {
    layers.push({
      role: 'ambient', octave: index, inset: false,
      x: 0, y: 0, blur: elevation * octave.blur, spread: 0,
      rgb: sky.rgb, alpha: sky.alpha * octave.weight,
    });
  });

  return layers;
}

/**
 * Shading of the card's top face from the strongest light: diffuse falloff
 * (inverse square × cosine across the face, brightest where the light is
 * nearest) and a satin glint where the light reflects towards the camera.
 * Positions are in px from the card's top-left corner.
 */
export function cardShading(scene, elevation) {
  const { theme, lights, total } = lighting(scene);
  const { width, height } = WORLD.card;
  const strongest = lights.reduce((a, b) => (b.intensity > a.intensity ? b : a));
  const { light } = strongest;
  const h = Math.max(1, light.z - elevation);

  const foot = { x: width / 2 + light.x, y: height / 2 + light.y };
  const near = Math.hypot(foot.x - clamp(foot.x, 0, width), foot.y - clamp(foot.y, 0, height));
  const far = Math.max(
    ...[[0, 0], [width, 0], [0, height], [width, height]].map(([cx, cy]) => Math.hypot(foot.x - cx, foot.y - cy))
  );
  // The card's own colour is what it looks like at its centre. Contrast is
  // eased by the theme, much as the eye adapts to a lamp-lit surface.
  const base = luminance(total) - strongest.intensity;
  const onFace = r => (WORLD.falloff ** 2 * h) / (h * h + r * r) ** 1.5;
  const centre = base + onFace(Math.hypot(light.x, light.y));
  const card = hexToRgb(theme.card).map(toLinear);
  const stops = [0, 0.25, 0.5, 0.75, 1].map(t => {
    const r = near + (far - near) * t;
    const ratio = 1 + ((base + onFace(r)) / centre - 1) * theme.shading;
    return { at: r, rgb: card.map(c => toSrgb(clamp(c * ratio, 0, 1))) };
  });

  // Mirror point of the light on the card plane for a camera overhead.
  const m = (WORLD.camera - elevation) / (WORLD.camera - elevation + h);
  const glint = {
    x: width / 2 + light.x * m,
    y: height / 2 + light.y * m,
    radius: light.size * m + 48,
    rgb: kelvinToRgb(light.kelvin),
    alpha: theme.glint * clamp(strongest.intensity, 0, 1),
  };

  return { color: hexToRgb(theme.card), diffuse: { x: foot.x, y: foot.y, stops }, glint };
}

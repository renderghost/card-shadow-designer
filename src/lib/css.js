import { WORLD, THEMES, cardShading, clamp, shadowLayers, stateElevation, stateScale } from './physics';

const round = (value, digits = 1) => {
  const p = 10 ** digits;
  const r = Math.round(value * p) / p;
  return Object.is(r, -0) ? 0 : r;
};

export const px = value => {
  const r = round(value);
  return r === 0 ? '0' : `${r}px`;
};

const channel = c => Math.round(clamp(c, 0, 1) * 255);
export const rgba = (rgb, alpha) => `rgba(${rgb.map(channel).join(', ')}, ${round(alpha, 3)})`;
export const hex = rgb => `#${rgb.map(c => channel(c).toString(16).padStart(2, '0')).join('')}`;

export const TRANSITION =
  'box-shadow 280ms cubic-bezier(0.2, 0.8, 0.2, 1), transform 280ms cubic-bezier(0.2, 0.8, 0.2, 1)';

export function layerToCss(layer, scale = 1) {
  const parts = [px(layer.x * scale), px(layer.y * scale), px(layer.blur * scale), px(layer.spread * scale)];
  return `${layer.inset ? 'inset ' : ''}${parts.join(' ')} ${rgba(layer.rgb, layer.alpha)}`;
}

export const boxShadow = (layers, scale = 1) => layers.map(l => layerToCss(l, scale)).join(', ');

export function gradients(shading, scale = 1) {
  const { glint, diffuse } = shading;
  const s = v => px(v * scale);
  return [
    `radial-gradient(circle at ${s(glint.x)} ${s(glint.y)}, ${rgba(glint.rgb, glint.alpha)} 0, ${rgba(glint.rgb, 0)} ${s(glint.radius)})`,
    `radial-gradient(circle at ${s(diffuse.x)} ${s(diffuse.y)}, ${diffuse.stops.map(st => `${hex(st.rgb)} ${s(st.at)}`).join(', ')})`,
  ];
}

const ORDINAL = ['near', 'mid', 'far'];

function note(layer, scene) {
  const n = layer.light + 1;
  switch (layer.role) {
    case 'rim': return `rim light · light ${n}`;
    case 'rim-shade': return `rim shade · light ${n}`;
    case 'key': return `key shadow · light ${n} · ${Math.round(scene.lights[layer.light].kelvin)}K`;
    default: return `ambient occlusion · ${ORDINAL[layer.octave]}`;
  }
}

function shadowDeclaration(layers, scene, notes) {
  const lines = layers.map((layer, i) => {
    const sep = i === layers.length - 1 ? ';' : ',';
    const comment = notes ? `/* ${note(layer, scene)} */ ` : '';
    return `    ${comment}${layerToCss(layer)}${sep}`;
  });
  return ['  box-shadow:', ...lines];
}

/** Everything the export needs, from one place, so the app renders exactly what it exports. */
export function cardStyle(scene, elevation, options) {
  const layers = shadowLayers(scene, elevation, options);
  const shading = options.shading ? cardShading(scene, scene.elevation) : null;
  return {
    layers,
    boxShadow: boxShadow(layers),
    backgroundColor: THEMES[scene.theme].card,
    backgroundImage: shading ? gradients(shading).join(', ') : 'none',
  };
}

export function buildCss(scene, options) {
  const theme = THEMES[scene.theme];
  const { notes, states } = options;
  const rest = shadowLayers(scene, scene.elevation, options);
  const lines = [];

  if (notes) {
    const count = scene.lights.length;
    lines.push(`/* Lumen · ${count} light${count > 1 ? 's' : ''} · card ${Math.round(scene.elevation)}px up · tuned for a ${theme.floor} page */`);
  }
  lines.push('.card {');
  lines.push(`  border-radius: ${WORLD.card.radius}px;`);
  lines.push(`  background-color: ${theme.card};`);
  if (options.shading) {
    const [glint, diffuse] = gradients(cardShading(scene, scene.elevation));
    lines.push('  background-image:');
    lines.push(`    ${notes ? '/* glint */ ' : ''}${glint},`);
    lines.push(`    ${notes ? '/* diffuse falloff */ ' : ''}${diffuse};`);
  }
  lines.push(...shadowDeclaration(rest, scene, notes));
  if (states) lines.push(`  transition: ${TRANSITION};`);
  lines.push('}');

  if (states) {
    for (const state of ['hover', 'active']) {
      const elevation = stateElevation(scene.elevation, state);
      lines.push('', `.card:${state} {`);
      lines.push(...shadowDeclaration(shadowLayers(scene, elevation, options), scene, false));
      lines.push(`  transform: scale(${round(stateScale(scene.elevation, elevation), 4)});`);
      lines.push('}');
    }
  }
  return lines.join('\n');
}

/* ---------------------------------------------------------- highlighting -- */

const TOKEN =
  /(\/\*.*?\*\/)|(rgba\([^)]*\)|#[0-9a-f]{6}\b)|(\.card(?::[a-z]+)?)|([a-z-]+(?=\())|([a-z-]+(?=:))|(-?\d*\.?\d+(?:px|ms|%)?)|([a-z-]+)|(\s+)|(.)/gi;
const TYPES = ['comment', 'color', 'selector', 'fn', 'prop', 'num', 'word', 'space', 'punct'];

export function tokenize(line) {
  const tokens = [];
  for (const match of line.matchAll(TOKEN)) {
    const type = TYPES[match.slice(1).findIndex(Boolean)];
    tokens.push({ type, text: match[0] });
  }
  return tokens;
}

import { describe, expect, test } from 'vitest';
import { buildCss, tokenize } from './css';
import { shadowLayers } from './physics';
import { DEFAULT_OPTIONS, decodeHash, defaultScene, encodeHash, sanitizeScene } from './storage';

const scene = {
  ...defaultScene('light'),
  lights: [
    { id: 1, x: -260, y: -300, z: 440, size: 140, kelvin: 4600 },
    { id: 2, x: 320, y: 40, z: 300, size: 60, kelvin: 2700 },
  ],
};

const shadowsIn = (css, selector) => {
  const block = css.split(`${selector} {`)[1].split('}')[0];
  return block.split('box-shadow:')[1].split(';')[0].split('),').length;
};

describe('exported CSS', () => {
  const css = buildCss(scene, { ...DEFAULT_OPTIONS, notes: true });

  test('uses raw values only', () => {
    expect(css).not.toMatch(/var\(|--[a-z]/);
  });

  test('covers rest, hover and press with matching shadow lists', () => {
    const rest = shadowsIn(css, '.card');
    expect(rest).toBe(shadowLayers(scene, scene.elevation, DEFAULT_OPTIONS).length);
    // At least 2 key shadows + 3 ambient octaves, plus whatever rim light shows.
    expect(rest).toBeGreaterThanOrEqual(5);
    expect(shadowsIn(css, '.card:hover')).toBe(rest);
    expect(shadowsIn(css, '.card:active')).toBe(rest);
    expect(css).toMatch(/\.card:hover \{[^}]*transform: scale\(1\.\d+\)/);
  });

  test('respects the export options', () => {
    const bare = buildCss(scene, { rim: false, shading: false, states: false, notes: false });
    expect(bare).not.toMatch(/:hover|:active|background-image|inset|\/\*/);
    expect(shadowsIn(bare, '.card')).toBe(5);
  });

  test('every line tokenizes back to itself', () => {
    for (const line of css.split('\n')) {
      expect(tokenize(line).map(t => t.text).join('')).toBe(line);
    }
  });
});

describe('links', () => {
  test('a scene survives a round trip through the URL', () => {
    const options = { rim: true, shading: false, states: true, notes: false };
    const decoded = decodeHash(encodeHash({ ...scene, theme: 'dark' }, options));
    expect(decoded.options).toEqual(options);
    expect(decoded.scene.theme).toBe('dark');
    expect(decoded.scene.lights.map(({ x, y, z, size, kelvin }) => [x, y, z, size, kelvin])).toEqual([
      [-260, -300, 440, 140, 4600],
      [320, 40, 300, 60, 2700],
    ]);
  });

  test('junk is rejected or clamped', () => {
    expect(decodeHash('#nothing=here')).toBeNull();
    expect(sanitizeScene({ lights: [{ x: 'a' }] })).toBeNull();
    const clamped = sanitizeScene({ elevation: 999, lights: [{ x: 0, y: 0, z: 1e6, size: 1, kelvin: 1 }] });
    expect(clamped.elevation).toBe(48);
    expect(clamped.lights[0].z).toBe(760);
  });
});

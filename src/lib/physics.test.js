import { describe, expect, test } from 'vitest';
import {
  WORLD, constrainLight, isAtLimit, kelvinToRgb, lightAngles, lightLimits, minDistance, shadowLayers, stateElevation,
  withAngle, withDistance,
} from './physics';

const light = overrides => ({ id: 1, x: -260, y: -300, z: 440, size: 140, kelvin: 6500, ...overrides });
const scene = (lights = [light()], theme = 'light') => ({ theme, elevation: 16, lights });
const key = (s, e = s.elevation) => shadowLayers(s, e, { rim: false }).find(l => l.role === 'key');

describe('key shadow', () => {
  test('falls on the side away from the light', () => {
    const k = key(scene());
    expect(k.x).toBeGreaterThan(0);
    expect(k.y).toBeGreaterThan(0);
    // Exactly opposite the light, scaled by e / (z - e).
    expect(k.x / k.y).toBeCloseTo(260 / 300, 6);
    expect(k.x).toBeCloseTo((260 * 16) / (440 - 16), 6);
  });

  test('grows longer and softer as the card rises', () => {
    const low = key(scene(), 8);
    const high = key(scene(), 32);
    expect(high.x).toBeGreaterThan(low.x * 3);
    expect(high.blur).toBeGreaterThan(low.blur * 3);
    expect(high.spread).toBeGreaterThan(low.spread);
  });

  test('a bigger light gives a softer shadow in the same place', () => {
    const small = key(scene([light({ size: 20 })]));
    const big = key(scene([light({ size: 300 })]));
    expect(big.blur).toBeCloseTo(small.blur * 15, 6);
    expect(big.x).toBeCloseTo(small.x, 6);
  });

  test('a farther light is dimmer, so its shadow is fainter', () => {
    const near = key(scene([light({ x: -150, y: -170, z: 250 })]));
    const far = key(scene([light({ x: -300, y: -340, z: 500 })]));
    expect(far.alpha).toBeLessThan(near.alpha);
  });

  test('a flat card casts nothing', () => {
    const layers = shadowLayers(scene(), 0);
    for (const l of layers.filter(l => !l.inset)) {
      expect(Math.abs(l.x) + Math.abs(l.y) + l.blur + l.spread).toBe(0);
    }
  });

  test('a warm light leaves a cool shadow', () => {
    const { rgb } = key(scene([light({ kelvin: 2000 })]));
    expect(rgb[2]).toBeGreaterThan(rgb[0]);
  });

  test('a neutral light in a neutral room gives a near-neutral shadow', () => {
    const { rgb } = key({ ...scene([light({ kelvin: 6500 })]), theme: 'dark' });
    expect(Math.max(...rgb) - Math.min(...rgb)).toBeLessThan(0.12);
  });
});

describe('ambient occlusion', () => {
  // Abramowitz & Stegun 7.1.26
  const erf = x => {
    const t = 1 / (1 + 0.3275911 * Math.abs(x));
    const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return Math.sign(x) * y;
  };

  test('the stacked octaves track the analytic falloff beside a floating plate', () => {
    const e = 20;
    const octaves = shadowLayers(scene(), e).filter(l => l.role === 'ambient');
    const total = octaves.reduce((sum, l) => sum + l.alpha, 0);
    for (const x of [0, 0.25 * e, 0.5 * e, e, 2 * e, 4 * e]) {
      // A box-shadow edge with blur B is a Gaussian with σ = B / 2.
      const stacked = octaves.reduce((sum, l) => sum + (l.alpha / total) * 0.5 * (1 - erf(x / ((l.blur / 2) * Math.SQRT2))), 0);
      const analytic = (1 - x / Math.hypot(x, e)) / 2;
      expect(Math.abs(stacked - analytic)).toBeLessThan(0.005);
    }
  });
});

describe('card states', () => {
  test('hover lifts the card and press lowers it', () => {
    expect(stateElevation(16, 'hover')).toBeGreaterThan(16);
    expect(stateElevation(16, 'active')).toBeLessThan(16);
  });

  test('every state has the same layers in the same order, so they can transition', () => {
    const s = scene([light(), light({ id: 2, x: 300, y: -100, kelvin: 2700 })]);
    const shape = e => shadowLayers(s, e).map(l => `${l.role}:${l.inset}`);
    const rest = shape(16);
    expect(shape(stateElevation(16, 'hover'))).toEqual(rest);
    expect(shape(stateElevation(16, 'active'))).toEqual(rest);
    expect(shape(0)).toEqual(rest);
  });
});

describe('range', () => {
  test('a light pulled past the maximum range stays on the range sphere', () => {
    const l = constrainLight(light({ x: -2000, y: -2000, z: 400 }));
    expect(Math.hypot(l.x, l.y, l.z)).toBeCloseTo(WORLD.maxRange, 6);
    expect(l.x / l.y).toBeCloseTo(1, 6);
    expect(isAtLimit(l)).toBe(true);
  });

  test('height, size and colour temperature are clamped', () => {
    const l = constrainLight(light({ z: 5, size: 9999, kelvin: 100 }));
    expect(l.z).toBe(WORLD.height[0]);
    expect(l.size).toBe(WORLD.size[1]);
    expect(l.kelvin).toBe(WORLD.kelvin[0]);
  });

  test('lights within range are left alone', () => {
    expect(constrainLight(light())).toEqual(light());
  });
});

describe('colour temperature', () => {
  test('low kelvin is orange, high kelvin is blue', () => {
    const [r1, , b1] = kelvinToRgb(1900);
    const [r2, , b2] = kelvinToRgb(10000);
    expect(r1).toBeGreaterThan(b1);
    expect(b2).toBeGreaterThan(r2);
  });

});

describe('panel edits', () => {
  test('distance slides the light along its line to the card', () => {
    const l = withDistance(light(), 400);
    expect(Math.hypot(l.x, l.y, l.z)).toBeCloseTo(400, 6);
    expect(lightAngles(l).azimuth).toBeCloseTo(lightAngles(light()).azimuth, 6);
    expect(lightAngles(l).altitude).toBeCloseTo(lightAngles(light()).altitude, 6);
  });

  test('distance stops at the maximum range and at the lowest height', () => {
    expect(Math.hypot(...Object.values(pick(withDistance(light(), 5000))))).toBeCloseTo(WORLD.maxRange, 6);
    const near = withDistance(light(), 1);
    expect(near.z).toBeCloseTo(WORLD.height[0], 6);
    expect(Math.hypot(near.x, near.y, near.z)).toBeCloseTo(minDistance(light()), 6);
  });

  test('angle swings the light round the card at the same height and reach', () => {
    const l = withAngle(light(), 90);
    expect(l.x).toBeCloseTo(Math.hypot(260, 300), 6);
    expect(l.y).toBeCloseTo(0, 6);
    expect(l.z).toBe(440);
  });

  test('limits flag values at their minimum or maximum', () => {
    expect(lightLimits(light())).toEqual({ kelvin: null, size: null, height: null, distance: null });
    const pinned = constrainLight(light({ x: -2000, y: -2000, size: 9999, kelvin: 1 }));
    expect(lightLimits(pinned)).toMatchObject({ kelvin: 'min', size: 'max', distance: 'max' });
    expect(lightLimits(light({ z: WORLD.height[0] }))).toMatchObject({ height: 'min', distance: 'min' });
  });
});

const pick = ({ x, y, z }) => ({ x, y, z });

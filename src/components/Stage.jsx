import { useLayoutEffect, useRef } from 'react';
import {
  WORLD, clamp, isAtLimit, kelvinToRgb, lightAngles, lightLimits, lighting, perspective, reachAt,
} from '../lib/physics';
import { rgba } from '../lib/css';

const { width: CARD_W, height: CARD_H, radius: CARD_R } = WORLD.card;
const EDGE = 12;

/** Light pooling on the floor: inverse square × cosine, centred under each light. */
function poolGradient(scene, center) {
  const { theme, lights } = lighting(scene);
  return lights
    .map(({ light }) => {
      const rgb = kelvinToRgb(light.kelvin);
      const peak = theme.pool * clamp((WORLD.falloff / light.z) ** 2 / 2.5, 0.35, 1);
      const stops = [0, 0.35, 0.7, 1, 1.5, 2.2, 3.2].map(
        t => `${rgba(rgb, peak * (1 + t * t) ** -1.5)} ${Math.round(t * light.z)}px`
      );
      const at = `${Math.round(center.x + light.x)}px ${Math.round(center.y + light.y)}px`;
      return `radial-gradient(circle at ${at}, ${stops.join(', ')}, ${rgba(rgb, 0)} ${Math.round(4.5 * light.z)}px)`;
    })
    .join(', ');
}

const css = rgb => `rgb(${rgb.map(c => Math.round(c * 255)).join(' ')})`;

export function screenOf(light, center) {
  const s = perspective(light.z);
  return { x: center.x + light.x * s, y: center.y + light.y * s, scale: s };
}

/** On-screen radius of a light's orb: grows with the light's size and nearness, up to a point. */
export const orbRadius = light => Math.min(64, (7 + light.size * 0.11) * perspective(light.z));

/** A resize cursor whose arrows point along the line from the card's centre to `orb`. */
export function radialCursor(orb, center) {
  const angle = (Math.atan2(orb.y - center.y, orb.x - center.x) * 180) / Math.PI;
  const a = ((angle % 180) + 180) % 180;
  if (a < 22.5 || a >= 157.5) return 'ew-resize';
  if (a < 67.5) return 'nwse-resize';
  if (a < 112.5) return 'ns-resize';
  return 'nesw-resize';
}

/** The geometry behind each key shadow: rays through the card's corners, umbra and penumbra. */
function Construction({ scene, elevation, center }) {
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => [(sx * CARD_W) / 2, (sy * CARD_H) / 2]);
  return scene.lights.map(light => {
    const orb = screenOf(light, center);
    const k = light.z / Math.max(1, light.z - elevation);
    const f = k - 1;
    const shadow = corners.map(([px, py]) => ({
      x: center.x + light.x + (px - light.x) * k,
      y: center.y + light.y + (py - light.y) * k,
    }));
    const xs = shadow.map(p => p.x);
    const ys = shadow.map(p => p.y);
    const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    const pen = light.size * f;
    const color = css(kelvinToRgb(light.kelvin));
    return (
      <g key={light.id} className="construction" style={{ '--ray': color }}>
        {shadow.map((p, i) => (
          <line key={i} x1={orb.x} y1={orb.y} x2={p.x} y2={p.y} className="ray" />
        ))}
        <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={CARD_R * k} className="umbra" />
        {pen > 1 && (
          <>
            <rect x={box.x - pen} y={box.y - pen} width={box.w + 2 * pen} height={box.h + 2 * pen} rx={CARD_R * k + pen} className="penumbra" />
            {box.w > 2 * pen && box.h > 2 * pen && (
              <rect x={box.x + pen} y={box.y + pen} width={box.w - 2 * pen} height={box.h - 2 * pen} rx={Math.max(0, CARD_R * k - pen)} className="penumbra" />
            )}
          </>
        )}
        {shadow.slice(0, 2).map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.5} className="corner" />
        ))}
      </g>
    );
  });
}

/**
 * Where a box of size w × h goes beside the orb, pushed outward from the card
 * along `angle`. Using the max-norm puts its nearest corner or edge on the
 * circle around the orb, so it never reaches back over the orb or its line.
 */
function besideOrb(orb, gap, angle, w, h) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const m = Math.max(Math.abs(dx), Math.abs(dy));
  const ax = orb.x + dx * gap;
  const ay = orb.y + dy * gap;
  return { left: ax - w / 2 + (dx / m) * (w / 2), top: ay - h / 2 + (dy / m) * (h / 2) };
}

/** Does the box (with a little padding) touch the segment a → b? */
function boxHitsSegment(box, a, b, pad = 6) {
  const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4) + 1;
  for (let i = 0; i <= steps; i++) {
    const x = a.x + ((b.x - a.x) * i) / steps;
    const y = a.y + ((b.y - a.y) * i) / steps;
    if (x >= box.left - pad && x <= box.right + pad && y >= box.top - pad && y <= box.bottom + pad) return true;
  }
  return false;
}

function boxHitsCircle(box, c, r) {
  const x = clamp(c.x, box.left, box.right);
  const y = clamp(c.y, box.top, box.bottom);
  return Math.hypot(c.x - x, c.y - y) < r;
}

function Readout({ light, center, viewport }) {
  const ref = useRef(null);
  const orb = screenOf(light, center);
  const radius = orbRadius(light);
  const { distance, azimuth } = lightAngles(light);
  const limits = lightLimits(light);

  // Try spots on a circle round the orb, starting outward from the card and
  // working round both ways, and take the first that is on screen and clear
  // of the orb and its line.
  useLayoutEffect(() => {
    const el = ref.current;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const foot = { x: center.x + light.x, y: center.y + light.y };
    const outward = Math.hypot(orb.x - center.x, orb.y - center.y) > 1 ? Math.atan2(orb.y - center.y, orb.x - center.x) : -Math.PI / 2;
    const steps = [0];
    for (let a = 15; a <= 180; a += 15) steps.push(a, -a);
    const boxAt = p => ({ ...p, right: p.left + w, bottom: p.top + h });
    const onScreen = b => b.left >= EDGE && b.top >= EDGE && b.right <= viewport.w - EDGE && b.bottom <= viewport.h - EDGE;
    const clear = b => !boxHitsSegment(b, orb, foot) && !boxHitsCircle(b, orb, radius + 6);
    const toScreen = b => {
      const left = clamp(b.left, EDGE, viewport.w - w - EDGE);
      const top = clamp(b.top, EDGE, viewport.h - h - EDGE);
      return boxAt({ left, top });
    };
    const candidates = steps.map(step => boxAt(besideOrb(orb, radius + 12, outward + (step * Math.PI) / 180, w, h)));
    const place =
      candidates.find(b => onScreen(b) && clear(b)) ??
      candidates.map(toScreen).find(clear) ??
      toScreen(candidates[0]);
    el.style.left = `${place.left}px`;
    el.style.top = `${place.top}px`;
  });

  const row = (label, value, limit) => (
    <div className={limit ? 'limit' : ''} key={`${label}${limit ?? ''}`}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );

  return (
    <div className="readout" ref={ref} aria-hidden="true">
      {row('Warmth', `${Math.round(light.kelvin)} K`, limits.kelvin)}
      {row('Size', `⌀ ${Math.round(light.size * 2)} px`, limits.size)}
      {row('Distance', `${Math.round(distance)} px`, limits.distance)}
      {row('Angle', `${Math.round(azimuth) % 360}°`)}
    </div>
  );
}

export default function Stage({
  ref, scene, viewport, elevation, elevationLimit, cardScale, cardStyle, selectedId, readoutId, dragging, dragCursor,
  modifier, lightsHidden, onCardState, onLightHover, onPointerDown, onPointerMove, onPointerUp,
}) {
  const center = { x: viewport.w / 2, y: viewport.h / 2 };
  // Hiding the lights hides the objects and their geometry only: they still light the scene.
  const readout = lightsHidden ? null : scene.lights.find(l => l.id === readoutId);

  return (
    <div
      ref={ref}
      className={`stage ${dragging ? 'is-dragging' : ''} ${dragCursor ? 'has-drag-cursor' : ''} ${lightsHidden ? 'lights-hidden' : ''}`}
      style={dragCursor ? { cursor: dragCursor } : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={e => e.preventDefault()}
    >
      <div className="pool" style={{ backgroundImage: poolGradient(scene, center) }} />
      <div className="vignette" />

      <svg className="overlay" width={viewport.w} height={viewport.h} aria-hidden="true">
        {scene.lights.map(light => {
          const orb = screenOf(light, center);
          const ringRadius = reachAt(light.z) * orb.scale;
          return (
            <g key={light.id}>
              <circle
                cx={center.x} cy={center.y} r={ringRadius}
                className={`range-ring ${readoutId === light.id && dragging ? 'visible' : ''} ${isAtLimit(light) ? 'limit' : ''}`}
              />
              <line x1={center.x + light.x} y1={center.y + light.y} x2={orb.x} y2={orb.y} className="plumb" />
              <circle cx={center.x + light.x} cy={center.y + light.y} r={3} className="foot" />
            </g>
          );
        })}
        <Construction scene={scene} elevation={elevation} center={center} />
      </svg>

      <div
        className="card"
        style={{
          width: CARD_W,
          height: CARD_H,
          borderRadius: CARD_R,
          left: center.x,
          top: center.y,
          transform: `translate(-50%, -50%) scale(${cardScale})`,
          boxShadow: cardStyle.boxShadow,
          backgroundColor: cardStyle.backgroundColor,
          backgroundImage: cardStyle.backgroundImage,
          cursor: modifier ? 'ns-resize' : undefined,
        }}
        onPointerEnter={() => onCardState('hover')}
        onPointerLeave={() => onCardState('rest')}
      >
        <span className="card-label">.card</span>
        <span className={`card-elevation ${elevationLimit ? 'limit' : ''}`} key={elevationLimit ?? 'free'}>
          ↑ {Math.round(elevation)} px
        </span>
      </div>

      {scene.lights.map(light => {
        const orb = screenOf(light, center);
        const rgb = kelvinToRgb(light.kelvin);
        const radius = orbRadius(light);
        const glow = (10 + light.size * 0.18) * orb.scale;
        const cursor = modifier === 'size' ? 'ns-resize' : modifier === 'distance' ? radialCursor(orb, center) : undefined;
        return (
          <button
            key={light.id}
            type="button"
            data-light={light.id}
            tabIndex={lightsHidden ? -1 : undefined}
            aria-hidden={lightsHidden || undefined}
            className={`orb ${light.id === selectedId ? 'selected' : ''}`}
            aria-label={`Light ${scene.lights.indexOf(light) + 1}, ${Math.round(light.kelvin)} kelvin`}
            onPointerEnter={() => onLightHover(light.id)}
            onPointerLeave={() => onLightHover(null)}
            style={{
              left: orb.x,
              top: orb.y,
              width: radius * 2,
              height: radius * 2,
              cursor,
              color: css(rgb),
              background: `radial-gradient(circle at 38% 34%, #fff 0, ${css(rgb)} 46%, ${css(rgb.map(c => c * 0.78))} 100%)`,
              boxShadow: `0 0 ${glow}px ${glow * 0.25}px ${rgba(rgb, 0.5)}, 0 0 ${glow * 2.4}px ${rgba(rgb, 0.22)}`,
            }}
          />
        );
      })}

      {readout && <Readout light={readout} center={center} viewport={viewport} />}
    </div>
  );
}

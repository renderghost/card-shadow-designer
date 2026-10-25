# Lumen · Card Shadow Designer

Design CSS card shadows by moving a light, not by pushing sliders. The shadow is
worked out from the light's position, height, size and colour temperature, then
exported as stacked `box-shadow` layers in plain values.

```sh
npm install
npm run dev     # http://localhost:5173
npm test
npm run build   # → dist/
```

## Controls

| Action | What it does | Control |
| --- | --- | --- |
| Move a light | Take hold of a light and drag it | Drag a light |
| Light distance | Slides the light along its line to the card | ⇧ Drag a light |
| Light size | Bigger lights cast softer shadows | ⌃ ⇧ Drag a light |
| Card elevation | Lifts the card off the page, or lowers it | ⇧ Drag the card |
| Edit a light | Opens its panel: drag a value left or right, or click to type | Click a light or its button |

Add up to three lights with **+** in the toolbar; remove them from their panel.
Keys: `C` CSS · `S` save a sample · `L` show or hide the lights and geometry
(they keep lighting the scene) · `F` full screen ·
`H` hide the interface · `?` controls.

## The model

World units are CSS pixels. The card floats at height `e` above the page and
each light is a sphere of radius `R` at `(x, y, z)`, no more than 820 px from the
card.

- **Key shadow, one per light.** The light projects the card onto the page,
  scaled by `k = z / (z − e)`. The offset is `−(x, y)·(k − 1)`, the spread is
  the growth in size, and the blur is the penumbra, `R·e / (z − e)`.
- **Falloff.** Irradiance is inverse square times the cosine of the angle, so
  farther lights cast fainter shadows.
- **Colour.** Shadows are solved in linear light against the page colour. A
  shadow keeps whatever light still reaches it, so a warm lamp in a cool room
  casts a cool shadow.
- **Ambient occlusion.** Three stacked shadows are fitted to the analytic sky
  occlusion beside a floating plate, `(1 − x / √(x² + e²)) / 2`, to within 0.001.
- **Rim light.** Inset shadows light the edge facing each light and shade the
  opposite edge, most strongly when the light is low.
- **States.** `:hover` lifts the card and `:active` presses it. The light stays
  put, and every state has the same layer list, so the browser can transition
  between them.

The physics lives in [`src/lib/physics.js`](src/lib/physics.js). The CSS export
is built in [`src/lib/css.js`](src/lib/css.js).

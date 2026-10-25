import { CloseIcon } from './icons';

// [title, description, control]
const ROWS = [
  ['Move a light', 'Take hold of a light and drag it.', ['Drag a light']],
  ['Light distance', 'Slides the light nearer or farther along its line to the card.', ['⇧', 'Drag a light']],
  ['Light size', 'Bigger lights cast softer shadows.', ['⌃', '⇧', 'Drag a light']],
  ['Card elevation', 'Lifts the card off the page, or lowers it.', ['⇧', 'Drag the card']],
  ['Edit a light', 'Opens its panel. Drag a value left or right, or click to type.', ['Click a light']],
  ['States', 'Previews the :hover and :active shadows.', ['Hover or press the card']],
  ['CSS', 'Shows or hides the CSS.', ['C']],
  ['Save', 'Saves this look to your samples.', ['S']],
  ['Lights and geometry', 'Shows or hides the lights and the rays, umbra and penumbra they cast. They keep lighting the scene.', ['L']],
  ['Full screen', 'Fills the screen.', ['F']],
  ['Hide interface', 'Hides everything but the card and lights.', ['H']],
  ['Controls', 'Opens this list.', ['?']],
];

const isKey = part => part.length <= 2;

export function Help({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="help-backdrop" data-ui onPointerDown={onClose}>
      <section className="help" role="dialog" aria-label="Controls" onPointerDown={e => e.stopPropagation()}>
        <header>
          <h2>Light it like a real thing</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </header>
        <p className="help-lede">
          The shadow is worked out from the light: where it is, how big and how warm. The light can travel up to 820 px
          from the card. Farther lights are dimmer, so their shadows are fainter.
        </p>
        <table className="help-table">
          <tbody>
            {ROWS.map(([title, description, control]) => (
              <tr key={title}>
                <th scope="row">{title}</th>
                <td>{description}</td>
                <td className="help-control">
                  {control.map((part, i) => (isKey(part) ? <kbd key={i}>{part}</kbd> : <span key={i}>{part}</span>))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export function Hint({ visible }) {
  return (
    <p className={`hint ${visible ? 'visible' : ''}`} aria-hidden={!visible}>
      <span><b>Drag a light</b> to move it</span>
      <span><kbd>⇧</kbd> <b>Drag a light</b> for distance</span>
      <span><kbd>⌃</kbd><kbd>⇧</kbd> <b>Drag a light</b> for size</span>
      <span><kbd>⇧</kbd> <b>Drag the card</b> to lift it</span>
      <span><kbd>?</kbd> for more</span>
    </p>
  );
}

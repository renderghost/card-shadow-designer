/** Hover and focus tooltip, with the keyboard shortcut when there is one. */
export default function Tip({ label, shortcut, side = 'below', children }) {
  return (
    <span className={`tip-host tip-${side}`}>
      {children}
      <span className="tip" role="tooltip">
        {label}
        {shortcut && <kbd>{shortcut}</kbd>}
      </span>
    </span>
  );
}

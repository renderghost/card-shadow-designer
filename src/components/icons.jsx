const Icon = ({ children, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export const SunIcon = () => (
  <Icon>
    <circle cx="8" cy="8" r="3" />
    <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" />
  </Icon>
);

export const MoonIcon = () => (
  <Icon>
    <path d="M13.5 9.6A5.8 5.8 0 0 1 6.4 2.5a5.8 5.8 0 1 0 7.1 7.1Z" />
  </Icon>
);

// A light and its plumb line, as drawn on the stage.
export const LightsIcon = () => (
  <Icon>
    <circle cx="8" cy="6" r="3.5" />
    <path d="M8 9.5v1.5M8 13v.5" />
  </Icon>
);

export const LightsOffIcon = () => (
  <Icon>
    <circle cx="8" cy="6" r="3.5" />
    <path d="M8 9.5v1.5M8 13v.5M2.5 2.5l11 11" />
  </Icon>
);

export const ExpandIcon = () => (
  <Icon>
    <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />
  </Icon>
);

export const CodeIcon = () => (
  <Icon>
    <path d="M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5" />
  </Icon>
);

export const PlusIcon = () => (
  <Icon size={14}>
    <path d="M8 3v10M3 8h10" />
  </Icon>
);

export const CloseIcon = () => (
  <Icon size={14}>
    <path d="M4 4l8 8M12 4l-8 8" />
  </Icon>
);

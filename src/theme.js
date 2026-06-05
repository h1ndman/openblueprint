// Color helpers + theme palette generation.

function hexToRgb(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]) {
  const h = (v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

// Linear blend between two hex colors, t in [0,1].
export function mix(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex([
    A[0] + (B[0] - A[0]) * t,
    A[1] + (B[1] - A[1]) * t,
    A[2] + (B[2] - A[2]) * t,
  ]);
}

// Returns a dark or light text color with good contrast against `hex`.
export function readableText(hex) {
  const lin = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  const L = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  return L > 0.48 ? "#0b1b2e" : "#ffffff";
}

export const DEFAULT_THEME = {
  primary: "#1d4ed8",
  secondary: "#38bdf8",
  gradient: true,
};

export const THEME_PRESETS = [
  { name: "Ocean", primary: "#1d4ed8", secondary: "#38bdf8" },
  { name: "Sky", primary: "#2563eb", secondary: "#7dd3fc" },
  { name: "Indigo", primary: "#4338ca", secondary: "#60a5fa" },
  { name: "Teal", primary: "#0e7490", secondary: "#5eead4" },
  { name: "Royal", primary: "#1e3a8a", secondary: "#93c5fd" },
  { name: "Violet", primary: "#6d28d9", secondary: "#c4b5fd" },
  { name: "Sunset", primary: "#be123c", secondary: "#fbbf24" },
  { name: "Forest", primary: "#166534", secondary: "#86efac" },
];

// The "light" anchor of the ramp. With gradient on, it's the secondary color;
// otherwise it's a near-white tint of the primary (monochrome scale).
function lightAnchor({ primary, secondary, gradient }) {
  return gradient ? secondary : mix(primary, "#ffffff", 0.72);
}

// Produces the CSS custom properties consumed across styles.css.
export function buildThemeVars(theme) {
  const dark = theme.primary;
  const light = lightAnchor(theme);
  return {
    "--blue-900": mix(dark, "#000000", 0.34),
    "--blue-700": dark,
    "--blue-600": mix(dark, light, 0.14),
    "--blue-500": mix(dark, light, 0.3),
    "--blue-400": mix(dark, light, 0.48),
    "--blue-300": mix(dark, light, 0.62),
    "--blue-200": mix(light, "#ffffff", 0.45),
    "--blue-100": mix(light, "#ffffff", 0.66),
    "--blue-50": mix(light, "#ffffff", 0.85),
    "--sky-400": light,
    "--line": mix(light, "#ffffff", 0.4),
    "--ink": mix(dark, "#06101f", 0.55),
    "--muted": mix(dark, light, 0.42),
  };
}

// Color for actor lane #i of n, sampled along the primary→secondary ramp.
export function actorColor(i, n, theme) {
  const dark = theme.primary;
  const light = lightAnchor(theme);
  if (n <= 1) return dark;
  const spread = theme.gradient ? 0.92 : 0.55;
  const t = (i / (n - 1)) * spread;
  return mix(dark, light, t);
}

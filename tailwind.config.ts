import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

// Stitch "Intellectual Focus" tokens. Light = design export; dark = derived from the same seed.
const light = {
  background: "#f8faf3", surface: "#f8faf3", "surface-bright": "#f8faf3", "surface-dim": "#d9dbd4",
  "surface-variant": "#e1e3dc", "surface-tint": "#4f4ccd",
  "surface-container-lowest": "#ffffff", "surface-container-low": "#f2f4ed", "surface-container": "#edefe7",
  "surface-container-high": "#e7e9e2", "surface-container-highest": "#e1e3dc",
  "on-background": "#191c18", "on-surface": "#191c18", "on-surface-variant": "#464554",
  outline: "#777585", "outline-variant": "#c7c4d6",
  "inverse-surface": "#2e312d", "inverse-on-surface": "#f0f2ea", "inverse-primary": "#c2c1ff",
  primary: "#3f3bbd", "on-primary": "#ffffff", "primary-container": "#5856d6", "on-primary-container": "#e7e4ff",
  "primary-fixed": "#e2dfff", "primary-fixed-dim": "#c2c1ff", "on-primary-fixed": "#0c006a", "on-primary-fixed-variant": "#3631b4",
  secondary: "#5c5d6f", "on-secondary": "#ffffff", "secondary-container": "#e1e0f6", "on-secondary-container": "#626375",
  "secondary-fixed": "#e1e0f6", "secondary-fixed-dim": "#c5c5da", "on-secondary-fixed": "#191a2a", "on-secondary-fixed-variant": "#444557",
  tertiary: "#005b38", "on-tertiary": "#ffffff", "tertiary-container": "#1d754d", "on-tertiary-container": "#a4f8c6",
  "tertiary-fixed": "#a0f4c2", "tertiary-fixed-dim": "#84d8a7", "on-tertiary-fixed": "#002111", "on-tertiary-fixed-variant": "#005232",
  error: "#ba1a1a", "on-error": "#ffffff", "error-container": "#ffdad6", "on-error-container": "#93000a",
};

const dark: Partial<typeof light> = {
  background: "#111410", surface: "#111410", "surface-bright": "#373a35", "surface-dim": "#111410",
  "surface-variant": "#3d403b",
  "surface-container-lowest": "#1a1d19", "surface-container-low": "#232621", "surface-container": "#2a2d28",
  "surface-container-high": "#333630", "surface-container-highest": "#3d403b",
  "on-background": "#e1e3dc", "on-surface": "#e1e3dc", "on-surface-variant": "#c7c4d6",
  outline: "#918f9f", "outline-variant": "#464554",
  "inverse-surface": "#0c0f0b", "inverse-on-surface": "#e1e3dc",
  primary: "#c2c1ff", "on-primary": "#20189f", "primary-fixed": "#3631b4",
  "secondary-container": "#444557", "on-secondary-container": "#e1e0f6", "on-secondary-fixed-variant": "#e1e0f6",
  tertiary: "#84d8a7", "on-tertiary-container": "#a4f8c6", "on-tertiary-fixed": "#a0f4c2",
  error: "#ffb4ab", "error-container": "#93000a", "on-error-container": "#ffdad6",
};

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};
const vars = (p: Record<string, string | undefined>) =>
  Object.fromEntries(Object.entries(p).map(([k, v]) => [`--c-${k}`, rgb(v!)]));

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: Object.fromEntries(Object.keys(light).map((k) => [k, `rgb(var(--c-${k}) / <alpha-value>)`])),
      // Stitch's scale: "full" is intentionally 0.75rem
      borderRadius: { DEFAULT: "0.125rem", lg: "0.25rem", xl: "0.5rem", full: "0.75rem" },
      spacing: {
        "space-xs": "0.25rem", "space-sm": "0.5rem", "space-md": "0.75rem", "space-lg": "1.25rem", "space-xl": "2rem",
        gutter: "1.25rem", "gutter-mobile": "0.75rem", margin: "2rem", "margin-mobile": "1rem",
      },
      fontFamily: {
        card: ["var(--font-serif)", "serif"],
        "label-md": ["var(--font-mono)"], "label-sm": ["var(--font-mono)"],
        "body-lg": ["var(--font-sans)"], "body-md": ["var(--font-sans)"], "body-sm": ["var(--font-sans)"],
        "headline-xl": ["var(--font-sans)"], "headline-lg": ["var(--font-sans)"], "headline-md": ["var(--font-sans)"],
        "headline-sm": ["var(--font-sans)"],
      },
      fontSize: {
        "label-md": ["13px", { lineHeight: "18px", letterSpacing: "-0.01em", fontWeight: "500" }],
        "label-sm": ["11px", { lineHeight: "16px", letterSpacing: "0.02em", fontWeight: "500" }],
        "body-lg": ["17px", { lineHeight: "28px", letterSpacing: "-0.005em", fontWeight: "400" }],
        "body-md": ["15px", { lineHeight: "24px", letterSpacing: "0em", fontWeight: "400" }],
        "body-sm": ["13px", { lineHeight: "20px", letterSpacing: "0em", fontWeight: "400" }],
        "headline-xl": ["36px", { lineHeight: "44px", letterSpacing: "-0.025em", fontWeight: "600" }],
        "headline-lg": ["28px", { lineHeight: "36px", letterSpacing: "-0.02em", fontWeight: "600" }],
        "headline-md": ["20px", { lineHeight: "28px", letterSpacing: "-0.015em", fontWeight: "500" }],
        "headline-sm": ["16px", { lineHeight: "24px", letterSpacing: "-0.01em", fontWeight: "600" }],
      },
    },
  },
  plugins: [
    plugin(({ addBase }) =>
      addBase({
        ":root": { ...vars(light), colorScheme: "light" },
        ".dark": { ...vars(dark), colorScheme: "dark" },
      }),
    ),
  ],
};

export default config;

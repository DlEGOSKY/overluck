import Phaser from "phaser";

export const palette = {
  bgDeep: 0x06060c,
  bg: 0x0a0a12,
  surface: 0x14141e,
  surfaceElevated: 0x1b1b28,
  surfaceHover: 0x20202f,
  hairline: 0x2a2a3b,
  divider: 0x3a3a50,

  text: 0xe8e8f0,
  textMuted: 0x9aa0b4,
  textDim: 0x5e6378,
  textInverted: 0x0a0a12,

  primary: 0xffd166,
  primaryDeep: 0xd79a3c,
  accent: 0x6fd3ff,
  accentDeep: 0x2f8fb8,
  danger: 0xff5c6c,
  dangerDeep: 0xb33a48,
  success: 0x6fff9c,
  warn: 0xffa94d,
  violet: 0xa97bff,

  felt: 0x162218,
  feltRim: 0x2a3d2f,
  gold: 0xd4a942,
  goldDeep: 0x9b7a2c,

  chipRed: 0xd13a4a,
  chipBlack: 0x1a1a22,
} as const;

export const hex = {
  text: "#e8e8f0",
  textMuted: "#9aa0b4",
  textDim: "#5e6378",
  textInverted: "#0a0a12",
  primary: "#ffd166",
  primaryDeep: "#d79a3c",
  accent: "#6fd3ff",
  danger: "#ff5c6c",
  success: "#6fff9c",
  warn: "#ffa94d",
  violet: "#a97bff",
  gold: "#d4a942",
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  huge: 64,
} as const;

export type FontWeight = "regular" | "medium" | "bold";

interface TypeStyle {
  fontSize: string;
  color: string;
  fontStyle?: string;
  letterSpacing?: number;
}

export const type = {
  display: {
    fontSize: "44px",
    color: hex.primary,
    fontStyle: "bold",
    letterSpacing: 4,
  },
  h1: {
    fontSize: "30px",
    color: hex.text,
    fontStyle: "bold",
    letterSpacing: 1,
  },
  h2: {
    fontSize: "22px",
    color: hex.text,
    fontStyle: "bold",
    letterSpacing: 0.5,
  },
  h3: {
    fontSize: "18px",
    color: hex.text,
    fontStyle: "bold",
  },
  bodyLg: {
    fontSize: "16px",
    color: hex.text,
  },
  body: {
    fontSize: "14px",
    color: hex.text,
  },
  bodyMuted: {
    fontSize: "14px",
    color: hex.textMuted,
  },
  caption: {
    fontSize: "12px",
    color: hex.textMuted,
  },
  overline: {
    fontSize: "11px",
    color: hex.textDim,
    fontStyle: "bold",
    letterSpacing: 3,
  },
  metric: {
    fontSize: "18px",
    color: hex.text,
    fontStyle: "bold",
  },
  metricLg: {
    fontSize: "24px",
    color: hex.text,
    fontStyle: "bold",
  },
} satisfies Record<string, TypeStyle>;

export function textStyle(
  style: TypeStyle,
  overrides?: Partial<Phaser.Types.GameObjects.Text.TextStyle>,
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily:
      '"Inter", "SF Pro Text", "Segoe UI", system-ui, -apple-system, sans-serif',
    fontSize: style.fontSize,
    color: style.color,
    fontStyle: style.fontStyle,
    ...(overrides ?? {}),
  };
}

export const ease = {
  out: "Sine.Out",
  inOut: "Sine.InOut",
  snap: "Back.Out",
  snapIn: "Back.In",
  smooth: "Quad.InOut",
  bounce: "Bounce.Out",
} as const;

// Camera effects (zoom/fade/pan/rotate) resolve strings via EaseMap which only
// knows long-form keys ("Sine.easeInOut"). To avoid that footgun pass these
// functions directly to camera effect calls.
export const cameraEase = {
  out: Phaser.Math.Easing.Sine.Out,
  inOut: Phaser.Math.Easing.Sine.InOut,
  snap: Phaser.Math.Easing.Back.Out,
  smooth: Phaser.Math.Easing.Quadratic.InOut,
} as const;

export const dur = {
  quick: 120,
  fast: 200,
  base: 320,
  slow: 520,
  slower: 820,
} as const;

export function colorToHex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

export function applyLetterSpacing(
  text: Phaser.GameObjects.Text,
  style: TypeStyle,
): void {
  if (style.letterSpacing != null) {
    text.setLetterSpacing(style.letterSpacing);
  }
}

export function drawSurface(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  options: {
    fill?: number;
    fillAlpha?: number;
    stroke?: number;
    strokeAlpha?: number;
    radius?: number;
  } = {},
): void {
  const radius = options.radius ?? 10;
  graphics.fillStyle(options.fill ?? palette.surface, options.fillAlpha ?? 1);
  graphics.fillRoundedRect(x, y, width, height, radius);
  if (options.stroke != null) {
    graphics.lineStyle(1, options.stroke, options.strokeAlpha ?? 0.85);
    graphics.strokeRoundedRect(x, y, width, height, radius);
  }
}

export function drawDivider(
  scene: Phaser.Scene,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color = palette.divider,
  alpha = 0.5,
): Phaser.GameObjects.Line {
  const line = scene.add.line(0, 0, x1, y1, x2, y2, color, alpha);
  line.setOrigin(0, 0);
  return line;
}

export interface IconOptions {
  size?: number;
  color: number;
  strokeColor?: number;
}

export function drawChipIcon(
  scene: Phaser.Scene,
  x: number,
  y: number,
  opts: IconOptions = { color: palette.primary },
): Phaser.GameObjects.Container {
  const size = opts.size ?? 14;
  const container = scene.add.container(x, y);

  const ring = scene.add.circle(0, 0, size, opts.color, 1);
  ring.setStrokeStyle(2, opts.strokeColor ?? palette.bgDeep, 1);

  const inner = scene.add.circle(0, 0, size * 0.6, palette.bgDeep, 1);
  const mark = scene.add.circle(0, 0, size * 0.22, opts.color, 1);

  for (let i = 0; i < 8; i += 1) {
    const angle = (Math.PI / 4) * i;
    const r1 = size - 2;
    const r2 = size + 2;
    const tick = scene.add.line(
      0,
      0,
      Math.cos(angle) * r1,
      Math.sin(angle) * r1,
      Math.cos(angle) * r2,
      Math.sin(angle) * r2,
      palette.bgDeep,
      0.8,
    );
    tick.setLineWidth(2);
    container.add(tick);
  }

  container.add([ring, inner, mark]);
  return container;
}

export function drawHeartIcon(
  scene: Phaser.Scene,
  x: number,
  y: number,
  opts: IconOptions = { color: palette.danger },
): Phaser.GameObjects.Graphics {
  const size = opts.size ?? 10;
  const g = scene.add.graphics();
  g.setPosition(x, y);
  g.fillStyle(opts.color, 1);

  const top = -size * 0.2;
  g.beginPath();
  g.arc(-size * 0.45, top, size * 0.45, Math.PI, 0, false);
  g.arc(size * 0.45, top, size * 0.45, Math.PI, 0, false);
  g.lineTo(0, size);
  g.lineTo(-size * 0.9, top);
  g.closePath();
  g.fillPath();

  return g;
}

export function drawTowerIcon(
  scene: Phaser.Scene,
  x: number,
  y: number,
  opts: IconOptions = { color: palette.accent },
): Phaser.GameObjects.Container {
  const size = opts.size ?? 12;
  const container = scene.add.container(x, y);
  const base = scene.add.circle(0, 0, size, palette.surfaceElevated, 1);
  base.setStrokeStyle(2, opts.color, 1);
  const barrel = scene.add.rectangle(size, 0, size + 2, size * 0.35, opts.color);
  barrel.setOrigin(0, 0.5);
  const led = scene.add.circle(0, 0, size * 0.2, palette.text, 1);
  container.add([base, barrel, led]);
  return container;
}

export function drawWaveIcon(
  scene: Phaser.Scene,
  x: number,
  y: number,
  opts: IconOptions = { color: palette.accent },
): Phaser.GameObjects.Graphics {
  const size = opts.size ?? 12;
  const g = scene.add.graphics();
  g.setPosition(x, y);
  g.lineStyle(2, opts.color, 1);
  g.beginPath();
  g.moveTo(-size, 0);
  g.lineTo(-size * 0.5, -size * 0.55);
  g.lineTo(0, 0);
  g.lineTo(size * 0.5, -size * 0.55);
  g.lineTo(size, 0);
  g.strokePath();
  return g;
}

export function drawEnemyIcon(
  scene: Phaser.Scene,
  x: number,
  y: number,
  opts: IconOptions = { color: palette.danger },
): Phaser.GameObjects.Graphics {
  const size = opts.size ?? 10;
  const g = scene.add.graphics();
  g.setPosition(x, y);
  g.fillStyle(opts.color, 1);
  g.lineStyle(1.5, palette.bgDeep, 1);

  g.beginPath();
  g.moveTo(-size, size * 0.7);
  g.lineTo(-size, -size * 0.3);
  g.lineTo(-size * 0.6, -size * 0.7);
  g.lineTo(size * 0.6, -size * 0.7);
  g.lineTo(size, -size * 0.3);
  g.lineTo(size, size * 0.7);
  g.lineTo(size * 0.6, size * 0.4);
  g.lineTo(-size * 0.6, size * 0.4);
  g.closePath();
  g.fillPath();
  g.strokePath();
  return g;
}

export function drawRelicIcon(
  scene: Phaser.Scene,
  x: number,
  y: number,
  relicId: string,
  color: number,
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y);
  const size = 9;

  if (relicId === "loaded_chip" || relicId === "greased_dice") {
    // Stacked chip (two ovals offset)
    const back = scene.add.circle(-1, 1, size * 0.9, palette.bgDeep, 1);
    back.setStrokeStyle(1, color, 0.6);
    const front = scene.add.circle(1, -1, size * 0.9, color, 1);
    front.setStrokeStyle(1, palette.bgDeep, 1);
    const dot = scene.add.circle(1, -1, size * 0.25, palette.bgDeep, 1);
    container.add([back, front, dot]);
  } else if (relicId === "hot_hand") {
    // Flame icon: stacked arcs
    const g = scene.add.graphics();
    g.fillStyle(color, 1);
    g.beginPath();
    g.moveTo(0, size);
    g.lineTo(-size * 0.7, size * 0.3);
    g.lineTo(-size * 0.35, 0);
    g.lineTo(-size * 0.6, -size * 0.5);
    g.lineTo(0, -size);
    g.lineTo(size * 0.5, -size * 0.4);
    g.lineTo(size * 0.3, 0);
    g.lineTo(size * 0.7, size * 0.3);
    g.closePath();
    g.fillPath();
    g.lineStyle(1, palette.bgDeep, 0.8);
    g.strokePath();
    const core = scene.add.circle(0, size * 0.15, size * 0.3, palette.primary, 0.9);
    container.add([g, core]);
  } else if (relicId === "steady_hand") {
    // Crosshair
    const g = scene.add.graphics();
    g.lineStyle(1.5, color, 1);
    g.strokeCircle(0, 0, size);
    g.lineStyle(1, color, 0.9);
    g.beginPath();
    g.moveTo(-size - 2, 0);
    g.lineTo(-size * 0.4, 0);
    g.moveTo(size * 0.4, 0);
    g.lineTo(size + 2, 0);
    g.moveTo(0, -size - 2);
    g.lineTo(0, -size * 0.4);
    g.moveTo(0, size * 0.4);
    g.lineTo(0, size + 2);
    g.strokePath();
    const center = scene.add.circle(0, 0, 1.5, color, 1);
    container.add([g, center]);
  } else if (relicId === "sparkplug") {
    // Lightning bolt
    const g = scene.add.graphics();
    g.fillStyle(color, 1);
    g.beginPath();
    g.moveTo(-size * 0.2, -size);
    g.lineTo(size * 0.6, -size * 0.2);
    g.lineTo(size * 0.1, -size * 0.2);
    g.lineTo(size * 0.5, size);
    g.lineTo(-size * 0.6, size * 0.1);
    g.lineTo(-size * 0.1, size * 0.1);
    g.closePath();
    g.fillPath();
    g.lineStyle(1, palette.bgDeep, 0.8);
    g.strokePath();
    container.add(g);
  } else {
    // Fallback: colored ring with dot
    const ring = scene.add.circle(0, 0, size, color, 0.2);
    ring.setStrokeStyle(1.5, color, 1);
    const dot = scene.add.circle(0, 0, 2.5, color, 1);
    container.add([ring, dot]);
  }

  return container;
}

export function drawOrnament(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width = 80,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.lineStyle(1, palette.goldDeep, 0.9);
  g.beginPath();
  g.moveTo(x - width / 2, y);
  g.lineTo(x - 6, y);
  g.moveTo(x + 6, y);
  g.lineTo(x + width / 2, y);
  g.strokePath();

  g.fillStyle(palette.gold, 1);
  g.fillCircle(x - 3, y, 2);
  g.fillCircle(x + 3, y, 2);
  g.fillCircle(x, y, 1.5);

  return g;
}

/** Shared palette. Every colour the mascot and its effects use is defined here once. */
import { Color } from "three";

export const PALETTE = {
  furLight: new Color("#ecd8bd"),
  furMid: new Color("#dfc4a2"),
  furShade: new Color("#caa87f"),
  innerEar: new Color("#e79aa8"),
  cheek: new Color("#e08496"),
  nose: new Color("#d9788c"),
  eye: new Color("#2b2440"),
  eyeShine: new Color("#ffffff"),
  collar: new Color("#7fe3c4"),
  bell: new Color("#ffd98e"),
  sparkA: new Color("#7fe3c4"),
  sparkB: new Color("#ffd98e"),
  sparkC: new Color("#e79aa8"),
  ground: new Color("#1e2b45"),
  bg: new Color("#0d1320"),
} as const;

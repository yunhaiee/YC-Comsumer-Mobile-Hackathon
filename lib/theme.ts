import { Platform, StyleSheet } from "react-native";

export const colors = {
  background: "#111111",
  surface: "#1C1C1E",
  surfaceRaised: "#242426",
  surfaceHigh: "#2C2C2E",
  border: "#2E2E31",
  hairline: "rgba(255,255,255,0.09)",
  text: "#FFFFFF",
  muted: "#8E8E93",
  faint: "#5A5A5F",
  accent: "#7104E6",
  accentStrong: "#7104E6",
  accentSoft: "rgba(113,4,230,0.2)",
  accentText: "#A56BFF",
  positive: "#34C759",
  positiveSoft: "rgba(52,199,89,0.14)",
  negative: "#FF6B6B",
  negativeSoft: "rgba(255,107,107,0.14)",
  warning: "#FFB547",
} as const;

export const radius = { sm: 12, md: 16, lg: 20, pill: 999 } as const;

export const space = { screen: 20 } as const;

export const hairline = StyleSheet.hairlineWidth;

export const font = {
  largeTitle: { fontSize: 34, fontWeight: "700", letterSpacing: Platform.OS === "ios" ? 0.37 : -0.5 },
  title: { fontSize: 22, fontWeight: "700", letterSpacing: -0.3 },
  headline: { fontSize: 17, fontWeight: "600", letterSpacing: -0.4 },
  body: { fontSize: 17, fontWeight: "400", letterSpacing: -0.4 },
  callout: { fontSize: 15, fontWeight: "400", letterSpacing: -0.2 },
  footnote: { fontSize: 13, fontWeight: "400", letterSpacing: -0.1 },
} as const;

export const TAB_BAR_CLEARANCE = 112;

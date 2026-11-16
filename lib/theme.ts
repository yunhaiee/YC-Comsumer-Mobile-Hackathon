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

const inter = {
  400: "Inter_400Regular",
  500: "Inter_500Medium",
  600: "Inter_600SemiBold",
  700: "Inter_700Bold",
  800: "Inter_800ExtraBold",
} as const;

export const dare = {
  colors: {
    bg: "#111111",
    surface: "#1B1B1B",
    surfaceBorder: "#262626",
    sheet: "#1A1A1A",
    sheetBorder: "#2A2A2A",
    control: "#222222",
    controlRaised: "#232323",
    controlBorder: "#2E2E2E",
    controlBorderStrong: "#333333",
    divider: "#222222",
    sheetDivider: "#2A2A2A",
    badge: "#2A2A2A",
    grabber: "#3A3A3A",
    closeButton: "#262626",
    placeholder: "#2A2A2A",
    text: "#FFFFFF",
    textMuted: "#A0A0A0",
    textSubtle: "#8C8C8C",
    textOption: "#B5B5B5",
    accent: "#7104E6",
    accentGlow: "rgba(113,4,230,0.6)",
    yes: "#3DDC84",
    yesTint: "rgba(61,220,132,0.12)",
    no: "#FF6B81",
    noTint: "rgba(255,107,129,0.12)",
    urgent: "#D93A4E",
    verified: "#3B82F6",
    scrimPill: "rgba(0,0,0,0.72)",
    dim: "rgba(0,0,0,0.55)",
  },
  radius: { card: 20, hero: 20, stat: 16, button: 16, option: 18, field: 14, sheet: 28, pill: 999 },
  space: { screen: 16, cardGap: 12, tap: 44 },
  font: inter,
  type: {
    listTitle: { fontFamily: inter[800], fontSize: 32, letterSpacing: -0.8 },
    detailTitle: { fontFamily: inter[800], fontSize: 26, lineHeight: 31, letterSpacing: -0.6 },
    sheetTitle: { fontFamily: inter[800], fontSize: 21, letterSpacing: -0.4 },
    cardTitle: { fontFamily: inter[800], fontSize: 21, lineHeight: 25, letterSpacing: -0.4 },
    cardReward: { fontFamily: inter[800], fontSize: 30, lineHeight: 34, letterSpacing: -0.7 },
    stat: { fontFamily: inter[800], fontSize: 24 },
    button: { fontFamily: inter[700], fontSize: 17 },
    buttonSub: { fontFamily: inter[600], fontSize: 12 },
    body: { fontFamily: inter[400], fontSize: 15 },
    label: { fontFamily: inter[400], fontSize: 13 },
    labelMedium: { fontFamily: inter[500], fontSize: 14 },
    disclaimer: { fontFamily: inter[400], fontSize: 12 },
  },
} as const;

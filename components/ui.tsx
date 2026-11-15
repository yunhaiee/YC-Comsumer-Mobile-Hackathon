import type { PropsWithChildren, ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, radius } from "@/lib/theme";

type Tone = "accent" | "positive" | "warning" | "muted" | "negative";

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "yes" | "no";
  selected?: boolean;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, onPress, variant = "primary", selected, disabled, loading, style }: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading, selected }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        selected && styles.selected,
        inactive && styles.inactive,
        pressed && !inactive && styles.pressed,
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={colors.text} /> : <Text style={styles.buttonLabel}>{label}</Text>}
    </Pressable>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Pill({ label, tone = "muted" }: { label: string; tone?: Tone }) {
  const color = colors[tone];
  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

export function Row({ label, value, tone }: { label: string; value: string; tone?: Tone }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, tone && { color: colors[tone] }]}>{value}</Text>
    </View>
  );
}

export function CenterMessage({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={styles.center}>
      <Text style={styles.centerTitle}>{title}</Text>
      {body ? <Text style={styles.centerBody}>{body}</Text> : null}
      {action}
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.accent} size="large" />
    </View>
  );
}

export function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Text accessibilityRole="alert" style={styles.error}>
      {message}
    </Text>
  );
}

export const text = StyleSheet.create({
  body: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  small: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  strong: { color: colors.text, fontSize: 15, fontWeight: "700" },
});

const styles = StyleSheet.create({
  button: { minHeight: 52, paddingHorizontal: 18, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border },
  yes: { backgroundColor: "#173F2E", borderWidth: 2, borderColor: "#1F6F4A" },
  no: { backgroundColor: "#3F1820", borderWidth: 2, borderColor: "#8A2D3B" },
  selected: { borderColor: colors.text },
  inactive: { opacity: 0.45 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  buttonLabel: { color: colors.text, fontSize: 16, fontWeight: "800", letterSpacing: 0.3, textAlign: "center" },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: 18, gap: 12 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" },
  pillText: { fontSize: 12, fontWeight: "700", letterSpacing: 0.4 },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  rowLabel: { color: colors.muted, fontSize: 14, flexShrink: 1 },
  rowValue: { color: colors.text, fontSize: 14, fontWeight: "700", textAlign: "right" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 14 },
  centerTitle: { color: colors.text, fontSize: 20, fontWeight: "800", textAlign: "center" },
  centerBody: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: "center" },
  error: { color: colors.negative, fontSize: 14, lineHeight: 20 },
});

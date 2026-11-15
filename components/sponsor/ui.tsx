import { Ionicons } from "@expo/vector-icons";
import { ConvexError } from "convex/values";
import { router } from "expo-router";
import { Component, type PropsWithChildren, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/lib/theme";

export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);

export const errorText = (error: unknown) =>
  error instanceof ConvexError && typeof error.data === "string" ? error.data : "Something went wrong. Please try again.";

export const newRequestId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

export const when = (timestamp: number) =>
  new Date(timestamp).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function SponsorScreen({ children, title, back = "/sponsor" }: PropsWithChildren<{ title: string; back?: "/sponsor" | "/" }>) {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.navigation}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={12} onPress={() => router.replace(back)} style={styles.back}>
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </Pressable>
          <Text style={styles.wordmark}>DARE<Text style={{ color: colors.accent }}>.</Text></Text>
          <Text style={styles.studio}>SPONSOR STUDIO</Text>
        </View>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        {children}
        <Text style={styles.footer}>Sandbox sponsorship. Represented rewards only. No money is transferred to participants. Predictions use free play credits.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

export function Button({ children, onPress, disabled, busy, secondary = false }: PropsWithChildren<{ onPress: () => void; disabled?: boolean; busy?: boolean; secondary?: boolean }>) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondaryButton, (disabled || busy) && styles.disabled, pressed && styles.pressed]}>
      {busy ? <ActivityIndicator color={colors.text} /> : null}
      <Text style={styles.buttonText}>{children}</Text>
    </Pressable>
  );
}

export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

export function Field({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} selectionColor={colors.accent} {...props} style={[styles.input, props.multiline && styles.multiline, props.style]} />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Notice({ children, error = false }: PropsWithChildren<{ error?: boolean }>) {
  return <View accessibilityRole={error ? "alert" : undefined} style={[styles.notice, error && styles.errorNotice]}><Text style={styles.body}>{children}</Text></View>;
}

export function Loading({ children = "Loading your studio…" }: { children?: ReactNode }) {
  return <View style={styles.loading}><ActivityIndicator color={colors.accent} /><Text style={styles.body}>{children}</Text></View>;
}

export function Status({ state }: { state: string }) {
  const labels: Record<string, string> = { draft: "DRAFT", awaiting_payment: "AWAITING PAYMENT", prediction_open: "PREDICTIONS OPEN", attempts_open: "ATTEMPTS OPEN", review_pending: "REVIEW EVIDENCE", resolved: "RESOLVED", void: "VOID · CREDITS REFUNDED" };
  return <View style={styles.badge}><View style={styles.dot} /><Text style={styles.badgeText}>{labels[state] ?? state.replaceAll("_", " ").toUpperCase()}</Text></View>;
}

export class SponsorErrorBoundary extends Component<PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <SponsorScreen title="Studio unavailable"><Notice error>We couldn’t load this page. Check your connection and sign in with an authorized sponsor account.</Notice><Button onPress={() => this.setState({ failed: false })}>Try again</Button><Button secondary onPress={() => router.replace("/")}>Back to discover</Button></SponsorScreen>;
    return this.props.children;
  }
}

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  page: { padding: 22, paddingBottom: 48, gap: 20, width: "100%", maxWidth: 760, alignSelf: "center" },
  navigation: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  back: { paddingVertical: 10, paddingRight: 4 },
  wordmark: { fontSize: 24, fontWeight: "900", letterSpacing: -1.2, color: colors.text },
  studio: { fontSize: 10, fontWeight: "800", color: colors.muted, letterSpacing: 1.5, marginLeft: "auto" },
  title: { fontSize: 36, lineHeight: 41, fontWeight: "800", letterSpacing: -1.5, color: colors.text },
  heading: { fontSize: 21, fontWeight: "700", letterSpacing: -0.5, color: colors.text },
  eyebrow: { fontSize: 11, fontWeight: "800", color: colors.accent, letterSpacing: 1.7 },
  body: { fontSize: 14, lineHeight: 22, color: colors.muted },
  strong: { color: colors.text, fontWeight: "700" },
  card: { backgroundColor: colors.surface, borderRadius: 22, borderWidth: 1, borderColor: colors.border, padding: 20, gap: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  button: { minHeight: 52, backgroundColor: colors.accent, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 14, justifyContent: "center", alignItems: "center", flexDirection: "row", gap: 10 },
  secondaryButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  buttonText: { fontSize: 14, fontWeight: "700", color: colors.text, textAlign: "center" },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
  field: { gap: 8 },
  label: { fontSize: 13, fontWeight: "600", color: colors.text },
  input: { minHeight: 52, backgroundColor: colors.background, color: colors.text, padding: 14, borderColor: colors.border, borderWidth: 1, borderRadius: 12, fontSize: 16 },
  multiline: { minHeight: 96, textAlignVertical: "top" },
  hint: { fontSize: 12, lineHeight: 18, color: colors.muted },
  notice: { backgroundColor: "#201831", borderColor: colors.border, borderWidth: 1, padding: 16, borderRadius: 16 },
  errorNotice: { borderColor: "#AF5A76" },
  loading: { paddingVertical: 40, gap: 14, alignItems: "center" },
  footer: { fontSize: 11, lineHeight: 17, color: colors.muted, textAlign: "center", paddingTop: 12 },
  badge: { alignSelf: "flex-start", backgroundColor: "#261D38", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 30, flexDirection: "row", gap: 7, alignItems: "center" },
  dot: { height: 5, width: 5, borderRadius: 3, backgroundColor: colors.accent },
  badgeText: { color: "#D1B9FF", fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  amount: { fontSize: 36, color: colors.text, fontWeight: "800", letterSpacing: -1.2 },
  divider: { height: 1, backgroundColor: colors.border },
});

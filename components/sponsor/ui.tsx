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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TAB_BAR_CLEARANCE, colors, hairline } from "@/lib/theme";

export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);

export const errorText = (error: unknown) =>
  error instanceof ConvexError && typeof error.data === "string" ? error.data : "Something went wrong. Please try again.";

export const newRequestId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

export const when = (timestamp: number) =>
  new Date(timestamp).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function SponsorScreen({ children, title, back = "/sponsor" }: PropsWithChildren<{ title: string; back?: "/sponsor" | "/" }>) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.safe}>
      <ScrollView
        contentContainerStyle={[styles.page, { paddingTop: insets.top + 8, paddingBottom: TAB_BAR_CLEARANCE + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.navigation}>
          {back === "/" ? null : (
            <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8} onPress={() => router.replace(back)} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </Pressable>
          )}
          <Text accessibilityRole="header" style={styles.title} numberOfLines={2}>{title}</Text>
        </View>
        {children}
        <Text style={styles.footer}>Sandbox sponsorship. Rewards recorded, not paid. Predictions use play credits.</Text>
      </ScrollView>
    </View>
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
  return <View style={styles.badge}><View style={[styles.dot, (state === "prediction_open" || state === "attempts_open") && { backgroundColor: colors.positive }]} /><Text style={styles.badgeText}>{labels[state] ?? state.replaceAll("_", " ").toUpperCase()}</Text></View>;
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
  page: { paddingHorizontal: 20, gap: 16, width: "100%", maxWidth: 760, alignSelf: "center" },
  navigation: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, marginBottom: 4 },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceHigh, borderWidth: hairline, borderColor: colors.hairline, alignItems: "center", justifyContent: "center" },
  wordmark: { fontSize: 24, fontWeight: "800", letterSpacing: -1, color: colors.text },
  studio: { fontSize: 13, color: colors.muted },
  title: { flex: 1, fontSize: 34, fontWeight: "700", letterSpacing: 0.37, color: colors.text },
  heading: { fontSize: 22, fontWeight: "700", letterSpacing: -0.3, color: colors.text },
  eyebrow: { fontSize: 13, fontWeight: "500", color: colors.muted },
  body: { fontSize: 15, lineHeight: 21, color: colors.muted, letterSpacing: -0.2 },
  strong: { color: colors.text, fontWeight: "600" },
  card: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: hairline, borderColor: colors.hairline, padding: 16, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  button: { minHeight: 54, backgroundColor: colors.accent, borderRadius: 16, paddingHorizontal: 20, justifyContent: "center", alignItems: "center", flexDirection: "row", gap: 10 },
  secondaryButton: { backgroundColor: colors.surfaceRaised },
  buttonText: { fontSize: 17, fontWeight: "600", letterSpacing: -0.4, color: colors.text, textAlign: "center" },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.75 },
  field: { gap: 8 },
  label: { fontSize: 13, fontWeight: "500", color: colors.muted },
  input: { minHeight: 54, backgroundColor: colors.background, color: colors.text, paddingHorizontal: 16, paddingVertical: 14, borderColor: colors.border, borderWidth: 1, borderRadius: 16, fontSize: 17 },
  multiline: { minHeight: 96, textAlignVertical: "top" },
  hint: { fontSize: 13, lineHeight: 18, color: colors.muted },
  notice: { backgroundColor: colors.surface, borderColor: colors.hairline, borderWidth: hairline, padding: 16, borderRadius: 16 },
  errorNotice: { borderColor: colors.negative, borderWidth: 1 },
  loading: { paddingVertical: 40, gap: 14, alignItems: "center" },
  footer: { fontSize: 12, lineHeight: 17, color: colors.faint, textAlign: "center", paddingTop: 8 },
  badge: { alignSelf: "flex-start", backgroundColor: colors.surfaceRaised, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, flexDirection: "row", gap: 6, alignItems: "center" },
  dot: { height: 6, width: 6, borderRadius: 3, backgroundColor: colors.accent },
  badgeText: { color: colors.text, fontSize: 12, fontWeight: "600", letterSpacing: 0.2 },
  amount: { fontSize: 28, color: colors.text, fontWeight: "700", letterSpacing: -0.6 },
  divider: { height: hairline, backgroundColor: colors.hairline },
});

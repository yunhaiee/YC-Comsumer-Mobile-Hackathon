import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState, type PropsWithChildren } from "react";
import { ActivityIndicator, Animated, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RulesList, StatCard } from "@/components/dare";
import { useCountdown } from "@/hooks/useCountdown";
import { formatUsd } from "@/lib/format";
import { dare } from "@/lib/theme";

const c = dare.colors;
const f = dare.font;

export type Side = "YES" | "NO";

const MAX_STAKE_DOLLARS = 10_000;

function Sheet({ visible, onClose, title, children }: PropsWithChildren<{ visible: boolean; onClose: () => void; title: string }>) {
  const insets = useSafeAreaInsets();
  const [offset] = useState(() => new Animated.Value(600));

  useEffect(() => {
    if (!visible) {
      offset.setValue(600);
      return;
    }
    Animated.spring(offset, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220, mass: 0.9 }).start();
  }, [visible, offset]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.root}>
        <Pressable style={styles.dim} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close sheet" />
        <Animated.View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16), transform: [{ translateY: offset }] }]}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={4} onPress={onClose} style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
              <Ionicons name="close" size={20} color={c.text} />
            </Pressable>
          </View>
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function PrimaryButton({ label, onPress, disabled, loading }: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [styles.primary, (disabled || loading) && styles.disabled, pressed && styles.pressed]}
    >
      {loading ? <ActivityIndicator color={c.text} /> : <Text style={styles.primaryLabel}>{label}</Text>}
    </Pressable>
  );
}

function ErrorLine({ message }: { message: string | null }) {
  return message ? <Text style={styles.error}>{message}</Text> : null;
}

export function BetSheet({
  visible,
  onClose,
  closesAt,
  yesPercent,
  side,
  onSideChange,
  lockedSide,
  presets,
  stake,
  onStakeChange,
  payoutCents,
  onConfirm,
  pending,
  disabled,
  error,
}: {
  visible: boolean;
  onClose: () => void;
  closesAt: number;
  yesPercent: number | null;
  side: Side;
  onSideChange: (side: Side) => void;
  lockedSide: Side | null;
  presets: number[];
  stake: number | null;
  onStakeChange: (dollars: number | null) => void;
  payoutCents: number | undefined;
  onConfirm: () => void;
  pending: boolean;
  disabled: boolean;
  error: string | null;
}) {
  const [custom, setCustom] = useState("");
  const countdown = useCountdown(closesAt);
  const tooLarge = stake !== null && stake > MAX_STAKE_DOLLARS;
  const options = [
    { side: "YES" as const, label: "Yes", color: c.yes, tint: c.yesTint, pct: yesPercent },
    { side: "NO" as const, label: "No", color: c.no, tint: c.noTint, pct: yesPercent === null ? null : 100 - yesPercent },
  ];

  return (
    <Sheet visible={visible} onClose={onClose} title="Will someone pull it off?">
      <Text style={styles.subtitle}>Closes in {countdown.label}</Text>

      <View style={styles.optionRow}>
        {options.map((option) => {
          const selected = side === option.side;
          const locked = lockedSide !== null && lockedSide !== option.side;
          return (
            <Pressable
              key={option.side}
              accessibilityRole="button"
              accessibilityLabel={`${option.label}${option.pct === null ? "" : `, ${option.pct}% picked`}`}
              accessibilityState={{ selected, disabled: locked }}
              disabled={locked}
              onPress={() => onSideChange(option.side)}
              style={[styles.option, selected && { backgroundColor: option.tint, borderColor: option.color }, locked && styles.disabled]}
            >
              <Text style={[styles.optionLabel, { color: option.color }]}>{option.label}</Text>
              <Text style={styles.optionSub}>{option.pct === null ? "No picks yet" : `${option.pct}% picked`}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.chips}>
        {presets.map((preset) => {
          const selected = custom === "" && stake === preset;
          return (
            <Pressable
              key={preset}
              accessibilityRole="button"
              accessibilityLabel={`$${preset}`}
              accessibilityState={{ selected }}
              onPress={() => {
                setCustom("");
                onStakeChange(preset);
              }}
              style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
            >
              <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>${preset}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.custom}>
        <Text style={styles.customLabel}>Custom</Text>
        <Text style={styles.customDollar}>$</Text>
        <TextInput
          value={custom}
          onChangeText={(value) => {
            const digits = value.replace(/[^0-9]/g, "").slice(0, 6);
            setCustom(digits);
            onStakeChange(digits ? Number(digits) : null);
          }}
          placeholder="0"
          placeholderTextColor={c.textSubtle}
          keyboardType="number-pad"
          returnKeyType="done"
          selectionColor={c.accent}
          accessibilityLabel="Custom amount in dollars"
          style={styles.customInput}
        />
      </View>

      <View style={styles.payout}>
        <Text style={styles.payoutLabel}>You get back if right</Text>
        <Text style={styles.payoutValue}>{stake && payoutCents !== undefined ? formatUsd(payoutCents) : stake ? "…" : "$0"}</Text>
      </View>

      <ErrorLine message={tooLarge ? `Max bet is ${formatUsd(MAX_STAKE_DOLLARS * 100)}.` : error} />
      <PrimaryButton
        label={stake ? `Bet $${stake.toLocaleString("en-US")} on ${side === "YES" ? "Yes" : "No"}` : "Pick an amount"}
        onPress={onConfirm}
        disabled={disabled || !stake || tooLarge || countdown.done}
        loading={pending}
      />
    </Sheet>
  );
}

export function TakeDareSheet({
  visible,
  onClose,
  rewardCents,
  spotsLeft,
  spotsTotal,
  rules,
  uploadDeadlineAt,
  onClaim,
  pending,
  disabled,
  error,
}: {
  visible: boolean;
  onClose: () => void;
  rewardCents: number;
  spotsLeft: number;
  spotsTotal: number;
  rules: string[];
  uploadDeadlineAt: number;
  onClaim: () => void;
  pending: boolean;
  disabled: boolean;
  error: string | null;
}) {
  const countdown = useCountdown(uploadDeadlineAt);
  return (
    <Sheet visible={visible} onClose={onClose} title="Take the dare">
      <View style={styles.stats}>
        <StatCard label="You earn" value={formatUsd(rewardCents)} tone="sheet" />
        <StatCard label="Spots left" value={String(spotsLeft)} total={spotsTotal} tone="sheet" />
      </View>
      <View style={styles.rules}>
        <RulesList rules={rules} />
      </View>
      <View style={styles.deadline}>
        <Ionicons name="time-outline" size={17} color={c.textMuted} />
        <Text style={styles.deadlineText}>Upload within {countdown.label}</Text>
      </View>
      <ErrorLine message={error} />
      <PrimaryButton label="Claim my spot" onPress={onClaim} disabled={disabled || spotsLeft <= 0} loading={pending} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  dim: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: c.dim },
  sheet: {
    backgroundColor: c.sheet,
    borderTopLeftRadius: dare.radius.sheet,
    borderTopRightRadius: dare.radius.sheet,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: c.sheetBorder,
    paddingTop: 10,
    paddingHorizontal: dare.space.screen,
  },
  grabber: { width: 40, height: 5, borderRadius: 3, backgroundColor: c.grabber, alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18, gap: 12 },
  title: { flex: 1, color: c.text, ...dare.type.sheetTitle },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.closeButton, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.4 },
  subtitle: { color: c.textMuted, fontFamily: f[400], fontSize: 14, marginTop: 4, fontVariant: ["tabular-nums"] },
  optionRow: { flexDirection: "row", gap: 10, marginTop: 18 },
  option: {
    flex: 1,
    height: 88,
    borderRadius: dare.radius.option,
    borderWidth: 2,
    borderColor: c.controlBorder,
    backgroundColor: c.control,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  optionLabel: { fontFamily: f[800], fontSize: 20 },
  optionSub: { color: c.textOption, fontFamily: f[400], fontSize: 14, marginTop: 4 },
  chips: { flexDirection: "row", gap: 8, marginTop: 18 },
  chip: {
    flex: 1,
    height: 44,
    borderRadius: dare.radius.pill,
    backgroundColor: c.control,
    borderWidth: 1,
    borderColor: c.controlBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  chipSelected: { backgroundColor: c.text, borderColor: c.text },
  chipLabel: { color: c.text, fontFamily: f[600], fontSize: 15 },
  chipLabelSelected: { color: c.bg, fontFamily: f[700] },
  custom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    height: 48,
    paddingHorizontal: 16,
    borderRadius: dare.radius.field,
    backgroundColor: c.control,
    borderWidth: 1,
    borderColor: c.controlBorder,
  },
  customLabel: { color: c.textMuted, fontFamily: f[400], fontSize: 15 },
  customDollar: { marginLeft: "auto", color: c.text, fontFamily: f[700], fontSize: 17 },
  customInput: { width: 90, height: 46, color: c.text, fontFamily: f[700], fontSize: 17, textAlign: "right", padding: 0 },
  payout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: c.sheetDivider,
  },
  payoutLabel: { color: c.textMuted, fontFamily: f[400], fontSize: 15 },
  payoutValue: { color: c.yes, fontFamily: f[800], fontSize: 26, fontVariant: ["tabular-nums"] },
  primary: { height: 56, borderRadius: dare.radius.button, backgroundColor: c.accent, alignItems: "center", justifyContent: "center", marginTop: 4 },
  primaryLabel: { color: c.text, ...dare.type.button },
  error: { color: c.no, fontFamily: f[500], fontSize: 13, lineHeight: 18, marginBottom: 8 },
  stats: { flexDirection: "row", gap: 10, marginTop: 16 },
  rules: { marginTop: 20 },
  deadline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: c.sheetDivider,
  },
  deadlineText: { color: c.textMuted, fontFamily: f[400], fontSize: 14, fontVariant: ["tabular-nums"] },
});

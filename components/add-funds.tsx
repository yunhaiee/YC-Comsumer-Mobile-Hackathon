import type { FunctionReference } from "convex/server";
import { useAction } from "convex/react";
import { openBrowserAsync } from "expo-web-browser";
import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Chip, ErrorText } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { errorMessage, formatUsd, newRequestId } from "@/lib/format";
import { colors, font, hairline, radius } from "@/lib/theme";

type CreateDeposit = FunctionReference<"action", "public", { amountUsdCents: number; requestId: string }, { checkoutUrl: string }>;

const createDeposit = (api as unknown as { whop: { deposits: { create: CreateDeposit } } }).whop.deposits.create;

const PRESETS = [1000, 2500, 5000];
const MIN_CENTS = 500;
const MAX_CENTS = 50000;

export function AddFundsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const create = useAction(createDeposit);
  const [preset, setPreset] = useState<number | "custom">(2500);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [request, setRequest] = useState<{ cents: number; id: string } | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  const cents = preset === "custom" ? Math.round(Number(custom) * 100) : preset;
  const valid = Number.isFinite(cents) && cents >= MIN_CENTS && cents <= MAX_CENTS;

  const close = () => {
    setError(null);
    setNotice(null);
    setRequest(null);
    setCheckoutUrl(null);
    onClose();
  };

  const submit = async () => {
    if (!valid || busy) return;
    const current = request?.cents === cents ? request : { cents, id: newRequestId() };
    setRequest(current);
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setCheckoutUrl((await create({ amountUsdCents: cents, requestId: current.id })).checkoutUrl);
    } catch (caught) {
      setError(errorMessage(caught));
    }
    setBusy(false);
  };

  const openCheckout = async () => {
    if (!checkoutUrl) return;
    await openBrowserAsync(checkoutUrl);
    setNotice("Checkout closed. Your balance updates once Whop confirms the payment.");
  };

  const pick = (next: number | "custom") => {
    setPreset(next);
    setCheckoutUrl(null);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.grabber} />
          <Text style={styles.title}>Add funds</Text>
          <Text style={styles.caption}>USD · test payments only, no real money</Text>
          <View style={styles.chips}>
            {PRESETS.map((value) => (
              <Chip key={value} label={formatUsd(value)} selected={preset === value} onPress={() => pick(value)} />
            ))}
            <Chip label="Custom" selected={preset === "custom"} onPress={() => pick("custom")} />
          </View>
          {preset === "custom" ? (
            <View style={styles.amountBox}>
              <Text style={styles.prefix}>$</Text>
              <TextInput
                value={custom}
                onChangeText={(value) => {
                  setCustom(value);
                  setCheckoutUrl(null);
                }}
                keyboardType="decimal-pad"
                placeholder="5–500"
                placeholderTextColor={colors.faint}
                selectionColor={colors.accent}
                style={styles.amount}
                accessibilityLabel="Custom amount in dollars"
                autoFocus
              />
            </View>
          ) : null}
          <ErrorText message={preset === "custom" && custom !== "" && !valid ? "Enter $5 to $500." : error} />
          {notice ? <Text style={styles.caption}>{notice}</Text> : null}
          {checkoutUrl ? (
            <Button label={`Pay ${formatUsd(cents, true)} with Whop`} onPress={openCheckout} />
          ) : (
            <Button label={valid ? `Add ${formatUsd(cents, true)}` : "Add funds"} onPress={submit} loading={busy} disabled={!valid} />
          )}
          <Text style={[styles.caption, { textAlign: "center" }]}>Paid with Whop sandbox checkout.</Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: hairline,
    borderColor: colors.hairline,
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 14,
  },
  grabber: { alignSelf: "center", width: 36, height: 5, borderRadius: 3, backgroundColor: colors.surfaceHigh, marginBottom: 6 },
  title: { color: colors.text, ...font.title },
  caption: { color: colors.muted, ...font.footnote },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  amountBox: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 18 },
  prefix: { color: colors.muted, fontSize: 28, fontWeight: "700", marginRight: 4 },
  amount: { flex: 1, minHeight: 60, color: colors.text, fontSize: 28, fontWeight: "700" },
});

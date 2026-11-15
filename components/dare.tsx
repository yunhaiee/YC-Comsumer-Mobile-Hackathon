import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar, Countdown } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { useNow } from "@/hooks/useNow";
import { campaignPhase, poolSplit, type CampaignSummary } from "@/lib/campaign";
import { formatCountdown, formatUsd } from "@/lib/format";
import { colors, font, hairline, radius } from "@/lib/theme";

const URGENT_MS = 10 * 60 * 1000;

export const sponsorLabel = (name: string) => name.replace(/\s*[—–-]\s*sandbox$/i, "");

export function PhaseCountdown({ campaign }: { campaign: CampaignSummary }) {
  const now = useNow();
  const phase = campaignPhase(campaign, now);
  if (!phase.target) return <Countdown label={phase.label} />;
  return <Countdown label={formatCountdown(phase.target, now)} tone={phase.target - now < URGENT_MS ? "negative" : "accent"} />;
}

export function Prize({ cents, size = 22 }: { cents: number; size?: number }) {
  return (
    <View style={styles.prize}>
      <Ionicons name="cash-outline" size={size * 0.8} color={colors.muted} />
      <Text style={[styles.prizeText, { fontSize: size }]}>{formatUsd(cents)}</Text>
    </View>
  );
}

export function ForAgainst({ campaign, onPick }: { campaign: CampaignSummary; onPick?: (side: "YES" | "NO") => void }) {
  const market = useQuery(api.predictions.getMarket, { campaignId: campaign.id });
  const split = market ? poolSplit(market.yesStakeUnits, market.noStakeUnits) : null;
  const sides = [
    { side: "YES" as const, label: "For", pct: split?.yes, color: colors.positive, soft: colors.positiveSoft },
    { side: "NO" as const, label: "Against", pct: split?.no, color: colors.negative, soft: colors.negativeSoft },
  ];
  return (
    <View style={styles.sides}>
      {sides.map((s) => (
        <Pressable
          key={s.side}
          accessibilityRole="button"
          accessibilityLabel={`Predict ${s.label}`}
          disabled={!onPick}
          onPress={() => onPick?.(s.side)}
          style={({ pressed }) => [styles.side, { backgroundColor: s.soft }, pressed && { opacity: 0.7 }]}
        >
          <Text style={[styles.sideLabel, { color: s.color }]}>{s.label}</Text>
          <Text style={[styles.sidePct, { color: s.color }]}>{s.pct === undefined ? "–" : `${s.pct}%`}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function DareCard({ campaign }: { campaign: CampaignSummary }) {
  const now = useNow();
  const open = (side?: "YES" | "NO") =>
    router.push({ pathname: "/dare/[id]", params: side ? { id: campaign.id, side } : { id: campaign.id } });
  const predictionsOpen = !campaign.outcome && now < campaign.predictionClosesAt;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={campaign.title}
      onPress={() => open()}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
    >
      <View style={styles.sponsorRow}>
        <Avatar label={sponsorLabel(campaign.sponsorName)} size={22} />
        <Text style={styles.sponsor} numberOfLines={1}>
          {sponsorLabel(campaign.sponsorName)}
        </Text>
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {campaign.title}
      </Text>
      <View style={styles.bottom}>
        <Prize cents={campaign.rewardUsdCents} />
        <PhaseCountdown campaign={campaign} />
      </View>
      {predictionsOpen ? <ForAgainst campaign={campaign} onPick={open} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: hairline, borderColor: colors.hairline, padding: 16, gap: 10 },
  sponsorRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sponsor: { flex: 1, color: colors.muted, ...font.footnote, fontWeight: "500" },
  title: { color: colors.text, fontSize: 20, fontWeight: "700", letterSpacing: -0.3 },
  bottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 2 },
  prize: { flexDirection: "row", alignItems: "center", gap: 6 },
  prizeText: { color: colors.text, fontWeight: "700", letterSpacing: -0.4 },
  sides: { flexDirection: "row", gap: 8 },
  side: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: radius.sm, paddingHorizontal: 14, minHeight: 44 },
  sideLabel: { ...font.headline },
  sidePct: { ...font.callout, fontWeight: "600", fontVariant: ["tabular-nums"] },
});

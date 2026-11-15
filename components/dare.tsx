import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar, Countdown } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { useNow } from "@/hooks/useNow";
import { campaignPhase, poolSplit, type CampaignSummary } from "@/lib/campaign";
import { formatUsd } from "@/lib/format";
import { colors, font, hairline, radius } from "@/lib/theme";

const URGENT_MS = 10 * 60 * 1000;

function formatClock(targetMs: number, nowMs: number) {
  const total = Math.max(0, Math.floor((targetMs - nowMs) / 1000));
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

export const sponsorLabel = (name: string) => name.replace(/\s*[—–-]\s*sandbox$/i, "");

export function PhaseCountdown({ campaign }: { campaign: CampaignSummary }) {
  const now = useNow();
  const phase = campaignPhase(campaign, now);
  if (!phase.target) return <Countdown label={phase.label} />;
  return <Countdown label={formatClock(phase.target, now)} tone={phase.target - now < URGENT_MS ? "negative" : "accent"} />;
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
  const sponsor = sponsorLabel(campaign.sponsorName);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={campaign.title}
      onPress={() => open()}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
    >
      <View style={styles.rowMain}>
        <Avatar label={sponsor} size={44} />
        <View style={styles.rowText}>
          <Text style={styles.title} numberOfLines={2}>
            {campaign.title}
          </Text>
          <Text style={styles.sponsor} numberOfLines={1}>
            {sponsor}
          </Text>
        </View>
        <View style={styles.rowRight}>
          <Text style={styles.prizeText}>{formatUsd(campaign.rewardUsdCents)}</Text>
          <PhaseCountdown campaign={campaign} />
        </View>
      </View>
      {predictionsOpen ? <ForAgainst campaign={campaign} onPick={open} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 14, gap: 12, borderBottomWidth: hairline, borderBottomColor: colors.hairline },
  rowMain: { flexDirection: "row", alignItems: "center", gap: 14 },
  rowText: { flex: 1, gap: 2 },
  rowRight: { alignItems: "flex-end", gap: 6 },
  sponsor: { color: colors.muted, ...font.footnote },
  title: { color: colors.text, ...font.headline },
  prize: { flexDirection: "row", alignItems: "center", gap: 6 },
  prizeText: { color: colors.text, fontSize: 20, fontWeight: "700", letterSpacing: -0.4 },
  sides: { flexDirection: "row", gap: 8 },
  side: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: radius.sm, paddingHorizontal: 14, minHeight: 44 },
  sideLabel: { ...font.headline },
  sidePct: { ...font.callout, fontWeight: "600", fontVariant: ["tabular-nums"] },
});

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Image, LayoutAnimation, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCountdown } from "@/hooks/useCountdown";
import { sponsorMedia } from "@/lib/dare-media";
import { formatUsd } from "@/lib/format";
import { dare } from "@/lib/theme";

const c = dare.colors;
const f = dare.font;

export const sponsorLabel = (name: string) => name.replace(/\s*[—–-]\s*sandbox$/i, "");

export function CountdownPill({ deadline, text }: { deadline: number | null; text?: string }) {
  const { label, urgent } = useCountdown(deadline);
  const value = text ?? (deadline === null ? "Ended" : label);
  const red = deadline !== null && urgent;
  return (
    <View style={[styles.pill, red && styles.pillUrgent]} accessible accessibilityLabel={`Time left ${value}`}>
      <Ionicons name="time-outline" size={15} color={c.text} />
      <Text style={[styles.pillText, red && styles.pillTextUrgent]}>{value}</Text>
    </View>
  );
}

export function SponsorTile({ name, size }: { name: string; size: 22 | 24 }) {
  const media = sponsorMedia(name);
  const tile = { width: size, height: size, borderRadius: size === 22 ? 6 : 7 };
  if (!media) {
    return (
      <View style={[tile, styles.tileFallback]}>
        <Text style={[styles.tileLetter, { fontSize: size * 0.55 }]}>{name.trim().charAt(0).toUpperCase()}</Text>
      </View>
    );
  }
  if (media.logoMode === "icon-on-tile") {
    return (
      <View style={[tile, styles.tileCenter, { backgroundColor: media.logoTileBg }]}>
        <Image source={media.logo} style={{ width: size * 0.65, height: size * 0.65 }} resizeMode="contain" />
      </View>
    );
  }
  return <Image source={media.logo} style={[tile, { backgroundColor: media.logoTileBg }]} resizeMode="cover" />;
}

function Hero({ sponsorName, thumbnailUrl }: { sponsorName: string; thumbnailUrl?: string | null }) {
  const source = thumbnailUrl ? { uri: thumbnailUrl } : sponsorMedia(sponsorName)?.hero;
  return source ? <Image source={source} style={styles.heroImage} resizeMode="cover" /> : null;
}

export function DareCard({
  title,
  sponsorName,
  thumbnailUrl,
  rewardCents,
  deadline,
  pillText,
  onPress,
}: {
  title: string;
  sponsorName: string;
  thumbnailUrl?: string | null;
  rewardCents: number;
  deadline: number | null;
  pillText?: string;
  onPress: () => void;
}) {
  const sponsor = sponsorLabel(sponsorName);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${formatUsd(rewardCents)} reward, sponsored by ${sponsor}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Hero sponsorName={sponsorName} thumbnailUrl={thumbnailUrl} />
      <LinearGradient
        colors={["rgba(0,0,0,0.85)", "rgba(0,0,0,0.5)", "rgba(0,0,0,0.78)", "rgba(0,0,0,0.97)", "#000000"]}
        locations={[0, 0.25, 0.48, 0.72, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.cardSponsor}>
        <SponsorTile name={sponsor} size={22} />
        <Text style={styles.cardSponsorName} numberOfLines={1}>
          {sponsor}
        </Text>
      </View>
      <View style={styles.cardPill}>
        <CountdownPill deadline={deadline} text={pillText} />
      </View>
      <View style={styles.cardBottom}>
        <Text style={styles.cardReward}>{formatUsd(rewardCents)}</Text>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

export function DareHero({ sponsorName, thumbnailUrl, deadline }: { sponsorName: string; thumbnailUrl?: string | null; deadline: number | null }) {
  return (
    <View style={styles.hero}>
      <Hero sponsorName={sponsorName} thumbnailUrl={thumbnailUrl} />
      <View style={styles.heroPill}>
        <CountdownPill deadline={deadline} />
      </View>
    </View>
  );
}

export function SponsorRow({ name }: { name: string }) {
  const sponsor = sponsorLabel(name);
  return (
    <View style={styles.sponsorRow}>
      <SponsorTile name={sponsor} size={24} />
      <Text style={styles.sponsorName} numberOfLines={1}>
        {sponsor}
      </Text>
      <Ionicons name="checkmark-circle" size={17} color={c.verified} accessibilityLabel="Verified sponsor" />
    </View>
  );
}

export function StatCard({ label, value, total, tone = "page" }: { label: string; value: string; total?: number; tone?: "page" | "sheet" }) {
  return (
    <View style={[styles.stat, tone === "sheet" && styles.statSheet]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>
        {value}
        {total !== undefined ? <Text style={styles.statTotal}> / {total}</Text> : null}
      </Text>
    </View>
  );
}

export function OddsCard({ yesPercent }: { yesPercent: number | null }) {
  const no = yesPercent === null ? null : 100 - yesPercent;
  return (
    <View style={styles.odds}>
      <Text style={styles.statLabel}>Will someone pull it off?</Text>
      <View style={styles.oddsRow}>
        <Text style={[styles.oddsText, { color: c.yes }]}>Yes {yesPercent === null ? "–" : `${yesPercent}%`}</Text>
        <Text style={[styles.oddsText, { color: c.no }]}>No {no === null ? "–" : `${no}%`}</Text>
      </View>
      <View style={styles.bar}>
        {yesPercent === null || no === null ? (
          <View style={[styles.barSegment, { flex: 1, backgroundColor: c.controlBorder }]} />
        ) : (
          <>
            {yesPercent > 0 ? <View style={[styles.barSegment, { flex: yesPercent, backgroundColor: c.yes }]} /> : null}
            {no > 0 ? <View style={[styles.barSegment, { flex: no, backgroundColor: c.no }]} /> : null}
          </>
        )}
      </View>
    </View>
  );
}

export function RulesList({ rules }: { rules: string[] }) {
  return (
    <View style={styles.rules}>
      {rules.map((rule, index) => (
        <View key={index} style={styles.rule}>
          <View style={styles.ruleBadge}>
            <Text style={styles.ruleNumber}>{index + 1}</Text>
          </View>
          <Text style={styles.ruleText}>{rule}</Text>
        </View>
      ))}
    </View>
  );
}

export function RulesRow({ rules }: { rules: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.rulesRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Rules, ${rules.length} steps`}
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setOpen((v) => !v);
        }}
        style={({ pressed }) => [styles.rulesHead, pressed && { opacity: 0.6 }]}
      >
        <Text style={styles.rulesTitle}>Rules</Text>
        <View style={styles.rulesMeta}>
          <Text style={styles.rulesCount}>
            {rules.length} {rules.length === 1 ? "step" : "steps"}
          </Text>
          <Ionicons name={open ? "chevron-down" : "chevron-forward"} size={17} color={c.textMuted} />
        </View>
      </Pressable>
      {open ? (
        <View style={styles.rulesBody}>
          <RulesList rules={rules} />
        </View>
      ) : null}
    </View>
  );
}

type Action = { label: string; sub: string; disabled: boolean; onPress: () => void };

export function DareActionBar({ bet, take }: { bet: Action; take: Action }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
      {[
        { ...bet, style: styles.betButton, subStyle: { color: c.yes }, flex: 1 },
        { ...take, style: styles.takeButton, subStyle: { color: c.text }, flex: 1.4 },
      ].map((action) => (
        <Pressable
          key={action.label}
          accessibilityRole="button"
          accessibilityLabel={`${action.label}. ${action.sub}`}
          accessibilityState={{ disabled: action.disabled }}
          disabled={action.disabled}
          onPress={action.onPress}
          style={({ pressed }) => [styles.action, action.style, { flex: action.flex }, action.disabled && styles.disabled, pressed && styles.pressed]}
        >
          <Text style={styles.actionLabel}>{action.label}</Text>
          {action.sub ? <Text style={[styles.actionSub, action.subStyle]}>{action.sub}</Text> : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: dare.radius.pill,
    backgroundColor: c.scrimPill,
  },
  pillUrgent: { backgroundColor: c.urgent },
  pillText: { color: c.text, fontFamily: f[600], fontSize: 13, fontVariant: ["tabular-nums"] },
  pillTextUrgent: { fontFamily: f[700] },
  tileCenter: { alignItems: "center", justifyContent: "center" },
  tileFallback: { alignItems: "center", justifyContent: "center", backgroundColor: c.accent },
  tileLetter: { color: c.text, fontFamily: f[800] },
  card: { height: 164, borderRadius: dare.radius.card, overflow: "hidden", backgroundColor: c.placeholder },
  pressed: { opacity: 0.85 },
  cardSponsor: { position: "absolute", top: 12, left: 12, right: 140, flexDirection: "row", alignItems: "center", gap: 7 },
  cardSponsorName: { color: c.text, fontFamily: f[600], fontSize: 13, flexShrink: 1 },
  cardPill: { position: "absolute", top: 10, right: 12 },
  cardBottom: { position: "absolute", left: 14, right: 14, bottom: 14 },
  cardReward: {
    ...dare.type.cardReward,
    color: c.accent,
    alignSelf: "flex-start",
    margin: -18,
    marginBottom: 2 - 18,
    padding: 18,
    textShadowColor: c.accentGlow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  cardTitle: { ...dare.type.cardTitle, color: c.text },
  heroImage: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" },
  hero: { height: 230, borderRadius: dare.radius.hero, overflow: "hidden", backgroundColor: c.placeholder },
  heroPill: { position: "absolute", left: 12, bottom: 12 },
  sponsorRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sponsorName: { color: c.textMuted, ...dare.type.labelMedium, flexShrink: 1 },
  stat: { flex: 1, backgroundColor: c.surface, borderWidth: 1, borderColor: c.surfaceBorder, borderRadius: dare.radius.stat, padding: 14 },
  statSheet: { backgroundColor: c.control, borderWidth: 0, padding: 15 },
  statLabel: { color: c.textMuted, ...dare.type.label },
  statValue: { color: c.text, ...dare.type.stat, marginTop: 4 },
  statTotal: { color: c.textSubtle, fontFamily: f[600], fontSize: 16 },
  odds: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.surfaceBorder, borderRadius: dare.radius.stat, padding: 14 },
  oddsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  oddsText: { fontFamily: f[700], fontSize: 15 },
  bar: { flexDirection: "row", gap: 4, height: 8, marginTop: 8 },
  barSegment: { borderRadius: 4 },
  rules: { gap: 14 },
  rule: { flexDirection: "row", alignItems: "center", gap: 12 },
  ruleBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: c.badge, alignItems: "center", justifyContent: "center" },
  ruleNumber: { color: c.text, fontFamily: f[700], fontSize: 13 },
  ruleText: { flex: 1, color: c.text, ...dare.type.body, lineHeight: 20 },
  rulesRow: { borderTopWidth: 1, borderTopColor: c.divider },
  rulesHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 54, paddingHorizontal: 2 },
  rulesTitle: { color: c.text, fontFamily: f[600], fontSize: 15 },
  rulesMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  rulesCount: { color: c.textMuted, fontFamily: f[500], fontSize: 15 },
  rulesBody: { paddingBottom: 16, paddingHorizontal: 2 },
  actionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: 10,
    paddingTop: 14,
    paddingHorizontal: dare.space.screen,
    backgroundColor: c.bg,
    borderTopWidth: 1,
    borderTopColor: c.divider,
  },
  action: { height: 60, borderRadius: dare.radius.button, alignItems: "center", justifyContent: "center", gap: 2 },
  betButton: { backgroundColor: c.controlRaised, borderWidth: 1, borderColor: c.controlBorderStrong },
  takeButton: { backgroundColor: c.accent },
  disabled: { opacity: 0.4 },
  actionLabel: { color: c.text, ...dare.type.button },
  actionSub: { ...dare.type.buttonSub },
});

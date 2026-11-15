import { Ionicons } from "@expo/vector-icons";
import { usePaginatedQuery } from "convex/react";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, CenterMessage, Loading, Pill } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { useNow } from "@/hooks/useNow";
import { campaignPhase, type CampaignSummary } from "@/lib/campaign";
import { formatCountdown, formatUsd } from "@/lib/format";
import { colors, radius } from "@/lib/theme";

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(0);
  const { results, status, loadMore } = usePaginatedQuery(api.campaigns.list, {}, { initialNumItems: 10 });

  const onLayout = (event: LayoutChangeEvent) => setHeight(event.nativeEvent.layout.height);

  return (
    <View style={styles.screen} onLayout={onLayout}>
      {status === "LoadingFirstPage" ? (
        <Loading />
      ) : results.length === 0 ? (
        <CenterMessage title="No live dares yet" body="Sponsored challenges appear here once a company funds a campaign." />
      ) : height > 0 ? (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <FeedCard campaign={item} height={height} topInset={insets.top} />}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={height}
          getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
          onEndReached={() => {
            if (status === "CanLoadMore") loadMore(10);
          }}
          onEndReachedThreshold={0.5}
        />
      ) : null}
      <View style={[styles.topBar, { top: insets.top + 8 }]} pointerEvents="box-none">
        <View style={styles.brand}>
          <View style={styles.mark}>
            <Text style={styles.markText}>D</Text>
          </View>
          <Text style={styles.brandText}>DARE</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Profile and wallet"
          onPress={() => router.push("/profile")}
          style={styles.iconButton}
        >
          <Ionicons name="person-circle-outline" size={30} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

function FeedCard({ campaign, height, topInset }: { campaign: CampaignSummary; height: number; topInset: number }) {
  const now = useNow();
  const phase = campaignPhase(campaign, now);
  const open = () => router.push({ pathname: "/dare/[id]", params: { id: campaign.id } });

  return (
    <View style={[styles.card, { height }]}>
      <LinearGradient colors={["#2B1A55", "#120E1C", colors.background]} style={StyleSheet.absoluteFill} />
      <View style={[styles.cardBody, { paddingTop: topInset + 72 }]}>
        <View style={styles.rowWrap}>
          <Pill label={`Sponsored by ${campaign.sponsorName}`} tone="accent" />
          {campaign.isDemo ? <Pill label="Demo sponsor" /> : null}
        </View>
        <View style={{ flex: 1 }} />
        <Text style={styles.reward}>{formatUsd(campaign.rewardUsdCents)}</Text>
        <Text style={styles.rewardNote}>
          per winner · {campaign.winnerCount} {campaign.winnerCount === 1 ? "prize" : "prizes"} · sponsor-funded
        </Text>
        <Text style={styles.title}>{campaign.title}</Text>
        <Text style={styles.description} numberOfLines={3}>
          {campaign.description}
        </Text>
        <View style={styles.stats}>
          <Stat label={phase.label} value={phase.target ? formatCountdown(phase.target, now) : "—"} tone={phase.tone} />
          <Stat label="Participants" value={String(campaign.participantCount)} />
        </View>
        <View style={styles.actions}>
          <Button label="DO THE DARE" onPress={open} style={{ flex: 1 }} />
          <Button label="PREDICT" variant="secondary" onPress={open} style={{ flex: 1 }} />
        </View>
      </View>
    </View>
  );
}

function Stat({ label, value, tone = "muted" }: { label: string; value: string; tone?: "accent" | "positive" | "warning" | "muted" }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, tone !== "muted" && { color: colors[tone] }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  topBar: { position: "absolute", left: 20, right: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  mark: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  markText: { color: colors.text, fontSize: 21, fontWeight: "900" },
  brandText: { color: colors.text, fontSize: 20, fontWeight: "900", letterSpacing: 2 },
  iconButton: { padding: 6, borderRadius: 999, backgroundColor: "rgba(12,10,18,0.6)" },
  card: { width: "100%", overflow: "hidden" },
  cardBody: { flex: 1, paddingHorizontal: 22, paddingBottom: 28, gap: 10, maxWidth: 640, width: "100%", alignSelf: "center" },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reward: { color: colors.text, fontSize: 56, fontWeight: "900", letterSpacing: -2 },
  rewardNote: { color: colors.muted, fontSize: 13, fontWeight: "600", marginTop: -6 },
  title: { color: colors.text, fontSize: 28, fontWeight: "800", lineHeight: 34 },
  description: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  stats: { flexDirection: "row", gap: 10, marginTop: 6 },
  stat: { flex: 1, backgroundColor: "rgba(23,19,33,0.85)", borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 4 },
  statLabel: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  statValue: { color: colors.text, fontSize: 18, fontWeight: "800" },
  actions: { flexDirection: "row", gap: 10, marginTop: 6 },
});

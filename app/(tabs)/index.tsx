import { Ionicons } from "@expo/vector-icons";
import { usePaginatedQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar, Chip, EmptyState, IconButton, Loading, Pill } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { useNow } from "@/hooks/useNow";
import { campaignPhase, type CampaignSummary } from "@/lib/campaign";
import { formatCountdown, formatUsd } from "@/lib/format";
import { TAB_BAR_CLEARANCE, colors, font, hairline, radius, space } from "@/lib/theme";

type Filter = "all" | "live" | "ended";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>("all");
  const { results, status, loadMore } = usePaginatedQuery(api.campaigns.list, {}, { initialNumItems: 10 });
  const visible = results.filter((c) => (filter === "all" ? true : filter === "live" ? !c.outcome : !!c.outcome));

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: TAB_BAR_CLEARANCE + insets.bottom }]}
      data={status === "LoadingFirstPage" ? [] : visible}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <DareCard campaign={item} />}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text accessibilityRole="header" style={styles.title}>
              Dares
            </Text>
            <IconButton icon="add" label="Create a campaign" onPress={() => router.push("/sponsor/create")} />
          </View>
          <View style={styles.chips}>
            <Chip label="All" selected={filter === "all"} onPress={() => setFilter("all")} />
            <Chip label="Live" selected={filter === "live"} onPress={() => setFilter("live")} />
            <Chip label="Ended" selected={filter === "ended"} onPress={() => setFilter("ended")} />
          </View>
        </View>
      }
      ListEmptyComponent={
        status === "LoadingFirstPage" ? (
          <View style={{ height: 240 }}>
            <Loading />
          </View>
        ) : (
          <EmptyState icon="flash" title="No dares" accent="yet" body="Sponsored challenges show up here." />
        )
      }
      onEndReached={() => {
        if (status === "CanLoadMore") loadMore(10);
      }}
      onEndReachedThreshold={0.5}
    />
  );
}

function DareCard({ campaign }: { campaign: CampaignSummary }) {
  const now = useNow();
  const phase = campaignPhase(campaign, now);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={campaign.title}
      onPress={() => router.push({ pathname: "/dare/[id]", params: { id: campaign.id } })}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}
    >
      <View style={styles.sponsorRow}>
        <Avatar label={campaign.sponsorName} size={28} />
        <Text style={styles.sponsor} numberOfLines={1}>
          {campaign.sponsorName}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={colors.faint} />
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>
        {campaign.title}
      </Text>
      <View style={styles.rewardRow}>
        <Text style={styles.reward}>{formatUsd(campaign.rewardUsdCents)}</Text>
        <Text style={styles.rewardUnit}>per winner</Text>
      </View>
      <View style={styles.metaRow}>
        <Pill
          label={phase.target ? `${phase.label} ${formatCountdown(phase.target, now)}` : phase.label}
          tone={phase.target ? "accent" : "muted"}
        />
        <Text style={styles.meta}>{campaign.participantCount} joined</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: space.screen, gap: 12, maxWidth: 680, width: "100%", alignSelf: "center" },
  header: { gap: 16, marginBottom: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 52 },
  title: { color: colors.text, ...font.largeTitle },
  chips: { flexDirection: "row", gap: 8 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: hairline,
    borderColor: colors.hairline,
    padding: 16,
    gap: 12,
  },
  sponsorRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  sponsor: { flex: 1, color: colors.muted, ...font.footnote, fontWeight: "500" },
  cardTitle: { color: colors.text, ...font.title },
  rewardRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  reward: { color: colors.text, fontSize: 34, fontWeight: "700", letterSpacing: -0.8 },
  rewardUnit: { color: colors.muted, ...font.callout },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  meta: { color: colors.muted, ...font.footnote },
});

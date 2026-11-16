import { usePaginatedQuery } from "convex/react";
import { router } from "expo-router";
import { FlatList, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DareCard } from "@/components/dare";
import { BrandHeader, EmptyState, Loading } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { useNow } from "@/hooks/useNow";
import { campaignPhase } from "@/lib/campaign";
import { DEMO_DARES, DEMO_DARES_ENABLED } from "@/lib/demo-dares";
import { TAB_BAR_CLEARANCE, dare } from "@/lib/theme";

type CardItem = { id: string; title: string; sponsorName: string; thumbnailUrl?: string | null; rewardCents: number; deadline: number | null };

const DEMO_ITEMS: CardItem[] = DEMO_DARES.map((d) => ({
  id: d.id,
  title: d.title,
  sponsorName: d.sponsorName,
  rewardCents: d.bounty * 100,
  deadline: d.deadlineAt,
}));

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const now = useNow(60_000);
  const { results, status, loadMore } = usePaginatedQuery(api.campaigns.list, DEMO_DARES_ENABLED ? "skip" : {}, { initialNumItems: 10 });
  const items: CardItem[] = DEMO_DARES_ENABLED
    ? DEMO_ITEMS
    : results.map((c) => ({
        id: c.id,
        title: c.title,
        sponsorName: c.sponsorName,
        thumbnailUrl: c.thumbnailUrl,
        rewardCents: c.rewardUsdCents,
        deadline: campaignPhase(c, now).target,
      }));
  const loading = !DEMO_DARES_ENABLED && status === "LoadingFirstPage";

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 20), paddingBottom: TAB_BAR_CLEARANCE + insets.bottom }]}
      data={loading ? [] : items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <DareCard
          title={item.title}
          sponsorName={item.sponsorName}
          thumbnailUrl={item.thumbnailUrl}
          rewardCents={item.rewardCents}
          deadline={item.deadline}
          onPress={() => router.push({ pathname: "/dare/[id]", params: { id: item.id } })}
        />
      )}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View style={styles.brand}>
          <BrandHeader />
        </View>
      }
      ListEmptyComponent={
        loading ? (
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: dare.colors.bg },
  content: { paddingHorizontal: dare.space.screen, gap: dare.space.cardGap, maxWidth: 680, width: "100%", alignSelf: "center" },
  brand: { marginBottom: 4 },
});

import { usePaginatedQuery } from "convex/react";
import { useState } from "react";
import { FlatList, Image, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DareCard } from "@/components/dare";
import { Chip, EmptyState, Loading } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { TAB_BAR_CLEARANCE, colors, space } from "@/lib/theme";

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
            <Image source={require("@/assets/logo-symbol.png")} style={styles.logo} accessibilityRole="header" accessibilityLabel="Dare" />
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: space.screen, gap: 10, maxWidth: 680, width: "100%", alignSelf: "center" },
  header: { gap: 16, marginBottom: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", minHeight: 52 },
  logo: { width: 29, height: 40, resizeMode: "contain" },
  chips: { flexDirection: "row", gap: 8 },
});

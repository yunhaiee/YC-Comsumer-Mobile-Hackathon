import { useConvexAuth, useQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { AddFundsSheet } from "@/components/add-funds";
import { ActionTiles, BalanceHero, Button, Chip, EmptyState, ListRow, Loading, Screen } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { formatTime, formatUsd } from "@/lib/format";
import { colors, font } from "@/lib/theme";

type Tab = "open" | "settled" | "rewards" | "deposits";
type Me = NonNullable<ReturnType<typeof useQuery<typeof api.profiles.me>>>;
type Position = Me["positions"][number];
type Deposit = { id?: string; amountUsdCents: number; status?: string; createdAt?: number };

export default function WalletScreen() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.profiles.me, isAuthenticated ? {} : "skip");
  const [tab, setTab] = useState<Tab>("open");
  const [adding, setAdding] = useState(false);

  if (isLoading || (isAuthenticated && me === undefined)) return <Loading />;
  if (!isAuthenticated || !me) {
    return (
      <Screen title="Wallet">
        <EmptyState
          icon="wallet"
          title="Your"
          accent="wallet"
          body="USD · test payments only, no real money."
          action={<Button label="Sign in" onPress={() => router.push("/sign-in")} style={{ alignSelf: "stretch" }} />}
        />
      </Screen>
    );
  }

  const deposits = (me as Me & { deposits?: Deposit[] }).deposits;
  const open = me.positions.filter((p) => p.outcome === null);
  const settled = me.positions.filter((p) => p.outcome !== null);
  const list = tab === "open" ? open : settled;

  return (
    <Screen title="Wallet">
      <BalanceHero label="USD balance" value={formatUsd(me.balanceUnits, true)} caption="Test payments only, no real money" />
      <ActionTiles
        tiles={[
          { icon: "add", label: "Add funds", onPress: () => setAdding(true) },
          { icon: "flash-outline", label: "Predict", onPress: () => router.push("/") },
          { icon: "time-outline", label: "Open", onPress: () => setTab("open") },
          { icon: "gift-outline", label: "Rewards", onPress: () => setTab("rewards") },
        ]}
      />
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Activity</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="Open" selected={tab === "open"} onPress={() => setTab("open")} />
          <Chip label="Settled" selected={tab === "settled"} onPress={() => setTab("settled")} />
          <Chip label="Rewards" selected={tab === "rewards"} onPress={() => setTab("rewards")} />
          {deposits ? <Chip label="Deposits" selected={tab === "deposits"} onPress={() => setTab("deposits")} /> : null}
        </ScrollView>
        <View>
          {tab === "deposits" ? (
            !deposits?.length ? (
              <EmptyState icon="card" title="No deposits yet" />
            ) : (
              deposits.map((d, i) => (
                <ListRow
                  key={`${d.createdAt}-${i}`}
                  first={i === 0}
                  icon="arrow-down"
                  title="Deposit"
                  subtitle={[d.status ? d.status.replaceAll("_", " ") : null, d.createdAt ? formatTime(d.createdAt) : null].filter(Boolean).join(" · ") || undefined}
                  value={formatUsd(d.amountUsdCents, true)}
                />
              ))
            )
          ) : tab === "rewards" ? (
            me.rewards.length === 0 ? (
              <EmptyState icon="gift" title="No rewards yet" />
            ) : (
              me.rewards.map((r, i) => (
                <ListRow
                  key={r.campaignId}
                  first={i === 0}
                  icon="gift"
                  iconTone="accent"
                  title="Dare reward"
                  subtitle="Recorded, not paid"
                  value={formatUsd(r.rewardUsdCents)}
                  onPress={() => router.push({ pathname: "/dare/[id]", params: { id: r.campaignId } })}
                />
              ))
            )
          ) : list.length === 0 ? (
            <EmptyState icon="stats-chart" title={tab === "open" ? "No open predictions" : "Nothing settled"} />
          ) : (
            list.map((p, i) => <PositionRow key={p.id} position={p} first={i === 0} />)
          )}
        </View>
      </View>
      <AddFundsSheet visible={adding} onClose={() => setAdding(false)} />
    </Screen>
  );
}

function PositionRow({ position, first }: { position: Position; first: boolean }) {
  const won = position.outcome !== null && position.outcome !== "VOID" && position.outcome === position.side;
  const status = position.outcome === null ? "Open" : position.outcome === "VOID" ? "Refunded" : won ? "Won" : "Lost";
  return (
    <ListRow
      first={first}
      icon={position.side === "YES" ? "checkmark" : "close"}
      iconTone={position.side === "YES" ? "positive" : "negative"}
      title={position.side === "YES" ? "For" : "Against"}
      subtitle={status}
      value={formatUsd(position.payoutUnits ?? position.stakeUnits, true)}
      valueSub={position.payoutUnits !== null ? "paid" : "staked"}
      tone={won ? "positive" : undefined}
      onPress={() => router.push({ pathname: "/dare/[id]", params: { id: position.campaignId } })}
    />
  );
}

const styles = StyleSheet.create({
  section: { gap: 14, marginTop: 8 },
  sectionTitle: { color: colors.text, ...font.title },
  chips: { flexDirection: "row", gap: 8 },
});

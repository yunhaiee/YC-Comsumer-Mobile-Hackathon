import { useConvexAuth, useQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ActionTiles, BalanceHero, Button, Chip, EmptyState, ListRow, Loading, Screen } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { formatCredits, formatUsd } from "@/lib/format";
import { colors, font } from "@/lib/theme";

type Tab = "open" | "settled" | "rewards";
type Me = NonNullable<ReturnType<typeof useQuery<typeof api.profiles.me>>>;
type Position = Me["positions"][number];

export default function WalletScreen() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.profiles.me, isAuthenticated ? {} : "skip");
  const [tab, setTab] = useState<Tab>("open");

  if (isLoading || (isAuthenticated && me === undefined)) return <Loading />;
  if (!isAuthenticated || !me) {
    return (
      <Screen title="Wallet">
        <EmptyState
          icon="wallet"
          title="Free play"
          accent="credits"
          body="Sign in to get credits for predictions."
          action={<Button label="Sign in" onPress={() => router.push("/sign-in")} style={{ alignSelf: "stretch" }} />}
        />
      </Screen>
    );
  }

  const open = me.positions.filter((p) => p.outcome === null);
  const settled = me.positions.filter((p) => p.outcome !== null);
  const list = tab === "open" ? open : settled;

  return (
    <Screen title="Wallet">
      <BalanceHero label="Play credits" value={formatCredits(me.balanceUnits)} caption="Free to play · not money" />
      <ActionTiles
        tiles={[
          { icon: "flash-outline", label: "Predict", onPress: () => router.push("/") },
          { icon: "time-outline", label: "Open", onPress: () => setTab("open") },
          { icon: "gift-outline", label: "Rewards", onPress: () => setTab("rewards") },
          { icon: "megaphone-outline", label: "Studio", onPress: () => router.push("/sponsor") },
        ]}
      />
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Activity</Text>
        <View style={styles.chips}>
          <Chip label={`Open ${open.length}`} selected={tab === "open"} onPress={() => setTab("open")} />
          <Chip label="Settled" selected={tab === "settled"} onPress={() => setTab("settled")} />
          <Chip label="Rewards" selected={tab === "rewards"} onPress={() => setTab("rewards")} />
        </View>
        <View>
          {tab === "rewards" ? (
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
                  subtitle="Sandbox · recorded, not paid"
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
    </Screen>
  );
}

function PositionRow({ position, first }: { position: Position; first: boolean }) {
  const won = position.outcome !== null && position.outcome !== "VOID" && position.outcome === position.side;
  const status =
    position.outcome === null ? "Open" : position.outcome === "VOID" ? "Refunded" : won ? "Won" : "Lost";
  return (
    <ListRow
      first={first}
      icon={position.side === "YES" ? "checkmark" : "close"}
      iconTone={position.side === "YES" ? "positive" : "negative"}
      title={`${position.side} prediction`}
      subtitle={status}
      value={formatCredits(position.payoutUnits ?? position.stakeUnits)}
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

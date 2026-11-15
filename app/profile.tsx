import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Button, Card, CenterMessage, Loading, Pill, Row, SectionTitle, text } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { formatCredits, formatUsd } from "@/lib/format";
import { colors } from "@/lib/theme";

export default function ProfileScreen() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.profiles.me, isAuthenticated ? {} : "skip");
  const { signOut } = useAuthActions();
  const [signingOut, setSigningOut] = useState(false);

  if (isLoading || (isAuthenticated && me === undefined)) return <Loading />;
  if (!isAuthenticated || !me) {
    return (
      <CenterMessage
        title="Sign in to see your wallet"
        body="Every account starts with free play credits for predictions."
        action={<Button label="Sign in" onPress={() => router.push("/sign-in")} />}
      />
    );
  }

  const open = me.positions.filter((p) => p.outcome === null);
  const settled = me.positions.filter((p) => p.outcome !== null);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card>
        <Text style={text.small}>Play-credit balance</Text>
        <Text style={styles.balance}>{formatCredits(me.balanceUnits)}</Text>
        <Text style={text.small}>Simulated credits. They can’t be bought, withdrawn, or exchanged for money.</Text>
      </Card>

      {me.isSponsor ? (
        <Card>
          <SectionTitle>Sponsor studio</SectionTitle>
          <Text style={text.body}>Create funded dares, track participation, and review evidence.</Text>
          <Button label="Open sponsor studio" onPress={() => router.push("/sponsor" as never)} />
        </Card>
      ) : null}

      <Card>
        <SectionTitle>Open predictions</SectionTitle>
        {open.length === 0 ? <Text style={text.small}>No open predictions.</Text> : open.map((p) => <PositionRow key={p.id} position={p} />)}
      </Card>

      <Card>
        <SectionTitle>Settled</SectionTitle>
        {settled.length === 0 ? <Text style={text.small}>Nothing settled yet.</Text> : settled.map((p) => <PositionRow key={p.id} position={p} />)}
      </Card>

      <Card>
        <SectionTitle>Dare rewards</SectionTitle>
        {me.rewards.length === 0 ? (
          <Text style={text.small}>Win a sponsored dare to earn a reward.</Text>
        ) : (
          me.rewards.map((r) => (
            <Row key={r.campaignId} label="Sponsor reward (sandbox, not paid out)" value={formatUsd(r.rewardUsdCents)} tone="positive" />
          ))
        )}
      </Card>

      <Button
        label="Sign out"
        variant="secondary"
        loading={signingOut}
        onPress={async () => {
          setSigningOut(true);
          await signOut();
          setSigningOut(false);
          router.replace("/");
        }}
      />
    </ScrollView>
  );
}

type Position = NonNullable<ReturnType<typeof useQuery<typeof api.profiles.me>>>["positions"][number];

function PositionRow({ position }: { position: Position }) {
  const won = position.outcome !== null && position.outcome !== "VOID" && position.outcome === position.side;
  return (
    <View style={styles.position}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          style={text.strong}
          onPress={() => router.push({ pathname: "/dare/[id]", params: { id: position.campaignId } })}
        >
          {position.side} · {formatCredits(position.stakeUnits)}
        </Text>
        {position.payoutUnits !== null ? <Text style={text.small}>Paid {formatCredits(position.payoutUnits)}</Text> : null}
      </View>
      <Pill
        label={position.outcome === null ? "Open" : position.outcome === "VOID" ? "Refunded" : won ? "Won" : "Lost"}
        tone={position.outcome === null ? "accent" : position.outcome === "VOID" ? "muted" : won ? "positive" : "negative"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16, paddingBottom: 48, maxWidth: 680, width: "100%", alignSelf: "center" },
  balance: { color: colors.text, fontSize: 44, fontWeight: "900" },
  position: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
});

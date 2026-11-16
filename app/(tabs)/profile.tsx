import { Ionicons } from "@expo/vector-icons";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { Button, EmptyState, ListRow, Loading, Screen } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { formatUsd } from "@/lib/format";
import { colors, font, hairline } from "@/lib/theme";

export default function ProfileScreen() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.profiles.me, isAuthenticated ? {} : "skip");
  const { signOut } = useAuthActions();
  const [signingOut, setSigningOut] = useState(false);

  if (isLoading || (isAuthenticated && me === undefined)) return <Loading />;
  if (!isAuthenticated || !me) {
    return (
      <Screen title="Profile">
        <EmptyState
          icon="logo"
          title="Join the"
          accent="Dare"
          body="Take dares or predict in USD."
          action={<Button label="Sign in" variant="secondary" onPress={() => router.push("/sign-in")} style={{ alignSelf: "stretch" }} />}
        />
      </Screen>
    );
  }

  return (
    <Screen title="Profile">
      <View style={styles.identity}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={34} color={colors.text} />
          <View style={styles.online} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.name}>{me.isSponsor ? "Sponsor account" : "Player"}</Text>
          <Text style={styles.stat}>
            <Text style={styles.statValue}>{formatUsd(me.balanceUnits, true)}</Text> · {me.positions.length} predictions
          </Text>
        </View>
      </View>

      <View style={styles.buttons}>
        <Button label="Wallet" variant="secondary" onPress={() => router.push("/wallet")} style={{ flex: 1 }} />
        <Button label="Explore" variant="secondary" onPress={() => router.push("/")} style={{ flex: 1 }} />
      </View>

      <View>
        <Text style={styles.group}>Account</Text>
        <ListRow first icon="wallet-outline" title="Wallet" onPress={() => router.push("/wallet")} />
        <ListRow icon="megaphone-outline" title="Sponsor studio" onPress={() => router.push("/sponsor")} />
        <ListRow icon="gift-outline" title="Rewards" value={String(me.rewards.length)} onPress={() => router.push("/wallet")} />
      </View>

      <View style={styles.divider} />

      <View>
        <ListRow
          first
          icon="log-out-outline"
          title={signingOut ? "Signing out…" : "Log out"}
          destructive
          onPress={async () => {
            if (signingOut) return;
            setSigningOut(true);
            await signOut();
            setSigningOut(false);
            router.replace("/");
          }}
        />
        {signingOut ? <ActivityIndicator color={colors.muted} /> : null}
      </View>

      <Text style={styles.footnote}>USD · test payments only, no real money. Nothing is withdrawable.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: "row", alignItems: "center", gap: 18 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#3A3D45",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: hairline,
    borderColor: colors.hairline,
  },
  online: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.positive,
    borderWidth: 3,
    borderColor: colors.background,
  },
  name: { color: colors.text, ...font.title },
  stat: { color: colors.muted, ...font.callout },
  statValue: { color: colors.text, fontWeight: "600" },
  buttons: { flexDirection: "row", gap: 10 },
  group: { color: colors.muted, ...font.callout, marginBottom: 4 },
  divider: { height: hairline, backgroundColor: colors.hairline },
  footnote: { color: colors.faint, ...font.footnote },
});

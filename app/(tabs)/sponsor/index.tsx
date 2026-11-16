import { useQuery } from "convex/react";
import { router } from "expo-router";
import { Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { DareCard } from "@/components/dare";
import { Loading, SponsorScreen, styles } from "@/components/sponsor/ui";
import { api } from "@/convex/_generated/api";
import { useNow } from "@/hooks/useNow";
import { campaignPhase } from "@/lib/campaign";
import { colors } from "@/lib/theme";

export default function SponsorDashboard() {
  const campaigns = useQuery(api.campaigns.listOwned, {});
  const now = useNow(60_000);

  return (
    <SponsorScreen
      title="Your dares"
      back="/"
      action={
        <Pressable accessibilityRole="button" accessibilityLabel="Create dare" onPress={() => router.push("/sponsor/create")} style={({ pressed }) => [styles.createButton, pressed && styles.pressed]}>
          <Ionicons name="add" size={20} color={colors.text} />
          <Text style={styles.buttonText}>Create</Text>
        </Pressable>
      }
    >
      {campaigns === undefined ? <Loading /> : null}
      {campaigns?.length === 0 ? <Text style={styles.body}>No dares yet.</Text> : null}
      {campaigns?.map((campaign) => (
        <DareCard
          key={campaign.id}
          title={campaign.title}
          sponsorName={campaign.sponsorName}
          thumbnailUrl={campaign.thumbnailUrl}
          rewardCents={campaign.rewardUsdCents}
          deadline={campaignPhase(campaign, now).target}
          pillText={campaign.state === "draft" || campaign.state === "awaiting_payment" ? "Unpaid" : undefined}
          onPress={() => router.push({ pathname: "/sponsor/[id]", params: { id: campaign.id } })}
        />
      ))}
    </SponsorScreen>
  );
}

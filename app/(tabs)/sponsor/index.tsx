import { useQuery } from "convex/react";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { Button, Card, Loading, Notice, SponsorScreen, Status, money, styles, when } from "@/components/sponsor/ui";
import { api } from "@/convex/_generated/api";

export default function SponsorDashboard() {
  const campaigns = useQuery(api.campaigns.listOwned, {});

  return (
    <SponsorScreen title="Your campaigns" back="/">
      <Button onPress={() => router.push("/sponsor/create")}>Create a campaign</Button>
      {campaigns === undefined ? <Loading /> : null}
      {campaigns?.length === 0 ? <Notice>No campaigns yet. Create a draft, then pay with Whop sandbox checkout to open it.</Notice> : null}
      {campaigns?.map((campaign) => (
        <Pressable
          key={campaign.id}
          accessibilityRole="button"
          accessibilityLabel={`Open ${campaign.title}`}
          onPress={() => router.push({ pathname: "/sponsor/[id]", params: { id: campaign.id } })}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Card>
            <View style={styles.between}>
              <Status state={campaign.state} />
            </View>
            <Text style={styles.heading}>{campaign.title}</Text>
            <Text style={styles.body}>
              {campaign.winnerCount} × {money(campaign.rewardUsdCents)} represented reward · deadline {when(campaign.deadlineAt)}
            </Text>
            <View style={styles.between}>
              <Metric label="Participants" value={campaign.participantCount} />
              <Metric label="Videos" value={campaign.submissionCount} />
              <Metric label="To review" value={campaign.pendingCount} />
            </View>
            {campaign.outcome ? <Text style={styles.body}>Outcome: <Text style={styles.strong}>{campaign.outcome}</Text></Text> : null}
          </Card>
        </Pressable>
      ))}
    </SponsorScreen>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <View>
      <Text style={styles.amount}>{value}</Text>
      <Text style={styles.hint}>{label}</Text>
    </View>
  );
}

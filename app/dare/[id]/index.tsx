import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { Avatar, BalanceHero, Button, Card, CenterMessage, Chip, ErrorText, ListRow, Loading, NavHeader, Pill, Row, Screen, text } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useNow } from "@/hooks/useNow";
import { campaignPhase, poolSplit } from "@/lib/campaign";
import { UNITS_PER_CREDIT, errorMessage, formatCountdown, formatCredits, formatTime, formatUsd, newRequestId } from "@/lib/format";
import { colors, font, radius } from "@/lib/theme";

type Side = "YES" | "NO";

const MAX_STAKE_UNITS = 1_000_000;

export default function DareDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const campaignId = id as Id<"campaigns">;
  const now = useNow();
  const { isAuthenticated } = useConvexAuth();
  const campaign = useQuery(api.campaigns.get, { campaignId });
  const market = useQuery(api.predictions.getMarket, { campaignId });
  const join = useMutation(api.campaigns.join);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  if (campaign === undefined) return <Loading />;
  if (campaign === null) return <CenterMessage title="Dare not found" body="It may be unpublished or removed." />;

  const phase = campaignPhase(campaign, now);
  const viewer = campaign.viewer;
  const split = market ? poolSplit(market.yesStakeUnits, market.noStakeUnits) : null;

  const onJoin = async () => {
    setJoinError(null);
    setJoining(true);
    try {
      await join({ campaignId });
    } catch (error) {
      setJoinError(errorMessage(error));
    } finally {
      setJoining(false);
    }
  };

  return (
    <Screen tabBar={false}>
      <NavHeader />
      <View style={styles.sponsorRow}>
        <Avatar label={campaign.sponsorName} size={32} />
        <Text style={styles.sponsor} numberOfLines={1}>
          {campaign.sponsorName}
        </Text>
        {campaign.isDemo ? <Pill label="Demo" /> : null}
      </View>
      <View style={{ gap: 8 }}>
        <Text style={styles.title}>{campaign.title}</Text>
        <Text style={text.body}>{campaign.description}</Text>
      </View>

      <BalanceHero
        label="Reward per winner"
        value={formatUsd(campaign.rewardUsdCents)}
        caption={`${campaign.winnerCount} ${campaign.winnerCount === 1 ? "winner" : "winners"} · sandbox, recorded not paid`}
      />
      <Pill label={phase.target ? `${phase.label} ${formatCountdown(phase.target, now)}` : phase.label} tone={phase.target ? "accent" : "muted"} />

      <Card style={{ gap: 0, paddingVertical: 4 }}>
        <ListRow first title="Joined" value={String(campaign.participantCount)} />
        <ListRow title="Predictions close" value={formatTime(campaign.predictionClosesAt)} />
        <ListRow title="Attempts start" value={formatTime(campaign.attemptStartsAt)} />
        <ListRow title="Evidence due" value={formatTime(campaign.deadlineAt)} />
      </Card>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Criteria</Text>
        <Text style={text.body}>{campaign.criteria}</Text>
      </View>

      <Card>
        <View style={styles.between}>
          <Text style={styles.blockTitle}>Will anyone do it?</Text>
          {split ? <Text style={text.small}>{formatCredits(split.total)}</Text> : null}
        </View>
        {split ? (
          <View style={{ gap: 8 }}>
            <View style={styles.bar}>
              <View style={[styles.barYes, { flex: Math.max(split.yes, 1) }]} />
              <View style={[styles.barNo, { flex: Math.max(split.no, 1) }]} />
            </View>
            <View style={styles.between}>
              <Text style={[styles.splitText, { color: colors.positive }]}>Yes {split.yes}%</Text>
              <Text style={[styles.splitText, { color: colors.negative }]}>No {split.no}%</Text>
            </View>
          </View>
        ) : (
          <Text style={text.small}>No predictions yet.</Text>
        )}
        {market?.position ? (
          <Row
            label="You"
            value={`${market.position.side} · ${formatCredits(market.position.stakeUnits)}${
              market.position.payoutUnits !== null ? ` → ${formatCredits(market.position.payoutUnits)}` : ""
            }`}
            tone={market.position.side === "YES" ? "positive" : "negative"}
          />
        ) : null}
      </Card>

      {!isAuthenticated ? (
        <Button label="Sign in to play" onPress={() => router.push("/sign-in")} />
      ) : viewer.role === "reviewer" ? (
        <Text style={text.small}>You review this dare, so you can’t join or predict.</Text>
      ) : (
        <>
          {viewer.role === "participant" ? (
            <Card>
              <Text style={styles.blockTitle}>
                You’re <Text style={{ color: colors.accent }}>in</Text>
              </Text>
              <Text style={text.body}>
                {viewer.canSubmit
                  ? "Record one continuous video before the deadline."
                  : now < campaign.attemptStartsAt
                    ? `Attempts open ${formatTime(campaign.attemptStartsAt)}.`
                    : "Submissions are closed."}
              </Text>
              <Button
                label={viewer.canSubmit ? "Submit evidence" : "My submissions"}
                icon={viewer.canSubmit ? "videocam" : undefined}
                variant={viewer.canSubmit ? "primary" : "secondary"}
                onPress={() => router.push({ pathname: "/dare/[id]/submit", params: { id: campaign.id } })}
              />
            </Card>
          ) : null}
          {viewer.canJoin ? (
            <View style={{ gap: 8 }}>
              <ErrorText message={joinError} />
              <Button label="Do the dare" icon="flash" onPress={onJoin} loading={joining} />
              <Text style={[text.small, { textAlign: "center" }]}>Players can’t predict on their own dare.</Text>
            </View>
          ) : null}
          {viewer.canPredict || viewer.role === "predictor" ? (
            <PredictCard campaignId={campaignId} lockedSide={market?.position?.side ?? null} canPredict={viewer.canPredict} />
          ) : null}
          {!viewer.role && !viewer.canJoin && !viewer.canPredict ? <Text style={text.small}>Joining and predictions are closed.</Text> : null}
        </>
      )}
    </Screen>
  );
}

function PredictCard({ campaignId, lockedSide, canPredict }: { campaignId: Id<"campaigns">; lockedSide: Side | null; canPredict: boolean }) {
  const [side, setSide] = useState<Side>(lockedSide ?? "YES");
  const [amount, setAmount] = useState("10");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(newRequestId);
  const place = useMutation(api.predictions.place);
  const activeSide = lockedSide ?? side;
  const credits = Number(amount);
  const stakeUnits = Number.isFinite(credits) && credits > 0 ? Math.round(credits * UNITS_PER_CREDIT) : 0;
  const tooLarge = stakeUnits > MAX_STAKE_UNITS;
  const validStake = stakeUnits > 0 && !tooLarge;
  const quote = useQuery(api.predictions.quote, validStake && canPredict ? { campaignId, side: activeSide, stakeUnits } : "skip");

  const onPlace = async () => {
    setError(null);
    setPending(true);
    try {
      await place({ campaignId, side: activeSide, stakeUnits, requestId });
      setRequestId(newRequestId());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(false);
    }
  };

  if (!canPredict) {
    return <Text style={text.small}>Predictions are closed. Your stake settles after review.</Text>;
  }

  return (
    <Card style={{ gap: 14 }}>
      <View style={styles.between}>
        <Text style={styles.blockTitle}>Predict</Text>
        <Pill label="Play credits" />
      </View>
      <View style={styles.sides}>
        <Button label="Yes" variant="yes" selected={activeSide === "YES"} disabled={!!lockedSide && lockedSide !== "YES"} onPress={() => setSide("YES")} style={{ flex: 1 }} />
        <Button label="No" variant="no" selected={activeSide === "NO"} disabled={!!lockedSide && lockedSide !== "NO"} onPress={() => setSide("NO")} style={{ flex: 1 }} />
      </View>
      <View style={styles.amountBox}>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          style={styles.amountInput}
          selectionColor={colors.accent}
          accessibilityLabel="Stake in credits"
        />
        <Text style={styles.amountUnit}>cr</Text>
      </View>
      <View style={styles.quick}>
        {["10", "25", "50", "100"].map((v) => (
          <Chip key={v} label={v} selected={amount === v} onPress={() => setAmount(v)} />
        ))}
      </View>
      {quote ? (
        <View style={{ gap: 8 }}>
          <Row label="Est. if right" value={formatCredits(quote.estimatedGrossPayoutUnits)} tone="positive" />
          <Row label="Max loss" value={formatCredits(quote.maximumLossUnits)} />
        </View>
      ) : null}
      <ErrorText message={tooLarge ? `Max stake is ${formatCredits(MAX_STAKE_UNITS)}.` : error} />
      <Button
        label={`Predict ${activeSide === "YES" ? "Yes" : "No"}`}
        onPress={onPlace}
        loading={pending}
        disabled={!validStake || (quote !== undefined && !quote.eligible)}
      />
      <Text style={[text.small, { textAlign: "center" }]}>
        {lockedSide ? `You’re on ${lockedSide}.` : "Your side locks after one prediction."} Estimates, not odds.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  sponsorRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  sponsor: { flex: 1, color: colors.muted, ...font.callout, fontWeight: "500" },
  title: { color: colors.text, ...font.largeTitle, fontSize: 30, lineHeight: 36 },
  block: { gap: 6 },
  blockTitle: { color: colors.text, ...font.headline },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  bar: { flexDirection: "row", height: 8, borderRadius: 4, overflow: "hidden", gap: 3 },
  barYes: { backgroundColor: colors.positive, borderRadius: 4 },
  barNo: { backgroundColor: colors.negative, borderRadius: 4 },
  splitText: { ...font.footnote, fontWeight: "600" },
  sides: { flexDirection: "row", gap: 10 },
  amountBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 18,
  },
  amountInput: { flex: 1, minHeight: 60, color: colors.text, fontSize: 28, fontWeight: "700" },
  amountUnit: { color: colors.muted, ...font.headline },
  quick: { flexDirection: "row", gap: 8 },
});

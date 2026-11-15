import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { Button, Card, CenterMessage, ErrorText, Loading, Pill, Row, SectionTitle, text } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useNow } from "@/hooks/useNow";
import { campaignPhase, poolSplit } from "@/lib/campaign";
import { UNITS_PER_CREDIT, errorMessage, formatCountdown, formatCredits, formatTime, formatUsd, newRequestId } from "@/lib/format";
import { colors, radius } from "@/lib/theme";

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
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.rowWrap}>
        <Pill label={`Sponsored by ${campaign.sponsorName}`} tone="accent" />
        <Pill label={phase.target ? `${phase.label} · ${formatCountdown(phase.target, now)}` : phase.label} tone={phase.tone} />
        {campaign.isDemo ? <Pill label="Demo sponsor" /> : null}
      </View>
      <Text style={styles.title}>{campaign.title}</Text>
      <Text style={text.body}>{campaign.description}</Text>

      <Card>
        <Text style={styles.reward}>{formatUsd(campaign.rewardUsdCents)}</Text>
        <Text style={text.small}>
          Fixed prize per winner · {campaign.winnerCount} {campaign.winnerCount === 1 ? "winner" : "winners"} · earliest approved
          completions win. Sandbox demo: rewards are recorded, not paid out.
        </Text>
        <Row label="Participants" value={String(campaign.participantCount)} />
        <Row label="Predictions close" value={formatTime(campaign.predictionClosesAt)} />
        <Row label="Attempts start" value={formatTime(campaign.attemptStartsAt)} />
        <Row label="Evidence due" value={formatTime(campaign.deadlineAt)} />
      </Card>

      <Card>
        <SectionTitle>Completion criteria</SectionTitle>
        <Text style={text.body}>{campaign.criteria}</Text>
      </Card>

      {campaign.outcome ? (
        <Card>
          <SectionTitle>Outcome</SectionTitle>
          <Text style={styles.outcome}>{campaign.outcome === "VOID" ? "Voided · stakes refunded" : campaign.outcome}</Text>
        </Card>
      ) : null}

      <Card>
        <SectionTitle right={split ? <Text style={text.small}>{formatCredits(split.total)} pooled</Text> : null}>
          Will anyone complete it?
        </SectionTitle>
        {split ? (
          <View style={{ gap: 8 }}>
            <View style={styles.bar}>
              <View style={[styles.barYes, { flex: Math.max(split.yes, 1) }]} />
              <View style={[styles.barNo, { flex: Math.max(split.no, 1) }]} />
            </View>
            <View style={styles.row}>
              <Text style={[styles.splitText, { color: colors.positive }]}>YES {split.yes}%</Text>
              <Text style={[styles.splitText, { color: colors.negative }]}>NO {split.no}%</Text>
            </View>
            <Text style={text.small}>Share of play credits staked on each side — crowd sentiment, not odds.</Text>
          </View>
        ) : (
          <Text style={text.small}>No predictions yet. Be the first to call it.</Text>
        )}
        {market?.position ? (
          <Row
            label="Your position"
            value={`${market.position.side} · ${formatCredits(market.position.stakeUnits)}${
              market.position.payoutUnits !== null ? ` → ${formatCredits(market.position.payoutUnits)}` : ""
            }`}
            tone={market.position.side === "YES" ? "positive" : "negative"}
          />
        ) : null}
      </Card>

      {!isAuthenticated ? (
        <Card>
          <Text style={text.body}>Sign in to take this dare or make a prediction.</Text>
          <Button label="Sign in" onPress={() => router.push("/sign-in")} />
        </Card>
      ) : viewer.role === "reviewer" ? (
        <Card>
          <Text style={text.body}>You’re reviewing this campaign for its sponsor, so you can’t participate or predict.</Text>
        </Card>
      ) : (
        <>
          {viewer.role === "participant" ? (
            <Card>
              <SectionTitle>You’re in</SectionTitle>
              <Text style={text.body}>
                {viewer.canSubmit
                  ? "Record one continuous video that meets the criteria and submit it before the deadline."
                  : now < campaign.attemptStartsAt
                    ? `Attempts open ${formatTime(campaign.attemptStartsAt)}. Get ready.`
                    : "Evidence submission is closed."}
              </Text>
              <Button
                label={viewer.canSubmit ? "Submit evidence" : "View my submissions"}
                onPress={() => router.push({ pathname: "/dare/[id]/submit", params: { id: campaign.id } })}
              />
            </Card>
          ) : null}
          {viewer.canJoin ? (
            <Card>
              <SectionTitle>Do the dare</SectionTitle>
              <Text style={text.body}>Join before attempts start. Participants can’t make predictions on this dare.</Text>
              <ErrorText message={joinError} />
              <Button label="DO THE DARE" onPress={onJoin} loading={joining} />
            </Card>
          ) : null}
          {viewer.canPredict || viewer.role === "predictor" ? (
            <PredictCard campaignId={campaignId} lockedSide={market?.position?.side ?? null} canPredict={viewer.canPredict} />
          ) : null}
          {!viewer.role && !viewer.canJoin && !viewer.canPredict ? (
            <Card>
              <Text style={text.body}>Joining and predictions are closed for this dare.</Text>
            </Card>
          ) : null}
        </>
      )}
    </ScrollView>
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
    return (
      <Card>
        <Text style={text.body}>Predictions are closed. Your stake settles when the sponsor finishes review.</Text>
      </Card>
    );
  }

  return (
    <Card>
      <SectionTitle>Predict</SectionTitle>
      <Text style={text.small}>
        Free play credits only. {lockedSide ? `You’re on ${lockedSide}; you can add to it.` : "Your side locks after your first prediction."}{" "}
        Predictors can’t join this dare.
      </Text>
      <View style={styles.row}>
        <Button label="YES" variant="yes" selected={activeSide === "YES"} disabled={!!lockedSide && lockedSide !== "YES"} onPress={() => setSide("YES")} style={{ flex: 1 }} />
        <Button label="NO" variant="no" selected={activeSide === "NO"} disabled={!!lockedSide && lockedSide !== "NO"} onPress={() => setSide("NO")} style={{ flex: 1 }} />
      </View>
      <View style={styles.amountRow}>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          style={styles.amountInput}
          accessibilityLabel="Stake in credits"
        />
        <Text style={text.strong}>credits</Text>
      </View>
      {quote ? (
        <View style={{ gap: 6 }}>
          <Row label="Estimated payout if right" value={formatCredits(quote.estimatedGrossPayoutUnits)} tone="positive" />
          <Row label="Estimated profit" value={formatCredits(quote.estimatedNetProfitUnits)} />
          <Row label="Maximum loss" value={formatCredits(quote.maximumLossUnits)} tone="negative" />
          <Text style={text.small}>{quote.label}</Text>
        </View>
      ) : null}
      <ErrorText message={tooLarge ? `Maximum stake is ${formatCredits(MAX_STAKE_UNITS)}.` : error} />
      <Button
        label={`Predict ${activeSide}`}
        variant={activeSide === "YES" ? "yes" : "no"}
        onPress={onPlace}
        loading={pending}
        disabled={!validStake || (quote !== undefined && !quote.eligible)}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16, paddingBottom: 48, maxWidth: 680, width: "100%", alignSelf: "center" },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  title: { color: colors.text, fontSize: 30, fontWeight: "900", lineHeight: 36 },
  reward: { color: colors.text, fontSize: 40, fontWeight: "900" },
  outcome: { color: colors.text, fontSize: 28, fontWeight: "900" },
  bar: { flexDirection: "row", height: 12, borderRadius: 6, overflow: "hidden", gap: 2 },
  barYes: { backgroundColor: colors.positive },
  barNo: { backgroundColor: colors.negative },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  splitText: { fontSize: 16, fontWeight: "800" },
  amountRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  amountInput: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    paddingHorizontal: 16,
  },
});

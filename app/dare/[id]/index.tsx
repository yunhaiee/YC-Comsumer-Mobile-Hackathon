import { useConvexAuth, useMutation, useQuery } from "convex/react";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import { useState, type ReactNode } from "react";
import { Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DareActionBar, DareHero, OddsCard, RulesRow, SponsorRow, StatCard } from "@/components/dare";
import { BetSheet, TakeDareSheet, type Side } from "@/components/dare-sheets";
import { CenterMessage, IconButton, Loading, NavHeader, Screen } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useNow } from "@/hooks/useNow";
import { PARTICIPANT_LIMIT, campaignPhase, campaignRules, poolSplit, spotsLeft } from "@/lib/campaign";
import { demoDare, type DemoDare } from "@/lib/demo-dares";
import { errorMessage, formatUsd, newRequestId } from "@/lib/format";
import { dare } from "@/lib/theme";

const PRESET_STAKES = [10, 25, 50, 100];
const DEFAULT_STAKE = 25;
const ACTION_BAR_HEIGHT = 74;

type DetailProps = {
  id: string;
  title: string;
  sponsorName: string;
  rewardCents: number;
  spotsLeft: number;
  spotsTotal: number;
  yesPercent: number | null;
  rules: string[];
  heroDeadline: number | null;
  winUpToCents: number | undefined;
  bet: { disabled: boolean; onPress: () => void };
  take: { label: string; disabled: boolean; onPress: () => void };
  sheets: ReactNode;
};

function DareDetail(props: DetailProps) {
  const insets = useSafeAreaInsets();
  const share = () =>
    Share.share({ message: `${props.title}: ${Linking.createURL(`/dare/${props.id}`)}` }).catch(() => undefined);
  return (
    <View style={styles.root}>
      <Screen
        tabBar={false}
        contentStyle={[styles.content, { paddingBottom: ACTION_BAR_HEIGHT + Math.max(insets.bottom, 14) + 24 }]}
      >
        <NavHeader right={<IconButton icon="share-outline" label="Share dare" onPress={share} />} />
        <View style={styles.hero}>
          <DareHero sponsorName={props.sponsorName} deadline={props.heroDeadline} />
        </View>
        <View style={styles.sponsor}>
          <SponsorRow name={props.sponsorName} />
          <Text style={styles.title} accessibilityRole="header">
            {props.title}
          </Text>
        </View>
        <View style={styles.stats}>
          <StatCard label="Reward" value={formatUsd(props.rewardCents)} />
          <StatCard label="Spots left" value={String(props.spotsLeft)} total={props.spotsTotal} />
        </View>
        <View style={styles.block}>
          <OddsCard yesPercent={props.yesPercent} />
        </View>
        <View style={styles.block}>
          <RulesRow rules={props.rules} />
        </View>
      </Screen>
      <DareActionBar
        bet={{ label: "Bet", sub: props.winUpToCents === undefined ? "" : `Win up to ${formatUsd(props.winUpToCents)}`, ...props.bet }}
        take={{ sub: `Earn ${formatUsd(props.rewardCents)}`, ...props.take }}
      />
      {props.sheets}
    </View>
  );
}

export default function DareDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const demo = demoDare(id);
  return demo ? <DemoDareDetail dare={demo} /> : <LiveDareDetail campaignId={id as Id<"campaigns">} />;
}

function LiveDareDetail({ campaignId }: { campaignId: Id<"campaigns"> }) {
  const now = useNow();
  const { isAuthenticated } = useConvexAuth();
  const campaign = useQuery(api.campaigns.get, { campaignId });
  const ready = !!campaign;
  const market = useQuery(api.predictions.getMarket, ready ? { campaignId } : "skip");
  const defaultUnits = DEFAULT_STAKE * 100;
  const yesQuote = useQuery(api.predictions.quote, ready ? { campaignId, side: "YES", stakeUnits: defaultUnits } : "skip");
  const noQuote = useQuery(api.predictions.quote, ready ? { campaignId, side: "NO", stakeUnits: defaultUnits } : "skip");
  const join = useMutation(api.campaigns.join);
  const place = useMutation(api.predictions.place);

  const [sheet, setSheet] = useState<"bet" | "take" | null>(null);
  const [side, setSide] = useState<Side>("YES");
  const [stake, setStake] = useState<number | null>(DEFAULT_STAKE);
  const [requestId, setRequestId] = useState(newRequestId);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lockedSide = market?.position?.side ?? null;
  const activeSide = lockedSide ?? side;
  const stakeUnits = stake && stake <= 10_000 ? stake * 100 : 0;
  const quote = useQuery(
    api.predictions.quote,
    ready && sheet === "bet" && stakeUnits > 0 ? { campaignId, side: activeSide, stakeUnits } : "skip",
  );

  if (campaign === undefined) return <Loading />;
  if (campaign === null) return <CenterMessage title="Dare not found" body="It may be unpublished or removed." />;

  const viewer = campaign.viewer;
  const split = market ? poolSplit(market.yesStakeUnits, market.noStakeUnits) : null;
  const spots = spotsLeft(campaign);
  const live = !campaign.outcome;
  const betOpen = live && now < campaign.predictionClosesAt;
  const joinOpen = live && now < campaign.attemptStartsAt && spots > 0;
  const isParticipant = viewer.role === "participant";
  const uploadOpen = live && now < campaign.deadlineAt;

  const open = (next: "bet" | "take") => {
    if (!isAuthenticated) {
      router.push("/sign-in");
      return;
    }
    setError(null);
    setSheet(next);
  };

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    setPending(true);
    try {
      await action();
      setSheet(null);
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setPending(false);
    }
  };

  const onConfirmPrediction = async () => {
    if (await run(() => place({ campaignId, side: activeSide, stakeUnits, requestId }))) setRequestId(newRequestId());
  };
  const onConfirmDare = () => run(() => join({ campaignId }));
  const onOpenSubmission = () => router.push({ pathname: "/dare/[id]/submit", params: { id: campaign.id } });

  const winUpToCents =
    yesQuote && noQuote ? Math.max(yesQuote.estimatedGrossPayoutUnits, noQuote.estimatedGrossPayoutUnits) : undefined;

  return (
    <DareDetail
      id={campaign.id}
      title={campaign.title}
      sponsorName={campaign.sponsorName}
      rewardCents={campaign.rewardUsdCents}
      spotsLeft={spots}
      spotsTotal={PARTICIPANT_LIMIT}
      yesPercent={split?.yes ?? null}
      rules={campaignRules(campaign.criteria)}
      heroDeadline={campaignPhase(campaign, now).target}
      winUpToCents={winUpToCents}
      bet={{ disabled: !betOpen || (isAuthenticated && !viewer.canPredict), onPress: () => open("bet") }}
      take={
        isParticipant
          ? { label: "Upload your attempt", disabled: !uploadOpen, onPress: onOpenSubmission }
          : { label: "Do the dare", disabled: !joinOpen || (isAuthenticated && !viewer.canJoin), onPress: () => open("take") }
      }
      sheets={
        <>
          <BetSheet
            visible={sheet === "bet"}
            onClose={() => setSheet(null)}
            closesAt={campaign.predictionClosesAt}
            yesPercent={split?.yes ?? null}
            side={activeSide}
            onSideChange={setSide}
            lockedSide={lockedSide}
            presets={PRESET_STAKES}
            stake={stake}
            onStakeChange={setStake}
            payoutCents={quote?.estimatedGrossPayoutUnits}
            onConfirm={onConfirmPrediction}
            pending={pending}
            disabled={!betOpen || !viewer.canPredict || quote?.eligible === false}
            error={error ?? (quote?.eligible === false ? "Not enough credits for this bet." : null)}
          />
          <TakeDareSheet
            visible={sheet === "take"}
            onClose={() => setSheet(null)}
            rewardCents={campaign.rewardUsdCents}
            spotsLeft={spots}
            spotsTotal={PARTICIPANT_LIMIT}
            rules={campaignRules(campaign.criteria)}
            uploadDeadlineAt={campaign.deadlineAt}
            onClaim={onConfirmDare}
            pending={pending}
            disabled={!joinOpen || !viewer.canJoin}
            error={error}
          />
        </>
      }
    />
  );
}

const DEMO_ERROR = "This is a demo dare. Open a live dare to bet or claim a spot.";

function DemoDareDetail({ dare: d }: { dare: DemoDare }) {
  const now = useNow();
  const [sheet, setSheet] = useState<"bet" | "take" | null>(null);
  const [side, setSide] = useState<Side>("YES");
  const [stake, setStake] = useState<number | null>(d.defaultStake);
  const [error, setError] = useState<string | null>(null);
  const open = now < d.deadlineAt;
  const payoutDollars = stake ? (d.payoutAtDefaultStake[side === "YES" ? "yes" : "no"] * stake) / d.defaultStake : undefined;
  const openSheet = (next: "bet" | "take") => {
    setError(null);
    setSheet(next);
  };

  return (
    <DareDetail
      id={d.id}
      title={d.title}
      sponsorName={d.sponsorName}
      rewardCents={d.bounty * 100}
      spotsLeft={d.availableSpots}
      spotsTotal={d.totalSpots}
      yesPercent={d.yesPercent}
      rules={d.rules}
      heroDeadline={d.deadlineAt}
      winUpToCents={Math.max(d.payoutAtDefaultStake.yes, d.payoutAtDefaultStake.no) * 100}
      bet={{ disabled: !open, onPress: () => openSheet("bet") }}
      take={{ label: "Do the dare", disabled: !open || d.availableSpots <= 0, onPress: () => openSheet("take") }}
      sheets={
        <>
          <BetSheet
            visible={sheet === "bet"}
            onClose={() => setSheet(null)}
            closesAt={d.deadlineAt}
            yesPercent={d.yesPercent}
            side={side}
            onSideChange={setSide}
            lockedSide={null}
            presets={d.presetStakes}
            stake={stake}
            onStakeChange={setStake}
            payoutCents={payoutDollars === undefined ? undefined : Math.round(payoutDollars * 100)}
            onConfirm={() => setError(DEMO_ERROR)}
            pending={false}
            disabled={!open}
            error={error}
          />
          <TakeDareSheet
            visible={sheet === "take"}
            onClose={() => setSheet(null)}
            rewardCents={d.bounty * 100}
            spotsLeft={d.availableSpots}
            spotsTotal={d.totalSpots}
            rules={d.rules}
            uploadDeadlineAt={d.deadlineAt}
            onClaim={() => setError(DEMO_ERROR)}
            pending={false}
            disabled={!open}
            error={error}
          />
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: dare.colors.bg },
  content: { paddingHorizontal: dare.space.screen, gap: 0 },
  hero: { marginTop: 8 },
  sponsor: { marginTop: 18, gap: 10 },
  title: { color: dare.colors.text, ...dare.type.detailTitle },
  stats: { flexDirection: "row", gap: 10, marginTop: 20 },
  block: { marginTop: 10 },
});

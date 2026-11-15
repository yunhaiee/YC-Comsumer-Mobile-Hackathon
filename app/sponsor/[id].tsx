import { useAction, useMutation, useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { openBrowserAsync } from "expo-web-browser";
import { useRef, useState } from "react";
import { Text, View } from "react-native";

import { Button, Card, Field, Loading, Notice, SponsorScreen, Status, errorText, money, newRequestId, styles, when } from "@/components/sponsor/ui";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const createCheckout = makeFunctionReference<"action", { campaignId: Id<"campaigns"> }, { checkoutUrl: string; sandbox: true }>("whop/checkout:create");

export default function SponsorCampaign() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const campaignId = id as Id<"campaigns">;
  const campaign = useQuery(api.campaigns.get, { campaignId });
  const evidence = useQuery(api.submissions.listForReview, campaign?.viewer.role === "reviewer" ? { campaignId } : "skip");

  if (campaign === undefined) {
    return (
      <SponsorScreen title="Campaign">
        <Loading />
      </SponsorScreen>
    );
  }
  if (campaign === null) {
    return (
      <SponsorScreen title="Campaign not found">
        <Notice>This campaign doesn’t exist or isn’t owned by your sponsor account.</Notice>
      </SponsorScreen>
    );
  }

  const unpaid = campaign.state === "draft" || campaign.state === "awaiting_payment";

  return (
    <SponsorScreen title={campaign.title}>
      <Status state={campaign.state} />
      <Text style={styles.body}>{campaign.description}</Text>
      <Card>
        <Text style={styles.eyebrow}>CRITERIA</Text>
        <Text style={styles.body}>{campaign.criteria}</Text>
        <View style={styles.divider} />
        <Text style={styles.body}>
          <Text style={styles.strong}>{campaign.winnerCount} × {money(campaign.rewardUsdCents)}</Text> represented reward ({money(campaign.winnerCount * campaign.rewardUsdCents)} sandbox commitment)
        </Text>
        <Text style={styles.body}>Predictions close {when(campaign.predictionClosesAt)}</Text>
        <Text style={styles.body}>Attempts start {when(campaign.attemptStartsAt)}</Text>
        <Text style={styles.body}>Evidence due {when(campaign.deadlineAt)}</Text>
        <Text style={styles.body}>Review closes {when(campaign.reviewDeadlineAt)}</Text>
      </Card>
      {unpaid ? <Checkout campaignId={campaign.id} /> : null}
      <Card>
        <Text style={styles.eyebrow}>PARTICIPATION</Text>
        <Text style={styles.body}>
          <Text style={styles.strong}>{campaign.participantCount}</Text> participants · <Text style={styles.strong}>{campaign.submissionCount}</Text> videos · <Text style={styles.strong}>{campaign.pendingCount}</Text> awaiting review
        </Text>
        {campaign.outcome ? <Text style={styles.body}>Outcome: <Text style={styles.strong}>{campaign.outcome}</Text></Text> : null}
      </Card>
      {campaign.viewer.role === "reviewer" ? (
        <>
          <Text style={styles.heading}>Evidence</Text>
          {evidence === undefined ? <Loading>Loading evidence…</Loading> : null}
          {evidence?.length === 0 ? <Notice>No evidence submitted yet.</Notice> : null}
          {evidence?.map((submission) => (
            <Submission key={submission.id} submission={submission} canReview={campaign.viewer.canReview} />
          ))}
        </>
      ) : null}
    </SponsorScreen>
  );
}

function Checkout({ campaignId }: { campaignId: Id<"campaigns"> }) {
  const create = useAction(createCheckout);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const pay = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const { checkoutUrl } = await create({ campaignId });
      await openBrowserAsync(checkoutUrl);
      setMessage({ text: "Checkout closed. Campaign remains inactive until payment is confirmed. This page updates automatically when Whop confirms it.", error: false });
    } catch (caught) {
      setMessage({ text: errorText(caught), error: true });
    }
    setBusy(false);
  };

  return (
    <Card>
      <Text style={styles.eyebrow}>PAYMENT</Text>
      <Text style={styles.body}>Pay with Whop sandbox checkout to open predictions. Use test card 4242 4242 4242 4242. No real money moves.</Text>
      {message ? <Notice error={message.error}>{message.text}</Notice> : null}
      <Button onPress={pay} busy={busy}>Pay with Whop sandbox</Button>
    </Card>
  );
}

type Evidence = {
  id: Id<"submissions">;
  userId: Id<"users">;
  submittedAt: number;
  status: "pending" | "approved" | "rejected";
  reason: string | null;
  mediaUrl: string | null;
};

function Submission({ submission, canReview }: { submission: Evidence; canReview: boolean }) {
  const review = useMutation(api.submissions.review);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<{ key: string; id: string } | null>(null);

  const decide = async (decision: "approved" | "rejected") => {
    const key = `${decision}:${reason}`;
    if (request.current?.key !== key) request.current = { key, id: newRequestId() };
    setBusy(true);
    setError(null);
    try {
      await review({ submissionId: submission.id, decision, reason, requestId: request.current.id });
    } catch (caught) {
      setError(errorText(caught));
    }
    setBusy(false);
  };

  return (
    <Card>
      <View style={styles.between}>
        <Text style={styles.strong}>Participant …{submission.userId.slice(-6)}</Text>
        <Status state={submission.status} />
      </View>
      <Text style={styles.hint}>Submitted {when(submission.submittedAt)}</Text>
      {submission.mediaUrl ? <Player uri={submission.mediaUrl} /> : <Notice error>Video unavailable.</Notice>}
      {submission.status === "pending" && canReview ? (
        <>
          <Field label="Reason" value={reason} onChangeText={setReason} maxLength={1000} multiline hint="Required for approval or rejection. Shown to the participant." />
          {error ? <Notice error>{error}</Notice> : null}
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Button onPress={() => decide("approved")} disabled={!reason.trim()} busy={busy}>Approve</Button>
            </View>
            <View style={{ flex: 1 }}>
              <Button secondary onPress={() => decide("rejected")} disabled={!reason.trim()} busy={busy}>Reject</Button>
            </View>
          </View>
        </>
      ) : null}
      {submission.status === "pending" && !canReview ? <Notice>The review window is closed.</Notice> : null}
      {submission.reason ? <Text style={styles.body}>Reason: {submission.reason}</Text> : null}
    </Card>
  );
}

function Player({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);
  return <VideoView player={player} nativeControls contentFit="contain" style={{ width: "100%", aspectRatio: 9 / 16, maxHeight: 520, borderRadius: 16, backgroundColor: "#000" }} />;
}

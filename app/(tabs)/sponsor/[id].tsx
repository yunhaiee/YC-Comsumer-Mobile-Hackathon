import { useAuthToken } from "@convex-dev/auth/react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { openBrowserAsync } from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
import { Platform, Text, View } from "react-native";

import { DareHero } from "@/components/dare";
import { Button, Card, Field, Loading, Notice, SponsorScreen, Status, errorText, money, newRequestId, styles, when } from "@/components/sponsor/ui";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useNow } from "@/hooks/useNow";
import { campaignPhase } from "@/lib/campaign";

export default function SponsorCampaign() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const campaignId = id as Id<"campaigns">;
  const campaign = useQuery(api.campaigns.get, { campaignId });
  const now = useNow(60_000);
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
      <DareHero sponsorName={campaign.sponsorName} thumbnailUrl={campaign.thumbnailUrl} deadline={unpaid ? null : campaignPhase(campaign, now).target} />
      <Status state={campaign.state} />
      {campaign.paymentIssue === "late_payment_refund_required" ? <Notice error>Late sandbox payment. This dare won’t open.</Notice> : null}
      <Text style={styles.body}>{campaign.criteria}</Text>
      <Text style={styles.body}>
        <Text style={styles.strong}>{money(campaign.rewardUsdCents)}</Text> × {campaign.winnerCount} winners · ends {when(campaign.deadlineAt)}
      </Text>
      {unpaid ? <Checkout campaignId={campaign.id} /> : null}
      <Text style={styles.body}>
        <Text style={styles.strong}>{campaign.participantCount}</Text> joined · <Text style={styles.strong}>{campaign.submissionCount}</Text> videos · <Text style={styles.strong}>{campaign.pendingCount}</Text> to review
        {campaign.outcome ? <Text> · <Text style={styles.strong}>{campaign.outcome}</Text></Text> : null}
      </Text>
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
  const create = useAction(api.whop.checkout.create);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async () => {
    setBusy(true);
    setError(null);
    try {
      await openBrowserAsync((await create({ campaignId })).checkoutUrl);
    } catch (caught) {
      setError(errorText(caught));
    }
    setBusy(false);
  };

  return (
    <>
      {error ? <Notice error>{error}</Notice> : null}
      <Button onPress={pay} busy={busy}>Pay with Whop (test card 4242)</Button>
    </>
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
  const [watching, setWatching] = useState(false);
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
      {!submission.mediaUrl ? <Notice error>Video unavailable.</Notice> : watching ? <Player uri={submission.mediaUrl} /> : null}
      {submission.mediaUrl ? <Button secondary onPress={() => setWatching(!watching)}>{watching ? "Hide video" : "Watch video"}</Button> : null}
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
  const token = useAuthToken();
  const [webUri, setWebUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web" || !token) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    fetch(uri, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setWebUri(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [uri, token]);

  if (!token || failed) return <Notice error>Video unavailable. Sign in again and retry.</Notice>;
  if (Platform.OS === "web") return webUri ? <VideoSurface source={{ uri: webUri }} /> : <Loading>Loading video…</Loading>;
  return <VideoSurface source={{ uri, headers: { Authorization: `Bearer ${token}` } }} />;
}

function VideoSurface({ source }: { source: { uri: string; headers?: Record<string, string> } }) {
  const player = useVideoPlayer(source);
  return <VideoView player={player} nativeControls contentFit="contain" style={{ width: "100%", aspectRatio: 9 / 16, maxHeight: 520, borderRadius: 16, backgroundColor: "#000" }} />;
}

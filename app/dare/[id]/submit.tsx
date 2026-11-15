import { useAuthToken } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Button, Card, CenterMessage, ErrorText, Loading, Pill, SectionTitle, text } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useNow } from "@/hooks/useNow";
import { errorMessage, formatCountdown, formatTime, newRequestId } from "@/lib/format";
import { colors, radius } from "@/lib/theme";

const MAX_BYTES = 25 * 1024 * 1024;
const TYPES = ["video/mp4", "video/quicktime", "video/webm"];

type Picked = { uri: string; mimeType: string; fileSize: number | null };

function mimeFor(asset: ImagePicker.ImagePickerAsset) {
  if (asset.mimeType && TYPES.includes(asset.mimeType)) return asset.mimeType;
  const name = (asset.fileName ?? asset.uri).toLowerCase();
  if (name.endsWith(".mov")) return "video/quicktime";
  if (name.endsWith(".webm")) return "video/webm";
  return "video/mp4";
}

export default function SubmitEvidenceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const campaignId = id as Id<"campaigns">;
  const now = useNow();
  const token = useAuthToken();
  const campaign = useQuery(api.campaigns.get, { campaignId });
  const mine = useQuery(api.submissions.mine, { campaignId });
  const generateUploadUrl = useMutation(api.submissions.generateUploadUrl);
  const submit = useMutation(api.submissions.submit);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [stage, setStage] = useState<"idle" | "uploading" | "submitting">("idle");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (campaign === undefined) return <Loading />;
  if (campaign === null) return <CenterMessage title="Dare not found" />;

  const choose = async (source: "camera" | "library") => {
    setError(null);
    setDone(false);
    const permission =
      source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(source === "camera" ? "Camera permission is needed to record evidence." : "Photo library permission is needed to pick a video.");
      return;
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["videos"], videoMaxDuration: 120, quality: 0.7 };
    const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > MAX_BYTES) {
      setError("That video is over 25 MB. Record a shorter clip.");
      return;
    }
    setPicked({ uri: asset.uri, mimeType: mimeFor(asset), fileSize: asset.fileSize ?? null });
  };

  const send = async () => {
    if (!picked || !token) return;
    setError(null);
    try {
      setStage("uploading");
      const body = await (await fetch(picked.uri)).blob();
      if (body.size > MAX_BYTES) throw new Error("That video is over 25 MB. Record a shorter clip.");
      const { uploadUrl, uploadToken } = await generateUploadUrl({ campaignId });
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": picked.mimeType },
        body,
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `Upload failed (${response.status}).`);
      }
      setStage("submitting");
      await submit({ campaignId, uploadToken, requestId: newRequestId() });
      setPicked(null);
      setDone(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setStage("idle");
    }
  };

  const canSubmit = campaign.viewer.canSubmit;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>{campaign.title}</Text>
      <Pill
        label={now < campaign.deadlineAt ? `Evidence due in ${formatCountdown(campaign.deadlineAt, now)}` : "Evidence closed"}
        tone={now < campaign.deadlineAt ? "positive" : "muted"}
      />
      <Card>
        <SectionTitle>Criteria</SectionTitle>
        <Text style={text.body}>{campaign.criteria}</Text>
        <Text style={text.small}>
          {campaign.sponsorName} reviews every submission. Earliest approved completions win the {campaign.winnerCount}{" "}
          {campaign.winnerCount === 1 ? "prize" : "prizes"}.
        </Text>
      </Card>

      {canSubmit ? (
        <Card>
          <SectionTitle>Your evidence</SectionTitle>
          {picked ? <Preview uri={picked.uri} /> : <Text style={text.small}>One continuous video, up to 25 MB.</Text>}
          <View style={styles.row}>
            <Button label="Record" variant="secondary" onPress={() => choose("camera")} disabled={stage !== "idle"} style={{ flex: 1 }} />
            <Button label="Choose video" variant="secondary" onPress={() => choose("library")} disabled={stage !== "idle"} style={{ flex: 1 }} />
          </View>
          <ErrorText message={error} />
          {done ? <Text style={[text.strong, { color: colors.positive }]}>Submitted. The sponsor will review it.</Text> : null}
          <Button
            label={stage === "uploading" ? "Uploading…" : stage === "submitting" ? "Submitting…" : "Submit evidence"}
            onPress={send}
            loading={stage !== "idle"}
            disabled={!picked || !token}
          />
        </Card>
      ) : (
        <Card>
          <Text style={text.body}>
            {campaign.viewer.role !== "participant"
              ? "Join this dare before attempts start to submit evidence."
              : now < campaign.attemptStartsAt
                ? `Submissions open ${formatTime(campaign.attemptStartsAt)}.`
                : "Submissions are closed for this dare."}
          </Text>
        </Card>
      )}

      <Card>
        <SectionTitle>Submissions</SectionTitle>
        {mine === undefined ? (
          <Text style={text.small}>Loading…</Text>
        ) : mine.length === 0 ? (
          <Text style={text.small}>Nothing submitted yet.</Text>
        ) : (
          mine.map((s) => (
            <View key={s.id} style={styles.submission}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={text.strong}>{formatTime(s.submittedAt)}</Text>
                {s.reason ? <Text style={text.small}>{s.reason}</Text> : null}
              </View>
              <Pill
                label={s.status === "approved" ? "Verified" : s.status === "rejected" ? "Rejected" : "In review"}
                tone={s.status === "approved" ? "positive" : s.status === "rejected" ? "negative" : "warning"}
              />
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

function Preview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return <VideoView player={player} style={styles.video} contentFit="cover" nativeControls />;
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16, paddingBottom: 48, maxWidth: 680, width: "100%", alignSelf: "center" },
  title: { color: colors.text, fontSize: 26, fontWeight: "900" },
  row: { flexDirection: "row", gap: 10 },
  video: { width: "100%", aspectRatio: 9 / 16, maxHeight: 420, borderRadius: radius.md, backgroundColor: colors.background },
  submission: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
});

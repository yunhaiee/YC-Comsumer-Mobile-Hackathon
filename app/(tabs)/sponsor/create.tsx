import * as ImagePicker from "expo-image-picker";
import { useAction, useMutation } from "convex/react";
import { router } from "expo-router";
import { openBrowserAsync } from "expo-web-browser";
import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Button, Field, Notice, SponsorScreen, errorText, money, styles } from "@/components/sponsor/ui";
import { api } from "@/convex/_generated/api";
import { colors } from "@/lib/theme";

const MINUTE = 60_000;
const DURATIONS = [
  { label: "5m", ms: 5 * MINUTE },
  { label: "1h", ms: 60 * MINUTE },
  { label: "24h", ms: 24 * 60 * MINUTE },
  { label: "3d", ms: 3 * 24 * 60 * MINUTE },
];

export default function CreateDare() {
  const uploadUrl = useMutation(api.campaigns.generateThumbnailUploadUrl);
  const createDraft = useMutation(api.campaigns.createDraft);
  const checkout = useAction(api.whop.checkout.create);
  const [title, setTitle] = useState("");
  const [rules, setRules] = useState("");
  const [thumbnail, setThumbnail] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [reward, setReward] = useState("100");
  const [people, setPeople] = useState("5");
  const [duration, setDuration] = useState(DURATIONS[1].ms);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const winnerCount = Number(people);
  const rewardUsdCents = Math.round(Number(reward) * 100);
  const valid =
    title.trim().length > 0 &&
    Number.isInteger(winnerCount) && winnerCount >= 1 && winnerCount <= 20 &&
    rewardUsdCents >= 100 && rewardUsdCents <= 100_000;

  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [16, 9], quality: 0.7 });
    if (!result.canceled) setThumbnail(result.assets[0]);
  };

  const post = async () => {
    setBusy(true);
    setError(null);
    try {
      let thumbnailId;
      if (thumbnail) {
        const body = await (await fetch(thumbnail.uri)).blob();
        const response = await fetch(await uploadUrl({}), { method: "POST", headers: { "Content-Type": thumbnail.mimeType ?? "image/jpeg" }, body });
        if (!response.ok) throw new Error("Thumbnail upload failed.");
        thumbnailId = (await response.json()).storageId;
      }
      const predictionClosesAt = Date.now() + duration + MINUTE;
      const campaignId = await createDraft({
        templateId: "custom",
        title: title.trim(),
        rules: rules.trim() || undefined,
        thumbnailId,
        winnerCount,
        rewardUsdCents,
        predictionClosesAt,
        attemptStartsAt: predictionClosesAt,
        deadlineAt: predictionClosesAt + duration,
      });
      const { checkoutUrl } = await checkout({ campaignId });
      router.replace({ pathname: "/sponsor/[id]", params: { id: campaignId } });
      await openBrowserAsync(checkoutUrl);
    } catch (caught) {
      setError(caught instanceof Error && !("data" in caught) ? caught.message : errorText(caught));
      setBusy(false);
    }
  };

  return (
    <SponsorScreen title="New dare">
      <Pressable accessibilityRole="button" accessibilityLabel="Upload thumbnail" onPress={pick} style={local.thumb}>
        {thumbnail ? (
          <Image source={{ uri: thumbnail.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <>
            <Ionicons name="image-outline" size={28} color={colors.muted} />
            <Text style={styles.hint}>Upload thumbnail</Text>
          </>
        )}
      </Pressable>
      <Field label="Dare" value={title} onChangeText={setTitle} placeholder="Run a marathon in a suit" maxLength={80} />
      <Field label="Rules (optional)" value={rules} onChangeText={setRules} placeholder="Film it in one take." multiline maxLength={500} />
      <View style={local.row}>
        <View style={{ flex: 1 }}>
          <Field label="Prize ($ each)" keyboardType="number-pad" value={reward} onChangeText={setReward} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Winners" keyboardType="number-pad" value={people} onChangeText={setPeople} />
        </View>
      </View>
      <Text style={styles.label}>Predictions open for</Text>
      <View style={local.row}>
        {DURATIONS.map((d) => (
          <Pressable key={d.label} accessibilityRole="radio" accessibilityState={{ checked: d.ms === duration }} onPress={() => setDuration(d.ms)} style={[local.chip, d.ms === duration && local.chipOn]}>
            <Text style={styles.buttonText}>{d.label}</Text>
          </Pressable>
        ))}
      </View>
      {error ? <Notice error>{error}</Notice> : null}
      <Button onPress={post} disabled={!valid} busy={busy}>
        {valid ? `Pay ${money(winnerCount * rewardUsdCents)} & post` : "Post dare"}
      </Button>
    </SponsorScreen>
  );
}

const local = StyleSheet.create({
  thumb: { height: 190, borderRadius: 20, overflow: "hidden", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 8 },
  row: { flexDirection: "row", gap: 10 },
  chip: { flex: 1, minHeight: 46, borderRadius: 14, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
});

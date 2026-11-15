import { useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Button, Card, Field, Loading, Notice, SponsorScreen, errorText, money, styles } from "@/components/sponsor/ui";
import { api } from "@/convex/_generated/api";

const MINUTE = 60_000;

export default function CreateCampaign() {
  const config = useQuery(api.campaigns.templates, {});
  const createDraft = useMutation(api.campaigns.createDraft);
  const [templateId, setTemplateId] = useState<"balance-object" | "paper-plane">("balance-object");
  const [winners, setWinners] = useState("1");
  const [reward, setReward] = useState("25");
  const [cutoffMinutes, setCutoffMinutes] = useState("10");
  const [startMinutes, setStartMinutes] = useState("15");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!config) {
    return (
      <SponsorScreen title="New campaign">
        <Loading />
      </SponsorScreen>
    );
  }

  const { limits } = config;
  const winnerCount = Number(winners);
  const rewardUsdCents = Math.round(Number(reward) * 100);
  const cutoff = Number(cutoffMinutes) * MINUTE;
  const start = Number(startMinutes) * MINUTE;
  const duration = Number(durationMinutes) * MINUTE;

  const problem = !Number.isInteger(winnerCount) || winnerCount < limits.minWinnerCount || winnerCount > limits.maxWinnerCount
    ? `Winners must be a whole number from ${limits.minWinnerCount} to ${limits.maxWinnerCount}.`
    : !Number.isFinite(rewardUsdCents) || rewardUsdCents < limits.minRewardUsdCents || rewardUsdCents > limits.maxRewardUsdCents
      ? `Reward per winner must be ${money(limits.minRewardUsdCents)} to ${money(limits.maxRewardUsdCents)}.`
      : !(cutoff >= limits.minLeadMs)
        ? "Predictions must stay open for at least one minute."
        : !(start >= cutoff && start <= limits.maxStartLeadMs)
          ? "Attempts must start at or after the prediction cutoff, within 30 days."
          : !(duration >= limits.minAttemptDurationMs && start + duration <= limits.maxDeadlineLeadMs)
            ? "The attempt window must be at least one minute and end within 31 days."
            : null;

  const submit = async () => {
    setBusy(true);
    setError(null);
    const now = Date.now();
    try {
      const campaignId = await createDraft({
        templateId,
        winnerCount,
        rewardUsdCents,
        predictionClosesAt: now + cutoff,
        attemptStartsAt: now + start,
        deadlineAt: now + start + duration,
      });
      router.replace({ pathname: "/sponsor/[id]", params: { id: campaignId } });
    } catch (caught) {
      setError(errorText(caught));
      setBusy(false);
    }
  };

  return (
    <SponsorScreen title="New campaign">
      <Text style={styles.eyebrow}>CHALLENGE</Text>
      {config.templates.map((template) => (
        <Pressable
          key={template.id}
          accessibilityRole="radio"
          accessibilityState={{ checked: template.id === templateId }}
          onPress={() => setTemplateId(template.id)}
        >
          <View style={[styles.card, template.id === templateId && { borderColor: "#8054E8" }]}>
            <Text style={styles.heading}>{template.title}</Text>
            <Text style={styles.body}>{template.description}</Text>
            <Text style={styles.body}>
              <Text style={styles.strong}>Criteria: </Text>
              {template.criteria}
            </Text>
          </View>
        </Pressable>
      ))}
      <Card>
        <Field label="Winners" keyboardType="number-pad" value={winners} onChangeText={setWinners} hint="Earliest approved distinct participants win." />
        <Field label="Reward per winner (USD)" keyboardType="decimal-pad" value={reward} onChangeText={setReward} hint="A represented reward. No money is transferred to participants." />
        <Field label="Predictions close in (minutes)" keyboardType="number-pad" value={cutoffMinutes} onChangeText={setCutoffMinutes} />
        <Field label="Attempts start in (minutes)" keyboardType="number-pad" value={startMinutes} onChangeText={setStartMinutes} hint="Joining also closes when attempts start." />
        <Field label="Attempt window (minutes)" keyboardType="number-pad" value={durationMinutes} onChangeText={setDurationMinutes} hint="Evidence is due when the window ends. You then have 24 hours to review." />
      </Card>
      <Card>
        <Text style={styles.eyebrow}>SANDBOX CHARGE</Text>
        <Text style={styles.amount}>{problem ? "—" : money(winnerCount * rewardUsdCents)}</Text>
        <Text style={styles.body}>Winners × reward, with no DARE platform fee. You pay with Whop sandbox checkout on the next screen; the campaign opens only after Whop confirms payment.</Text>
      </Card>
      {problem ? <Notice error>{problem}</Notice> : null}
      {error ? <Notice error>{error}</Notice> : null}
      <Button onPress={submit} disabled={Boolean(problem)} busy={busy}>Create draft</Button>
    </SponsorScreen>
  );
}

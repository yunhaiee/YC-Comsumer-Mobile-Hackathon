import type { FunctionReturnType } from "convex/server";

import type { api } from "@/convex/_generated/api";

export type CampaignSummary = FunctionReturnType<typeof api.campaigns.list>["page"][number];

type Tone = "accent" | "positive" | "warning" | "muted";

export function campaignPhase(campaign: CampaignSummary, now: number): { label: string; target: number | null; tone: Tone } {
  if (campaign.outcome === "VOID") return { label: "Voided · refunded", target: null, tone: "muted" };
  if (campaign.outcome) return { label: `Resolved ${campaign.outcome}`, target: null, tone: "muted" };
  if (now < campaign.predictionClosesAt) return { label: "Predictions close", target: campaign.predictionClosesAt, tone: "accent" };
  if (now < campaign.attemptStartsAt) return { label: "Attempts start", target: campaign.attemptStartsAt, tone: "warning" };
  if (now < campaign.deadlineAt) return { label: "Evidence due", target: campaign.deadlineAt, tone: "positive" };
  return { label: "Sponsor reviewing", target: campaign.reviewDeadlineAt, tone: "warning" };
}

export const PARTICIPANT_LIMIT = 50;

export function spotsLeft(campaign: CampaignSummary) {
  return Math.max(0, Math.min(PARTICIPANT_LIMIT, campaign.winnerCount) - campaign.participantCount);
}

export function campaignRules(criteria: string) {
  return criteria
    .split(/\n+|(?<=[.!?])\s+(?=[A-Z])/)
    .map((rule) => rule.trim().replace(/\.$/, ""))
    .filter(Boolean);
}

export function poolSplit(yesUnits: number, noUnits: number) {
  const total = yesUnits + noUnits;
  if (total === 0) return null;
  const yes = Math.round((yesUnits / total) * 100);
  return { yes, no: 100 - yes, total };
}

export const DEMO_DARES_ENABLED = process.env.EXPO_PUBLIC_DARE_DEMO === "1";

const loadedAt = Date.now();

export type DemoDare = {
  id: string;
  sponsorName: string;
  title: string;
  bounty: number;
  availableSpots: number;
  totalSpots: number;
  yesPercent: number;
  presetStakes: number[];
  defaultStake: number;
  payoutAtDefaultStake: { yes: number; no: number };
  deadlineAt: number;
  rules: string[];
};

const DATA = [
  {
    id: "mcdonalds-big-mac-proposal",
    sponsorName: "McDonald's",
    title: "Propose to a Big Mac in a wedding dress",
    bounty: 500,
    availableSpots: 3,
    totalSpots: 10,
    yesPercent: 54,
    payoutAtDefaultStake: { yes: 46, no: 39 },
    secondsRemaining: 82781,
    rules: ["Wear a wedding dress to McDonald's", "Get on one knee and propose to a Big Mac", "Film it in one take, with permission"],
  },
  {
    id: "whop-logo-forehead",
    sponsorName: "Whop",
    title: "Tattoo the Whop logo on your forehead",
    bounty: 1000,
    availableSpots: 1,
    totalSpots: 5,
    yesPercent: 38,
    payoutAtDefaultStake: { yes: 62, no: 38 },
    secondsRemaining: 51125,
    rules: [
      "DRAFT: Get the Whop logo tattooed or shaved on your head",
      "DRAFT: Show the logo clearly in good light",
      "DRAFT: Film the reveal in one take",
    ],
  },
  {
    id: "cocacola-plank",
    sponsorName: "Coca-Cola",
    title: "Hold a 60s plank with an open Coke on your back",
    bounty: 250,
    availableSpots: 6,
    totalSpots: 20,
    yesPercent: 71,
    payoutAtDefaultStake: { yes: 33, no: 82 },
    secondsRemaining: 2530,
    rules: [
      "DRAFT: Balance an open, full can of Coca-Cola on your lower back",
      "DRAFT: Hold a forearm plank for 60 seconds without spilling",
      "DRAFT: Film it in one take with a visible timer",
    ],
  },
  {
    id: "suitsupply-marathon",
    sponsorName: "Suitsupply",
    title: "Run a marathon in a suit",
    bounty: 750,
    availableSpots: 2,
    totalSpots: 8,
    yesPercent: 23,
    payoutAtDefaultStake: { yes: 103, no: 31 },
    secondsRemaining: 196200,
    rules: [
      "DRAFT: Wear a full suit, shirt and tie the entire race",
      "DRAFT: Finish an official marathon",
      "DRAFT: Show your bib and finish time on camera",
    ],
  },
];

export const DEMO_DARES: DemoDare[] = DATA.map(({ secondsRemaining, ...dare }) => ({
  ...dare,
  presetStakes: [10, 25, 50, 100],
  defaultStake: 25,
  deadlineAt: loadedAt + secondsRemaining * 1000,
}));

export function demoDare(id: string | undefined) {
  return DEMO_DARES_ENABLED ? DEMO_DARES.find((dare) => dare.id === id) ?? null : null;
}

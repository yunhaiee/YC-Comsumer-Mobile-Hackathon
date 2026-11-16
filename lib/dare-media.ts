import type { ImageSourcePropType } from "react-native";

export type SponsorMedia = {
  hero: ImageSourcePropType;
  logo: ImageSourcePropType;
  logoTileBg: string;
  logoMode: "icon-on-tile" | "full-bleed";
};

const MEDIA: Record<string, SponsorMedia> = {
  mcdonalds: {
    hero: require("@/assets/dares/hero-mcdonalds.webp"),
    logo: require("@/assets/dares/logo-mcdonalds-arches.png"),
    logoTileBg: "#DA101C",
    logoMode: "icon-on-tile",
  },
  whop: {
    hero: require("@/assets/dares/hero-whop.jpg"),
    logo: require("@/assets/dares/logo-whop.png"),
    logoTileBg: "#FA4616",
    logoMode: "full-bleed",
  },
  cocacola: {
    hero: require("@/assets/dares/hero-cocacola.jpg"),
    logo: require("@/assets/dares/logo-cocacola.png"),
    logoTileBg: "#F40009",
    logoMode: "full-bleed",
  },
  suitsupply: {
    hero: require("@/assets/dares/hero-suitsupply.jpg"),
    logo: require("@/assets/dares/logo-suitsupply.png"),
    logoTileBg: "#F5F5F5",
    logoMode: "full-bleed",
  },
};

export function sponsorMedia(sponsorName: string): SponsorMedia | null {
  return MEDIA[sponsorName.toLowerCase().replace(/[^a-z]/g, "")] ?? null;
}

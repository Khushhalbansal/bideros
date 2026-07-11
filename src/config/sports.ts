// Single source of truth for sport theming across hero, /sport/$slug, auth reskin, dashboard picker.
export interface SportConfig {
  slug: "cricket" | "football" | "pickleball" | "badminton";
  name: string;
  tag: string;
  description: string;
  cta: string;
  image: string;
  bgImage: string;
  bg: string; // solid fallback bg
  textLeft: string;
  textRight: string;
  accent: string; // hex, drives glows + auth reskin
  gradientFrom: string;
  gradientTo: string;
}

export const SPORTS: SportConfig[] = [
  {
    slug: "cricket",
    name: "STRIKE",
    tag: "CRICKET CLOSER",
    description: "One strike rewrites the scoreboard — Strike turns your bid into the winning six.",
    cta: "Take Strike",
    image: "/assets/child_cricket.png",
    bgImage: "/assets/bg_cricket.jpg",
    bg: "#548c5a",
    textLeft: "AUC",
    textRight: "TION",
    accent: "#00ffcc",
    gradientFrom: "#0d3a1f",
    gradientTo: "#548c5a",
  },
  {
    slug: "football",
    name: "GOAL",
    tag: "FOOTBALL FINISHER",
    description:
      "One goal changes everything — Goal turns the final whistle into your victory lap.",
    cta: "Score The Bid",
    image: "/assets/child_football.png",
    bgImage: "/assets/bg_football.jpg",
    bg: "#3e6c99",
    textLeft: "GAME",
    textRight: "DAY",
    accent: "#33ccff",
    gradientFrom: "#0a1b3a",
    gradientTo: "#3e6c99",
  },
  {
    slug: "pickleball",
    name: "DINK",
    tag: "KITCHEN CONTROLLER",
    description:
      "One soft dink, one hard truth — Dink wins the point nobody sees coming and seals the bid quietly.",
    cta: "Dink The Bid",
    image: "/assets/child_pickleball.png",
    bgImage: "/assets/bg_pickleball.jpg",
    bg: "#8c4c7a",
    textLeft: "COURT",
    textRight: "SIDE",
    accent: "#ff66ff",
    gradientFrom: "#2a0f3a",
    gradientTo: "#8c4c7a",
  },
  {
    slug: "badminton",
    name: "SMASH",
    tag: "BADMINTON BIDDER",
    description:
      "One smash and it's game over — Smash brings precision power that seals the bid in a blink.",
    cta: "Smash Your Bid",
    image: "/assets/child_badminton.png",
    bgImage: "/assets/bg_badminton.jpg",
    bg: "#bd5353",
    textLeft: "SMASH",
    textRight: "POINT",
    accent: "#ff5500",
    gradientFrom: "#3a0f0f",
    gradientTo: "#bd5353",
  },
];

export function getSport(slug?: string): SportConfig {
  return SPORTS.find((s) => s.slug === slug) ?? SPORTS[0];
}

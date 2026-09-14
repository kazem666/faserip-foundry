export const RANKS = [
  { id: "shift0", label: "Shift 0", abbr: "Sh0", min: 0, value: 0, max: 0 },
  { id: "feeble", label: "Feeble", abbr: "Fb", min: 1, value: 2, max: 2 },
  { id: "poor", label: "Poor", abbr: "Pr", min: 3, value: 4, max: 4 },
  { id: "typical", label: "Typical", abbr: "Ty", min: 5, value: 6, max: 7 },
  { id: "good", label: "Good", abbr: "Gd", min: 8, value: 10, max: 15 },
  { id: "excellent", label: "Excellent", abbr: "Ex", min: 16, value: 20, max: 25 },
  { id: "remarkable", label: "Remarkable", abbr: "Rm", min: 26, value: 30, max: 35 },
  { id: "incredible", label: "Incredible", abbr: "In", min: 36, value: 40, max: 45 },
  { id: "amazing", label: "Amazing", abbr: "Am", min: 46, value: 50, max: 62 },
  { id: "monstrous", label: "Monstrous", abbr: "Mn", min: 63, value: 75, max: 87 },
  { id: "unearthly", label: "Unearthly", abbr: "Un", min: 88, value: 100, max: 125 },
  { id: "shiftx", label: "Shift X", abbr: "ShX", min: 126, value: 150, max: 175 },
  { id: "shifty", label: "Shift Y", abbr: "ShY", min: 176, value: 200, max: 350 },
  { id: "shiftz", label: "Shift Z", abbr: "ShZ", min: 351, value: 500, max: 999 },
  { id: "cl1000", label: "Class 1000", abbr: "C1000", min: 1000, value: 1000, max: 1000 },
  { id: "cl3000", label: "Class 3000", abbr: "C3000", min: 3000, value: 3000, max: 3000 },
  { id: "cl5000", label: "Class 5000", abbr: "C5000", min: 5000, value: 5000, max: 5000 },
  { id: "beyond", label: "Beyond", abbr: "By", min: 99999, value: 99999, max: 99999 }
];

export const RANK_BY_ID = Object.fromEntries(RANKS.map((r) => [r.id, r]));

export const UNIVERSAL_TABLE = {
  shift0: { green: 66, yellow: 95, red: 100 },
  feeble: { green: 61, yellow: 91, red: 100 },
  poor: { green: 56, yellow: 86, red: 100 },
  typical: { green: 51, yellow: 81, red: 98 },
  good: { green: 46, yellow: 76, red: 98 },
  excellent: { green: 41, yellow: 71, red: 95 },
  remarkable: { green: 36, yellow: 66, red: 95 },
  incredible: { green: 31, yellow: 61, red: 91 },
  amazing: { green: 26, yellow: 56, red: 91 },
  monstrous: { green: 21, yellow: 51, red: 86 },
  unearthly: { green: 16, yellow: 46, red: 86 },
  shiftx: { green: 11, yellow: 41, red: 81 },
  shifty: { green: 7, yellow: 41, red: 81 },
  shiftz: { green: 4, yellow: 36, red: 76 },
  cl1000: { green: 2, yellow: 36, red: 76 },
  cl3000: { green: 2, yellow: 31, red: 71 },
  cl5000: { green: 2, yellow: 26, red: 66 },
  beyond: { green: 2, yellow: 21, red: 61 }
};

export const ABILITIES = ["fighting","agility","strength","endurance","reason","intuition","psyche"];
export const PHYSICAL = ["fighting","agility","strength","endurance"];
export const MENTAL = ["reason","intuition","psyche"];

export const BATTLE_EFFECTS = {
  blunt: { label: "Blunt Attack (Slugfest)", ability: "fighting", white: "Miss", green: "Hit", yellow: "Slam", red: "Stun" },
  edged: { label: "Edged Attack (Slugfest)", ability: "fighting", white: "Miss", green: "Hit", yellow: "Stun", red: "Kill" },
  shooting: { label: "Shooting", ability: "agility", white: "Miss", green: "Hit", yellow: "Bullseye", red: "Kill" },
  throwEdged: { label: "Edged Throwing", ability: "agility", white: "Miss", green: "Hit", yellow: "Stun", red: "Kill" },
  throwBlunt: { label: "Blunt Throwing", ability: "agility", white: "Miss", green: "Hit", yellow: "Bullseye", red: "Stun" },
  energy: { label: "Energy", ability: "agility", white: "Miss", green: "Hit", yellow: "Bullseye", red: "Kill" },
  force: { label: "Force", ability: "agility", white: "Miss", green: "Hit", yellow: "Bullseye", red: "Stun" },
  grappling: { label: "Grappling", ability: "strength", white: "Miss", green: "Miss", yellow: "Partial Hold", red: "Hold" },
  grabbing: { label: "Grabbing", ability: "strength", white: "Miss", green: "Take", yellow: "Grab", red: "Break" },
  escaping: { label: "Escaping", ability: "strength", white: "Miss", green: "Miss", yellow: "Escape", red: "Reverse" },
  charging: { label: "Charging", ability: "endurance", white: "Miss", green: "Hit", yellow: "Slam", red: "Stun" },
  dodging: { label: "Dodging", ability: "agility", white: "No Shift", green: "-2 CS", yellow: "-4 CS", red: "-6 CS" },
  evading: { label: "Evading", ability: "fighting", white: "Auto-Hit", green: "Evasion", yellow: "Evasion +1 CS", red: "Evasion +2 CS" },
  blocking: { label: "Blocking", ability: "strength", white: "-6 CS armor", green: "-4 CS armor", yellow: "-2 CS armor", red: "+1 CS armor" },
  catching: { label: "Catching", ability: "agility", white: "Auto-Hit", green: "Miss", yellow: "Damage", red: "Catch" },
  slamCheck: { label: "Slam Check (Endurance)", ability: "endurance", white: "Great Slam", green: "1 Area", yellow: "Stagger", red: "No Slam" },
  stunCheck: { label: "Stun Check (Endurance)", ability: "endurance", white: "Unconscious 1d10 turns", green: "Unconscious 1d10 turns", yellow: "Stunned 1 turn", red: "No Effect" },
  killCheck: { label: "Kill Check (Endurance)", ability: "endurance", white: "Endurance Loss", green: "Endurance Loss", yellow: "E/S (edged/shooting only)", red: "No Effect" }
};

export const MOVEMENT_AREAS = { shift0:0, feeble:1, poor:1, typical:2, good:2, excellent:3, remarkable:3, incredible:4, amazing:5, monstrous:6, unearthly:7, shiftx:8, shifty:9, shiftz:10, cl1000:20, cl3000:40, cl5000:60, beyond:99 };
export const THROW_RANGE = { shift0:0, feeble:1, poor:1, typical:1, good:2, excellent:3, remarkable:4, incredible:5, amazing:6, monstrous:7, unearthly:8, shiftx:10, shifty:15, shiftz:20, cl1000:99, cl3000:99, cl5000:99, beyond:99 };

export const ORIGINS = [
  { id: "altered", label: "Altered Human", column: 1, notes: "Column 1. After rolling, raise any one primary ability +1 CS." },
  { id: "mutant", label: "Mutant", column: 1, notes: "Column 1. +1 Endurance. +1 Power (max 5). Resources -1 CS. Starting Popularity 0." },
  { id: "hitech", label: "Hi-Tech", column: 3, notes: "Column 3. Reason +2 CS. Resources start Good. Powers come from equipment." },
  { id: "robot", label: "Robot", column: 4, notes: "Column 4. Popularity 0." },
  { id: "alien", label: "Alien", column: 5, notes: "Column 5. -1 Power (minimum 2). Resources start Poor. One Contact maximum." },
  { id: "magic", label: "Magic", column: 1, notes: "Treat as Altered Human unless the table agrees otherwise." },
  { id: "other", label: "Other", column: 1, notes: "Custom origin. Judge picks a generation column." }
];

export const RANDOM_RANKS = {
  1: [{id:"feeble",lo:1,hi:5},{id:"poor",lo:6,hi:10},{id:"typical",lo:11,hi:20},{id:"good",lo:21,hi:40},{id:"excellent",lo:41,hi:60},{id:"remarkable",lo:61,hi:80},{id:"incredible",lo:81,hi:96},{id:"amazing",lo:97,hi:100}],
  2: [{id:"feeble",lo:1,hi:5},{id:"poor",lo:6,hi:25},{id:"typical",lo:26,hi:75},{id:"good",lo:76,hi:95},{id:"excellent",lo:96,hi:100}],
  3: [{id:"feeble",lo:1,hi:5},{id:"poor",lo:6,hi:10},{id:"typical",lo:11,hi:40},{id:"good",lo:41,hi:80},{id:"excellent",lo:81,hi:95},{id:"remarkable",lo:96,hi:100}],
  4: [{id:"feeble",lo:1,hi:5},{id:"poor",lo:6,hi:10},{id:"typical",lo:11,hi:15},{id:"good",lo:16,hi:40},{id:"excellent",lo:41,hi:50},{id:"remarkable",lo:51,hi:70},{id:"incredible",lo:71,hi:90},{id:"amazing",lo:91,hi:98},{id:"monstrous",lo:99,hi:100}],
  5: [{id:"feeble",lo:1,hi:10},{id:"poor",lo:11,hi:20},{id:"typical",lo:21,hi:30},{id:"good",lo:31,hi:40},{id:"excellent",lo:41,hi:60},{id:"remarkable",lo:61,hi:70},{id:"incredible",lo:71,hi:80},{id:"amazing",lo:81,hi:95},{id:"monstrous",lo:96,hi:100}]
};

export const ORIGIN_TABLE = [
  { lo: 1, hi: 30, id: "altered" },
  { lo: 31, hi: 60, id: "mutant" },
  { lo: 61, hi: 90, id: "hitech" },
  { lo: 91, hi: 95, id: "robot" },
  { lo: 96, hi: 100, id: "alien" }
];

export const ABILITY_MODIFIER_TABLE = [
  { lo: 1, hi: 15, cs: -1, label: "-1 CS" },
  { lo: 16, hi: 50, cs: 0, label: "No change" },
  { lo: 51, hi: 70, cs: 1, label: "+1 CS" },
  { lo: 71, hi: 85, cs: 2, label: "+2 CS" },
  { lo: 86, hi: 95, cs: 3, label: "+3 CS" },
  { lo: 96, hi: 100, cs: 4, label: "+4 CS" }
];

export const SPECIAL_COUNT_TABLE = [
  { lo: 1, hi: 20, powers: [2, 4], talents: [1, 6], contacts: [0, 4] },
  { lo: 21, hi: 60, powers: [3, 4], talents: [2, 5], contacts: [1, 4] },
  { lo: 61, hi: 90, powers: [4, 4], talents: [3, 4], contacts: [2, 4] },
  { lo: 91, hi: 100, powers: [5, 5], talents: [4, 4], contacts: [3, 4] }
];

export const POWER_CATEGORIES = [
  { lo: 1, hi: 5, id: "resistances", label: "Resistances" },
  { lo: 6, hi: 10, id: "senses", label: "Senses" },
  { lo: 11, hi: 15, id: "movement", label: "Movement" },
  { lo: 16, hi: 25, id: "matter", label: "Matter Control" },
  { lo: 26, hi: 40, id: "energy", label: "Energy Control" },
  { lo: 41, hi: 55, id: "bodyControl", label: "Body Control" },
  { lo: 56, hi: 70, id: "distance", label: "Distance Attacks" },
  { lo: 71, hi: 75, id: "mental", label: "Mental Powers" },
  { lo: 76, hi: 90, id: "offensive", label: "Body Alterations / Offensive" },
  { lo: 91, hi: 100, id: "defensive", label: "Body Alterations / Defensive" }
];

export { POWER_CATALOG, TALENT_CATEGORIES, TALENT_CATALOG, CONTACT_TYPES, MATERIAL_EXAMPLES } from "./config-catalogs.mjs";

export function rankIndex(id) { return RANKS.findIndex((r) => r.id === id); }
export function shiftRank(id, cs = 0) {
  const i = rankIndex(id);
  if (i < 0) return "typical";
  return RANKS[Math.min(RANKS.length - 1, Math.max(0, i + cs))].id;
}
export function colorForRoll(rankId, roll) {
  const table = UNIVERSAL_TABLE[rankId] ?? UNIVERSAL_TABLE.typical;
  if (roll >= table.red) return "red";
  if (roll >= table.yellow) return "yellow";
  if (roll >= table.green) return "green";
  return "white";
}
export function rankLabel(id) {
  const r = RANK_BY_ID[id];
  return r ? `${r.label} (${r.value})` : id;
}
export function rankValue(id) { return RANK_BY_ID[id]?.value ?? 0; }
export function rankMin(id) { return RANK_BY_ID[id]?.min ?? 0; }
export function rankFromNumber(n) {
  const num = Number(n) || 0;
  if (num <= 0) return "shift0";
  for (const r of RANKS) if (num >= r.min && num <= r.max) return r.id;
  if (num >= 1000 && num < 3000) return "cl1000";
  if (num >= 3000 && num < 5000) return "cl3000";
  if (num >= 5000 && num < 99999) return "cl5000";
  return "beyond";
}
export function abilityNumber(abilityData) {
  const n = Number(abilityData?.number || 0);
  if (n > 0) return n;
  return rankValue(abilityData?.rank ?? "typical");
}
export function intensityNeeded(abilityRankId, intensityRankId) {
  if (!intensityRankId) return { color: "green", label: "Any color (no Intensity set)", automatic: false, impossible: false, delta: 0 };
  const delta = rankIndex(abilityRankId) - rankIndex(intensityRankId);
  const automatic = delta >= 3;
  const impossible = delta <= -2;
  let color = "green";
  if (delta === 0) color = "yellow";
  if (delta < 0) color = "red";
  let label = `Need ${color.toUpperCase()}`;
  if (automatic) label = "Automatic (Intensity 3+ ranks lower)";
  if (impossible) label = "Impossible (optional: Intensity more than 1 rank higher)";
  return { color, label, automatic, impossible, delta };
}
export function initiativeModifier(intuitionNumber) {
  const n = Number(intuitionNumber) || 0;
  if (n >= 75) return 6;
  if (n >= 51) return 5;
  if (n >= 41) return 4;
  if (n >= 31) return 3;
  if (n >= 21) return 2;
  if (n >= 11) return 1;
  return 0;
}
export function lookupTable(table, roll) {
  const n = Number(roll);
  return table.find((row) => n >= row.lo && n <= row.hi) ?? table[0];
}
export function rollOnColumn(column, roll) {
  const rows = RANDOM_RANKS[column] ?? RANDOM_RANKS[1];
  return lookupTable(rows, roll).id;
}
export function battleResult(columnId, color) {
  const col = BATTLE_EFFECTS[columnId];
  return col ? (col[color] ?? "") : "";
}
export function originById(id) {
  return ORIGINS.find((o) => o.id === id || o.label === id) ?? ORIGINS[0];
}

/** MHAC-9 Realms of Magic tables. Judge-toggled source. Original reconstruction, not reprinted text. */

export function isRomEnabled() {
  try {
    const v = game.settings.get("faserip", "useRealmsOfMagic");
    return v === true || v === "true" || v === "on" || v === 1;
  } catch {
    return false;
  }
}

export function wantRom(explicit) {
  if (explicit === true || explicit === "true" || explicit === "on" || explicit === 1) return true;
  if (explicit === false || explicit === "false" || explicit === "off" || explicit === 0) return false;
  return isRomEnabled();
}

export const ROM_CHARACTER_TYPE = [
  { lo: 1, hi: 10, id: "enhanced", label: "Magically Enhanced" },
  { lo: 11, hi: 35, id: "items", label: "Possesses Magical Item(s)" },
  { lo: 36, hi: 100, id: "wielder", label: "Magic Wielder" }
];

export const ROM_ENERGY = [
  { lo: 1, hi: 15, id: "personal", label: "Personal energy only", lists: ["personal"] },
  { lo: 16, hi: 50, id: "personalUniversal", label: "Personal and Universal", lists: ["personal", "universal"] },
  { lo: 51, hi: 100, id: "all", label: "Personal, Universal, and Dimensional", lists: ["personal", "universal", "dimensional"] }
];

export const ROM_SPELL_COUNT = [
  { lo: 1, hi: 5, count: 2 },
  { lo: 6, hi: 50, count: 3 },
  { lo: 51, hi: 85, count: 4 },
  { lo: 86, hi: 97, count: 5 },
  { lo: 98, hi: 100, count: 6 }
];

export const ROM_SPELL_RANK = [
  { lo: 1, hi: 15, id: "good" },
  { lo: 16, hi: 45, id: "excellent" },
  { lo: 46, hi: 70, id: "remarkable" },
  { lo: 71, hi: 90, id: "incredible" },
  { lo: 91, hi: 100, id: "amazing" }
];

export const ROM_WIELDER_TALENT_COUNT = [
  { lo: 1, hi: 35, count: 1 },
  { lo: 36, hi: 70, count: 2 },
  { lo: 71, hi: 100, count: 3 }
];

export const ROM_ITEM_COUNT = [
  { lo: 1, hi: 10, count: 1, abilityCs: 2 },
  { lo: 11, hi: 50, count: 2, abilityCs: 1 },
  { lo: 51, hi: 90, count: 3, abilityCs: 0 },
  { lo: 91, hi: 100, count: 4, abilityCs: 0 }
];

export const ROM_RESOURCE_RANK = [
  { lo: 1, hi: 5, id: "poor" },
  { lo: 6, hi: 15, id: "typical" },
  { lo: 16, hi: 45, id: "good" },
  { lo: 46, hi: 75, id: "excellent" },
  { lo: 76, hi: 95, id: "remarkable" },
  { lo: 96, hi: 99, id: "incredible" },
  { lo: 100, hi: 100, id: "amazing" }
];

export const ROM_RESOURCE_CACHE = [
  { lo: 1, hi: 20, rp: 250 },
  { lo: 21, hi: 45, rp: 500 },
  { lo: 46, hi: 75, rp: 1000 },
  { lo: 76, hi: 90, rp: 2500 },
  { lo: 91, hi: 100, rp: 5000 }
];

export const ROM_ENHANCEMENT = [
  { lo: 1, hi: 10, select: 1, raise: 1, random: false, power: false },
  { lo: 11, hi: 25, select: 2, raise: 1, random: false, power: false },
  { lo: 26, hi: 40, select: 2, raise: 2, random: true, power: false },
  { lo: 41, hi: 60, select: 2, raise: 2, random: true, power: true },
  { lo: 61, hi: 75, select: 2, raise: 2, random: false, power: false },
  { lo: 76, hi: 90, select: 3, raise: 2, random: true, power: false },
  { lo: 91, hi: 95, select: 3, raise: 2, random: false, power: false },
  { lo: 96, hi: 98, select: 3, raise: 2, random: true, power: true },
  { lo: 99, hi: 100, select: 3, raise: 2, random: false, power: true }
];

export const ROM_ENHANCEMENT_CONDITION = [
  { lo: 1, hi: 60, id: "none", label: "Permanent — no special condition" },
  { lo: 61, hi: 70, id: "time", label: "Only during a listed time window" },
  { lo: 71, hi: 80, id: "sacrifice", label: "Needs an ongoing personal sacrifice" },
  { lo: 81, hi: 90, id: "keyword", label: "Needs a keyword, gesture, or displayed sign" },
  { lo: 91, hi: 100, id: "judge", label: "Needs a Judge-set condition" }
];

export const ROM_ITEM_CONDITION = [
  { lo: 1, hi: 50, label: "No catch — the item works as described." },
  { lo: 51, hi: 53, label: "No effect versus a listed material." },
  { lo: 54, hi: 56, label: "No effect versus a listed creature type." },
  { lo: 57, hi: 60, label: "No effect unless the item is in plain sight." },
  { lo: 61, hi: 63, label: "No effect versus one energy type (personal, universal, or dimensional)." },
  { lo: 64, hi: 66, label: "No effect unless used in the light." },
  { lo: 67, hi: 70, label: "No effect unless a Judge-set condition is met." },
  { lo: 71, hi: 73, label: "Must consume or destroy a hostile magical creature once a year." },
  { lo: 74, hi: 76, label: "Must consume at least 10 Resource points of precious metal or jewels every two weeks." },
  { lo: 77, hi: 80, label: "Must take a huge energy charge once a week." },
  { lo: 81, hi: 83, label: "Must consume a roomful of light or darkness once a day." },
  { lo: 84, hi: 86, label: "Needs a Judge-set fuel and usage rate." },
  { lo: 87, hi: 89, label: "Hates a listed creature type and may seize the user near it." },
  { lo: 90, hi: 92, label: "Doubles effect under a listed condition." },
  { lo: 93, hi: 97, label: "Has a second working that only appears under a listed condition." },
  { lo: 98, hi: 100, label: "Grants three Universal workings under a listed condition." }
];

export const ROM_MASTERY = [
  { id: "novice", label: "Novice", spells: "<5 or no Amazing pair", notes: "Lives with the master most of the time. Cannot memorize new tome spells yet." },
  { id: "disciple", label: "Disciple", spells: "5+ or Amazing in every spell", notes: "Assists rites. Can learn one written spell every nine months of study." },
  { id: "adept", label: "Adept", spells: "8+, Excellent floor, two Incredible", notes: "Adventures more than studies. Can learn one written spell every six months." },
  { id: "master", label: "Master", spells: "12+, Excellent floor, four Incredible", notes: "May take a student. Can learn one written spell every five months." },
  { id: "supreme", label: "Sorcerer Supreme", spells: "14+, Remarkable floor, five Amazing", notes: "Strongest master of a dimension. Guards it full-time." }
];

export const ROM_LIMITS = [
  { id: "shift0", duration: "Can't cast", area: "None", damage: 0 },
  { id: "feeble", duration: "1 round", area: "Touching", damage: 2 },
  { id: "poor", duration: "1 round", area: "Touching", damage: 4 },
  { id: "typical", duration: "1 round", area: "Touching", damage: 6 },
  { id: "good", duration: "1 round", area: "User's area", damage: 10 },
  { id: "excellent", duration: "10 rounds", area: "1 area", damage: 20 },
  { id: "remarkable", duration: "1 hour", area: "2 areas", damage: 30 },
  { id: "incredible", duration: "1 day", area: "5 areas", damage: 40 },
  { id: "amazing", duration: "1 month", area: "12 areas", damage: 50 },
  { id: "monstrous", duration: "1 year", area: "10 sq. miles", damage: 75 },
  { id: "unearthly", duration: "Permanent", area: "1 planet", damage: 100 },
  { id: "shiftX", duration: "Permanent", area: "1 planet", damage: 150 },
  { id: "class1000", duration: "Permanent", area: "1 dimension", damage: 1000 }
];

export const MAGIC_EFFECTS = {
  columns: {
    slugfest: ["Miss", "Hit", "Slam", "Stun"],
    biteClaw: ["Miss", "Hit", "Hit", "Stun"],
    targeting: ["Miss", "Hit", "Bull's-Eye", "Bull's-Eye"],
    blasting: ["Miss", "Hit", "Slam", "Stun"],
    mentalControl: ["Miss", "Hold", "Hold", "Hold"],
    hold: ["Miss", "Miss", "Escape", "Reverse"],
    psycheFeat: ["Affected", "Same Area", "No Effect", "No Effect"],
    slam: ["1 area", "No Stun", "No Slam", "No Slam"],
    stun: ["1-10 rounds", "No Stun", "No Stun", "No Stun"]
  },
  colors: ["white", "green", "yellow", "red"]
};

export const ROM_SCHOOLS = [
  { id: "chaos", label: "Magic for Chaos", alignment: "chaos", notes: "NPC-leaning. Strong near forbidden sites. Draws opposing order-workers." },
  { id: "druidic", label: "Druidic Magic", alignment: "neutral", notes: "Earth and season work. Strong outdoors. Iron and steel pinch it." },
  { id: "voodoo", label: "Spirit-Faith Magic", alignment: "order", notes: "Spirit-court work. Strong on home ground and among the dead. Can be twisted toward chaos." },
  { id: "faerie", label: "Border-Folk Magic", alignment: "neutral", notes: "Old border-realm craft. Strong with old artifacts. Iron and steel pinch it." },
  { id: "atlantean", label: "Sunken-Age Magic", alignment: "order", notes: "Pre-flood order school. Strong against chaos work and with order relics." },
  { id: "scientific", label: "Laboratory Magic", alignment: "neutral", notes: "Powders, devices, and rites treated as technique. Extra prepared effects; gear can be stolen." },
  { id: "pantheon", label: "Realm or Pantheon Magic", alignment: "varies", notes: "Tied to one realm's rites. Strong on that ground; weak on hostile ground." },
  { id: "nature", label: "Nature Magic", alignment: "order", notes: "Living world as one web. Strong with animals and weather. Chaos-eaters notice it." },
  { id: "order", label: "Magic for Order", alignment: "order", notes: "Disciplined order school. Allies and libraries help; long enemy lists hurt." },
  { id: "eclectic", label: "Eclectic Magic", alignment: "neutral", notes: "Scrapbook school. Few bindings, slow advancement, no single master." }
];

export const ROM_SCHOOL_TABLE = [
  { lo: 1, hi: 10, id: "chaos" },
  { lo: 11, hi: 20, id: "druidic" },
  { lo: 21, hi: 30, id: "voodoo" },
  { lo: 31, hi: 40, id: "faerie" },
  { lo: 41, hi: 50, id: "atlantean" },
  { lo: 51, hi: 60, id: "scientific" },
  { lo: 61, hi: 70, id: "pantheon" },
  { lo: 71, hi: 80, id: "nature" },
  { lo: 81, hi: 90, id: "order" },
  { lo: 91, hi: 100, id: "eclectic" }
];

export function lookupBand(table, roll) {
  return table.find((row) => roll >= row.lo && roll <= row.hi) ?? table[0];
}

export function schoolById(id) {
  return ROM_SCHOOLS.find((s) => s.id === id) || ROM_SCHOOLS[8];
}

export function romLimitFor(rankId) {
  return ROM_LIMITS.find((row) => row.id === String(rankId || "").toLowerCase()) || ROM_LIMITS[4];
}

export function startingMastery(spellCount = 3) {
  if (spellCount >= 14) return ROM_MASTERY[4];
  if (spellCount >= 12) return ROM_MASTERY[3];
  if (spellCount >= 8) return ROM_MASTERY[2];
  if (spellCount >= 5) return ROM_MASTERY[1];
  return ROM_MASTERY[0];
}

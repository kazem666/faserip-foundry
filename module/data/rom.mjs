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

import { UPB_POWERS } from "./upb-powers.mjs";
import { UPB_PHYSICAL_FORMS, UPB_ORIGINS_OF_POWER, UPB_COMPOUND_COUNT } from "./upb-forms.mjs";
export { UPB_POWERS, UPB_PHYSICAL_FORMS, UPB_ORIGINS_OF_POWER, UPB_COMPOUND_COUNT };
/** MA3 Ultimate Powers Book generation tables. Judge-toggled source. */

export const UPB_COUNT_TABLE = [
  { lo: 1, hi: 12, powers: [1, 3], talents: [0, 3], contacts: [0, 2] },
  { lo: 13, hi: 26, powers: [2, 4], talents: [1, 4], contacts: [0, 4] },
  { lo: 27, hi: 41, powers: [3, 5], talents: [1, 6], contacts: [1, 4] },
  { lo: 42, hi: 55, powers: [4, 6], talents: [2, 4], contacts: [2, 4] },
  { lo: 56, hi: 66, powers: [5, 7], talents: [2, 6], contacts: [2, 6] },
  { lo: 67, hi: 75, powers: [6, 8], talents: [2, 8], contacts: [3, 3] },
  { lo: 76, hi: 83, powers: [7, 9], talents: [3, 4], contacts: [3, 4] },
  { lo: 84, hi: 89, powers: [8, 10], talents: [3, 6], contacts: [3, 6] },
  { lo: 90, hi: 94, powers: [9, 12], talents: [4, 8], contacts: [4, 4] },
  { lo: 95, hi: 97, powers: [10, 12], talents: [4, 4], contacts: [4, 5] },
  { lo: 98, hi: 99, powers: [12, 14], talents: [5, 6], contacts: [5, 5] },
  { lo: 100, hi: 100, powers: [14, 18], talents: [6, 8], contacts: [6, 6] }
];

export const UPB_POWER_CLASSES = [
  { lo: 1, hi: 5, id: "defensive", label: "Defensive", code: "D" },
  { lo: 6, hi: 11, id: "detection", label: "Detection", code: "DT" },
  { lo: 12, hi: 16, id: "energyControl", label: "Energy Control", code: "EC" },
  { lo: 17, hi: 24, id: "energyEmission", label: "Energy Emission", code: "EE" },
  { lo: 25, hi: 29, id: "fighting", label: "Fighting", code: "F" },
  { lo: 30, hi: 31, id: "illusory", label: "Illusory", code: "I" },
  { lo: 32, hi: 35, id: "lifeform", label: "Lifeform Control", code: "L" },
  { lo: 36, hi: 40, id: "magic", label: "Magic", code: "MG" },
  { lo: 41, hi: 47, id: "matterControl", label: "Matter Control", code: "MC" },
  { lo: 48, hi: 53, id: "matterConversion", label: "Matter Conversion", code: "MCo" },
  { lo: 54, hi: 57, id: "matterCreation", label: "Matter Creation", code: "MCr" },
  { lo: 58, hi: 71, id: "mental", label: "Mental Enhancement", code: "M" },
  { lo: 72, hi: 85, id: "physical", label: "Physical Enhancement", code: "P" },
  { lo: 86, hi: 88, id: "powerControl", label: "Power Control", code: "PC" },
  { lo: 89, hi: 92, id: "selfAlteration", label: "Self-Alteration", code: "S" },
  { lo: 93, hi: 100, id: "travel", label: "Travel", code: "T" }
];

export const UPB_WEAKNESS_STIMULUS = [
  { lo: 1, hi: 13, label: "Psychological" },
  { lo: 14, hi: 18, label: "Elemental Allergy" },
  { lo: 19, hi: 43, label: "Molecular Allergy" },
  { lo: 44, hi: 68, label: "Energy Allergy" },
  { lo: 69, hi: 81, label: "Energy Depletion" },
  { lo: 82, hi: 94, label: "Energy Dampening" },
  { lo: 95, hi: 100, label: "Finite Limit" }
];

export const UPB_WEAKNESS_EFFECT = [
  { lo: 1, hi: 50, label: "Power Negation" },
  { lo: 51, hi: 90, label: "Incapacitation" },
  { lo: 91, hi: 100, label: "Fatal" }
];

export const UPB_WEAKNESS_DURATION = [
  { lo: 1, hi: 40, label: "Continuous with Contact" },
  { lo: 41, hi: 60, label: "Limited Duration with Contact" },
  { lo: 61, hi: 90, label: "Limited Duration after Contact" },
  { lo: 91, hi: 100, label: "Permanent" }
];

export function lookupBand(table, roll) {
  return table.find((row) => roll >= row.lo && roll <= row.hi) ?? table[0];
}

export function lookupUpbPower(classId, roll) {
  const list = UPB_POWERS[classId] ?? [];
  return list.find((row) => roll >= row.lo && roll <= row.hi) ?? list[0];
}

export function upbCatalogGroups() {
  return UPB_POWER_CLASSES.map((cls) => ({
    id: cls.id,
    label: cls.label + " (" + cls.code + ")",
    items: (UPB_POWERS[cls.id] ?? []).map((row) => row.countsAsTwo ? row.name + " (counts as two)" : row.name)
  }));
}

export function isUpbEnabled() {
  try {
    const v = game.settings.get("faserip", "useUltimatePowersBook");
    return v === true || v === "true" || v === "on" || v === 1;
  } catch {
    return false;
  }
}

/** Honor an explicit wizard checkbox; otherwise use the world setting. */
export function wantUpb(explicit) {
  if (explicit === true || explicit === "true" || explicit === "on" || explicit === 1) return true;
  if (explicit === false || explicit === "false" || explicit === "off" || explicit === 0) return false;
  return isUpbEnabled();
}

/** Apply printed form modifiers to a generation result after ranks and counts exist. */
export function applyUpbForm(result, form, { shiftRank, rankMin } = {}) {
  if (!result || !form) return result;
  result.form = form;
  result.origin = {
    ...(result.origin || {}),
    column: form.column ?? result.origin?.column ?? 1,
    notes: [result.origin?.notes, form.notes].filter(Boolean).join(" ")
  };
  const abilities = result.abilities || {};
  const shifts = { ...(form.abilityCs || {}) };
  if (form.allPrimaryCs) {
    for (const key of ["fighting", "agility", "strength", "endurance", "reason", "intuition", "psyche"]) {
      shifts[key] = (shifts[key] || 0) + form.allPrimaryCs;
    }
  }
  if (shiftRank) {
    for (const [key, cs] of Object.entries(shifts)) {
      if (!abilities[key] || !cs) continue;
      if (cs <= -99) abilities[key] = "shift0";
      else abilities[key] = shiftRank(abilities[key], cs);
    }
    if (form.resourceCs && result.resources) result.resources = shiftRank(result.resources, form.resourceCs);
  }
  if (form.resourcesFixed) result.resources = form.resourcesFixed;
  if (typeof form.popularityFixed === "number") result.popularity = form.popularityFixed;
  else if (form.popularityCs) result.popularity = Math.max(0, (result.popularity ?? 10) + form.popularityCs * 10);
  if (result.counts) {
    if (form.extraPower) result.counts.powers[0] += form.extraPower;
    if (form.lessPower) result.counts.powers[0] = Math.max(0, result.counts.powers[0] - form.lessPower);
    if (form.id === "normalHuman") {
      result.counts.powers[0] = Math.min(result.counts.powers[0], 5);
      result.counts.powers[1] = Math.min(result.counts.powers[1] ?? 5, 5);
    }
    if (form.minContacts) {
      result.counts.contacts[0] = Math.max(result.counts.contacts[0], form.minContacts);
      result.counts.contacts[1] = Math.max(result.counts.contacts[1], form.minContacts);
    }
    if (form.maxContacts != null) {
      result.counts.contacts[0] = Math.min(result.counts.contacts[0], form.maxContacts);
      result.counts.contacts[1] = Math.min(result.counts.contacts[1], form.maxContacts);
    }
  }
  if (rankMin && result.numbers && result.abilities) {
    for (const key of Object.keys(result.abilities)) result.numbers[key] = rankMin(result.abilities[key]);
  }
  result.formRaiseOne = !!form.raiseOne;
  result.bonusPowers = [...(result.bonusPowers || []), ...(form.bonusPowers || [])];
  result.doubleHealth = !!form.doubleHealth;
  result.requireTravel = !!form.requireTravel;
  return result;
}

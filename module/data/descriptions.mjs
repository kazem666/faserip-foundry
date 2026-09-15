/**
 * Original mechanical blurbs for catalog Powers and Talents.
 * These are fan-written play aids, not reprinted rulebook text.
 */

import { UPB_DEFINITIONS } from "./upb-descriptions.mjs";
import { POWER_DEFINITIONS, TALENT_DEFINITIONS } from "./adv-descriptions.mjs";
export { POWER_DEFINITIONS, TALENT_DEFINITIONS } from "./adv-descriptions.mjs";

export function catalogKey(name) {
  return String(name || "")
    .replace(/\s*\(counts as two[^)]*\)/gi, "")
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/[\u2014\u2013]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const UPB_CLASS_HINT = {
  defensive: "Defensive Power. Use this rank to resist, block, or shed the listed threat.",
  detection: "Detection Power. A FEAT at this rank reveals the listed stimulus within range.",
  energyControl: "Energy-control Power. Shape or redirect the listed energy at this rank.",
  energyEmission: "Energy-emission Power. Project the listed energy as a blast or field at this rank.",
  fighting: "Fighting Power. Apply this rank to unarmed or weapon combat as the name suggests.",
  illusory: "Illusory Power. Create false sensory input; observers may see through it with Intuition.",
  lifeform: "Lifeform-control Power. Affect living targets; they may resist with Endurance or Psyche.",
  magic: "Magic Power. Treat rites and effects as FEATs at this rank. The Judge sets what the campaign's magic can do.",
  matterControl: "Matter-control Power. Move or reshape existing matter at this rank.",
  matterConversion: "Matter-conversion Power. Change one substance toward another at this rank.",
  matterCreation: "Matter-creation Power. Produce the listed matter or object at this rank.",
  mental: "Mental Power. Psyche contests and mental FEATs use this rank.",
  physical: "Physical-enhancement Power. The body performs beyond human norms at this rank.",
  powerControl: "Power-control Power. Alter, copy, or feed on other Powers at this rank.",
  selfAlteration: "Self-alteration Power. The hero changes form or state at this rank.",
  travel: "Travel Power. Movement mode and speed use this rank."
};

export function describePower(name, extra = {}) {
  const key = catalogKey(name);
  const two = /counts as two/i.test(name) || extra.slotsTaken === 2;
  const stock = POWER_DEFINITIONS[key] || UPB_DEFINITIONS[key];
  const definition = stock
    || extra.definition
    || `${String(name).replace(/\s*\(counts as two[^)]*\)/gi, "").trim()} is a FASERIP Power. Use this rank for FEATs. The Judge sets range, duration, and Intensity from your rulebook.`;
  const out = {
    definition,
    slotsTaken: two ? 2 : Number(extra.slotsTaken || 1) || 1,
    category: extra.category || "",
    bodyArmor: !!extra.bodyArmor || /body armor|armor skin|body resistance/i.test(key),
    forceField: !!extra.forceField || /force field/i.test(key)
  };
  if (/invulnerability|true invulnerability|immortality|teleport|dimensional|dimension travel|gateway|time travel|time control|precognition|possession|mind control|emotion control|image generation|probability|nullifying|health-drain|cosmic awareness|combat sense/i.test(key)) {
    out.slotsTaken = Math.max(out.slotsTaken, two ? 2 : out.slotsTaken);
  }
  return out;
}

export function describeTalent(name, extra = {}) {
  const key = catalogKey(name);
  const stock = TALENT_DEFINITIONS[key];
  return {
    definition: stock?.definition || extra.definition || `${String(name).replace(/\s*\([^)]*\)/g, "").trim()} is a Talent. When it applies, shift the related ability +1 CS unless a more specific bonus is listed.`,
    bonus: extra.bonus || stock?.bonus || "",
    attribute: extra.attribute || stock?.attribute || "",
    category: extra.category || "",
    slotsTaken: Number(extra.slotsTaken || 1) || 1
  };
}

export function describeCatalogItem(type, name, extra = {}) {
  if (type === "talent") return describeTalent(name, extra);
  return describePower(name, extra);
}

export function displayName(name) {
  return String(name || "").replace(/\s*\(counts as two[^)]*\)/gi, "").trim();
}

export function buildCatalogItemData(type, rawName, extra = {}) {
  const name = displayName(rawName);
  const two = /counts as two/i.test(rawName);
  const info = describeCatalogItem(type, rawName, { ...extra, slotsTaken: two ? 2 : extra.slotsTaken });
  const system = {
    category: extra.category || info.category || "",
    definition: info.definition,
    notes: extra.notes || ""
  };
  if (type === "power") {
    system.rank = extra.rank || "typical";
    system.number = extra.number ?? 0;
    system.slotsTaken = info.slotsTaken;
    system.bodyArmor = info.bodyArmor;
    system.forceField = info.forceField;
    if (extra.range) system.range = extra.range;
  }
  if (type === "talent") {
    system.rank = extra.rank || "typical";
    system.number = extra.number ?? 0;
    system.bonus = info.bonus;
    system.attribute = info.attribute;
    system.slotsTaken = info.slotsTaken;
  }
  return {
    name,
    type,
    img: type === "talent" ? "icons/svg/upgrade.svg" : "icons/svg/aura.svg",
    system
  };
}

export function upbHint(classId) {
  return UPB_CLASS_HINT[classId] || "Use this Power rank for FEATs. The Judge sets details from your rulebook.";
}

export function isGenericDefinition(text) {
  const t = String(text || "");
  if (!t) return true;
  return /is a FASERIP Power\. Use this rank|Use this Power rank for FEATs\. The Judge sets details|Defensive Power\. Use this rank|Detection Power\. Use this rank|Energy-control Power\.|Energy-emission Power\.|Fighting Power\. Apply this rank|Illusory Power\.|Lifeform-control Power\.|Magic Power\. Treat rites|Matter-control Power\.|Matter-conversion Power\.|Matter-creation Power\.|Mental Power\. Psyche contests|Physical-enhancement Power\.|Power-control Power\.|Self-alteration Power\.|Travel Power\. Movement mode/i.test(t);
}

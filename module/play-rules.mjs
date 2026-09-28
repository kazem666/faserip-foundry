import { BATTLE_EFFECTS, rankFromNumber, rankValue, shiftRank } from "./config.mjs";

export const ATTACK_COLUMNS = new Set([
  "blunt", "edged", "shooting", "throwEdged", "throwBlunt", "energy", "force", "charging", "grappling", "grabbing"
]);

export const DAMAGE_COLUMNS = new Set([
  "blunt", "edged", "shooting", "throwEdged", "throwBlunt", "energy", "force", "charging"
]);

const CHECK_BY_EFFECT = {
  Slam: "slamCheck",
  Stun: "stunCheck",
  Kill: "killCheck"
};

const COLUMN_WORDS = [
  ["grappling", /grappl/i],
  ["grabbing", /grab/i],
  ["escaping", /escape/i],
  ["dodging", /dodg/i],
  ["evading", /evad/i],
  ["blocking", /block/i],
  ["catching", /catch/i],
  ["blunt", /blunt|unarmed/i],
  ["edged", /edged/i],
  ["shooting", /firearm|guns|\bshoot/i],
  ["throwEdged", /throw/i],
  ["throwBlunt", /throw/i],
  ["slamCheck", /\bslam\b/i],
  ["stunCheck", /\bstun\b/i],
  ["killCheck", /kill check/i]
];

export function signed(n) {
  const value = Number(n) || 0;
  return value > 0 ? `+${value}` : String(value);
}

export function effectDealsDamage(columnId, effect) {
  if (!DAMAGE_COLUMNS.has(columnId)) return false;
  const text = String(effect || "");
  if (!text || /miss/i.test(text)) return false;
  return true;
}

export function checkForEffect(effect) {
  return CHECK_BY_EFFECT[String(effect || "")] || "";
}

export function attackDamageNumber(actor, item, columnId) {
  if (!actor || !DAMAGE_COLUMNS.has(columnId)) return 0;
  if (["shooting", "throwEdged", "throwBlunt", "energy", "force"].includes(columnId)) {
    const numbered = Number(item?.system?.number || 0);
    if (numbered > 0) return numbered;
    if (item?.system?.rank) return rankValue(item.system.rank);
    if (item?.system?.material) return rankValue(item.system.material);
  }
  if (typeof actor.getAbilityNumber === "function") return actor.getAbilityNumber("strength");
  return 0;
}

export function readPending(actor) {
  const raw = actor?.getFlag?.("faserip", "pending") || actor?.flags?.faserip?.pending || {};
  return {
    nextCs: Number(raw.nextCs || 0),
    nextNote: raw.nextNote || "",
    incomingCs: Number(raw.incomingCs || 0),
    incomingNote: raw.incomingNote || "",
    armorCs: Number(raw.armorCs || 0),
    armorNote: raw.armorNote || ""
  };
}

export async function writePending(actor, patch) {
  if (!actor?.setFlag) return null;
  return actor.setFlag("faserip", "pending", { ...readPending(actor), ...patch });
}

export function formatPending(pending) {
  const bits = [];
  if (pending?.nextCs) bits.push(`Next roll ${signed(pending.nextCs)} CS`);
  if (pending?.incomingCs) bits.push(`Incoming attacks ${signed(pending.incomingCs)} CS`);
  if (pending?.armorCs) bits.push(`Armor ${signed(pending.armorCs)} CS`);
  return bits.join(" · ");
}

export function shiftedArmor(armor, cs) {
  const base = Number(armor || 0);
  const shift = Number(cs || 0);
  if (!base || !shift) return base;
  return rankValue(shiftRank(rankFromNumber(base), shift));
}

export function pendingFromDefense(columnId, effect) {
  const text = String(effect || "");
  const match = text.match(/([+-]?\d+)\s*CS/i);
  const n = match ? Number(match[1]) : 0;
  if (columnId === "dodging") {
    if (!match) return null;
    return { incomingCs: n, incomingNote: `Dodge ${text}` };
  }
  if (columnId === "blocking") {
    if (!match) return null;
    return { armorCs: n, armorNote: `Block ${text}` };
  }
  if (columnId === "evading" && (match || /evasion/i.test(text))) {
    return { nextCs: n, nextNote: `Evasion ${text}` };
  }
  return null;
}

function talentText(item) {
  return `${item?.system?.bonus || ""} ${item?.system?.definition || ""} ${item?.name || ""}`;
}

function skippedShift(text) {
  return /one weapon|chosen weapon|listed weapon/i.test(text);
}

export function talentColumnShift(actor, { ability = "", effectsColumn = "" } = {}) {
  let cs = 0;
  const notes = [];
  for (const item of actor?.items ?? []) {
    if (item.type !== "talent") continue;
    const text = talentText(item);
    if (skippedShift(text)) continue;
    const shiftText = text.replace(/[+-]?\d+\s*CS\s*(?:to\s*)?initiative/ig, "");
    const match = shiftText.match(/([+-]?\d+)\s*CS/i);
    if (!match) continue;
    const n = Number(match[1]);
    if (!n) continue;
    const words = COLUMN_WORDS.filter(([, re]) => re.test(text));
    if (/unarmed/i.test(text) && effectsColumn && effectsColumn !== "blunt") continue;
    if (words.length) {
      if (!effectsColumn || !words.some(([id]) => id === effectsColumn)) continue;
    } else {
      const bonus = String(item.system?.bonus || "").trim();
      const attr = String(item.system?.attribute || "").toLowerCase();
      const generic = /^[+-]?\d+\s*CS\.?$/i.test(bonus);
      if (!generic || !ability || !attr.includes(String(ability).toLowerCase())) continue;
    }
    cs += n;
    notes.push(`${item.name} ${match[0]}`);
  }
  return { cs, notes };
}

export function initiativeTalentBonus(actor) {
  let total = 0;
  for (const item of actor?.items ?? []) {
    if (item.type !== "talent") continue;
    const text = talentText(item);
    if (skippedShift(text) || !/initiative/i.test(text)) continue;
    const match = text.match(/([+-]?\d+)\s*(?:CS\s*(?:to\s*)?)?initiative/i);
    if (match) total += Number(match[1]) || 0;
  }
  return total;
}

export function initiativeTotal(face, mod) {
  const die = Number(face);
  if (die === 1) return 1;
  return die + (Number(mod) || 0);
}

export function combinedShift(actor, { ability = "", effectsColumn = "", target = null } = {}) {
  const talent = talentColumnShift(actor, { ability, effectsColumn });
  const pending = readPending(actor);
  let cs = talent.cs + pending.nextCs;
  const notes = [...talent.notes];
  if (pending.nextCs) notes.push(pending.nextNote || `Saved ${signed(pending.nextCs)} CS`);
  let consumeIncoming = false;
  if (target && ATTACK_COLUMNS.has(effectsColumn)) {
    const incoming = readPending(target);
    if (incoming.incomingCs) {
      cs += incoming.incomingCs;
      notes.push(`${target.name}: ${incoming.incomingNote || `${signed(incoming.incomingCs)} CS`}`);
      consumeIncoming = true;
    }
  }
  return {
    cs,
    notes,
    note: notes.join("; "),
    consumeOutgoing: !!pending.nextCs,
    consumeIncoming
  };
}

export function abilityForColumn(columnId, fallback = "") {
  return BATTLE_EFFECTS[columnId]?.ability || fallback || "";
}

export function sceneActorChoices() {
  const tokens = globalThis.canvas?.tokens?.placeables ?? [];
  const choices = [];
  const seen = new Set();
  for (const token of tokens) {
    const actor = token.actor;
    if (!actor || seen.has(actor.id)) continue;
    if (actor.type !== "hero" && actor.type !== "npc") continue;
    seen.add(actor.id);
    const targeted = !!token.targeted || !!globalThis.game?.user?.targets?.has?.(token);
    choices.push({ id: actor.id, name: token.name || actor.name, targeted });
  }
  return choices;
}

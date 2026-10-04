import { BATTLE_EFFECTS, rankFromNumber, rankValue, shiftRank } from "./config.mjs";
import { situationMods } from "./situation.mjs";
import { namedInitiative, namedTalentShift } from "./talents.mjs";

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
    armorNote: raw.armorNote || "",
    strikeCs: Number(raw.strikeCs || 0),
    strikeNote: raw.strikeNote || "",
    psycheCs: Number(raw.psycheCs || 0),
    psycheNote: raw.psycheNote || ""
  };
}

export async function writePending(actor, patch) {
  if (!actor?.setFlag) return null;
  const next = { ...readPending(actor), ...patch };
  const saved = await actor.setFlag("faserip", "pending", next);
  const { syncShiftEffects } = await import("./effects.mjs");
  await syncShiftEffects(actor, next);
  return saved;
}

export function formatPending(pending) {
  const bits = [];
  if (pending?.nextCs) bits.push(`Next roll ${signed(pending.nextCs)} CS`);
  if (pending?.incomingCs) bits.push(`Incoming attacks ${signed(pending.incomingCs)} CS`);
  if (pending?.armorCs) bits.push(`Armor ${signed(pending.armorCs)} CS`);
  if (pending?.strikeCs) bits.push(`Next attack ${signed(pending.strikeCs)} CS`);
  if (pending?.psycheCs) bits.push(`Next Psyche FEAT ${signed(pending.psycheCs)} CS`);
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

export function talentColumnShift(actor, { ability = "", effectsColumn = "", item: attack = null, sourceColumn = "" } = {}) {
  let cs = 0;
  const notes = [];
  const parts = [];
  for (const item of actor?.items ?? []) {
    if (item.type !== "talent") continue;
    const named = namedTalentShift(item, { effectsColumn, attack, sourceColumn });
    if (named.handled) {
      if (named.cs) {
        cs += named.cs;
        notes.push(named.note);
        parts.push({ id: `talent-${item.id}`, cs: named.cs, note: named.note });
      }
      continue;
    }
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
    const note = `${item.name} ${match[0]}`;
    notes.push(note);
    parts.push({ id: `talent-${item.id}`, cs: n, note });
  }
  return { cs, notes, parts };
}

export function initiativeTalentBonus(actor) {
  let total = 0;
  for (const item of actor?.items ?? []) {
    if (item.type !== "talent") continue;
    const named = namedInitiative(item);
    if (named.handled) {
      total += named.cs;
      continue;
    }
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

export function combinedShift(actor, { ability = "", effectsColumn = "", target = null, item = null, reservePending = false, sourceColumn = "" } = {}) {
  const talent = talentColumnShift(actor, { ability, effectsColumn, item, sourceColumn });
  const pending = readPending(actor);
  let cs = talent.cs + (reservePending ? 0 : pending.nextCs);
  const notes = [...talent.notes];
  const parts = [...(talent.parts || [])];
  if (!reservePending && pending.nextCs) {
    const note = pending.nextNote || `Saved ${signed(pending.nextCs)} CS`;
    notes.push(note);
    parts.push({ id: "next", cs: pending.nextCs, note, consume: "outgoing" });
  }
  let consumeIncoming = false;
  if (target && ATTACK_COLUMNS.has(effectsColumn)) {
    const incoming = readPending(target);
    if (incoming.incomingCs) {
      const note = `${target.name}: ${incoming.incomingNote || `${signed(incoming.incomingCs)} CS`}`;
      cs += incoming.incomingCs;
      notes.push(note);
      parts.push({ id: "incoming", cs: incoming.incomingCs, note, consume: "incoming" });
      consumeIncoming = true;
    }
  }
  const situation = situationMods(actor, effectsColumn);
  cs += situation.cs;
  if (situation.note) notes.push(situation.note);
  if (situation.cs || situation.damageCs) {
    parts.push({
      id: "situation",
      cs: situation.cs,
      note: situation.note || `Situation ${signed(situation.cs)} CS`,
      damageCs: situation.damageCs || 0
    });
  }
  const emotion = actor?.getFlag?.("faserip", "emotion");
  if (emotion === "rage" && ATTACK_COLUMNS.has(effectsColumn)) {
    cs += 1;
    notes.push("Rage +1 CS");
    parts.push({ id: "rage", cs: 1, note: "Rage +1 CS" });
  }
  if (emotion === "fear" && ATTACK_COLUMNS.has(effectsColumn)) {
    cs -= 1;
    notes.push("Fear −1 CS");
    parts.push({ id: "fear", cs: -1, note: "Fear −1 CS" });
  }
  if (target?.getFlag?.("faserip", "small") && ATTACK_COLUMNS.has(effectsColumn)) {
    cs -= 1;
    notes.push("Tiny target −1 CS");
    parts.push({ id: "small", cs: -1, note: "Tiny target −1 CS" });
  }
  let consumeStrike = false;
  if (!reservePending && pending.strikeCs && ATTACK_COLUMNS.has(effectsColumn)) {
    const note = pending.strikeNote || `Next attack ${signed(pending.strikeCs)} CS`;
    cs += pending.strikeCs;
    notes.push(note);
    parts.push({ id: "strike", cs: pending.strikeCs, note, consume: "strike" });
    consumeStrike = true;
  }
  let consumeMagicResist = false;
  if (!reservePending && pending.psycheCs && String(ability).toLowerCase() === "psyche") {
    const note = pending.psycheNote || `Psyche ${signed(pending.psycheCs)} CS`;
    cs += pending.psycheCs;
    notes.push(note);
    parts.push({ id: "psyche", cs: pending.psycheCs, note, consume: "magic" });
    consumeMagicResist = true;
  }
  return {
    cs,
    damageCs: situation.damageCs,
    notes,
    parts,
    note: notes.join("; "),
    consumeOutgoing: !reservePending && !!pending.nextCs,
    consumeIncoming,
    consumeStrike,
    consumeMagicResist
  };
}

export function abilityForColumn(columnId, fallback = "") {
  return BATTLE_EFFECTS[columnId]?.ability || fallback || "";
}

export function actorFromRef(ref) {
  if (!ref) return null;
  if (typeof ref !== "string") return ref.documentName === "Actor" ? ref : (ref.actor || null);
  if (ref.includes(".")) {
    try {
      const doc = globalThis.foundry?.utils?.fromUuidSync?.(ref);
      if (doc?.documentName === "Actor") return doc;
    } catch {
      /* uuid not in this client yet */
    }
  }
  for (const token of globalThis.canvas?.tokens?.placeables ?? []) {
    const actor = token.actor;
    if (actor && (actor.uuid === ref || actor.id === ref)) return actor;
  }
  return globalThis.game?.actors?.get?.(ref) ?? null;
}

export function combatTarget(excludeId = "") {
  const ordered = [];
  const seen = new Set();
  const add = (token) => {
    if (!token || seen.has(token)) return;
    seen.add(token);
    ordered.push(token);
  };
  try {
    for (const token of globalThis.game?.user?.targets ?? []) add(token);
  } catch {
    /* targets may not be iterable until the canvas is ready */
  }
  for (const token of globalThis.canvas?.tokens?.placeables ?? []) {
    if (token.isTargeted || token.targeted) add(token);
  }
  for (const token of globalThis.canvas?.tokens?.controlled ?? []) add(token);
  for (const token of ordered) {
    const actor = token.actor || token.document?.actor;
    if (!actor) continue;
    if (excludeId && (actor.id === excludeId || actor.uuid === excludeId)) continue;
    return actor;
  }
  return null;
}

export function sceneActorChoices() {
  const tokens = globalThis.canvas?.tokens?.placeables ?? [];
  const choices = [];
  const seen = new Set();
  for (const token of tokens) {
    const actor = token.actor;
    const key = actor?.uuid || actor?.id;
    if (!actor || !key || seen.has(key)) continue;
    if (actor.type !== "hero" && actor.type !== "npc") continue;
    seen.add(key);
    let targeted = !!(token.isTargeted || token.targeted);
    try { targeted = targeted || !!globalThis.game?.user?.targets?.has?.(token); } catch { /* ignore */ }
    choices.push({ id: actor.uuid || actor.id, name: token.name || actor.name, targeted });
  }
  return choices;
}

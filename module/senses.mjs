import { rankIndex } from "./config.mjs";
import { writePending } from "./play-rules.mjs";
import { gridFeet } from "./movement.mjs";

/**
 * Senses and detection. Distances are play values, not a book chart.
 * Vision powers change the token's sight. Detection whispers what is in range.
 * Protected senses can refuse a blind or a deafen at or under their rank.
 */

const SENSE_FEET = {
  shift0: 0, feeble: 20, poor: 40, typical: 60, good: 120, excellent: 240,
  remarkable: 500, incredible: 1000, amazing: 2500, monstrous: 5000,
  unearthly: 10000, shiftx: 25000, shifty: 50000, shiftz: 100000,
  cl1000: 250000, cl3000: 500000, cl5000: 1000000, beyond: 9999999
};

const GLIMPSE = {
  red: "a sharp answer",
  yellow: "a clear but incomplete answer",
  green: "a vague impression",
  white: "nothing useful"
};

function powerKey(name) {
  return String(name || "")
    .replace(/\s*\(counts as two[^)]*\)/gi, "")
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/[—–]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function senseKind(name) {
  const key = powerKey(name);
  if (key === "protected senses") return "guard";
  if (key === "enhanced senses" || key === "abnormal sensitivity") return "keen";
  if (key === "infravision" || key === "thermal vision") return "heat";
  if (key === "uv vision") return "uv";
  if (key === "telescopic vision") return "far";
  if (key === "true sight") return "true";
  if (key === "radarsense" || key === "sonar") return "radar";
  if (key === "circular vision") return "circle";
  if (key === "cosmic awareness") return "cosmic";
  if (key === "combat sense") return "combat";
  if (key === "computer links") return "computer";
  if (key === "emotion detection") return "emotion";
  if (key === "energy detection") return "energy";
  if (key === "magic detection") return "magic";
  if (key === "magnetic detection") return "magnetic";
  if (key === "mutant detection") return "mutant";
  if (key === "psionic detection") return "psionic";
  if (key === "astral detection") return "astral";
  if (key === "extradimensional detection") return "rift";
  if (key === "life detection") return "life";
  if (key === "power detection") return "power";
  if (key === "tracking ability" || key === "tracking" || key === "hyper-olfactory") return "track";
  if (key === "hyper-hearing") return "hear";
  if (key === "hyper-touch") return "touch";
  if (key === "microscopic vision") return "micro";
  if (key === "penetration vision") return "penetrate";
  if (key === "environmental awareness") return "environment";
  if (key === "weakness detection") return "weak";
  return "";
}

export function senseUseTitle(name) {
  const kind = senseKind(name);
  if (!kind) return "";
  const titles = {
    guard: "Use guards sight and hearing. A blind or deafen at or under this rank does not land. Use again lowers the guard. If you are already blinded or deafened, Use can clear it.",
    keen: "The next Intuition FEAT uses this rank.",
    heat: "Use toggles heat sight, so darkness does not hide warm shapes. Use again restores normal sight.",
    uv: "Use toggles sight that still works in the dark. Use again restores normal sight.",
    far: "Use extends how far the token can see. Use again restores the old range.",
    true: "Use lets the token see invisible creatures. Use again restores normal sight.",
    radar: "Use maps nearby shapes without relying on light, including underwater for sonar. Use again turns it off.",
    circle: "Use watches the full circle and raises initiative to this rank when that is higher. Use again turns it off.",
    cosmic: "Ask a broad question. The FEAT color tells the Judge how sharp the answer is.",
    combat: "Use substitutes this rank for Intuition when it is higher, including initiative. Use again returns to Intuition.",
    computer: "The next Reason FEAT uses this rank for a machine or system.",
    emotion: "Whisper the strong feelings of people in range.",
    energy: "Whisper who in range is carrying an energy power, and mark those tokens on your sight. Use again turns that sight off.",
    magic: "Whisper who in range reads as magical, and mark invisible creatures on sight. Use again turns that sight off.",
    magnetic: "Whisper who in range is carrying metal or a magnetic power.",
    mutant: "Whisper who in range has a mutant origin.",
    psionic: "Whisper who in range has a mental power.",
    astral: "Whisper who in range is out of their body.",
    rift: "Whisper who in range is using a gate, dimension, or astral power.",
    life: "Whisper the living creatures in range.",
    power: "Whisper who in range has a power.",
    track: "Name the trail. The FEAT color tells the Judge how clear it still is.",
    hear: "Name what you are listening for. The FEAT color tells the Judge what you catch.",
    touch: "Name the surface or seam. The FEAT color tells the Judge what your fingers find.",
    micro: "Name the tiny detail. The FEAT color tells the Judge how much you resolve.",
    penetrate: "Name the barrier. The FEAT color tells the Judge what you see through it.",
    environment: "Ask about the place. The FEAT color tells the Judge how much of the scene you read.",
    weak: "Study a target. Yellow or red gives your next attack +1 column. The Judge can add what the weakness is."
  };
  return titles[kind] || "";
}

export function protectedSensesHold(actor, attackRank) {
  const rank = actor?.getFlag?.("faserip", "protectedSenses");
  if (!rank) return false;
  return rankIndex(rank) >= rankIndex(attackRank || "typical");
}

function who(actor) {
  return actor?.name || "The hero";
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function rankOf(item) {
  return item?.system?.rank || "typical";
}

function senseFeet(rankId) {
  return SENSE_FEET[rankId] ?? SENSE_FEET.typical;
}

function tokenFor(actor) {
  const list = actor?.getActiveTokens?.() ?? [];
  return list.find((entry) => entry.controlled) || list[0] || null;
}

function gridSize() {
  return Number(globalThis.canvas?.grid?.size) || 100;
}

function hasStatus(actor, id) {
  return [...(actor?.effects ?? [])].some((effect) => effect.statuses?.has?.(id) || effect.getFlag?.("core", "statusId") === id);
}

async function whisper(actor, html) {
  const ids = new Set();
  if (globalThis.game?.user?.id) ids.add(globalThis.game.user.id);
  for (const user of globalThis.game?.users ?? []) {
    if (user.isGM) ids.add(user.id);
  }
  const ChatMessage = globalThis.ChatMessage;
  if (!ChatMessage?.create) return;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker?.({ actor }) || { alias: who(actor) },
    whisper: [...ids],
    content: html
  });
}

async function askText(title, label) {
  const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) return "";
  const form = await DialogV2.wait({
    window: { title },
    content: `<label>${esc(label)} <input type="text" name="q" autofocus></label>`,
    buttons: [
      { action: "ask", label: "Ask", default: true, callback: (_event, button) => button.form },
      { action: "cancel", label: "Cancel" }
    ],
    rejectClose: false
  });
  if (!form || form === "cancel") return "";
  return String(form.elements?.q?.value || form.querySelector?.('[name="q"]')?.value || "").trim();
}

async function rollColor(actor, item) {
  const { rollFeat } = await import("./dice/universal-table.mjs");
  const message = await rollFeat({
    actor,
    rankId: rankOf(item),
    label: item.name,
    skipCondition: true
  });
  if (!message) return "";
  return message.flags?.faserip?.color || "";
}

async function askAndRead(actor, item, prompt) {
  const text = await askText(item.name, prompt);
  if (!text) return null;
  const color = await rollColor(actor, item);
  if (!color) return null;
  const glimpse = GLIMPSE[color] || GLIMPSE.white;
  await whisper(actor, `<p><strong>${esc(item.name)}</strong>: ${esc(text)}. ${esc(who(actor))} gets ${esc(glimpse)}. The Judge supplies the detail.</p>`);
  globalThis.ui?.notifications?.info(`${item.name}: ${glimpse}.`);
  return true;
}

function nearby(actor, item) {
  const origin = tokenFor(actor);
  const docs = globalThis.canvas?.scene?.tokens ?? globalThis.canvas?.tokens?.placeables?.map((token) => token.document) ?? [];
  if (!origin) return [];
  const doc = origin.document || origin;
  const ox = doc.x + ((doc.width || 1) * gridSize()) / 2;
  const oy = doc.y + ((doc.height || 1) * gridSize()) / 2;
  const maxPx = (senseFeet(rankOf(item)) / gridFeet()) * gridSize();
  const found = [];
  for (const token of docs) {
    const person = token.actor;
    if (!person || person.id === actor.id) continue;
    const cx = token.x + ((token.width || 1) * gridSize()) / 2;
    const cy = token.y + ((token.height || 1) * gridSize()) / 2;
    if (Math.hypot(cx - ox, cy - oy) > maxPx) continue;
    found.push(person);
  }
  return found;
}

function powerNames(actor) {
  return [...(actor?.items ?? [])].filter((item) => item.type === "power").map((item) => item.name);
}

function matches(actor, kind) {
  const names = powerNames(actor).join(" ").toLowerCase();
  const origin = String(actor?.system?.identity?.origin || "").toLowerCase();
  if (kind === "emotion") return actor.getFlag?.("faserip", "emotion") || "";
  if (kind === "energy") return /generat|energy|electric|magnet|fire |light |force field|radiation|plasma|sonic|darkforce/.test(names);
  if (kind === "magic") return origin === "magic" || /magic|spell|enchant|mystic|ward/.test(names);
  if (kind === "magnetic") return /magnet|steel|iron|metal/.test(names);
  if (kind === "mutant") return origin === "mutant";
  if (kind === "psionic") return /telepath|psionic|psi-|mind control|mental|empathy|telekinesis/.test(names);
  if (kind === "astral") return !!(actor.getFlag?.("faserip", "astral") || hasStatus(actor, "astral"));
  if (kind === "rift") return /dimension|gateway|astral|teleport/.test(names);
  if (kind === "life") return true;
  if (kind === "power") return powerNames(actor).length > 0;
  return false;
}

async function scan(actor, item, kind) {
  const people = nearby(actor, item);
  if (!tokenFor(actor)) {
    globalThis.ui?.notifications?.warn(`${who(actor)} needs a token on the map.`);
    return null;
  }
  const hits = [];
  for (const person of people) {
    const mark = matches(person, kind);
    if (!mark) continue;
    hits.push(kind === "emotion" ? `${person.name} (${mark})` : person.name);
  }
  const line = hits.length
    ? `${who(actor)} reads: ${hits.join(", ")}.`
    : `${who(actor)} reads nothing in range.`;
  await whisper(actor, `<p><strong>${esc(item.name)}</strong>: ${esc(line)}</p>`);
  globalThis.ui?.notifications?.info(line);
  return true;
}

function plainSight(doc) {
  const sight = typeof doc?.sight?.toObject === "function" ? doc.sight.toObject() : { ...(doc?.sight || {}) };
  const modes = typeof doc?.detectionModes?.toObject === "function"
    ? doc.detectionModes.toObject()
    : (doc?.detectionModes || []).map((mode) => ({ ...mode }));
  return { sight, detectionModes: modes };
}

async function toggleVision(actor, item, spec) {
  const tokens = actor?.getActiveTokens?.() ?? [];
  if (!tokens.length) {
    globalThis.ui?.notifications?.warn(`${who(actor)} needs a token on the map.`);
    return null;
  }
  const range = spec.range ?? senseFeet(rankOf(item));
  let turnedOn = false;
  for (const token of tokens) {
    const doc = token.document || token;
    const saved = doc.getFlag?.("faserip", "senseSight");
    try {
      if (saved?.kind === spec.kind) {
        const update = {};
        if (saved.sight) update.sight = saved.sight;
        if (saved.detectionModes) update.detectionModes = saved.detectionModes;
        if (Object.keys(update).length) await doc.update(update);
        await doc.unsetFlag("faserip", "senseSight");
      } else {
        if (saved) await doc.unsetFlag("faserip", "senseSight");
        const before = plainSight(doc);
        await doc.setFlag("faserip", "senseSight", { kind: spec.kind, ...before });
        const update = {};
        if (spec.visionMode || spec.angle || spec.far) {
          const sight = { ...before.sight, enabled: true };
          if (spec.visionMode) sight.visionMode = spec.visionMode;
          if (spec.angle) sight.angle = spec.angle;
          if (spec.far || spec.visionMode || spec.detection) sight.range = Math.max(Number(sight.range) || 0, range);
          update.sight = sight;
        }
        if (spec.detection) {
          const modes = (before.detectionModes || []).filter((mode) => mode?.id !== spec.detection);
          modes.push({ id: spec.detection, enabled: true, range });
          update.detectionModes = modes;
        }
        if (Object.keys(update).length) await doc.update(update);
        turnedOn = true;
      }
    } catch (err) {
      console.warn("FASERIP | sense sight", err);
    }
  }
  if (spec.flag) {
    if (turnedOn) await actor.setFlag?.("faserip", spec.flag, rankOf(item));
    else await actor.unsetFlag?.("faserip", spec.flag);
  }
  globalThis.ui?.notifications?.info(turnedOn ? `${item.name} is on.` : `${item.name} is off.`);
  return true;
}

async function guard(actor, item) {
  const on = !!actor.getFlag?.("faserip", "protectedSenses");
  if (on) {
    await actor.unsetFlag?.("faserip", "protectedSenses");
    globalThis.ui?.notifications?.info(`${item.name} is off.`);
    return true;
  }
  await actor.setFlag?.("faserip", "protectedSenses", rankOf(item));
  const blind = globalThis.CONFIG?.specialStatusEffects?.BLIND || "blind";
  const overloaded = hasStatus(actor, blind) || hasStatus(actor, "deaf");
  if (overloaded) {
    const color = await rollColor(actor, item);
    if (color && color !== "white") {
      try {
        if (hasStatus(actor, blind)) await actor.toggleStatusEffect(blind, { active: false, overlay: true });
        if (hasStatus(actor, "deaf")) await actor.toggleStatusEffect("deaf", { active: false });
      } catch (err) {
        console.warn("FASERIP | protected senses", err);
      }
      globalThis.ui?.notifications?.info(`${item.name} clears the overload and stays up.`);
      return true;
    }
    globalThis.ui?.notifications?.info(`${item.name} is up, but the current overload holds.`);
    return true;
  }
  globalThis.ui?.notifications?.info(`${item.name} is up. Blinds and deafens at ${rankOf(item)} or under do not land.`);
  return true;
}

async function keen(actor, item) {
  await actor.setFlag?.("faserip", "senseRank", rankOf(item));
  globalThis.ui?.notifications?.info(`The next Intuition FEAT uses this rank.`);
  return true;
}

async function combat(actor, item) {
  const on = !!actor.getFlag?.("faserip", "combatSense");
  if (on) await actor.unsetFlag?.("faserip", "combatSense");
  else await actor.setFlag?.("faserip", "combatSense", rankOf(item));
  globalThis.ui?.notifications?.info(on
    ? `${item.name} is off. Initiative uses Intuition again.`
    : `${item.name} is on. Intuition rolls and initiative use this rank when it is higher.`);
  return true;
}

async function computer(actor, item) {
  await actor.setFlag?.("faserip", "machineRank", rankOf(item));
  globalThis.ui?.notifications?.info(`The next Reason FEAT uses this rank.`);
  return true;
}

async function weak(actor, item) {
  const { combatTarget } = await import("./play-rules.mjs");
  const target = combatTarget(actor?.id || "");
  if (!target) {
    globalThis.ui?.notifications?.warn("Target a token.");
    return null;
  }
  const color = await rollColor(actor, item);
  if (!color) return null;
  if (color === "yellow" || color === "red") {
    await writePending(actor, { strikeCs: 1, strikeNote: "Weakness +1 CS" });
    await whisper(actor, `<p><strong>${esc(item.name)}</strong> finds a gap in ${esc(target.name)}. The next attack is +1 column. The Judge can name the weakness.</p>`);
    globalThis.ui?.notifications?.info(`A weakness shows. The next attack is +1 column.`);
    return true;
  }
  await whisper(actor, `<p><strong>${esc(item.name)}</strong> on ${esc(target.name)}: ${esc(GLIMPSE[color] || GLIMPSE.white)}.</p>`);
  globalThis.ui?.notifications?.info(color === "white" ? "No weakness shows." : "A vague soft spot, with no column shift.");
  return true;
}

export async function useSensePower(actor, item) {
  const kind = senseKind(item?.name);
  if (!actor || !kind) return null;
  if (kind === "guard") return guard(actor, item);
  if (kind === "keen") return keen(actor, item);
  if (kind === "heat" || kind === "uv") {
    const { visionModeId, detectionId } = await import("./detection.mjs");
    const mode = kind === "heat" ? "faseripHeat" : "faseripUv";
    return toggleVision(actor, item, {
      kind,
      visionMode: visionModeId(mode),
      detection: mode === "faseripHeat" ? detectionId("faseripHeat", "") : ""
    });
  }
  if (kind === "far") return toggleVision(actor, item, { kind, far: true, range: senseFeet(rankOf(item)) * 4 });
  if (kind === "true") {
    const { detectionId } = await import("./detection.mjs");
    return toggleVision(actor, item, { kind, detection: detectionId("faseripTrue", "seeInvisibility") });
  }
  if (kind === "radar") {
    const { detectionId } = await import("./detection.mjs");
    return toggleVision(actor, item, { kind, detection: detectionId("faseripRadar", "feelTremor") });
  }
  if (kind === "magic") {
    const { detectionId } = await import("./detection.mjs");
    const id = detectionId("faseripMagic", "seeInvisibility");
    if (id) await toggleVision(actor, item, { kind, detection: id });
    return scan(actor, item, kind);
  }
  if (kind === "energy") {
    const { detectionId } = await import("./detection.mjs");
    const id = detectionId("faseripEnergy", "");
    if (id) await toggleVision(actor, item, { kind, detection: id });
    return scan(actor, item, kind);
  }
  if (kind === "circle") return toggleVision(actor, item, { kind, angle: 360, flag: "circularVision" });
  if (kind === "cosmic") return askAndRead(actor, item, "What are you asking?");
  if (kind === "combat") return combat(actor, item);
  if (kind === "computer") return computer(actor, item);
  if (kind === "track") return askAndRead(actor, item, "What trail are you following?");
  if (kind === "hear") return askAndRead(actor, item, "What are you listening for?");
  if (kind === "touch") return askAndRead(actor, item, "What are you feeling for?");
  if (kind === "micro") return askAndRead(actor, item, "What detail are you magnifying?");
  if (kind === "penetrate") return askAndRead(actor, item, "What are you looking through?");
  if (kind === "environment") return askAndRead(actor, item, "What about this place?");
  if (kind === "weak") return weak(actor, item);
  return scan(actor, item, kind);
}

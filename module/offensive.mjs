import { MATERIAL_EXAMPLES, RANKS, rankIndex, rankLabel, rankValue } from "./config.mjs";
import { setBattleState } from "./battle-results.mjs";
import { combatTarget } from "./play-rules.mjs";
import { gridSeparation, reachSquares } from "./movement.mjs";

/**
 * Body alterations that hit. Counts and durations below are play values, not a book chart.
 * Claws follow natural weaponry: claws, fangs, horns, or spines.
 * Corrosive and chemical touches follow a secreted chemical: acid, toxin, or adhesive.
 */

const EXTRA_STRIKES = {
  shift0: 0, feeble: 1, poor: 1, typical: 1, good: 2, excellent: 2, remarkable: 3,
  incredible: 3, amazing: 4, monstrous: 5, unearthly: 6, shiftx: 8, shifty: 10,
  shiftz: 12, cl1000: 20, cl3000: 30, cl5000: 40, beyond: 50
};

const waiters = new Map();

function powerKey(name) {
  return String(name || "")
    .replace(/\s*\(counts as two[^)]*\)/gi, "")
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/[—–]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function offensiveKind(name) {
  const key = powerKey(name);
  if (key === "extra body parts") return "parts";
  if (key === "extra attacks") return "extra";
  if (key === "energy touch") return "energy";
  if (key === "paralyzing touch") return "paralysis";
  if (key === "claws" || key === "natural weaponry") return "claws";
  if (key === "rotting touch") return "rot";
  if (key === "corrosive touch") return "corrosive";
  if (key === "chemical touch") return "chemical";
  if (key === "health-drain touch") return "drain";
  if (key === "blinding touch") return "blind";
  return "";
}

export function offensiveUseTitle(name) {
  const kind = offensiveKind(name);
  if (kind === "parts") return "Choose another arm (one extra strike), a tail (a grab), or wings (flying on or off).";
  if (kind === "extra") return "Ready extra strikes this round, then spend them as edged, blunt, or grabbing attacks.";
  if (kind === "energy") return "A touch strikes with energy, or a lighter jolt that stuns. They resist a jolt with Endurance.";
  if (kind === "paralysis") return "A touch can lock a target in place. They resist with Endurance or Psyche. A worse color lasts longer.";
  if (kind === "claws") return "Strike with claws, fangs, horns, or thrown spines. If Strength is higher, you can strike with that instead.";
  if (kind === "rot") return "Decay a living target, or spoil an organic material. Living targets resist with Endurance.";
  if (kind === "corrosive") return "Burn a living target, or eat through a material. Compare this rank to the material.";
  if (kind === "chemical") return "Deliver acid, a toxin, or an adhesive by touch. Targets resist with Endurance or Strength.";
  if (kind === "drain") return "Steal Health by touch. They resist with Endurance. Health you take is Health you gain.";
  if (kind === "blind") return "A touch can blind. They resist with Endurance. A worse color lasts longer. Use again can clear it.";
  return "";
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

function extraCount(rankId) {
  return EXTRA_STRIKES[rankId] ?? EXTRA_STRIKES.typical;
}

function tokenFor(actor, { controlled = false } = {}) {
  const list = actor?.getActiveTokens?.() ?? [];
  const token = controlled ? (list.find((entry) => entry.controlled) || list[0]) : list[0];
  return token || null;
}

function touchTarget(actor) {
  const target = combatTarget(actor?.id || "");
  if (!target) {
    globalThis.ui?.notifications?.warn("Target a token in reach.");
    return null;
  }
  const from = tokenFor(actor, { controlled: true });
  const to = tokenFor(target);
  if (!from || !to) {
    globalThis.ui?.notifications?.warn("Both tokens need to be on the map.");
    return null;
  }
  if (gridSeparation(from, to) > Math.max(1, reachSquares(actor)) + 0.25) {
    globalThis.ui?.notifications?.warn(`${target.name} is out of reach.`);
    return null;
  }
  return target;
}

function betterRank(actor, keys) {
  let best = "feeble";
  let score = -1;
  for (const key of keys) {
    const id = typeof actor?.getAbilityRank === "function" ? actor.getAbilityRank(key) : "typical";
    const index = rankIndex(id);
    if (index > score) {
      score = index;
      best = id;
    }
  }
  return best;
}

function blindId() {
  return globalThis.CONFIG?.specialStatusEffects?.BLIND || "blind";
}

function hasStatus(actor, id) {
  return [...(actor?.effects ?? [])].some((effect) => effect.statuses?.has?.(id) || effect.getFlag?.("core", "statusId") === id);
}

function requestId() {
  return globalThis.foundry?.utils?.randomID?.() || Math.random().toString(36).slice(2);
}

async function fromUuid(uuid) {
  if (!uuid) return null;
  try {
    return await globalThis.foundry?.utils?.fromUuid?.(uuid);
  } catch {
    return null;
  }
}

function isActiveGm() {
  const gm = globalThis.game?.users?.activeGM;
  return !!(gm && gm.id === globalThis.game?.user?.id);
}

async function perform(data) {
  try {
    const actor = await fromUuid(data.uuid);
    if (!actor) return null;
    if (data.action === "harm") {
      return actor.applyDamage(Number(data.amount) || 0, { energy: !!data.energy });
    }
    if (data.action === "mend") return actor.heal(Number(data.amount) || 0);
    if (data.action === "stun") {
      await setBattleState(actor, data.data || null);
      return true;
    }
    if (data.action === "status") {
      await actor.toggleStatusEffect(data.statusId, { active: !!data.active, overlay: !!data.overlay });
      return true;
    }
    if (data.action === "flag") {
      if (data.unset) await actor.unsetFlag("faserip", data.key);
      else await actor.setFlag("faserip", data.key, data.value);
      return true;
    }
    if (data.action === "poison") {
      await actor.setFlag("faserip", "poison", data.value);
      return true;
    }
  } catch (err) {
    console.warn("FASERIP | offensive", err);
    return null;
  }
  return null;
}

async function askJudge(action, payload) {
  if (globalThis.game?.user?.isGM) return perform({ action, ...payload });
  if (!globalThis.game?.socket) {
    globalThis.ui?.notifications?.warn("The Judge needs to be online for that.");
    return null;
  }
  return new Promise((resolve) => {
    const id = requestId();
    const timer = setTimeout(() => {
      waiters.delete(id);
      globalThis.ui?.notifications?.warn("The Judge needs to be online for that.");
      resolve(null);
    }, 5000);
    waiters.set(id, (reply) => {
      clearTimeout(timer);
      resolve(reply?.result ?? null);
    });
    globalThis.game.socket.emit("system.faserip", { system: "offensive", action, requestId: id, ...payload });
  });
}

async function owned(doc, action, payload) {
  if (globalThis.game?.user?.isGM || doc?.isOwner) return perform({ action, ...payload });
  return askJudge(action, payload);
}

async function choose(title, content, buttons) {
  const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) return buttons[0]?.action || "";
  const result = await DialogV2.wait({
    window: { title },
    content: `<p>${content}</p>`,
    buttons: buttons.map((button, index) => ({
      action: button.action,
      label: button.label,
      default: index === 0,
      callback: () => button.action
    })),
    rejectClose: false
  });
  if (!result || result === "cancel") return "";
  return result;
}

async function chooseMaterial(title) {
  const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
  const ranks = RANKS.filter((rank) => MATERIAL_EXAMPLES[rank.id] || rank.id === "typical");
  if (!DialogV2?.wait) return "typical";
  const options = ranks.map((rank) => {
    const sample = MATERIAL_EXAMPLES[rank.id] ? ` — ${esc(MATERIAL_EXAMPLES[rank.id])}` : "";
    return `<option value="${rank.id}">${esc(rank.label)}${sample}</option>`;
  }).join("");
  const form = await DialogV2.wait({
    window: { title },
    content: `<label>Material <select name="rank">${options}</select></label>`,
    buttons: [
      { action: "ok", label: "Compare", default: true, callback: (_event, button) => button.form },
      { action: "cancel", label: "Cancel" }
    ],
    rejectClose: false
  });
  if (!form || form === "cancel") return "";
  return form.elements?.rank?.value || form.querySelector?.('[name="rank"]')?.value || "";
}

async function resist(target, powerRank, keys, label) {
  const { rollFeat } = await import("./dice/universal-table.mjs");
  const message = await rollFeat({
    actor: target,
    rankId: betterRank(target, keys),
    intensityId: powerRank,
    label,
    skipCondition: true
  });
  if (!message) return null;
  const held = !!(message.getFlag?.("faserip", "intensityPass") ?? message.flags?.faserip?.intensityPass);
  const color = message.flags?.faserip?.color || "";
  return { held, color };
}

function failRounds(color) {
  if (color === "yellow") return 1;
  if (color === "green") return 2;
  if (color === "white") return 3;
  return 1;
}

async function strike(actor, item, column, rankFrom = "item", ability = "") {
  const { rollAction } = await import("./item-actions.mjs");
  const spec = {
    kind: "attack",
    column,
    ability: ability || (column === "grappling" || column === "grabbing" ? "strength" : column.startsWith("throw") ? "agility" : "fighting"),
    rankFrom,
    label: "Attack"
  };
  return rollAction(actor, spec, { item, label: item.name });
}

async function spendStrikes(actor, item, count) {
  let left = count;
  await actor.setFlag?.("faserip", "extraStrikes", left);
  while (left > 0) {
    const mode = await choose(item.name, `${left} extra strike${left === 1 ? "" : "s"} ready.`, [
      { action: "edged", label: "Edged" },
      { action: "blunt", label: "Blunt" },
      { action: "grab", label: "Grab" },
      { action: "done", label: "Done" }
    ]);
    if (!mode || mode === "done") break;
    const column = mode === "blunt" ? "blunt" : mode === "grab" ? "grappling" : "edged";
    await strike(actor, item, column);
    left -= 1;
    await actor.setFlag?.("faserip", "extraStrikes", left);
  }
  if (left <= 0) await actor.unsetFlag?.("faserip", "extraStrikes");
  globalThis.ui?.notifications?.info(left > 0
    ? `${item.name} still has ${left} extra strike${left === 1 ? "" : "s"} this round.`
    : `${item.name}: the extra strikes are spent.`);
  return true;
}

async function parts(actor, item) {
  const mode = await choose(item.name, "What does the extra part do?", [
    { action: "arm", label: "Extra arm" },
    { action: "tail", label: "Tail" },
    { action: "wings", label: "Wings" },
    { action: "cancel", label: "Cancel" }
  ]);
  if (!mode) return null;
  if (mode === "wings") {
    const { toggleFlying } = await import("./falling.mjs");
    const on = await toggleFlying(actor);
    globalThis.ui?.notifications?.info(on ? `${who(actor)} takes off.` : `${who(actor)} lands.`);
    return true;
  }
  if (mode === "tail") return strike(actor, item, "grappling");
  return spendStrikes(actor, item, 1);
}

async function claws(actor, item) {
  const power = rankValue(rankOf(item));
  const strength = typeof actor.getAbilityNumber === "function" ? actor.getAbilityNumber("strength") : 0;
  const buttons = [
    { action: "claws", label: "Claws" },
    { action: "fangs", label: "Fangs" },
    { action: "horns", label: "Horns" },
    { action: "spines", label: "Spines" }
  ];
  if (strength > power) buttons.push({ action: "strength", label: "Strength" });
  buttons.push({ action: "cancel", label: "Cancel" });
  const mode = await choose(item.name, "Natural weapons. Damage uses this rank, unless you strike with Strength.", buttons);
  if (!mode) return null;
  if (mode === "strength") return strike(actor, item, "edged", "ability", "strength");
  if (mode === "horns") return strike(actor, item, "blunt");
  if (mode === "spines") {
    const how = await choose(item.name, "Spines in hand, or thrown.", [
      { action: "melee", label: "Melee" },
      { action: "throw", label: "Throw" },
      { action: "cancel", label: "Cancel" }
    ]);
    if (!how) return null;
    return strike(actor, item, how === "throw" ? "throwEdged" : "edged");
  }
  return strike(actor, item, "edged");
}

async function energyTouch(actor, item) {
  const mode = await choose(item.name, "A full energy strike, or a jolt that stuns.", [
    { action: "strike", label: "Strike" },
    { action: "jolt", label: "Jolt" },
    { action: "cancel", label: "Cancel" }
  ]);
  if (!mode) return null;
  if (mode === "strike") return strike(actor, item, "energy", "item", "fighting");
  const target = touchTarget(actor);
  if (!target) return null;
  const result = await resist(target, rankOf(item), ["endurance"], `Resist ${item.name}`);
  if (!result) return null;
  if (result.held) {
    globalThis.ui?.notifications?.info(`${target.name} holds against ${item.name}.`);
    return true;
  }
  const now = globalThis.game?.combat?.round ?? 0;
  const ok = await owned(target, "stun", {
    uuid: target.uuid,
    data: { state: "stunned", rounds: 1, untilRound: now + 1 }
  });
  if (!ok) return null;
  globalThis.ui?.notifications?.info(`${item.name} jolts ${target.name} for 1 round.`);
  return true;
}

async function paralyze(actor, item) {
  const target = touchTarget(actor);
  if (!target) return null;
  const result = await resist(target, rankOf(item), ["endurance", "psyche"], `Resist ${item.name}`);
  if (!result) return null;
  if (result.held) {
    globalThis.ui?.notifications?.info(`${target.name} holds against ${item.name}.`);
    return true;
  }
  const rounds = failRounds(result.color);
  const now = globalThis.game?.combat?.round ?? 0;
  const ok = await owned(target, "stun", {
    uuid: target.uuid,
    data: { state: "stunned", rounds, untilRound: now + rounds, note: item.name }
  });
  if (!ok) return null;
  globalThis.ui?.notifications?.info(`${item.name} locks ${target.name} for ${rounds} round${rounds === 1 ? "" : "s"}.`);
  return true;
}

async function harmLiving(actor, item, target, { energy = false, label = "" } = {}) {
  const result = await resist(target, rankOf(item), ["endurance"], `Resist ${item.name}`);
  if (!result) return null;
  if (result.held) {
    globalThis.ui?.notifications?.info(`${target.name} holds against ${item.name}.`);
    return true;
  }
  const amount = rankValue(rankOf(item));
  const taken = await owned(target, "harm", { uuid: target.uuid, amount, energy });
  if (label) globalThis.ui?.notifications?.info(`${label} (${taken ?? 0} Health).`);
  return taken;
}

async function spoilMaterial(actor, item, note) {
  const material = await chooseMaterial(item.name);
  if (!material) return null;
  const power = rankIndex(rankOf(item));
  const wall = rankIndex(material);
  let line = `${item.name} marks the ${rankLabel(material)} material.`;
  if (power > wall) line = `${item.name} ruins the ${rankLabel(material)} material. ${note}`;
  else if (power === wall) line = `${item.name} damages the ${rankLabel(material)} material.`;
  globalThis.ui?.notifications?.info(line);
  return true;
}

async function rot(actor, item) {
  const mode = await choose(item.name, "Living flesh, or an organic material.", [
    { action: "flesh", label: "Flesh" },
    { action: "organic", label: "Organic" },
    { action: "cancel", label: "Cancel" }
  ]);
  if (!mode) return null;
  if (mode === "organic") return spoilMaterial(actor, item, "Cloth, wood, and hide give way.");
  const target = touchTarget(actor);
  if (!target) return null;
  return harmLiving(actor, item, target, { label: `${item.name} decays ${target.name}` });
}

async function acidBurn(actor, item) {
  const target = touchTarget(actor);
  if (!target) return null;
  return harmLiving(actor, item, target, { energy: true, label: `${item.name} burns ${target.name}` });
}

async function toxin(actor, item) {
  const target = touchTarget(actor);
  if (!target) return null;
  const result = await resist(target, rankOf(item), ["endurance"], `Resist ${item.name}`);
  if (!result) return null;
  if (result.held) {
    globalThis.ui?.notifications?.info(`${target.name} holds against ${item.name}.`);
    return true;
  }
  const amount = rankValue(rankOf(item));
  await owned(target, "harm", { uuid: target.uuid, amount, energy: false });
  const rounds = failRounds(result.color);
  await owned(target, "poison", { uuid: target.uuid, value: { intensityId: rankOf(item), rounds } });
  globalThis.ui?.notifications?.info(`${item.name} poisons ${target.name}. Health does not return until it is treated.`);
  return true;
}

async function adhesive(actor, item) {
  const target = touchTarget(actor);
  if (!target) return null;
  if (target.getFlag?.("faserip", "stuck")) {
    const mode = await choose(item.name, `${esc(target.name)} is already stuck.`, [
      { action: "release", label: "Release" },
      { action: "cancel", label: "Cancel" }
    ]);
    if (mode !== "release") return null;
    await owned(target, "flag", { uuid: target.uuid, key: "stuck", unset: true });
    await owned(target, "flag", { uuid: target.uuid, key: "tempo", unset: true });
    globalThis.ui?.notifications?.info(`${target.name} is free.`);
    return true;
  }
  const result = await resist(target, rankOf(item), ["strength"], `Resist ${item.name}`);
  if (!result) return null;
  if (result.held) {
    globalThis.ui?.notifications?.info(`${target.name} pulls free.`);
    return true;
  }
  await owned(target, "flag", { uuid: target.uuid, key: "stuck", value: { by: actor.uuid, rank: rankOf(item) } });
  await owned(target, "flag", { uuid: target.uuid, key: "tempo", value: "stop" });
  globalThis.ui?.notifications?.info(`${item.name} sticks ${target.name}. A Strength FEAT against ${rankLabel(rankOf(item))} breaks it, or Use again releases them.`);
  return true;
}

async function chemical(actor, item, corrosive) {
  const buttons = [
    { action: "acid", label: "Acid" },
    { action: "material", label: "Material" }
  ];
  if (!corrosive) buttons.push({ action: "toxin", label: "Toxin" }, { action: "glue", label: "Adhesive" });
  buttons.push({ action: "cancel", label: "Cancel" });
  const mode = await choose(item.name, corrosive ? "Burn a person, or eat a material." : "Acid, toxin, or adhesive.", buttons);
  if (!mode) return null;
  if (mode === "material") return spoilMaterial(actor, item, "The surface gives way.");
  if (mode === "toxin") return toxin(actor, item);
  if (mode === "glue") return adhesive(actor, item);
  return acidBurn(actor, item);
}

async function drain(actor, item) {
  const target = touchTarget(actor);
  if (!target) return null;
  const taken = await harmLiving(actor, item, target);
  if (taken == null || taken === true) return taken === true;
  const gained = Number(taken) || 0;
  if (gained > 0) {
    await owned(actor, "mend", { uuid: actor.uuid, amount: gained });
    globalThis.ui?.notifications?.info(`${who(actor)} drains ${gained} Health from ${target.name}.`);
  } else {
    globalThis.ui?.notifications?.info(`${item.name} does not get through ${target.name}'s protection.`);
  }
  return true;
}

async function blind(actor, item) {
  const target = touchTarget(actor);
  if (!target) return null;
  const id = blindId();
  if (hasStatus(target, id)) {
    const mode = await choose(item.name, `${esc(target.name)} is already blinded.`, [
      { action: "clear", label: "Clear" },
      { action: "again", label: "Blind again" },
      { action: "cancel", label: "Cancel" }
    ]);
    if (mode === "clear") {
      await owned(target, "status", { uuid: target.uuid, statusId: id, active: false, overlay: true });
      await owned(target, "flag", { uuid: target.uuid, key: "blindTouch", unset: true });
      globalThis.ui?.notifications?.info(`${target.name} can see again.`);
      return true;
    }
    if (mode !== "again") return null;
  }
  const result = await resist(target, rankOf(item), ["endurance"], `Resist ${item.name}`);
  if (!result) return null;
  if (result.held) {
    globalThis.ui?.notifications?.info(`${target.name} holds against ${item.name}.`);
    return true;
  }
  const rounds = result.color === "white" ? 0 : failRounds(result.color);
  const now = globalThis.game?.combat?.round ?? 0;
  await owned(target, "status", { uuid: target.uuid, statusId: id, active: true, overlay: true });
  await owned(target, "flag", {
    uuid: target.uuid,
    key: "blindTouch",
    value: rounds ? { rounds, untilRound: now + rounds } : { rounds: 0 }
  });
  globalThis.ui?.notifications?.info(rounds
    ? `${item.name} blinds ${target.name} for ${rounds} round${rounds === 1 ? "" : "s"}.`
    : `${item.name} blinds ${target.name}. It lasts until it is cleared.`);
  return true;
}

export async function useOffensivePower(actor, item) {
  const kind = offensiveKind(item?.name);
  if (!actor || !kind) return null;
  if (kind === "parts") return parts(actor, item);
  if (kind === "extra") return spendStrikes(actor, item, extraCount(rankOf(item)));
  if (kind === "energy") return energyTouch(actor, item);
  if (kind === "paralysis") return paralyze(actor, item);
  if (kind === "claws") return claws(actor, item);
  if (kind === "rot") return rot(actor, item);
  if (kind === "corrosive") return chemical(actor, item, true);
  if (kind === "chemical") return chemical(actor, item, false);
  if (kind === "drain") return drain(actor, item);
  if (kind === "blind") return blind(actor, item);
  return null;
}

async function clearRoundFlags() {
  const round = globalThis.game?.combat?.round ?? 0;
  const actors = globalThis.game?.actors ?? [];
  for (const actor of actors) {
    const saved = actor.getFlag?.("faserip", "blindTouch");
    if (saved?.untilRound && round >= saved.untilRound) {
      try {
        if (hasStatus(actor, blindId())) await actor.toggleStatusEffect(blindId(), { active: false, overlay: true });
        await actor.unsetFlag("faserip", "blindTouch");
      } catch (err) {
        console.warn("FASERIP | blind touch", err);
      }
    }
    if (actor.getFlag?.("faserip", "extraStrikes")) {
      try { await actor.unsetFlag("faserip", "extraStrikes"); } catch { /* the next round starts clean */ }
    }
  }
}

export function registerOffensive() {
  const game = globalThis.game;
  const Hooks = globalThis.Hooks;
  if (Hooks && !Hooks._faseripOffensive) {
    Hooks._faseripOffensive = true;
    Hooks.on("updateCombat", () => {
      if (!isActiveGm()) return;
      clearRoundFlags().catch((err) => console.warn("FASERIP | offensive tick", err));
    });
  }
  if (!game?.socket || game.faserip?._offensiveSocket) return;
  game.faserip = game.faserip || {};
  game.faserip._offensiveSocket = true;
  game.socket.on("system.faserip", async (data) => {
    if (data?.system !== "offensive") return;
    if (data.action === "reply") {
      const waiter = waiters.get(data.requestId);
      if (!waiter) return;
      waiters.delete(data.requestId);
      waiter(data);
      return;
    }
    if (!isActiveGm()) return;
    const result = await perform(data);
    game.socket.emit("system.faserip", {
      system: "offensive",
      action: "reply",
      requestId: data.requestId,
      result
    });
  });
}

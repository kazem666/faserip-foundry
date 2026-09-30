import { THROW_RANGE, rankIndex, rankLabel, rankValue } from "./config.mjs";
import { setBattleState, readBattle } from "./battle-results.mjs";
import { combatTarget, writePending } from "./play-rules.mjs";
import { feetPerArea, gridFeet, gridSeparation, reachSquares } from "./movement.mjs";

/**
 * Defensive powers. Regeneration amounts are a play rate, not a book chart.
 * Body armor and armor skin already soak. Absorption turns one hit into Health.
 * Water breathing and life support cover air. Healing and immortality put Health back.
 */

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

export function defenseKind(name) {
  const key = powerKey(name);
  if (key === "body armor" || key === "armor skin" || key === "body resistance") return "armor";
  if (key === "water breathing" || key === "waterbreathing") return "water";
  if (key === "absorption" || key === "absorption power") return "absorb";
  if (key === "regeneration") return "regen";
  if (key === "solar regeneration") return "solar";
  if (key === "recovery") return "recovery";
  if (key === "life support" || key === "self-sustenance") return "life";
  if (key === "pheromones") return "scent";
  if (key === "damage transfer") return "transfer";
  if (key === "healing" || key === "healing - self") return "heal";
  if (key === "immortality") return "immortal";
  return "";
}

export function defenseUseTitle(name) {
  const kind = defenseKind(name);
  if (kind === "armor") return "This already soaks physical damage at its rank. Energy attacks ignore 20 of that. Use reports the current soak.";
  if (kind === "water") return "Use toggles water breathing. Drowning and holding breath do not apply while it is on.";
  if (kind === "absorb") return "Use readies one hit. Damage up to this rank becomes Health. Anything past that still lands.";
  if (kind === "regen") return "Use toggles regeneration. Each combat round restores Health equal to this rank until Use turns it off.";
  if (kind === "solar") return "Use toggles regeneration that works in daylight. A dark or stormy scene leaves it idle.";
  if (kind === "recovery") return "Use rolls this rank to shake off stun or unconsciousness. Yellow or red clears it.";
  if (kind === "life") return "Use toggles life support. Air and drowning checks do not apply while it is on.";
  if (kind === "scent") return "Calm, draw, or unsettle a target in range. They resist with Intuition or Psyche.";
  if (kind === "transfer") return "Take an ally's wounds onto yourself, or push your wounds onto a target. An unwilling target resists.";
  if (kind === "heal") return "Restore Health equal to this rank. A downed character needs a FEAT. White leaves the wound.";
  if (kind === "immortal") return "When you are down or dead, Use rolls this rank. Anything but white puts you back on your feet.";
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

function tokenFor(actor, { controlled = false } = {}) {
  const list = actor?.getActiveTokens?.() ?? [];
  return (controlled ? (list.find((entry) => entry.controlled) || list[0]) : list[0]) || null;
}

function requestId() {
  return globalThis.foundry?.utils?.randomID?.() || Math.random().toString(36).slice(2);
}

function isActiveGm() {
  const gm = globalThis.game?.users?.activeGM;
  return !!(gm && gm.id === globalThis.game?.user?.id);
}

async function fromUuid(uuid) {
  if (!uuid) return null;
  try { return await globalThis.foundry?.utils?.fromUuid?.(uuid); } catch { return null; }
}

async function perform(data) {
  try {
    const actor = await fromUuid(data.uuid);
    if (!actor) return null;
    if (data.action === "harm") return actor.applyDamage(Number(data.amount) || 0, { ignoreArmor: true });
    if (data.action === "mend") return actor.heal(Number(data.amount) || 0);
    if (data.action === "stun") {
      await setBattleState(actor, data.data || null);
      return true;
    }
    if (data.action === "flag") {
      if (data.unset) await actor.unsetFlag("faserip", data.key);
      else await actor.setFlag("faserip", data.key, data.value);
      return true;
    }
    if (data.action === "status") {
      const on = !!(data.active);
      const has = [...(actor.effects ?? [])].some((effect) => effect.statuses?.has?.(data.statusId) || effect.getFlag?.("core", "statusId") === data.statusId);
      if (has !== on && actor.toggleStatusEffect) await actor.toggleStatusEffect(data.statusId, { active: on, overlay: !!data.overlay });
      return true;
    }
    if (data.action === "pending") {
      await writePending(actor, data.patch || {});
      return true;
    }
    if (data.action === "rise") {
      await setBattleState(actor, null);
      const health = Math.max(1, Number(data.health) || 1);
      await actor.update({
        "system.health.value": health,
        "system.condition.unconscious": false
      }, { faseripHeal: true });
      return true;
    }
  } catch (err) {
    console.warn("FASERIP | defense", err);
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
    globalThis.game.socket.emit("system.faserip", { system: "defense", action, requestId: id, ...payload });
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

function betterRank(actor, keys) {
  let best = "feeble";
  let score = -1;
  for (const key of keys) {
    const id = actor?.getAbilityRank?.(key) || "typical";
    const index = rankIndex(id);
    if (index > score) {
      score = index;
      best = id;
    }
  }
  return best;
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
  return { held, color: message.flags?.faserip?.color || "" };
}

function separated(actor, target) {
  const from = tokenFor(actor, { controlled: true });
  const to = tokenFor(target);
  if (!from || !to) return Infinity;
  return gridSeparation(from, to);
}

function touchTarget(actor) {
  const target = combatTarget(actor?.id || "");
  if (!target) {
    globalThis.ui?.notifications?.warn("Target a token in reach.");
    return null;
  }
  if (separated(actor, target) > Math.max(1, reachSquares(actor)) + 0.25) {
    globalThis.ui?.notifications?.warn(`${target.name} is out of reach.`);
    return null;
  }
  return target;
}

async function spark(actor) {
  const db = globalThis.Sequencer?.Database;
  const Sequence = globalThis.Sequence;
  const token = tokenFor(actor);
  if (!token || typeof Sequence !== "function" || typeof db?.entryExists !== "function") return;
  const file = ["jb2a.healing_generic", "jb2a.cure_wounds.400px.blue", "jb2a.energy_beam"].find((entry) => {
    try { return db.entryExists(entry); } catch { return false; }
  });
  if (!file) return;
  try {
    await new Sequence().effect().file(file).atLocation(token).scaleToObject(1.2).play();
  } catch (err) {
    console.warn("FASERIP | heal art", err);
  }
}

async function armor(actor) {
  const soak = actor.getBodyArmor?.() || 0;
  globalThis.ui?.notifications?.info(`${who(actor)} soaks ${soak} physical damage. Energy attacks ignore 20 of that.`);
  return true;
}

async function toggleFlag(actor, item, key, onText, offText) {
  const on = !actor.getFlag?.("faserip", key);
  if (on) await actor.setFlag?.("faserip", key, rankOf(item));
  else await actor.unsetFlag?.("faserip", key);
  globalThis.ui?.notifications?.info(on ? onText : offText);
  return true;
}

async function absorb(actor, item) {
  const ready = !!actor.getFlag?.("faserip", "absorbing");
  if (ready) {
    await actor.unsetFlag?.("faserip", "absorbing");
    globalThis.ui?.notifications?.info(`${item.name} is no longer ready.`);
    return true;
  }
  await actor.setFlag?.("faserip", "absorbing", { rank: rankOf(item) });
  globalThis.ui?.notifications?.info(`${item.name} is ready. The next hit up to ${rankLabel(rankOf(item))} becomes Health.`);
  return true;
}

async function toggleRegen(actor, item, solar) {
  const current = actor.getFlag?.("faserip", "regen");
  const same = current && !!current.solar === !!solar;
  if (same) {
    await actor.unsetFlag?.("faserip", "regen");
    globalThis.ui?.notifications?.info(`${item.name} is off.`);
    return true;
  }
  await actor.setFlag?.("faserip", "regen", { rank: rankOf(item), solar: !!solar });
  globalThis.ui?.notifications?.info(solar
    ? `${item.name} is on while the scene is in daylight.`
    : `${item.name} restores ${rankValue(rankOf(item))} Health each round.`);
  return true;
}

async function recovery(actor, item) {
  const cond = readBattle(actor);
  const down = cond?.state === "stunned" || cond?.state === "unconscious";
  if (!down && Number(actor.system?.health?.value) > 0) {
    globalThis.ui?.notifications?.info(`${who(actor)} has nothing to shake off.`);
    return true;
  }
  const { rollFeat } = await import("./dice/universal-table.mjs");
  const message = await rollFeat({ actor, rankId: rankOf(item), label: item.name, skipCondition: true });
  const color = message?.flags?.faserip?.color || "";
  if (!message) return null;
  if (color === "white" || color === "green") {
    globalThis.ui?.notifications?.info(`${item.name} does not break the condition.`);
    return true;
  }
  await setBattleState(actor, null);
  if (Number(actor.system?.health?.value) <= 0) await actor.update({ "system.health.value": 1, "system.condition.unconscious": false }, { faseripHeal: true });
  globalThis.ui?.notifications?.info(`${who(actor)} shakes it off.`);
  return true;
}

async function scent(actor, item) {
  const target = combatTarget(actor?.id || "");
  if (!target) {
    globalThis.ui?.notifications?.warn("Target a token.");
    return null;
  }
  const areas = THROW_RANGE[rankOf(item)] ?? 1;
  const squares = Math.max(2, Math.round(areas * (feetPerArea() / gridFeet())));
  if (separated(actor, target) > squares + 0.25) {
    globalThis.ui?.notifications?.warn(`${target.name} is out of scent range.`);
    return null;
  }
  const mode = await choose(item.name, `Scent on ${esc(target.name)}.`, [
    { action: "calm", label: "Calm" },
    { action: "draw", label: "Draw" },
    { action: "unsettle", label: "Unsettle" },
    { action: "cancel", label: "Cancel" }
  ]);
  if (!mode) return null;
  if (mode !== "calm") {
    const { resistHarm } = await import("./resistances.mjs");
    const warded = resistHarm(target, { name: item.name, rankId: rankOf(item), tags: ["emotion"] });
    if (warded.result === "cancel") {
      globalThis.ui?.notifications?.info(warded.note);
      return true;
    }
  }
  const result = await resist(target, rankOf(item), ["intuition", "psyche"], `Resist ${item.name}`);
  if (!result) return null;
  if (result.held) {
    globalThis.ui?.notifications?.info(`${target.name} holds against ${item.name}.`);
    return true;
  }
  if (mode === "calm") {
    await owned(target, "flag", { uuid: target.uuid, key: "emotion", unset: true });
    await owned(target, "status", { uuid: target.uuid, statusId: "fear", active: false });
    await owned(target, "status", { uuid: target.uuid, statusId: "rage", active: false });
    globalThis.ui?.notifications?.info(`${target.name} settles.`);
    return true;
  }
  if (mode === "draw") {
    await owned(target, "pending", { uuid: target.uuid, patch: { incomingCs: 1, incomingNote: "Pheromones +1 CS" } });
    globalThis.ui?.notifications?.info(`${target.name} is drawn in. The next attack against them is +1 column.`);
    return true;
  }
  await owned(target, "flag", { uuid: target.uuid, key: "emotion", value: "fear" });
  await owned(target, "status", { uuid: target.uuid, statusId: "fear", active: true });
  globalThis.ui?.notifications?.info(`${target.name} is unsettled. Their attacks are −1 column.`);
  return true;
}

function missingHealth(actor) {
  const max = Number(actor?.system?.health?.max) || 0;
  const value = Number(actor?.system?.health?.value) || 0;
  return Math.max(0, max - value);
}

async function transfer(actor, item) {
  const target = touchTarget(actor);
  if (!target) return null;
  const mode = await choose(item.name, "Take their wounds, or push yours onto them.", [
    { action: "take", label: "Take" },
    { action: "push", label: "Push" },
    { action: "cancel", label: "Cancel" }
  ]);
  if (!mode) return null;
  const cap = rankValue(rankOf(item));
  if (mode === "take") {
    const amount = Math.min(cap, missingHealth(target), Number(actor.system?.health?.value) || 0);
    if (amount <= 0) {
      globalThis.ui?.notifications?.info("There is no wound to take.");
      return true;
    }
    await owned(actor, "harm", { uuid: actor.uuid, amount });
    await owned(target, "mend", { uuid: target.uuid, amount });
    globalThis.ui?.notifications?.info(`${who(actor)} takes ${amount} Health of wounds from ${target.name}.`);
    return true;
  }
  const result = await resist(target, rankOf(item), ["endurance", "psyche"], `Resist ${item.name}`);
  if (!result) return null;
  if (result.held) {
    globalThis.ui?.notifications?.info(`${target.name} refuses the wounds.`);
    return true;
  }
  const amount = Math.min(cap, missingHealth(actor));
  if (amount <= 0) {
    globalThis.ui?.notifications?.info(`${who(actor)} has no wounds to push.`);
    return true;
  }
  await owned(target, "harm", { uuid: target.uuid, amount });
  await owned(actor, "mend", { uuid: actor.uuid, amount });
  globalThis.ui?.notifications?.info(`${who(actor)} pushes ${amount} Health of wounds onto ${target.name}.`);
  return true;
}

async function heal(actor, item) {
  const target = combatTarget(actor?.id || "") || actor;
  const self = target.id === actor.id;
  if (!self && separated(actor, target) > Math.max(1, reachSquares(actor)) + 0.25) {
    globalThis.ui?.notifications?.warn(`${target.name} is out of reach.`);
    return null;
  }
  const down = Number(target.system?.health?.value) <= 0 || readBattle(target)?.state === "unconscious" || readBattle(target)?.state === "dying";
  if (down) {
    const { rollFeat } = await import("./dice/universal-table.mjs");
    const message = await rollFeat({ actor, rankId: rankOf(item), label: item.name, skipCondition: true });
    const color = message?.flags?.faserip?.color || "";
    if (!message) return null;
    if (color === "white") {
      globalThis.ui?.notifications?.info(`${item.name} cannot close that wound.`);
      return true;
    }
  }
  const amount = rankValue(rankOf(item));
  await owned(target, "mend", { uuid: target.uuid, amount });
  await spark(target);
  globalThis.ui?.notifications?.info(`${item.name} restores ${amount} Health to ${target.name}.`);
  return true;
}

async function immortal(actor, item) {
  const cond = readBattle(actor);
  const down = Number(actor.system?.health?.value) <= 0 || cond?.state === "dying" || cond?.state === "dead" || cond?.state === "unconscious";
  if (!down) {
    globalThis.ui?.notifications?.info(`${item.name} is quiet while ${who(actor)} is up.`);
    return true;
  }
  const { rollFeat } = await import("./dice/universal-table.mjs");
  const message = await rollFeat({ actor, rankId: rankOf(item), label: item.name, skipCondition: true });
  const color = message?.flags?.faserip?.color || "";
  if (!message) return null;
  if (color === "white") {
    globalThis.ui?.notifications?.info(`${item.name} does not bring ${who(actor)} back yet.`);
    return true;
  }
  const health = Math.max(1, rankValue(rankOf(item)));
  await owned(actor, "rise", { uuid: actor.uuid, health });
  await spark(actor);
  globalThis.ui?.notifications?.info(`${who(actor)} returns with ${health} Health.`);
  return true;
}

export async function useDefensePower(actor, item) {
  const kind = defenseKind(item?.name);
  if (!actor || !kind) return null;
  if (kind === "armor") return armor(actor);
  if (kind === "water") {
    return toggleFlag(actor, item, "waterBreath", `${item.name} is on. ${who(actor)} can breathe water.`, `${item.name} is off.`);
  }
  if (kind === "absorb") return absorb(actor, item);
  if (kind === "regen") return toggleRegen(actor, item, false);
  if (kind === "solar") return toggleRegen(actor, item, true);
  if (kind === "recovery") return recovery(actor, item);
  if (kind === "life") {
    return toggleFlag(actor, item, "lifeSupport", `${item.name} is on. ${who(actor)} does not need air.`, `${item.name} is off.`);
  }
  if (kind === "scent") return scent(actor, item);
  if (kind === "transfer") return transfer(actor, item);
  if (kind === "heal") return heal(actor, item);
  if (kind === "immortal") return immortal(actor, item);
  return null;
}

function inDaylight() {
  const scene = globalThis.canvas?.scene;
  const dark = Number(scene?.environment?.darknessLevel ?? scene?.darkness ?? 0);
  const weather = String(scene?.weather || "");
  if (dark >= 0.5) return false;
  if (/storm|fog/i.test(weather)) return false;
  return true;
}

async function tickRegen() {
  if (!isActiveGm()) return;
  for (const actor of globalThis.game?.actors ?? []) {
    const regen = actor.getFlag?.("faserip", "regen");
    if (!regen?.rank) continue;
    if (regen.solar && !inDaylight()) continue;
    if (actor.getFlag?.("faserip", "poison")) continue;
    const missing = missingHealth(actor);
    if (missing <= 0) continue;
    try {
      await actor.heal(Math.min(missing, rankValue(regen.rank)));
    } catch (err) {
      console.warn("FASERIP | regeneration", err);
    }
  }
}

export function registerDefense() {
  const game = globalThis.game;
  const Hooks = globalThis.Hooks;
  if (Hooks && !Hooks._faseripDefense) {
    Hooks._faseripDefense = true;
    Hooks.on("updateCombat", () => {
      tickRegen().catch((err) => console.warn("FASERIP | regeneration", err));
    });
  }
  if (!game?.socket || game.faserip?._defenseSocket) return;
  game.faserip = game.faserip || {};
  game.faserip._defenseSocket = true;
  game.socket.on("system.faserip", async (data) => {
    if (data?.system !== "defense") return;
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
      system: "defense",
      action: "reply",
      requestId: data.requestId,
      result
    });
  });
}

import { THROW_RANGE, rankIndex } from "./config.mjs";
import { elevationFeet } from "./elevation.mjs";
import { combatTarget, writePending } from "./play-rules.mjs";
import {
  feetPerArea,
  formatMovement,
  gridFeet,
  gridSeparation,
  pickMapPoint,
  shoveActor
} from "./movement.mjs";

/**
 * Energy control. Distances are grid squares chosen for play, not a book chart.
 * Magnet pulls. Electricity stuns. Light blinds or brightens. Sound shoves or deafens.
 * Darkforce darkens a patch. Gravity weighs an area or drops someone.
 * Probability shifts the next roll one column. Nullify suppresses a power.
 * Reflection bounces the next energy hit. Time slows or hastens movement.
 */

const PULL_SQUARES = {
  shift0: 0, feeble: 1, poor: 1, typical: 2, good: 2, excellent: 3, remarkable: 4,
  incredible: 5, amazing: 6, monstrous: 8, unearthly: 10, shiftx: 12, shifty: 16,
  shiftz: 20, cl1000: 30, cl3000: 40, cl5000: 50, beyond: 60
};

const FIELD_SQUARES = {
  shift0: 1, feeble: 1, poor: 1, typical: 2, good: 2, excellent: 3, remarkable: 4,
  incredible: 5, amazing: 6, monstrous: 8, unearthly: 10, shiftx: 12, shifty: 14,
  shiftz: 16, cl1000: 20, cl3000: 24, cl5000: 28, beyond: 32
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

export function energyKind(name) {
  const key = powerKey(name);
  if (key === "magnetic manipulation") return "magnet";
  if (key === "electrical manipulation" || key === "electrical control") return "electric";
  if (key === "light manipulation" || key === "light control") return "light";
  if (key === "sound manipulation") return "sound";
  if (key === "darkforce manipulation") return "dark";
  if (key === "gravity manipulation") return "gravity";
  if (key === "probability manipulation" || key === "probability control") return "probability";
  if (key === "nullifying power") return "nullify";
  if (key === "energy reflection") return "reflect";
  if (key === "time control") return "time";
  return "";
}

export function energyUseTitle(name) {
  const kind = energyKind(name);
  if (kind === "magnet") return "Pull a target toward you, or push them away.";
  if (kind === "electric") return "Target someone. They resist with Endurance. A failed resist stuns them for 1 round.";
  if (kind === "light") return "Blind a target, brighten or darken a spot, or bend light to turn unseen.";
  if (kind === "sound") return "Blast shoves a target. Silence deafens one person. Quiet lays a silent patch and deafens whoever is in it.";
  if (kind === "dark") return "Lay a dark field, snare someone with a tendril, or blast them backward.";
  if (kind === "gravity") return "Place heavy or light gravity, ease someone's falls, or drop a flyer. They resist a drop with Strength or Endurance.";
  if (kind === "probability") return "Favor gives someone +1 column on their next roll. Foul gives −1. One use, then it is spent.";
  if (kind === "nullify") return "Target someone and suppress one power. They resist with Psyche. Use again can release it.";
  if (kind === "reflect") return "Use readies a bounce. If someone is targeted, the energy goes to them. Otherwise it hits the attacker, then turns off.";
  if (kind === "time") return "Hasten, slow, stop, or mark a spot and loop a target back to it. They resist with Psyche or Intuition unless marked willing.";
  return "";
}

export function pullSquares(rankId) {
  return PULL_SQUARES[rankId] ?? PULL_SQUARES.typical;
}

export function fieldSquares(rankId) {
  return FIELD_SQUARES[rankId] ?? FIELD_SQUARES.typical;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function who(actor) {
  return actor?.name || "The hero";
}

function rankOf(item) {
  return item?.system?.rank || "typical";
}

function reachFeet(item) {
  return (THROW_RANGE[rankOf(item)] ?? 2) * feetPerArea();
}

function gridSize() {
  return Number(globalThis.canvas?.grid?.size) || 100;
}

function sceneOf() {
  return globalThis.canvas?.scene || null;
}

function tokenFor(actor, { controlled = false } = {}) {
  const list = actor?.getActiveTokens?.() ?? [];
  const token = controlled ? (list.find((entry) => entry.controlled) || list[0]) : list[0];
  return token || null;
}

function centerOf(token) {
  const doc = token?.document || token;
  const grid = gridSize();
  if (!doc) return null;
  return {
    x: doc.x + ((doc.width || 1) * grid) / 2,
    y: doc.y + ((doc.height || 1) * grid) / 2
  };
}

function feetBetween(a, b) {
  return (Math.hypot(a.x - b.x, a.y - b.y) / gridSize()) * gridFeet();
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
  try {
    return await globalThis.foundry?.utils?.fromUuid?.(uuid);
  } catch {
    return null;
  }
}

async function perform(data) {
  const scene = globalThis.game?.scenes?.get?.(data.sceneId) || sceneOf();
  try {
    if (data.action === "embed") {
      if (!scene) return [];
      const docs = await scene.createEmbeddedDocuments(data.docType, data.data || []);
      return docs.map((doc) => doc.id).filter(Boolean);
    }
    if (data.action === "remove") {
      if (!scene) return false;
      for (const part of data.parts || []) {
        const ids = (part.ids || []).filter(Boolean);
        if (!ids.length) continue;
        for (const id of ids) {
          const doc = scene.getEmbeddedDocument?.(part.docType, id);
          if (doc?.locked) {
            try { await doc.update({ locked: false }); } catch { /* delete still follows */ }
          }
        }
        await scene.deleteEmbeddedDocuments(part.docType, ids);
      }
      return true;
    }
    if (data.action === "token") {
      const doc = await fromUuid(data.uuid);
      if (!doc) return false;
      await doc.update(data.update || {});
      return true;
    }
    if (data.action === "flag") {
      const doc = await fromUuid(data.uuid);
      if (!doc) return false;
      if (data.unset) await doc.unsetFlag("faserip", data.key);
      else await doc.setFlag("faserip", data.key, data.value === undefined ? true : data.value);
      return true;
    }
    if (data.action === "status") {
      const actor = await fromUuid(data.uuid);
      if (!actor || typeof actor.toggleStatusEffect !== "function") return false;
      const active = hasStatus(actor, data.statusId);
      if (active !== !!data.active) await actor.toggleStatusEffect(data.statusId, { active: !!data.active, overlay: !!data.overlay });
      return true;
    }
    if (data.action === "stun") {
      const actor = await fromUuid(data.uuid);
      if (!actor) return false;
      const { setBattleState } = await import("./battle-results.mjs");
      await setBattleState(actor, data.data);
      return true;
    }
    if (data.action === "pending") {
      const actor = await fromUuid(data.uuid);
      if (!actor) return false;
      await writePending(actor, data.patch || {});
      return true;
    }
    if (data.action === "drop") {
      const doc = await fromUuid(data.uuid);
      if (!doc) return false;
      const { applyFall } = await import("./falling.mjs");
      return applyFall(doc);
    }
  } catch (err) {
    console.warn("FASERIP | energy", err);
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
    globalThis.game.socket.emit("system.faserip", { system: "energy", action, requestId: id, ...payload });
  });
}

async function owned(doc, action, payload) {
  if (globalThis.game?.user?.isGM || doc?.isOwner) return perform({ action, ...payload });
  return askJudge(action, payload);
}

function hasStatus(actor, id) {
  return [...(actor?.effects ?? [])].some((effect) => effect.statuses?.has?.(id) || effect.getFlag?.("core", "statusId") === id);
}

function blindId() {
  return globalThis.CONFIG?.specialStatusEffects?.BLIND || "blind";
}

function nearEnough(actor, item, point) {
  const here = centerOf(tokenFor(actor, { controlled: true }));
  if (!here) {
    globalThis.ui?.notifications?.warn(`${who(actor)} needs a token on the map.`);
    return false;
  }
  const feet = feetBetween(here, point);
  if (feet > reachFeet(item) + 0.5) {
    globalThis.ui?.notifications?.warn(`${item?.name || "That power"} reaches ${formatMovement(reachFeet(item) / feetPerArea())}.`);
    return false;
  }
  return true;
}

function targetInReach(actor, item, target) {
  const from = tokenFor(actor, { controlled: true });
  const to = tokenFor(target);
  if (!from || !to) {
    globalThis.ui?.notifications?.warn("Target a token on the map.");
    return false;
  }
  const squares = gridSeparation(from, to);
  const max = Math.max(1, Math.round(reachFeet(item) / gridFeet()));
  if (squares > max + 0.25) {
    globalThis.ui?.notifications?.warn(`${target.name} is out of reach.`);
    return false;
  }
  return true;
}

function needTarget(actor, item) {
  const target = combatTarget(actor?.id || "");
  if (!target || !targetInReach(actor, item, target)) return null;
  return target;
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

async function choosePower(powers, title) {
  if (powers.length <= 1) return powers[0] || null;
  const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) return powers[0];
  const options = powers.map((power) => `<option value="${power.id}">${esc(power.name)}</option>`).join("");
  const form = await DialogV2.wait({
    window: { title },
    content: `<label>Power <select name="power">${options}</select></label>`,
    buttons: [
      { action: "take", label: "Choose", default: true, callback: (_event, button) => button.form },
      { action: "cancel", label: "Cancel" }
    ],
    rejectClose: false
  });
  if (!form || form === "cancel") return null;
  const id = form.elements?.power?.value || form.querySelector?.('[name="power"]')?.value || "";
  return powers.find((power) => power.id === id) || null;
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

async function askWilling(name) {
  return choose(name, `${esc(name)} can resist, or you can mark them willing.`, [
    { action: "resist", label: "They resist" },
    { action: "willing", label: "Willing" },
    { action: "cancel", label: "Cancel" }
  ]);
}

async function theyHold(target, powerRank, keys, label) {
  const { rollFeat } = await import("./dice/universal-table.mjs");
  const message = await rollFeat({
    actor: target,
    rankId: betterRank(target, keys),
    intensityId: powerRank,
    label,
    skipCondition: true
  });
  if (!message) return false;
  const pass = message.getFlag?.("faserip", "intensityPass") ?? message.flags?.faserip?.intensityPass;
  return !!pass;
}

async function postCard(actor, line, parts) {
  const ChatMessage = globalThis.ChatMessage;
  if (!ChatMessage?.create) return;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker?.({ actor }) || { alias: who(actor) },
    content: `<div class="faserip-energy"><p>${esc(line)}</p><div class="feat-actions"><button type="button" data-faserip-energy="clear">Dismiss</button></div></div>`,
    flags: { faserip: { energy: { sceneId: sceneOf()?.id || "", parts } } }
  });
}

async function slide(doc, x, y) {
  if (globalThis.game?.user?.isGM || doc?.isOwner) {
    try {
      if (typeof doc.move === "function") {
        const moved = await doc.move([{ x, y, action: "walk", snapped: false, explicit: true }], { showRuler: false });
        if (moved !== false) return true;
      }
    } catch (err) {
      console.warn("FASERIP | pull", err);
    }
    try {
      await doc.update({ x, y });
      return true;
    } catch (err) {
      console.warn("FASERIP | pull", err);
      return false;
    }
  }
  return askJudge("token", { uuid: doc.uuid, update: { x, y } });
}

async function pull(actor, item) {
  const mode = await choose(item.name, "Pull them closer, or push them away.", [
    { action: "pull", label: "Pull" },
    { action: "push", label: "Push" },
    { action: "cancel", label: "Cancel" }
  ]);
  if (!mode) return null;
  const target = needTarget(actor, item);
  if (!target) return null;
  if (mode === "push") {
    const squares = pullSquares(rankOf(item));
    const shove = await shoveActor(target, actor, squares, "back");
    const landed = shove?.squares ? `${shove.squares} square${shove.squares === 1 ? "" : "s"}` : "no open square";
    globalThis.ui?.notifications?.info(`${item.name} pushes ${target.name} (${landed}).`);
    return true;
  }
  const doc = tokenFor(target)?.document;
  const fromToken = tokenFor(actor, { controlled: true });
  const from = centerOf(fromToken);
  const here = centerOf(doc);
  if (!doc || !from || !here) return null;
  const squares = pullSquares(rankOf(item));
  const dx = from.x - here.x;
  const dy = from.y - here.y;
  const dist = Math.hypot(dx, dy);
  const travel = Math.min(squares * gridSize(), Math.max(0, dist - gridSize()));
  if (!(travel > gridSize() * 0.2)) {
    globalThis.ui?.notifications?.info(`${target.name} is already next to ${who(actor)}.`);
    return true;
  }
  const scale = travel / dist;
  const x = Math.round(here.x + dx * scale - (doc.width * gridSize()) / 2);
  const y = Math.round(here.y + dy * scale - (doc.height * gridSize()) / 2);
  const ok = await slide(doc, x, y);
  if (!ok) return null;
  globalThis.ui?.notifications?.info(`${item.name} pulls ${target.name} toward ${who(actor)}.`);
  return true;
}

async function shock(actor, item) {
  const target = needTarget(actor, item);
  if (!target) return null;
  const held = await theyHold(target, rankOf(item), ["endurance"], `Resist ${item.name}`);
  if (held) {
    globalThis.ui?.notifications?.info(`${target.name} holds against ${item.name}.`);
    return true;
  }
  const now = globalThis.game?.combat?.round ?? 0;
  const data = { state: "stunned", rounds: 1, untilRound: now + 1 };
  const ok = (globalThis.game?.user?.isGM || target.isOwner)
    ? await perform({ action: "stun", uuid: target.uuid, data })
    : await askJudge("stun", { uuid: target.uuid, data });
  if (!ok) return null;
  globalThis.ui?.notifications?.info(`${item.name} stuns ${target.name} for 1 round.`);
  return true;
}

async function setStatus(actor, statusId, active, overlay) {
  return owned(actor, "status", { uuid: actor.uuid, statusId, active, overlay });
}

async function blind(actor, item) {
  const target = combatTarget(actor.id || "");
  if (target) {
    if (!targetInReach(actor, item, target)) return null;
    const mode = await choose(item.name, "Blind them, or bend light around yourself.", [
      { action: "blind", label: "Blind" },
      { action: "bend", label: "Bend" },
      { action: "cancel", label: "Cancel" }
    ]);
    if (mode === "bend") return bendLight(actor, item);
    if (!mode) return null;
    const id = blindId();
    const on = hasStatus(target, id);
    if (!on) {
      const held = await theyHold(target, rankOf(item), ["intuition", "endurance"], `Resist ${item.name}`);
      if (held) {
        globalThis.ui?.notifications?.info(`${target.name} holds against ${item.name}.`);
        return true;
      }
    }
    const ok = await setStatus(target, id, !on, true);
    if (!ok) return null;
    globalThis.ui?.notifications?.info(on ? `${target.name} can see again.` : `${item.name} blinds ${target.name}.`);
    return true;
  }
  const mode = await choose(item.name, "Brighten, darken, or bend light around yourself.", [
    { action: "bright", label: "Brighten" },
    { action: "dim", label: "Darken" },
    { action: "bend", label: "Bend" },
    { action: "cancel", label: "Cancel" }
  ]);
  if (mode === "bend") return bendLight(actor, item);
  if (!mode) return null;
  if (mode === "bright") {
    return placeField(actor, item, {
      line: `${who(actor)} brightens a patch with ${item.name}.`,
      light: true,
      region: { mode: 1, modifier: 0.8 },
      fill: "#fef3c7",
      stroke: "#f59e0b",
      text: "Light"
    });
  }
  return placeField(actor, item, {
    line: `${who(actor)} dims a patch with ${item.name}.`,
    region: { mode: 2, modifier: 0.75 },
    fill: "#44403c",
    stroke: "#292524",
    text: "Dim",
    textColor: "#f5f5f4"
  });
}

async function bendLight(actor, item) {
  const { toggleInvisible } = await import("./body-form.mjs");
  const on = await toggleInvisible(actor);
  globalThis.ui?.notifications?.info(on
    ? `${item.name} bends light. ${who(actor)} is unseen.`
    : `${item.name} lets the light fall normally. ${who(actor)} can be seen.`);
  return true;
}

async function sound(actor, item) {
  const mode = await choose(item.name, "A blast shoves. Silence deafens one person. Quiet deafens a patch.", [
    { action: "blast", label: "Blast" },
    { action: "silence", label: "Silence" },
    { action: "quiet", label: "Quiet" },
    { action: "cancel", label: "Cancel" }
  ]);
  if (!mode) return null;
  if (mode === "quiet") {
    return placeField(actor, item, {
      line: `${who(actor)} lays a silent patch with ${item.name}.`,
      fill: "#cbd5e1",
      stroke: "#64748b",
      text: "Quiet",
      deaf: true
    });
  }
  const target = needTarget(actor, item);
  if (!target) return null;
  if (mode === "blast") {
    const squares = pullSquares(rankOf(item));
    if (squares <= 0) {
      globalThis.ui?.notifications?.info(`${item.name} does not move ${target.name}.`);
      return true;
    }
    const doc = tokenFor(target)?.document;
    const canMove = !!(globalThis.game?.user?.isGM || doc?.isOwner);
    const shove = canMove
      ? await shoveActor(target, actor, squares, "back")
      : await askJudge("gust", { actorUuid: actor.uuid, targetUuid: target.uuid, squares });
    const landed = shove?.squares ? `${shove.squares} square${shove.squares === 1 ? "" : "s"}` : "no open square";
    globalThis.ui?.notifications?.info(`${item.name} blasts ${target.name} (${landed}).`);
    return true;
  }
  const on = hasStatus(target, "deaf");
  if (!on) {
    const held = await theyHold(target, rankOf(item), ["endurance"], `Resist ${item.name}`);
    if (held) {
      globalThis.ui?.notifications?.info(`${target.name} holds against ${item.name}.`);
      return true;
    }
  }
  const ok = await setStatus(target, "deaf", !on, false);
  if (!ok) return null;
  globalThis.ui?.notifications?.info(on ? `${target.name} can hear again.` : `${item.name} deafens ${target.name}.`);
  return true;
}

async function placeField(actor, item, spec) {
  const point = await pickMapPoint(`${item.name}: click the center. Right-click cancels.`);
  if (!point || !nearEnough(actor, item, point)) return null;
  const radius = (fieldSquares(rankOf(item)) * gridSize()) / 2;
  const sceneId = sceneOf()?.id;
  const parts = [];
  const drawingIds = await askJudge("embed", {
    sceneId,
    docType: "Drawing",
    data: [{
      x: point.x - radius,
      y: point.y - radius,
      shape: { type: "e", width: radius * 2, height: radius * 2 },
      strokeWidth: 4,
      strokeColor: spec.stroke,
      strokeAlpha: 1,
      fillType: 1,
      fillColor: spec.fill,
      fillAlpha: 0.4,
      text: spec.text,
      fontSize: Math.max(16, Math.round(radius * 0.3)),
      textColor: spec.textColor || "#0f172a",
      interface: false,
      hidden: false,
      flags: { faserip: { energy: spec.text } }
    }]
  });
  if (drawingIds?.length) parts.push({ docType: "Drawing", ids: drawingIds });
  if (spec.light) {
    const feet = fieldSquares(rankOf(item)) * gridFeet();
    const lightIds = await askJudge("embed", {
      sceneId,
      docType: "AmbientLight",
      data: [{
        x: Math.round(point.x),
        y: Math.round(point.y),
        config: {
          bright: Math.max(gridFeet(), feet / 2),
          dim: Math.max(gridFeet() * 2, feet),
          color: "#fff7d6",
          alpha: 0.6,
          animation: { type: "pulse", speed: 2, intensity: 3 }
        },
        flags: { faserip: { energy: "light" } }
      }]
    });
    if (lightIds?.length) parts.push({ docType: "AmbientLight", ids: lightIds });
  }
  if (spec.region || spec.gravity != null) {
    const behavior = spec.gravity
      ? { name: spec.text, type: "modifyMovementCost", system: { difficulties: { walk: spec.gravity } } }
      : { name: spec.text, type: "adjustDarknessLevel", system: spec.region };
    const regionIds = await askJudge("embed", {
      sceneId,
      docType: "Region",
      data: [{
        name: spec.text,
        color: spec.fill,
        shapes: [{ type: "ellipse", x: point.x, y: point.y, radiusX: radius, radiusY: radius }],
        behaviors: [behavior],
        flags: { faserip: { energy: spec.text } }
      }]
    });
    if (regionIds?.length) parts.push({ docType: "Region", ids: regionIds });
  }
  if (!parts.length) {
    globalThis.ui?.notifications?.warn("That field could not be placed.");
    return null;
  }
  await postCard(actor, spec.line, parts);
  if (spec.deaf) {
    const tokens = globalThis.canvas?.tokens?.placeables ?? [];
    for (const token of tokens) {
      const spot = centerOf(token);
      const person = token.actor;
      if (!spot || !person) continue;
      if (Math.hypot(spot.x - point.x, spot.y - point.y) > radius) continue;
      await setStatus(person, "deaf", true, false);
    }
  }
  globalThis.ui?.notifications?.info(spec.line);
  return true;
}

async function dark(actor, item) {
  const mode = await choose(item.name, "A field darkens a patch. A tendril slows someone. A blast shoves them.", [
    { action: "field", label: "Field" },
    { action: "tendril", label: "Tendril" },
    { action: "blast", label: "Blast" },
    { action: "cancel", label: "Cancel" }
  ]);
  if (!mode) return null;
  if (mode === "tendril" || mode === "blast") {
    const target = needTarget(actor, item);
    if (!target) return null;
    if (mode === "blast") {
      const squares = pullSquares(rankOf(item));
      const shove = await shoveActor(target, actor, squares, "back");
      const landed = shove?.squares ? `${shove.squares} square${shove.squares === 1 ? "" : "s"}` : "no open square";
      globalThis.ui?.notifications?.info(`${item.name} blasts ${target.name} (${landed}).`);
      return true;
    }
    const held = await theyHold(target, rankOf(item), ["strength", "endurance"], `Resist ${item.name}`);
    if (held) {
      globalThis.ui?.notifications?.info(`${target.name} holds against ${item.name}.`);
      return true;
    }
    const ok = await owned(target, "flag", { uuid: target.uuid, key: "tempo", value: "slow" });
    if (!ok) return null;
    globalThis.ui?.notifications?.info(`${item.name} snares ${target.name}. Movement is halved.`);
    return true;
  }
  return placeField(actor, item, {
    line: `${who(actor)} lays a dark field with ${item.name}.`,
    region: { mode: 0, modifier: 0.9 },
    fill: "#1e1b4b",
    stroke: "#312e81",
    text: "Dark",
    textColor: "#e0e7ff"
  });
}

async function gravity(actor, item) {
  const mode = await choose(item.name, "Weigh an area, or drop someone who is aloft.", [
    { action: "heavy", label: "Heavy" },
    { action: "light", label: "Light" },
    { action: "ease", label: "Ease" },
    { action: "drop", label: "Drop" },
    { action: "cancel", label: "Cancel" }
  ]);
  if (!mode) return null;
  if (mode === "ease") {
    const target = needTarget(actor, item);
    if (!target) return null;
    const on = !!target.getFlag?.("faserip", "softFall");
    const ok = await owned(target, "flag", on
      ? { uuid: target.uuid, key: "softFall", unset: true }
      : { uuid: target.uuid, key: "softFall", value: true });
    if (!ok) return null;
    globalThis.ui?.notifications?.info(on
      ? `${target.name} falls at full weight again.`
      : `${item.name} eases ${target.name}. Falls deal half damage.`);
    return true;
  }
  if (mode === "drop") {
    const target = needTarget(actor, item);
    if (!target) return null;
    const token = tokenFor(target);
    if (elevationFeet(token) < 8) {
      globalThis.ui?.notifications?.info(`${target.name} is already on the ground.`);
      return true;
    }
    const held = await theyHold(target, rankOf(item), ["strength", "endurance"], `Resist ${item.name}`);
    if (held) {
      globalThis.ui?.notifications?.info(`${target.name} holds against ${item.name}.`);
      return true;
    }
    const doc = token?.document;
    const ok = (globalThis.game?.user?.isGM || doc?.isOwner)
      ? await perform({ action: "drop", uuid: doc?.uuid })
      : await askJudge("drop", { uuid: doc?.uuid });
    return ok ? true : null;
  }
  const heavy = mode === "heavy";
  return placeField(actor, item, {
    line: heavy
      ? `${who(actor)} makes a heavy-gravity patch. Walking costs double.`
      : `${who(actor)} makes a light-gravity patch. Walking costs half.`,
    gravity: heavy ? 2 : 0.5,
    fill: heavy ? "#78716c" : "#e7e5e4",
    stroke: heavy ? "#44403c" : "#a8a29e",
    text: heavy ? "Heavy" : "Light"
  });
}

async function probability(actor, item) {
  const mode = await choose(item.name, "Nudge the next roll by one column.", [
    { action: "favor", label: "Favor" },
    { action: "foul", label: "Foul" },
    { action: "cancel", label: "Cancel" }
  ]);
  if (!mode) return null;
  const target = mode === "foul" ? needTarget(actor, item) : (combatTarget(actor.id || "") || actor);
  if (!target) return null;
  if (target !== actor && !targetInReach(actor, item, target)) return null;
  if (mode === "foul") {
    const held = await theyHold(target, rankOf(item), ["psyche"], `Resist ${item.name}`);
    if (held) {
      globalThis.ui?.notifications?.info(`${target.name} holds against ${item.name}.`);
      return true;
    }
  }
  const patch = mode === "favor"
    ? { nextCs: 1, nextNote: "Probability +1 CS" }
    : { nextCs: -1, nextNote: "Probability −1 CS" };
  const ok = (globalThis.game?.user?.isGM || target.isOwner)
    ? await perform({ action: "pending", uuid: target.uuid, patch })
    : await askJudge("pending", { uuid: target.uuid, patch });
  if (!ok) return null;
  const line = mode === "favor"
    ? `${item.name} favors ${target.name}. Their next roll is +1 column.`
    : `${item.name} fouls ${target.name}. Their next roll is −1 column.`;
  globalThis.ui?.notifications?.info(line);
  return true;
}

function isNullified(item) {
  return !!(item?.getFlag?.("faserip", "nullified") || item?.flags?.faserip?.nullified);
}

async function nullify(actor, item) {
  const target = needTarget(actor, item);
  if (!target) return null;
  const powers = [...(target.items ?? [])].filter((entry) => entry.type === "power");
  if (!powers.length) {
    globalThis.ui?.notifications?.warn(`${target.name} has no powers to suppress.`);
    return null;
  }
  const held = powers.filter((entry) => isNullified(entry));
  const open = powers.filter((entry) => !isNullified(entry));
  let mode = "suppress";
  if (held.length) {
    mode = await choose(item.name, `${esc(target.name)} has a suppressed power.`, [
      { action: "release", label: "Release" },
      { action: "suppress", label: "Suppress another" },
      { action: "cancel", label: "Cancel" }
    ]);
    if (!mode) return null;
  }
  if (mode === "release") {
    for (const entry of held) {
      const ok = await owned(entry, "flag", { uuid: entry.uuid, key: "nullified", unset: true });
      if (!ok) return null;
    }
    globalThis.ui?.notifications?.info(`${item.name} releases ${target.name}.`);
    return true;
  }
  const picked = await choosePower(open, item.name);
  if (!picked) return null;
  const heldResist = await theyHold(target, rankOf(item), ["psyche"], `Resist ${item.name}`);
  if (heldResist) {
    globalThis.ui?.notifications?.info(`${target.name} holds against ${item.name}.`);
    return true;
  }
  const ok = await owned(picked, "flag", { uuid: picked.uuid, key: "nullified", value: { by: actor.uuid, rank: rankOf(item) } });
  if (!ok) return null;
  globalThis.ui?.notifications?.info(`${item.name} suppresses ${picked.name}.`);
  return true;
}

async function reflect(actor, item) {
  const on = !!(actor.getFlag?.("faserip", "reflecting"));
  const aimed = combatTarget(actor.id || "");
  const value = aimed && aimed.id !== actor.id ? { uuid: aimed.uuid } : true;
  const flag = await owned(actor, "flag", on
    ? { uuid: actor.uuid, key: "reflecting", unset: true }
    : { uuid: actor.uuid, key: "reflecting", value });
  if (!flag) return null;
  await setStatus(actor, "reflect", !on, false);
  const aimedName = value?.uuid ? aimed?.name : "";
  globalThis.ui?.notifications?.info(on
    ? `${item.name} is off.`
    : aimedName
      ? `${item.name} is ready. The next energy hit goes to ${aimedName}.`
      : `${item.name} is ready. The next energy hit bounces back.`);
  return true;
}

async function time(actor, item) {
  const target = needTarget(actor, item);
  if (!target) return null;
  const current = target.getFlag?.("faserip", "tempo") || "";
  const buttons = [
    { action: "fast", label: "Hasten" },
    { action: "slow", label: "Slow" },
    { action: "stop", label: "Stop" },
    { action: "loop", label: "Loop" }
  ];
  if (current) buttons.push({ action: "restore", label: "Restore" });
  buttons.push({ action: "cancel", label: "Cancel" });
  const mode = await choose(item.name, `Change how fast ${esc(target.name)} moves.`, buttons);
  if (!mode) return null;
  if (mode !== "restore") {
    const willing = await askWilling(target.name);
    if (!willing) return null;
    if (willing === "resist") {
      const held = await theyHold(target, rankOf(item), ["psyche", "intuition"], `Resist ${item.name}`);
      if (held) {
        globalThis.ui?.notifications?.info(`${target.name} holds against ${item.name}.`);
        return true;
      }
    }
  }
  if (mode === "loop") return markLoop(target, item);
  const next = mode === "fast" ? "fast" : mode === "slow" ? "slow" : mode === "stop" ? "stop" : "";
  const ok = next
    ? await owned(target, "flag", { uuid: target.uuid, key: "tempo", value: next })
    : await owned(target, "flag", { uuid: target.uuid, key: "tempo", unset: true });
  if (!ok) return null;
  const line = next === "fast"
    ? `${target.name} hastens. Movement is doubled.`
    : next === "slow"
      ? `${target.name} slows. Movement is halved.`
      : next === "stop"
        ? `${target.name} crawls. Movement is a quarter of normal.`
        : `${target.name} returns to normal speed.`;
  globalThis.ui?.notifications?.info(`${item.name}: ${line}`);
  return true;
}

async function markLoop(target, item) {
  const doc = tokenFor(target)?.document;
  if (!doc) return null;
  const saved = target.getFlag?.("faserip", "timeLoop");
  if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
    const ok = await askJudge("token", { uuid: doc.uuid, update: { x: saved.x, y: saved.y } });
    if (!ok) return null;
    await owned(target, "flag", { uuid: target.uuid, key: "timeLoop", unset: true });
    globalThis.ui?.notifications?.info(`${item.name} snaps ${target.name} back.`);
    return true;
  }
  const ok = await owned(target, "flag", { uuid: target.uuid, key: "timeLoop", value: { x: doc.x, y: doc.y } });
  if (!ok) return null;
  globalThis.ui?.notifications?.info(`${item.name} marks ${target.name}. Use again and choose Loop to snap them back.`);
  return true;
}

export async function useEnergyPower(actor, item) {
  const kind = energyKind(item?.name);
  if (!actor || !kind) return null;
  if (!sceneOf()) {
    globalThis.ui?.notifications?.warn("Open a scene first.");
    return null;
  }
  if (kind === "magnet") return pull(actor, item);
  if (kind === "electric") return shock(actor, item);
  if (kind === "light") return blind(actor, item);
  if (kind === "sound") return sound(actor, item);
  if (kind === "dark") return dark(actor, item);
  if (kind === "gravity") return gravity(actor, item);
  if (kind === "probability") return probability(actor, item);
  if (kind === "nullify") return nullify(actor, item);
  if (kind === "reflect") return reflect(actor, item);
  if (kind === "time") return time(actor, item);
  return null;
}

export function bindEnergyChat(message, html) {
  const root = html instanceof HTMLElement ? html : html?.[0];
  const card = root?.querySelector?.(".faserip-energy");
  if (!card || card.dataset.energyBound) return;
  const energy = message.getFlag?.("faserip", "energy") ?? message.flags?.faserip?.energy;
  if (!energy?.parts?.length) return;
  card.dataset.energyBound = "1";
  card.querySelector("[data-faserip-energy='clear']")?.addEventListener("click", (event) => {
    event.preventDefault();
    clearEnergy(message, energy).catch((err) => console.warn("FASERIP | energy", err));
  });
}

async function clearEnergy(message, energy) {
  const ok = await askJudge("remove", { sceneId: energy.sceneId, parts: energy.parts });
  if (!ok) return;
  try {
    await message.update?.({ content: `<div class="faserip-energy"><p>Dismissed.</p></div>` });
  } catch {
    /* the field is already gone */
  }
  globalThis.ui?.notifications?.info("Dismissed.");
}

function ensureStatus(id, name, img) {
  const effects = globalThis.CONFIG?.statusEffects;
  if (!Array.isArray(effects) || effects.some((effect) => effect.id === id)) return;
  effects.push({ id, name, img });
}

export function registerEnergy() {
  ensureStatus("deaf", "Deafened", "icons/svg/deaf.svg");
  ensureStatus("reflect", "Reflecting", "icons/svg/mage-shield.svg");
  ensureStatus(blindId(), "Blinded", "icons/svg/blind.svg");
  const Hooks = globalThis.Hooks;
  if (Hooks && !Hooks._faseripEnergy) {
    Hooks._faseripEnergy = true;
    Hooks.on("renderChatMessageHTML", bindEnergyChat);
  }
  const game = globalThis.game;
  if (!game?.socket || game.faserip?._energySocket) return;
  game.faserip = game.faserip || {};
  game.faserip._energySocket = true;
  game.socket.on("system.faserip", async (data) => {
    if (data?.system !== "energy") return;
    if (data.action === "reply") {
      const waiter = waiters.get(data.requestId);
      if (!waiter) return;
      waiters.delete(data.requestId);
      waiter(data);
      return;
    }
    if (!isActiveGm()) return;
    if (data.action === "gust") {
      const actor = await fromUuid(data.actorUuid);
      const target = await fromUuid(data.targetUuid);
      const result = actor && target ? await shoveActor(target, actor, data.squares, "back") : null;
      game.socket.emit("system.faserip", { system: "energy", action: "reply", requestId: data.requestId, result });
      return;
    }
    const result = await perform(data);
    game.socket.emit("system.faserip", { system: "energy", action: "reply", requestId: data.requestId, result });
  });
}

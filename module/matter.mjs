import { THROW_RANGE, rankIndex } from "./config.mjs";
import { setDensityMode } from "./body-form.mjs";
import { combatTarget } from "./play-rules.mjs";
import {
  feetPerArea,
  formatMovement,
  gridFeet,
  gridSeparation,
  pickMapPoint,
  shoveActor
} from "./movement.mjs";

/**
 * Matter control. Distances are grid squares chosen for play, not a book chart.
 * Earth raises a wall. Air shoves. Fire lights a spot. Water slows walking.
 * Weather changes the scene. The Others powers change a targeted character.
 */

const GUST_SQUARES = {
  shift0: 0, feeble: 1, poor: 1, typical: 2, good: 2, excellent: 3, remarkable: 4,
  incredible: 5, amazing: 6, monstrous: 8, unearthly: 10, shiftx: 12, shifty: 16,
  shiftz: 20, cl1000: 30, cl3000: 40, cl5000: 50, beyond: 60
};

const POOL_SQUARES = {
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

export function matterKind(name) {
  const key = powerKey(name);
  if (key === "earth control") return "earth";
  if (key === "air control") return "air";
  if (key === "fire control") return "fire";
  if (key === "water control") return "water";
  if (key === "weather control" || key === "weather") return "weather";
  if (key === "density manipulation - others") return "density";
  if (key === "body transformation - others") return "body";
  if (key === "animal transformation - others") return "animal";
  return "";
}

export function matterUseTitle(name) {
  const kind = matterKind(name);
  if (kind === "earth") return "Choose a wall, a pit, or a hurl that shoves someone. Drop or Fill on the chat card removes a wall or pit.";
  if (kind === "air") return "Gust shoves a target. Buffer raises a wall of air you can see through.";
  if (kind === "fire") return "Target a token to light or extinguish it, or click a spot to start a flame. Extinguish is on the chat card.";
  if (kind === "water") return "Pool water that slows walking, or send a wave that shoves someone. Dry up removes a pool.";
  if (kind === "weather") return "Choose clear, rain, fog, storm, or a wind that shoves a target.";
  if (kind === "density") return "Target someone. Use cycles solid, diffuse, then normal. Solid is tougher and slower. They resist with Strength or Endurance unless marked willing.";
  if (kind === "body") return "Turn a target into a likeness, a gas, or a liquid. They resist with Endurance or Psyche. Use again restores them.";
  if (kind === "animal") return "Target someone and pick an animal picture. Use again restores their look. They resist with Endurance or Psyche unless marked willing.";
  return "";
}

export function gustSquares(rankId) {
  return GUST_SQUARES[rankId] ?? GUST_SQUARES.typical;
}

export function poolSquares(rankId) {
  return POOL_SQUARES[rankId] ?? POOL_SQUARES.typical;
}

export function shortenSegment(ax, ay, bx, by, maxPx) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (!(maxPx > 0) || !(len > maxPx)) return { x: bx, y: by };
  const scale = maxPx / len;
  return { x: ax + dx * scale, y: ay + dy * scale };
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

function senseNormal() {
  return globalThis.CONST?.EDGE_SENSE_TYPES?.NORMAL ?? globalThis.CONST?.WALL_SENSE_TYPES?.NORMAL ?? 20;
}

function moveNormal() {
  return globalThis.CONST?.WALL_MOVEMENT_TYPES?.NORMAL ?? 20;
}

function requestId() {
  return globalThis.foundry?.utils?.randomID?.() || Math.random().toString(36).slice(2);
}

function isActiveGm() {
  const gm = globalThis.game?.users?.activeGM;
  return !!(gm && gm.id === globalThis.game?.user?.id);
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
    waiters.set(id, (data) => {
      clearTimeout(timer);
      resolve(data?.result ?? null);
    });
    globalThis.game.socket.emit("system.faserip", { system: "matter", action, requestId: id, ...payload });
  });
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
    if (data.action === "weather") return applyWeather(data.mode, data.sceneId);
    if (data.action === "gust") {
      const actor = await fromUuid(data.actorUuid);
      const target = await fromUuid(data.targetUuid);
      if (!actor || !target) return null;
      return shoveActor(target, actor, data.squares, "back");
    }
    if (data.action === "density") {
      const actor = await fromUuid(data.uuid);
      if (!actor) return "";
      await setDensityMode(actor, data.mode || "", data.rankId || "");
      return data.mode || "";
    }
    if (data.action === "flag") {
      const actor = await fromUuid(data.uuid);
      if (!actor) return false;
      if (data.unset) await actor.unsetFlag("faserip", data.key);
      else await actor.setFlag("faserip", data.key, data.value);
      return true;
    }
    if (data.action === "token") {
      const doc = await fromUuid(data.uuid);
      if (!doc) return false;
      await doc.update(data.update || {});
      return true;
    }
  } catch (err) {
    console.warn("FASERIP | matter", err);
    return null;
  }
  return null;
}

async function fromUuid(uuid) {
  if (!uuid) return null;
  try {
    return await globalThis.foundry?.utils?.fromUuid?.(uuid);
  } catch {
    return null;
  }
}

function nearEnough(actor, item, point) {
  const here = centerOf(tokenFor(actor, { controlled: true }));
  if (!here) {
    globalThis.ui?.notifications?.warn(`${who(actor)} needs a token on the map.`);
    return false;
  }
  const feet = feetBetween(here, point);
  const budget = reachFeet(item);
  if (feet > budget + 0.5) {
    globalThis.ui?.notifications?.warn(`${item?.name || "That power"} reaches ${formatMovement(budget / feetPerArea())}.`);
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
  const max = Math.max(1, Math.round((reachFeet(item) / gridFeet())));
  if (squares > max + 0.25) {
    globalThis.ui?.notifications?.warn(`${target.name} is out of reach.`);
    return false;
  }
  return true;
}

async function postCard(actor, line, button, parts) {
  const ChatMessage = globalThis.ChatMessage;
  if (!ChatMessage?.create) return;
  const sceneId = sceneOf()?.id || "";
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker?.({ actor }) || { alias: who(actor) },
    content: `<div class="faserip-matter"><p>${esc(line)}</p><div class="feat-actions"><button type="button" data-faserip-matter="clear">${esc(button)}</button></div></div>`,
    flags: { faserip: { matter: { sceneId, parts } } }
  });
}

async function raiseEarth(actor, item, opts = {}) {
  const start = await pickMapPoint(`${item.name}: click one end of the wall. Right-click cancels.`);
  if (!start || !nearEnough(actor, item, start)) return null;
  const raw = await pickMapPoint(`${item.name}: click the other end.`);
  if (!raw) return null;
  const here = centerOf(tokenFor(actor, { controlled: true }));
  const maxPx = (reachFeet(item) / gridFeet()) * gridSize();
  const reached = here ? shortenSegment(here.x, here.y, raw.x, raw.y, maxPx) : raw;
  const end = shortenSegment(start.x, start.y, reached.x, reached.y, maxPx);
  if (Math.hypot(end.x - start.x, end.y - start.y) < gridSize() * 0.25) {
    globalThis.ui?.notifications?.warn("That wall is too short.");
    return null;
  }
  const ids = await askJudge("embed", {
    sceneId: sceneOf()?.id,
    docType: "Wall",
    data: [{
      c: [Math.round(start.x), Math.round(start.y), Math.round(end.x), Math.round(end.y)],
      move: moveNormal(),
      sight: opts.seeThrough ? 0 : senseNormal(),
      light: opts.seeThrough ? 0 : senseNormal(),
      sound: opts.seeThrough ? 0 : senseNormal(),
      flags: { faserip: { matter: "earth" } }
    }]
  });
  if (!ids?.length) {
    globalThis.ui?.notifications?.warn("That wall could not be raised.");
    return null;
  }
  const line = opts.seeThrough
    ? `${who(actor)} raises a buffer of air with ${item.name}. You can see through it.`
    : `${who(actor)} raises a wall with ${item.name}.`;
  await postCard(actor, line, opts.seeThrough ? "Drop buffer" : "Drop wall", [{ docType: "Wall", ids }]);
  globalThis.ui?.notifications?.info(line);
  return true;
}

async function gust(actor, item) {
  const target = combatTarget(actor.id || "");
  if (!target || !targetInReach(actor, item, target)) return null;
  const squares = gustSquares(rankOf(item));
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
  const line = `${who(actor)} gusts ${target.name} (${landed}).`;
  globalThis.ui?.notifications?.info(line);
  return true;
}

function flameConfig(rankId) {
  const feet = poolSquares(rankId) * gridFeet();
  return {
    bright: Math.max(gridFeet(), feet / 2),
    dim: Math.max(gridFeet() * 2, feet),
    color: "#ff7a18",
    alpha: 0.7,
    animation: { type: "torch", speed: 3, intensity: 5 }
  };
}

async function ignite(actor, item) {
  const target = combatTarget(actor.id || "");
  if (target) {
    if (!targetInReach(actor, item, target)) return null;
    const doc = tokenFor(target)?.document;
    if (!doc) return null;
    const saved = doc.getFlag?.("faserip", "fireLight");
    if (saved) {
      const ok = await askJudge("token", {
        uuid: doc.uuid,
        update: { light: saved.light || {}, "flags.faserip.-=fireLight": null }
      });
      if (!ok) return null;
      globalThis.ui?.notifications?.info(`${item.name} extinguishes the flame on ${target.name}.`);
      return true;
    }
    const light = flameConfig(rankOf(item));
    const ok = await askJudge("token", {
      uuid: doc.uuid,
      update: {
        light,
        "flags.faserip.fireLight": { light: doc.light?.toObject?.() || {} }
      }
    });
    if (!ok) return null;
    globalThis.ui?.notifications?.info(`${item.name} lights ${target.name}.`);
    return true;
  }
  const point = await pickMapPoint(`${item.name}: click where the flame starts. Right-click cancels.`);
  if (!point || !nearEnough(actor, item, point)) return null;
  const config = flameConfig(rankOf(item));
  const ids = await askJudge("embed", {
    sceneId: sceneOf()?.id,
    docType: "AmbientLight",
    data: [{
      x: Math.round(point.x),
      y: Math.round(point.y),
      config,
      flags: { faserip: { matter: "fire" } }
    }]
  });
  if (!ids?.length) {
    globalThis.ui?.notifications?.warn("That flame could not be lit.");
    return null;
  }
  const line = `${who(actor)} lights a flame with ${item.name}.`;
  await postCard(actor, line, "Extinguish", [{ docType: "AmbientLight", ids }]);
  globalThis.ui?.notifications?.info(line);
  return true;
}

function waterDifficulties(walk = 2) {
  return { walk };
}

async function pool(actor, item, spec = {}) {
  const label = spec.text || "Water";
  const point = await pickMapPoint(`${item.name}: click where the ${label.toLowerCase()} goes. Right-click cancels.`);
  if (!point || !nearEnough(actor, item, point)) return null;
  const radius = (poolSquares(rankOf(item)) * gridSize()) / 2;
  const drawingIds = await askJudge("embed", {
    sceneId: sceneOf()?.id,
    docType: "Drawing",
    data: [{
      x: point.x - radius,
      y: point.y - radius,
      shape: { type: "e", width: radius * 2, height: radius * 2 },
      strokeWidth: 4,
      strokeColor: spec.stroke || "#0284c7",
      strokeAlpha: 1,
      fillType: 1,
      fillColor: spec.fill || "#38bdf8",
      fillAlpha: 0.45,
      text: label,
      fontSize: Math.max(16, Math.round(radius * 0.35)),
      textColor: spec.textColor || "#0c4a6e",
      interface: false,
      hidden: false,
      flags: { faserip: { matter: "water" } }
    }]
  });
  const regionIds = await askJudge("embed", {
    sceneId: sceneOf()?.id,
    docType: "Region",
    data: [{
      name: label,
      color: spec.fill || "#0ea5e9",
      shapes: [{ type: "ellipse", x: point.x, y: point.y, radiusX: radius, radiusY: radius }],
      behaviors: [{
        name: "Wade",
        type: "modifyMovementCost",
        system: { difficulties: waterDifficulties(spec.walk || 2) }
      }],
      flags: { faserip: { matter: "water" } }
    }]
  });
  const parts = [];
  if (drawingIds?.length) parts.push({ docType: "Drawing", ids: drawingIds });
  if (regionIds?.length) parts.push({ docType: "Region", ids: regionIds });
  if (!parts.length) {
    globalThis.ui?.notifications?.warn("That water could not be shaped.");
    return null;
  }
  const line = spec.line || `${who(actor)} pools water with ${item.name}. Walking through it costs double.`;
  await postCard(actor, line, spec.button || "Dry up", parts);
  globalThis.ui?.notifications?.info(line);
  return true;
}

async function chooseSky() {
  const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) return "rain";
  const result = await DialogV2.wait({
    window: { title: "Weather Control" },
    content: "<p>Shift the weather on this scene.</p>",
    buttons: [
      { action: "clear", label: "Clear", callback: () => "clear" },
      { action: "rain", label: "Rain", default: true, callback: () => "rain" },
      { action: "fog", label: "Fog", callback: () => "fog" },
      { action: "storm", label: "Storm", callback: () => "storm" },
      { action: "wind", label: "Wind", callback: () => "wind" }
    ],
    rejectClose: false
  });
  if (!result || result === "cancel") return "";
  return result;
}

function weatherKey(preferred) {
  const effects = globalThis.CONFIG?.weatherEffects || {};
  if (effects[preferred]) return preferred;
  const names = Object.keys(effects);
  return names.find((key) => key.toLowerCase().includes(preferred)) || "";
}

async function applyWeather(mode, sceneId) {
  const scene = globalThis.game?.scenes?.get?.(sceneId) || sceneOf();
  if (!scene) return "";
  const saved = scene.getFlag?.("faserip", "sky");
  const current = {
    weather: scene.weather || "",
    darkness: Number(scene.environment?.darknessLevel) || 0
  };
  let weather = "";
  let darkness = saved?.darkness ?? current.darkness;
  if (mode === "clear") {
    weather = saved?.weather || "";
    darkness = saved?.darkness ?? 0;
  } else if (mode === "fog") {
    weather = weatherKey("fog");
    darkness = Math.max(darkness, 0.55);
  } else if (mode === "storm") {
    weather = weatherKey("storm") || weatherKey("rain");
    darkness = Math.max(darkness, 0.75);
  } else {
    weather = weatherKey("rain");
    darkness = Math.max(darkness, 0.35);
  }
  const update = { weather, "environment.darknessLevel": darkness };
  if (mode === "clear") update["flags.faserip.-=sky"] = null;
  else if (!saved) update["flags.faserip.sky"] = current;
  await scene.update(update);
  const label = mode === "clear" ? "clear" : mode;
  return `The sky turns ${label}.`;
}

async function shiftWeather(actor, item) {
  const mode = await chooseSky();
  if (!mode) return null;
  if (mode === "wind") return gust(actor, item);
  const line = await askJudge("weather", { mode, sceneId: sceneOf()?.id });
  if (!line) {
    globalThis.ui?.notifications?.warn(`${item.name} could not change the sky.`);
    return null;
  }
  globalThis.ui?.notifications?.info(`${who(actor)}: ${line}`);
  return true;
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
  const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) return false;
  const result = await DialogV2.wait({
    window: { title: name },
    content: `<p>${esc(name)} can resist, or you can mark them willing.</p>`,
    buttons: [
      { action: "resist", label: "They resist", default: true, callback: () => "resist" },
      { action: "willing", label: "Willing", callback: () => "willing" },
      { action: "cancel", label: "Cancel", callback: () => "cancel" }
    ],
    rejectClose: false
  });
  if (!result || result === "cancel") return null;
  return result === "willing";
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

function nextDensity(current) {
  const order = ["", "solid", "diffuse"];
  const index = order.indexOf(current);
  return order[(index + 1) % order.length];
}

async function changeDensity(actor, item) {
  const target = combatTarget(actor.id || "");
  if (!target || !targetInReach(actor, item, target)) return null;
  const willing = await askWilling(target.name);
  if (willing == null) return null;
  if (!willing) {
    const held = await theyHold(target, rankOf(item), ["strength", "endurance"], `Resist ${item.name}`);
    if (held) {
      globalThis.ui?.notifications?.info(`${target.name} holds against ${item.name}.`);
      return true;
    }
  }
  const next = nextDensity(target.getFlag?.("faserip", "density") || "");
  const applied = await askJudge("density", { uuid: target.uuid, mode: next, rankId: rankOf(item) });
  if (applied == null) return null;
  const state = next === "solid" ? "solid" : next === "diffuse" ? "diffuse" : "normal";
  globalThis.ui?.notifications?.info(`${item.name} leaves ${target.name} ${state}.`);
  return true;
}

function pickImage(current) {
  const FilePickerImpl = globalThis.foundry?.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
  if (!FilePickerImpl) return Promise.resolve("");
  return new Promise((resolve) => {
    let done = false;
    const finish = (path) => {
      if (done) return;
      done = true;
      resolve(path || "");
    };
    try {
      const picker = new FilePickerImpl({
        type: "image",
        current: current || "",
        callback: (path) => finish(path)
      });
      picker.browse().catch(() => finish(""));
    } catch (err) {
      console.warn("FASERIP | matter image", err);
      finish("");
    }
  });
}

async function changeForm(actor, item, kind = "") {
  const target = combatTarget(actor.id || "");
  if (!target || !targetInReach(actor, item, target)) return null;
  const doc = tokenFor(target)?.document;
  if (!doc) {
    globalThis.ui?.notifications?.warn(`${target.name} needs a token on the map.`);
    return null;
  }
  const saved = doc.getFlag?.("faserip", "forcedFace");
  if (saved?.src) {
    const update = { "texture.src": saved.src, "flags.faserip.-=forcedFace": null };
    if (saved.alpha != null) update.alpha = saved.alpha;
    const ok = await askJudge("token", { uuid: doc.uuid, update });
    if (!ok) return null;
    if (saved.form === "gas") await askJudge("density", { uuid: target.uuid, mode: "", rankId: "" });
    if (saved.form === "liquid") await askJudge("flag", { uuid: target.uuid, key: "tempo", unset: true });
    globalThis.ui?.notifications?.info(`${item.name} restores ${target.name}.`);
    return true;
  }
  const willing = await askWilling(target.name);
  if (willing == null) return null;
  if (!willing) {
    const held = await theyHold(target, rankOf(item), ["endurance", "psyche"], `Resist ${item.name}`);
    if (held) {
      globalThis.ui?.notifications?.info(`${target.name} holds against ${item.name}.`);
      return true;
    }
  }
  if (kind === "body") {
    const shape = await chooseMode(item.name, [
      { action: "likeness", label: "Likeness" },
      { action: "gas", label: "Gas" },
      { action: "liquid", label: "Liquid" },
      { action: "cancel", label: "Cancel" }
    ]);
    if (!shape) return null;
    if (shape === "gas" || shape === "liquid") {
      const original = doc.texture?.src || "";
      if (shape === "gas") await askJudge("density", { uuid: target.uuid, mode: "diffuse", rankId: rankOf(item) });
      else await askJudge("flag", { uuid: target.uuid, key: "tempo", value: "slow" });
      const ok = await askJudge("token", {
        uuid: doc.uuid,
        update: {
          alpha: shape === "gas" ? 0.55 : 0.8,
          "flags.faserip.forcedFace": { src: original, form: shape, alpha: doc.alpha ?? 1 }
        }
      });
      if (!ok) return null;
      globalThis.ui?.notifications?.info(shape === "gas"
        ? `${target.name} becomes a gas and can pass through walls.`
        : `${target.name} becomes a liquid and moves slowly.`);
      return true;
    }
  }
  const next = await pickImage(doc.texture?.src || "");
  if (!next) return null;
  const original = doc.texture?.src || "";
  const ok = await askJudge("token", {
    uuid: doc.uuid,
    update: { "texture.src": next, "flags.faserip.forcedFace": { src: original } }
  });
  if (!ok) return null;
  globalThis.ui?.notifications?.info(`${item.name} changes ${target.name}.`);
  return true;
}

async function chooseMode(title, buttons) {
  const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) return buttons[0]?.action || "";
  const result = await DialogV2.wait({
    window: { title },
    content: "<p>Choose what this power does.</p>",
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

export async function useMatterPower(actor, item) {
  const kind = matterKind(item?.name);
  if (!actor || !kind) return null;
  if (!sceneOf() && kind !== "density") {
    globalThis.ui?.notifications?.warn("Open a scene first.");
    return null;
  }
  if (kind === "earth") {
    const mode = await chooseMode(item.name, [
      { action: "wall", label: "Wall" },
      { action: "pit", label: "Pit" },
      { action: "hurl", label: "Hurl" },
      { action: "cancel", label: "Cancel" }
    ]);
    if (!mode) return null;
    if (mode === "pit") {
      return pool(actor, item, {
        text: "Pit",
        fill: "#78350f",
        stroke: "#451a03",
        textColor: "#fef3c7",
        walk: 3,
        button: "Fill",
        line: `${who(actor)} opens a pit with ${item.name}. Crossing it is slow.`
      });
    }
    if (mode === "hurl") return gust(actor, item);
    return raiseEarth(actor, item);
  }
  if (kind === "air") {
    const mode = await chooseMode(item.name, [
      { action: "gust", label: "Gust" },
      { action: "buffer", label: "Buffer" },
      { action: "cancel", label: "Cancel" }
    ]);
    if (!mode) return null;
    if (mode === "buffer") return raiseEarth(actor, item, { seeThrough: true });
    return gust(actor, item);
  }
  if (kind === "fire") return ignite(actor, item);
  if (kind === "water") {
    const mode = await chooseMode(item.name, [
      { action: "pool", label: "Pool" },
      { action: "wave", label: "Wave" },
      { action: "cancel", label: "Cancel" }
    ]);
    if (!mode) return null;
    if (mode === "wave") return gust(actor, item);
    return pool(actor, item);
  }
  if (kind === "weather") return shiftWeather(actor, item);
  if (kind === "density") return changeDensity(actor, item);
  if (kind === "body" || kind === "animal") return changeForm(actor, item, kind);
  return null;
}

export function bindMatterChat(message, html) {
  const root = html instanceof HTMLElement ? html : html?.[0];
  const card = root?.querySelector?.(".faserip-matter");
  if (!card || card.dataset.matterBound) return;
  const matter = message.getFlag?.("faserip", "matter") ?? message.flags?.faserip?.matter;
  if (!matter?.parts?.length) return;
  card.dataset.matterBound = "1";
  card.querySelector("[data-faserip-matter='clear']")?.addEventListener("click", (event) => {
    event.preventDefault();
    clearMatter(message, matter).catch((err) => console.warn("FASERIP | matter", err));
  });
}

async function clearMatter(message, matter) {
  const ok = await askJudge("remove", { sceneId: matter.sceneId, parts: matter.parts });
  if (!ok) return;
  try {
    await message.update?.({ content: `<div class="faserip-matter"><p>Cleared.</p></div>` });
  } catch {
    /* the map objects are already gone */
  }
  globalThis.ui?.notifications?.info("Cleared.");
}

export function registerMatter() {
  const game = globalThis.game;
  const Hooks = globalThis.Hooks;
  if (Hooks && !Hooks._faseripMatter) {
    Hooks._faseripMatter = true;
    Hooks.on("renderChatMessageHTML", bindMatterChat);
  }
  if (!game?.socket || game.faserip?._matterSocket) return;
  game.faserip = game.faserip || {};
  game.faserip._matterSocket = true;
  game.socket.on("system.faserip", async (data) => {
    if (data?.system !== "matter") return;
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
      system: "matter",
      action: "reply",
      requestId: data.requestId,
      result
    });
  });
}

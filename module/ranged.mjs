import { MATERIAL_EXAMPLES, RANKS, THROW_RANGE, rankIndex, rankLabel } from "./config.mjs";
import { abilityForColumn, combatTarget } from "./play-rules.mjs";
import { fieldSquares, pullSquares } from "./energy.mjs";
import { setBattleState } from "./battle-results.mjs";
import { gridFeet, gridSeparation, pickMapPoint } from "./movement.mjs";

/**
 * Ranged powers. A blast uses the battle table at this rank.
 * Ice, fire, sound, and darkforce also make sheets, auras, and holds.
 * Distances for sheets follow the energy-field play sizes, not a book chart.
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

export function rangedKind(name) {
  const key = powerKey(name);
  if (key === "projectile missile") return "shot";
  if (key === "ensnaring missile") return "snare";
  if (key === "ice generation" || key === "cold generation") return "ice";
  if (key === "fire generation" || key === "heat") return "fire";
  if (key === "energy generation" || key === "plasma generation" || key === "hard radiation") return "energy";
  if (key === "sound generation" || key === "sonic generation" || key === "vibration" || key === "radiowave generation") return "sound";
  if (key === "stunning missile") return "stun";
  if (key === "corrosive missile") return "acid";
  if (key === "slashing missile") return "slash";
  if (key === "nullifier missile") return "null";
  if (key === "darkforce generation" || key === "shadowcasting") return "dark";
  if (key === "electrical generation") return "electric";
  if (key === "kinetic bolt") return "kinetic";
  if (key === "light emission") return "light";
  if (key === "magnetism") return "magnet";
  if (key === "energy doppelganger") return "copy";
  return "";
}

export function rangedUseTitle(name) {
  const kind = rangedKind(name);
  const titles = {
    shot: "Shoot a missile, or hurl one. Damage and range use this rank.",
    snare: "Fire a snare. A hit holds the target. Strength or Agility against this rank breaks it, or Use again releases them.",
    ice: "A blast, a slick sheet, or bonds that hold someone. They resist bonds with Strength or Agility.",
    fire: "A blast, or an aura of flame around you. Heat can also melt a material.",
    energy: "Fire an energy blast. Hard radiation and plasma can also lay a field. Lasting sickness is a Judge call.",
    sound: "A damaging blast, or a stun. Vibration can also crack a material.",
    stun: "Fire a bolt on the Force column, aimed at a stun rather than a killing blow.",
    acid: "A dissolving blast, or a shot that eats a material if this rank is higher.",
    slash: "Fire a cutting missile. The battle table uses edged results.",
    null: "Hit a target and suppress one power. They resist with Psyche. Use again can release it.",
    dark: "A darkforce blast, or a field of shadow.",
    electric: "An electrical blast, or a current that stuns on a failed Endurance resist.",
    kinetic: "A bolt of force, or the same bolt on the Energy column.",
    light: "Burning light, or a flash that blinds. They resist a flash with Intuition or Endurance.",
    magnet: "A magnetic blast, or a pull that drags the target toward you.",
    copy: "Place a short-lived energy copy. Its Strength is this rank. Dismiss ends it."
  };
  return titles[kind] || "";
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

function gridSize() {
  return Number(globalThis.canvas?.grid?.size) || 100;
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
  const scene = globalThis.game?.scenes?.get?.(data.sceneId) || globalThis.canvas?.scene;
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
        if (ids.length) await scene.deleteEmbeddedDocuments(part.docType, ids);
      }
      return true;
    }
    const actor = await fromUuid(data.uuid);
    if (!actor) return null;
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
      await actor.toggleStatusEffect(data.statusId, { active: !!data.active, overlay: !!data.overlay });
      return true;
    }
    if (data.action === "token") {
      const doc = await fromUuid(data.uuid);
      if (!doc) return false;
      await doc.update(data.update || {});
      return true;
    }
  } catch (err) {
    console.warn("FASERIP | ranged", err);
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
    globalThis.game.socket.emit("system.faserip", { system: "ranged", action, requestId: id, ...payload });
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
  return { held: !!(message.getFlag?.("faserip", "intensityPass") ?? message.flags?.faserip?.intensityPass) };
}

function inRange(actor, target, item) {
  const from = tokenFor(actor, { controlled: true });
  const to = tokenFor(target);
  if (!from || !to) return false;
  return gridSeparation(from, to) <= maxSquares(item) + 0.25;
}

function needTarget(actor, item) {
  const target = combatTarget(actor?.id || "");
  if (!target) {
    globalThis.ui?.notifications?.warn("Target a token.");
    return null;
  }
  if (!inRange(actor, target, item)) {
    globalThis.ui?.notifications?.warn(`${target.name} is out of range.`);
    return null;
  }
  return target;
}

async function fire(actor, item, column) {
  const { rollAction } = await import("./item-actions.mjs");
  const ability = abilityForColumn(column, "agility");
  return rollAction(actor, {
    kind: "attack",
    column,
    ability,
    rankFrom: "item",
    label: "Attack"
  }, { item, label: item.name });
}

async function holdTarget(target, item) {
  await owned(target, "flag", { uuid: target.uuid, key: "stuck", value: { by: item.uuid, rank: rankOf(item) } });
  await owned(target, "flag", { uuid: target.uuid, key: "tempo", value: "stop" });
}

async function releaseTarget(target) {
  await owned(target, "flag", { uuid: target.uuid, key: "stuck", unset: true });
  await owned(target, "flag", { uuid: target.uuid, key: "tempo", unset: true });
}

async function snare(actor, item) {
  const target = combatTarget(actor?.id || "");
  if (target?.getFlag?.("faserip", "stuck")) {
    const mode = await choose(item.name, `${esc(target.name)} is already held.`, [
      { action: "release", label: "Release" },
      { action: "again", label: "Fire again" },
      { action: "cancel", label: "Cancel" }
    ]);
    if (mode === "release") {
      await releaseTarget(target);
      globalThis.ui?.notifications?.info(`${target.name} is free.`);
      return true;
    }
    if (mode !== "again") return null;
  }
  const message = await fire(actor, item, "shooting");
  const color = message?.flags?.faserip?.color || "";
  const hit = target && color && color !== "white";
  if (hit) {
    await holdTarget(target, item);
    globalThis.ui?.notifications?.info(`${item.name} holds ${target.name}.`);
  }
  return message ? true : null;
}

async function bonds(actor, item) {
  const target = needTarget(actor, item);
  if (!target) return null;
  if (target.getFlag?.("faserip", "stuck")) {
    await releaseTarget(target);
    globalThis.ui?.notifications?.info(`${item.name} releases ${target.name}.`);
    return true;
  }
  const result = await resist(target, rankOf(item), ["strength", "agility"], `Resist ${item.name}`);
  if (!result) return null;
  if (result.held) {
    globalThis.ui?.notifications?.info(`${target.name} breaks the bonds.`);
    return true;
  }
  await holdTarget(target, item);
  globalThis.ui?.notifications?.info(`${item.name} binds ${target.name}.`);
  return true;
}

function maxSquares(item) {
  const areas = THROW_RANGE[rankOf(item)] ?? 2;
  const feet = Number(globalThis.game?.settings?.get?.("faserip", "feetPerArea")) || 20;
  return Math.max(1, Math.round(areas * (feet / gridFeet())));
}

function pointInRange(actor, item, point) {
  const token = tokenFor(actor, { controlled: true });
  if (!token) {
    globalThis.ui?.notifications?.warn(`${who(actor)} needs a token on the map.`);
    return false;
  }
  const center = token.center || { x: token.x, y: token.y };
  const squares = Math.hypot(point.x - center.x, point.y - center.y) / gridSize();
  if (squares > maxSquares(item) + 0.5) {
    globalThis.ui?.notifications?.warn(`${item.name} does not reach that far.`);
    return false;
  }
  return true;
}

async function sheet(actor, item, spec) {
  const point = await pickMapPoint(`${item.name}: click the center. Right-click cancels.`);
  if (!point || !pointInRange(actor, item, point)) return null;
  const radius = (fieldSquares(rankOf(item)) * gridSize()) / 2;
  const sceneId = globalThis.canvas?.scene?.id;
  const drawingIds = await askJudge("embed", {
    sceneId,
    docType: "Drawing",
    data: [{
      x: point.x - radius,
      y: point.y - radius,
      shape: { type: "e", width: radius * 2, height: radius * 2 },
      strokeWidth: 4,
      strokeColor: spec.stroke,
      fillType: 1,
      fillColor: spec.fill,
      fillAlpha: 0.45,
      text: spec.text,
      fontSize: Math.max(16, Math.round(radius * 0.3)),
      textColor: spec.textColor,
      interface: false,
      hidden: false,
      flags: { faserip: { ranged: spec.text } }
    }]
  });
  const parts = [];
  if (drawingIds?.length) parts.push({ docType: "Drawing", ids: drawingIds });
  if (spec.walk) {
    const regionIds = await askJudge("embed", {
      sceneId,
      docType: "Region",
      data: [{
        name: spec.text,
        color: spec.fill,
        shapes: [{ type: "ellipse", x: point.x, y: point.y, radiusX: radius, radiusY: radius }],
        behaviors: [{
          name: spec.text,
          type: "modifyMovementCost",
          system: { difficulties: { walk: spec.walk } }
        }],
        flags: { faserip: { ranged: spec.text } }
      }]
    });
    if (regionIds?.length) parts.push({ docType: "Region", ids: regionIds });
  }
  if (spec.dark) {
    const regionIds = await askJudge("embed", {
      sceneId,
      docType: "Region",
      data: [{
        name: spec.text,
        color: spec.fill,
        shapes: [{ type: "ellipse", x: point.x, y: point.y, radiusX: radius, radiusY: radius }],
        behaviors: [{
          name: "Dark",
          type: "adjustDarknessLevel",
          system: { mode: 0, modifier: 0.9 }
        }],
        flags: { faserip: { ranged: spec.text } }
      }]
    });
    if (regionIds?.length) parts.push({ docType: "Region", ids: regionIds });
  }
  const effectName = await patchArt(point, spec.art || [], radius);
  if (!parts.length && !effectName) {
    globalThis.ui?.notifications?.warn("That patch could not be placed.");
    return null;
  }
  await postCard(actor, spec.line, parts, effectName ? [effectName] : []);
  globalThis.ui?.notifications?.info(spec.line);
  return true;
}

async function patchArt(point, files, radius) {
  const db = globalThis.Sequencer?.Database;
  const Sequence = globalThis.Sequence;
  if (typeof Sequence !== "function" || typeof db?.entryExists !== "function") return "";
  const file = files.find((entry) => {
    try { return db.entryExists(entry); } catch { return false; }
  });
  if (!file) return "";
  const name = `faserip-ranged-${requestId()}`;
  try {
    const seq = new Sequence();
    seq.effect().file(file).atLocation(point).scale(Math.max(0.4, radius / gridSize())).persist(true).name(name);
    await seq.play();
    return name;
  } catch (err) {
    console.warn("FASERIP | ranged art", err);
    return "";
  }
}

async function postCard(actor, line, parts, effectNames) {
  const ChatMessage = globalThis.ChatMessage;
  if (!ChatMessage?.create) return;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker?.({ actor }) || { alias: who(actor) },
    content: `<div class="faserip-ranged"><p>${esc(line)}</p><div class="feat-actions"><button type="button" data-faserip-ranged="clear">Dismiss</button></div></div>`,
    flags: { faserip: { ranged: { sceneId: globalThis.canvas?.scene?.id || "", parts, effectNames } } }
  });
}

async function aura(actor, item) {
  const on = !!actor.getFlag?.("faserip", "fireAura");
  const tokens = actor.getActiveTokens?.() ?? [];
  if (on) {
    const { endSequencerNames } = await import("./vfx.mjs");
    await endSequencerNames([`faserip-aura-${actor.id}`], { prefix: true });
    for (const token of tokens) {
      const doc = token.document || token;
      const saved = doc.getFlag?.("faserip", "fireLight");
      try {
        if (saved) await doc.update({ light: saved });
        await doc.unsetFlag("faserip", "fireLight");
      } catch (err) {
        console.warn("FASERIP | fire aura", err);
      }
    }
    await actor.unsetFlag?.("faserip", "fireAura");
    globalThis.ui?.notifications?.info(`${item.name} aura is out.`);
    return true;
  }
  const Sequence = globalThis.Sequence;
  const db = globalThis.Sequencer?.Database;
  const file = ["jb2a.wall_of_fire.horizontal.orange", "jb2a.fire_jet", "jb2a.shield"].find((entry) => {
    try { return db?.entryExists?.(entry); } catch { return false; }
  });
  if (file && typeof Sequence === "function") {
    try {
      const seq = new Sequence();
      tokens.forEach((token, index) => {
        seq.effect().file(file).attachTo(token).scaleToObject(1.4).persist(true).name(`faserip-aura-${actor.id}-${index}`);
      });
      await seq.play();
    } catch (err) {
      console.warn("FASERIP | fire aura", err);
    }
  }
  for (const token of tokens) {
    const doc = token.document || token;
    try {
      const light = typeof doc.light?.toObject === "function" ? doc.light.toObject() : { ...(doc.light || {}) };
      await doc.setFlag("faserip", "fireLight", light);
      await doc.update({ light: { bright: 15, dim: 30, color: "#f97316", animation: { type: "torch", speed: 2, intensity: 4 } } });
    } catch (err) {
      console.warn("FASERIP | fire aura", err);
    }
  }
  await actor.setFlag?.("faserip", "fireAura", true);
  globalThis.ui?.notifications?.info(`${item.name} wraps ${who(actor)} in flame.`);
  return true;
}

async function material(actor, item, note) {
  const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
  const ranks = RANKS.filter((rank) => MATERIAL_EXAMPLES[rank.id]);
  if (!DialogV2?.wait) return null;
  const options = ranks.map((rank) => `<option value="${rank.id}">${esc(rank.label)} — ${esc(MATERIAL_EXAMPLES[rank.id])}</option>`).join("");
  const form = await DialogV2.wait({
    window: { title: item.name },
    content: `<label>Material <select name="rank">${options}</select></label>`,
    buttons: [
      { action: "ok", label: "Compare", default: true, callback: (_event, button) => button.form },
      { action: "cancel", label: "Cancel" }
    ],
    rejectClose: false
  });
  if (!form || form === "cancel") return null;
  const id = form.elements?.rank?.value || form.querySelector?.('[name="rank"]')?.value || "";
  if (!id) return null;
  const power = rankIndex(rankOf(item));
  const wall = rankIndex(id);
  let line = `${item.name} marks the ${rankLabel(id)} material.`;
  if (power > wall) line = `${item.name} ruins the ${rankLabel(id)} material. ${note}`;
  else if (power === wall) line = `${item.name} damages the ${rankLabel(id)} material.`;
  globalThis.ui?.notifications?.info(line);
  return true;
}

async function jolt(actor, item) {
  const target = needTarget(actor, item);
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
    data: { state: "stunned", rounds: 1, untilRound: now + 1, note: item.name }
  });
  if (!ok) return null;
  globalThis.ui?.notifications?.info(`${item.name} stuns ${target.name} for 1 round.`);
  return true;
}

async function blind(actor, item) {
  const target = needTarget(actor, item);
  if (!target) return null;
  const { protectedSensesHold } = await import("./senses.mjs");
  if (protectedSensesHold(target, rankOf(item))) {
    globalThis.ui?.notifications?.info(`${target.name}'s protected senses hold.`);
    return true;
  }
  const result = await resist(target, rankOf(item), ["intuition", "endurance"], `Resist ${item.name}`);
  if (!result) return null;
  if (result.held) {
    globalThis.ui?.notifications?.info(`${target.name} looks away.`);
    return true;
  }
  const id = globalThis.CONFIG?.specialStatusEffects?.BLIND || "blind";
  const ok = await owned(target, "status", { uuid: target.uuid, statusId: id, active: true, overlay: true });
  if (!ok) return null;
  globalThis.ui?.notifications?.info(`${item.name} blinds ${target.name}.`);
  return true;
}

async function nullShot(actor, item) {
  const target = needTarget(actor, item);
  if (!target) return null;
  const powers = [...(target.items ?? [])].filter((entry) => entry.type === "power");
  if (!powers.length) {
    globalThis.ui?.notifications?.warn(`${target.name} has no powers to suppress.`);
    return null;
  }
  const held = powers.filter((entry) => entry.getFlag?.("faserip", "nullified") || entry.flags?.faserip?.nullified);
  const open = powers.filter((entry) => !held.includes(entry));
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
  const picked = open.length === 1 ? open[0] : await choosePower(open, item.name);
  if (!picked) return null;
  const result = await resist(target, rankOf(item), ["psyche"], `Resist ${item.name}`);
  if (!result) return null;
  if (result.held) {
    globalThis.ui?.notifications?.info(`${target.name} holds onto ${picked.name}.`);
    return true;
  }
  const ok = await owned(picked, "flag", { uuid: picked.uuid, key: "nullified", value: { by: actor.uuid, rank: rankOf(item) } });
  if (!ok) return null;
  globalThis.ui?.notifications?.info(`${item.name} suppresses ${picked.name}.`);
  return true;
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
      { action: "take", label: "Suppress", default: true, callback: (_event, button) => button.form },
      { action: "cancel", label: "Cancel" }
    ],
    rejectClose: false
  });
  if (!form || form === "cancel") return null;
  const id = form.elements?.power?.value || "";
  return powers.find((power) => power.id === id) || null;
}

async function pull(actor, item) {
  const target = needTarget(actor, item);
  if (!target) return null;
  const squares = pullSquares(rankOf(item));
  const doc = tokenFor(target)?.document;
  const from = tokenFor(actor, { controlled: true });
  if (!doc || !from) return null;
  const grid = gridSize();
  const origin = {
    x: from.x + ((from.document?.width || from.width || 1) * grid) / 2,
    y: from.y + ((from.document?.height || from.height || 1) * grid) / 2
  };
  const here = {
    x: doc.x + ((doc.width || 1) * grid) / 2,
    y: doc.y + ((doc.height || 1) * grid) / 2
  };
  const dx = origin.x - here.x;
  const dy = origin.y - here.y;
  const dist = Math.hypot(dx, dy);
  const travel = Math.min(squares * grid, Math.max(0, dist - grid));
  if (!(travel > grid * 0.2)) {
    globalThis.ui?.notifications?.info(`${target.name} is already next to ${who(actor)}.`);
    return true;
  }
  const scale = travel / dist;
  const ok = await owned(doc, "token", {
    uuid: doc.uuid,
    update: {
      x: Math.round(here.x + dx * scale - (doc.width * grid) / 2),
      y: Math.round(here.y + dy * scale - (doc.height * grid) / 2)
    }
  });
  if (!ok) return null;
  globalThis.ui?.notifications?.info(`${item.name} pulls ${target.name} closer.`);
  return true;
}

async function placeCopy(actor, item) {
  const point = await pickMapPoint(`${item.name}: click where the copy stands. Right-click cancels.`);
  if (!point || !pointInRange(actor, item, point)) return null;
  const token = tokenFor(actor, { controlled: true });
  const src = token?.document?.texture?.src || "";
  const radius = gridSize() * ((token?.document?.width || 1) / 2);
  const effectName = src ? await patchArt(point, [src], radius) : "";
  const sceneId = globalThis.canvas?.scene?.id;
  const drawingIds = effectName ? [] : await askJudge("embed", {
    sceneId,
    docType: "Drawing",
    data: [{
      x: point.x - radius,
      y: point.y - radius,
      shape: { type: "e", width: radius * 2, height: radius * 2 },
      strokeWidth: 4,
      strokeColor: "#38bdf8",
      fillType: 1,
      fillColor: "#7dd3fc",
      fillAlpha: 0.45,
      text: "Copy",
      fontSize: 18,
      textColor: "#0c4a6e",
      interface: false,
      hidden: false,
      flags: { faserip: { ranged: "copy" } }
    }]
  });
  const parts = drawingIds?.length ? [{ docType: "Drawing", ids: drawingIds }] : [];
  const line = `${who(actor)} leaves an energy copy. Its Strength is ${rankLabel(rankOf(item))}.`;
  await postCard(actor, line, parts, effectName ? [effectName] : []);
  globalThis.ui?.notifications?.info(line);
  return true;
}

async function signal(actor, item) {
  const ChatMessage = globalThis.ChatMessage;
  const recipients = ChatMessage?.getWhisperRecipients?.("GM")?.map((user) => user.id) || [];
  await ChatMessage?.create?.({
    speaker: ChatMessage.getSpeaker?.({ actor }) || { alias: who(actor) },
    whisper: recipients,
    content: `<p>${esc(who(actor))} sends a signal with ${esc(item.name)}. The Judge decides who hears it.</p>`
  });
  globalThis.ui?.notifications?.info(`${item.name} sends a signal.`);
  return true;
}

export async function useRangedPower(actor, item) {
  const kind = rangedKind(item?.name);
  if (!actor || !kind) return null;
  if (kind === "shot") {
    const mode = await choose(item.name, "Shoot it, or hurl it.", [
      { action: "shoot", label: "Shoot" },
      { action: "hurl", label: "Hurl" },
      { action: "cancel", label: "Cancel" }
    ]);
    if (!mode) return null;
    return fire(actor, item, mode === "hurl" ? "throwBlunt" : "shooting");
  }
  if (kind === "snare") return snare(actor, item);
  if (kind === "ice") {
    const mode = await choose(item.name, "A blast, a slick sheet, or bonds.", [
      { action: "blast", label: "Blast" },
      { action: "sheet", label: "Sheet" },
      { action: "bonds", label: "Bonds" },
      { action: "cancel", label: "Cancel" }
    ]);
    if (mode === "sheet") {
      return sheet(actor, item, {
        text: "Ice",
        fill: "#bae6fd",
        stroke: "#0284c7",
        textColor: "#0c4a6e",
        walk: 2,
        art: ["jb2a.wall_of_force.horizontal.blue", "jb2a.ice_spikes.radial.white"],
        line: `${who(actor)} lays a sheet of ice. Walking on it is slow.`
      });
    }
    if (mode === "bonds") return bonds(actor, item);
    if (mode === "blast") return fire(actor, item, "energy");
    return null;
  }
  if (kind === "fire") {
    const buttons = [
      { action: "blast", label: "Blast" },
      { action: "aura", label: "Aura" }
    ];
    if (powerKey(item.name) === "heat") buttons.push({ action: "melt", label: "Melt" });
    buttons.push({ action: "cancel", label: "Cancel" });
    const mode = await choose(item.name, "A blast, or flames around you.", buttons);
    if (mode === "aura") return aura(actor, item);
    if (mode === "melt") return material(actor, item, "The surface gives way.");
    if (mode === "blast") return fire(actor, item, "energy");
    return null;
  }
  if (kind === "energy") {
    const key = powerKey(item.name);
    if (key === "energy generation") return fire(actor, item, "energy");
    const mode = await choose(item.name, "A blast, or a field.", [
      { action: "blast", label: "Blast" },
      { action: "field", label: "Field" },
      { action: "cancel", label: "Cancel" }
    ]);
    if (mode === "field") {
      const plasma = key === "plasma generation";
      return sheet(actor, item, {
        text: plasma ? "Plasma" : "Radiation",
        fill: plasma ? "#fdba74" : "#86efac",
        stroke: plasma ? "#c2410c" : "#166534",
        textColor: plasma ? "#431407" : "#052e16",
        art: plasma
          ? ["jb2a.energy_field.circle.orange", "jb2a.wall_of_fire.horizontal.orange"]
          : ["jb2a.energy_field.circle.green", "jb2a.energy_beam"],
        line: plasma
          ? `${who(actor)} lays a plasma field.`
          : `${who(actor)} lays a hard radiation field. Lasting sickness is a Judge call.`
      });
    }
    if (mode === "blast") return fire(actor, item, "energy");
    return null;
  }
  if (kind === "sound") {
    const buttons = [
      { action: "blast", label: "Blast" },
      { action: "stun", label: "Stun" }
    ];
    if (powerKey(item.name) === "vibration") buttons.push({ action: "crack", label: "Crack" });
    if (powerKey(item.name) === "radiowave generation") buttons.push({ action: "signal", label: "Signal" });
    buttons.push({ action: "cancel", label: "Cancel" });
    const mode = await choose(item.name, "Damage them, or stun them.", buttons);
    if (mode === "stun") return jolt(actor, item);
    if (mode === "crack") return material(actor, item, "The structure fails.");
    if (mode === "signal") return signal(actor, item);
    if (mode === "blast") return fire(actor, item, "energy");
    return null;
  }
  if (kind === "stun") return fire(actor, item, "force");
  if (kind === "acid") {
    const mode = await choose(item.name, "Burn a target, or eat a material.", [
      { action: "blast", label: "Blast" },
      { action: "material", label: "Material" },
      { action: "cancel", label: "Cancel" }
    ]);
    if (mode === "material") return material(actor, item, "Gear and cover give way.");
    if (mode === "blast") return fire(actor, item, "energy");
    return null;
  }
  if (kind === "slash") return fire(actor, item, "throwEdged");
  if (kind === "null") return nullShot(actor, item);
  if (kind === "dark") {
    const mode = await choose(item.name, "A blast, or a field of shadow.", [
      { action: "blast", label: "Blast" },
      { action: "field", label: "Field" },
      { action: "cancel", label: "Cancel" }
    ]);
    if (mode === "field") {
      return sheet(actor, item, {
        text: "Shadow",
        fill: "#1e1b4b",
        stroke: "#312e81",
        textColor: "#e0e7ff",
        dark: true,
        art: ["jb2a.darkness", "jb2a.energy_field.circle.blue"],
        line: `${who(actor)} lays a field of shadow.`
      });
    }
    if (mode === "blast") return fire(actor, item, "energy");
    return null;
  }
  if (kind === "electric") {
    const mode = await choose(item.name, "A blast, or a stunning current.", [
      { action: "blast", label: "Blast" },
      { action: "current", label: "Current" },
      { action: "cancel", label: "Cancel" }
    ]);
    if (mode === "current") return jolt(actor, item);
    if (mode === "blast") return fire(actor, item, "energy");
    return null;
  }
  if (kind === "kinetic") {
    const mode = await choose(item.name, "Force column, or Energy column.", [
      { action: "force", label: "Force" },
      { action: "energy", label: "Energy" },
      { action: "cancel", label: "Cancel" }
    ]);
    if (!mode) return null;
    return fire(actor, item, mode === "energy" ? "energy" : "force");
  }
  if (kind === "light") {
    const mode = await choose(item.name, "Burn them, or blind them.", [
      { action: "burn", label: "Burn" },
      { action: "blind", label: "Blind" },
      { action: "cancel", label: "Cancel" }
    ]);
    if (mode === "blind") return blind(actor, item);
    if (mode === "burn") return fire(actor, item, "energy");
    return null;
  }
  if (kind === "copy") return placeCopy(actor, item);
  if (kind === "magnet") {
    const mode = await choose(item.name, "A blast, or a pull.", [
      { action: "blast", label: "Blast" },
      { action: "pull", label: "Pull" },
      { action: "cancel", label: "Cancel" }
    ]);
    if (mode === "pull") return pull(actor, item);
    if (mode === "blast") return fire(actor, item, "energy");
    return null;
  }
  return null;
}

function bindRangedChat(message, html) {
  const root = html instanceof HTMLElement ? html : html?.[0];
  const card = root?.querySelector?.(".faserip-ranged");
  if (!card || card.dataset.rangedBound) return;
  const data = message.getFlag?.("faserip", "ranged") ?? message.flags?.faserip?.ranged;
  if (!data?.parts?.length && !data?.effectNames?.length) return;
  card.dataset.rangedBound = "1";
  card.querySelector("[data-faserip-ranged='clear']")?.addEventListener("click", (event) => {
    event.preventDefault();
    clearRanged(message, data).catch((err) => console.warn("FASERIP | ranged", err));
  });
}

async function clearRanged(message, data) {
  const { endSequencerNames } = await import("./vfx.mjs");
  await endSequencerNames(data.effectNames || []);
  if (data.parts?.length) await askJudge("remove", { sceneId: data.sceneId, parts: data.parts });
  try {
    await message.update?.({ content: `<div class="faserip-ranged"><p>Dismissed.</p></div>` });
  } catch { /* the patch is already gone */ }
}

export function registerRanged() {
  const game = globalThis.game;
  const Hooks = globalThis.Hooks;
  if (Hooks && !Hooks._faseripRanged) {
    Hooks._faseripRanged = true;
    Hooks.on("renderChatMessageHTML", bindRangedChat);
  }
  if (!game?.socket || game.faserip?._rangedSocket) return;
  game.faserip = game.faserip || {};
  game.faserip._rangedSocket = true;
  game.socket.on("system.faserip", async (data) => {
    if (data?.system !== "ranged") return;
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
      system: "ranged",
      action: "reply",
      requestId: data.requestId,
      result
    });
  });
}

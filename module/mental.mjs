import { ABILITIES, THROW_RANGE, rankIndex, rankLabel, rankValue } from "./config.mjs";
import { combatTarget } from "./play-rules.mjs";
import { feetPerArea, formatMovement, gridFeet, gridSeparation, pickMapPoint } from "./movement.mjs";

/**
 * Mental powers. Psionic Attack stays a Force blast. Plant Control stays a grapple.
 * The rest act from Use: messages, movement, shields, and one-roll rank swaps.
 */

const GLIMPSE = {
  red: "a sharp glimpse",
  yellow: "a clear but incomplete image",
  green: "a vague impression",
  white: "nothing useful"
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

export function mentalKind(name) {
  const key = powerKey(name);
  if (key === "telepathy") return "telepathy";
  if (key === "image generation") return "image";
  if (key === "telekinesis") return "tk";
  if (key === "mind control") return "mind";
  if (key === "emotion control") return "emotion";
  if (key === "force field generation" || key === "force field") return "field";
  if (key === "animal communication and control") return "animal";
  if (key === "mechanical intuition") return "machine";
  if (key === "animal empathy") return "animal-empathy";
  if (key === "empathy") return "empathy";
  if (key === "psi-screen") return "screen";
  if (key === "mental probe") return "probe";
  if (key === "animate drawings") return "animate";
  if (key === "possession") return "possession";
  if (key === "transferral") return "transfer";
  if (key === "astral projection") return "astral";
  if (key === "precognition") return "precog";
  if (key === "postcognition") return "postcog";
  if (key === "ultimate skill") return "ultimate";
  return "";
}

export function mentalUseTitle(name) {
  const kind = mentalKind(name);
  if (kind === "telepathy") return "Send a thought, or listen for one. An unwilling mind resists with Psyche.";
  if (kind === "image") return "Pick a picture and click where the image appears. Dismiss on the chat card removes it.";
  if (kind === "tk") return "Move a token to a clicked spot, or hurl it away. The spot has to be in range.";
  if (kind === "mind") return "Give a target a command. They resist with Psyche unless marked willing. Use again can release them.";
  if (kind === "emotion") return "Lay fear, rage, or calm on a target. Fear is −1 column on attacks. Rage is +1. They resist with Psyche.";
  if (kind === "field") return "Raise a personal shield that soaks at this rank, or click two points for a barrier. Use again lowers the shield.";
  if (kind === "animal") return "Speak with an animal, or steer it. It resists steering with Intuition unless marked willing. Use again releases it.";
  if (kind === "machine") return "The next Reason FEAT uses this Power rank instead.";
  if (kind === "empathy" || kind === "animal-empathy") return "Read a target's feeling and how hurt they are. A yellow or red FEAT asks the Judge to say why. The note is whispered.";
  if (kind === "screen") return "Use raises a mental shield. A psionic blast at or under this rank does not get through. Use again lowers it.";
  if (kind === "probe") return "Ask a question of a target's mind. They resist with Psyche unless marked willing.";
  if (kind === "animate") return "Pick a picture and click where it comes to life. Its Strength is this rank. Dismiss removes it.";
  if (kind === "possession") return "Occupy a target after a Psyche resist. Use again returns you to your body.";
  if (kind === "transfer") return "Move one power onto you, or swap places and looks as a mind exchange. They resist with Psyche. Use again undoes it.";
  if (kind === "astral") return "Use steps out of the body. The token can pass through walls until Use returns you.";
  if (kind === "precog") return "Ask about a possible future, then roll. The color is how clear the glimpse is.";
  if (kind === "postcog") return "Ask about a past event, then roll. The color is how clear the trace is.";
  if (kind === "ultimate") return "Pick an ability. The next roll of that ability uses this Power rank.";
  return "";
}

export function psiScreenBlocks(target, item, rankId) {
  const screen = target?.getFlag?.("faserip", "psiScreen");
  if (!screen) return false;
  if (!/psionic attack|mind blast|mind drain/i.test(item?.name || "")) return false;
  return rankIndex(screen) >= rankIndex(rankId);
}

export function mentalRankOverride(actor, spec) {
  if (!actor || !spec || spec.rankFrom === "item") return "";
  const ultimate = actor.getFlag?.("faserip", "ultimate");
  if (ultimate?.ability && ultimate.ability === spec.ability && ultimate.rank) return ultimate.rank;
  if (spec.ability === "reason" && actor.getFlag?.("faserip", "machineRank")) return actor.getFlag("faserip", "machineRank");
  if (spec.ability === "intuition") {
    const once = actor.getFlag?.("faserip", "senseRank");
    if (once) return once;
    const combat = actor.getFlag?.("faserip", "combatSense");
    if (combat && rankIndex(combat) > rankIndex(actor.getAbilityRank?.("intuition") || "typical")) return combat;
  }
  return "";
}

export async function consumeMentalPrep(actor, spec) {
  if (!actor?.unsetFlag || !spec || spec.rankFrom === "item") return;
  const ultimate = actor.getFlag?.("faserip", "ultimate");
  if (ultimate?.ability && ultimate.ability === spec.ability) {
    try { await actor.unsetFlag("faserip", "ultimate"); } catch { /* the roll already used the rank */ }
    return;
  }
  if (spec.ability === "reason" && actor.getFlag?.("faserip", "machineRank")) {
    try { await actor.unsetFlag("faserip", "machineRank"); } catch { /* the roll already used the rank */ }
  }
  if (spec.ability === "intuition" && actor.getFlag?.("faserip", "senseRank")) {
    try { await actor.unsetFlag("faserip", "senseRank"); } catch { /* the roll already used the rank */ }
  }
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
  return (controlled ? list.find((entry) => entry.controlled) : null) || list[0] || null;
}

function centerOf(token) {
  const doc = token?.document || token;
  const grid = gridSize();
  if (!doc) return null;
  return { x: doc.x + ((doc.width || 1) * grid) / 2, y: doc.y + ((doc.height || 1) * grid) / 2 };
}

function feetBetween(a, b) {
  return (Math.hypot(a.x - b.x, a.y - b.y) / gridSize()) * gridFeet();
}

function hasStatus(actor, id) {
  return [...(actor?.effects ?? [])].some((effect) => effect.statuses?.has?.(id) || effect.getFlag?.("core", "statusId") === id);
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
        if (ids.length) await scene.deleteEmbeddedDocuments(part.docType, ids);
      }
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
      if (!actor?.toggleStatusEffect) return false;
      if (hasStatus(actor, data.statusId) !== !!data.active) {
        await actor.toggleStatusEffect(data.statusId, { active: !!data.active, overlay: !!data.overlay });
      }
      return true;
    }
    if (data.action === "token") {
      const doc = await fromUuid(data.uuid);
      if (!doc) return false;
      await doc.update(data.update || {});
      return true;
    }
    if (data.action === "animate") {
      const Cls = globalThis.CONFIG?.Actor?.documentClass;
      if (!Cls?.create || !scene) return null;
      const created = await Cls.create(data.actor);
      if (!created) return null;
      let tokenId = "";
      try {
        const tokenData = typeof created.getTokenDocument === "function"
          ? (await created.getTokenDocument({ x: data.x, y: data.y, texture: { src: data.src } })).toObject()
          : { x: data.x, y: data.y, actorId: created.id, texture: { src: data.src } };
        const [token] = await scene.createEmbeddedDocuments("Token", [tokenData]);
        tokenId = token?.id || "";
      } catch (err) {
        console.warn("FASERIP | animate token", err);
      }
      return { actorId: created.id, tokenId };
    }
    if (data.action === "deleteActor") {
      const puppet = globalThis.game?.actors?.get?.(data.actorId);
      if (scene) {
        const ids = scene.tokens?.filter?.((token) => token.actorId === data.actorId).map((token) => token.id) || [];
        if (ids.length) await scene.deleteEmbeddedDocuments("Token", ids);
      }
      if (puppet) await puppet.delete();
      return true;
    }
    if (data.action === "give") {
      const actor = await fromUuid(data.uuid);
      if (!actor?.createEmbeddedDocuments) return "";
      const [created] = await actor.createEmbeddedDocuments("Item", [data.item]);
      return created?.id || "";
    }
    if (data.action === "deleteItem") {
      const item = await fromUuid(data.uuid);
      if (!item?.delete) return false;
      await item.delete();
      return true;
    }
  } catch (err) {
    console.warn("FASERIP | mental", err);
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
    globalThis.game.socket.emit("system.faserip", { system: "mental", action, requestId: id, ...payload });
  });
}

async function owned(doc, action, payload) {
  if (globalThis.game?.user?.isGM || doc?.isOwner) return perform({ action, ...payload });
  return askJudge(action, payload);
}

function needScene() {
  if (sceneOf()) return true;
  globalThis.ui?.notifications?.warn("Open a scene first.");
  return false;
}

function targetInReach(actor, item, target) {
  const from = tokenFor(actor, { controlled: true });
  const to = tokenFor(target);
  if (!from || !to) {
    globalThis.ui?.notifications?.warn("Target a token on the map.");
    return false;
  }
  const max = Math.max(1, Math.round(reachFeet(item) / gridFeet()));
  if (gridSeparation(from, to) > max + 0.25) {
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

function nearEnough(actor, item, point) {
  const here = centerOf(tokenFor(actor, { controlled: true }));
  if (!here) {
    globalThis.ui?.notifications?.warn(`${who(actor)} needs a token on the map.`);
    return false;
  }
  if (feetBetween(here, point) > reachFeet(item) + 0.5) {
    globalThis.ui?.notifications?.warn(`${item?.name || "That power"} reaches ${formatMovement(reachFeet(item) / feetPerArea())}.`);
    return false;
  }
  return true;
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

async function askText(title, label) {
  const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) return "";
  const form = await DialogV2.wait({
    window: { title },
    content: `<label>${esc(label)}<br><textarea name="text" rows="3"></textarea></label>`,
    buttons: [
      { action: "ok", label: "Send", default: true, callback: (_event, button) => button.form },
      { action: "cancel", label: "Cancel" }
    ],
    rejectClose: false
  });
  if (!form || form === "cancel") return "";
  return String(form.elements?.text?.value || form.querySelector?.('[name="text"]')?.value || "").trim();
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
  return !!(message.getFlag?.("faserip", "intensityPass") ?? message.flags?.faserip?.intensityPass);
}

async function setStatus(actor, statusId, active, overlay = false) {
  return owned(actor, "status", { uuid: actor.uuid, statusId, active, overlay });
}

async function whisper(actor, target, html) {
  const ids = new Set();
  if (globalThis.game?.user?.id) ids.add(globalThis.game.user.id);
  for (const user of globalThis.game?.users ?? []) {
    if (user.isGM) ids.add(user.id);
    try {
      if (target?.testUserPermission?.(user, "OWNER")) ids.add(user.id);
    } catch { /* public note still posts */ }
  }
  const ChatMessage = globalThis.ChatMessage;
  if (!ChatMessage?.create) {
    globalThis.ui?.notifications?.info(html.replace(/<[^>]+>/g, ""));
    return;
  }
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker?.({ actor }) || { alias: who(actor) },
    whisper: [...ids],
    content: html
  });
}

async function resisted(target, item, keys) {
  const willing = await askWilling(target.name);
  if (!willing) return null;
  if (willing === "willing") return false;
  const held = await theyHold(target, rankOf(item), keys, `Resist ${item.name}`);
  if (held) {
    globalThis.ui?.notifications?.info(`${target.name} holds against ${item.name}.`);
    return true;
  }
  return false;
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
      const picker = new FilePickerImpl({ type: "image", current: current || "", callback: (path) => finish(path) });
      picker.browse().catch(() => finish(""));
    } catch {
      finish("");
    }
  });
}

async function postCard(actor, line, extra) {
  const ChatMessage = globalThis.ChatMessage;
  if (!ChatMessage?.create) return;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker?.({ actor }) || { alias: who(actor) },
    content: `<div class="faserip-mental"><p>${esc(line)}</p><div class="feat-actions"><button type="button" data-faserip-mental="clear">Dismiss</button></div></div>`,
    flags: { faserip: { mental: { sceneId: sceneOf()?.id || "", ...extra } } }
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
      console.warn("FASERIP | telekinesis", err);
    }
    try {
      await doc.update({ x, y });
      return true;
    } catch (err) {
      console.warn("FASERIP | telekinesis", err);
      return false;
    }
  }
  return askJudge("token", { uuid: doc.uuid, update: { x, y } });
}

async function telepathy(actor, item) {
  const mode = await choose(item.name, "Send a thought, or listen for one.", [
    { action: "send", label: "Send" },
    { action: "listen", label: "Listen" },
    { action: "cancel", label: "Cancel" }
  ]);
  if (!mode) return null;
  const target = needTarget(actor, item);
  if (!target) return null;
  if (mode === "listen") {
    const held = await resisted(target, item, ["psyche"]);
    if (held !== false) return held ? true : null;
    const thought = target.getFlag?.("faserip", "command")?.text
      || target.getFlag?.("faserip", "emotion")
      || "a surface thought";
    await whisper(actor, target, `<p><strong>${esc(item.name)}</strong> listens to ${esc(target.name)}. You catch: ${esc(thought)}. The Judge fills in the rest.</p>`);
    globalThis.ui?.notifications?.info(`${who(actor)} listens to ${target.name}.`);
    return true;
  }
  const text = await askText(item.name, `Thought for ${target.name}`);
  if (!text) return null;
  const held = await resisted(target, item, ["psyche"]);
  if (held !== false) return held ? true : null;
  await whisper(actor, target, `<p><strong>${esc(item.name)}</strong> from ${esc(who(actor))} to ${esc(target.name)}: ${esc(text)}</p>`);
  globalThis.ui?.notifications?.info(`${who(actor)} sends a thought to ${target.name}.`);
  return true;
}

async function image(actor, item) {
  if (!needScene()) return null;
  const src = await pickImage("");
  if (!src) return null;
  const point = await pickMapPoint(`${item.name}: click where the image appears. Right-click cancels.`);
  if (!point || !nearEnough(actor, item, point)) return null;
  const size = gridSize() * 2;
  const ids = await askJudge("embed", {
    sceneId: sceneOf()?.id,
    docType: "Tile",
    data: [{
      x: Math.round(point.x - size / 2),
      y: Math.round(point.y - size / 2),
      width: size,
      height: size,
      texture: { src },
      flags: { faserip: { mental: "image" } }
    }]
  });
  if (!ids?.length) {
    globalThis.ui?.notifications?.warn("That image could not be placed.");
    return null;
  }
  const line = `${who(actor)} projects an image with ${item.name}.`;
  await postCard(actor, line, { parts: [{ docType: "Tile", ids }] });
  globalThis.ui?.notifications?.info(line);
  return true;
}

async function telekinesis(actor, item) {
  if (!needScene()) return null;
  const mode = await choose(item.name, "Move the target to a spot, or hurl them away.", [
    { action: "move", label: "Move" },
    { action: "hurl", label: "Hurl" },
    { action: "cancel", label: "Cancel" }
  ]);
  if (!mode) return null;
  const target = needTarget(actor, item);
  if (!target) return null;
  if (mode === "hurl") {
    const { shoveActor } = await import("./movement.mjs");
    const squares = Math.max(1, Number(THROW_RANGE[rankOf(item)]) || 1);
    const shove = await shoveActor(target, actor, squares, "back");
    const landed = shove?.squares ? `${shove.squares} square${shove.squares === 1 ? "" : "s"}` : "no open square";
    globalThis.ui?.notifications?.info(`${item.name} hurls ${target.name} (${landed}).`);
    return true;
  }
  const doc = tokenFor(target)?.document;
  if (!doc) return null;
  const point = await pickMapPoint(`${item.name}: click where ${target.name} moves. Right-click cancels.`);
  if (!point || !nearEnough(actor, item, point)) return null;
  const x = Math.round(point.x - (doc.width * gridSize()) / 2);
  const y = Math.round(point.y - (doc.height * gridSize()) / 2);
  const ok = await slide(doc, x, y);
  if (!ok) return null;
  globalThis.ui?.notifications?.info(`${item.name} moves ${target.name}.`);
  return true;
}

async function mind(actor, item) {
  const target = needTarget(actor, item);
  if (!target) return null;
  if (target.getFlag?.("faserip", "command")) {
    const mode = await choose(item.name, `${esc(target.name)} is already under a command.`, [
      { action: "release", label: "Release" },
      { action: "again", label: "New command" },
      { action: "cancel", label: "Cancel" }
    ]);
    if (!mode) return null;
    if (mode === "release") {
      await owned(target, "flag", { uuid: target.uuid, key: "command", unset: true });
      await setStatus(target, "controlled", false, true);
      globalThis.ui?.notifications?.info(`${target.name} is released.`);
      return true;
    }
  }
  const text = await askText(item.name, `Command for ${target.name}`);
  if (!text) return null;
  const held = await resisted(target, item, ["psyche"]);
  if (held !== false) return held ? true : null;
  const ok = await owned(target, "flag", { uuid: target.uuid, key: "command", value: { by: actor.uuid, text } });
  if (!ok) return null;
  await setStatus(target, "controlled", true, true);
  await whisper(actor, target, `<p><strong>${esc(item.name)}</strong>: ${esc(target.name)} is commanded to ${esc(text)}</p>`);
  globalThis.ui?.notifications?.info(`${target.name} is under command.`);
  return true;
}

async function emotion(actor, item) {
  const target = needTarget(actor, item);
  if (!target) return null;
  const mode = await choose(item.name, `Set ${esc(target.name)}'s feeling.`, [
    { action: "fear", label: "Fear" },
    { action: "rage", label: "Rage" },
    { action: "calm", label: "Calm" },
    { action: "cancel", label: "Cancel" }
  ]);
  if (!mode) return null;
  if (mode !== "calm") {
    const held = await resisted(target, item, ["psyche"]);
    if (held !== false) return held ? true : null;
  }
  if (mode === "calm") {
    await owned(target, "flag", { uuid: target.uuid, key: "emotion", unset: true });
    await setStatus(target, "fear", false);
    await setStatus(target, "rage", false);
    globalThis.ui?.notifications?.info(`${target.name} is calmed.`);
    return true;
  }
  await owned(target, "flag", { uuid: target.uuid, key: "emotion", value: mode });
  await setStatus(target, "fear", mode === "fear");
  await setStatus(target, "rage", mode === "rage");
  const line = mode === "fear"
    ? `${target.name} is afraid. Attacks are −1 column.`
    : `${target.name} is enraged. Attacks are +1 column.`;
  globalThis.ui?.notifications?.info(line);
  return true;
}

async function field(actor, item) {
  const mode = await choose(item.name, "A shield soaks on you. A barrier is a wall on the map.", [
    { action: "shield", label: "Shield" },
    { action: "barrier", label: "Barrier" },
    { action: "cancel", label: "Cancel" }
  ]);
  if (mode === "barrier") return forceBarrier(actor, item);
  if (!mode) return null;
  const on = !item.system?.forceField;
  try {
    await item.update({ "system.forceField": on });
  } catch (err) {
    console.warn("FASERIP | force field", err);
    return null;
  }
  const amount = rankValue(rankOf(item));
  const { playShieldArt } = await import("./vfx.mjs");
  await playShieldArt(actor, on);
  globalThis.ui?.notifications?.info(on ? `${item.name} is up. It soaks ${amount}.` : `${item.name} is down.`);
  return true;
}

async function forceBarrier(actor, item) {
  if (!needScene()) return null;
  const start = await pickMapPoint(`${item.name}: click one end of the barrier. Right-click cancels.`);
  if (!start || !nearEnough(actor, item, start)) return null;
  const end = await pickMapPoint(`${item.name}: click the other end. Right-click cancels.`);
  if (!end || !nearEnough(actor, item, end)) return null;
  const ids = await askJudge("embed", {
    sceneId: sceneOf()?.id,
    docType: "Wall",
    data: [{
      c: [Math.round(start.x), Math.round(start.y), Math.round(end.x), Math.round(end.y)],
      move: 20,
      sight: 20,
      light: 20,
      sound: 20
    }]
  });
  if (!ids?.length) {
    globalThis.ui?.notifications?.warn("That barrier could not be raised.");
    return null;
  }
  const { playWallArt } = await import("./vfx.mjs");
  const effectName = await playWallArt(start, end, "force");
  const line = `${who(actor)} raises a barrier with ${item.name}.`;
  await postCard(actor, line, { parts: [{ docType: "Wall", ids }], effectNames: effectName ? [effectName] : [] });
  globalThis.ui?.notifications?.info(line);
  return true;
}

async function animal(actor, item) {
  const target = needTarget(actor, item);
  if (!target) return null;
  const mode = await choose(item.name, "Speak with them, or steer them.", [
    { action: "speak", label: "Speak" },
    { action: "steer", label: "Steer" },
    { action: "cancel", label: "Cancel" }
  ]);
  if (!mode) return null;
  if (mode === "speak") {
    const text = await askText(item.name, `Say to ${target.name}`);
    if (!text) return null;
    await whisper(actor, target, `<p><strong>${esc(item.name)}</strong> to ${esc(target.name)}: ${esc(text)}</p>`);
    globalThis.ui?.notifications?.info(`${who(actor)} speaks with ${target.name}.`);
    return true;
  }
  if (target.getFlag?.("faserip", "obeys")) {
    await owned(target, "flag", { uuid: target.uuid, key: "obeys", unset: true });
    await setStatus(target, "obeys", false);
    globalThis.ui?.notifications?.info(`${target.name} is released.`);
    return true;
  }
  const held = await resisted(target, item, ["intuition"]);
  if (held !== false) return held ? true : null;
  await owned(target, "flag", { uuid: target.uuid, key: "obeys", value: actor.uuid });
  await setStatus(target, "obeys", true);
  globalThis.ui?.notifications?.info(`${target.name} obeys ${who(actor)}.`);
  return true;
}

async function machine(actor, item) {
  await actor.setFlag?.("faserip", "machineRank", rankOf(item));
  globalThis.ui?.notifications?.info(`The next Reason FEAT uses ${rankLabel(rankOf(item))}.`);
  return true;
}

async function empathy(actor, item, animals) {
  const target = needTarget(actor, item);
  if (!target) return null;
  const feeling = target.getFlag?.("faserip", "emotion") || "";
  const state = target.getFlag?.("faserip", "battle")?.state || "";
  const max = Number(target.system?.health?.max) || 0;
  const value = Number(target.system?.health?.value) || 0;
  const ratio = max > 0 ? value / max : 1;
  const body = ratio > 0.75 ? "steady" : ratio > 0.4 ? "hurt" : ratio > 0 ? "badly hurt" : "down";
  const mood = feeling || (animals ? "no strong animal mood" : "no strong emotion");
  const hurt = state && state !== "ok" ? ` They are ${state}.` : "";
  await whisper(actor, null, `<p><strong>${esc(item.name)}</strong>: ${esc(target.name)} feels ${esc(mood)}. They seem ${esc(body)}.${esc(hurt)}</p>`);
  try {
    const { rollFeat } = await import("./dice/universal-table.mjs");
    const message = await rollFeat({
      actor,
      rankId: rankOf(item),
      label: item.name,
      skipCondition: true
    });
    const color = message?.flags?.faserip?.color;
    if (color === "yellow" || color === "red") {
      await whisper(actor, null, `<p><strong>${esc(item.name)}</strong>: a clearer read of ${esc(target.name)}. The Judge says why they feel that way.</p>`);
    }
  } catch (err) {
    console.warn("FASERIP | empathy", err);
  }
  globalThis.ui?.notifications?.info(`${who(actor)} reads ${target.name}.`);
  return true;
}

async function screen(actor, item) {
  const on = !actor.getFlag?.("faserip", "psiScreen");
  if (on) await actor.setFlag?.("faserip", "psiScreen", rankOf(item));
  else await actor.unsetFlag?.("faserip", "psiScreen");
  await setStatus(actor, "psi-screen", on);
  globalThis.ui?.notifications?.info(on
    ? `${item.name} is up. Psionic blasts at ${rankLabel(rankOf(item))} or under do not get through.`
    : `${item.name} is down.`);
  return true;
}

async function probe(actor, item) {
  const target = needTarget(actor, item);
  if (!target) return null;
  const text = await askText(item.name, `What are you looking for in ${target.name}?`);
  if (!text) return null;
  const held = await resisted(target, item, ["psyche"]);
  if (held !== false) return held ? true : null;
  await whisper(actor, target, `<p><strong>${esc(item.name)}</strong> of ${esc(target.name)}: ${esc(text)}. The Judge names what the mind gives up.</p>`);
  globalThis.ui?.notifications?.info(`The probe of ${target.name} gets through.`);
  return true;
}

async function animate(actor, item) {
  if (!needScene()) return null;
  const src = await pickImage("");
  if (!src) return null;
  const point = await pickMapPoint(`${item.name}: click where it comes to life. Right-click cancels.`);
  if (!point || !nearEnough(actor, item, point)) return null;
  const rankId = rankOf(item);
  const made = await askJudge("animate", {
    sceneId: sceneOf()?.id,
    x: Math.round(point.x - gridSize() / 2),
    y: Math.round(point.y - gridSize() / 2),
    src,
    actor: {
      name: "Animated Drawing",
      type: "npc",
      img: src,
      system: { abilities: { strength: { rank: rankId, number: rankValue(rankId) } } }
    }
  });
  if (!made?.actorId) {
    globalThis.ui?.notifications?.warn("That drawing could not be animated.");
    return null;
  }
  const line = `${who(actor)} animates a drawing at ${rankLabel(rankId)} Strength.`;
  await postCard(actor, line, { actorId: made.actorId, parts: [] });
  globalThis.ui?.notifications?.info(line);
  return true;
}

async function possession(actor, item) {
  const saved = actor.getFlag?.("faserip", "possessing");
  if (saved?.uuid) {
    const self = tokenFor(actor, { controlled: true })?.document;
    const host = await fromUuid(saved.uuid);
    if (self) {
      await owned(self, "token", {
        uuid: self.uuid,
        update: {
          x: saved.x,
          y: saved.y,
          alpha: saved.alpha ?? 1,
          movementAction: saved.movementAction || "walk"
        }
      });
    }
    if (host) await setStatus(host, "possessed", false, true);
    await actor.unsetFlag?.("faserip", "possessing");
    globalThis.ui?.notifications?.info(`${who(actor)} returns to their body.`);
    return true;
  }
  if (!needScene()) return null;
  const target = needTarget(actor, item);
  if (!target) return null;
  const held = await resisted(target, item, ["psyche"]);
  if (held !== false) return held ? true : null;
  const self = tokenFor(actor, { controlled: true })?.document;
  const host = tokenFor(target)?.document;
  if (!self || !host) return null;
  await actor.setFlag?.("faserip", "possessing", {
    uuid: target.uuid,
    x: self.x,
    y: self.y,
    alpha: self.alpha ?? 1,
    movementAction: self.movementAction || "walk"
  });
  await owned(self, "token", {
    uuid: self.uuid,
    update: { x: host.x, y: host.y, alpha: 0.35 }
  });
  await setStatus(target, "possessed", true, true);
  globalThis.ui?.notifications?.info(`${who(actor)} occupies ${target.name}.`);
  return true;
}

async function swapMinds(actor, item) {
  const target = needTarget(actor, item);
  if (!target) return null;
  const held = await resisted(target, item, ["psyche"]);
  if (held !== false) return held ? true : null;
  const a = tokenFor(actor, { controlled: true })?.document;
  const b = tokenFor(target)?.document;
  if (!a || !b) {
    globalThis.ui?.notifications?.warn("Both tokens need to be on the map.");
    return null;
  }
  const record = {
    host: target.uuid,
    ax: a.x,
    ay: a.y,
    bx: b.x,
    by: b.y,
    aSrc: a.texture?.src || "",
    bSrc: b.texture?.src || ""
  };
  const movedA = await owned(a, "token", {
    uuid: a.uuid,
    update: { x: record.bx, y: record.by, "texture.src": record.bSrc }
  });
  const movedB = await owned(b, "token", {
    uuid: b.uuid,
    update: { x: record.ax, y: record.ay, "texture.src": record.aSrc }
  });
  if (!movedA || !movedB) return null;
  await actor.setFlag?.("faserip", "mindSwap", record);
  globalThis.ui?.notifications?.info(`${who(actor)} and ${target.name} exchange places and looks. Use again to undo it.`);
  return true;
}

async function restoreMinds(actor, item, saved) {
  const host = await fromUuid(saved.host);
  const a = tokenFor(actor, { controlled: true })?.document;
  const b = tokenFor(host)?.document || host?.getActiveTokens?.()?.[0]?.document;
  if (a) {
    await owned(a, "token", {
      uuid: a.uuid,
      update: { x: saved.ax, y: saved.ay, "texture.src": saved.aSrc || a.texture?.src }
    });
  }
  if (b) {
    await owned(b, "token", {
      uuid: b.uuid,
      update: { x: saved.bx, y: saved.by, "texture.src": saved.bSrc || b.texture?.src }
    });
  }
  await actor.unsetFlag?.("faserip", "mindSwap");
  globalThis.ui?.notifications?.info(`${item.name} puts both minds back.`);
  return true;
}

async function transfer(actor, item) {
  const swapped = actor.getFlag?.("faserip", "mindSwap");
  if (swapped) return restoreMinds(actor, item, swapped);
  const saved = actor.getFlag?.("faserip", "transfer");
  if (!saved?.itemId) {
    const mode = await choose(item.name, "Move a power, or exchange places and looks.", [
      { action: "power", label: "Power" },
      { action: "minds", label: "Minds" },
      { action: "cancel", label: "Cancel" }
    ]);
    if (mode === "minds") return swapMinds(actor, item);
    if (!mode) return null;
  }
  if (saved?.itemId) {
    const held = actor.items?.get?.(saved.itemId);
    const host = await fromUuid(saved.hostUuid);
    if (held && host) {
      const system = typeof held.system?.toObject === "function" ? held.system.toObject() : { rank: held.system?.rank || "typical" };
      await owned(host, "give", {
        uuid: host.uuid,
        item: { name: held.name, type: "power", img: held.img, system }
      });
      await held.delete();
    } else if (held) {
      await held.delete();
    }
    await actor.unsetFlag?.("faserip", "transfer");
    globalThis.ui?.notifications?.info(`${item.name} gives the power back.`);
    return true;
  }
  const target = needTarget(actor, item);
  if (!target) return null;
  const powers = [...(target.items ?? [])].filter((entry) => entry.type === "power" && entry.id !== item.id);
  if (!powers.length) {
    globalThis.ui?.notifications?.warn(`${target.name} has no power to move.`);
    return null;
  }
  const picked = powers.length === 1 ? powers[0] : await choosePower(powers, item.name);
  if (!picked) return null;
  const held = await resisted(target, item, ["psyche"]);
  if (held !== false) return held ? true : null;
  const system = typeof picked.system?.toObject === "function" ? picked.system.toObject() : { rank: picked.system?.rank || "typical" };
  let createdId = "";
  if (typeof actor.createEmbeddedDocuments === "function") {
    const [created] = await actor.createEmbeddedDocuments("Item", [{
      name: picked.name,
      type: "power",
      img: picked.img,
      system,
      flags: { faserip: { transferred: true } }
    }]);
    createdId = created?.id || "";
  } else {
    createdId = await askJudge("give", {
      uuid: actor.uuid,
      item: { name: picked.name, type: "power", img: picked.img, system, flags: { faserip: { transferred: true } } }
    });
  }
  if (!createdId) return null;
  const removed = await owned(picked, "deleteItem", { uuid: picked.uuid });
  if (!removed) return null;
  await actor.setFlag?.("faserip", "transfer", { itemId: createdId, hostUuid: target.uuid });
  globalThis.ui?.notifications?.info(`${picked.name} moves to ${who(actor)}.`);
  return true;
}

async function choosePower(powers, title) {
  const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) return powers[0];
  const options = powers.map((power) => `<option value="${power.id}">${esc(power.name)}</option>`).join("");
  const form = await DialogV2.wait({
    window: { title },
    content: `<label>Power <select name="power">${options}</select></label>`,
    buttons: [
      { action: "take", label: "Take", default: true, callback: (_event, button) => button.form },
      { action: "cancel", label: "Cancel" }
    ],
    rejectClose: false
  });
  if (!form || form === "cancel") return null;
  const id = form.elements?.power?.value || form.querySelector?.('[name="power"]')?.value || "";
  return powers.find((power) => power.id === id) || null;
}

async function astral(actor, item) {
  const doc = tokenFor(actor, { controlled: true })?.document;
  if (!doc) {
    globalThis.ui?.notifications?.warn(`${who(actor)} needs a token on the map.`);
    return null;
  }
  const saved = doc.getFlag?.("faserip", "astralBody");
  if (actor.getFlag?.("faserip", "astral") && saved) {
    await doc.update({ alpha: saved.alpha ?? 1, movementAction: saved.movementAction || "walk" });
    await doc.unsetFlag?.("faserip", "astralBody");
    await actor.unsetFlag?.("faserip", "astral");
    await setStatus(actor, "astral", false);
    globalThis.ui?.notifications?.info(`${who(actor)} returns to their body.`);
    return true;
  }
  await doc.setFlag?.("faserip", "astralBody", { alpha: doc.alpha ?? 1, movementAction: doc.movementAction || "walk" });
  await actor.setFlag?.("faserip", "astral", true);
  await doc.update({ alpha: 0.4, movementAction: "phase" });
  await setStatus(actor, "astral", true);
  globalThis.ui?.notifications?.info(`${item.name}: ${who(actor)} is astral and can pass through walls. The body is helpless.`);
  return true;
}

async function glimpse(actor, item, past) {
  const text = await askText(item.name, past ? "What past are you reading?" : "What future are you looking at?");
  if (!text) return null;
  const { rollFeat } = await import("./dice/universal-table.mjs");
  const message = await rollFeat({
    actor,
    item,
    rankId: rankOf(item),
    label: item.name,
    skipCondition: true
  });
  if (!message) return null;
  const color = message.getFlag?.("faserip", "color") ?? message.flags?.faserip?.color ?? "white";
  const hint = GLIMPSE[color] || GLIMPSE.white;
  const line = `${item.name}: ${hint}. ${text}`;
  await whisper(actor, null, `<p>${esc(line)} The Judge fills in the picture.</p>`);
  globalThis.ui?.notifications?.info(`${item.name}: ${hint}.`);
  return true;
}

async function ultimate(actor, item) {
  const buttons = ABILITIES.map((ability) => ({
    action: ability,
    label: ability.charAt(0).toUpperCase() + ability.slice(1)
  }));
  buttons.push({ action: "cancel", label: "Cancel" });
  const ability = await choose(item.name, "The next roll of this ability uses the Power rank.", buttons);
  if (!ability) return null;
  await actor.setFlag?.("faserip", "ultimate", { ability, rank: rankOf(item) });
  globalThis.ui?.notifications?.info(`The next ${ability} roll uses ${rankLabel(rankOf(item))}.`);
  return true;
}

export async function useMentalPower(actor, item) {
  const kind = mentalKind(item?.name);
  if (!actor || !kind) return null;
  if (kind === "telepathy") return telepathy(actor, item);
  if (kind === "image") return image(actor, item);
  if (kind === "tk") return telekinesis(actor, item);
  if (kind === "mind") return mind(actor, item);
  if (kind === "emotion") return emotion(actor, item);
  if (kind === "field") return field(actor, item);
  if (kind === "animal") return animal(actor, item);
  if (kind === "machine") return machine(actor, item);
  if (kind === "empathy") return empathy(actor, item, false);
  if (kind === "animal-empathy") return empathy(actor, item, true);
  if (kind === "screen") return screen(actor, item);
  if (kind === "probe") return probe(actor, item);
  if (kind === "animate") return animate(actor, item);
  if (kind === "possession") return possession(actor, item);
  if (kind === "transfer") return transfer(actor, item);
  if (kind === "astral") return astral(actor, item);
  if (kind === "precog") return glimpse(actor, item, false);
  if (kind === "postcog") return glimpse(actor, item, true);
  if (kind === "ultimate") return ultimate(actor, item);
  return null;
}

export function bindMentalChat(message, html) {
  const root = html instanceof HTMLElement ? html : html?.[0];
  const card = root?.querySelector?.(".faserip-mental");
  if (!card || card.dataset.mentalBound) return;
  const mental = message.getFlag?.("faserip", "mental") ?? message.flags?.faserip?.mental;
  if (!mental?.parts?.length && !mental?.actorId) return;
  card.dataset.mentalBound = "1";
  card.querySelector("[data-faserip-mental='clear']")?.addEventListener("click", (event) => {
    event.preventDefault();
    clearMental(message, mental).catch((err) => console.warn("FASERIP | mental", err));
  });
}

async function clearMental(message, mental) {
  const { endSequencerNames } = await import("./vfx.mjs");
  await endSequencerNames(mental.effectNames || []);
  if (mental.parts?.length) await askJudge("remove", { sceneId: mental.sceneId, parts: mental.parts });
  if (mental.actorId) await askJudge("deleteActor", { sceneId: mental.sceneId, actorId: mental.actorId });
  try {
    await message.update?.({ content: `<div class="faserip-mental"><p>Dismissed.</p></div>` });
  } catch { /* the map piece is already gone */ }
  globalThis.ui?.notifications?.info("Dismissed.");
}

function ensureStatus(id, name, img) {
  const effects = globalThis.CONFIG?.statusEffects;
  if (!Array.isArray(effects) || effects.some((effect) => effect.id === id)) return;
  effects.push({ id, name, img });
}

export function registerMental() {
  ensureStatus("controlled", "Controlled", "icons/svg/cowled.svg");
  ensureStatus("fear", "Fear", "icons/svg/hazard.svg");
  ensureStatus("rage", "Rage", "icons/svg/combat.svg");
  ensureStatus("obeys", "Obeys", "icons/svg/net.svg");
  ensureStatus("possessed", "Possessed", "icons/svg/mystery-man.svg");
  ensureStatus("astral", "Astral", "icons/svg/aura.svg");
  ensureStatus("psi-screen", "Psi-Screen", "icons/svg/holy-shield.svg");
  const Hooks = globalThis.Hooks;
  if (Hooks && !Hooks._faseripMental) {
    Hooks._faseripMental = true;
    Hooks.on("renderChatMessageHTML", bindMentalChat);
  }
  const game = globalThis.game;
  if (!game?.socket || game.faserip?._mentalSocket) return;
  game.faserip = game.faserip || {};
  game.faserip._mentalSocket = true;
  game.socket.on("system.faserip", async (data) => {
    if (data?.system !== "mental") return;
    if (data.action === "reply") {
      const waiter = waiters.get(data.requestId);
      if (!waiter) return;
      waiters.delete(data.requestId);
      waiter(data);
      return;
    }
    if (!isActiveGm()) return;
    const result = await perform(data);
    game.socket.emit("system.faserip", { system: "mental", action: "reply", requestId: data.requestId, result });
  });
}

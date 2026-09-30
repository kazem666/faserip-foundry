import { RANKS, rankLabel } from "./config.mjs";
import { elevationFeet } from "./elevation.mjs";
import { fallOutcome, floorsFromFeet } from "./rules-battle.mjs";
import { workflowOn } from "./workflow.mjs";

const STATUS_ID = "falling";
const ALOFT_NAME = /\bflight\b|gliding|levitation|skywalk|air walk/;
const dropping = new Set();

function groundElevation() {
  const base = Number(globalThis.canvas?.level?.elevation?.base ?? 0);
  return Number.isFinite(base) ? base : 0;
}

export function heightFeet(tokenDoc) {
  if (!tokenDoc) return 0;
  const here = elevationFeet(tokenDoc);
  const ground = elevationFeet({ document: { elevation: groundElevation() } });
  return here - ground;
}

export function powerKeepsAloft(name) {
  return ALOFT_NAME.test(String(name || "").toLowerCase());
}

export function flyingStatusId() {
  return globalThis.CONFIG?.specialStatusEffects?.FLY || "fly";
}

function hasStatus(actor, id) {
  return [...(actor?.effects ?? [])].some((effect) => effect.statuses?.has?.(id) || effect.getFlag?.("core", "statusId") === id);
}

async function syncFlyMovement(actor, active) {
  for (const token of actor?.getActiveTokens?.() ?? []) {
    const doc = token.document || token;
    if (active) {
      if (doc.movementAction === "fly") continue;
    } else if (doc.movementAction !== "fly") continue;
    try { await doc.update({ movementAction: active ? "fly" : "walk" }); } catch { /* the icon still toggles */ }
  }
}

export async function setFlying(actor, active) {
  if (!actor || typeof actor.toggleStatusEffect !== "function") return;
  const id = flyingStatusId();
  if (hasStatus(actor, id) !== active) {
    try {
      await actor.toggleStatusEffect(id, { active, overlay: false });
    } catch (err) {
      console.warn("FASERIP | flying", err);
    }
  }
  await syncFlyMovement(actor, active);
}

export async function toggleFlying(actor) {
  const next = !hasStatus(actor, flyingStatusId());
  await setFlying(actor, next);
  return next;
}

function isIncapacitated(actor) {
  if (actor?.system?.condition?.unconscious) return true;
  const state = actor?.getFlag?.("faserip", "battle")?.state || actor?.flags?.faserip?.battle?.state;
  return state === "unconscious" || state === "dying" || state === "dead";
}

/** A conscious flyer, glider, levitator, or skywalker is in the air on purpose. */
export function staysAloft(tokenDoc) {
  const actor = tokenDoc?.actor;
  if (!actor || isIncapacitated(actor)) return false;
  if (tokenDoc.movementAction === "fly") return true;
  for (const item of actor.items ?? []) {
    if (item?.type !== "power" && item?.type !== "equipment") continue;
    if (powerKeepsAloft(item.name)) return true;
  }
  return false;
}

export function isFlying(tokenDoc) {
  return staysAloft(tokenDoc);
}

function hasFalling(actor) {
  return [...(actor?.effects ?? [])].some((effect) => effect.statuses?.has?.(STATUS_ID));
}

async function setFalling(actor, active) {
  if (!actor || typeof actor.toggleStatusEffect !== "function") return;
  if (hasFalling(actor) === active) return;
  try {
    await actor.toggleStatusEffect(STATUS_ID, { active, overlay: false });
  } catch (err) {
    console.warn("FASERIP | falling status", err);
  }
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function surfaceOptions() {
  return RANKS.map((rank) => `<option value="${rank.id}" ${rank.id === "excellent" ? "selected" : ""}>${esc(rank.label)}</option>`).join("");
}

function fallCard({ name, uuid, done = false, line = "" }) {
  if (done) {
    return `<div class="faserip-chat faserip-fall" data-faserip-fall-token="${esc(uuid)}">
      <header><span>Falling</span><span>${esc(name)}</span></header>
      <p class="fall-line">${esc(line)}</p>
    </div>`;
  }
  return `<div class="faserip-chat faserip-fall" data-faserip-fall-token="${esc(uuid)}">
    <header><span>Falling</span><span>${esc(name)}</span></header>
    <p class="fall-line" data-fall-copy>Drop uses this token's height.</p>
    <label>Surface <select name="surface">${surfaceOptions()}</select></label>
    <div class="feat-actions"><button type="button" data-faserip-fall>Drop to ground</button></div>
  </div>`;
}

export function describeFall(feet, surface = "excellent") {
  const floors = floorsFromFeet(feet);
  const outcome = fallOutcome(floors, surface);
  const height = `${Math.round(feet)} ft, ${floors} floor${floors === 1 ? "" : "s"}`;
  let result = "Too short a drop to deal damage.";
  if (floors > 0 && outcome.gives) {
    result = `${height}. Falls at ${outcome.rate} areas. ${rankLabel(outcome.impactId)} impact breaks a ${rankLabel(outcome.surface)} surface, so the fall is absorbed.`;
  } else if (floors > 0) {
    result = `${height}. Falls at ${outcome.rate} areas. ${rankLabel(outcome.impactId)} impact gets through after Body Armor.`;
  }
  return { floors, outcome, result };
}

function paintCard(card, tokenDoc) {
  const copy = card.querySelector("[data-fall-copy]");
  if (!copy || !tokenDoc) return;
  const surface = card.querySelector("[name=surface]")?.value || "excellent";
  copy.textContent = describeFall(heightFeet(tokenDoc), surface).result;
}

function openCards(uuid) {
  return [...document.querySelectorAll(".faserip-fall")].filter((card) => card.dataset.faseripFallToken === uuid && card.querySelector("[data-faserip-fall]"));
}

function surfaceFromOpenCard(uuid) {
  return openCards(uuid)[0]?.querySelector("[name=surface]")?.value || "excellent";
}

async function tokenFromUuid(uuid) {
  if (!uuid || typeof globalThis.fromUuid !== "function") return null;
  try { return await globalThis.fromUuid(uuid); } catch { return null; }
}

function fallMessages(uuid, { pending = false } = {}) {
  return (globalThis.game?.messages?.contents ?? []).filter((message) => {
    const flagged = message.getFlag?.("faserip", "fallToken") === uuid;
    if (!flagged) return false;
    return pending ? !message.getFlag("faserip", "fallApplied") : true;
  });
}

async function settleCards(uuid, name, line) {
  const pending = fallMessages(uuid, { pending: true });
  if (!pending.length) {
    try {
      await globalThis.ChatMessage?.create({
        content: fallCard({ name, uuid, done: true, line }),
        speaker: globalThis.ChatMessage?.getSpeaker?.() || {},
        flags: { faserip: { fallToken: uuid, fallApplied: true } }
      });
    } catch (err) {
      console.warn("FASERIP | fall result", err);
    }
    return;
  }
  for (const message of pending) {
    try {
      await message.update({
        content: fallCard({ name, uuid, done: true, line }),
        flags: { faserip: { fallToken: uuid, fallApplied: true } }
      });
    } catch (err) {
      console.warn("FASERIP | fall card", err);
    }
  }
}

async function postFallCard(tokenDoc) {
  const actor = tokenDoc?.actor;
  const uuid = tokenDoc?.uuid;
  if (!actor || !uuid || fallMessages(uuid, { pending: true }).length) return;
  try {
    await globalThis.ChatMessage.create({
      content: fallCard({ name: actor.name, uuid }),
      speaker: globalThis.ChatMessage.getSpeaker({ actor, token: tokenDoc }),
      flags: { faserip: { fallToken: uuid } }
    });
  } catch (err) {
    console.warn("FASERIP | fall card", err);
  }
}

async function syncToken(tokenDoc) {
  if (!globalThis.game?.user?.isGM) return;
  const actor = tokenDoc?.actor;
  if (!actor || dropping.has(tokenDoc.uuid)) return;
  if (isIncapacitated(actor)) await setFlying(actor, false);
  const before = hasFalling(actor);
  const suspended = workflowOn("autoFalling") && !staysAloft(tokenDoc) && heightFeet(tokenDoc) >= 8;
  await setFalling(actor, suspended);
  if (suspended && !before) await postFallCard(tokenDoc);
}

function refreshActor(actor) {
  if (!globalThis.game?.user?.isGM || !actor) return;
  for (const token of actor.getActiveTokens?.() ?? []) {
    syncToken(token.document || token).catch(() => {});
  }
}

export async function applyFall(tokenDoc, surface = "excellent") {
  const actor = tokenDoc?.actor;
  const uuid = tokenDoc?.uuid;
  if (!actor || !uuid) return false;
  if (!actor.isOwner && !globalThis.game?.user?.isGM) {
    globalThis.ui?.notifications?.warn("Only the Judge can drop this token.");
    return false;
  }
  if (dropping.has(uuid)) return false;
  dropping.add(uuid);
  try {
    const feet = heightFeet(tokenDoc);
    const { floors, outcome } = describeFall(feet, surface);
    const name = actor.name;
    await tokenDoc.update({ elevation: groundElevation() });
    await setFalling(actor, false);
    let line = `${name} is not high enough to take falling damage and is back on the ground.`;
    if (floors > 0 && outcome.gives) {
      line = `${name} drops ${Math.round(feet)} ft (${floors} floors). The fall is ${outcome.rate} areas, ${rankLabel(outcome.impactId)}. The ${rankLabel(outcome.surface)} surface gives way, so the impact is absorbed.`;
    } else if (floors > 0 && outcome.damage > 0) {
      const soft = !!actor.getFlag?.("faserip", "softFall");
      const harm = soft ? Math.floor(outcome.damage / 2) : outcome.damage;
      const taken = await actor.applyDamage(harm, { energy: false });
      line = `${name} drops ${Math.round(feet)} ft (${floors} floors) onto ${rankLabel(outcome.surface)}. Impact ${rankLabel(outcome.impactId)} gets through for ${taken} Health.`;
      if (soft) line += " Light gravity cut the impact in half.";
    }
    globalThis.ui?.notifications?.info(line);
    await settleCards(uuid, name, line);
    return true;
  } finally {
    dropping.delete(uuid);
  }
}

export async function dropToken(tokenDoc) {
  return applyFall(tokenDoc, surfaceFromOpenCard(tokenDoc?.uuid));
}

export function bindFallChat(message, html) {
  const uuid = message.getFlag?.("faserip", "fallToken") ?? message.flags?.faserip?.fallToken;
  if (!uuid) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  const card = root?.querySelector?.(".faserip-fall");
  if (!card || card.dataset.fallBound) return;
  card.dataset.fallBound = "1";
  const select = card.querySelector("[name=surface]");
  const button = card.querySelector("[data-faserip-fall]");
  if (!select && !button) return;
  const refresh = () => {
    tokenFromUuid(uuid).then((token) => paintCard(card, token)).catch(() => {});
  };
  refresh();
  select?.addEventListener("change", refresh);
  button?.addEventListener("click", async (event) => {
    event.preventDefault();
    const token = await tokenFromUuid(uuid);
    if (!token) return;
    await applyFall(token, select?.value || "excellent");
  });
}

export function registerFalling() {
  const effects = globalThis.CONFIG?.statusEffects;
  if (Array.isArray(effects) && !effects.some((effect) => effect.id === STATUS_ID)) {
    effects.push({ id: STATUS_ID, name: "Falling", img: "icons/svg/falling.svg" });
  }
  const flyId = flyingStatusId();
  if (Array.isArray(effects) && !effects.some((effect) => effect.id === flyId)) {
    effects.push({ id: flyId, name: "EFFECT.StatusFlying", img: "icons/svg/wing.svg" });
  }
  const Hooks = globalThis.Hooks;
  if (!Hooks || Hooks._faseripFalling) return;
  Hooks._faseripFalling = true;
  Hooks.on("updateToken", (doc, changes) => {
    if (!changes || !("elevation" in changes || "movementAction" in changes)) return;
    syncToken(doc).catch((err) => console.warn("FASERIP | falling", err));
  });
  Hooks.on("updateActor", (actor, changes) => {
    if (!changes?.system?.condition && !changes?.flags?.faserip && !changes?.system?.health) return;
    refreshActor(actor);
  });
  const onPower = (item) => {
    if (item?.type === "power" || item?.type === "equipment") refreshActor(item.actor || item.parent);
  };
  Hooks.on("createItem", onPower);
  Hooks.on("deleteItem", onPower);
  Hooks.on("updateItem", onPower);
  Hooks.on("canvasReady", () => {
    for (const token of globalThis.canvas?.tokens?.placeables ?? []) {
      syncToken(token.document).catch(() => {});
    }
  });
  Hooks.on("renderTokenHUD", (hud, html) => {
    const root = html instanceof HTMLElement ? html : html?.[0];
    const tokenDoc = hud?.object?.document;
    if (!root || !tokenDoc) return;
    root.addEventListener("click", (event) => {
      const hit = event.target?.closest?.('[data-status-id="falling"]');
      if (!hit) return;
      event.preventDefault();
      event.stopPropagation();
      applyFall(tokenDoc, surfaceFromOpenCard(tokenDoc.uuid)).catch((err) => console.warn("FASERIP | drop", err));
    }, true);
  });
  Hooks.on("renderChatMessageHTML", bindFallChat);
}

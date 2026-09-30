import { TELEPORT_AREAS, intensityNeeded, rankIndex, rankLabel } from "./config.mjs";
import { feetPerArea, formatAreaCount, formatMovement } from "./movement.mjs";

const USE = {
  self: "Click a destination. A place you can see needs no roll. A known place out of sight calls for a FEAT, and a miss scatters one area.",
  other: "Target someone, then click where they appear. They resist with Psyche or Intuition unless you mark them willing.",
  gateway: "Click the entrance, then the exit. Each portal appears as you click it and stays until Close. Walking into the entrance comes out the exit.",
  dimension: "Roll a FEAT to leave. Return from the chat card."
};

export function teleportKind(name) {
  const key = String(name || "").toLowerCase();
  if (/matter teleport/.test(key)) return "";
  if (/teleport others|teleport other/.test(key)) return "other";
  if (/gateway|dimensional gate|dimensional aperture/.test(key)) return "gateway";
  if (/dimension travel|dimensional travel/.test(key)) return "dimension";
  if (/teleport|telereform/.test(key)) return "self";
  return "";
}

export function teleportUseTitle(name, rankId = "typical") {
  const kind = teleportKind(name);
  if (!kind) return "";
  const reach = teleportReachAreas(rankId);
  const range = Number.isFinite(reach) ? formatAreaCount(reach) : "the whole scene";
  return `${USE[kind]} Range ${range}.`;
}

export function teleportReachAreas(rankId) {
  if (Object.prototype.hasOwnProperty.call(TELEPORT_AREAS, rankId)) return TELEPORT_AREAS[rankId];
  return TELEPORT_AREAS.typical;
}

export function withinTeleport(feet, rankId, perArea = 20) {
  const max = teleportReachAreas(rankId);
  if (!Number.isFinite(max)) return true;
  if (!(max > 0)) return false;
  const per = perArea > 0 ? perArea : 20;
  return Number(feet) <= max * per + per * 0.05;
}

export function resistHolds(color, abilityRank, intensityRank) {
  const need = intensityNeeded(abilityRank, intensityRank);
  if (need.automatic) return true;
  if (need.impossible) return color === "red";
  if (need.color === "red") return color === "red";
  if (need.color === "yellow") return color === "yellow" || color === "red";
  return color && color !== "white";
}

function betterAbility(actor, keys) {
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

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function rankOf(item) {
  return item?.system?.rank || "typical";
}

function rangeText(rankId) {
  const areas = teleportReachAreas(rankId);
  if (!Number.isFinite(areas)) return "anywhere on this scene";
  return formatMovement(areas);
}

function tokenForActor(actor, { controlled = false } = {}) {
  const tokens = globalThis.canvas?.tokens?.placeables ?? [];
  const matches = tokens.filter((token) => token.actor === actor || token.actor?.uuid === actor?.uuid);
  if (controlled) return matches.find((token) => token.controlled) || matches[0] || null;
  return matches[0] || null;
}

function canMove(token) {
  return !!(token?.document?.isOwner || token?.actor?.isOwner || globalThis.game?.user?.isGM);
}

function centerOf(token) {
  const doc = token?.document;
  const size = Number(globalThis.canvas?.grid?.size) || 0;
  if (!doc || !(size > 0)) return null;
  return {
    x: doc.x + ((doc.width || 1) * size) / 2,
    y: doc.y + ((doc.height || 1) * size) / 2
  };
}

function distanceFeet(a, b) {
  const grid = globalThis.canvas?.grid;
  try {
    if (typeof grid?.measurePath === "function") {
      const path = grid.measurePath([a, b], { gridSpaces: false });
      const n = Number(path?.distance);
      if (Number.isFinite(n)) return n;
    }
  } catch {
    /* measure in squares instead */
  }
  const size = Number(grid?.size) || 1;
  const dist = Number(grid?.distance) || 5;
  return Math.hypot((a?.x || 0) - (b?.x || 0), (a?.y || 0) - (b?.y || 0)) / size * dist;
}

function sightBlocked(from, to) {
  try {
    const backend = globalThis.CONFIG?.Canvas?.polygonBackends?.sight;
    if (typeof backend?.testCollision === "function") {
      return !!backend.testCollision(from, to, { type: "sight", mode: "any" });
    }
  } catch {
    /* treat an unreadable wall test as open sight */
  }
  return false;
}

function teleportActionId() {
  const actions = globalThis.CONFIG?.Token?.movement?.actions ?? {};
  if (actions.blink?.teleport) return "blink";
  const found = Object.entries(actions).find(([, action]) => action?.teleport);
  return found?.[0] || "blink";
}

function topLeftFor(doc, point) {
  const grid = globalThis.canvas?.grid;
  const size = Number(grid?.size) || 0;
  const raw = {
    x: point.x - ((doc.width || 1) * size) / 2,
    y: point.y - ((doc.height || 1) * size) / 2
  };
  const mode = globalThis.CONST?.GRID_SNAPPING_MODES?.TOP_LEFT;
  if (typeof grid?.getSnappedPoint === "function" && mode != null) {
    try { return grid.getSnappedPoint(raw, { mode }); } catch { /* use the raw corner */ }
  }
  return raw;
}

function clampScene(point) {
  const box = globalThis.canvas?.dimensions;
  if (!box) return point;
  const left = Number(box.sceneX) || 0;
  const top = Number(box.sceneY) || 0;
  const right = left + (Number(box.sceneWidth) || 0);
  const bottom = top + (Number(box.sceneHeight) || 0);
  if (!(right > left) || !(bottom > top)) return point;
  return {
    x: Math.min(Math.max(point.x, left), right),
    y: Math.min(Math.max(point.y, top), bottom)
  };
}

function clampToReach(from, point, rankId) {
  const max = teleportReachAreas(rankId);
  if (!Number.isFinite(max)) return point;
  const maxFeet = max * feetPerArea();
  const dist = distanceFeet(from, point);
  if (!(dist > maxFeet) || !(dist > 0)) return point;
  const scale = maxFeet / dist;
  return {
    x: from.x + (point.x - from.x) * scale,
    y: from.y + (point.y - from.y) * scale
  };
}

function scatterAround(from, dest, rankId) {
  const feet = feetPerArea();
  const size = Number(globalThis.canvas?.grid?.size) || 1;
  const gridFeet = Number(globalThis.canvas?.grid?.distance) || 5;
  const pixels = feet / gridFeet * size;
  const angle = Math.random() * Math.PI * 2;
  const point = clampScene({
    x: dest.x + Math.cos(angle) * pixels,
    y: dest.y + Math.sin(angle) * pixels
  });
  return clampToReach(from, point, rankId);
}

function pickPoint(hint) {
  const board = document.getElementById("board");
  if (!board || !globalThis.canvas?.canvasCoordinatesFromClient) {
    globalThis.ui?.notifications?.warn("The map is not ready for a destination.");
    return Promise.resolve(null);
  }
  globalThis.ui?.notifications?.info(hint);
  return new Promise((resolve) => {
    const finish = (point) => {
      board.removeEventListener("pointerdown", onDown, true);
      board.removeEventListener("contextmenu", onMenu, true);
      document.removeEventListener("keydown", onKey, true);
      resolve(point);
    };
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      finish(null);
    };
    const onMenu = (event) => {
      event.preventDefault();
      event.stopPropagation();
      finish(null);
    };
    const onDown = (event) => {
      if (event.button === 2) {
        event.preventDefault();
        event.stopPropagation();
        finish(null);
        return;
      }
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      finish(globalThis.canvas.canvasCoordinatesFromClient({ x: event.clientX, y: event.clientY }));
    };
    board.addEventListener("pointerdown", onDown, true);
    board.addEventListener("contextmenu", onMenu, true);
    document.addEventListener("keydown", onKey, true);
  });
}

async function blinkToken(token, point) {
  const doc = token?.document;
  if (!doc || !point) return false;
  if (!canMove(token)) {
    globalThis.ui?.notifications?.warn("Only the Judge can move that token.");
    return false;
  }
  const corner = topLeftFor(doc, point);
  const action = teleportActionId();
  if (typeof doc.move === "function") {
    try {
      const moved = await doc.move(
        [{ x: corner.x, y: corner.y, action, snapped: false, explicit: true }],
        { showRuler: false }
      );
      if (moved !== false) return true;
    } catch (err) {
      console.warn("FASERIP | teleport move", err);
    }
  }
  try {
    await doc.update({ x: corner.x, y: corner.y });
    return true;
  } catch (err) {
    console.warn("FASERIP | teleport update", err);
    return false;
  }
}

async function note(actor, token, html, flags = null) {
  try {
    return await globalThis.ChatMessage?.create({
      content: html,
      speaker: globalThis.ChatMessage?.getSpeaker?.({ actor, token: token?.document }) || {},
      flags: flags ? { faserip: flags } : {}
    });
  } catch (err) {
    console.warn("FASERIP | teleport note", err);
    return null;
  }
}

function card(title, name, line, buttons = "") {
  return `<div class="faserip-chat faserip-teleport"><header><span>${esc(title)}</span><span>${esc(name)}</span></header><p class="fall-line">${esc(line)}</p>${buttons}</div>`;
}

async function playJump(actor, item) {
  try {
    const { playFeatVfx } = await import("./vfx.mjs");
    playFeatVfx({ actor, item, label: item?.name || "Teleport", color: "green" });
  } catch {
    /* the move still happens */
  }
}

async function arrive(actor, token, item, point, line, { vfx = true } = {}) {
  const moved = await blinkToken(token, point);
  if (!moved) return null;
  if (vfx) await playJump(token.actor || actor, item);
  await note(actor, token, card(item.name, actor.name, line));
  globalThis.ui?.notifications?.info(line);
  return true;
}

async function checkReach(from, point, item) {
  const rankId = rankOf(item);
  const feet = distanceFeet(from, point);
  if (withinTeleport(feet, rankId, feetPerArea())) return true;
  const away = formatAreaCount(feet / feetPerArea());
  globalThis.ui?.notifications?.warn(`${item.name} reaches ${rangeText(rankId)}. That point is ${away} away.`);
  return false;
}

async function teleportSelf(actor, item, token = null) {
  const hero = token || tokenForActor(actor, { controlled: true });
  if (!hero) {
    globalThis.ui?.notifications?.warn(`${actor.name} needs a token on the map.`);
    return null;
  }
  const from = centerOf(hero);
  if (!from) return null;
  const dest = await pickPoint(`${item.name}: click the destination, or right-click to cancel. Reach ${rangeText(rankOf(item))}.`);
  if (!dest) return null;
  if (!(await checkReach(from, dest, item))) return null;
  const mover = hero.actor?.name || actor.name;
  let point = dest;
  let rolled = false;
  let line = `${mover} arrives ${formatAreaCount(distanceFeet(from, dest) / feetPerArea())} away.`;
  if (sightBlocked(from, dest)) {
    const { confirmDialog } = await import("./foundry-api.mjs");
    const known = await confirmDialog({
      title: item.name,
      content: "<p>That place is out of sight. A known destination still needs a FEAT. A miss scatters one area.</p>"
    });
    if (!known) return null;
    const { rollFeat } = await import("./dice/universal-table.mjs");
    const message = await rollFeat({
      actor,
      item,
      rankId: rankOf(item),
      label: item.name,
      skipCondition: false
    });
    if (!message) return null;
    rolled = true;
    const color = message.getFlag?.("faserip", "color") ?? message.flags?.faserip?.color;
    if (color === "white") {
      point = scatterAround(from, dest, rankOf(item));
      line = `${mover} misses the destination and scatters one area.`;
    } else {
      line = `${mover} arrives at the known place (${rankLabel(rankOf(item))} ${color}).`;
    }
  }
  return arrive(actor, hero, item, point, line, { vfx: !rolled });
}

async function teleportOther(actor, item) {
  const { combatTarget } = await import("./play-rules.mjs");
  const target = combatTarget(actor.id);
  const token = tokenForActor(target);
  if (!target || !token) {
    globalThis.ui?.notifications?.warn(`Target the person ${item.name} should move.`);
    return null;
  }
  const { promptForm } = await import("./foundry-api.mjs");
  const form = await promptForm({
    title: item.name,
    okLabel: "Choose destination",
    content: `<form><p>${esc(target.name)} will be moved.</p><label class="check"><input type="checkbox" name="resists" checked /> They resist (Psyche or Intuition)</label></form>`
  });
  if (!form) return null;
  const resists = !!form.querySelector?.('[name="resists"]')?.checked;
  if (resists) {
    const { rollFeat } = await import("./dice/universal-table.mjs");
    const ability = betterAbility(target, ["psyche", "intuition"]);
    const message = await rollFeat({
      actor: target,
      item,
      rankId: ability,
      label: `Resist ${item.name}`,
      intensityId: rankOf(item),
      skipCondition: true
    });
    if (!message) return null;
    const color = message.getFlag?.("faserip", "color") ?? message.flags?.faserip?.color;
    if (resistHolds(color, ability, rankOf(item))) {
      const line = `${target.name} resists ${item.name} and stays put.`;
      globalThis.ui?.notifications?.info(line);
      return true;
    }
  }
  return teleportSelf(actor, item, token);
}

function portalRadius() {
  return (Number(globalThis.canvas?.grid?.size) || 100) * 0.7;
}

function portalDrawing(point, label) {
  const radius = portalRadius();
  const exit = label === "Out";
  return {
    x: point.x - radius,
    y: point.y - radius,
    shape: { type: "e", width: radius * 2, height: radius * 2 },
    strokeWidth: 8,
    strokeColor: exit ? "#d97706" : "#6d28d9",
    strokeAlpha: 1,
    fillType: 1,
    fillColor: exit ? "#fde68a" : "#c4b5fd",
    fillAlpha: 0.45,
    text: label,
    fontSize: Math.max(18, Math.round(radius * 0.45)),
    textColor: "#1e1b4b",
    interface: false,
    hidden: false,
    locked: true,
    flags: { faserip: { gatewayPortal: true } }
  };
}

function portalFile() {
  const db = globalThis.Sequencer?.Database;
  if (typeof db?.entryExists !== "function") return "";
  const candidates = [
    "jb2a.portals.vertical.ring.blue",
    "jb2a.portals.horizontal.ring.blue",
    "jb2a.magic_signs.circle.02.conjuration.loop.blue",
    "jb2a.energy_field.circle.blue"
  ];
  return candidates.find((file) => {
    try { return db.entryExists(file); } catch { return false; }
  }) || "";
}

async function placePortal(point, label) {
  const portalIds = [];
  const effectNames = [];
  const scene = globalThis.canvas?.scene;
  if (scene?.createEmbeddedDocuments) {
    try {
      const docs = await scene.createEmbeddedDocuments("Drawing", [portalDrawing(point, label)]);
      for (const doc of docs) if (doc?.id) portalIds.push(doc.id);
    } catch (err) {
      console.warn("FASERIP | gateway portal", err);
      globalThis.ui?.notifications?.warn("That portal could not be drawn on the map.");
    }
  }
  const file = portalFile();
  const Sequence = globalThis.Sequence;
  if (file && typeof Sequence === "function") {
    const name = `faserip-gate-${label}-${globalThis.foundry?.utils?.randomID?.() || Math.random().toString(36).slice(2)}`;
    try {
      await new Sequence().effect().file(file).atLocation(point).scale(0.4).persist(true).name(name).play();
      effectNames.push(name);
    } catch (err) {
      console.warn("FASERIP | gateway effect", err);
    }
  }
  return { portalIds, effectNames };
}

function gateScene(gate) {
  return globalThis.game?.scenes?.get?.(gate?.sceneId) || globalThis.canvas?.scene || null;
}

function isGatewayDrawing(drawing) {
  return !!(drawing?.getFlag?.("faserip", "gatewayPortal")
    || drawing?.flags?.faserip?.gatewayPortal
    || drawing?._source?.flags?.faserip?.gatewayPortal);
}

function drawingCenter(drawing) {
  const shape = drawing?._source?.shape || drawing?.shape || {};
  return {
    x: Number(drawing?.x) + (Number(shape.width) || 0) / 2,
    y: Number(drawing?.y) + (Number(shape.height) || 0) / 2
  };
}

function nearPoint(drawing, point, reach) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
  const center = drawingCenter(drawing);
  return Math.hypot(center.x - point.x, center.y - point.y) <= reach;
}

function sameGate(a, b) {
  const aIds = (a?.portalIds || []).filter(Boolean).join(",");
  const bIds = (b?.portalIds || []).filter(Boolean).join(",");
  if (aIds && bIds) return aIds === bIds;
  return a?.sceneId === b?.sceneId && a?.ax === b?.ax && a?.ay === b?.ay && a?.bx === b?.bx && a?.by === b?.by;
}

function portalIdsFor(gate) {
  const ids = new Set((gate?.portalIds || []).filter(Boolean));
  const scene = gateScene(gate);
  if (!scene?.drawings) return [...ids];
  const reserved = new Set();
  for (const other of openGates()) {
    if (sameGate(other, gate)) continue;
    for (const id of other.portalIds || []) if (id) reserved.add(id);
  }
  for (const id of reserved) ids.delete(id);
  const reach = Math.max(portalRadius() * 2, 80);
  const spots = [{ x: gate?.ax, y: gate?.ay }, { x: gate?.bx, y: gate?.by }];
  for (const drawing of scene.drawings) {
    if (reserved.has(drawing.id) || ids.has(drawing.id) || !isGatewayDrawing(drawing)) continue;
    if (spots.some((spot) => nearPoint(drawing, spot, reach))) ids.add(drawing.id);
  }
  return [...ids];
}

function clearPortalGraphics(ids) {
  const canvas = globalThis.canvas;
  if (!canvas || !ids?.length) return;
  for (const id of ids) {
    const placeable = canvas.drawings?.get?.(id);
    try { canvas.primary?.removeDrawing?.(placeable); } catch { /* already gone */ }
    try { canvas.interface?.removeDrawing?.(placeable); } catch { /* already gone */ }
    if (placeable) {
      try { placeable.destroy(); } catch { /* already gone */ }
    }
    for (const group of [canvas.primary, canvas.interface]) {
      const map = group?.drawings;
      const key = `Drawing.${id}`;
      if (!map?.has?.(key)) continue;
      const shape = map.get(key);
      try { if (shape?.destroyed === false) shape.destroy({ children: true }); } catch { /* already gone */ }
      map.delete(key);
    }
  }
}

async function endGateEffects(names) {
  const endEffects = globalThis.Sequencer?.EffectManager?.endEffects;
  if (typeof endEffects !== "function") return;
  for (const name of new Set((names || []).filter((entry) => typeof entry === "string" && entry))) {
    try { await endEffects({ name }); } catch (err) {
      console.warn("FASERIP | gateway effect", err);
    }
  }
}

async function removePortals(gate) {
  const ids = portalIdsFor(gate);
  const scene = gateScene(gate);
  if (ids.length && scene?.deleteEmbeddedDocuments) {
    try { await scene.deleteEmbeddedDocuments("Drawing", ids); } catch (err) {
      console.warn("FASERIP | gateway portals", err);
    }
  }
  clearPortalGraphics(ids);
  await endGateEffects(gate?.effectNames);
}

async function sweepClosedGates() {
  if (!globalThis.game?.user?.isGM) return;
  for (const message of globalThis.game.messages?.contents ?? []) {
    if (!message.getFlag?.("faserip", "gateClosed")) continue;
    const gate = message.getFlag?.("faserip", "gateway") ?? message.flags?.faserip?.gateway;
    if (!gate) continue;
    await removePortals(gate);
  }
}

async function finishGate(message, line) {
  const gate = message.getFlag?.("faserip", "gateway") ?? message.flags?.faserip?.gateway;
  await removePortals(gate);
  try { await message.setFlag("faserip", "gateClosed", true); } catch (err) {
    console.warn("FASERIP | gateway", err);
  }
  const closed = String(message.content || "").replace(
    /<div class="feat-actions">[\s\S]*<\/div>/,
    `<p class="fall-line">${esc(line)}</p>`
  );
  try { await message.update({ content: closed }); } catch { /* the flag still blocks another step */ }
}

async function openGateway(actor, item) {
  const hero = tokenForActor(actor, { controlled: true });
  const from = hero ? centerOf(hero) : null;
  const first = await pickPoint(`${item.name}: click the entrance, or right-click to cancel. Reach ${rangeText(rankOf(item))}.`);
  if (!first) return null;
  if (from && !(await checkReach(from, first, item))) return null;
  const entrance = await placePortal(first, "In");
  let second = null;
  while (!second) {
    const point = await pickPoint(`${item.name}: click the exit. Right-click cancels and removes the entrance.`);
    if (!point) {
      await removePortals(entrance);
      return null;
    }
    if (!(await checkReach(first, point, item))) continue;
    second = point;
  }
  const exit = await placePortal(second, "Out");
  const sceneId = globalThis.canvas?.scene?.id || "";
  const line = `${actor.name} opens a gateway. Walk into the entrance to come out the exit. Close removes both portals.`;
  const buttons = `<div class="feat-actions"><button type="button" data-faserip-gate="close">Close</button></div>`;
  await note(actor, hero, card(item.name, actor.name, line, buttons), {
    gateway: {
      sceneId,
      ax: first.x,
      ay: first.y,
      bx: second.x,
      by: second.y,
      ownerId: actor.uuid || actor.id,
      portalIds: [...entrance.portalIds, ...exit.portalIds],
      effectNames: [...entrance.effectNames, ...exit.effectNames]
    }
  });
  await playJump(actor, item);
  globalThis.ui?.notifications?.info(line);
  return true;
}

async function leaveDimension(actor, item) {
  const token = tokenForActor(actor, { controlled: true });
  if (!token) {
    globalThis.ui?.notifications?.warn(`${actor.name} needs a token on the map.`);
    return null;
  }
  const { rollFeat } = await import("./dice/universal-table.mjs");
  const message = await rollFeat({
    actor,
    item,
    rankId: rankOf(item),
    label: item.name,
    skipCondition: false
  });
  if (!message) return null;
  const color = message.getFlag?.("faserip", "color") ?? message.flags?.faserip?.color;
  if (color === "white") {
    globalThis.ui?.notifications?.info(`${actor.name} fails to cross over.`);
    return true;
  }
  const doc = token.document;
  const spot = { x: doc.x, y: doc.y, elevation: doc.elevation ?? 0, sceneId: globalThis.canvas?.scene?.id || "" };
  try { await doc.update({ hidden: true }); } catch { /* the return card still marks them away */ }
  const line = `${actor.name} leaves this place.`;
  const buttons = `<div class="feat-actions"><button type="button" data-faserip-return>Return</button></div>`;
  await note(actor, token, card(item.name, actor.name, line, buttons), {
    returnSpot: { ...spot, tokenUuid: doc.uuid }
  });
  globalThis.ui?.notifications?.info(line);
  return true;
}

const crossing = new Set();

function gateKeeper(doc) {
  const users = globalThis.game?.users;
  const gm = users?.find?.((user) => user.isGM && user.active);
  if (gm) return globalThis.game.user?.id === gm.id;
  const owners = users?.filter?.((user) => user.active && doc?.testUserPermission?.(user, "OWNER")) ?? [];
  owners.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return owners[0]?.id === globalThis.game.user?.id;
}

function openGates() {
  const sceneId = globalThis.canvas?.scene?.id || "";
  const gates = [];
  for (const message of globalThis.game?.messages?.contents ?? []) {
    if (message.getFlag?.("faserip", "gateClosed")) continue;
    const gate = message.getFlag?.("faserip", "gateway") ?? message.flags?.faserip?.gateway;
    if (!gate || gate.sceneId !== sceneId) continue;
    if (!Number.isFinite(gate.ax) || !Number.isFinite(gate.bx)) continue;
    gates.push(gate);
  }
  return gates;
}

function enteredPortal(doc, point) {
  const here = centerOf({ document: doc });
  if (!here || !point) return false;
  const size = Number(globalThis.canvas?.grid?.size) || 100;
  const reach = portalRadius() + ((doc.width || 1) * size) / 2;
  return Math.hypot(here.x - point.x, here.y - point.y) <= reach;
}

async function onTokenMoved(doc) {
  if (!doc || crossing.has(doc.id) || !gateKeeper(doc)) return;
  const token = doc.object || globalThis.canvas?.tokens?.get?.(doc.id);
  if (!token) return;
  for (const gate of openGates()) {
    if (!enteredPortal(doc, { x: gate.ax, y: gate.ay })) continue;
    crossing.add(doc.id);
    try {
      const moved = await blinkToken(token, { x: gate.bx, y: gate.by });
      if (moved) {
        const name = token.actor?.name || token.name || "A token";
        globalThis.ui?.notifications?.info(`${name} comes out the exit portal.`);
      }
    } finally {
      crossing.delete(doc.id);
    }
    return;
  }
}

async function closeGate(message) {
  if (!globalThis.game?.user?.isGM && message.author?.id !== globalThis.game?.user?.id) {
    globalThis.ui?.notifications?.warn("Only the Judge can close this gateway.");
    return;
  }
  await finishGate(message, "The gateway is closed.");
}

async function returnFrom(message) {
  const spot = message.getFlag?.("faserip", "returnSpot") ?? message.flags?.faserip?.returnSpot;
  if (!spot || message.getFlag?.("faserip", "returned")) return;
  let doc = null;
  try { doc = spot.tokenUuid ? await globalThis.fromUuid(spot.tokenUuid) : null; } catch { doc = null; }
  if (!doc) {
    globalThis.ui?.notifications?.warn("That token is no longer on the scene.");
    return;
  }
  if (!doc.isOwner && !globalThis.game?.user?.isGM) {
    globalThis.ui?.notifications?.warn("Only the Judge can bring that token back.");
    return;
  }
  try {
    await doc.update({ x: spot.x, y: spot.y, elevation: spot.elevation ?? 0, hidden: false });
    await message.setFlag("faserip", "returned", true);
  } catch (err) {
    console.warn("FASERIP | return", err);
    return;
  }
  globalThis.ui?.notifications?.info(`${doc.actor?.name || doc.name} returns.`);
}

export async function useTeleportPower(actor, item) {
  const kind = teleportKind(item?.name);
  if (!actor || !kind) return null;
  if (kind === "dimension") return leaveDimension(actor, item);
  if (kind === "gateway") return openGateway(actor, item);
  if (kind === "other") return teleportOther(actor, item);
  return teleportSelf(actor, item);
}

export function bindTeleportChat(message, html) {
  const root = html instanceof HTMLElement ? html : html?.[0];
  const cardEl = root?.querySelector?.(".faserip-teleport");
  if (!cardEl || cardEl.dataset.teleportBound) return;
  const gate = message.getFlag?.("faserip", "gateway") ?? message.flags?.faserip?.gateway;
  const spot = message.getFlag?.("faserip", "returnSpot") ?? message.flags?.faserip?.returnSpot;
  if (!gate && !spot) return;
  cardEl.dataset.teleportBound = "1";
  cardEl.querySelector("[data-faserip-gate='close']")?.addEventListener("click", (event) => {
    event.preventDefault();
    closeGate(message);
  });
  cardEl.querySelector("[data-faserip-return]")?.addEventListener("click", (event) => {
    event.preventDefault();
    returnFrom(message);
  });
}

function isCircleType(type) {
  return type === "c" || type === "circle";
}

function ellipseFrom(shape) {
  const radius = Number(shape?.radius) || 0;
  const width = Math.max(1, Math.round(Number(shape?.width) || (radius ? radius * 2 : 1)));
  const height = Math.max(1, Math.round(Number(shape?.height) || (radius ? radius * 2 : 1)));
  return {
    type: "e",
    width,
    height,
    radius: Math.max(1, Math.round(radius || Math.min(width, height) / 2)),
    points: Array.isArray(shape?.points) ? shape.points : []
  };
}

function coerceCircleShape(document) {
  const shape = document?.shape;
  if (!isCircleType(shape?.type)) return false;
  const next = ellipseFrom(shape);
  shape.type = next.type;
  shape.width = next.width;
  shape.height = next.height;
  if (!shape.radius) shape.radius = next.radius;
  return shape.type === "e";
}

function installCircleDrawingFix() {
  const Doc = globalThis.foundry?.documents?.DrawingDocument || globalThis.DrawingDocument;
  const proto = Doc?.prototype;
  if (!proto?.prepareDerivedData || proto._faseripCircleCoerce) return;
  const original = proto.prepareDerivedData;
  const wrapped = function (...args) {
    try { coerceCircleShape(this); }
    catch (err) { console.warn("FASERIP | circle drawing", err); }
    return original.apply(this, args);
  };
  const libWrapper = globalThis.libWrapper;
  if (typeof libWrapper?.register === "function") {
    try {
      libWrapper.register(
        "faserip",
        "foundry.documents.DrawingDocument.prototype.prepareDerivedData",
        function (next, ...args) {
          try { coerceCircleShape(this); }
          catch (err) { console.warn("FASERIP | circle drawing", err); }
          return next(...args);
        },
        "WRAPPER"
      );
      proto._faseripCircleCoerce = true;
      return;
    } catch (err) {
      console.warn("FASERIP | circle drawing", err);
    }
  }
  proto.prepareDerivedData = wrapped;
  proto._faseripCircleCoerce = true;
}

function circleDrawingUpdates(scene) {
  const updates = [];
  const seen = new Set();
  const consider = (id, shape) => {
    if (!id || seen.has(id) || !isCircleType(shape?.type)) return;
    seen.add(id);
    updates.push({ _id: id, shape: ellipseFrom(shape) });
  };
  for (const drawing of scene.drawings ?? []) consider(drawing.id, drawing._source?.shape || drawing.shape);
  const raw = scene.drawings?._source;
  if (Array.isArray(raw)) {
    for (const data of raw) consider(data?._id, data?.shape);
  }
  return updates;
}

async function repairPortalDrawings() {
  if (!globalThis.game?.user?.isGM) return;
  const removed = new Set();
  let changed = false;
  for (const scene of globalThis.game.scenes ?? []) {
    const updates = circleDrawingUpdates(scene);
    if (!updates.length) continue;
    try {
      await scene.updateEmbeddedDocuments("Drawing", updates);
      changed = true;
      console.log("FASERIP | saved circle drawings as ellipses", updates.map((update) => update._id));
      continue;
    } catch (err) {
      console.warn("FASERIP | portal repair", err);
    }
    try {
      await scene.deleteEmbeddedDocuments("Drawing", updates.map((update) => update._id));
      for (const update of updates) removed.add(update._id);
      changed = true;
    } catch (err) {
      console.warn("FASERIP | portal repair", err);
    }
  }
  const canvas = globalThis.canvas;
  if (changed && canvas?.scene && !canvas.ready) {
    try { await canvas.draw(); }
    catch (err) { console.warn("FASERIP | portal repair draw", err); }
  }
  if (!removed.size || !canvas?.scene) return;
  const sceneId = canvas.scene.id || "";
  for (const message of globalThis.game.messages?.contents ?? []) {
    if (message.getFlag?.("faserip", "gateClosed")) continue;
    const gate = message.getFlag?.("faserip", "gateway") ?? message.flags?.faserip?.gateway;
    if (!gate || gate.sceneId !== sceneId) continue;
    const stale = (gate.portalIds || []).some((id) => removed.has(id) || !canvas.scene.drawings?.get?.(id));
    if (!stale) continue;
    await removePortals({ portalIds: [], effectNames: gate.effectNames || [] });
    const entrance = await placePortal({ x: gate.ax, y: gate.ay }, "In");
    const exit = await placePortal({ x: gate.bx, y: gate.by }, "Out");
    try {
      await message.setFlag("faserip", "gateway", {
        ...gate,
        portalIds: [...entrance.portalIds, ...exit.portalIds],
        effectNames: [...entrance.effectNames, ...exit.effectNames]
      });
    } catch (err) {
      console.warn("FASERIP | portal repair", err);
    }
  }
}

export function registerTeleport() {
  const Hooks = globalThis.Hooks;
  if (!Hooks || Hooks._faseripTeleport) return;
  Hooks._faseripTeleport = true;
  installCircleDrawingFix();
  Hooks.on("renderChatMessageHTML", bindTeleportChat);
  Hooks.on("updateToken", (doc, changes) => {
    if (!changes || !("x" in changes || "y" in changes)) return;
    if ("width" in changes || "height" in changes) return;
    onTokenMoved(doc).catch((err) => console.warn("FASERIP | gateway", err));
  });
  Hooks.on("deleteChatMessage", (message) => {
    const gate = message?.getFlag?.("faserip", "gateway") ?? message?.flags?.faserip?.gateway;
    if (!gate) return;
    removePortals(gate).catch((err) => console.warn("FASERIP | gateway", err));
  });
  Hooks.once("ready", () => {
    repairPortalDrawings()
      .then(() => sweepClosedGates())
      .catch((err) => console.warn("FASERIP | portal repair", err));
  });
}

import { ABILITIES, rankIndex, rankLabel, rankValue, shiftRank } from "./config.mjs";
import { reachSquares } from "./movement.mjs";
import { ATTACK_COLUMNS, combatTarget } from "./play-rules.mjs";

/**
 * First batch of body powers: reach that stretches the token, and size or unseen toggles.
 * Sizes are grid squares chosen for play, not a height chart from a book.
 */

const STRETCH_COLUMNS = new Set(["blunt", "edged", "grappling", "grabbing"]);
const STRETCH_NAME = /elongat|plasticity|stretch|prehensile hair/;
const stretches = new Map();

const GROWTH_SQUARES = {
  shift0: 1, feeble: 2, poor: 2, typical: 3, good: 3, excellent: 4, remarkable: 5,
  incredible: 6, amazing: 8, monstrous: 10, unearthly: 12, shiftx: 16, shifty: 20,
  shiftz: 24, cl1000: 30, cl3000: 40, cl5000: 50, beyond: 60
};

const SHRINK_SCALE = {
  shift0: 1, feeble: 0.75, poor: 0.6, typical: 0.5, good: 0.4, excellent: 0.3,
  remarkable: 0.25, incredible: 0.2, amazing: 0.15, monstrous: 0.12, unearthly: 0.1,
  shiftx: 0.08, shifty: 0.06, shiftz: 0.05, cl1000: 0.04, cl3000: 0.03, cl5000: 0.02, beyond: 0.02
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

export function bodyFormKind(name) {
  const key = powerKey(name);
  if (key === "growth") return "growth";
  if (key === "shrinking") return "shrink";
  if (key === "invisibility") return "invisible";
  if (key === "phasing") return "phase";
  if (key === "density manipulation - self") return "density";
  if (key === "blending") return "blend";
  if (key === "imitation") return "imitation";
  if (key === "alter ego") return "alter";
  if (key === "raise lowest ability") return "raise";
  if (key === "power absorption") return "absorb";
  if (key === "shape-shifting" || key === "body transformation" || key === "animal transformation - self") return "disguise";
  if (STRETCH_NAME.test(key)) return "squeeze";
  return "";
}

export function bodyUseTitle(name) {
  const kind = bodyFormKind(name);
  if (kind === "growth") return "Use toggles a larger token and raises Strength. Use again restores size and Strength. Shift-click to set Karma or Intensity.";
  if (kind === "shrink") return "Use toggles a smaller token. Strength drops and attackers take −1 column. Use again restores both. Shift-click to set Karma or Intensity.";
  if (kind === "invisible") return "Use toggles unseen. An attack reveals the hero. Shift-click to set Karma or Intensity.";
  if (kind === "phase") return "Use toggles phasing. The token can walk through walls until Use is pressed again. Shift-click to set Karma or Intensity.";
  if (kind === "density") return "Use cycles solid, diffuse, then normal. Solid is tougher and slower. Diffuse walks through walls and is easier to shove. Shift-click to set Karma or Intensity.";
  if (kind === "blend") return "Use fades the token into the background. Moving reveals it. Shift-click to set Karma or Intensity.";
  if (kind === "imitation") return "Use copies a targeted token's picture, or asks for an image. Use again restores the original. Shift-click to set Karma or Intensity.";
  if (kind === "disguise") return "Use asks for a new token image. Use again restores the original. Shift-click to set Karma or Intensity.";
  if (kind === "alter") return "Use swaps to the other face. The first use asks for that picture. Shift-click to set Karma or Intensity.";
  if (kind === "raise") return "Use lifts the lowest ability up to this Power rank. Use again puts it back. Shift-click to set Karma or Intensity.";
  if (kind === "absorb") return "Use copies a power from a touched target. They resist with Psyche. Use again drops the copy. Shift-click to set Karma or Intensity.";
  if (kind === "squeeze") return "Use flattens the token so it can slip through a gap. Melee still stretches toward a target. Use again restores the shape.";
  return "";
}

export function stretchPowerTitle(name) {
  if (!STRETCH_NAME.test(powerKey(name))) return "";
  return "Melee reach follows this rank. Slugfest, grabs, and other close attacks stretch the token toward the target, then it snaps back. Use flattens the token to slip through a gap, and Use again restores it.";
}

export function growthSquares(rankId) {
  return GROWTH_SQUARES[rankId] || GROWTH_SQUARES.typical;
}

export function shrinkScale(rankId) {
  return SHRINK_SCALE[rankId] || SHRINK_SCALE.typical;
}

function gridSize() {
  return Number(globalThis.canvas?.grid?.size) || 100;
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

export function stretchBox(doc, other, grid) {
  const size = Number(grid) || 100;
  if (!doc || !other || !(size > 0)) return null;
  const dx = (other.x + (other.width * size) / 2) - (doc.x + (doc.width * size) / 2);
  const dy = (other.y + (other.height * size) / 2) - (doc.y + (doc.height * size) / 2);
  if (Math.hypot(dx, dy) < size * 0.4) return null;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const far = other.x + (other.width * size) / 2;
    const back = dx >= 0 ? doc.x : doc.x + doc.width * size;
    const edge = dx >= 0 ? Math.max(far, back + size) : Math.min(far, back - size);
    const x = Math.round(Math.min(back, edge));
    const width = Math.max(Number(doc.width) || 1, Math.abs(edge - back) / size);
    if (width <= Number(doc.width) + 0.15) return null;
    return { x, width: round2(width) };
  }
  const far = other.y + (other.height * size) / 2;
  const back = dy >= 0 ? doc.y : doc.y + doc.height * size;
  const edge = dy >= 0 ? Math.max(far, back + size) : Math.min(far, back - size);
  const y = Math.round(Math.min(back, edge));
  const height = Math.max(Number(doc.height) || 1, Math.abs(edge - back) / size);
  if (height <= Number(doc.height) + 0.15) return null;
  return { y, height: round2(height) };
}

export function grownBox(doc, squares, grid) {
  const size = Number(grid) || 100;
  const next = Math.max(Number(doc?.width) || 1, Number(doc?.height) || 1, Number(squares) || 1);
  const cx = doc.x + (doc.width * size) / 2;
  const cy = doc.y + (doc.height * size) / 2;
  return {
    x: Math.round(cx - (next * size) / 2),
    y: Math.round(cy - (next * size) / 2),
    width: next,
    height: next
  };
}

export function shrunkBox(doc, scale, grid) {
  const size = Number(grid) || 100;
  const factor = Math.min(1, Math.max(0.02, Number(scale) || 1));
  const width = Math.max(0.2, round2((Number(doc?.width) || 1) * factor));
  const height = Math.max(0.2, round2((Number(doc?.height) || 1) * factor));
  const cx = doc.x + (doc.width * size) / 2;
  const cy = doc.y + (doc.height * size) / 2;
  return {
    x: Math.round(cx - (width * size) / 2),
    y: Math.round(cy - (height * size) / 2),
    width,
    height
  };
}

function hasStretchPower(actor) {
  for (const item of actor?.items ?? []) {
    if (item?.type !== "power" && item?.type !== "equipment") continue;
    if (STRETCH_NAME.test(powerKey(item.name))) return true;
  }
  return false;
}

function tokenFor(actor, { controlled = false, targeted = false } = {}) {
  const list = actor?.getActiveTokens?.() ?? [];
  if (controlled) {
    const held = list.find((token) => token.controlled);
    if (held) return held;
  }
  if (targeted) {
    const marked = list.find((token) => token.isTargeted || token.targeted);
    if (marked) return marked;
  }
  return list[0] || null;
}

export async function stretchForStrike(actor, column) {
  if (!STRETCH_COLUMNS.has(column) || !hasStretchPower(actor)) return;
  const target = combatTarget(actor?.id || "");
  const from = tokenFor(actor, { controlled: true });
  const to = tokenFor(target, { targeted: true });
  const doc = from?.document;
  const other = to?.document;
  if (!doc || !other || doc.id === other.id) return;
  const box = stretchBox(doc, other, gridSize());
  if (!box) return;
  const key = doc.id;
  const gen = (stretches.get(key)?.gen || 0) + 1;
  const saved = { x: doc.x, y: doc.y, width: doc.width, height: doc.height };
  stretches.set(key, { gen, saved });
  try {
    await doc.update(box);
  } catch (err) {
    stretches.delete(key);
    console.warn("FASERIP | stretch", err);
    return;
  }
  setTimeout(() => {
    const current = stretches.get(key);
    if (!current || current.gen !== gen) return;
    stretches.delete(key);
    doc.update(current.saved).catch((err) => console.warn("FASERIP | stretch", err));
  }, 700);
}

function sizeRank(actor, kind) {
  const wanted = kind === "growth" ? "growth" : "shrinking";
  for (const item of actor?.items ?? []) {
    if (item?.type !== "power") continue;
    if (powerKey(item.name) !== wanted) continue;
    return item.system?.rank || "typical";
  }
  return "typical";
}

export async function toggleBodySize(actor, kind) {
  const tokens = actor?.getActiveTokens?.() ?? [];
  if (!tokens.length) {
    globalThis.ui?.notifications?.warn(`${actor?.name || "The hero"} needs a token on the map.`);
    return null;
  }
  const turningOff = tokens.some((token) => (token.document || token).getFlag?.("faserip", "bodySize")?.mode === kind);
  const rankId = sizeRank(actor, kind);
  const grid = gridSize();
  for (const token of tokens) {
    const doc = token.document || token;
    const saved = doc.getFlag?.("faserip", "bodySize");
    try {
      if (turningOff && saved) {
        await doc.update({ x: saved.x, y: saved.y, width: saved.width, height: saved.height });
        await doc.unsetFlag("faserip", "bodySize");
        continue;
      }
      const base = saved
        ? { x: saved.x, y: saved.y, width: saved.width, height: saved.height }
        : { x: doc.x, y: doc.y, width: doc.width, height: doc.height };
      if (saved) await doc.update(base);
      const box = kind === "growth" ? grownBox(base, growthSquares(rankId), grid) : shrunkBox(base, shrinkScale(rankId), grid);
      await doc.update(box);
      await doc.setFlag("faserip", "bodySize", { mode: kind, ...base });
    } catch (err) {
      console.warn("FASERIP | body size", err);
    }
  }
  await syncSizeStrength(actor, kind, !turningOff);
  return !turningOff;
}

async function syncSizeStrength(actor, kind, active) {
  const saved = actor.getFlag?.("faserip", "sizeStrength");
  if (saved?.rank) {
    try {
      await actor.update({
        "system.abilities.strength.rank": saved.rank,
        "system.abilities.strength.number": saved.number ?? 0
      });
      await actor.unsetFlag("faserip", "sizeStrength");
      await actor.unsetFlag("faserip", "small");
    } catch (err) {
      console.warn("FASERIP | size strength", err);
    }
  }
  if (!active) return;
  const current = actor.getAbilityRank?.("strength") || "typical";
  const slot = actor.system?.abilities?.strength || {};
  const steps = kind === "growth"
    ? Math.min(3, Math.max(1, Math.floor((growthSquares(sizeRank(actor, "growth")) - 1) / 2)))
    : -1;
  const next = shiftRank(current, steps);
  try {
    await actor.setFlag("faserip", "sizeStrength", { rank: slot.rank || current, number: slot.number ?? 0 });
    await actor.update({
      "system.abilities.strength.rank": next,
      "system.abilities.strength.number": rankValue(next)
    });
    if (kind === "shrink") await actor.setFlag("faserip", "small", true);
  } catch (err) {
    console.warn("FASERIP | size strength", err);
  }
}

async function toggleSqueeze(actor, item) {
  const docs = activeDocs(actor);
  if (!docs.length) {
    globalThis.ui?.notifications?.warn(`${who(actor)} needs a token on the map.`);
    return "";
  }
  const squeezed = docs.some((doc) => doc.getFlag?.("faserip", "squeezed"));
  for (const doc of docs) {
    const saved = doc.getFlag?.("faserip", "squeezed");
    try {
      if (squeezed && saved) {
        await doc.update({ width: saved.width, height: saved.height });
        await doc.unsetFlag("faserip", "squeezed");
      } else if (!squeezed) {
        await doc.setFlag("faserip", "squeezed", { width: doc.width, height: doc.height });
        await doc.update({ width: Math.max(0.3, doc.width * 0.4) });
      }
    } catch (err) {
      console.warn("FASERIP | squeeze", err);
    }
  }
  return squeezed ? `${item.name} is off. ${who(actor)} fills back out.` : `${item.name} flattens ${who(actor)} so they can slip through.`;
}

function invisibleStatusId() {
  return globalThis.CONFIG?.specialStatusEffects?.INVISIBLE || "invisible";
}

function hasStatus(actor, id) {
  return [...(actor?.effects ?? [])].some((effect) => effect.statuses?.has?.(id) || effect.getFlag?.("core", "statusId") === id);
}

export async function toggleInvisible(actor) {
  if (!actor || typeof actor.toggleStatusEffect !== "function") return false;
  const id = invisibleStatusId();
  const next = !hasStatus(actor, id);
  try {
    await actor.toggleStatusEffect(id, { active: next, overlay: true });
  } catch (err) {
    console.warn("FASERIP | invisibility", err);
  }
  return next;
}

export async function revealIfAttacking(actor, column) {
  if (!ATTACK_COLUMNS.has(column) || !hasStatus(actor, invisibleStatusId())) return false;
  if (typeof actor.toggleStatusEffect !== "function") return false;
  try {
    await actor.toggleStatusEffect(invisibleStatusId(), { active: false });
  } catch (err) {
    console.warn("FASERIP | invisibility", err);
    return false;
  }
  globalThis.ui?.notifications?.info(`${actor.name} is seen.`);
  return true;
}

function who(actor) {
  return actor?.name || "The hero";
}

function activeDocs(actor) {
  return (actor?.getActiveTokens?.() ?? []).map((token) => token.document || token).filter(Boolean);
}

export function densitySlamSquares(squares, actor) {
  const mode = actor?.getFlag?.("faserip", "density") || "";
  const n = Math.max(0, Number(squares) || 0);
  if (mode === "solid") return Math.floor(n * 0.5);
  if (mode === "diffuse") return Math.ceil(n * 1.5);
  return n;
}

function wantsPhase(actor) {
  return !!(actor?.getFlag?.("faserip", "phasing") || actor?.getFlag?.("faserip", "density") === "diffuse");
}

async function syncPhaseMove(actor) {
  const phase = wantsPhase(actor);
  for (const doc of activeDocs(actor)) {
    const saved = doc.getFlag?.("faserip", "moveAction");
    try {
      if (phase) {
        if (doc.movementAction === "phase") continue;
        if (!saved) await doc.setFlag("faserip", "moveAction", doc.movementAction || "walk");
        await doc.update({ movementAction: "phase" });
      } else if (doc.movementAction === "phase") {
        await doc.update({ movementAction: saved || "walk" });
        if (saved) await doc.unsetFlag("faserip", "moveAction");
      }
    } catch (err) {
      console.warn("FASERIP | phase", err);
    }
  }
}

async function syncAlpha(actor) {
  const blending = !!actor?.getFlag?.("faserip", "blending");
  const phasing = !!actor?.getFlag?.("faserip", "phasing");
  const diffuse = actor?.getFlag?.("faserip", "density") === "diffuse";
  const alpha = blending ? 0.3 : phasing ? 0.45 : diffuse ? 0.55 : null;
  for (const doc of activeDocs(actor)) {
    const saved = doc.getFlag?.("faserip", "baseAlpha");
    try {
      if (alpha == null) {
        if (saved == null) continue;
        await doc.update({ alpha: saved });
        await doc.unsetFlag("faserip", "baseAlpha");
        continue;
      }
      if (saved == null) await doc.setFlag("faserip", "baseAlpha", doc.alpha ?? 1);
      if (doc.alpha !== alpha) await doc.update({ alpha });
    } catch (err) {
      console.warn("FASERIP | body look", err);
    }
  }
}

export function registerBodyForm() {
  const actions = globalThis.CONFIG?.Token?.movement?.actions;
  if (actions && !actions.phase && !Object.isFrozen(actions)) {
    actions.phase = {
      label: "Phase",
      icon: "fa-solid fa-ghost",
      img: "icons/svg/invisible.svg",
      order: 9,
      walls: null,
      canSelect: () => false
    };
  }
  const Hooks = globalThis.Hooks;
  if (!Hooks || Hooks._faseripBody) return;
  Hooks._faseripBody = true;
  Hooks.on("updateToken", (doc, changes) => {
    if (!changes || !("x" in changes || "y" in changes)) return;
    if ("width" in changes || "height" in changes) return;
    if (!doc?.isOwner) return;
    const actor = doc.actor;
    if (!actor?.getFlag?.("faserip", "blending")) return;
    revealBlend(actor).catch((err) => console.warn("FASERIP | blending", err));
  });
}

async function revealBlend(actor) {
  if (!actor?.getFlag?.("faserip", "blending")) return;
  await actor.unsetFlag("faserip", "blending");
  await syncAlpha(actor);
  globalThis.ui?.notifications?.info(`${who(actor)} is seen. Movement broke the blend.`);
}

export async function applyBodyPower(actor, item) {
  const kind = bodyFormKind(item?.name);
  if (!actor || !kind) return "";
  if (kind === "growth" || kind === "shrink") {
    const on = await toggleBodySize(actor, kind);
    if (on === true) return kind === "growth" ? `${item.name} is on. ${who(actor)} grows, and Strength rises.` : `${item.name} is on. ${who(actor)} shrinks. Strength drops, and attackers take −1 column.`;
    if (on === false) return `${item.name} is off. ${who(actor)} is back to normal size.`;
    return "";
  }
  if (kind === "invisible") {
    const on = await toggleInvisible(actor);
    return on ? `${item.name} is on. ${who(actor)} is unseen.` : `${item.name} is off. ${who(actor)} can be seen.`;
  }
  if (kind === "phase") return togglePhase(actor, item);
  if (kind === "density") return cycleDensity(actor, item);
  if (kind === "blend") return toggleBlend(actor, item);
  if (kind === "disguise" || kind === "imitation" || kind === "alter") return toggleFace(actor, item, kind);
  if (kind === "raise") return toggleRaise(actor, item);
  if (kind === "absorb") return toggleAbsorb(actor, item);
  if (kind === "squeeze") return toggleSqueeze(actor, item);
  return "";
}

async function togglePhase(actor, item) {
  const on = !actor.getFlag?.("faserip", "phasing");
  if (on) await actor.setFlag("faserip", "phasing", true);
  else await actor.unsetFlag("faserip", "phasing");
  await syncPhaseMove(actor);
  await syncAlpha(actor);
  return on ? `${item.name} is on. ${who(actor)} can walk through walls.` : `${item.name} is off.`;
}

export async function setDensityMode(actor, mode, rankId = "") {
  if (!actor) return;
  if (mode) {
    await actor.setFlag("faserip", "density", mode);
    if (rankId) await actor.setFlag("faserip", "densityRank", rankId);
  } else {
    await actor.unsetFlag("faserip", "density");
    await actor.unsetFlag("faserip", "densityRank");
  }
  await syncPhaseMove(actor);
  await syncAlpha(actor);
}

async function cycleDensity(actor, item) {
  const order = ["", "solid", "diffuse"];
  const current = actor.getFlag?.("faserip", "density") || "";
  const next = order[(order.indexOf(current) + 1) % order.length];
  await setDensityMode(actor, next, item?.system?.rank || "typical");
  if (next === "solid") return `${item.name}: solid. ${who(actor)} is tougher and slower. Slams shove a shorter distance.`;
  if (next === "diffuse") return `${item.name}: diffuse. ${who(actor)} can walk through walls and is easier to slam.`;
  return `${item.name} is off. Density is normal.`;
}

async function toggleBlend(actor, item) {
  const on = !actor.getFlag?.("faserip", "blending");
  if (!activeDocs(actor).length) {
    globalThis.ui?.notifications?.warn(`${who(actor)} needs a token on the map.`);
    return "";
  }
  if (on) await actor.setFlag("faserip", "blending", true);
  else await actor.unsetFlag("faserip", "blending");
  await syncAlpha(actor);
  return on ? `${item.name} is on. ${who(actor)} fades until they move.` : `${item.name} is off.`;
}

function textureSrc(doc) {
  return doc?.texture?.src || "";
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
      console.warn("FASERIP | image", err);
      finish("");
    }
  });
}

async function targetImage(actor) {
  const target = combatTarget(actor?.id || "");
  const token = (target?.getActiveTokens?.() ?? []).find((entry) => entry.isTargeted || entry.targeted) || target?.getActiveTokens?.()?.[0];
  return textureSrc(token?.document);
}

async function toggleFace(actor, item, kind) {
  const docs = activeDocs(actor);
  if (!docs.length) {
    globalThis.ui?.notifications?.warn(`${who(actor)} needs a token on the map.`);
    return "";
  }
  const showing = docs.some((doc) => doc.getFlag?.("faserip", "face")?.kind === kind);
  if (showing) {
    for (const doc of docs) {
      const saved = doc.getFlag?.("faserip", "face");
      if (saved?.kind !== kind || !saved.src) continue;
      try {
        await doc.update({ "texture.src": saved.src });
        await doc.unsetFlag("faserip", "face");
      } catch (err) {
        console.warn("FASERIP | face", err);
      }
    }
    return `${item.name} is off. ${who(actor)} looks like themself again.`;
  }
  let next = "";
  if (kind === "imitation") next = await targetImage(actor);
  if (kind === "alter") {
    next = actor.getFlag?.("faserip", "alterFace")?.src || "";
    if (!next) {
      next = await pickImage(textureSrc(docs[0]));
      if (next) await actor.setFlag("faserip", "alterFace", { src: next });
    }
  }
  if (!next && kind !== "alter") next = await pickImage(textureSrc(docs[0]));
  if (!next) return "";
  for (const doc of docs) {
    const saved = doc.getFlag?.("faserip", "face");
    const original = saved?.src || textureSrc(doc);
    try {
      await doc.update({ "texture.src": next });
      await doc.setFlag("faserip", "face", { kind, src: original });
    } catch (err) {
      console.warn("FASERIP | face", err);
    }
  }
  return `${item.name} is on. ${who(actor)} wears another look.`;
}

async function toggleRaise(actor, item) {
  const saved = actor.getFlag?.("faserip", "raisedAbility");
  if (saved?.key) {
    try {
      await actor.update({
        [`system.abilities.${saved.key}.rank`]: saved.rank,
        [`system.abilities.${saved.key}.number`]: saved.number ?? 0
      });
      await actor.unsetFlag("faserip", "raisedAbility");
    } catch (err) {
      console.warn("FASERIP | raise", err);
      return "";
    }
    const ability = saved.key.charAt(0).toUpperCase() + saved.key.slice(1);
    return `${item.name} is off. ${ability} returns to ${rankLabel(saved.rank)}.`;
  }
  const powerRank = item?.system?.rank || "typical";
  let key = ABILITIES[0];
  let lowest = rankIndex(actor.getAbilityRank?.(key));
  for (const ability of ABILITIES) {
    const index = rankIndex(actor.getAbilityRank?.(ability));
    if (index >= 0 && (lowest < 0 || index < lowest)) {
      lowest = index;
      key = ability;
    }
  }
  if (rankIndex(powerRank) < 0 || lowest >= rankIndex(powerRank)) {
    return `${who(actor)}'s lowest ability is already at ${rankLabel(powerRank)} or higher.`;
  }
  const slot = actor.system?.abilities?.[key] || {};
  try {
    await actor.setFlag("faserip", "raisedAbility", { key, rank: slot.rank || "typical", number: slot.number ?? 0 });
    await actor.update({
      [`system.abilities.${key}.rank`]: powerRank,
      [`system.abilities.${key}.number`]: rankValue(powerRank)
    });
  } catch (err) {
    console.warn("FASERIP | raise", err);
    return "";
  }
  const ability = key.charAt(0).toUpperCase() + key.slice(1);
  return `${item.name} raises ${ability} to ${rankLabel(powerRank)}.`;
}

function squaresApart(doc, other) {
  const grid = gridSize();
  const ax = doc.x + (doc.width * grid) / 2;
  const ay = doc.y + (doc.height * grid) / 2;
  const bx = other.x + (other.width * grid) / 2;
  const by = other.y + (other.height * grid) / 2;
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by)) / grid;
}

async function chooseAbsorbed(powers) {
  if (powers.length <= 1) return powers[0] || null;
  const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) return powers[0];
  const options = powers.map((power) => `<option value="${power.id}">${esc(power.name)}</option>`).join("");
  const form = await DialogV2.wait({
    window: { title: "Power Absorption" },
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

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

async function absorbResist(target, rankId, label) {
  const { rollFeat } = await import("./dice/universal-table.mjs");
  const message = await rollFeat({
    actor: target,
    rankId: target.getAbilityRank?.("psyche") || "typical",
    intensityId: rankId,
    label: `Resist ${label}`,
    skipCondition: true
  });
  if (!message) return false;
  return !!(message.getFlag?.("faserip", "intensityPass") ?? message.flags?.faserip?.intensityPass);
}

async function toggleAbsorb(actor, item) {
  const existing = actor.getFlag?.("faserip", "absorbedPower");
  if (existing) {
    const held = actor.items?.get?.(existing);
    try {
      if (held) await held.delete();
      await actor.unsetFlag("faserip", "absorbedPower");
    } catch (err) {
      console.warn("FASERIP | absorb", err);
      return "";
    }
    return `${item.name} is off. The copied power is gone.`;
  }
  const target = combatTarget(actor.id);
  if (!target) {
    globalThis.ui?.notifications?.warn("Target someone you can touch.");
    return "";
  }
  const from = activeDocs(actor)[0];
  const to = (target.getActiveTokens?.() ?? [])[0]?.document;
  if (!from || !to) {
    globalThis.ui?.notifications?.warn("Both tokens need to be on the map.");
    return "";
  }
  const limit = Math.max(1, reachSquares(actor));
  if (squaresApart(from, to) > limit + 0.25) {
    globalThis.ui?.notifications?.warn(`${target.name} is out of reach.`);
    return "";
  }
  const powers = [...(target.items ?? [])].filter((power) => power.type === "power" && !power.getFlag?.("faserip", "absorbed"));
  if (!powers.length) {
    globalThis.ui?.notifications?.warn(`${target.name} has no power to copy.`);
    return "";
  }
  const picked = await chooseAbsorbed(powers);
  if (!picked) return "";
  const held = await absorbResist(target, item?.system?.rank || "typical", item?.name || "Power Absorption");
  if (held) return `${target.name} holds onto ${picked.name}.`;
  const system = typeof picked.system?.toObject === "function" ? picked.system.toObject() : { rank: picked.system?.rank || "typical" };
  system.notes = "A copied power. It lasts until Power Absorption is used again.";
  try {
    const [created] = await actor.createEmbeddedDocuments("Item", [{
      name: picked.name,
      type: "power",
      img: picked.img,
      system,
      flags: { faserip: { absorbed: true, from: target.uuid } }
    }]);
    if (created?.id) await actor.setFlag("faserip", "absorbedPower", created.id);
  } catch (err) {
    console.warn("FASERIP | absorb", err);
    return "";
  }
  return `${who(actor)} copies ${picked.name} from ${target.name}.`;
}

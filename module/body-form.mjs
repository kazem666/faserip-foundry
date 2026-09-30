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
  return "";
}

export function bodyUseTitle(name) {
  const kind = bodyFormKind(name);
  if (kind === "growth") return "Use toggles a larger token. Use again to return to normal size. Shift-click to set Karma or Intensity.";
  if (kind === "shrink") return "Use toggles a smaller token. Use again to return to normal size. Shift-click to set Karma or Intensity.";
  if (kind === "invisible") return "Use toggles unseen. An attack reveals the hero. Shift-click to set Karma or Intensity.";
  return "";
}

export function stretchPowerTitle(name) {
  if (!STRETCH_NAME.test(powerKey(name))) return "";
  return "Melee reach follows this rank. Slugfest, grabs, and other close attacks stretch the token toward the target, then it snaps back.";
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
  return !turningOff;
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

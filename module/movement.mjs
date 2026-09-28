import { MOVEMENT_AREAS, THROW_RANGE } from "./config.mjs";

export const DEFAULT_FEET_PER_AREA = 20;

const MODE_RULES = [
  { action: "walk", re: /lightning speed|hyper-speed|hyper-running|hyper speed/ },
  { action: "fly", re: /\bflight\b|gliding|levitation/ },
  { action: "swim", re: /\bswimming\b/ },
  { action: "climb", re: /climbing|wall-crawling|wall crawling/ },
  { action: "jump", re: /leaping|hyper-leaping/ },
  { action: "burrow", re: /\bdigging\b/ },
  { action: "blink", re: /teleport/ }
];

const MODE_LABELS = {
  fly: "Fly",
  swim: "Swim",
  climb: "Climb",
  jump: "Leap",
  burrow: "Dig",
  blink: "Teleport"
};

export function feetPerArea() {
  try {
    const n = Number(globalThis.game?.settings?.get("faserip", "feetPerArea"));
    if (n >= 5) return n;
  } catch {
    /* setting is not registered yet */
  }
  return DEFAULT_FEET_PER_AREA;
}

export function gridFeet() {
  const n = Number(globalThis.canvas?.scene?.grid?.distance);
  return n > 0 ? n : 5;
}

export function areasToFeet(areas) {
  return Number(areas || 0) * feetPerArea();
}

export function feetToAreas(feet) {
  const per = feetPerArea();
  return per > 0 ? Number(feet || 0) / per : 0;
}

export function squaresPerArea() {
  const grid = gridFeet();
  return grid > 0 ? feetPerArea() / grid : 4;
}

export function formatAreaCount(areas) {
  const n = Number(areas);
  if (!Number.isFinite(n)) return "";
  const quarter = Math.round(n * 4) / 4;
  const shown = Math.abs(n - quarter) < 0.02 ? quarter : Math.round(n * 10) / 10;
  if (shown === 0.25) return "1/4 area";
  if (shown === 0.5) return "1/2 area";
  if (shown === 0.75) return "3/4 area";
  if (shown === 1.25) return "1 1/4 areas";
  if (shown === 1.5) return "1 1/2 areas";
  if (shown === 1.75) return "1 3/4 areas";
  return `${shown} ${Math.abs(shown) === 1 ? "area" : "areas"}`;
}

export function formatMovement(areas) {
  const feet = Math.round(areasToFeet(areas));
  const squares = gridFeet() > 0 ? areasToFeet(areas) / gridFeet() : 0;
  const sqWhole = Math.abs(squares - Math.round(squares)) < 0.05;
  const sq = sqWhole ? Math.round(squares) : Math.round(squares * 10) / 10;
  return `${formatAreaCount(areas)} · ${feet} ft · ${sq} squares`;
}

function areasForRank(rankId) {
  return MOVEMENT_AREAS[rankId] ?? MOVEMENT_AREAS.typical ?? 2;
}

export function movementModes(actor) {
  const ground = typeof actor?.getAbilityRank === "function"
    ? areasForRank(actor.getAbilityRank("endurance"))
    : areasForRank("typical");
  const modes = { walk: ground };
  for (const item of actor?.items ?? []) {
    if (item?.type !== "power") continue;
    const name = String(item.name || "").toLowerCase();
    const areas = areasForRank(item.system?.rank || "typical");
    for (const rule of MODE_RULES) {
      if (!rule.re.test(name)) continue;
      modes[rule.action] = Math.max(modes[rule.action] || 0, areas);
    }
  }
  return modes;
}

export function movementBudgetFeet(actor, action = "walk") {
  const modes = movementModes(actor);
  const areas = action && modes[action] != null ? modes[action] : modes.walk;
  return areasToFeet(areas || 0);
}

export function movementLines(actor) {
  const modes = movementModes(actor);
  const extra = [];
  for (const [action, areas] of Object.entries(modes)) {
    if (action === "walk" || !MODE_LABELS[action] || !(areas > 0)) continue;
    extra.push({ label: MODE_LABELS[action], text: formatMovement(areas) });
  }
  return { walk: formatMovement(modes.walk || 0), extra, feetPerArea: feetPerArea(), squaresPerArea: feetPerArea() / gridFeet() };
}

const MELEE_COLUMNS = new Set(["blunt", "edged", "grappling", "grabbing"]);
const RANGED_COLUMNS = new Set(["charging", "shooting", "throwEdged", "throwBlunt", "energy", "force"]);
const THROWN_COLUMNS = new Set(["throwEdged", "throwBlunt"]);
const REACH_POWER = /elongat|plasticity|stretch|prehensile hair/;

export function parseRangeAreas(text) {
  const raw = String(text || "").trim().toLowerCase();
  if (!raw || /touch|melee|beside|adjacent/.test(raw)) return null;
  const areas = raw.match(/(\d+(?:\.\d+)?)\s*areas?/);
  if (areas) return Number(areas[1]);
  const feet = raw.match(/(\d+(?:\.\d+)?)\s*(?:ft|feet|')/);
  if (feet) return Number(feet[1]) / feetPerArea();
  return null;
}

export function reachSquares(actor) {
  let areas = 0;
  for (const item of actor?.items ?? []) {
    if (item?.type !== "power") continue;
    if (!REACH_POWER.test(String(item.name || "").toLowerCase())) continue;
    areas = Math.max(areas, MOVEMENT_AREAS[item.system?.rank] ?? 0);
  }
  if (!(areas > 0)) return 1;
  return Math.max(1, Math.round(areas * squaresPerArea()));
}

export function maxRangeSquares(actor, column, item = null) {
  if (!MELEE_COLUMNS.has(column) && !RANGED_COLUMNS.has(column)) return Infinity;
  const listed = parseRangeAreas(item?.system?.range);
  if (column === "charging") {
    const areas = movementModes(actor).walk || 0;
    return Math.max(1, Math.round(areas * squaresPerArea()));
  }
  if (MELEE_COLUMNS.has(column)) {
    const beside = reachSquares(actor);
    if (listed == null) return beside;
    return Math.max(beside, Math.round(listed * squaresPerArea()));
  }
  if (THROWN_COLUMNS.has(column)) {
    const strength = typeof actor?.getAbilityRank === "function"
      ? (THROW_RANGE[actor.getAbilityRank("strength")] ?? 1)
      : 1;
    const areas = listed ?? strength;
    return Math.max(1, Math.round(areas * squaresPerArea()));
  }
  if (listed != null) return Math.max(1, Math.round(listed * squaresPerArea()));
  if (item?.type === "power") {
    const areas = THROW_RANGE[item.system?.rank] ?? 2;
    return Math.max(1, Math.round(areas * squaresPerArea()));
  }
  const fallback = column === "shooting" ? 10 : column === "energy" || column === "force" ? 5 : 1;
  return Math.max(1, Math.round(fallback * squaresPerArea()));
}

export function rangePhrase(actor, column, item = null) {
  const max = maxRangeSquares(actor, column, item);
  if (!Number.isFinite(max)) return "";
  if (max <= 1 && MELEE_COLUMNS.has(column) && parseRangeAreas(item?.system?.range) == null && reachSquares(actor) <= 1) {
    return "beside the target";
  }
  const areas = max / squaresPerArea();
  return `${formatAreaCount(areas)} (${max} squares)`;
}

export function gridSeparation(tokenA, tokenB) {
  const a = occupiedOffsets(tokenA);
  const b = occupiedOffsets(tokenB);
  if (!a.length || !b.length) return Infinity;
  let best = Infinity;
  for (const left of a) {
    for (const right of b) {
      const gap = Math.max(Math.abs(left.i - right.i), Math.abs(left.j - right.j));
      if (gap < best) best = gap;
    }
  }
  return best;
}

function occupiedOffsets(token) {
  try {
    const offsets = token?.document?.getOccupiedGridSpaceOffsets?.();
    const list = offsets ? (Array.isArray(offsets) ? offsets : [...offsets]) : [];
    const usable = list.filter((entry) => Number.isFinite(entry?.i) && Number.isFinite(entry?.j));
    if (usable.length) return usable;
  } catch {
    /* grid not ready */
  }
  const doc = token?.document;
  const grid = globalThis.canvas?.grid;
  if (!doc || typeof grid?.getOffset !== "function") return [];
  try {
    const point = grid.getOffset({
      x: doc.x + ((doc.width || 1) * (grid.size || 0)) / 2,
      y: doc.y + ((doc.height || 1) * (grid.size || 0)) / 2
    });
    if (Number.isFinite(point?.i) && Number.isFinite(point?.j)) return [point];
  } catch {
    /* point is off the grid */
  }
  return [];
}

function sceneToken(actor, { targeted = false, controlled = false } = {}) {
  const tokens = globalThis.canvas?.tokens?.placeables ?? [];
  const matches = tokens.filter((token) => token.actor === actor || token.actor?.uuid === actor?.uuid);
  if (controlled) return matches.find((token) => token.controlled) || matches[0] || null;
  if (targeted) return matches.find((token) => token.isTargeted || token.targeted) || matches[0] || null;
  return matches[0] || null;
}

export function attackOutOfRange(actor, target, column, item = null) {
  if (!actor || !target || !column) return "";
  const max = maxRangeSquares(actor, column, item);
  if (!Number.isFinite(max)) return "";
  const from = sceneToken(actor, { controlled: true });
  const to = sceneToken(target, { targeted: true });
  if (!from || !to) return "";
  const gap = gridSeparation(from, to);
  if (!Number.isFinite(gap) || !(gap > max)) return "";
  const reach = max <= 1 ? "someone beside you" : rangePhrase(actor, column, item);
  return `${target.name} is ${gap} squares away. This attack reaches ${reach}.`;
}

function appendAreas(label, feet) {
  const n = Number(feet);
  if (!Number.isFinite(n)) return label || "";
  const areas = formatAreaCount(feetToAreas(n));
  return label ? `${label} · ${areas}` : areas;
}

export function registerMovement() {
  globalThis.game?.settings?.register("faserip", "feetPerArea", {
    name: "Feet in one area",
    hint: "FASERIP movement is in areas. One area is a room, about 20 feet across: 4 squares on a 5-foot grid. The grid stays 5 feet per square. Use 50 for a longer outdoor area (10 squares).",
    scope: "world",
    config: true,
    type: Number,
    default: DEFAULT_FEET_PER_AREA,
    range: { min: 5, max: 200, step: 5 },
    restricted: true
  });
  installMovementActions();
  installRulers();
}

function installMovementActions() {
  const actions = globalThis.CONFIG?.Token?.movement?.actions;
  if (!actions) return;
  for (const [id, action] of Object.entries(actions)) {
    if (!action || action.teleport || id === "displace" || action._faseripCost) continue;
    action.getCostFunction = () => (first, _from, _to, distance) => {
      const per = feetPerArea();
      const measured = Number.isFinite(Number(distance)) ? Number(distance) : Number(first);
      return per > 0 && Number.isFinite(measured) ? measured / per : measured;
    };
    action._faseripCost = true;
  }
  for (const id of ["fly", "swim", "climb", "jump", "burrow", "blink"]) {
    const action = actions[id];
    if (!action || action._faseripWrapped) continue;
    const previous = action.canSelect;
    action.canSelect = (token) => {
      if (!movementModes(token?.actor)?.[id]) return false;
      if (typeof previous === "function") return previous(token);
      return previous !== false;
    };
    if (id === "climb" || id === "swim" || id === "jump") action.costMultiplier = 1;
    action._faseripWrapped = true;
  }
}

function installRulers() {
  const BaseRuler = globalThis.foundry?.canvas?.interaction?.Ruler;
  if (typeof BaseRuler === "function" && globalThis.CONFIG?.Canvas) {
    class FaseripRuler extends BaseRuler {
      _getSegmentLabel(segment, totalDistance) {
        let label = "";
        try {
          label = super._getSegmentLabel(segment, totalDistance);
        } catch {
          try { label = super._getSegmentLabel(segment); } catch { label = ""; }
        }
        return appendAreas(label, segment?.distance);
      }
    }
    CONFIG.Canvas.rulerClass = FaseripRuler;
  }

  const BaseTokenRuler = globalThis.foundry?.canvas?.placeables?.tokens?.TokenRuler
    ?? globalThis.CONFIG?.Token?.rulerClass;
  if (typeof BaseTokenRuler !== "function" || !globalThis.CONFIG?.Token) return;
  class FaseripTokenRuler extends BaseTokenRuler {
    _getWaypointLabelContext(waypoint, state) {
      const context = super._getWaypointLabelContext(waypoint, state);
      if (!context) return context;
      const measured = Number(waypoint?.measurement?.distance);
      if (!Number.isFinite(measured)) return context;
      const areas = formatAreaCount(feetToAreas(measured));
      if (context.cost) {
        context.cost.total = areas;
        context.cost.units = "";
        context.cost.delta = "";
      }
      if (context.distance) context.distance.total = areas;
      context.units = "";
      return context;
    }

    _getSegmentStyle(waypoint) {
      const style = super._getSegmentStyle(waypoint) || {};
      if (pastBudget(this.token, waypoint)) style.color = 0xb91c1c;
      return style;
    }

    _getGridHighlightStyle(waypoint, offset) {
      const style = super._getGridHighlightStyle(waypoint, offset) || {};
      if (pastBudget(this.token, waypoint)) style.color = 0xb91c1c;
      return style;
    }
  }
  CONFIG.Token.rulerClass = FaseripTokenRuler;
}

function pastBudget(token, waypoint) {
  const feet = Number(waypoint?.measurement?.distance ?? waypoint?.distance ?? 0);
  const action = waypoint?.action || token?.document?.movementAction || "walk";
  const budget = movementBudgetFeet(token?.actor, action);
  return budget > 0 && feet > budget + 0.5;
}

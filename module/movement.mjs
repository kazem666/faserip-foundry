import { MOVEMENT_AREAS } from "./config.mjs";

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

export function formatAreaCount(areas) {
  const n = Number(areas);
  if (!Number.isFinite(n)) return "";
  const whole = Math.abs(n - Math.round(n)) < 0.05;
  const shown = whole ? Math.round(n) : Math.round(n * 10) / 10;
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
      const feet = Number(context.distance ?? waypoint?.measurement?.distance);
      if (!Number.isFinite(feet)) return context;
      const areas = formatAreaCount(feetToAreas(feet));
      context.units = context.units ? `${context.units} · ${areas}` : areas;
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

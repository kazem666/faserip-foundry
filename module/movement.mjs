import { MOVEMENT_AREAS, TELEPORT_AREAS, THROW_RANGE } from "./config.mjs";

export const DEFAULT_FEET_PER_AREA = 20;

const MODE_RULES = [
  { action: "walk", re: /lightning speed|hyper-speed|hyper-running|hyper speed/ },
  { action: "fly", re: /\bflight\b|gliding|levitation/ },
  { action: "swim", re: /\bswimming\b/ },
  { action: "climb", re: /climbing|wall-crawling|wall crawling/ },
  { action: "jump", re: /leaping|hyper-leaping/ },
  { action: "burrow", re: /\bdigging\b/ },
  { action: "blink", re: /teleport|telereform|gateway|dimensional gate|dimensional aperture/ }
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
  const sign = n < -0.001 ? "-" : "";
  const quarters = Math.round(Math.abs(n) * 4);
  const whole = Math.floor(quarters / 4);
  const rem = quarters % 4;
  const frac = ["", "1/4", "2/4", "3/4"][rem];
  if (whole === 0 && rem === 0) return "0 areas";
  if (whole === 0) return `${sign}${frac} area`;
  if (rem === 0) return `${sign}${whole} ${whole === 1 ? "area" : "areas"}`;
  return `${sign}${whole} ${frac} areas`;
}

export function formatMovement(areas) {
  if (areas === Infinity) return "anywhere on this scene";
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
      if (rule.action === "blink") {
        if (/matter teleport/.test(name)) continue;
        const reach = TELEPORT_AREAS[item.system?.rank] ?? TELEPORT_AREAS.typical;
        const budget = Number.isFinite(reach) ? reach : Infinity;
        modes.blink = Math.max(modes.blink || 0, budget);
        continue;
      }
      modes[rule.action] = Math.max(modes[rule.action] || 0, areas);
    }
  }
  const tempo = actor?.getFlag?.("faserip", "tempo") || "";
  const scale = tempo === "slow" ? 0.5 : tempo === "fast" ? 2 : tempo === "stop" ? 0.25 : 1;
  const heavy = actor?.getFlag?.("faserip", "density") === "solid" ? 0.5 : 1;
  const combined = scale * heavy;
  if (combined !== 1) {
    for (const key of Object.keys(modes)) {
      if (Number.isFinite(modes[key])) modes[key] = Math.max(0, modes[key] * combined);
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

function cellKey(offset) {
  return `${offset.i},${offset.j}`;
}

function cellGap(left, right) {
  let best = Infinity;
  for (const a of left) {
    for (const b of right) {
      best = Math.min(best, Math.max(Math.abs(a.i - b.i), Math.abs(a.j - b.j)));
    }
  }
  return best;
}

function anchorOffset(cells) {
  return cells.reduce((best, cell) => ({
    i: Math.min(best.i, cell.i),
    j: Math.min(best.j, cell.j)
  }), { i: Infinity, j: Infinity });
}

function neighborCells(cells) {
  const inside = new Set(cells.map(cellKey));
  const found = [];
  const seen = new Set();
  for (const cell of cells) {
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        if (!di && !dj) continue;
        const next = { i: cell.i + di, j: cell.j + dj };
        const key = cellKey(next);
        if (inside.has(key) || seen.has(key)) continue;
        seen.add(key);
        found.push(next);
      }
    }
  }
  return found;
}

export function chargeStop(attackerCells, targetCells, blocked = []) {
  if (!attackerCells?.length || !targetCells?.length) return null;
  const origin = anchorOffset(attackerCells);
  if (cellGap(attackerCells, targetCells) <= 1) return { i: origin.i, j: origin.j, squares: 0 };
  const footprint = attackerCells.map((cell) => ({ di: cell.i - origin.i, dj: cell.j - origin.j }));
  const targetSet = new Set(targetCells.map(cellKey));
  const blockedSet = new Set(blocked.map(cellKey));
  let best = null;
  for (const neighbor of neighborCells(targetCells)) {
    for (const part of footprint) {
      const dest = { i: neighbor.i - part.di, j: neighbor.j - part.dj };
      const placed = footprint.map((piece) => ({ i: dest.i + piece.di, j: dest.j + piece.dj }));
      if (placed.some((cell) => targetSet.has(cellKey(cell)) || blockedSet.has(cellKey(cell)))) continue;
      if (cellGap(placed, targetCells) > 1) continue;
      const squares = Math.max(Math.abs(dest.i - origin.i), Math.abs(dest.j - origin.j));
      const manhattan = Math.abs(dest.i - origin.i) + Math.abs(dest.j - origin.j);
      if (!best || squares < best.squares || (squares === best.squares && manhattan < best.manhattan)) {
        best = { i: dest.i, j: dest.j, squares, manhattan };
      }
    }
  }
  return best;
}

const OCTANTS = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];

export function facingStep(di, dj, facing = "back") {
  const turns = { back: 0, backLeft: 1, backRight: -1, left: 2, right: -2 }[facing];
  if (turns == null) return null;
  const exact = OCTANTS.findIndex((dir) => dir[0] === di && dir[1] === dj);
  let best = exact;
  if (best < 0) {
    let score = -Infinity;
    OCTANTS.forEach((dir, index) => {
      const dot = dir[0] * di + dir[1] * dj;
      if (dot > score) {
        score = dot;
        best = index;
      }
    });
  }
  const next = OCTANTS[(best + ((turns % 8) + 8)) % 8];
  return { di: next[0], dj: next[1] };
}

export function knockbackLanding(targetCells, attackerCells, squares, blocked = [], facing = "back") {
  const steps = Math.max(0, Math.floor(Number(squares) || 0));
  if (!targetCells?.length || steps <= 0) return null;
  const origin = anchorOffset(targetCells);
  const from = attackerCells?.length ? anchorOffset(attackerCells) : null;
  let di = 0;
  let dj = 1;
  if (from) {
    const rawI = origin.i - from.i;
    const rawJ = origin.j - from.j;
    if (rawI || rawJ) {
      di = Math.sign(rawI);
      dj = Math.sign(rawJ);
    }
  }
  if (facing === "up" || facing === "down") {
    return { i: origin.i, j: origin.j, squares: 0, stopped: false, vertical: facing };
  }
  const turned = facingStep(di, dj, facing);
  if (turned) {
    di = turned.di;
    dj = turned.dj;
  }
  const footprint = targetCells.map((cell) => ({ di: cell.i - origin.i, dj: cell.j - origin.j }));
  const blockedSet = new Set(blocked.map(cellKey));
  let landed = null;
  for (let step = 1; step <= steps; step++) {
    const dest = { i: origin.i + di * step, j: origin.j + dj * step };
    const placed = footprint.map((piece) => ({ i: dest.i + piece.di, j: dest.j + piece.dj }));
    if (placed.some((cell) => blockedSet.has(cellKey(cell)))) {
      return landed
        ? { ...landed, stopped: true }
        : { i: origin.i, j: origin.j, squares: 0, stopped: true };
    }
    landed = { i: dest.i, j: dest.j, squares: step, stopped: false };
  }
  return landed;
}

export async function shoveActor(actor, awayFrom, squares, facing = "back") {
  const token = sceneToken(actor);
  const fromToken = awayFrom ? sceneToken(awayFrom) : null;
  if (!token) return { moved: false, squares: 0, stopped: false };
  const landing = knockbackLanding(
    occupiedOffsets(token),
    fromToken ? occupiedOffsets(fromToken) : [],
    squares,
    occupiedByOthers(token, fromToken),
    facing
  );
  if (landing?.vertical) return { moved: false, squares: 0, stopped: false, vertical: landing.vertical };
  if (!landing || landing.squares <= 0) return { moved: false, squares: 0, stopped: !!landing?.stopped };
  const point = gridTopLeft(landing);
  if (!point) return { moved: false, squares: landing.squares, stopped: landing.stopped };
  const moved = await slideToken(token, point.x, point.y);
  return { moved, squares: landing.squares, stopped: landing.stopped };
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

function occupiedByOthers(attacker, target) {
  const tokens = globalThis.canvas?.tokens?.placeables ?? [];
  const cells = [];
  for (const token of tokens) {
    if (token === attacker || token === target) continue;
    cells.push(...occupiedOffsets(token));
  }
  return cells;
}

function gridTopLeft(offset) {
  const grid = globalThis.canvas?.grid;
  if (typeof grid?.getTopLeftPoint !== "function") return null;
  try {
    return grid.getTopLeftPoint(offset);
  } catch {
    return null;
  }
}

async function slideToken(token, x, y) {
  const doc = token?.document;
  if (!doc) return false;
  if (Math.abs(Number(doc.x) - x) < 1 && Math.abs(Number(doc.y) - y) < 1) return true;
  const waypoint = { x, y, action: "walk", snapped: true, explicit: true };
  if (typeof doc.move === "function") {
    try {
      const moved = await doc.move([waypoint], { showRuler: true, autoRotate: true });
      return moved !== false;
    } catch (err) {
      console.warn("FASERIP | charge move", err);
    }
  }
  try {
    await doc.update({ x, y });
    return true;
  } catch (err) {
    console.warn("FASERIP | charge update", err);
    return false;
  }
}

export async function closeCharge(actor, target) {
  const from = sceneToken(actor, { controlled: true });
  const to = sceneToken(target, { targeted: true });
  if (!from || !to) {
    ui.notifications?.warn("Charging needs both tokens on the map.");
    return false;
  }
  const max = maxRangeSquares(actor, "charging");
  const gap = gridSeparation(from, to);
  if (!Number.isFinite(gap)) {
    ui.notifications?.warn("Could not measure the charge on the grid.");
    return false;
  }
  if (gap > max) {
    ui.notifications?.warn(`${target.name} is ${gap} squares away. Charging reaches ${rangePhrase(actor, "charging")}.`);
    return false;
  }
  const stop = chargeStop(occupiedOffsets(from), occupiedOffsets(to), occupiedByOthers(from, to));
  if (!stop || stop.squares > max) {
    ui.notifications?.warn(`No open square beside ${target.name} within the charge.`);
    return false;
  }
  if (stop.squares === 0) return true;
  const point = gridTopLeft(stop);
  if (!point) return false;
  const moved = await slideToken(from, point.x, point.y);
  if (!moved) {
    ui.notifications?.warn("Could not move the charging token.");
    return false;
  }
  const after = gridSeparation(from, to);
  if (after > 1) {
    ui.notifications?.warn("The charge stopped before it reached the target.");
    return false;
  }
  return true;
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
  if (actions.burrow && !Object.isFrozen(actions)) actions.burrow.walls = null;
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

const MOVE_AREA_COLORS = [
  0x3b82f6,
  0xf5c518,
  0xef4444,
  0x22c55e,
  0xf97316,
  0xa78bfa,
  0x22d3ee,
  0xf472b6
];

function areaNumber(feet) {
  const per = feetPerArea();
  const n = Number(feet);
  if (!(per > 0) || !(n > 0)) return 1;
  return Math.max(1, Math.ceil(n / per - 1e-6));
}

function areaColor(feet) {
  return MOVE_AREA_COLORS[(areaNumber(feet) - 1) % MOVE_AREA_COLORS.length];
}

function rulerDistanceLabel(feet) {
  const n = Number(feet);
  if (!Number.isFinite(n) || !(n > 0)) return "";
  return `${formatAreaCount(feetToAreas(n))} · ${Math.round(n)} ft`;
}

function highlightGrid() {
  return globalThis.canvas?.interface?.grid || null;
}

function moveHighlightName(token) {
  const id = token?.document?.id || token?.id;
  return id ? `faserip-move-${id}` : "";
}

function clearMoveHighlight(token, destroy = false) {
  const grid = highlightGrid();
  const name = moveHighlightName(token);
  if (!grid || !name) return;
  try {
    if (destroy && typeof grid.destroyHighlightLayer === "function") grid.destroyHighlightLayer(name);
    else grid.clearHighlightLayer?.(name);
  } catch {
    /* the layer is already gone */
  }
}

function pushCenter(centers, point) {
  if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return;
  const last = centers[centers.length - 1];
  if (last && Math.hypot(last.x - point.x, last.y - point.y) < 1) return;
  centers.push({ x: point.x, y: point.y });
}

function collectMoveCenters(token, options) {
  const centers = [];
  if (token?.center) pushCenter(centers, token.center);
  const lists = [options?.passedWaypoints, options?.pendingWaypoints];
  const planned = options?.plannedMovement;
  if (Array.isArray(planned)) lists.push(planned);
  else if (planned && typeof planned === "object") {
    for (const value of Object.values(planned)) {
      if (Array.isArray(value)) lists.push(value);
    }
  }
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const waypoint of list) pushCenter(centers, waypoint?.center || waypoint);
  }
  return centers;
}

function expandMoveCenters(centers) {
  const grid = globalThis.canvas?.grid;
  if (!grid?.getDirectPath || !grid?.getOffset || !grid?.getCenterPoint || centers.length < 2) return centers;
  const expanded = [];
  for (let i = 0; i < centers.length - 1; i++) {
    let piece = [];
    try {
      const offsets = grid.getDirectPath([grid.getOffset(centers[i]), grid.getOffset(centers[i + 1])]);
      piece = (offsets || []).map((offset) => {
        const point = grid.getCenterPoint(offset);
        return { x: point.x, y: point.y, offset };
      });
    } catch {
      piece = [];
    }
    if (piece.length < 2) {
      if (!expanded.length) expanded.push(centers[i]);
      expanded.push(centers[i + 1]);
      continue;
    }
    if (expanded.length) piece = piece.slice(1);
    expanded.push(...piece);
  }
  return expanded;
}

function feetAlong(points) {
  const grid = globalThis.canvas?.grid;
  const fallback = points.map((_point, index) => index * gridFeet());
  if (!grid?.measurePath || points.length < 2) return fallback;
  try {
    const result = grid.measurePath(points.map((point) => ({ x: point.x, y: point.y })));
    const measured = (result?.waypoints || []).map((waypoint) => Number(waypoint?.distance));
    if (measured.length === points.length && measured.every((feet) => Number.isFinite(feet))) return measured;
  } catch {
    /* use one square at a time */
  }
  return fallback;
}

function planMovementBands(token, options) {
  const centers = expandMoveCenters(collectMoveCenters(token, options));
  if (centers.length < 2) return [];
  const feet = feetAlong(centers);
  const budget = movementBudgetFeet(token?.actor, options?.pendingWaypoints?.at?.(-1)?.action || token?.document?.movementAction || "walk");
  const runs = [];
  for (let i = 1; i < centers.length; i++) {
    const here = Number(feet[i]) || 0;
    const color = areaColor(here);
    const over = budget > 0 && here > budget + 0.5;
    const last = runs[runs.length - 1];
    if (!last || last.color !== color || last.over !== over) {
      runs.push({ color, over, points: [centers[i - 1], centers[i]], cells: [centers[i]] });
    } else {
      last.points.push(centers[i]);
      last.cells.push(centers[i]);
    }
  }
  return runs;
}

function drawMovementBands(token, runs) {
  const grid = highlightGrid();
  const board = globalThis.canvas?.grid;
  const name = moveHighlightName(token);
  if (!grid?.addHighlightLayer || !grid?.highlightPosition || !name) return false;
  if (!runs.length) {
    clearMoveHighlight(token);
    return false;
  }
  try {
    grid.addHighlightLayer(name);
    grid.clearHighlightLayer(name);
  } catch {
    return false;
  }
  for (const run of runs) {
    for (const cell of run.cells) {
      let point = cell;
      try {
        const offset = cell.offset || board?.getOffset?.(cell);
        const top = offset && board?.getTopLeftPoint?.(offset);
        if (top) point = top;
      } catch {
        point = cell;
      }
      try {
        grid.highlightPosition(name, {
          x: point.x,
          y: point.y,
          color: run.color,
          alpha: run.over ? 0.28 : 0.5,
          border: run.over ? 0xf8fafc : null
        });
      } catch {
        /* skip a cell the grid cannot highlight */
      }
    }
  }
  return true;
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
      const areas = rulerDistanceLabel(measured);
      if (!areas) return context;
      if (context.cost) {
        context.cost.total = areas;
        context.cost.units = "";
        context.cost.delta = "";
      }
      if (context.distance) {
        context.distance.total = areas;
        context.distance.units = "";
        if ("delta" in context.distance) context.distance.delta = "";
      }
      context.units = "";
      return context;
    }

    _getSegmentStyle(waypoint) {
      const style = super._getSegmentStyle(waypoint) || {};
      const feet = Number(waypoint?.measurement?.distance);
      if (this._faseripHideDefault) {
        style.width = 0;
        return style;
      }
      style.color = areaColor(feet);
      style.alpha = pastBudget(this.token, waypoint) ? 0.4 : 0.95;
      return style;
    }

    _getGridHighlightStyle(waypoint, offset) {
      const style = super._getGridHighlightStyle(waypoint, offset) || {};
      const feet = Number(waypoint?.measurement?.distance);
      style.color = areaColor(feet);
      style.alpha = pastBudget(this.token, waypoint) ? 0.28 : (style.alpha ?? 0.5);
      return style;
    }

    _getWaypointStyle(waypoint) {
      const style = super._getWaypointStyle(waypoint) || {};
      style.color = areaColor(Number(waypoint?.measurement?.distance));
      return style;
    }

    refresh(options) {
      const runs = planMovementBands(this.token, options);
      this._faseripHideDefault = runs.length > 0;
      const result = super.refresh(options);
      if (drawMovementBands(this.token, runs) || !runs.length) return result;
      this._faseripHideDefault = false;
      return super.refresh(options);
    }

    clear() {
      this._faseripHideDefault = false;
      clearMoveHighlight(this.token, true);
      return super.clear();
    }

    _onVisibleChange() {
      super._onVisibleChange();
      if (!this.visible) {
        this._faseripHideDefault = false;
        clearMoveHighlight(this.token, true);
      }
    }
  }
  CONFIG.Token.rulerClass = FaseripTokenRuler;
}

const TRAVEL_ACTION = { climb: "climb", swim: "swim", dig: "burrow", leap: "jump" };

export function movementPowerKind(name) {
  const key = String(name || "").toLowerCase();
  if (/hyper-leaping|hyper leaping|\bleaping\b/.test(key)) return "leap";
  if (/wall-crawling|wall crawling|\bclimbing\b/.test(key)) return "climb";
  if (/\bswimming\b/.test(key)) return "swim";
  if (/\bdigging\b/.test(key)) return "dig";
  if (/lightning speed|hyper-speed|hyper speed|hyper-running|hyper running/.test(key)) return "sprint";
  return "";
}

export function movementUseTitle(name, rankId = "typical") {
  const kind = movementPowerKind(name);
  if (!kind) return "";
  const areas = formatMovement(areasForRank(rankId));
  if (kind === "leap") return `Click a landing spot within ${areas}. Right-click cancels.`;
  if (kind === "climb") return `Use toggles climbing. The ruler allows ${areas} on walls and ceilings. Shift-click to set Karma or Intensity.`;
  if (kind === "swim") return `Use toggles swimming. The ruler allows ${areas} in water. Shift-click to set Karma or Intensity.`;
  if (kind === "dig") return `Use toggles tunneling. The token can pass through walls at ${areas}. Shift-click to set Karma or Intensity.`;
  return `Use sets movement to a ground sprint. The ruler allows ${areas}. Shift-click to set Karma or Intensity.`;
}

function controlledDoc(actor) {
  const list = actor?.getActiveTokens?.() ?? [];
  const token = list.find((entry) => entry.controlled) || list[0];
  return token?.document || null;
}

function tokenCenter(doc) {
  const grid = Number(globalThis.canvas?.grid?.size) || 100;
  return {
    x: doc.x + (doc.width * grid) / 2,
    y: doc.y + (doc.height * grid) / 2,
    grid
  };
}

export function pickMapPoint(hint) {
  const board = globalThis.canvas?.app?.view || globalThis.document?.getElementById?.("board");
  if (!board) return Promise.resolve(null);
  globalThis.ui?.notifications?.info(hint);
  return new Promise((resolve) => {
    const finish = (point) => {
      board.removeEventListener("pointerdown", onDown, true);
      board.removeEventListener("contextmenu", onMenu, true);
      globalThis.document?.removeEventListener?.("keydown", onKey, true);
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
      const point = globalThis.canvas?.canvasCoordinatesFromClient?.({ x: event.clientX, y: event.clientY });
      finish(point || null);
    };
    board.addEventListener("pointerdown", onDown, true);
    board.addEventListener("contextmenu", onMenu, true);
    globalThis.document?.addEventListener?.("keydown", onKey, true);
  });
}

async function scatterLanding(actor, doc) {
  try {
    const { rollFeat } = await import("./dice/universal-table.mjs");
    const message = await rollFeat({
      actor,
      rankId: actor?.getAbilityRank?.("agility") || "typical",
      label: "Landing",
      skipCondition: true
    });
    const color = message?.flags?.faserip?.color;
    if (color !== "white") return;
    const grid = Number(globalThis.canvas?.grid?.size) || 100;
    const angle = Math.random() * Math.PI * 2;
    await doc.update({
      x: Math.round(doc.x + Math.cos(angle) * grid),
      y: Math.round(doc.y + Math.sin(angle) * grid)
    });
    globalThis.ui?.notifications?.info("The landing scatters one square.");
  } catch (err) {
    console.warn("FASERIP | landing", err);
  }
}

async function leapNow(actor, item) {
  const doc = controlledDoc(actor);
  if (!doc) {
    globalThis.ui?.notifications?.warn(`${actor?.name || "The hero"} needs a token on the map.`);
    return null;
  }
  const rankId = item?.system?.rank || "typical";
  const reach = formatMovement(areasForRank(rankId));
  const point = await pickMapPoint(`${item?.name || "Leaping"}: click a landing spot within ${reach}. Right-click cancels.`);
  if (!point) return null;
  const here = tokenCenter(doc);
  const feet = (Math.hypot(point.x - here.x, point.y - here.y) / here.grid) * gridFeet();
  const budget = areasToFeet(areasForRank(rankId));
  if (feet > budget + 0.5) {
    globalThis.ui?.notifications?.warn(`${item?.name || "Leaping"} reaches ${reach}. That spot is ${formatMovement(feetToAreas(feet))} away.`);
    return null;
  }
  const corner = {
    x: Math.round(point.x - (doc.width * here.grid) / 2),
    y: Math.round(point.y - (doc.height * here.grid) / 2)
  };
  const hop = Math.max(gridFeet(), Math.min(budget / 4, gridFeet() * 4));
  const mid = {
    x: Math.round((doc.x + corner.x) / 2),
    y: Math.round((doc.y + corner.y) / 2),
    elevation: (Number(doc.elevation) || 0) + hop
  };
  try {
    if (typeof doc.move === "function") {
      const moved = await doc.move([
        { ...mid, action: "jump", snapped: false, explicit: true },
        { x: corner.x, y: corner.y, elevation: doc.elevation ?? 0, action: "jump", snapped: false, explicit: true }
      ], { showRuler: false });
      if (moved !== false) {
        await scatterLanding(actor, doc);
        globalThis.ui?.notifications?.info(`${actor?.name || "The hero"} leaps ${formatMovement(feetToAreas(feet))}.`);
        return true;
      }
    }
    await doc.update({ x: corner.x, y: corner.y, movementAction: "jump" });
    await scatterLanding(actor, doc);
    globalThis.ui?.notifications?.info(`${actor?.name || "The hero"} leaps ${formatMovement(feetToAreas(feet))}.`);
    return true;
  } catch (err) {
    console.warn("FASERIP | leap", err);
    globalThis.ui?.notifications?.warn("That leap could not be moved.");
    return null;
  }
}

async function setTravelAction(actor, action) {
  const list = actor?.getActiveTokens?.() ?? [];
  if (!list.length) {
    globalThis.ui?.notifications?.warn(`${actor?.name || "The hero"} needs a token on the map.`);
    return null;
  }
  const turningOff = list.some((token) => (token.document || token).movementAction === action);
  const next = turningOff ? "walk" : action;
  for (const token of list) {
    const doc = token.document || token;
    try { await doc.update({ movementAction: next }); } catch (err) {
      console.warn("FASERIP | travel", err);
    }
  }
  return !turningOff;
}

export async function useMovementPower(actor, item) {
  const kind = movementPowerKind(item?.name);
  if (!actor || !kind) return null;
  if (kind === "leap") return leapNow(actor, item);
  if (kind === "sprint") {
    const on = await setTravelAction(actor, "walk");
    const reach = formatMovement(areasForRank(item?.system?.rank || "typical"));
    if (on === null) return null;
    globalThis.ui?.notifications?.info(`${item.name} is on. Ground speed ${reach}.`);
    return true;
  }
  const action = TRAVEL_ACTION[kind];
  const on = await setTravelAction(actor, action);
  if (on === null) return null;
  const reach = formatMovement(areasForRank(item?.system?.rank || "typical"));
  const label = kind === "climb" ? "climbing" : kind === "swim" ? "swimming" : "tunneling";
  globalThis.ui?.notifications?.info(on ? `${item.name} is on. ${actor.name} is ${label} at ${reach}.` : `${item.name} is off.`);
  return true;
}

function pastBudget(token, waypoint) {
  const feet = Number(waypoint?.measurement?.distance ?? waypoint?.distance ?? 0);
  const action = waypoint?.action || token?.document?.movementAction || "walk";
  const budget = movementBudgetFeet(token?.actor, action);
  return budget > 0 && feet > budget + 0.5;
}

import { RANKS, RANK_BY_ID, rankFromNumber, rankIndex, rankValue, shiftRank } from "./config.mjs";

const YELLOW_KILL = new Set(["edged", "shooting", "throwEdged"]);

export function effectGetsThrough(amount, protection, taken) {
  const raw = Number(amount) || 0;
  const soaked = Math.max(0, Number(protection) || 0);
  if (raw <= 0) return false;
  if ((Number(taken) || 0) > 0) return true;
  return raw === soaked;
}

export function slamSquares(color, strengthRank, perArea) {
  const per = Math.max(1, Number(perArea) || 1);
  if (color === "yellow") return 1;
  if (color === "green") return per;
  if (color === "white") return Math.max(0, rankIndex(strengthRank)) * per;
  return 0;
}

export function killApplies(color, sourceColumn) {
  if (color === "white" || color === "green") return true;
  if (color === "yellow") return YELLOW_KILL.has(sourceColumn);
  return false;
}

export function wakeResult(color) {
  if (color === "red") return "wake";
  if (color === "yellow") return "still";
  return "dying";
}

export function fallRate(floors) {
  let left = Math.max(0, Math.floor(Number(floors) || 0));
  if (left <= 0) return 0;
  for (const rate of [3, 6, 10]) {
    if (left <= rate) return rate;
    left -= rate;
  }
  return 20;
}

export function rankForAreas(areas) {
  const n = Math.max(0, Math.floor(Number(areas) || 0));
  if (n >= 20) return "cl1000";
  if (n > 13) return "shiftz";
  return RANKS[n]?.id || "shift0";
}

export function fallOutcome(floors, surfaceRankId = "excellent") {
  const rate = fallRate(floors);
  const impactId = rankForAreas(rate);
  const surface = surfaceRankId || "excellent";
  const gives = rankIndex(impactId) > rankIndex(surface);
  return {
    rate,
    impactId,
    surface,
    gives,
    damage: gives || rate <= 0 ? 0 : rankValue(impactId)
  };
}

function stepRank(rankId, number) {
  const rank = RANK_BY_ID[rankId] || RANK_BY_ID.typical;
  const current = Number(number) > 0 ? Number(number) : rank.value;
  const bumped = current + 1;
  let nextId = rankFromNumber(bumped);
  let nextNumber = bumped;
  if (nextId === rank.id && bumped > rank.max) {
    nextId = shiftRank(rank.id, 1);
    nextNumber = RANK_BY_ID[nextId].min;
  }
  return { from: current, nextId, nextNumber, crest: nextId !== rank.id };
}

export function abilityAdvance(rankId, number) {
  const step = stepRank(rankId, number);
  return { ...step, cost: step.from * 10 + (step.crest ? 400 : 0) };
}

export function powerAdvance(rankId, number) {
  const step = stepRank(rankId, number);
  return { ...step, cost: step.nextNumber * 20 + (step.crest ? 500 : 0) };
}

export function resourceAdvance(rankId) {
  const current = RANK_BY_ID[rankId] || RANK_BY_ID.typical;
  const nextId = shiftRank(current.id, 1);
  if (nextId === current.id) return null;
  return { cost: current.value * 10 + 200, nextId, fromId: current.id };
}

export function popularityAdvance(value) {
  const current = Math.max(0, Math.floor(Number(value) || 0));
  return { cost: Math.max(10, current * 10), next: current + 1, from: current };
}

export function powerAddCost(rankId) {
  return 3000 + 40 * rankValue(rankId);
}

export function talentCost(taught) {
  return taught ? 1000 : 2000;
}

export function contactCost(resourceRankId) {
  return 500 + 10 * rankValue(resourceRankId);
}

import { rankFromNumber, rankValue, shiftRank } from "./config.mjs";
import { gridSeparation, maxRangeSquares, squaresPerArea } from "./movement.mjs";
import { workflowActive } from "./workflow.mjs";

const RANGED = new Set(["shooting", "throwEdged", "throwBlunt", "energy", "force"]);

export const SITUATIONS = [
  { id: "", label: "Clear" },
  { id: "dark", label: "Darkness" },
  { id: "fog", label: "Fog" },
  { id: "rain", label: "Rain" },
  { id: "heavyRain", label: "Heavy rain" },
  { id: "heat", label: "Heat over 90°F" },
  { id: "cold", label: "Cold" },
  { id: "underwater", label: "Underwater" }
];

export const POPULARITY_PRESETS = [
  { id: "", label: "No preset", value: null },
  { id: "lost", label: "Defeated by a hero (−30)", value: -30 },
  { id: "beatHero", label: "Defeated a hero (+10)", value: 10 },
  { id: "beatVillain", label: "Defeated another villain (+5)", value: 5 },
  { id: "prison", label: "Imprisoned (−5)", value: -5 },
  { id: "challenge", label: "Public challenge (−5)", value: -5 }
];

const EVENTS = [
  "A robbery alarm is close enough to reach before the haul is gone.",
  "A contact sends word. It may be a warning, a lure, or a favor.",
  "A break-in hits somewhere the hero protects. The trail is still warm.",
  "The press runs a hostile story.",
  "A windfall is available. Make a Resources FEAT. On any success, Resources may rise one rank, no higher than Remarkable.",
  "The authorities arrive. Friendly, neutral, or already suspicious.",
  "Something powerful is tearing through the area, and it is not here for the heroes.",
  "The lights go out across the block. Elevators, alarms, and traffic stop."
];

function itemText(actor) {
  return [...(actor?.items ?? [])].map((item) => `${item.name || ""} ${item.system?.definition || ""}`).join(" ");
}

export function hasNightVision(actor) {
  return /night vision|darkness generation|darkforce|infra-?vision|radar sense/i.test(itemText(actor));
}

export function hasWaterPower(actor) {
  return /water breathing|water freedom|\bswimming\b/i.test(itemText(actor));
}

export function currentSituation() {
  let id = "";
  try { id = game.settings.get("faserip", "situation") || ""; } catch { id = ""; }
  return SITUATIONS.find((row) => row.id === id) || SITUATIONS[0];
}

export function situationMods(actor, column = "") {
  const empty = { cs: 0, damageCs: 0, note: "" };
  if (!workflowActive("autoSituation")) return empty;
  const sit = currentSituation();
  if (!sit.id) return empty;
  if (sit.id === "dark" && hasNightVision(actor)) return { cs: 0, damageCs: 0, note: "Night vision ignores the darkness." };
  if (sit.id === "underwater" && hasWaterPower(actor)) return empty;
  const ranged = RANGED.has(column);
  if (sit.id === "fog") {
    return ranged
      ? { cs: -1, damageCs: 0, note: "Fog −1 CS on distance and thrown attacks." }
      : empty;
  }
  if (sit.id === "rain") {
    return ranged
      ? { cs: -1, damageCs: 0, note: "Rain −1 CS on firing, distance, and thrown attacks." }
      : empty;
  }
  if (sit.id === "heavyRain") return { cs: -1, damageCs: 0, note: "Heavy rain −1 CS on FEATs." };
  if (sit.id === "heat") return { cs: -1, damageCs: 0, note: "Heat −1 CS on FEATs." };
  if (sit.id === "cold") return { cs: -1, damageCs: -1, note: "Cold −1 CS on FEATs and one rank less damage." };
  if (sit.id === "dark") return { cs: -2, damageCs: 0, note: "Darkness −2 CS on FEATs." };
  if (sit.id === "underwater") return { cs: -1, damageCs: 0, note: "Underwater −1 CS, and range is halved." };
  return empty;
}

export function shiftDamageAmount(amount, cs) {
  const steps = Number(cs) || 0;
  const raw = Number(amount) || 0;
  if (!steps || raw <= 0) return raw;
  return rankValue(shiftRank(rankFromNumber(raw), steps));
}

function actorTokens(actor) {
  return (globalThis.canvas?.tokens?.placeables ?? []).filter((token) => token.actor === actor || token.actor?.uuid === actor?.uuid);
}

function primaryToken(actor, { targeted = false, controlled = false } = {}) {
  const matches = actorTokens(actor);
  if (controlled) return matches.find((token) => token.controlled) || matches[0] || null;
  if (targeted) return matches.find((token) => token.isTargeted || token.targeted) || matches[0] || null;
  return matches[0] || null;
}

export function situationProblem(actor, target, column) {
  if (!actor || !column || !workflowActive("autoSituation")) return "";
  const sit = currentSituation();
  if (!sit.id) return "";
  if (sit.id === "underwater" && !hasWaterPower(actor) && (column === "shooting" || column === "throwEdged" || column === "throwBlunt")) {
    return "Missile weapons do not work underwater.";
  }
  if (!target) return "";
  const from = primaryToken(actor, { controlled: true });
  const to = primaryToken(target, { targeted: true });
  if (!from || !to) return "";
  const gap = gridSeparation(from, to);
  if (!Number.isFinite(gap)) return "";
  let sight = Infinity;
  if (sit.id === "dark" && !hasNightVision(actor)) sight = 5;
  if (sit.id === "fog" && RANGED.has(column)) sight = 1;
  if (Number.isFinite(sight) && gap > sight * squaresPerArea()) {
    return `${sit.label} limits sight to ${sight} area${sight === 1 ? "" : "s"}.`;
  }
  if (sit.id === "underwater" && !hasWaterPower(actor) && RANGED.has(column)) {
    const reach = Math.max(1, Math.floor(maxRangeSquares(actor, column) / 2));
    if (gap > reach) return "Underwater, this attack reaches half its normal range.";
  }
  return "";
}

export async function splashMiss({ actor, target, columnId, rankId, label, item }) {
  if (!workflowActive("autoLineOfFire") || !actor || !target) return;
  if (!RANGED.has(columnId)) return;
  const origin = primaryToken(target, { targeted: true });
  if (!origin) return;
  const seen = new Set([actor.uuid, target.uuid]);
  const neighbors = [];
  for (const token of globalThis.canvas?.tokens?.placeables ?? []) {
    const other = token.actor;
    if (!other || seen.has(other.uuid)) continue;
    if (gridSeparation(origin, token) > 1) continue;
    seen.add(other.uuid);
    neighbors.push(other);
  }
  if (!neighbors.length) return;
  const { rollFeat } = await import("./dice/universal-table.mjs");
  ui.notifications?.info(`The miss checks anyone beside ${target.name}.`);
  for (const other of neighbors) {
    await rollFeat({
      actor,
      item,
      rankId,
      label: `${label} · line of fire`,
      cs: -2,
      effectsColumn: columnId,
      targetId: other.id,
      targetUuid: other.uuid,
      shiftNotes: "Beside the line of fire −2 CS",
      lineCheck: true,
      skipCondition: true
    });
  }
}

export async function rollRandomEvent() {
  if (!game.user?.isGM) {
    ui.notifications?.warn("Only the Judge rolls a random event.");
    return;
  }
  const roll = await new Roll("1d8").evaluate({ allowInteractive: false });
  const index = Math.min(7, Math.max(0, Number(roll.total) - 1));
  const line = EVENTS[index];
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker(),
    content: `<p><strong>Random event ${roll.total}.</strong> ${line}</p>`
  });
  if (index === 3) {
    const names = [];
    for (const token of game.user?.targets ?? []) {
      const actor = token.actor;
      if (!actor) continue;
      const next = Number(actor.system?.popularity?.value || 0) - 5;
      await actor.update({ "system.popularity.value": next });
      names.push(actor.name);
    }
    if (names.length) ui.notifications?.info(`${names.join(", ")}: Popularity −5.`);
  }
}

export async function setSituation(id) {
  if (!game.user?.isGM) return;
  const sit = SITUATIONS.find((row) => row.id === id) || SITUATIONS[0];
  await game.settings.set("faserip", "situation", sit.id);
  ui.notifications?.info(sit.id ? `Situation: ${sit.label}.` : "Situation cleared.");
}

/**
 * Optional fear. Off until the Judge turns the house rule on.
 * A Psyche FEAT. Failure is fight, flee, or freeze for the round.
 */

import { intensityNeeded, rankLabel, RANKS, UNIVERSAL_TABLE } from "./config.mjs";
import { roundStamp } from "./combat-rules.mjs";
import { formValue, promptForm } from "./foundry-api.mjs";
import { houseOn } from "./house-rules.mjs";

const ATTACKS = new Set(["blunt", "edged", "shooting", "throwEdged", "throwBlunt", "energy", "force", "grappling", "grabbing", "charging"]);

const NOTES = {
  fight: "Fight this round. The action has to be an attack.",
  flee: "Flee this round. They can move, and they cannot act.",
  freeze: "Freeze this round. No action and no movement."
};

function passed(need, color) {
  if (need.automatic) return true;
  if (need.impossible) return color === "red";
  if (need.color === "green") return color !== "white";
  if (need.color === "yellow") return color === "yellow" || color === "red";
  return color === "red";
}

function ceilingFor(rankId, need) {
  const table = UNIVERSAL_TABLE[rankId] ?? UNIVERSAL_TABLE.typical;
  if (need.impossible || need.color === "red") return table.red;
  if (need.color === "yellow") return table.yellow;
  return table.green;
}

export function fearSplit(roll, ceiling) {
  const top = Math.max(1, Number(ceiling) - 1);
  const n = Math.min(top, Math.max(1, Number(roll) || 1));
  const third = Math.ceil(top / 3);
  if (n <= third) return "freeze";
  if (n <= third * 2) return "flee";
  return "fight";
}

export function fearResult({ rankId = "typical", intensityId = "", roll = 0, color = "white" } = {}) {
  const need = intensityNeeded(rankId, intensityId);
  if (passed(need, color)) return "hold";
  return fearSplit(roll, ceilingFor(rankId, need));
}

function readFear(actor) {
  return actor?.getFlag?.("faserip", "fear") || actor?.flags?.faserip?.fear || null;
}

export function fearActive(actor) {
  if (!houseOn("houseFear")) return "";
  const flag = readFear(actor);
  if (!flag?.result || flag.result === "hold") return "";
  if (flag.stamp === "next") return flag.result;
  return flag.stamp === roundStamp() ? flag.result : "";
}

export function fearDenial(actor, columnId, isCheck = false) {
  if (isCheck) return "";
  const result = fearActive(actor);
  if (!result) return "";
  const name = actor?.name || "This hero";
  if (result === "fight" && ATTACKS.has(columnId)) return "";
  if (result === "fight") return `${name} is fighting. The action has to be an attack.`;
  if (result === "flee") return `${name} is fleeing and cannot act.`;
  return `${name} freezes and cannot act.`;
}

export function fearPace(actor) {
  return fearActive(actor) === "freeze" ? 0 : null;
}

export function fearNote(actor) {
  const result = fearActive(actor);
  if (!result) return "";
  return `${actor?.name || "This hero"}: ${NOTES[result]}`;
}

export async function spendFear(actor, columnId = "") {
  const flag = readFear(actor);
  if (!flag || flag.stamp !== "next") return;
  const result = fearActive(actor);
  if (!result) return;
  if (result === "fight" && !ATTACKS.has(columnId)) return;
  await actor.unsetFlag?.("faserip", "fear");
}

function fearMark() {
  return globalThis.game?.combat?.started ? roundStamp() : "next";
}

export async function promptFear(actor) {
  if (!houseOn("houseFear") || !actor) return null;
  const current = actor.getAbilityRank?.("psyche") || "typical";
  const options = RANKS.filter((row) => row?.id).map((row) => `<option value="${esc(row.id)}">${esc(row.label)}</option>`).join("");
  const form = await promptForm({
    title: "Fear",
    okLabel: "Roll Psyche",
    content: `<p>${esc(actor.name)} rolls Psyche (${esc(rankLabel(current))}). Failure is fight, flee, or freeze for the round. The low third of the miss freezes, the middle flees, and the high third fights.</p>
      <div class="form-group"><label>Rank of the fear</label><select name="intensity">${options}</select></div>`
  });
  if (!form) return null;
  const intensityId = formValue(form, "intensity") || "typical";
  const { promptFeatRoll } = await import("./dice/universal-table.mjs");
  const message = await promptFeatRoll({
    actor,
    ability: "psyche",
    rankId: current,
    label: "Fear",
    defaultIntensity: intensityId,
    fearCheck: true
  });
  if (!message) return null;
  const flags = message.getFlag?.("faserip") || message.flags?.faserip || {};
  const result = fearResult({
    rankId: flags.rankId || current,
    intensityId: flags.intensityId || intensityId,
    roll: flags.roll,
    color: flags.color
  });
  if (result === "hold") {
    await actor.unsetFlag?.("faserip", "fear");
    const line = `${actor.name} holds against the fear.`;
    globalThis.ui?.notifications?.info(line);
    return result;
  }
  await actor.setFlag("faserip", "fear", { result, stamp: fearMark() });
  const line = `${actor.name}: ${NOTES[result]}`;
  await globalThis.ChatMessage?.create?.({
    speaker: globalThis.ChatMessage?.getSpeaker?.({ actor }),
    content: `<div class="faserip-chat"><header><span class="feat-label">Fear</span></header><p>${esc(line)}</p></div>`
  });
  globalThis.ui?.notifications?.info(line);
  return result;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

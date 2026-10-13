/**
 * Optional inhibitor. Off until the Judge turns the house rule on.
 * Powers at the inhibitor's rank or lower do not work. A Strength FEAT breaks it.
 */

import { intensityNeeded, rankIndex, rankLabel } from "./config.mjs";
import { houseOn } from "./house-rules.mjs";

export function readInhibitor(actor) {
  const raw = actor?.getFlag?.("faserip", "inhibitor") ?? actor?.flags?.faserip?.inhibitor ?? "";
  const id = String(raw || "");
  return rankIndex(id) >= 0 ? id : "";
}

export function inhibitorHolds(powerRank, lid, ruleOn) {
  if (!ruleOn || rankIndex(lid) < 0) return false;
  const power = rankIndex(powerRank) >= 0 ? powerRank : "typical";
  return rankIndex(power) <= rankIndex(lid);
}

export function inhibitorBroken(strengthRank, lid, color) {
  const need = intensityNeeded(strengthRank, lid);
  if (need.automatic) return true;
  if (need.impossible) return color === "red";
  if (need.color === "green") return color !== "white";
  if (need.color === "yellow") return color === "yellow" || color === "red";
  return color === "red";
}

export async function promptBreakInhibitor(actor) {
  if (!houseOn("houseInhibitor") || !actor) return null;
  const lid = readInhibitor(actor);
  if (!lid) {
    globalThis.ui?.notifications?.info(`${actor.name} is not wearing an inhibitor.`);
    return null;
  }
  const strength = actor.getAbilityRank?.("strength") || "typical";
  const { promptFeatRoll } = await import("./dice/universal-table.mjs");
  const message = await promptFeatRoll({
    actor,
    ability: "strength",
    rankId: strength,
    label: "Break the inhibitor",
    defaultIntensity: lid
  });
  if (!message) return null;
  const flags = message.getFlag?.("faserip") || message.flags?.faserip || {};
  if (!inhibitorBroken(flags.rankId || strength, lid, flags.color || "white")) {
    globalThis.ui?.notifications?.warn(`${actor.name} does not break the inhibitor (${rankLabel(lid)}).`);
    return null;
  }
  await actor.unsetFlag?.("faserip", "inhibitor");
  const line = `${actor.name} breaks the inhibitor (${rankLabel(lid)}).`;
  await globalThis.ChatMessage?.create?.({
    speaker: globalThis.ChatMessage?.getSpeaker?.({ actor }),
    content: `<div class="faserip-chat"><header><span class="feat-label">Inhibitor</span></header><p>${esc(line)}</p></div>`
  });
  globalThis.ui?.notifications?.info(line);
  return true;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

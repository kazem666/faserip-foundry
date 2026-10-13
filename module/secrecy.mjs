/**
 * Optional secrecy rank. Off until the Judge turns the house rule on.
 * One rank for a hero who keeps a private life.
 */

import { rankIndex, rankLabel, RANKS, shiftRank } from "./config.mjs";
import { houseOn } from "./house-rules.mjs";

const CAP = "unearthly";

export function secrecyRank(stored) {
  return rankIndex(stored) >= 0 ? stored : "excellent";
}

export function moveSecrecy(stored, steps) {
  let next = shiftRank(secrecyRank(stored), steps);
  if (rankIndex(next) > rankIndex(CAP)) next = CAP;
  return next;
}

export function coverBlown(stored) {
  return rankIndex(secrecyRank(stored)) < rankIndex("typical");
}

export function privateKarmaBlocked({ ruleOn, keepsSecret, fromPrivateLife, stored } = {}) {
  if (!ruleOn || !keepsSecret || !fromPrivateLife) return false;
  return coverBlown(stored);
}

export function secrecyChoices(stored) {
  const current = secrecyRank(stored);
  const cap = rankIndex(CAP);
  return RANKS.filter((row) => rankIndex(row.id) >= 0 && rankIndex(row.id) <= cap).map((row) => ({
    id: row.id,
    label: row.label,
    selected: row.id === current
  }));
}

export async function changeSecrecy(actor, steps, reason) {
  if (!houseOn("houseSecrecy") || !actor) return null;
  if (!actor.system?.identity?.secretId) {
    globalThis.ui?.notifications?.info(`${actor.name} is not keeping a secret identity.`);
    return null;
  }
  const next = moveSecrecy(actor.system?.identity?.secrecy, steps);
  await actor.update({ "system.identity.secrecy": next });
  const blown = coverBlown(next);
  const line = `${actor.name}: ${reason} Secrecy is ${rankLabel(next)}.${blown ? " The cover is below Typical, so private-life Karma does not come in." : ""}`;
  await globalThis.ChatMessage?.create?.({
    speaker: globalThis.ChatMessage?.getSpeaker?.({ actor }),
    content: `<div class="faserip-chat"><header><span class="feat-label">Secrecy</span></header><p>${esc(line)}</p></div>`
  });
  globalThis.ui?.notifications?.info(line);
  return next;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

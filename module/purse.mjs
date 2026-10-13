/**
 * Optional weekly purse. Off until the Judge turns the house rule on.
 * The Resources rank number is walking-around money. It refills each world week.
 * Spending it does not use the weekly Resources FEAT.
 */

import { rankLabel, rankValue } from "./config.mjs";
import { worldWeek } from "./clock.mjs";
import { formValue, promptForm } from "./foundry-api.mjs";
import { houseOn } from "./house-rules.mjs";

export function purseMax(actor) {
  return Math.max(0, rankValue(actor?.system?.resources?.rank || "typical"));
}

export function purseState(actor, now) {
  const max = purseMax(actor);
  const week = String(worldWeek(now));
  const stamped = String(actor?.getFlag?.("faserip", "purseWeek") ?? actor?.flags?.faserip?.purseWeek ?? "");
  const stored = actor?.getFlag?.("faserip", "purse") ?? actor?.flags?.faserip?.purse;
  if (stamped !== week || stored == null || stored === "") return { left: max, max, week, fresh: true };
  return { left: Math.max(0, Math.min(max, Number(stored) || 0)), max, week, fresh: false };
}

export async function refillPurse(actor, now) {
  if (!houseOn("housePurse") || !actor?.setFlag) return null;
  const state = purseState(actor, now);
  if (!state.fresh) return state;
  await actor.setFlag("faserip", "purse", state.left);
  await actor.setFlag("faserip", "purseWeek", state.week);
  return state;
}

export async function spendPurse(actor, amount, note = "") {
  if (!houseOn("housePurse") || !actor?.setFlag) return null;
  const n = Math.max(0, Math.floor(Number(amount) || 0));
  if (!n) return null;
  const state = purseState(actor);
  if (n > state.left) {
    globalThis.ui?.notifications?.warn(`The purse has ${state.left}. This needs a Resources FEAT.`);
    return null;
  }
  const left = state.left - n;
  await actor.setFlag("faserip", "purse", left);
  await actor.setFlag("faserip", "purseWeek", state.week);
  const line = `${actor.name} spends ${n} from the purse (${left} of ${state.max} left).${note ? ` ${note}` : ""}`;
  await globalThis.ChatMessage?.create?.({
    speaker: globalThis.ChatMessage?.getSpeaker?.({ actor }),
    content: `<div class="faserip-chat"><header><span class="feat-label">Purse</span></header><p>${esc(line)}</p></div>`
  });
  globalThis.ui?.notifications?.info(line);
  return { left, max: state.max };
}

export async function promptSpendPurse(actor) {
  if (!houseOn("housePurse") || !actor) return null;
  const state = purseState(actor);
  const form = await promptForm({
    title: "Spend from the purse",
    okLabel: "Spend",
    content: `<p>${esc(actor.name)} has ${state.left} of ${state.max} this week. ${esc(rankLabel(actor.system?.resources?.rank || "typical"))} refills it next week. This does not use the Resources FEAT.</p>
      <div class="form-group"><label>Amount</label><input type="number" name="amount" min="1" max="${state.left}" value="1" /></div>
      <div class="form-group"><label>What it bought</label><input type="text" name="note" /></div>`
  });
  if (!form) return null;
  return spendPurse(actor, formValue(form, "amount"), formValue(form, "note"));
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

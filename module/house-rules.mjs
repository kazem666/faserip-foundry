/**
 * Optional house rules. Each one is off until the Judge turns it on.
 */

import { ABILITIES, rankIndex, rankValue } from "./config.mjs";
import { formValue, promptForm } from "./foundry-api.mjs";

const COLOR_RANK = { white: 0, green: 1, yellow: 2, red: 3 };
const COLOR_NAME = ["white", "green", "yellow", "red"];

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

export const TAILOR_TIERS = {
  street: {
    label: "Street",
    note: "Training or one edge. Abilities Typical to Excellent. Powers Good to Excellent.",
    ability: "good",
    abilityCap: "excellent",
    power: "good",
    powerCap: "excellent",
    resources: "typical",
    budget: 40
  },
  enhanced: {
    label: "Enhanced",
    note: "Clearly past a trained person. Abilities Good to Remarkable. Powers Excellent to Remarkable.",
    ability: "excellent",
    abilityCap: "remarkable",
    power: "excellent",
    powerCap: "remarkable",
    resources: "good",
    budget: 50
  },
  superhuman: {
    label: "Superhuman",
    note: "A full comic hero. Abilities Excellent to Incredible. Powers Remarkable to Amazing.",
    ability: "remarkable",
    abilityCap: "incredible",
    power: "remarkable",
    powerCap: "amazing",
    resources: "excellent",
    budget: 62
  },
  cosmic: {
    label: "Cosmic",
    note: "A power that changes the battlefield. Abilities Remarkable to Unearthly. Powers Incredible to Monstrous.",
    ability: "incredible",
    abilityCap: "unearthly",
    power: "incredible",
    powerCap: "monstrous",
    resources: "remarkable",
    budget: 74
  }
};

const TAILOR_RANKS = ["feeble", "poor", "typical", "good", "excellent", "remarkable", "incredible", "amazing", "monstrous", "unearthly", "shiftx"];

export function tailorOn() { return houseOn("houseTailored"); }
export function tailorCapOn() { return tailorOn() && houseOn("houseTailoredCap"); }
export function tailorWeaknessOn() { return tailorOn() && houseOn("houseTailoredWeakness"); }
export function tailorBudgetOn() { return tailorOn() && houseOn("houseTailoredBudget"); }

export function tailorSignatures(text) {
  return String(text || "").split(/\n|,/).map((part) => part.trim()).filter(Boolean).slice(0, 3);
}

export function tailorRankChoices(capId) {
  if (!capId) return TAILOR_RANKS.slice();
  const cap = rankIndex(capId);
  if (cap < 0) return TAILOR_RANKS.slice();
  return TAILOR_RANKS.filter((id) => rankIndex(id) >= 0 && rankIndex(id) <= cap);
}

export function houseOn(key) {
  try {
    return !!globalThis.game?.settings?.get("faserip", key);
  } catch {
    return false;
  }
}

export function splitTags(value) {
  return String(value || "")
    .split(/[,;\n]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function roundStamp() {
  const combat = globalThis.game?.combat;
  if (combat?.started) return `${combat.id}:${combat.round}`;
  return `scene:${globalThis.game?.scenes?.active?.id || "none"}`;
}

export function percentileHits(raw) {
  const roll = Number(raw) || 0;
  let band = "low";
  try { band = globalThis.game?.settings?.get("faserip", "houseFantasticBand") || "low"; } catch { /* low */ }
  if (band === "high") return roll >= 96;
  return roll >= 1 && roll <= 5;
}

export function focusAbility() {
  try {
    return globalThis.game?.settings?.get("faserip", "houseFocusAbility") === "reason" ? "reason" : "psyche";
  } catch {
    return "psyche";
  }
}

export function focusMax(actor) {
  const key = focusAbility();
  const rank = actor?.getAbilityRank?.(key) || actor?.system?.abilities?.[key]?.rank || "typical";
  return Math.max(1, Math.floor(rankValue(rank) / 2));
}

export function focusView(actor) {
  const max = focusMax(actor);
  const stored = actor?.getFlag?.("faserip", "focus");
  if (!stored || typeof stored !== "object") return { value: max, max };
  const value = Math.max(0, Math.min(max, Number(stored.value) || 0));
  return { value, max };
}

export async function refreshFocus(actor) {
  if (!actor) return null;
  const max = focusMax(actor);
  await actor.setFlag("faserip", "focus", { value: max, max });
  return { value: max, max };
}

export async function spendFocus(actor, amount = 1) {
  if (!actor || !houseOn("houseFocus")) return false;
  const state = focusView(actor);
  const cost = Math.max(1, Number(amount) || 1);
  if (state.value < cost) {
    globalThis.ui?.notifications?.warn(`${actor.name} does not have ${cost} Focus.`);
    return false;
  }
  await actor.setFlag("faserip", "focus", { value: state.value - cost, max: state.max });
  return true;
}

export async function refundFocus(actor, amount = 1) {
  if (!actor) return;
  const state = focusView(actor);
  const next = Math.min(state.max, state.value + Math.max(1, Number(amount) || 1));
  await actor.setFlag("faserip", "focus", { value: next, max: state.max });
}

export async function claimTag(actor) {
  const stamp = roundStamp();
  if (actor.getFlag?.("faserip", "tagRound") === stamp) return false;
  await actor.setFlag("faserip", "tagRound", stamp);
  return true;
}

export function houseFeatFields(actor, item) {
  if (!actor) return "";
  const bits = [];
  if (houseOn("houseFantastic")) {
    bits.push(`<label class="check"><input type="checkbox" name="fantasticCheck" /> Spend Karma to check for Fantastic on a Yellow or Red</label>
      <div class="form-group"><label>Fantastic check (10–20 Karma)</label><input type="number" name="fantasticKarma" value="10" min="10" max="20" /></div>`);
  }
  if (houseOn("houseTags")) {
    const tags = splitTags(actor.system?.identity?.tags);
    const hind = splitTags(actor.system?.identity?.hindrances);
    if (tags.length) {
      const choices = tags.map((tag) => `<option value="${esc(tag)}">${esc(tag)}</option>`).join("");
      bits.push(`<div class="form-group"><label>Invoke a tag (once per round)</label>
        <select name="tagInvoke"><option value="">— none —</option>${choices}</select>
        <select name="tagCs"><option value="1">+1 column</option><option value="2">+2 columns</option></select>
      </div>`);
    }
    for (const name of hind) {
      bits.push(`<label class="check"><input type="checkbox" name="hindrance" value="${esc(name)}" /> ${esc(name)} (−1 column)</label>`);
    }
  }
  if (houseOn("houseFocus") && item?.type === "power") {
    const focus = focusView(actor);
    bits.push(`<label class="check"><input type="checkbox" name="focusPush" /> Spend 1 Focus to push this power one rank (${focus.value} left)</label>`);
  }
  return bits.join("");
}

export async function readHouseFeat(actor, form) {
  const notes = [];
  let cs = 0;
  let focusPush = false;
  let fantasticKarma = 0;
  if (!actor || !form) return { cs, notes, focusPush, fantasticKarma };
  if (houseOn("houseTags")) {
    const tag = String(form.querySelector('[name="tagInvoke"]')?.value || "").trim();
    const bonus = Math.max(1, Math.min(2, Number(form.querySelector('[name="tagCs"]')?.value || 1)));
    if (tag) {
      const ok = await claimTag(actor);
      if (!ok) globalThis.ui?.notifications?.warn(`${actor.name} already invoked a tag this round.`);
      else {
        cs += bonus;
        notes.push(`Tag "${tag}" +${bonus} column${bonus === 1 ? "" : "s"}`);
      }
    }
    const hindrances = [...form.querySelectorAll('[name="hindrance"]:checked')].map((box) => box.value).filter(Boolean);
    if (hindrances.length) {
      cs -= hindrances.length;
      notes.push(hindrances.map((name) => `${name} −1 column`).join("; "));
    }
  }
  if (houseOn("houseFantastic") && form.querySelector('[name="fantasticCheck"]')?.checked) {
    fantasticKarma = Math.max(10, Math.min(20, Number(form.querySelector('[name="fantasticKarma"]')?.value || 10)));
  }
  if (houseOn("houseFocus") && form.querySelector('[name="focusPush"]')?.checked) focusPush = true;
  return { cs, notes, focusPush, fantasticKarma };
}

export function fantasticOutcome({ color, raw, paid = 0 } = {}) {
  if (!houseOn("houseFantastic")) return { fantastic: false, spend: 0 };
  const band = percentileHits(raw);
  const natural = color === "red" && band;
  const paidTry = paid >= 10 && (color === "yellow" || color === "red");
  return {
    fantastic: natural || (paidTry && band),
    spend: paidTry && !natural ? paid : 0
  };
}

export async function describeFantasticPanel(message) {
  const form = await promptForm({
    title: "Fantastic panel",
    okLabel: "Post",
    content: `<form><label>What does the panel show?<textarea name="panel" rows="3"></textarea></label></form>`
  });
  if (!form) return;
  const text = String(formValue(form, "panel") || "").trim();
  if (!text) return;
  await globalThis.ChatMessage?.create({
    speaker: message?.speaker,
    content: `<div class="faserip-chat"><header><span class="feat-label">Fantastic panel</span></header><p>${esc(text)}</p></div>`
  });
}

export async function grantFreeStunt(message) {
  const actor = globalThis.game?.actors?.get(message?.speaker?.actor);
  if (!actor) return;
  await actor.setFlag("faserip", "freeStunt", true);
  globalThis.ui?.notifications?.info(`${actor.name} can attempt one Power Stunt at no Karma cost.`);
}

export async function rerollWithFocus(message) {
  const actor = globalThis.game?.actors?.get(message?.speaker?.actor);
  if (!actor) return null;
  if (!(await spendFocus(actor))) return null;
  const { promptFeatRoll } = await import("./dice/universal-table.mjs");
  return promptFeatRoll({
    actor,
    rankId: message.getFlag?.("faserip", "baseRankId") || message.getFlag?.("faserip", "rankId"),
    label: message.getFlag?.("faserip", "label") || "FEAT",
    defaultColumn: message.getFlag?.("faserip", "effectsColumn") || "",
    defaultIntensity: message.getFlag?.("faserip", "intensityId") || ""
  });
}

function betterColor(color) {
  const next = (COLOR_RANK[color] ?? 0) + 1;
  if (next >= COLOR_NAME.length) return "fantastic";
  return COLOR_NAME[next];
}

export async function promptTeamManeuver(actor) {
  if (!houseOn("houseTeam")) return;
  const seen = new Set();
  const pool = [];
  const add = (entry) => {
    if (!entry || seen.has(entry.id)) return;
    seen.add(entry.id);
    pool.push(entry);
  };
  add(actor);
  for (const combatant of globalThis.game?.combat?.combatants ?? []) add(combatant.actor);
  if (pool.length < 2) {
    for (const hero of globalThis.game?.actors?.filter((entry) => entry.type === "hero") ?? []) add(hero);
  }
  if (pool.length < 2) {
    globalThis.ui?.notifications?.warn("A team maneuver needs at least two characters.");
    return;
  }
  const abilities = ABILITIES.map((key) => {
    const label = globalThis.game?.i18n?.localize?.(`FASERIP.Ability.${key}`) || key;
    return `<option value="${key}">${esc(label)}</option>`;
  }).join("");
  const rows = pool.map((entry) => `<label class="check"><input type="checkbox" name="member" value="${esc(entry.uuid)}" ${entry.id === actor?.id ? "checked" : ""} /> ${esc(entry.name)}
      <select name="ability-${esc(entry.id)}">${abilities}</select></label>`).join("");
  const form = await promptForm({
    title: "Team Maneuver",
    okLabel: "Roll",
    width: 560,
    content: `<form>
      <p class="hint">Two or more characters spend their action. Each rolls a FEAT. If at least two succeed, the best result counts as one column better.</p>
      <label>How the powers combine<textarea name="blurb" rows="2"></textarea></label>
      ${rows}
    </form>`
  });
  if (!form) return;
  const blurb = String(formValue(form, "blurb") || "").trim();
  const chosen = [...form.querySelectorAll('[name="member"]:checked')].map((box) => box.value).filter(Boolean);
  if (chosen.length < 2) {
    globalThis.ui?.notifications?.warn("Pick at least two characters.");
    return;
  }
  const { rollFeat } = await import("./dice/universal-table.mjs");
  const results = [];
  for (const uuid of chosen) {
    let member = null;
    try { member = await globalThis.fromUuid(uuid); } catch { member = null; }
    if (!member) continue;
    const ability = form.querySelector(`[name="ability-${CSS.escape(member.id)}"]`)?.value || "fighting";
    const message = await rollFeat({
      actor: member,
      rankId: member.getAbilityRank?.(ability) || "typical",
      label: "Team Maneuver",
      ability,
      shiftNotes: blurb
    });
    const color = message?.flags?.faserip?.color || "white";
    results.push({ actor: member, color, ok: color !== "white" });
  }
  const hits = results.filter((row) => row.ok);
  let summary = `${results.map((row) => `${row.actor.name}: ${row.color}`).join("; ")}.`;
  if (hits.length < 2) {
    summary += " Fewer than two succeed, so the maneuver does not combine.";
  } else {
    const best = hits.reduce((top, row) => (COLOR_RANK[row.color] > COLOR_RANK[top] ? row.color : top), "white");
    const boosted = betterColor(best);
    summary += ` Best result is ${best}, so the maneuver counts as ${boosted === "fantastic" ? "a Fantastic Success" : boosted}.`;
    if (boosted === "fantastic") {
      summary += " The effect can cover an area. Each participant gains 10 Karma.";
      for (const row of results) {
        const current = Number(row.actor.system?.karma?.value || 0);
        try {
          await row.actor.update({ "system.karma.value": current + 10 });
        } catch (err) {
          console.warn("FASERIP | team karma", err);
        }
      }
    }
  }
  if (blurb) summary = `${blurb} ${summary}`;
  await globalThis.ChatMessage?.create({
    speaker: globalThis.ChatMessage?.getSpeaker?.({ actor }),
    content: `<div class="faserip-chat"><header><span class="feat-label">Team Maneuver</span><span class="result-chip ${hits.length >= 2 ? "yellow" : "white"}">${hits.length >= 2 ? "Combined" : "Miss"}</span></header><p>${esc(summary)}</p></div>`
  });
}

export function registerHouseRules() {
  const settings = globalThis.game?.settings;
  if (!settings) return;
  const judge = { scope: "world", config: false, restricted: true };
  settings.register("faserip", "houseFantastic", {
    name: "House rule: Fantastic Success",
    hint: "Judge only. A Red FEAT whose percentile is in the chosen band is a Fantastic Success: damage, intensity, or duration is doubled. The player can describe the panel or take one Power Stunt at no Karma cost. Spending 10–20 Karma lets a Yellow or Red check that same band.",
    ...judge,
    type: Boolean,
    default: false
  });
  settings.register("faserip", "houseFantasticBand", {
    name: "Fantastic Success band",
    hint: "Used when Fantastic Success is on. Low is a percentile of 01–05. High is 96–00.",
    ...judge,
    type: String,
    choices: { low: "01–05", high: "96–00" },
    default: "low"
  });
  settings.register("faserip", "houseTeam", {
    name: "House rule: Team Maneuvers",
    hint: "Judge only. Two or more characters can combine an action. If at least two FEATs succeed, the best result counts as one column better. A result past Red is a Fantastic Success: the effect can be area-wide and each participant gains 10 Karma.",
    ...judge,
    type: Boolean,
    default: false
  });
  settings.register("faserip", "houseTags", {
    name: "House rule: Tags",
    hint: "Judge only. A hero lists up to three tags and any hindrances. One tag per round is +1 or +2 columns when it clearly applies. A hindrance the Judge applies is −1 column.",
    ...judge,
    type: Boolean,
    default: false
  });
  settings.register("faserip", "houseFocus", {
    name: "House rule: Focus",
    hint: "Judge only. Each fight starts with Focus equal to half the chosen rank number (minimum 1). Spend 1 to push a power one rank, reroll a FEAT, or attempt a Power Stunt. New scene refreshes it. Karma is unchanged.",
    ...judge,
    type: Boolean,
    default: false
  });
  settings.register("faserip", "houseFocusAbility", {
    name: "Focus ability",
    hint: "Used when Focus is on. The pool is half that ability's rank number.",
    ...judge,
    type: String,
    choices: { psyche: "Psyche", reason: "Reason" },
    default: "psyche"
  });
  settings.register("faserip", "houseTailored", {
    name: "House rule: Tailored characters",
    hint: "Judge only. The player states a concept, an origin, and 1–3 signature powers or themes. You agree a tier (street, enhanced, superhuman, or cosmic) and assign ranks and powers to match. Surprise me still rolls the old random generation.",
    ...judge,
    type: Boolean,
    default: false
  });
  settings.register("faserip", "houseTailoredCap", {
    name: "Tailored: cap ranks to the tier",
    hint: "Used when Tailored characters is on. Ability and power ranks cannot go above that tier.",
    ...judge,
    type: Boolean,
    default: false
  });
  settings.register("faserip", "houseTailoredWeakness", {
    name: "Tailored: require a weakness",
    hint: "Used when Tailored characters is on. The hero cannot finish without a weakness or limitation.",
    ...judge,
    type: Boolean,
    default: false
  });
  settings.register("faserip", "houseAdvancement", {
    name: "House rule: Advancement",
    hint: "Judge only. Abilities, powers, and Resources rise 5 points at a time. Talents, new powers, and contacts use the advancement schedule. Karma cannot buy Popularity.",
    ...judge,
    type: Boolean,
    default: false
  });
  settings.register("faserip", "houseTailoredBudget", {
    name: "Tailored: point budget",
    hint: "Used when Tailored characters is on. Ability ranks and chosen powers spend a light budget for that tier. A higher rank costs more.",
    ...judge,
    type: Boolean,
    default: false
  });
  settings.register("faserip", "houseGadgets", {
    name: "House rule: Gadgets",
    hint: "Judge only. A hero can design a device: stake Karma, roll Resources for the parts, then roll Reason for the body and each ability or power. The workshop caps the ranks. An omni-gadget is named when used, works a short time, then burns out until repaired. Field repair is two columns harder.",
    ...judge,
    type: Boolean,
    default: false
  });
  settings.register("faserip", "houseSecrecy", {
    name: "House rule: Secrecy",
    hint: "Judge only. A hero with a secret identity has one Secrecy rank. A slip, someone being told, or a scene in the open drops it one column. Below Typical, private-life Karma does not come in until the cover is repaired.",
    ...judge,
    type: Boolean,
    default: false
  });
  const Hooks = globalThis.Hooks;
  if (!Hooks || Hooks._faseripHouse) return;
  Hooks._faseripHouse = true;
  Hooks.on("combatStart", (combat) => {
    if (!houseOn("houseFocus")) return;
    for (const combatant of combat?.combatants ?? []) {
      if (combatant.actor) refreshFocus(combatant.actor).catch((err) => console.warn("FASERIP | focus", err));
    }
  });
}

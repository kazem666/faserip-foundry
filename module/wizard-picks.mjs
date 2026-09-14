import {
  POWER_CATALOG, TALENT_CATALOG, CONTACT_TYPES,
  rankLabel, rollOnColumn, lookupTable, POWER_CATEGORIES, TALENT_CATEGORIES
} from "./config.mjs";
import { promptedD100 } from "./dice/percentile.mjs";
import { isTwoSlotPower, cleanPowerName, slotCost } from "./data/slots.mjs";

const WEAKNESSES = [
  "None",
  "Allergy / Dependence",
  "Attracts Unexpected",
  "Fatiguing Power",
  "Involuntary Change",
  "Mute / Communication Limit",
  "Physical Handicap",
  "Psychological Limitation",
  "Susceptibility",
  "Trigger / Powerless",
  "Uncontrolled Power"
];

function d100() { return Math.floor(Math.random() * 100) + 1; }

export function esc(s) {
  return String(s ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
}

export function options(list, selected = "") {
  return list.map((v) => {
    const val = typeof v === "string" ? v : v.id;
    const lab = typeof v === "string" ? v : v.label;
    const sel = val === selected ? " selected" : "";
    return `<option value="${esc(val)}"${sel}>${lab}</option>`;
  }).join("");
}

export function wrapDialogContent(html) {
  return `<div class="faserip-dialog-scroll">${html}</div>`;
}

export async function dialog(title, content, buttons, width = 560) {
  const DialogV2 = foundry.applications.api.DialogV2;
  return DialogV2.wait({
    classes: ["faserip-dialog"],
    window: { title, icon: "fa-solid fa-mask", resizable: true },
    position: { width },
    content: wrapDialogContent(content),
    buttons,
    rejectClose: false
  });
}

export function collect(button, dialog) {
  const form = button?.form
    || button?.closest?.("form")
    || dialog?.element?.querySelector?.("form")
    || dialog?.form;
  const out = {};
  if (!form) return out;
  for (const el of form.elements) {
    if (!el.name) continue;
    out[el.name] = el.type === "checkbox" ? !!el.checked : el.value;
  }
  return out;
}

export async function pickPowers(result, actor = null, useUpb = false) {
  if (useUpb || result.useUpb) {
    const { pickUpbPowers } = await import("./wizard-upb.mjs");
    return pickUpbPowers(result, actor);
  }
  const needed = result.counts.powers[0];
  const selected = [];
  let spent = 0;
  while (spent < needed) {
    const remaining = needed - spent;
    const slot = selected.length + 1;
    const catRoll = await promptedD100({
      title: "Power category " + slot,
      body: "Roll 1d100 on the Primary Powers table to determine the category for Power slot " + slot + " of " + needed + ".",
      flavor: (actor?.name || "Hero") + " - Power category " + slot,
      actor
    });
    if (catRoll == null) return null;
    const cat = { roll: catRoll, ...lookupTable(POWER_CATEGORIES, catRoll) };
    const list = POWER_CATALOG[cat.id] ?? [];
    const choice = await dialog("Power slot " + (spent + 1) + "–" + needed + " (" + remaining + " slot" + (remaining === 1 ? "" : "s") + " left)",
      "<p>Category <strong>" + esc(cat.label) + "</strong> (d100 " + cat.roll + "). Choose the Power. A power marked counts-as-two spends <strong>two</strong> of the " + needed + " slots. Rank uses column " + result.origin.column + ".</p>" +
      "<p class='hint'>Used " + spent + " / " + needed + " slots. Current powers: " + (selected.map((p) => p.name + (p.cost === 2 ? " (2)" : "")).join(", ") || "none") + ".</p>" +
      "<div class='form-group'><label>Power</label><select name='power'>" + options(list) + "</select></div>" +
      "<div class='form-group'><label>Custom name</label><input name='custom' type='text' /></div>", [
      { action: "add", label: "Add Power", icon: "fa-solid fa-plus", default: true, callback: (_e, b) => ({ action: "add", ...collect(b) }) },
      { action: "reroll", label: "Reroll Category", icon: "fa-solid fa-rotate" },
      { action: "skip", label: "Skip Remaining" },
      { action: "cancel", label: "Stop" }
    ]);
    if (!choice || choice === "cancel") return null;
    if (choice === "skip") break;
    if (choice === "reroll") continue;
    const rawName = (choice.custom || "").trim() || choice.power;
    if (!rawName) continue;
    const name = cleanPowerName(rawName);
    const cost = slotCost(rawName, {}, remaining);
    if (isTwoSlotPower(rawName) && remaining < 2) {
      ui.notifications.warn(name + " costs two Power slots. " + remaining + " left.");
      continue;
    }
    const rankRoll = await promptedD100({
      title: "Power rank - " + name,
      body: "Roll 1d100 on Random Ranks column " + result.origin.column + " for <strong>" + esc(name) + "</strong>.",
      flavor: (actor?.name || "Hero") + " - " + name + " rank",
      actor
    });
    if (rankRoll == null) return null;
    const rank = rollOnColumn(result.origin.column, rankRoll);
    selected.push({
      name, category: cat.label, rank, rankRoll, cost, slotsTaken: cost,
      bodyArmor: /body armor/i.test(name),
      forceField: /force field/i.test(name)
    });
    spent += cost;
    ui.notifications.info(name + ": " + rankLabel(rank) + " · " + cost + " slot" + (cost === 2 ? "s" : "") + " (" + spent + "/" + needed + ")");
  }
  return selected;
}

export async function pickTalents(result, actor = null) {
  const needed = result.counts.talents[0];
  const selected = [];
  const hitech = result.origin.id === "hitech";
  while (selected.length < needed) {
    const slot = selected.length + 1;
    let heading;
    let list;
    if (hitech && selected.length === 0) {
      list = [].concat(TALENT_CATALOG.scientific || [], TALENT_CATALOG.professional || []);
      heading = "Scientific / Professional (required for Hi-Tech)";
    } else {
      const catRoll = await promptedD100({
        title: "Talent category " + slot,
        body: "Roll 1d100 on the Talent Categories table for Talent slot " + slot + " of " + needed + ".",
        flavor: (actor?.name || "Hero") + " - Talent category " + slot,
        actor
      });
      if (catRoll == null) return null;
      const cat = { roll: catRoll, ...lookupTable(TALENT_CATEGORIES, catRoll) };
      list = TALENT_CATALOG[cat.id] ?? [];
      heading = cat.label + " (d100 " + cat.roll + ")";
    }
    const choice = await dialog("Talent " + slot + " of " + needed,
      "<p>Category <strong>" + esc(heading) + "</strong>.</p>" +
      "<div class='form-group'><label>Talent</label><select name='talent'>" + options(list) + "</select></div>" +
      "<div class='form-group'><label>Custom name</label><input name='custom' type='text' /></div>", [
      { action: "add", label: "Add Talent", icon: "fa-solid fa-plus", default: true, callback: (_e, b) => ({ action: "add", ...collect(b) }) },
      { action: "reroll", label: "Reroll Category", icon: "fa-solid fa-rotate" },
      { action: "skip", label: "Skip Remaining" },
      { action: "cancel", label: "Stop" }
    ]);
    if (!choice || choice === "cancel") return null;
    if (choice === "skip") break;
    if (choice === "reroll") continue;
    const name = (choice.custom || "").trim() || choice.talent;
    if (name) selected.push({ name, category: heading });
  }
  return selected;
}

export async function pickContacts(count, max, originId) {
  const selected = [];
  const target = originId === "alien" ? Math.min(1, count) : count;
  if (target <= 0) {
    const extra = await dialog("Contacts", `
        <p>Rolled 0 starting Contacts (max ${max}). Add one?</p>
        <div class="form-group"><label>Type</label><select name="type">${options(CONTACT_TYPES)}</select></div>
        <div class="form-group"><label>Name</label><input name="name" type="text" /></div>`, [
      { action: "add", label: "Add Contact", callback: (_e, b) => ({ action: "add", ...collect(b) }) },
      { action: "skip", label: "No Contacts", default: true },
      { action: "cancel", label: "Stop" }
    ]);
    if (!extra || extra === "cancel") return extra === "skip" ? [] : null;
    if (extra === "skip") return [];
    selected.push({ name: extra.name || extra.type, type: extra.type });
    return selected;
  }
  for (let i = 0; i < target; i++) {
    const alienNote = originId === "alien" ? "<p class='hint'>Aliens may have one Contact, usually their people.</p>" : "";
    const choice = await dialog(`Contact ${i + 1} of ${target} (max ${max})`, `
        ${alienNote}
        <div class="form-group"><label>Type</label><select name="type">${options(CONTACT_TYPES)}</select></div>
        <div class="form-group"><label>Name</label><input name="name" type="text" /></div>`, [
      { action: "add", label: "Add Contact", icon: "fa-solid fa-plus", default: true, callback: (_e, b) => ({ action: "add", ...collect(b) }) },
      { action: "skip", label: "Skip Remaining" },
      { action: "cancel", label: "Stop" }
    ]);
    if (!choice || choice === "cancel") return null;
    if (choice === "skip") break;
    selected.push({ name: (choice.name || "").trim() || choice.type, type: choice.type });
  }
  return selected;
}

export async function pickWeakness(actor = null, useUpb = false) {
  if (useUpb) {
    const { pickUpbWeakness } = await import("./wizard-upb.mjs");
    return pickUpbWeakness(actor);
  }
  const choice = await dialog("Weakness (optional)", `
      <p>Optional Advanced Set limitation. Written onto the hero notes.</p>
      <div class="form-group"><label>Weakness</label><select name="weakness">${options(WEAKNESSES)}</select></div>
      <div class="form-group"><label>Notes</label><input name="notes" type="text" /></div>`, [
    { action: "ok", label: "Finish Hero", icon: "fa-solid fa-check", default: true, callback: (_e, b) => ({ action: "ok", ...collect(b) }) },
    { action: "cancel", label: "Stop" }
  ]);
  if (!choice || choice === "cancel") return null;
  if (!choice.weakness || choice.weakness === "None") return "";
  return choice.notes ? `${choice.weakness}: ${choice.notes}` : choice.weakness;
}

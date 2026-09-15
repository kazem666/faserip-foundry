import {
  POWER_CATALOG, TALENT_CATALOG, CONTACT_TYPES,
  rankLabel, rollOnColumn, lookupTable, POWER_CATEGORIES, TALENT_CATEGORIES
} from "./config.mjs";
import { promptedD100 } from "./dice/percentile.mjs";
import { isTwoSlotPower, cleanPowerName, slotCost } from "./data/slots.mjs";
import { parseCountPair, writeGeneratedItem } from "./chargen.mjs";

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
  return String(s ?? "")
    .replaceAll("&", "\u0026amp;")
    .replaceAll("<", "\u0026lt;")
    .replaceAll('"', "\u0026quot;");
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
  if (String(html).includes("<form")) return `<div class="faserip-dialog-scroll">${html}</div>`;
  return `<div class="faserip-dialog-scroll"><form class="faserip-feat-dialog">${html}</form></div>`;
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

export function collect(button, dlg) {
  const form = button?.form
    || (button instanceof HTMLElement ? button.closest("form") : null)
    || button?.closest?.("form")
    || dlg?.element?.querySelector?.("form")
    || dlg?.form
    || dlg?.element;
  const out = {};
  if (!form) return out;
  const fields = form.elements
    || form.querySelectorAll?.("input[name], select[name], textarea[name]")
    || [];
  for (const el of fields) {
    if (!el?.name) continue;
    out[el.name] = el.type === "checkbox" ? !!el.checked : el.value;
  }
  return out;
}

export async function pickPowers(result, actor = null, useUpb = false) {
  if (useUpb || result.useUpb) {
    const { pickUpbPowers } = await import("./wizard-upb.mjs");
    return pickUpbPowers(result, actor);
  }
  const needed = Math.max(0, Number(result.counts?.powers?.[0] ?? 0));
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
    if (catRoll == null) return selected;
    const cat = { roll: catRoll, ...lookupTable(POWER_CATEGORIES, catRoll) };
    const list = POWER_CATALOG[cat.id] ?? [];
    const choice = await dialog("Power slot " + (spent + 1) + " of " + needed + " (" + remaining + " slot" + (remaining === 1 ? "" : "s") + " left)",
      "<p>Category <strong>" + esc(cat.label) + "</strong> (d100 " + cat.roll + "). Choose the Power. A power marked counts-as-two spends two of the " + needed + " slots. Rank uses column " + result.origin.column + ".</p>" +
      "<p class='hint'>Used " + spent + " / " + needed + " slots. Current powers: " + (selected.map((p) => p.name + (p.cost === 2 ? " (2)" : "")).join(", ") || "none") + ".</p>" +
      "<div class='form-group'><label>Power</label><select name='power'>" + options(list) + "</select></div>" +
      "<div class='form-group'><label>Custom name</label><input name='custom' type='text' /></div>", [
      { action: "add", label: "Add Power", icon: "fa-solid fa-plus", default: true, callback: (_e, b, d) => ({ action: "add", ...collect(b, d) }) },
      { action: "reroll", label: "Reroll Category", icon: "fa-solid fa-rotate" },
      { action: "skip", label: "Skip Remaining" },
      { action: "cancel", label: "Keep What I Have" }
    ]);
    if (!choice || choice === "cancel" || choice === "skip") break;
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
      body: "Roll 1d100 on Random Ranks column " + result.origin.column + " for " + name + ".",
      flavor: (actor?.name || "Hero") + " - " + name + " rank",
      actor
    });
    if (rankRoll == null) break;
    const rank = rollOnColumn(result.origin.column, rankRoll);
    const entry = {
      name, category: cat.label, rank, rankRoll, cost, slotsTaken: cost,
      bodyArmor: /body armor/i.test(name),
      forceField: /force field/i.test(name)
    };
    selected.push(entry);
    spent += cost;
    if (actor) {
      await writeGeneratedItem(actor, "power", name, {
        rank, number: 0, category: cat.label, slotsTaken: cost,
        bodyArmor: entry.bodyArmor, forceField: entry.forceField,
        notes: rankRoll ? ("Generation roll " + rankRoll) : ""
      });
    }
    ui.notifications.info(name + ": " + rankLabel(rank) + " · " + cost + " slot" + (cost === 2 ? "s" : "") + " (" + spent + "/" + needed + ")");
  }
  return selected;
}

export async function pickTalents(result, actor = null) {
  const useUpb = !!(result.useUpb);
  const pair = parseCountPair(result.counts?.talents, [1, 4]);
  const needed = pair[0];
  const cap = Math.min(useUpb ? 8 : 6, pair[1]);
  const selected = [];
  const hitech = result.origin?.id === "hitech";

  async function chooseOne(slot, buyingExtra = false) {
    let heading;
    let list;
    if (hitech && selected.length === 0) {
      list = [].concat(TALENT_CATALOG.scientific || [], TALENT_CATALOG.professional || []);
      heading = "Scientific / Professional (required for Hi-Tech)";
    } else {
      const catRoll = await promptedD100({
        title: "Talent category " + slot,
        body: buyingExtra
          ? "Extra Talent " + slot + " of max " + cap + " (starting allotment was " + needed + "). Roll the Talent Categories table."
          : "Roll 1d100 on the Talent Categories table for starting Talent " + slot + " of " + needed + " (max " + cap + "). This is not a Power roll.",
        flavor: (actor?.name || "Hero") + " - Talent category " + slot,
        actor
      });
      if (catRoll == null) return "keep";
      const cat = { roll: catRoll, ...lookupTable(TALENT_CATEGORIES, catRoll) };
      list = TALENT_CATALOG[cat.id] ?? [];
      heading = cat.label + " (d100 " + cat.roll + ")";
    }
    const choice = await dialog(
      buyingExtra
        ? "Extra Talent " + slot + " / max " + cap
        : "Starting Talent " + slot + " of " + needed,
      "<p>Category <strong>" + esc(heading) + "</strong>.</p>" +
      "<p class='hint'>Starting Talents are " + needed + " (max " + cap + ").</p>" +
      "<div class='form-group'><label>Talent</label><select name='talent'>" + options(list) + "</select></div>" +
      "<div class='form-group'><label>Custom name</label><input name='custom' type='text' /></div>", [
      { action: "add", label: "Add Talent", icon: "fa-solid fa-plus", default: true, callback: (_e, b, d) => ({ action: "add", ...collect(b, d) }) },
      { action: "reroll", label: "Reroll Category", icon: "fa-solid fa-rotate" },
      { action: "skip", label: "Skip Remaining" },
      { action: "cancel", label: "Keep What I Have" }
    ]);
    if (!choice || choice === "cancel") return "keep";
    if (choice === "skip") return "keep";
    if (choice === "reroll") return "reroll";
    const name = String((choice.custom || "").trim() || choice.talent || "").trim();
    if (!name) return "reroll";
    selected.push({ name, category: heading });
    if (actor) await writeGeneratedItem(actor, "talent", name, { category: heading, rank: "typical", number: 0 });
    ui.notifications.info("Talent " + selected.length + "/" + needed + " starting (max " + cap + "): " + name);
    return "added";
  }

  for (let slot = 1; slot <= needed; slot++) {
    let outcome = "reroll";
    while (outcome === "reroll") outcome = await chooseOne(slot, false);
    if (outcome === "keep") break;
  }

  while (selected.length < cap) {
    const extra = await dialog(
      "Extra Talent? " + selected.length + " of " + needed + " starting, max " + cap,
      "<p>Starting allotment is filled or skipped (" + needed + "). Table maximum is " + cap + ".</p>" +
      "<p class='hint'>Advanced Set: each Talent above the initial number costs -1 CS starting Resources.</p>",
      [
        { action: "add", label: "Buy extra (-1 CS Resources)" },
        { action: "done", label: "Done with Talents", default: true },
        { action: "cancel", label: "Keep What I Have" }
      ]
    );
    if (!extra || extra === "cancel" || extra === "done" || extra === "skip") break;
    const { shiftRank } = await import("./config.mjs");
    result.resources = shiftRank(result.resources, -1);
    if (actor) {
      try {
        const { rankMin } = await import("./config.mjs");
        await actor.update({
          "system.resources.rank": result.resources,
          "system.resources.number": rankMin(result.resources)
        });
      } catch {}
    }
    ui.notifications.info("Bought an extra Talent. Resources now " + result.resources + ".");
    let outcome = "reroll";
    while (outcome === "reroll") outcome = await chooseOne(selected.length + 1, true);
    if (outcome === "keep") break;
  }
  return selected;
}

export async function pickContacts(count, max, originId, actor = null) {
  const selected = [];
  const target = originId === "alien" ? Math.min(1, count) : Math.max(0, Number(count) || 0);
  const cap = Math.max(target, Number(max) || target);

  async function addFromChoice(choice) {
    const name = String((choice.name || "").trim() || choice.type || "Contact").trim();
    selected.push({ name, type: choice.type || "" });
    if (actor) {
      await writeGeneratedItem(actor, "contact", name, {
        category: choice.type || "",
        occupation: choice.type || name,
        rank: "typical",
        number: 0
      });
    }
  }

  if (target <= 0) {
    const extra = await dialog("Contacts",
      "<p>Rolled 0 starting Contacts (max " + cap + "). Add one?</p>" +
      "<div class='form-group'><label>Type</label><select name='type'>" + options(CONTACT_TYPES) + "</select></div>" +
      "<div class='form-group'><label>Name</label><input name='name' type='text' /></div>", [
      { action: "add", label: "Add Contact", callback: (_e, b, d) => ({ action: "add", ...collect(b, d) }) },
      { action: "skip", label: "No Contacts", default: true },
      { action: "cancel", label: "Keep What I Have" }
    ]);
    if (!extra || extra === "cancel" || extra === "skip") return [];
    await addFromChoice(extra);
    return selected;
  }
  for (let i = 0; i < target; i++) {
    const alienNote = originId === "alien" ? "<p class='hint'>Aliens may have one Contact, usually their people.</p>" : "";
    const choice = await dialog("Contact " + (i + 1) + " of " + target + " (max " + cap + ")",
      alienNote +
      "<div class='form-group'><label>Type</label><select name='type'>" + options(CONTACT_TYPES) + "</select></div>" +
      "<div class='form-group'><label>Name</label><input name='name' type='text' /></div>", [
      { action: "add", label: "Add Contact", icon: "fa-solid fa-plus", default: true, callback: (_e, b, d) => ({ action: "add", ...collect(b, d) }) },
      { action: "skip", label: "Skip Remaining" },
      { action: "cancel", label: "Keep What I Have" }
    ]);
    if (!choice || choice === "cancel" || choice === "skip") break;
    await addFromChoice(choice);
  }
  return selected;
}

export async function pickWeakness(actor = null, useUpb = false) {
  if (useUpb) {
    const { pickUpbWeakness } = await import("./wizard-upb.mjs");
    return pickUpbWeakness(actor);
  }
  const choice = await dialog("Weakness (optional)",
    "<p>Optional Advanced Set limitation. Written onto the hero notes.</p>" +
    "<div class='form-group'><label>Weakness</label><select name='weakness'>" + options(WEAKNESSES) + "</select></div>" +
    "<div class='form-group'><label>Notes</label><input name='notes' type='text' /></div>", [
    { action: "ok", label: "Finish Hero", icon: "fa-solid fa-check", default: true, callback: (_e, b, d) => ({ action: "ok", ...collect(b, d) }) },
    { action: "skip", label: "No Weakness" },
    { action: "cancel", label: "Finish Without Weakness" }
  ]);
  if (!choice || choice === "cancel" || choice === "skip") return "";
  if (!choice.weakness || choice.weakness === "None") return "";
  return choice.notes ? (choice.weakness + ": " + choice.notes) : choice.weakness;
}

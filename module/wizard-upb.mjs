import { rankLabel, rollOnColumn } from "./config.mjs";
import { promptedD100 } from "./dice/percentile.mjs";
import { dialog, collect, options, esc } from "./wizard-picks.mjs";
import {
  UPB_POWER_CLASSES, UPB_POWERS, lookupBand, lookupUpbPower,
  UPB_WEAKNESS_STIMULUS, UPB_WEAKNESS_EFFECT, UPB_WEAKNESS_DURATION
} from "./data/upb.mjs";

function two(name, rolled) {
  return /counts as two/i.test(name) || !!(rolled && rolled.countsAsTwo);
}

export async function pickUpbPowers(result, actor) {
  const needed = result.counts.powers[0];
  const selected = [];
  let spent = 0;
  while (spent < needed) {
    const remaining = needed - spent;
    const slot = selected.length + 1;
    const classRoll = await promptedD100({
      title: "UPB Power Class " + slot,
      body: "Roll 1d100 on the Ultimate Powers Book Power Class table for slot " + slot + " of " + needed + ".",
      flavor: (actor?.name || "Hero") + " - UPB power class " + slot,
      actor
    });
    if (classRoll == null) return null;
    const cls = lookupBand(UPB_POWER_CLASSES, classRoll);
    const specRoll = await promptedD100({
      title: "UPB " + cls.label + " Power",
      body: "Roll 1d100 on the " + cls.label + " list. Counts-as-two powers spend two slots.",
      flavor: (actor?.name || "Hero") + " - UPB " + cls.label,
      actor
    });
    if (specRoll == null) return null;
    const rolled = lookupUpbPower(cls.id, specRoll);
    const list = (UPB_POWERS[cls.id] ?? []).map((row) => row.countsAsTwo ? row.name + " (counts as two)" : row.name);
    const rolledName = rolled.countsAsTwo ? rolled.name + " (counts as two)" : rolled.name;
    const choice = await dialog("UPB Power " + slot + " of " + needed,
      "<p>Class <strong>" + esc(cls.label) + "</strong> (" + classRoll + ") then <strong>" + esc(rolledName) + "</strong> (" + specRoll + ").</p>" +
      "<div class='form-group'><label>Power</label><select name='power'>" + options(list, rolledName) + "</select></div>" +
      "<div class='form-group'><label>Custom name</label><input name='custom' type='text' /></div>", [
      { action: "add", label: "Add Power", icon: "fa-solid fa-plus", default: true, callback: (_e, b) => ({ action: "add", ...collect(b) }) },
      { action: "reroll", label: "Reroll Class", icon: "fa-solid fa-rotate" },
      { action: "skip", label: "Skip Remaining" },
      { action: "cancel", label: "Stop" }
    ]);
    if (!choice || choice === "cancel") return null;
    if (choice === "skip") break;
    if (choice === "reroll") continue;
    const name = (choice.custom || "").trim() || choice.power;
    if (!name) continue;
    if (two(name, rolled) && remaining < 2) {
      ui.notifications.warn(name + " costs two Power slots.");
      continue;
    }
    const cost = two(name, rolled) ? 2 : 1;
    const rankRoll = await promptedD100({
      title: "Power rank - " + name,
      body: "Roll 1d100 on Random Ranks column " + result.origin.column + " for <strong>" + esc(name) + "</strong>.",
      flavor: (actor?.name || "Hero") + " - " + name + " rank",
      actor
    });
    if (rankRoll == null) return null;
    const rank = rollOnColumn(result.origin.column, rankRoll);
    selected.push({
      name: name.replace(/ \(counts as two\)$/i, ""),
      category: cls.label,
      rank,
      rankRoll,
      cost,
      bodyArmor: /body armor|armor skin|body resistance/i.test(name),
      forceField: /force field/i.test(name)
    });
    spent += cost;
    ui.notifications.info(name + ": " + rankLabel(rank));
  }
  return selected;
}

export async function pickUpbWeakness(actor) {
  const s = await promptedD100({ title: "Weakness Stimulus", body: "UPB: roll 1d100 for Weakness Stimulus.", flavor: "Weakness stimulus", actor });
  if (s == null) return null;
  const e = await promptedD100({ title: "Weakness Effect", body: "UPB: roll 1d100 for Weakness Effect.", flavor: "Weakness effect", actor });
  if (e == null) return null;
  const d = await promptedD100({ title: "Weakness Duration", body: "UPB: roll 1d100 for Weakness Duration.", flavor: "Weakness duration", actor });
  if (d == null) return null;
  const stim = lookupBand(UPB_WEAKNESS_STIMULUS, s).label;
  const eff0 = lookupBand(UPB_WEAKNESS_EFFECT, e).label;
  const dur = lookupBand(UPB_WEAKNESS_DURATION, d).label;
  const choice = await dialog("UPB Weakness",
    "<p><strong>Stimulus:</strong> " + stim + " (" + s + ")<br><strong>Effect:</strong> " + eff0 + " (" + e + ")<br><strong>Duration:</strong> " + dur + " (" + d + ")</p>" +
    "<p>If no Power exceeds Remarkable, Fatal may become Incapacitation.</p>" +
    "<div class='form-group'><label>Notes</label><input name='notes' type='text' /></div>" +
    "<div class='form-group'><label><input type='checkbox' name='convertFatal' /> Convert Fatal to Incapacitation</label></div>", [
    { action: "ok", label: "Accept Weakness", default: true, callback: (_e, b) => ({ action: "ok", ...collect(b) }) },
    { action: "skip", label: "No Weakness" },
    { action: "cancel", label: "Stop" }
  ]);
  if (!choice || choice === "cancel") return null;
  if (choice === "skip") return "";
  let effect = eff0;
  if (choice.convertFatal && effect === "Fatal") effect = "Incapacitation";
  const note = (choice.notes || "").trim();
  return stim + " / " + effect + " / " + dur + (note ? " - " + note : "");
}

import { rankLabel, rollOnColumn, shiftRank, rankMin } from "./config.mjs";
import { promptedD100 } from "./dice/percentile.mjs";
import { dialog, collect, options, esc } from "./wizard-picks.mjs";
import {
  UPB_POWER_CLASSES, UPB_POWERS, lookupBand, lookupUpbPower,
  UPB_WEAKNESS_STIMULUS, UPB_WEAKNESS_EFFECT, UPB_WEAKNESS_DURATION,
  UPB_PHYSICAL_FORMS, UPB_ORIGINS_OF_POWER, UPB_COMPOUND_COUNT, applyUpbForm
} from "./data/upb.mjs";

export async function pickUpbPrelude(actor) {
  const formList = UPB_PHYSICAL_FORMS.map((f) => f.label);
  const formRoll = await promptedD100({
    title: "UPB Physical Form",
    body: "Roll 1d100 on the Ultimate Powers Book Physical Form table, or pick a form after the roll.",
    flavor: (actor?.name || "Hero") + " - Physical form",
    actor
  });
  if (formRoll == null) return null;
  let form = lookupBand(UPB_PHYSICAL_FORMS, formRoll);
  const formChoice = await dialog("Physical Form",
    "<p>Rolled <strong>" + esc(form.label) + "</strong> (" + formRoll + "). Column " + form.column + ".</p>" +
    "<p class='hint'>" + esc(form.notes) + "</p>" +
    "<div class='form-group'><label>Form</label><select name='form'>" + options(formList, form.label) + "</select></div>", [
      { action: "ok", label: "Use Form", default: true, callback: (_e, b) => ({ action: "ok", ...collect(b) }) },
      { action: "cancel", label: "Stop" }
    ]);
  if (!formChoice || formChoice === "cancel") return null;
  form = UPB_PHYSICAL_FORMS.find((f) => f.label === formChoice.form) || form;

  let aspects = [];
  if (form.rollAspects) {
    const nRoll = await promptedD100({
      title: form.label + " aspects",
      body: "01-50 two aspects, 51-75 three, 76-95 four, 96-00 five.",
      flavor: (actor?.name || "Hero") + " - " + form.label + " count",
      actor
    });
    if (nRoll == null) return null;
    const band = lookupBand(UPB_COMPOUND_COUNT, nRoll);
    for (let i = 0; i < band.n; i++) {
      const aRoll = await promptedD100({
        title: "Aspect " + (i + 1) + " of " + band.n,
        body: "Roll 1d100 on the Physical Form table for aspect " + (i + 1) + ".",
        flavor: (actor?.name || "Hero") + " - form aspect " + (i + 1),
        actor
      });
      if (aRoll == null) return null;
      const aspect = lookupBand(UPB_PHYSICAL_FORMS, aRoll);
      aspects.push(aspect.label + " (" + aRoll + ")");
    }
    form = { ...form, notes: form.notes + " Aspects (" + band.keep + " traits kept): " + aspects.join("; ") };
  }

  if (form.pickAngelDemon) {
    const side = await dialog("Angel or Demon",
      "<p>Angels gain +2 CS Popularity and a magical sword. Demons lose −2 CS Popularity and gain Good Fire Generation plus heat invulnerability.</p>" +
      "<div class='form-group'><label>Type</label><select name='side'><option value='angel'>Angel</option><option value='demon'>Demon</option></select></div>", [
        { action: "ok", label: "Continue", default: true, callback: (_e, b) => ({ action: "ok", ...collect(b) }) },
        { action: "cancel", label: "Stop" }
      ]);
    if (!side || side === "cancel") return null;
    if (side.side === "demon") {
      form = { ...form, label: "Demon", popularityCs: -2, bonusPowers: ["Fire Generation", "Resistance to Fire and Heat"] };
    } else {
      form = { ...form, label: "Angel", popularityCs: 2, bonusPowers: ["Artifact Creation (magical sword)"] };
    }
  }

  const originList = UPB_ORIGINS_OF_POWER.map((o) => o.label);
  const originRoll = await promptedD100({
    title: "UPB Origin of Power",
    body: "Roll 1d100 on the Origin of Power table (Natal, Maturity, Self-Achievement, Endowment, Mishap, Procedure, Creation, Biological / Chemical / Energy Exposure, Rebirth).",
    flavor: (actor?.name || "Hero") + " - Origin of Power",
    actor
  });
  if (originRoll == null) return null;
  let originOfPower = lookupBand(UPB_ORIGINS_OF_POWER, originRoll);
  const originChoice = await dialog("Origin of Power",
    "<p>Rolled <strong>" + esc(originOfPower.label) + "</strong> (" + originRoll + ").</p>" +
    "<p class='hint'>" + esc(originOfPower.notes) + "</p>" +
    "<div class='form-group'><label>Origin</label><select name='origin'>" + options(originList, originOfPower.label) + "</select></div>", [
      { action: "ok", label: "Use Origin", default: true, callback: (_e, b) => ({ action: "ok", ...collect(b) }) },
      { action: "cancel", label: "Stop" }
    ]);
  if (!originChoice || originChoice === "cancel") return null;
  originOfPower = UPB_ORIGINS_OF_POWER.find((o) => o.label === originChoice.origin) || originOfPower;
  return { form, originOfPower, formRoll, originRoll, aspects };
}

export function finalizeUpbResult(result, prelude) {
  if (!result || !prelude) return result;
  applyUpbForm(result, prelude.form, { shiftRank, rankMin });
  result.originOfPower = prelude.originOfPower;
  result.origin = {
    id: result.origin?.id || "other",
    label: prelude.form.label,
    column: prelude.form.column,
    notes: prelude.form.notes + " Origin of Power: " + prelude.originOfPower.label + ". " + prelude.originOfPower.notes
  };
  return result;
}

function two(name, rolled) {
  return /counts as two/i.test(name) || !!(rolled && rolled.countsAsTwo);
}

export async function pickUpbPowers(result, actor) {
  const needed = result.counts.powers[0];
  const selected = [];
  for (const bonus of result.bonusPowers || []) {
    selected.push({
      name: bonus,
      category: "Form bonus",
      rank: "good",
      rankRoll: 0,
      cost: 0,
      bodyArmor: /armor/i.test(bonus),
      forceField: /force field/i.test(bonus)
    });
  }
  if (result.requireTravel) {
    ui.notifications.info("Deity form: at least one Power should be a Travel Power.");
  }
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
      body: "Roll 1d100 on the " + cls.label + " list. Powers marked counts-as-two spend two slots.",
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
    const cost = two(name, rolled) && remaining >= 2 ? 2 : (two(name, rolled) ? 0 : 1);
    if (two(name, rolled) && remaining < 2) {
      ui.notifications.warn(name + " costs two Power slots.");
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
      name: name.replace(/ \(counts as two\)$/i, ""),
      category: cls.label,
      rank,
      rankRoll,
      cost: cost || 1,
      bodyArmor: /body armor|armor skin|body resistance/i.test(name),
      forceField: /force field/i.test(name)
    });
    spent += selected[selected.length - 1].cost;
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

import { ORIGINS, ABILITIES, rankLabel } from "./config.mjs";
import { generateHero, applyGeneration } from "./chargen.mjs";
import { rollHeroDice } from "./roll-hero-dice.mjs";
import { dialog, collect, pickPowers, pickTalents, pickContacts, pickWeakness } from "./wizard-picks.mjs";
import { isUpbEnabled, wantUpb } from "./data/upb.mjs";

function abilityRows(result) {
  return ABILITIES.map((key) => {
    const label = key.charAt(0).toUpperCase() + key.slice(1);
    return `<tr><td>${label}</td><td>${result.abilityRolls[key]}</td><td>${rankLabel(result.abilities[key])}</td><td>${result.numbers[key]}</td></tr>`;
  }).join("");
}

export async function createActorWizard() {
  const originOpts = ORIGINS.map((o) => `<option value="${o.id}">${o.label}</option>`).join("");
  const choice = await dialog("Create FASERIP Hero — Identity", `
      <p>Generation: Origin → Abilities → Resources → Powers → Talents → Contacts.</p>
      <div class="form-group"><label>Hero name</label><input name="heroName" type="text" value="New Hero" autofocus /></div>
      <div class="form-group"><label>Public identity</label><input name="publicId" type="text" /></div>
      <div class="form-group"><label>Secret identity</label><input name="secretName" type="text" /></div>
      <div class="form-group"><label>Actor type</label><select name="actorType"><option value="hero">Hero</option><option value="npc">NPC</option></select></div>
      <div class="form-group"><label>Origin</label><select name="origin">${originOpts}</select></div>
      <div class="form-group"><label><input type="checkbox" name="rollOrigin" checked /> Roll Advanced Set origin</label></div>
      <div class="form-group"><label><input type="checkbox" name="secretId" /> Secret identity</label></div>
      <div class="form-group"><label><input type="checkbox" name="guided" checked /> Run full generation now</label></div>
      <div class="form-group"><label><input type="checkbox" name="useUpb" ${isUpbEnabled() ? "checked" : ""} /> Use Ultimate Powers Book (MA3) tables</label></div>`, [
    { action: "create", label: "Continue", icon: "fa-solid fa-dice", default: true, callback: (_e, b) => ({ action: "create", ...collect(b) }) },
    { action: "cancel", label: "Cancel" }
  ]);
  if (!choice || choice === "cancel") return null;
  const extras = {
    name: choice.heroName || "New Hero", type: choice.actorType || "hero",
    publicId: choice.publicId || "", secretName: choice.secretName || "",
    originId: choice.origin || "altered", rollOrigin: !!choice.rollOrigin,
    secretId: !!choice.secretId,
    guided: choice.guided !== false && choice.guided !== "false",
    useUpb: wantUpb(choice.useUpb)
  };
  const actor = await CONFIG.Actor.documentClass.create({
    name: extras.name, type: extras.type,
    system: { identity: { public: extras.publicId, secret: extras.secretName, origin: "", secretId: extras.secretId } },
    flags: { faserip: { generating: true } }
  }, { renderSheet: false });
  if (!actor) return null;
  if (extras.guided) await runFullGeneration(actor, extras);
  await actor.unsetFlag("faserip", "generating");
  try { actor.sheet?.render(true); } catch { actor.sheet?.render?.({ force: true }); }
  return actor;
}

export async function runFullGeneration(actor, extras = {}) {
  extras.useUpb = wantUpb(extras.useUpb);
  try { actor.sheet?.close(); } catch {}
  let prelude = null;
  if (extras.useUpb) {
    const { pickUpbPrelude } = await import("./wizard-upb.mjs");
    prelude = await pickUpbPrelude(actor);
    if (!prelude) return false;
    await actor.update({
      "system.identity.form": prelude.form.label,
      "system.identity.originOfPower": prelude.originOfPower.label,
      "system.identity.origin": prelude.originOfPower.label
    });
  }
  let result = await rollHeroDice(actor, {
    originId: extras.originId,
    rollOrigin: extras.useUpb ? false : extras.rollOrigin,
    useUpb: extras.useUpb,
    column: prelude?.form?.column,
    originLabel: prelude?.form?.label,
    skipOriginMods: !!extras.useUpb
  });
  if (!result) return false;
  if (prelude) {
    const { finalizeUpbResult } = await import("./wizard-upb.mjs");
    result = finalizeUpbResult(result, prelude);
  }
  const abilitiesOk = await reviewAbilities(actor, result, extras);
  if (!abilitiesOk) return false;
  result = abilitiesOk.result;
  extras.raise = abilitiesOk.raise;
  const selectedPowers = (await pickPowers(result, actor, extras.useUpb)) || [];
  const selectedTalents = (await pickTalents(result, actor)) || [];
  let contactSlots = Number(result.counts?.contacts?.[0] || 0);
  if (selectedTalents.some((t) => /Journalism/i.test(t.name))) contactSlots += 2;
  const selectedContacts = (await pickContacts(contactSlots, result.counts?.contacts?.[1] ?? 4, result.origin.id, actor)) || [];
  const weakness = (await pickWeakness(actor, extras.useUpb)) || "";
  if (selectedTalents.some((t) => /Heir to Fortune/i.test(t.name))) result.resources = "amazing";
  try {
    await applyGeneration(actor, result, {
      raiseAbility: extras.raise, secretId: extras.secretId,
      powers: selectedPowers, talents: selectedTalents, contacts: selectedContacts, weakness
    });
  } catch (err) {
    console.error("FASERIP | applyGeneration failed", err);
    ui.notifications.error("Generation stats saved but items failed: " + err.message);
  }
  await actor.update({
    "system.identity.public": extras.publicId || actor.system.identity.public,
    "system.identity.secret": extras.secretName || actor.system.identity.secret
  });
  await actor.setFlag("faserip", "generation", {
    origin: result.origin.label || result.origin.id,
    form: result.form?.label || "", originOfPower: result.originOfPower?.label || "",
    upb: !!extras.useUpb,
    powers: selectedPowers.map((p) => p.name),
    talents: selectedTalents.map((t) => t.name),
    contacts: selectedContacts.map((c) => c.name),
    weakness, powerCount: result.counts.powers, talentCount: result.counts.talents, contactCount: result.counts.contacts
  });
  ui.notifications.info(`${actor.name}: ${selectedPowers.length} powers, ${selectedTalents.length} talents, ${selectedContacts.length} contacts.`);
  try { actor.sheet?.render(true); } catch { actor.sheet?.render?.({ force: true }); }
  return true;
}

async function reviewAbilities(actor, result, extras) {
  const raiseOptions = ABILITIES.map((k) => `<option value="${k}">${k}</option>`).join("");
  const canRaise = result.origin.id === "altered" || result.formRaiseOne;
  const raiseBlock = canRaise
    ? `<div class="form-group"><label>Raise one primary ability +1 CS</label><select name="raise">${raiseOptions}</select></div>`
    : `<input type="hidden" name="raise" value="" />`;
  const health = ["fighting", "agility", "strength", "endurance"].reduce((s, k) => s + result.numbers[k], 0);
  const karma = ["reason", "intuition", "psyche"].reduce((s, k) => s + result.numbers[k], 0);
  const choice = await dialog(`Abilities — ${result.origin.label}`, `
      <p><strong>${result.form ? "Form" : "Origin"}:</strong> ${result.origin.label} (column ${result.origin.column})</p>
      <p class="hint">${result.origin.notes}</p>
      <table class="chargen-table"><thead><tr><th>Ability</th><th>d100</th><th>Rank</th><th>#</th></tr></thead>
      <tbody>${abilityRows(result)}</tbody></table>
      <p><strong>Health</strong> ${health} &nbsp; <strong>Karma</strong> ${karma}</p>
      <p><strong>Resources:</strong> ${rankLabel(result.resources)} — ${result.resourceMod.label} (roll ${result.resourceModRoll})</p>
      <p>Powers ${result.counts.powers[0]}/${result.counts.powers[1]} · Talents ${result.counts.talents[0]}/${result.counts.talents[1]} · Contacts ${result.counts.contacts[0]}/${result.counts.contacts[1]}</p>
      ${raiseBlock}`, [
    { action: "next", label: "Choose Powers", icon: "fa-solid fa-bolt", default: true, callback: (_e, b) => ({ action: "next", ...collect(b) }) },
    { action: "reroll", label: "Reroll Abilities" },
    { action: "cancel", label: "Stop" }
  ]);
  if (!choice || choice === "cancel") return null;
  if (choice === "reroll") {
    const reroll = await rollHeroDice(actor, {
      originId: result.origin.id, rollOrigin: false, useUpb: extras.useUpb,
      column: result.form?.column || result.column,
      originLabel: result.form?.label || result.origin.label,
      skipOriginMods: !!extras.useUpb
    });
    if (!reroll) return null;
    if (result.form) {
      const { finalizeUpbResult } = await import("./wizard-upb.mjs");
      finalizeUpbResult(reroll, { form: result.form, originOfPower: result.originOfPower });
    }
    return reviewAbilities(actor, reroll, extras);
  }
  return { result, raise: choice.raise || null };
}

export function attachDirectoryButton(app, element) {
  const root = element instanceof HTMLElement ? element : element?.[0];
  if (!root || root.querySelector(".faserip-generate")) return;
  const header = root.querySelector(".header-actions") || root.querySelector(".directory-header") || root.querySelector("header") || root;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "faserip-generate";
  btn.innerHTML = `<i class="fa-solid fa-dice"></i> Generate Hero`;
  btn.addEventListener("click", (event) => {
    event.preventDefault();
    createActorWizard().catch((err) => ui.notifications.error(`Hero generation failed: ${err.message}`));
  });
  header.prepend(btn);
}

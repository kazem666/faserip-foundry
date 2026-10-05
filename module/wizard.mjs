import { ABILITIES, rankLabel } from "./config.mjs";
import { applyGeneration } from "./chargen.mjs";
import { rollHeroDice } from "./roll-hero-dice.mjs";
import { dialog, collect, pickPowers, pickTalents, pickContacts, pickWeakness } from "./wizard-picks.mjs";
import { wantUpb } from "./data/upb.mjs";
import { wantRom } from "./data/rom.mjs";
import { wantUltimateTalents } from "./data/ultimate-talents.mjs";
import {
  ARCHETYPE_CHOICES, tuneArchetypeResult, promptArchetypeExtras,
  packagePowers, pickMartialPowers, pickImplants, vampireWeakness, symbioteWeakness,
  writeHeightWeight, writeCalling, writeQuirk, writeLifeDetails
} from "./life.mjs";
import { symbioteStandardRows } from "./data/symbiote.mjs";

function abilityRows(result) {
  return ABILITIES.map((key) => {
    const label = key.charAt(0).toUpperCase() + key.slice(1);
    return `<tr><td>${label}</td><td>${result.abilityRolls[key]}</td><td>${rankLabel(result.abilities[key])}</td><td>${result.numbers[key]}</td></tr>`;
  }).join("");
}

export async function createActorWizard() {
  const { openCreator } = await import("./apps/creator-app.mjs");
  return openCreator();
}

export async function runFullGeneration(actor, extras = {}) {
  extras.useUpb = wantUpb(extras.useUpb);
  extras.useUltimateTalents = wantUltimateTalents(extras.useUltimateTalents);
  extras.useRom = wantRom(extras.useRom);
  try { await actor.sheet?.close?.({ submit: false }); } catch {}
  if (extras.rolled) {
    const result = extras.rolled;
    result.useUltimateTalents = !!extras.useUltimateTalents;
    return finishRolledGeneration(actor, result, extras);
  }
  let prelude = null;
  if (extras.useUpb && !extras.archetype) {
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
    originLabel: extras.originLabel || prelude?.form?.label,
    skipOriginMods: !!extras.useUpb || !!extras.archetype,
    rankFor: extras.rankFor,
    fixedAbilities: extras.fixedAbilities
  });
  if (!result) return false;
  tuneArchetypeResult(result, extras.archetype);
  result.useUltimateTalents = !!extras.useUltimateTalents;
  if (prelude) {
    const { finalizeUpbResult } = await import("./wizard-upb.mjs");
    result = finalizeUpbResult(result, prelude);
  }
  const abilitiesOk = await reviewAbilities(actor, result, extras);
  if (!abilitiesOk) return false;
  result = abilitiesOk.result;
  result.useUltimateTalents = !!extras.useUltimateTalents;
  extras.raise = abilitiesOk.raise;
  return finishRolledGeneration(actor, result, extras);
}

async function finishRolledGeneration(actor, result, extras) {
  let selectedPowers = [];
  let selectedTalents = [];
  let romPrelude = null;
  if (extras.archetype) {
    try { await promptArchetypeExtras(actor, result, extras.archetype); } catch (err) {
      console.warn("FASERIP | archetype extras", err);
    }
  }
  if (extras.useRom && !extras.archetype) {
    try {
      const rom = await import("./wizard-rom.mjs");
      romPrelude = await rom.pickRomPrelude(actor, result);
      if (romPrelude) {
        if (romPrelude.type?.id === "enhanced") {
          selectedPowers = (await rom.pickRomEnhancement(romPrelude, actor, result)) || [];
          selectedTalents = (await pickTalents(result, actor)) || [];
        } else {
          if (romPrelude.type?.id === "wielder") result = (await rom.pickRomResources(romPrelude, actor, result)) || result;
          if (romPrelude.type?.id === "items") result = (await rom.applyRomAbilityBonus(romPrelude, actor, result)) || result;
          selectedPowers = (await rom.pickRomSpells(romPrelude, actor)) || [];
          selectedTalents = (await rom.pickRomTalents(romPrelude, actor, result)) || [];
          if (romPrelude.type?.id === "wielder") await rom.noteWielderLife(actor, selectedPowers);
          if (romPrelude.type?.id !== "wielder") selectedTalents = selectedTalents.concat((await pickTalents(result, actor)) || []);
        }
      }
    } catch (err) {
      console.error("FASERIP | Realms of Magic path failed", err);
      ui.notifications.warn("Realms of Magic path failed — continuing with standard picks.");
      romPrelude = null;
    }
  }
  if (extras.archetype === "cyborg") {
    await pickImplants(actor);
    selectedTalents = (await pickTalents(result, actor)) || [];
  } else if (extras.archetype === "martial") {
    selectedPowers = (await pickMartialPowers(actor, result.counts.powers[0])) || [];
    selectedTalents = (await pickTalents(result, actor)) || [];
  } else if (extras.archetype === "vampire") {
    selectedTalents = (await pickTalents(result, actor)) || [];
  } else if (!romPrelude) {
    if (!selectedPowers.length) selectedPowers = (await pickPowers(result, actor, extras.useUpb)) || [];
    if (!selectedTalents.length) selectedTalents = (await pickTalents(result, actor)) || [];
  }
  selectedPowers = selectedPowers.concat(packagePowers(extras.archetype), result.archetypePowers || []);
  let contactSlots = Number(result.counts?.contacts?.[0] || 0);
  if (romPrelude) {
    try {
      const { romContactSlots } = await import("./wizard-rom.mjs");
      contactSlots = Math.max(contactSlots, romContactSlots(romPrelude, selectedPowers));
    } catch {}
  }
  if (selectedTalents.some((t) => /Journalism/i.test(t.name))) contactSlots += 2;
  const selectedContacts = (await pickContacts(contactSlots, result.counts?.contacts?.[1] ?? 4, result.origin.id, actor)) || [];
  let weakness = (await pickWeakness(actor, extras.useUpb)) || "";
  if (extras.archetype === "vampire") weakness = [weakness, vampireWeakness()].filter(Boolean).join(" ");
  if (extras.archetype === "symbiote") weakness = [weakness, symbioteWeakness()].filter(Boolean).join(" ");
  if (result.origin?.id === "symbiote" && !extras.useUpb) {
    const have = new Set(selectedPowers.map((row) => String(row.name || "").toLowerCase()));
    for (const row of symbioteStandardRows()) {
      if (!have.has(row.name.toLowerCase())) selectedPowers.push(row);
    }
  }
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
  let purchasedGear = [];
  try {
    const { pickStartingShop } = await import("./wizard-shop.mjs");
    purchasedGear = (await pickStartingShop(actor, result)) || [];
  } catch (err) {
    console.warn("FASERIP | starting shop skipped", err);
  }
  await actor.update({
    "system.identity.public": extras.publicId || actor.system.identity.public,
    "system.identity.secret": extras.secretName || actor.system.identity.secret,
    "system.identity.archetype": ARCHETYPE_CHOICES.find((row) => row.id === extras.archetype)?.label || ""
  });
  try {
    if (extras.lifeHeight) await writeHeightWeight(actor, { prompt: true });
    if (extras.lifeCalling) await writeCalling(actor, { prompt: true });
    if (extras.lifeQuirk) await writeQuirk(actor, { prompt: true, balanced: true });
    if (extras.lifeDetails) await writeLifeDetails(actor, { prompt: false });
  } catch (err) {
    console.warn("FASERIP | life rolls", err);
  }
  await actor.setFlag("faserip", "generation", {
    origin: result.origin.label || result.origin.id,
    form: result.form?.label || "", originOfPower: result.originOfPower?.label || "",
    upb: !!extras.useUpb, rom: !!extras.useRom, ultimateTalents: !!extras.useUltimateTalents,
    school: romPrelude?.school?.label || "", magicType: romPrelude?.type?.label || "",
    powers: selectedPowers.map((p) => p.name),
    talents: selectedTalents.map((t) => t.name),
    contacts: selectedContacts.map((c) => c.name),
    weakness, gear: purchasedGear,
    powerCount: result.counts.powers, talentCount: result.counts.talents, contactCount: result.counts.contacts
  });
  ui.notifications.info(actor.name + ": " + selectedPowers.length + " powers, " + selectedTalents.length + " talents, " + selectedContacts.length + " contacts, " + purchasedGear.length + " gear item(s).");
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
  const choice = await dialog("Abilities - " + result.origin.label, `
      <p><strong>${result.form ? "Form" : "Origin"}:</strong> ${result.origin.label} (column ${result.origin.column})</p>
      <p class="hint">${result.origin.notes}</p>
      <table class="chargen-table"><thead><tr><th>Ability</th><th>d100</th><th>Rank</th><th>#</th></tr></thead>
      <tbody>${abilityRows(result)}</tbody></table>
      <p><strong>Health</strong> ${health}  <strong>Karma</strong> ${karma}</p>
      <p><strong>Resources:</strong> ${rankLabel(result.resources)} - ${result.resourceMod.label} (roll ${result.resourceModRoll})</p>
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
      originLabel: extras.originLabel || result.form?.label || result.origin.label,
      skipOriginMods: !!extras.useUpb || !!extras.archetype,
      rankFor: extras.rankFor,
      fixedAbilities: extras.fixedAbilities
    });
    if (reroll) tuneArchetypeResult(reroll, extras.archetype);
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
    createActorWizard().catch((err) => ui.notifications.error("Hero generation failed: " + err.message));
  });
  header.prepend(btn);
}

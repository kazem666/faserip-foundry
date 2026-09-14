import { ORIGINS, ABILITIES, rankLabel } from "./config.mjs";
import { applyGeneration, rollHeroDice } from "./chargen.mjs";
import { dialog, collect, pickPowers, pickTalents, pickContacts, pickWeakness } from "./wizard-picks.mjs";

function abilityRows(result) {
  return ABILITIES.map((key) => {
    const label = key.charAt(0).toUpperCase() + key.slice(1);
    return "<tr><td>" + label + "</td><td>" + result.abilityRolls[key] + "</td><td>" + rankLabel(result.abilities[key]) + "</td><td>" + result.numbers[key] + "</td></tr>";
  }).join("");
}

export async function createActorWizard() {
  const originOpts = ORIGINS.map((o) => "<option value='" + o.id + "'>" + o.label + "</option>").join("");
  const choice = await dialog("Create FASERIP Hero — Identity",
    "<p>Next you will be prompted to roll each FASERIP ability one at a time. Dice So Nice will show each 1d100.</p>" +
    "<div class='form-group'><label>Hero name</label><input name='heroName' type='text' value='New Hero' autofocus /></div>" +
    "<div class='form-group'><label>Public identity</label><input name='publicId' type='text' /></div>" +
    "<div class='form-group'><label>Secret identity</label><input name='secretName' type='text' /></div>" +
    "<div class='form-group'><label>Actor type</label><select name='actorType'><option value='hero'>Hero</option><option value='npc'>NPC</option></select></div>" +
    "<div class='form-group'><label>Origin</label><select name='origin'>" + originOpts + "</select></div>" +
    "<div class='form-group'><label><input type='checkbox' name='rollOrigin' /> Roll origin with 1d100</label></div>" +
    "<div class='form-group'><label><input type='checkbox' name='secretId' /> Secret identity</label></div>" +
    "<div class='form-group'><label><input type='checkbox' name='guided' checked /> Run full generation now</label></div>", [
    { action: "create", label: "Continue", icon: "fa-solid fa-dice", default: true, callback: (_e, b) => ({ action: "create", ...collect(b) }) },
    { action: "cancel", label: "Cancel", icon: "fa-solid fa-xmark" }
  ]);
  if (!choice || choice === "cancel") return null;
  const extras = {
    name: choice.heroName || "New Hero",
    type: choice.actorType || "hero",
    publicId: choice.publicId || "",
    secretName: choice.secretName || "",
    originId: choice.origin || "altered",
    rollOrigin: !!choice.rollOrigin,
    secretId: !!choice.secretId,
    guided: choice.guided !== false && choice.guided !== "false"
  };
  const actor = await CONFIG.Actor.documentClass.create({
    name: extras.name,
    type: extras.type,
    system: { identity: { public: extras.publicId, secret: extras.secretName, origin: "", secretId: extras.secretId } }
  }, { renderSheet: false });
  if (!actor) return null;
  if (extras.guided) await runFullGeneration(actor, extras);
  actor.sheet?.render({ force: true });
  return actor;
}

export async function runFullGeneration(actor, extras) {
  ui.notifications.info("Roll each FASERIP ability when prompted.");
  let result = await rollHeroDice(actor, { originId: extras.originId, rollOrigin: extras.rollOrigin });
  if (!result) return false;
  const abilitiesOk = await reviewAbilities(actor, result, extras);
  if (!abilitiesOk) return false;
  result = abilitiesOk.result;
  extras.raise = abilitiesOk.raise;
  const selectedPowers = await pickPowers(result, actor);
  if (selectedPowers === null) return false;
  const selectedTalents = await pickTalents(result, actor);
  if (selectedTalents === null) return false;
  let contactSlots = result.counts.contacts[0];
  if (selectedTalents.some((t) => /Journalism/i.test(t.name))) contactSlots += 2;
  const selectedContacts = await pickContacts(contactSlots, result.counts.contacts[1], result.origin.id);
  if (selectedContacts === null) return false;
  const weakness = await pickWeakness();
  if (weakness === null) return false;
  if (selectedTalents.some((t) => /Heir to Fortune/i.test(t.name))) result.resources = "amazing";
  await applyGeneration(actor, result, {
    raiseAbility: extras.raise,
    secretId: extras.secretId,
    powers: selectedPowers,
    talents: selectedTalents,
    contacts: selectedContacts,
    weakness
  });
  await actor.update({
    "system.identity.public": extras.publicId || actor.system.identity.public,
    "system.identity.secret": extras.secretName || actor.system.identity.secret
  });
  ui.notifications.info(actor.name + ": " + selectedPowers.length + " powers, " + selectedTalents.length + " talents, " + selectedContacts.length + " contacts.");
  return true;
}

async function reviewAbilities(actor, result, extras) {
  const raiseOptions = ABILITIES.map((k) => "<option value='" + k + "'>" + k + "</option>").join("");
  const raiseBlock = result.origin.id === "altered"
    ? "<div class='form-group'><label>Altered Human: raise one primary ability +1 CS</label><select name='raise'>" + raiseOptions + "</select></div>"
    : "<input type='hidden' name='raise' value='' />";
  const health = ["fighting", "agility", "strength", "endurance"].reduce((s, k) => s + result.numbers[k], 0);
  const karma = ["reason", "intuition", "psyche"].reduce((s, k) => s + result.numbers[k], 0);
  const choice = await dialog("Abilities — " + result.origin.label,
    "<p><strong>Origin:</strong> " + result.origin.label + " (column " + result.origin.column + ")</p>" +
    "<p class='hint'>" + result.origin.notes + "</p>" +
    "<table class='chargen-table'><thead><tr><th>Ability</th><th>d100</th><th>Rank</th><th>#</th></tr></thead><tbody>" + abilityRows(result) + "</tbody></table>" +
    "<p><strong>Health</strong> " + health + " &nbsp; <strong>Karma</strong> " + karma + "</p>" +
    "<p><strong>Resources:</strong> " + rankLabel(result.resources) + " — " + result.resourceMod.label + "</p>" +
    "<p>Powers " + result.counts.powers[0] + " · Talents " + result.counts.talents[0] + " · Contacts " + result.counts.contacts[0] + "</p>" +
    raiseBlock, [
    { action: "next", label: "Choose Powers", icon: "fa-solid fa-bolt", default: true, callback: (_e, b) => ({ action: "next", ...collect(b) }) },
    { action: "reroll", label: "Reroll with Dice", icon: "fa-solid fa-rotate" },
    { action: "cancel", label: "Stop" }
  ]);
  if (!choice || choice === "cancel") return null;
  if (choice === "reroll") {
    const again = await rollHeroDice(actor, { originId: result.origin.id, rollOrigin: false });
    if (!again) return null;
    return reviewAbilities(actor, again, extras);
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
  btn.innerHTML = "<i class='fa-solid fa-dice'></i> Generate Hero";
  btn.addEventListener("click", (event) => {
    event.preventDefault();
    createActorWizard().catch((err) => {
      console.error(err);
      ui.notifications.error("Hero generation failed: " + err.message);
    });
  });
  header.prepend(btn);
}

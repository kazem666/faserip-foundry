import { ORIGINS, ABILITIES, rankLabel } from "./config.mjs";
import { generateHero, applyGeneration } from "./chargen.mjs";

function formVal(form, name) {
  const el = form?.querySelector?.(`[name="${name}"]`);
  if (!el) return "";
  if (el.type === "checkbox") return !!el.checked;
  return el.value ?? "";
}

function abilityRows(result) {
  return ABILITIES.map((key) => {
    const label = key.charAt(0).toUpperCase() + key.slice(1);
    return `<tr><td>${label}</td><td>${result.abilityRolls[key]}</td><td>${rankLabel(result.abilities[key])}</td><td>${result.numbers[key]}</td></tr>`;
  }).join("");
}

export async function createActorWizard() {
  const DialogV2 = foundry.applications.api.DialogV2;
  const originOpts = ORIGINS.map((o) => `<option value="${o.id}">${o.label}</option>`).join("");

  const form = await DialogV2.wait({
    window: { title: "Create FASERIP Hero", icon: "fa-solid fa-mask" },
    position: { width: 520 },
    content: `
      <form class="faserip-feat-dialog">
        <p>Advanced Set guided generation. Rank numbers start at the minimum of each rank range. Health = F+A+S+E. Karma = R+I+P.</p>
        <div class="form-group"><label>Hero name</label><input name="name" type="text" value="New Hero" autofocus /></div>
        <div class="form-group"><label>Public identity</label><input name="publicId" type="text" placeholder="Known-as name" /></div>
        <div class="form-group"><label>Secret identity</label><input name="secretName" type="text" placeholder="Civilian name" /></div>
        <div class="form-group">
          <label>Actor type</label>
          <select name="type"><option value="hero">Hero</option><option value="npc">NPC</option></select>
        </div>
        <div class="form-group">
          <label>Origin</label>
          <select name="origin">${originOpts}</select>
        </div>
        <div class="form-group">
          <label><input type="checkbox" name="rollOrigin" /> Roll origin randomly</label>
        </div>
        <div class="form-group">
          <label><input type="checkbox" name="secretId" /> Uses a secret identity</label>
        </div>
        <div class="form-group">
          <label><input type="checkbox" name="guided" checked /> Run generation now</label>
        </div>
      </form>`,
    buttons: [
      { action: "create", label: "Continue", icon: "fa-solid fa-dice", default: true, callback: (_event, button) => button.form },
      { action: "cancel", label: "Cancel", icon: "fa-solid fa-xmark" }
    ],
    rejectClose: false
  });

  if (!form || form === "cancel") return null;

  const name = formVal(form, "name") || "New Hero";
  const type = formVal(form, "type") || "hero";
  const publicId = formVal(form, "publicId");
  const secretName = formVal(form, "secretName");
  const originId = formVal(form, "origin") || "altered";
  const rollOrigin = formVal(form, "rollOrigin");
  const secretId = formVal(form, "secretId");
  const guided = formVal(form, "guided");

  const actor = await Actor.create({
    name,
    type,
    system: { identity: { public: publicId, secret: secretName, origin: "", secretId } }
  }, { renderSheet: false });

  if (!actor) return null;
  if (!guided) {
    actor.sheet?.render(true);
    return actor;
  }

  const result = generateHero({ originId, rollOrigin });
  await reviewGeneration(actor, result, { secretId, publicId, secretName });
  actor.sheet?.render(true);
  return actor;
}

async function reviewGeneration(actor, result, extras) {
  const DialogV2 = foundry.applications.api.DialogV2;
  const raiseOptions = ABILITIES.map((k) => `<option value="${k}">${k}</option>`).join("");
  const raiseBlock = result.origin.id === "altered"
    ? `<div class="form-group"><label>Altered Human: raise one primary ability +1 CS</label><select name="raise">${raiseOptions}</select></div>`
    : `<input type="hidden" name="raise" value="" />`;
  const powerList = result.powerCats.map((c) => `<li>${c.label} (roll ${c.roll})</li>`).join("");
  const talentList = result.talentCats.map((c) => `<li>${c.label} (roll ${c.roll})</li>`).join("");

  const form = await DialogV2.wait({
    window: { title: `Generated — ${result.origin.label}`, icon: "fa-solid fa-user-plus" },
    position: { width: 540 },
    content: `<form class="faserip-feat-dialog">
      <p><strong>Origin:</strong> ${result.origin.label} (column ${result.origin.column})</p>
      <p class="hint">${result.origin.notes}</p>
      <table class="chargen-table"><thead><tr><th>Ability</th><th>d100</th><th>Rank</th><th>#</th></tr></thead><tbody>${abilityRows(result)}</tbody></table>
      <p><strong>Resources:</strong> ${rankLabel(result.resources)} — ${result.resourceMod.label}</p>
      <p><strong>Powers:</strong> ${result.counts.powers[0]} / max ${result.counts.powers[1]}</p><ul>${powerList}</ul>
      <p><strong>Talents:</strong> ${result.counts.talents[0]} / max ${result.counts.talents[1]}</p><ul>${talentList}</ul>
      <p><strong>Contacts:</strong> ${result.counts.contacts[0]} / max ${result.counts.contacts[1]}</p>
      ${raiseBlock}</form>`,
    buttons: [
      { action: "apply", label: "Apply to Hero", icon: "fa-solid fa-check", default: true, callback: (_e, button) => button.form },
      { action: "reroll", label: "Reroll", icon: "fa-solid fa-rotate" },
      { action: "blank", label: "Keep Blank Sheet" }
    ],
    rejectClose: false
  });

  if (!form || form === "blank") return false;
  if (form === "reroll") {
    return reviewGeneration(actor, generateHero({ originId: result.origin.id, rollOrigin: false }), extras);
  }
  const raise = form.querySelector?.('[name="raise"]')?.value || null;
  await applyGeneration(actor, result, { raiseAbility: raise, secretId: extras.secretId });
  await actor.update({
    "system.identity.public": extras.publicId || actor.system.identity.public,
    "system.identity.secret": extras.secretName || actor.system.identity.secret
  });
  await actor.setFlag("faserip", "generation", {
    origin: result.origin.id,
    powers: result.powerCats.map((c) => c.label),
    talents: result.talentCats.map((c) => c.label),
    powerCount: result.counts.powers,
    talentCount: result.counts.talents,
    contactCount: result.counts.contacts
  });
  ui.notifications.info(`${actor.name} generated.`);
  return true;
}

import {
  ABILITIES,
  ORIGINS,
  ORIGIN_TABLE,
  SPECIAL_COUNT_TABLE,
  ABILITY_MODIFIER_TABLE,
  POWER_CATEGORIES,
  TALENT_CATEGORIES,
  rankMin,
  shiftRank,
  lookupTable,
  rollOnColumn,
  originById
} from "./config.mjs";
import { deepClone } from "./foundry-api.mjs";

function d100() {
  return Math.floor(Math.random() * 100) + 1;
}

export function generateHero({ originId = null, rollOrigin = false } = {}) {
  const originRoll = d100();
  const originKey = rollOrigin
    ? lookupTable(ORIGIN_TABLE, originRoll).id
    : (originById(originId || "altered").id);
  const origin = originById(originKey);

  const abilities = {};
  const abilityRolls = {};
  for (const key of ABILITIES) {
    const roll = d100();
    abilityRolls[key] = roll;
    abilities[key] = rollOnColumn(origin.column, roll);
  }

  if (origin.id === "mutant") {
    abilities.endurance = shiftRank(abilities.endurance, 1);
  }
  if (origin.id === "hitech") {
    abilities.reason = shiftRank(abilities.reason, 2);
  }

  const numbers = {};
  for (const key of ABILITIES) numbers[key] = rankMin(abilities[key]);

  const resourceModRoll = d100();
  const resourceMod = lookupTable(ABILITY_MODIFIER_TABLE, resourceModRoll);
  let resources = origin.id === "hitech" ? "good" : origin.id === "alien" ? "poor" : "typical";
  resources = shiftRank(resources, resourceMod.cs);
  if (origin.id === "mutant") resources = shiftRank(resources, -1);

  const powerRoll = d100();
  const talentRoll = d100();
  const contactRoll = d100();
  const counts = {
    powers: lookupTable(SPECIAL_COUNT_TABLE, powerRoll).powers,
    talents: lookupTable(SPECIAL_COUNT_TABLE, talentRoll).talents,
    contacts: lookupTable(SPECIAL_COUNT_TABLE, contactRoll).contacts
  };
  if (origin.id === "mutant") {
    counts.powers[0] = Math.min(5, counts.powers[0] + 1);
  }
  if (origin.id === "alien") {
    counts.powers[0] = Math.max(2, counts.powers[0] - 1);
    counts.contacts[0] = Math.min(1, counts.contacts[0]);
    counts.contacts[1] = 1;
  }

  const powerCats = [];
  for (let i = 0; i < counts.powers[0]; i++) {
    const r = d100();
    powerCats.push({ roll: r, ...lookupTable(POWER_CATEGORIES, r) });
  }
  const talentCats = [];
  for (let i = 0; i < counts.talents[0]; i++) {
    const r = d100();
    talentCats.push({ roll: r, ...lookupTable(TALENT_CATEGORIES, r) });
  }

  let popularity = origin.id === "mutant" || origin.id === "robot" ? 0 : 10;

  return {
    origin,
    originRoll,
    abilities,
    numbers,
    abilityRolls,
    resources,
    resourceModRoll,
    resourceMod,
    counts,
    powerRoll,
    talentRoll,
    contactRoll,
    powerCats,
    talentCats,
    popularity
  };
}

export async function applyGeneration(actor, result, { raiseAbility = null, secretId = false } = {}) {
  const abilities = deepClone(result.abilities);
  const numbers = deepClone(result.numbers);
  if (raiseAbility && abilities[raiseAbility]) {
    abilities[raiseAbility] = shiftRank(abilities[raiseAbility], 1);
    numbers[raiseAbility] = rankMin(abilities[raiseAbility]);
  }

  let popularity = result.popularity;
  if (!secretId && popularity === 10) popularity = 20;
  if (secretId) popularity = Math.max(-5, popularity - 5);

  const update = {
    "system.identity.origin": result.origin.label,
    "system.identity.secretId": !!secretId,
    "system.resources.rank": result.resources,
    "system.resources.number": rankMin(result.resources),
    "system.popularity.value": popularity,
    "system.popularity.secret": secretId ? popularity : popularity
  };
  for (const key of ABILITIES) {
    update[`system.abilities.${key}.rank`] = abilities[key];
    update[`system.abilities.${key}.number`] = numbers[key];
  }
  await actor.update(update);

  const phys = ["fighting", "agility", "strength", "endurance"].reduce((s, k) => s + numbers[k], 0);
  const ment = ["reason", "intuition", "psyche"].reduce((s, k) => s + numbers[k], 0);
  await actor.update({
    "system.health.value": phys,
    "system.karma.value": ment
  });
}

function formatResult(result) {
  const lines = [];
  lines.push(`<p><strong>Origin:</strong> ${result.origin.label} (column ${result.origin.column})</p>`);
  lines.push(`<p class="hint">${result.origin.notes}</p>`);
  lines.push("<table class='chargen-table'><thead><tr><th>Ability</th><th>Roll</th><th>Rank</th><th>#</th></tr></thead><tbody>");
  for (const key of ABILITIES) {
    const label = key.charAt(0).toUpperCase() + key.slice(1);
    lines.push(`<tr><td>${label}</td><td>${result.abilityRolls[key]}</td><td>${result.abilities[key]}</td><td>${result.numbers[key]}</td></tr>`);
  }
  lines.push("</tbody></table>");
  lines.push(`<p><strong>Resources:</strong> ${result.resources} (mod roll ${result.resourceModRoll}: ${result.resourceMod.label})</p>`);
  lines.push(`<p><strong>Popularity start:</strong> ${result.popularity}</p>`);
  lines.push(`<p><strong>Powers:</strong> ${result.counts.powers[0]} / max ${result.counts.powers[1]}</p>`);
  lines.push("<ul>");
  for (const c of result.powerCats) lines.push(`<li>Power category: ${c.label} (${c.roll})</li>`);
  lines.push("</ul>");
  lines.push(`<p><strong>Talents:</strong> ${result.counts.talents[0]} / max ${result.counts.talents[1]}</p>`);
  lines.push("<ul>");
  for (const c of result.talentCats) lines.push(`<li>Talent category: ${c.label} (${c.roll})</li>`);
  lines.push("</ul>");
  lines.push(`<p><strong>Contacts:</strong> ${result.counts.contacts[0]} / max ${result.counts.contacts[1]}</p>`);
  return lines.join("");
}

export async function promptGeneration(actor) {
  const originOptions = ORIGINS.map((o) => `<option value="${o.id}">${o.label}</option>`).join("");
  const content = `
    <form class="faserip-feat-dialog">
      <p>Advanced Set generated-hero procedure. Rank numbers are set to the <em>minimum</em> of each rank range.</p>
      <div class="form-group">
        <label>Origin</label>
        <select name="origin">${originOptions}</select>
      </div>
      <div class="form-group">
        <label><input type="checkbox" name="rollOrigin" /> Roll origin on 01–30 Altered / 31–60 Mutant / 61–90 Hi-Tech / 91–95 Robot / 96–00 Alien</label>
      </div>
      <div class="form-group">
        <label><input type="checkbox" name="secretId" /> Secret identity (−5 Popularity)</label>
      </div>
    </form>
  `;

  const DialogV2 = foundry.applications.api.DialogV2;
  const form = await DialogV2.wait({
    window: { title: "Generate Hero", icon: "fa-solid fa-dice" },
    content,
    buttons: [
      {
        action: "generate",
        label: "Generate",
        icon: "fa-solid fa-dice",
        default: true,
        callback: (_event, button) => button.form
      },
      { action: "cancel", label: "Cancel", icon: "fa-solid fa-xmark" }
    ],
    rejectClose: false
  });
  if (!form || form === "cancel") return null;
  const originId = form.querySelector('[name="origin"]')?.value;
  const rollOrigin = form.querySelector('[name="rollOrigin"]')?.checked;
  const secretId = form.querySelector('[name="secretId"]')?.checked;
  const result = generateHero({ originId, rollOrigin });
  await showApplyDialog(actor, result, secretId);
  return result;
}

async function showApplyDialog(actor, result, secretId) {
  const raiseOptions = ABILITIES.map((k) => `<option value="${k}">${k}</option>`).join("");
  const extra = result.origin.id === "altered"
    ? `<div class="form-group"><label>Raise one primary ability +1 CS</label><select name="raise">${raiseOptions}</select></div>`
    : `<input type="hidden" name="raise" value="" />`;

  const DialogV2 = foundry.applications.api.DialogV2;
  const form = await DialogV2.wait({
    window: { title: `Generated — ${result.origin.label}`, icon: "fa-solid fa-user-plus" },
    position: { width: 480 },
    content: `<form class="faserip-feat-dialog">${formatResult(result)}${extra}</form>`,
    buttons: [
      {
        action: "apply",
        label: "Apply to Sheet",
        icon: "fa-solid fa-check",
        default: true,
        callback: (_event, button) => button.form
      },
      { action: "preview", label: "Keep Preview Only" }
    ],
    rejectClose: false
  });
  if (!form || form === "preview") return false;
  const raise = form.querySelector?.('[name="raise"]')?.value || null;
  await applyGeneration(actor, result, { raiseAbility: raise, secretId });
  ui.notifications.info(`Applied generated stats to ${actor.name}. Add Powers / Talents / Contacts from the suggested categories.`);
  return true;
}

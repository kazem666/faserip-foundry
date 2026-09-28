import { ABILITIES, RANKS, rankLabel, rankValue } from "./config.mjs";
import { abilityAdvance, contactCost, popularityAdvance, powerAddCost, powerAdvance, resourceAdvance, talentCost } from "./rules-battle.mjs";
import { confirmDialog, formValue, promptForm } from "./foundry-api.mjs";

const ABILITY_LABELS = {
  fighting: "Fighting",
  agility: "Agility",
  strength: "Strength",
  endurance: "Endurance",
  reason: "Reason",
  intuition: "Intuition",
  psyche: "Psyche"
};

const BANKS = {
  fighting: "fase", agility: "fase", strength: "fase", endurance: "fase",
  reason: "rip", intuition: "rip", psyche: "rip",
  power: "powers", talent: "talents", contact: "contacts",
  resources: "resources", popularity: "popularity"
};

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function rankOptions(selected = "typical") {
  return RANKS.map((rank) => `<option value="${rank.id}" ${rank.id === selected ? "selected" : ""}>${esc(rank.label)} ${rank.value}</option>`).join("");
}

async function pay(actor, cost, bankKey) {
  const bank = Number(actor.system?.karmaBank?.[bankKey] || 0);
  const pool = Number(actor.system?.karmaBank?.pool || 0);
  const karma = Number(actor.system?.karma?.value || 0);
  let need = cost;
  const fromBank = Math.min(bank, need);
  need -= fromBank;
  const fromPool = Math.min(pool, need);
  need -= fromPool;
  const fromKarma = Math.min(karma, need);
  need -= fromKarma;
  if (need > 0) {
    ui.notifications?.warn(`${actor.name} needs ${cost} Karma. ${cost - need} is available in the fund, the pool, and current Karma.`);
    return false;
  }
  await actor.update({
    [`system.karmaBank.${bankKey}`]: bank - fromBank,
    "system.karmaBank.pool": pool - fromPool,
    "system.karmaBank.totalSpent": Number(actor.system?.karmaBank?.totalSpent || 0) + cost,
    "system.karma.value": karma - fromKarma
  });
  return true;
}

function stampAbility(actor, key, rankId, number) {
  const rolled = actor.getFlag("faserip", "rolledStats");
  if (!rolled?.abilities) return null;
  const next = foundry.utils.deepClone(rolled);
  next.abilities[key] = rankId;
  next.numbers = next.numbers || {};
  next.numbers[key] = number;
  return next;
}

export async function bankKarma(actor) {
  const form = await promptForm({
    title: "Bank Karma",
    okLabel: "Bank",
    content: `<form>
      <p class="hint">Move current Karma into the advancement fund. It stays there until it is spent on a rank, a power, a talent, or a contact.</p>
      <div class="form-group"><label>Amount</label><input type="number" name="amount" value="${Number(actor.system?.karma?.value || 0)}" min="1" /></div>
    </form>`
  });
  if (!form) return;
  const amount = Math.max(0, Math.floor(Number(formValue(form, "amount")) || 0));
  const karma = Number(actor.system?.karma?.value || 0);
  if (amount <= 0 || amount > karma) {
    ui.notifications?.warn(`${actor.name} does not have ${amount} current Karma.`);
    return;
  }
  await actor.update({
    "system.karma.value": karma - amount,
    "system.karmaBank.pool": Number(actor.system?.karmaBank?.pool || 0) + amount
  });
  ui.notifications?.info(`${actor.name} banks ${amount} Karma.`);
}

export async function toggleGroupMember(actor) {
  const on = !actor.getFlag("faserip", "groupMember");
  await actor.setFlag("faserip", "groupMember", on);
  ui.notifications?.info(on
    ? `${actor.name} shares the group Karma pool.`
    : `${actor.name} leaves the group Karma pool.`);
}

export async function promptAbilityAdvance(actor) {
  const options = ABILITIES.map((key) => `<option value="${key}">${ABILITY_LABELS[key]}</option>`).join("");
  const form = await promptForm({
    title: "Raise an ability",
    okLabel: "Next",
    content: `<form><div class="form-group"><label>Ability</label><select name="ability">${options}</select></div></form>`
  });
  if (!form) return;
  const key = formValue(form, "ability");
  const slot = actor.system?.abilities?.[key];
  if (!slot) return;
  const step = abilityAdvance(slot.rank, slot.number);
  const ok = await confirmDialog({
    title: "Raise an ability",
    content: `<p>Raise ${ABILITY_LABELS[key]} from ${esc(rankLabel(slot.rank))} number ${step.from} to ${esc(rankLabel(step.nextId))} number ${step.nextNumber} for <strong>${step.cost}</strong> Karma.</p>`
  });
  if (!ok) return;
  if (!(await pay(actor, step.cost, BANKS[key]))) return;
  const rolled = stampAbility(actor, key, step.nextId, step.nextNumber);
  const update = {
    [`system.abilities.${key}.rank`]: step.nextId,
    [`system.abilities.${key}.number`]: step.nextNumber
  };
  if (rolled) update["flags.faserip.rolledStats"] = rolled;
  await actor.update(update, { faseripAdvance: true });
  ui.notifications?.info(`${actor.name} raises ${ABILITY_LABELS[key]} to ${rankLabel(step.nextId)} (${step.nextNumber}).`);
}

export async function promptPowerAdvance(actor) {
  const powers = [...(actor.items ?? [])].filter((item) => item.type === "power");
  if (!powers.length) {
    ui.notifications?.warn(`${actor.name} has no powers to raise.`);
    return;
  }
  const options = powers.map((item) => `<option value="${item.id}">${esc(item.name)} (${esc(rankLabel(item.system.rank))})</option>`).join("");
  const form = await promptForm({
    title: "Raise a power",
    okLabel: "Next",
    content: `<form><div class="form-group"><label>Power</label><select name="power">${options}</select></div></form>`
  });
  if (!form) return;
  const item = actor.items.get(formValue(form, "power"));
  if (!item) return;
  const step = powerAdvance(item.system.rank, item.system.number);
  const ok = await confirmDialog({
    title: "Raise a power",
    content: `<p>Raise ${esc(item.name)} from ${esc(rankLabel(item.system.rank))} number ${step.from} to ${esc(rankLabel(step.nextId))} number ${step.nextNumber} for <strong>${step.cost}</strong> Karma.</p>`
  });
  if (!ok) return;
  if (!(await pay(actor, step.cost, "powers"))) return;
  await item.update({ "system.rank": step.nextId, "system.number": step.nextNumber });
  ui.notifications?.info(`${item.name} is now ${rankLabel(step.nextId)} (${step.nextNumber}).`);
}

export async function promptResourceAdvance(actor) {
  const step = resourceAdvance(actor.system?.resources?.rank || "typical");
  if (!step) {
    ui.notifications?.warn("Resources cannot be raised further.");
    return;
  }
  const ok = await confirmDialog({
    title: "Raise Resources",
    content: `<p>Raise Resources from ${esc(rankLabel(step.fromId))} to ${esc(rankLabel(step.nextId))} for <strong>${step.cost}</strong> Karma.</p>`
  });
  if (!ok) return;
  if (!(await pay(actor, step.cost, "resources"))) return;
  await actor.update({
    "system.resources.rank": step.nextId,
    "system.resources.number": rankValue(step.nextId)
  });
  ui.notifications?.info(`${actor.name}'s Resources are now ${rankLabel(step.nextId)}.`);
}

export async function promptPopularityAdvance(actor) {
  const step = popularityAdvance(actor.system?.popularity?.value);
  const ok = await confirmDialog({
    title: "Raise Popularity",
    content: `<p>Raise Popularity from ${step.from} to ${step.next} for <strong>${step.cost}</strong> Karma.</p>`
  });
  if (!ok) return;
  if (!(await pay(actor, step.cost, "popularity"))) return;
  await actor.update({ "system.popularity.value": step.next });
  ui.notifications?.info(`${actor.name}'s Popularity is now ${step.next}.`);
}

export async function promptPowerAdd(actor) {
  const form = await promptForm({
    title: "Add a power",
    okLabel: "Add",
    content: `<form>
      <p class="hint">A new power costs 3000 plus 40 times its starting rank number.</p>
      <div class="form-group"><label>Name</label><input type="text" name="name" value="" /></div>
      <div class="form-group"><label>Starting rank</label><select name="rank">${rankOptions("typical")}</select></div>
    </form>`
  });
  if (!form) return;
  const name = String(formValue(form, "name") || "").trim();
  const rankId = formValue(form, "rank") || "typical";
  if (!name) return;
  const cost = powerAddCost(rankId);
  if (!(await pay(actor, cost, "powers"))) return;
  await actor.createEmbeddedDocuments("Item", [{
    name,
    type: "power",
    system: { rank: rankId, number: rankValue(rankId) }
  }]);
  ui.notifications?.info(`${actor.name} gains ${name} at ${rankLabel(rankId)} for ${cost} Karma.`);
}

export async function promptTalentAdd(actor) {
  const form = await promptForm({
    title: "Add a talent",
    okLabel: "Add",
    content: `<form>
      <p class="hint">1000 Karma with a teacher. 2000 Karma worked out alone.</p>
      <div class="form-group"><label>Name</label><input type="text" name="name" value="" /></div>
      <label class="check"><input type="checkbox" name="taught" checked /> Learned from a teacher (1000)</label>
    </form>`
  });
  if (!form) return;
  const name = String(formValue(form, "name") || "").trim();
  if (!name) return;
  const taught = !!form.querySelector?.('[name="taught"]')?.checked;
  const cost = talentCost(taught);
  if (!(await pay(actor, cost, "talents"))) return;
  await actor.createEmbeddedDocuments("Item", [{
    name,
    type: "talent",
    system: { rank: "typical", number: rankValue("typical") }
  }]);
  ui.notifications?.info(`${actor.name} learns ${name} for ${cost} Karma.`);
}

export async function promptContactAdd(actor) {
  const form = await promptForm({
    title: "Add a contact",
    okLabel: "Add",
    content: `<form>
      <p class="hint">500 Karma plus 10 times the contact's Resources rank number.</p>
      <div class="form-group"><label>Name</label><input type="text" name="name" value="" /></div>
      <div class="form-group"><label>Contact Resources</label><select name="rank">${rankOptions("good")}</select></div>
    </form>`
  });
  if (!form) return;
  const name = String(formValue(form, "name") || "").trim();
  const rankId = formValue(form, "rank") || "typical";
  if (!name) return;
  const cost = contactCost(rankId);
  if (!(await pay(actor, cost, "contacts"))) return;
  await actor.createEmbeddedDocuments("Item", [{
    name,
    type: "contact",
    system: { rank: rankId, number: rankValue(rankId), acquired: true }
  }]);
  ui.notifications?.info(`${actor.name} gains ${name} as a contact for ${cost} Karma.`);
}

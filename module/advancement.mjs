import { ABILITIES, RANKS, rankFromNumber, rankIndex, rankLabel, rankValue } from "./config.mjs";
import { abilityAdvance, contactCost, popularityAdvance, powerAddCost, powerAdvance, resourceAdvance, talentCost } from "./rules-battle.mjs";
import { confirmDialog, formValue, promptForm } from "./foundry-api.mjs";
import { houseOn } from "./house-rules.mjs";

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

function houseAdvance() {
  return houseOn("houseAdvancement");
}

function currentNumber(rankId, number) {
  const n = Math.floor(Number(number) || 0);
  return n > 0 ? n : rankValue(rankId);
}

function fiveStep(number, jumpCost, pointCost) {
  const from = Math.max(0, Math.floor(Number(number) || 0));
  if (from % 5 !== 0) return { from, nextNumber: from + 1, cost: pointCost, catchUp: true };
  return { from, nextNumber: from + 5, cost: jumpCost, catchUp: false };
}

function pastUnearthly(rankId) {
  return rankIndex(rankId) > rankIndex("unearthly");
}

async function postAdvance(actor, text) {
  const ChatMessage = globalThis.ChatMessage;
  if (!ChatMessage?.create) return;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker?.({ actor }),
    content: `<div class="faserip-chat"><header><span class="feat-label">Advancement</span></header><p>${esc(text)}</p></div>`
  });
}

function reasonText(form) {
  return String(formValue(form, "reason") || "").trim();
}

async function houseAbility(actor, key, slot) {
  const from = currentNumber(slot.rank, slot.number);
  const step = fiveStep(from, 1000, 200);
  const nextId = rankFromNumber(step.nextNumber);
  const why = step.catchUp
    ? `${step.from} is not a multiple of 5. One point costs 200 Karma.`
    : "Five points cost 1000 Karma.";
  const form = await promptForm({
    title: `Raise ${ABILITY_LABELS[key]}`,
    okLabel: "Spend Karma",
    content: `<form>
      <p>${esc(ABILITY_LABELS[key])} ${step.from} becomes ${step.nextNumber} (${esc(rankLabel(nextId))}) for <strong>${step.cost}</strong> Karma. ${esc(why)}</p>
      <div class="form-group"><label>What has this hero been doing?</label><textarea name="reason" rows="3"></textarea></div>
    </form>`
  });
  if (!form) return;
  const reason = reasonText(form);
  if (!reason) {
    ui.notifications?.warn("Say what earned the raise.");
    return;
  }
  if (!(await pay(actor, step.cost, BANKS[key]))) return;
  const rolled = stampAbility(actor, key, nextId, step.nextNumber);
  const update = {
    [`system.abilities.${key}.rank`]: nextId,
    [`system.abilities.${key}.number`]: step.nextNumber
  };
  if (rolled) update["flags.faserip.rolledStats"] = rolled;
  await actor.update(update, { faseripAdvance: true });
  await postAdvance(actor, `${actor.name} raises ${ABILITY_LABELS[key]} from ${step.from} to ${step.nextNumber} for ${step.cost} Karma. ${reason}`);
  ui.notifications?.info(`${actor.name} raises ${ABILITY_LABELS[key]} to ${rankLabel(nextId)} (${step.nextNumber}).`);
}

async function housePower(actor, item) {
  const from = currentNumber(item.system.rank, item.system.number);
  const nextNumber = from + 5;
  const nextId = rankFromNumber(nextNumber);
  const gate = pastUnearthly(nextId);
  const form = await promptForm({
    title: `Raise ${item.name}`,
    okLabel: "Spend Karma",
    content: `<form>
      <p>${esc(item.name)} ${from} becomes ${nextNumber} (${esc(rankLabel(nextId))}) for <strong>2000</strong> Karma.</p>
      <div class="form-group"><label>What raised the potential?</label><textarea name="reason" rows="3"></textarea></div>
      ${gate ? `<div class="form-group"><label>Limitation</label><input type="text" name="limit" value="${esc(item.system.limitation || "")}" /></div><label class="check"><input type="checkbox" name="approved" /> The Judge approved a rank past Unearthly</label>` : ""}
    </form>`
  });
  if (!form) return;
  const reason = reasonText(form);
  if (!reason) {
    ui.notifications?.warn("Say what raised the potential.");
    return;
  }
  const limit = String(formValue(form, "limit") || "").trim();
  if (gate && (!limit || !formValue(form, "approved"))) {
    ui.notifications?.warn("A rank past Unearthly needs the Judge's approval and a limitation.");
    return;
  }
  if (!(await pay(actor, 2000, "powers"))) return;
  const update = { "system.rank": nextId, "system.number": nextNumber };
  if (limit) update["system.limitation"] = limit;
  await item.update(update);
  await postAdvance(actor, `${item.name} rises from ${from} to ${nextNumber} for 2000 Karma. ${reason}${limit ? ` Limitation: ${limit}.` : ""}`);
  ui.notifications?.info(`${item.name} is now ${rankLabel(nextId)} (${nextNumber}).`);
}

async function houseResources(actor) {
  const rankId = actor.system?.resources?.rank || "typical";
  const from = currentNumber(rankId, actor.system?.resources?.number);
  const nextNumber = from + 5;
  const nextId = rankFromNumber(nextNumber);
  const form = await promptForm({
    title: "Raise Resources",
    okLabel: "Spend Karma",
    content: `<form>
      <p>Resources ${from} become ${nextNumber} (${esc(rankLabel(nextId))}) for <strong>500</strong> Karma.</p>
      <div class="form-group"><label>Where does the money come from?</label><textarea name="reason" rows="3"></textarea></div>
      <label class="check"><input type="checkbox" name="approved" /> The Judge approved this raise</label>
    </form>`
  });
  if (!form) return;
  const reason = reasonText(form);
  if (!reason || !formValue(form, "approved")) {
    ui.notifications?.warn("Resources wait on the Judge, and on a note about the money.");
    return;
  }
  if (!(await pay(actor, 500, "resources"))) return;
  await actor.update({ "system.resources.rank": nextId, "system.resources.number": nextNumber });
  await postAdvance(actor, `${actor.name} raises Resources from ${from} to ${nextNumber} for 500 Karma. ${reason}`);
  ui.notifications?.info(`${actor.name}'s Resources are now ${rankLabel(nextId)}.`);
}

async function housePowerAdd(actor) {
  const gm = !!globalThis.game?.user?.isGM;
  const form = await promptForm({
    title: "Add a power",
    okLabel: "Add",
    content: `<form>
      <p class="hint">4000 Karma, plus 1000 for each 5 points of the starting rank. A limitation can waive part of that, and the Judge sets the waiver.</p>
      <div class="form-group"><label>Name</label><input type="text" name="name" value="" /></div>
      <div class="form-group"><label>Starting rank</label><select name="rank">${rankOptions("typical")}</select></div>
      <div class="form-group"><label>How does the hero gain it?</label><textarea name="reason" rows="3"></textarea></div>
      <div class="form-group"><label>Limitation</label><input type="text" name="limit" value="" /></div>
      ${gm ? `<div class="form-group"><label>Karma waived</label><input type="number" name="waiver" value="0" min="0" /></div>` : ""}
    </form>`
  });
  if (!form) return;
  const name = String(formValue(form, "name") || "").trim();
  const rankId = formValue(form, "rank") || "typical";
  const reason = reasonText(form);
  const limit = String(formValue(form, "limit") || "").trim();
  if (!name || !reason) {
    ui.notifications?.warn("Name the power and how it was gained.");
    return;
  }
  const steps = Math.max(1, Math.ceil(rankValue(rankId) / 5));
  let waiver = gm ? Math.max(0, Math.floor(Number(formValue(form, "waiver")) || 0)) : 0;
  if (waiver > 0 && !limit) {
    ui.notifications?.warn("A waiver needs a limitation.");
    return;
  }
  const cost = Math.max(0, 4000 + (1000 * steps) - waiver);
  if (cost > 0 && !(await pay(actor, cost, "powers"))) return;
  await actor.createEmbeddedDocuments("Item", [{
    name,
    type: "power",
    system: { rank: rankId, number: rankValue(rankId), limitation: limit }
  }]);
  await postAdvance(actor, `${actor.name} gains ${name} at ${rankLabel(rankId)} for ${cost} Karma. ${reason}${limit ? ` Limitation: ${limit}.` : ""}`);
  ui.notifications?.info(`${actor.name} gains ${name} at ${rankLabel(rankId)} for ${cost} Karma.`);
}

async function houseTalent(actor) {
  const form = await promptForm({
    title: "Add a talent",
    okLabel: "Add",
    content: `<form>
      <p class="hint">Say you are learning it before you spend, and play the practice.</p>
      <div class="form-group"><label>Name</label><input type="text" name="name" value="" /></div>
      <div class="form-group"><label>Teacher</label><select name="teacher"><option value="npc">NPC (1000)</option><option value="pc">Player character (2000)</option></select></div>
      <div class="form-group"><label>What practice led here?</label><textarea name="reason" rows="3"></textarea></div>
    </form>`
  });
  if (!form) return;
  const name = String(formValue(form, "name") || "").trim();
  const reason = reasonText(form);
  if (!name || !reason) {
    ui.notifications?.warn("Name the talent and the practice.");
    return;
  }
  const fromPc = formValue(form, "teacher") === "pc";
  const cost = fromPc ? 2000 : 1000;
  if (!(await pay(actor, cost, "talents"))) return;
  await actor.createEmbeddedDocuments("Item", [{
    name,
    type: "talent",
    system: { rank: "typical", number: rankValue("typical") }
  }]);
  await postAdvance(actor, `${actor.name} learns ${name} from ${fromPc ? "a player character" : "an NPC"} for ${cost} Karma. ${reason}`);
  ui.notifications?.info(`${actor.name} learns ${name} for ${cost} Karma.`);
}

async function houseContact(actor) {
  const form = await promptForm({
    title: "Add a contact",
    okLabel: "Add",
    content: `<form>
      <p class="hint">A contact already earned in play is free. 500 Karma names one sooner.</p>
      <div class="form-group"><label>Name</label><input type="text" name="name" value="" /></div>
      <label class="check"><input type="checkbox" name="spend" checked /> Spend 500 Karma to name them now</label>
    </form>`
  });
  if (!form) return;
  const name = String(formValue(form, "name") || "").trim();
  if (!name) return;
  const spend = !!formValue(form, "spend");
  const cost = spend ? 500 : 0;
  if (cost && !(await pay(actor, cost, "contacts"))) return;
  await actor.createEmbeddedDocuments("Item", [{
    name,
    type: "contact",
    system: { rank: "typical", number: rankValue("typical"), acquired: true }
  }]);
  await postAdvance(actor, cost
    ? `${actor.name} names ${name} as a contact for 500 Karma.`
    : `${actor.name} adds ${name} as a contact earned in play.`);
  ui.notifications?.info(cost ? `${actor.name} gains ${name} for 500 Karma.` : `${actor.name} adds ${name}.`);
}

export async function promptContactRegard(actor) {
  if (!houseAdvance()) return;
  const contacts = [...(actor.items ?? [])].filter((item) => item.type === "contact");
  if (!contacts.length) {
    ui.notifications?.warn(`${actor.name} has no contacts.`);
    return;
  }
  const options = contacts.map((item) => `<option value="${item.id}">${esc(item.name)}</option>`).join("");
  const picked = await promptForm({
    title: "Raise a contact's regard",
    okLabel: "Next",
    content: `<form><div class="form-group"><label>Contact</label><select name="contact">${options}</select></div></form>`
  });
  if (!picked) return;
  const item = actor.items.get(formValue(picked, "contact"));
  if (!item) return;
  const from = currentNumber(item.system.rank, item.system.number);
  const nextNumber = from + 5;
  const nextId = rankFromNumber(nextNumber);
  const form = await promptForm({
    title: `Regard of ${item.name}`,
    okLabel: "Spend Karma",
    content: `<form>
      <p>${esc(item.name)}'s regard goes from ${from} to ${nextNumber} (${esc(rankLabel(nextId))}) for <strong>500</strong> Karma. Acting against them can still damage the tie.</p>
      <div class="form-group"><label>How did the tie improve?</label><textarea name="reason" rows="3"></textarea></div>
    </form>`
  });
  if (!form) return;
  const reason = reasonText(form);
  if (!reason) {
    ui.notifications?.warn("Say how the tie improved.");
    return;
  }
  if (!(await pay(actor, 500, "contacts"))) return;
  await item.update({ "system.rank": nextId, "system.number": nextNumber });
  await postAdvance(actor, `${actor.name} raises ${item.name}'s regard from ${from} to ${nextNumber} for 500 Karma. ${reason}`);
  ui.notifications?.info(`${item.name}'s regard is now ${rankLabel(nextId)} (${nextNumber}).`);
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
  if (houseAdvance()) return houseAbility(actor, key, slot);
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
  if (houseAdvance()) return housePower(actor, item);
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
  if (houseAdvance()) return houseResources(actor);
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
  if (houseAdvance()) {
    ui.notifications?.info("Karma cannot buy Popularity. Deeds and charity raise it, and it can be lost. A contact's regard is raised on its own.");
    return;
  }
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
  if (houseAdvance()) return housePowerAdd(actor);
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
  if (houseAdvance()) return houseTalent(actor);
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
  if (houseAdvance()) return houseContact(actor);
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

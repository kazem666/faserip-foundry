/**
 * Optional combat rules. Each one is off until the Judge turns it on.
 * They change the FEAT they name. The standard roll is unchanged while they are off.
 */

import { colorForRoll, intensityNeeded, rankFromNumber, rankIndex, rankValue, UNIVERSAL_TABLE } from "./config.mjs";

const MELEE = new Set(["blunt", "edged", "grappling", "grabbing", "charging"]);
const BLOW = new Set(["blunt", "force", "throwBlunt"]);
const EDGED = new Set(["edged", "throwEdged"]);
const COLORS = ["white", "green", "yellow", "red"];

const MANEUVERS = {
  crit2: { cs: -2, damageCs: 1, label: "Critical (−2 to hit, +1 damage)", rules: ["combatCritical"] },
  crit4: { cs: -4, damageCs: 2, label: "Critical, harder (−4 to hit, +2 damage)", rules: ["combatCritical"] },
  crit6: { cs: -6, damageCs: 3, label: "Critical, all-out (−6 to hit, +3 damage)", rules: ["combatCritical"] },
  devastate: { cs: -4, damageCs: 2, label: "Devastating (−4 to hit, +2 damage)", rules: ["combatDevastating"] },
  flail: { cs: 1, damageCs: -2, label: "Flailing (+1 to hit, −2 damage)", rules: ["combatFlail"] },
  sweep: { cs: 1, damageCs: 0, label: "Sweep (+1 to hit)", rules: ["combatSweep"] },
  pull: { cs: -1, damageCs: 0, label: "Pull the punch (−1 to hit)", rules: ["combatPull"] }
};

export const CALLED = {
  drop: { cs: -1, label: "Drop what they are holding (−1)" },
  action: { cs: -2, label: "Lose the next action (−2)" },
  run: { cs: -2, label: "Unable to run (−2)" },
  stagger: { cs: -4, label: "Stagger (−4): next action and no run" }
};

export const COMBAT_PAGES = [
  {
    title: "The exchange",
    keys: ["combatTurn"]
  },
  {
    title: "Damage",
    keys: ["combatVariable", "combatPiercing", "combatEdge", "combatSubdual", "combatSoak"]
  },
  {
    title: "Strikes",
    keys: ["combatCritical", "combatDevastating", "combatFlail", "combatSweep", "combatPull", "combatDodgeAttack", "combatCalled"]
  },
  {
    title: "Defense",
    keys: ["combatAgile", "combatRollBlow", "combatDodgeCut", "combatPress", "combatLayback"]
  },
  {
    title: "Grappling",
    keys: ["combatGrapple", "combatGrappleFight"]
  },
  {
    title: "Position",
    keys: ["combatColorShift", "combatFighting", "combatCover"]
  }
];

const SETTINGS = [
  ["combatTurn", "One dice action", "A second FEAT in the same round is noted. Movement and an automatic action are still separate."],
  ["combatVariable", "Variable damage", "The low half of a green result is a graze at half damage. The high half is a light hit at three quarters. Red adds 3d6. A 100 adds 3d10 instead. Karma that pushes the roll to 100 counts."],
  ["combatPiercing", "Piercing", "A piercing attack treats Body Armor or a Force Field as 20 points thinner."],
  ["combatEdge", "Edged weapons and armor", "An edged attack rolls the weapon's material against Body Armor. Success ignores that armor. There is no automatic success."],
  ["combatSubdual", "Subdual", "A subdual hit still costs Health, but dropping to 0 does not start dying."],
  ["combatSoak", "Endurance soak", "After a hit, the target may roll Endurance to soak some of it. Soaking a heavy hit can wind Endurance. Health's maximum does not change."],
  ["combatCritical", "Critical attack", "Voluntary −2, −4, or −6 to hit for +1, +2, or +3 damage."],
  ["combatDevastating", "Devastating blow", "−4 to hit and +2 damage."],
  ["combatFlail", "Flailing attack", "+1 to hit and −2 damage."],
  ["combatSweep", "Sweep", "+1 to hit with a long implement swung through an area."],
  ["combatPull", "Pulling a punch", "−1 to hit."],
  ["combatDodgeAttack", "Dodge and attack", "Before the attack, Incredible Agility and Remarkable Fighting. Both must succeed. The attack is then −2, or −3 if either fails."],
  ["combatAgile", "Agile targets", "Amazing Agility is −1 to be hit, Monstrous −2, Unearthly or higher −3, unless the target is surprised."],
  ["combatRollBlow", "Roll with the blow", "After a blunt, force, or thrown blunt hit, a Fighting or Agility FEAT can cut 10, 20, or 40 points."],
  ["combatDodgeCut", "Dodge cuts damage", "A dodge's column shift also lowers the damage."],
  ["combatPress", "Pressing the attack", "The character who has the turn gains +1 to hit, and foes gain +1 against them."],
  ["combatLayback", "Laying back", "The character who has the turn is −1 to hit, and foes are −1 against them."],
  ["combatGrapple", "Grapple results", "Green is a partial hold. Yellow is a full hold. Red is a full hold that may damage or throw now."],
  ["combatGrappleFight", "Grapple with Fighting", "The first grab is a Fighting FEAT. Strength still describes the hold afterward."],
  ["combatColorShift", "Color shifts", "Column shifts past Shift 0 lower the color instead, to a maximum of two steps. Red can fall to green. They do not create a fumble."],
  ["combatFighting", "Fighting comparison", "On a melee attack, the difference in Fighting rank numbers is added to the attacker's d100 and subtracted from the lower Fighting."],
  ["combatCover", "Cover and concealment", "A partly hidden target is harder to hit. A miss of 15 or more can strike the cover."],
  ["combatCalled", "Called shots", "Spend column shifts to aim. On a yellow or red, the target rolls Endurance. Failure drops what they hold, loses the next action, stops a run, or staggers."]
];

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

export function combatOn(key) {
  try { return !!globalThis.game?.settings?.get("faserip", key); }
  catch { return false; }
}

export function roundStamp() {
  const combat = globalThis.game?.combat;
  if (combat?.started) return `${combat.id}:${combat.round}`;
  const scene = globalThis.game?.scenes?.current?.id || "none";
  return `scene:${scene}`;
}

export function agilityShift(rankId) {
  const index = rankIndex(rankId);
  if (index >= rankIndex("unearthly")) return -3;
  if (index >= rankIndex("monstrous")) return -2;
  if (index >= rankIndex("amazing")) return -1;
  return 0;
}

export function columnAndColor(rankId, cs) {
  const index = Math.max(0, rankIndex(rankId));
  const shift = Number(cs) || 0;
  if (!combatOn("combatColorShift") || shift >= 0 || index + shift >= 0) return { cs: shift, colorSteps: 0 };
  return { cs: -index, colorSteps: Math.min(2, -(index + shift)) };
}

export function downgradeColor(color, steps) {
  const count = Math.max(0, Number(steps) || 0);
  const index = COLORS.indexOf(color);
  if (index < 0 || !count) return color;
  return COLORS[Math.max(0, index - count)];
}

export function variableKind(rankId, roll) {
  const table = UNIVERSAL_TABLE[rankId] ?? UNIVERSAL_TABLE.typical;
  const n = Number(roll) || 0;
  if (n >= 100) return "hundred";
  if (n >= table.red) return "red";
  if (n >= table.yellow) return "";
  if (n >= table.green) {
    const span = Math.max(1, table.yellow - table.green);
    const mid = table.green + Math.floor((span - 1) / 2);
    return n <= mid ? "graze" : "light";
  }
  return "";
}

export function intensityMet(color, need) {
  if (need === "green") return color !== "white";
  if (need === "yellow") return color === "yellow" || color === "red";
  return color === "red";
}

function enabledManeuvers() {
  const seen = new Set();
  const rows = [];
  for (const [id, row] of Object.entries(MANEUVERS)) {
    if (seen.has(row.label)) continue;
    if (!row.rules.some((key) => combatOn(key))) continue;
    if (id === "devastate" && combatOn("combatCritical")) continue;
    seen.add(row.label);
    rows.push([id, row]);
  }
  return rows;
}

export function combatFeatFields() {
  const bits = [];
  const maneuvers = enabledManeuvers();
  if (maneuvers.length) {
    const options = maneuvers.map(([id, row]) => `<option value="${esc(id)}">${esc(row.label)}</option>`).join("");
    bits.push(`<div class="form-group"><label>Optional strike</label><select name="combatStrike"><option value="">— standard attack —</option>${options}</select></div>`);
  }
  if (combatOn("combatPiercing")) bits.push(`<label class="check"><input type="checkbox" name="piercing" /> Piercing (−20 armor or field)</label>`);
  if (combatOn("combatSubdual")) bits.push(`<label class="check"><input type="checkbox" name="subdual" /> Subdual (no dying at 0 Health)</label>`);
  if (combatOn("combatDodgeAttack")) bits.push(`<label class="check"><input type="checkbox" name="dodgeAttack" /> Dodge and attack</label>`);
  if (combatOn("combatPress")) bits.push(`<label class="check"><input type="checkbox" name="pressAttack" /> Press the attack (your turn)</label>`);
  if (combatOn("combatLayback")) bits.push(`<label class="check"><input type="checkbox" name="layBack" /> Lay back (your turn)</label>`);
  if (combatOn("combatCover")) {
    bits.push(`<div class="form-group"><label>Cover or concealment</label><select name="cover">
      <option value="">— clear —</option>
      <option value="conceal25">25% visible, concealment (−3)</option>
      <option value="conceal50">50% visible, concealment (−2)</option>
      <option value="conceal75">75% visible, concealment (−1)</option>
      <option value="cover25">25% visible, hard cover (−6)</option>
      <option value="cover50">50% visible, hard cover (−4)</option>
      <option value="cover75">75% visible, hard cover (−2)</option>
    </select></div>`);
  }
  if (combatOn("combatCalled")) {
    const options = Object.entries(CALLED).map(([id, row]) => `<option value="${esc(id)}">${esc(row.label)}</option>`).join("");
    bits.push(`<div class="form-group"><label>Called shot</label><select name="called"><option value="">— no call —</option>${options}</select></div>`);
  }
  return bits.join("");
}

const COVER_CS = { conceal25: -3, conceal50: -2, conceal75: -1, cover25: -6, cover50: -4, cover75: -2 };

export async function readCombatFeat(actor, form) {
  const notes = [];
  let cs = 0;
  let damageCs = 0;
  let piercing = false;
  let subdual = false;
  let dodgeAttack = false;
  let cover = "";
  let called = "";
  if (!form) return { cs, damageCs, piercing, subdual, dodgeAttack, cover, called, notes };
  const strike = MANEUVERS[form.querySelector?.('[name="combatStrike"]')?.value || ""];
  if (strike && strike.rules.some((key) => combatOn(key))) {
    cs += strike.cs;
    damageCs += strike.damageCs;
    notes.push(strike.label);
  }
  if (combatOn("combatPiercing") && form.querySelector?.('[name="piercing"]')?.checked) {
    piercing = true;
    notes.push("Piercing. Armor or a field is 20 points thinner.");
  }
  if (combatOn("combatSubdual") && form.querySelector?.('[name="subdual"]')?.checked) {
    subdual = true;
    notes.push("Subdual. At 0 Health this does not start dying.");
  }
  if (combatOn("combatDodgeAttack") && form.querySelector?.('[name="dodgeAttack"]')?.checked) dodgeAttack = true;
  cover = combatOn("combatCover") ? (form.querySelector?.('[name="cover"]')?.value || "") : "";
  if (COVER_CS[cover]) {
    cs += COVER_CS[cover];
    notes.push(`Cover ${COVER_CS[cover]} CS`);
  }
  const call = CALLED[form.querySelector?.('[name="called"]')?.value || ""];
  if (combatOn("combatCalled") && call) {
    called = form.querySelector('[name="called"]').value;
    cs += call.cs;
    notes.push(call.label);
  }
  const mine = globalThis.game?.combat?.combatant?.actor?.id === actor?.id;
  if (combatOn("combatPress") && form.querySelector?.('[name="pressAttack"]')?.checked) {
    if (!mine) notes.push("Pressing the attack waits for this character's turn.");
    else {
      await actor.setFlag("faserip", "pressRound", roundStamp());
      await actor.unsetFlag("faserip", "layRound").catch(() => {});
    }
  }
  if (combatOn("combatLayback") && form.querySelector?.('[name="layBack"]')?.checked) {
    if (!mine) notes.push("Laying back waits for this character's turn.");
    else {
      await actor.setFlag("faserip", "layRound", roundStamp());
      await actor.unsetFlag("faserip", "pressRound").catch(() => {});
    }
  }
  return { cs, damageCs, piercing, subdual, dodgeAttack, cover, called, notes };
}

export function autoCombatAdjust({ actor, target, rankId, cs, columnId, blindside }) {
  const notes = [];
  let flat = 0;
  let next = Number(cs) || 0;
  if (combatOn("combatAgile") && target && !blindside) {
    const pen = agilityShift(target.getAbilityRank?.("agility"));
    if (pen) {
      next += pen;
      notes.push(`Agile target ${pen} CS`);
    }
  }
  if (combatOn("combatFighting") && target && MELEE.has(columnId)) {
    const delta = Number(actor?.getAbilityNumber?.("fighting") || 0) - Number(target.getAbilityNumber?.("fighting") || 0);
    if (delta) {
      flat += delta;
      notes.push(`Fighting gap ${delta > 0 ? "+" : ""}${delta} on the d100`);
    }
  }
  const stamp = roundStamp();
  if (combatOn("combatPress") && actor?.getFlag?.("faserip", "pressRound") === stamp) {
    next += 1;
    notes.push("Pressing the attack. +1 CS.");
  }
  if (combatOn("combatLayback") && actor?.getFlag?.("faserip", "layRound") === stamp) {
    next -= 1;
    notes.push("Laying back. −1 CS.");
  }
  if (combatOn("combatPress") && target?.getFlag?.("faserip", "pressRound") === stamp) {
    next += 1;
    notes.push("They are pressing the attack. +1 CS.");
  }
  if (combatOn("combatLayback") && target?.getFlag?.("faserip", "layRound") === stamp) {
    next -= 1;
    notes.push("They are laying back. −1 CS.");
  }
  const split = columnAndColor(rankId, next);
  if (split.colorSteps) notes.push(`${split.colorSteps} column${split.colorSteps === 1 ? "" : "s"} past Shift 0 lower the color.`);
  return { cs: split.cs, colorSteps: split.colorSteps, flat, notes };
}

export function grappleEffect(columnId, color, effect) {
  if (!combatOn("combatGrapple") || columnId !== "grappling") return effect;
  if (color === "green") return "Partial hold.";
  if (color === "yellow") return "Full hold. No damage or throw on this turn.";
  if (color === "red") return "Full hold. Damage or a throw may follow now.";
  return effect;
}

export async function variableBonus(kind) {
  if (kind === "hundred") {
    const roll = await new Roll("3d10").evaluate({ allowInteractive: false });
    return { bonus: Number(roll.total) || 0, note: `A 100 adds ${roll.total} (3d10).` };
  }
  if (kind === "red") {
    const roll = await new Roll("3d6").evaluate({ allowInteractive: false });
    return { bonus: Number(roll.total) || 0, note: `Red adds ${roll.total} (3d6).` };
  }
  return { bonus: 0, note: "" };
}

export function applyVariable(amount, kind, bonus = 0) {
  const base = Math.max(0, Number(amount) || 0);
  if (kind === "graze") return { amount: Math.floor(base / 2), note: "Graze. Half damage." };
  if (kind === "light") return { amount: Math.floor(base * 0.75), note: "Light hit. Three quarters damage." };
  if (kind === "red" || kind === "hundred") return { amount: base + bonus, note: "" };
  return { amount: base, note: "" };
}

async function featColor(rankId) {
  const roll = await new Roll("1d100").evaluate({ allowInteractive: false });
  return { roll: Number(roll.total), color: colorForRoll(rankId, Number(roll.total)) };
}

export async function dodgeAndAttack(actor) {
  const agility = actor?.getAbilityRank?.("agility") || "typical";
  const fighting = actor?.getAbilityRank?.("fighting") || "typical";
  const agNeed = intensityNeeded(agility, "incredible");
  const figNeed = intensityNeeded(fighting, "remarkable");
  const ag = await featColor(agility);
  const fig = await featColor(fighting);
  const agOk = intensityMet(ag.color, agNeed.automatic ? "green" : (agNeed.impossible ? "red" : agNeed.color));
  const figOk = intensityMet(fig.color, figNeed.automatic ? "green" : (figNeed.impossible ? "red" : figNeed.color));
  const both = agOk && figOk;
  return {
    cs: both ? -2 : -3,
    note: both
      ? `Dodge and attack. Agility ${ag.roll} ${ag.color}, Fighting ${fig.roll} ${fig.color}. −2 to hit.`
      : `Dodge and attack failed. Agility ${ag.roll} ${ag.color}, Fighting ${fig.roll} ${fig.color}. −3 to hit, and no dodge.`
  };
}

export async function edgedCut(item, actor, target) {
  if (!combatOn("combatEdge") || !target) return null;
  const armor = Number(target.getBodyArmor?.() || 0);
  if (armor <= 0) return null;
  const material = item?.system?.material;
  const weaponRank = (material && rankIndex(material) >= 0) ? material : (item?.system?.rank || actor?.getAbilityRank?.("strength") || "typical");
  const armorRank = rankFromNumber(armor);
  const need = intensityNeeded(weaponRank, armorRank);
  const needColor = need.automatic ? "green" : (need.impossible ? "red" : need.color);
  const rolled = await featColor(weaponRank);
  const ok = intensityMet(rolled.color, needColor);
  return {
    ok,
    note: ok
      ? `The edge cuts the armor (${rolled.roll}, ${rolled.color}). Damage ignores it.`
      : `The edge does not cut the armor (${rolled.roll}, ${rolled.color}).`
  };
}

export async function noteSecondAction(actor, columnId, isCheck) {
  if (!combatOn("combatTurn") || !actor || isCheck) return "";
  const stamp = roundStamp();
  if (actor.getFlag?.("faserip", "diceRound") === stamp) return "Second dice action this round.";
  try { await actor.setFlag("faserip", "diceRound", stamp); } catch { /* the roll still stands */ }
  return "";
}

async function targetOf(message) {
  const uuid = message?.getFlag?.("faserip", "targetUuid");
  if (!uuid || !globalThis.fromUuid) return null;
  return globalThis.fromUuid(uuid);
}

export async function promptRollWithBlow(message) {
  if (!combatOn("combatRollBlow")) return;
  if (message?.getFlag?.("faserip", "blew")) {
    globalThis.ui?.notifications?.warn("This hit was already rolled with.");
    return;
  }
  const column = message?.getFlag?.("faserip", "effectsColumn");
  if (!BLOW.has(column)) return;
  const target = await targetOf(message);
  if (!target) return;
  const ability = column === "blunt" ? "fighting" : "agility";
  const rankId = target.getAbilityRank?.(ability) || "typical";
  const rolled = await featColor(rankId);
  const cut = { white: 0, green: 10, yellow: 20, red: 40 }[rolled.color] || 0;
  const applied = !!message.getFlag("faserip", "damageApplied");
  const taken = Number(message.getFlag("faserip", "damageTaken") || 0);
  const listed = Number(message.getFlag("faserip", "damageAmount") || 0);
  let restored = 0;
  if (cut && applied && taken > 0 && target.heal) {
    restored = Math.min(cut, taken);
    await target.heal(restored);
  } else if (cut && !applied) {
    await message.setFlag("faserip", "damageAmount", Math.max(0, listed - cut));
  }
  await message.setFlag("faserip", "blew", true);
  const line = cut
    ? `${target.name} rolls with the blow (${rolled.roll}, ${rolled.color}) and sheds ${applied ? restored : Math.min(cut, listed)} points.`
    : `${target.name} rolls with the blow (${rolled.roll}, white) and sheds nothing.`;
  await globalThis.ChatMessage?.create?.({
    speaker: globalThis.ChatMessage?.getSpeaker?.({ actor: target }),
    content: `<div class="faserip-chat"><p>${esc(line)}</p></div>`
  });
}

export async function promptSoak(message) {
  if (!combatOn("combatSoak")) return;
  if (message?.getFlag?.("faserip", "soaked")) {
    globalThis.ui?.notifications?.warn("This hit was already soaked.");
    return;
  }
  const target = await targetOf(message);
  if (!target) return;
  const amount = Number(message.getFlag("faserip", "damageAmount") || 0);
  const endurance = Number(target.getAbilityNumber?.("endurance") || 0);
  const endRank = target.getAbilityRank?.("endurance") || "typical";
  const delta = rankIndex(endRank) - rankIndex(rankFromNumber(amount));
  const need = delta >= 2 ? "green" : (delta >= -1 ? "yellow" : "red");
  const cap = need === "green" ? endurance : (need === "yellow" ? Math.floor(endurance / 2) : Math.floor(endurance / 4));
  const rolled = await featColor(endRank);
  const ok = intensityMet(rolled.color, need);
  const soak = ok ? Math.min(cap, amount) : 0;
  const applied = !!message.getFlag("faserip", "damageApplied");
  if (soak && applied && target.heal) await target.heal(soak);
  else if (soak && !applied) await message.setFlag("faserip", "damageAmount", Math.max(0, amount - soak));
  await message.setFlag("faserip", "soaked", true);
  let price = "";
  if (soak >= 50) price = " Endurance is winded for three ranks.";
  else if (soak > 30) price = rolled.color === "red" ? " A red Endurance hold keeps the rank." : (rolled.color === "yellow" ? " Endurance is winded for two ranks." : " Endurance is winded for three ranks.");
  else if (soak > 10) price = rolled.color === "red" ? " A red Endurance hold keeps the rank." : " Endurance is winded for one rank.";
  const hours = Math.max(0.5, 6 - Math.floor(endurance / 10));
  if (price && !/keeps the rank/.test(price)) price += ` About ${hours} hours, and Health's maximum stays.`;
  const line = soak
    ? `${target.name} soaks ${soak} with Endurance (${rolled.roll}, ${rolled.color}, needed ${need}).${price}`
    : `${target.name} does not soak the hit (${rolled.roll}, ${rolled.color}, needed ${need}).`;
  await globalThis.ChatMessage?.create?.({
    speaker: globalThis.ChatMessage?.getSpeaker?.({ actor: target }),
    content: `<div class="faserip-chat"><p>${esc(line)}</p></div>`
  });
}

export function calledReady(color) {
  return color === "yellow" || color === "red";
}

export function calledEffects(id) {
  if (id === "drop") return ["drop"];
  if (id === "action") return ["action"];
  if (id === "run") return ["run"];
  if (id === "stagger") return ["action", "run"];
  return [];
}

export function runLocked(actor) {
  if (!combatOn("combatCalled")) return false;
  const flag = actor?.getFlag?.("faserip", "noRun") || actor?.flags?.faserip?.noRun;
  if (!flag) return false;
  if (flag === "next") return true;
  return flag === roundStamp();
}

function noRunMark() {
  return globalThis.game?.combat?.started ? roundStamp() : "next";
}

async function dropHeld(target) {
  const gear = [...(target?.items ?? [])].filter((item) => item.type === "weapon" || item.type === "equipment");
  const held = gear.find((item) => item.type === "weapon" && !item.getFlag?.("faserip", "dropped"))
    || gear.find((item) => !item.getFlag?.("faserip", "dropped"));
  if (!held) return "Nothing in hand to drop.";
  await held.setFlag("faserip", "dropped", true);
  return `${held.name} is on the ground.`;
}

export async function resolveCalled({ target, color, callId, rankId }) {
  if (!combatOn("combatCalled") || !CALLED[callId]) return "";
  if (!calledReady(color)) {
    return color === "green" ? "The called shot needed a yellow or red. The hit is ordinary." : "";
  }
  if (!target) return "The called shot has no target.";
  const endurance = target.getAbilityRank?.("endurance") || "typical";
  const need = intensityNeeded(endurance, rankId);
  const needColor = need.automatic ? "green" : (need.impossible ? "red" : need.color);
  const rolled = await featColor(endurance);
  if (intensityMet(rolled.color, needColor)) {
    return `${target.name} shrugs off the called shot (${rolled.roll}, ${rolled.color}).`;
  }
  const notes = [`${target.name} fails to shrug it off (${rolled.roll}, ${rolled.color}).`];
  for (const effect of calledEffects(callId)) {
    if (effect === "drop") notes.push(await dropHeld(target));
    if (effect === "action") {
      await target.setFlag("faserip", "lostAction", true);
      notes.push("The next action is lost.");
    }
    if (effect === "run") {
      await target.setFlag("faserip", "noRun", noRunMark());
      notes.push("They cannot run.");
    }
  }
  return notes.join(" ");
}

export async function pickUpItem(item) {
  if (!item?.getFlag?.("faserip", "dropped")) return null;
  await item.unsetFlag("faserip", "dropped");
  globalThis.ui?.notifications?.info(`${item.name} is back in hand.`);
  return item;
}

export function registerCombatRules() {
  const settings = globalThis.game?.settings;
  if (!settings) return;
  const judge = { scope: "world", config: false, restricted: true, type: Boolean, default: false };
  for (const [key, name, hint] of SETTINGS) {
    settings.register("faserip", key, { name, hint, ...judge });
  }
}

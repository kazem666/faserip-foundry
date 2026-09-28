import { abilityNumber, colorForRoll, rankIndex, rankLabel, rankValue, shiftRank } from "./config.mjs";
import { effectGetsThrough, fallOutcome, killApplies, slamSquares, wakeResult } from "./rules-battle.mjs";
import { shoveActor, squaresPerArea } from "./movement.mjs";
import { workflowActive } from "./workflow.mjs";

const CHECKS = new Set(["slamCheck", "stunCheck", "killCheck"]);

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

export function soakAmount(actor, { energy = false, useForceField = false, bonusArmor = 0 } = {}) {
  if (useForceField) {
    const field = Number(actor?.getForceField?.() || 0);
    return energy ? field : Math.max(0, field - 10);
  }
  let armor = Math.max(Number(actor?.getBodyArmor?.() || 0), Number(bonusArmor) || 0);
  if (energy) armor = Math.max(0, armor - 20);
  return armor;
}

export { effectGetsThrough };

export function readBattle(actor) {
  return actor?.getFlag?.("faserip", "battle") || null;
}

export function describeCondition(actor) {
  const cond = readBattle(actor);
  if (!cond?.state || cond.state === "ok") return "";
  if (cond.state === "stunned") return `Stunned for ${cond.rounds} round${cond.rounds === 1 ? "" : "s"}. No actions.`;
  if (cond.state === "unconscious" && cond.unit === "hours") {
    return `Unconscious for ${cond.rounds} hour${cond.rounds === 1 ? "" : "s"} after aid.`;
  }
  if (cond.state === "unconscious") return `Unconscious for ${cond.rounds} round${cond.rounds === 1 ? "" : "s"}.`;
  if (cond.state === "dying") {
    return cond.stabilized
      ? "Losing Endurance. Holding on for this round."
      : "Losing one Endurance rank each round.";
  }
  if (cond.state === "dead") return "Endurance is Shift 0.";
  return cond.note || "";
}

export function conditionBlock(actor) {
  const cond = readBattle(actor);
  if (!cond?.state || cond.state === "ok") return "";
  const name = actor?.name || "This hero";
  if (cond.state === "stunned") return `${name} is stunned and cannot act this round.`;
  if (cond.state === "unconscious") return `${name} is unconscious.`;
  if (cond.state === "dying") return `${name} is losing Endurance and cannot act.`;
  if (cond.state === "dead") return `${name} is at Shift 0 Endurance.`;
  return "";
}

export function isCheckColumn(columnId) {
  return CHECKS.has(columnId);
}

function leadGM() {
  const gm = game.users?.find?.((user) => user.active && user.isGM);
  if (gm) return game.user?.id === gm.id;
  return !!game.user?.isGM;
}

async function note(text) {
  const line = String(text || "").trim();
  if (!line) return;
  ui.notifications?.info(line);
  try {
    await ChatMessage.create({ content: `<p>${esc(line)}</p>` });
  } catch (err) {
    console.warn("FASERIP | battle note", err);
  }
}

async function writeBattle(actor, data) {
  if (!data) {
    try { await actor.unsetFlag("faserip", "battle"); } catch {}
    return;
  }
  await actor.setFlag("faserip", "battle", data);
}

function stampRolled(actor, key, rankId, number) {
  const rolled = actor.getFlag?.("faserip", "rolledStats");
  if (!rolled?.abilities) return null;
  const next = foundry.utils.deepClone(rolled);
  next.abilities[key] = rankId;
  next.numbers = next.numbers || {};
  next.numbers[key] = number;
  return next;
}

async function setEndurance(actor, rankId) {
  const number = rankValue(rankId);
  const rolled = stampRolled(actor, "endurance", rankId, number);
  const update = {
    "system.abilities.endurance.rank": rankId,
    "system.abilities.endurance.number": number,
    "system.condition.enduranceLoss": Number(actor.system?.condition?.enduranceLoss || 0) + 1
  };
  if (rolled) update["flags.faserip.rolledStats"] = rolled;
  await actor.update(update, { faseripAdvance: true });
}

async function markDead(actor, killerId) {
  await writeBattle(actor, { state: "dead", rounds: 0, note: "Shift 0" });
  await actor.update({ "system.condition.unconscious": true });
  await note(`${actor.name} reaches Shift 0 Endurance.`);
  if (!workflowActive("autoKarmaOnKill") || !killerId) return;
  const killer = game.actors?.get?.(killerId) || null;
  if (!killer) return;
  try {
    await killer.update({ "system.karma.value": 0 });
  } catch (err) {
    console.warn("FASERIP | karma wipe", err);
    return;
  }
  if (killer.getFlag("faserip", "groupMember")) {
    try { await game.settings.set("faserip", "groupKarma", 0); } catch {}
    await note(`${killer.name} drops to 0 current Karma. The group pool is wiped.`);
    return;
  }
  await note(`${killer.name} drops to 0 current Karma.`);
}

async function dropEndurance(actor, killerId) {
  const current = actor.getAbilityRank?.("endurance") || "typical";
  if (rankIndexSafe(current) <= 0) {
    await markDead(actor, killerId);
    return;
  }
  const next = shiftRank(current, -1);
  await setEndurance(actor, next);
  if (next === "shift0") {
    await markDead(actor, killerId);
    return;
  }
  await note(`${actor.name} loses an Endurance rank: ${rankLabel(next)}.`);
}

function rankIndexSafe(id) {
  const index = rankIndex(id);
  return index < 0 ? 0 : index;
}

async function applySlam(actor, color, resultOf) {
  if (color === "red") {
    await note(`${actor.name} keeps their feet. No Slam.`);
    return;
  }
  const attacker = resultOf?.attackerId ? game.actors?.get?.(resultOf.attackerId) : null;
  const strength = resultOf?.strengthRank || attacker?.getAbilityRank?.("strength") || "typical";
  const squares = slamSquares(color, strength, squaresPerArea());
  if (squares <= 0) {
    await note(`${actor.name} is staggered in place.`);
    return;
  }
  const shove = await shoveActor(actor, attacker, squares);
  const label = color === "yellow" ? "staggers" : color === "green" ? "is knocked back 1 area" : "is slammed";
  const landed = shove.squares ? `${shove.squares} square${shove.squares === 1 ? "" : "s"}` : "no open square";
  const blocked = shove.stopped ? " Something in the way stops the slide. Treat the rest as a charging impact." : "";
  await note(`${actor.name} ${label} (${landed}).${blocked}`);
}

function timedState(state, rounds, extra = {}) {
  const now = game.combat?.round ?? 0;
  return { state, rounds, untilRound: now + rounds, ...extra };
}

async function applyStun(actor, color) {
  if (color === "red") {
    await note(`${actor.name} shrugs off the Stun.`);
    return;
  }
  if (color === "yellow") {
    await writeBattle(actor, timedState("stunned", 1));
    await note(`${actor.name} is stunned for 1 round and cannot act.`);
    return;
  }
  const roll = await new Roll("1d10").evaluate({ allowInteractive: false });
  const rounds = Math.max(1, Number(roll.total) || 1);
  await writeBattle(actor, timedState("unconscious", rounds, { wakeCheck: false }));
  await actor.update({ "system.condition.unconscious": true });
  await note(`${actor.name} is unconscious for ${rounds} round${rounds === 1 ? "" : "s"}.`);
}

async function applyKill(actor, color, resultOf) {
  if (!killApplies(color, resultOf?.sourceColumn || "")) {
    if (resultOf?.reprieve) {
      await writeBattle(actor, null);
      await note(`${actor.name} stops losing Endurance.`);
      return;
    }
    await note(`${actor.name} avoids Endurance loss.`);
    if (Number(actor.system?.health?.value) === 0) await collapseAtZero(actor);
    return;
  }
  await writeBattle(actor, {
    state: "dying",
    rounds: 0,
    stabilized: false,
    killerId: resultOf?.attackerId || "",
    sourceColumn: resultOf?.sourceColumn || ""
  });
  await actor.update({ "system.condition.unconscious": true });
  await dropEndurance(actor, resultOf?.attackerId || "");
}

export async function applyCheckResult({ actor, color, columnId, resultOf = null } = {}) {
  if (!actor || !workflowActive("autoBattleResults")) return;
  if (columnId === "slamCheck") return applySlam(actor, color, resultOf);
  if (columnId === "stunCheck") return applyStun(actor, color);
  if (columnId === "killCheck") return applyKill(actor, color, resultOf);
}

export async function collapseAtZero(actor) {
  if (!actor || !workflowActive("autoBattleResults")) return;
  const existing = readBattle(actor);
  if (existing?.state === "dying" || existing?.state === "dead" || existing?.state === "unconscious") return;
  const roll = await new Roll("1d10").evaluate({ allowInteractive: false });
  const rounds = Math.max(1, Number(roll.total) || 1);
  await writeBattle(actor, timedState("unconscious", rounds, { wakeCheck: true, note: "Health 0" }));
  await actor.update({ "system.condition.unconscious": true });
  await note(`${actor.name} drops to 0 Health and is out for ${rounds} round${rounds === 1 ? "" : "s"}.`);
}

async function rollWake(actor) {
  const rankId = actor.getAbilityRank?.("endurance") || "typical";
  const roll = await new Roll("1d100").evaluate({ allowInteractive: false });
  const color = colorForRoll(rankId, Number(roll.total));
  const outcome = wakeResult(color);
  await note(`${actor.name} rolls Endurance to wake (${color}).`);
  if (outcome === "wake") {
    const health = Math.max(1, abilityNumber(actor.system?.abilities?.endurance));
    await actor.update({
      "system.health.value": health,
      "system.condition.unconscious": false
    }, { faseripHeal: true });
    await writeBattle(actor, null);
    await note(`${actor.name} wakes with ${health} Health.`);
    return;
  }
  if (outcome === "dying") {
    await writeBattle(actor, { state: "dying", rounds: 0, stabilized: false, killerId: "", sourceColumn: "" });
    await dropEndurance(actor, "");
    return;
  }
  const more = await new Roll("1d10").evaluate({ allowInteractive: false });
  const rounds = Math.max(1, Number(more.total) || 1);
  await writeBattle(actor, timedState("unconscious", rounds, { wakeCheck: true, note: "Still out" }));
  await note(`${actor.name} is still unconscious for ${rounds} more round${rounds === 1 ? "" : "s"}.`);
}

export async function tickOne(actor, { force = false } = {}) {
  const cond = readBattle(actor);
  if (!cond?.state || cond.state === "dead") return;
  if (cond.state === "stunned" || (cond.state === "unconscious" && cond.unit !== "hours")) {
    const round = game.combat?.round ?? 0;
    if (force) {
      const left = Math.max(0, Number(cond.rounds) - 1);
      if (left > 0) {
        await writeBattle(actor, { ...cond, rounds: left, untilRound: round + left });
        return;
      }
    } else if (cond.untilRound != null && round <= cond.untilRound) {
      await writeBattle(actor, { ...cond, rounds: Math.max(1, cond.untilRound - round) });
      return;
    }
    if (cond.wakeCheck) {
      await rollWake(actor);
      return;
    }
    await writeBattle(actor, null);
    if (cond.state === "unconscious") await actor.update({ "system.condition.unconscious": false });
    await note(`${actor.name} can act again.`);
    return;
  }
  if (cond.state === "dying") {
    if (cond.stabilized) {
      await writeBattle(actor, { ...cond, stabilized: false });
      await note(`${actor.name} holds on this round.`);
      return;
    }
    await dropEndurance(actor, cond.killerId || "");
  }
}

export async function tickCombatConditions(combat) {
  if (!leadGM() || !workflowActive("autoDyingClock")) return;
  const seen = new Set();
  for (const combatant of combat?.combatants ?? []) {
    const actor = combatant.actor;
    if (!actor || seen.has(actor.uuid)) continue;
    seen.add(actor.uuid);
    try { await tickOne(actor); } catch (err) {
      console.warn("FASERIP | condition tick", err);
    }
  }
}

export async function holdOn(actor) {
  const cond = readBattle(actor);
  if (cond?.state !== "dying") return;
  if ((actor.system?.karma?.value ?? 0) < 50) {
    ui.notifications?.warn(`${actor.name} needs 50 Karma to hold on.`);
    return;
  }
  await actor.spendKarma(50);
  await writeBattle(actor, { ...cond, stabilized: true });
  await note(`${actor.name} spends 50 Karma and holds on for the next round.`);
}

export async function buyEnduranceFeat(actor) {
  const cond = readBattle(actor);
  if (cond?.state !== "dying") return;
  if ((actor.system?.karma?.value ?? 0) < 200) {
    ui.notifications?.warn(`${actor.name} needs 200 Karma for another Endurance FEAT.`);
    return;
  }
  await actor.spendKarma(200);
  const { rollFeat } = await import("./dice/universal-table.mjs");
  await rollFeat({
    actor,
    rankId: actor.getAbilityRank("endurance"),
    label: "Endurance FEAT",
    effectsColumn: "killCheck",
    skipCondition: true,
    resultOf: {
      attackerId: cond.killerId || "",
      sourceColumn: cond.sourceColumn || "",
      reprieve: true
    }
  });
}

export async function aidDying(actor) {
  const cond = readBattle(actor);
  if (cond?.state !== "dying") return;
  const roll = await new Roll("1d10").evaluate({ allowInteractive: false });
  const hours = Math.max(1, Number(roll.total) || 1);
  await writeBattle(actor, { state: "unconscious", rounds: hours, unit: "hours", wakeCheck: false });
  await actor.update({ "system.condition.unconscious": true });
  await note(`Aid stops ${actor.name}'s Endurance loss. Unconscious for ${hours} hour${hours === 1 ? "" : "s"}.`);
}

export async function hourPasses(actor) {
  const cond = readBattle(actor);
  if (cond?.unit !== "hours") return;
  const rounds = Math.max(0, Number(cond.rounds) - 1);
  if (rounds <= 0) {
    await writeBattle(actor, null);
    await actor.update({ "system.condition.unconscious": false });
    await note(`${actor.name} comes around.`);
    return;
  }
  await writeBattle(actor, { ...cond, rounds });
  await note(`${actor.name} has ${rounds} hour${rounds === 1 ? "" : "s"} left.`);
}

export async function clearCondition(actor) {
  await writeBattle(actor, null);
  await actor.update({ "system.condition.unconscious": false });
}

export async function promptFall(actor) {
  const { promptForm, formValue } = await import("./foundry-api.mjs");
  const { RANKS } = await import("./config.mjs");
  const options = RANKS.map((rank) => `<option value="${rank.id}" ${rank.id === "excellent" ? "selected" : ""}>${rank.label}</option>`).join("");
  const form = await promptForm({
    title: "Falling impact",
    okLabel: "Apply",
    content: `<form>
      <p class="hint">The first round covers 3 floors, the second 6, the third 10, and later rounds 20. If the impact outranks the surface, the surface gives and the fall is absorbed. If the surface holds, the hero takes the impact after Body Armor.</p>
      <div class="form-group"><label>Floors fallen</label><input type="number" name="floors" value="3" min="1" /></div>
      <div class="form-group"><label>Surface rank</label><select name="surface">${options}</select></div>
    </form>`
  });
  if (!form) return;
  const outcome = fallOutcome(formValue(form, "floors"), formValue(form, "surface"));
  if (outcome.damage <= 0) {
    await note(outcome.rate <= 0
      ? `${actor.name} does not fall far enough to be hurt.`
      : `${actor.name} falls at ${outcome.rate} areas this round. The ${rankLabel(outcome.surface)} surface gives way, so the impact is absorbed.`);
    return;
  }
  const taken = await actor.applyDamage(outcome.damage, { energy: false });
  await note(`${actor.name} falls at ${outcome.rate} areas this round onto ${rankLabel(outcome.surface)}. Impact ${rankLabel(outcome.impactId)} gets through for ${taken} Health.`);
  if (Number(actor.system?.health?.value) === 0) await collapseAtZero(actor);
}

export async function promptCatch(actor) {
  const { promptForm, formValue } = await import("./foundry-api.mjs");
  const { RANKS } = await import("./config.mjs");
  const options = RANKS.map((rank) => `<option value="${rank.id}" ${rank.id === "excellent" ? "selected" : ""}>${rank.label}</option>`).join("");
  const form = await promptForm({
    title: "Catch",
    okLabel: "Roll",
    content: `<form>
      <p class="hint">Intensity equals the object's speed. A bullet wants Unearthly Agility, an arrow Amazing, other thrown objects Remarkable, and a falling person any Agility. Catching something aimed at you is −3 CS.</p>
      <div class="form-group"><label>Speed rank</label><select name="speed">${options}</select></div>
      <label class="check"><input type="checkbox" name="aimed" /> Aimed at the catcher (−3 CS)</label>
    </form>`
  });
  if (!form) return;
  const { rollFeat } = await import("./dice/universal-table.mjs");
  const aimed = !!form.querySelector?.('[name="aimed"]')?.checked || formValue(form, "aimed") === true;
  await rollFeat({
    actor,
    rankId: actor.getAbilityRank("agility"),
    label: "Catch",
    cs: aimed ? -3 : 0,
    intensityId: formValue(form, "speed") || "excellent",
    effectsColumn: "catching",
    skipCondition: true
  });
}

function sensesAmbush(actor) {
  return [...(actor?.items ?? [])].some((item) => /danger sense|combat sense|extraordinary sense|radar sense|enhanced senses/i.test(item.name || ""));
}

export function spoilBlindside(target) {
  return sensesAmbush(target);
}

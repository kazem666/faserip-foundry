import { rankValue, ABILITIES, abilityNumber, abilityRankId, initiativeModifier } from "../config.mjs";
import { rollFeat } from "../dice/universal-table.mjs";
import { createActorWizard } from "../wizard.mjs";
import { initiativeTalentBonus, initiativeTotal, readPending, shiftedArmor, writePending } from "../play-rules.mjs";
import { workflowOn } from "../workflow.mjs";

function rolledStatsStamp(actor) {
  return actor.getFlag?.("faserip", "rolledStats") || actor.flags?.faserip?.rolledStats || null;
}

function isApplyingRolledStats(options = {}) {
  return !!(options.faseripApplyRolls || options.faseripReapply);
}

function nestFlatAbilityChanges(changed) {
  if (!changed || typeof changed !== "object") return;
  const flat = Object.keys(changed).filter((key) => /^system\.abilities\.[^.]+\.(rank|number)$/.test(String(key)));
  if (!flat.length) return;
  changed.system = changed.system || {};
  changed.system.abilities = { ...(changed.system.abilities || {}) };
  for (const key of flat) {
    const match = String(key).match(/^system\.abilities\.([^.]+)\.(rank|number)$/);
    if (!match) continue;
    const [, ability, field] = match;
    changed.system.abilities[ability] = { ...(changed.system.abilities[ability] || {}), [field]: changed[key] };
  }
}

/**
 * Sheet submitOnChange posts the HTML form that was open when generation
 * started (all Typical / 6). Block that revert whenever we have a stamp.
 */
function protectRolledAbilities(actor, changed, options = {}) {
  if (isApplyingRolledStats(options)) return;
  nestFlatAbilityChanges(changed);
  const rolled = rolledStatsStamp(actor);
  if (!rolled?.abilities || !changed?.system?.abilities) return;
  const incoming = changed.system.abilities;
  const generating = !!(actor.getFlag?.("faserip", "generating") || actor.flags?.faserip?.generating);
  const touched = ABILITIES.filter((key) => incoming[key]);
  if (!touched.length) return;
  const stale = touched.filter((key) => {
    const want = rolled.abilities[key];
    const next = incoming[key];
    if (!want || !next) return false;
    if (next.rank && next.rank !== want) return true;
    if (rolled.numbers?.[key] != null && next.number != null && Number(next.number) !== Number(rolled.numbers[key])) {
      return next.rank === "typical" || generating;
    }
    return false;
  });
  const bulkRevert = touched.length >= 4 && stale.length >= 3;
  if (!generating && !bulkRevert) return;
  for (const key of stale) {
    const want = rolled.abilities[key];
    const wantNum = rolled.numbers?.[key];
    const patch = { rank: want };
    if (wantNum != null) patch.number = Number(wantNum);
    incoming[key] = patch;
  }
  if (stale.length) {
    console.log("FASERIP | blocked stale ability submit", stale, rolled.abilities);
  }
}

export class FaseripActor extends Actor {
  async _preUpdate(changed, options, userId) {
    try { protectRolledAbilities(this, changed, options); } catch (err) {
      console.warn("FASERIP | protectRolledAbilities", err);
    }
    return super._preUpdate(changed, options, userId);
  }

  static async createDialog(data = {}, options = {}) {
    if (data?.type && data.type !== "hero" && data.type !== "npc") {
      return super.createDialog(data, options);
    }
    try {
      const actor = await createActorWizard();
      if (actor) return actor;
    } catch (err) {
      console.error("FASERIP | createDialog wizard failed", err);
      ui.notifications?.error(err.message);
    }
    return super.createDialog(data, options);
  }

  prepareBaseData() {
    super.prepareBaseData();
  }

  prepareDerivedData() {
    super.prepareDerivedData();
  }

  getAbilityRank(ability) {
    const data = this.system.abilities?.[ability];
    const rolled = this.getFlag?.("faserip", "rolledStats")?.abilities?.[ability]
      || this.flags?.faserip?.rolledStats?.abilities?.[ability]
      || "";
    return abilityRankId(data, rolled);
  }

  getAbilityNumber(ability) {
    const data = this.system.abilities?.[ability] || {};
    const rolled = this.flags?.faserip?.rolledStats;
    const number = Number(data.number || 0) || Number(rolled?.numbers?.[ability] || 0);
    return abilityNumber({ rank: this.getAbilityRank(ability), number });
  }

  getBodyArmor() {
    let armor = Number(this.system.defense?.bodyArmor || 0);
    for (const item of this.items) {
      if (!item.system?.bodyArmor) continue;
      const n = Number(item.system.number || 0) || rankValue(item.system.rank);
      if (n > armor) armor = n;
    }
    return shiftedArmor(armor, readPending(this).armorCs);
  }

  getForceField() {
    let ff = Number(this.system.defense?.forceField || 0);
    for (const item of this.items) {
      if (!item.system?.forceField) continue;
      const n = Number(item.system.number || 0) || rankValue(item.system.rank);
      if (n > ff) ff = n;
    }
    return ff;
  }

  async applyDamage(amount, { energy = false, ignoreArmor = false, useForceField = false, bonusArmor = 0, protection = null } = {}) {
    let incoming = Number(amount || 0);
    if (!ignoreArmor) {
      let soak = Number.isFinite(protection) ? protection : null;
      if (soak == null) {
        const { soakAmount } = await import("../battle-results.mjs");
        soak = soakAmount(this, { energy, useForceField, bonusArmor });
      }
      incoming = Math.max(0, incoming - soak);
    }
    const absorb = this.getFlag?.("faserip", "absorbing");
    let absorbed = 0;
    if (absorb && incoming > 0) {
      const cap = rankValue(absorb.rank || "typical");
      absorbed = Math.min(incoming, cap);
      incoming -= absorbed;
      try { await this.unsetFlag("faserip", "absorbing"); } catch { /* the hit still resolves */ }
    }
    const value = Math.max(0, (this.system.health.value ?? 0) - incoming);
    const update = {
      "system.health.value": value,
      "system.condition.lastDamageRound": game.combat?.round ?? 0,
      "system.condition.recoveredToday": false,
      "flags.faserip.healthLock": { value, at: Date.now() }
    };
    if (value === 0) update["system.condition.unconscious"] = true;
    await this.update(update, { faseripDamage: true });
    if (readPending(this).armorCs) await writePending(this, { armorCs: 0, armorNote: "" });
    if (value === 0) {
      const { collapseAtZero } = await import("../battle-results.mjs");
      await collapseAtZero(this);
    }
    if (absorbed > 0) {
      await this.heal(absorbed);
      globalThis.ui?.notifications?.info(`${this.name} absorbs ${absorbed} of that hit as Health.`);
    }
    return incoming;
  }

  async heal(amount) {
    if (this.getFlag("faserip", "poison")) {
      ui.notifications?.warn(`${this.name} cannot regain Health until the poison is treated.`);
      return;
    }
    const max = this.system.health.max ?? 0;
    const value = Math.min(max, (this.system.health.value ?? 0) + Number(amount || 0));
    const out = this.getFlag("faserip", "battle");
    const stillOut = out?.cause === "poison" && out?.state === "unconscious" && Number(out.rounds) > 0;
    const update = { "system.health.value": value };
    if (value > 0 && !stillOut) update["system.condition.unconscious"] = false;
    await this.update(update, { faseripHeal: true });
    if (value > 0 && !stillOut) {
      const { releaseIfConscious } = await import("../battle-results.mjs");
      await releaseIfConscious(this);
    }
    return value;
  }

  async recover() {
    const { recoveryUsed, stampRecovery } = await import("../clock.mjs");
    if (recoveryUsed(this)) {
      ui.notifications.warn(`${this.name} already used Recovery today.`);
      return;
    }
    const last = Number(this.system.condition?.lastDamageRound || 0);
    const round = Number(game.combat?.round || 0);
    if (round && last && round - last < 10) {
      ui.notifications.warn(`${this.name} can recover 10 turns after the last hit. ${10 - (round - last)} turns remain.`);
      return;
    }
    const amount = this.getAbilityNumber("endurance");
    await this.heal(amount);
    await stampRecovery(this);
    return this.update({ "system.condition.recoveredToday": true });
  }

  async naturalHeal({ rest = false } = {}) {
    const now = Number(globalThis.game?.time?.worldTime || 0);
    const last = this.getFlag("faserip", "hourHealAt");
    if (last != null && last !== "" && now - Number(last) < 3600) {
      const left = Math.max(1, Math.ceil((3600 - (now - Number(last))) / 60));
      ui.notifications?.warn(`${this.name} regains Health once an hour. ${left} minute${left === 1 ? "" : "s"} left on the world clock.`);
      return;
    }
    const amount = this.getAbilityNumber("endurance") * (rest ? 2 : 1);
    const healed = await this.heal(amount);
    if (healed == null) return;
    await this.setFlag("faserip", "hourHealAt", now);
    return healed;
  }

  async spendKarma(amount) {
    const value = Math.max(0, (this.system.karma.value ?? 0) - Number(amount || 0));
    return this.update({ "system.karma.value": value });
  }

  async rollAbility(ability, { cs = 0, karma = 0, label, intensityId, effectsColumn } = {}) {
    const base = this.getAbilityRank(ability);
    return rollFeat({
      actor: this,
      rankId: base,
      cs,
      karma,
      intensityId,
      effectsColumn,
      label: label ?? game.i18n.localize(`FASERIP.Ability.${ability}`)
    });
  }

  getInitiativeMod() {
    let number = this.getAbilityNumber("intuition");
    for (const key of ["combatSense", "circularVision"]) {
      const rank = this.getFlag?.("faserip", key);
      if (rank) number = Math.max(number, rankValue(rank));
    }
    return initiativeModifier(number) + initiativeTalentBonus(this);
  }

  getInitiativeRoll() {
    const mod = this.getInitiativeMod();
    const RollClass = globalThis.foundry?.dice?.Roll ?? globalThis.Roll;
    const roll = typeof RollClass?.create === "function"
      ? RollClass.create("1d10", this.getRollData())
      : new RollClass("1d10", this.getRollData());
    const evaluate = roll.evaluate.bind(roll);
    roll.evaluate = async (options = {}) => {
      await evaluate({ ...options, allowInteractive: false });
      const term = roll.terms?.find((part) => part.faces === 10);
      const face = Number(term?.results?.[0]?.result ?? term?.total ?? roll.total);
      roll._total = workflowOn("strictInitiative") ? initiativeTotal(face, mod) : face + mod;
      return roll;
    };
    return roll;
  }

  async rollInitiative({ createCombatants = false, rerollInitiative = false } = {}) {
    return super.rollInitiative({ createCombatants, rerollInitiative });
  }

  getRollData() {
    const data = super.getRollData();
    data.abilities = {};
    for (const key of ABILITIES) {
      const rank = this.getAbilityRank(key);
      data.abilities[key] = { rank, value: this.getAbilityNumber(key) };
    }
    data.health = this.system.health;
    data.karma = this.system.karma;
    data.initMod = this.getInitiativeMod();
    data.bodyArmor = this.getBodyArmor();
    return data;
  }
}

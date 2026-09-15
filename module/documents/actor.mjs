import { rankValue, ABILITIES, abilityNumber, initiativeModifier } from "../config.mjs";
import { rollFeat } from "../dice/universal-table.mjs";
import { createActorWizard } from "../wizard.mjs";

function rolledStatsStamp(actor) {
  return actor.getFlag?.("faserip", "rolledStats") || actor.flags?.faserip?.rolledStats || null;
}

function isApplyingRolledStats(options = {}) {
  return !!(options.faseripApplyRolls || options.faseripReapply);
}

/**
 * Sheet submitOnChange posts the HTML form that was open when generation
 * started (all Typical / 6). Block that revert whenever we have a stamp.
 */
function protectRolledAbilities(actor, changed, options = {}) {
  if (isApplyingRolledStats(options)) return;
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
    return this.system.abilities?.[ability]?.rank ?? "typical";
  }

  getAbilityNumber(ability) {
    return abilityNumber(this.system.abilities?.[ability]);
  }

  getBodyArmor() {
    let armor = Number(this.system.defense?.bodyArmor || 0);
    for (const item of this.items) {
      if (!item.system?.bodyArmor) continue;
      const n = Number(item.system.number || 0) || rankValue(item.system.rank);
      if (n > armor) armor = n;
    }
    return armor;
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

  async applyDamage(amount, { energy = false, ignoreArmor = false, useForceField = false } = {}) {
    let incoming = Number(amount || 0);
    if (!ignoreArmor) {
      if (useForceField) {
        const ff = this.getForceField();
        const protection = energy ? ff : Math.max(0, ff - 10);
        incoming = Math.max(0, incoming - protection);
      } else {
        let armor = this.getBodyArmor();
        if (energy) armor = Math.max(0, armor - 20);
        incoming = Math.max(0, incoming - armor);
      }
    }
    const value = Math.max(0, (this.system.health.value ?? 0) - incoming);
    const update = {
      "system.health.value": value,
      "system.condition.lastDamageRound": game.combat?.round ?? 0,
      "system.condition.recoveredToday": false
    };
    if (value === 0) update["system.condition.unconscious"] = true;
    await this.update(update);
    return incoming;
  }

  async heal(amount) {
    const max = this.system.health.max ?? 0;
    const value = Math.min(max, (this.system.health.value ?? 0) + Number(amount || 0));
    const update = { "system.health.value": value };
    if (value > 0) update["system.condition.unconscious"] = false;
    return this.update(update);
  }

  async recover() {
    if (this.system.condition?.recoveredToday) {
      ui.notifications.warn(`${this.name} already used Recovery today.`);
      return;
    }
    const amount = this.getAbilityNumber("endurance");
    await this.heal(amount);
    return this.update({ "system.condition.recoveredToday": true });
  }

  async naturalHeal({ rest = false } = {}) {
    const amount = this.getAbilityNumber("endurance") * (rest ? 2 : 1);
    return this.heal(amount);
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
    return initiativeModifier(this.getAbilityNumber("intuition"));
  }

  async getInitiativeRoll(formula) {
    const mod = this.getInitiativeMod();
    const f = formula || `1d10 + ${mod}`;
    return new Roll(f, this.getRollData());
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

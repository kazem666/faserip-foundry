import { rankValue, ABILITIES, abilityNumber, initiativeModifier } from "../config.mjs";
import { rollFeat } from "../dice/universal-table.mjs";

export class FaseripActor extends Actor {
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

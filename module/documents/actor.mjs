import { rankValue, ABILITIES, abilityNumber, initiativeModifier } from "../config.mjs";
import { rollFeat } from "../dice/universal-table.mjs";
import { createActorWizard } from "../wizard.mjs";

export class FaseripActor extends Actor {
  static async createDialog(data = {}, options = {}) {
    if (data?.type && data.type !== "hero" && data.type !== "npc") {
      return super.createDialog(data, options);
    }
    return createActorWizard();
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
        incoming = Math.max(0, incoming - (energy ? ff : Math.max(0, ff - 10)));
      } else {
        let armor = this.getBodyArmor();
        if (energy) armor = Math.max(0, armor - 20);
        incoming = Math.max(0, incoming - armor);
      }
    }
    const value = Math.max(0, (this.system.health.value ?? 0) - incoming);
    const update = { "system.health.value": value, "system.condition.lastDamageRound": game.combat?.round ?? 0, "system.condition.recoveredToday": false };
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
    await this.heal(this.getAbilityNumber("endurance"));
    return this.update({ "system.condition.recoveredToday": true });
  }

  async naturalHeal({ rest = false } = {}) {
    return this.heal(this.getAbilityNumber("endurance") * (rest ? 2 : 1));
  }

  getInitiativeMod() {
    return initiativeModifier(this.getAbilityNumber("intuition"));
  }

  getRollData() {
    const data = super.getRollData();
    data.abilities = {};
    for (const key of ABILITIES) {
      data.abilities[key] = { rank: this.getAbilityRank(key), value: this.getAbilityNumber(key) };
    }
    data.health = this.system.health;
    data.karma = this.system.karma;
    data.initMod = this.getInitiativeMod();
    data.bodyArmor = this.getBodyArmor();
    return data;
  }
}

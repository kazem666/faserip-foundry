import { ABILITIES, PHYSICAL, MENTAL, abilityNumber, MOVEMENT_AREAS } from "../config.mjs";

const { NumberField, StringField, SchemaField, HTMLField, BooleanField } = foundry.data.fields;

function abilitySchema() {
  return new SchemaField({
    rank: new StringField({ required: true, initial: "typical" }),
    number: new NumberField({ required: true, integer: true, min: 0, initial: 0 })
  });
}

export class HeroData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const abilities = {};
    for (const key of ABILITIES) abilities[key] = abilitySchema();

    return {
      abilities: new SchemaField(abilities),
      health: new SchemaField({
        value: new NumberField({ required: true, integer: true, min: 0, initial: 24 }),
        max: new NumberField({ required: true, integer: true, min: 0, initial: 24 })
      }),
      karma: new SchemaField({
        value: new NumberField({ required: true, integer: true, min: 0, initial: 18 }),
        max: new NumberField({ required: true, integer: true, min: 0, initial: 18 })
      }),
      resources: new SchemaField({
        rank: new StringField({ required: true, initial: "typical" }),
        number: new NumberField({ required: true, integer: true, min: 0, initial: 0 })
      }),
      popularity: new SchemaField({
        value: new NumberField({ required: true, integer: true, initial: 10 }),
        secret: new NumberField({ required: true, integer: true, initial: 10 })
      }),
      defense: new SchemaField({
        bodyArmor: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        forceField: new NumberField({ required: true, integer: true, min: 0, initial: 0 })
      }),
      condition: new SchemaField({
        unconscious: new BooleanField({ initial: false }),
        enduranceLoss: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        lastDamageRound: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        recoveredToday: new BooleanField({ initial: false })
      }),
      identity: new SchemaField({
        public: new StringField({ initial: "" }),
        secret: new StringField({ initial: "" }),
        group: new StringField({ initial: "" }),
        origin: new StringField({ initial: "" }),
        form: new StringField({ initial: "" }),
        originOfPower: new StringField({ initial: "" }),
        secretId: new BooleanField({ initial: false })
      }),
      biography: new HTMLField({ initial: "" }),
      notes: new HTMLField({ initial: "" })
    };
  }

  prepareDerivedData() {
    const phys = PHYSICAL.reduce((sum, k) => sum + abilityNumber(this.abilities[k]), 0);
    const ment = MENTAL.reduce((sum, k) => sum + abilityNumber(this.abilities[k]), 0);
    this.health.max = phys;
    this.karma.max = ment;
    if (this.health.value > this.health.max) this.health.value = this.health.max;
    if (this.karma.value > this.karma.max) this.karma.value = this.karma.max;

    const endRank = this.abilities.endurance?.rank ?? "typical";
    this.movement = MOVEMENT_AREAS[endRank] ?? 2;
    this.healRate = abilityNumber(this.abilities.endurance);
  }
}

export class NpcData extends HeroData {}

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
        max: new NumberField({ required: true, integer: true, min: 0, initial: 24 }),
        regen: new NumberField({ required: true, integer: true, min: 0, initial: 0 })
      }),
      karma: new SchemaField({
        value: new NumberField({ required: true, integer: true, min: 0, initial: 18 }),
        max: new NumberField({ required: true, integer: true, min: 0, initial: 18 })
      }),
      resources: new SchemaField({
        rank: new StringField({ required: true, initial: "typical" }),
        number: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        usedThisWeek: new StringField({ initial: "" }),
        loan: new StringField({ initial: "" }),
        payment: new StringField({ initial: "" })
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
        secretId: new BooleanField({ initial: false }),
        occupation: new StringField({ initial: "" }),
        legalStatus: new StringField({ initial: "" }),
        age: new StringField({ initial: "" }),
        sex: new StringField({ initial: "" }),
        handed: new StringField({ initial: "" }),
        height: new StringField({ initial: "" }),
        weight: new StringField({ initial: "" }),
        hair: new StringField({ initial: "" }),
        eyes: new StringField({ initial: "" }),
        ears: new StringField({ initial: "" }),
        skin: new StringField({ initial: "" }),
        ethnicity: new StringField({ initial: "" }),
        placeOfBirth: new StringField({ initial: "" }),
        hometown: new StringField({ initial: "" }),
        birthOrder: new StringField({ initial: "" }),
        maritalStatus: new StringField({ initial: "" }),
        knownRelatives: new StringField({ initial: "" }),
        father: new StringField({ initial: "" }),
        mother: new StringField({ initial: "" }),
        siblings: new StringField({ initial: "" }),
        baseOfOperations: new StringField({ initial: "" }),
        pastGroups: new StringField({ initial: "" }),
        aliases: new StringField({ initial: "" }),
        clothing: new StringField({ initial: "" }),
        physicalFeatures: new StringField({ initial: "" }),
        personality: new StringField({ initial: "" }),
        languages: new StringField({ initial: "" }),
        player: new StringField({ initial: "" }),
        era: new StringField({ initial: "" }),
        campaign: new StringField({ initial: "" })
      }),
      karmaBank: new SchemaField({
        fase: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        rip: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        powers: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        talents: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        contacts: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        resources: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        popularity: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        totalSpent: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        pool: new NumberField({ required: true, integer: true, min: 0, initial: 0 })
      }),
      story: new SchemaField({
        briefHistory: new StringField({ initial: "" }),
        roleplaying: new StringField({ initial: "" }),
        weaknesses: new StringField({ initial: "" }),
        miscellaneous: new StringField({ initial: "" }),
        powerStuntHistory: new StringField({ initial: "" }),
        strengths: new StringField({ initial: "" }),
        relationships: new StringField({ initial: "" }),
        family: new StringField({ initial: "" })
      }),
      biography: new HTMLField({ initial: "" }),
      notes: new HTMLField({ initial: "" })
    };
  }

  prepareBaseData() {
    const rolled = this.parent?.flags?.faserip?.rolledStats;
    if (!rolled?.abilities) return;
    for (const key of ABILITIES) {
      const slot = this.abilities?.[key];
      const want = rolled.abilities[key];
      if (!slot || !want) continue;
      const have = slot.rank || "typical";
      if (have !== want && have === "typical") {
        slot.rank = want;
        if (rolled.numbers?.[key] != null) slot.number = Number(rolled.numbers[key]);
      }
    }
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

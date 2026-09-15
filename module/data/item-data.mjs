const { StringField, NumberField, HTMLField, BooleanField, ArrayField, SchemaField } = foundry.data.fields;

class RankedItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      rank: new StringField({ required: true, initial: "typical" }),
      number: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      category: new StringField({ initial: "" }),
      limitation: new StringField({ initial: "" }),
      notes: new HTMLField({ initial: "" })
    };
  }
}

export class PowerData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      rank: new StringField({ required: true, initial: "typical" }),
      number: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      category: new StringField({ initial: "" }),
      powerType: new StringField({ initial: "" }),
      limitation: new StringField({ initial: "" }),
      range: new StringField({ initial: "" }),
      area: new StringField({ initial: "" }),
      acceleration: new StringField({ initial: "" }),
      mph: new StringField({ initial: "" }),
      mpm: new StringField({ initial: "" }),
      areasPerRound: new StringField({ initial: "" }),
      emanatesFrom: new StringField({ initial: "" }),
      slotsTaken: new NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      definition: new StringField({ initial: "" }),
      bodyArmor: new BooleanField({ initial: false }),
      forceField: new BooleanField({ initial: false }),
      effectsColumn: new StringField({ initial: "" }),
      notes: new HTMLField({ initial: "" }),
      stunts: new ArrayField(new SchemaField({
        name: new StringField({ initial: "" }),
        rank: new StringField({ initial: "" }),
        description: new StringField({ initial: "" }),
        attempts: new NumberField({ required: true, integer: true, min: 0, max: 10, initial: 0 }),
        mastered: new BooleanField({ initial: false })
      }))
    };
  }
}

export class TalentData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      rank: new StringField({ required: true, initial: "typical" }),
      number: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      category: new StringField({ initial: "" }),
      bonus: new StringField({ initial: "" }),
      attribute: new StringField({ initial: "" }),
      slotsTaken: new NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      definition: new StringField({ initial: "" }),
      notes: new HTMLField({ initial: "" })
    };
  }
}

export class ContactData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      rank: new StringField({ required: true, initial: "typical" }),
      number: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      category: new StringField({ initial: "" }),
      occupation: new StringField({ initial: "" }),
      base: new StringField({ initial: "" }),
      tie: new StringField({ initial: "" }),
      practicality: new StringField({ initial: "" }),
      assistance: new NumberField({ required: true, integer: true, min: 0, max: 10, initial: 0 }),
      acquired: new BooleanField({ initial: false }),
      definition: new StringField({ initial: "" }),
      notes: new HTMLField({ initial: "" })
    };
  }
}

export class EquipmentData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      rank: new StringField({ required: true, initial: "typical" }),
      number: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      material: new StringField({ required: true, initial: "typical" }),
      category: new StringField({ initial: "" }),
      definition: new StringField({ initial: "" }),
      range: new StringField({ initial: "" }),
      bodyArmor: new BooleanField({ initial: false }),
      notes: new HTMLField({ initial: "" })
    };
  }
}

export class WeaponData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      rank: new StringField({ required: true, initial: "typical" }),
      number: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      material: new StringField({ required: true, initial: "typical" }),
      category: new StringField({ initial: "" }),
      definition: new StringField({ initial: "" }),
      range: new StringField({ initial: "1 area" }),
      damage: new StringField({ initial: "" }),
      weaponType: new StringField({ initial: "Blunt" }),
      effectsColumn: new StringField({ initial: "blunt" }),
      notes: new HTMLField({ initial: "" })
    };
  }
}

export { RankedItemData };

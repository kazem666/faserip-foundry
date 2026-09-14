const { StringField, NumberField, HTMLField, BooleanField } = foundry.data.fields;

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
      limitation: new StringField({ initial: "" }),
      bodyArmor: new BooleanField({ initial: false }),
      forceField: new BooleanField({ initial: false }),
      effectsColumn: new StringField({ initial: "" }),
      notes: new HTMLField({ initial: "" })
    };
  }
}

export class TalentData extends RankedItemData {}
export class ContactData extends RankedItemData {}

export class EquipmentData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      rank: new StringField({ required: true, initial: "typical" }),
      number: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      material: new StringField({ required: true, initial: "typical" }),
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
      range: new StringField({ initial: "1 area" }),
      damage: new StringField({ initial: "" }),
      weaponType: new StringField({ initial: "Blunt" }),
      effectsColumn: new StringField({ initial: "blunt" }),
      notes: new HTMLField({ initial: "" })
    };
  }
}

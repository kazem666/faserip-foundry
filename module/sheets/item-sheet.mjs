import { RANKS, BATTLE_EFFECTS } from "../config.mjs";
import { getItemSheetClass } from "../foundry-api.mjs";

const ItemSheetBase = getItemSheetClass();

export class FaseripItemSheet extends ItemSheetBase {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["faserip", "sheet", "item"],
      template: "systems/faserip/templates/item/item-sheet.hbs",
      width: 520,
      height: 560,
      resizable: true,
      submitOnChange: true
    });
  }

  async getData(options) {
    const context = await super.getData(options);
    context.item = this.document ?? this.item;
    context.system = context.item.system;
    context.ranks = RANKS;
    context.columns = Object.entries(BATTLE_EFFECTS).map(([id, col]) => ({ id, label: col.label }));
    context.isPower = context.item.type === "power";
    context.isTalent = context.item.type === "talent";
    context.isContact = context.item.type === "contact";
    context.isWeapon = context.item.type === "weapon";
    context.isEquipment = context.item.type === "equipment" || context.item.type === "weapon";
    context.cssClass = context.cssClass || "editable";
    context.editable = this.isEditable;
    return context;
  }
}

import { RANKS, BATTLE_EFFECTS, MATERIAL_EXAMPLES } from "../config.mjs";
import { getItemSheetClass, getTextEditor } from "../foundry-api.mjs";

const ItemSheetBase = getItemSheetClass();

export class FaseripItemSheet extends ItemSheetBase {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["faserip", "sheet", "item"],
      template: "systems/faserip/templates/item/item-sheet.hbs",
      width: 500,
      height: 560
    });
  }

  async getData(options) {
    const context = await super.getData(options);
    context.ranks = RANKS;
    context.system = this.item.system;
    context.isWeapon = this.item.type === "weapon";
    context.isEquipment = this.item.type === "equipment" || this.item.type === "weapon";
    context.isPower = this.item.type === "power";
    context.columns = Object.entries(BATTLE_EFFECTS).map(([id, col]) => ({ id, label: col.label }));
    context.materialHint = MATERIAL_EXAMPLES[this.item.system.material] ?? "";
    context.enrichedNotes = await getTextEditor().enrichHTML(this.item.system.notes ?? "", {
      secrets: this.item.isOwner
    });
    return context;
  }
}

import { RANKS, BATTLE_EFFECTS } from "../config.mjs";
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export class FaseripItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["faserip", "item"],
    position: { width: 520, height: 520 },
    form: { submitOnChange: true, closeOnSubmit: false },
    window: { resizable: true }
  };
  static PARTS = { body: { template: "systems/faserip/templates/item/item-sheet.hbs" } };
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.item = this.document;
    context.system = this.document.system;
    context.ranks = RANKS;
    context.columns = Object.entries(BATTLE_EFFECTS).map(([id, col]) => ({ id, label: col.label }));
    return context;
  }
}

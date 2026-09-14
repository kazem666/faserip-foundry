import { RANKS, BATTLE_EFFECTS } from "../config.mjs";
import { getItemSheetV2, getItemSheetV1, getItemSheetClass, getHandlebarsMixin } from "../foundry-api.mjs";

const TEMPLATE = "systems/faserip/templates/item/item-sheet.hbs";

function fillItemContext(sheet, context = {}) {
  const item = sheet.document ?? sheet.item;
  context.item = item;
  context.system = item.system;
  context.ranks = RANKS;
  context.columns = Object.entries(BATTLE_EFFECTS).map(([id, col]) => ({ id, label: col.label }));
  context.isPower = item.type === "power";
  context.isTalent = item.type === "talent";
  context.isContact = item.type === "contact";
  context.isWeapon = item.type === "weapon";
  context.isEquipment = item.type === "equipment" || item.type === "weapon";
  context.cssClass = context.cssClass || (sheet.isEditable ? "editable" : "locked");
  context.editable = sheet.isEditable;
  return context;
}

export function buildItemSheetClass() {
  const Mixin = getHandlebarsMixin();
  const V2 = getItemSheetV2();
  if (typeof Mixin === "function" && typeof V2 === "function") {
    return class FaseripItemSheet extends Mixin(V2) {
      static DEFAULT_OPTIONS = {
        classes: ["faserip", "sheet", "item"],
        tag: "form",
        position: { width: 520, height: 560 },
        window: { resizable: true, icon: "fa-solid fa-bolt" },
        form: { submitOnChange: true, closeOnSubmit: false }
      };
      static PARTS = { body: { template: TEMPLATE, scrollable: [""] } };
      async _prepareContext(options) {
        const context = await super._prepareContext(options);
        return fillItemContext(this, context);
      }
    };
  }
  const V1 = getItemSheetV1() ?? getItemSheetClass();
  return class FaseripItemSheet extends V1 {
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions ?? {}, {
        classes: ["faserip", "sheet", "item"],
        template: TEMPLATE,
        width: 520,
        height: 560,
        resizable: true,
        submitOnChange: true
      });
    }
    async getData(options) {
      const context = await super.getData(options);
      return fillItemContext(this, context);
    }
  };
}

const ItemSheetBase = getItemSheetClass();
export class FaseripItemSheet extends ItemSheetBase {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions ?? {}, {
      classes: ["faserip", "sheet", "item"],
      template: TEMPLATE,
      width: 520,
      height: 560,
      resizable: true,
      submitOnChange: true
    });
  }
  async getData(options) {
    const context = await super.getData(options);
    return fillItemContext(this, context);
  }
}

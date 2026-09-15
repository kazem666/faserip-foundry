import { rollFeat } from "../dice/universal-table.mjs";

export class FaseripItem extends Item {
  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user);
    const fillTypes = new Set(["power", "talent", "weapon", "equipment", "contact"]);
    if (!fillTypes.has(this.type)) return;
    const { describeCatalogItem } = await import("../data/descriptions.mjs");
    const info = describeCatalogItem(this.type, this.name, this.system ?? {});
    const patch = {};
    if (!this.system.definition && info.definition) patch["system.definition"] = info.definition;
    if (this.type === "talent") {
      if (!this.system.bonus && info.bonus) patch["system.bonus"] = info.bonus;
      if (!this.system.attribute && info.attribute) patch["system.attribute"] = info.attribute;
    }
    if (this.type === "power" && info.slotsTaken && !data.system?.slotsTaken) {
      patch["system.slotsTaken"] = info.slotsTaken;
    }
    if (this.type === "weapon") {
      if (!this.system.weaponType && info.weaponType) patch["system.weaponType"] = info.weaponType;
      if (!this.system.damage && info.damage) patch["system.damage"] = info.damage;
      if ((!this.system.range || this.system.range === "1 area") && info.range) patch["system.range"] = info.range;
      if (info.effectsColumn && !data.system?.effectsColumn) patch["system.effectsColumn"] = info.effectsColumn;
      if (info.material && this.system.material === "typical") patch["system.material"] = info.material;
    }
    if ((this.type === "equipment" || this.type === "contact") && info.category && !this.system.category) {
      patch["system.category"] = info.category;
    }
    if (this.type === "contact" && info.occupation && !this.system.occupation) {
      patch["system.occupation"] = info.occupation;
    }
    if (Object.keys(patch).length) this.updateSource(patch);
  }

  async roll({ cs = 0, karma = 0, intensityId = "", effectsColumn = "" } = {}) {
    const rankId = this.system.rank ?? "typical";
    return rollFeat({
      actor: this.actor,
      item: this,
      rankId,
      cs,
      karma,
      intensityId,
      effectsColumn: effectsColumn || this.system.effectsColumn || "",
      label: this.name
    });
  }
}

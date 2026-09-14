import { rollFeat } from "../dice/universal-table.mjs";

export class FaseripItem extends Item {
  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user);
    if (this.type !== "power" && this.type !== "talent") return;
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

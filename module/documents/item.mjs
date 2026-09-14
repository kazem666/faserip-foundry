import { rollFeat } from "../dice/universal-table.mjs";

export class FaseripItem extends Item {
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

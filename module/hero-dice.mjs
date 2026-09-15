import {
  ABILITIES, ORIGINS, ORIGIN_TABLE, SPECIAL_COUNT_TABLE, ABILITY_MODIFIER_TABLE,
  rankMin, shiftRank, lookupTable, rollOnColumn, originById
} from "./config.mjs";
import { rollD100, promptedD100, promptNextRoll } from "./dice/percentile.mjs";
import { UPB_COUNT_TABLE } from "./data/upb.mjs";
import { clampCounts, persistGenerationStats } from "./chargen.mjs";

export async function promptGeneration(actor) {
  const { isUpbEnabled } = await import("./data/upb.mjs");
  const upbOn = isUpbEnabled();
  const originOptions = ORIGINS.map((o) => `<option value="${o.id}">${o.label}</option>`).join("");
  const DialogV2 = foundry.applications.api.DialogV2;
  const form = await DialogV2.wait({
    classes: ["faserip-dialog"],
    window: { title: "Generate Hero", icon: "fa-solid fa-dice", resizable: true },
    content: `
    <div class="faserip-dialog-scroll">
    <form class="faserip-feat-dialog">
      <div class="form-group"><label><input type="checkbox" name="useUpb" ${upbOn ? "checked" : ""} /> Use Ultimate Powers Book (MA3)</label></div>
      <div class="form-group"><label>Advanced Set origin (ignored if UPB is on)</label><select name="origin">${originOptions}</select></div>
      <div class="form-group"><label><input type="checkbox" name="rollOrigin" ${upbOn ? "" : "checked"} /> Roll Advanced Set origin</label></div>
      <div class="form-group"><label><input type="checkbox" name="secretId" /> Secret identity</label></div>
    </form>
    </div>`,
    buttons: [
      { action: "generate", label: "Generate", icon: "fa-solid fa-dice", default: true, callback: (_e, b) => b.form },
      { action: "cancel", label: "Cancel" }
    ],
    rejectClose: false
  });
  if (!form || form === "cancel") return null;
  const { runFullGeneration } = await import("./wizard.mjs");
  await runFullGeneration(actor, {
    originId: form.querySelector('[name="origin"]')?.value,
    rollOrigin: !!form.querySelector('[name="rollOrigin"]')?.checked,
    secretId: !!form.querySelector('[name="secretId"]')?.checked,
    useUpb: !!form.querySelector('[name="useUpb"]')?.checked,
    publicId: actor.system.identity?.public,
    secretName: actor.system.identity?.secret
  });
  return true;
}

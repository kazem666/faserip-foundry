import {
  colorForRoll,
  rankLabel,
  shiftRank,
  RANK_BY_ID,
  BATTLE_EFFECTS,
  intensityNeeded,
  battleResult
} from "../config.mjs";

const COLOR_HEX = {
  white: "#f4f0e6",
  green: "#2f9e44",
  yellow: "#f5c518",
  red: "#c92a2a"
};

export async function rollFeat({
  actor = null,
  item = null,
  rankId = "typical",
  cs = 0,
  karma = 0,
  label = "FEAT",
  intensityId = "",
  effectsColumn = ""
} = {}) {
  const effectiveId = shiftRank(rankId, Number(cs) || 0);
  let spend = Number(karma) || 0;
  if (spend > 0 && spend < 10) {
    ui.notifications.warn("Karma spent to modify a roll must be at least 10.");
    spend = 10;
  }

  if (actor && spend > 0 && actor.system?.karma) {
    const available = actor.system.karma.value ?? 0;
    if (available < spend) {
      ui.notifications.warn(`${actor.name} does not have ${spend} Karma.`);
      spend = 0;
    } else {
      await actor.update({ "system.karma.value": available - spend });
    }
  }

  const roll = await new Roll("1d100").evaluate({ allowInteractive: false });
  const raw = Number(roll.total);
  const adjusted = Math.min(100, Math.max(1, raw + spend));
  const color = colorForRoll(effectiveId, adjusted);
  const rank = RANK_BY_ID[effectiveId];
  const intensity = intensityNeeded(effectiveId, intensityId || "");
  let intensityPass = true;
  if (intensityId) {
    if (intensity.automatic) intensityPass = true;
    else if (intensity.impossible) intensityPass = color === "red";
    else if (intensity.color === "green") intensityPass = color !== "white";
    else if (intensity.color === "yellow") intensityPass = color === "yellow" || color === "red";
    else intensityPass = color === "red";
  }
  const effect = effectsColumn ? battleResult(effectsColumn, color) : "";
  const effectLabel = effectsColumn ? (BATTLE_EFFECTS[effectsColumn]?.label ?? effectsColumn) : "";

  const content = await foundry.applications.handlebars.renderTemplate("systems/faserip/templates/chat/feat-roll.hbs", {
    actorName: actor?.name ?? "",
    itemName: item?.name ?? "",
    label,
    raw,
    adjusted,
    karma: spend,
    cs: Number(cs) || 0,
    color,
    colorLabel: game.i18n.localize(`FASERIP.Color.${color}`),
    colorHint: game.i18n.localize(`FASERIP.ColorHint.${color}`),
    baseRank: rankLabel(rankId),
    effectiveRank: rankLabel(effectiveId),
    rankValue: rank?.value ?? 0,
    intensityId,
    intensityLabel: intensityId ? rankLabel(intensityId) : "",
    intensityNeed: intensityId ? intensity.label : "",
    intensityPass,
    effect,
    effectLabel
  });

  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    rolls: [roll],
    flags: {
      faserip: {
        color,
        rankId: effectiveId,
        roll: adjusted,
        intensityId: intensityId || null,
        intensityPass,
        effectsColumn: effectsColumn || null,
        effect
      }
    }
  });
}

function optionList(entries, selected = "") {
  return entries
    .map(([id, label]) => `<option value="${id}" ${id === selected ? "selected" : ""}>${label}</option>`)
    .join("");
}

export async function promptFeatRoll({
  actor,
  rankId,
  label,
  defaultColumn = "",
  defaultIntensity = ""
} = {}) {
  const ranks = (game.faserip?.ranks ?? []).map((r) => [r.id, r.label]);
  const columns = [["", "— none (plain FEAT) —"], ...Object.entries(BATTLE_EFFECTS).map(([id, col]) => [id, col.label])];
  const intensityOpts = [["", "— no Intensity —"], ...ranks];

  const content = `
    <div class="faserip-dialog-scroll">
    <form class="faserip-feat-dialog">
      <p><strong>${label}</strong> — ${rankLabel(rankId)}</p>
      <div class="form-group">
        <label>Column Shift (+ right / easier, − left / harder)</label>
        <input type="number" name="cs" value="0" step="1" />
      </div>
      <div class="form-group">
        <label>Spend Karma (minimum 10 to modify the d100)</label>
        <input type="number" name="karma" value="0" min="0" step="1" />
      </div>
      <div class="form-group">
        <label>Intensity (non-combat FEATs)</label>
        <select name="intensity">${optionList(intensityOpts, defaultIntensity)}</select>
        <p class="hint">Ability &gt; Intensity → Green. Equal → Yellow. Intensity higher → Red. 3+ ranks easier may be Automatic.</p>
      </div>
      <div class="form-group">
        <label>Battle Effects column</label>
        <select name="column">${optionList(columns, defaultColumn)}</select>
      </div>
    </form>
    </div>
  `;

  const DialogV2 = foundry.applications.api.DialogV2;
  const form = await DialogV2.wait({
    classes: ["faserip-dialog"],
    window: { title: `${label} FEAT`, icon: "fa-solid fa-dice", resizable: true },
    content,
    buttons: [
      {
        action: "roll",
        label: "Roll",
        icon: "fa-solid fa-dice",
        default: true,
        callback: (_event, button) => button.form
      },
      { action: "cancel", label: "Cancel", icon: "fa-solid fa-xmark" }
    ],
    rejectClose: false
  });
  if (!form || form === "cancel") return null;
  const cs = Number(form.querySelector('[name="cs"]')?.value || 0);
  const karma = Number(form.querySelector('[name="karma"]')?.value || 0);
  const intensityId = form.querySelector('[name="intensity"]')?.value || "";
  const effectsColumn = form.querySelector('[name="column"]')?.value || "";
  return rollFeat({ actor, rankId, label, cs, karma, intensityId, effectsColumn });
}

export { COLOR_HEX };

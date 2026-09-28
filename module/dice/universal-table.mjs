import {
  colorForRoll,
  rankLabel,
  shiftRank,
  RANK_BY_ID,
  BATTLE_EFFECTS,
  intensityNeeded,
  battleResult
} from "../config.mjs";
import { abilityForColumn, sceneActorChoices } from "../play-rules.mjs";
import { shiftPlan, showCombatButtons } from "../workflow.mjs";

const COLOR_HEX = {
  white: "#f4f0e6",
  green: "#2f9e44",
  yellow: "#f5c518",
  red: "#c92a2a"
};

const COLUMN_ALIAS = {
  wrestling: "grappling",
  slugfest: "blunt",
  "blunt attack": "blunt",
  "edged attack": "edged",
  "edged throwing": "throwEdged",
  "blunt throwing": "throwBlunt"
};

function resolveBattleColumn(columnId) {
  const raw = String(columnId || "").trim();
  if (!raw) return "";
  if (BATTLE_EFFECTS[raw]) return raw;
  return COLUMN_ALIAS[raw] || COLUMN_ALIAS[raw.toLowerCase()] || raw;
}

export async function rollFeat({
  actor = null,
  item = null,
  rankId = "typical",
  cs = 0,
  karma = 0,
  label = "FEAT",
  intensityId = "",
  effectsColumn = "",
  targetId = "",
  shiftNotes = "",
  consumeOutgoing = false,
  consumeIncoming = false,
  holdPending = false
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
  const columnId = resolveBattleColumn(effectsColumn);
  const effect = columnId ? battleResult(columnId, color) : "";
  const effectLabel = columnId ? (BATTLE_EFFECTS[columnId]?.label ?? columnId) : "";

  const target = targetId ? game.actors.get(targetId) : null;
  let combat = {};
  if (!holdPending) {
    const { settleShifts, combatFlags } = await import("../play.mjs");
    await settleShifts({
      actor,
      target,
      columnId,
      effect,
      consumeOutgoing,
      consumeIncoming
    });
    combat = combatFlags({ actor, item, target, columnId, effect });
  }
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
    effectLabel,
    shiftNotes,
    targetName: combat.targetName || target?.name || "",
    damageAmount: combat.damageAmount ?? null,
    canDamage: combat.damageAmount != null,
    damageEnergy: !!combat.damageEnergy,
    checkColumn: combat.checkColumn || "",
    checkLabel: combat.checkColumn ? (BATTLE_EFFECTS[combat.checkColumn]?.label ?? "") : "",
    showButtons: showCombatButtons()
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
        label,
        actorName: actor?.name ?? "",
        intensityId: intensityId || null,
        intensityPass,
        effectsColumn: columnId || null,
        effect,
        targetId: combat.targetId || null,
        targetName: combat.targetName || target?.name || "",
        damageAmount: combat.damageAmount ?? null,
        damageEnergy: !!combat.damageEnergy,
        checkColumn: combat.checkColumn || null,
        attackerId: actor?.id || null
      }
    }
  });
}

function optionList(entries, selected = "") {
  return entries
    .map(([id, label]) => `<option value="${id}" ${id === selected ? "selected" : ""}>${label}</option>`)
    .join("");
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

export async function promptFeatRoll({
  actor,
  item = null,
  rankId,
  label,
  ability = "",
  defaultColumn = "",
  defaultIntensity = "",
  holdPending = false
} = {}) {
  const ranks = (game.faserip?.ranks ?? []).map((r) => [r.id, r.label]);
  const columns = [["", "— none (plain FEAT) —"], ...Object.entries(BATTLE_EFFECTS).map(([id, col]) => [id, col.label])];
  const intensityOpts = [["", "— no Intensity —"], ...ranks];
  const targets = sceneActorChoices().filter((choice) => choice.id !== actor?.id);
  const targetOptions = [["", "— no target —"], ...targets.map((choice) => [choice.id, choice.name])];
  const preselected = targets.find((choice) => choice.targeted)?.id || "";
  const weaponHint = item?.type === "weapon"
    ? `<p class="hint">${esc(item.system.weaponType || "Weapon")} · ${esc(item.system.range || "touch")} · damage ${esc(item.system.damage || "by Strength / material")} · column ${esc(BATTLE_EFFECTS[item.system.effectsColumn]?.label || item.system.effectsColumn || "none")}</p>`
    : "";

  const content = `
    <div class="faserip-dialog-scroll">
    <form class="faserip-feat-dialog" data-ability="${esc(ability)}">
      <p><strong>${esc(label)}</strong> — ${esc(rankLabel(rankId))}</p>
      ${weaponHint}
      <div class="form-group">
        <label>Target</label>
        <select name="target">${optionList(targetOptions, preselected)}</select>
      </div>
      <div class="form-group">
        <label>Column Shift (+ right / easier, − left / harder)</label>
        <input type="number" name="cs" value="0" step="1" />
        <p class="hint shift-hint"></p>
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

  const refreshShift = (root) => {
    if (!root || holdPending) return;
    const column = root.querySelector('[name="column"]')?.value || "";
    const target = game.actors.get(root.querySelector('[name="target"]')?.value || "");
    const plan = shiftPlan(actor, {
      ability: abilityForColumn(column, ability),
      effectsColumn: column,
      target
    });
    const input = root.querySelector('[name="cs"]');
    const hint = root.querySelector(".shift-hint");
    if (input && !input.dataset.edited) input.value = plan.cs;
    if (hint) hint.textContent = plan.note || "Talents and saved defense shifts land here. Edit the number to override this roll.";
  };

  Hooks.once("renderDialogV2", (app) => {
    const root = app?.element ?? app?.window?.element;
    const form = root?.querySelector?.(".faserip-feat-dialog") || document.querySelector(".faserip-feat-dialog");
    if (!form) return;
    refreshShift(form);
    form.querySelector('[name="column"]')?.addEventListener("change", () => refreshShift(form));
    form.querySelector('[name="target"]')?.addEventListener("change", () => refreshShift(form));
    form.querySelector('[name="cs"]')?.addEventListener("input", (event) => {
      event.currentTarget.dataset.edited = "1";
    });
  });

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
  const csInput = form.querySelector('[name="cs"]');
  const typedCs = Number(csInput?.value || 0);
  const karma = Number(form.querySelector('[name="karma"]')?.value || 0);
  const intensityId = form.querySelector('[name="intensity"]')?.value || "";
  const effectsColumn = form.querySelector('[name="column"]')?.value || "";
  const targetId = form.querySelector('[name="target"]')?.value || "";
  const target = targetId ? game.actors.get(targetId) : null;
  const plan = holdPending ? { note: "", consumeOutgoing: false, consumeIncoming: false } : shiftPlan(actor, {
    ability: abilityForColumn(effectsColumn, ability),
    effectsColumn,
    target
  });
  const cs = csInput?.dataset.edited ? typedCs : plan.cs;
  return rollFeat({
    actor,
    item,
    rankId,
    label,
    cs,
    karma,
    intensityId,
    effectsColumn,
    targetId,
    shiftNotes: plan.note,
    consumeOutgoing: plan.consumeOutgoing,
    consumeIncoming: plan.consumeIncoming,
    holdPending
  });
}

export { COLOR_HEX };

import {
  colorForRoll,
  rankLabel,
  shiftRank,
  RANK_BY_ID,
  BATTLE_EFFECTS,
  intensityNeeded,
  battleResult,
  rankValue
} from "../config.mjs";
import { magicColumnShift, magicHarm, magicResult, resistLine } from "../magic.mjs";
import { abilityForColumn, actorFromRef, combatTarget, sceneActorChoices } from "../play-rules.mjs";
import { shiftPlan, showCombatButtons, workflowActive } from "../workflow.mjs";
import { playComicHit } from "../comic-hit.mjs";
import { playAttackSound } from "../psfx.mjs";
import { playFeatVfx } from "../vfx.mjs";
import { attackOutOfRange, closeCharge } from "../movement.mjs";
import { psiScreenBlocks } from "../mental.mjs";
import { resistHarm } from "../resistances.mjs";
import {
  applyCheckResult,
  collapseAtZero,
  conditionBlock,
  effectGetsThrough,
  isCheckColumn,
  soakAmount,
  spoilBlindside
} from "../battle-results.mjs";
import { shiftDamageAmount, situationProblem, splashMiss } from "../situation.mjs";

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
  targetUuid = "",
  shiftNotes = "",
  consumeOutgoing = false,
  consumeIncoming = false,
  holdPending = false,
  allowKarma = true,
  blindside = false,
  lure = false,
  shieldRank = "",
  skipCondition = false,
  resultOf = null,
  damageCs = 0,
  lineCheck = false,
  whisperGM = false,
  magic = false
} = {}) {
  const columnIdEarly = resolveBattleColumn(effectsColumn);
  if (!skipCondition && actor && !isCheckColumn(columnIdEarly) && conditionBlock(actor)) {
    ui.notifications?.warn(conditionBlock(actor));
    return null;
  }
  let columnShift = Number(cs) || 0;
  if (lure) columnShift += 2;
  if (shieldRank) columnShift -= 2;
  let baseRank = rankId;
  if (magic) {
    const adjusted = magicColumnShift(baseRank, columnShift);
    baseRank = adjusted.rankId;
    columnShift = adjusted.cs;
  }
  const effectiveId = shiftRank(baseRank, columnShift);
  let spend = allowKarma ? (Number(karma) || 0) : 0;
  if (spend > 0 && spend < 10) {
    ui.notifications.warn("Karma spent to modify a roll must be at least 10.");
    spend = 10;
  }
  const earlyTarget = actorFromRef(targetUuid || targetId);
  if (blindside && spoilBlindside(earlyTarget)) {
    ui.notifications?.info(`${earlyTarget.name} senses the approach, so the blindside does not count.`);
    blindside = false;
  }
  if (blindside) spend = 0;
  if (lure) shiftNotes = [shiftNotes, "Lure +2 CS"].filter(Boolean).join(". ");
  if (shieldRank) shiftNotes = [shiftNotes, "Shield −2 CS"].filter(Boolean).join(". ");
  if (blindside) shiftNotes = [shiftNotes, "Blindside"].filter(Boolean).join(". ");

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
  let effect = columnId ? battleResult(columnId, color) : "";
  let effectLabel = columnId ? (BATTLE_EFFECTS[columnId]?.label ?? columnId) : "";
  if (magic) {
    const rewritten = magicResult(columnId, color);
    if (rewritten) {
      effect = rewritten;
      effectLabel = "Magic Effects";
    }
  }

  const target = actorFromRef(targetUuid || targetId);
  if (magic) {
    const resist = resistLine(actor, target, item);
    if (resist) shiftNotes = [shiftNotes, resist].filter(Boolean).join(" ");
  }
  if (!whisperGM && !lineCheck && !isCheckColumn(columnId)) {
    playFeatVfx({ actor, target, item, columnId, color, label });
  }
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
  if (magic && combat.damageAmount != null) combat.damageAmount = magicHarm(effectiveId);
  if (damageCs && combat.damageAmount) combat.damageAmount = shiftDamageAmount(combat.damageAmount, damageCs);
  if (blindside) combat.checkColumn = "";
  const shieldValue = shieldRank ? rankValue(shieldRank) : 0;
  let healthNote = "";
  let damageApplied = false;
  let taken = null;
  let effectBlocked = false;
  let resistNote = "";
  if (target && combat.damageAmount != null && !psiScreenBlocks(target, item, effectiveId)) {
    const harm = resistHarm(target, {
      name: item?.name || label || "",
      rankId: effectiveId,
      columnId,
      energy: !!combat.damageEnergy,
      amount: Number(combat.damageAmount) || 0
    });
    if (harm.result === "cancel") {
      healthNote = harm.note;
      combat.checkColumn = "";
      combat.damageAmount = null;
      effectBlocked = true;
      ui.notifications?.info(healthNote);
    } else if (harm.result === "reduce") {
      combat.damageAmount = harm.amount;
      resistNote = harm.note;
    }
  }
  if (healthNote && effectBlocked && combat.damageAmount == null) {
    /* the resistance already reported the miss */
  } else if (target && psiScreenBlocks(target, item, effectiveId)) {
    healthNote = `${target.name}'s Psi-Screen holds.`;
    combat.checkColumn = "";
    combat.damageAmount = null;
    ui.notifications?.info(healthNote);
  } else if (target && combat.damageEnergy && target.getFlag?.("faserip", "reflecting") && actor && actor.id !== target.id) {
    const bounce = target.getFlag?.("faserip", "reflecting");
    const aimed = bounce && typeof bounce === "object" && bounce.uuid
      ? globalThis.fromUuidSync?.(bounce.uuid)
      : null;
    const victim = aimed || actor;
    try { await target.unsetFlag("faserip", "reflecting"); } catch { /* the bounce still resolves */ }
    try {
      if ([...(target.effects ?? [])].some((effect) => effect.statuses?.has?.("reflect") || effect.getFlag?.("core", "statusId") === "reflect")) {
        await target.toggleStatusEffect("reflect", { active: false });
      }
    } catch { /* the flag is already cleared */ }
    const amount = Number(combat.damageAmount) || 0;
    if (amount > 0 && victim && (victim.isOwner || game.user?.isGM)) {
      const before = Number(victim.system?.health?.value ?? 0);
      const protection = soakAmount(victim, { energy: true, useForceField: false, bonusArmor: 0 });
      try {
        taken = await victim.applyDamage(amount, { energy: true, protection });
        const after = Number(victim.system?.health?.value ?? before);
        damageApplied = true;
        healthNote = taken > 0
          ? `${target.name} reflects the energy. ${victim.name} Health ${before} → ${after} (−${taken}).`
          : `${target.name} reflects the energy. ${victim.name} loses no Health.`;
      } catch (err) {
        console.warn("FASERIP | reflect", err);
        healthNote = `${target.name} reflects the energy toward ${victim?.name || actor.name}.`;
      }
    } else {
      healthNote = `${target.name} reflects the energy toward ${victim?.name || actor.name}.`;
    }
    ui.notifications?.info(healthNote);
  } else if (target && combat.damageAmount != null && workflowActive("autoApplyDamage")) {
    if (target.isOwner || game.user?.isGM) {
      const before = Number(target.system?.health?.value ?? 0);
      const useForceField = workflowActive("preferForceField") && Number(target.getForceField?.() || 0) > 0;
      const protection = soakAmount(target, {
        energy: !!combat.damageEnergy,
        useForceField,
        bonusArmor: useForceField ? 0 : shieldValue
      });
      try {
        taken = await target.applyDamage(Number(combat.damageAmount) || 0, {
          energy: !!combat.damageEnergy,
          useForceField,
          protection
        });
        const after = Number(target.system?.health?.value ?? before);
        damageApplied = true;
        const amount = Number(combat.damageAmount) || 0;
        const through = effectGetsThrough(amount, protection, taken);
        healthNote = taken > 0
          ? `${target.name} Health ${before} → ${after} (−${taken})`
          : amount > 0
            ? `${target.name} loses no Health. Armor or a force field stopped ${amount}.`
            : `${target.name} takes no Health from this hit.`;
        if (resistNote) healthNote = `${resistNote} ${healthNote}`;
        if (combat.checkColumn && workflowActive("autoBattleResults") && !through) {
          combat.checkColumn = "";
          effectBlocked = true;
          healthNote += " Protection held, so there is no Slam, Stun, or Kill check.";
        } else if (combat.checkColumn && through && taken <= 0) {
          healthNote += " The hit matches the protection, so the effect still applies.";
        }
        ui.notifications?.info(healthNote);
        const deferred = combat.checkColumn === "stunCheck" || combat.checkColumn === "killCheck";
        if (after === 0 && !deferred) await collapseAtZero(target);
      } catch (err) {
        console.warn("FASERIP | apply damage", err);
      }
    }
  }
  if (lure && color === "white") {
    healthNote = [healthNote, "The lure missed. The attack continues into whatever is behind the decoy."].filter(Boolean).join(" ");
  }
  if (!holdPending && target && (combat.damageAmount == null || damageApplied)) {
    playComicHit({
      targetUuid: target.uuid,
      columnId,
      color,
      effect,
      taken: damageApplied ? taken : null
    });
    playAttackSound({
      targetUuid: target.uuid,
      columnId,
      color,
      effect,
      itemName: item?.name || label || "",
      magic: !!magic
    });
  }
  const content = await foundry.applications.handlebars.renderTemplate("systems/faserip/templates/chat/feat-roll.hbs", {
    actorName: actor?.name ?? "",
    itemName: item?.name ?? "",
    label,
    raw,
    adjusted,
    karma: spend,
    cs: columnShift,
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
    healthNote,
    damageAmount: combat.damageAmount ?? null,
    canDamage: combat.damageAmount != null,
    damageEnergy: !!combat.damageEnergy,
    checkColumn: combat.checkColumn || "",
    checkLabel: combat.checkColumn ? (BATTLE_EFFECTS[combat.checkColumn]?.label ?? "") : "",
    showButtons: showCombatButtons()
  });

  const messageData = {
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
        itemName: item?.name || label || "",
        effect,
        targetId: combat.targetId || target?.id || null,
        targetUuid: combat.targetUuid || target?.uuid || null,
        targetName: combat.targetName || target?.name || "",
        damageAmount: combat.damageAmount ?? null,
        damageEnergy: !!combat.damageEnergy,
        damageApplied,
        checkColumn: combat.checkColumn || null,
        attackerId: actor?.id || null,
        strengthRank: actor?.getAbilityRank?.("strength") || null,
        bonusArmor: shieldValue || 0,
        effectBlocked,
        magic: !!magic
      }
    }
  };
  if (whisperGM) messageData.whisper = (game.users?.filter((user) => user.isGM) ?? []).map((user) => user.id);
  const message = await ChatMessage.create(messageData);
  if (isCheckColumn(columnId)) {
    await applyCheckResult({ actor, color, columnId, resultOf });
  }
  if (!lineCheck && color === "white" && target) {
    await splashMiss({ actor, target, columnId, rankId: effectiveId, label, item });
  }
  return message;
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
  holdPending = false,
  karmaMode = "normal",
  resultOf = null,
  whisperGM = false,
  extraCs = 0,
  extraNote = "",
  magic = false
} = {}) {
  if (actor && !isCheckColumn(defaultColumn) && conditionBlock(actor)) {
    ui.notifications?.warn(conditionBlock(actor));
    return null;
  }
  const ranks = (game.faserip?.ranks ?? []).map((r) => [r.id, r.label]);
  const columns = [["", "— none (plain FEAT) —"], ...Object.entries(BATTLE_EFFECTS).map(([id, col]) => [id, col.label])];
  const intensityOpts = [["", "— no Intensity —"], ...ranks];
  const targets = sceneActorChoices().filter((choice) => choice.id !== actor?.uuid && choice.id !== actor?.id);
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
      ${karmaMode === "none" ? `<p class="hint">Karma cannot modify this FEAT.</p>` : ""}
      ${karmaMode === "resources" ? `<label class="check"><input type="checkbox" name="invention" /> Building or invention (Karma must be declared before the roll)</label>` : ""}
      ${karmaMode === "none" ? "" : `<div class="form-group">
        <label>Spend Karma (minimum 10 to modify the d100)</label>
        <input type="number" name="karma" value="0" min="0" step="1" />
      </div>`}
      ${karmaMode === "normal" ? `<details>
        <summary>Maneuvers</summary>
        <label class="check"><input type="checkbox" name="blindside" /> Blindside (no Karma, and no Slam, Stun, or Kill check)</label>
        <label class="check"><input type="checkbox" name="lure" /> Lure (+2 CS; a miss notes the space behind)</label>
        <div class="form-group">
          <label>Shield material (−2 CS, counted as Body Armor)</label>
          <select name="shield"><option value="">— none —</option>${optionList(ranks)}</select>
        </div>
      </details>` : ""}
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
    if (!root) return;
    const column = root.querySelector('[name="column"]')?.value || "";
    const target = actorFromRef(root.querySelector('[name="target"]')?.value || "");
    const plan = shiftPlan(actor, {
      ability: abilityForColumn(column, ability),
      effectsColumn: column,
      target,
      item,
      reservePending: holdPending,
      sourceColumn: resultOf?.sourceColumn || ""
    });
    const input = root.querySelector('[name="cs"]');
    const hint = root.querySelector(".shift-hint");
    if (input && !input.dataset.edited) input.value = plan.cs + (Number(extraCs) || 0);
    if (hint) hint.textContent = [plan.note, extraNote].filter(Boolean).join(" ") || "Talents and saved defense shifts land here. Edit the number to override this roll.";
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
  const invention = !!form.querySelector('[name="invention"]')?.checked;
  let karma = Number(form.querySelector('[name="karma"]')?.value || 0);
  if (karmaMode === "none" || (karmaMode === "resources" && !invention)) karma = 0;
  const intensityId = form.querySelector('[name="intensity"]')?.value || "";
  const effectsColumn = form.querySelector('[name="column"]')?.value || "";
  const picked = form.querySelector('[name="target"]')?.value || "";
  const target = actorFromRef(picked) || combatTarget(actor?.id);
  if (target && effectsColumn) {
    const situationBlock = situationProblem(actor, target, effectsColumn);
    if (situationBlock) {
      ui.notifications?.warn(`${label}: ${situationBlock}`);
      return null;
    }
    const blocked = attackOutOfRange(actor, target, effectsColumn, item);
    if (blocked) {
      ui.notifications?.warn(`${label}: ${blocked}`);
      return null;
    }
  }
  if (target && effectsColumn === "charging") {
    const arrived = await closeCharge(actor, target);
    if (!arrived) return null;
  }
  const plan = shiftPlan(actor, {
    ability: abilityForColumn(effectsColumn, ability),
    effectsColumn,
    target,
    item,
    reservePending: holdPending,
    sourceColumn: resultOf?.sourceColumn || ""
  });
  const cs = csInput?.dataset.edited ? typedCs : plan.cs + (Number(extraCs) || 0);
  return rollFeat({
    actor,
    item,
    rankId,
    label,
    cs,
    karma,
    intensityId,
    effectsColumn,
    targetId: target?.id || "",
    targetUuid: target?.uuid || "",
    shiftNotes: [plan.note, extraNote].filter(Boolean).join(" "),
    magic,
    consumeOutgoing: plan.consumeOutgoing,
    consumeIncoming: plan.consumeIncoming,
    damageCs: plan.damageCs || 0,
    holdPending,
    allowKarma: karmaMode !== "none" && (karmaMode !== "resources" || invention),
    blindside: !!form.querySelector('[name="blindside"]')?.checked,
    lure: !!form.querySelector('[name="lure"]')?.checked,
    shieldRank: form.querySelector('[name="shield"]')?.value || "",
    resultOf,
    whisperGM
  });
}

export { COLOR_HEX };

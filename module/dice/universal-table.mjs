import {
  colorForRoll,
  rankIndex,
  rankLabel,
  columnShiftRank,
  shiftRank,
  RANK_BY_ID,
  BATTLE_EFFECTS,
  intensityNeeded,
  battleResult,
  rankValue,
  UNIVERSAL_TABLE
} from "../config.mjs";
import { magicColumnShift, magicEnergy, magicHarm, magicResult, pulledResultColor, resistLine, takeMagic } from "../magic.mjs";
import { abilityForColumn, actorFromRef, combatTarget, readPending, sceneActorChoices, signed, writePending } from "../play-rules.mjs";
import { damageCardParts } from "../play.mjs";
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
import { fantasticOutcome, houseFeatFields, houseOn, percentileHits, readHouseFeat, spendFocus } from "../house-rules.mjs";
import { poolBlocked } from "../power-pool.mjs";
import { fearDenial, spendFear } from "../fear.mjs";
import { pulledKill } from "../lethal.mjs";
import { inhibitorHolds, readInhibitor } from "../inhibitor.mjs";
import { boneDenial, breakQualifies } from "../break-bone.mjs";
import {
  applyVariable, autoCombatAdjust, combatFeatFields, combatOn, dodgeAndAttack, downgradeColor,
  edgedCut, grappleEffect, noteSecondAction, readCombatFeat, resolveCalled, variableBonus, variableKind
} from "../combat-rules.mjs";

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

function colorName(color) {
  const name = String(color || "");
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : "";
}

function explainResult({ rankId, roll, color, columnColor, colorSteps, raw, karma, flat, effect, effectLabel }) {
  const lines = [];
  const parts = [`d100 ${raw}`];
  if (karma) parts.push(`${karma > 0 ? "+" : ""}${karma} Karma`);
  if (flat) parts.push(`${flat > 0 ? "+" : ""}${flat}`);
  lines.push(roll === raw ? parts.join(" ") : `${parts.join(" ")} = ${roll}`);
  const table = UNIVERSAL_TABLE[rankId] ?? UNIVERSAL_TABLE.typical;
  const bands = [
    ["White", 1, table.green - 1],
    ["Green", table.green, table.yellow - 1],
    ["Yellow", table.yellow, table.red - 1],
    ["Red", table.red, 100]
  ].filter(([, lo, hi]) => hi >= lo);
  lines.push(`${rankLabel(rankId)} reads ${bands.map(([name, lo, hi]) => lo === hi ? `${name} ${lo}` : `${name} ${lo}–${hi}`).join(", ")}.`);
  const hit = bands.find(([, lo, hi]) => roll >= lo && roll <= hi);
  if (hit) {
    const [name, lo, hi] = hit;
    lines.push(lo === hi ? `${roll} is ${name}.` : `${roll} is ${name}, from ${lo} to ${hi}.`);
  }
  if (colorSteps && columnColor && columnColor !== color) {
    lines.push(`${colorName(columnColor)} is lowered ${colorSteps} ${colorSteps === 1 ? "step" : "steps"}, to ${colorName(color)}.`);
  }
  if (effect && effectLabel) lines.push(`${colorName(color)} on ${effectLabel} is ${effect}.`);
  return lines;
}

function explainShift({ fromId, toId, cs, notes }) {
  const lines = [];
  if (fromId && toId && fromId !== toId) lines.push(`Started at ${rankLabel(fromId)}. Read on ${rankLabel(toId)}.`);
  if (cs) lines.push(`Net column shift ${cs > 0 ? `+${cs}` : cs} CS.`);
  for (const line of String(notes || "").split(/\s*;\s*|\.\s+/)) {
    const text = line.trim().replace(/\.$/, "");
    if (text && !lines.includes(text)) lines.push(text);
  }
  return lines;
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
  consumeStrike = false,
  consumeMagicResist = false,
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
  magic = false,
  focusPush = false,
  fantasticKarma = 0,
  piercing = false,
  subdual = false,
  dodgeAttack = false,
  cover = "",
  called = "",
  fearCheck = false,
  abilityId = "",
  boneCheck = false
} = {}) {
  const columnIdEarly = resolveBattleColumn(effectsColumn);
  if (item?.getFlag?.("faserip", "dropped") || item?.flags?.faserip?.dropped) {
    ui.notifications?.warn(`${item.name} is on the ground.`);
    return null;
  }
  if (poolBlocked(item)) {
    ui.notifications?.warn(`${item.name} is set aside. Make it ready first.`);
    return null;
  }
  if (item?.type === "power" && inhibitorHolds(item.system?.rank, readInhibitor(actor), houseOn("houseInhibitor"))) {
    ui.notifications?.warn(`${item.name} is held by an inhibitor (${rankLabel(readInhibitor(actor))}).`);
    return null;
  }
  if (!fearCheck) {
    const scared = fearDenial(actor, columnIdEarly, isCheckColumn(columnIdEarly));
    if (scared) {
      await spendFear(actor, columnIdEarly);
      ui.notifications?.warn(scared);
      return null;
    }
  }
  if (!boneCheck) {
    const broken = boneDenial(actor, columnIdEarly, abilityId, isCheckColumn(columnIdEarly));
    if (broken) {
      ui.notifications?.warn(broken);
      return null;
    }
  }
  if (!boneCheck && combatOn("combatCalled") && actor?.getFlag?.("faserip", "lostAction") && !isCheckColumn(columnIdEarly)) {
    await actor.unsetFlag("faserip", "lostAction");
    if (actor.getFlag?.("faserip", "noRun") === "next") await actor.unsetFlag("faserip", "noRun");
    ui.notifications?.warn(`${actor.name} loses this action to a called shot.`);
    return null;
  }
  if (!skipCondition && actor && !isCheckColumn(columnIdEarly) && conditionBlock(actor)) {
    ui.notifications?.warn(conditionBlock(actor));
    return null;
  }
  let columnShift = Number(cs) || 0;
  if (lure) columnShift += 2;
  if (shieldRank) columnShift -= 2;
  let baseRank = rankId;
  const earlyColumn = resolveBattleColumn(effectsColumn);
  if (combatOn("combatGrappleFight") && earlyColumn === "grappling" && actor?.getAbilityRank) {
    baseRank = actor.getAbilityRank("fighting") || baseRank;
    shiftNotes = [shiftNotes, "The grab is a Fighting FEAT."].filter(Boolean).join(". ");
  }
  if (dodgeAttack && actor) {
    const paired = await dodgeAndAttack(actor);
    columnShift += paired.cs;
    shiftNotes = [shiftNotes, paired.note].filter(Boolean).join(". ");
  }
  const second = boneCheck ? "" : await noteSecondAction(actor, earlyColumn, isCheckColumn(earlyColumn));
  if (second) shiftNotes = [shiftNotes, second].filter(Boolean).join(". ");
  if (focusPush && actor && await spendFocus(actor)) {
    baseRank = shiftRank(baseRank, 1);
    shiftNotes = [shiftNotes, "Focus pushes the power one rank."].filter(Boolean).join(". ");
  }
  if (magic) {
    const adjusted = magicColumnShift(baseRank, columnShift);
    baseRank = adjusted.rankId;
    columnShift = adjusted.cs;
  }
  const aimed = actorFromRef(targetUuid || targetId);
  const auto = autoCombatAdjust({
    actor, target: aimed, rankId: baseRank, cs: columnShift, columnId: earlyColumn, blindside
  });
  columnShift = auto.cs;
  const colorSteps = auto.colorSteps;
  const combatFlat = auto.flat;
  if (auto.notes.length) shiftNotes = [shiftNotes, auto.notes.join(". ")].filter(Boolean).join(". ");
  const effectiveId = columnShiftRank(baseRank, columnShift);
  let spend = allowKarma ? (Number(karma) || 0) : 0;
  if (spend > 0 && spend < 10) {
    ui.notifications.warn("Karma spent to modify a roll must be at least 10.");
    spend = 10;
  }
  const earlyTarget = aimed;
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
  const adjusted = Math.min(100, Math.max(1, raw + spend + combatFlat));
  const columnColor = colorForRoll(effectiveId, adjusted);
  let color = downgradeColor(columnColor, colorSteps);
  const fantasticPlan = fantasticOutcome({ color, raw, paid: fantasticKarma });
  let fantastic = fantasticPlan.fantastic;
  if (fantasticPlan.spend > 0 && actor?.system?.karma) {
    const available = Number(actor.system.karma.value ?? 0);
    if (available < fantasticPlan.spend) {
      ui.notifications?.warn(`${actor.name} does not have ${fantasticPlan.spend} Karma for a Fantastic check.`);
      fantastic = color === "red" && percentileHits(raw);
    } else {
      await actor.update({ "system.karma.value": available - fantasticPlan.spend });
      shiftNotes = [shiftNotes, `Spent ${fantasticPlan.spend} Karma on a Fantastic check.`].filter(Boolean).join(" ");
    }
  }
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
  effect = grappleEffect(columnId, color, effect);
  let effectLabel = columnId ? (BATTLE_EFFECTS[columnId]?.label ?? columnId) : "";
  let effectColor = color;
  if (magic && takeMagic(item)?.pullColor) {
    const pulled = pulledResultColor(color);
    if (pulled !== color) {
      effectColor = pulled;
      shiftNotes = [shiftNotes, `Pulled punch: ${color} counts as ${pulled}.`].filter(Boolean).join(" ");
    }
  }
  if (magic) {
    const rewritten = magicResult(columnId, effectColor);
    if (rewritten) {
      effect = rewritten;
      effectLabel = "Magic Effects";
    }
  }
  const pulled = pulledKill(effect, { ruleOn: houseOn("houseLethal"), lethal: !!actor?.system?.identity?.lethal });
  if (pulled.note) {
    effect = pulled.effect;
    shiftNotes = [shiftNotes, pulled.note].filter(Boolean).join(" ");
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
      consumeIncoming,
      consumeStrike,
      consumeMagicResist
    });
    combat = combatFlags({ actor, item, target, columnId, effect });
  }
  if (magic && combat.checkColumn && target) {
    const endurance = target.getAbilityRank?.("endurance") || "typical";
    if (rankIndex(effectiveId) < rankIndex(endurance)) {
      combat.checkColumn = "";
      shiftNotes = [shiftNotes, "The spell rank is below Endurance, so there is no Slam or Stun check."].filter(Boolean).join(" ");
    }
  }
  const psycheGate = !!(magic && target && actor && actor.id !== target.id && magicEnergy(item) !== "dimensional" && /^(hit|slam|stun|bull's-eye|bullseye)$/i.test(String(effect || "")));
  if (psycheGate) shiftNotes = [shiftNotes, "Psyche FEAT to resist. Yellow or red: no effect. White or green: the working takes."].filter(Boolean).join(" ");
  if (magic && combat.damageAmount != null) combat.damageAmount = magicHarm(effectiveId);
  if (damageCs && combat.damageAmount) combat.damageAmount = shiftDamageAmount(combat.damageAmount, damageCs);
  if (fantastic && combat.damageAmount) {
    combat.damageAmount = Number(combat.damageAmount) * 2;
    shiftNotes = [shiftNotes, "Fantastic Success. Damage is doubled."].filter(Boolean).join(" ");
  } else if (fantastic) {
    shiftNotes = [shiftNotes, "Fantastic Success. Intensity or duration is doubled."].filter(Boolean).join(" ");
  }
  if (blindside) combat.checkColumn = "";
  if (cover && color === "white" && adjusted >= 15) {
    shiftNotes = [shiftNotes, "The roll missed the target and can hit the cover."].filter(Boolean).join(". ");
  }
  if (called) {
    const aimed = await resolveCalled({ target, color, callId: called, rankId: effectiveId });
    if (aimed) shiftNotes = [shiftNotes, aimed].filter(Boolean).join(". ");
  }
  if (combatOn("combatVariable") && combat.damageAmount) {
    const kind = variableKind(effectiveId, adjusted);
    const extra = await variableBonus(kind);
    const varied = applyVariable(combat.damageAmount, kind, extra.bonus);
    if (varied.note || extra.note) {
      combat.damageAmount = varied.amount;
      shiftNotes = [shiftNotes, varied.note, extra.note].filter(Boolean).join(". ");
    }
  }
  const shieldValue = shieldRank ? rankValue(shieldRank) : 0;
  let healthNote = "";
  let healthBefore = null;
  let healthAfter = null;
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
        healthBefore = before;
        healthAfter = after;
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
      let protection = soakAmount(target, {
        energy: !!combat.damageEnergy,
        useForceField,
        bonusArmor: useForceField ? 0 : shieldValue
      });
      if (piercing) protection = Math.max(0, protection - 20);
      if (combat.damageAmount && (columnId === "edged" || columnId === "throwEdged")) {
        const cut = await edgedCut(item, actor, target);
        if (cut?.note) shiftNotes = [shiftNotes, cut.note].filter(Boolean).join(". ");
        if (cut?.ok) protection = 0;
      }
      try {
        taken = await target.applyDamage(Number(combat.damageAmount) || 0, {
          energy: !!combat.damageEnergy,
          useForceField,
          protection
        });
        const after = Number(target.system?.health?.value ?? before);
        damageApplied = true;
        healthBefore = before;
        healthAfter = after;
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
        if (after === 0 && subdual) healthNote += " Subdual. This does not start dying.";
        ui.notifications?.info(healthNote);
        const deferred = combat.checkColumn === "stunCheck" || combat.checkColumn === "killCheck";
        if (after === 0 && !deferred && !subdual) await collapseAtZero(target);
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
  const colorWord = fantastic ? "Fantastic" : game.i18n.localize(`FASERIP.Color.${color}`);
  const shortEffect = effect && effect.length <= 18 && !/[.]/.test(effect) ? effect : "";
  const actionName = String(effectLabel || label || "").replace(/\s*\([^)]*\)\s*$/, "");
  const bareLabel = String(label || "").replace(/\s*\([^)]*\)\s*$/, "");
  const damage = damageCardParts({
    damageAmount: combat.damageAmount ?? null,
    damageEnergy: !!combat.damageEnergy,
    damageApplied,
    damageTaken: taken,
    healthBefore,
    healthAfter,
    healthNote,
    targetName: combat.targetName || target?.name || ""
  });
  const canDamage = combat.damageAmount != null;
  const psychePending = !!psycheGate;
  const applyPrimary = !psychePending && canDamage && !damageApplied;
  const checkVisible = !!combat.checkColumn && !effectBlocked && (!canDamage || damageApplied);
  const content = await foundry.applications.handlebars.renderTemplate("systems/faserip/templates/chat/feat-roll.hbs", {
    actorName: actor?.name ?? "",
    itemName: item?.name ?? "",
    label,
    raw,
    adjusted,
    karma: spend,
    cs: columnShift,
    color,
    fantastic,
    houseFocus: houseOn("houseFocus"),
    rollWithBlow: combatOn("combatRollBlow") && ["blunt", "force", "throwBlunt"].includes(columnId) && color !== "white",
    enduranceSoak: combatOn("combatSoak") && (combat.damageAmount || 0) > 0 && color !== "white",
    boneBreak: combatOn("combatBreak") && !!target && color !== "white" && breakQualifies(combat.damageAmount, target.system?.health?.max),
    showAdjusted: adjusted !== raw,
    combatFlat,
    colorLabel: colorWord,
    headline: [colorWord, shortEffect].filter(Boolean).join(" "),
    actionName,
    rollCaption: bareLabel && actionName && bareLabel !== actionName ? bareLabel : "",
    effectSentence: shortEffect ? "" : (effect || ""),
    faceRank: RANK_BY_ID[effectiveId]?.label || rankLabel(effectiveId),
    formulaLines: explainResult({
      rankId: effectiveId,
      roll: adjusted,
      color,
      columnColor,
      colorSteps,
      raw,
      karma: spend,
      flat: combatFlat,
      effect,
      effectLabel
    }),
    shiftLines: explainShift({ fromId: rankId, toId: effectiveId, cs: columnShift, notes: shiftNotes }),
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
    damageMode: damage?.mode || "",
    damageKind: damage?.kind || "",
    damageDetail: damage?.note || "",
    healthBefore: damage?.before ?? "",
    healthAfter: damage?.after ?? "",
    damageTaken: damage?.taken ?? "",
    damageAmount: combat.damageAmount ?? null,
    canDamage,
    damageApplied,
    damageEnergy: !!combat.damageEnergy,
    checkColumn: combat.checkColumn || "",
    checkLabel: combat.checkColumn ? (BATTLE_EFFECTS[combat.checkColumn]?.label ?? "") : "",
    checkVisible,
    applyPrimary,
    checkPrimary: checkVisible && !psychePending && !applyPrimary,
    fantasticPrimary: !!fantastic && !psychePending && !applyPrimary && !checkVisible,
    psycheGate,
    showButtons: showCombatButtons()
  });

  const messageData = {
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    rolls: [roll],
    flags: {
      faserip: {
        color,
        fantastic,
        baseRankId: rankId,
        rankId: effectiveId,
        cs: columnShift,
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
        damageTaken: taken,
        healthBefore,
        healthAfter,
        healthNote,
        checkColumn: combat.checkColumn || null,
        attackerId: actor?.id || null,
        strengthRank: actor?.getAbilityRank?.("strength") || null,
        bonusArmor: shieldValue || 0,
        effectBlocked,
        magic: !!magic,
        psycheGate
      }
    }
  };
  if (whisperGM) messageData.whisper = (game.users?.filter((user) => user.isGM) ?? []).map((user) => user.id);
  const message = await ChatMessage.create(messageData);
  if (isCheckColumn(columnId)) {
    await applyCheckResult({ actor, color, columnId, resultOf });
  }
  if (actor && item?.type === "power" && /^focus$/i.test(String(item.name || "").replace(/\s*\([^)]*\)/g, "").trim()) && color && color !== "white") {
    const current = readPending(actor);
    await writePending(actor, {
      nextCs: (Number(current.nextCs) || 0) + 1,
      nextNote: [current.nextNote, "Focus +1 CS"].filter(Boolean).join("; ")
    });
    ui.notifications?.info(`${item.name} lands. The next roll is +1 column.`);
  }
  if (!lineCheck && color === "white" && target) {
    await splashMiss({ actor, target, columnId, rankId: effectiveId, label, item });
  }
  if (!boneCheck && actor && !isCheckColumn(columnId) && actor.getFlag?.("faserip", "noRun") === "next") {
    await actor.unsetFlag("faserip", "noRun");
  }
  if (actor && !fearCheck && !boneCheck && !isCheckColumn(columnId)) await spendFear(actor, columnId);
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

function cssEscape(value) {
  if (globalThis.CSS?.escape) return CSS.escape(String(value));
  return String(value).replace(/["\\]/g, "\\$&");
}

function featShiftParts(plan, extraCs, extraNote) {
  const parts = [...(plan?.parts || [])];
  const extra = Number(extraCs) || 0;
  if (!extra) return parts;
  const note = String(extraNote || "").trim();
  parts.push({ id: "extra", cs: extra, note: note && note.length <= 160 ? note : `Casting ${signed(extra)} CS` });
  return parts;
}

function writeShiftTotal(root, parts, skipped) {
  const input = root.querySelector('[name="cs"]');
  if (!input || input.dataset.edited) return;
  const sum = parts.filter((part) => !skipped.has(part.id)).reduce((total, part) => total + (Number(part.cs) || 0), 0);
  input.value = String(sum);
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
  magic = false,
  fearCheck = false
} = {}) {
  if (item?.type === "power" && inhibitorHolds(item.system?.rank, readInhibitor(actor), houseOn("houseInhibitor"))) {
    ui.notifications?.warn(`${item.name} is held by an inhibitor (${rankLabel(readInhibitor(actor))}).`);
    return null;
  }
  if (!fearCheck && actor && fearDenial(actor, defaultColumn, isCheckColumn(defaultColumn))) {
    ui.notifications?.warn(fearDenial(actor, defaultColumn, isCheckColumn(defaultColumn)));
    return null;
  }
  if (actor && boneDenial(actor, defaultColumn, ability, isCheckColumn(defaultColumn))) {
    ui.notifications?.warn(boneDenial(actor, defaultColumn, ability, isCheckColumn(defaultColumn)));
    return null;
  }
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
        <div class="shift-list"></div>
        <input type="number" name="cs" value="0" step="1" />
        <p class="hint shift-hint">Uncheck a shift to leave it off this roll. A saved shift you leave off stays for the next roll. Edit the number to override the total.</p>
      </div>
      ${karmaMode === "none" ? `<p class="hint">Karma cannot modify this FEAT.</p>` : ""}
      ${karmaMode === "resources" ? `<label class="check"><input type="checkbox" name="invention" /> Building or invention (Karma must be declared before the roll)</label>` : ""}
      ${karmaMode === "none" ? "" : `<div class="form-group">
        <label>Spend Karma (minimum 10 to modify the d100)</label>
        <input type="number" name="karma" value="0" min="0" step="1" />
      </div>`}
      ${houseFeatFields(actor, item)}
      ${combatFeatFields()}
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

  const skipped = new Set();
  const currentParts = (root) => {
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
    return { plan, parts: featShiftParts(plan, extraCs, extraNote) };
  };
  const refreshShift = (root) => {
    if (!root) return;
    const list = root.querySelector(".shift-list");
    if (list) {
      for (const box of list.querySelectorAll("[data-shift]")) {
        if (box.checked) skipped.delete(box.dataset.shift);
        else skipped.add(box.dataset.shift);
      }
    }
    const { parts } = currentParts(root);
    if (list) {
      list.innerHTML = parts.length
        ? parts.map((part) => `<label class="check"><input type="checkbox" data-shift="${esc(part.id)}"${skipped.has(part.id) ? "" : " checked"} /> ${esc(part.note)}</label>`).join("")
        : `<p class="hint">No automatic shifts on this roll.</p>`;
      for (const box of list.querySelectorAll("[data-shift]")) {
        box.addEventListener("change", () => {
          if (box.checked) skipped.delete(box.dataset.shift);
          else skipped.add(box.dataset.shift);
          const input = root.querySelector('[name="cs"]');
          if (input) delete input.dataset.edited;
          writeShiftTotal(root, parts, skipped);
        });
      }
    }
    writeShiftTotal(root, parts, skipped);
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
  const parts = featShiftParts(plan, extraCs, extraNote);
  const active = parts.filter((part) => {
    const box = form.querySelector(`[data-shift="${cssEscape(part.id)}"]`);
    return !box || box.checked;
  });
  const sum = active.reduce((total, part) => total + (Number(part.cs) || 0), 0);
  const cs = csInput?.dataset.edited ? typedCs : sum;
  const listed = new Set(parts.map((part) => part.note));
  const notes = [
    ...active.map((part) => part.note),
    ...(plan.notes || []).filter((note) => note && !listed.has(note))
  ].filter(Boolean);
  if (csInput?.dataset.edited && typedCs !== sum) notes.push(`Column shift set to ${signed(typedCs)}`);
  const using = (id) => active.some((part) => part.id === id);
  const house = await readHouseFeat(actor, form);
  if (house.notes.length) notes.push(...house.notes);
  const strike = await readCombatFeat(actor, form);
  if (strike.notes.length) notes.push(...strike.notes);
  let damageCs = using("situation") ? (plan.damageCs || 0) : 0;
  if (combatOn("combatDodgeCut")) {
    const dodge = active.find((part) => part.cs < 0 && /dodge/i.test(part.note || ""));
    if (dodge) {
      damageCs += dodge.cs;
      notes.push("The dodge also cuts the damage.");
    }
  }
  damageCs += strike.damageCs;
  return rollFeat({
    actor,
    item,
    rankId,
    label,
    cs: cs + house.cs + strike.cs,
    karma,
    focusPush: house.focusPush,
    fantasticKarma: house.fantasticKarma,
    intensityId,
    effectsColumn,
    targetId: target?.id || "",
    targetUuid: target?.uuid || "",
    shiftNotes: notes.join("; "),
    magic,
    consumeOutgoing: plan.consumeOutgoing && using("next"),
    consumeIncoming: plan.consumeIncoming && using("incoming"),
    consumeStrike: plan.consumeStrike && using("strike"),
    consumeMagicResist: plan.consumeMagicResist && using("psyche"),
    damageCs,
    holdPending,
    allowKarma: karmaMode !== "none" && (karmaMode !== "resources" || invention),
    blindside: !!form.querySelector('[name="blindside"]')?.checked,
    lure: !!form.querySelector('[name="lure"]')?.checked,
    shieldRank: form.querySelector('[name="shield"]')?.value || "",
    piercing: strike.piercing,
    subdual: strike.subdual,
    dodgeAttack: strike.dodgeAttack,
    cover: strike.cover,
    called: strike.called,
    fearCheck,
    abilityId: ability,
    resultOf,
    whisperGM
  });
}

export { COLOR_HEX };

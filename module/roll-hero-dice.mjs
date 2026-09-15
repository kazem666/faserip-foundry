import {
  ABILITIES, ORIGIN_TABLE, SPECIAL_COUNT_TABLE, ABILITY_MODIFIER_TABLE,
  rankMin, shiftRank, lookupTable, rollOnColumn, originById
} from "./config.mjs";
import { rollD100, promptedD100, promptNextRoll } from "./dice/percentile.mjs";
import { UPB_COUNT_TABLE } from "./data/upb.mjs";
import { clampCounts, persistGenerationStats } from "./chargen.mjs";

export async function rollHeroDice(actor, {
  originId = "altered", rollOrigin = false, useUpb = false, column = null, originLabel = null, skipOriginMods = false
} = {}) {
  let originRoll = null;
  let id = originId || "altered";
  if (rollOrigin && !useUpb) {
    const go = await promptNextRoll("Origin", "Roll 1d100: 01-30 Altered Human, 31-60 Mutant, 61-90 Hi-Tech, 91-95 Robot, 96-00 Alien.");
    if (!go) return null;
    originRoll = await rollD100({ flavor: actor.name + " — Origin table", actor });
    id = lookupTable(ORIGIN_TABLE, originRoll).id;
  }
  const origin = originById(id);
  try {
    await actor.update({ "system.identity.origin": originLabel || origin.label });
    ui.notifications.info("Origin: " + (originLabel || origin.label) + (originRoll ? " (d100 " + originRoll + ")" : ""));
  } catch (err) {
    console.warn("FASERIP | could not write origin yet", err);
  }
  const col = Number(column || origin.column);
  const colLabel = originLabel || origin.label;
  const abilityRolls = {};
  const abilities = {};
  const order = ["fighting", "agility", "strength", "endurance", "reason", "intuition", "psyche"];
  try { await actor.setFlag("faserip", "generating", true); } catch {}
  try { actor.sheet?.close(); } catch {}
  let step = 1;
  for (const key of order) {
    const label = key.charAt(0).toUpperCase() + key.slice(1);
    const go = await promptNextRoll("FASERIP " + step + " of 7 — " + label, actor.name + " rolls <strong>" + label + "</strong> on column " + col + " (" + colLabel + ").");
    if (!go) return null;
    const total = await rollD100({ flavor: actor.name + " — " + label + " (column " + col + ")", actor });
    abilityRolls[key] = total;
    abilities[key] = rollOnColumn(col, total);
    try {
      await actor.update({
        [`system.abilities.${key}.rank`]: abilities[key],
        [`system.abilities.${key}.number`]: rankMin(abilities[key]),
        "flags.faserip.generating": true
      }, { render: false, faseripApplyRolls: true });
    } catch (err) {
      console.warn("FASERIP | ability write failed", key, err);
    }
    step += 1;
  }
  if (!skipOriginMods && !useUpb) {
    if (origin.id === "mutant") abilities.endurance = shiftRank(abilities.endurance, 1);
    if (origin.id === "hitech") abilities.reason = shiftRank(abilities.reason, 2);
  }
  const numbers = {};
  for (const key of ABILITIES) numbers[key] = rankMin(abilities[key]);
  const resourceModRoll = await promptedD100({
    title: "Resources",
    body: "Roll 1d100 on the Ability Modifier table. Origin modifiers are applied automatically.",
    flavor: actor.name + " - Resource modifier",
    actor
  });
  if (resourceModRoll == null) return null;
  const resourceMod = lookupTable(ABILITY_MODIFIER_TABLE, resourceModRoll);
  let resources = (!useUpb && origin.id === "hitech") ? "good" : (!useUpb && origin.id === "alien") ? "poor" : "typical";
  resources = shiftRank(resources, resourceMod.cs);
  if (!useUpb && origin.id === "mutant") resources = shiftRank(resources, -1);
  const countSrc = useUpb ? UPB_COUNT_TABLE : SPECIAL_COUNT_TABLE;
  const powerRoll = await promptedD100({
    title: "Number of Powers",
    body: useUpb
      ? "d100 on the UPB count table. Starting / max Powers only — Talents use a separate roll."
      : "d100 Advanced Set Powers: 01–20 = 2/4, 21–60 = 3/4, 61–90 = 4/4, 91–00 = 5/5.",
    flavor: actor.name + " - Number of Powers",
    actor
  });
  if (powerRoll == null) return null;
  const talentRoll = await promptedD100({
    title: "Number of Talents",
    body: useUpb
      ? "Separate d100, Talent column only. Never uses the Power total."
      : "Separate d100 Talent column: 01–20 = 1/6, 21–60 = 2/5, 61–90 = 3/4, 91–00 = 4/4.",
    flavor: actor.name + " - Number of Talents",
    actor
  });
  if (talentRoll == null) return null;
  const contactRoll = await promptedD100({
    title: "Number of Contacts",
    body: useUpb
      ? "Separate d100, Contact column only."
      : "Separate d100 Contact column: 01–20 = 0/4, 21–60 = 1/4, 61–90 = 2/4, 91–00 = 3/4.",
    flavor: actor.name + " - Number of Contacts",
    actor
  });
  if (contactRoll == null) return null;
  const powerRow = lookupTable(countSrc, powerRoll);
  const talentRow = lookupTable(countSrc, talentRoll);
  const contactRow = lookupTable(countSrc, contactRoll);
  let counts = clampCounts({
    powers: powerRow?.powers ?? [2, 4],
    talents: talentRow?.talents ?? [1, 4],
    contacts: contactRow?.contacts ?? [0, 4]
  }, useUpb);
  if (!useUpb && origin.id === "mutant") counts.powers[0] = Math.min(5, counts.powers[0] + 1);
  if (!useUpb && origin.id === "alien") {
    counts.powers[0] = Math.max(2, counts.powers[0] - 1);
    counts.contacts[0] = Math.min(1, counts.contacts[0]);
    counts.contacts[1] = 1;
  }
  counts = clampCounts(counts, useUpb);
  const popularity = (!useUpb && (origin.id === "mutant" || origin.id === "robot")) ? 0 : 10;
  const result = {
    origin, originRoll, abilities, numbers, abilityRolls, resources, resourceModRoll, resourceMod,
    counts, powerCats: [], talentCats: [],
    popularity, useUpb, column: col,
    countRolls: { powers: powerRoll, talents: talentRoll, contacts: contactRoll }
  };
  await persistGenerationStats(actor, result, { originLabel: colLabel });
  try {
    await actor.setFlag("faserip", "generation", {
      origin: originLabel || origin.label,
      upb: !!useUpb,
      powerCount: counts.powers,
      talentCount: counts.talents,
      contactCount: counts.contacts,
      countRolls: result.countRolls,
      inProgress: true
    });
  } catch {}
  ui.notifications.info(
    `Table result — Powers ${counts.powers[0]} starting / ${counts.powers[1]} max (d100 ${powerRoll}). `
    + `Talents ${counts.talents[0]} starting / ${counts.talents[1]} max (d100 ${talentRoll}). `
    + `Contacts ${counts.contacts[0]} starting / ${counts.contacts[1]} max (d100 ${contactRoll}).`
  );
  return result;
}

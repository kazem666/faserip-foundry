import { rankLabel, rankMin, rollOnColumn, shiftRank } from "./config.mjs";
import { promptedD100 } from "./dice/percentile.mjs";
import { writeGeneratedItem } from "./chargen.mjs";
import { dialog, collect, esc, options } from "./wizard-picks.mjs";
import { symbioteStandardRows, SYMBIOTE_WEAKNESS } from "./data/symbiote.mjs";
import {
  ARCHETYPE_CHOICES, ARMOR_DAMAGE, ARMOR_FASE, ARMOR_POWERS, ARMOR_RANKS, BUILDS,
  CALLINGS, CYBORG_BUDGET, CYBORG_COLUMNS, ELDER_PASSIONS, ELDER_POWERS, STATURE,
  IMPLANTS, LIFE_TABLES, MARTIAL_COLUMNS, MARTIAL_POWERS, MARTIAL_STYLES,
  MORLOCK, QUIRKS, QUIRK_TYPES, SPACEKNIGHT_BODY, SPACEKNIGHT_ENDURANCE,
  SPACEKNIGHT_FIGHTING, VAMPIRE_ABILITIES, VAMPIRE_LIMITS, VAMPIRE_POWERS,
  WEIGHT_MODS, band, columnRank, heightAndWeight, statureText
} from "./data/archetypes.mjs";

function d100() {
  return Math.floor(Math.random() * 100) + 1;
}

export function archetypeSetup(id) {
  if (id === "armored") {
    return { originId: "hitech", rollOrigin: false, originLabel: "Armored hero" };
  }
  if (id === "cyborg") {
    return { originId: "altered", rollOrigin: false, originLabel: "Cyborg", rankFor: (key, roll) => columnRank(CYBORG_COLUMNS[key], roll) };
  }
  if (id === "martial") {
    return { originId: "altered", rollOrigin: false, originLabel: "Martial artist", rankFor: (key, roll) => columnRank(MARTIAL_COLUMNS[key], roll) };
  }
  if (id === "vampire") {
    return { originId: "altered", rollOrigin: false, originLabel: "Vampire", fixedAbilities: { ...VAMPIRE_ABILITIES } };
  }
  if (id === "spaceknight") {
    return {
      originId: "alien", rollOrigin: false, originLabel: "Spaceknight",
      rankFor: (key, roll) => {
        if (key === "fighting") return band(SPACEKNIGHT_FIGHTING, roll).id;
        if (key === "agility" || key === "strength") return band(SPACEKNIGHT_BODY, roll).id;
        if (key === "endurance") return band(SPACEKNIGHT_ENDURANCE, roll).id;
        if (key === "reason" || key === "intuition") return shiftRank(rollOnColumn(1, roll), 2);
        return rollOnColumn(1, roll);
      }
    };
  }
  if (id === "morlock") {
    return { originId: "mutant", rollOrigin: false, originLabel: "Morlock", rankFor: morlockRank };
  }
  if (id === "elder") {
    return { originId: "alien", rollOrigin: false, originLabel: "Elder" };
  }
  if (id === "symbiote") {
    return { originId: "symbiote", rollOrigin: false, originLabel: "Symbiote", keepBooks: true };
  }
  return null;
}

function morlockRank(key, roll) {
  const row = MORLOCK[key];
  const n = Math.min(100, Math.max(1, Number(roll) || 1));
  let cs = 0;
  if (n >= row.way) cs = 2;
  else if (n >= row.above) cs = 1;
  else if (n <= row.below) cs = d100() <= 50 ? -1 : -2;
  const shifted = shiftRank(row.average, cs);
  const cap = ["shiftx", "shifty", "shiftz", "cl1000", "cl3000", "cl5000", "beyond", "unearthly"];
  return cap.includes(shifted) ? "monstrous" : shifted;
}

export function tuneArchetypeResult(result, id) {
  if (!result || !id) return result;
  if (id === "martial") {
    let fighting = shiftRank(result.abilities.fighting, 2);
    const order = ["feeble", "poor", "typical", "good", "excellent", "remarkable", "incredible", "amazing"];
    if (order.indexOf(fighting) > order.indexOf("amazing")) fighting = "amazing";
    if (order.indexOf(fighting) < order.indexOf("remarkable")) fighting = "remarkable";
    result.abilities.fighting = fighting;
    result.numbers.fighting = rankMin(fighting);
    result.counts.powers[0] = Math.max(0, result.counts.powers[0] - 3);
    result.counts.talents[0] = Math.min(12, result.counts.talents[0] + 4);
    result.counts.talents[1] = Math.max(result.counts.talents[1], result.counts.talents[0]);
  }
  if (id === "elder") {
    for (const key of ["endurance", "intuition", "psyche"]) {
      result.abilities[key] = shiftRank(result.abilities[key], 2);
      result.numbers[key] = rankMin(result.abilities[key]);
    }
  }
  if (id === "vampire") {
    result.resources = "shift0";
    result.popularity = -10;
  }
  if (id === "morlock") {
    result.resources = "feeble";
    result.popularity = 0;
    if (d100() > 10) result.counts.powers = [0, 1];
    else result.counts.powers = [1, 1];
  }
  if (id === "spaceknight") result.counts.powers = [d100() <= 50 ? 1 : 2, 2];
  if (id === "symbiote" && result.counts?.powers) {
    const start = Math.min(2, Number(result.counts.powers[0]) || 0);
    const max = Math.min(2, Math.max(start, Number(result.counts.powers[1]) || start));
    result.counts.powers = [start, max];
  }
  return result;
}

async function askD100(actor, title, body) {
  return promptedD100({ title, body, flavor: `${actor?.name || "Hero"} — ${title}`, actor });
}

export async function writeHeightWeight(actor, { prompt = false } = {}) {
  const strength = actor?.getAbilityRank?.("strength") || actor?.system?.abilities?.strength?.rank || "typical";
  let buildRoll = d100();
  let sizeRoll = d100();
  if (prompt) {
    buildRoll = await askD100(actor, "Build", "01–25 slender, 26–75 average, 76–00 muscular.");
    if (buildRoll == null) return null;
    sizeRoll = await askD100(actor, "Height", "Roll stature. Weight is then scaled by Strength.");
    if (sizeRoll == null) return null;
  }
  const rolled = heightAndWeight(buildRoll, sizeRoll, strength, d100());
  await actor.update({
    "system.identity.height": rolled.height,
    "system.identity.weight": rolled.weight,
    "system.identity.physicalFeatures": [actor.system.identity.physicalFeatures, `Build: ${rolled.build}. ${rolled.modifier}.`]
      .filter(Boolean).join(" ")
  });
  ui.notifications?.info(`${actor.name}: ${rolled.height}, ${rolled.weight} (${rolled.build}).`);
  return rolled;
}

export async function writeCalling(actor, { prompt = false } = {}) {
  let roll = d100();
  if (prompt) {
    roll = await askD100(actor, "Calling", "A moral drive, like an alignment. One result.");
    if (roll == null) return null;
  }
  const index = Math.min(CALLINGS.length - 1, Math.floor(((roll - 1) / 100) * CALLINGS.length));
  const calling = CALLINGS[index];
  const personality = [actor.system.identity.personality, `${calling.label}: ${calling.note}`].filter(Boolean).join(" ");
  await actor.update({
    "system.identity.calling": calling.label,
    "system.identity.personality": personality
  });
  ui.notifications?.info(`${actor.name} calling: ${calling.label}.`);
  return calling;
}

function quirkByRoll(side, kind, roll) {
  return band(QUIRKS[kind][side], roll);
}

export async function writeQuirk(actor, { prompt = false, balanced = false } = {}) {
  const picked = [];
  const take = async (side, kind) => {
    const roll = prompt
      ? await askD100(actor, `${side} ${kind} quirk`, "Roll on that quirk list.")
      : d100();
    if (roll == null) return null;
    const row = quirkByRoll(side, kind, roll);
    picked.push(row);
    return row;
  };
  if (balanced) {
    const kindRoll = prompt ? await askD100(actor, "Quirk type", "01–33 physical, 34–66 mental, 67–00 personal.") : d100();
    if (kindRoll == null) return null;
    const kind = band(QUIRK_TYPES, kindRoll).id;
    if (!await take("positive", kind)) return null;
    if (!await take("negative", kind)) return null;
  } else {
    const kind = band(QUIRK_TYPES, d100()).id;
    const side = d100() <= 50 ? "positive" : "negative";
    if (!await take(side, kind)) return null;
  }
  const clean = picked.map((row) => `${row.name} (${row.points} pt): ${row.note}`).join(" ");
  const quirks = [actor.system.identity.quirks, clean].filter(Boolean).join(" | ");
  await actor.update({ "system.identity.quirks": quirks });
  ui.notifications?.info(`${actor.name} quirk: ${picked.map((row) => row.name).join(", ")}.`);
  return picked;
}

export async function writeLifeDetails(actor, { prompt = false } = {}) {
  const rolls = {};
  for (const key of Object.keys(LIFE_TABLES)) {
    rolls[key] = prompt ? await askD100(actor, key, "Life detail.") : d100();
    if (rolls[key] == null) return null;
  }
  const pick = (key) => band(LIFE_TABLES[key], rolls[key]).label;
  const features = [
    actor.system.identity.physicalFeatures,
    `Body ${pick("body")}. Looks ${pick("looks")}. Stature ${pick("statureBand")}. ${pick("extra")}.`
  ].filter(Boolean).join(" ");
  await actor.update({
    "system.identity.ethnicity": pick("ancestry"),
    "system.identity.sex": pick("gender"),
    "system.identity.maritalStatus": pick("marital"),
    "system.identity.orientation": pick("orientation"),
    "system.identity.age": pick("age"),
    "system.identity.legalStatus": pick("record"),
    "system.identity.occupation": actor.system.identity.occupation || pick("class"),
    "system.story.family": [actor.system.story?.family, pick("family")].filter(Boolean).join(" "),
    "system.identity.physicalFeatures": features,
    "system.story.weaknesses": pick("capability") === "No notable limit"
      ? (actor.system.story?.weaknesses || "")
      : [actor.system.story?.weaknesses, `Limit: ${pick("capability")}.`].filter(Boolean).join(" ")
  });
  if (pick("capability") === "Heroic edge") {
    const pool = ["fighting", "agility", "strength", "endurance", "reason", "intuition", "psyche"];
    const key = pool[Math.floor(Math.random() * pool.length)];
    const next = shiftRank(actor.getAbilityRank(key), 1);
    await actor.update({
      [`system.abilities.${key}.rank`]: next,
      [`system.abilities.${key}.number`]: rankMin(next)
    }, { faseripApplyRolls: true });
  }
  ui.notifications?.info(`${actor.name}: life details written on the Identity tab.`);
  return true;
}

export async function promptArchetypeExtras(actor, result, id) {
  if (id === "armored") await splitArmorFase(actor, result);
  if (id === "martial") await grantMartialStyle(actor);
  if (id === "elder") await askPassion(actor);
}

async function splitArmorFase(actor, result) {
  const roll = await askD100(actor, "Armor FASE pool", "Split this many column shifts across Fighting, Agility, Strength, and Endurance while the suit is worn.");
  if (roll == null) return;
  const pool = band(ARMOR_FASE, roll);
  if (!pool.cs) {
    ui.notifications?.info("The armor does not raise FASE.");
  } else {
    let choice = null;
    while (!choice) {
      const form = await dialog("Split armor bonuses", `
        <p>Roll ${roll}: <strong>${pool.label}</strong>. The four numbers must add up to ${pool.cs}.</p>
        ${["fighting", "agility", "strength", "endurance"].map((key) =>
          `<div class="form-group"><label>${key}</label><input name="${key}" type="number" min="0" max="${pool.cs}" value="0" /></div>`
        ).join("")}`, [
        { action: "ok", label: "Apply", default: true, callback: (_e, b) => ({ action: "ok", ...collect(b) }) },
        { action: "cancel", label: "Skip" }
      ]);
      if (!form || form === "cancel" || form.action === "cancel") break;
      const parts = ["fighting", "agility", "strength", "endurance"].map((key) => Math.max(0, Number(form[key]) || 0));
      if (parts.reduce((s, n) => s + n, 0) !== pool.cs) {
        ui.notifications?.warn(`Those shifts add up to ${parts.reduce((s, n) => s + n, 0)}. They need to add up to ${pool.cs}.`);
        continue;
      }
      choice = parts;
    }
    if (choice) {
      ["fighting", "agility", "strength", "endurance"].forEach((key, i) => {
        if (!choice[i]) return;
        result.abilities[key] = shiftRank(result.abilities[key], choice[i]);
        result.numbers[key] = rankMin(result.abilities[key]);
      });
    }
  }
  const enduranceRoll = await askD100(actor, "Armor Endurance", "Rank of the suit's resistance to outside control.");
  const endurance = enduranceRoll == null ? "excellent" : band(ARMOR_RANKS, enduranceRoll).id;
  result.archetypePowers = [
    { name: "Body Armor", rank: "excellent", definition: "The suit's hide. Energy attacks treat it as 20 points thinner.", bodyArmor: true },
    { name: "Armor Endurance", rank: endurance, definition: "Resistance when something tries to seize the suit from outside." }
  ];
  ui.notifications?.info(`Armor Endurance ${rankLabel(endurance)}. Suit powers should be machinery: see the Armored Powers roll table.`);
}

async function grantMartialStyle(actor) {
  const form = await dialog("Martial style", `
    <p>A style is a talent. It grants +1 CS Fighting while that style is in use. Daily practice is part of the path. Missed days dull the martial powers.</p>
    <div class="form-group"><label>Style</label><select name="style">${options(MARTIAL_STYLES)}</select></div>`, [
    { action: "ok", label: "Take style", default: true, callback: (_e, b) => ({ action: "ok", ...collect(b) }) },
    { action: "cancel", label: "Skip" }
  ]);
  if (!form || form === "cancel") return;
  await writeGeneratedItem(actor, "talent", form.style || MARTIAL_STYLES[0], {
    rank: "excellent",
    definition: "+1 CS Fighting while this style is in use. Train most days or the martial powers slip."
  });
  await writeGeneratedItem(actor, "contact", "Teacher", {
    rank: "good",
    definition: "The sensei, sifu, or coach who taught the style."
  });
}

async function askPassion(actor) {
  const form = await dialog("Elder obsession", `
    <p>An Elder stays alive by refusing to finish one huge pursuit. Name it.</p>
    <div class="form-group"><label>Passion</label><select name="passion">${options(ELDER_PASSIONS)}</select></div>
    <div class="form-group"><label>In their own words</label><input name="custom" type="text" /></div>`, [
    { action: "ok", label: "Set passion", default: true, callback: (_e, b) => ({ action: "ok", ...collect(b) }) },
    { action: "cancel", label: "Skip" }
  ]);
  if (!form || form === "cancel") return;
  const passion = form.custom || form.passion;
  await actor.update({
    "system.identity.personality": [actor.system.identity.personality, `Obsession: ${passion}.`].filter(Boolean).join(" ")
  });
}

export function packagePowers(id) {
  if (id === "vampire") {
    return VAMPIRE_POWERS.map(([name, rank, definition]) => ({ name, rank, definition }));
  }
  if (id === "elder") {
    return ELDER_POWERS.map(([name, rank, definition]) => ({ name, rank, definition }));
  }
  if (id === "spaceknight") {
    return [
      { name: "Flight", rank: "monstrous", definition: "Monstrous in air. Unearthly once the knight is in space." },
      { name: "Body Armor", rank: "incredible", definition: "Incredible against physical, heat, cold, and radiation.", bodyArmor: true },
      { name: "Regeneration", rank: "good", definition: "The suit knits Good damage." },
      { name: "Space Warp", rank: "monstrous", definition: "Finds a warp. The jump itself is Class 1000 range." }
    ];
  }
  if (id === "symbiote") return symbioteStandardRows();
  return [];
}

export function vampireWeakness() {
  return VAMPIRE_LIMITS.join(" ");
}

export function symbioteWeakness() {
  return SYMBIOTE_WEAKNESS;
}

export async function pickMartialPowers(actor, count) {
  const needed = Math.max(0, Number(count) || 0);
  const chosen = [];
  for (let i = 0; i < needed; i++) {
    const roll = await askD100(actor, `Martial power ${i + 1}`, "Pressure points, chi, combat sense, deadly strike, and the rest of the martial list.");
    if (roll == null) break;
    const row = band(MARTIAL_POWERS, roll);
    const form = await dialog("Martial power", `
      <p>Rolled <strong>${esc(row.name)}</strong>. ${esc(row.note)}</p>
      <div class="form-group"><label>Power</label><select name="name">${options(MARTIAL_POWERS.map((p) => p.name), row.name)}</select></div>`, [
      { action: "ok", label: "Keep", default: true, callback: (_e, b) => ({ action: "ok", ...collect(b) }) },
      { action: "cancel", label: "Stop" }
    ]);
    if (!form || form === "cancel") break;
    const power = MARTIAL_POWERS.find((p) => p.name === form.name) || row;
    const rankRoll = await askD100(actor, power.name, "Rank on the suit's power table: mostly Remarkable, up to Amazing.");
    const rank = rankRoll == null ? "remarkable" : band(ARMOR_RANKS, rankRoll).id;
    chosen.push({ name: power.name, rank, definition: power.note, category: "Martial" });
  }
  return chosen;
}

export async function pickImplants(actor) {
  const roll = await askD100(actor, "Implant budget", "How many implants, and how many resource points they can cost.");
  if (roll == null) return [];
  const budget = band(CYBORG_BUDGET, roll);
  const boxes = IMPLANTS.map((row, i) =>
    `<label class="implant"><input type="checkbox" name="imp" value="${i}" /> ${esc(row[0])} (${row[1]}, threshold ${row[2]}, ${row[3]})</label>`
  ).join("");
  const form = await dialog("Implants", `
    <p>${budget.count} implants, ${budget.total} resource points total, ${budget.max === 99 ? "no" : budget.max} point cap on one implant. Cyberware threshold starts at 100. Bioware threshold equals the Endurance rank number.</p>
    <div class="implant-list">${boxes}</div>`, [
    { action: "ok", label: "Install", default: true, callback: (_e, button) => {
      const form = button?.form || button?.closest?.("form") || document.querySelector(".faserip-dialog .implant-list")?.closest("form");
      const values = [...(form?.querySelectorAll("input[name=imp]:checked") || [])].map((el) => el.value);
      return { action: "ok", imp: values };
    } },
    { action: "cancel", label: "Skip" }
  ], 640);
  if (!form || form === "cancel") return [];
  const ids = [].concat(form.imp || []).map(Number);
  const picked = ids.map((i) => IMPLANTS[i]).filter(Boolean).slice(0, budget.count);
  for (const row of picked) {
    await writeGeneratedItem(actor, "equipment", row[0], {
      rank: row[3],
      definition: `${row[1]} implant. Threshold ${row[2]}. ${row[4]}`
    });
  }
  ui.notifications?.info(`${picked.length} implant(s) installed.`);
  return picked.map((row) => row[0]);
}

export function lifeTableSpecs() {
  const specs = [];
  specs.push({ name: "Life — Build", description: "Body type before height and weight.", rows: BUILDS.map((row) => ({ lo: row.lo, hi: row.hi, text: row.label })) });
  specs.push({ name: "Life — Height and Weight", description: "Base pounds before the Strength multiplier.", rows: STATURE.map((row) => ({ lo: row.lo, hi: row.hi, text: statureText(row) })) });
  specs.push({ name: "Life — Weight by Strength", description: "Multiply the base weight by the Strength row.", rows: WEIGHT_MODS.filter((row) => row.label).map((row, i, list) => ({ lo: Math.floor(i * 100 / list.length) + 1, hi: i === list.length - 1 ? 100 : Math.floor((i + 1) * 100 / list.length), text: row.label })) });
  specs.push({ name: "Life — Calling", description: "Moral drive.", rows: CALLINGS.map((row, i) => ({ lo: Math.floor(i * 100 / CALLINGS.length) + 1, hi: i === CALLINGS.length - 1 ? 100 : Math.floor((i + 1) * 100 / CALLINGS.length), text: `${row.label}: ${row.note}` })) });
  specs.push({ name: "Life — Quirk Type", description: "Which quirk list to roll next.", rows: QUIRK_TYPES.map((row) => ({ lo: row.lo, hi: row.hi, text: row.label })) });
  for (const kind of ["physical", "mental", "social"]) {
    for (const side of ["positive", "negative"]) {
      specs.push({
        name: `Life — ${kind} quirks (${side})`,
        description: "One point unless the note says two. A hero who takes points should balance them.",
        rows: QUIRKS[kind][side].map((row) => ({ lo: row.lo, hi: row.hi, text: `${row.name} (${row.points} pt): ${row.note}` }))
      });
    }
  }
  const lifeNames = {
    ancestry: "Ancestry", gender: "Gender", marital: "Marital status", orientation: "Orientation",
    class: "Social class", family: "Family", record: "Criminal record", body: "Body type",
    statureBand: "Everyday stature", age: "Age", capability: "Capability", looks: "Looks", extra: "Extra detail"
  };
  for (const [key, rows] of Object.entries(LIFE_TABLES)) {
    specs.push({ name: `Life — ${lifeNames[key]}`, description: "Ordinary-life detail.", rows: rows.map((row) => ({ lo: row.lo, hi: row.hi, text: row.label })) });
  }
  specs.push({ name: "Armor — FASE pool", description: "Column shifts to split across Fighting, Agility, Strength, and Endurance.", rows: ARMOR_FASE.map((row) => ({ lo: row.lo, hi: row.hi, text: row.label })) });
  specs.push({ name: "Armor — Power Rank", description: "Rank for a suit power or Armor Endurance.", rows: ARMOR_RANKS.map((row) => ({ lo: row.lo, hi: row.hi, text: row.id })) });
  specs.push({ name: "Armor — Battle Damage", description: "When a hit beats Body Armor by 2 CS or more and the breach check is red.", rows: ARMOR_DAMAGE.map((row) => ({ lo: row.lo, hi: row.hi, text: row.label })) });
  specs.push({ name: "Armor — Machine Powers", description: "Powers a suit can plausibly mount.", rows: ARMOR_POWERS.map((name, i) => ({ lo: Math.floor(i * 100 / ARMOR_POWERS.length) + 1, hi: i === ARMOR_POWERS.length - 1 ? 100 : Math.floor((i + 1) * 100 / ARMOR_POWERS.length), text: name })) });
  specs.push({ name: "Cyborg — Implant Budget", description: "Implant count and resource points.", rows: CYBORG_BUDGET.map((row) => ({ lo: row.lo, hi: row.hi, text: `${row.count} implants, ${row.total} points, max ${row.max === 99 ? "any" : row.max}` })) });
  specs.push({ name: "Cyborg — Implants", description: "Cyberware threshold 100. Bioware threshold equals the Endurance rank number.", rows: IMPLANTS.map((row, i) => ({ lo: Math.floor(i * 100 / IMPLANTS.length) + 1, hi: i === IMPLANTS.length - 1 ? 100 : Math.floor((i + 1) * 100 / IMPLANTS.length), text: `${row[0]} (${row[1]} ${row[2]}): ${row[4]}` })) });
  specs.push({ name: "Martial Artist — Powers", description: "Powers from training. Fighting should be at least Remarkable.", rows: MARTIAL_POWERS.map((row) => ({ lo: row.lo, hi: row.hi, text: `${row.name}: ${row.note}` })) });
  specs.push({ name: "Martial Artist — Styles", description: "Each style is a talent: +1 CS Fighting while it is used.", rows: MARTIAL_STYLES.map((name, i) => ({ lo: Math.floor(i * 100 / MARTIAL_STYLES.length) + 1, hi: i === MARTIAL_STYLES.length - 1 ? 100 : Math.floor((i + 1) * 100 / MARTIAL_STYLES.length), text: name })) });
  specs.push({ name: "Vampire — Limits", description: "Roll one pressure, or use the whole list.", rows: VAMPIRE_LIMITS.map((text, i) => ({ lo: Math.floor(i * 100 / VAMPIRE_LIMITS.length) + 1, hi: i === VAMPIRE_LIMITS.length - 1 ? 100 : Math.floor((i + 1) * 100 / VAMPIRE_LIMITS.length), text })) });
  specs.push({ name: "Elder — Passion", description: "The obsession that keeps an Elder alive.", rows: ELDER_PASSIONS.map((text, i) => ({ lo: Math.floor(i * 100 / ELDER_PASSIONS.length) + 1, hi: i === ELDER_PASSIONS.length - 1 ? 100 : Math.floor((i + 1) * 100 / ELDER_PASSIONS.length), text })) });
  return specs;
}

export { ARCHETYPE_CHOICES };

/**
 * Play-side Realms of Magic procedures.
 * Original wording. Spell-title lists and school essays stay out.
 */

import { colorForRoll, rankIndex, rankLabel, rankValue } from "./config.mjs";
import { combatTarget, writePending } from "./play-rules.mjs";
import { MAGIC_EFFECTS, romLimitFor, startingMastery } from "./data/rom.mjs";
import { worldDay } from "./clock.mjs";
import { formValue, promptForm } from "./foundry-api.mjs";

const COLOR_INDEX = { white: 0, green: 1, yellow: 2, red: 3 };
const HIGH_RANKS = new Set(["cl1000", "cl3000", "cl5000", "beyond"]);
const pending = new Map();

export function isRomPower(item) {
  if (!item || item.type !== "power") return false;
  const type = String(item.system?.powerType || "");
  const category = String(item.system?.category || "");
  return type === "Realms of Magic" || /^rom\b/i.test(category);
}

export function magicEnergy(item) {
  const category = String(item?.system?.category || "").toLowerCase();
  if (category.includes("dimensional")) return "dimensional";
  if (category.includes("personal")) return "personal";
  if (category.includes("universal")) return "universal";
  const name = String(item?.name || "").toLowerCase();
  if (/entreat|banish|aperture|dimensional/.test(name)) return "dimensional";
  return "universal";
}

export function magicLimitNote(item) {
  const row = romLimitFor(item?.system?.rank || "typical");
  if (row.id === "shift0") return "Shift 0 cannot cast.";
  return `Lasts ${row.duration}. Covers ${row.area}. Damage ${row.damage}.`;
}

export function magicColumnShift(rankId, cs) {
  let id = rankId || "typical";
  let shift = Number(cs) || 0;
  if (!HIGH_RANKS.has(id)) return { rankId: id, cs: shift };
  if (shift > 0) shift = 0;
  if (shift < 0) {
    id = "unearthly";
    shift += 1;
  }
  return { rankId: id, cs: shift };
}

export function magicResult(columnId, color) {
  const table = {
    energy: "blasting",
    force: "blasting",
    blasting: "blasting",
    shooting: "targeting",
    targeting: "targeting",
    edged: "biteClaw",
    blunt: "slugfest",
    charging: "slugfest"
  };
  const key = table[columnId];
  if (!key) return "";
  return MAGIC_EFFECTS.columns[key]?.[COLOR_INDEX[color] ?? 0] || "";
}

export function magicHarm(rankId) {
  return Number(romLimitFor(rankId).damage || 0);
}

export function takeMagic(item) {
  return item?.id ? pending.get(item.id) || null : null;
}

function roundStamp() {
  const combat = globalThis.game?.combat;
  if (!combat) return null;
  return { key: `${combat.id}:${combat.round ?? 0}`, combatId: combat.id, round: Number(combat.round ?? 0) };
}

function readCast(actor) {
  const raw = actor?.getFlag?.("faserip", "magicCast") || {};
  const stamp = roundStamp();
  const sameCombat = !!(stamp && raw.combatId === stamp.combatId);
  const busyRound = sameCombat ? Number(raw.busyRound || 0) : 0;
  if (!stamp || raw.key !== stamp.key) {
    return { key: stamp?.key || "", personal: 0, dimensional: 0, combatId: stamp?.combatId || "", busyRound };
  }
  return {
    key: raw.key,
    personal: Number(raw.personal || 0),
    dimensional: Number(raw.dimensional || 0),
    combatId: raw.combatId || stamp.combatId,
    busyRound
  };
}

function groupBlock(actor, item) {
  const name = item.getFlag?.("faserip", "spellGroup") || item.flags?.faserip?.spellGroup || "";
  const need = Number(item.getFlag?.("faserip", "spellGroupNeed") || item.flags?.faserip?.spellGroupNeed || 0);
  if (!name || need <= 1) return "";
  const owned = (actor?.items || []).filter((entry) => (entry.getFlag?.("faserip", "spellGroup") || entry.flags?.faserip?.spellGroup) === name).length;
  if (owned >= need) return "";
  return `${item.name} belongs to ${name}. ${owned} of ${need} are known, so none of that group can be cast yet.`;
}

function psycheNote(actor, target) {
  if (!actor || !target || actor.id === target.id) return "";
  const caster = rankIndex(actor.getAbilityRank?.("psyche") || "typical");
  const defender = rankIndex(target.getAbilityRank?.("psyche") || "typical");
  if (caster > defender) return "Caster's Psyche is higher: the target's Psyche FEAT to resist this working is −1 CS.";
  if (defender > caster) return "Defender's Psyche is higher: their Psyche FEAT to resist this working is +1 CS.";
  return "";
}

async function abilityColor(actor, ability) {
  const rankId = actor?.getAbilityRank?.(ability) || "typical";
  const roll = await new Roll("1d100").evaluate({ allowInteractive: false });
  const total = Number(roll.total);
  return { total, color: colorForRoll(rankId, total), rankId };
}

function checkbox(name, label) {
  return `<label class="check"><input type="checkbox" name="${name}" /> ${label}</label>`;
}

export async function prepareMagicCast(actor, item) {
  if (!actor || !isRomPower(item)) return null;
  const blocked = groupBlock(actor, item);
  if (blocked) {
    ui.notifications?.warn(blocked);
    return null;
  }
  const rankId = item.system?.rank || "typical";
  if (romLimitFor(rankId).id === "shift0") {
    ui.notifications?.warn(`${item.name} is Shift 0 and cannot be cast.`);
    return null;
  }
  const energy = magicEnergy(item);
  const stamp = roundStamp();
  const cast = readCast(actor);
  let second = false;
  if (stamp) {
    if (cast.busyRound && stamp.round <= cast.busyRound) {
      ui.notifications?.warn(`${actor.name} is still finishing a working.`);
      return null;
    }
    if (energy === "dimensional") {
      if (cast.dimensional || cast.personal) {
        ui.notifications?.warn("A dimensional working cannot share a round with another working.");
        return null;
      }
    } else if (cast.dimensional) {
      ui.notifications?.warn("A personal or universal working cannot share a round with a dimensional working.");
      return null;
    } else if (cast.personal >= 2) {
      ui.notifications?.warn("Two personal or universal workings is the limit for this round.");
      return null;
    } else if (cast.personal === 1) {
      second = true;
    }
  }
  const fromText = !!(item.getFlag?.("faserip", "fromText") || item.flags?.faserip?.fromText);
  const polish = Number(item.getFlag?.("faserip", "polish") || item.flags?.faserip?.polish || 0);
  const form = await promptForm({
    title: item.name,
    okLabel: "Cast",
    content: `<form>
      <p class="hint">${magicLimitNote(item)} ${energy === "dimensional" ? "Dimensional workings do not allow a Psyche FEAT to avoid them, and only one can be cast in a round." : "One personal or universal working a round, or two if Agility is Red. A second attempt that is not Red is −1 CS."}</p>
      ${checkbox("huge", "Target is over 30 feet tall or at least 2 areas wide (−2 CS)")}
      ${checkbox("other", "Target is from another dimension (−1 CS)")}
      ${checkbox("ground", "This ground favors the caster's school (+1 CS)")}
      ${checkbox("vulnerable", "Target is vulnerable to the caster's school (+1 CS)")}
      ${checkbox("willing", "Target is truly willing, not controlled (+3 CS)")}
      ${checkbox("astral", "Astral combat (−1 CS)")}
      ${fromText ? "" : checkbox("book", "Learned in play from an old text (+2 CS)")}
      ${checkbox("distracted", "Distracted. A Psyche FEAT is required to finish this round.")}
    </form>`
  });
  if (!form) return null;
  let cs = polish;
  const notes = [magicLimitNote(item)];
  if (polish) notes.push(`Refined ${polish} time${polish === 1 ? "" : "s"} at this rank (+${polish} CS). The rank does not change.`);
  if (fromText) {
    cs += 2;
    notes.push("Learned from an old text (+2 CS).");
  }
  const marks = [
    ["huge", -2, "Huge target (−2 CS)."],
    ["other", -1, "Other-dimensional target (−1 CS)."],
    ["ground", 1, "Helpful ground (+1 CS)."],
    ["vulnerable", 1, "School vulnerability (+1 CS)."],
    ["willing", 3, "Willing target (+3 CS)."],
    ["astral", -1, "Astral combat (−1 CS)."],
    ["book", 2, "Learned from an old text (+2 CS)."]
  ];
  for (const [name, amount, line] of marks) {
    if (!formValue(form, name)) continue;
    cs += amount;
    notes.push(line);
  }
  if (second) {
    const agility = await abilityColor(actor, "agility");
    if (agility.color === "red") {
      notes.push(`Second working this round. Agility ${agility.total} is Red, so the rank stays.`);
    } else {
      cs -= 1;
      notes.push(`Second working this round. Agility ${agility.total} is not Red, so −1 CS.`);
    }
  }
  let busyRound = 0;
  if (formValue(form, "distracted")) {
    const psyche = await abilityColor(actor, "psyche");
    if (psyche.color === "white") {
      notes.push(`Distracted. Psyche ${psyche.total} failed, so this working takes two rounds.`);
      if (stamp) busyRound = stamp.round + 1;
    } else {
      notes.push(`Distracted, but Psyche ${psyche.total} (${psyche.color}) finishes it this round.`);
    }
  }
  const prep = { cs, note: notes.join(" "), energy, busyRound };
  if (item.id) pending.set(item.id, prep);
  return prep;
}

export async function commitMagicCast(actor, item, prep = null) {
  const stored = prep || takeMagic(item);
  const stamp = roundStamp();
  if (actor?.setFlag && stamp) {
    const cast = readCast(actor);
    const energy = stored?.energy || magicEnergy(item);
    const next = {
      key: stamp.key,
      combatId: stamp.combatId,
      personal: cast.personal + (energy === "dimensional" ? 0 : 1),
      dimensional: cast.dimensional + (energy === "dimensional" ? 1 : 0),
      busyRound: Math.max(cast.busyRound || 0, stored?.busyRound || 0)
    };
    await actor.setFlag("faserip", "magicCast", next);
  }
  if (item?.id) pending.delete(item.id);
}

export function magicStudyNote(actor) {
  const study = actor?.getFlag?.("faserip", "magicStudy");
  if (!study?.name) return "";
  const left = Math.max(0, Number(study.months || 0) * 30 - (worldDay() - Number(study.day || 0)));
  if (left <= 0) return `${study.name} is ready to finish.`;
  return `Studying ${study.name}: ${left} world day${left === 1 ? "" : "s"} left.`;
}

function studyMonths(actor) {
  const count = (actor?.items || []).filter((item) => isRomPower(item)).length;
  const mastery = startingMastery(count);
  if (mastery.id === "novice") return { months: 0, mastery };
  if (mastery.id === "disciple") return { months: 9, mastery };
  if (mastery.id === "adept") return { months: 6, mastery };
  return { months: 5, mastery };
}

async function payMagic(actor, cost) {
  const bank = Number(actor.system?.karmaBank?.powers || 0);
  const pool = Number(actor.system?.karmaBank?.pool || 0);
  const karma = Number(actor.system?.karma?.value || 0);
  let need = cost;
  const fromBank = Math.min(bank, need);
  need -= fromBank;
  const fromPool = Math.min(pool, need);
  need -= fromPool;
  const fromKarma = Math.min(karma, need);
  need -= fromKarma;
  if (need > 0) {
    ui.notifications?.warn(`${actor.name} needs ${cost} Karma.`);
    return false;
  }
  await actor.update({
    "system.karmaBank.powers": bank - fromBank,
    "system.karmaBank.pool": pool - fromPool,
    "system.karma.value": karma - fromKarma,
    "system.karmaBank.totalSpent": Number(actor.system?.karmaBank?.totalSpent || 0) + cost
  });
  return true;
}

async function createWorking(actor, { name, energy, rank, fromText = false, group = "", groupNeed = 1 }) {
  const { describeRomSpell } = await import("./data/rom-descriptions.mjs");
  const system = {
    rank,
    number: rankValue(rank),
    category: `RoM ${energy}`,
    ...describeRomSpell(name, { energy, rank, category: `RoM ${energy}` })
  };
  const [item] = await actor.createEmbeddedDocuments("Item", [{ name, type: "power", system }]);
  if (!item) return null;
  if (fromText) await item.setFlag("faserip", "fromText", true);
  if (group && groupNeed > 1) {
    await item.setFlag("faserip", "spellGroup", group);
    await item.setFlag("faserip", "spellGroupNeed", groupNeed);
  }
  return item;
}

function workingForm(title, hint) {
  return promptForm({
    title,
    okLabel: "Spend Karma",
    content: `<form>
      <p class="hint">${hint}</p>
      <div class="form-group"><label>Name</label><input type="text" name="name" value="" /></div>
      <div class="form-group"><label>Energy</label>
        <select name="energy">
          <option value="personal">Personal</option>
          <option value="universal">Universal</option>
          <option value="dimensional">Dimensional</option>
        </select>
      </div>
      <div class="form-group"><label>Group name (leave blank if it stands alone)</label><input type="text" name="group" value="" /></div>
      <div class="form-group"><label>Spells in that group</label><input type="number" name="groupNeed" value="1" min="1" /></div>
    </form>`
  });
}

function readWorkingForm(form) {
  const name = String(formValue(form, "name") || "").trim();
  const energy = formValue(form, "energy") || "personal";
  const group = String(formValue(form, "group") || "").trim();
  const groupNeed = Math.max(1, Number(formValue(form, "groupNeed") || 1));
  return { name, energy, group, groupNeed: group ? groupNeed : 1 };
}

export async function promptLearnWorking(actor) {
  if (!actor) return;
  const form = await workingForm(
    "Learn a working",
    "From a master: 2500 Karma, or 1500 for each spell that belongs to a group. The rank starts at Excellent. A group cannot be cast until every spell in it is known."
  );
  if (!form) return;
  const fields = readWorkingForm(form);
  if (!fields.name) return;
  const cost = fields.groupNeed > 1 ? 1500 : 2500;
  if (!(await payMagic(actor, cost))) return;
  await createWorking(actor, { ...fields, rank: "excellent" });
  ui.notifications?.info(`${actor.name} learns ${fields.name} at ${rankLabel("excellent")} for ${cost} Karma.`);
}

export async function promptStudyWorking(actor) {
  if (!actor) return;
  const existing = actor.getFlag("faserip", "magicStudy");
  if (existing?.name) {
    const left = Math.max(0, Number(existing.months || 0) * 30 - (worldDay() - Number(existing.day || 0)));
    if (left > 0) {
      ui.notifications?.info(magicStudyNote(actor));
      return;
    }
    await createWorking(actor, {
      name: existing.name,
      energy: existing.energy || "personal",
      rank: "good",
      fromText: true,
      group: existing.group || "",
      groupNeed: Number(existing.groupNeed || 1)
    });
    await actor.unsetFlag("faserip", "magicStudy");
    ui.notifications?.info(`${actor.name} finishes ${existing.name} at ${rankLabel("good")}.`);
    return;
  }
  const pace = studyMonths(actor);
  if (!pace.months) {
    ui.notifications?.warn(`${actor.name} is a novice and cannot memorize a new tome spell yet.`);
    return;
  }
  const form = await workingForm(
    "Study a text",
    `${pace.mastery.label} pace: one written working every ${pace.months} months of world time. 2500 Karma, or 1500 if it is part of a group. It arrives at Good.`
  );
  if (!form) return;
  const fields = readWorkingForm(form);
  if (!fields.name) return;
  const cost = fields.groupNeed > 1 ? 1500 : 2500;
  if (!(await payMagic(actor, cost))) return;
  await actor.setFlag("faserip", "magicStudy", {
    ...fields,
    months: pace.months,
    day: worldDay()
  });
  ui.notifications?.info(`${actor.name} begins studying ${fields.name}. ${pace.months} months of world time remain.`);
}

export async function promptRefineWorking(actor) {
  if (!actor) return;
  const powers = (actor.items || []).filter((item) => isRomPower(item));
  if (!powers.length) {
    ui.notifications?.warn(`${actor.name} has no magical workings to refine.`);
    return;
  }
  const options = powers.map((item) => `<option value="${item.id}">${item.name}</option>`).join("");
  const form = await promptForm({
    title: "Refine a working",
    okLabel: "Spend 500",
    content: `<form>
      <p class="hint">500 Karma improves the working's effect without raising its rank. Each refinement is +1 CS when that working is cast.</p>
      <div class="form-group"><label>Working</label><select name="id">${options}</select></div>
    </form>`
  });
  if (!form) return;
  const item = actor.items.get(formValue(form, "id"));
  if (!item) return;
  if (!(await payMagic(actor, 500))) return;
  const next = Number(item.getFlag("faserip", "polish") || 0) + 1;
  await item.setFlag("faserip", "polish", next);
  ui.notifications?.info(`${item.name} is refined (${next}). Its rank stays ${rankLabel(item.system?.rank)}.`);
}

export async function promptDrawCache(actor) {
  if (!actor) return;
  const cache = Number(actor.getFlag("faserip", "resourceCache") || 0);
  if (cache <= 0) {
    ui.notifications?.warn(`${actor.name} has no resource cache.`);
    return;
  }
  const form = await promptForm({
    title: "Draw from the cache",
    okLabel: "Draw",
    content: `<form>
      <p class="hint">${cache} resource points are set aside.</p>
      <div class="form-group"><label>Amount</label><input type="number" name="amount" value="1" min="1" max="${cache}" /></div>
    </form>`
  });
  if (!form) return;
  const amount = Math.min(cache, Math.max(1, Number(formValue(form, "amount") || 0)));
  await actor.setFlag("faserip", "resourceCache", cache - amount);
  ui.notifications?.info(`${actor.name} draws ${amount}. ${cache - amount} remains in the cache.`);
}

export function resistLine(actor, target, item) {
  if (!isRomPower(item) || magicEnergy(item) === "dimensional") return "";
  return psycheNote(actor, target);
}

const SPELL_MODE = {
  armor: "armor",
  "alteration - appearance": "appearance",
  alteration: "appearance",
  "invisibility - self": "invisible",
  invisibility: "invisible",
  levitation: "levitate",
  "eldritch beam": "beam",
  "eldritch beams": "beam",
  "matter animation": "animate",
  animation: "animate",
  shield: "shield",
  "shield - individual": "shield",
  illusion: "illusion",
  bind: "bind",
  bands: "bind",
  banishment: "banish",
  entreaty: "entreat"
};

const AREA_MODE = new Set(["beam", "animate", "shield", "illusion", "bind"]);
const ZONE_FOR = { beam: "mark", animate: "animate", illusion: "illusion", bind: "bind", shield: "" };

function spellKey(name) {
  return String(name || "")
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/[—–]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function spellMode(item) {
  return SPELL_MODE[spellKey(item?.name)] || "";
}

function rollColor(result) {
  if (!result || result === true) return "";
  return result.getFlag?.("faserip", "color") || result.flags?.faserip?.color || "";
}

function liveEffect(actor, itemId) {
  return [...(actor?.effects ?? [])].find((effect) => effect.getFlag?.("faserip", "magicItem") === itemId && !effect.disabled) || null;
}

function effectDuration(rankId) {
  const text = String(romLimitFor(rankId).duration || "");
  const combat = globalThis.game?.combat;
  if (/permanent/i.test(text)) return {};
  const count = Number(text.match(/\d+/)?.[0] || 1);
  if (/hour/i.test(text)) return { seconds: 3600, startTime: globalThis.game?.time?.worldTime ?? 0 };
  if (/day/i.test(text)) return { seconds: 86400, startTime: globalThis.game?.time?.worldTime ?? 0 };
  if (/month/i.test(text)) return { seconds: 86400 * 30, startTime: globalThis.game?.time?.worldTime ?? 0 };
  if (/year/i.test(text)) return { seconds: 86400 * 365, startTime: globalThis.game?.time?.worldTime ?? 0 };
  return { rounds: /round/i.test(text) ? count : 1, startRound: combat?.round ?? null, combat: combat?.id || null };
}

function areaSquares(rankId) {
  const area = String(romLimitFor(rankId).area || "");
  if (/touch/i.test(area)) return 0;
  if (/user|same/i.test(area)) return 1;
  const count = Number(area.match(/(\d+)/)?.[1] || 0);
  if (count > 0 && /area/i.test(area)) return count;
  return 0;
}

function gridSize() {
  return Number(globalThis.canvas?.grid?.size) || 100;
}

function tokenCenter(actor) {
  const token = actor?.getActiveTokens?.(true)?.[0] || actor?.getActiveTokens?.()?.[0];
  if (!token) return null;
  const doc = token.document || token;
  return {
    token,
    doc,
    scene: doc.parent || globalThis.canvas?.scene,
    x: token.center?.x ?? token.x,
    y: token.center?.y ?? token.y
  };
}

const magicWaiters = new Map();

function requestId() {
  return globalThis.foundry?.utils?.randomID?.() || Math.random().toString(36).slice(2);
}

async function performMagic(data) {
  const scene = globalThis.game?.scenes?.get?.(data.sceneId) || globalThis.canvas?.scene;
  try {
    if (data.action === "embed") {
      if (!scene?.createEmbeddedDocuments) return [];
      const docs = await scene.createEmbeddedDocuments(data.docType, data.data || []);
      return docs.map((doc) => doc.id).filter(Boolean);
    }
    if (data.action === "remove") {
      if (!scene?.deleteEmbeddedDocuments || !data.ids?.length) return false;
      await scene.deleteEmbeddedDocuments(data.docType, data.ids);
      return true;
    }
    if (data.action === "hide") {
      const token = scene?.tokens?.get?.(data.tokenId);
      if (!token) return false;
      await token.update({ hidden: !!data.hidden });
      return true;
    }
    if (data.action === "stuck") {
      const target = globalThis.game?.actors?.get?.(data.actorId);
      if (!target) return false;
      if (data.active) await target.setFlag("faserip", "stuck", true);
      else await target.unsetFlag("faserip", "stuck");
      return true;
    }
  } catch (err) {
    console.warn("FASERIP | magic scene", err);
  }
  return null;
}

async function askMagic(action, payload) {
  if (globalThis.game?.user?.isGM) return performMagic({ action, ...payload });
  if (!globalThis.game?.socket) {
    globalThis.ui?.notifications?.warn("The Judge needs to be online for that.");
    return null;
  }
  return new Promise((resolve) => {
    const id = requestId();
    const timer = setTimeout(() => {
      magicWaiters.delete(id);
      globalThis.ui?.notifications?.warn("The Judge needs to be online for that.");
      resolve(null);
    }, 5000);
    magicWaiters.set(id, (result) => {
      clearTimeout(timer);
      resolve(result ?? null);
    });
    globalThis.game.socket.emit("system.faserip", { system: "magic", action, requestId: id, ...payload });
  });
}

export function registerMagic() {
  if (globalThis.game?.socket && !globalThis.game.faserip?._magicSocket) {
    globalThis.game.faserip = globalThis.game.faserip || {};
    globalThis.game.faserip._magicSocket = true;
    globalThis.game.socket.on("system.faserip", async (data) => {
      if (data?.system !== "magic") return;
      if (data.action === "reply") {
        const waiter = magicWaiters.get(data.requestId);
        if (!waiter) return;
        magicWaiters.delete(data.requestId);
        waiter(data.result);
        return;
      }
      if (!globalThis.game.user?.isGM) return;
      if (data.action === "embed" || data.action === "remove" || data.action === "hide" || data.action === "stuck") {
        const result = await performMagic(data);
        globalThis.game.socket.emit("system.faserip", {
          system: "magic",
          action: "reply",
          requestId: data.requestId,
          result
        });
      }
    });
  }
  const Hooks = globalThis.Hooks;
  if (!Hooks || Hooks._faseripMagicEffect) return;
  Hooks._faseripMagicEffect = true;
  const finish = (effect) => {
    clearMagicEffect(effect).catch((err) => console.warn("FASERIP | magic effect", err));
  };
  Hooks.on("deleteActiveEffect", finish);
  Hooks.on("updateActiveEffect", (effect, changes) => {
    if (changes?.disabled) finish(effect);
  });
}

export async function dismissMagicSpell(actor, item) {
  const effects = [];
  const own = liveEffect(actor, item?.id);
  if (own) effects.push(own);
  for (const other of globalThis.game?.actors ?? []) {
    if (other?.id === actor?.id) continue;
    const effect = liveEffect(other, item?.id);
    if (effect) effects.push(effect);
  }
  if (!effects.length) return false;
  for (const effect of effects) {
    try { await effect.delete(); } catch (err) {
      console.warn("FASERIP | dismiss working", err);
    }
  }
  globalThis.ui?.notifications?.info(`${item.name} ends.`);
  return true;
}

export async function clearMagicEffect(effect) {
  const work = effect?.getFlag?.("faserip", "magicWork") || effect?.flags?.faserip?.magicWork;
  if (!work || effect._faseripMagicCleared) return;
  effect._faseripMagicCleared = true;
  const actor = effect.parent;
  const mode = work.mode;
  if (actor && work.itemId) {
    const item = actor.items?.get?.(work.itemId);
    if (item && (mode === "armor" || mode === "shield")) {
      const field = mode === "armor" ? "system.bodyArmor" : "system.forceField";
      try { await item.update({ [field]: false }); } catch { /* the effect is already going */ }
    }
  }
  if (actor && mode === "levitate") {
    const { powerKeepsAloft, setFlying } = await import("./falling.mjs");
    const other = [...(actor.items ?? [])].some((item) => item.id !== work.itemId && powerKeepsAloft(item.name));
    if (!other) await setFlying(actor, false);
  }
  if (actor && mode === "shield") {
    try {
      const { playShieldArt } = await import("./vfx.mjs");
      await playShieldArt(actor, false);
    } catch { /* the field is already down */ }
  }
  if (mode === "bind") {
    for (const id of work.targetIds || []) {
      await askMagic("stuck", { actorId: id, active: false });
    }
  }
  if (work.sceneId && work.templateIds?.length) {
    await askMagic("remove", { sceneId: work.sceneId, docType: "MeasuredTemplate", ids: work.templateIds });
  }
  if (work.sceneId && work.regionIds?.length) {
    await askMagic("remove", { sceneId: work.sceneId, docType: "Region", ids: work.regionIds });
  }
  if (work.sceneId && work.tokenId && work.hidden) {
    await askMagic("hide", { sceneId: work.sceneId, tokenId: work.tokenId, hidden: false });
  }
}

async function placeArea(actor, item, mode) {
  const aimed = mode === "beam" ? tokenCenter(combatTarget(actor?.id)) : null;
  const where = aimed || tokenCenter(actor);
  if (!where?.scene) return null;
  const { squaresPerArea } = await import("./movement.mjs");
  const { circleTemplateData, coveredBy, zoneBehaviorData } = await import("./zones.mjs");
  const squares = Math.max(areaSquares(item.system?.rank), mode === "shield" ? 1 : 0);
  if (!(squares > 0) && mode !== "shield") return null;
  const span = (squares > 0 ? squares : 1) * squaresPerArea();
  const radius = (span * gridSize()) / 2;
  const colors = { beam: "#c084fc", animate: "#a16207", shield: "#38bdf8", illusion: "#f472b6", bind: "#fbbf24" };
  const color = colors[mode] || "#c084fc";
  const templateIds = await askMagic("embed", {
    sceneId: where.scene.id,
    docType: "MeasuredTemplate",
    data: [circleTemplateData({ x: where.x, y: where.y }, radius, color, item.name)]
  });
  let regionIds = [];
  const zone = ZONE_FOR[mode];
  if (zone) {
    const behavior = zoneBehaviorData(zone, item.system?.rank || "typical");
    if (behavior) {
      regionIds = await askMagic("embed", {
        sceneId: where.scene.id,
        docType: "Region",
        data: [{
          name: item.name,
          color,
          shapes: [{ type: "ellipse", x: where.x, y: where.y, radiusX: radius, radiusY: radius }],
          behaviors: [behavior],
          flags: { faserip: { magicZone: zone } }
        }]
      }) || [];
    }
  }
  const names = [];
  for (const token of globalThis.canvas?.tokens?.placeables ?? []) {
    const center = token.center || { x: token.x, y: token.y };
    if (Math.hypot(center.x - where.x, center.y - where.y) <= radius && token.actor) names.push(token.actor);
  }
  return {
    sceneId: where.scene.id,
    templateIds: templateIds || [],
    regionIds,
    note: coveredBy({ x: where.x, y: where.y }, radius),
    inside: names
  };
}

async function markEffect(actor, item, mode, work = {}) {
  if (!actor?.createEmbeddedDocuments) return null;
  const rankId = item.system?.rank || "typical";
  const [effect] = await actor.createEmbeddedDocuments("ActiveEffect", [{
    name: item.name,
    img: "icons/svg/aura.svg",
    disabled: false,
    duration: effectDuration(rankId),
    flags: {
      faserip: {
        magicItem: item.id,
        magicWork: { mode, itemId: item.id, ...work }
      }
    }
  }]);
  return effect || null;
}

export async function automateMagicSpell(actor, item, result) {
  const mode = spellMode(item);
  if (!actor || !mode || !result) return;
  if (mode === "invisible" || mode === "appearance") return;
  const color = rollColor(result);
  if (color === "white") return;
  const rankId = item.system?.rank || "typical";
  const amount = magicHarm(rankId);
  if (mode === "armor" || mode === "shield") {
    const field = mode === "armor" ? "system.bodyArmor" : "system.forceField";
    try { await item.update({ [field]: true, "system.number": amount }); } catch (err) {
      console.warn("FASERIP | magic ward", err);
    }
    const area = mode === "shield" ? await placeArea(actor, item, mode) : null;
    await markEffect(actor, item, mode, area ? {
      sceneId: area.sceneId,
      templateIds: area.templateIds,
      regionIds: area.regionIds
    } : {});
    if (mode === "shield") {
      try {
        const { playShieldArt } = await import("./vfx.mjs");
        await playShieldArt(actor, true);
      } catch { /* the ward still soaks */ }
    }
    const soak = mode === "armor" ? "physical damage. Energy attacks ignore 20 of that." : "as a force field.";
    globalThis.ui?.notifications?.info(`${item.name} is up. It soaks ${amount} ${soak}${area?.note ? " " + area.note : ""}`);
    return;
  }
  if (mode === "levitate") {
    const { setFlying } = await import("./falling.mjs");
    await setFlying(actor, true);
    await markEffect(actor, item, mode);
    globalThis.ui?.notifications?.info(`${actor.name} rises on ${item.name}.`);
    return;
  }
  if (mode === "entreat") {
    await writePending(actor, { nextCs: 1, nextNote: "Entreaty +1 CS" });
    globalThis.ui?.notifications?.info(`${item.name} lends ${actor.name} +1 CS on the next roll.`);
    return;
  }
  if (mode === "banish") {
    const target = combatTarget(actor.id);
    const spot = tokenCenter(target);
    if (!target || !spot?.doc) {
      globalThis.ui?.notifications?.warn("Target a token to banish.");
      return;
    }
    await askMagic("hide", { sceneId: spot.scene?.id, tokenId: spot.doc.id, hidden: true });
    await markEffect(target, item, mode, { sceneId: spot.scene?.id, tokenId: spot.doc.id, hidden: true });
    globalThis.ui?.notifications?.info(`${target.name} is banished for the working's duration.`);
    return;
  }
  if (!AREA_MODE.has(mode)) return;
  const area = await placeArea(actor, item, mode);
  if (!area) return;
  const targetIds = [];
  if (mode === "bind") {
    for (const target of area.inside || []) {
      if (!target?.id || target.id === actor.id) continue;
      const held = await askMagic("stuck", { actorId: target.id, active: true });
      if (held) targetIds.push(target.id);
    }
  }
  await markEffect(actor, item, mode, {
    sceneId: area.sceneId,
    templateIds: area.templateIds,
    regionIds: area.regionIds,
    targetIds
  });
  globalThis.ui?.notifications?.info(`${item.name} covers the area. ${area.note}`);
}

import { ABILITIES, RANKS, rankIndex, rankLabel } from "./config.mjs";
import { CITY_ENCOUNTERS, ENCOUNTER_KINDS, ENCOUNTER_WHEEL } from "./data/city-encounters.mjs";
import { formValue, promptForm } from "./foundry-api.mjs";

const WHEEL_RANK = {
  shifty: "shiftx",
  shiftz: "shiftx",
  cl1000: "shiftx",
  cl3000: "shiftx",
  cl5000: "shiftx",
  beyond: "shiftx"
};

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function dayPart(now = globalThis.game?.time?.worldTime) {
  const hour = Math.floor((Number(now || 0) % 86400) / 3600);
  if (hour < 5 || hour >= 21) return "night";
  if (hour < 9) return "dawn";
  if (hour < 17) return "day";
  return "evening";
}

function bestRank(actor) {
  let best = "typical";
  let score = rankIndex(best);
  for (const key of ABILITIES) {
    const id = actor?.getAbilityRank?.(key) || "typical";
    const index = rankIndex(id);
    if (index > score) {
      score = index;
      best = id;
    }
  }
  return WHEEL_RANK[best] || (ENCOUNTER_WHEEL[best] ? best : "typical");
}

function wheelColumn(rankId) {
  return ENCOUNTER_WHEEL[WHEEL_RANK[rankId] || rankId] || ENCOUNTER_WHEEL.typical;
}

function pickBand(rankId, roll) {
  const column = wheelColumn(rankId);
  return column.find((row) => roll >= row.lo && roll <= row.hi) || column[0];
}

function pickScene(code, part) {
  const all = CITY_ENCOUNTERS.filter((row) => row.code === code);
  const timed = all.filter((row) => row.time.includes("any") || row.time.includes(part));
  const pool = timed.length ? timed : all;
  const index = Math.floor(Math.random() * Math.max(1, pool.length));
  return { scene: pool[index] || all[0], widened: !timed.length && all.length > 0 };
}

function rankOptions(selected) {
  return RANKS.filter((rank) => ENCOUNTER_WHEEL[rank.id] || WHEEL_RANK[rank.id]).map((rank) => {
    const id = WHEEL_RANK[rank.id] || rank.id;
    const label = id === rank.id ? rank.label : `${rank.label} (uses ${RANKS.find((row) => row.id === id)?.label || id})`;
    return `<option value="${rank.id}" ${rank.id === selected ? "selected" : ""}>${esc(label)}</option>`;
  }).join("");
}

export async function rollCityEncounter(actor) {
  if (!globalThis.game?.user?.isGM) {
    globalThis.ui?.notifications?.warn("Only the Judge rolls a city encounter.");
    return null;
  }
  const part = dayPart();
  const suggested = bestRank(actor);
  const form = await promptForm({
    title: "City encounter",
    okLabel: "Roll",
    content: `<form>
      <p class="hint">The wheel uses the hero's rank. World time says this hour is ${part}. Scenes that fit the hour come up first.</p>
      <div class="form-group"><label>Rank</label><select name="rank">${rankOptions(suggested)}</select></div>
      <div class="form-group"><label>Time</label>
        <select name="part">
          <option value="${part}" selected>World clock (${part})</option>
          <option value="dawn">Dawn</option>
          <option value="day">Day</option>
          <option value="evening">Evening</option>
          <option value="night">Night</option>
          <option value="any">Any hour</option>
        </select>
      </div>
    </form>`
  });
  if (!form) return null;
  const rankId = formValue(form, "rank") || suggested;
  const when = formValue(form, "part") || part;
  const roll = await new Roll("1d100").evaluate({ allowInteractive: false });
  const total = Number(roll.total);
  const columnId = WHEEL_RANK[rankId] || rankId;
  const band = pickBand(columnId, total);
  const { scene, widened } = pickScene(band.code, when);
  const kind = ENCOUNTER_KINDS[band.code] || band.code;
  const buttons = (scene.karma || []).map((row, index) => {
    const amount = Number(row.karma) || 0;
    const sign = amount > 0 ? `+${amount}` : String(amount);
    return `<button type="button" data-faserip-encounter-karma="${index}">${esc(row.label)} (${sign} Karma)</button>`;
  }).join(" ");
  const hourNote = widened ? " No scene in that kind fit the hour, so the net was widened." : "";
  const content = `
    <div class="faserip-encounter">
      <p><strong>City encounter.</strong> ${esc(rankLabel(columnId))} column, roll ${total}: ${esc(kind)}.${esc(hourNote)}</p>
      <p><strong>${esc(scene.summary)}</strong></p>
      <p><strong>Set-up.</strong> ${esc(scene.setup)}</p>
      <p><strong>Play.</strong> ${esc(scene.adventure)}</p>
      <p><strong>After.</strong> ${esc(scene.aftermath)}</p>
      ${buttons ? `<p class="faserip-encounter-karma">${buttons}</p>` : ""}
    </div>`;
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    rolls: [roll],
    flags: {
      faserip: {
        encounter: true,
        encounterActor: actor?.uuid || "",
        encounterKarma: scene.karma || []
      }
    }
  });
}

async function payKarma(message, index) {
  if (!globalThis.game?.user?.isGM) {
    globalThis.ui?.notifications?.warn("Only the Judge awards this Karma.");
    return;
  }
  const paid = { ...(message.getFlag?.("faserip", "encounterPaid") || {}) };
  if (paid[index]) return;
  const rows = message.getFlag?.("faserip", "encounterKarma") || [];
  const row = rows[index];
  const uuid = message.getFlag?.("faserip", "encounterActor");
  const actor = uuid && globalThis.fromUuid ? await globalThis.fromUuid(uuid) : null;
  if (!row || !actor) return;
  const amount = Number(row.karma) || 0;
  const next = Math.max(0, Number(actor.system?.karma?.value || 0) + amount);
  await actor.update({ "system.karma.value": next });
  paid[index] = true;
  await message.setFlag("faserip", "encounterPaid", paid);
  globalThis.ui?.notifications?.info(`${actor.name}: ${amount > 0 ? "+" : ""}${amount} Karma. ${row.label}.`);
}

export function bindEncounterChat(message, html) {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root?.querySelectorAll) return;
  if (!message?.getFlag?.("faserip", "encounter") && !message?.flags?.faserip?.encounter) return;
  const paid = message.getFlag?.("faserip", "encounterPaid") || message.flags?.faserip?.encounterPaid || {};
  root.querySelectorAll("[data-faserip-encounter-karma]").forEach((button) => {
    const index = button.dataset.faseripEncounterKarma;
    if (paid[index]) {
      button.disabled = true;
      return;
    }
    button.addEventListener("click", (event) => {
      event.preventDefault();
      payKarma(message, index).catch((err) => console.warn("FASERIP | encounter karma", err));
    });
  });
}

export function registerEncounters() {
  const Hooks = globalThis.Hooks;
  if (!Hooks || Hooks._faseripEncounters) return;
  Hooks._faseripEncounters = true;
  Hooks.on("renderChatMessageHTML", bindEncounterChat);
}

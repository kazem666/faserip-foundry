import { ABILITIES, RANKS } from "./config.mjs";

const ABILITY_LABEL = {
  fighting: "Fighting",
  agility: "Agility",
  strength: "Strength",
  endurance: "Endurance",
  reason: "Reason",
  intuition: "Intuition",
  psyche: "Psyche"
};

const RANK_LOOKUP = new Map();
for (const rank of RANKS) {
  RANK_LOOKUP.set(rank.id, rank.id);
  RANK_LOOKUP.set(rank.label.toLowerCase(), rank.id);
  RANK_LOOKUP.set(rank.abbr.toLowerCase(), rank.id);
}
for (const [alias, id] of [
  ["shift 0", "shift0"],
  ["shift x", "shiftx"],
  ["shift y", "shifty"],
  ["shift z", "shiftz"],
  ["class 1000", "cl1000"],
  ["class 3000", "cl3000"],
  ["class 5000", "cl5000"]
]) RANK_LOOKUP.set(alias, id);

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function abilityId(text) {
  const key = String(text || "").trim().toLowerCase().replace(/\s+feat$/, "");
  return ABILITIES.includes(key) ? key : "";
}

function intensityId(text) {
  const key = String(text || "").trim().toLowerCase().replace(/\s+/g, " ").replace(/\s+intensity$/, "");
  if (!key) return "";
  return RANK_LOOKUP.get(key) || RANK_LOOKUP.get(key.replace(/\s+/g, "")) || "";
}

export function parseFeat(raw) {
  let text = String(raw || "").trim().replace(/\s+/g, " ");
  if (!text) return null;
  const bar = text.split("|").map((part) => part.trim()).filter(Boolean);
  if (bar.length === 2) {
    const ability = abilityId(bar[0]);
    const intensity = intensityId(bar[1]);
    if (!ability || !intensity) return null;
    return { ability, intensity };
  }
  text = text.replace(/\s+intensity$/i, "");
  const match = text.match(/^(fighting|agility|strength|endurance|reason|intuition|psyche)(?:\s+feat)?(?:\s+at\s+(.+))?$/i);
  if (!match) return null;
  const ability = match[1].toLowerCase();
  const intensity = match[2] ? intensityId(match[2]) : "";
  if (match[2] && !intensity) return null;
  return { ability, intensity };
}

export function featLabel(parsed) {
  const name = ABILITY_LABEL[parsed.ability] || parsed.ability;
  if (!parsed.intensity) return `${name} FEAT`;
  const rank = RANKS.find((entry) => entry.id === parsed.intensity);
  return `${name} FEAT at ${rank?.label || parsed.intensity} Intensity`;
}

export function featButtons(text) {
  const buttons = [];
  for (const match of String(text || "").matchAll(/@FEAT\[([^\]]+)\]/gi)) {
    const parsed = parseFeat(match[1]);
    if (!parsed) continue;
    buttons.push({ ...parsed, label: featLabel(parsed) });
  }
  return buttons;
}

function featEnricher(match) {
  if (typeof document === "undefined") return null;
  const parsed = parseFeat(match[1]);
  const anchor = document.createElement("a");
  anchor.className = parsed ? "faserip-feat-link" : "broken";
  if (!parsed) {
    anchor.textContent = match[0];
    return anchor;
  }
  anchor.dataset.ability = parsed.ability;
  anchor.dataset.intensity = parsed.intensity || "";
  const icon = document.createElement("i");
  icon.className = "fa-solid fa-dice";
  icon.setAttribute("aria-hidden", "true");
  anchor.append(icon, document.createTextNode(` ${featLabel(parsed)}`));
  return anchor;
}

function controlledActors() {
  const list = [];
  const seen = new Set();
  for (const token of globalThis.canvas?.tokens?.controlled ?? []) {
    const actor = token.actor;
    if (!actor || seen.has(actor.id)) continue;
    if (actor.type !== "hero" && actor.type !== "npc") continue;
    if (!actor.isOwner) continue;
    seen.add(actor.id);
    list.push(actor);
  }
  return list;
}

function ownedHeroes() {
  return [...(globalThis.game?.actors ?? [])].filter((actor) => {
    if (actor.type !== "hero" && actor.type !== "npc") return false;
    return !!actor.isOwner;
  });
}

async function pickActor(actors) {
  const { promptForm, formValue } = await import("./foundry-api.mjs");
  const { actorFromRef } = await import("./play-rules.mjs");
  const options = actors.map((actor) => `<option value="${esc(actor.uuid)}">${esc(actor.name)}</option>`).join("");
  const form = await promptForm({
    title: "Who is rolling?",
    okLabel: "Roll",
    content: `<form><div class="form-group"><label>Hero</label><select name="actor">${options}</select></div></form>`
  });
  if (!form) return null;
  return actorFromRef(formValue(form, "actor"));
}

async function actorForFeat() {
  const controlled = controlledActors();
  if (controlled.length === 1) return controlled[0];
  if (controlled.length > 1) return pickActor(controlled);
  const user = globalThis.game?.user;
  const character = user?.character;
  if (character?.isOwner && (character.type === "hero" || character.type === "npc")) return character;
  if (!user?.isGM) {
    const owned = ownedHeroes();
    if (owned.length === 1) return owned[0];
    if (owned.length > 1) return pickActor(owned);
  } else {
    const { sceneActorChoices, actorFromRef } = await import("./play-rules.mjs");
    const onScene = [];
    const seen = new Set();
    for (const choice of sceneActorChoices()) {
      const actor = actorFromRef(choice.id);
      if (!actor || seen.has(actor.id) || !actor.isOwner) continue;
      seen.add(actor.id);
      onScene.push(actor);
    }
    if (onScene.length === 1) return onScene[0];
    if (onScene.length > 1) return pickActor(onScene);
  }
  globalThis.ui?.notifications?.warn("Select the hero who is rolling this FEAT.");
  return null;
}

async function rollFromLink(link) {
  const ability = link.dataset.ability || "";
  const intensity = link.dataset.intensity || "";
  if (!ABILITIES.includes(ability)) return;
  const actor = await actorForFeat();
  if (!actor) return;
  const { promptFeatRoll } = await import("./dice/universal-table.mjs");
  await promptFeatRoll({
    actor,
    rankId: actor.getAbilityRank(ability),
    label: ABILITY_LABEL[ability] || "FEAT",
    ability,
    defaultIntensity: intensity
  });
}

function onFeatClick(event) {
  const link = event.target?.closest?.("a.faserip-feat-link");
  if (!link) return;
  event.preventDefault();
  event.stopPropagation();
  rollFromLink(link).catch((err) => console.warn("FASERIP | feat link", err));
}

function onChatMessage(_log, message, chatData) {
  const match = String(message || "").match(/^\/feat\s+(.+)$/i);
  if (!match) return;
  if (!parseFeat(match[1])) {
    globalThis.ui?.notifications?.warn("Use /feat Agility at Good, or /feat Reason.");
    return false;
  }
  chatData.content = `@FEAT[${match[1].trim()}]`;
}

export function registerFeatLinks() {
  const editor = globalThis.CONFIG?.TextEditor;
  if (editor) {
    editor.enrichers = editor.enrichers || [];
    if (!editor.enrichers.some((entry) => entry.id === "faserip-feat")) {
      editor.enrichers.push({
        id: "faserip-feat",
        pattern: /@FEAT\[([^\]]+)\]/gi,
        enricher: featEnricher
      });
    }
  }
  const root = globalThis.document?.documentElement;
  if (root && !root.dataset.faseripFeatLink) {
    root.dataset.faseripFeatLink = "1";
    document.addEventListener("click", onFeatClick);
  }
  const Hooks = globalThis.Hooks;
  if (Hooks && !Hooks._faseripFeatChat) {
    Hooks._faseripFeatChat = true;
    Hooks.on("chatMessage", onChatMessage);
  }
}

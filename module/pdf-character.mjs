/** Read a FASERIP character out of text taken from a PDF. Original field labels only. */

import { ABILITIES, RANKS, rankValue } from "./config.mjs";

const ABILITY_LABEL = {
  fighting: "Fighting",
  agility: "Agility",
  strength: "Strength",
  endurance: "Endurance",
  reason: "Reason",
  intuition: "Intuition",
  psyche: "Psyche"
};

const RANK_PHRASES = [
  ["shift 0", "shift0"],
  ["shift x", "shiftx"],
  ["shift y", "shifty"],
  ["shift z", "shiftz"],
  ["class 1000", "cl1000"],
  ["class 3000", "cl3000"],
  ["class 5000", "cl5000"],
  ["feeble", "feeble"],
  ["poor", "poor"],
  ["typical", "typical"],
  ["good", "good"],
  ["excellent", "excellent"],
  ["remarkable", "remarkable"],
  ["incredible", "incredible"],
  ["amazing", "amazing"],
  ["monstrous", "monstrous"],
  ["unearthly", "unearthly"],
  ["beyond", "beyond"],
  ["sh0", "shift0"],
  ["shx", "shiftx"],
  ["shy", "shifty"],
  ["shz", "shiftz"],
  ["fb", "feeble"],
  ["pr", "poor"],
  ["ty", "typical"],
  ["gd", "good"],
  ["ex", "excellent"],
  ["rm", "remarkable"],
  ["in", "incredible"],
  ["am", "amazing"],
  ["mn", "monstrous"],
  ["un", "unearthly"]
];

const SECTION_FOR = {
  power: "powers",
  powers: "powers",
  talent: "talents",
  talents: "talents",
  contact: "contacts",
  contacts: "contacts",
  weapon: "weapons",
  weapons: "weapons",
  equipment: "equipment",
  gear: "equipment",
  weakness: "weakness",
  weaknesses: "weakness",
  limitation: "weakness",
  limitations: "weakness",
  "known powers": "powers",
  "special powers": "powers",
  history: "history",
  biography: "history",
  background: "history",
  notes: "notes",
  note: "notes"
};

function loosen(text) {
  return String(text || "")
    .replace(/\r/g, "\n")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Za-z])/g, "$1 $2")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

function rankFromPhrase(phrase) {
  const key = String(phrase || "").trim().toLowerCase().replace(/\s+/g, " ");
  return RANK_PHRASES.find(([label]) => label === key)?.[1] || "";
}

function readRankAt(tokens, index, allowAbbrev) {
  const pair = rankFromPhrase(`${tokens[index] || ""} ${tokens[index + 1] || ""}`);
  if (pair) return { id: pair, used: 2, word: `${tokens[index]} ${tokens[index + 1]}` };
  const word = tokens[index] || "";
  if (!allowAbbrev && word.length <= 2) return null;
  const single = rankFromPhrase(word);
  if (single) return { id: single, used: 1, word };
  return null;
}

function numberFor(id, raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return rankValue(id);
  const band = RANKS.find((row) => row.id === id);
  if (band && n >= band.min && n <= Math.max(band.max, band.value)) return n;
  if (band && Math.abs(n - band.value) <= 2) return n;
  return rankValue(id);
}

function parseRankChunk(chunk) {
  const tokens = String(chunk || "").split(/[^A-Za-z0-9]+/).filter(Boolean);
  const scan = (allowAbbrev) => {
    for (let i = 0; i < tokens.length; i++) {
      const hit = readRankAt(tokens, i, allowAbbrev);
      if (!hit) continue;
      const after = tokens[i + hit.used];
      const number = /^\d+$/.test(after || "") ? numberFor(hit.id, after) : rankValue(hit.id);
      return { id: hit.id, number, word: hit.word };
    }
    return null;
  };
  const words = tokens.filter((token) => !/^\d+$/.test(token));
  const abbrevOk = words.length > 0 && words.length <= 2 && words.every((word) => rankFromPhrase(word));
  return scan(false) || (abbrevOk ? scan(true) : null);
}

function abilityFromLabels(text) {
  const found = {};
  for (const key of ABILITIES) {
    const re = new RegExp(`\\b${ABILITY_LABEL[key]}\\b\\s*[:\\-]?\\s*([^\\n]{0,48})`, "gi");
    let match;
    while ((match = re.exec(text))) {
      const parsed = parseRankChunk(match[1]);
      if (parsed) {
        found[key] = parsed;
        break;
      }
    }
  }
  return found;
}

function abilityFromRankLine(text) {
  for (const line of String(text || "").split("\n")) {
    const tokens = line.trim().split(/[^A-Za-z0-9]+/).filter(Boolean);
    if (tokens.length < 7) continue;
    const ranks = [];
    let index = 0;
    while (index < tokens.length && ranks.length < 7) {
      const hit = readRankAt(tokens, index, true);
      if (!hit) break;
      const after = tokens[index + hit.used];
      const numbered = /^\d+$/.test(after || "");
      ranks.push({ id: hit.id, number: numbered ? numberFor(hit.id, after) : rankValue(hit.id) });
      index += hit.used + (numbered ? 1 : 0);
    }
    if (ranks.length === 7 && index === tokens.length) return ranks;
  }
  return null;
}

function titleName(text) {
  for (const line of String(text || "").split("\n")) {
    const trimmed = line.trim().replace(/\s+/g, " ");
    if (trimmed.length < 2 || trimmed.length > 48) continue;
    const letters = trimmed.replace(/[^A-Za-z]/g, "");
    if (letters.length < 2 || letters.length < trimmed.length * 0.5) continue;
    if (sectionHeader(trimmed)) continue;
    if (/^(health|karma|resources|popularity|faserip|known|powers|talents|contacts|weapons|equipment|weakness|history|background|character|sheet|hero|page|abilities|ability|statistics|stats|limitation|limitations)\b/i.test(trimmed)) continue;
    if (ABILITIES.some((key) => new RegExp(`^${ABILITY_LABEL[key]}\\b`, "i").test(trimmed))) continue;
    const tokens = trimmed.split(/[^A-Za-z0-9]+/).filter(Boolean);
    if (tokens.length && tokens.every((token) => rankFromPhrase(token) || /^\d+$/.test(token))) continue;
    if (tokens.length === 7 && tokens.every((token, index) => token.toLowerCase() === ["f", "a", "s", "e", "r", "i", "p"][index])) continue;
    return trimmed;
  }
  return "";
}

function abilityFromRow(text) {
  const tokens = text.split(/\s+/).filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    let start = -1;
    if (/^faserip$/i.test(tokens[i])) start = i + 1;
    else if (["f", "a", "s", "e", "r", "i", "p"].every((letter, n) => (tokens[i + n] || "").toLowerCase() === letter)) start = i + 7;
    if (start < 0) continue;
    const ranks = [];
    for (let j = start; j < tokens.length && ranks.length < 7;) {
      const hit = readRankAt(tokens, j, true);
      if (!hit) break;
      const after = tokens[j + hit.used];
      const number = /^\d+$/.test(after || "") ? numberFor(hit.id, after) : rankValue(hit.id);
      ranks.push({ id: hit.id, number });
      j += hit.used + (/^\d+$/.test(after || "") ? 1 : 0);
    }
    if (ranks.length === 7) return ranks;
  }
  return null;
}

function pool(text, label) {
  const both = new RegExp(`\\b${label}\\b\\s*[:\\-]?\\s*(\\d+)\\s*(?:\\/|of)\\s*(\\d+)`, "i").exec(text);
  if (both) return { value: Number(both[1]), max: Number(both[2]) };
  const one = new RegExp(`\\b${label}\\b\\s*[:\\-]?\\s*(\\d+)`, "i").exec(text);
  if (one) return { value: Number(one[1]), max: Number(one[1]) };
  return null;
}

function field(text, re) {
  const match = re.exec(text);
  return match ? match[1].replace(/\s+/g, " ").trim().slice(0, 120) : "";
}

function cleanName(raw) {
  return String(raw || "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(feeble|poor|typical|good|excellent|remarkable|incredible|amazing|monstrous|unearthly|shift\s*[0xyz]|class\s*\d+)\b/ig, " ")
    .replace(/\b\d+\b/g, " ")
    .replace(/^[\s,.:;\-–—]+|[\s,.:;\-–—]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function entryFromLine(line) {
  const raw = String(line || "").replace(/^[\s•*\-–—\d.)]+/, "").trim();
  if (!raw || raw.length < 2) return null;
  const text = raw.length > 180 ? raw.slice(0, 180) : raw;
  if (/^(page|sheet|player|campaign|faserip|health|karma|resources|popularity|abilities|height|weight|name|origin|hair|eyes|group|calling|occupation|identity|known|limitation|limitations|background)\b/i.test(text)) return null;
  if (ABILITIES.some((key) => new RegExp(`^${ABILITY_LABEL[key]}\\b`, "i").test(text))) return null;
  const parsed = parseRankChunk(text);
  let name = text;
  if (parsed) {
    const at = text.toLowerCase().indexOf(String(parsed.word).toLowerCase());
    name = cleanName(at > 0 ? text.slice(0, at) : text);
  } else {
    name = cleanName(text.split(/[.:]/)[0]);
    if (name.split(/\s+/).filter(Boolean).length > 5) return null;
  }
  if (!name || name.length < 2 || name.length > 48) return null;
  return {
    name,
    rank: parsed?.id || "typical",
    number: parsed?.number || rankValue(parsed?.id || "typical")
  };
}

function splitEntryLine(line) {
  const ranks = RANK_PHRASES.filter(([label]) => label.length > 2 && new RegExp(`\\b${label}\\b`, "i").test(line)).length;
  if (ranks > 1 && /[,;]/.test(line)) return line.split(/[,;]/);
  return [line];
}

function sectionHeader(line) {
  const trimmed = line.trim();
  const headed = /^([A-Za-z]+(?:\s+[A-Za-z]+)?)\s*[:\-–—]\s*(.*)$/.exec(trimmed);
  const alone = /^([A-Za-z]+(?:\s+[A-Za-z]+)?)\s*$/.exec(trimmed);
  const match = headed || alone;
  if (!match) return null;
  const key = SECTION_FOR[match[1].toLowerCase()];
  if (!key) return null;
  return { key, rest: match[2] || "" };
}

function readSections(text) {
  const buckets = { powers: [], talents: [], contacts: [], weapons: [], equipment: [], weakness: [], history: [], notes: [] };
  let section = "";
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const header = sectionHeader(line);
    if (header) {
      section = header.key;
      if (header.rest) absorb(buckets, section, header.rest);
      continue;
    }
    if (section) absorb(buckets, section, line);
  }
  return buckets;
}

function absorb(buckets, section, line) {
  if (section === "weakness" || section === "history" || section === "notes") {
    buckets[section].push(line.replace(/\s+/g, " ").trim());
    return;
  }
  for (const part of splitEntryLine(line)) {
    const entry = entryFromLine(part);
    if (entry) buckets[section].push(entry);
  }
}

export function parseCharacterText(text, { filename = "", mechanicsOnly = false } = {}) {
  const source = loosen(text);
  const labeled = abilityFromLabels(source);
  const row = abilityFromRow(source);
  const lineRanks = abilityFromRankLine(source);
  const abilities = {};
  ABILITIES.forEach((key, index) => {
    const fromRow = row ? { id: row[index].id, number: row[index].number } : null;
    const fromLine = lineRanks ? { id: lineRanks[index].id, number: lineRanks[index].number } : null;
    abilities[key] = labeled[key] || fromRow || fromLine;
  });
  const found = ABILITIES.filter((key) => abilities[key]).length;
  const sections = readSections(source);
  const named = field(source, /\b(?:hero name|character name|name)\b\s*[:\-]\s*([^\n]+)/i);
  const fileName = mechanicsOnly ? "" : String(filename || "").replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim();
  const resources = parseRankChunk(field(source, /\bresources\b\s*[:\-]\s*([^\n]+)/i) || "");
  const popularityMatch = /\b(?:popularity|pop)\b\s*[:\-]\s*(-?\d+)/i.exec(source);
  const weakness = sections.weakness.join(" ");
  return {
    name: (named || titleName(source) || fileName || "Imported Hero").slice(0, 80),
    abilities,
    found,
    resources: resources?.id || "",
    resourceNumber: resources?.number || 0,
    popularity: popularityMatch ? Number(popularityMatch[1]) : null,
    health: pool(source, "health"),
    karma: pool(source, "karma"),
    identity: {
      public: field(source, /\b(?:public identity|public name)\b\s*[:\-]\s*([^\n]+)/i),
      secret: field(source, /\b(?:secret identity|real name|true name)\b\s*[:\-]\s*([^\n]+)/i),
      origin: field(source, /\borigin(?:\s+of\s+power)?\b\s*[:\-]\s*([^\n]+)/i),
      height: field(source, /\bheight\b\s*[:\-]\s*([^\n]+)/i),
      weight: field(source, /\bweight\b\s*[:\-]\s*([^\n]+)/i),
      hair: field(source, /\bhair\b\s*[:\-]\s*([^\n]+)/i),
      eyes: field(source, /\beyes\b\s*[:\-]\s*([^\n]+)/i),
      group: field(source, /\b(?:group|team)\b\s*[:\-]\s*([^\n]+)/i),
      calling: field(source, /\bcalling\b\s*[:\-]\s*([^\n]+)/i),
      occupation: field(source, /\boccupation\b\s*[:\-]\s*([^\n]+)/i)
    },
    powers: sections.powers,
    talents: sections.talents,
    contacts: sections.contacts,
    weapons: sections.weapons,
    equipment: sections.equipment,
    weakness: mechanicsOnly && weakness.length > 90 ? "" : weakness,
    history: mechanicsOnly ? "" : sections.history.join(" "),
    notes: mechanicsOnly ? "" : sections.notes.join(" ")
  };
}

export function heroSummary(hero) {
  const ranks = ABILITIES.map((key) => {
    const row = hero.abilities[key];
    const label = RANKS.find((rank) => rank.id === row?.id)?.label || "—";
    return `${ABILITY_LABEL[key]} ${label}${row ? ` ${row.number}` : ""}`;
  }).join("\n");
  const list = (title, rows) => rows?.length ? `${title}: ${rows.map((row) => row.name).join(", ")}` : "";
  return [
    hero.name,
    ranks,
    hero.health ? `Health ${hero.health.value}${hero.health.max !== hero.health.value ? ` / ${hero.health.max}` : ""}` : "",
    hero.karma ? `Karma ${hero.karma.value}${hero.karma.max !== hero.karma.value ? ` / ${hero.karma.max}` : ""}` : "",
    list("Powers", hero.powers),
    list("Talents", hero.talents),
    list("Contacts", hero.contacts),
    list("Weapons", hero.weapons)
  ].filter(Boolean).join("\n");
}

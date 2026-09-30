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
  statistics: "skip",
  history: "history",
  biography: "history",
  background: "history",
  "role-playing notes": "history",
  "role playing notes": "history",
  notes: "notes",
  note: "notes"
};

const LETTER_ABILITY = {
  f: "fighting",
  a: "agility",
  s: "strength",
  e: "endurance",
  r: "reason",
  i: "intuition",
  p: "psyche"
};

const IDENTITY_LINE = /^(real name|public identity|public name|secret identity|true name|occupation|legal status|identity|place of birth|marital status|known relatives|base of operations|past group affiliations|present group affiliation|group affiliation|former aliases|aliases|height|weight|hair|eyes|calling|origin(?: of power)?)\s*:/i;

function loosen(text) {
  return String(text || "")
    .replace(/\r/g, "\n")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/knownpowers/ig, "known powers")
    .replace(/roleplaying/ig, "role playing")
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

function rankToken(raw) {
  const attempts = [raw, String(raw || "").replace(/1/g, "I").replace(/0/g, "O").replace(/5/g, "S")];
  for (const attempt of attempts) {
    const parsed = parseRankChunk(attempt);
    if (parsed) return parsed;
  }
  return null;
}

function statisticsSlice(text) {
  const source = String(text || "");
  const start = source.search(/\bstatistics\b/i);
  const body = start >= 0 ? source.slice(start) : source;
  const end = body.search(/\b(?:background|known powers|talents|contacts)\b/i);
  return end > 0 ? body.slice(0, end) : body.slice(0, 900);
}

function abilityFromLetters(text) {
  const found = {};
  const region = statisticsSlice(text);
  const re = /(?:^|\s)([FASERIPl|])\s*[:\-]?\s*([A-Za-z]{2,12})\s*(?:\(\s*(\d{1,4})\s*\)|(\d{1,4})(?!\d))?/gi;
  for (const line of region.split("\n")) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(line))) {
      const letter = match[1].toLowerCase();
      const key = letter === "l" || letter === "|" ? "intuition" : LETTER_ABILITY[letter];
      if (!key || found[key]) continue;
      const parsed = rankToken(match[2]);
      if (!parsed) continue;
      const rawNumber = match[3] || match[4];
      found[key] = { id: parsed.id, number: rawNumber ? numberFor(parsed.id, rawNumber) : parsed.number };
    }
  }
  const glued = /\b([FASERIP])([A-Za-z]{2,8})\s*\(?\s*(\d{1,4})\b/gi;
  for (const line of region.split("\n")) {
    if (line.trim().length > 24) continue;
    glued.lastIndex = 0;
    let match;
    while ((match = glued.exec(line))) {
      const key = LETTER_ABILITY[match[1].toLowerCase()];
      if (!key || found[key]) continue;
      const parsed = rankToken(match[2]);
      if (!parsed) continue;
      found[key] = { id: parsed.id, number: numberFor(parsed.id, match[3]) };
    }
  }
  const missing = ABILITIES.filter((key) => !found[key]);
  if (missing.length !== 1) return found;
  for (const line of region.split("\n")) {
    const alone = /^\s*([A-Za-z0-9]{2,8})\s*\(\s*(\d{1,4})\s*\)\s*$/.exec(line.trim());
    if (!alone) continue;
    const parsed = rankToken(alone[1]);
    if (!parsed) continue;
    const number = numberFor(parsed.id, alone[2]);
    const duplicate = Object.values(found).some((row) => row.id === parsed.id && row.number === number);
    if (duplicate) continue;
    found[missing[0]] = { id: parsed.id, number };
    break;
  }
  return found;
}

function sliceEntry(text) {
  const lines = String(text || "").split("\n");
  const starts = [];
  lines.forEach((line, index) => {
    if (/^statistics\b/i.test(line.trim())) starts.push(index);
  });
  if (starts.length <= 1) return text;
  let best = starts[0];
  let bestScore = -1;
  for (let index = 0; index < starts.length; index++) {
    const start = starts[index];
    const end = starts[index + 1] ?? lines.length;
    const score = Object.keys(abilityFromLetters(lines.slice(start, end).join("\n"))).length;
    if (score > bestScore) {
      bestScore = score;
      best = start;
    }
  }
  const next = starts.find((start) => start > best);
  let chunk = lines.slice(Math.max(0, best - 2), next ?? lines.length).join("\n");
  if (!/known\s*powers/i.test(chunk)) {
    const after = lines.slice(next ?? lines.length).join("\n");
    const at = after.search(/known\s*powers/i);
    if (at >= 0) {
      const rest = after.slice(at);
      const stop = rest.search(/\n[^\n]{0,40}\n\s*statistics\b/i);
      chunk += `\n${stop > 0 ? rest.slice(0, stop) : rest.slice(0, 2200)}`;
    }
  }
  return chunk;
}

function nameAboveStatistics(text) {
  const lines = String(text || "").split("\n").map((line) => line.trim()).filter(Boolean);
  for (let index = 1; index < lines.length; index++) {
    if (!/^statistics\b/i.test(lines[index])) continue;
    const prev = lines[index - 1].replace(/\s+/g, " ");
    if (prev.length < 2 || prev.length > 40) continue;
    const letters = prev.replace(/[^A-Za-z]/g, "");
    if (letters.length < 2 || letters.length < prev.length * 0.6) continue;
    if (sectionHeader(prev) || IDENTITY_LINE.test(prev)) continue;
    if (!/[A-Za-z]/.test(prev)) continue;
    return prev;
  }
  return "";
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
    if (letters.length < 2 || letters.length < trimmed.length * 0.6) continue;
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
  const title = "([A-Za-z]+(?:[-\\s]+[A-Za-z]+){0,3})";
  const headed = new RegExp(`^${title}\\s*[:\\-–—]\\s*(.*)$`, "i").exec(trimmed);
  const alone = new RegExp(`^${title}\\s*$`, "i").exec(trimmed);
  const match = headed || alone;
  if (!match) return null;
  const key = SECTION_FOR[match[1].toLowerCase().replace(/\s+/g, " ")];
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
  if (section === "skip") return;
  const clean = line.replace(/\s+/g, " ").trim();
  if (!clean) return;
  if (section === "history" && IDENTITY_LINE.test(clean)) return;
  if (section === "weakness" || section === "history" || section === "notes") {
    buckets[section].push(clean);
    return;
  }
  if (section === "powers" || section === "talents" || section === "contacts") {
    buckets[section].push(clean);
    return;
  }
  for (const part of splitEntryLine(clean)) {
    const entry = entryFromLine(part);
    if (entry) buckets[section].push(entry);
  }
}

function madeItem(name, blob) {
  const parsed = parseRankChunk(blob || name);
  const clean = cleanName(name);
  if (!clean || clean.length < 2 || clean.length > 48) return null;
  if (clean.split(/\s+/).length > 6) return null;
  const id = parsed?.id || "typical";
  return { name: clean, rank: id, number: parsed?.number || rankValue(id) };
}

function titleFromLine(line) {
  const words = line.replace(/[:\-–—]+$/, "").trim().split(/\s+/).filter(Boolean);
  const title = [];
  for (const word of words) {
    const bare = word.replace(/[,.]$/, "");
    if (!/^[A-Z0-9]/.test(bare)) break;
    title.push(bare);
    if (title.length === 4) break;
  }
  if (!title.length || title.length > 4) return null;
  return { title: title.join(" "), rest: words.slice(title.length).join(" ") };
}

function parseNamedBlocks(lines) {
  const blocks = [];
  let title = "";
  let body = [];
  const flush = () => {
    const made = madeItem(title || body.join(" ").split(/[.:]/)[0], body.join(" ") || title);
    if (made && !blocks.some((row) => row.name.toLowerCase() === made.name.toLowerCase())) blocks.push(made);
    title = "";
    body = [];
  };
  for (const line of lines) {
    const trimmed = line.trim();
    const headed = /^([A-Za-z][^:]{1,42}):\s*(.*)$/.exec(trimmed);
    if (headed && !IDENTITY_LINE.test(`${headed[1]}:`) && !/^(health|karma|resources|popularity)$/i.test(headed[1])) {
      if (title || body.length) flush();
      title = headed[1];
      if (headed[2]) body.push(headed[2]);
      continue;
    }
    const titled = /^[A-Z]/.test(trimmed) ? titleFromLine(trimmed) : null;
    if (titled && titled.rest && /\b(?:feeble|poor|typical|good|excellent|remarkable|incredible|amazing|monstrous|unearthly|shift)\b/i.test(titled.rest)) {
      if (title || body.length) flush();
      title = titled.title;
      body.push(titled.rest);
      continue;
    }
    body.push(trimmed);
  }
  if (title || body.length) flush();
  return blocks;
}

function sectionSpan(text, start, end) {
  const source = String(text || "");
  const at = source.search(start);
  if (at < 0) return [];
  let rest = source.slice(at).split("\n").slice(1).join("\n");
  const stop = rest.search(end);
  if (stop >= 0) rest = rest.slice(0, stop);
  return rest.split("\n").map((line) => line.trim()).filter(Boolean);
}

function parseTalentBlocks(lines) {
  const text = lines.join(" ");
  const found = [];
  const re = /\b([A-Za-z]+(?:\s+(?!talents?\b)[A-Za-z]+){0,2})\s+talents?\b/gi;
  let match;
  while ((match = re.exec(text))) {
    const label = match[1].replace(/^(?:(?:the|a|an|has|and|of|for|with)\s+)+/i, "");
    const made = madeItem(label, label);
    if (made && !found.some((row) => row.name.toLowerCase() === made.name.toLowerCase())) found.push(made);
  }
  return found.length ? found : parseNamedBlocks(lines);
}

function parseContactBlocks(lines) {
  const lead = lines.join(" ").split(/\s+\b(?:is|are|was|were)\b/)[0];
  const named = lead.split(/[,;]/).map((part) => madeItem(part.split(/[.:]/)[0], part)).filter(Boolean);
  if (named.length) return named;
  return parseNamedBlocks(lines);
}

function dossier(text) {
  const map = {};
  const re = /^(real name|public identity|public name|secret identity|true name|occupation|legal status|identity|place of birth|marital status|known relatives|base of operations|past group affiliations|present group affiliation|group affiliation|former aliases|aliases|height|weight|hair|eyes|calling|origin(?: of power)?)\s*:\s*(.*)$/i;
  let key = "";
  for (const raw of String(text || "").split("\n")) {
    const line = raw.trim();
    const match = re.exec(line);
    if (match) {
      key = match[1].toLowerCase();
      map[key] = match[2].trim();
      continue;
    }
    if (key && /^[a-z(]/.test(line) && (map[key] || "").length < 180 && !sectionHeader(line)) {
      map[key] = `${map[key]} ${line}`.trim();
    } else if (line) key = "";
  }
  const take = (label) => String(map[label] || "").replace(/\s+/g, " ").trim().slice(0, 240);
  return {
    public: take("public identity") || take("public name"),
    secret: take("real name") || take("secret identity") || take("true name"),
    secretId: /secret|unknown/i.test(map.identity || ""),
    origin: take("origin") || take("origin of power"),
    occupation: take("occupation"),
    legalStatus: take("legal status"),
    placeOfBirth: take("place of birth"),
    maritalStatus: take("marital status"),
    knownRelatives: take("known relatives"),
    baseOfOperations: take("base of operations"),
    pastGroups: take("past group affiliations"),
    group: take("present group affiliation") || take("group affiliation"),
    aliases: take("former aliases") || take("aliases"),
    height: take("height"),
    weight: take("weight"),
    hair: take("hair"),
    eyes: take("eyes"),
    calling: take("calling")
  };
}

export function parseCharacterText(text, { filename = "", mechanicsOnly = false, fullSheet = false } = {}) {
  const source = sliceEntry(loosen(text));
  const labeled = abilityFromLabels(source);
  const letters = abilityFromLetters(source);
  const row = abilityFromRow(source);
  const lineRanks = abilityFromRankLine(source);
  const abilities = {};
  ABILITIES.forEach((key, index) => {
    const fromRow = row ? { id: row[index].id, number: row[index].number } : null;
    const fromLine = lineRanks ? { id: lineRanks[index].id, number: lineRanks[index].number } : null;
    abilities[key] = labeled[key] || letters[key] || fromRow || fromLine;
  });
  const found = ABILITIES.filter((key) => abilities[key]).length;
  const sections = readSections(source);
  const facts = dossier(source);
  const named = field(source, /\b(?:hero name|character name|name)\b\s*[:\-]\s*([^\n]+)/i);
  const fileName = mechanicsOnly || fullSheet ? "" : String(filename || "").replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim();
  const resources = parseRankChunk(field(source, /\bresources\b\s*[:\-]\s*([^\n]+)/i) || "");
  const popularityMatch = /\b(?:popularity|pop)\b\s*[:\-]\s*(-?\d+)/i.exec(source);
  const weakness = sections.weakness.join(" ");
  const keepStory = fullSheet || !mechanicsOnly;
  return {
    name: (nameAboveStatistics(source) || named || titleName(source) || fileName || "Imported Hero").slice(0, 80),
    abilities,
    found,
    resources: resources?.id || "",
    resourceNumber: resources?.number || 0,
    popularity: popularityMatch ? Number(popularityMatch[1]) : null,
    health: pool(source, "health"),
    karma: pool(source, "karma"),
    identity: facts,
    powers: parseNamedBlocks(sections.powers.length ? sections.powers : sectionSpan(source, /known\s*powers|^powers\s*:/im, /\n\s*(?:talents|contacts|role[\s-]*playing|statistics)\b/i)),
    talents: parseTalentBlocks(sections.talents.length ? sections.talents : sectionSpan(source, /\btalents\b/i, /\n\s*(?:contacts|role[\s-]*playing|known\s*powers|statistics)\b/i)),
    contacts: parseContactBlocks(sections.contacts.length ? sections.contacts : sectionSpan(source, /\bcontacts\b/i, /\n\s*(?:role[\s-]*playing|talents|known\s*powers|statistics)\b/i)),
    weapons: sections.weapons,
    equipment: sections.equipment,
    weakness: !keepStory && weakness.length > 90 ? "" : weakness.slice(0, 2000),
    history: keepStory ? sections.history.join(" ").slice(0, 4000) : "",
    notes: keepStory ? sections.notes.join(" ").slice(0, 2000) : ""
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
    hero.identity?.secret ? `Real name ${hero.identity.secret}` : "",
    hero.identity?.occupation ? `Occupation ${hero.identity.occupation}` : "",
    hero.health ? `Health ${hero.health.value}${hero.health.max !== hero.health.value ? ` / ${hero.health.max}` : ""}` : "",
    hero.karma ? `Karma ${hero.karma.value}${hero.karma.max !== hero.karma.value ? ` / ${hero.karma.max}` : ""}` : "",
    list("Powers", hero.powers),
    list("Talents", hero.talents),
    list("Contacts", hero.contacts),
    list("Weapons", hero.weapons)
  ].filter(Boolean).join("\n");
}

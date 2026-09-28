import { workflowOn } from "./workflow.mjs";

const COMIC_COLUMNS = new Set([
  "blunt", "edged", "shooting", "throwEdged", "throwBlunt",
  "energy", "force", "charging", "grappling", "grabbing"
]);

const WORDS = {
  blunt: { green: ["POW", "BAM", "SOCK", "BIFF"], yellow: ["WHAM", "BIFF", "THWACK"], red: ["KAPOW", "SMASH", "BLAMMO"] },
  edged: { green: ["SLASH", "SNIK", "CUT"], yellow: ["SLICE", "SHNK", "RIP"], red: ["CLEAVE", "REND", "SHUNK"] },
  shooting: { green: ["BANG", "POP", "PAF"], yellow: ["BLAM", "KRAK", "BANG"], red: ["KABLAM", "BOOM", "BLAMMO"] },
  throwEdged: { green: ["ZING", "THWIK", "SWISH"], yellow: ["THWIP", "THOK", "SHUNK"], red: ["THOCK", "SPLAT", "SHUNK"] },
  throwBlunt: { green: ["BONK", "WHUMP", "PLOP"], yellow: ["THUD", "WHAM", "CLOP"], red: ["CRASH", "WHAMMO", "KRUNCH"] },
  energy: { green: ["ZAP", "ZOT", "BZT"], yellow: ["BZAP", "ZORCH", "ZOT"], red: ["ZAAAP", "KRAKOW", "BZOW"] },
  force: { green: ["THOOM", "POOM", "WHUMP"], yellow: ["KRAK", "THOOM", "WHAM"], red: ["KABOOM", "KRAKKA", "THOOOM"] },
  charging: { green: ["SLAM", "WHAM", "BAM"], yellow: ["CRASH", "BASH", "WHAM"], red: ["SMASH", "KAPOW", "CRAAASH"] },
  grappling: { yellow: ["GRAB", "LOCK", "OOF"], red: ["PINNED", "CRUSH", "GOTCHA"] },
  grabbing: { green: ["YOINK", "SNATCH", "GRAB"], yellow: ["GRAB", "GOTCHA", "YOINK"], red: ["SNAP", "CRUSH", "YANK"] }
};

const KILL_WORD = {
  blunt: "KAPOW",
  edged: "SHUNK",
  shooting: "KABLAM",
  throwEdged: "THOCK",
  throwBlunt: "CRASH",
  energy: "ZAAAP",
  force: "KABOOM",
  charging: "SMASH"
};

const EFFECT_WORD = {
  "Partial Hold": "HOLD",
  Hold: "PINNED",
  Take: "YOINK",
  Grab: "GRAB",
  Break: "SNAP"
};

const PALETTES = {
  blunt: { fill: "#ffe14a", fill2: "#ff3b30", ink: "#141414", word: "#ff2a2a" },
  edged: { fill: "#f7f7f2", fill2: "#ff3b30", ink: "#141414", word: "#ff2a2a" },
  shooting: { fill: "#ff9f1c", fill2: "#ffe14a", ink: "#141414", word: "#fffdf6" },
  throwEdged: { fill: "#ffe14a", fill2: "#f7f7f2", ink: "#141414", word: "#ff2a2a" },
  throwBlunt: { fill: "#ffd166", fill2: "#ef476f", ink: "#141414", word: "#fffdf6" },
  energy: { fill: "#4cc9f0", fill2: "#ffe14a", ink: "#071b3a", word: "#fffdf6" },
  force: { fill: "#c77dff", fill2: "#ffe14a", ink: "#1a1030", word: "#fffdf6" },
  charging: { fill: "#ff6b35", fill2: "#ffe14a", ink: "#141414", word: "#fffdf6" },
  grappling: { fill: "#8ecae6", fill2: "#ffe14a", ink: "#141414", word: "#073b8a" },
  grabbing: { fill: "#ffd166", fill2: "#fb8500", ink: "#141414", word: "#fffdf6" }
};

function rngFrom(seed) {
  let a = Number(seed) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function starPath(rng, spikes, outer, inner) {
  let d = "";
  const count = spikes * 2;
  for (let i = 0; i < count; i++) {
    const ang = (Math.PI * i) / spikes - Math.PI / 2;
    const rad = (i % 2 === 0 ? outer : inner) * (0.86 + rng() * 0.28);
    const x = Math.cos(ang) * rad;
    const y = Math.sin(ang) * rad * 0.92;
    d += `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }
  return `${d}Z`;
}

export function buildComic({ columnId = "", color = "", effect = "", taken = null, targetUuid = "", seed } = {}) {
  const column = COMIC_COLUMNS.has(columnId) ? columnId : "";
  const text = String(effect || "");
  const miss = !text || /miss/i.test(text);
  const hit = !!(column && !miss && color && color !== "white");
  const loss = taken == null || taken === "" ? null : Math.max(0, Math.round(Number(taken) || 0));
  if (!hit && !(loss > 0)) return null;

  const rngSeed = Number.isFinite(Number(seed)) ? Number(seed) : Math.floor(Math.random() * 1e9);
  const palette = PALETTES[column] || PALETTES.blunt;
  let word = "POW";
  let intensity = 1.2;
  if (hit) {
    if (text === "Slam") word = "SLAM";
    else if (text === "Stun") word = "STUN";
    else if (text === "Kill") word = KILL_WORD[column] || "KAPOW";
    else if (text === "Bullseye") word = "ZOWIE";
    else if (EFFECT_WORD[text]) word = EFFECT_WORD[text];
    else {
      const list = WORDS[column]?.[color] || WORDS[column]?.yellow || WORDS.blunt.green;
      word = list[rngSeed % list.length];
    }
    if (text === "Kill") intensity = 2.6;
    else if (text === "Stun" || text === "Slam") intensity = 2.15;
    else if (color === "red") intensity = 2;
    else if (color === "yellow") intensity = 1.55;
    else intensity = 1.15;
  }

  return {
    word,
    fill: palette.fill,
    fill2: palette.fill2,
    ink: palette.ink,
    wordColor: palette.word,
    intensity,
    heavy: intensity >= 2,
    targetUuid: targetUuid || "",
    taken: loss,
    seed: rngSeed
  };
}

function tokenForUuid(uuid) {
  if (!uuid) return null;
  const tokens = globalThis.canvas?.tokens?.placeables ?? [];
  const matches = tokens.filter((token) => token.actor?.uuid === uuid);
  return matches.find((token) => token.isTargeted || token.targeted) || matches[0] || null;
}

function clientPoint(token) {
  const center = token.center || { x: token.x + (token.w || 0) / 2, y: token.y + (token.h || 0) / 2 };
  const canvas = globalThis.canvas;
  if (typeof canvas?.clientCoordinatesFromCanvas === "function") {
    return canvas.clientCoordinatesFromCanvas(center);
  }
  const rect = canvas?.app?.canvas?.getBoundingClientRect?.() || { left: 0, top: 0 };
  const m = canvas?.stage?.worldTransform;
  if (!m) return { x: rect.left, y: rect.top };
  return {
    x: rect.left + m.a * center.x + m.c * center.y + m.tx,
    y: rect.top + m.b * center.x + m.d * center.y + m.ty
  };
}

function renderComic(comic) {
  const token = tokenForUuid(comic.targetUuid);
  if (!token || !globalThis.document?.body) return;
  const rng = rngFrom(comic.seed);
  const spikes = comic.intensity >= 2.4 ? 18 : comic.intensity >= 1.7 ? 14 : 10;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "-150 -140 300 280");
  svg.setAttribute("aria-hidden", "true");
  const ink = document.createElementNS("http://www.w3.org/2000/svg", "path");
  ink.setAttribute("d", starPath(rng, spikes, 132, 78));
  ink.setAttribute("fill", comic.ink);
  const fill = document.createElementNS("http://www.w3.org/2000/svg", "path");
  fill.setAttribute("d", starPath(rng, spikes, 118, 68));
  fill.setAttribute("fill", comic.fill);
  const core = document.createElementNS("http://www.w3.org/2000/svg", "path");
  core.setAttribute("d", starPath(rng, Math.max(8, spikes - 4), 72, 40));
  core.setAttribute("fill", comic.fill2);
  svg.append(ink, fill, core);
  for (let i = 0; i < 6; i++) {
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    const ang = rng() * Math.PI * 2;
    const rad = 108 + rng() * 24;
    dot.setAttribute("cx", (Math.cos(ang) * rad).toFixed(1));
    dot.setAttribute("cy", (Math.sin(ang) * rad).toFixed(1));
    dot.setAttribute("r", (2.2 + rng() * 2.4).toFixed(1));
    dot.setAttribute("fill", comic.ink);
    svg.append(dot);
  }

  const root = document.createElement("div");
  root.className = `faserip-comic${comic.heavy ? " is-heavy" : ""}`;
  const pop = document.createElement("div");
  pop.className = "faserip-comic-pop";
  pop.append(svg);
  const word = document.createElement("div");
  word.className = "faserip-comic-word";
  word.style.color = comic.wordColor;
  word.textContent = `${comic.word}!`;
  pop.append(word);
  root.append(pop);

  if (comic.taken != null) {
    const loss = document.createElement("div");
    loss.className = "faserip-comic-loss";
    loss.textContent = comic.taken > 0 ? `−${comic.taken}` : "BLOCKED";
    if (comic.taken <= 0) loss.classList.add("is-blocked");
    root.append(loss);
  }

  document.body.append(root);
  const started = performance.now();
  const duration = comic.heavy ? 1350 : 1100;
  const offsetX = ((comic.seed % 17) - 8) * 3;
  const offsetY = (((comic.seed >> 4) % 13) - 6) * 3;

  const frame = (now) => {
    const live = tokenForUuid(comic.targetUuid) || token;
    const point = clientPoint(live);
    const zoom = globalThis.canvas?.stage?.scale?.x || 1;
    const tokenScreen = (live.w || live.width || 100) * zoom;
    const size = Math.round(Math.max(150, Math.min(480, tokenScreen * (0.85 + comic.intensity * 0.5))));
    root.style.left = `${point.x + offsetX}px`;
    root.style.top = `${point.y + offsetY}px`;
    root.style.width = `${size}px`;
    const long = comic.word.length > 7 ? 0.18 : comic.word.length > 5 ? 0.22 : 0.28;
    word.style.fontSize = `${Math.round(size * long)}px`;
    const loss = root.querySelector(".faserip-comic-loss");
    if (loss) loss.style.fontSize = `${Math.round(size * (comic.taken > 0 ? 0.3 : 0.18))}px`;
    if (now - started < duration) requestAnimationFrame(frame);
    else root.remove();
  };
  requestAnimationFrame(frame);
}

export function playComicHit(spec) {
  if (!workflowOn("comicHits")) return null;
  const comic = buildComic(spec);
  if (!comic) return null;
  renderComic(comic);
  try {
    globalThis.game?.socket?.emit("system.faserip", { system: "comic", action: "hit", comic });
  } catch {
    /* local burst still played */
  }
  return comic;
}

export function registerComicSocket() {
  const game = globalThis.game;
  if (!game?.socket || game.faserip?._comicSocket) return;
  game.faserip = game.faserip || {};
  game.faserip._comicSocket = true;
  game.socket.on("system.faserip", (data) => {
    if (data?.system !== "comic" || data.action !== "hit" || !data.comic) return;
    try { renderComic(data.comic); } catch (err) {
      console.warn("FASERIP | comic hit", err);
    }
  });
}

import { workflowOn } from "./workflow.mjs";

/**
 * JB2A database paths. Sequencer picks a color and distance variant under each path.
 * Melee, ranged, and ray stretch from the attacker to the target. Burst and self play on one token.
 */
const RULES = [
  [/flamethrower|fire jet|flame jet/, { file: "jb2a.fire_jet", mode: "ray" }],
  [/grenade|bazooka|missile launcher|artillery|\blaw\b|\bbomb\b|detonation|explosive power/, { file: "jb2a.fireball.beam.orange", impact: "jb2a.fireball.explosion.orange", mode: "ranged" }],
  [/laser|photon|plasma/, { file: "jb2a.energy_beam", mode: "ray" }],
  [/shotgun|handgun|pistol|rifle|machine gun|sub-machine|cannon|gyro-jet|artillery/, { file: "jb2a.bullet", mode: "ranged", muzzle: true }],
  [/bow|crossbow|arrow/, { file: "jb2a.arrow", mode: "ranged" }],
  [/shuriken|kunai/, { file: "jb2a.shuriken", mode: "ranged" }],
  [/boomerang/, { file: "jb2a.boomerang", mode: "ranged" }],
  [/javelin/, { file: "jb2a.javelin", mode: "ranged" }],
  [/bola|net\b|web/, { file: "jb2a.web", mode: "burst" }],
  [/throwing axe|hatchet|handaxe|hand axe/, { file: "jb2a.handaxe.melee", mode: "melee" }],
  [/throwing knife|dagger|knife|switchblade/, { file: "jb2a.dagger.melee", mode: "melee" }],
  [/great sword|greatsword|broadsword/, { file: "jb2a.greatsword.melee", mode: "melee" }],
  [/rapier/, { file: "jb2a.rapier.melee", mode: "melee" }],
  [/scimitar/, { file: "jb2a.scimitar.melee", mode: "melee" }],
  [/short sword|shortsword|\bsword\b|\bblade\b/, { file: "jb2a.sword.melee", mode: "melee" }],
  [/glaive/, { file: "jb2a.glaive.melee", mode: "melee" }],
  [/halberd|pike/, { file: "jb2a.halberd.melee", mode: "melee" }],
  [/battle axe|greataxe|great axe|\baxe\b/, { file: "jb2a.greataxe.melee", mode: "melee" }],
  [/sledge|maul/, { file: "jb2a.maul.melee", mode: "melee" }],
  [/war hammer|warhammer/, { file: "jb2a.warhammer.melee", mode: "melee" }],
  [/quarterstaff|bo stick|\bstaff\b/, { file: "jb2a.quarterstaff.melee", mode: "melee" }],
  [/greatclub|nightstick|baseball|club\b/, { file: "jb2a.club.melee", mode: "melee" }],
  [/\bmace\b|\bhammer\b/, { file: "jb2a.mace.melee", mode: "melee" }],
  [/\bspear\b/, { file: "jb2a.spear.melee", mode: "melee" }],
  [/brass knuckle|cestus|slugfest|unarmed|punch|atemi|dimak/, { file: "jb2a.unarmed_strike", mode: "melee" }],
  [/whip|chain\b/, { file: "jb2a.melee_generic", mode: "melee" }],
  [/claw|quill|razor|fang|bite/, { file: "jb2a.claws", mode: "burst" }],
  [/fire|flame|heat|burn|incendiary/, { file: "jb2a.fire_bolt", impact: "jb2a.explosion.01.orange", mode: "ranged" }],
  [/cold|ice|frost/, { file: "jb2a.ray_of_frost", mode: "ranged" }],
  [/lightning|electric|electro|thunder(?!wave)/, { file: "jb2a.lightning_bolt.narrow.blue", mode: "ray" }],
  [/sonic|sound wave|thunderwave/, { file: "jb2a.thunderwave", mode: "burst" }],
  [/radiation|nuclear|microwave|plasma|cosmic energy|hard radiation|energy emission|energy beam/, { file: "jb2a.energy_beam", mode: "ray" }],
  [/poison|toxin|acid|corros/, { file: "jb2a.liquid", mode: "burst" }],
  [/telekin|magic missile|psionic attack|mind blast/, { file: "jb2a.magic_missile", mode: "ranged" }],
  [/mind|psi|psion|mental|fear|emotion|sleep|illusion|hypno/, { file: "jb2a.dizzy_stars", mode: "burst" }],
  [/heal|regenerat|cure|recovery/, { file: "jb2a.healing_generic", mode: "self" }],
  [/teleport|dimension|gateway|blink|displace/, { file: "jb2a.teleport", mode: "self" }],
  [/shield bash|riot shield/, { file: "jb2a.shield_attack", mode: "melee" }],
  [/shield|armor|bubble|invulner|null-field|aura field|force field/, { file: "jb2a.shield", mode: "self" }],
  [/darkness|darkforce|shadow/, { file: "jb2a.darkness", mode: "self" }],
  [/earth|stone|rock|seismic/, { file: "jb2a.boulder", mode: "ranged" }],
  [/water|hydro|aqua/, { file: "jb2a.water_splash", mode: "burst" }],
  [/wind|weather|air control|gust/, { file: "jb2a.gust_of_wind", mode: "ray" }],
  [/plant|vine|entangle/, { file: "jb2a.entangle", mode: "burst" }],
  [/sense|vision|detect|awareness|radar|sonar/, { file: "jb2a.detect_magic", mode: "self" }],
  [/flight|\bfly\b|levitat|glide/, { file: "jb2a.wind_stream", mode: "self" }],
  [/magic|spell|sorcer|mystic/, { file: "jb2a.magic_missile", mode: "ranged" }]
];

const COLUMN = {
  blunt: { file: "jb2a.unarmed_strike", mode: "melee" },
  edged: { file: "jb2a.sword.melee", mode: "melee" },
  shooting: { file: "jb2a.bullet", mode: "ranged", muzzle: true },
  throwEdged: { file: "jb2a.dagger.melee", mode: "melee" },
  throwBlunt: { file: "jb2a.boomerang", mode: "ranged" },
  energy: { file: "jb2a.energy_beam", mode: "ray" },
  force: { file: "jb2a.magic_missile", mode: "ranged" },
  charging: { file: "jb2a.unarmed_strike", mode: "melee" },
  grappling: { file: "jb2a.web", mode: "burst" },
  grabbing: { file: "jb2a.unarmed_strike", mode: "melee" }
};

const POWER_CAST = { file: "jb2a.cast_generic", mode: "self" };
const ENERGY_BEAM = { file: "jb2a.energy_beam", mode: "ray" };

function isEnergyWeapon(item, columnId, blob) {
  if (/flamethrower|flame jet|incendiary|sonic/.test(blob)) return false;
  if (/laser|photon|plasma/.test(blob)) return true;
  if (item?.type === "weapon" && /energy/i.test(item.system?.weaponType || "")) return true;
  return item?.type === "weapon" && columnId === "energy" && /pistol|rifle|cannon|gun|beam/.test(blob);
}

function librariesOn() {
  const modules = globalThis.game?.modules;
  if (!modules?.get("sequencer")?.active) return false;
  return !!(modules.get("jb2a_patreon")?.active || modules.get("JB2A_DnD5e")?.active);
}

function tokenOf(actor) {
  if (!actor) return null;
  const active = actor.getActiveTokens?.() ?? [];
  const controlled = active.find((token) => token.controlled) || active[0];
  if (controlled) return controlled;
  return globalThis.canvas?.tokens?.placeables?.find((token) => token.actor === actor) ?? null;
}

export function specFor({ item, columnId, label }) {
  const blob = `${item?.name || ""} ${item?.system?.weaponType || ""} ${label || ""}`.toLowerCase();
  if (isEnergyWeapon(item, columnId, blob)) return ENERGY_BEAM;
  const attack = !!(columnId && COLUMN[columnId]);
  for (const [re, spec] of RULES) {
    if (!re.test(blob)) continue;
    if (attack && spec.mode === "self") continue;
    if (columnId === "force" && spec.muzzle) continue;
    return spec;
  }
  if (attack) return COLUMN[columnId];
  if (item?.type === "power" || item?.type === "weapon") return POWER_CAST;
  return null;
}

function place(effect, spec, source, target, color) {
  const where = spec.mode === "self" ? source : (target || source);
  effect.atLocation(spec.mode === "burst" || spec.mode === "self" ? where : source);
  if ((spec.mode === "melee" || spec.mode === "ranged" || spec.mode === "ray") && target) {
    effect.stretchTo(target);
  }
  if (color === "white") effect.opacity(0.45);
  if (color === "red") effect.scale(1.15);
  return effect;
}

const AA_MENUS = ["melee", "range", "ontoken", "templatefx", "aura", "preset"];

function rinseAa(name) {
  return String(name || "").replace(/\s+/g, "").toLowerCase();
}

function menuRecognizes(name) {
  const rinsed = rinseAa(name);
  if (!rinsed) return false;
  const settings = globalThis.game?.settings;
  if (!settings) return false;
  for (const menu of AA_MENUS) {
    let entries = [];
    try { entries = settings.get("autoanimations", `aaAutorec-${menu}`) || []; } catch { continue; }
    for (const entry of entries) {
      const label = rinseAa(entry?.label);
      if (label && rinsed.includes(label)) return true;
    }
  }
  return false;
}

function autoRecognitionPlays({ item, label, source, dest }) {
  const play = globalThis.AutomatedAnimations?.playAnimation;
  if (typeof play !== "function" || !source) return false;
  try {
    if (globalThis.game?.settings?.get("autoanimations", "disableAutoRec")) return false;
  } catch {
    return false;
  }
  const name = item?.name || label || "";
  const flags = item?.flags?.autoanimations;
  if (!flags?.isCustomized && !flags?.killAnim && !menuRecognizes(name)) return false;
  const standIn = item?.name ? item : { name, type: "weapon" };
  try {
    Promise.resolve(play(source, standIn, { targets: dest ? [dest] : [] })).catch((err) => {
      console.warn("FASERIP | Automated Animations", err);
    });
  } catch (err) {
    console.warn("FASERIP | Automated Animations", err);
    return false;
  }
  return true;
}

export function playFeatVfx({ actor, target, item, columnId = "", color = "", label = "" } = {}) {
  if (!workflowOn("jb2aVfx")) return;
  const spec = specFor({ item, columnId, label });
  if (!spec) return;
  const source = tokenOf(actor);
  const dest = tokenOf(target);
  if (!source) return;
  if ((spec.mode === "melee" || spec.mode === "ranged" || spec.mode === "ray") && !dest) return;
  if (autoRecognitionPlays({ item, label, source, dest })) return;
  if (!librariesOn()) return;
  const Sequence = globalThis.Sequence;
  if (typeof Sequence !== "function") return;
  try {
    const seq = new Sequence();
    if (spec.muzzle && dest) {
      seq.effect().file("jb2a.muzzle_flash").atLocation(source).stretchTo(dest).scale(0.35);
    }
    place(seq.effect().file(spec.file), spec, source, dest, color);
    const landed = color && color !== "white";
    if (landed && dest && spec.impact) {
      seq.effect().file(spec.impact).atLocation(dest);
    } else if (landed && dest && (spec.mode === "melee" || spec.mode === "ranged" || spec.mode === "ray")) {
      seq.effect().file("jb2a.impact").atLocation(dest).scale(0.45);
    }
    seq.play();
  } catch (err) {
    console.warn("FASERIP | jb2a", err);
  }
}

const WALL_FILES = {
  earth: [
    "jb2a.falling_rocks.endframe.side.2x1.sandstone",
    "jb2a.falling_rocks.endframe.side.2x1.grey",
    "modules/jb2a_patreon/Library/Generic/Traps/Falling_Rocks/FallingRocks01Side_01_Regular_Sandstone_10x05ft_Endframe.webp",
    "jb2a.wall_of_force.vertical.grey"
  ],
  air: [
    "jb2a.gust_of_wind.veryfast",
    "jb2a.gust_of_wind",
    "jb2a.wall_of_force.horizontal.blue"
  ],
  force: [
    "jb2a.wall_of_force.horizontal.blue",
    "jb2a.wall_of_force.horizontal.purple",
    "jb2a.energy_beam"
  ]
};

const SHIELD_FILES = [
  "jb2a.shield.01.loop.blue",
  "jb2a.shield.01.complete.blue",
  "jb2a.shield",
  "jb2a.energy_field.circle.blue"
];

function sequencerFile(candidates) {
  const db = globalThis.Sequencer?.Database;
  const modules = globalThis.game?.modules;
  return candidates.find((file) => {
    if (String(file).startsWith("modules/jb2a_patreon/") && modules?.get?.("jb2a_patreon")?.active) return true;
    if (typeof db?.entryExists !== "function") return false;
    try { return db.entryExists(file); } catch { return false; }
  }) || "";
}

function effectId() {
  return globalThis.foundry?.utils?.randomID?.() || Math.random().toString(36).slice(2);
}

export async function endSequencerNames(names = [], { prefix = false } = {}) {
  const manager = globalThis.Sequencer?.EffectManager;
  if (!manager) return;
  const list = (names || []).filter((entry) => typeof entry === "string" && entry);
  if (!list.length) return;
  const effects = typeof manager.effects?.[Symbol.iterator] === "function" ? [...manager.effects] : [];
  const matched = [];
  for (const effect of effects) {
    const name = String(effect?.data?.name || "");
    const hit = list.some((wanted) => prefix ? name.startsWith(wanted) : (name === wanted || name.startsWith(`${wanted}-`)));
    if (hit) matched.push(effect);
  }
  for (const effect of matched) {
    try { await effect.endEffect?.(); } catch (err) {
      console.warn("FASERIP | sequencer", err);
    }
  }
  if (typeof manager.endEffects !== "function") return;
  if (!prefix) {
    for (const name of list) {
      try { await manager.endEffects({ name }); } catch (err) {
        console.warn("FASERIP | sequencer", err);
      }
    }
  }
  const ids = matched.map((effect) => effect.id).filter(Boolean);
  if (ids.length) {
    try { await manager.endEffects({ effects: ids }); } catch (err) {
      console.warn("FASERIP | sequencer", err);
    }
  }
}

function rockPoints(start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dist = Math.hypot(dx, dy) || 1;
  const grid = Number(globalThis.canvas?.grid?.size) || 100;
  const step = Math.max(grid, grid * 1.35);
  const count = Math.max(1, Math.ceil(dist / step));
  const points = [];
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    points.push({ x: start.x + dx * t, y: start.y + dy * t });
  }
  return { points, angle: Math.atan2(dy, dx) * (180 / Math.PI), grid };
}

export async function playWallArt(start, end, kind = "force") {
  if (!librariesOn() || !start || !end) return "";
  const Sequence = globalThis.Sequence;
  if (typeof Sequence !== "function") return "";
  const file = sequencerFile(WALL_FILES[kind] || WALL_FILES.force);
  if (!file) return "";
  const name = `faserip-wall-${kind}-${effectId()}`;
  const rocks = kind === "earth" && /falling_rocks|FallingRocks/i.test(file);
  try {
    const seq = new Sequence();
    if (rocks) {
      const { points, angle, grid } = rockPoints(start, end);
      const scale = Math.max(0.3, (grid * 1.15) / 250);
      points.forEach((point, index) => {
        seq.effect().file(file).atLocation(point).rotate(angle).scale(scale).persist(true).name(`${name}-${index}`);
      });
    } else {
      const effect = seq.effect().file(file).atLocation(start).stretchTo(end).scale(0.45).persist(true).name(name);
      if (kind === "air") effect.opacity(0.55);
      if (kind === "earth" && typeof effect.tint === "function") effect.tint("#a16207");
    }
    await seq.play();
    return name;
  } catch (err) {
    console.warn("FASERIP | wall art", err);
    return "";
  }
}

export async function playShieldArt(actor, active) {
  const prefix = `faserip-shield-${actor?.id || "hero"}`;
  await endSequencerNames([prefix], { prefix: true });
  if (!active || !librariesOn()) return;
  const Sequence = globalThis.Sequence;
  if (typeof Sequence !== "function") return;
  const file = sequencerFile(SHIELD_FILES);
  if (!file) return;
  const tokens = actor?.getActiveTokens?.() ?? [];
  if (!tokens.length) return;
  try {
    const seq = new Sequence();
    tokens.forEach((token, index) => {
      seq.effect().file(file).attachTo(token).scaleToObject(1.5).persist(true).fadeIn(200).name(`${prefix}-${index}`);
    });
    await seq.play();
  } catch (err) {
    console.warn("FASERIP | shield art", err);
  }
}

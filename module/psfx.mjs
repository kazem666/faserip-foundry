const ATTACKS = new Set([
  "blunt", "edged", "shooting", "throwEdged", "throwBlunt",
  "energy", "force", "charging", "grappling", "grabbing"
]);

const IMPACT = {
  edged: "psfx.impacts.slashing.v1",
  throwEdged: "psfx.impacts.slashing.v1",
  blunt: "psfx.impacts.bludgeoning.v1",
  throwBlunt: "psfx.impacts.bludgeoning.v1",
  charging: "psfx.impacts.bludgeoning.v1",
  grappling: "psfx.impacts.bludgeoning.v1",
  grabbing: "psfx.impacts.bludgeoning.v1"
};

function psfxOn() {
  const modules = globalThis.game?.modules;
  if (!modules?.get?.("sequencer")?.active) return false;
  return !!(modules.get("psfx-patreon")?.active || modules.get("psfx")?.active);
}

function exists(path) {
  try { return !!globalThis.Sequencer?.Database?.entryExists?.(path); } catch { return false; }
}

function first(paths) {
  return paths.find((path) => path && exists(path)) || "";
}

function tokenFor(uuid) {
  if (!uuid) return null;
  const tokens = globalThis.canvas?.tokens?.placeables ?? [];
  return tokens.find((token) => token.actor?.uuid === uuid) || null;
}

function elementImpact(name) {
  if (/fire|flame|heat|burn|plasma/.test(name)) return ["psfx.impacts.magicaleffects.fire"];
  if (/cold|ice|frost/.test(name)) return ["psfx.impacts.magicaleffects.cold"];
  if (/lightning|electric|shock|volt/.test(name)) return ["psfx.impacts.magicaleffects.lightning"];
  if (/mind|psychic|mental|psionic/.test(name)) return ["psfx.impacts.magicaleffects.psychic"];
  if (/acid|poison|rot|necro|decay/.test(name)) return ["psfx.impacts.magicaleffects.necrotic"];
  return [];
}

function elementSwoosh(name) {
  if (/fire|flame|heat|burn|plasma/.test(name)) return ["psfx.weapon-swooshes.fire", "psfx.weapon-swooshes.fire.v1.group01"];
  if (/cold|ice|frost/.test(name)) return ["psfx.weapon-swooshes.cold", "psfx.weapon-swooshes.cold.v1.group01"];
  if (/lightning|electric|shock|volt/.test(name)) return ["psfx.weapon-swooshes.lightning", "psfx.weapon-swooshes.lightning.v1.group01"];
  return [];
}

function gun(name) {
  if (/shotgun/.test(name)) return ["psfx.ranged-weapons.guns.single-fire.shotgun"];
  if (/rifle/.test(name)) return ["psfx.ranged-weapons.guns.single-fire.rifle", "psfx.ranged-weapons.guns.single-fire.musket"];
  if (/musket/.test(name)) return ["psfx.ranged-weapons.guns.single-fire.musket"];
  if (/bow|arrow/.test(name)) return ["psfx.ranged-weapons.longbow.v1.30ft", "psfx.ranged-weapons.longbow.v1.15ft"];
  if (/laser|blaster|plasma|photon/.test(name)) {
    return ["psfx.ranged-weapons.guns.energy-blaster", "psfx.ranged-weapons.guns.single-fire.energy-blaster"];
  }
  return ["psfx.ranged-weapons.guns.single-fire.revolver"];
}

function beam() {
  return ["psfx.ranged-magic.generic.beam.001", "psfx.ranged-magic.generic.beam.002", "psfx.ranged-magic.generic.projectile.001"];
}

function choose(spec) {
  const name = String(spec.itemName || spec.label || "").toLowerCase();
  const column = spec.columnId || "";
  const miss = spec.color === "white" || /miss/i.test(spec.effect || "");
  const heavy = spec.color === "red" || /kill|stun|slam/i.test(spec.effect || "");
  const swoosh = first([
    ...elementSwoosh(name),
    heavy ? "psfx.weapon-swooshes.heavy.v1.group01" : "psfx.weapon-swooshes.light.v1.group01"
  ]);
  const melee = column === "blunt" || column === "edged" || column === "throwBlunt" || column === "throwEdged" || column === "charging";
  if (melee) {
    return {
      wind: swoosh,
      hit: miss ? "" : first([elementImpact(name)[0], IMPACT[column]])
    };
  }
  if (column === "grappling" || column === "grabbing") {
    return { wind: "", hit: miss ? "" : first([IMPACT[column]]) };
  }
  if (column === "shooting") {
    return { wind: first(gun(name)), hit: "" };
  }
  if (column === "energy" || column === "force" || spec.magic) {
    const hit = first([...elementImpact(name), ...beam()]);
    return { wind: miss ? first(beam()) : "", hit: miss ? "" : hit };
  }
  return { wind: "", hit: "" };
}

function addSound(seq, file, volume, token) {
  const section = seq.sound().file(file).volume(volume);
  if (token && typeof section.atLocation === "function") section.atLocation(token);
}

export function playAttackSound(spec = {}) {
  if (!psfxOn() || typeof globalThis.Sequence !== "function") return;
  const column = spec.columnId || "";
  if (column && !ATTACKS.has(column) && !spec.magic) return;
  const picked = choose(spec);
  if (!picked.wind && !picked.hit) return;
  const token = tokenFor(spec.targetUuid);
  try {
    const seq = new globalThis.Sequence();
    if (picked.wind) addSound(seq, picked.wind, spec.color === "white" ? 0.38 : 0.45, token);
    if (picked.hit) addSound(seq, picked.hit, spec.color === "red" ? 0.72 : 0.58, token);
    seq.play().catch((err) => console.warn("FASERIP | psfx", err));
  } catch (err) {
    console.warn("FASERIP | psfx", err);
  }
}

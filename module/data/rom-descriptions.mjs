/** Original play-aid blurbs for MHAC-9 catalogs. Not reprinted accessory text. */

const ENERGY_HINT = {
  personal: "Personal-energy working. It mostly changes the caster or a willing subject.",
  universal: "Universal-energy working. It uses the caster as a focus to change the outside world.",
  dimensional: "Dimensional working. It borrows from a neighboring source and finishes at the end of the round."
};

export const ROM_DEFINITIONS = {
  "absorption": "Soak incoming force or energy at this rank. What is soaked can be held briefly or dumped.",
  "armor": "Wear a mystic shell as Body Armor at this rank while the working lasts.",
  "alteration - appearance": "Shift face, build, and clothing look. Close inspection may pierce it with Intuition.",
  "healing": "Restore Health. A Red result can close a grave wound. Not true resurrection.",
  "healing - self": "Restore Health. A Red result can close a grave wound. Not true resurrection.",
  "invisibility": "Hide from sight. Other senses and detection workings still apply.",
  "invisibility - self": "Hide from sight. Other senses and detection workings still apply.",
  "levitation": "Rise and hover. Slower and less agile than Flight.",
  "eldritch beam": "Ranged mystic bolt. Damage and range follow the Magical Limits table at this rank.",
  "eldritch beams": "Ranged mystic bolt. Damage and range follow the Magical Limits table at this rank.",
  "matter animation": "Make an object act. Complexity and Strength of the motion are this rank.",
  "animation": "Make an object act. Complexity is this rank.",
  "shield": "A personal ward. Treat as Body Armor / Force Field at this rank while maintained.",
  "shield - individual": "A personal ward. Treat as Body Armor / Force Field at this rank.",
  "teleport": "Instant change of area. Line of sight or a known place. Misses scatter.",
  "teleportation": "Instant change of area. Counts as two Universal slots; one Dimensional slot.",
  "illusion": "False scene. Observers resist with Intuition.",
  "bind": "Bind a target in mystic rings. Strength or a counter-working breaks them.",
  "bands": "Bind a target in mystic rings. Strength or a counter-working breaks them.",
  "dimensional aperture": "Open a hole to a listed neighboring realm. Closing it is a FEAT.",
  "dimensional gate": "A lasting door between two listed places or realms. Holding it open is a FEAT.",
  "banishment": "Force a summoned or extra-dimensional being back where it came from. Psyche contest.",
  "entreaty": "Borrow a listed source's power for one round. Dimensional; the source notices."
};

export const ROM_TALENT_DEFINITIONS = {
  "demonologist": { definition: "Knows how hostile otherworld predators behave. Research, ID, talk, and fights involving them.", bonus: "+1 CS", attribute: "reason" },
  "occultist": { definition: "Hauntings, unmarked sites, and quiet wrongness. Field lore more than library lore.", bonus: "+2 CS", attribute: "intuition" },
  "runesmith": { definition: "Cuts, reads, and repairs old letter-magic on objects.", bonus: "+2 CS", attribute: "reason" },
  "bibliophile": { definition: "Knows magical books, scrolls, and where their traps hide.", bonus: "+2 CS", attribute: "reason" },
  "theogonist": { definition: "Studies extra-dimensional sources people entreat, and the politics between them.", bonus: "+2 CS", attribute: "reason" },
  "chronicler of magic": { definition: "Tracks schools, masters, and who owes whom.", bonus: "+2 CS", attribute: "reason" }
};

export const ROM_SCHOOL_DEFINITIONS = {};

export function describeRomSpell(name, extra = {}) {
  const key = String(name || "").replace(/\s*\([^)]*\)/g, "").replace(/[\u2014\u2013]/g, "-").replace(/\s+/g, " ").trim().toLowerCase();
  const energy = String(extra.energy || extra.category || "").toLowerCase().replace(/^rom\s+/i, "");
  const hint = ENERGY_HINT[energy] || ENERGY_HINT.universal;
  let range = extra.range || "";
  let area = extra.area || "";
  const fallback = {
    feebl: "Touch",
    poor: "Touch",
    typical: "Same area",
    good: "User's area",
    excellent: "1 area",
    remarkable: "2 areas",
    incredible: "5 areas",
    amazing: "12 areas",
    monstrous: "20 areas",
    uneart: "40 areas"
  };
  if (!range && extra.rank) {
    range = fallback[String(extra.rank).toLowerCase()] || "User's area";
    area = extra.area || range;
  }
  const from = energy === "personal" ? "Caster" : energy === "dimensional" ? "Borrowed source" : "Caster as focus";
  return {
    definition: ROM_DEFINITIONS[key] || extra.definition || (String(name).trim() + " is a magical working. " + hint),
    category: extra.category || extra.energy || "Magic",
    powerType: extra.powerType || "Realms of Magic",
    slotsTaken: extra.two || extra.slotsTaken === 2 ? 2 : 1,
    range,
    area,
    areasPerRound: extra.areasPerRound || "",
    emanatesFrom: extra.emanatesFrom || from,
    effectsColumn: extra.effectsColumn || (/beam|bolt|blast|flame|breath|crystal/i.test(key) ? "blasting" : "")
  };
}

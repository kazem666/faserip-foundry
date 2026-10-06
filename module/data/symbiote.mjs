/** A living coat. Each row is a power the system already has. */

import { rankIndex, rankValue, shiftRank } from "../config.mjs";

export const SYMBIOTE_WEAKNESS = "The coat can be attacked at −4 CS. Coat Health equals the hero's Health (Fighting + Agility + Strength + Endurance) and is tracked on its own. It heals the Regeneration rank number each round. At 0 it is out for 1–10 hours, and that damage is suffered by the host. Loud sound does +3 CS damage to the bond. Intense heat and open flame do +1 CS.";

export const SYMBIOTE_LIMITS = `${SYMBIOTE_WEAKNESS} The coat needs a living host. It keeps memories of earlier hosts and can share them. A danger sense learned from an earlier host of this same bond does not warn against it. A strong coat can push the host toward what it wants.`;

export const SYMBIOTE_BONDS = [
  { power: "Body Armor", standard: true, note: "The living coat is dense and takes the hit before the host." },
  { power: "Regeneration", standard: true, note: "The coat knits. Track its Health apart from the host." },
  { power: "Extra Body Parts", standard: true, note: "Every coat can form tendrils. It can also form a tail or wing membranes." },
  { power: "Claws", standard: true, note: "Most coats can form spikes, talons, or blades. Edged damage." },
  { power: "Elongation", standard: true, note: "The coat stretches to cover a host or an object, and limbs and tendrils reach at this rank." },
  { power: "Shape-Shifting", standard: true, note: "The coat becomes ordinary clothes or another outline." },
  { power: "Blending", standard: true, note: "The coat matches the surroundings, which makes a blindsiding attack easier." },
  { power: "Life Support", standard: true, note: "The coat supplies breathable gas underwater or in vacuum." },
  { power: "Resistance to Radiation", standard: true, note: "The coat shields the host from radiation." },
  { power: "Empathy", standard: true, note: "The coat answers the host's thoughts and can feel nearby minds. It does not control them." },
  { power: "Wall-Crawling", note: "A bond that has learned to grip most surfaces." },
  { power: "Ensnaring Missile", note: "A strand of the coat. One attack strand every third round. A strand used to swing is reeled back and does not spend that. Pushing past the limit deals Good damage to the coat. A loose strand dissolves in 5 to 50 minutes. While it is still attached, the host can move it like a limb." },
  { power: "Imitation", note: "The coat copies a face or build it has been in contact with." },
  { power: "Plasticity", note: "The coat's mass flows. A deep bond can let the host's body flow with it." },
  { power: "Growth", note: "The coat bulks the host larger. A larger coat can lift more." },
  { power: "Gliding", note: "Membranes formed from the coat carry the host." },
  { power: "Corrosive Missile", note: "Some coats secrete acid from their own mass." },
  { power: "Projectile Missile", note: "A piece of the coat hurled as a weapon, out to about three areas. It falls apart after 1 to 6 rounds." },
  { power: "Healing", note: "Some bonds clean illness or mend another body." },
  { power: "Power Absorption", note: "The coat can imprint powers it wore on a superhuman host and carry them to a later host." }
];

export function symbioteHasCoat(actor) {
  if (!actor) return false;
  const arch = String(actor.system?.identity?.archetype || "");
  const origin = String(actor.system?.identity?.origin || "");
  const weak = String(actor.system?.story?.weaknesses || "");
  return /symbiote/i.test(arch) || /symbiote/i.test(origin) || /coat can be attacked/i.test(weak) || /coat health equals/i.test(weak);
}

export function symbioteCoatHealth(actor) {
  if (!symbioteHasCoat(actor)) return null;
  const max = Math.max(0, Number(actor.system?.health?.max) || 0);
  const stored = actor.getFlag?.("faserip", "coatHealth");
  const value = stored == null || stored === "" ? max : Math.max(0, Math.min(max, Number(stored) || 0));
  const regenItem = actor.items?.find?.((item) => item.type === "power" && /^regeneration$/i.test(item.name));
  const regen = rankValue(regenItem?.system?.rank || "good");
  return {
    value,
    max,
    pct: max ? Math.round((value / max) * 100) : 0,
    regen
  };
}
export function symbioteNote(name) {
  const key = String(name || "").toLowerCase();
  return SYMBIOTE_BONDS.find((row) => row.power.toLowerCase() === key)?.note || "";
}

export function symbioteAbilityRank(key, rank) {
  if (key === "strength") rank = shiftRank(rank, 2);
  else if (key === "agility") rank = shiftRank(rank, 1);
  else return rank;
  if (rankIndex(rank) > rankIndex("amazing")) return "amazing";
  return rank;
}

export function symbioteStandardRows() {
  return SYMBIOTE_BONDS.filter((row) => row.standard).map((row) => ({
    name: row.power,
    category: "Symbiote",
    rank: "good",
    cost: 0,
    slotsTaken: 0,
    bondNote: row.note,
    source: "symbiote",
    grade: "Coat"
  }));
}

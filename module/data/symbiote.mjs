/** A living bond. Each row is a power the system already has. */

export const SYMBIOTE_LIMITS = "The coat can be attacked at −4 CS. It has its own Health and heals each round; at 0 it is out for 1–10 hours, and that damage is suffered by the host. Loud sound does +3 CS damage to the bond. Open flame does +1 CS. A danger sense learned from an earlier host of this same bond does not warn against it.";

export const SYMBIOTE_BONDS = [
  { power: "Body Armor", note: "The living coat soaks physical hits at this rank." },
  { power: "Regeneration", note: "The coat knits. Track its Health apart from the host." },
  { power: "Ensnaring Missile", note: "A strand of the coat. One attack strand every third round. A strand used to swing is reeled back and does not spend that. Pushing past the limit deals Good damage to the coat. A loose strand dissolves in 5 to 50 minutes. While it is still attached, the host can move it like a limb." },
  { power: "Wall-Crawling", note: "The coat grips most surfaces." },
  { power: "Claws", note: "Fangs or blades formed from the coat. Edged damage." },
  { power: "Elongation", note: "Limbs and tendrils stretch at this rank." },
  { power: "Extra Body Parts", note: "The coat forms extra limbs, a tail, or wing membranes." },
  { power: "Blending", note: "The coat matches the surroundings, which makes a blindsiding attack easier." },
  { power: "Shape-Shifting", note: "The coat becomes ordinary clothes or another outline." },
  { power: "Imitation", note: "The coat copies a face or build it has been in contact with." },
  { power: "Invisibility", note: "The coat can fade until the host is nearly unseen." },
  { power: "Growth", note: "The coat bulks the host larger." },
  { power: "Gliding", note: "Membranes formed from the coat carry the host." },
  { power: "Plasticity", note: "The coat's mass flows, squeezes, and reshapes." },
  { power: "Phasing", note: "The coat slips the host through cracks, vents, and wire paths." },
  { power: "Projectile Missile", note: "A piece of the coat hurled as a weapon, out to about three areas. It falls apart after 1 to 6 rounds." },
  { power: "Healing", note: "Some bonds clean illness or mend another body." },
  { power: "Life Support", note: "The coat keeps the host supplied for a time." }
];

export function symbioteNote(name) {
  const key = String(name || "").toLowerCase();
  return SYMBIOTE_BONDS.find((row) => row.power.toLowerCase() === key)?.note || "";
}

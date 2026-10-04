/** Original mechanical blurbs for Advanced Set gear. Not reprinted TSR text. */

export const GEAR_DEFINITIONS = {
  "arrows / bolts": { definition: "A quiver of arrows or bolts. Reloading a bow or crossbow draws from this stack.", itemType: "equipment", category: "Ammunition" },
  "assault rifle": { definition: "Military rifle. Two shots a round from a 20-shot clip. Raising the rate of fire shortens the range. Good material. Restricted.", itemType: "weapon", weaponType: "Shooting", effectsColumn: "shooting", material: "good", range: "7 areas", damage: "10" },
  "automatic rifle": { definition: "Military rifle. One burst a round, 20 bursts in the clip. A yellow FEAT on the burst can hit up to three adjacent targets. Good material.", itemType: "weapon", weaponType: "Shooting", effectsColumn: "shooting", material: "good", range: "5 areas", damage: "15" },
  "axe": { definition: "One-handed chopping tool. Edged Attacks.", itemType: "weapon", weaponType: "Edged", effectsColumn: "edged", material: "good", range: "touch" },
  "baseball bat": { definition: "Sporting lumber used as a club. Blunt Attacks.", itemType: "weapon", weaponType: "Blunt", effectsColumn: "blunt", material: "typical", range: "touch" },
  "battle axe": { definition: "Two-handed war axe. Edged Attacks.", itemType: "weapon", weaponType: "Edged", effectsColumn: "edged", material: "excellent", range: "touch" },
  "bazooka": { definition: "Shoulder tube. 10 shots. The blast fills the target area. If the tube is damaged, it can explode for 1–10 rounds. Typical material.", itemType: "weapon", weaponType: "Shooting", effectsColumn: "shooting", material: "typical", range: "20 areas", damage: "40" },
  "bola": { definition: "Weighted cords. Grappling at range.", itemType: "weapon", weaponType: "Grappling", effectsColumn: "wrestling", material: "typical", range: "2 areas", damage: "*" },
  "boomerang": { definition: "Curved throwing stick. Blunt Throwing.", itemType: "weapon", weaponType: "Blunt", effectsColumn: "throwBlunt", material: "typical", range: "3 areas", damage: "6" },
  "cheap handgun": { definition: "Pocket pistol. 6 shots. Poor material. One hand. Will not take specialized ammunition.", itemType: "weapon", weaponType: "Shooting", effectsColumn: "shooting", material: "poor", range: "2 areas", damage: "6" },
  "club": { definition: "Simple blunt stick. Blunt Attacks column.", itemType: "weapon", weaponType: "Blunt", effectsColumn: "blunt", material: "typical", range: "touch" },
  "compound bow": { definition: "Cam bow. Quiet. Two hands.", itemType: "weapon", weaponType: "Bow", effectsColumn: "shooting", material: "typical", range: "6 areas", damage: "10" },
  "concussion cannon": { definition: "Incredible Slugfest damage. 10 shots from a power pack. Remarkable material. One firer.", itemType: "weapon", weaponType: "Shooting", effectsColumn: "blunt", material: "remarkable", range: "15 areas", damage: "40" },
  "concussion pistol": { definition: "One-hand force gun. 5 shots from a power pack. Slugfest damage. No ammunition.", itemType: "weapon", weaponType: "Shooting", effectsColumn: "blunt", material: "typical", range: "4 areas", damage: "10" },
  "concussion rifle": { definition: "Two-hand force rifle. 12 shots from a power pack. Slugfest damage. Good material.", itemType: "weapon", weaponType: "Shooting", effectsColumn: "blunt", material: "good", range: "7 areas", damage: "10" },
  "crossbow": { definition: "Shoulder-fired prod.", itemType: "weapon", weaponType: "Bow", effectsColumn: "shooting", material: "good", range: "5 areas", damage: "10" },
  "dagger": { definition: "Fighting knife. Edged Attacks; throwable.", itemType: "weapon", weaponType: "Edged", effectsColumn: "edged", material: "good", range: "1 area" },
  "grenade launcher": { definition: "Two hands. One grenade, then a round to reload. Damage is the grenade's. Good material. Range 3 areas.", itemType: "weapon", weaponType: "Shooting", effectsColumn: "shooting", material: "good", range: "3 areas", damage: "" },
  "gyro-jet pistol": { definition: "Rocket pistol. 3 shots. One shot every two rounds. Range 5 areas.", itemType: "weapon", weaponType: "Shooting", effectsColumn: "shooting", material: "good", range: "5 areas", damage: "10" },
  "handgun / pistol": { definition: "Standard sidearm. One hand. Magazine is 6, 8, or 9. Excellent material. Can be fitted for specialized ammunition.", itemType: "weapon", weaponType: "Shooting", effectsColumn: "shooting", material: "excellent", range: "3 areas", damage: "6" },
  "heavy artillery": { definition: "Crew of two. 30 shells. One shell fills the target area. Remarkable material. Stationary unless mounted so it can turn.", itemType: "weapon", weaponType: "Shooting", effectsColumn: "shooting", material: "remarkable", range: "20 areas", damage: "50" },
  "hunting rifle": { definition: "Rural rifle. Two hands. Magazine is 6, 7, or 8. Good material.", itemType: "weapon", weaponType: "Shooting", effectsColumn: "shooting", material: "good", range: "10 areas", damage: "10" },
  "knife": { definition: "Small edged blade. Edged Attacks column.", itemType: "weapon", weaponType: "Edged", effectsColumn: "edged", material: "good", range: "touch" },
  "laser cannon": { definition: "Crew of one. 10 shots from a power pack. Excellent material. Remarkable energy.", itemType: "weapon", weaponType: "Energy", effectsColumn: "energy", material: "excellent", range: "20 areas", damage: "30" },
  "laser pistol": { definition: "Energy sidearm. 10 shots from a power pack. Poor material. No ammunition. Restricted.", itemType: "weapon", weaponType: "Energy", effectsColumn: "energy", material: "poor", range: "10 areas", damage: "10" },
  "laser rifle": { definition: "Two-hand energy rifle. 20 shots from a power pack. Typical material.", itemType: "weapon", weaponType: "Energy", effectsColumn: "energy", material: "typical", range: "4 areas", damage: "20" },
  "long bow": { definition: "Tall war bow. Two hands. Needs Typical Strength, or a Strength FEAT.", itemType: "weapon", weaponType: "Bow", effectsColumn: "shooting", material: "typical", range: "7 areas", damage: "10" },
  "machine gun": { definition: "Crew or bipod burst weapon.", itemType: "weapon", weaponType: "Shooting", effectsColumn: "shooting", material: "excellent", range: "10 areas", damage: "30" },
  "machine pistol": { definition: "One-hand burst gun. 6 bursts in the clip. Excellent material. Restricted.", itemType: "weapon", weaponType: "Shooting", effectsColumn: "shooting", material: "excellent", range: "3 areas", damage: "20" },
  "missile launcher": { definition: "Crew of two. 10 missiles. One to ten missiles in a round. Must stay still to fire. Damage 40.", itemType: "weapon", weaponType: "Shooting", effectsColumn: "shooting", material: "typical", range: "by missile", damage: "40" },
  "plasma beam handgun": { definition: "One-hand energy pistol. 10 shots from a power pack. Excellent material. Damage 20.", itemType: "weapon", weaponType: "Energy", effectsColumn: "energy", material: "excellent", range: "7 areas", damage: "20" },
  "rifle": { definition: "Two-handed rifle. 4 shots. Good material.", itemType: "weapon", weaponType: "Shooting", effectsColumn: "shooting", material: "good", range: "10 areas", damage: "10" },
  "riot gun": { definition: "One or two hands. 6 shots. Often gas or specialized ammunition. Excellent material.", itemType: "weapon", weaponType: "Shooting", effectsColumn: "shooting", material: "excellent", range: "2 areas", damage: "15" },
  "shotgun": { definition: "Two hands. 2 rounds. Can fire once or twice in a round. May hit up to three adjacent targets in the same area. Good material.", itemType: "weapon", weaponType: "Shooting", effectsColumn: "shooting", material: "good", range: "3 areas", damage: "20" },
  "sniper rifle": { definition: "Two hands. 4 shots. The sight raises the firing ability one rank, and that bonus stops at Remarkable. Good material.", itemType: "weapon", weaponType: "Shooting", effectsColumn: "shooting", material: "good", range: "10 areas", damage: "15" },
  "stun cannon": { definition: "Incredible Intensity stun. 10 shots from a power pack. Remarkable material. One firer takes a column shift penalty.", itemType: "weapon", weaponType: "Stun", effectsColumn: "force", material: "remarkable", range: "10 areas", damage: "" },
  "stun pistol": { definition: "One-hand stunner. 10 shots from a power pack. Poor material. No Health damage. The target makes an Endurance FEAT against Typical Intensity or is stunned.", itemType: "weapon", weaponType: "Stun", effectsColumn: "force", material: "poor", range: "6 areas", damage: "" },
  "stun rifle": { definition: "Two hands. 20 shots from a power pack. Typical material. No Health damage. The target makes an Endurance FEAT against Remarkable Intensity or is stunned.", itemType: "weapon", weaponType: "Stun", effectsColumn: "force", material: "typical", range: "5 areas", damage: "" },
  "superheavy artillery": { definition: "Crew weapon. 30 shells. One shell fills the target area. Incredible material.", itemType: "weapon", weaponType: "Shooting", effectsColumn: "shooting", material: "incredible", range: "25 areas", damage: "50" },
  "target pistol": { definition: "One shot. Excellent material. Fired with two hands, Agility is one rank higher.", itemType: "weapon", weaponType: "Shooting", effectsColumn: "shooting", material: "excellent", range: "5 areas", damage: "6" },
  "medicine": { definition: "Contact: doctors, nurses, EMTs, hospital admin.", itemType: "contact", category: "Medicine", occupation: "Medicine" },
  "law": { definition: "Contact: attorneys, clerks, judges.", itemType: "contact", category: "Law", occupation: "Law" },
  "law enforcement": { definition: "Contact: beat cops to bureau agents.", itemType: "contact", category: "Law Enforcement", occupation: "Law Enforcement" },
  "military": { definition: "Contact: service members and veterans.", itemType: "contact", category: "Military", occupation: "Military" },
  "net": { definition: "Weighted mesh. Grappling wrap.", itemType: "weapon", weaponType: "Grappling", effectsColumn: "wrestling", material: "typical", range: "1 area", damage: "*" },
  "regular bow": { definition: "Simple bow. Two hands. Poor material.", itemType: "weapon", weaponType: "Bow", effectsColumn: "shooting", material: "poor", range: "5 areas", damage: "6" },
  "staff": { definition: "Two-handed pole. Blunt Attacks.", itemType: "weapon", weaponType: "Blunt", effectsColumn: "blunt", material: "good", range: "touch" },
  "sword": { definition: "One-handed sword. Edged Attacks.", itemType: "weapon", weaponType: "Edged", effectsColumn: "edged", material: "excellent", range: "touch" },
  "whip": { definition: "Long lash. Grappling at short range.", itemType: "weapon", weaponType: "Grappling", effectsColumn: "wrestling", material: "poor", range: "1 area" }
};

function guessWeapon(key) {
  if (/grenade|bola|net|whip/.test(key)) return { weaponType: "Grappling", effectsColumn: /grenade/.test(key) ? "force" : "grappling", range: "2 areas" };
  if (/throwing|shuriken|boomerang|javelin/.test(key)) return { weaponType: "Edged", effectsColumn: "throwEdged", range: "2 areas" };
  if (/pistol|rifle|gun|shotgun|bow|crossbow|artillery|cannon|bazooka|launcher|flamethrower|law/.test(key)) return { weaponType: "Shooting", effectsColumn: /laser|plasma|flame|flare|sonic/.test(key) ? "energy" : /stun|concussion/.test(key) ? "force" : "shooting", range: "5 areas" };
  if (/sword|knife|dagger|axe|spear|pike|hatchet/.test(key)) return { weaponType: "Edged", effectsColumn: "edged", range: "touch" };
  return { weaponType: "Blunt", effectsColumn: "blunt", range: "touch" };
}

export function describeGear(name, extra = {}) {
  const key = String(name || "")
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/[—–]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  const named = GEAR_DEFINITIONS[key];
  const stock = named && extra.itemType === "weapon" && named.itemType === "contact" ? null : named;
  const type = extra.itemType || extra.type || stock?.itemType || "equipment";
  const guessed = type === "weapon" ? guessWeapon(key) : {};
  const definition = extra.definition || stock?.definition || `${String(name).trim()} is catalog gear. The Judge sets cost, material, and effect from your rulebook.`;
  return { ...guessed, ...stock, ...extra, definition, itemType: type };
}

/** Original mechanical blurbs for Advanced Set gear. Not reprinted TSR text. */

export const GEAR_DEFINITIONS = {
  "assault rifle": { definition: "Military rifle. Burst fire. Restricted.", itemType: "weapon", weaponType: "Shooting", effectsColumn: "shooting", material: "good", range: "7 areas", damage: "10" },
  "automatic rifle": { definition: "Military burst rifle.", itemType: "weapon", weaponType: "Shooting", effectsColumn: "shooting", material: "good", range: "5 areas", damage: "16" },
  "axe": { definition: "One-handed chopping tool. Edged Attacks.", itemType: "weapon", weaponType: "Edged", effectsColumn: "edged", material: "good", range: "touch" },
  "baseball bat": { definition: "Sporting lumber used as a club. Blunt Attacks.", itemType: "weapon", weaponType: "Blunt", effectsColumn: "blunt", material: "typical", range: "touch" },
  "battle axe": { definition: "Two-handed war axe. Edged Attacks.", itemType: "weapon", weaponType: "Edged", effectsColumn: "edged", material: "excellent", range: "touch" },
  "bazooka": { definition: "Reloadable recoilless tube. Military.", itemType: "weapon", weaponType: "Shooting", effectsColumn: "shooting", material: "good", range: "4 areas", damage: "40" },
  "bola": { definition: "Weighted cords. Grappling at range.", itemType: "weapon", weaponType: "Grappling", effectsColumn: "wrestling", material: "typical", range: "2 areas", damage: "*" },
  "boomerang": { definition: "Curved throwing stick. Blunt Throwing.", itemType: "weapon", weaponType: "Blunt", effectsColumn: "throwBlunt", material: "typical", range: "3 areas", damage: "6" },
  "cheap handgun": { definition: "Bargain pocket pistol.", itemType: "weapon", weaponType: "Shooting", effectsColumn: "shooting", material: "poor", range: "3 areas", damage: "4" },
  "club": { definition: "Simple blunt stick. Blunt Attacks column.", itemType: "weapon", weaponType: "Blunt", effectsColumn: "blunt", material: "typical", range: "touch" },
  "compound bow": { definition: "Cam bow. Quiet.", itemType: "weapon", weaponType: "Bow", effectsColumn: "shooting", material: "typical", range: "6 areas", damage: "10" },
  "crossbow": { definition: "Shoulder-fired prod.", itemType: "weapon", weaponType: "Bow", effectsColumn: "shooting", material: "good", range: "5 areas", damage: "10" },
  "dagger": { definition: "Fighting knife. Edged Attacks; throwable.", itemType: "weapon", weaponType: "Edged", effectsColumn: "edged", material: "good", range: "1 area" },
  "handgun / pistol": { definition: "Standard sidearm. Shooting column.", itemType: "weapon", weaponType: "Shooting", effectsColumn: "shooting", material: "typical", range: "3 areas", damage: "6" },
  "knife": { definition: "Small edged blade. Edged Attacks column.", itemType: "weapon", weaponType: "Edged", effectsColumn: "edged", material: "good", range: "touch" },
  "laser pistol": { definition: "Energy sidearm. Energy column. Restricted.", itemType: "weapon", weaponType: "Energy", effectsColumn: "energy", material: "poor", range: "10 areas", damage: "10" },
  "laser rifle": { definition: "Energy rifle. Energy column. Restricted.", itemType: "weapon", weaponType: "Energy", effectsColumn: "energy", material: "typical", range: "7 areas", damage: "20" },
  "long bow": { definition: "Tall war bow.", itemType: "weapon", weaponType: "Bow", effectsColumn: "shooting", material: "typical", range: "7 areas", damage: "10" },
  "machine gun": { definition: "Crew or bipod burst weapon.", itemType: "weapon", weaponType: "Shooting", effectsColumn: "shooting", material: "excellent", range: "10 areas", damage: "30" },
  "medicine": { definition: "Contact: doctors, nurses, EMTs, hospital admin.", itemType: "contact", category: "Medicine", occupation: "Medicine" },
  "law": { definition: "Contact: attorneys, clerks, judges.", itemType: "contact", category: "Law", occupation: "Law" },
  "law enforcement": { definition: "Contact: beat cops to bureau agents.", itemType: "contact", category: "Law Enforcement", occupation: "Law Enforcement" },
  "military": { definition: "Contact: service members and veterans.", itemType: "contact", category: "Military", occupation: "Military" },
  "net": { definition: "Weighted mesh. Grappling wrap.", itemType: "weapon", weaponType: "Grappling", effectsColumn: "wrestling", material: "typical", range: "1 area", damage: "*" },
  "regular bow": { definition: "Simple bow.", itemType: "weapon", weaponType: "Bow", effectsColumn: "shooting", material: "poor", range: "5 areas", damage: "6" },
  "rifle": { definition: "Two-handed long gun. Shooting column.", itemType: "weapon", weaponType: "Shooting", effectsColumn: "shooting", material: "good", range: "10 areas", damage: "10" },
  "shotgun": { definition: "Smoothbore. Scatter in the target area.", itemType: "weapon", weaponType: "Shooting", effectsColumn: "shooting", material: "good", range: "3 areas", damage: "20" },
  "sniper rifle": { definition: "Precision rifle.", itemType: "weapon", weaponType: "Shooting", effectsColumn: "shooting", material: "good", range: "10 areas", damage: "15" },
  "staff": { definition: "Two-handed pole. Blunt Attacks.", itemType: "weapon", weaponType: "Blunt", effectsColumn: "blunt", material: "good", range: "touch" },
  "stun pistol": { definition: "One-handed stunner. Force column.", itemType: "weapon", weaponType: "Stun", effectsColumn: "force", material: "poor", range: "3 areas", damage: "*" },
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
  const stock = GEAR_DEFINITIONS[key];
  const type = extra.itemType || extra.type || stock?.itemType || "equipment";
  const guessed = type === "weapon" ? guessWeapon(key) : {};
  const definition = extra.definition || stock?.definition || `${String(name).trim()} is catalog gear. The Judge sets cost, material, and effect from your rulebook.`;
  return { ...guessed, ...stock, ...extra, definition, itemType: type };
}

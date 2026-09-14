export const POWER_CATALOG = {
  resistances: ["Resistance to Fire and Heat","Resistance to Cold","Resistance to Electricity","Resistance to Radiation","Resistance to Toxins","Resistance to Corrosives","Resistance to Emotion Attacks","Resistance to Mental Attacks","Resistance to Magical Attacks","Resistance to Disease","Invulnerability (counts as two Powers)"],
  senses: ["Protected Senses","Enhanced Senses","Infravision","Cosmic Awareness (counts as two)","Combat Sense (counts as two)","Computer Links","Emotion Detection","Energy Detection","Magic Detection","Magnetic Detection","Mutant Detection","Psionic Detection","Astral Detection","Tracking Ability"],
  movement: ["Flight","Gliding","Leaping","Wall-Crawling","Lightning Speed","Teleportation (counts as two)","Levitation","Swimming","Climbing","Digging","Dimensional Travel (counts as two)"],
  matter: ["Earth Control","Air Control","Fire Control","Water Control","Weather Control","Density Manipulation — Others","Body Transformation — Others","Animal Transformation — Others"],
  energy: ["Magnetic Manipulation","Electrical Manipulation","Light Manipulation","Sound Manipulation","Darkforce Manipulation","Gravity Manipulation","Probability Manipulation (counts as two)","Nullifying Power (counts as two)","Energy Reflection","Time Control (counts as two)"],
  bodyControl: ["Growth","Shrinking","Density Manipulation — Self","Phasing","Invisibility","Plasticity","Elongation","Shape-Shifting","Imitation","Body Transformation","Animal Transformation — Self","Raise Lowest Ability","Blending","Power Absorption","Alter Ego"],
  distance: ["Projectile Missile","Ensnaring Missile","Ice Generation","Fire Generation","Energy Generation","Sound Generation","Stunning Missile","Corrosive Missile","Slashing Missile","Nullifier Missile","Darkforce Generation"],
  mental: ["Telepathy","Image Generation (counts as two)","Telekinesis","Mind Control (counts as two)","Emotion Control (counts as two)","Force Field Generation","Animal Communication and Control","Mechanical Intuition","Animal Empathy","Empathy","Psi-Screen","Mental Probe","Animate Drawings","Possession (counts as two)","Transferral (counts as two)","Astral Projection","Psionic Attack","Precognition (counts as two)","Postcognition","Plant Control","Ultimate Skill"],
  offensive: ["Extra Body Parts","Extra Attacks","Energy Touch","Paralyzing Touch","Claws","Rotting Touch","Corrosive Touch","Health-Drain Touch (counts as two)","Blinding Touch"],
  defensive: ["Body Armor","Water Breathing","Absorption","Regeneration","Solar Regeneration","Recovery","Life Support","Pheromones","Damage Transfer","Healing","Immortality (counts as two)"]
};

export const TALENT_CATEGORIES = [
  { lo: 1, hi: 20, id: "weapon", label: "Weapon Skills" },
  { lo: 21, hi: 45, id: "fighting", label: "Fighting Skills" },
  { lo: 46, hi: 65, id: "professional", label: "Professional Skills" },
  { lo: 66, hi: 85, id: "scientific", label: "Scientific Skills" },
  { lo: 86, hi: 90, id: "mystic", label: "Mystic and Mental Skills" },
  { lo: 91, hi: 100, id: "other", label: "Other Skills" }
];

export const TALENT_CATALOG = {
  weapon: ["Guns (+1 CS to hit with firearms)","Thrown Weapons (+1 CS)","Bows (+1 CS)","Blunt Weapons (+1 CS)","Sharp Weapons (+1 CS)","Oriental Weapons (+1 CS)","Marksman (+1 CS)","Weapons Master (+1 CS)","Weapons Specialist (+2 CS one weapon)"],
  fighting: ["Martial Arts A","Martial Arts B (+1 CS unarmed Fighting)","Martial Arts C","Martial Arts D","Martial Arts E","Wrestling (+2 CS Grappling)","Thrown Objects","Tumbling","Acrobatics"],
  professional: ["Medicine","Law","Law-Enforcement","Pilot","Military","Business/Finance","Journalism","Engineering","Crime","Psychiatry","Detective/Espionage"],
  scientific: ["Chemistry","Biology","Geology","Genetics","Archeology","Physics","Computers","Electronics"],
  mystic: ["Trance","Mesmerism and Hypnosis","Sleight of Hand","Resist Domination","Mystic Origin","Occult Lore"],
  other: ["Artist","Languages","First Aid","Repair/Tinkering","Trivia","Performer","Animal Training","Heir to Fortune","Student","Leadership"]
};

export const CONTACT_TYPES = ["Medicine","Law","Law Enforcement","Military","Business / Finance","Journalism / Media","Science / Research","Government","Crime","Engineering / Industry","Mystic / Occult","Academic","Local Community","Foreign / Off-world People","Other"];

export const MATERIAL_EXAMPLES = {
  feeble: "Cloth, glass, paper",
  poor: "Wood, common plastics",
  typical: "Rubber, soft metals, ice",
  good: "Brick, aluminum, asphalt",
  excellent: "Concrete, iron, bullet-proof glass",
  remarkable: "Reinforced concrete, steel",
  incredible: "Solid stone, volcanic rock",
  amazing: "Heavy steel alloys, granite",
  monstrous: "Diamond, super-heavy alloys",
  unearthly: "Near-indestructible alloys",
  cl1000: "Virtually indestructible artifacts"
};

/**
 * Named gear drawn from Advanced Set Players / Judges section lists.
 * Marvel-unique vehicle and gadget names are replaced with generic labels.
 * Definitions live in gear-descriptions.mjs (original play aids).
 */

export const WEAPON_CATALOG = {
  melee: [
    "Club", "Baseball Bat", "Nightstick", "Staff", "Quarterstaff",
    "Knife", "Switchblade", "Dagger", "Short Sword", "Sword", "Broadsword",
    "Great Sword", "Rapier", "Axe", "Battle Axe", "Hatchet",
    "Spear", "Javelin", "Pike", "Mace", "War Hammer", "Sledgehammer",
    "Chain", "Whip", "Nunchaku", "Bo Stick", "Brass Knuckles", "Cestus",
    "Shield", "Riot Shield"
  ],
  shooting: [
    "Cheap Handgun", "Handgun / Pistol", "Target Pistol", "Variable Pistol",
    "Gyro-Jet Pistol", "Machine Pistol", "Stun Pistol", "Laser Pistol",
    "Concussion Pistol", "Plasma Beam Handgun",
    "Rifle", "Hunting Rifle", "Sniper Rifle", "Assault Rifle", "Automatic Rifle",
    "Laser Rifle", "Stun Rifle", "Concussion Rifle",
    "Shotgun", "Riot Gun", "Sub-Machine Gun", "Machine Gun",
    "Grenade Launcher", "Flamethrower", "Bazooka", "LAW",
    "Light Artillery", "Heavy Artillery", "Superheavy Artillery",
    "Stun Cannon", "Concussion Cannon", "Laser Cannon",
    "Missile Launcher", "Flare Pistol"
  ],
  bow: [
    "Regular Bow", "Long Bow", "Compound Bow", "Crossbow", "Heavy Crossbow"
  ],
  thrown: [
    "Throwing Knife", "Shuriken", "Throwing Axe", "Boomerang", "Bola", "Net",
    "Fragmentation Grenade", "Concussion Grenade", "Stun Grenade",
    "Smoke Grenade", "Tear Gas Grenade", "Incendiary Grenade",
    "Flash Grenade", "Sonic Grenade", "Knock-Out Grenade"
  ]
};

export const AMMO_CATALOG = [
  "Standard Ammunition", "Armor-Piercing Shot", "Rubber Shot",
  "Explosive Shot", "Mercy Rounds",
  "Gas Canister", "Knock-Out Canister", "Smoke Canister",
  "Explosive Canister", "Incendiary Canister",
  "Standard Gyrojet Round", "Explosive Gyrojet Round",
  "Heat-Seeker Gyrojet", "Explosive Heat-Seeker Gyrojet",
  "Standard Missile", "Concentrated Explosive Missile",
  "High Explosive Missile", "Incendiary Missile", "Gas Missile",
  "Heat-Seeking Missile", "Radio-Linked Missile"
];

export const VEHICLE_CATALOG = {
  road: [
    "Sedan", "Mini-Car", "Sports Car", "Luxury Car", "Security Limo",
    "Van", "Convertible", "Taxi", "Bus", "Police Car", "Police Van", "SWAT Van",
    "Semi", "Sleeper Cab", "Armored Car", "Fire Truck", "Ambulance", "Rocket Car"
  ],
  offRoad: [
    "Bicycle", "Motorcycle", "Motor Trike", "Pickup Truck", "Jeep", "ATV",
    "Snowmobile", "Heavy Truck", "Tractor", "Bulldozer",
    "Tank", "SPG", "Armored Carrier", "Walker", "Borer"
  ],
  railed: ["Train", "Bullet Train", "Elevated Train", "Subway", "Trolley", "Monorail"],
  gev: ["Hovercraft", "Ground-Effect Platform"],
  air: [
    "Hang Glider", "Ultralight", "Glider", "Autogyro", "Gyrocopter",
    "Private Plane", "Corporate Jet", "Airliner", "Commercial Jet",
    "WWII Fighter", "WWII Bomber", "Military Jet", "VTOL Jet",
    "Traffic Helicopter", "Battle Helicopter", "Jetpack", "Balloon", "Blimp",
    "Air Car", "Skymobile", "Flying Car", "Super-team VTOL Jet",
    "Supersonic Airliner", "Jump Jet", "Family Flyer", "Spy Interceptor"
  ],
  space: ["Capsule", "Shuttle", "Space Shuttle", "Lunar Shuttle", "Orbital Craft", "Deep-Space Ship"],
  water: [
    "Raft", "Rowboat", "Sailboat", "Racing Sloop", "Motorboat", "Speedboat",
    "Yacht", "Jet Ski", "Hydrofoil", "Patrol Boat", "Freighter", "Ocean Liner",
    "Destroyer", "Battleship", "Carrier"
  ],
  sub: ["Mini-Sub", "Attack Submarine"]
};

export const PLACE_CATALOG = {
  buildings: [
    "Apartment", "Small House", "Medium House", "Large House", "Mansion",
    "Storefront", "Office Suite", "Office Floor", "Office Building",
    "Small Warehouse", "Medium Warehouse", "Large Warehouse",
    "Small Factory", "Large Factory", "Underground Lair",
    "Rural Retreat", "Skyscraper Floor"
  ],
  rooms: [
    "Living Room Package", "Living Quarters", "Kitchen Package", "Bedroom Package",
    "Conference Room Package", "Library Package", "Gym Package", "Pool Package",
    "Trophy Room Package", "Office Package"
  ],
  work: [
    "Laboratory Package", "Workshop Package", "Medical Bay Package",
    "Computer Room Package", "Communications Center Package", "Crime Files Package"
  ],
  defense: [
    "Detention Cell Package", "Imprisonment Package", "Security Package",
    "Defense System Package", "Fire Protection Package", "Secret Entrance",
    "Danger Room Package"
  ],
  support: [
    "Garage Package", "Hangar Package", "Dock Package",
    "Helipad", "Power Plant Package", "Radar / Sensor Suite"
  ]
};

export const EQUIPMENT_CATALOG = {
  tools: [
    "Crowbar", "Lockpicks", "Toolkit", "Electronics Kit", "First Aid Kit",
    "Fire Extinguisher", "Flashlight", "Halogen Flashlight", "Binoculars",
    "Camera", "Tape Recorder", "Radio", "Walkie-Talkie", "Cell Phone",
    "Laptop", "Desktop Computer", "Handcuffs", "Restraints",
    "Grappling Line", "Climbing Gear", "Scuba Gear", "Gas Mask", "Rebreather",
    "Parachute", "Spotlight", "Infra-red Goggles", "Polarized Lenses",
    "Mace Spray", "Roller Skates", "Sniper Sight"
  ],
  armor: [
    "Leather Jacket", "Flak Vest", "Kevlar Vest", "Riot Armor",
    "Helmet", "NBC Suit", "Vacuum Suit", "Asbestos Suit", "Body Suit"
  ],
  packs: [
    "Power Pack", "Ammo Reload", "Medkit Refill", "Fuel Canister"
  ],
  hardware: [
    "Rocket Pack", "Stasis Projector", "Inhibitor Band",
    "Power / Mutant Detector", "Mystic Primer Text",
    "Standard Utility Robot", "Sentry Robot",
    "Water-Breathing Tablets", "Silencer"
  ]
};

export const CREATURE_CATALOG = {
  domestic: ["Dog", "Guard Dog", "Horse", "Cat", "Hawk (trained)", "Cattle"],
  wild: [
    "Wolf", "Lion", "Tiger", "Bear", "Shark", "Crocodile", "Alligator",
    "Snake", "Eagle", "Elephant", "Boar", "Cheetah", "Bat", "Ape"
  ],
  unusual: ["Dolphin", "Owl", "Rat Swarm", "Whale", "Camel"]
};

export const CONTACT_CATALOG = {
  types: [
    "Medicine", "Law", "Law Enforcement", "Military", "Business / Finance",
    "Journalism / Media", "Science / Research", "Government", "Crime",
    "Engineering / Industry", "Mystic / Occult", "Academic",
    "Local Community", "Foreign / Off-world People", "Other"
  ]
};

export const GEAR_PACKS = [
  { name: "faserip-weapons", label: "FASERIP Weapons", builder: "weapons" },
  { name: "faserip-ammo", label: "FASERIP Ammunition", builder: "ammo" },
  { name: "faserip-vehicles", label: "FASERIP Vehicles", builder: "vehicles" },
  { name: "faserip-places", label: "FASERIP Places", builder: "places" },
  { name: "faserip-equipment", label: "FASERIP Equipment", builder: "equipment" },
  { name: "faserip-creatures", label: "FASERIP Creatures", builder: "creatures" },
  { name: "faserip-contacts", label: "FASERIP Contacts", builder: "contacts" }
];

export function flattenCatalog(catalog) {
  if (Array.isArray(catalog)) return catalog.map((raw) => ({ raw, category: "" }));
  const rows = [];
  for (const [category, list] of Object.entries(catalog)) {
    for (const raw of list) rows.push({ raw, category });
  }
  return rows;
}

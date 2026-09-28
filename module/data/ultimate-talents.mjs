/** Ultimate Talents categories and specialties. Names only, with short original glosses. */

export function isUltimateTalentsEnabled() {
  try {
    const v = game.settings.get("faserip", "useUltimateTalents");
    return v === true || v === "true" || v === "on" || v === 1;
  } catch {
    return false;
  }
}

export function wantUltimateTalents(explicit) {
  if (explicit === true || explicit === "true" || explicit === "on" || explicit === 1) return true;
  if (explicit === false || explicit === "false" || explicit === "off" || explicit === 0) return false;
  return isUltimateTalentsEnabled();
}

function row(lo, hi, name, definition = "") {
  return { lo, hi, name, definition };
}

export const ULTIMATE_TALENT_CATEGORIES = [
  { lo: 1, hi: 6, id: "alternative", label: "Alternative Sciences" },
  { lo: 7, hi: 12, id: "astronomy", label: "Astronomy" },
  { lo: 13, hi: 20, id: "biology", label: "Biology" },
  { lo: 21, hi: 28, id: "chemistry", label: "Chemistry" },
  { lo: 29, hi: 34, id: "crime", label: "Crime and Law" },
  { lo: 35, hi: 38, id: "cognitive", label: "Cognitive Sciences and Humanities" },
  { lo: 39, hi: 45, id: "computer", label: "Computer Science" },
  { lo: 46, hi: 52, id: "earth", label: "Earth Sciences" },
  { lo: 53, hi: 59, id: "engineering", label: "Engineering" },
  { lo: 60, hi: 66, id: "fighting", label: "Fighting Skills" },
  { lo: 67, hi: 70, id: "medicine", label: "Medicine" },
  { lo: 71, hi: 74, id: "mystic", label: "Mystic and Mental" },
  { lo: 75, hi: 79, id: "other", label: "Other" },
  { lo: 80, hi: 86, id: "physics", label: "Physics" },
  { lo: 87, hi: 93, id: "piloting", label: "Piloting" },
  { lo: 94, hi: 100, id: "weapons", label: "Weapons" }
];

export const ULTIMATE_HITECH_CATEGORIES = [
  "alternative", "astronomy", "biology", "chemistry", "cognitive", "computer",
  "earth", "engineering", "medicine", "physics", "crime"
];

export const ULTIMATE_TALENT_CATALOG = {
  alternative: [
    row(1, 25, "Catastrophism", "Study of disasters and events that could reshape history."),
    row(26, 50, "Cryonics", "Preserving a body at extreme cold for a possible future revival."),
    row(51, 75, "Paranormal Phenomena", "Scientific study of unexplained events."),
    row(76, 100, "Parapsychology", "Study of psychic phenomena.")
  ],
  astronomy: [
    row(1, 20, "Astronautics", "Design of vehicles that travel beyond the atmosphere."),
    row(21, 40, "Astrophotography", "Photographing objects in the sky."),
    row(41, 60, "Astrophysics", "Physical makeup of stars and other celestial matter."),
    row(61, 80, "Radio Astronomy", "Reading radio signals from outside the atmosphere."),
    row(81, 100, "Stellar Cartography", "Mapping space.")
  ],
  biology: [
    row(1, 5, "Anatomy", "Structure of living bodies."),
    row(6, 10, "Animal Behaviour", "How animals act and why."),
    row(11, 15, "Bio-Physics", "Physical principles applied to living systems."),
    row(16, 21, "Biotechnology", "Engineering applied to living tissue, organs, and devices."),
    row(22, 26, "Botany", "Study of plant life."),
    row(27, 31, "Ecology", "How organisms relate to their surroundings."),
    row(32, 37, "Genetics", "Heredity, variation, and signs of genetic change."),
    row(38, 42, "Immunology", "Immunity and immune responses."),
    row(43, 48, "Marine Biology", "Life in the sea."),
    row(49, 54, "Micro-Biology", "Life too small to see unaided."),
    row(55, 61, "Neurosciences", "Nerves, behavior, and learning."),
    row(62, 67, "Parasitology", "Parasites and their hosts."),
    row(68, 73, "Pharmacology", "Drugs, poisons, and treatments."),
    row(74, 79, "Phenology", "How species react to the environment."),
    row(80, 85, "Physiology", "How living systems function."),
    row(86, 90, "Psychobiology", "Mind and behavior tied to biology."),
    row(91, 95, "Radiobiology", "How radiation affects living systems."),
    row(96, 100, "Zoology", "Study of animals.")
  ],
  chemistry: [
    row(1, 11, "Alchemy", "Old speculative chemistry aimed at transmutation, cures, and long life."),
    row(12, 24, "Chemical and Biological Weapons", "Agents meant to harm through chemistry or disease."),
    row(25, 37, "Chemical Engineering", "Industrial use of chemistry and new chemical processes."),
    row(38, 50, "Electrochemistry", "Electricity and chemical change."),
    row(51, 64, "Organic Chemistry", "Chemistry of carbon compounds and natural substances."),
    row(65, 77, "Polymers", "Building new materials from long-chain compounds."),
    row(78, 88, "Sonochemistry", "How sound energy changes chemicals."),
    row(89, 100, "Spectroscopy", "Reading how matter and radiation interact.")
  ],
  crime: [
    row(1, 4, "Ballistics", "Matching shots, firearms, and where a bullet came from."),
    row(5, 7, "Camouflage", "Hiding gear, objects, or yourself."),
    row(8, 10, "Counterfeit Recognition", "Spotting false money, signatures, and art."),
    row(11, 12, "Clue Analysis", "Reading a scene for useful traces."),
    row(13, 16, "Criminology", "How criminals plan and behave."),
    row(17, 22, "Demolitions", "Placing and making explosives."),
    row(23, 29, "Detective/Espionage", "Investigation, cover, and a contact in crime, police, or law."),
    row(30, 31, "Disguise", "Passing at a glance, or adopting a full manner."),
    row(32, 37, "Forensics", "Laboratory reading of physical evidence."),
    row(38, 42, "Forgery", "Copying a signature or a work of art."),
    row(43, 44, "Intimidation", "Using threat, size, or force to frighten."),
    row(45, 47, "Interrogation", "Drawing information out of a subject."),
    row(48, 55, "Law", "Statutes, courts, and legal procedure."),
    row(56, 64, "Law Enforcement", "Police work, firearms, and legal arrest while still serving."),
    row(65, 70, "Military", "Service skills, heavy weapons, and a military contact."),
    row(71, 77, "Negotiations", "Talking through a hostile standoff."),
    row(78, 83, "Police Procedure", "Moving through a crime scene without becoming the suspect."),
    row(84, 88, "Pick Pocket", "Taking a carried item unnoticed."),
    row(89, 92, "Security", "Building, defeating, or noticing security devices."),
    row(93, 96, "Stealth", "Moving without being noticed."),
    row(97, 100, "Tracking", "Following a trail, or hiding your own.")
  ],
  cognitive: [
    row(1, 13, "Anthropology", "Cultures and how people live. A specialty may be taken as its own Talent."),
    row(14, 21, "Archaeology", "Material remains of past cultures."),
    row(22, 29, "Cartography", "Drawing and reading maps."),
    row(30, 39, "History", "A chosen period or place. Another branch costs another Talent."),
    row(40, 52, "Philology", "How a language is built. Fluent in one language besides the hero's own."),
    row(53, 66, "Music Cognition", "How music developed. This is not performance."),
    row(67, 80, "Philosophy", "Arguments about knowledge, ethics, and meaning."),
    row(81, 100, "Psychology", "The mind. Useful with mental powers.")
  ],
  computer: [
    row(1, 13, "Architecture", "Design of buildings and spaces."),
    row(14, 29, "Artificial Intelligence", "Machines built to reason."),
    row(30, 45, "Computer Engineering", "Design and construction of computer hardware."),
    row(46, 51, "Electronic Counter Measures", "Bugs, jammers, and decoders."),
    row(52, 58, "Graphics", "Layout, advertising, and printed or screen design."),
    row(59, 75, "Security and Encryption", "Locks made of code, and how to open them."),
    row(76, 89, "Programming", "Writing software."),
    row(90, 100, "Virtual Reality", "How people interact with simulated systems.")
  ],
  earth: [
    row(1, 11, "Agriculture", "Crops, soil, farm equipment, and forestry."),
    row(12, 25, "Ecology", "What throws a living system out of balance."),
    row(12, 25, "Geography", "The surface of the world and how it is mapped."),
    row(26, 38, "Geology", "Rocks and the history of the earth."),
    row(39, 50, "Hydrology", "Where water moves, on land and in the air."),
    row(51, 64, "Meteorology", "Weather systems."),
    row(65, 75, "Metallurgy", "Metals and how they are worked."),
    row(76, 90, "Oceanography", "Oceans and their effect on land and weather."),
    row(91, 100, "Seismology", "Earth movement, ice, and volcanoes.")
  ],
  engineering: [
    row(1, 6, "Aviation and Aeronautics Engineering", "How aircraft are designed. This is not piloting."),
    row(7, 11, "Astronautic Engineering", "Craft that operate beyond the atmosphere."),
    row(12, 16, "Automotive Engineering", "Cars and similar ground vehicles."),
    row(17, 19, "Battlesuit Design", "Powered armor, harnesses, and similar suits."),
    row(20, 21, "Civil Engineering", "Roads, waterworks, and city structures."),
    row(22, 25, "Cybernetics/Bionics", "Machines patterned on living systems, including replacement limbs."),
    row(26, 28, "Demolitions", "Building, using, and disarming explosives."),
    row(29, 31, "Gadgetry", "Building small devices."),
    row(32, 34, "Identify Gadgets", "Recognizing and using a device without building it."),
    row(35, 38, "Electrical Engineering", "Power, circuits, and electrical machines."),
    row(39, 44, "Locksmith", "Locks, keys, and how they fail."),
    row(45, 50, "Marine Engineering", "Ships, submarines, and underwater structures."),
    row(51, 57, "Mechanical Engineering", "Complex machines for a chosen job."),
    row(58, 63, "Military Engineering", "Field works, fortifications, and military machines."),
    row(64, 69, "Nuclear Engineering", "Devices that produce or control nuclear energy."),
    row(70, 76, "Repair/Tinkering", "Changing a machine that already exists."),
    row(77, 82, "Robotics", "Construction, upkeep, and theory of robots."),
    row(83, 88, "Structural Engineering", "Buildings, bases, tunnels, and mines."),
    row(89, 95, "Weapons Engineering", "Guns, missiles, and artillery. Not explosives."),
    row(96, 100, "Weapons Tinkering", "Modifying a weapon that already exists.")
  ],
  fighting: [
    row(1, 3, "Aerial Combat", "Fighting while airborne."),
    row(4, 7, "Underwater Combat", "Fighting while submerged."),
    row(8, 11, "Climbing", "Walls, cliffs, and similar surfaces."),
    row(12, 15, "Dodging", "Getting out of the way of a blow."),
    row(16, 19, "Gymnastics", "Flips, rolls, and showy movement."),
    row(20, 23, "Martial Arts A", "Turning an opponent's force. Can force Slam or Stun past the usual comparison."),
    row(24, 27, "Martial Arts B", "Short, hard strikes. +1 CS Fighting unarmed."),
    row(28, 30, "Martial Arts C", "Holds and escapes."),
    row(31, 34, "Martial Arts D", "Watches a foe for two rounds, then ignores Body Armor for Slam and Stun."),
    row(35, 38, "Martial Arts E", "+1 CS to initiative while unarmed."),
    row(39, 42, "Martial Arts F", "Defense. +1 CS to block and to Slam or Stun checks."),
    row(43, 45, "Martial Arts G", "May wait to declare a melee action until others have declared."),
    row(46, 49, "Martial Arts H", "Body control. +2 CS Endurance to heal, or to hold breath while still."),
    row(50, 53, "Martial Arts I", "A teacher shares a Karma pool with students."),
    row(54, 57, "Martial Arts J", "Uses loose objects in the area as part of the fight."),
    row(58, 61, "Martial Arts K", "A called strike can force an Endurance FEAT or unconsciousness."),
    row(62, 65, "Martial Arts L", "+1 CS Endurance against Slam and Stun from slugfest, unless blindsided."),
    row(66, 69, "Martial Arts M", "+1 CS Fighting for evasion only."),
    row(70, 73, "Martial Arts N", "One committed blow. +1 CS damage, then the attacker loses the next initiative."),
    row(74, 77, "Martial Arts O", "Fighting animals. Difficulty depends on how unfamiliar the animal is."),
    row(78, 81, "Martial Arts P", "A paired throw. Use the better Agility of the two heroes."),
    row(82, 85, "Martial Arts Q", "Standing still, a Psyche FEAT grants Excellent protection from blunt blows."),
    row(86, 89, "Martial Arts R", "+1 CS damage when breaking objects, not people."),
    row(90, 92, "Quick-Striking", "+1 CS when trying for extra attacks, and +1 initiative."),
    row(93, 94, "Wrestling", "+2 CS on Grappling to hit, not to damage."),
    row(95, 96, "Thrown Objects", "+1 CS throwing and catching."),
    row(97, 98, "Acrobatics", "+1 CS to dodge, evade, and escape."),
    row(99, 100, "Tumbling", "An Agility FEAT to land on your feet after a fall that deals no damage.")
  ],
  medicine: [
    row(1, 5, "Acupuncture", "Treatment through precise points on the body."),
    row(6, 10, "Cardiology", "The heart and circulation."),
    row(11, 15, "Chiropractic", "Treatment through the spine and joints."),
    row(16, 20, "Dentistry", "Teeth and the mouth."),
    row(21, 25, "Emergency Medicine", "Trauma and immediate care."),
    row(26, 33, "First Aid", "Stop Endurance loss and stabilize a dying patient shortly after Health reaches 0."),
    row(34, 39, "Geriatrics", "Care of older patients."),
    row(40, 44, "Obstetrics and Gynecology", "Pregnancy, birth, and related care."),
    row(45, 49, "Oncology", "Cancers and their treatment."),
    row(50, 54, "Pathology", "The nature of disease."),
    row(55, 60, "Pediatrics", "Care of children."),
    row(61, 65, "Pharmacology", "Medicines and how they act."),
    row(66, 70, "Physical Therapy", "Restoring movement after injury."),
    row(71, 75, "Plastic Surgery", "Reconstructive and cosmetic surgery."),
    row(76, 81, "Psychiatry", "Mental, emotional, and behavioral disorders."),
    row(82, 87, "Radiology", "Radiation used to diagnose or treat."),
    row(88, 93, "Sports Medicine", "Injuries from athletic effort."),
    row(94, 98, "Surgery", "Operating to repair serious damage. Harder outside a hospital, or on an unfamiliar body."),
    row(99, 100, "Veterinary", "Medical care of animals.")
  ],
  mystic: [
    row(1, 8, "Bibliophile", "Magical books, scrolls, and the lore around them."),
    row(9, 16, "Demonologist", "Identifying and dealing with hostile otherworldly beings."),
    row(17, 24, "Mesmerism and Hypnosis", "A limited mental influence at the hero's Reason. A command the subject would refuse breaks it."),
    row(25, 32, "Mystic Background", "The hero has studied magical forces. Powers still need the Judge's approval."),
    row(33, 40, "Occult Lore", "Hauntings, mysteries, and other spirit-world accounts."),
    row(41, 48, "Resist Domination", "Mental defense as if Psyche were one rank higher."),
    row(49, 56, "Runesmith", "Reading and cutting runes."),
    row(57, 65, "Scholar of Antiquities", "Old objects, especially ones with a magical history."),
    row(66, 74, "Sleight of Hand", "Palming a small item."),
    row(75, 83, "Theogony", "Stories and records of gods and similar beings."),
    row(84, 92, "Trance", "Slow the body enough to seem dead, and recover Endurance slowly."),
    row(93, 100, "Zoologist of Magic", "Identifying magical creatures and what they can do.")
  ],
  other: [
    row(1, 5, "Accounting", "Books, taxes, and where money went."),
    row(6, 9, "Actor", "Performance that can support a disguise."),
    row(10, 14, "Animal Training", "Teaching an animal a simple trick."),
    row(15, 19, "Artist", "Painting, sculpture, or writing made to be seen."),
    row(20, 25, "Business/Finance", "Companies and money. Starting Resources are at least Good."),
    row(26, 30, "Escape Artist", "Slipping holds and bonds."),
    row(31, 32, "Heir to a Fortune", "A situation, not a skill. Starting Resources are at least Remarkable."),
    row(33, 36, "Instructor", "Teaching a skill so a student can learn it."),
    row(37, 41, "Journalism", "Reporting. Two extra media contacts."),
    row(42, 46, "Leadership", "Recognized leader of a team Karma pool."),
    row(47, 52, "Performer", "Acting, song, dance, or another act for an audience."),
    row(53, 57, "Persuasion", "Talking someone into a belief or an action. Usually takes time."),
    row(58, 63, "Pick Pocketing", "Removing a carried item without notice."),
    row(64, 69, "Politics", "Public office or campaigns. Two contacts, usually supporters."),
    row(70, 76, "Seduction", "Persuasion aimed at attraction."),
    row(77, 82, "Sewing and Tailoring", "Making and altering clothes."),
    row(83, 89, "Streetsmart", "Getting by in a city. Two street-level contacts."),
    row(90, 93, "Student", "Chosen only at creation. Other starting Talents are deferred; later Talents cost less Karma."),
    row(94, 96, "Thief", "Locks, alarms, and safes."),
    row(97, 99, "Trivia", "One chosen subject the hero will not stop talking about."),
    row(100, 100, "Writer", "Novels, scripts, or similar work. A finished piece takes at least a week.")
  ],
  physics: [
    row(1, 15, "Acoustics", "Sound, noise, and using sound to make light in a liquid."),
    row(16, 32, "Atomic Physics", "The atom, including nuclear physics."),
    row(33, 48, "Cryogenics", "Producing and using very low temperatures."),
    row(49, 66, "Energy and Particle Physics", "The energy spectrum and new power sources."),
    row(67, 83, "Mathematics", "Hard problems that can be solved with numbers."),
    row(84, 100, "Quantum Physics", "Teleportation, tunnels through space, and similar theories. Counts as two Talents.")
  ],
  piloting: [
    row(1, 15, "Airplane Pilot", "Jets, small planes, and fighters."),
    row(16, 27, "Automobile Specialist", "Cars, trains, tanks, and hovercraft."),
    row(28, 38, "Boat Pilot", "Sail, large ships, and submarines."),
    row(39, 50, "Helicopter", "Rotary-wing aircraft."),
    row(51, 63, "Military Vehicle Specialist", "Tanks, jeeps, and other field vehicles."),
    row(64, 77, "Motorcycle", "Two-wheeled motor vehicles."),
    row(78, 89, "Spacecraft", "Shuttles and other craft beyond the atmosphere."),
    row(90, 100, "Submersible Vehicle", "Submarines, bells, and other underwater craft.")
  ],
  weapons: [
    row(1, 6, "Ancient Weapons", "Weapons from one chosen era before gunpowder."),
    row(7, 12, "Battlesuit Operation", "Using a battlesuit without the penalty for unfamiliar systems."),
    row(13, 20, "Blunt Weapons", "Clubs, bats, and similar weapons."),
    row(21, 27, "Bows", "Fire and reload in one round. Extra arrows need an Agility FEAT."),
    row(28, 34, "Energy Weapons", "Lasers, stunners, and similar guns. Not vehicle cannon."),
    row(35, 42, "Guns", "Handguns and rifles."),
    row(43, 49, "Marksman", "Aimed fire at a distance, with no range penalty."),
    row(50, 56, "Oriental Weapons", "Shuriken, crossbows, sai, and similar blades."),
    row(57, 63, "Heavy Weapons", "Vehicle mounts and tripod weapons."),
    row(64, 70, "Fencing", "Parry, disarm, and a quick strike on a yellow Agility FEAT."),
    row(71, 76, "Paired Weapons", "Fighting with a weapon in each hand."),
    row(77, 83, "Sharp Weapons", "Swords, daggers, and spears that are not thrown."),
    row(84, 90, "Thrown Weapons", "Spears, disks, shuriken, and similar throws."),
    row(91, 96, "Weapons Master", "+1 CS with any weapon that uses Fighting to hit."),
    row(97, 100, "Weapons Specialist", "+2 CS with one chosen weapon, and +1 initiative with it.")
  ]
};

export function ultimateTalentNames(categoryIds) {
  const names = [];
  for (const id of categoryIds) {
    for (const row of ULTIMATE_TALENT_CATALOG[id] || []) names.push(row.name);
  }
  return names;
}

export function ultimateTalentByName(name) {
  const want = String(name || "").trim().toLowerCase();
  for (const rows of Object.values(ULTIMATE_TALENT_CATALOG)) {
    const found = rows.find((row) => row.name.toLowerCase() === want);
    if (found) return found;
  }
  return null;
}

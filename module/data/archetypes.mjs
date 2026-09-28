/** Life tables and archetype packages. Original short notes only. */

export const ARCHETYPE_CHOICES = [
  { id: "", label: "Standard hero" },
  { id: "armored", label: "Armored hero" },
  { id: "cyborg", label: "Cyborg" },
  { id: "martial", label: "Martial artist" },
  { id: "vampire", label: "Vampire" },
  { id: "spaceknight", label: "Spaceknight" },
  { id: "morlock", label: "Morlock" },
  { id: "elder", label: "Elder" }
];

export function band(rows, roll) {
  const n = Math.min(100, Math.max(1, Number(roll) || 1));
  return rows.find((row) => n >= row.lo && n <= row.hi) || rows[rows.length - 1];
}

export const BUILDS = [
  { lo: 1, hi: 25, id: "slender", label: "Slender" },
  { lo: 26, hi: 75, id: "average", label: "Average" },
  { lo: 76, hi: 100, id: "muscular", label: "Muscular" }
];

export const STATURE = [
  { lo: 1, hi: 3, height: "5'0\"", slender: [97, 105], average: [106, 115], muscular: [115, 128] },
  { lo: 4, hi: 6, height: "5'1\"", slender: [101, 110], average: [111, 121], muscular: [122, 132] },
  { lo: 7, hi: 12, height: "5'2\"", slender: [104, 115], average: [115, 125], muscular: [126, 137] },
  { lo: 13, hi: 18, height: "5'3\"", slender: [107, 120], average: [121, 132], muscular: [133, 141] },
  { lo: 19, hi: 21, height: "5'4\"", slender: [114, 124], average: [125, 139], muscular: [139, 150] },
  { lo: 22, hi: 24, height: "5'5\"", slender: [118, 130], average: [131, 142], muscular: [143, 155] },
  { lo: 25, hi: 27, height: "5'6\"", slender: [121, 134], average: [135, 146], muscular: [147, 160] },
  { lo: 28, hi: 30, height: "5'7\"", slender: [125, 139], average: [140, 152], muscular: [153, 165] },
  { lo: 31, hi: 33, height: "5'8\"", slender: [129, 142], average: [143, 156], muscular: [157, 169] },
  { lo: 34, hi: 36, height: "5'9\"", slender: [132, 145], average: [146, 160], muscular: [161, 174] },
  { lo: 37, hi: 39, height: "5'10\"", slender: [136, 155], average: [156, 180], muscular: [180, 210] },
  { lo: 40, hi: 45, height: "5'11\"", slender: [140, 159], average: [159, 170], muscular: [170, 184] },
  { lo: 46, hi: 49, height: "6'0\"", slender: [144, 166], average: [167, 176], muscular: [176, 189] },
  { lo: 50, hi: 54, height: "6'1\"", slender: [148, 170], average: [170, 180], muscular: [181, 195] },
  { lo: 55, hi: 58, height: "6'2\"", slender: [152, 174], average: [175, 188], muscular: [189, 200] },
  { lo: 59, hi: 62, height: "6'3\"", slender: [156, 178], average: [179, 192], muscular: [192, 205] },
  { lo: 63, hi: 66, height: "6'4\"", slender: [160, 182], average: [183, 196], muscular: [197, 209] },
  { lo: 67, hi: 71, height: "6'5\"", slender: [164, 188], average: [189, 199], muscular: [200, 216] },
  { lo: 72, hi: 75, height: "6'6\"", slender: [168, 194], average: [195, 204], muscular: [205, 220] },
  { lo: 76, hi: 79, height: "6'7\"", slender: [170, 197], average: [198, 208], muscular: [209, 226] },
  { lo: 80, hi: 83, height: "6'8\"", slender: [172, 202], average: [203, 214], muscular: [215, 232] },
  { lo: 84, hi: 88, height: "6'9\"", slender: [178, 206], average: [207, 222], muscular: [223, 242] },
  { lo: 89, hi: 92, height: "6'10\"", slender: [187, 211], average: [212, 230], muscular: [231, 250] },
  { lo: 93, hi: 96, height: "6'11\"", slender: [192, 220], average: [221, 238], muscular: [239, 264] },
  { lo: 97, hi: 100, height: "7'0\"", slender: [201, 229], average: [230, 246], muscular: [247, 275] }
];

export const WEIGHT_MODS = [
  { lo: 1, hi: 1, ranks: ["feeble", "poor", "shift0"], mult: 0.8, label: "Feeble to Poor ×0.8" },
  { ranks: ["typical"], mult: 1, label: "Typical, no change" },
  { ranks: ["good", "excellent"], mult: 1.25, label: "Good to Excellent ×1.25" },
  { ranks: ["remarkable", "incredible"], mult: 1.5, label: "Remarkable to Incredible ×1.5" },
  { ranks: ["amazing", "monstrous"], mult: 2, label: "Amazing to Monstrous ×2" },
  { ranks: ["unearthly"], mult: 3, label: "Unearthly ×3" },
  { ranks: ["shiftx", "shifty", "shiftz", "cl1000", "cl3000", "cl5000", "beyond"], mult: 4, label: "Shift X and above ×4" }
];

export function statureText(row) {
  const span = (id) => `${row[id][0]}–${row[id][1]} lb`;
  return `${row.height} — slender ${span("slender")}, average ${span("average")}, muscular ${span("muscular")}`;
}

export function heightAndWeight(buildRoll, sizeRoll, strengthId, weightRoll = 50) {
  const build = band(BUILDS, buildRoll);
  const row = band(STATURE, sizeRoll);
  const [low, high] = row[build.id];
  const t = Math.min(100, Math.max(1, Number(weightRoll) || 50)) / 100;
  const base = Math.round(low + (high - low) * t);
  const mod = WEIGHT_MODS.find((entry) => entry.ranks.includes(strengthId)) || WEIGHT_MODS[1];
  return {
    build: build.label,
    height: row.height,
    weight: `${Math.max(1, Math.round(base * mod.mult))} lb`,
    modifier: mod.label
  };
}

export const CALLINGS = [
  { label: "Adventurer", note: "Chases danger to feel alive." },
  { label: "Animal Nature", note: "Fights a savage impulse that can take the wheel." },
  { label: "Demolisher", note: "Takes pride in raw destruction." },
  { label: "Exemplar", note: "Stands in public for a people or a tradition." },
  { label: "Explorer", note: "Lives to find new places and new ideas." },
  { label: "Gloryhound", note: "Needs the crowd to see the win." },
  { label: "Greed", note: "Wants more wealth after already having enough." },
  { label: "Guardian", note: "Protects particular people or a home first." },
  { label: "Idealist", note: "Will risk death for a cause." },
  { label: "Investigator", note: "Unravels mysteries, especially when the answer helps." },
  { label: "Majesty", note: "Leads a people and spends power on their behalf." },
  { label: "Mentor", note: "Trains others and tests whether they can stand alone." },
  { label: "Outcast", note: "Is feared or hated and trusts only unbiased allies." },
  { label: "Peace of Mind", note: "Works to quiet an inner conflict." },
  { label: "Protector", note: "Steps in whenever a stranger is in danger." },
  { label: "Repentant", note: "Does good to pay for an old wrong." },
  { label: "Responsibility of Power", note: "Never asked for power and uses it because someone must." },
  { label: "Soldier", note: "Follows or gives orders unless they break a personal code." },
  { label: "Thrill Seeker", note: "Acts for the rush." },
  { label: "Uncontrolled Power", note: "Powers can slip and force a regretted act." },
  { label: "Vengeance", note: "Will pay any price to settle one wrong." },
  { label: "Vestige of Humanity", note: "Is not fully human and wants feelings others take for granted." },
  { label: "World Domination", note: "Wants dominion and answers resistance with force." },
  { label: "Youthful Exuberance", note: "Treats the heroic life as a game and tunes out instructions." }
];

function quirk(lo, hi, name, points, note) {
  return { lo, hi, name, points, note };
}

export const QUIRK_TYPES = [
  { lo: 1, hi: 33, id: "physical", label: "Physical" },
  { lo: 34, hi: 66, id: "mental", label: "Mental" },
  { lo: 67, hi: 100, id: "social", label: "Personal / social" }
];

export const QUIRKS = {
  physical: {
    positive: [
      quirk(1, 7, "Acceleration Tolerance", 1, "Sudden speed changes bother this body less."),
      quirk(8, 13, "Adrenal Surge", 1, "Once a day, Strength rises +1 CS for 1d10 turns."),
      quirk(14, 20, "Ambidexterity", 1, "Either hand works without the off-hand penalty."),
      quirk(21, 27, "Fighting Logistics", 1, "After a few rounds against one foe, Fighting FEATs against them gain +1 CS."),
      quirk(28, 33, "Gravity Tolerance", 1, "Endurance FEATs against gravity shifts are +2 CS, and that damage drops 2 CS."),
      quirk(34, 40, "Hardiness", 2, "Health is 20% above the F+A+S+E total."),
      quirk(41, 47, "High Pain Threshold", 1, "Endurance resists pain and Stun at +2 CS."),
      quirk(48, 53, "Learned Resistance", 1, "Name one hazard. Endurance FEATs against it are +1 CS. Can be taken again."),
      quirk(54, 60, "Natural Talent", 1, "Name one skill. FEATs with it are +1 CS. Can be taken again."),
      quirk(61, 67, "Omnidexterity", 2, "Feet and extra limbs act almost as well as the main hand."),
      quirk(68, 73, "Rank Increase", 2, "One physical ability or power starts +1 CS. Can be taken again."),
      quirk(74, 80, "Rapid Healing", 1, "Healing uses Endurance as if it were +4 CS."),
      quirk(81, 87, "Sensory Increase", 1, "Name one sense. Intuition FEATs with it are +1 CS."),
      quirk(88, 93, "Strong Bones", 1, "Bones count as tougher than Typical. Each level reduces some blunt damage. Can be taken again."),
      quirk(94, 100, "Sturdiness", 1, "Negative Health uses Endurance as if it were +1 CS.")
    ],
    negative: [
      quirk(1, 6, "Acceleration Intolerance", 1, "Picks up speed one area per turn slower, minimum half an area."),
      quirk(7, 12, "Albinism", 1, "Direct sun imposes -1 CS until the character is in shade."),
      quirk(13, 18, "Allergy", 1, "Name a substance. Resistance to it is -1 CS, or damage from it is +1 CS. Can be taken again."),
      quirk(19, 24, "Colorblind", 1, "Color cues are missing or reduced to one confusion."),
      quirk(25, 30, "Dwarfism", 1, "Disproportionately short. Clothes and gear must be made to fit."),
      quirk(31, 36, "Epilepsy", 1, "A fit is coming. Red Endurance and Psyche both, or 1d10 turns at -4 CS."),
      quirk(37, 42, "Feebleness", 1, "Negative Health uses Endurance as if it were -1 CS."),
      quirk(43, 48, "Gigantism", 1, "Disproportionately tall. Ordinary rooms and gear do not fit."),
      quirk(49, 54, "Gravity Intolerance", 1, "Endurance FEATs for gravity changes are -2 CS."),
      quirk(55, 60, "Lameness", 1, "One limb or organ works below par. Name the part and the penalty."),
      quirk(61, 66, "Low Pain Threshold", 1, "Pain resistance is -2 CS."),
      quirk(67, 72, "Missing Parts", 1, "One body part is absent. The Judge sets the limit."),
      quirk(73, 78, "Rank Decrease", 2, "One physical ability or power starts -1 CS. Can be taken again."),
      quirk(79, 84, "Reduced Healing", 1, "Healing uses Endurance as if it were -4 CS, not below Feeble."),
      quirk(85, 90, "Sensory Decrease", 1, "Name one sense. It works at -2 CS. Can be taken again."),
      quirk(91, 95, "Weak Bones", 2, "Blunt damage is about 20% worse."),
      quirk(96, 100, "Weakness", 2, "Health is 20% below the F+A+S+E total.")
    ]
  },
  mental: {
    positive: [
      quirk(1, 8, "3-D Sense", 1, "Position above or below is not a penalty by itself."),
      quirk(9, 15, "Alertness", 1, "Hard to surprise, even while asleep on a yellow Intuition FEAT."),
      quirk(16, 23, "Cyber-immunity", 1, "Psyche is +2 CS when coping with new implants."),
      quirk(24, 31, "Fortitude", 1, "Mental stamina uses Psyche as if it were +1 CS."),
      quirk(32, 38, "High Stress Capacity", 1, "Keeping calm under pressure is +2 CS."),
      quirk(39, 46, "Karmic Shell", 2, "Starting Karma pool is 20% above R+I+P if the table uses that pool."),
      quirk(47, 54, "Magical Potential", 1, "If this hero learns magic, range and similar factors act +1 CS."),
      quirk(55, 61, "Mechanical Aptitude", 1, "Build, use, and repair high-tech gear as if Reason were +2 CS."),
      quirk(62, 69, "Psionic Potential", 1, "Latent mind powers can emerge later without a new origin."),
      quirk(70, 77, "Quick Learning", 1, "New talents take half the time and about three quarters of the Karma."),
      quirk(78, 84, "Rank Increase", 2, "One mental ability or power starts +1 CS. Can be taken again."),
      quirk(85, 92, "Sanity", 1, "Psyche FEATs to stay sane are +2 CS."),
      quirk(93, 100, "Static", 1, "Mental powers aimed at this hero, or anyone within 10 feet, are -1 CS.")
    ],
    negative: [
      quirk(1, 3, "Absent-minded", 1, "Remembering names and plans is a Reason FEAT at -2 CS."),
      quirk(4, 5, "Action Addict", 1, "Boredom forces a Psyche FEAT or the hero goes looking for trouble."),
      quirk(6, 8, "Mental Allergy", 1, "Mental attacks land as if Psyche were -1 CS. Can be taken again."),
      quirk(9, 11, "Attitude", 1, "Acting pleasant takes a Psyche FEAT at -1 CS."),
      quirk(12, 13, "Bloodlust", 1, "In a fight, Psyche at -2 CS or the hero tries to finish a fallen foe."),
      quirk(14, 16, "Bluntness", 1, "Keeping the first thought unspoken is a Reason FEAT at -1 CS."),
      quirk(17, 19, "Bully", 1, "Not pushing a weaker person takes Psyche at -1 CS."),
      quirk(20, 21, "Combat Paralysis", 1, "Each turn of a fight, Psyche at -1 CS or the hero freezes."),
      quirk(22, 24, "Compulsiveness", 1, "Stopping a nervous habit takes Psyche at -1 CS."),
      quirk(25, 27, "Cowardice", 1, "Staying in danger takes Psyche at -1 CS."),
      quirk(28, 29, "Cyber-neurosis", 1, "Psyche is -2 CS against madness brought on by implants."),
      quirk(30, 32, "Delusions", 1, "Ignoring the private world takes Psyche at -1 CS."),
      quirk(33, 35, "Dyslexia", 1, "New study is Reason -2 CS, takes twice as long, and costs half again the Karma."),
      quirk(36, 37, "Fanatic", 1, "When the cause is insulted or advanced, Psyche at -2 CS or the hero acts."),
      quirk(38, 40, "Greed", 1, "Walking away from a fortune is Psyche at -1 CS."),
      quirk(41, 43, "Gullibility", 1, "Disbelieving a lie is Reason at -1 CS."),
      quirk(44, 45, "Honesty", 1, "Telling a lie takes Psyche at -1 CS."),
      quirk(46, 48, "Impulsiveness", 1, "Not acting on the first idea is Reason at -1 CS."),
      quirk(49, 51, "Inept", 1, "Ordinary tasks need a Reason FEAT at -1 CS."),
      quirk(52, 53, "Insanity", 2, "Perception and action follow a private reality. Hard to play."),
      quirk(54, 56, "Insomnia", 1, "Sleep takes Psyche at -2 CS. A failed night is -1 CS the next day."),
      quirk(57, 59, "Jealousy", 1, "Hiding spite takes Psyche at -1 CS."),
      quirk(60, 61, "Karma Deficiency", 2, "A Karma pool based on R+I+P starts 20% low."),
      quirk(62, 64, "Laziness", 1, "Starting a chore takes Psyche at -1 CS."),
      quirk(65, 67, "Mania", 1, "Name the obsession. Resisting it is Psyche at -1 CS. Can be taken again."),
      quirk(68, 69, "Multiple Personality", 1, "Each level adds another personality with its own Reason, Intuition, and Psyche."),
      quirk(70, 72, "Pacifism", 1, "Choosing violence takes Psyche at -1 CS."),
      quirk(73, 75, "Paranoia", 1, "Trusting someone new takes Psyche at -1 CS."),
      quirk(76, 77, "Personal Code", 1, "Breaking the private code takes Psyche at -1 CS."),
      quirk(78, 80, "Phobia", 1, "Name the fear. Facing it is Psyche at -2 CS."),
      quirk(81, 83, "Pushover", 1, "Mental stamina uses Psyche as if it were -1 CS."),
      quirk(84, 85, "Rank Decrease", 2, "One mental ability or power starts -1 CS."),
      quirk(86, 88, "Rudeness", 1, "Being civil on purpose takes Psyche at -1 CS."),
      quirk(89, 91, "Shyness", 1, "Speaking up in public takes Psyche at -1 CS."),
      quirk(92, 93, "Stubbornness", 1, "Admitting someone else is right takes Psyche at -1 CS."),
      quirk(94, 96, "Temper", 1, "Not losing it, and cooling off, are Psyche at -1 CS."),
      quirk(97, 100, "Vow", 1, "A sworn task. Ignoring a chance to advance it is Psyche at -2 CS.")
    ]
  },
  social: {
    positive: [
      quirk(1, 9, "Ally", 1, "A true friend who will take a real risk to help."),
      quirk(10, 18, "Assistant", 1, "A sidekick, tech, or partner who shows up for the work."),
      quirk(19, 27, "Attractiveness", 1, "Popularity is +1 CS with people inclined to notice. Can be taken again."),
      quirk(28, 36, "Benefactor", 1, "Someone else's money backs the cause."),
      quirk(37, 45, "Cash Flow", 1, "Resources sit one step above the rolled rank."),
      quirk(46, 54, "Charmed", 1, "Every tenth roll of a companion is rearranged in their favor."),
      quirk(55, 63, "Fame", 1, "Popularity shifts +1 CS, for good or ill. Can be taken again."),
      quirk(64, 72, "Fan Club", 1, "With fans, Popularity is about +3 CS."),
      quirk(73, 81, "Likeability", 1, "NPC reactions land one step kinder unless they are already hostile."),
      quirk(82, 90, "Luckiness", 1, "Every tenth roll swaps the dice so the higher die is tens."),
      quirk(91, 100, "Reputation", 1, "People who know the reputation react at +1 CS. Betraying it sours that.")
    ],
    negative: [
      quirk(1, 7, "Alien Customs", 1, "Home culture clashes here. Popularity is -2 CS with people who resent it. Can be taken again."),
      quirk(8, 13, "Bigotry", 1, "A named group is looked down on. Hiding it is Psyche at -1 CS."),
      quirk(14, 20, "Disgusting Personal Habits", 1, "Each level is -1 CS Popularity."),
      quirk(21, 27, "Dependent", 1, "Someone relies on this hero and gets into trouble."),
      quirk(28, 33, "Enemy", 1, "A foe of equal measure. Extra levels add power or another foe."),
      quirk(34, 40, "Illiteracy", 1, "Cannot read or write until it is actually learned."),
      quirk(41, 47, "Jinxed", 1, "Every tenth roll of a random companion is rearranged against them."),
      quirk(48, 53, "Loner", 1, "Crowds force Psyche at -1 CS or the hero leaves. Can be taken again."),
      quirk(54, 60, "Nerd", 1, "Reactions from people who prize cool are -2 CS."),
      quirk(61, 67, "Repugnant Personality", 1, "Each level is -1 CS Popularity."),
      quirk(68, 73, "Snob", 1, "Outside the clique, Popularity acts as -2 CS."),
      quirk(74, 80, "Social Dependent", 1, "Decisions made alone take Psyche at -1 CS per level."),
      quirk(81, 87, "Unattractiveness", 1, "Romantic or social reactions are -1 CS. Can be taken again."),
      quirk(88, 93, "Unluckiness", 1, "Every tenth roll swaps the dice so the lower die is tens."),
      quirk(94, 100, "Weirdness Magnet", 1, "Strange events keep finding this hero and anyone standing nearby.")
    ]
  }
};

export const LIFE_TABLES = {
  ancestry: [
    { lo: 1, hi: 5, label: "Alaska Native" },
    { lo: 6, hi: 14, label: "American Indian" },
    { lo: 15, hi: 27, label: "Asian" },
    { lo: 28, hi: 45, label: "African American" },
    { lo: 46, hi: 68, label: "Caucasian" },
    { lo: 69, hi: 88, label: "Hispanic" },
    { lo: 89, hi: 94, label: "Native Hawaiian" },
    { lo: 95, hi: 100, label: "Pacific Islander" }
  ],
  gender: [
    { lo: 1, hi: 45, label: "Male" },
    { lo: 46, hi: 100, label: "Female" }
  ],
  marital: [
    { lo: 1, hi: 20, label: "Divorced" },
    { lo: 21, hi: 35, label: "Partnered, no children" },
    { lo: 36, hi: 65, label: "Single" },
    { lo: 66, hi: 76, label: "Partnered, with children" },
    { lo: 77, hi: 85, label: "Single, with children" },
    { lo: 86, hi: 92, label: "Separated" },
    { lo: 93, hi: 100, label: "Widowed" }
  ],
  orientation: [
    { lo: 1, hi: 4, label: "Homosexual" },
    { lo: 5, hi: 10, label: "Bisexual" },
    { lo: 11, hi: 90, label: "Heterosexual" },
    { lo: 91, hi: 94, label: "Bisexual" },
    { lo: 95, hi: 100, label: "Homosexual" }
  ],
  class: [
    { lo: 1, hi: 3, label: "Homeless" },
    { lo: 4, hi: 8, label: "Deep poverty" },
    { lo: 9, hi: 16, label: "Lower class" },
    { lo: 17, hi: 30, label: "Paycheck to paycheck" },
    { lo: 31, hi: 80, label: "Middle class" },
    { lo: 81, hi: 90, label: "Upper middle class" },
    { lo: 91, hi: 97, label: "Upper class" },
    { lo: 98, hi: 100, label: "Wealthy" }
  ],
  family: [
    { lo: 1, hi: 5, label: "Four or more siblings" },
    { lo: 6, hi: 15, label: "Three siblings" },
    { lo: 16, hi: 30, label: "Two siblings" },
    { lo: 31, hi: 65, label: "One sibling" },
    { lo: 66, hi: 80, label: "Only child" },
    { lo: 81, hi: 85, label: "A sibling has died" },
    { lo: 86, hi: 90, label: "One parent has died" },
    { lo: 91, hi: 95, label: "Orphan" },
    { lo: 96, hi: 100, label: "Foster child" }
  ],
  record: [
    { lo: 1, hi: 2, label: "Felony" },
    { lo: 3, hi: 8, label: "Misdemeanor" },
    { lo: 9, hi: 92, label: "No criminal record" },
    { lo: 93, hi: 98, label: "Misdemeanor" },
    { lo: 99, hi: 100, label: "Felony" }
  ],
  body: [
    { lo: 1, hi: 5, label: "Underweight" },
    { lo: 6, hi: 20, label: "Overweight" },
    { lo: 21, hi: 25, label: "Muscular" },
    { lo: 26, hi: 40, label: "Ordinary" },
    { lo: 41, hi: 60, label: "Toned" },
    { lo: 61, hi: 75, label: "Ordinary" },
    { lo: 76, hi: 80, label: "Muscular" },
    { lo: 81, hi: 95, label: "Overweight" },
    { lo: 96, hi: 100, label: "Underweight" }
  ],
  statureBand: [
    { lo: 1, hi: 2, label: "Dwarf" },
    { lo: 3, hi: 12, label: "Petite" },
    { lo: 13, hi: 20, label: "A bit over average" },
    { lo: 21, hi: 80, label: "Ordinary height" },
    { lo: 81, hi: 87, label: "A bit over average" },
    { lo: 88, hi: 97, label: "Tall" },
    { lo: 98, hi: 100, label: "Giant" }
  ],
  age: [
    { lo: 1, hi: 8, label: "13–16" },
    { lo: 9, hi: 16, label: "16–18" },
    { lo: 17, hi: 24, label: "19–25" },
    { lo: 25, hi: 75, label: "26–35" },
    { lo: 76, hi: 84, label: "36–45" },
    { lo: 85, hi: 92, label: "46–60" },
    { lo: 93, hi: 100, label: "60+" }
  ],
  capability: [
    { lo: 1, hi: 3, label: "Mental limit" },
    { lo: 4, hi: 6, label: "Social limit" },
    { lo: 7, hi: 10, label: "Physical limit" },
    { lo: 11, hi: 90, label: "No notable limit" },
    { lo: 91, hi: 100, label: "Heroic edge" }
  ],
  looks: [
    { lo: 1, hi: 5, label: "Ugly" },
    { lo: 6, hi: 12, label: "Unattractive" },
    { lo: 13, hi: 23, label: "Plain" },
    { lo: 24, hi: 76, label: "Average" },
    { lo: 77, hi: 87, label: "Good-looking" },
    { lo: 88, hi: 95, label: "Striking" },
    { lo: 96, hi: 100, label: "Extremely attractive" }
  ],
  extra: [
    { lo: 1, hi: 1, label: "Acne" },
    { lo: 2, hi: 2, label: "Bald or balding" },
    { lo: 3, hi: 3, label: "Clumsy" },
    { lo: 4, hi: 4, label: "Slight build through the chest" },
    { lo: 5, hi: 5, label: "Nervous habit" },
    { lo: 6, hi: 8, label: "A large facial feature" },
    { lo: 9, hi: 92, label: "None" },
    { lo: 93, hi: 96, label: "No muscle tone" },
    { lo: 97, hi: 97, label: "Very pale" },
    { lo: 98, hi: 98, label: "Smoker" },
    { lo: 99, hi: 99, label: "Heavy brows or facial hair" },
    { lo: 100, hi: 100, label: "An odd voice" }
  ]
};

export const ARMOR_FASE = [
  { lo: 1, hi: 10, cs: 0, label: "Unchanged" },
  { lo: 11, hi: 20, cs: 1, label: "+1 CS" },
  { lo: 21, hi: 45, cs: 2, label: "+2 CS" },
  { lo: 46, hi: 75, cs: 3, label: "+3 CS" },
  { lo: 76, hi: 95, cs: 4, label: "+4 CS" },
  { lo: 96, hi: 100, cs: 5, label: "+5 CS" }
];

export const ARMOR_RANKS = [
  { lo: 1, hi: 5, id: "feeble" },
  { lo: 6, hi: 10, id: "poor" },
  { lo: 11, hi: 20, id: "typical" },
  { lo: 21, hi: 40, id: "good" },
  { lo: 41, hi: 55, id: "excellent" },
  { lo: 56, hi: 80, id: "remarkable" },
  { lo: 81, hi: 95, id: "incredible" },
  { lo: 96, hi: 100, id: "amazing" }
];

export const ARMOR_DAMAGE = [
  { lo: 1, hi: 20, label: "One power at -2 CS" },
  { lo: 21, hi: 40, label: "One FASE bonus at -2 CS" },
  { lo: 41, hi: 65, label: "One power inoperative" },
  { lo: 66, hi: 90, label: "All powers at -1 CS" },
  { lo: 91, hi: 94, label: "All FASE bonuses at -1 CS" },
  { lo: 95, hi: 98, label: "All FASE bonuses and powers at -2 CS" },
  { lo: 99, hi: 100, label: "Overload. FASE bonuses -2 CS. All but one power inoperative." }
];

export const ARMOR_POWERS = [
  "Body Armor", "Force Field", "Resistance to Energy", "Resistance to Physical",
  "Circular Vision", "Energy Detection", "Hypersensitive Hearing", "Hypersensitive Touch",
  "Life Detection", "Microscopic Vision", "Penetration Vision", "Radar Sense", "Sonar",
  "Telescopic Vision", "Thermal Vision", "Ultraviolet Vision", "Electrical Control",
  "Energy Absorption", "Hard Radiation", "Magnetic Manipulation", "Energy Emission",
  "Weapons Creation", "Illusion", "Sleep", "Bonding", "Machine Animation", "Disintegration",
  "Missile Creation", "Spray", "Webcasting", "Clairaudience", "Clairvoyance",
  "Communicate with Machines", "Danger Sense", "Speech Throw", "Total Memory",
  "Lightning Speed", "Lung Adaptability", "Stealth", "Waterbreathing", "Water Freedom",
  "Blending", "Invisibility", "Gliding", "Digging", "Leaping", "Hyper-Running",
  "Swimming", "Rocket"
];

export const CYBORG_COLUMNS = {
  fighting: [[1, 3, "feeble"], [4, 8, "poor"], [9, 20, "typical"], [21, 35, "good"], [36, 60, "excellent"], [61, 80, "remarkable"], [81, 95, "incredible"], [96, 100, "amazing"]],
  agility: [[1, 2, "feeble"], [3, 6, "poor"], [7, 20, "typical"], [21, 40, "good"], [41, 70, "excellent"], [71, 90, "remarkable"], [91, 100, "incredible"]],
  strength: [[1, 5, "feeble"], [6, 20, "poor"], [21, 60, "typical"], [61, 90, "good"], [91, 100, "excellent"]],
  endurance: [[1, 5, "feeble"], [6, 10, "poor"], [11, 20, "typical"], [21, 40, "good"], [41, 80, "excellent"], [81, 100, "remarkable"]],
  reason: [[1, 10, "feeble"], [11, 25, "poor"], [26, 45, "typical"], [46, 75, "good"], [76, 95, "excellent"], [96, 100, "remarkable"]],
  intuition: [[1, 10, "feeble"], [11, 25, "poor"], [26, 40, "typical"], [41, 60, "good"], [61, 80, "excellent"], [81, 97, "remarkable"], [98, 100, "incredible"]],
  psyche: [[1, 15, "feeble"], [16, 30, "poor"], [31, 60, "typical"], [61, 80, "good"], [81, 100, "excellent"]]
};

export const CYBORG_BUDGET = [
  { lo: 1, hi: 10, count: 3, total: 20, max: 10 },
  { lo: 11, hi: 20, count: 4, total: 30, max: 10 },
  { lo: 21, hi: 35, count: 5, total: 40, max: 15 },
  { lo: 36, hi: 55, count: 6, total: 50, max: 18 },
  { lo: 56, hi: 70, count: 6, total: 65, max: 20 },
  { lo: 71, hi: 85, count: 7, total: 70, max: 25 },
  { lo: 86, hi: 98, count: 7, total: 90, max: 30 },
  { lo: 99, hi: 100, count: 8, total: 120, max: 99 }
];

export const IMPLANTS = [
  ["Chemical Analyzer", "cyber", 4, "typical", "Chemistry FEATs +2 CS."],
  ["Datajack", "cyber", 4, "good", "Plug into machines. Computer work at Reason."],
  ["Encephalon I", "cyber", 15, "excellent", "Reason +1 CS."],
  ["Encephalon II", "cyber", 35, "excellent", "Reason +2 CS."],
  ["Memory Store", "cyber", 6, "good", "Holds recorded data. Needs a datajack to use."],
  ["Scent Booster", "cyber", 4, "typical", "Scent at Remarkable."],
  ["Orientation System", "cyber", 8, "good", "Knows location and maps on a charted world."],
  ["Skill Jack", "cyber", 5, "good", "Two chip slots for professional skills."],
  ["Tactical Computer", "cyber", 60, "remarkable", "Tags foes and grants a CS bonus on later attacks."],
  ["Commlink", "cyber", 6, "good", "Implanted short-range radio."],
  ["Crypto Circuit", "cyber", 2, "excellent", "Scrambles signals at Incredible."],
  ["Radio", "cyber", 12, "typical", "Longer-range transmitter. Easier to overhear."],
  ["Balance Augmentation", "cyber", 8, "good", "Acrobatics and tumbling +2 CS."],
  ["Sonic Damper", "cyber", 2, "typical", "Excellent resistance to sonic attacks."],
  ["Hearing Amp", "cyber", 4, "typical", "Hearing at Remarkable."],
  ["Low-light Eyes", "cyber", 4, "typical", "Darkness penalties are 2 CS lighter."],
  ["Vision Magnifier", "cyber", 4, "typical", "Telescopic vision at Feeble."],
  ["Thermographic Eyes", "cyber", 4, "typical", "Thermal vision at Incredible."],
  ["Eye Dart", "cyber", 5, "typical", "One Poor shot, then a reload and a brief penalty."],
  ["Retractable Razors", "cyber", 4, "good", "Excellent edged damage."],
  ["Internal Air", "cyber", 5, "typical", "Breath-holding Endurance +4 CS."],
  ["Bone Lacing", "cyber", 23, "good", "Typical body armor and a small damage bonus."],
  ["Armored Torso", "cyber", 25, "excellent", "Typical torso armor. Limb strength costs less threshold."],
  ["Armored Skull", "cyber", 13, "excellent", "Poor armor on the head."],
  ["Cyber Limb", "cyber", 20, "excellent", "A replacement limb with Typical armor."],
  ["Muscle Replacement", "cyber", 20, "excellent", "Strength and Agility +1 CS. Further levels cost more."],
  ["Smartlink", "cyber", 5, "typical", "Firearms +1 CS if the gun is built for the link."],
  ["Dermal Plating", "cyber", 10, "good", "Body armor from the points spent."],
  ["Filter Lungs", "cyber", 8, "excellent", "Excellent resistance to gas and poison."],
  ["Skill Wires", "cyber", 30, "remarkable", "Up to ten skill chips."],
  ["Wired Reflexes", "cyber", 40, "excellent", "+2 initiative and +1 CS attacks. Not with other reflex kits."],
  ["Boosted Reflexes", "cyber", 10, "good", "+1 initiative. Not with wired reflexes."],
  ["Platelet Factory", "bio", 4, "good", "Damage -1 CS. Needs a daily anticoagulant."],
  ["Symbiote I", "bio", 4, "good", "Feeble regeneration. Eats more."],
  ["Synthacardium", "bio", 2, "good", "Endurance +1 CS."],
  ["Orthoskin", "bio", 5, "good", "Poor body armor. Higher levels cost more."],
  ["Adrenal Pump", "bio", 13, "excellent", "Brief +1 CS to F, A, S, E, and Psyche, then a crash."],
  ["Toxin Extractor", "bio", 4, "good", "Resistance to toxins."],
  ["Cerebral Booster", "bio", 5, "excellent", "Reason and Intuition +1 CS."],
  ["Mnemonic Enhancer", "bio", 4, "good", "Total memory."],
  ["Synaptic Accelerator", "bio", 15, "excellent", "+1 CS attack and +2 initiative."],
  ["Toxin Exhaler", "bio", 6, "good", "Breathe a Remarkable poison. The user is not immune."],
  ["Enhanced Articulation", "bio", 6, "good", "+3 initiative."],
  ["Muscle Augmentation", "bio", 8, "good", "Agility and Strength +1 CS, not above Monstrous."]
];

export const MARTIAL_COLUMNS = {
  fighting: [[1, 5, "feeble"], [6, 10, "poor"], [11, 20, "typical"], [21, 40, "good"], [41, 60, "excellent"], [61, 80, "remarkable"], [81, 95, "incredible"], [96, 100, "amazing"]],
  agility: [[1, 10, "feeble"], [11, 20, "poor"], [21, 40, "typical"], [41, 60, "good"], [61, 80, "excellent"], [81, 95, "remarkable"], [96, 100, "incredible"]],
  strength: [[1, 5, "feeble"], [6, 25, "poor"], [26, 75, "typical"], [76, 95, "good"], [96, 100, "excellent"]],
  endurance: [[1, 5, "feeble"], [6, 10, "poor"], [11, 40, "typical"], [41, 80, "good"], [81, 95, "excellent"], [96, 100, "remarkable"]],
  reason: [[1, 5, "feeble"], [6, 10, "poor"], [11, 40, "typical"], [41, 80, "good"], [81, 95, "excellent"], [96, 100, "remarkable"]],
  intuition: [[1, 5, "feeble"], [6, 10, "poor"], [11, 20, "typical"], [21, 40, "good"], [41, 60, "excellent"], [61, 80, "remarkable"], [81, 95, "incredible"], [96, 100, "amazing"]],
  psyche: [[1, 5, "feeble"], [6, 10, "poor"], [11, 20, "typical"], [21, 40, "good"], [41, 60, "excellent"], [61, 80, "remarkable"], [81, 95, "incredible"], [96, 100, "amazing"]]
};

export const MARTIAL_POWERS = [
  { lo: 1, hi: 6, name: "Pressure Points", note: "Touch can heal, stun, slow a poison, or lock a limb. A killing touch must be taught." },
  { lo: 7, hi: 15, name: "Chi", note: "Psyche fuels a brief FASE boost, a strike, a field, or self-healing. Starts with one stunt." },
  { lo: 16, hi: 25, name: "Chi Absorption", note: "A shoulder strike can steal a point of Fighting and raise one martial power for 1d10 rounds." },
  { lo: 26, hi: 38, name: "Combat Sense", note: "One extra melee attack, ranged attack, or dodge each round." },
  { lo: 39, hi: 47, name: "Deadly Strike", note: "Unarmed damage uses this power's rank. The rank starts at least one step above Strength." },
  { lo: 48, hi: 56, name: "Focus Energy", note: "One round to pour the power into one ability: green +1, yellow +2, red +3 CS." },
  { lo: 57, hi: 63, name: "Hyper-Attack", note: "Chain Fighting or Agility FEATs, or fold extra attacks into one harder blow." },
  { lo: 64, hi: 75, name: "Iron Will", note: "Soak up to this rank in damage, then release half of it for real." },
  { lo: 76, hi: 82, name: "Stealth", note: "Trackers subtract this rank." },
  { lo: 83, hi: 94, name: "Ultimate Skill", note: "One weapon or fighting talent works at Unearthly." },
  { lo: 95, hi: 100, name: "Weakness Detection", note: "After watching a foe act, a power FEAT ignores body armor up to this rank." }
];

export const MARTIAL_STYLES = [
  "Aikido", "Jujitsu", "Shaolin", "Boxing", "Tae Kwon Do", "Karate", "Muay Thai",
  "Brazilian Jiu-Jitsu", "Tai Chi", "Wing Chun", "Pencak Silat", "Jeet Kune Do", "Arnis"
];

export const VAMPIRE_ABILITIES = {
  fighting: "good", agility: "excellent", strength: "remarkable", endurance: "remarkable",
  reason: "typical", intuition: "good", psyche: "excellent"
};

export const VAMPIRE_POWERS = [
  ["Immortality", "unearthly", "Does not age or take disease. Physical Kill and Stun do not stick. Slam still does."],
  ["Animal Transformation", "excellent", "Bat or wolf."],
  ["Animal Communication", "remarkable", "Speak with animals larger than an insect."],
  ["Hypnotic Control", "excellent", "Needs eye contact."],
  ["Heightened Senses", "remarkable", "All five senses."],
  ["Telepathy", "excellent", "Psyche FEAT against a visible mind."],
  ["Astral Projection", "incredible", "Spirit travels unseen."],
  ["Hyper-Speed", "typical", "Quicker than the living body was."],
  ["Blending", "amazing", "Step into shadow."],
  ["Psychic Invisibility", "excellent", "Onlookers fail to notice."],
  ["Emotion Control", "remarkable", "A hiss can force flight unless Psyche resists."],
  ["Night Vision", "excellent", "Sees in natural darkness."],
  ["Claws", "excellent", "Edged damage at Strength +1 CS."],
  ["Wall-Crawling", "incredible", "Including ceilings."],
  ["Regeneration", "excellent", "Silver wounds close at a human rate."],
  ["Bite", "typical", "Blood drain each round. A drained body given vampire blood can rise."]
];

export const VAMPIRE_LIMITS = [
  "Must drink blood. Two days without it is -1 CS everywhere, down to a torpor that ends at the scent of blood.",
  "A stake through the heart suspends, it does not destroy.",
  "Direct sun is Remarkable damage. Zero Health this way is dust.",
  "Holy symbols, holy water, and garlic hold the vampire back while they are present.",
  "Silver burns at Feeble and weapons of it strike at +1 CS. Stun and Slam apply.",
  "No reflection and no image on film. A mirror tempts a Psyche FEAT or the vampire smashes it.",
  "Cannot enter a home without an invitation. Revoking it locks the door again.",
  "Cannot cross running water alone. Immersion can drown until the body is pulled out.",
  "Beyond 100 miles from the birthplace, a pound of home soil is required.",
  "Lasting destruction is heart, then head, then two fires, then the ashes scattered."
];

export const SPACEKNIGHT_FIGHTING = [
  { lo: 1, hi: 60, id: "excellent" },
  { lo: 61, hi: 80, id: "remarkable" },
  { lo: 81, hi: 96, id: "incredible" },
  { lo: 97, hi: 99, id: "amazing" },
  { lo: 100, hi: 100, id: "monstrous" }
];

export const SPACEKNIGHT_BODY = [
  { lo: 1, hi: 10, id: "excellent" },
  { lo: 11, hi: 30, id: "remarkable" },
  { lo: 31, hi: 70, id: "incredible" },
  { lo: 71, hi: 90, id: "amazing" },
  { lo: 91, hi: 100, id: "monstrous" }
];

export const SPACEKNIGHT_ENDURANCE = [
  { lo: 1, hi: 30, id: "amazing" },
  { lo: 31, hi: 90, id: "monstrous" },
  { lo: 91, hi: 100, id: "unearthly" }
];

export const MORLOCK = {
  fighting: { average: "good", below: 5, above: 92, way: 99 },
  agility: { average: "typical", below: 3, above: 96, way: 100 },
  strength: { average: "poor", below: 3, above: 90, way: 98 },
  endurance: { average: "excellent", below: 5, above: 92, way: 99 },
  reason: { average: "poor", below: 5, above: 92, way: 99 },
  intuition: { average: "good", below: 3, above: 90, way: 98 },
  psyche: { average: "poor", below: 5, above: 92, way: 99 }
};

export const ELDER_POWERS = [
  ["Immortality", "cl1000", "Death is temporary unless the obsession dies. Then the Elder dies at once."],
  ["Power Primordial", "unearthly", "A framework. Extra powers should serve the obsession."],
  ["Invulnerability", "cl1000", "Disease, poison, and aging do not take."],
  ["Resistance to Pressure", "unearthly", "Vacuum and crushing air are survivable."],
  ["Self Sustenance", "unearthly", "No need for food, drink, or air."],
  ["Telepathy", "feeble", "Enough to speak, even in space."]
];

export const ELDER_PASSIONS = [
  "Collecting rarities", "Games of strategy", "Cultivating living worlds", "The hunt",
  "Judging other beings", "One unfinished science", "Physical perfection", "An errand that cannot be completed"
];

export function columnRank(table, roll) {
  const n = Math.min(100, Math.max(1, Number(roll) || 1));
  const row = table.find((entry) => n >= entry[0] && n <= entry[1]);
  return row ? row[2] : table[table.length - 1][2];
}

/**
 * Original mechanical blurbs for catalog Powers and Talents.
 * These are fan-written play aids, not reprinted rulebook text.
 */

export function catalogKey(name) {
  return String(name || "")
    .replace(/\s*\(counts as two[^)]*\)/gi, "")
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/[\u2014\u2013]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export const POWER_DEFINITIONS = {
  "resistance to fire and heat": "Ignore or reduce fire and heat damage. Compare this Power rank to the attack rank; a successful FEAT lessens or cancels the effect.",
  "resistance to cold": "Ignore or reduce cold and ice damage. Compare this Power rank to the attack rank; a successful FEAT lessens or cancels the effect.",
  "resistance to electricity": "Ignore or reduce electrical damage. Compare this Power rank to the attack rank; a successful FEAT lessens or cancels the effect.",
  "resistance to radiation": "Ignore or reduce radiation damage and related Intensity effects. Compare this Power rank to the attack or environmental rank.",
  "resistance to toxins": "Ignore or reduce poisons, venoms, and chemical toxins. Roll a FEAT against the toxin Intensity.",
  "resistance to corrosives": "Ignore or reduce acid and corrosive damage. Compare this Power rank to the attack rank.",
  "resistance to emotion attacks": "Resist fear, rage, love, and other emotion Powers. Roll a FEAT against the attacking Power rank.",
  "resistance to mental attacks": "Resist telepathy, mind control, and similar mental Powers. Roll a FEAT against the attacking Power rank.",
  "resistance to magical attacks": "Resist spells and magical effects aimed at the hero. Roll a FEAT against the attacking Power or spell rank.",
  "resistance to disease": "Resist infection and disease Intensities. A successful FEAT prevents or shortens the illness.",
  "resistance to energy attacks": "Resist generic energy bolts and similar attacks. Compare this Power rank to the incoming energy rank.",
  "invulnerability": "Two-slot Power. The hero is extremely hard to injure by the chosen attack form. Treat most attacks of lower rank as ineffective; the Judge may still allow exotic or higher-rank threats.",
  "protected senses": "Sight, hearing, or other chosen senses shrug off blinding flashes, sonic shocks, and similar overloads. Roll a FEAT against the attack Intensity.",
  "enhanced senses": "One or more senses operate at this Power rank. Use it for notice, track, or identify FEATs the Judge would normally assign to Intuition.",
  "infravision": "See heat patterns in darkness. Range and detail use this Power rank. Smoke and intense heat can still interfere.",
  "cosmic awareness": "Two-slot Power. The hero may ask the Judge a broad question about a distant event or hidden truth. Success and detail depend on a FEAT at this rank.",
  "combat sense": "Two-slot Power. The hero is rarely surprised and may substitute this rank for Intuition when spotting an incoming attack.",
  "computer links": "Interface with computers and digital systems at this Power rank. Security and unfamiliar machines may require a FEAT.",
  "emotion detection": "Sense strong emotions nearby. A FEAT at this rank reveals mood, and a better color may identify the source.",
  "energy detection": "Sense energy sources, power use, and similar signatures. Range and precision use this Power rank.",
  "magic detection": "Sense active magic and enchanted objects. Range and precision use this Power rank.",
  "magnetic detection": "Sense magnetic fields, ferrous masses, and similar distortions. Range uses this Power rank.",
  "mutant detection": "Sense nearby mutants or similar unusual life signatures if the campaign uses that distinction. Range uses this Power rank.",
  "psionic detection": "Sense active telepathy and other mental Powers. Range uses this Power rank.",
  "astral detection": "Sense astral forms, ghosts, and similar out-of-body presence. Range uses this Power rank.",
  "tracking ability": "Follow a trail by scent, psychic residue, or similar means. Roll a FEAT against time passed, weather, or concealment.",
  "flight": "Move through the air. Speed and maneuvering use this Power rank. Landing in a tight space or fighting while flying may require a FEAT.",
  "gliding": "Descend and travel on air currents. The hero cannot usually gain altitude without a thermal or similar aid.",
  "leaping": "Jump a number of areas based on this Power rank. A FEAT may be required for a precise landing.",
  "wall-crawling": "Cling to walls and ceilings. Slippery or greased surfaces may require a FEAT at this rank.",
  "lightning speed": "Move on the ground at high speed. Areas per turn follow this Power rank. Turning, stopping, and fine tasks at speed may need a FEAT.",
  "teleportation": "Two-slot Power. Instantly move to a known or seen location within range derived from this rank. A FEAT may be required if the destination is unseen or blocked.",
  "levitation": "Rise and hover. Horizontal travel is limited compared with true flight. Speed uses this Power rank.",
  "swimming": "Move through water at this Power rank and operate comfortably below the surface for a short time.",
  "climbing": "Scale surfaces that would stall an ordinary athlete. Difficult or inverted climbs use this Power rank.",
  "digging": "Tunnel through earth and similar material. Speed and the material rank that can be bored use this Power rank.",
  "dimensional travel": "Two-slot Power. Cross into another dimension or plane. Arrival point and return usually require a FEAT at this rank.",
  "earth control": "Shape, move, or hurl earth and stone. Effect Intensity and range use this Power rank.",
  "air control": "Shape wind, create buffers of air, or slam foes with gusts. Intensity and range use this Power rank.",
  "fire control": "Ignite, shape, or extinguish fire that is already present. Creating fire from nothing may require a related Generation Power.",
  "water control": "Move and shape water. Intensity and range use this Power rank. Large open water is easier than a sealed pipe.",
  "weather control": "Shift local weather toward rain, wind, fog, or storm. Large or sudden changes require a FEAT at this rank.",
  "density manipulation - others": "Raise or lower another character's density. Higher density can add toughness and cut movement; lower density can allow passage through matter.",
  "body transformation - others": "Change another character's physical state (for example gas, liquid, or a chosen material). The target may resist with a FEAT.",
  "animal transformation - others": "Turn another character into an animal form. The target may resist with a FEAT against this Power rank.",
  "body manipulation - others": "Warp another character's anatomy or posture. The target may resist; lasting harm is a Judge call.",
  "animate objects": "Give limited motion to objects. The animation's Strength and control use this Power rank.",
  "magnetic manipulation": "Move ferrous metal and related fields. Strength and range use this Power rank.",
  "electrical manipulation": "Shape existing electricity, overload devices, or redirect current. Intensity uses this Power rank.",
  "light manipulation": "Brighten, dim, or bend light. Blinding bursts and concealment are FEATs at this rank.",
  "sound manipulation": "Amplify, mute, or shape sound. Sonic attacks and silence fields use this Power rank.",
  "darkforce manipulation": "Shape a dark extra-dimensional energy used as blasts, tendrils, or shadow fields. Intensity uses this Power rank.",
  "gravity manipulation": "Raise or lower gravity in an area. Movement, falling damage, and lifting are affected at this rank.",
  "probability manipulation": "Two-slot Power. Nudge unlikely events. The Judge sets how large a swing a FEAT at this rank can buy.",
  "nullifying power": "Two-slot Power. Suppress another Power for as long as the hero concentrates or until the target wins a FEAT.",
  "energy reflection": "Bounce an energy attack toward another target. A FEAT at this rank is required to catch and redirect it.",
  "time control": "Two-slot Power. Slow, hasten, or briefly loop local time. Exact options are a Judge call; this rank sets how far the effect can reach.",
  "growth": "Increase size and usually Strength or Health while grown. Endurance FEATs may apply if the change is sudden.",
  "shrinking": "Reduce size. Tiny heroes are harder to hit and may slip through small gaps, but Strength and reach drop.",
  "density manipulation - self": "Change the hero's own density. High density adds toughness; low density can pass through obstacles and may cut Strength.",
  "phasing": "Pass through solid matter. Electrical systems, force fields, and remaining inside a solid are Judge hazards.",
  "invisibility": "Become unseen. Noise, scent, and special senses can still give the hero away. Attacking may break or weaken the effect.",
  "plasticity": "Stretch and flatten the body. Escape bonds, squeeze through gaps, or reach extra areas at this rank.",
  "elongation": "Extend limbs or the torso. Reach and some grappling uses follow this Power rank.",
  "shape-shifting": "Take other humanoid or simple forms. Detailed copies of a specific person may require Imitation or a FEAT.",
  "imitation": "Copy a known person's appearance and voice. Close friends may still see through it on a good Intuition FEAT.",
  "body transformation": "Change the hero's own body into another state or material. Duration and remaining Power use are a Judge call.",
  "animal transformation - self": "Take an animal form. Abilities shift toward that animal; speech and hands may be lost.",
  "raise lowest ability": "Permanently or while active, lift the hero's weakest FASERIP ability toward this Power rank. The Judge chooses whether the change is lasting.",
  "blending": "Match nearby color and texture. Stillness helps; movement or an Intuition FEAT can reveal the hero.",
  "power absorption": "Drain a touched Power for a short time. The target may resist. Overloaded ranks can rebound on the user.",
  "alter ego": "Switch between two identities with different ability spreads or Power sets. Time to change is a Judge call.",
  "projectile missile": "Fire a physical missile. Damage and range use this Power rank. Use the Shooting or Throwing column as appropriate.",
  "ensnaring missile": "Fire a net, line, or similar snare. A hit can hold the target; escaping uses Strength or Agility against this rank.",
  "ice generation": "Create ice as blasts, sheets, or bonds. Intensity and how long the ice lasts use this Power rank.",
  "fire generation": "Create fire as blasts or auras. Intensity uses this Power rank. Uncontrolled fire can spread.",
  "energy generation": "Project a generic energy blast. Damage and range use this Power rank.",
  "sound generation": "Create damaging or stunning sound. Intensity uses this Power rank. Silence and sealed helmets may reduce it.",
  "stunning missile": "Fire a bolt meant to stun rather than injure. Resolve on the appropriate Battle Effects column.",
  "corrosive missile": "Fire an acid or dissolving blast. Material rank of gear and cover matters.",
  "slashing missile": "Fire a cutting projectile. Use Edged results on the Battle Effects Table.",
  "nullifier missile": "Fire a bolt that suppresses Powers on a successful FEAT against the target Power rank.",
  "darkforce generation": "Project darkforce as a blast or field. Intensity uses this Power rank.",
  "telepathy": "Send and receive thoughts. Unwilling minds resist with Psyche against this Power rank.",
  "image generation": "Two-slot Power. Create believable sensory images. Observers may see through them with Intuition or Reason FEATs.",
  "telekinesis": "Move objects at a distance. Effective Strength and range use this Power rank.",
  "mind control": "Two-slot Power. Force another character to follow a command. The target resists with Psyche; extreme orders are harder.",
  "emotion control": "Two-slot Power. Impose fear, calm, rage, or similar feelings. The target resists with Psyche.",
  "force field generation": "Raise a barrier that soaks damage at this Power rank. Treat it as a Force Field on the sheet when active.",
  "animal communication and control": "Speak with animals and, on a FEAT, steer their actions. Intelligent or hostile animals resist.",
  "mechanical intuition": "Understand unfamiliar machines quickly. Repair and operate FEATs may use this rank instead of Reason.",
  "animal empathy": "Sense an animal's mood and intent. Useful before a fight-or-flight moment.",
  "empathy": "Read surface emotions. A better FEAT color may reveal why the feeling is there.",
  "psi-screen": "A mental shield. Incoming mental attacks must beat this Power rank.",
  "mental probe": "Search a willing or subdued mind for a fact. Deep or guarded memories require a harder FEAT.",
  "animate drawings": "Bring a drawing or image to limited life. Its Strength and duration use this Power rank.",
  "possession": "Two-slot Power. Occupy another body. The host resists with Psyche; harm to either body is a Judge hazard.",
  "transferral": "Two-slot Power. Swap minds or shift a Power from one character to another. Both parties may resist.",
  "astral projection": "Leave the body as an astral form. The body is helpless. Silver cords, wards, and return time are Judge tools.",
  "psionic attack": "A direct mental blast. Damage or stun uses this Power rank versus Psyche.",
  "precognition": "Two-slot Power. Glimpse a possible future. The Judge answers in images or short phrases; it is never a guarantee.",
  "postcognition": "Read past events at a place or object. Age of the trace and interference set the FEAT difficulty.",
  "plant control": "Command plants to grab, grow, or part. Intensity uses this Power rank.",
  "ultimate skill": "Treat one chosen professional or scientific task as this Power rank instead of the usual ability.",
  "extra body parts": "Additional arms, tail, wings, or similar. Extra attacks or movement options follow what the part can reasonably do.",
  "extra attacks": "Take additional combat actions. The Judge may require this rank as a FEAT to keep the extra swing.",
  "energy touch": "Discharge energy through a touch. Damage uses this Power rank.",
  "paralyzing touch": "A touch can freeze the target in place. The target resists with Endurance or Psyche against this rank.",
  "claws": "Natural edged weapons. Damage uses this Power rank or Strength, whichever the Judge prefers for the strike.",
  "rotting touch": "Decay organic matter on contact. Living targets resist with Endurance.",
  "corrosive touch": "Dissolve material on contact. Compare this rank to the material rank.",
  "health-drain touch": "Two-slot Power. Steal Health from a touched target. The target resists with Endurance.",
  "blinding touch": "A touch can blind. Recovery time depends on FEAT color and Endurance.",
  "body armor": "Reduce incoming physical damage by this Power rank. Energy attacks usually ignore 20 points of that protection.",
  "water breathing": "Breathe underwater without a time limit. Pressure and temperature are separate problems.",
  "absorption": "Convert a listed attack form into Health or Power. Overflow can still injure the hero.",
  "regeneration": "Recover Health faster than the usual hourly rate. The amount per turn or hour uses this Power rank.",
  "solar regeneration": "Regenerate while in sunlight or a similar energy bath. Without that source the Power is idle.",
  "recovery": "Shake off stun, slam, or similar lasting combat results sooner. Roll this rank when the Judge allows a recovery check.",
  "life support": "Go without air, food, or a safe environment for a time based on this rank.",
  "pheromones": "Broadcast a scent that shifts mood or attention. Targets resist with Intuition or Psyche.",
  "damage transfer": "Move damage from one character to another by touch or link. Unwilling targets resist.",
  "healing": "Restore Health to another character. Amount healed uses this Power rank; a FEAT may be required for serious harm.",
  "immortality": "Two-slot Power. The hero does not stay dead by ordinary means. Return time and remaining weaknesses are a Judge call."
};

export const TALENT_DEFINITIONS = {
  "guns": { bonus: "+1 CS to hit with firearms", attribute: "Agility", definition: "Trained with firearms. Shift Agility +1 CS when shooting a gun the hero can reasonably handle." },
  "thrown weapons": { bonus: "+1 CS", attribute: "Agility", definition: "Trained to throw weapons. Shift +1 CS on thrown-weapon attacks." },
  "bows": { bonus: "+1 CS; no untrained penalty", attribute: "Agility", definition: "Trained archer. Shift +1 CS with bows and ignore the usual untrained penalty." },
  "blunt weapons": { bonus: "+1 CS Blunt Attacks", attribute: "Fighting", definition: "Trained with clubs, staves, and similar blunt weapons. Shift +1 CS on those Blunt Attacks." },
  "sharp weapons": { bonus: "+1 CS Edged Attacks", attribute: "Fighting", definition: "Trained with blades and other edged weapons. Shift +1 CS on those Edged Attacks." },
  "oriental weapons": { bonus: "+1 CS listed weapons", attribute: "Fighting", definition: "Trained with a listed set of specialized martial weapons. Shift +1 CS with those weapons." },
  "marksman": { bonus: "+1 CS line-of-sight; ignore range CS", attribute: "Agility", definition: "Expert shot. Shift +1 CS against a seen target and ignore ordinary range column penalties." },
  "weapons master": { bonus: "+1 CS Fighting weapons", attribute: "Fighting", definition: "Broad weapons training. Shift +1 CS with Fighting-based weapons the hero can use." },
  "weapons specialist": { bonus: "+2 CS one weapon; +1 initiative", attribute: "Fighting", definition: "Specialist in a single chosen weapon. Shift +2 CS with it and gain +1 initiative when using it." },
  "martial arts a": { bonus: "Stun/Slam regardless of comparative ranks", attribute: "Fighting", definition: "Unarmed style that can Stun or Slam even when the foe's Endurance outranks the attack." },
  "martial arts b": { bonus: "+1 CS unarmed Fighting", attribute: "Fighting", definition: "Unarmed striking style. Shift +1 CS on unarmed Fighting attacks." },
  "martial arts c": { bonus: "+1 CS Grapple/Escape and Dodge", attribute: "Fighting / Agility", definition: "A defensive and wrestling-aware style. Shift +1 CS on Grapple, Escape, and Dodge." },
  "martial arts d": { bonus: "Study to ignore armor vs Stun/Slam", attribute: "Fighting", definition: "After two turns of study, ignore Body Armor when checking Stun or Slam on that foe." },
  "martial arts e": { bonus: "+1 initiative unarmed", attribute: "Fighting", definition: "Fast unarmed fighter. Gain +1 initiative when fighting without a weapon." },
  "wrestling": { bonus: "+2 CS Grappling to hit", attribute: "Fighting", definition: "Trained grappler. Shift +2 CS on Grappling attacks to hit." },
  "thrown objects": { bonus: "+1 CS throw and catch", attribute: "Agility", definition: "Trained to throw and catch improvised objects. Shift +1 CS on those actions." },
  "tumbling": { bonus: "Agility FEAT to land safely", attribute: "Agility", definition: "Break falls and roll with impacts. An Agility FEAT can avoid falling damage the Judge allows." },
  "acrobatics": { bonus: "+1 CS Dodge / Evade / Escape", attribute: "Agility", definition: "Gymnastic combat movement. Shift +1 CS on Dodge, Evade, and Escape." },
  "medicine": { bonus: "Medical FEATs; aid Healing", attribute: "Reason", definition: "Diagnose and treat injury. Reason FEATs can stabilize a patient or improve hourly Healing when the Judge allows." },
  "law": { bonus: "Legal knowledge FEATs", attribute: "Reason", definition: "Know statutes, courts, and procedure. Reason FEATs cover research, argument, and spotting legal traps." },
  "law-enforcement": { bonus: "Includes Guns and Law", attribute: "Reason / Agility", definition: "Police or similar training. Includes the Guns and Law talents unless the Judge splits them." },
  "pilot": { bonus: "Vehicle FEATs", attribute: "Agility / Reason", definition: "Operate air, space, or similar craft. Agility or Reason FEATs handle difficult flight." },
  "military": { bonus: "Tactics and military protocol", attribute: "Reason", definition: "Service training. Covers tactics, chain of command, and military equipment the hero would know." },
  "business/finance": { bonus: "Resources and deal FEATs", attribute: "Reason", definition: "Markets, books, and deals. Reason FEATs can stretch Resources or read a contract." },
  "journalism": { bonus: "+2 Contacts when generated", attribute: "Reason / Intuition", definition: "Research, interviews, and deadlines. Generated heroes with this talent gain two extra Contacts." },
  "engineering": { bonus: "Design and repair FEATs", attribute: "Reason", definition: "Design, build, and repair structures or machines. Reason FEATs set what the hero can improvise." },
  "crime": { bonus: "Underworld FEATs", attribute: "Intuition / Agility", definition: "Street craft: locks, fences, crews, and quietly getting in. The Judge picks the ability." },
  "psychiatry": { bonus: "Mental recovery FEATs", attribute: "Reason / Psyche", definition: "Treat mental strain and emotion Powers after the fact. Can aid recovery from psychic harm." },
  "detective/espionage": { bonus: "Investigation FEATs", attribute: "Intuition / Reason", definition: "Shadowing, covers, and crime scenes. Intuition or Reason FEATs uncover what others hide." },
  "chemistry": { bonus: "Chemical analysis and compounds", attribute: "Reason", definition: "Identify and mix chemicals. Reason FEATs cover analysis, antidotes, and field brewing." },
  "biology": { bonus: "Life-science FEATs", attribute: "Reason", definition: "Living systems, field ID, and lab work. Reason FEATs cover anatomy and organisms." },
  "geology": { bonus: "Earth-science FEATs", attribute: "Reason", definition: "Rock, quakes, and underground structure. Useful for tunnels, quakes, and material ID." },
  "genetics": { bonus: "Heredity and mutation FEATs", attribute: "Reason", definition: "Read genetic traits and lab work on heredity. Campaign mutants and clones fall under this." },
  "archeology": { bonus: "Ruin and artifact FEATs", attribute: "Reason", definition: "Date ruins, read dead cultures, and handle artifacts without wrecking them." },
  "physics": { bonus: "Physical-science FEATs", attribute: "Reason", definition: "Forces, energy, and models of how the world works. Useful around strange Powers and devices." },
  "computers": { bonus: "Programming and intrusion FEATs", attribute: "Reason", definition: "Program, hack, and recover data. Security rank sets the FEAT difficulty." },
  "electronics": { bonus: "Circuit FEATs", attribute: "Reason", definition: "Build and repair electronic gear. Reason FEATs cover jury-rigs and diagnosis." },
  "trance": { bonus: "Rest and resist mental noise", attribute: "Psyche", definition: "Enter a deep focus. Can substitute rest and help resist mental distraction." },
  "mesmerism and hypnosis": { bonus: "Suggestion FEATs", attribute: "Psyche", definition: "Plant a suggestion in a willing or relaxed subject. Hostile use is a Psyche contest." },
  "sleight of hand": { bonus: "Conceal and palming FEATs", attribute: "Agility", definition: "Palm small objects and misdirect eyes. Agility FEATs cover theft and stage magic." },
  "resist domination": { bonus: "+1 CS vs mental control", attribute: "Psyche", definition: "Harder to control. Shift +1 CS on FEATs to resist domination, possession, and similar effects." },
  "mystic origin": { bonus: "Magic background FEATs", attribute: "Psyche", definition: "Raised around magic. Reason or Psyche FEATs identify rites, relics, and occult etiquette." },
  "occult lore": { bonus: "Research supernatural FEATs", attribute: "Reason / Psyche", definition: "Book knowledge of spirits, relics, and forbidden names. Does not by itself cast spells." },
  "artist": { bonus: "Create and forge art", attribute: "Reason / Agility", definition: "Produce art good enough to sell, disguise, or forge. Quality is a FEAT." },
  "languages": { bonus: "Extra languages", attribute: "Reason", definition: "Speak additional languages. The Judge sets how many and whether a FEAT is needed for dialects." },
  "first aid": { bonus: "Stabilize and field care", attribute: "Reason", definition: "Field medicine. Can stop bleeding and help a stunned or unconscious character at the Judge's rate." },
  "repair/tinkering": { bonus: "Jury-rig FEATs", attribute: "Reason / Agility", definition: "Fix broken gear with what is on hand. Quality and time are FEATs." },
  "trivia": { bonus: "Obscure-fact FEATs", attribute: "Reason", definition: "Recall odd facts. The Judge may allow a Reason FEAT when a niche detail matters." },
  "performer": { bonus: "Stage and crowd FEATs", attribute: "Intuition / Popularity", definition: "Hold a crowd, play a role, or work a room. Useful with Popularity and disguises." },
  "animal training": { bonus: "Train and command animals", attribute: "Intuition", definition: "Train animals and give them standing commands. Untrained beasts still need a FEAT." },
  "heir to fortune": { bonus: "Higher starting Resources", attribute: "Resources", definition: "Family money or a trust. Starting Resources are better than the usual generated rank." },
  "student": { bonus: "Research bonus while studying", attribute: "Reason", definition: "Still in training. Reason FEATs to look something up are easier when the hero has time and materials." },
  "leadership": { bonus: "Coordinate allies; Karma options", attribute: "Intuition / Popularity", definition: "Direct a team in a fight or crisis. The Judge may allow extra Karma or initiative help for a coordinated plan." }
};

const UPB_CLASS_HINT = {
  defensive: "Defensive Power. Use this rank to resist, block, or shed the listed threat.",
  detection: "Detection Power. A FEAT at this rank reveals the listed stimulus within range.",
  energyControl: "Energy-control Power. Shape or redirect the listed energy at this rank.",
  energyEmission: "Energy-emission Power. Project the listed energy as a blast or field at this rank.",
  fighting: "Fighting Power. Apply this rank to unarmed or weapon combat as the name suggests.",
  illusory: "Illusory Power. Create false sensory input; observers may see through it with Intuition.",
  lifeform: "Lifeform-control Power. Affect living targets; they may resist with Endurance or Psyche.",
  magic: "Magic Power. Treat rites and effects as FEATs at this rank. The Judge sets what the campaign's magic can do.",
  matterControl: "Matter-control Power. Move or reshape existing matter at this rank.",
  matterConversion: "Matter-conversion Power. Change one substance toward another at this rank.",
  matterCreation: "Matter-creation Power. Produce the listed matter or object at this rank.",
  mental: "Mental Power. Psyche contests and mental FEATs use this rank.",
  physical: "Physical-enhancement Power. The body performs beyond human norms at this rank.",
  powerControl: "Power-control Power. Alter, copy, or feed on other Powers at this rank.",
  selfAlteration: "Self-alteration Power. The hero changes form or state at this rank.",
  travel: "Travel Power. Movement mode and speed use this rank."
};

export function describePower(name, extra = {}) {
  const key = catalogKey(name);
  const two = /counts as two/i.test(name) || extra.slotsTaken === 2;
  const stock = POWER_DEFINITIONS[key];
  const definition = stock
    || extra.definition
    || `${String(name).replace(/\s*\(counts as two[^)]*\)/gi, "").trim()} is a FASERIP Power. Use this rank for FEATs. The Judge sets range, duration, and Intensity from your rulebook.`;
  const out = {
    definition,
    slotsTaken: two ? 2 : Number(extra.slotsTaken || 1) || 1,
    category: extra.category || "",
    bodyArmor: !!extra.bodyArmor || /body armor|armor skin|body resistance/i.test(key),
    forceField: !!extra.forceField || /force field/i.test(key)
  };
  if (/invulnerability|true invulnerability|immortality|teleport|dimensional|dimension travel|gateway|time travel|time control|precognition|possession|mind control|emotion control|image generation|probability|nullifying|health-drain|cosmic awareness|combat sense/i.test(key)) {
    out.slotsTaken = Math.max(out.slotsTaken, two ? 2 : out.slotsTaken);
  }
  return out;
}

export function describeTalent(name, extra = {}) {
  const key = catalogKey(name);
  const stock = TALENT_DEFINITIONS[key];
  return {
    definition: stock?.definition || extra.definition || `${String(name).replace(/\s*\([^)]*\)/g, "").trim()} is a Talent. When it applies, shift the related ability +1 CS unless a more specific bonus is listed.`,
    bonus: extra.bonus || stock?.bonus || "",
    attribute: extra.attribute || stock?.attribute || "",
    category: extra.category || "",
    slotsTaken: Number(extra.slotsTaken || 1) || 1
  };
}

export function describeCatalogItem(type, name, extra = {}) {
  if (type === "talent") return describeTalent(name, extra);
  return describePower(name, extra);
}

export function displayName(name) {
  return String(name || "").replace(/\s*\(counts as two[^)]*\)/gi, "").trim();
}

export function buildCatalogItemData(type, rawName, extra = {}) {
  const name = displayName(rawName);
  const two = /counts as two/i.test(rawName);
  const info = describeCatalogItem(type, rawName, { ...extra, slotsTaken: two ? 2 : extra.slotsTaken });
  const system = {
    category: extra.category || info.category || "",
    definition: info.definition,
    notes: extra.notes || ""
  };
  if (type === "power") {
    system.rank = extra.rank || "typical";
    system.number = extra.number ?? 0;
    system.slotsTaken = info.slotsTaken;
    system.bodyArmor = info.bodyArmor;
    system.forceField = info.forceField;
    if (extra.range) system.range = extra.range;
  }
  if (type === "talent") {
    system.rank = extra.rank || "typical";
    system.number = extra.number ?? 0;
    system.bonus = info.bonus;
    system.attribute = info.attribute;
    system.slotsTaken = info.slotsTaken;
  }
  return {
    name,
    type,
    img: type === "talent" ? "icons/svg/upgrade.svg" : "icons/svg/aura.svg",
    system
  };
}

export function upbHint(classId) {
  return UPB_CLASS_HINT[classId] || "Use this Power rank for FEATs. The Judge sets details from your rulebook.";
}

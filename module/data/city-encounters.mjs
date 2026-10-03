/**
 * City encounter wheel. Bands match the accessory wheel.
 * Scenes are original. They are not the book's adventures.
 */

export const ENCOUNTER_KINDS = {
  N: "No encounter",
  DL: "Daily life",
  PC: "Petty crime",
  R: "Robbery",
  B: "Burglary",
  RA: "Rampage",
  V: "Vendetta",
  C: "Catastrophe",
  OC: "Organized crime"
};

function band(lo, hi, code) {
  return { lo, hi, code };
}

export const ENCOUNTER_WHEEL = {
  shift0: [band(1, 55, "RA"), band(56, 85, "V"), band(86, 99, "OC"), band(100, 100, "C")],
  feeble: [band(1, 50, "RA"), band(51, 80, "V"), band(81, 97, "C"), band(98, 100, "OC")],
  poor: [band(1, 45, "N"), band(46, 75, "N"), band(76, 97, "DL"), band(98, 100, "PC")],
  typical: [band(1, 40, "N"), band(41, 70, "DL"), band(71, 94, "PC"), band(95, 100, "B")],
  good: [band(1, 35, "N"), band(36, 65, "DL"), band(66, 94, "PC"), band(95, 100, "R")],
  excellent: [band(1, 30, "DL"), band(31, 60, "N"), band(61, 90, "PC"), band(91, 100, "B")],
  remarkable: [band(1, 25, "DL"), band(26, 55, "N"), band(56, 90, "PC"), band(91, 100, "R")],
  incredible: [band(1, 20, "PC"), band(21, 50, "DL"), band(51, 85, "N"), band(86, 100, "V")],
  amazing: [band(1, 15, "R"), band(16, 45, "PC"), band(46, 85, "DL"), band(86, 100, "N")],
  monstrous: [band(1, 10, "B"), band(11, 40, "R"), band(41, 80, "PC"), band(81, 100, "DL")],
  unearthly: [band(1, 65, "OC"), band(66, 94, "B"), band(95, 99, "R"), band(100, 100, "PC")],
  shiftx: [band(1, 60, "N"), band(61, 90, "OC"), band(91, 99, "B"), band(100, 100, "RA")]
};

export const CITY_ENCOUNTERS = [
  {
    id: "n-quiet",
    code: "N",
    time: ["any"],
    summary: "The block is busy and ordinary.",
    setup: "Traffic, errands, and noise. Nobody is calling for help.",
    adventure: "The hero can keep moving. A Reason or Intuition FEAT notices only the usual city.",
    aftermath: "The hour passes. The Judge can roll again later.",
    karma: []
  },
  {
    id: "dl-wallet",
    code: "DL",
    time: ["dawn", "day"],
    summary: "A jogger drops a wallet and does not notice.",
    setup: "A riverside path or a park edge, early or midday.",
    adventure: "The wallet has cash and a name. Finding the owner takes a short search or a question at a nearby stand.",
    aftermath: "Returned, the owner is grateful. Kept, the loss is reported.",
    karma: [
      { label: "Return the wallet", karma: 5 },
      { label: "Keep it", karma: -5 }
    ]
  },
  {
    id: "dl-child",
    code: "DL",
    time: ["day"],
    summary: "A small child is alone on a park bench and will not stop crying.",
    setup: "A public park in the afternoon. Other people are nearby and unsure what to do.",
    adventure: "A gentle approach and an Intuition FEAT finds a parent still in the park. A harsh grab frightens the child.",
    aftermath: "A reunion draws a small crowd. Walking away leaves the child with strangers.",
    karma: [
      { label: "Reunite the child with a parent", karma: 10 },
      { label: "Leave the child", karma: -5 }
    ]
  },
  {
    id: "dl-musician",
    code: "DL",
    time: ["evening"],
    summary: "A street musician's case is kicked over in the rush.",
    setup: "A station entrance or a busy corner at dusk.",
    adventure: "Coins and bills are in the gutter. Helping takes a minute. The player is embarrassed, not hurt.",
    aftermath: "The take is mostly recovered, or the player packs up short.",
    karma: [
      { label: "Help gather the money", karma: 3 },
      { label: "Pocket some of it", karma: -5 }
    ]
  },
  {
    id: "pc-pick",
    code: "PC",
    time: ["day", "evening"],
    summary: "A pickpocket is working a crowded corner.",
    setup: "A market street or a train platform while people are packed shoulder to shoulder.",
    adventure: "An Intuition FEAT spots the hand. Catching the thief is an Agility or Fighting FEAT. They run if they can.",
    aftermath: "The wallet goes back to its owner. If the thief escapes, they try another car.",
    karma: [
      { label: "Stop the pickpocket and return the take", karma: 5 },
      { label: "Let it happen", karma: -3 }
    ]
  },
  {
    id: "pc-tag",
    code: "PC",
    time: ["night"],
    summary: "Three teenagers are tagging a shuttered storefront.",
    setup: "A side street after the shops have closed. One lookout watches the corner.",
    adventure: "They are not armed. A show of force scatters them. Talking them down is an Intuition or Popularity FEAT.",
    aftermath: "The owner finds paint or a clean gate in the morning.",
    karma: [
      { label: "Stop the damage without hurting them", karma: 3 },
      { label: "Hurt them over paint", karma: -5 }
    ]
  },
  {
    id: "pc-fare",
    code: "PC",
    time: ["day", "evening"],
    summary: "A fare argument on a bus turns into shoving.",
    setup: "A crowded bus or station booth. The driver is scared. Riders are trapped in the aisle.",
    adventure: "Separating the pair is a Fighting or Strength FEAT. The dispute is money, not a grudge.",
    aftermath: "The bus moves again, or the fight spills onto the curb.",
    karma: [
      { label: "Break it up before anyone is hurt", karma: 5 },
      { label: "Join the shoving", karma: -5 }
    ]
  },
  {
    id: "r-shop",
    code: "R",
    time: ["day", "evening"],
    summary: "Two masked people are emptying a shop register.",
    setup: "A corner store. The clerk is on the floor. One robber watches the door.",
    adventure: "They have handguns. Talking them out is a Popularity or Intuition FEAT. A fight risks the clerk.",
    aftermath: "The cash is recovered or they reach a waiting car.",
    karma: [
      { label: "Stop the robbery with the clerk safe", karma: 10 },
      { label: "A bystander is hurt in the fight", karma: -10 }
    ]
  },
  {
    id: "r-cab",
    code: "R",
    time: ["night"],
    summary: "A cab is stopped and the driver is being robbed at the curb.",
    setup: "A quiet avenue late at night. The back door is open. One person holds the driver.",
    adventure: "A surprise approach is +1 CS. The robber bolts toward an alley if startled.",
    aftermath: "The driver radios it in. If the hero leaves, the cab is found empty later.",
    karma: [
      { label: "Save the driver and the fare", karma: 10 },
      { label: "Chase the money and leave the driver", karma: -5 }
    ]
  },
  {
    id: "r-bank",
    code: "R",
    time: ["day"],
    summary: "A lobby holdup is already underway at a bank branch.",
    setup: "Midday. Guards are down. Customers are on the floor. A lookout is at the door.",
    adventure: "Getting the customers out is the hard part. The crew has a car on the side street.",
    aftermath: "News crews arrive within minutes. How the hero is described depends on who got hurt.",
    karma: [
      { label: "End it with the hostages safe", karma: 15 },
      { label: "A hostage is hurt", karma: -15 }
    ]
  },
  {
    id: "b-shop",
    code: "B",
    time: ["night"],
    summary: "A shop window has been forced and someone is still inside.",
    setup: "After closing. The alarm is a local bell, not a silent line. The street is empty.",
    adventure: "An Intuition FEAT hears movement in the back. They have tools, not a plan for a fight.",
    aftermath: "The owner can be called. If the hero waits, the burglar leaves with one bag.",
    karma: [
      { label: "Catch them before they leave", karma: 5 },
      { label: "Take a share of the goods", karma: -10 }
    ]
  },
  {
    id: "b-escape",
    code: "B",
    time: ["night", "evening"],
    summary: "Someone with a full bag is climbing a fire escape.",
    setup: "A residential block. A window on the third floor is open. A tenant is about to shout.",
    adventure: "Cutting them off is an Agility FEAT. The bag is household goods, not a fortune.",
    aftermath: "The tenant identifies what was taken. A fall from the escape is a real risk.",
    karma: [
      { label: "Stop the theft", karma: 5 },
      { label: "Let them fall", karma: -10 }
    ]
  },
  {
    id: "b-dock",
    code: "B",
    time: ["night"],
    summary: "A warehouse door is open and a hand truck is moving crates to a van.",
    setup: "A loading dock with one light. Two people, no uniforms.",
    adventure: "The crates are ordinary goods. They run if challenged. The van's driver stays at the wheel.",
    aftermath: "A night watchman shows up late either way.",
    karma: [
      { label: "Stop the load before the van leaves", karma: 10 },
      { label: "Ignore it", karma: -3 }
    ]
  },
  {
    id: "ra-machine",
    code: "RA",
    time: ["day"],
    summary: "A driverless construction machine is rolling down a street.",
    setup: "A work site at one end of the block. The machine is in gear. People are in the crosswalk.",
    adventure: "Stopping it is a Strength FEAT against the machine's mass, or an Agility FEAT to reach the controls. Clearing the crosswalk comes first.",
    aftermath: "The contractor arrives angry and scared. Injuries land on the hero's account if the crowd was left in the way.",
    karma: [
      { label: "Stop it before it hits anyone", karma: 15 },
      { label: "Someone is struck", karma: -15 }
    ]
  },
  {
    id: "ra-main",
    code: "RA",
    time: ["any"],
    summary: "A gas main is burning and the fire is walking toward occupied buildings.",
    setup: "A torn street. The flame is high. Residents are at their windows.",
    adventure: "Getting people out is the job. Closing the valve is a Reason FEAT in the pit, if the hero can reach it.",
    aftermath: "Fire crews take the block. The hero's name is on the evening news if anyone saw the rescue.",
    karma: [
      { label: "Get the nearest building clear", karma: 15 },
      { label: "Leave people inside", karma: -15 }
    ]
  },
  {
    id: "ra-market",
    code: "RA",
    time: ["day"],
    summary: "Something too strong for the stalls is tearing through a market.",
    setup: "A street market. Stalls are down. The cause is a person or a creature at the hero's power rank or one rank higher. Shoppers are the cover.",
    adventure: "The rampage has no speech and no plan. Ending it without crushing the crowd is the FEAT.",
    aftermath: "Vendors count their losses. A public win here is also a Popularity moment if the Judge wants one.",
    karma: [
      { label: "Stop the rampage and protect the crowd", karma: 20 },
      { label: "The crowd takes the damage", karma: -20 }
    ]
  },
  {
    id: "v-crews",
    code: "V",
    time: ["night", "evening"],
    summary: "Two crews are shooting at each other, and the street is not empty.",
    setup: "A corner they both claim. Parked cars are the cover. A few residents are caught between them.",
    adventure: "This is a grudge, not a robbery. Stopping the guns is the fight. Learning why can wait.",
    aftermath: "Ambulances if anyone is down. Both crews remember who interfered.",
    karma: [
      { label: "Stop the shooting and cover the bystanders", karma: 15 },
      { label: "A bystander is hit", karma: -15 }
    ]
  },
  {
    id: "v-return",
    code: "V",
    time: ["night"],
    summary: "Someone the hero has beaten before has come back with friends.",
    setup: "They pick a place the hero uses: a home block, a workplace, or a rooftop. They want a rematch, not a theft.",
    adventure: "They announce themselves. Innocent people are nearby if the hero lives among neighbors.",
    aftermath: "Win or lose, the grudge is public. The friends scatter if their leader drops.",
    karma: [
      { label: "Win it without the neighbors paying", karma: 10 },
      { label: "A neighbor is hurt", karma: -10 }
    ]
  },
  {
    id: "v-roof",
    code: "V",
    time: ["night"],
    summary: "A grudge fight on a roof is about to spill people off the edge.",
    setup: "Two powered fighters, neither asking for help. Tenants are on the fire escape below.",
    adventure: "Separating them is the encounter. Taking a side continues it.",
    aftermath: "The roof is a wreck. The tenants know who kept them from falling.",
    karma: [
      { label: "Keep everyone on the roof", karma: 10 },
      { label: "Someone goes over", karma: -20 }
    ]
  },
  {
    id: "c-train",
    code: "C",
    time: ["day", "evening"],
    summary: "An elevated train has stopped, and one car is tilting off the track.",
    setup: "A sharp curve. Passengers are screaming. The car shifts when people move.",
    adventure: "Holding the car is a Strength FEAT. Getting passengers across the coupling is Agility. Both may be needed.",
    aftermath: "Transit crews close the line. The hero is filmed from the street.",
    karma: [
      { label: "Empty the car before it goes", karma: 20 },
      { label: "The car falls with people aboard", karma: -20 }
    ]
  },
  {
    id: "c-fire",
    code: "C",
    time: ["any"],
    summary: "A residence is burning and people are at the upper windows.",
    setup: "Smoke on the second and third floors. The stairs are the problem. Fire crews are minutes away.",
    adventure: "Each trip in is Endurance against smoke. A white result means that trip fails and the hero needs air.",
    aftermath: "The people who got out are on the sidewalk. The ones who did not are the story.",
    karma: [
      { label: "Bring the people at the windows out", karma: 15 },
      { label: "Leave them", karma: -15 }
    ]
  },
  {
    id: "c-pier",
    code: "C",
    time: ["day"],
    summary: "A pier section has dropped, and people are in the water.",
    setup: "A public pier. The break is fresh. Some swimmers can tread water. One cannot.",
    adventure: "A swim or a reach from the edge. The current pulls toward the pilings.",
    aftermath: "Boats arrive slowly. Hypothermia is the aftermath if the rescue was late.",
    karma: [
      { label: "Pull them out", karma: 15 },
      { label: "Someone goes under", karma: -15 }
    ]
  },
  {
    id: "oc-protect",
    code: "OC",
    time: ["day", "evening"],
    summary: "A collector is leaning on a shopkeeper for a weekly payment.",
    setup: "The shop is open. Two quiet men. The owner is trying not to make a scene. Neighbors pretend not to see.",
    adventure: "This is organized, not a stickup. The collector names a boss only if pressed, and even then it is a street name. A fight brings more of them later.",
    aftermath: "The owner is grateful and frightened. The next visit depends on whether the hero stays involved.",
    karma: [
      { label: "Get the collector out without a war", karma: 10 },
      { label: "The shop is wrecked anyway", karma: -5 }
    ]
  },
  {
    id: "oc-alley",
    code: "OC",
    time: ["night"],
    summary: "Cases are changing hands in an alley, with lookouts on both ends.",
    setup: "No shouting. A van and a car. The goods are sealed. The lookouts are armed.",
    adventure: "Breaking it up is a fight. Following the van is a chase. Opening a case tells the Judge what the trade was.",
    aftermath: "The losers report upward. The hero has been seen.",
    karma: [
      { label: "Break up the trade", karma: 10 },
      { label: "Take the goods for yourself", karma: -15 }
    ]
  },
  {
    id: "oc-house",
    code: "OC",
    time: ["night", "evening"],
    summary: "The hero stumbles onto a guarded flat used as a counting room.",
    setup: "A normal building. Too many lights. A doorman who is not a doorman.",
    adventure: "Getting in unseen is Agility. A frontal entry is a short fight against guards at Typical to Good, with one leader a rank higher.",
    aftermath: "Cash and notebooks. The notebooks are a later lead, not a name from a roster.",
    karma: [
      { label: "Shut the room down", karma: 15 },
      { label: "Walk off with the cash", karma: -10 }
    ]
  }
];

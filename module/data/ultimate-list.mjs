/** Extra powers from the expanded Ultimate Powers list that are not already on the Advanced or UPB tables. Original short notes. */
function keyOf(name) {
  return String(name || "").replace(/\s*\(counts as two[^)]*\)/gi, "").replace(/[—–-]/g, " ").replace(/[^a-z0-9 ]/gi, " ").replace(/\s+/g, " ").trim().toLowerCase();
}
export const ULTIMATE_GROUPS = [
  {
    "id": "defensive",
    "label": "Defensive",
    "items": [
      {
        "cat": "defensive",
        "name": "Death Field",
        "ability": "endurance",
        "column": "force",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Death Field presses a target at this Power rank. A hit uses the Force column."
      },
      {
        "cat": "defensive",
        "name": "Null-Field",
        "ability": "endurance",
        "column": "",
        "forceField": true,
        "bodyArmor": false,
        "definition": "Null-Field turns aside or soaks harm up to this Power rank."
      },
      {
        "cat": "defensive",
        "name": "Bubble",
        "ability": "endurance",
        "column": "",
        "forceField": true,
        "bodyArmor": false,
        "definition": "Bubble turns aside or soaks harm up to this Power rank."
      },
      {
        "cat": "defensive",
        "name": "Aura Field",
        "ability": "endurance",
        "column": "",
        "forceField": true,
        "bodyArmor": false,
        "definition": "Aura Field turns aside or soaks harm up to this Power rank."
      },
      {
        "cat": "defensive",
        "name": "Resistances",
        "ability": "endurance",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Resistances turns aside or soaks harm up to this Power rank."
      },
      {
        "cat": "defensive",
        "name": "Sense Protection",
        "ability": "intuition",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Sense Protection turns aside or soaks harm up to this Power rank."
      },
      {
        "cat": "defensive",
        "name": "Electronic Counter Measures",
        "ability": "endurance",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Electronic Counter Measures turns aside or soaks harm up to this Power rank."
      }
    ]
  },
  {
    "id": "detection",
    "label": "Detection",
    "items": [
      {
        "cat": "detection",
        "name": "Sense Artificial Intelligence",
        "ability": "intuition",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Sense Artificial Intelligence notices its stimulus. Range and detail use this Power rank."
      },
      {
        "cat": "detection",
        "name": "Death Sense",
        "ability": "intuition",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Death Sense notices its stimulus. Range and detail use this Power rank."
      },
      {
        "cat": "detection",
        "name": "Aura Perception",
        "ability": "intuition",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Aura Perception notices its stimulus. Range and detail use this Power rank."
      },
      {
        "cat": "detection",
        "name": "Cosmic Perception",
        "ability": "intuition",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Cosmic Perception notices its stimulus. Range and detail use this Power rank."
      },
      {
        "cat": "detection",
        "name": "Genetic Perception",
        "ability": "intuition",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Genetic Perception notices its stimulus. Range and detail use this Power rank."
      },
      {
        "cat": "detection",
        "name": "Hyper Sense",
        "ability": "intuition",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Hyper Sense notices its stimulus. Range and detail use this Power rank."
      },
      {
        "cat": "detection",
        "name": "Reality Perception",
        "ability": "intuition",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Reality Perception notices its stimulus. Range and detail use this Power rank."
      },
      {
        "cat": "detection",
        "name": "VR Vision",
        "ability": "intuition",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "VR Vision notices its stimulus. Range and detail use this Power rank."
      }
    ]
  },
  {
    "id": "energyControl",
    "label": "Energy Control",
    "items": [
      {
        "cat": "energyControl",
        "name": "Energy Absorption",
        "ability": "reason",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Energy Absorption shapes or redirects that energy at this Power rank."
      },
      {
        "cat": "energyControl",
        "name": "Channel",
        "ability": "reason",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Channel shapes or redirects that energy at this Power rank."
      },
      {
        "cat": "energyControl",
        "name": "Cosmic Energy Manipulation",
        "ability": "reason",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Cosmic Energy Manipulation shapes or redirects that energy at this Power rank."
      },
      {
        "cat": "energyControl",
        "name": "Cyberspace Manipulation",
        "ability": "reason",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Cyberspace Manipulation shapes or redirects that energy at this Power rank."
      },
      {
        "cat": "energyControl",
        "name": "Dream Manipulation",
        "ability": "reason",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Dream Manipulation shapes or redirects that energy at this Power rank."
      },
      {
        "cat": "energyControl",
        "name": "Ectoplasm Control",
        "ability": "reason",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Ectoplasm Control shapes or redirects that energy at this Power rank."
      },
      {
        "cat": "energyControl",
        "name": "Electro-magnetic Manipulation",
        "ability": "reason",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Electro-magnetic Manipulation shapes or redirects that energy at this Power rank."
      },
      {
        "cat": "energyControl",
        "name": "Energy Plasmoids",
        "ability": "reason",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Energy Plasmoids shapes or redirects that energy at this Power rank."
      },
      {
        "cat": "energyControl",
        "name": "Explosive Power",
        "ability": "reason",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Explosive Power shapes or redirects that energy at this Power rank."
      },
      {
        "cat": "energyControl",
        "name": "Extradimensional Energy Control",
        "ability": "reason",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Extradimensional Energy Control shapes or redirects that energy at this Power rank."
      },
      {
        "cat": "energyControl",
        "name": "Extraterrestrial Energy Control",
        "ability": "reason",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Extraterrestrial Energy Control shapes or redirects that energy at this Power rank."
      },
      {
        "cat": "energyControl",
        "name": "Imbuement",
        "ability": "reason",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Imbuement shapes or redirects that energy at this Power rank."
      },
      {
        "cat": "energyControl",
        "name": "Microwave Manipulation",
        "ability": "reason",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Microwave Manipulation shapes or redirects that energy at this Power rank."
      },
      {
        "cat": "energyControl",
        "name": "Nuclear Control",
        "ability": "reason",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Nuclear Control shapes or redirects that energy at this Power rank."
      },
      {
        "cat": "energyControl",
        "name": "Probability Stabilization",
        "ability": "reason",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Probability Stabilization shapes or redirects that energy at this Power rank."
      },
      {
        "cat": "energyControl",
        "name": "Reality Manipulation",
        "ability": "reason",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Reality Manipulation shapes or redirects that energy at this Power rank."
      },
      {
        "cat": "energyControl",
        "name": "Space Manipulation",
        "ability": "reason",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Space Manipulation shapes or redirects that energy at this Power rank."
      },
      {
        "cat": "energyControl",
        "name": "Continuum Control",
        "ability": "reason",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Continuum Control shapes or redirects that energy at this Power rank."
      },
      {
        "cat": "energyControl",
        "name": "Entropy Magnification",
        "ability": "reason",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Entropy Magnification shapes or redirects that energy at this Power rank."
      },
      {
        "cat": "energyControl",
        "name": "Energy Threshold",
        "ability": "reason",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Energy Threshold shapes or redirects that energy at this Power rank."
      }
    ]
  },
  {
    "id": "energyEmission",
    "label": "Energy Emission",
    "items": [
      {
        "cat": "energyEmission",
        "name": "Cosmic Energy Emission",
        "ability": "agility",
        "column": "energy",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Cosmic Energy Emission projects an energy attack at this Power rank."
      },
      {
        "cat": "energyEmission",
        "name": "Ectoplasmcasting",
        "ability": "agility",
        "column": "energy",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Ectoplasmcasting projects an energy attack at this Power rank."
      },
      {
        "cat": "energyEmission",
        "name": "Electro-Magnetism",
        "ability": "agility",
        "column": "energy",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Electro-Magnetism projects an energy attack at this Power rank."
      },
      {
        "cat": "energyEmission",
        "name": "Extradimensional Energy Emission",
        "ability": "agility",
        "column": "energy",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Extradimensional Energy Emission projects an energy attack at this Power rank."
      },
      {
        "cat": "energyEmission",
        "name": "Extraterrestrial Energy Emission",
        "ability": "agility",
        "column": "energy",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Extraterrestrial Energy Emission projects an energy attack at this Power rank."
      },
      {
        "cat": "energyEmission",
        "name": "Hard Radiation Emission",
        "ability": "agility",
        "column": "energy",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Hard Radiation Emission projects an energy attack at this Power rank."
      },
      {
        "cat": "energyEmission",
        "name": "Microwave Generation",
        "ability": "agility",
        "column": "energy",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Microwave Generation projects an energy attack at this Power rank."
      },
      {
        "cat": "energyEmission",
        "name": "Nuclear Generation",
        "ability": "agility",
        "column": "energy",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Nuclear Generation projects an energy attack at this Power rank."
      },
      {
        "cat": "energyEmission",
        "name": "Gas Generation",
        "ability": "agility",
        "column": "energy",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Gas Generation projects an energy attack at this Power rank."
      },
      {
        "cat": "energyEmission",
        "name": "Bomb",
        "ability": "agility",
        "column": "energy",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Bomb projects an energy attack at this Power rank."
      }
    ]
  },
  {
    "id": "fighting",
    "label": "Fighting",
    "items": [
      {
        "cat": "fighting",
        "name": "Atemi",
        "ability": "fighting",
        "column": "blunt",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Atemi is a close Fighting attack at this Power rank."
      },
      {
        "cat": "fighting",
        "name": "Chi",
        "ability": "fighting",
        "column": "blunt",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Chi is a close Fighting attack at this Power rank."
      },
      {
        "cat": "fighting",
        "name": "Dimak",
        "ability": "fighting",
        "column": "blunt",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Dimak is a close Fighting attack at this Power rank."
      },
      {
        "cat": "fighting",
        "name": "Frenzy",
        "ability": "fighting",
        "column": "blunt",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Frenzy is a close Fighting attack at this Power rank."
      },
      {
        "cat": "fighting",
        "name": "Hyper-attack",
        "ability": "fighting",
        "column": "blunt",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Hyper-attack is a close Fighting attack at this Power rank."
      },
      {
        "cat": "fighting",
        "name": "Hyper-Charge",
        "ability": "endurance",
        "column": "charging",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Hyper-Charge closes the distance and strikes at this Power rank."
      },
      {
        "cat": "fighting",
        "name": "Mirror-Image",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Mirror-Image creates fighting duplicates. Observers may see through them with Intuition."
      },
      {
        "cat": "fighting",
        "name": "Object Creation",
        "ability": "reason",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Object Creation forms a solid object at this Power rank. The Judge sets size and how long it lasts."
      },
      {
        "cat": "fighting",
        "name": "Rage",
        "ability": "fighting",
        "column": "blunt",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Rage is a close Fighting attack at this Power rank."
      },
      {
        "cat": "fighting",
        "name": "Holy Gift",
        "ability": "fighting",
        "column": "blunt",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Holy Gift is a close Fighting attack at this Power rank."
      }
    ]
  },
  {
    "id": "illusory",
    "label": "Illusory",
    "items": [
      {
        "cat": "illusory",
        "name": "Solid Images",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Solid Images creates a false image. Observers may see through it with Intuition."
      },
      {
        "cat": "illusory",
        "name": "Tattoo",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Tattoo creates a false image. Observers may see through it with Intuition."
      }
    ]
  },
  {
    "id": "life",
    "label": "Lifeform Control",
    "items": [
      {
        "cat": "life",
        "name": "Affliction",
        "ability": "endurance",
        "column": "force",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Affliction presses a target at this Power rank. A hit uses the Force column."
      },
      {
        "cat": "life",
        "name": "Animal Control",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Animal Control affects a living target. They may resist with Endurance or Psyche."
      },
      {
        "cat": "life",
        "name": "Bio-Toxin",
        "ability": "endurance",
        "column": "force",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Bio-Toxin presses a target at this Power rank. A hit uses the Force column."
      },
      {
        "cat": "life",
        "name": "Birth Power",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Birth Power affects a living target. They may resist with Endurance or Psyche."
      },
      {
        "cat": "life",
        "name": "Cybernetic Control",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Cybernetic Control affects a living target. They may resist with Endurance or Psyche."
      },
      {
        "cat": "life",
        "name": "Death Power",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Death Power affects a living target. They may resist with Endurance or Psyche."
      },
      {
        "cat": "life",
        "name": "Devolution",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Devolution affects a living target. They may resist with Endurance or Psyche."
      },
      {
        "cat": "life",
        "name": "Fear-Induced",
        "ability": "psyche",
        "column": "force",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Fear-Induced presses a target at this Power rank. A hit uses the Force column."
      },
      {
        "cat": "life",
        "name": "Hostile Field",
        "ability": "psyche",
        "column": "",
        "forceField": true,
        "bodyArmor": false,
        "definition": "Hostile Field affects a living target. They may resist with Endurance or Psyche."
      },
      {
        "cat": "life",
        "name": "Invisibility, Others",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Invisibility, Others affects a living target. They may resist with Endurance or Psyche."
      },
      {
        "cat": "life",
        "name": "Life Absorption",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Life Absorption affects a living target. They may resist with Endurance or Psyche."
      },
      {
        "cat": "life",
        "name": "Mass Alteration",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Mass Alteration affects a living target. They may resist with Endurance or Psyche."
      },
      {
        "cat": "life",
        "name": "Memory Elimination",
        "ability": "psyche",
        "column": "force",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Memory Elimination presses a target at this Power rank. A hit uses the Force column."
      },
      {
        "cat": "life",
        "name": "Molecular Modification",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Molecular Modification affects a living target. They may resist with Endurance or Psyche."
      },
      {
        "cat": "life",
        "name": "Petrifaction",
        "ability": "psyche",
        "column": "force",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Petrifaction presses a target at this Power rank. A hit uses the Force column."
      },
      {
        "cat": "life",
        "name": "Seduction",
        "ability": "psyche",
        "column": "force",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Seduction presses a target at this Power rank. A hit uses the Force column."
      },
      {
        "cat": "life",
        "name": "Shapechange, Others",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Shapechange, Others affects a living target. They may resist with Endurance or Psyche."
      },
      {
        "cat": "life",
        "name": "Sleep – Induced",
        "ability": "psyche",
        "column": "force",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Sleep – Induced presses a target at this Power rank. A hit uses the Force column."
      },
      {
        "cat": "life",
        "name": "Soul Absorption",
        "ability": "psyche",
        "column": "force",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Soul Absorption presses a target at this Power rank. A hit uses the Force column."
      },
      {
        "cat": "life",
        "name": "Soul Purification",
        "ability": "psyche",
        "column": "force",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Soul Purification presses a target at this Power rank. A hit uses the Force column."
      },
      {
        "cat": "life",
        "name": "Soul Vampirism",
        "ability": "psyche",
        "column": "force",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Soul Vampirism presses a target at this Power rank. A hit uses the Force column."
      },
      {
        "cat": "life",
        "name": "Spirit Control",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Spirit Control affects a living target. They may resist with Endurance or Psyche."
      },
      {
        "cat": "life",
        "name": "Vertigo",
        "ability": "psyche",
        "column": "force",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Vertigo presses a target at this Power rank. A hit uses the Force column."
      },
      {
        "cat": "life",
        "name": "Aura Control",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Aura Control affects a living target. They may resist with Endurance or Psyche."
      },
      {
        "cat": "life",
        "name": "Distance Healing",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Distance Healing affects a living target. They may resist with Endurance or Psyche."
      }
    ]
  },
  {
    "id": "magic",
    "label": "Magic",
    "items": [
      {
        "cat": "magic",
        "name": "Abjuration",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Abjuration is a magical working. The rite is a Power FEAT at this rank."
      },
      {
        "cat": "magic",
        "name": "Alchemy",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Alchemy is a magical working. The rite is a Power FEAT at this rank."
      },
      {
        "cat": "magic",
        "name": "Alteration",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Alteration is a magical working. The rite is a Power FEAT at this rank."
      },
      {
        "cat": "magic",
        "name": "Astral Supremacy",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Astral Supremacy is a magical working. The rite is a Power FEAT at this rank."
      },
      {
        "cat": "magic",
        "name": "Conjuration",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Conjuration is a magical working. The rite is a Power FEAT at this rank."
      },
      {
        "cat": "magic",
        "name": "Demonic",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Demonic is a magical working. The rite is a Power FEAT at this rank."
      },
      {
        "cat": "magic",
        "name": "Dimensional Pocket",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Dimensional Pocket is a magical working. The rite is a Power FEAT at this rank."
      },
      {
        "cat": "magic",
        "name": "Divination",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Divination is a magical working. The rite is a Power FEAT at this rank."
      },
      {
        "cat": "magic",
        "name": "Elemental",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Elemental is a magical working. The rite is a Power FEAT at this rank."
      },
      {
        "cat": "magic",
        "name": "Enhancement",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Enhancement is a magical working. The rite is a Power FEAT at this rank."
      },
      {
        "cat": "magic",
        "name": "Entreaty",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Entreaty is a magical working. The rite is a Power FEAT at this rank."
      },
      {
        "cat": "magic",
        "name": "Evocation",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Evocation is a magical working. The rite is a Power FEAT at this rank."
      },
      {
        "cat": "magic",
        "name": "Faerie",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Faerie is a magical working. The rite is a Power FEAT at this rank."
      },
      {
        "cat": "magic",
        "name": "Familiar",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Familiar is a magical working. The rite is a Power FEAT at this rank."
      },
      {
        "cat": "magic",
        "name": "Illusory",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Illusory is a magical working. The rite is a Power FEAT at this rank."
      },
      {
        "cat": "magic",
        "name": "Imprisonment",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Imprisonment is a magical working. The rite is a Power FEAT at this rank."
      },
      {
        "cat": "magic",
        "name": "Item",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Item is a magical working. The rite is a Power FEAT at this rank."
      },
      {
        "cat": "magic",
        "name": "Life Protection",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Life Protection is a magical working. The rite is a Power FEAT at this rank."
      },
      {
        "cat": "magic",
        "name": "Magic Absorption",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Magic Absorption is a magical working. The rite is a Power FEAT at this rank."
      },
      {
        "cat": "magic",
        "name": "Necromancy",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Necromancy is a magical working. The rite is a Power FEAT at this rank."
      },
      {
        "cat": "magic",
        "name": "Phantasmal",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Phantasmal is a magical working. The rite is a Power FEAT at this rank."
      },
      {
        "cat": "magic",
        "name": "Spirit Eviction",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Spirit Eviction is a magical working. The rite is a Power FEAT at this rank."
      },
      {
        "cat": "magic",
        "name": "Techno-Magic",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Techno-Magic is a magical working. The rite is a Power FEAT at this rank."
      },
      {
        "cat": "magic",
        "name": "Thaumaturgy",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Thaumaturgy is a magical working. The rite is a Power FEAT at this rank."
      },
      {
        "cat": "magic",
        "name": "Witchery",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Witchery is a magical working. The rite is a Power FEAT at this rank."
      },
      {
        "cat": "magic",
        "name": "Wild",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Wild is a magical working. The rite is a Power FEAT at this rank."
      }
    ]
  },
  {
    "id": "matterControl",
    "label": "Matter Control",
    "items": [
      {
        "cat": "matterControl",
        "name": "Animation",
        "ability": "reason",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Animation changes matter at this Power rank. The Judge sets how much and how far."
      },
      {
        "cat": "matterControl",
        "name": "Extradimensional Matter Control",
        "ability": "reason",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Extradimensional Matter Control changes matter at this Power rank. The Judge sets how much and how far."
      },
      {
        "cat": "matterControl",
        "name": "Extraterrestrial Matter Control",
        "ability": "reason",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Extraterrestrial Matter Control changes matter at this Power rank. The Judge sets how much and how far."
      },
      {
        "cat": "matterControl",
        "name": "Matter Teleportation",
        "ability": "agility",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Matter Teleportation changes matter at this Power rank. The Judge sets how much and how far."
      },
      {
        "cat": "matterControl",
        "name": "Warping",
        "ability": "reason",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Warping changes matter at this Power rank. The Judge sets how much and how far."
      }
    ]
  },
  {
    "id": "matterConversion",
    "label": "Matter Conversion",
    "items": [
      {
        "cat": "matterConversion",
        "name": "Projective Sizing",
        "ability": "reason",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Projective Sizing changes matter at this Power rank. The Judge sets how much and how far."
      },
      {
        "cat": "matterConversion",
        "name": "Transmutation",
        "ability": "reason",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Transmutation changes matter at this Power rank. The Judge sets how much and how far."
      },
      {
        "cat": "matterConversion",
        "name": "Weight Manipulation",
        "ability": "reason",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Weight Manipulation changes matter at this Power rank. The Judge sets how much and how far."
      }
    ]
  },
  {
    "id": "matterCreation",
    "label": "Matter Creation",
    "items": [
      {
        "cat": "matterCreation",
        "name": "Chemical Creation",
        "ability": "reason",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Chemical Creation changes matter at this Power rank. The Judge sets how much and how far."
      },
      {
        "cat": "matterCreation",
        "name": "Hyper-Dimensional Pocket",
        "ability": "reason",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Hyper-Dimensional Pocket changes matter at this Power rank. The Judge sets how much and how far."
      },
      {
        "cat": "matterCreation",
        "name": "Nexus Creation",
        "ability": "reason",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Nexus Creation changes matter at this Power rank. The Judge sets how much and how far."
      },
      {
        "cat": "matterCreation",
        "name": "Projectile Creation",
        "ability": "reason",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Projectile Creation changes matter at this Power rank. The Judge sets how much and how far."
      },
      {
        "cat": "matterCreation",
        "name": "Undead Creation",
        "ability": "reason",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Undead Creation changes matter at this Power rank. The Judge sets how much and how far."
      }
    ]
  },
  {
    "id": "mental",
    "label": "Mental Enhancement",
    "items": [
      {
        "cat": "mental",
        "name": "Bio-Manipulation",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Bio-Manipulation is a mental Power. Contests use Psyche against this rank."
      },
      {
        "cat": "mental",
        "name": "Cyber Transmission",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Cyber Transmission is a mental Power. Contests use Psyche against this rank."
      },
      {
        "cat": "mental",
        "name": "Dream Travel",
        "ability": "agility",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Dream Travel is a mental Power. Contests use Psyche against this rank."
      },
      {
        "cat": "mental",
        "name": "Eidetic Memory",
        "ability": "psyche",
        "column": "force",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Eidetic Memory presses a target at this Power rank. A hit uses the Force column."
      },
      {
        "cat": "mental",
        "name": "Electrokinesis",
        "ability": "psyche",
        "column": "force",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Electrokinesis presses a target at this Power rank. A hit uses the Force column."
      },
      {
        "cat": "mental",
        "name": "Empathic Transmission",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Empathic Transmission is a mental Power. Contests use Psyche against this rank."
      },
      {
        "cat": "mental",
        "name": "Empathic Vampirism",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Empathic Vampirism is a mental Power. Contests use Psyche against this rank."
      },
      {
        "cat": "mental",
        "name": "Hydrokinesis",
        "ability": "psyche",
        "column": "force",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Hydrokinesis presses a target at this Power rank. A hit uses the Force column."
      },
      {
        "cat": "mental",
        "name": "Memory Alteration",
        "ability": "psyche",
        "column": "force",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Memory Alteration presses a target at this Power rank. A hit uses the Force column."
      },
      {
        "cat": "mental",
        "name": "Mental Gestalt",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Mental Gestalt is a mental Power. Contests use Psyche against this rank."
      },
      {
        "cat": "mental",
        "name": "Omniscience",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Omniscience is a mental Power. Contests use Psyche against this rank."
      },
      {
        "cat": "mental",
        "name": "Photographic Reflexes",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Photographic Reflexes is a mental Power. Contests use Psyche against this rank."
      },
      {
        "cat": "mental",
        "name": "Photographic Memory",
        "ability": "psyche",
        "column": "force",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Photographic Memory presses a target at this Power rank. A hit uses the Force column."
      }
    ]
  },
  {
    "id": "physical",
    "label": "Physical Enhancement",
    "items": [
      {
        "cat": "physical",
        "name": "Abnormal Physiology",
        "ability": "endurance",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Abnormal Physiology pushes the body past human limits at this Power rank."
      },
      {
        "cat": "physical",
        "name": "Bodily Tension",
        "ability": "endurance",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Bodily Tension pushes the body past human limits at this Power rank."
      },
      {
        "cat": "physical",
        "name": "Cocoon",
        "ability": "endurance",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Cocoon pushes the body past human limits at this Power rank."
      },
      {
        "cat": "physical",
        "name": "Death Simulation",
        "ability": "endurance",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Death Simulation pushes the body past human limits at this Power rank."
      },
      {
        "cat": "physical",
        "name": "Detonation",
        "ability": "agility",
        "column": "energy",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Detonation projects an energy attack at this Power rank."
      },
      {
        "cat": "physical",
        "name": "Enhanced Beauty",
        "ability": "endurance",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Enhanced Beauty pushes the body past human limits at this Power rank."
      },
      {
        "cat": "physical",
        "name": "Hyper-Agility",
        "ability": "endurance",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Hyper-Agility pushes the body past human limits at this Power rank."
      },
      {
        "cat": "physical",
        "name": "Hyper-Breath",
        "ability": "endurance",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Hyper-Breath pushes the body past human limits at this Power rank."
      },
      {
        "cat": "physical",
        "name": "Immovability",
        "ability": "endurance",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Immovability pushes the body past human limits at this Power rank."
      },
      {
        "cat": "physical",
        "name": "Immunity",
        "ability": "endurance",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Immunity pushes the body past human limits at this Power rank."
      },
      {
        "cat": "physical",
        "name": "Karma Power",
        "ability": "endurance",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Karma Power pushes the body past human limits at this Power rank."
      },
      {
        "cat": "physical",
        "name": "Longevity",
        "ability": "endurance",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Longevity pushes the body past human limits at this Power rank."
      },
      {
        "cat": "physical",
        "name": "Malleability",
        "ability": "endurance",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Malleability pushes the body past human limits at this Power rank."
      },
      {
        "cat": "physical",
        "name": "Metabolic Resistance",
        "ability": "endurance",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Metabolic Resistance pushes the body past human limits at this Power rank."
      },
      {
        "cat": "physical",
        "name": "Non-Detection",
        "ability": "intuition",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Non-Detection pushes the body past human limits at this Power rank."
      },
      {
        "cat": "physical",
        "name": "Omnipotence",
        "ability": "endurance",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Omnipotence pushes the body past human limits at this Power rank."
      },
      {
        "cat": "physical",
        "name": "Quills",
        "ability": "fighting",
        "column": "edged",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Quills cuts or pierces at this Power rank."
      },
      {
        "cat": "physical",
        "name": "Retarded Aging",
        "ability": "endurance",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Retarded Aging pushes the body past human limits at this Power rank."
      },
      {
        "cat": "physical",
        "name": "Strength Absorption",
        "ability": "endurance",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Strength Absorption pushes the body past human limits at this Power rank."
      },
      {
        "cat": "physical",
        "name": "Techno-Organic Body",
        "ability": "endurance",
        "column": "",
        "forceField": false,
        "bodyArmor": true,
        "definition": "Techno-Organic Body pushes the body past human limits at this Power rank."
      },
      {
        "cat": "physical",
        "name": "Unstoppability",
        "ability": "endurance",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Unstoppability pushes the body past human limits at this Power rank."
      },
      {
        "cat": "physical",
        "name": "Non-Stick Substance",
        "ability": "endurance",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Non-Stick Substance pushes the body past human limits at this Power rank."
      },
      {
        "cat": "physical",
        "name": "Physical Threshold",
        "ability": "endurance",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Physical Threshold pushes the body past human limits at this Power rank."
      },
      {
        "cat": "physical",
        "name": "Hyper-Fighting",
        "ability": "endurance",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Hyper-Fighting pushes the body past human limits at this Power rank."
      },
      {
        "cat": "physical",
        "name": "Body Enhancement",
        "ability": "endurance",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Body Enhancement pushes the body past human limits at this Power rank."
      },
      {
        "cat": "physical",
        "name": "Dual Brain",
        "ability": "endurance",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Dual Brain pushes the body past human limits at this Power rank."
      },
      {
        "cat": "physical",
        "name": "Poison Generation",
        "ability": "endurance",
        "column": "force",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Poison Generation presses a target at this Power rank. A hit uses the Force column."
      }
    ]
  },
  {
    "id": "powerControl",
    "label": "Power Control",
    "items": [
      {
        "cat": "powerControl",
        "name": "Assimilation",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Assimilation alters, copies, or feeds another Power at this rank."
      },
      {
        "cat": "powerControl",
        "name": "Cosmic Host",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Cosmic Host alters, copies, or feeds another Power at this rank."
      },
      {
        "cat": "powerControl",
        "name": "Dance",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Dance alters, copies, or feeds another Power at this rank."
      },
      {
        "cat": "powerControl",
        "name": "Hyper-Power",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Hyper-Power alters, copies, or feeds another Power at this rank."
      },
      {
        "cat": "powerControl",
        "name": "Investment",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Investment alters, copies, or feeds another Power at this rank."
      },
      {
        "cat": "powerControl",
        "name": "Multi-Tasking",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Multi-Tasking alters, copies, or feeds another Power at this rank."
      },
      {
        "cat": "powerControl",
        "name": "Omniversal",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Omniversal alters, copies, or feeds another Power at this rank."
      },
      {
        "cat": "powerControl",
        "name": "Power Creation",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Power Creation alters, copies, or feeds another Power at this rank."
      },
      {
        "cat": "powerControl",
        "name": "Power Domination",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Power Domination alters, copies, or feeds another Power at this rank."
      },
      {
        "cat": "powerControl",
        "name": "Power Duplication",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Power Duplication alters, copies, or feeds another Power at this rank."
      },
      {
        "cat": "powerControl",
        "name": "Power Gestalt",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Power Gestalt alters, copies, or feeds another Power at this rank."
      },
      {
        "cat": "powerControl",
        "name": "Scream",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Scream alters, copies, or feeds another Power at this rank."
      },
      {
        "cat": "powerControl",
        "name": "Imbuing",
        "ability": "psyche",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Imbuing alters, copies, or feeds another Power at this rank."
      }
    ]
  },
  {
    "id": "self",
    "label": "Self-Alteration",
    "items": [
      {
        "cat": "self",
        "name": "Density Control - Self",
        "ability": "reason",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Density Control - Self changes the hero's own body at this Power rank."
      },
      {
        "cat": "self",
        "name": "Prehensile Skin",
        "ability": "fighting",
        "column": "grappling",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Prehensile Skin grabs and holds at this Power rank, using the Grappling column."
      },
      {
        "cat": "self",
        "name": "Razorskin",
        "ability": "fighting",
        "column": "edged",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Razorskin cuts or pierces at this Power rank."
      }
    ]
  },
  {
    "id": "travel",
    "label": "Travel",
    "items": [
      {
        "cat": "travel",
        "name": "Displacement",
        "ability": "agility",
        "column": "",
        "forceField": false,
        "bodyArmor": false,
        "definition": "Displacement moves the hero. Speed or the destination uses this Power rank."
      }
    ]
  }
];
const BY_KEY = new Map();
for (const group of ULTIMATE_GROUPS) {
  for (const item of group.items) BY_KEY.set(keyOf(item.name), item);
}
export function ultimateSpec(name) {
  return BY_KEY.get(keyOf(name)) || null;
}
export function ultimateCatalog() {
  const out = {};
  for (const group of ULTIMATE_GROUPS) out['Ultimate — ' + group.label] = group.items.map((item) => item.name);
  return out;
}

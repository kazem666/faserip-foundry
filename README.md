# FASERIP for Foundry VTT

Unofficial Foundry Virtual Tabletop **system** for FASERIP-style superhero games (the rules engine behind the classic 1980s Marvel Super Heroes RPG Advanced Set and later retro-clones such as 4C / FASERIP / FASERIPopedia).

This package contains **no Marvel characters, art, or copyrighted rules text**. You still need a rulebook you are allowed to use (original books you own, or an OGL retro-clone).

Version **1.2.0**. Built for Foundry VTT **v14** (`compatibility.minimum` / `verified`: 14). Not for v12 or v13.

## Install through Foundry

1. Open Foundry VTT **v14** Setup.
2. **Game Systems** → **Install System**.
3. Paste this Manifest URL:

```
https://raw.githubusercontent.com/kazem666/faserip-foundry/main/system.json
```

4. Install, then create a world using **FASERIP**.
5. First boot: disable extra modules until the sheet and FEAT dialogs load cleanly.

Repo: https://github.com/kazem666/faserip-foundry

### Manual install

Copy this repository into `{User Data}/Data/systems/faserip/` so that `system.json` sits in that folder.

## What you get

- Hero and NPC actor types with the seven FASERIP abilities
- Advanced Set rank ranges plus standard and minimum rank numbers
- Automatic Health = F+A+S+E and Karma = R+I+P
- Resources rank and split Popularity
- Item types: Power, Talent, Contact, Equipment, Weapon
- Catalog pickers for generic Powers, Talents, and Contact types
- FEAT rolls on the Universal Table (White / Green / Yellow / Red)
- Intensity helper and Battle Effects Table columns
- Column Shift and Karma spend (minimum 10 to modify a roll)
- Initiative `1d10 + Intuition modifier`
- Body Armor / Force Field damage reduction
- Recovery and hourly Healing
- Generated-hero dialog

## Legal

FASERIP as a nickname for the seven attributes is community usage. Marvel Super Heroes, Marvel characters, and the original TSR text are property of their owners. This system is a fan-made virtual-tabletop helper so you can run games with books you already have.

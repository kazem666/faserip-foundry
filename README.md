# FASERIP for Foundry VTT

Unofficial Foundry Virtual Tabletop **system** for FASERIP-style superhero games (the rules engine behind the classic 1980s Marvel Super Heroes RPG Advanced Set and later retro-clones such as 4C / FASERIP / FASERIPopedia).

This package contains **no Marvel characters, art, or copyrighted rules text**. You still need a rulebook you are allowed to use (original books you own, or an OGL retro-clone).

Version **1.8.2**. Built for Foundry VTT **v14** (`compatibility.minimum` / `verified`: 14). Not for v12 or v13.

## What you get

- Hero and NPC actor types with the seven FASERIP abilities
- Advanced Set **rank ranges** plus standard and minimum rank numbers
- Automatic **Health = F+A+S+E rank numbers** and **Karma = R+I+P rank numbers**
- Resources rank and split Popularity (hero / secret ID)
- Item types: Power, Talent, Contact, Equipment, Weapon
- Catalog pickers for generic Powers, Talents, and Contact types
- One-click **FEAT rolls** on the Universal Table (White / Green / Yellow / Red)
- **Intensity** helper (Green / Yellow / Red needed)
- **Battle Effects Table** columns (Slugfest, Shooting, Wrestling, Charging, Slam/Stun/Kill checks, etc.)
- Column Shift and Karma spend (minimum 10 to modify a roll)
- Initiative `1d10 + Intuition modifier`
- Body Armor / Force Field damage reduction (Energy −20 vs armor; Field −10 vs non-energy)
- Recovery (Endurance number, once per day) and hourly Healing
- Generated-hero dialog (origins, Random Ranks columns, special-ability counts)
- Optional Judge world setting **Use Ultimate Powers Book (MA3)**: physical form, origin of power, expanded power-class lists, UPB count table, and stimulus/effect/duration weaknesses. Off by default.
- Color-coded chat cards
- Distance measured in **areas**

## Foundry v14

1.8.2 keeps v14 compatibility and makes generation / FEAT dialogs scrollable:

- `system.json` `compatibility.minimum` / `verified` set to `"14"` (v12–v13 will not load it)
- Dialogs use `DialogV2`
- Rich text uses `foundry.applications.ux.TextEditor`
- Templates use `foundry.applications.handlebars.renderTemplate`
- Sheet registration uses `foundry.documents.collections.Actors` / `Items`
- Character sheets still use AppV1 (`foundry.appv1.sheets.ActorSheet`) — that path is valid on v14 and scheduled for removal in v16
- HTML fields declared in `documentTypes` for server-side sanitization
- `foundry.utils.duplicate` replaced with `deepClone`

Install into a **separate v14 user-data folder**. Do not point a v13 world at this package.

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

1. Download the repo zip or copy this folder into `{User Data}/Data/systems/faserip/`.
2. The folder name **must** be `faserip` and `system.json` must be inside it.

## How to play on the sheet

1. Create an Actor of type **Hero** or **NPC**.
2. Either set ranks by hand or click **Generate Hero** (Advanced Set random generation). Generated heroes use the **minimum** rank number for each rank.
3. Optionally type a **rank number** under each ability. `0` means “use the standard number for that rank.” Health and Karma maxima use the numbers.
4. Click an ability letter to roll a FEAT. In the dialog:
   - **Column Shift** moves the Universal Table column.
   - **Spend Karma** adds to the d100 (minimum 10) and subtracts from current Karma.
   - **Intensity** tells you whether you need Green, Yellow, or Red.
   - **Battle Effects column** prints Slam / Stun / Kill / Hold / etc. on the chat card.
5. Use **Combat FEAT** for a preset attack/defense column using the matching ability.
6. Flag a Power as **Body Armor** or **Force Field**, or enter a manual value on the Biography tab. **Apply Damage** subtracts that protection first. Check **Energy** to apply the −20 armor penalty.

### Intensity

- Ability rank **higher** than Intensity → need **Green**
- **Equal** → need **Yellow**
- Intensity **higher** → need **Red**
- Optional: 3+ ranks easier may be treated as Automatic; more than 1 rank harder as Impossible

### Initiative

Combat formula is `1d10 + @initMod`. The modifier comes from the Intuition **rank number**:

| Intuition # | Modifier |
| --- | --- |
| 0–10 | +0 |
| 11–20 | +1 |
| 21–30 | +2 |
| 31–40 | +3 |
| 41–50 | +4 |
| 51–75 | +5 |
| 75+ | +6 |

A natural 1 on the initiative die stays 1 in the printed rules; Foundry still adds the modifier unless you override the roll.

### Healing

- **Recovery**: Endurance rank number, 10 turns after last damage, once per day (sheet button).
- **Hour Heal**: Endurance rank number per hour. Shift-click to double (bedrest / medical care).
- Health 0 marks the hero unconscious; use an Endurance **Kill Check** Combat FEAT if you are using the dying rules.

## Rank ranges (Advanced Set)

| Rank | Range | Generated min | Standard |
| --- | --- | --- | --- |
| Shift 0 | 0 | 0 | 0 |
| Feeble | 1–2 | 1 | 2 |
| Poor | 3–4 | 3 | 4 |
| Typical | 5–7 | 5 | 6 |
| Good | 8–15 | 8 | 10 |
| Excellent | 16–25 | 16 | 20 |
| Remarkable | 26–35 | 26 | 30 |
| Incredible | 36–45 | 36 | 40 |
| Amazing | 46–62 | 46 | 50 |
| Monstrous | 63–87 | 63 | 75 |
| Unearthly | 88–125 | 88 | 100 |
| Shift X | 126–175 | 126 | 150 |
| Shift Y | 176–350 | 176 | 200 |
| Shift Z | 351+ | 351 | 500 |
| Class 1000 / 3000 / 5000 | fixed | same | same |

## Macros / API

```js
const actor = canvas.tokens.controlled[0]?.actor ?? game.user.character;
await game.faserip.promptFeatRoll({
  actor,
  rankId: "incredible",
  label: "Web-Slinging"
});
await game.faserip.rollFeat({
  actor,
  rankId: actor.getAbilityRank("fighting"),
  effectsColumn: "blunt",
  label: "Slugfest"
});
await game.faserip.promptGeneration(actor);
```

Battle Effects `effectsColumn` ids: `blunt`, `edged`, `shooting`, `throwEdged`, `throwBlunt`, `energy`, `force`, `grappling`, `grabbing`, `escaping`, `charging`, `dodging`, `evading`, `blocking`, `catching`, `slamCheck`, `stunCheck`, `killCheck`.

## Legal

FASERIP as a nickname for the seven attributes is community usage. Marvel Super Heroes, Marvel characters, and the original TSR text are property of their owners. This system is a fan-made virtual-tabletop helper so you can run games with books you already have. Do not ship official scans, character write-ups you do not have rights to, or Marvel trademarks inside a public Foundry package.

## File map

```
faserip/
  system.json
  faserip.mjs
  module/config.mjs          ranks, Universal Table, Battle Effects, catalogs
  module/foundry-api.mjs     Foundry v14 API wrappers
  module/chargen.mjs         generated-hero dialog
  module/data/               TypeDataModels
  module/documents/          Actor / Item classes
  module/sheets/             character + item sheets
  module/dice/               FEAT roller
  templates/
  styles/faserip.css
  lang/en.json
```

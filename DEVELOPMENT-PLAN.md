# Neon Relic — Foundry VTT System Development Plan

> **Target:** Foundry VTT v14 (14.361+)  
> **Engine:** Year Zero Engine — d6 dice-pool variant  
> **Status:** Planning  

---

## Overview

A complete Foundry VTT v14 system module for the **Neon Relic** TTRPG. Implements the Year Zero Engine d6 dice-pool variant with Neon Relic's signature mechanics: Corruption, Artifacts, Gear Degradation, Card Initiative, Headquarters management, Case File operations, and more.

Architecture follows **Blade Runner's** build tooling with **Mutant: Year Zero's** modern DataModel approach and **ApplicationV2** sheets throughout.

---

## Key Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Foundry target | v14 (compatibility.minimum: 14, verified: 14) | Current stable release (April 2026) |
| Data models | `TypeDataModel` classes (`foundry.abstract.TypeDataModel`) | Modern v12+ approach — no legacy `template.json` |
| Sheets | `ApplicationV2` + `HandlebarsApplicationMixin` | V1 deprecated (removal in v16), V2 is the standard |
| Build pipeline | esbuild + gulp | Proven in Blade Runner/T2K — SCSS, YAML→JSON, path aliases |
| Dice library | `yzur` bundled locally in `src/lib/` | Stability over npm — from T2K/Vaesen pattern |
| Compendium packs | LevelDB built from YAML source | v14 native format, version-control friendly |
| Entry point | ES Module (`neon-relic.mjs`) | v14 standard |
| Styling | SCSS → CSS via build | Follows Blade Runner pattern |
| Internationalization | YAML → JSON via build | Clean authoring, compiled for Foundry |
| HQ system | Actor type | Vaesen headquarter + MYZ ark pattern |
| Scope | Complete — all core rules | Nothing deferred |

---

## Reference Systems

| System | Repo | Use As Reference For |
|---|---|---|
| Blade Runner | `blade-runner-foundry-vtt` | Build tooling, project structure, SCSS organization, item sheet pattern |
| Twilight 2000 | `twilight2000-foundry-vtt` | Vehicle system, ammo tracking, yzur bundling |
| Vaesen | `vaesen-foundry-vtt` | d6 pool rolls, HQ management, card initiative, push mechanic |
| Mutant: Year Zero | `mutant-year-zero` | TypeDataModel classes, RollDialogV2 (AppV2), Ark management, gear dice |

---

## Phase Structure

| # | Phase | Key Deliverables |
|---|---|---|
| 1 | Scaffolding & Build Tooling | system.json, package.json, gulp+esbuild pipeline, directory structure |
| 2 | Data Models | TypeDataModel classes for 5 actor types + 11 item types |
| 3 | Document Classes | NeonRelicActor, NeonRelicItem with game logic methods |
| 4 | Dice System & Roll Dialog | yzur registration, d6 pool rolls, push, resource/artifact die, D66, group roll, stunt tables |
| 5 | Character Sheets | Agent, NPC, Mob, HQ, Vehicle sheets (ApplicationV2) |
| 6 | Item Sheets | Per-type rendering for all 11 item types |
| 7 | Corruption System | Track, threshold (10+EMP+modifiers), stage effects, healing, session cap, retroactive threshold |
| 8 | Gear Degradation & Resource Dice | Weapons/tools auto-degrade on gear die 1s; armor degrades on push/stunts; step-down chains, repair table, scavenging, crafting |
| 9 | Artifact System | Artifact die (d20→fractured, step on 1 only), activation, emissions, cascade, containment rituals |
| 10 | Combat & Initiative | Card-draw deck (Ace–10), action economy, zone ranges, surprise, shared cards, vehicle combat |
| 11 | Fear Checks & Conditions | Wits-only roll, panic table with exit conditions, FR escalation, Active Effects |
| 12 | HQ Management | Upgrade tree (Standing-gated), standing triggers, DP, personnel, threat meter, compromise events, vault re-consecration |
| 13 | Case File & Operations Board | 14-day/56-shift grid, 14-square org countdowns, cross-links, relic milestones, packets, scene resolution, info/NPC/location cards, equipping, debrief, downtime |
| 14 | Social Conflict | Disposition 1–5, opposed social rolls, psychoanalyze modes, push penalties, multi-agent scenes |
| 15 | Mob Rules & Chase System | Mob actor type (shared pool), 5-position chase track UI |
| 16 | Travel & Road Events | Shift-based travel, road event table (d12), 3-option tail mechanics, vehicle wear |
| 17 | Compendium Packs | LevelDB from YAML — all game content (9 artifacts, 16 general talents, 60+ backgrounds, investigative tech, 10 vehicles, 5 faction operatives, sample case, case generator tables) |
| 18 | Art, Tokens & Theming | 1980s analog aesthetic, custom assets, light/dark mode |
| 19 | Polish & Integration | Dice So Nice, YZE Combat compat, sockets, macros, accessibility, session tracking |

---

## Detailed Phases

### Phase 1: Scaffolding & Build Tooling

- `system.json` manifest (v14 format with `documentTypes`, `compatibility`, `esmodules`)
- `package.json` with esbuild, gulp, sass, yaml, husky, eslint, prettier
- `gulpfile.js` orchestrating: SCSS→CSS, YAML→JSON, esbuild bundle, static copy, pack compilation
- `esbuild.config.js` with path aliases (`@actor`, `@item`, `@components`, `@system`, `@utils`)
- Directory structure: `src/`, `static/`, `dist/`
- Entry point: `src/neon-relic.mjs`
- Basic `src/lang/en.yaml` with system name
- `.eslintrc.json`, `.prettierrc`, `.gitignore`

---

### Phase 2: Data Models

All TypeDataModel classes using `foundry.data.fields` (`NumberField`, `StringField`, `SchemaField`, `BooleanField`, `HTMLField`, `ArrayField`, `FilePathField`).

#### Actor Models (`src/data/actor-models.mjs`)

| Model | Key Fields |
|---|---|
| `AgentDataModel` | Attributes (STR/AGI/WIT/EMP with value/max), 13 skills, corruption (value/threshold with modifier aggregation from talents/injuries), clearance level, division, sub-unit, specialty (3 per sub-unit, 27 total), age group, country of origin (`countryOfOrigin` StringField — distinct from biography), encumbrance (carry=STR×2, encumbered>STR×2 = −1 die STR+AGI + move costs Slow Action, overloaded>STR×3 = cannot move zones), anchor (named personal relationship + memory), dark secret (text + XP trigger flag), biography, division item (Codex/Satchel/Bracer with per-scene/per-session use tracking), key attributes/skills per division, starting CL (Wayfinder=3, Recovery=2, Keep=3), retroactive threshold deadline tracker (`thresholdDeadlineSession`: session# by which Corruption must be reduced, or null) |
| `NPCDataModel` | Attributes, skills (sparse), armor rating, fear rating (base + optional `escalatedFearRating` for conditional/mid-encounter escalation), tier, broken state, dying state (boolean — † Critical Injury sustained), motivation, special abilities, corruption stage (0–3: Stage 0=normal, Stage 1=−1 social die, Stage 2=goal replaced+FR 1, Stage 3=catatonic/Hollow), disposition (NumberField 1–5, NOT enum), damage resistance flags (`{physical: true}`, `{firearms: {maxDamage: 1}}`), damage immunity flags, social skill immunity flags (`{intimidate: true}` — e.g., Accord Zealots), anchor item link (`anchorItemId` for entity-bound objects), reconstitution timer, incorporeal flag (boolean — moves through solids, immune to physical while active), zoneLocked flag (boolean — cannot move from zone), NPC Card fields (organization link, secret, goal, artifact connection, starting/gained knowledge, locations, positive/negative result, tags: multi-select from Witness/Operative/Civilian/Cultist/Authority/Specialist), corruption exposure tracker (separate from PC Corruption — artifact proximity symptoms) |
| `MobDataModel` | Shared strength pool (3/member, max 15), member count, best pool reference, bonus dice (max +3), single initiative card, broken state |
| `VehicleDataModel` | Speed (Slow/Medium/Fast/Very Fast), AR, reliability (NumberField), wear track (0 to reliability), handling, capacity (Enc), noise, crew, special modifiers (StringField — e.g., Sneak modifier, weather penalties), half-reliability penalty flag. **Wear thresholds are dynamic**: problem at `floor(reliability/2)`, vehicle stops at `reliability` value. NOT hardcoded 3/5. |
| `HeadquartersDataModel` | Standing (0–20), threat meter (0–6), development points, personnel slots, linked player IDs, vault re-consecration counter (every 3 Case Files), compromise event log |

#### Item Models (`src/data/item-models.mjs`)

| Model | Key Fields |
|---|---|
| `WeaponDataModel` | Gear bonus, damage, range, target attribute (`targetAttribute`: STR/AGI/WIT/EMP — routes damage to correct attribute), melee type (`meleeType`: Heavy=Force/Fast=Brawl, null for ranged), range penalty table (`rangePenalties`: per-range modifier object, e.g., `{engaged: -1, long: -1}` for pistol, `{engaged: +1damage, long: -2}` for shotgun), traits (Reliable, High Capacity, Full Auto, Stunned, range-conditional damage), ammo die (current step), CL, encumbrance |
| `ArmorDataModel` | Armor rating, encumbrance, agility penalty (e.g., Tactical Riot Armor = −2 AGI), CL |
| `GearDataModel` | Gear bonus, encumbrance, CL, broken state |
| `ConsumableDataModel` | Resource die (current step), type (first-aid/trauma/battery/specialized-battery/rations/artifact-components/junk/hardware/medical/specialized-parts/covenant-cache), starting die value |
| `ArtifactDataModel` | Tier (1–3), artifact die (current step d4–d20), activation condition, corruption cost, effect, risk tag, emission type, emission trigger (`emissionTrigger`: text — custom trigger for Pulse/Burst), emission corruption override (`emissionCorruption`: NumberField — default varies per artifact), emission radius override (`emissionRadius`: text/enum — some artifacts override defaults), encumbrance (base = tier value), active artifact pressure (+1 Enc if activated this Case File), fracture condition (unique text + mechanical effect per artifact), containment profile type (Physical Isolation/Ritual Quiescence/Environmental Suppression/Proximity Restriction/Temporal Lock/Cognitive Anchor), replicable (boolean), decay track (optional, 0–5) |
| `TalentDataModel` | Type (general/division/sub-unit/background), description, corruption cost (or free), requirements, per-session limit flag, healing tag (boolean — max 3 Corruption healed/session from tagged **General** Talents; Division healing talents like Gallows Humor/Confessor are EXEMPT from this cap and heal 1d4, not 1), once-per-session use tracker, conditional modifier definition (e.g., Adrenaline Junkie: +2 AGI dice when STR < max STR — computed in `prepareDerivedData()`) |
| `CriticalInjuryDataModel` | Type (physical/mental), d66 reference, effect, time limit, lethal flag (`†` marker — creates Dying state), healed state, insight (permanent bonus that persists after healing — e.g., +1 Command; insights stack from different injuries, same insight cannot be gained twice) |
| `AnchorDataModel` | Relationship description, memory, uses remaining |
| `DarkSecretDataModel` | Description, XP trigger, division (for example tables), faction consequence level, exposure consequences (Exposed to Covenant: −1 Standing; Active aid to rival: −3 Standing + CL −1 for one Case File; Exposed to rival faction: faction leverage once/arc) |
| `UpgradeDataModel` | Tier (1–3), DP cost, Standing requirement (minimum Standing gate), category, effect, prerequisites (for HQ) |
| `LocationDataModel` | Name, description, availability (open/clue-locked/contact-locked/time-locked/packet-locked), NPCs present, information available, organizations present, positive result, negative result, milestone changes |

---

### Phase 3: Document Classes

#### `NeonRelicActor` (`src/actor/actor-document.mjs`) — extends `Actor`

```js
// Key methods
prepareDerivedData()     // Compute corruption threshold (10 + EMP + talent/injury modifiers),
                         // carry capacity (STR×2), encumbered penalties (>STR×2: −1 STR+AGI, move=Slow),
                         // overloaded (>STR×3: cannot move), broken states,
                         // NPC corruption stage derivation, half-reliability penalty (vehicles),
                         // conditional talent modifiers (Adrenaline Junkie: +2 AGI if STR < max),
                         // vehicle wear thresholds (problem=floor(reliability/2), stop=reliability)
applyDamage(amount, attribute)  // Route damage by type: Physical→STR, Exhaustion→AGI, Horror→WIT, Trauma→EMP
healAttribute(amount, attribute)
applyCorruption(amount, source)
healCorruption(amount, method)
getRollData()            // For formula access in rolls
checkThresholdDrop()     // Retroactive threshold check when EMP drops — triggers Fear Check
resetSessionTrackers()   // Clear once-per-session uses (Anchor, Conditioned Mind, Bracer, talents)
stabilize(healer)        // Heal WIT Diff 2 + First Aid Kit → attribute restored to 1.
                         //   Without kit: −2 dice. Failed attempt: −1 STR to treating agent.
                         //   Full Shift of rest required. DOA (result 66): must stabilize same round.
getDyingState()          // Returns true if Broken + † Critical Injury. Dying character dies at end of scene
                         //   (not round) unless stabilized.
recoverAttributes(method)  // Short Rest: +1/attribute/Shift. Medical Aid: +1/success beyond Diff.
                           // Full Downtime: all damage cleared. Infirmary: +3/attribute/Shift.
                           // Broken Recovery: Heal WIT Diff 2 → attribute to 1 (full Shift).
```

#### `NeonRelicItem` (`src/item/item-document.mjs`) — extends `Item`

```js
// Key methods
prepareDerivedData()     // Resource die labels, weapon range labels, derived encumbrance
degrade()               // Reduce gear bonus by 1, mark broken at 0
stepDownDie()           // Step down resource/artifact die
// Getters
get isPhysical()
get isEquippable()
get isBroken()
```

---

### Phase 4: Dice System & Roll Dialog

- **Bundle `yzur`** in `src/lib/yzur.js` — register as `'nr'` variant via `YZUR.YearZeroRollManager.register()`
- **Custom die categories**: Attribute (white/`b`), Skill (green/`s`), Gear (black/`g`)

#### `NRRollHandler` (`src/components/roll/roll-handler.mjs`)

- Build pool from attribute + skill + gear bonus + modifiers (help dice, cover, etc.)
- Count 6s for successes, track 1s on gear dice for degradation → auto-degrade item
- Push mechanic: reroll all non-6 attribute + skill dice, +1 Corruption (to active roller only — helpers do NOT gain Corruption), gear dice locked
- Stunt points = extra successes beyond difficulty (spent immediately — cannot be saved)
- **Unarmed damage baseline**: bare hands deal 1 Damage on hit (no gear dice)
- Opposed roll mode: both sides roll, compare totals, ties favor PC; zero-zero = stalemate (no change, **no Corruption** to acting character); PC vs. PC ties: DA rules in context (no mechanical default)
- **Pushed opposed rolls**: push decisions must be declared **before** comparing results (significant UX flow: collect push decisions from both sides before revealing totals)
- **D66 roll mode**: two d6 read as tens + units (range 11–66) for critical injury tables
- **Group Roll mode**: all team members roll same skill simultaneously. Three canonical threshold types: **All succeed**, **Majority succeed**, **At least one succeeds** — presented as selector in Group Roll dialog. Used for travel, stealth, investigation.
- **Help dice rules**: helper must be at Engaged or Close range AND have skill ≥ 1 (or DA approval). Help dice are Skill Dice (green/`s`), max 2. Helpers do not gain Corruption when active roller pushes.
- **Post-roll stunt picker UI**: presents skill-specific stunt options (13 skills × 3 stunts each) plus 6 Generic Stunts, each with SP cost and effect. Stunt selection must occur before closing roll result.
- **Weapon special traits automation**: Reliable (ignore first gear 1 on push), High Capacity (extra successes hit additional adjacent targets), Full Auto (two-attack/two-ammo procedure), range-conditional damage (+1 at Engaged for shotgun)

#### `NRRollDialog` (`src/components/roll/roll-dialog.mjs`)

- `ApplicationV2` dialog for roll configuration
- Attribute/skill selector dropdowns
- Gear modifier input
- Difficulty input (default 1)
- Help dice (0–2) with range/skill validation prompt
- Modifier adjustments (conditions, cover, soft cover +2 AR, hard cover +4 AR, etc.)
- Push button rendered on chat message (Vaesen pattern)
- **Conditioned Mind intercept**: if talent owned, show "Declare Conditioned Mind" checkbox before push (once/session, push without +1 Corruption)

#### Specialized Roll Types

| Roll Type | Mechanic |
|---|---|
| **Standard Roll** | Attribute + Skill + Gear, count 6s |
| **Resource Die** | d4–d12 step-down; on 1–2, reduce one step; at d4 depleted |
| **Artifact Die** | d20→d12→d10→d8→d6→d4→Fractured; on **1 only** (NOT 1–2), step down |
| **Ammo Die** | Same as Resource Die, weapon-attached |
| **Fear Check** | Wits dice only, count 6s (success) AND 1s (Corruption) separately |
| **Armor Roll** | Armor Rating as gear dice; each 6 absorbs 1 damage |
| **D66** | Two d6 read as tens+units (range 11–66) for critical injury table lookups |
| **Group Roll** | All participants roll same skill; team passes if threshold count of individuals succeed |
| **Opposed Roll** | Both sides roll, compare totals; ties favor PC; zero-zero = stalemate |

---

### Phase 5: Character Sheets (ApplicationV2)

All sheets extend `HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2)`.

#### `AgentSheet` (`src/actor/agent/agent-sheet.mjs`)

| Tab | Contents |
|---|---|
| Summary | Name, division, sub-unit, specialty, CL, portrait, key stats overview |
| Attributes/Skills | 4 attributes (current/max bars, click-to-roll), 13 skills grouped by attribute, key skills highlighted per division |
| Combat | Equipped weapons, armor, conditions tracker, initiative card display |
| Gear | Full inventory with encumbrance bar (carry/encumbered/overloaded thresholds), resource dice widgets, ammo tracking |
| Talents | Categorized talent list (general, division, sub-unit, background) with per-session use tracking, healing tag indicators |
| Corruption | Track visualization (0 to threshold), current stage indicator, threshold modifier breakdown (10+EMP+talent/injury), healing log, session healing cap tracker |
| Biography | Anchor (relationship + memory), dark secret (text + XP trigger), backstory (HTML editor), division item status |

#### `NPCSheet` (`src/actor/npc/npc-sheet.mjs`)

- Compact layout matching the stat block format from the rules
- All attributes on one line, key skills listed, AR, FR (base + escalated), tier badge
- Broken state selector, special abilities list
- Quick roll buttons for any skill/attribute
- Corruption stage indicator (0–3) with derived mechanical effects
- Disposition scale (1–5 numeric) with threshold indicator at 3+
- Damage resistance/immunity flags display
- Entity anchor link field (bound physical object)
- Reconstitution timer field
- **Simplified humanoid stat block toggle**: for standard humanoid NPCs (faction operatives, civilians), collapses to a single-line stat summary with key stats only

#### `MobSheet` (`src/actor/mob/mob-sheet.mjs`)

- Member count adjuster (+/−)
- Shared strength pool display with damage tracking
- Best pool display with bonus dice calculation
- Single initiative card
- Member dropout indicators

#### `HeadquartersSheet` (`src/actor/headquarters/hq-sheet.mjs`)

| Tab | Contents |
|---|---|
| Overview | Standing tracker (0–20) with rank label, DP available, cell members |
| Upgrades | 3-tier tree with prerequisite visualization AND Standing-gate indicators, purchase buttons |
| Personnel | Recruited personnel with once-per-case ability toggles, activation roll button (Command EMP Diff 2 when under surveillance) |
| Operations Board | Embedded Operations Board (see Phase 13) |
| Threat | Threat meter (0–6), DA-only controls, compromise event log, vault re-consecration counter |

#### `VehicleSheet` (`src/actor/vehicle/vehicle-sheet.mjs`)

- Speed (Slow/Medium/Fast/Very Fast) / AR / Reliability / Handling / Capacity / Noise stats
- Wear track (0–reliability) with dynamic thresholds: problem at floor(reliability/2), stops at reliability
- Half-reliability penalty indicator (−1 die on vehicle rolls)
- Crew slots (driver + passengers)
- Cargo inventory with capacity tracking
- Vehicle repair button (Tech WIT Diff 2, clears 1 Wear per scene)

---

### Phase 6: Item Sheets (ApplicationV2)

- Single `NRItemSheet` base class with per-type rendering via `static PARTS`
- Each item type gets its own `.hbs` template partial

#### Per-Type Features

| Item Type | Sheet Features |
|---|---|
| Weapon | Gear bonus, damage, range selector, traits checkboxes (Reliable, High Capacity, Full Auto, Stunned, range-conditional damage), ammo die widget |
| Armor | AR input, encumbrance, agility penalty field, CL |
| Gear | Gear bonus, encumbrance, CL, broken toggle |
| Consumable | Resource die step indicator with roll button, type selector, starting die value |
| Artifact | Corruption tier selector, artifact die visualization (d20 chain), activation condition text, emission type, containment profile type selector, fracture condition text, active pressure flag, decay track (optional), replicable toggle, encumbrance (auto = tier) |
| Talent | Type categorization, description (HTML), corruption cost, prerequisite fields, healing tag toggle, per-session use counter, once-per-session flag |
| Critical Injury | Physical/mental toggle, d66 ref, effect text, time limit, lethal flag, healed checkbox, insight field (permanent bonus text — persists after healing) |
| Anchor | Relationship description, memory text, uses remaining counter |
| Dark Secret | Description text, XP trigger, division-specific examples |
| Upgrade | Tier, DP cost, Standing requirement, category, effect description, prerequisites |
| Location | Name, description, availability type selector, NPCs present, information available, organizations present, positive/negative result, milestone changes |

---

### Phase 7: Corruption System

**`src/components/corruption.mjs`** — Central corruption management utility.

#### Core Functions

```js
gainCorruption(actor, amount, source)   // Add to track, check threshold, apply stage effects
healCorruption(actor, amount, method)   // Remove from track, respect session cap (5) + healing tag cap (3)
getCorruptionStage(value)              // Return current stage + effects
checkThreshold(actor)                  // Detect breach → retirement warning
checkThresholdDrop(actor)              // Retroactive: EMP loss drops threshold below current Corruption
                                       //   → immediate Fear Check; fail = instant catatonia;
                                       //   success = must reduce below new threshold by end of next session
computeThreshold(actor)                // 10 + EMP + modifiers from talents/injuries
                                       //   (Redundant Safeties +2, Fracture Point −2, etc.)
                                       //   Aggregated from owned items/Active Effects
```

#### Corruption Sources (automated)

| Source | Amount | Trigger |
|---|---|---|
| Pushing a roll | +1 | Roll handler callback |
| Division Talent activation | +1 (most) | Talent use |
| Artifact activation | +1/+2/+3 (by tier) | Artifact workflow |
| Fear Check (any 1s) | +1 | Fear check handler |
| Failed Fear Check | +1 additional | Fear check handler |
| Psychoanalyze contaminated NPC | +1 | Social conflict handler |
| Fight panic guilt | +1 | If Fight panic (roll 1) attack targets an ally |
| Stage 10–12 ally contamination | +1/scene | Allies in same zone as Stage 10–12 character |
| Skipping Personal Phase | +1 | Between-case downtime |
| Active Artifact Pressure (encumbered) | +1/scene start | Carrying activated artifact that causes encumbered state |
| Corruption Cascade (3+ artifacts) | All costs/scene | 3+ activated artifacts carried simultaneously |

#### Stage Effects (auto-applied Active Effects)

| Range | Stage | Mechanical Effect |
|---|---|---|
| 1–3 | Nosebleeds/Migraines | Descriptive only |
| 4–6 | Auditory Hallucinations | DA may require Wits Diff 1 roll; fail = act on hallucination 1 round |
| 7–9 | Eldritch Tremors | −1 die on Sleight of Hand and Firearms |
| 10–12 | Reality Distortion | Electronic Gear degrades each scene; allies in same zone gain +1 Corruption/scene start |
| 13–14 | Fugue States | d6 each scene; on 1–2 DA controls character 1 round |
| 15–17 | Collapse of Self | −1 die on all social rolls (reachable with Redundant Safeties or similar) |
| >Threshold | Catatonia | Character permanently retired (triggers on Corruption **strictly greater than** threshold, not equal) |

#### Healing Methods

| Method | Amount | Limit |
|---|---|---|
| Anchor Scene | 1d4 | Once/session; cannot share scene with Safe Scene; **one Anchor at a time** (enforce on sheet); if Anchor is lost/destroyed, healing unavailable until replacement during downtime |
| Safe Scene | 1 | Once/session; must be a **different scene** than Anchor Scene; cannot share scene with Anchor Scene |
| General Talent (Healing tag) | 1 each | Max 3 Corruption/session from Healing-tagged **General** Talents combined |
| Division Healing Talent (Gallows Humor, Confessor, etc.) | 1d4 each | **Exempt** from General Talent cap. Track separately. |
| Full Rest (24hrs) | Empathy score | Between Case Files only, requires non-anomalous location, exempt from session cap |
| Faraday Cage (HQ) | Up to 4 | One character/downtime |
| **Session Cap** | Max 5 total | From all in-session active sources (Anchor + Safe + Talents + facilities). Full Rest exempt. |

---

### Phase 8: Gear Degradation & Resource Dice

**`src/components/resource-die.mjs`**

#### Gear Degradation

Two distinct degradation systems exist:

**Weapons and Tools:**
- Triggered when any **Gear Die shows a 1 on the initial roll** (NOT on pushes — Gear Dice are locked during pushes)
- `degradeGear(item)` reduces gear bonus by 1
- Applies identically to weapons (Gear Bonus −1), tools (Gear Bonus −1), and improvised items (break outright on single Gear Die showing 1)
- At Gear Bonus 0 → item marked **Broken** (unusable until repaired)
- Chat notification on degradation

**Armor:**
- Armor does **NOT** degrade on rolling 1s on armor dice
- Armor Rating decreases by 1 when: (a) the character **pushes any roll** while wearing the armor, or (b) a **Combat Stunt or Critical Injury** specifically targets the armor
- Armor uses flat AR decrement, NOT the Gear Die step chain — this is an explicit exception
- `degradeArmor(item)` reduces AR by 1

#### Resource Die System

- Step chain: **d12 → d10 → d8 → d6 → d4 → Depleted**
- Roll after meaningful use; on **1–2**, step down one size
- UI widget on item sheet showing current die with roll button
- Categories with starting dice: Basic First Aid Kit (d10), Trauma Surgical Kit (d8), Battery Pack (d8), Specialized Battery (d6), Field Rations (d8), Artifact Components (d6), Junk/Scrap (d6), Hardware Components (d8), Medical Supplies (d10), Specialized Parts (d6), Covenant Cache Parts (d12)

#### Ammo Die (weapon-attached)

- Same mechanic as Resource Die
- Starting die varies by weapon (pistol=d10, shotgun=d8, rifle=d8)
- Roll after each turn of firing; Full Auto = roll twice
- Displayed on weapon item sheet and agent combat tab

#### Repair System

- **Repair Difficulty table**:
  - Degraded: Tech Diff 1, 15 min, restores 1 gear bonus
  - Broken non-electronic: Tech Diff 2, 1 Shift, requires parts (Resource Die)
  - Broken electronic: Tech Diff 3, 1 Shift + Power Tools
  - Artifact-adjacent damage: Tech Diff 4, Occult Lab required
- **Repair parts Resource Die system**: Junk/Scrap (d6), Hardware Components (d8), Medical Supplies (d10), Specialized Parts (d6), Covenant Cache Parts (d12). Roll after each repair — on 1–2, step down.
- **Stack Division agents**: +1 die on all repair/crafting Tech rolls, Quick Repair in 5 min (not 15), Full Repair in 2 hours (not a full Shift), no Junk step-down on success, one free Hardware Components (d8) per case from contacts, workshop access at HQ without full build

#### Scavenging System

- **Scavenging**: Investigate (WIT) Diff 1, Slow Action. 6-row location table (d6) determines find quality. Extra successes upgrade Junk to Hardware Components.
- **Restocking sources**: Equipping Phase (free, subject to CL), field resupply (DA availability, Tech/Sleight of Hand Diff 1–2), HQ Underground Field Medic (medical to d8, once per Case File)

#### Improvised Crafting

- **Improvised item crafting table** (10 items): Club, Shiv, Molotov, First Aid Kit, Signal Jammer, Tripwire, Garrote, Lockpick Set, Bug Detector, **Field Radio Booster** — each with Tech difficulty and time
- **Improvised item failure table** (d6): Catastrophic Break (1 STR damage), Jams, Splinters/Shrapnel (adjacent ally Endure Diff 1), Power Surge (Tech Diff 1), Reduced Function, Quick Fix

---

### Phase 9: Artifact System

**`src/components/artifact.mjs`**

#### Artifact Die Chain

**d20 → d12 → d10 → d8 → d6 → d4 → Fractured**

- Roll after each activation; on **1 only** (NOT 1–2 like Resource Die), step down
- Past d4 = **Fracture** — triggers artifact's unique Fracture Condition (per-artifact text + mechanical effect, NOT a generic event)
- Separate from Resource Die (different chain, different trigger value)

#### Activation Workflow

1. Verify activation condition met (specific trigger per artifact)
2. Confirm Slow Action spent
3. Apply Corruption = artifact tier (+1/+2/+3)
4. Effect resolves automatically (no roll — Corruption IS the cost)
5. Roll Artifact Die → potential step-down
6. Mark artifact as "activated this Case File" → Active Artifact Pressure applies

#### Corruption Tiers

| Tier | Cost | Power Level | Base Enc |
|---|---|---|---|
| 1 — Uncanny | +1 Corruption | Auto-success or information reveal | 1 |
| 2 — Threatening | +2 Corruption | Guaranteed success or significant combat advantage | 2 |
| 3 — Catastrophic | +3 Corruption | Transcends human ability entirely | 3 |

#### Active Artifact Pressure

- An artifact activated at least once this Case File gains **+1 Enc** above base for the remainder of the Case File
- If this pushes the carrier into Encumbered, they also gain +1 Corruption at the start of each scene

#### Emissions (passive effects tracked on artifact item)

| Type | Radius | Effect |
|---|---|---|
| Aura | Same zone | +1 Corruption/scene start to all in zone |
| Pulse | Adjacent zones | +1 Corruption on trigger event |
| Burst | Up to 4 zones | +2 Corruption to all (or +1 on Endure AGI Diff 2 save) |

#### Cascade Detection

- If agent carries **3+ activated artifacts** → Corruption Cascade
- All artifacts apply their Corruption cost at end of each scene, even if none were activated
- Warning displayed on agent sheet

#### Lore Identification

- **Lore (Diff 2)** roll to sense an artifact's tier and whether it was previously activated

#### Containment Ritual Workflow (`src/components/containment-ritual.mjs`)

Three ritual types with distinct rules:

| Type | Skill/Diff | Time | Lore Prerequisite |
|---|---|---|---|
| Quiescence | Lore WIT Diff 2 | 10 min | Lore 1+ |
| Shielding | Lore WIT Diff 2 | Full scene | Lore 1+ |
| Banishment | Lore WIT Diff 3 | Full scene | Lore 3+ (or Wayfinder); Lore 2+ without Wayfinder at +1 Diff |

**Difficulty modifiers**: +1 (Tier 3/active/emitting/multi-person), +2 (catastrophic multi-zone), +1 (hostile conditions), −1 (exact containment profile/true name), −1 (prepared vault/lab)

**Minimum inputs**: Boundary materials, Target/Anchor, Key (true name/condition), Working Window

**4 Support Actions** (other PCs contribute):
1. Identify the Key (Investigate/Lore)
2. Build the Boundary (Tech/Sleight of Hand → +1 die to leader)
3. Hold the Line (Command/Firearms/Force/Sneak)
4. Stabilize the Subject (Heal/Psychoanalyze)

**Backlash table** (d6 on failure or push): Corruption Surge (+1 all in boundary), Boundary Rupture (+1 Diff next attempt), Clock Advance, Psychic Recoil (1 WIT/EMP damage to leader), Anchor Shift, Hostile Backlash (entity lashes out or electronics lose 1 Gear Bonus)

**Pushing ritual cost**: +1 Corruption on resolution (even success) if target is active/manifest/broadcasting

**Containment Mission success criteria** (3 conditions — all must be met):
1. Artifact physically secured (in Satchel or approved container)
2. All Containment Truths identified (checklist complete on Relic Sheet)
3. No active emissions detected (containment profile applied and verified)

#### Containment

- Containment profiles tracked on artifact items: Physical Isolation, Ritual Quiescence, Environmental Suppression, Proximity Restriction, Temporal Lock, Cognitive Anchor
- Containment status suppresses emissions

#### Artifact Decay Track (Optional Rule)

- Hidden 0–5 score per artifact. Advances on successful Lore study, containment ritual, or Artifact Die step-down
- Decay 1–2: step down die + Corruption cost −1 (min 1)
- Decay 3–4: step down two + cost −1 + diminished effect
- Decay 5: inert/neutralized
- Core campaign loop mechanic — toggled via system setting

---

### Phase 10: Combat & Initiative

**`src/combat/combat.mjs`** + **`src/combat/combatant.mjs`**

#### Card-Draw Initiative

- Extend Foundry's `Combat` and `Combatant` document classes
- Virtual deck: **Ace through 10** (no face cards)
- Initiative value = card value (Ace = 1, lowest)
- Higher card acts first
- **Reshuffle every round** (full deck reset)
- Display card image in combat tracker sidebar
- Integrate with YZE Combat module if present
- **Shared initiative**: multiple combatants can share a single card (e.g., MJ-12 Strike Agents). All act on the same initiative slot.
- **Combat Reflexes talent**: draw 2 cards, keep 1. Or swap with a willing ally after draw.
- **Elevated zone bonus**: +2 to card value for elevated combatants
- **Initiative tie-breaking**: re-draw until resolved (automated in `Combat.rollInitiative` override)

#### Combat Tracker Customization

- Card image display per combatant
- Action economy indicators: Slow Action (spent/available), Fast Action (spent/available)
- Condition icons on combatant entries
- Round counter with auto-reshuffle

#### Action Economy Tracking

| Type | Quantity | Examples |
|---|---|---|
| Slow Action | 1/turn | Attack, First Aid, Reload, Activate Artifact, Help |
| Fast Action | 1/turn | Move 1 zone, Draw weapon, Take cover, Dodge |
| Reactive Action | As triggered | Dodge, Parry (cannot parry Damage 4+ weapons) |
| Free Action | Unlimited | Speak, drop item, look around |

- Tracked per combatant per round
- Movement: 1 zone = Fast, 2 zones = Fast + Slow (entire turn)
- **Retreat/Disengage**: AGI roll Diff 1 to break from Engaged; then can move 2 zones
- **Surprise/Ambush rounds**: free full round (Slow+Fast) for ambushers; targets cannot use Reactive Actions. Triggered by opposed Sneak vs Investigate.

#### Combat Mechanics

- **Parry counterattack bonus**: beat attacker by 2+ successes → attacker loses Slow Action next round
- **Dodge mechanic**: defender rolls AGI dice as defense; ties favor defender (NOT attacker like standard opposed rolls)
- **Cover loss on firing**: firing from cover = lose cover bonus against return fire until next turn
- **Ranged attacks vs elevated targets**: −1 die penalty
- **Unarmed damage**: bare hands deal 1 Damage on hit (no gear dice, damage routes to target’s STR)
- **Chase attack penalty**: −1 die on attacks during a chase (on foot); DA-discretion skill choice for chase maneuvers
- **Vehicle combat**: vehicles as cover (vehicle AR as personal armor dice), attacking vehicles (damage exceeding AR = Wear), targeting occupants (called shot/open windows = half AR)

#### Zone Ranges

| Zone | Approx. Distance | Grid Equivalent |
|---|---|---|
| Engaged | Arm's reach | Same square (0–1 sq) |
| Near | ~10m | 1–4 squares |
| Short | ~30m | 5–12 squares |
| Long | ~100m | 13–24 squares |
| Distant | ~300m | 25+ squares |

> **Note:** Zone naming uses **Engaged/Near/Short/Long/Distant** per the canonical chapter text. Grid equivalents provided for VTT mapping.

#### Zone Features

Each zone may have one or more features, stored as tags on the scene/tile:

| Feature | Effect |
|---|---|
| **Cramped** (closets, crawlspaces, car interiors) | Long weapons (rifles, shotguns) suffer −2 dice. Movement into/out costs Slow Action. |
| **Rough** (rubble, ice, wet floors) | Entering requires Endure (AGI) Diff 1 or go prone. |
| **Dark** (unlit, fog, smoke) | Halve dice on ranged attacks and Investigate. +2 dice on Sneak. |
| **Open** (parking lots, fields, rooftops) | +1 die on ranged attacks. No cover available. |
| **Elevated** (rooftops, catwalks, upper floors) | +2 to initiative card value. −1 die for attackers below. |

#### Special Melee Maneuvers

These are distinct from combat stunts — they are declared as the attack action:

| Maneuver | Roll | Effect |
|---|---|---|
| **Grapple** | Opposed Brawl | Target restrained; cannot move or use weapons until break free (opposed Brawl next turn). |
| **Shove** | Force vs Endure | Target moved to adjacent zone or knocked prone. |
| **Disarm** (non-stunt) | Sleight of Hand vs Force or Brawl | Target drops held weapon at Engaged range. |
| **Feint** | Brawl vs Wits | If attacker wins, next attack gains +2 dice. |

#### Cover Tiers

| Cover Type | Bonus | Examples |
|---|---|---|
| **Soft Cover** | +2 AR | Car door, drywall, wooden crate |
| **Hard Cover** | +4 AR | Concrete wall, engine block, steel door |

- **Cover loss on firing**: firing from cover = lose cover bonus against return fire until next turn (tracked as combatant state flag `inCover`)

---

### Phase 11: Fear Checks & Conditions

**`src/components/fear-check.mjs`**

#### Fear Check Procedure

1. Roll dice = current **Wits** value (no skill, no gear, no help, **cannot push**)
2. Count results:
   - **Any 6s** = success (passed)
   - **Any 1s** (regardless of pass/fail) = +1 Corruption
   - **No 6s** = failure → 1 Wits damage + 1 Corruption + Panic Table roll
3. Automated chat output showing successes, 1s, and consequences

#### Fear Rating Frequency Tiers

| Fear Rating | Check Frequency |
|---|---|
| FR 1–2 | One check per scene on first confrontation |
| FR 3–4 | Check each time entity acts against a character |
| FR 5 | Check every round while entity is in sight |

- **Fear Rating escalation**: some entities have FR that increases mid-encounter (e.g., FR 2 initially → FR 4 once nature understood). Escalation triggers a new Fear Check even if character already passed one this scene. Requires `fearRating` + `escalatedFearRating` fields on NPC data model.
- **Sustained presence checks**: each additional round at Engaged range with an active hostile entity triggers a new Fear Check, even after initial success.
- **Fear check immunity states**: Broken, unconscious, or in-Fugue characters do not make Fear checks. Characters currently suffering a Panic result skip additional checks until the result ends.
- **One-check-per-trigger per known entity**: Once a character has successfully passed a Fear Check against a specific entity type, subsequent encounters with the same type in later scenes do not require a new check unless the entity escalates (new FR tier or new behavior). Track `knownEntities` set on actor.
- **MJ-12 Fear check training bonus**: MJ-12 operatives (NPC faction) receive +1 die on Fear Checks (faction trait, applied as Active Effect).

#### Panic Table (d6, on failed Fear Check)

| Roll | Response | Mechanical Effect | Exit Condition |
|---|---|---|---|
| 1 | Fight | Single Brawl attack (AGI+Brawl, no gear, damage 1) at nearest target. Target can Dodge but not Parry (surprise). If target is ally → attacker gains +1 Corruption from guilt. | After one strike |
| 2 | Flight | Run 2 zones/round for 1d6 rounds. Drop held items. | Duration expires, or physically restrained (opposed Brawl/Force) |
| 3 | Freeze | Paralyzed. | Ally Psychoanalyze Diff 1 succeeds, OR fear source no longer visible |
| 4 | Denial | Cannot acknowledge entity. | Ally Psychoanalyze Diff 2; character becomes Shaken (−1 die all rolls rest of scene) |
| 5 | Compulsion | Locked in repetitive behavior. | Ally Psychoanalyze Diff 2 |
| 6 | Fugue | DA takes character sheet for scene. This is **Panic Fugue** (acute, single-scene). Distinct from **Chronic Fugue** at Corruption Stage 13–14 (recurring d6 per scene). | Ally Psychoanalyze Diff 3; then −2 dice all rolls rest of scene |

#### Conditions (Active Effects)

**Damage Type Routing** (config.mjs `DAMAGE_TYPES` enum):

| Damage Type | Target Attribute | Sources |
|---|---|---|
| Physical | STR | Weapons, falls, explosions |
| Exhaustion | AGI | Chases, forced marches, grapples |
| Horror | WIT | Fear checks, supernatural perception |
| Trauma | EMP | Psychic attacks, social devastation |

**Three Death States:**
1. **Broken** (attribute = 0): character collapses. No further actions. Must be stabilized within the scene. **Broken attribute stays at 0** unless a Critical Injury result specifically says otherwise.
2. **Dying** (Broken + † Critical Injury): character has a lethal injury. Dies at **end of scene** (not round) unless stabilized. Tracked as boolean `isDying` on actor.
3. **Dead**: Dying character not stabilized by scene end, or DOA result (66 on Critical Injury).

**Simultaneous Injury Resolution Order**: Physical damage → Death Check (Critical Injury if Broken) → Corruption check (if applicable). Process left-to-right.

**AGI-damage Broken**: When AGI reaches 0, roll on **Physical** Critical Injury table (not Mental), with DA narrative reinterpretation for exhaustion/collapse.

**Night Terrors** (Critical Injury effect): halves AGI Short Rest recovery (round down).

**Physical Conditions:**
- Exhausted, Battered, Wounded → Broken (STR or AGI = 0) → Dying if † Critical Injury

**Mental Conditions:**
- Shaken, Distressed, Unhinged → Broken (WIT or EMP = 0) → Dying if † Critical Injury

**Corruption Stages** — applied as passive Active Effects with mechanical modifiers

#### Status Effect Icons

- Custom icon set registered via `CONFIG.statusEffects`
- One icon per condition + corruption stage
- Applied/removed via condition tracker on character sheet

---

### Phase 12: HQ Management

Built into the **HeadquartersSheet** (Phase 5) with full interactivity.

#### Upgrade Tree (3 Tiers, 10 Facilities)

Each facility requires BOTH a DP cost AND a minimum Standing threshold (not just tree prerequisites).

**Tier 1** (no prerequisites):
- Secure Communications Room (2 DP)
- Basic Medical Bay (2 DP)
- Safeguard Protocol (1 DP)

**Tier 2** (require 1× Tier 1 + Standing ≥ 5):
- Microfiche Archive (3 DP + Standing 5) — +2 Gear on Lore research
- Occult Laboratory (3 DP + Standing 5) — safe artifact identification
- Black-Market Armory (3 DP) — CL 4 requisition for all (**NOT Standing-gated**; no minimum Standing required)
- Faraday Cage (4 DP + Standing 5) — heals up to 4 Corruption/downtime

**Tier 3** (require 2× Tier 2 + Standing ≥ 10–15):
- Field Intelligence Network (5 DP + Standing 10) — free pre-case clue + **+1 Investigation die vs rival factions** (persistent modifier)
- Covenant Armorer (5 DP + Standing 10) — permanent +1 Gear Bonus upgrade/case + grants Reliable trait (item does not degrade on first 1 per session)
- Corruption Dampening Vault (6 DP + Standing 10) — stores 3 artifacts safely; must be **re-consecrated every 3 Case Files** (Lore WIT Diff 2; failure = random stored artifact activates)
- Safe House Network (6 DP + Standing 15) — fallback locations everywhere

#### Division Item + Facility Interaction Modifiers

- Verdant Codex + Microfiche Archive: both bonuses apply on same Lore roll
- Verdant Codex + Occult Lab: +1 bonus die on identification
- Warden's Bracer + Faraday Cage: both heal independently
- Keep Containment Protocol talent + Vault re-consecration: talent bonus applies

#### Standing Milestones & Rewards

| Score | Rank | Key Benefit |
|---|---|---|
| 0–4 | Unknown | Minimal access |
| 5–9 | Acknowledged | Tier 2 unlocked, CL 3 cell-wide |
| 10–14 | Trusted | Tier 3 unlocked, CL 4 cell-wide, Keep Reinforcements (once/arc) |
| 15–19 | Honored | Classified Archive Access (+2 dice Lore/Investigate), Covenant Asset Call-In (once/arc), Lore research bonuses: +1 die Lore at Standing 15, +2 dice at Standing 20 |
| 20 | Covenant Elite | Legacy Standing Bonus (replacement PCs start +3 Standing), Unrestricted HQ Upgrade (0 DP once/arc) |

#### Standing Gain/Loss Triggers

| Event | Standing Change |
|---|---|
| Successful artifact containment | +2 |
| Zero civilian exposure | +1 |
| Tier 3 artifact recovered | +3 |
| Civilian casualty | −2 each |
| Media exposure | −3 |
| Agent compromised | −4 |

#### Threat Meter (DA-only)

- Hidden from players (GM-only section of HQ sheet)
- 0–6 scale, increases from operational exposure
- **Decrease**: −1 at end of fully covert Case File (no witnesses, no law enforcement, no corruption incidents)
- At 6 → Compromise Event triggered (d6 table auto-roll)

#### Compromise Event Table (d6)

| Roll | Outcome | Mechanical Effect |
|---|---|---|
| 1–2 | Surveillance | Threat resets to 4, Tier 2+ facilities offline until surveillance dealt with (1 Case File mini-investigation) |
| 3–4 | Break-In | Threat resets to 3, one facility trashed (random: number built facilities, roll d6, re-roll if exceeds count), repair at half DP cost |
| 5 | Direct Assault | Threat resets to 2, triggers **HQ Defense Scene** (structured combat) |
| 6 | Burned | Threat resets to 0, safehouse fully compromised, lose Tier 1–2 facilities (Tier 3 survive only with Safe House Network), must relocate, single extraction scene, all banked DP intact |

#### HQ Defense Scene Procedure

- Structured combat triggered by Compromise roll of Direct Assault
- Attacker strength formula: Grunt × team size or Elite × half
- Safeguard Protocol initiative bonus (if purchased)
- Retreat-and-reroll mechanic available

#### Personnel Recruitment

5 types, each 2–4 DP with once-per-Case-File benefits:
- Station Dispatcher, Underground Field Medic, Black-Market Fence, Covenant Scholar, Signals Technician
- **Personnel activation roll**: Command (EMP) Diff 2 required when contact is under surveillance, compromised, or operating outside capability. Otherwise no roll.

#### Rival Cells (Optional Rule)

- d6 relationship table (Cooperative → Hostile)
- Separate rival Standing track
- Contested artifact recovery mechanics
- Shared information procedures, combined operations bonuses
- Hostile cell escalation: rival surpassing player Standing by 5+ triggers leftover case assignments
- Toggled via system setting

---

### Phase 13: Case File & Operations Board

#### Case File (`src/components/case-file.mjs`)

Implemented as a custom **JournalEntry sub-type** with structured data:

- **Metadata**: case name, status (active/resolved/cold), assigned cell
- **14-day / 56-shift grid**: 4 shifts per day (Morning/Day/Evening/Night). Day 1 = catastrophe. The grid is a fixed 14-column structure, NOT a simple counter.
- **Relic Milestones on shift row**: artifact escalation events keyed to specific day-columns. When the last quadrant of a milestone day fills, the artifact event fires automatically. Per-case custom events with `day`, `label`, and `effect` fields.
- **Linked entities**: Organizations (with 14-square countdowns), Locations (with availability locks), NPCs (with card data including tags: Witness/Operative/Civilian/Cultist/Authority/Specialist), Information Cards (with double-sided reveal state)
- **Case document types**:
  - **Case Brief** (player-shareable): summary handout distributed to players at case start
  - **Relic Sheet**: case-scoped document with artifact stats, Containment Truth checklist (checkboxes for each truth discovered), and containment profile
  - **Organization Reference**: consolidated DA-only view of all organizations in the case with countdown states, cross-links, and dormancy status
- **Handout/clue image distribution**: system for distributing clue images (photos, documents, maps) to specific players via chat or journal
- **Equipping Phase** workflow between cases:
  - Requisition UI based on individual CL and cell-wide CL floor (from Standing)
  - Gear selection/swap interface
  - CL requirement validation
  - **Stack Requisition Bonus**: Stack Division agents receive a crafting materials bonus during Equipping Phase (free Junk/Scrap d6 or Hardware Components d8)
  - **Warden sidearm pre-authorization**: Keep Division Wardens at CL 3+ may bypass standard CL requirements for a sidearm (one per Case File)
  - Recovery armor CL exception: Recovery agents (CL 2) can request CL 3 armor if Standing ≥ 2 (once per Case File)
  - **Specialized Parts CL reduction**: Stack Division agents reduce CL requirement for Specialized Parts by 1 (min CL 1)

#### Development Points (DP) Earning Triggers

| Source | DP Earned |
|---|---|
| Case File completion | +3 |
| Artifact successfully contained | +1 |
| Named Threat neutralized | +1 |
| Pressure event (Relic Milestone/Org Countdown) survived | +1 |
| Civilian rescue (at risk to cell) | +1 |

#### Covenant Request Packets

- **1 packet per shift limit**, minimum 2-shift response time (3+ for complex/classified)
- Contains multiple related questions
- Returns unlock scenes, provide Containment Truths, identify contacts, or reveal rival moves
- Data model: `pendingPackets[]` with `shiftSent`, `shiftAvailable`, and `content` fields
- `packetsSentThisShift` counter on case file for enforcement

#### Scene Resolution System

- **Key Activity**: one player rolls primary skill
- **4 Contribution types** from other players:
  - Immediate: adds dice to the Key Activity roll
  - Shield: reduces consequences on partial success/failure
  - Position: creates future benefit (stacks for next scene)
  - Delayed: launches parallel thread (tracked separately)
- **5 Result Bands**: Clean Progress, Progress With Cost, Partial Progress, Setback With Signal, Breach
- **Delayed Results tracking**: 3 fields per delayed action: what will return, earliest shift it can return, what can disrupt it

#### Operations Board (`src/components/operations-board.mjs`)

An `ApplicationV2` window launchable from HQ sheet or via macro:

- **Organization rows**: each org has a **14-square countdown** with variable starting value (1–14), current value, and **3 labeled milestone squares** (O_M1, O_M2, O_M3) at specific positions. Data model needs: `startingValue`, `currentValue`, and `milestones[3]` with `position`, `label`, and `consequenceText`.
- **Organization cross-links**: milestone descriptions can advance OTHER org rows (e.g., "O2M2: Advance O3 by 2 and O1 by 1"). Each milestone has a `crossLinks[]` array specifying target org ID and advancement amount. This is the core case engine mechanic.
- **Dormant organizations**: `dormant: boolean` flag + `activationCondition` text. Start inactive; activation triggered by agent action, cross-link from another org milestone, or relic milestone. Once active, escalates normally.
- **Location cards**: availability type (open/clue-locked/contact-locked/time-locked/packet-locked), linked NPCs, information available
- **NPC tracker**: linked to NPC actors with card data (10 fields: Name, Org link, Secret, Goal, Artifact Connection, Starting Knowledge, Gained Knowledge, Locations, Positive/Negative Result)
- **Information Card deck**: 6 fields per card (ID, Content, Found At, Known By, HQ Fallback day#, Type: Containment Truth/Supporting Intel). Double-sided: player-facing front, DA-facing back. Drag to reveal.
- **Containment Truth structure**: 3 mechanically required facts per case artifact: Trigger Condition, Appetite, Quiescence Condition. All three needed for safe containment. Each must have 2+ field sources + HQ fallback.
- **HQ Safety Valve**: Information Cards have an "HQ Fallback" day field — if agents miss a fact in the field, they can request it via packet. The cost is shifts.
- **Shift Advancement button**: advances all active Organization countdown squares by 1, checks for milestone triggers + cross-links
- **Split Operations**: agents can split across locations in same shift. Each subgroup resolves independently. Communication requires payphones. Other group cannot intervene until next shift.
- **Packet tracking**: which information packets have been delivered to players, sent/received shift tracking

#### Debrief & Aftermath Workflow (`src/components/debrief.mjs`)

An `ApplicationV2` dialog presented at case conclusion:

- **Debrief checklist**: 5 yes/no questions → +1 XP each
  - "Did you participate in the session?" (automatic +1 XP — always yes)
  - "Did you risk your life for a fellow Covenant member or an innocent civilian?"
  - "Did your Dark Secret complicate the mission, or did you heavily interact with your Anchor?"
  - "Did the team successfully secure or contain an Occult Artifact?"
  - "Did you learn something new and significant about the supernatural threat or rival factions?"
- Tallies XP and transitions to DP spending on HQ sheet
- **Aftermath**: earn DP based on mission success, spend on HQ upgrades

#### Between-Case-Files 5-Phase Downtime (`src/components/downtime.mjs`)

1. **Aftermath**: Calculate DP earned, Standing changes (from trigger tables)
2. **Recovery**: Heal injuries, run Psychoanalyze campaigns (multi-phase therapy: one Psychoanalyze roll per downtime phase at listed Difficulty; patient cannot perform other downtime activities during treatment; 3 formats: guided sessions, exposure therapy, cognitive restructuring), Full Rest (−Empathy Corruption, exempt from session cap), attribute recovery (all attributes restore to max during Full Downtime; Infirmary facility heals 3 pts/attribute/Shift instead of 1)
3. **HQ Investment**: Spend DP on facility upgrades
4. **Personal Phase**: 3 questions about personal life. Skipping Personal Phase = +1 Corruption.
5. **Briefing**: Assignment quality varies by Standing tier (higher Standing = better intel, more prep shifts)

**Downtime phase duration**: each downtime phase represents approximately **1 week** of in-world time.

**Undertaking types per shift** (6 categories):
1. **Scene** — narrative roleplay moment (Anchor, Safe Scene, personal)
2. **Travel** — movement between locations
3. **Surveillance** — stakeouts, tailing, monitoring
4. **Research** — Lore/Investigate library/archive work
5. **Preparation** — crafting, requisitioning, fortifying
6. **Recovery** — rest, medical attention, Psychoanalyze sessions

#### Character Death & Continuity

- Gear returns to Stack Division
- Dark Secrets may surface (faction consequences)
- Replacement PC XP = lowest surviving member's XP
- **Legacy system**: one item, connection, or reputation inherited by new character

---

### Phase 14: Social Conflict

**`src/components/social-conflict.mjs`**

- **Disposition tracking** on NPC actors: numeric **1–5 scale** (1=Closed, 5=Open). At Disposition 3+, low-risk questions answered without a roll.
- **Opposed roll integration**: Manipulate or Command vs NPC's best social skill
- **NPC Social Defense**: NPCs can roll opposed Psychoanalyze for lie detection; combined test where agent must meet Difficulty AND beat NPC roll.
- **Command opposed roll procedure**: Command (EMP) vs NPC Manipulate (EMP). This is specific — Command uses the commander's EMP, and the NPC resists with their Manipulate skill + EMP.
- **Stunt spending** for social effects (skill-specific stunts from Chapter 4):
  - **Manipulate**: Bought Silence (1 SP: NPC won't reveal conversation), Read the Room (2 SP: learn NPC's goal/fear), Turned Asset (3 SP: NPC becomes temporary informant)
  - **Command**: Rally (1 SP: allies gain +1 die next action), Coordinated Action (2 SP: two allies act simultaneously), Hold the Line (3 SP: allies ignore Fear Check this round)
  - **Psychoanalyze**: Pressure Point (1 SP: +1 Disposition shift), Decompress (2 SP: target heals 1 Corruption), Full Read (3 SP: learn target's Dark Secret or deepest motivation)
- **Psychoanalyze modes**:
  - **Reading mode**: +1 bonus die and −1 Difficulty on follow-up roll vs same NPC. Reading bonus non-transferable to other agents. **Expiry**: Reading bonus invalidated if NPC takes significant action between scenes (DA discretion) or if NPC disposition drops to 1. **Stunt interactions**: Pressure Point stunt (+1 Disposition) and Full Read stunt (learn Dark Secret) can only be used during a Reading-mode Psychoanalyze roll.
  - **Stabilizing mode**: +2 Disposition shift on success (cap at 4), −1 on failure. Variable difficulty by distress source (supernatural=3, mundane=1, complex=2).
- **Psychoanalyze contaminated NPC**: automatic +1 Corruption when target is contaminated (even on success)
- **Disposition recovery from 1**: at Disposition 1, only non-roll actions permitted (reveal info, concessions, remove threat). No dice allowed until NPC returns to 2.
- **Disposition persistence**: rules for how NPC disposition carries over or resets across encounters:
  - Positive outcome (Disposition 3+): next scene starts at previous value or −1, whichever DA chooses
  - Negative outcome (Disposition 1–2): next scene starts at 1 or 2 based on severity
  - Closed (Disposition 1 from push failure or hostile): NPC will not engage further
- **Command-specific Disposition rules**: Command does NOT shift Disposition on success or failure. Command is blocked entirely at Disposition 1. At Disposition 2, Command is emergency-only (Diff 2). Command cannot extract information (use Manipulate or Psychoanalyze for that).
- **Failed social scene consequences** (5 types, DA selects):
  1. **Closed Source**: NPC refuses further interaction for remainder of case
  2. **Alert Raised**: relevant rival org advances 1 square on Operations Board
  3. **Physical Escalation**: NPC or associates become hostile
  4. **Faction Response**: NPC's faction takes countermeasure (surveillance, ambush, etc.)
  5. **Trust Erosion**: −1 Disposition with ALL NPCs in same organization
- **Pushing social rolls penalties**: each social skill has distinct push-failure consequences:
  - Manipulate pushed fail: Disposition −2
  - Command pushed fail: NPC emboldened (narrative advantage)
  - Psychoanalyze Reading pushed fail: misleading information provided
- **Multiple agents in social scenes**: focal point rules — one agent leads, helpers add +1 die each (max 2). Aggressive teamwork risks −1 Disposition.

---

### Phase 15: Mob Rules & Chase System

#### Mob Actor Type (`MobDataModel`)

- **Shared Strength pool**: 3 HP per member, max 15 (5 members)
- **Member count tracker** with +/− controls
- **Best dice pool** + bonus dice per extra member (max +3)
- **Single initiative card** for the whole mob
- **Damage handling**: splits across pool; members drop when increments of 3 are depleted
- **Auto-generate**: select multiple NPC actors → combine into Mob

#### Chase Track (`src/components/chase.mjs`)

An `ApplicationV2` window — visual 5-position track:

```
[Contact] → [Following] → [Closing] → [Widening] → [Escaped]
```

- **Participant slots**: pursuer(s) and quarry
- **Roll integration**:
  - On foot: AGI + Sneak/Endure
  - In vehicle: WIT + Tech
- **Speed differential modifier** display (vehicle speed comparison, ±1 die per tier difference)
- **Handling bonus** applied from vehicle stats
- **Maneuver buttons**:
  - Ram (Force vs Tech, mutual damage)
  - PIT (Tech Diff 3, target loses action)
  - Off-Road Break (Tech AGI Diff 2)
  - Gunfire from Vehicle (−1/−2 dice from moving vehicle)
  - Blend In (Sneak WIT Diff 2, instant escape on success)
- **Push chase roll cost**: +1 Corruption AND +1 vehicle Wear
- **Hiding attempt** at Widening position (auto-sets Sneak Difficulty 2)
- **Outcome resolution**: Escaped (quarry wins) or Caught (pursuer wins at Contact)
- Position moves 1 step toward winner each round
- **Vehicle breakdown** at reliability Wear: d6 table (Total Failure / Serious Fault / Inconvenient Failure). Occupants must Endure (AGI) Diff 1 or take 1 AGI damage.
- **Vehicle repair**: Tech Diff 2 + 30 min = clear 1 Wear. Overnight garage = full restore.

---

### Phase 16: Travel & Road Events

**`src/components/travel.mjs`**

#### Travel System

- **Shift-based travel** as a pacing mechanic integrated with Case File shifts
- **Route planning UI**: origin → destination, estimated shifts based on distance/transport
- **Route types** (4 categories affecting modifiers):
  1. **Fast** — highways, direct. Quickest but most exposed.
  2. **Quiet** — back roads, detours. Slower but harder to tail.
  3. **Institutional** — official Covenant channels, charter flights. Requires CL.
  4. **Illegal** — smuggler routes, black-market transport. Fastest but risky.
- **On foot travel exhaustion**: multi-shift foot travel requires Endure (AGI) Diff 2 per shift after the first. Failure = 1 AGI damage.
- **Professional tail modifier**: +1 Difficulty to detect a trained/professional tail (applied when tail is faction operative)
- **Travel resolution rolls by mode**:
  - Car/motorcycle: Investigate (WIT) Diff 1/2/3 (based on distance/difficulty)
  - Foot/urban: Sneak (AGI) Diff 1/2
  - Charter flight: Tech (WIT) Diff 2
- **Road Event Table** (d12): integrated as a Foundry RollTable, auto-rollable per shift
- **Road Event sub-mechanics**: several events have embedded mechanics:
  - Police Checkpoint (#3): 3 resolution options (reroute, Manipulate, Sneak)
  - Corruption Event (#6): automatic +1 Corruption to all characters
  - CB Radio Intercept (#7): Investigate WIT Diff 2 for intel
  - Mechanical Oddity (#10): Lore WIT Diff 2 assessment
- **Tail detection**: opposed Sneak vs Investigate at journey start
- **Losing a tail — 3 distinct options**:
  - Outrun: Tech WIT or Endure AGI, Diff 2
  - Blend In: Sneak AGI or Investigate WIT, Diff 2
  - Double Back/Trap: Investigate WIT, Diff 3 — identifies the tail
- **Named Threat tail**: losing a Named Threat requires a Contested Roll (team skill vs NPC Wits-based skill), not the standard 3-option procedure
- **Tail arrival consequences**: if tail persists to destination → DA places hostile element in arrival scene, relevant rival org advances on Operations Board immediately
- **Push vehicle roll cost**: pushing any vehicle-related roll adds +1 Wear in addition to +1 Corruption
- **Vehicle Wear thresholds**: dynamic — problem at floor(reliability/2), vehicle stops at reliability value. Tech WIT Diff 2 clears 1 Wear per scene.
- **Vehicle-specific Sneak modifiers**: each vehicle type has a Sneak modifier (e.g., motorcycle +1, delivery van −1, sedan 0) stored on VehicleDataModel `specialModifiers`.
- **Motorcycle bad weather penalty**: −2 dice on all motorcycle handling rolls in adverse weather (rain, ice, fog).
- **Fuel/supply consumption**: Resource Die roll for vehicle fuel per shift
- **1980s atmospheric rules**: road maps required (+1 Difficulty without), payphones with 10-minute trace window, rest stop social rolls (Manipulate EMP 2+ at Diff 1 for rumors)

#### Random Event Tables (RollTable documents in compendiums)

| Table | Die | Entries |
|---|---|---|
| Road Events | d12 | 12 encounter/complication types (with embedded sub-mechanics) |
| Compromise Events | d6 | 4 outcome bands (Surveillance/Break-In/Assault/Burned) |
| Improvised Item Failure | d6 | 6 breakdown modes |
| Vehicle Breakdown | d6 | 3 failure severities (Total/Serious/Inconvenient) |
| Panic Table | d6 | 6 fear responses with exit conditions |
| Containment Ritual Backlash | d6 | 6 backlash outcomes |
| d66 Anchor Table | d66 | 36 random anchors for character creation |
| Case File: Artifact Type | d66 | 36 artifact types |
| Case File: Inciting Incident | d6 | 6 incident types |
| Case File: Location | d6 | 6 location types |
| Case File: Complication | d6 | 6 complications |
| Case File: Named Threat | d6 | 6 threat types |
| Scavenging Finds | d6 | 6 find quality tiers by location |

---

### Phase 17: Compendium Packs (LevelDB from YAML)

**Build pipeline**: YAML source in `src/packs/` → compiled to LevelDB in `dist/packs/` via gulp task.

#### Packs

| Pack ID | Contents |
|---|---|
| `weapons` | All firearms, melee weapons, explosives from Chapter 7 |
| `armor` | All armor types with AR/Enc/penalties (including agility penalty on Tactical Riot Armor) |
| `gear` | Standard equipment, tools, kits, investigative tech (Maglite, Micro-Cassette Recorder, Polaroid SX-70, Air Ion Counter, Acoustic Coupler Modem, Spirit Box Prototype, Thermal/IR Camera — each with specific skill bonuses), standard tools (Basic First Aid Kit, Lockpick Kit, Crowbar/Bolt Cutters, Walkie-Talkies, Trauma Surgical Kit) |
| `consumables` | Supply categories with correct starting dice: Basic First Aid Kit (d10), Trauma Surgical Kit (d8), Battery Pack (d8), Specialized Battery (d6), Field Rations (d8), Artifact Components (d6), Junk/Scrap (d6), Hardware Components (d8), Medical Supplies (d10), Specialized Parts (d6), Covenant Cache Parts (d12) |
| `talents-general` | 16 named General Talents: Street Medic, Cathartic Release, Hair-Trigger, Paranormal Intuition, Heavy Packer, Skeptic's Shield, Night Owl, Chain Smoker, Analog Junkie, Grit Your Teeth, Desensitized, Lucky Coin, Iron Will, Brawler, Flee the Scene, Requisition Authority — each with specific once-per-session or passive effects, healing tags where applicable |
| `talents-division` | Wayfinder, Recovery, Keep division talents (including Combat Reflexes, Conditioned Mind, Adrenaline Junkie with full mechanics) |
| `talents-subunit` | Wing/Paradigm/Department talents |
| `talents-background` | All ~60+ background talents (each grants +1 permanent bonus die to a specific skill) |
| `critical-injuries-physical` | Full d66 table (36 entries) with insight tags on applicable entries |
| `critical-injuries-mental` | Full d66 table (36 entries) with insight tags on applicable entries |
| `artifacts` | 9 artifacts: Betamax of St. Jude, Obsidian Walkman, Oppenheimer Lens, Judas Coin, Chronos Polaroid, Broadcast Reel, Custody Manifest, Quarantine Bell, Stethoscope of Dr. Morrow — each with full stats, effects, fracture conditions, emissions, containment profiles, emission trigger/corruption/radius overrides |
| `npcs` | Sample NPCs from Bestiary (all tiers 1–4) with corruption stage data, damage resistance/immunity flags, social skill immunity flags (`{intimidate: true}` etc.), anchor links, reconstitution timers, NPC passive recurring effects (auto-triggers per round/scene via Active Effect hooks), **simplified humanoid stat block view toggle** for standard humanoid NPCs |
| `supernatural-entities` | Bestiary entities with Fear Ratings (base + escalated), conditional FR, shared initiative flags, entity-specific data fields (artifact tether range, corruption cost on contact, dissolution method), incorporeal/zoneLocked flags, **DA Monster Creation reference tables** (attribute ranges by tier, suggested FR, ability templates) |
| `faction-operatives` | 5 named faction operative stat blocks from Ch 17: MJ-12 Strike Agent, Accord Zealot, Consortium Principal, Pale Archive Watcher, Wormwood Network Cell Leader — each with faction-specific abilities (MJ-12: +1 Fear Check die; Consortium Principal: milestone acceleration) |
| `hq-upgrades` | 10 facilities across 3 tiers with Standing requirements |
| `hq-personnel` | 5 personnel types |
| `vehicles` | 10 vehicles (Crown Victoria, Caprice Classic, Dodge Van, F-150, Ducati 900, Camaro Z28, Huey helicopter, Cessna 172, Zodiac boat, Bicycle) with Speed/AR/Reliability/Handling/Capacity/Noise/special notes + per-vehicle Sneak modifiers |
| `rolltables` | Panic (d6 with exit conditions), Road Events (d12), Compromise Events (d6 with 4 outcome bands), Vehicle Breakdown (d6), Improvised Item Failure (d6), d66 Anchor Table (36 entries), Case File Generator tables (d66 + 4×d6), Containment Ritual Backlash (d6), Stunt tables (13 skill-specific + 6 generic), **1980s Investigation Complication Table (d12)** — 12 era-specific complications (microfiche jam, payphone queue, CB interference, etc.) |
| `sample-case` | *The Spear That Went Dark* complete worked example from Ch 20: full Case File with Operations Board state, NPCs, Locations, Information Cards, Relic Milestones, pre-built Equipping Phase load-outs |
| `macros` | Quick-roll macros for common actions |

---

### Phase 18: Art, Tokens & Theming

#### Visual Identity — 1980s Analog Aesthetic

- **CRT scanlines**, VHS tracking lines, amber/green phosphor tones
- **Character sheet**: worn manila folder background, typewriter font headers, redacted stamp effects
- **UI chrome**: brushed metal, toggle switches, analog dials for tracks
- **Light mode**: faded paper tones, coffee-stained edges
- **Dark mode**: CRT terminal green-on-black, scanline overlay

#### Asset List

| Asset | Description |
|---|---|
| Token frames | Covenant badge border (per-division color) |
| Initiative cards | 10 cards (Ace–10), occult-themed card backs |
| Status effect icons | Custom set for all conditions + corruption stages |
| Division emblems | Wayfinder (eye), Recovery (hand), The Keep (lock) |
| Corruption indicators | Escalating glow/distortion overlay per stage |
| Artifact icons | Per-tier visual (Uncanny/Threatening/Catastrophic) |
| HQ facility icons | 10 icons matching upgrade tree |
| Item category icons | Weapon types, armor, gear, consumable categories |
| Loading/pause screens | System branding with Verdant Covenant sigil |
| Fonts | Period-appropriate typewriter + monospace (Courier-like, IBM Plex Mono) |

---

### Phase 19: Polish & Integration

#### Module Integrations

| Module | Integration |
|---|---|
| **Dice So Nice** | Custom die themes: white/green/black d6, amber resource dice, red artifact die |
| **YZE Combat** | Card initiative handoff, compatible combat tracker |
| **Item Piles** | Loot container configuration |

#### System Features

- **Chat messages**: styled roll results, corruption gain/loss banners, gear degradation alerts, fear check results with panic outcome + exit conditions, stunt picker results
- **Token configuration**: primary bar = Strength, secondary bar = Corruption
- **Drag-and-drop**: items to actor sheets, talents, actors to HQ member list
- **Keyboard shortcuts**: quick-roll attribute, push last roll
- **Tour/welcome**: first-launch system tour explaining key features
- **Macro compendium**: pre-built macros for common actions (roll attribute, resource die, fear check, D66, group roll, etc.)
- **Socket events**: multi-user HQ updates, shared Operations Board state, corruption notifications, org cross-link advancement
- **Settings**: optional rules toggles (grid distance conversion, variant fear check rules, corruption variant, artifact decay track, rival cells)
- **Session tracking**: once-per-session ability uses (Anchor healing, Conditioned Mind, Bracer absorption, various talents), session healing cap (5), healing tag cap (3) — with session reset mechanism
- **Performance**: lazy-load sheet tabs, minimize re-renders via PARTS, efficient `prepareDerivedData()`
- **Accessibility**: ARIA labels on interactive elements, full keyboard navigation, screen reader support for roll results

---

## Project File Structure

```
foundry-neon-relic-system/
├── DEVELOPMENT-PLAN.md              # This plan
├── package.json
├── gulpfile.js
├── esbuild.config.js
├── .eslintrc.json
├── .prettierrc
├── .gitignore
├── src/
│   ├── neon-relic.mjs               # Entry point
│   ├── neon-relic.scss              # Main SCSS entry
│   ├── data/
│   │   ├── actor-models.mjs         # All actor TypeDataModel classes
│   │   └── item-models.mjs          # All item TypeDataModel classes
│   ├── actor/
│   │   ├── actor-document.mjs       # NeonRelicActor extends Actor
│   │   ├── actor-sheet.mjs          # Base sheet (ApplicationV2)
│   │   ├── agent/                   # Agent sheet + templates
│   │   ├── npc/                     # NPC sheet + templates
│   │   ├── mob/                     # Mob sheet + templates
│   │   ├── headquarters/            # HQ sheet + templates
│   │   └── vehicle/                 # Vehicle sheet + templates
│   ├── item/
│   │   ├── item-document.mjs        # NeonRelicItem extends Item
│   │   ├── item-sheet.mjs           # Base item sheet (ApplicationV2)
│   │   └── templates/               # Per-type .hbs templates
│   ├── combat/
│   │   ├── combat.mjs               # Card initiative combat override
│   │   └── combatant.mjs            # Extended Combatant (action economy)
│   ├── components/
│   │   ├── corruption.mjs           # Corruption tracker + stage effects
│   │   ├── resource-die.mjs         # Resource die mechanic (consumables, ammo)
│   │   ├── artifact.mjs             # Artifact activation + artifact die
│   │   ├── containment-ritual.mjs   # Containment ritual workflow + backlash
│   │   ├── fear-check.mjs           # Fear check + panic table
│   │   ├── social-conflict.mjs      # Disposition tracking, opposed social rolls
│   │   ├── chase.mjs                # Chase track ApplicationV2 window
│   │   ├── travel.mjs               # Travel system + road events
│   │   ├── operations-board.mjs     # Operations Board ApplicationV2 window
│   │   ├── case-file.mjs            # Case File management
│   │   ├── debrief.mjs              # Debrief checklist + aftermath workflow
│   │   ├── downtime.mjs             # Between-case 5-phase downtime
│   │   └── roll/
│   │       ├── roll-handler.mjs     # Pool builder, success counting, push, D66, group roll
│   │       ├── roll-dialog.mjs      # Roll configuration dialog (ApplicationV2)
│   │       └── stunt-picker.mjs     # Post-roll stunt selection UI
│   ├── system/
│   │   ├── config.mjs               # System constants & config
│   │   ├── sheets.mjs               # Sheet registration
│   │   ├── handlebars.mjs           # HBS helpers
│   │   ├── settings.mjs             # Game settings
│   │   ├── enricher.mjs             # Text enrichers
│   │   ├── socket.mjs               # Socket event handlers
│   │   └── migration.mjs            # Data migration
│   ├── lib/
│   │   └── yzur.js                  # Bundled yzur library (local)
│   ├── plugins/
│   │   └── dice-so-nice.mjs         # DSN integration
│   ├── styles/                      # SCSS partials
│   ├── packs/                       # YAML source for compendium packs
│   │   ├── weapons.yaml
│   │   ├── armor.yaml
│   │   ├── gear.yaml
│   │   ├── consumables.yaml
│   │   ├── talents-general.yaml
│   │   ├── talents-division.yaml
│   │   ├── talents-subunit.yaml
│   │   ├── talents-background.yaml
│   │   ├── critical-injuries-physical.yaml
│   │   ├── critical-injuries-mental.yaml
│   │   ├── artifacts.yaml
│   │   ├── npcs.yaml
│   │   ├── supernatural-entities.yaml
│   │   ├── hq-upgrades.yaml
│   │   ├── hq-personnel.yaml
│   │   ├── vehicles.yaml
│   │   ├── faction-operatives.yaml
│   │   ├── sample-case.yaml
│   │   ├── rolltables.yaml
│   │   └── macros.yaml
│   └── lang/
│       └── en.yaml                  # English i18n strings
├── static/
│   ├── system.json                  # System manifest (v14 format)
│   ├── assets/
│   │   ├── cards/                   # Initiative card images (Ace–10 + back)
│   │   ├── icons/                   # Status effects, item categories, divisions
│   │   ├── tokens/                  # Token frames
│   │   ├── ui/                      # Sheet backgrounds, borders, textures
│   │   └── branding/               # Logo, loading screen, pause image
│   └── fonts/                       # Typewriter + monospace fonts
└── dist/                            # Build output (gitignored)
    ├── neon-relic.mjs               # Bundled entry point
    ├── neon-relic.css               # Compiled styles
    ├── system.json                  # Copied manifest
    ├── templates/                   # Copied .hbs files
    ├── packs/                       # Compiled LevelDB packs
    ├── assets/                      # Copied static assets
    ├── fonts/                       # Copied fonts
    └── lang/
        └── en.json                  # Compiled i18n
```

---

## System Manifest (`system.json`)

```json
{
  "id": "neon-relic",
  "title": "Neon Relic",
  "description": "An occult investigation TTRPG set in an alternate 1980s, built on the Year Zero Engine.",
  "version": "0.1.0",
  "compatibility": {
    "minimum": 14,
    "verified": 14
  },
  "esmodules": ["neon-relic.mjs"],
  "styles": ["neon-relic.css"],
  "languages": [
    { "lang": "en", "name": "English", "path": "lang/en.json" }
  ],
  "documentTypes": {
    "Actor": {
      "agent": {},
      "npc": {},
      "mob": {},
      "vehicle": {},
      "headquarters": {}
    },
    "Item": {
      "weapon": {},
      "armor": {},
      "gear": {},
      "consumable": {},
      "artifact": {},
      "talent": {},
      "criticalInjury": {},
      "anchor": {},
      "darkSecret": {},
      "upgrade": {},
      "location": {}
    }
  },
  "packs": [],
  "packFolders": [],
  "primaryTokenAttribute": "attributes.str",
  "secondaryTokenAttribute": "corruption",
  "socket": true,
  "authors": [
    { "name": "Bruce", "flags": {} }
  ],
  "url": "https://github.com/bruceamoser/foundry-neon-relic-system",
  "flags": {}
}
```

---

## Verification Checklist

| # | Test | Pass Criteria |
|---|---|---|
| 1 | Build | `npm run build` produces clean `dist/` with no errors |
| 2 | Load | Foundry VTT v14 loads system without console errors |
| 3 | Agent actor | All fields present (incl. specialty, division item, threshold modifiers), click-to-roll works |
| 4 | NPC actor | Compact stat block renders, disposition 1–5 scale, corruption stage 0–3, damage resistance flags, FR base+escalated |
| 5 | Mob actor | Shared pool, bonus dice calculation, member tracking |
| 6 | Vehicle actor | All stats display (Speed/AR/Reliability/Handling/Capacity/Noise), wear track 0–reliability with dynamic thresholds: problem at floor(reliability/2), stops at reliability |
| 7 | HQ actor | Upgrades with Standing gates, standing triggers, threat meter, vault re-consecration counter, personnel activation roll |
| 8 | All item types | Proper sheets display for all 11 types (incl. Location) |
| 9 | Dice roll | Attribute + skill + gear → counts 6s, shows successes |
| 10 | D66 roll | Two d6 → tens+units result, maps to critical injury table |
| 11 | Group roll | All members roll, threshold comparison, team pass/fail |
| 12 | Stunt picker | Post-roll UI shows skill-specific + generic stunts with SP costs |
| 13 | Gear degradation | Weapons/tools degrade on **rolling 1s on gear dice** in initial roll (auto-degrade). Armor degrades on pushes and targeted stunts (NOT on 1s). Chat notification on both. |
| 14 | Push roll | +1 Corruption applied, gear dice locked, non-6s rerolled, Conditioned Mind intercept works |
| 15 | Corruption threshold | Computed as 10+EMP+modifiers; breach → warning; retroactive EMP drop → Fear Check |
| 16 | Session caps | Session healing cap 5, healing tag cap 3, once-per-session uses tracked + reset |
| 17 | Resource die | Step-down on 1–2, depleted state reached |
| 18 | Artifact die | d20 chain, step-down on **1 only**, fracture event past d4 with per-artifact condition |
| 19 | Card initiative | Cards drawn, sorted correctly, reshuffle each round, shared cards work, Combat Reflexes (draw 2 keep 1) |
| 20 | Action economy | Slow/fast/reactive action tracking, surprise round, retreat/disengage |
| 21 | Fear check | Wits-only, 1s = corruption, failure → panic table with exit conditions; FR escalation triggers new check |
| 22 | Conditions | Active Effects apply/remove correctly, panic exit conditions enforced |
| 23 | Operations Board | 14-square org countdowns, cross-links fire, dormant orgs activate, relic milestones trigger |
| 24 | Case File | 14-day/56-shift grid, linked entities (Location/NPC/Info Card data models), equipping phase, packet tracking |
| 25 | Scene Resolution | Key Activity + 4 contribution types → 5 result bands |
| 26 | Containment Ritual | 3 ritual types, difficulty modifiers, support actions, backlash table |
| 27 | Social conflict | Disposition 1–5, psychoanalyze modes (Reading/Stabilizing), push penalties per skill, multi-agent focal point |
| 28 | Chase track | 5-position visual, roll integration, maneuver buttons, push cost (+1 Corruption +1 Wear), escape/catch |
| 29 | Travel | 3 tail-loss options, named threat contested roll, road event sub-mechanics, vehicle wear |
| 30 | Mob rules | Shared pool damage, auto-bonus dice, member dropout |
| 31 | Debrief | 5-question checklist (participate / risk life / Dark Secret or Anchor / secure artifact / learn something new) → XP tally, DP spending transition |
| 32 | Downtime | 5-phase between-cases workflow, Personal Phase corruption penalty |
| 33 | Compendium packs | All packs load correctly (LevelDB format), 9 artifacts, 16 general talents, 60+ backgrounds, investigative tech, 10 vehicles, 5 faction operatives, sample case |
| 34 | Dice So Nice | Custom die themes render for all die types |
| 35 | Theming | Light and dark modes both readable |
| 36 | Multi-user | Socket events update HQ, Operations Board, and org cross-links for all clients |
| 37 | Zone features | Cramped/Rough/Dark/Open/Elevated features apply correct modifiers to rolls and movement |
| 38 | Melee maneuvers | Grapple/Shove/Disarm/Feint resolve with correct opposed rolls |
| 39 | Cover tiers | Soft Cover (+2 AR) and Hard Cover (+4 AR) apply correctly; cover loss on firing tracked |
| 40 | Damage routing | Physical→STR, Exhaustion→AGI, Horror→WIT, Trauma→EMP routing works for all damage sources |
| 41 | Death states | Broken/Dying/Dead progression correct: Dying = Broken + † CI, death at scene end not round |
| 42 | Attribute recovery | Short Rest +1/attr/Shift, Infirmary +3/attr/Shift, Full Downtime all, Medical Aid +1/success beyond Diff |
| 43 | NPC simplified view | Simplified humanoid stat block toggle renders for standard humanoid NPCs |
| 44 | Case documents | Case Brief (player-shareable), Relic Sheet (case-scoped with Containment Truth checklist), Organization Reference (DA view) |

---

## Dependencies (package.json)

### Dev Dependencies

| Package | Purpose |
|---|---|
| `esbuild` | JavaScript bundling |
| `esbuild-sass-plugin` | SCSS compilation within esbuild |
| `gulp` | Build orchestration |
| `gulp-yaml` | YAML → JSON compilation (i18n) |
| `fs-extra` | File operations in gulp tasks |
| `cross-env` | NODE_ENV toggling |
| `eslint` | Linting |
| `prettier` | Code formatting |
| `husky` | Git hooks |

### Bundled (not npm)

| Library | Purpose |
|---|---|
| `yzur` | Year Zero Universal Roller — dice pool mechanics |

---

## Notes

- **No `template.json`** — all data schemas defined via TypeDataModel classes
- **No ApplicationV1** — all UI uses ApplicationV2 exclusively
- **Card initiative** uses Foundry's built-in Card support where possible, falls back to virtual deck
- **Corruption** is the game's unique selling point — every integration point must preserve risk-reward tension
- **Gear Dice are never rerolled** during pushes — this is a core rule distinction from other YZE games
- **Armor degrades on pushes and combat stunts** — NOT on rolling 1s on armor dice. **Weapons and tools degrade on gear die 1s** in the initial roll — two distinct systems.
- **Artifact Die steps on 1 only** (d20 chain) — distinct from Resource Die which steps on 1–2 (d12 chain)
- **Disposition is numeric 1–5** — not named labels (Friendly/Neutral/Hostile)
- **Operations Board uses 14-square countdowns** per organization — not 0–5 escalation levels
- **Case File uses 14-day / 56-shift fixed grid** — not a simple shift counter
- **Division Items have specific mechanics**: Verdant Codex (+1 Lore/Investigate per scene, info preservation), Verdant Satchel (aura suppression, instability warning, 1-round stabilization delay), Warden's Bracer (+1 AR physical, absorbs first 1 Corruption/session)
- **Encumbrance has 3 tiers**: normal (≤STR×2), Encumbered (>STR×2, −1 STR+AGI, move=Slow Action), Overloaded (>STR×3, cannot move zones)
- **Zone names**: Engaged / Near / Short / Long / Distant (NOT Close/Far/Very Far)
- **Vehicle wear thresholds are dynamic**: problem at floor(reliability/2), stops at reliability (NOT hardcoded 3/5)
- **Catatonia triggers on strictly greater than threshold** (not equal)
- **Black-Market Armory has NO Standing gate** — only 7 facilities are Standing-gated
- **Three death states**: Broken (attr=0) → Dying (Broken + † CI) → Dead (end of scene if not stabilized)

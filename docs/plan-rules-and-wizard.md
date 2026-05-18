# Plan: Rules Compendium + Character Creation Wizard

---

## Task 1: Rules Compendium — Full Chapter Content

### TL;DR

Replace the abbreviated summaries in `rules-reference.yaml` with the actual rulebook content from the `.adoc` chapter files, converted to HTML via `asciidoctor.js`.

### Current State

- `src/packs/rules-reference.yaml` has 14 journal pages with short HTML summaries
- Authoritative content lives in 23 AsciiDoc files under `C:\Repos\neon-relic\docs\chapters\`
- gulpfile builds YAML → LevelDB packs

### Steps

1. Add `@asciidoctor/core` as a devDependency
2. Create `tools/build-rules-reference.mjs` — a script that:
   - Reads each `.adoc` from `C:\Repos\neon-relic\docs\chapters\`
   - Converts to HTML body fragments (no document wrapper)
   - Strips unresolvable `include::` directives and cross-references
   - Writes the complete `src/packs/rules-reference.yaml` with full content per page
3. Optionally add a `gulp rules` task or `npm run build:rules` script to invoke it before pack build
4. Build packs (`npx gulp build`) and verify pages load in Foundry

### Relevant Files

| File                                                                                   | Role                            |
| -------------------------------------------------------------------------------------- | ------------------------------- |
| `C:\Repos\neon-relic\docs\chapters\01-introduction.adoc` through `22-yze-license.adoc` | Source content                  |
| `src/packs/rules-reference.yaml`                                                       | Target (overwritten by script)  |
| `tools/build-rules-reference.mjs`                                                      | New conversion script           |
| `gulpfile.js`                                                                          | May wire in as a pre-build step |

### Verification

1. Open Rules Reference journal in Foundry → each page shows full chapter content with proper headings, tables, bold/italic
2. No broken HTML or YAML escaping issues
3. Script is idempotent — running it twice produces identical output

### Decisions Needed

- **Chapter scope** — Include all 23 chapters in the compendium, or just the 14 player-facing ones (excluding front matter, DA guidance, sample case file, YZE license)?
- **Build integration** — Should the conversion script be a gulp task (run automatically on build) or a standalone tool?

---

## Task 2: Character Creation Wizard

### TL;DR

A "Create Character" button at the top of the agent sheet that opens a multi-step wizard (`ApplicationV2` dialog) walking through the creation steps, auto-adding gear at each appropriate point and enforcing talent slot rules.

### Wizard Flow

| Step                    | Input                                                                                          | Data Applied                                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1. Identity             | Name, Age Group, Age (numeric), Sex, Country of Origin, Biography (optional)                   | `name`, `system.ageGroup`, `system.age`, `system.sex`, `system.countryOfOrigin`, `system.description` |
| 2. Division             | Pick Wayfinder / Recovery / Keep (with descriptions, CL preview)                               | `system.division`                                                                                     |
| 3. Sub-Unit             | Dynamic list filtered by division                                                              | `system.subUnit`                                                                                      |
| 4. Specialty            | Dynamic list filtered by sub-unit                                                              | `system.specialty`                                                                                    |
| 5. Gear                 | Auto-add division item + starting kit (Stack variant for Stack agents)                         | Gear items held in wizard state                                                                       |
| 6. Attributes           | 4 sliders/inputs with budget display (from age group)                                          | `system.str.max` … `system.emp.max`                                                                   |
| 7. Skills               | 13 skill inputs with budget + key skill highlighted                                            | `system.skills.*`                                                                                     |
| 8. Talents              | 3 filtered drop zones (Division/General, Sub-unit, Background); Stack shows 6 sub-unit talents | Talent items held in wizard state                                                                     |
| 9. Anchor & Dark Secret | Roll d66 or custom anchor; drag Dark Secret from filtered compendium or write custom           | Anchor + Dark Secret items held in wizard state                                                       |
| 10. Summary             | Review all choices → Confirm                                                                   | Batch-applies all data + creates all items, sets `system.creationComplete = true`                     |

### Implementation Phases

#### Phase A — Data Model & Config (parallel with Phase B)

1. Add `sex` (StringField), `age` (NumberField), and `creationComplete` (BooleanField) to `AgentDataModel`
2. Add sex enum and country-of-origin list to `config.mjs`
3. Add talent slot type tracking or enforce via drop handler

#### Phase B — Wizard UI

4. Create `src/actor/agent/creation-wizard.mjs` — ApplicationV2 with step navigation
5. Create `src/templates/actor/agent/wizard/` — one `.hbs` per step (~6–8 templates)
6. Add "Create Character" button in `agent-header.hbs` (visible only when `!system.creationComplete`)
7. Implement Next/Back/Cancel with per-step validation

#### Phase C — Gear & Talent Logic (depends on A)

8. Gear auto-add: resolve `startingGear` references from subdivision pack items → create on actor
9. Talent filtering: on drop during wizard step 8, enforce:
   - Slot 1: Division OR General talent (not both)
   - Slot 2: Sub-unit talent matching chosen sub-unit
   - Slot 3: Background talent only
10. Show slot status and remaining count

#### Phase D — Polish (depends on B, C)

11. Wizard styling (`.scss`)
12. Localization strings
13. Hide wizard button after completion; add "Reset Creation" escape hatch

### Relevant Files

| File                                                    | Role                                                  |
| ------------------------------------------------------- | ----------------------------------------------------- |
| `src/actor/agent/creation-wizard.mjs`                   | NEW — wizard ApplicationV2 class                      |
| `src/templates/actor/agent/wizard/*.hbs`                | NEW — step templates                                  |
| `src/data/actor-models.mjs`                             | Add `sex`, `creationComplete` fields                  |
| `src/system/config.mjs`                                 | Add enums (sex, countries)                            |
| `src/actor/agent/agent-sheet.mjs`                       | Wizard launch + talent enforcement in `_onDropItem()` |
| `src/templates/actor/agent/agent-header.hbs`            | Creation button                                       |
| `src/neon-relic.scss` or `src/actor/agent/_wizard.scss` | Wizard styling                                        |

### Code to Reuse

- **`#applySubdivision()`** in agent-sheet.mjs — specialty dialog pattern and data update logic
- **`SubdivisionDataModel.startingGear`** — gear reference resolution
- **`_onDropItem()` talent path** — existing XP cost logic (extend with slot enforcement)

### Talent Enforcement Rules

| Slot | Allowed Types       | Notes                                          |
| ---- | ------------------- | ---------------------------------------------- |
| 1    | Division OR General | Cannot take both — pick one category           |
| 2    | Sub-unit talent     | Must match the chosen Wing/Paradigm/Department |
| 3    | Background          | Always passive, no Corruption cost             |

After creation, additional talents cost 6 XP each (existing logic already handles this).

### Verification

1. New agent → "Create Character" button visible in header
2. Complete all steps → actor has correct division, sub-unit, specialty, attributes within budget, skills within budget
3. Division gear + starting kit items appear in Gear tab
4. Talent drag rejects wrong types with clear error messages; accepts valid choices
5. After completion → button hidden, sheet works normally
6. Existing characters (already created) don't show the wizard button

### Decisions Needed

- **Wizard timing** — Apply data at each step (immediate saves) or collect everything and apply in a batch at confirmation? Immediate saves match `submitOnChange` pattern but makes "Cancel" harder. Batch is cleaner but means the actor is blank until step 10.
- **Country of origin** — Free-text input or a curated list of 1980s-relevant countries?

---

## Task 3: Supporting Data Packs

Two compendium packs required by the wizard don't exist yet.

### 3a. Dark Secrets Compendium Pack

The `darkSecret` item type exists (data model, template, drag-drop support) but no pre-made items are in any pack. Chapter 13 defines 20 Dark Secrets:

| Group             | Count | Source                                                      |
| ----------------- | ----- | ----------------------------------------------------------- |
| Wayfinder         | 5     | Ch. 13 — Advancement                                        |
| Recovery          | 5     | Ch. 13 — Advancement                                        |
| The Keep          | 5     | Ch. 13 — Advancement                                        |
| Stack (Logistics) | 5     | Ch. 13 — Advancement (replaces Keep table for Stack agents) |

Create `src/packs/dark-secrets.yaml` with all 20, tagged by division (and `subUnit: stack` for Stack-specific entries). Register in `system.json`.

### 3b. Anchor d66 Roll Table

The roll-tables pack has 7 tables but **no Anchor Table**. The rulebook Step 9 says "Roll d66 on the Anchor Table in the Healing chapter." Add the d66 table from Chapter 8 to `src/packs/roll-tables.yaml`.

---

## Gap Analysis (completed 2026-05-18)

Cross-referenced all 23 AsciiDoc chapter files against the plan and GitHub issues. Findings:

### Gaps Found and Resolved

| #   | Gap                                               | Resolution                                                                     |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1   | Biography missing from wizard                     | Added to #236 (Step 1: Identity) — optional textarea for `system.description`  |
| 2   | Numeric `age` field not in data model or wizard   | Added `age` NumberField to #232; added age input to #236 with range validation |
| 3   | No Dark Secret items in any compendium pack       | Created #250 — populate `dark-secrets.yaml` with 20 items from Ch. 13          |
| 4   | No Anchor d66 roll table                          | Created #251 — add Anchor Table from Ch. 8 to `roll-tables.yaml`               |
| 5   | Stack gear variant not called out                 | Updated #238 — explicit acceptance criterion for Stack variant kit             |
| 6   | Stack has 6 sub-unit talents (not 3)              | Updated #244 — talent count table and Stack exception noted                    |
| 7   | Summary step missing anchor/dark secret/biography | Updated #243 — now includes all fields and embedded item creation              |

### Verified Coverage (No Gaps)

| Rule                                             | Issue              |
| ------------------------------------------------ | ------------------ |
| Attribute range 2–5, budget by age               | #240               |
| Skill range 0–3, key skill max 4                 | #241               |
| Key skill per division (Lore/Firearms/Command)   | #241               |
| CL = Division base + Age modifier (min 1, max 5) | #237, #243         |
| Corruption starts at 0                           | Data model default |
| Max Corruption = 10 + Empathy                    | #240 preview       |
| Division Item automatic                          | #238               |
| 3 talent slots with type enforcement             | #242, #244         |
| State reset on upstream changes                  | #245               |
| Pre-existing character migration                 | #247               |
| All 20 chapters in compendium                    | #231               |

### Not In Scope (Play-Time Rules)

These rules are correct in the chapter files but not relevant to character creation:

- Recovery CL 2 armor exception (Standing ≥ 2 personal protection request)
- Stack +1 requisition die for crafting materials
- Healing talent cap (max 3 Corruption/session from General Healing talents)
- Requisition Authority talent (repeatable, max CL 5)
- XP debrief system (5 questions, max 5 XP/session)

---

## GitHub Issues — Complete List (22 total)

### Rules Compendium (2 issues)

| #    | Title                                                              |
| ---- | ------------------------------------------------------------------ |
| #231 | Create asciidoctor.js conversion script for rules compendium       |
| #230 | Add npm script and gulp task integration for rules-reference build |

### Character Creation Wizard (18 issues)

| #    | Title                                                                   | Phase |
| ---- | ----------------------------------------------------------------------- | ----- |
| #232 | Add `sex`, `age`, and `creationComplete` fields to Agent data model     | A     |
| #233 | Add "Create Character" button to agent sheet header                     | B     |
| #234 | Create CharacterCreationWizard ApplicationV2 shell with step navigation | B     |
| #236 | Wizard Step 1: Identity (Name, Age, Sex, Country, Biography)            | B     |
| #237 | Wizard Step 2: Division selection                                       | B     |
| #235 | Wizard Step 3: Sub-Unit selection (filtered by division)                | B     |
| #239 | Wizard Step 4: Specialty selection (from sub-unit)                      | B     |
| #238 | Wizard Step 5: Auto-add division item and starting gear                 | C     |
| #240 | Wizard Step 6: Distribute attribute points within budget                | B     |
| #241 | Wizard Step 7: Distribute skill points with key skill exception         | B     |
| #242 | Wizard Step 8: Talent selection with 3-slot enforcement                 | C     |
| #249 | Wizard Step 9: Anchor and Dark Secret selection                         | B     |
| #243 | Wizard Step 10: Summary review and apply all data to actor              | B     |
| #244 | Add talent type taxonomy fields for wizard slot enforcement             | A     |
| #245 | Wizard state management: reset downstream steps on upstream changes     | B     |
| #246 | Style the character creation wizard (SCSS)                              | D     |
| #247 | Add "Reset Character Creation" and handle pre-existing characters       | D     |
| #248 | Add all wizard localization strings to en.json                          | D     |

### Supporting Data Packs (2 issues)

| #    | Title                                                 |
| ---- | ----------------------------------------------------- |
| #250 | Populate Dark Secrets compendium pack from Chapter 13 |
| #251 | Add Anchor d66 roll table to roll-tables pack         |

### Dependency Order

```
#232 (data model) ──┐
                    ├─→ #236 (Identity) ──→ #237 (Division) ──→ #235 (Sub-Unit) ──→ #239 (Specialty)
#234 (wizard shell) ┘                                               │
                                                                    ├─→ #238 (Gear)
#244 (talent taxonomy) ──→ #242 (Talents)                           │
                                                                    ├─→ #240 (Attributes) ──→ #241 (Skills)
#250 (Dark Secrets pack) ──→ #249 (Anchor & Dark Secret)            │
#251 (Anchor roll table) ──┘                                        │
                                                                    └─→ #243 (Summary) ──→ #245 (State mgmt)
                                                                                        ──→ #246 (SCSS)
                                                                                        ──→ #247 (Reset)
                                                                                        ──→ #248 (i18n)
```

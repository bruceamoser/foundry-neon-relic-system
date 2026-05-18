# Plan: Character Creation, Import Fix, XP & Sheet Bugs

## TL;DR

Fix world-setup import, duplicate name bug, and missing character creation support. Key architecture: subdivisions are draggable Items (auto-set division, prompt starting gear). Point-buy tracks attribute/skill budgets from age group. XP auto-deducts on skill/talent advancement. CL auto-computed. No wizard, no dropdowns for subdivisions.

---

## Phase 1: Fix World Setup Import

1. Add logging to `checkWorldSetup()` — log `worldInitialized` value
2. Add auto-recovery — if `worldInitialized=true` but 0 journals in world, reset and show dialog
3. Add duplicate guard — skip documents whose IDs already exist in world
4. Build, deploy, verify in fresh world

**Files:** `src/system/world-setup.mjs`

---

## Phase 2: Fix Duplicate Name

5. Remove `<input name='name'>` from `agent-summary.hbs` (keep header's version only)

**Files:** `src/templates/actor/agent/agent-summary.hbs`

---

## Phase 3: New Item Type — Subdivision

6. Create `SubdivisionDataModel` in `item-models.mjs`:
   - `division` (string: wayfinder/recovery/keep)
   - `keySkill` (string: lore/firearms/command)
   - `baseCL` (number: 2 or 3)
   - `specialties` (array of `{key, label}` objects)
   - `startingGearPack` (array of item references/descriptions)
   - `divisionItemName` (string: Verdant Codex / Verdant Satchel / Warden's Bracer)
7. Register `subdivision` in `system.json` item types and `config.mjs`
8. Create subdivision item template (simple display sheet)
9. Create `subdivisions.yaml` pack with all 9 subdivisions:
   - Wayfinder: Research Wing, Counterintelligence Wing
   - Recovery: Ex-Agency Operative, Heavy-Hitter, Acquisition Specialist
   - Keep: Catalogers, Wardens, Internal CI, Stack
10. Register subdivisions pack in `system.json`
11. Add localization keys for all subdivisions + specialties

**Files:** `src/data/item-models.mjs`, `static/system.json`, `src/system/config.mjs`, `src/packs/subdivisions.yaml` (new), `src/lang/en.yaml`, `src/templates/item/item-subdivision.hbs` (new), `src/item/item-sheet.mjs`

---

## Phase 4: Subdivision Drop Handler + Starting Gear

12. In `actor-document.mjs` `_onDropItem()`: detect subdivision item drop:
    - Auto-set `system.division` from subdivision's `division` field
    - Auto-set `system.subUnit` from subdivision name
    - Auto-set `clearanceLevel` from subdivision's `baseCL` + age modifier
    - Remove any previously-dropped subdivision item (only 1 allowed)
    - Prompt: "Add starting gear package for [Subdivision]?" → if yes, create starting gear items on actor
13. Add specialty selection: after subdivision drop, show dialog with specialty choices from the item's `specialties` array → set `system.specialty`

**Files:** `src/actor/actor-document.mjs`

---

## Phase 5: Extend Data Model — Age, XP, Point Budget

14. Add fields to `AgentDataModel`:
    - `ageGroup`: StringField (young/experienced/senior, initial: `experienced`)
    - `age`: NumberField (18–60)
    - `experience`: SchemaField `{ current: NumberField(0) }`
    - `creation`: SchemaField `{ complete: BooleanField(false) }`
15. Add `ageGroups` config:
    - young: `{ label, attributePoints: 14, skillPoints: 10, clMod: -1 }`
    - experienced: `{ label, attributePoints: 13, skillPoints: 12, clMod: 0 }`
    - senior: `{ label, attributePoints: 12, skillPoints: 14, clMod: 1 }`
16. Add `prepareDerivedData()`: compute
    - `attributePointsSpent` = sum of all attribute values − 8 (base = 4 attrs × min 2)
    - `skillPointsSpent` = sum of all skill values
    - `attributeBudget` = `ageGroups[ageGroup].attributePoints`
    - `skillBudget` = `ageGroups[ageGroup].skillPoints`
    - `attributePointsRemaining` = budget − spent
    - `skillPointsRemaining` = budget − spent
    - `creation.complete` auto-set when both remaining = 0

**Files:** `src/data/actor-models.mjs`, `src/system/config.mjs`, `src/lang/en.yaml`

---

## Phase 6: Point Buy UI + XP-Gated Advancement

17. Update `agent-summary.hbs`: add `ageGroup` dropdown, `age` number input
18. Update `agent-attributes.hbs`: show point budget display
    - "Attribute Points: X/14 remaining" (during creation)
    - "Skill Points: X/10 remaining" (during creation)
    - +/− buttons on each attribute and skill value
19. Add advancement logic in `agent-sheet.mjs`:
    - Clicking **+** on attribute: if `attributePointsRemaining > 0` AND `value < 5` → increment free
    - Clicking **+** on attribute: if `attributePointsRemaining <= 0` → block (attributes never increase with XP)
    - Clicking **+** on skill: if `skillPointsRemaining > 0` AND `value < 3` (or `< 4` for key skill) → increment free
    - Clicking **+** on skill: if `skillPointsRemaining <= 0` AND `experience.current >= 5` AND `value < 5` → deduct 5 XP, increment
    - Clicking **+** on skill: if insufficient XP → show notification "Not enough XP (need 5)"
    - Clicking **−** on attribute/skill: only allowed during creation (remaining < budget)
20. Talent drop handler: if `experience.current >= 6` → deduct 6 XP on drop. If insufficient → block with notification. During creation (3 free talent slots), allow free drops.

**Files:** `src/actor/agent/agent-sheet.mjs`, `src/templates/actor/agent/agent-attributes.hbs`, `src/templates/actor/agent/agent-summary.hbs`, `src/actor/actor-document.mjs`

---

## Phase 7: XP Display + CL Auto-Compute

21. Add XP display to `agent-header.hbs` — editable number next to CL badge
22. CL auto-compute in `prepareDerivedData()`:
    - `baseCL` from subdivision item's `baseCL` (or division config fallback)
    - \+ `ageGroups[ageGroup].clMod`
    - \+ count of Requisition Authority talents owned
    - clamped 1–5
    - CL field becomes read-only (computed)

**Files:** `src/templates/actor/agent/agent-header.hbs`, `src/data/actor-models.mjs`

---

## Phase 8: Skill-Attribute Mapping Fix

23. Fix `endure`: `agi` → `str` in `config.mjs`
24. Fix `heal`: `emp` → `wit` (verify against rules first)
25. Verify all 13 skill mappings

**Files:** `src/system/config.mjs`

---

## Phase 9: Build, Deploy, Browser Test

26. `npx gulp build`
27. Clean deploy
28. Create fresh world → verify import
29. Create agent → test full creation flow:
    - Select age group → see point budgets
    - Drag subdivision from compendium → division auto-set, gear prompt
    - Distribute attribute points with +/− → budget enforced
    - Distribute skill points with +/− → budget enforced, key skill cap 4
    - Drop talents → free during creation (3 slots), XP-gated after
    - Set name, origin, biography
    - Verify CL auto-computed
    - Enter play → earn XP → spend on skill increase → XP auto-deducts
    - Verify rolls, corruption, placeholder image still work

---

## Decisions

- Subdivisions as Items (drag-and-drop, not dropdowns)
- Dropping subdivision auto-sets division + prompts starting gear
- Attributes NEVER increase with XP (fixed after creation)
- Skills cost 5 XP after creation budget exhausted
- Talents cost 6 XP after 3 free creation slots
- CL fully auto-computed (read-only field)
- Point buy enforced: +/− buttons with budget tracking
- Age group is a simple dropdown (only 3 choices)

---

## Key Numbers

| Budget | Young | Experienced | Senior |
|---|---|---|---|
| Attribute Points | 14 | 13 | 12 |
| Skill Points | 10 | 12 | 14 |
| CL Modifier | −1 | +0 | +1 |

- Attribute constraints: min 2, max 5 per attribute
- Skill constraints at creation: max 3 per skill, key skill max 4
- Base attributes: 4 × 2 = 8 (minimum)
- XP costs: Skill +1 = 5 XP, Talent = 6 XP
- Debrief XP: max 5/session (5 questions, each +1 XP)
- Division base CL: Wayfinder = 3, Recovery = 2, Keep = 3

---

## Open Items

- Verify `heal` skill mapping (`emp` or `wit`?)
- Starting talent slot tracking — how to distinguish "creation free" from "XP purchased"

# ProseMirror Editors in Foundry V14

## Correct Pattern

Use the `<prose-mirror>` custom element with an `{{#if isEditable}}` guard and an enriched HTML fallback for non-editable mode:

```hbs
{{#if isEditable}}
  <prose-mirror
    name='system.fieldName'
    value='{{system.fieldName}}'
    data-document-uuid='{{document.uuid}}'
    relative
  ></prose-mirror>
{{else}}
  {{{enrichedFieldName}}}
{{/if}}
```

| Attribute | Purpose |
|-----------|---------|
| `name` | The document field path (e.g. `system.description`) |
| `value` | Raw unenriched content |
| `data-document-uuid` | The document's UUID for collaborative editing |
| `relative` | Boolean attribute; enables relative UUID generation |

> ⚠️ **Do NOT add the `toggled` attribute.** `toggled` turns the editor into a
> click-to-edit control: while inactive it renders *only the element's innerHTML*
> (which we leave empty), so **the field's saved text is invisible** until the
> user clicks it — and the formatting menu is hidden. Without `toggled`, the
> editor is "always active": the text loads immediately and the menu bar is
> always available. Verified against Foundry v14's
> `client/applications/elements/prosemirror-editor.mjs` (`#toggled`, `open`,
> `_activateListeners`).

## Why This Pattern Works

- `<prose-mirror>` is a custom HTML element registered by Foundry.
- It **auto-activates** via `connectedCallback` when inserted into the DOM — no manual `TextEditor.create()` or `activateListeners()` call is needed.
- The `{{#if isEditable}}` guard prevents editor initialization when the sheet is in view-only mode.
- The `{{{enrichedFieldName}}}` fallback shows properly enriched HTML (links, UUID references, inline rolls) when not editing.

## Patterns That DO NOT Work

### ❌ `{{{enrichedXxx}}}` in a `<div class="editor">`

```hbs
<div class="editor">{{{enrichedRealSituation}}}</div>
```

This renders static HTML. Foundry may auto-detect the `.editor` class and add an edit button,
but it will not create a working ProseMirror instance. The content area will appear empty because
there is no `<prose-mirror>` element and no form field binding.

### ❌ `{{formInput (formField ...) type='prosemirror'}}`

```hbs
{{formInput (formField system.fields.content value=system.content) name='system.content' type='prosemirror'}}
```

This pattern works in some contexts (e.g., `informationCard.hbs`) but fails in others.
The `formField` helper can return `undefined` for certain data model field configurations,
causing `formGroup`/`formInput` to throw "Non-existent data field" errors.

### ❌ `{{{editor}}}` Handlebars helper

This is an actor-sheet pattern that does not work in item sheets. It relies on the
actor sheet's `editor` Handlebars helper registration, which is not available in the
item sheet context.

## Enrichment in `_prepareContext`

For each ProseMirror field, compute an enriched version in `_prepareContext`:

```js
context.enrichedFieldName = await TextEditor.enrichHTML(
  system.fieldName ?? '',
  { async: true, relativeTo: item },
);
```

The enriched HTML is used for the non-editable display fallback.

## Fields Must Be `HTMLField` in the Data Model

```js
static defineSchema() {
  return {
    description: new HTMLField({ blank: true }),
  };
}
```

## Tabs + ProseMirror

When using Foundry's `Tabs` UX component alongside `<prose-mirror>` editors:

```js
async _onRender(context, options) {
  await super._onRender(context, options);
  if (itemType === 'daCaseBrief') {
    new foundry.applications.ux.Tabs({
      navSelector: '.dcb-tabs',
      contentSelector: '.dcb-tab-content',
      initial: 'section-i',
    }).bind(this.element);
  }
}
```

Editors inside hidden tabs initialize correctly when the tab becomes active because the
`<prose-mirror>` element uses `connectedCallback` — it initializes when it becomes visible
in the DOM.

## Sizing, Resizing & Vertical Flow

Foundry core styles `prose-mirror` as a fixed box:

- the host gets `min-height: var(--min-height)`, and
- `.editor-content` is **absolutely positioned** inside it (`position: absolute; inset: 0`).

Because the host never sees the content height, editors render small with an internal
scrollbar. Core has a `content-sized` mode that fixes this by un-positioning the content,
but it is not applied by default.

The system applies the equivalent centrally in `src/styles/_prosemirror-theme.scss`:

```scss
.neon-relic prose-mirror .editor-content {
  position: unset; // host grows with its content → vertical flow
}

// Item-sheet editors: floor + drag handle. Scoped to
// `.neon-relic.item-sheet` + `prose-mirror.editor.prosemirror` (the host
// always carries the `editor` and `prosemirror` classes).
.neon-relic.item-sheet prose-mirror.editor.prosemirror {
  --min-height: 130px; // default floor
  min-height: var(--min-height);
  resize: vertical; // drag handle (requires non-visible overflow)
  overflow: auto;
}
```

The `.neon-relic.item-sheet` + `prose-mirror.editor.prosemirror` scoping gives a
4-class + 1-type specificity so the cascade **outranks the legacy textarea-era floors** that
landed on the host (4-class selectors such as `.item-sheet .description .editor`,
`.player-case-brief .editor`, and `.relic-sheet-item .rs-field`). Actor-sheet editors (agent
biography 320px, HQ description 240px) are not item-sheet scoped and keep their own floors.

Per-surface floors are set as `--min-height` overrides on the host classes
(`.dcb-textarea`, `.pcb-textarea`, `.loc-textarea`, `.org-textarea`, `.anchor-textarea`,
`.rs-field`).

> **Do not** add `resize` or `min-height` to component stylesheets for editors — sizing is
> owned by `_prosemirror-theme.scss` so it stays consistent across sheets.

## Reference

- Foundry V14 API: `foundry.applications.ux.ProseMirrorEditor`
- Reference implementation: `src/templates/actor/agent/agent-biography.hbs`
- Date documented: 2026-07-19

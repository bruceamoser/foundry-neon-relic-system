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

## Reference

- Foundry V14 API: `foundry.applications.ux.ProseMirrorEditor`
- Reference implementation: `src/templates/actor/agent/agent-biography.hbs`
- Date documented: 2026-07-19

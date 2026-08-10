# Radix/headless adoption research

## Sources

* Radix Primitives documentation via Context7: `/radix-ui/primitives`.
* Local package contract: `packages/react-designer/package.json`.
* Local UI contract: `.trellis/spec/monorepo/ptd-ui-system.md`.

## Findings

Radix Primitives are deliberately unstyled and expose behavior through composable primitives. Select
provides a combobox/listbox ARIA model, keyboard navigation (Arrow keys, Home/End, typeahead), disabled
items and focus management. Popover provides controlled/uncontrolled open state, Portal positioning,
DismissableLayer outside dismissal and FocusScope behavior. Both expose `data-state` and forward
`className`/`style`, which fits PTD CSS Modules and semantic tokens without adopting Radix Themes.

Portal content must be treated as part of the interaction tree even when mounted under `document.body`.
For nested or trapped layers, Radix FocusScope supports registered branches so portalled content does not
lose focus unexpectedly. PTD should therefore apply `ptdTheme` to Portal Content and add a stable
`data-ptd-editor-interactive`/equivalent interaction boundary on every interactive Portal.

## Mapping to this repository

* Already installed: ContextMenu, ScrollArea, Separator, Tabs and Tooltip.
* Likely next additions: `@radix-ui/react-select`, `@radix-ui/react-popover`, optionally `@radix-ui/react-collapsible` or `@radix-ui/react-toggle-group` only when a concrete panel requires them.
* Do not add Radix Themes: the repository already defines its own warm-paper/graphite/ink-blue token system and has a strict no-complete-UI-framework boundary.
* Keep business components responsible for Schema/Store writes; primitives own focus, keyboard, Portal and visual state contracts.

## Feasible adoption approaches

### A. Incremental primitive layer (recommended)

Create a small `components/Primitives` or `components/ui` layer containing PTD-styled wrappers for
Select, Popover/Color, Tabs, Disclosure and Field. Migrate one Inspector panel first, then expand.

Pros: small rollback surface, behavior parity is measurable, existing business panels remain stable, and
the visual contract is established before broad migration.

Cons: temporary coexistence of old and new controls; requires strict scope discipline.

### B. Inspector-first rewrite

Replace all Property Inspector controls in one batch using Radix wrappers and shared field components.

Pros: consistent result in one visible area.

Cons: large regression surface across many Schema types, harder to isolate Portal/focus bugs, and more
difficult to review or roll back.

### C. Global control replacement

Replace every matching native control across Designer, AppBar, DataPanel, Sidebar and ContentEditor.

Pros: fastest visual convergence if successful.

Cons: highest risk; some native text/number inputs are semantically correct, and global replacement can
break history, IME, file input, browser validation, or compact overlay behavior.

## Recommendation

Choose Approach A. Start with the Property Inspector's most repeated compound controls: Select/combobox,
segmented ToggleGroup, Popover-based ColorField and a shared Field shell. Defer raw text/number inputs,
file inputs, date/time inputs and Canvas/ContentEditor until their specific behavior is documented.

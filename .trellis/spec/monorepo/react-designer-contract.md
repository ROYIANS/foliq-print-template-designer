# React Designer Integration Contract

## Scenario: embed and extend `@ptd/react-designer`

### 1. Scope / Trigger

Use this contract whenever code changes the public `<Designer>` component, editor state/history,
component commands, package styles, or a host application consuming the designer.

The designer is React-specific, but its `TemplateSchema` and canvas renderers come from the
framework-agnostic `@ptd/core` and `@ptd/components` packages. This boundary must remain explicit.

### 2. Signatures

Public component:

```ts
interface DesignerProps {
  value: TemplateSchema
  onChange?: (value: TemplateSchema) => void
  host?: DesignerHost
  renderContext?: RenderContext
}

interface DesignerHost {
  document?: DesignerDocumentState
  commands?: Partial<Record<DesignerHostCommandId, DesignerHostCommandState>>
  onCommand?: (
    command: DesignerHostCommandId,
    context: { template: TemplateSchema; document?: DesignerDocumentState },
  ) => void | Promise<void>
  onCommandError?: (command: DesignerHostCommandId, error: unknown) => void
}

interface TemplatePreviewProps {
  template: TemplateSchema
  pageIndex?: number
  label?: string
  className?: string
  renderContext?: RenderContext
}
```

Internal command boundary:

```ts
class EditorStore {
  readonly measurementUnit: Signal<MeasurementUnit>
  readonly recentColors: Signal<readonly string[]>
  readonly activeTool: Signal<EditorTool>
  readonly temporaryHand: Signal<boolean>
  readonly effectiveTool: ReadonlySignal<EditorTool>
  readonly lastDrawingTool: Signal<DrawingComponentType>
  setActiveTool(tool: EditorTool): void
  completeDrawnComponent(component: ComponentSchema, tool: DrawnComponentType): boolean
  setTemporaryHand(active: boolean): void
  setMeasurementUnit(unit: MeasurementUnit): void
  recordRecentColor(color: string): void
  updatePageConfig(patch: Partial<PageConfig>, transient?: boolean): boolean
  syncExternal(template: TemplateSchema): void
  updateComponent(id: string, patch: Partial<ComponentSchema>, transient?: boolean): void
  updateComponentStyle(id: string, patch: Partial<ComponentStyle>, transient?: boolean): void
  beginGesture(): void
  commitGesture(): void
  cancelGesture(): void
  pasteAt(left: number, top: number): void
  setCurrentPage(index: number): void
  addPage(): string
  duplicatePage(index?: number): string | null
  deletePage(index?: number): void
  movePage(fromIndex: number, toIndex: number): void
  undo(): void
  redo(): void
}
```

Tool types:

```ts
type DrawingComponentType = 'RoyLine' | 'RoyRect' | 'RoyCircle' | 'RoyStar'
type DrawnComponentType = CreatableComponentType
type EditorTool = 'select' | 'hand' | DrawnComponentType
```

Host style import:

```ts
import '@ptd/react-designer/styles.css'
```

### 3. Contracts

#### Controlled value

- Each `<Designer>` creates one isolated `EditorStore`; editor signals must never live at module
  scope.
- Commands produce a new immutable `TemplateSchema` and call the latest `onChange` callback.
- When the host returns the exact emitted object as `value`, history is preserved.
- During transient gestures, every emitted object remains a recognized Host echo. A bounded gesture-echo
  window also recognizes structurally identical Host copies until the final gesture value is acknowledged;
  a delayed earlier echo must not be mistaken for an external replacement or clear selection while a newer
  local update is active. The window closes on final acknowledgement or a genuinely different external value.
- A genuinely external template object creates a new history baseline and clears invalid selection.

#### Read-only template preview

- `<TemplatePreview>` is a narrow, non-interactive public surface for rendering one real manual page.
  It accepts a `TemplateSchema`, optional page index/accessibility label/class name, and owns no HTTP,
  persistence, thumbnail generation or cache behavior. The Host fetches template content.
- Preview rendering must reuse the same `ComponentRenderer` and framework-independent component
  implementations as Canvas. It must not copy render logic, draw fake placeholders for valid content or
  maintain a second renderer registry.
- Each Preview owns an isolated EditorStore only to satisfy renderer context. It never emits Host changes,
  creates history, selection, editing handles or pointer interaction; its rendered component tree is hidden
  from accessibility APIs behind one outer `role="img"` and cannot receive pointer input.
- `pageIndex` clamps to a valid manual page. The page fits its container while preserving physical aspect
  ratio and component geometry. A new `template` synchronizes the isolated store without remounting the
  public Preview surface.
- ResizeObserver and every component renderer/editor instance must be disconnected or destroyed on unmount.
  Preview is not a bitmap-thumbnail generator and must never persist a derived image into TemplateSchema.
- Preview is static and deterministic by default. It never inherits the current Designer's temporary
  `RenderContext`; it renders proof data only when its Host explicitly supplies `renderContext`.

#### Data definition, bindings and proof state

- `TemplateSchema.data` is the canonical persisted data definition. Top-level `dataSource` / `dataSet`
  and legacy field tokens are compatibility inputs only; normalization and serialization must converge
  them to the canonical v2 data and binding model rather than creating a second editable source of truth.
- Field models, field names, field formatters, component bindings, explicitly saved sample records,
  removal of saved sample records and applying a newly reviewed import candidate are template mutations.
  Each deliberate action emits through `onChange`, marks the Host document dirty and creates at most one
  meaningful History entry.
- Proof mode, current proof-record index, field-search query, expanded field ids and JSON import drafts,
  parsing results or candidate previews are Designer-instance UI state. Host-supplied runtime data is also
  temporary. None may enter `TemplateSchema`, History, dirty calculation or `onChange` until the user
  explicitly applies a candidate that changes the canonical data definition.
- `Designer.renderContext` is the Host injection point for temporary `data`, `record`, `recordIndex`,
  `locale`, `timeZone` and an explicit ISO `now`. Changing it may update proof output, but does not write
  runtime values back into the template.
- Proof rendering calls Core `resolveComponentBindings` to derive render-only `ComponentSchema` values.
  It must never mutate the source component, the controlled template or its manual pages, and must not
  duplicate binding evaluation inside React renderers.
- Switching proof mode or proof records, searching fields, and expanding/collapsing field rows produces no
  History entry, dirty transition or Host change.
- A genuinely external `value` replacement closes proof mode, clamps the proof-record index, and clears
  import candidates and field-editing surfaces that belonged to the previous template.

#### Host application commands and document state

- `host` is the single application integration surface. Do not add top-level `onSave`, `onLoad`,
  `onExport`, HTTP client, router or authentication props back to Designer.
- New/Open/Save/Save As, template browser, version history/restore, template import/export,
  preview/print/document export and Help intents use stable `DesignerHostCommandId` values.
- `open` is the canonical user-visible cross-file command and may navigate the Host to its protected
  file workspace rather than opening an Editor overlay. `templateBrowser` remains a compatibility
  capability for existing hosts, but when both reach the same file workspace they must share state
  and handling rather than appearing as two distinct product actions.
- A command is a declared capability only when its key exists in `host.commands` and
  `host.onCommand` exists. Undeclared future commands resolve as unavailable for shortcut/integration
  callers; product menus must not synthesize roadmap placeholders merely because a stable command ID exists.
- `enabled` defaults true. Host `pending` and Designer's local Promise pending both reject duplicate
  execution; local pending is instance-only and cannot leak between two Designers.
- Command context contains the exact current `TemplateSchema` plus optional read-only Host document
  metadata. It must never contain API records, cookies, Session/JWT values or database types.
- New/Open are Host-owned. After confirmations, routes or API work complete, the Host updates the
  controlled `value`; a command handler does not return a Template to mutate internally.
- A Host may distinguish its file-workspace route, saved-document route and explicit unsaved-new
  route. Navigating away from dirty/conflict content and deciding whether to discard it remains
  Host-owned; Designer must not introduce a template-browser Modal or infer routing from document id.
- Save may create an unsaved document immediately using Host-selected/default metadata. Save As may
  open a non-modal Host command sheet. Neither interaction surface enters the Designer package.
- Version History is a File-menu Host intent. The Host owns version list/detail requests, real snapshot
  preview, restore confirmation, `expectedVersion`, request cancellation and 409 handling; Designer owns
  no version records and never applies a restore snapshot internally.
- Template JSON import/export are distinct File-menu Host intents and must not be conflated with the
  Data Panel's runtime/sample-data JSON workflow. Export receives the command context's exact current
  in-memory `TemplateSchema`, including unsaved edits; the Host serializes it through Core without server
  id/version/owner/session metadata. Import is Host-owned file I/O: size/version/schema validation and
  canonical migration happen before replacing `value`; a successful import becomes an id-less dirty
  document, and dirty/conflict content must pass the existing discard guard first.
- `Ctrl/Cmd+S/N/O` and `Ctrl/Cmd+Shift+S` execute only a currently enabled, non-pending declared
  Host command and yield to rich text, table cells, form controls and Portal menus.
- `DesignerDocumentState` exposes optional id/title/version plus
  `clean | dirty | saving | loading | error | conflict`. Chrome renders text as well as color for
  every state; `message` may provide Host-owned detail without creating a package Toast system.
- Existing editor and workspace menu items call the same EditorStore/layout commands as Toolbar,
  keyboard and panels. A menu must not duplicate template mutations or close as a fake execution.
- App Bar organizes low-frequency workflows as File/Template/View/Help. File owns document lifecycle;
  Template opens the existing page settings, page/assets/data workspaces and future template inspection;
  View owns ruler and guide assistance without repeating Status Bar zoom; Help dispatches real Host help
  commands. Single-component operations such as locking and layer movement stay in the component Quick Bar,
  Canvas context menu and keyboard paths; multi-selection-only commands such as alignment and grouping may
  remain in the Context Shelf. The App Bar must not create a duplicate Object category. Window is not
  used solely to mirror panel toggles. Version History is executable when the Host declares a saved document
  capability. A small number of stable near-term capabilities such as Template Inspection and Fit Page may
  appear disabled as `即将提供`, but a category must retain real executable actions and user-visible reasons
  must never expose internal delivery or integration copy.

#### History and gestures

- History snapshots contain the complete `TemplateSchema`, not only current-page components.
- The initial `value` is snapshot zero, so the first edit is undoable.
- A pointer or form gesture may emit transient updates, but `commitGesture()` adds at most one
  history entry.
- `cancelGesture()` restores the exact gesture-start `TemplateSchema`, emits that restoration through
  `onChange`, preserves valid selection, and adds no history entry.
- A new edit after undo discards the redo branch.
- Locked components reject content, style, geometry and structural commands; changing `isLock` to
  unlock remains allowed.

#### Measurement display and document page configuration

- Every Designer instance defaults to `mm` and may switch globally to PTD Canvas `px`; the unit is
  instance UI state and survives external template synchronization without entering `TemplateSchema`.
- Switching units updates Page/Single/Table Inspector geometry, ruler, guides, Context Shelf and Status
  Bar. It changes formatting, parsing, precision and step only; it emits no Host change and creates no
  history. Font size remains `pt`, rotation remains degrees, opacity remains percent and line height is unitless.
- PTD Canvas coordinates use the existing fixed contract `1 mm = 5 px`; display `px` is not browser DPI
  and does not define bitmap export resolution.
- One top-level `PageConfig` applies to every manual page. It includes four content-safety margins;
  legacy values missing left/right margins normalize through Core compatibility helpers.
- Invalid page size, margin combination, font size or line height is rejected before Schema mutation.
  Focused drafts remain local; Escape restores the exact gesture start and valid continuous edits add
  at most one history node.
- Paper resize preserves every component geometry. Out-of-bounds components are derived from rotated
  bounds, shown as a count in Page Inspector and marked on Canvas without persisting warning state.

#### Inspector controls and color state

- `RoySimpleText` and `RoyText` expose bounded `columnCount` (1–6), non-negative `columnGap` and
  `columnFill` (`auto` / `balance`) controls in Single Inspector. Each interaction uses the existing transient
  gesture boundary, preserves one component identity and commits at most one history entry; non-text components do
  not expose these controls.
- Page, Single, Multi and free-table business panels compose the shared `InspectorControls` layer;
  native input/select/textarea/color elements are implementation details of that layer rather than
  independently styled business fields.
- The Inspector body is one continuous warm `surface-form`, not a stack of white Section cards. Sections
  use heading rhythm and spacing, plus at most one low-contrast 1 CSS px inset separator between adjacent
  Sections. Editable fields use a white borderless `surface-field`, 6 CSS px radius and
  `--ptd-shadow-field`.
- Normal Inspector fields are 32 CSS px high, explicit compact/table-internal fields are 28 CSS px and
  coarse-pointer fields are 40 CSS px. Page, Single, Multi and free-table panels must not introduce a
  third field height or duplicate field appearance outside `InspectorControls`.
- Field default shadow is deliberately near-invisible; hover, focus-visible and invalid raise it to
  `--ptd-shadow-field-hover`. Focus-visible and invalid also use a full non-layout ring/outline plus text;
  disabled/locked reduce surface/shadow while remaining identifiable. Business panels must not copy raw
  shadows or restore decorative field outlines.
- Inspector segmented/Button Groups use one white `surface-field` track. The current item uses the warm
  `surface-form`, one low-contrast neutral 1 CSS px boundary and no selection shadow. This inset form-control
  language does not replace the archival-ink active surface used by Floating Dock or the raised white selection
  surface used by Rail and navigation Tabs.
- Typed numeric drafts outside the declared range remain local and expose an associated accessible
  error. They do not clamp into Schema, emit a Host change or create history; steppers and scrubbers may
  stop at an explicit boundary. Escape restores the exact gesture start.
- Color controls accept three- or six-digit HEX drafts and persist normalized six-digit lowercase HEX.
  Transparent/no-color is exposed only for renderer properties that support it; reset restores the
  control's explicit semantic default.
- Page Inspector's document settings use the Store-agnostic `PtdColorField` for paper and default text
  color. The field exposes the PTD HSV surface/hue controls plus HEX and palette choices. Opening starts
  one transient gesture; valid visual/HEX/palette changes remain transient until outside
  close commits, while Escape calls `cancelGesture` and restores the exact opening value. Reset is one
  discrete gesture. A continuous color edit must create at most one history node and preserve undo/redo
  parity.
- Recent colors are bounded Designer-instance UI state. Document colors are derived from PageConfig,
  component styles, table cells and QR/barcode content, normalized and de-duplicated by frequency plus
  stable document order. Neither palette mutates TemplateSchema or history, and disabled/locked controls
  close any open palette.
- Rich-text HTML is not a primary Inspector field. Content and selection-level formatting remain in the
  canvas editor; Inspector typography and appearance are component-frame defaults.

#### Persistent tools, temporary Hand and drawn creation

- `activeTool` is the current user-selected tool. `temporaryHand` is a UI-only Space override;
  `effectiveTool` is `hand` only while that override is active and otherwise equals `activeTool`.
- `lastDrawingTool` tracks only the four Shape subtypes. Select, Hand, Text and Space must not replace
  the remembered Shape used by the grouped Floating Main Dock control.
- `H` selects persistent Hand; `V` and Escape select `select`. Space keydown outside editable controls
  sets temporary Hand; keyup, window blur and hook cleanup clear it even if focus has since moved.
- Hand pan sessions own only pointer/client origins and viewport scroll origins. Pointer move changes
  only `scrollLeft/scrollTop`; it does not clear selection, mutate Schema, call `onChange` or write history.
- Every available catalog click only activates its draw tool and creates nothing immediately. The user
  defines the frame by dragging on Paper; Floating Main Dock click/native drag must not insert a centered
  component.
- Draw preview is local Canvas state. A valid pointer-up runs geometry normalization/clamp and exactly
  one `completeDrawnComponent()`; preview movement, sub-4px client-space drags and every cancellation
  path create no Schema, host emission or history node and do not switch tools.
- Shape tools (`RoyLine`, `RoyRect`, `RoyCircle`, `RoyStar`) remain active after successful creation.
  Text, rich text, image, code and table tools are one-shot and return to Select. Newly created plain or
  rich text enters direct editing immediately; other one-shot components remain selected for inspection.
- QR frame geometry is always square. Other non-Shape tools accept normalized forward or reverse
  rectangular frames; Shift constraints remain specific to closed Shape tools.
- Pointer cancel, lost pointer capture, tool/effective-tool change and window blur must close the current
  Pan/Draw session. Releasing temporary Space-Hand returns to the previously selected creation tool without
  resurrecting the cancelled preview.
- Shape menu keys are scoped: Arrow/Home/End navigate; Enter/Space choose; Escape closes only the menu.
  These keys must not bubble to object nudge, temporary Hand or global Escape handling.
- The complete component catalog is exposed through an instance-local More picker rather than a Resource
  Panel. It renders only available tools, never planned items; opening, searching and recent-tool order are
  UI state and must not emit Host changes or history.
- The Text group in Floating Main Dock remembers the last plain/rich text tool per Designer instance.
  Picker and grouped-tool Portal/menu boundaries own Arrow/Home/End, Enter/Space and Escape, and
  restore trigger focus when dismissed.
- Pointer-mouse outside press may dismiss the More picker. Touch/Pen outside pointerdown must not dismiss it;
  explicit close, tool selection and Escape remain available. Portal geometry stays clamped to the Designer
  container and carries the shared theme plus editor-interactive boundary.

#### Workspace rail and floating tool dock

The Designer shell uses three grid rows and mounts the floating controls inside the Canvas area:

```tsx
<AppBar />
<Workspace>
  <Sidebar />
  <CanvasArea>
    <Canvas />
    <FloatingToolDock />
  </CanvasArea>
  <PropertyInspector />
</Workspace>
<StatusBar />
```

- There is no standalone Header-adjacent command-bar row. The left Sidebar rail contains exactly
  Assets, Pages, Layers and Data, ordered at its top; it owns only Resource Panel disclosure and resize.
- `FloatingToolDock` owns the persistent Main Dock plus one Context Shelf. The Main Dock groups
  Undo/Redo, Select/Hand, Text/Shape/Image/SimpleTable/More and the Inspector toggle without duplicating
  Store commands. The Context Shelf reuses the page, single, multi, guide and active-tool commands.
- Stable DOM regions are `data-ptd-region="floating-tool-dock"` and
  `data-ptd-region="context-shelf"`; the removed `command-bar` region must not be reintroduced as an
  empty compatibility row.
- At normal widths the Main Dock has a stable 448 CSS px width and centers its tool groups. The Context
  Shelf is absolutely positioned behind it and inset 24 CSS px from each side, giving it 400 CSS px of
  content-safe width without participating in the dock's intrinsic sizing. It uses `surface-sunken`, has no
  border or box shadow and overlaps the Main Dock edge by 5 CSS px. The Main Dock is also borderless, uses
  the near-black translucent `--ptd-header-bg`, 8 CSS px radius, one 14 CSS px backdrop blur and the dedicated
  `--ptd-shadow-tool-dock` token. Changing context content must not move or
  resize Main Dock controls, and
  desktop context content must not be clipped. A single-component context shows only its user-facing
  catalog type plus X/Y/W/H metrics; it does not expose custom layer names, internal Schema component types
  such as `RoySimpleText`, or duplicate Copy/Lock/Layer/Delete actions already available through the
  component Quick Bar, Canvas context menu and keyboard paths.
- Main Dock and Context Shelf tool selection use a complete archival-ink `--ptd-selection` surface
  with white foreground, no border and no selection shadow. Rail, navigation Tabs and Status Bar selection
  retain a complete white selection surface, `--ptd-shadow-selection` and archival-ink foreground. Persistent blue bottom indicators, pale-blue fills
  and non-focused blue outlines are forbidden; Canvas selection/guides and focus-visible rings keep their
  functional archival-ink geometry.
- Canvas scroll content reserves `--ptd-floating-tool-dock-safe-area`; the dock offset leaves the
  horizontal scrollbar and Status Bar operable. The dock uses the Selection layer so compact Scrim covers
  it, while Resource/Inspector overlay remains above the Scrim.
- In compact mode Image and SimpleTable direct buttons may be CSS-hidden, but More, Undo/Redo,
  Select/Hand, Text, Shape and Inspector remain visible. The More picker must still expose every available
  component type.
- Component Picker geometry centers on its Main Dock trigger, opens upward with one gutter, clamps left/
  right/top to the Designer bounds and derives max-height from the space above the trigger. Escape restores
  More-button focus exactly as before the move.

#### Clipboard placement

- `pasteAt(left, top)` interprets `left/top` as the requested paper-space position of the copied
  selection's visual bounding-box top-left, not as a per-component absolute position.
- A copied multi-selection preserves every component's relative geometry. All pasted ids, including
  ids nested inside groups, are regenerated before insertion.
- If the copied selection can fit on an axis of the physical page, the complete selection is clamped
  into that page axis. A selection larger than the page keeps the requested translation rather than
  being distorted or collapsing its relative layout.
- One paste inserts and selects the complete copied set through one immutable template update, one
  `onChange` emission and one history entry. Pasting a cut clipboard consumes it only after the
  insertion succeeds.

#### Canvas context commands

- Context targeting is resolved before the menu opens: an unselected component becomes the sole
  selection, a component already inside a multi-selection preserves the complete selection, and
  blank paper clears component selection.
- Opening a context menu or opening Properties is UI state only and must not add template history.
- Locked selections may be inspected, copied and explicitly unlocked. Cut, delete, group/ungroup and
  layer mutations must be unavailable in the UI and remain guarded as no-ops in `EditorStore`.
- Blank-paper paste delegates to `pasteAt`; component commands reuse the same store methods as the
  command bar and keyboard shortcuts rather than duplicating mutation logic.
- The paper exposes an accessible name and supports both native pointer context-menu input and
  `Shift+F10` / the Context Menu key. Radix owns roving focus, Arrow navigation, Enter selection and
  Escape dismissal.
- Main and nested context-menu portal content must be treated as editor-interactive targets. Designer
  root pointer capture must not reclaim focus from them, and global editor shortcuts must yield to
  Radix so submenu items remain pointer-clickable and keyboard-operable.

#### Direct content editing

- Empty rich text remains a valid semantic document canonicalized as `<p><br></p>`; product placeholders are
  authoring-only UI and must never be persisted as component content.
- The rich editor wrapper and its ProseMirror surface must fill the complete drawn component frame.
  Entering a newly drawn empty rich-text component focuses the editor immediately, and clicking any
  otherwise empty point inside the frame forwards focus to the contenteditable surface.
- ProseMirror's trailing `<br>` in an empty paragraph must still expose the visual placeholder. The
  placeholder disappears after input without changing the persisted HTML on its own.

#### Media and code content

- `@ptd/core` owns public image, QR and barcode content types, usable defaults, exact runtime guards,
  compatibility normalizers and format-specific validation. Renderer and Inspector must consume the
  same functions instead of maintaining unchecked casts or divergent fallback values.
- New images persist structured `{ src, alt, fit, position }` content while legacy string sources remain
  readable. The first content edit may lazily upgrade a legacy string, and the complete focused edit is
  one transient gesture that Undo restores to the exact legacy value.
- Image file selection reads `image/*` through `FileReader` and persists its Data URL directly. A
  `blob:` URL, script URL or non-image Data URL is never committed as a stable template source.
- New QR and barcode frames have non-empty valid defaults and render immediately. QR exposes content,
  correction level, quiet-zone margin and dark/light colors. Barcode exposes content, supported symbology,
  foreground color and human-readable-text visibility, with symbology-specific validation.
- Framework-independent renderers expose mutually exclusive empty, loading, ready and error states where
  applicable. Image source changes remove the previous image while the next source loads off-DOM; image
  events and dynamic QR/barcode imports use per-instance render identity so stale work cannot overwrite
  newer content or a destroyed component. Load/generation errors must never become a blank frame.
- Inspector text/select/color changes use the existing begin/transient/commit gesture boundary. Discrete
  file, clear and segmented commands are one history entry each; locked components disable every path.

#### Free-table authoring

- `@ptd/core` owns the canonical `SimpleTableProps` model. Every grid coordinate references a Cell ID;
  rectangular merged regions repeat that ID, while the Cell Map stores one plain-text payload, span and
  style record. The model must keep at least one row/column, unique IDs, rectangular non-overlapping spans
  and an addressable owner for every covered coordinate.
- Legacy `tableConfig/tableData` remains a compatibility input. Renderer and Designer normalize it through
  the same Core function; legacy cell HTML becomes plain text and must never be executed. New tables start
  with a real independent 2×2 grid rather than `null` or a renderer-only placeholder.
- Insert/delete row/column, merge/split, track resize, text update and cell-style update are immutable Core
  commands without DOM geometry. A discrete structure command performs one component replacement, one Host
  change and one PTD history node. Focused Inspector input and pointer track resize use one transient gesture.
- Selecting the table object is distinct from selecting cells. Cell anchor/focus, drag selection and active
  cell editing are instance UI state and never enter `TemplateSchema`. Single click selects, drag/Shift extends,
  Arrow/Tab navigates, and double click or Enter/F2 opens a local plain-text draft; Escape cancels and commit
  writes at most one history node.
- Locked tables use the framework-independent Renderer and reject every cell selection/edit/structure path.
  `RoyComplexTable` remains a read-only compatibility Renderer and a planned Catalog item until data binding,
  section authoring, repeated detail and derived pagination contracts are implemented.

#### Manual pages and derived pagination

- `TemplateSchema.pages` is the ordered list of manually designed physical pages. Page switching is
  instance UI navigation: it clears page-local selection/guides/reveal state but does not emit
  `onChange` or create template history.
- Add inserts one blank page after the current page. Duplicate inserts a deep independent copy after
  the source and regenerates the page id plus every component and nested group-child id.
- Delete must never remove the final page. When deleting the current page, select the page now at the
  deleted index or the previous final page when the deleted page was last.
- Reorder is a single immutable `pages` replacement and preserves the active page by `page.id`, not
  by its former numeric index. Add, duplicate, delete and reorder each emit once and create exactly
  one history entry.
- History restore preserves the active page id when it still exists; otherwise it clamps
  `currentPageIndex` into the restored page array and clears stale page-local selection state.
- Automatic overflow pagination is derived preview/print output, not a mutation of the manual page
  list. Future table/list/long-text flow rules must generate ephemeral render pages and must not write
  those pages back into `TemplateSchema.pages`.

#### Package consumption

- `@ptd/react-designer` extracts CSS to `dist/index.css` and exports it as `./styles.css`.
- Its tsup configuration maps `.css` to esbuild's `local-css` loader. tsup's CSS plugin reads the
  generic `.css` loader even when the source filename ends in `.module.css`; configuring only
  `.module.css` silently emits empty JavaScript class maps.
- Every host imports the style subpath explicitly. Do not use runtime style injection: it conflicts
  with CSS Modules, CSP and SSR control.
- Every host declares the designer's peer dependencies (`react`, `react-dom`,
  `@preact/signals-react`) in its own dependencies.
- Build dependency packages before consuming apps. Never run `react-designer` clean/build in
  parallel with a Web build that reads its `dist` directory.

### 4. Validation & Error Matrix

| Condition                                 | Required behavior                                                    |
| ----------------------------------------- | -------------------------------------------------------------------- |
| `value` is the exact last-emitted object  | No history reset                                                     |
| `value` is a new external object          | Replace template; reset history baseline and selection               |
| Host command key is absent                | Keep command disabled and label it as not integrated                 |
| Host command is pending                   | Reject duplicate menu, App Bar and shortcut execution                |
| Save handler executes                     | Receive exact current template and optional document metadata        |
| New/Open handler completes                | Wait for Host to replace controlled `value`; do not sync internally  |
| Document status is conflict/error         | Render explicit text status; never rely on color alone               |
| Preview page index is out of bounds       | Clamp to an existing manual page                                     |
| Preview receives a new TemplateSchema     | Update real renderer content; no Host/history/selection mutation     |
| Preview has no explicit `renderContext`   | Render static content; do not inherit Designer proof state           |
| Host replaces `Designer.renderContext`    | Recompute proof only; no Schema, Host, dirty or history mutation     |
| Proof/search/expanded state changes       | Update instance UI only; no Schema, Host, dirty or history mutation  |
| JSON is parsed or previewed               | Keep candidate local; do not mutate the template before Apply        |
| User applies a valid import candidate     | Replace canonical data once; one Host emission and history entry     |
| Field/formatter/binding/sample edit       | Persist once in canonical data; one coherent history entry           |
| External `value` replaces the template    | Close proof, clamp record and clear stale data-panel draft surfaces  |
| Proof resolves a component binding        | Derive via Core without mutating source components or manual pages   |
| First user mutation then undo             | Restore initial `value`                                              |
| Gesture emits many transient updates      | One final history entry                                              |
| Gesture is cancelled                      | Restore the exact gesture-start value; add no history entry          |
| Switch `mm` / `px`                        | Update all display consumers; no Schema, Host or history mutation    |
| Page config draft is invalid              | Keep it local; do not emit or create history                         |
| Page resize makes objects out of bounds   | Preserve geometry; derive warning count and Canvas marker            |
| Select/Text/Shape + Space keydown         | `effectiveTool=hand`; persistent tool/history/selection unchanged    |
| Space keyup, blur or cleanup              | Clear temporary Hand; restore exact persistent tool                  |
| Hand pointer drag                         | Change viewport scroll only; no host/history/selection mutation      |
| Text/Shape tool activation                | UI state only; do not create a component                             |
| Valid Text/Shape pointer-up               | One component, one host emission and one history entry               |
| Short/cancelled/lost-capture draw         | Clear preview; no component/emission/history                         |
| Shape menu Escape                         | Close menu; preserve active Shape tool                               |
| Designer shell renders                    | No standalone command-bar row; Canvas gains that vertical space      |
| Left Rail renders                         | Exactly Assets/Pages/Layers/Data; no canvas creation tools           |
| Context changes                           | Shelf content changes; Main Dock positions remain stable             |
| Compact hides Image/Table shortcuts       | More Picker still exposes both and all other available tools         |
| Compact overlay opens                     | Scrim covers Floating Dock; active overlay remains above Scrim       |
| More Picker opens                         | Center above trigger and clamp completely inside Designer bounds     |
| Inspector field renders                   | White borderless field on warm form canvas with semantic shadow      |
| Inspector field receives focus/errors     | Full non-layout focus/invalid ring plus accessible text              |
| UI control becomes selected               | White raised surface; no blue bottom indicator or persistent outline |
| Selection contains a locked component     | Destructive/structural command is a no-op                            |
| Context click targets unselected object   | Select that object before rendering component commands               |
| Context click targets selected group item | Preserve the existing multi-selection                                |
| Context click targets blank paper         | Clear selection; expose page properties and positioned paste         |
| Pointer enters a context submenu          | Preserve Radix focus; allow submenu item click and keyboard select   |
| Newly drawn rich text has empty HTML      | Focus full-frame editor; type without Inspector/source workaround    |
| New QR or barcode frame                   | Persist a valid visible default; expose dedicated Inspector fields   |
| Image content is a legacy string          | Render unchanged; first edit may normalize as one undoable gesture   |
| Image source uses `blob:`/unsafe data     | Show field/frame error; never commit it as a stable source           |
| QR/barcode content is invalid             | Show format-specific error; never leave a silent blank frame         |
| Async code render resolves after update   | Ignore stale result through the instance render token                |
| `pasteAt` receives a multi-selection      | Preserve relative geometry; regenerate every id; one history         |
| Switch an existing page                   | Change UI page only; clear local selection; no host/history          |
| Add or duplicate a page                   | Insert after source; select new page; one host/history               |
| Duplicate a page with groups              | Regenerate page, component and recursive child ids                   |
| Delete the only page                      | No-op; template always retains at least one manual page              |
| Reorder around the active page            | Preserve active `page.id` and valid component selection              |
| History removes the active page           | Select nearest valid page; never expose an invalid index             |
| Unsupported structured `propValue`        | Inspector is read-only; never coerce to string                       |
| Host omits `styles.css` import            | Integration is invalid; UI styling is not guaranteed                 |
| Built CSS Module default export is `{}`   | Invalid package build; host elements receive no class names          |
| Host omits a peer dependency              | Workspace/install validation must fail before release                |
| App build overlaps package `clean`        | Invalid verification order; rerun sequentially                       |

### 5. Good / Base / Bad Cases

- **Good**: a host declares all peers, imports `styles.css`, stores `onChange` output unchanged, and
  builds after dependency packages.
- **Base**: a single designer edits one page; the first update, undo and redo all preserve schema and
  selection invariants.
- **Good tool flow**: Rectangle is persistent, Space temporarily pans, keyup returns to Rectangle,
  and the next valid drag adds one Rectangle as one undo step.
- **Bad**: module-global signals make two designers share selection/history; Space overwrites
  `activeTool`; Shape-menu keys reach global shortcuts; preview updates stream into history; a group
  array is edited through a text area; or Web build runs while tsup is cleaning designer `dist`.

### 6. Tests Required

- Store unit test: two stores do not share template, selection, clipboard or history.
- Host contract tests: undeclared/disabled/pending capability resolution, exact command context,
  local Promise duplicate prevention and two-Designer pending isolation.
- App Bar/keyboard tests: real EditorStore/workspace execution, Host Save/New/Open shortcuts,
  planned command disabled state and document title/version/status Chrome.
- Preview tests: real ComponentRenderer output, external Schema synchronization, non-interactive semantics
  and page-index clamping without Host changes or history; default static output does not inherit Designer
  proof state, while an explicit Preview `renderContext` deterministically resolves bindings.
- Data-panel/Store tests: proof mode, record navigation, search and expanded rows are instance-local and
  history-free; JSON parse/preview remains local; Apply, field/formatter/binding edits and saved-sample
  removal each create one coherent Host emission and history entry.
- Store synchronization test: external `value` replacement closes proof, clamps the record index and clears
  stale import and field-editing surfaces without modifying the incoming template.
- Core/renderer contract test: proof uses `resolveComponentBindings`, leaves the source template and manual
  pages referentially unchanged, and reacts to Host `record`, locale, time zone and explicit ISO `now`
  without persisting runtime data.
- Store/Core unit tests: measurement preferences are instance-local and history-free; conversion,
  formatting, parsing, precision and stepping preserve canonical Canvas geometry.
- Core/Store tests: legacy page config gains left/right margins; invalid content areas are rejected;
  one page-config gesture creates one history node; resize preserves out-of-bounds component geometry.
- Store unit test: first mutation undo/redo and redo-branch truncation.
- Store unit test: a committed transient gesture produces one snapshot; a cancelled gesture restores
  the exact starting template without history; locked commands are no-ops.
- Store/keyboard test: temporary Space-Hand parameterizes Select, Text and Shape; keyup/blur/cleanup
  restores the exact persistent tool and preserves last Shape, selection, history and `onChange` count.
- Geometry test: Text forward/reverse/clamp, closed-Shape Shift, Line midpoint/length/angle, CSS-pixel
  threshold and non-mutation of registry defaults.
- Canvas/browser test: persistent Hand changes only viewport scroll with grab/grabbing cursor; Text
  activation creates nothing; one valid text frame is one undo step; cancel/lost capture creates none.
- Floating Dock test/browser assertion: Main Dock tools use the documented fine/coarse/mobile targets and
  centered glyphs; Text/Shape disclosure overlays without shifting the glyph; grouped-menu and More-picker
  keys never activate Hand/Select or reach object shortcuts. The Rail exposes only four Resource buttons.
- Workspace layout assertion: no `command-bar` region; Context Shelf is 48px narrower with no shadow;
  borderless Main Dock uses 8px radius and `--ptd-shadow-tool-dock`; Canvas safe area exceeds the combined dock stack; compact Image/
  Table shortcuts are hidden while More exposes all available component types.
- Store unit test: `pasteAt` preserves multi-selection geometry, selects fresh ids, emits one host
  change, creates one history entry, undoes as one operation and clamps into physical page bounds.
- Store unit test: add/duplicate/delete/reorder page commands cover fresh recursive ids, final-page
  protection, one host/history mutation, active-page identity and Undo/Redo index repair.
- Geometry unit test: group → scale/rotate/move → ungroup preserves visual geometry.
- Inspector helper test: structured values are read-only; numeric primitive values preserve type.
- Inspector CSS/browser assertion: continuous warm form canvas, 32/28/40px field sizes, 6px field radius,
  white borderless surface, exact semantic field shadow and full non-layout focus/invalid rings. Page,
  Single, Multi and Table controls must not expose a second raw field style.
- Inspector value/palette tests: out-of-range drafts are rejected without clamping; shorthand HEX is
  normalized; document colors remain stable; recent colors are unique, bounded and instance-local.
- Core content tests: image/QR/barcode defaults, exact guards, legacy normalization, unsafe image
  source rejection and every supported barcode format validation remain deterministic.
- Renderer tests: empty/unsafe images and invalid QR/barcodes expose explicit frame states rather than
  broken-image chrome or blank DOM; image states remain mutually exclusive across source updates, and no
  asynchronous media/code rendering can outlive its render identity.
- Store test: a focused Inspector gesture can upgrade a legacy image string to structured content as
  one history entry, and Undo restores the exact legacy string.
- Table tests: legacy input normalization cannot execute HTML; merge/split and row/column insertion/deletion
  preserve all grid invariants; table cell selection is history-free; one cell-edit commit is exactly one
  history entry and locked/non-table objects reject table sessions.
- Package build assertion: ESM, CJS, DTS and `dist/index.css` exist; ESM/CJS contain non-empty CSS
  Module class maps such as `Designer_designer`.
- Host build assertion: peer dependencies resolve and `@ptd/react-designer/styles.css` imports.
- Browser assertion: right-click target resolution, blank/component command sets, locked disabled
  states, positioned paste + one-step Undo, clickable layer submenu and `Shift+F10` keyboard entry
  all work without Designer root focus capture dismissing a menu.
- Rich-text assertion: sanitized `<p></p>` canonicalizes to `<p><br></p>`; an empty editor fills the drawn frame,
  focuses on creation and accepts input from any point inside the frame without persisting placeholder
  text.
- Verification ordering: finish the designer package build before starting the host build.

### 7. Wrong vs Correct

#### Wrong

```ts
// Global mutable editor state leaks between Designer instances.
export const templateSignal = signal(defaultTemplate)

// Host relies on package CSS appearing automatically.
import { Designer } from '@ptd/react-designer'
```

#### Correct

```tsx
import { Designer } from '@ptd/react-designer'
import '@ptd/react-designer/styles.css'

function Host() {
  const [template, setTemplate] = useState(initialTemplate)
  return <Designer value={template} onChange={setTemplate} />
}
```

#### Wrong tool state

```ts
// Space destroys the user's persistent tool and panning pollutes template history.
store.setActiveTool('hand')
store.updateTemplate({ viewportLeft: nextScrollLeft })
```

#### Correct tool state

```ts
// Space is temporary UI state; viewport panning never enters TemplateSchema.
store.setTemporaryHand(true)
viewport.scrollLeft = nextScrollLeft
store.setTemporaryHand(false)
```

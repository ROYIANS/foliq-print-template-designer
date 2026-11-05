# Quality Guidelines (v2)

---

## Claude Code File Edit Rules

When using Claude Code (CLI or agent) to edit files, the tool enforces a **read-before-write** contract:

> **You must call the `Read` tool on a file before calling `Edit` or `Write` on it in the same session.**

This is a Claude Code platform constraint, not a permissions issue. If you see a "File has not been read yet" error, the fix is always to read the file first, then retry the edit.

**Pattern to follow:**

```
Read(file_path)          ← always first
Edit(file_path, ...)     ← then edit
```

This applies to both the main agent and all sub-agents (`trellis-implement`, `trellis-check`, etc.). Sub-agents must read any file they intend to modify, even if the file content was described in the prompt.

---

## Toolchain

| Tool       | Version            | Config                                         |
| ---------- | ------------------ | ---------------------------------------------- |
| ESLint     | v9 (flat config)   | `eslint.config.js` at root                     |
| Prettier   | v3                 | `.prettierrc.json` at root                     |
| TypeScript | v5+                | `tsconfig.base.json` + per-package             |
| Node       | 22.12+ recommended | Full workspace baseline; CI/Docker use Node 22 |
| pnpm       | 11.18.0            | root `packageManager` + `pnpm-workspace.yaml`  |

---

## Prettier Config

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "semi": false,
  "printWidth": 100,
  "tabWidth": 2
}
```

---

## EditorConfig

```ini
indent_style = space
indent_size = 2
end_of_line = lf
trim_trailing_whitespace = true
insert_final_newline = true
```

---

## ESLint

Uses flat config (`eslint.config.js`). TypeScript rules applied to `**/*.{ts,tsx}`. React rules applied to `apps/web/**` and `packages/react-designer/**`.

Run: `corepack pnpm lint`

---

## Required Patterns

- Every `packages/*` must have a `typecheck` and build script appropriate to its current package
  contract
- Implemented library packages (`core`, `components`, `export`, `react-designer`) use tsup and Vitest
- `src/index.ts` must exist and be the only public API entry point
- After an authorized dependency change, `corepack pnpm install` must succeed from root and the
  lockfile must be committed with the manifest change
- pnpm build-script policy belongs in root `pnpm-workspace.yaml#allowBuilds`; pnpm 11 no longer
  reads `package.json#pnpm.onlyBuiltDependencies`
- Destroy third-party instances in cleanup / component unmount (DOM listeners, observers, editors,
  renderers, browser processes, or other external resources)

---

## Forbidden Patterns

- Importing across packages via relative paths (`../../../packages/core/src`)
- `console.log` in library packages (`@ptd/*`) — use a debug utility or remove
- Committing `dist/` directories — they are gitignored
- `node_modules` in any commit
- Adding `"type": "commonjs"` to any package — all packages are ESM

---

## Testing

Implemented library packages use **Vitest** for unit tests.

### Landing-page current-state copy contract

`apps/web/src/pages/landing/LandingPage.tsx` is a public implementation surface, not a historical marketing
snapshot. Whenever authentication/access policy, demo reset behavior, persistence/versioning,
Datasource, preview/output, deployment environment variables, or licensing changes, audit every
landing-page section in the same change.

- Verify claims against live code and the nearest current README; archived task documents are not
  current-state authority.
- Distinguish shipped capabilities, partial vertical slices, and roadmap items explicitly. Do not
  describe an implemented preview/PDF/data-binding path as unavailable, or a planned Word/batch
  path as shipped.
- Security and hosting copy must name real external dependencies. Self-hosted template storage does
  not mean “no third party” while GitHub OAuth still provides identity.
- `PTD_ADMIN_EMAILS` identifies administrators; it is not a login allowlist. Public copy must not
  reintroduce the removed allowlist model.
- Add or update a LandingPage regression test that asserts the new current-state claim and rejects
  the stale claim being replaced.

```tsx
// Wrong: a broad promise that drifts as features change.
<p>设计模板需要的，都在这里。</p>

// Correct: current shipped boundary plus an explicit adjacent limitation.
<p>打印预览与服务端 PDF 已上线；Word 与批量输出仍在建设。</p>
```

### vitest.config.ts (required in every package)

Default for pure logic packages (no DOM):

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
  },
})
```

For packages that use DOM APIs (`@ptd/components` and any future browser-only packages), use `jsdom`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
  },
})
```

> **Rule**: Use `environment: 'node'` by default. Switch to `'jsdom'` only when the package directly manipulates DOM (e.g., `document.createElement`, `element.style.setProperty`). Do not add `jsdom` to packages that don't need it — it adds ~5s to test startup.

### Test file location

Tests live in `src/__tests__/` with the naming pattern `<module>.test.ts`.

### Import paths in tests

Tests are inside `src/__tests__/`, so imports are relative to `src/`:

```ts
// Correct — tests are inside src/__tests__/
import { DataBindingEngine } from '../data-binding/engine'

// Wrong — do not include 'src' in the path
import { DataBindingEngine } from '../src/data-binding/engine'
```

# Package Conventions (v2)

---

## Implemented Package Mode

All implemented workspace library packages use the same build and test mode.

| Packages                                                             | Current build/test mode   |
| -------------------------------------------------------------------- | ------------------------- |
| `@ptd/core`, `@ptd/components`, `@ptd/export`, `@ptd/react-designer` | tsup ESM+CJS+d.ts, Vitest |

New implemented library packages should use **tsup** for ESM + CJS + `.d.ts` unless an approved
task establishes a different output contract.

### tsup.config.ts (required in implemented tsup packages)

```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
})
```

### package.json Required Fields

Every implemented tsup package under `packages/` should have:

```json
{
  "name": "@ptd/<name>",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  },
  "engines": { "node": ">=20" }
}
```

Individual package engine ranges may remain broader when their runtime permits it. The complete
workspace development baseline is Node 22.12+ because CI, Docker builds and the production Server
runtime are standardized on Node 22; public setup documentation must recommend Node 22.12+.

> **Warning**: In `exports`, `"types"` must come **before** `"import"` and `"require"`. Putting it after causes a tsup/esbuild warning: "The condition 'types' here will never be used."

### tsconfig Split Pattern

Implemented tsup packages keep two tsconfig files (for IDE + typecheck):

| File                  | Purpose                                                |
| --------------------- | ------------------------------------------------------ |
| `tsconfig.json`       | IDE + `tsc --noEmit` typecheck                         |
| `tsconfig.build.json` | Kept for reference; tsup uses `tsconfig.json` directly |

`tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## peerDependencies

| Package               | peerDependencies                                              |
| --------------------- | ------------------------------------------------------------- |
| `@ptd/core`           | none                                                          |
| `@ptd/components`     | `@preact/signals-core: ^1`                                    |
| `@ptd/react-designer` | `react: >=19`, `react-dom: >=19`, `@preact/signals-react: ^3` |
| `@ptd/export`         | none                                                          |

Framework packages (react, preact) go in `peerDependencies`, not `dependencies`.

> **Host rule**: peer dependencies are not inherited transitively. Every app consuming
> `@ptd/react-designer` must declare `react`, `react-dom`, and `@preact/signals-react` itself.

### Headless PTD primitive packages

`@ptd/react-ui` is the store-agnostic home for PTD-styled React headless wrappers. Keep React and
React DOM as peer dependencies; Radix primitives and icon packages are runtime dependencies of the
wrapper package. The package must expose an explicit `./styles.css` subpath and keep all `--ptd-*`
tokens and component CSS inside the package.

```tsx
import { PtdSelect } from '@ptd/react-ui'
import '@ptd/react-ui/styles.css'

<PtdSelect
  label="纸张规格"
  value={pageSize}
  options={options}
  onValueChange={setPageSize}
  onOpenChange={(open) => (open ? beginGesture() : commitGesture())}
/>
```

Primitives emit only standard controlled events and must not import Store/history or mutate
`TemplateSchema`. The business host owns gesture/history and schema writes. When a PTD package bundles
`@ptd/react-ui` into another CSS-extracted package (currently `@ptd/react-designer`), use tsup's
`noExternal` for the UI package so the host keeps one public stylesheet entry; consumers of the
standalone UI package still import its own CSS subpath.

### Extracted CSS package export

React designer CSS is extracted by tsup and must be a public package subpath:

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./styles.css": "./dist/index.css"
  },
  "style": "./dist/index.css",
  "sideEffects": ["**/*.css"]
}
```

Consumers import it explicitly:

```ts
import '@ptd/react-designer/styles.css'
```

Do not enable runtime `injectStyle` for a CSS Modules package. Explicit CSS is compatible with
SSR/CSP, lets hosts control ordering, and avoids tsup/esbuild CSS Modules export mismatches.

The React designer must also preserve CSS Module default-export maps in its JavaScript output:

```ts
export default defineConfig({
  // ...shared options
  loader: {
    '.css': 'local-css',
  },
})
```

Use the `.css` key, not `.module.css`: tsup's CSS plugin forwards `loader['.css']` for every CSS
file it handles. Without `local-css`, the stylesheet may still be emitted while every imported
module map becomes `{}`, leaving the rendered UI without class names.

## Build Script Convention

Root `package.json` scripts run packages via pnpm filters. Public and contributor documentation uses
Corepack so the repository-declared pnpm version wins:

```bash
corepack pnpm build          # runs each workspace package/app's own build script
corepack pnpm dev            # builds Web dependencies, then watches them alongside apps/web
corepack pnpm dev:all        # same preparation, then watches packages + Web + Server
corepack pnpm typecheck      # runs each workspace's typecheck script
corepack pnpm lint           # ESLint across workspace
```

The Web development command must build `@ptd/core`, `@ptd/components`, and
`@ptd/react-designer` sequentially before starting their watchers and Vite. A Vite-only command
can consume missing or stale package `dist` output.

The root `dev:all` command must preserve the same dependency preparation and then include the
`server` workspace in the parallel `dev` run. Long-lived applications expose a common `dev` script
so the root can coordinate them without shell-specific background operators or an extra process
manager dependency. Root scripts that recursively invoke the package manager must call
`corepack pnpm`, not a bare `pnpm`, so a globally installed older pnpm cannot bypass the repository's
`packageManager` contract.

The same dependency order applies to clean CI typechecks. Workspace packages publish their type
entry from `dist/index.d.ts`, while `typecheck` uses `tsc --noEmit` and does not create that file.
CI must therefore typecheck and build each upstream package before typechecking its consumer
(`core` -> `components` -> `react-designer` -> `web`). Do not typecheck every package before the
first build; local ignored `dist` output can hide the resulting clean-runner resolution failure.

Individual package:

```bash
corepack pnpm --filter @ptd/core build
corepack pnpm --filter web dev
```

`core`, `components`, `export`, and `react-designer` build through tsup and test through Vitest.

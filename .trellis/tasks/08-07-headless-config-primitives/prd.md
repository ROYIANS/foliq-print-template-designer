# Headless 配置界面基础组件

## Goal

为 Foliq 设计器建立一套以成熟 headless 原语为交互基础、以现有 Foliq/PTD 视觉 token 为表现层的配置界面基础组件体系。目标是让 Property Inspector、页面设置、数据面板和后续配置界面共享同一套键盘、焦点、Portal、表单提交、禁用/锁定和响应式行为，同时避免再次依赖原生 select、color、popover 等控件导致 selection 丢失、弹层闪退或风格漂移。

## What I already know

* 用户建议后续优先做“配置界面基础组件使用 Radix 等成熟 headless 组件，并保持现有风格”。
* 项目当前产品定位是精密、可信、纸张/校样工具感的结构化文档设计器；UI token 已集中在 `ptdTheme`。
* `@ptd/react-designer` 已使用 Radix ContextMenu、ScrollArea、Separator、Tabs、Tooltip，但部分配置控件仍由业务面板直接拼装原生 input/select/button。
* 项目已有 `InspectorControls`、`PropertyInspector`、`AppBar`、`DataPanel`、`Sidebar`、`FloatingToolDock` 等可复用边界，后续应优先在这些边界上收敛，而不是一次性重写整个 Designer。
* RichText 工具条本轮已经证明：headless trigger + Portal/交互边界 + selection/focus 保存，是解决原生控件冲突的有效模式。
* `PropertyInspector` 的“文档页面设置”同时包含页面方向 `SegmentedInput`、纸张规格 `SelectInput` 和共享 `InspectorField`，业务逻辑相对集中；单对象布局/外观面板还叠加锁定、批量 history、颜色和大量数值字段；图片/二维码/条码内容面板则叠加校验和文件操作。

## Assumptions (temporary)

* 第一阶段优先统一配置界面控件契约，不改变 `TemplateSchema`、Store history 或导出 DOM。
* Radix UI 作为默认原语来源；项目中已有的成熟 headless 库可以继续使用，但不能引入带强视觉意见的完整 UI 框架。
* 新基础组件必须由 `@ptd/react-ui` 自有 CSS Modules + PTD theme token 负责视觉表现，原语只负责行为、可访问性和状态管理。

## Open Questions

* 无（待最终确认）

## Requirements (evolving)

* 建立统一的 headless 基础组件契约：Trigger、Content/Portal、focus-visible、Escape、outside click、disabled、locked、invalid、loading（适用时）和 `data-ptd-editor-interactive`/Portal 边界。
* MVP 第一切片先实现 `PtdField`、`PtdSelect`、`PtdSegmented`，并在 Property Inspector 的真实配置面板中试点；`PtdColorField` 作为第二切片，暂不与第一切片绑定交付。
* 基础组件以独立 workspace package 交付，Property Inspector 通过公开入口消费，避免把业务面板路径作为基础组件的长期 API 边界。
* 独立 workspace package 命名为 `@ptd/react-ui`，公开入口为 `src/index.ts`，使用 React peer dependencies、Radix primitives、tsup ESM/CJS/d.ts 和显式 CSS 子路径。
* 第一切片使用 `@radix-ui/react-select` 和 `@radix-ui/react-toggle-group`，由 `@ptd/react-ui` 提供 PTD 风格 wrapper；不自行重写 Select/ToggleGroup 的键盘和 ARIA 核心模型。
* 第一切片迁移 `PropertyInspector` 的“文档页面设置”面板：页面方向使用 `PtdSegmented`，纸张规格使用 `PtdSelect`，字段布局使用 `PtdField`；保留自定义尺寸条件渲染和现有 Store history 行为。
* `PtdField` 只负责 label/layout/状态壳层；现有文本和数字输入（包括 scrub、Escape cancel、范围校验和 history 行为）在第一切片继续使用，不新增 `PtdTextInput` 或 `PtdNumberInput`。
* `@ptd/react-ui` 完全与 Store/history 无关；`PtdSelect`/`PtdSegmented` 只发出标准受控交互事件，`PropertyInspector` 适配层负责 gesture/history 和 Schema 更新。
* 边界策略采用 fail-closed：disabled/locked 不可打开，打开后变为 disabled 立即关闭；空 options 显示不可用状态；未知受控值保留原值并显示 fallback/placeholder，不自动改值或触发额外更新。
* 默认主题保持现有 Foliq/PTD 风格；token 命名和主题根节点保留未来增加主题变体的扩展点，但本 MVP 不交付主题切换 UI 或运行时主题管理器。
* MVP 仅交付默认主题样式；主题根节点和 `--ptd-*` token 作为后续主题变体的稳定扩展点，不新增 ThemeProvider 或切换状态。
* 保持现有暖纸灰、暖石墨、档案墨蓝、校样朱红 token 和紧凑工作台密度；不引入 Tailwind、CSS-in-JS 或大面积玻璃/渐变。
* 组件 API 使用显式 TypeScript union、稳定 `data-ptd-*` 属性和受控/非受控状态边界。
* 配置控件不直接写模板导出状态；业务层仍负责 Schema/Store 读写，基础组件只负责交互和显示。
* 为每个迁移控件提供键盘与真实 Chromium smoke 验证。

## Acceptance Criteria (evolving)

* [ ] 第一切片的 `PtdField`、`PtdSelect`、`PtdSegmented` 在“文档页面设置”真实配置面板中落地，并通过现有视觉 token 渲染。
* [ ] `PtdSelect` 和 `PtdSegmented` 支持键盘、Escape、outside click、focus-visible、disabled/locked 和受控/非受控状态；ColorField 的 Popover/颜色交互在第二切片验收。
* [ ] Portal 内容在 Designer 根节点、画布、Inspector 和 compact overlay 中都可见、可点、可键盘操作。
* [ ] 配置控件不会写入打印/导出 DOM，也不会产生额外模板历史节点。
* [ ] 1600×1000、1366×768、1024×768 与 compact 容器下无不可达横向滚动；200% 浏览器缩放仍可操作。
* [ ] typecheck、lint、Vitest、包构建和真实 Chromium smoke 全部通过。

## Definition of Done

* 基础组件 API、视觉 token、交互边界和迁移示例有文档记录。
* 至少一个 Inspector 配置面板完成迁移并保留行为 parity。
* 新增/更新单元测试、组件契约测试和浏览器 smoke。
* 不修改用户已有的 Canvas/output DOM 合同，且明确记录 out-of-scope。

## Out of Scope (explicit)

* 本阶段不重做整个 Designer 的布局，不改 Canvas 绘制模型，不改 TemplateSchema 数据结构。
* 不引入新的完整 UI 组件库或全局主题系统。
* 不在没有迁移验收的情况下批量替换所有原生 input；普通文本/数字输入是否保留原生语义待后续决策。
* 不处理 Docker、PostgreSQL 或导出后端。

## Technical Notes

* Applicable specs: `.trellis/spec/monorepo/ptd-ui-system.md`, `package-conventions.md`, `typescript-conventions.md`, `styling-conventions.md`, `cross-layer-thinking-guide.md`。
* Existing Radix dependencies are declared in `packages/react-designer/package.json`: ContextMenu, ScrollArea, Separator, Tabs, Tooltip。
* Candidate migration surfaces: `packages/react-designer/src/components/PropertyInspector/`, `InspectorControls.tsx`, `DataPanel/`, `AppBar/`, and current ContentEditor headless toolbar patterns。
* New research findings will be recorded under `research/` before selecting the first implementation slice.

## Implementation Notes

* `packages/react-ui/` now provides `@ptd/react-ui` with PTD theme tokens, CSS Modules and public `./styles.css`.
* `PtdField`、`PtdSelect`、`PtdSegmented` are implemented with Radix Select/ToggleGroup wrappers; the package is store-agnostic and filters invalid empty option values fail-closed.
* `packages/react-designer` bundles `@ptd/react-ui` so its existing `./styles.css` remains the single host CSS entry for Designer hosts, while the new package remains independently consumable.
* `PropertyInspector` page settings now use the new Select/Segmented primitives; text/number inputs and existing history code remain in `InspectorControls`.
* Verification completed: `@ptd/react-ui` 4 tests, React Designer 24 files/163 tests, workspace lint/typecheck/build, and real Chrome smoke against `http://localhost:5173` covering Select open/option selection, custom page size and landscape ToggleGroup state.
* Select regression coverage now drives the real Radix keyboard contract (ArrowDown/Enter), verifies themed Portal content, outside-click/Escape dismissal, and asserts that a page-size selection creates exactly one undoable history step.

## Research References

* [`research/radix-headless-adoption.md`](research/radix-headless-adoption.md) — Radix Select/Popover accessibility, Portal/focus contracts and adoption options mapped to this repository.

## Research Notes

### Feasible approaches

**Approach A: 增量式基础组件层**（推荐）

建立 PTD 自有的 `Primitives`/`ui` 包装层，先迁移一个 Inspector 面板，再逐步扩展。保留原生文本/数字输入等语义合适的控件，优先替换会抢焦点、需要 Portal 或复杂键盘模型的控件。

**Approach B: Inspector 一次性重写**

一次迁移所有 Property Inspector 控件。结果集中，但回归面大，Portal、Schema 写入和 compact overlay 问题会混在一起。

**Approach C: 全局控件替换**

全仓库批量替换原生控件。视觉收敛最快，但风险最大，不适合作为第一步。

## Decision (ADR-lite)

**Context**: 当前项目已有 Radix ContextMenu、ScrollArea、Separator、Tabs、Tooltip，但配置面板仍存在重复的原生控件和局部交互实现；富文本迁移已经暴露 selection、Portal 和 focus 边界问题。

**Decision**: 采用 Approach A，并将 PTD 风格的 headless primitive wrapper 放入独立 workspace package；第一切片交付 Select/Combobox、Segmented ToggleGroup 和共享 Field shell，在 Property Inspector 试点；Popover ColorField 作为第二切片。

**Consequences**: 可以用较小切片验证行为 parity 和视觉一致性，并保留回滚路径；短期会存在新旧控件并存，需要通过组件契约和迁移清单防止第三套样式产生。普通 text/number input、file input、Canvas 和 ContentEditor 不纳入第一批全局替换。

## Confirmed Decisions

* MVP 采用“Inspector 基础控件试点”：第一切片先实现 `PtdField + PtdSelect + PtdSegmented`，在 Property Inspector 的真实配置面板中验证 wrapper 契约、视觉 token、键盘、Portal 和 history parity；`PtdColorField` 延后到第二切片。
* 基础组件不放在 `PropertyInspector/` 内部，而是新建 `@ptd/react-ui` workspace package；第一切片先由“文档页面设置”面板消费。
* 第一切片的具体迁移路径确定为 `PropertyInspector` 的“文档页面设置”面板。
* 主题由 `@ptd/react-ui` 持有基础 token 与组件样式，`@ptd/react-designer` 消费其显式 CSS 入口；Radix 只提供无样式交互原语。
* 第一切片保留原生文本/数字输入，仅迁移 Field shell、Select 和 Segmented；扩大输入替换范围需要新的需求确认。
* history 决策：primitive 不接收 history adapter，不调用 `beginGesture`/`commitGesture`/`cancelGesture`，业务层显式编排这些生命周期。
* 边界决策：组件不通过自动回退或首项选择修复业务数据，异常值由宿主决定如何提示或修正。
* 第一切片 headless 依赖决策：采用 Radix Select + Radix ToggleGroup，Popover/ColorField 等其他原语延后到后续切片按需引入。

# Headless 颜色控件全量迁移

## Goal

把 Property Inspector 中剩余的颜色入口统一迁移到 `@ptd/react-ui` 的 `PtdColorField`，彻底移除这些业务面板对原生 `input[type=color]` 和旧 `InspectorColorControl` 的依赖。页面设置、单对象、表格、二维码、条形码和多选样式使用同一套 PTD 风格 HSV/HEX/色板交互，同时保持各自已有的锁定、混合值、取消、批量更新和 history 语义。

## What I already know

- 第一个 headless 切片已交付 `PtdField`、`PtdSelect`、`PtdSegmented`，第二个切片已交付完整 `PtdColorField`。
- 页面设置中的“纸张颜色”和“默认文字”已经使用 `PtdColorField`，并通过真实 Chromium smoke 验证。
- `PropertyInspector.tsx` 仍有 7 个旧 `ColorInput` 使用点，覆盖单对象外观、二维码、条形码和多选样式。
- `TableContentFields.tsx` 仍通过旧 `InspectorColorControl` 别名提供表格文字、背景和边框颜色。
- 旧 `InspectorColorControl` 内部包含原生 `<input type="color">`，以及一套与 `PtdColorField` 重复的 HEX/色板/Portal 逻辑。
- `PtdColorField` 是 Store/history-agnostic；宿主必须负责 gesture、transient update、commit/cancel、Schema 更新和最近颜色记录。
- 当前颜色业务合同只接受六位 HEX 或 `transparent`；混合值通过 `value={null}` 和 placeholder 表达，不自动覆盖混合值。

## Requirements

- 将单对象外观的文字、背景、边框颜色迁移到 `PtdColorField`。
- 将二维码前景/背景颜色迁移到 `PtdColorField`。
- 将条形码前景/背景颜色迁移到 `PtdColorField`。
- 将多选样式文字颜色迁移到 `PtdColorField`，保留混合值 placeholder 和批量样式更新。
- 将表格文字、背景、边框颜色迁移到 `PtdColorField`，保留表格批量 cell patch 的 gesture/history 行为。
- 按现有字段语义设置 `allowTransparent`、`defaultValue`、`disabled`、`locked`、`placeholder` 和 `wide`。
- 统一使用 `onOpenChange` 建立/提交宿主 gesture；`onCancel` 必须调用既有 cancel handler；颜色变化只走宿主 transient update。
- 已提交的合法颜色继续调用 `recordRecentColor`；最近颜色和文档颜色不写入 Schema/history。
- 删除旧颜色控件在本迁移范围内的业务消费和重复样式；若旧实现仍被范围外代码使用，保留其导出但明确不再新增使用点。
- 不修改 `TemplateSchema`、导出 DOM、颜色数据格式、Docker 或 PostgreSQL。

## Acceptance Criteria

- [ ] Property Inspector、TableContentFields 中本切片范围内不再渲染原生 `input[type=color]`。
- [ ] 单对象、表格、二维码、条形码和多选样式的颜色字段均渲染 `PtdColorField` 的 HSV/HEX/色板面板。
- [ ] 锁定对象不可打开颜色面板，打开后进入锁定状态会立即关闭。
- [ ] 单对象与多选颜色连续编辑最多产生一个 history node；Escape 不产生提交 history，undo/redo 值保持 parity。
- [ ] 表格批量颜色编辑仍只产生一个批量 gesture，取消恢复编辑前 cell 样式。
- [ ] 混合颜色显示既有 placeholder，打开并输入/选择新色后才应用到全部目标对象。
- [ ] 颜色选择后页面、对象、表格、二维码和条形码的 recent/document palette 派生仍正确，且 UI 状态不进入 Schema/history。
- [ ] 新增/更新 React Designer 测试覆盖所有迁移面板的渲染、取消、history 和批量更新边界。
- [ ] `@ptd/react-ui`、`@ptd/react-designer` 测试、typecheck、build，仓库 lint/typecheck/build 全部通过。
- [ ] 使用真实 Chromium smoke 验证至少一个单对象颜色、一个表格颜色和一个二维码/条形码颜色的打开、HSV 取色、HEX 输入、Escape/outside click 和提交行为。

## Definition of Done

- 所有范围内颜色入口使用统一的 `PtdColorField` 和 PTD Portal/CSS Modules 风格。
- 业务层仍是唯一的 Store/history/Schema 适配边界。
- 旧原生颜色入口在范围内清零，并有回归测试防止重新引入。
- 规范文档补充全量迁移后的宿主 gesture 和混合值约定。
- 代码完成 Trellis quality check，并准备好分组提交。

## Technical Approach

先梳理旧 `InspectorColorControl` 每个使用点的 `onStart`/`onFinish`/`onCancel`/`onValue` 语义，按宿主面板拆成 `PtdColorField` 的标准事件边界；不在 `@ptd/react-ui` 增加 Store 适配器。对于表格和多选，使用现有 patch/update 函数承接 `onValueChange`，由打开/关闭边界管理一次批量 gesture。`allowTransparent` 只在原属性允许透明的字段开启；混合颜色以 `null` 受控值和原 placeholder 传入，面板内部使用安全 fallback 进行可视化但不自动写回。

## Decision (ADR-lite)

**Context**: 页面设置已证明 `PtdColorField` 能解决原生颜色控件的焦点、Portal 和风格不一致问题，但其它 Inspector 面板仍保留旧实现，造成两套交互并存。

**Decision**: 采用增量全量迁移：复用已验证的 `PtdColorField`，只在各业务宿主补齐事件适配和测试；不为旧控件增加新的功能分支，也不引入第二套颜色 primitive。

**Consequences**: 颜色交互和视觉行为统一，后续可安全删除旧颜色控件；本切片会触及多种面板的批量 history 逻辑，需要重点验证混合值、表格 cell patch 和取消回滚。

## Out of Scope

- `PtdNumberField`、`PtdMetricField`、`PtdTextField` 和 `PtdTextArea` 的新建或迁移。
- Data Panel、AppBar 或其它非 Inspector 配置界面的原生输入迁移。
- 新增 alpha 数值/八位 HEX、颜色格式扩展或 TemplateSchema 改动。
- 主题切换运行时、Radix Themes、ThemeProvider、Tailwind、CSS-in-JS。
- Docker/Compose 测试和 PostgreSQL 调整。

## Technical Notes

- 主要文件：`packages/react-designer/src/components/PropertyInspector/PropertyInspector.t sx`、`TableContentFields.tsx`、`InspectorControls.tsx`。
- 复用组件：`packages/react-ui/src/ColorField.tsx` 及其 `PtdColorFieldProps`。
- 相关测试：`property-inspector-headless.test.tsx`、`inspector-colors.test.ts`、表格/二维码/条形码相关测试。
- 需要在提交前运行仓库级 lint、typecheck、build 和真实 Chromium smoke；不运行 Docker。

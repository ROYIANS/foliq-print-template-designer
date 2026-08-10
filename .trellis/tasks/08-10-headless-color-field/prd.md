# Headless PtdColorField 第二切片

## Goal

在 `@ptd/react-ui` 增加一个不依赖 Store/history 的 PTD 风格颜色字段，并把 Property Inspector 的“文档页面设置”中的“纸张颜色”和“默认文字颜色”迁移到该 primitive。颜色面板需要在 Designer 的根节点焦点管理下仍可稳定交互，同时保持现有 Foliq 暖纸灰、暖石墨、档案墨蓝、校样朱红视觉语言。

## Requirements

- 新增公开的 `PtdColorField`，使用 Radix Popover 负责 Portal、焦点、Escape 和 outside-click 行为。
- 支持受控 `value`，以及 `label`、`defaultValue`、`disabled`、`locked`、`wide`、`allowTransparent`、`recentColors`、`documentColors`、`open`/`defaultOpen` 等字段能力。
- Trigger 可聚焦；Enter/Space 打开，Escape 关闭；打开后按 Escape 恢复打开前颜色；outside click 关闭。
- Popover Content 应用 `ptdThemeClass`，并标记 `data-ptd-editor-interactive="true"`；内容区域点击不能被 Designer 根节点抢焦点。
- disabled/locked 时不能打开；已打开后状态变为 disabled/locked 时立即关闭。
- 颜色面板采用自有的 HSV 取色器：饱和度/明度二维面板 + 色相滑条；保留最近颜色、文档颜色、主题色、标准色和 HEX 文本输入。不以原生 `input[type=color]` 作为主要入口。
- HEX draft 只有通过合法校验后才触发 `onValueChange`；非法 draft 显示错误且不写入业务值。保留未知受控值，不自动纠正外部数据。
- `transparent` 仅在 `allowTransparent` 时可用；reset 是明确的 `onReset` 动作。
- primitive 只发出标准受控事件，不导入 EditorStore/history、不写 TemplateSchema。
- 页面设置业务层负责 `beginGesture`/transient update/`commitGesture`/`cancelGesture`，并将已提交颜色写入 `recordRecentColor`；recent/document colors 不进入 Schema/history。
- 页面设置中两个颜色字段的连续编辑最多产生一个 history 节点；undo/redo 分别恢复打开前/已提交颜色。
- 现有其他面板使用的 `InspectorColorControl` 暂时保留，不在本切片迁移单对象、表格、二维码或条形码颜色控件。

## Acceptance Criteria

- [ ] `PtdColorField` 从 `packages/react-ui/src/index.ts` 导出，且 standalone build 产物包含 CSS。
- [ ] primitive 测试覆盖键盘打开、Escape 回滚、outside click、Portal theme/interactive 标记、禁用锁定、合法/非法 HEX、transparent/reset、最近色/文档色和未知受控值。
- [ ] Property Inspector 页面设置只使用 `PtdColorField` 渲染纸张颜色与默认文字颜色，保留现有标签、默认值和恢复默认语义。
- [ ] 页面设置 history parity 测试证明一次连续颜色手势只产生一次 history，取消不产生 history，undo/redo 值正确。
- [ ] `@ptd/react-ui` 与 `@ptd/react-designer` 的测试、typecheck、build 通过；仓库 lint/typecheck/build 通过。
- [ ] 使用已启动的 `http://localhost:5173` 完成真实 Chromium smoke，确认面板可打开、色板/HEX/关闭交互可用；Docker 测试跳过。

## Definition of Done

- 新代码遵循 monorepo TypeScript、CSS Modules、PTD UI System 和包导出约定。
- 新增/更新测试覆盖正常路径和边界行为。
- 依赖变更只包含 Popover 所需依赖及 lockfile 对应更新。
- 代码经过 Trellis quality check，并准备好单独的工作提交。

## Technical Approach

`PtdColorField` 由 `PtdField` 包裹，内部使用 `@radix-ui/react-popover`。Trigger 展示 swatch + 当前值；Content 采用分组布局：HSV 取色器、HEX 输入、最近颜色、文档颜色、主题色、标准色、透明/恢复默认动作。颜色规范化与校验保存在 primitive 内部，仅对合法值发出 `onValueChange`。打开时保存 `value` 快照，Escape/cancel 回调恢复快照；业务宿主在 `onOpenChange` 边界建立 history gesture。

页面设置迁移复用现有 `inspectorColors.ts` 的文档颜色派生与 `EditorStore.recordRecentColor`，不复制这些状态逻辑。旧 `InspectorColorControl` 继续服务尚未迁移的面板。

## Decision (ADR-lite)

**Context**: 原生颜色输入和下拉控件受 Designer 根节点事件及浏览器焦点行为影响，且需要统一 Portal/theme 边界。

**Decision**: 用 Radix Popover + PTD 自有 CSS Modules 实现 HSV 取色器 + palette + HEX。取色器采用原生 Pointer/Keyboard 事件，避免引入带视觉意见的 spectrum 库；常用颜色走 swatch，任意颜色可通过二维面板或 HEX 精确输入。

**Consequences**: 依赖和实现更小、交互可测试且风格统一；高级 HSV 选色留待后续切片，业务层仍可在不改变 primitive API 的前提下扩展。

## Out of Scope

- 单对象外观、表格、二维码、条形码等其他颜色控件迁移。
- 系统原生颜色对话框和 alpha 数值写入（当前 Schema 颜色合同只接受六位 HEX 或 transparent）。
- recent colors 持久化、TemplateSchema 字段扩展、主题切换运行时。
- Docker/Compose 测试和 PostgreSQL 调整。

## Technical Notes

- Primitive: `packages/react-ui/src/ColorField.tsx`、`primitives.module.css`、`index.ts`。
- Host migration: `packages/react-designer/src/components/PropertyInspector/PropertyInspector.tsx` 与现有页面配置测试。
- Existing color derivation: `packages/react-designer/src/components/PropertyInspector/inspectorColors.ts`。
- Existing session-only recent color API: `packages/react-designer/src/state/editor.ts`。
- `@ptd/react-ui` package currently depends on Radix Select and ToggleGroup; Popover is the only new runtime dependency.

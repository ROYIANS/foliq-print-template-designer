# Radix Popover 与颜色字段研究

## Radix Popover contract

当前项目已经使用 Radix Select/ToggleGroup，并把 Portal Content 应用 `ptdThemeClass` 与 `data-ptd-editor-interactive="true"`。Radix Popover 提供同样的受控 `open`/`onOpenChange`、`Popover.Trigger`、`Popover.Portal`、`Popover.Content`、Escape dismissal 和 outside-pointer dismissal；Content 的 `onOpenAutoFocus`/`onCloseAutoFocus` 可在需要时保留触发器焦点。Popover content 是 Portal，因此主题 class 和 Designer 交互边界必须显式放到 Portal 节点上，而不能依赖祖先 DOM 继承。

## Keyboard model

Trigger 使用真正的 button，由 Radix 处理 Enter/Space 打开。打开后 Escape 关闭并把焦点交还 Trigger；触发器 disabled 时 Radix 不应打开。业务 primitive 在打开时保存当前值快照，Escape/cancel 通过受控事件通知宿主恢复；这使恢复动作和 history gesture 边界由业务层决定，而不是让 primitive 修改 Schema。

## Color input

自有 HSV 取色器（饱和度/明度二维面板 + 色相滑条）提供连续取色，主题/标准/最近/文档 swatches 提供快速选择，HEX 输入覆盖精确输入，不需要额外的 spectrum 依赖。二维面板和色相滑条必须同时支持 pointer 与键盘方向键。HEX draft 应在输入阶段保持本地字符串，提交时接受 `#RGB`、`#RRGGBB`（带 alpha 不写入当前 Schema 合同），统一为小写 6 位 HEX；非法 draft 只显示错误，不发出 `onValueChange`。`transparent` 和 reset 是独立动作，避免把空字符串或未知值误解释成颜色。

## Repo mapping

- `@ptd/react-ui` package owns the component API and CSS; it must not import `EditorStore` or history.
- Property Inspector owns gesture/history and calls `recordRecentColor` after a committed valid color.
- The old native `InspectorColorControl` remains for panels outside this migration.

## Version note

`@radix-ui/react-popover` latest metadata on 2026-08-10 reports `1.1.23`; the workspace will pin the dependency using the repository's existing pnpm lockfile workflow.

# `@ptd/react-designer`

Foliq 的 React 专业编辑器。它把 `@ptd/core` 的模板模型和 `@ptd/components` 的 DOM 渲染器组合成可嵌入的 Canvas-first 工作区。

> v2 package 当前只在本仓库 workspace 中使用，尚未发布到 npm。

## 使用

```tsx
import { useState } from 'react'
import { Designer, type RenderContext, type TemplateSchema } from '@ptd/react-designer'
import '@ptd/react-designer/styles.css'

export function Editor({ initialValue }: { initialValue: TemplateSchema }) {
  const [value, setValue] = useState(initialValue)
  const [saving, setSaving] = useState(false)
  const renderContext: RenderContext = {
    data: [{ orderNo: 'CC-2026-0815' }],
    record: { orderNo: 'CC-2026-0815' },
    recordIndex: 0,
    locale: 'zh-CN',
    timeZone: 'Asia/Shanghai',
    now: '2026-08-01T02:00:00.000Z',
    mode: 'proof',
  }

  return (
    <Designer
      value={value}
      onChange={setValue}
      renderContext={renderContext}
      host={{
        document: {
          id: 'template-42',
          title: '出库交接单',
          version: 3,
          status: saving ? 'saving' : 'dirty',
        },
        commands: {
          new: {},
          open: {},
          save: { pending: saving },
          saveAs: {},
          versionHistory: {},
          importTemplate: {},
          exportTemplate: {},
        },
        onCommand: async (command, context) => {
          if (command === 'save') {
            setSaving(true)
            try {
              await saveTemplate(context.template)
            } finally {
              setSaving(false)
            }
          }
          // New/Open 由 Host 完成确认、路由或 API，然后更新受控 value。
        },
      }}
    />
  )
}
```

Host 需要为设计器提供一个具有明确高度的容器，并显式加载 `styles.css`。React 19、React DOM 和 `@preact/signals-react` 是 peer dependencies，使用方必须自行声明。

### 只读模板预览

需要在 Host 的文件列表中展示真实模板内容时，可使用同一公共包中的只读预览：

```tsx
import { TemplatePreview } from '@ptd/react-designer'
;<TemplatePreview template={template} pageIndex={0} label="出库交接单预览" />
```

`TemplatePreview` 复用 Canvas 的真实 `ComponentRenderer`，按容器等比缩放一个手工页面。它不提供
选择、编辑、历史、HTTP、缓存或位图缩略图生成；Host 负责取得 `TemplateSchema`。越界 `pageIndex`
会收敛到有效页面，组件 DOM 对可访问树隐藏，由外层单一 `role="img"` 提供名称。

默认 Preview 只渲染模板保存的静态内容，不会自动选择示例记录，也不会继承当前 Editor 的临时校样。
只有 Host 明确传入 `renderContext` 时才解析绑定：

```tsx
;<TemplatePreview template={template} renderContext={renderContext} label="出库交接单数据校样" />
```

## `DesignerProps`

```ts
export interface DesignerProps {
  value: TemplateSchema
  onChange?: (value: TemplateSchema) => void
  host?: DesignerHost
  renderContext?: RenderContext
}
```

| 属性            | 约定                                                                      |
| --------------- | ------------------------------------------------------------------------- |
| `value`         | 必填。Host 持有的模板真值；外部替换时编辑器会同步。                       |
| `onChange`      | 模板命令产生新值时通知 Host；交互 UI 状态不会触发。                       |
| `host`          | 可选。统一承载文档元数据、应用命令能力、异步状态和应用命令处理器。        |
| `renderContext` | 可选。Host 临时运行时数据与确定性 locale/timeZone/now；不会自动写入模板。 |

旧的 `onSave` / `onLoad` 已被统一 Host 合同替代，也不会继续增加 `onExport` 或
`onDataSource` 顶层回调。打开或新建完成后，Host 更新受控 `value`；Designer 不直接载入 API 记录。

`renderContext` 是受控渲染输入，不属于命令式 `DesignerHost`。更新它、切换校样模式或切换样例记录都只
改变当前 Designer 实例的派生视图，不触发 `onChange`，不增加 History，也不令 Host 文档变 Dirty。
Designer 在没有 Host context 时使用稳定的 Foliq 默认校样环境 `zh-CN` / `Asia/Shanghai`，并在实例
创建时固定 `now`；面向其他地区的 Host 应始终显式传入 locale、timeZone 和 now，Core 不读取浏览器环境
或系统时钟来求值。

### Host 应用命令

```ts
interface DesignerHost {
  document?: {
    id?: string
    title?: string
    version?: string | number
    status: 'clean' | 'dirty' | 'saving' | 'loading' | 'error' | 'conflict'
    message?: string
  }
  commands?: Partial<
    Record<DesignerHostCommandId, { enabled?: boolean; pending?: boolean; reason?: string }>
  >
  onCommand?: (
    command: DesignerHostCommandId,
    context: { template: TemplateSchema; document?: DesignerDocumentState },
  ) => void | Promise<void>
  onCommandError?: (command: DesignerHostCommandId, error: unknown) => void
}
```

- `commands` 中出现某个 ID 表示 Host 声明该能力；未出现的命令显示为“功能待接入”并禁用。
- `enabled` 默认为 `true`；`pending` 会禁用重复触发；`reason` 用于说明只读、冲突等不可用原因。
- Promise 执行期间 Designer 还会维护实例级 Pending，避免 Host 状态更新前的连续双击。
- `Ctrl/Cmd+S/N/O` 与 `Ctrl/Cmd+Shift+S` 只在相应 Host 命令当前可执行时拦截。
- `onCommand` 收到的是执行时的最新 `TemplateSchema`，不是网络记录、Session 或 Token。
- New/Open/Save/Save As/Version History/Restore 的确认、API、错误提示、冲突处理和路由均由 Host 负责。
- File → Version History 只分发 `versionHistory` Host intent；历史列表、真实快照预览、恢复确认和
  `expectedVersion` 属于 Host，不进入 Designer package。
- File → Import/Export Template JSON 只分发 `importTemplate` / `exportTemplate` Host intent。导出上下文
  是包含未保存编辑的最新 `TemplateSchema`；本地文件读写、Core 序列化/反序列化、大小与版本校验、
  未保存替换保护，以及将导入结果标记为无服务端 ID 的新文档，均由 Host 负责。它与 Data Panel 的
  示例数据 JSON 导入是两种不同工作流。
- 当前公共 Host ID 还覆盖模板浏览器、版本历史/恢复、模板导入导出、预览、打印、文档导出与帮助入口；
  `DESIGNER_HOST_COMMAND_IDS` 可用于建立穷尽映射。

## 已实现交互

- 选择、多选、框选、拖动、缩放和旋转。
- 锁定、组合、图层、复制、剪切和定位粘贴。
- Undo/Redo、右键菜单和键盘菜单。
- 标尺 hover 预览、点击固定、彩色参考线和距离 badge。
- 默认毫米、可切换 PTD Canvas px 的实例级显示单位；Inspector、标尺、参考线与状态读数同步切换。
- Typed Inspector、mixed value 和数值 label scrub。
- Page、Single 与 Table 业务面板统一组合 `InspectorControls`，原生 input/select/textarea/color 仅作为
  控件内部实现细节；数值、度量、文本、长文本、小枚举、长枚举、文件和颜色使用各自适合的交互。
- 颜色控件支持三位/六位 HEX 精确输入、透明色、恢复默认、实例级最近颜色和模板派生文档颜色；
  色板临时状态与最近颜色不会写入模板或历史。
- 越界或不完整数值草稿保持在控件本地并显示可访问错误，不会静默夹紧或写入 Schema；Escape
  恢复本次编辑的精确起点。
- 模板级页面标题、纸张预设/自定义尺寸、方向、四边内容安全区、纸张颜色和默认排版设置。
- 页面缩小后保留组件几何，并以派生警告与画布标记提示越界对象。
- 多页面新增、复制、删除与排序。
- 文本、富文本、图片、编码、自由表格和基础图形的工具式拖框创建。
- 普通文本与富文本画布内编辑；富文本选区工具栏支持段前/段后间距和首行缩进，按 PTD 画布 px
  持久化并跟随 mm/px 显示单位换算；图片、二维码和条形码使用专用内容 Inspector。
- 富文本 Inspector 不暴露 HTML 源码输入框；选区级内容与格式在画布内工具栏维护，Inspector 只处理
  组件框级默认样式。
- 自由表格单元格拖选、双击纯文本编辑、键盘导航、行列增删与尺寸拖动、合并拆分和单元格排版。
- Hand Tool 与按住 Space 的临时抓手。
- 位置稳定的高频 Tool Dock、文本/图形工具组，以及带搜索、最近使用和键盘导航的完整组件 Picker。
- 页面、图层、数据与素材资源面板；素材面板当前提供真实图片框入口，资产持久化留待后续阶段。
- 数据面板支持拖入、选择或在专用表面粘贴 JSON；先复用 Core 上限、校验与字段推断展示记录数、
  字段数、体积、深度和诊断，只有明确“应用字段与样例”才产生一次模板变更。失败与超限输入保留草稿，
  不会静默替换字段模型。
- 可搜索的嵌套字段树显示名称、路径和值类型；字段显示名和类型相关默认格式可原位编辑，同时保持
  字段 ID/path 稳定。导入替换会说明保留与失效引用数量，失效绑定保留为可诊断信息而不被删除。
- 当前单选组件的绑定能力只来自 Core Registry。普通文本提供 literal 与多个 field token 的结构化
  组合编辑；富文本、图片、二维码、条形码和自由表格活动单元格支持直接字段绑定。锁定、多选、无选择、
  未选表格单元格和不支持组件均有明确状态，完整点击/键盘路径不依赖拖拽。
- “设计内容 / 数据校样”和样例前后切换属于实例 UI 状态，不触发 `onChange` 或 History。Host
  `renderContext` 优先于模板样例且默认永不持久化；移除样例会保留字段与组件绑定。
- wide / standard / compact 响应式工作区。

组件目录按文本、表格、图像、编码、图形分组。画布中的“更多组件”Picker 只展示 `available`，
不会把 `planned` 能力伪装成禁用工具；规划项仍保留在 Catalog 元数据和产品文档中。
`RoyComplexTable` 只保留旧模板 Renderer，目录中作为规划能力展示；完整结构表格要等待数据绑定、
重复明细和派生分页合同，不冒充已经可创作的报表引擎。

## 状态与集成边界

Designer 内部持有交互状态和命令历史，但模板持久化的所有权在 Host：

```text
Host value ──► Designer store ──► 用户命令
    ▲                              │
    └──────── onChange ────────────┘

Host document + commands ──► Designer intent ──► Host application

Host RenderContext ──► proof UI state ──► Core binding resolution ──► derived component view
```

- Host 负责 API、保存状态、错误提示、冲突处理和身份信息。
- Designer 的 Host 合同不包含 HTTP、Cookie、Better Auth、数据库记录或路由类型。
- Designer 不应直接 import `apps/web` 或 `apps/server`。
- 外部 `value` 同步必须避免把纯 Host 回显制造成新的用户历史。
- 外部 `value` 替换会退出当前校样并修复记录索引；受控 `renderContext` 本身仍由 Host 持有。
- 示例记录来自 `normalizeTemplateData(value)`；Host 临时数据不会因校样或 Preview 被持久化。
- 字段、样例和组件绑定命令会在显式编辑边界 canonicalize 旧 `dataSource/dataSet`；只读打开、字段搜索、
  展开树、导入预检和校样不会偷偷迁移模板。真正的外部 `value` 替换会清理尚未应用的导入/字段草稿，
  Designer 内部字段或绑定提交不会打断仍在进行的面板工作流。
- `TemplateSchema.pages` 是持久化的手工页面；自动溢出页是未来导出层的派生数据。

详细命令、历史和同步约束见 [React Designer Contract](../../.trellis/spec/monorepo/react-designer-contract.md)，视觉与交互契约见 [PTD UI System](../../.trellis/spec/monorepo/ptd-ui-system.md)。

## 开发与验证

```bash
corepack pnpm --filter @ptd/core build
corepack pnpm --filter @ptd/components build
corepack pnpm --filter @ptd/react-designer typecheck
corepack pnpm --filter @ptd/react-designer test
corepack pnpm --filter @ptd/react-designer build
```

样式使用 CSS Modules，并由 tsup 提取为公开的 `./styles.css` subpath。不要改成运行时注入，也不要从 package 内部路径导入未公开模块。

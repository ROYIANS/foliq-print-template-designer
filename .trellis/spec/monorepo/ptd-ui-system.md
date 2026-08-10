# PTD UI 系统规范

> 适用于 `@ptd/react-designer` 及其宿主应用中的编辑器工作区。规范来源于 PTD Legacy
> 的真实操作结构、Workshop 高密度工具台规范、Vidorra Blueprint 的“结构即装饰”方法，
> 以及当前 React 架构约束；它不是营销站设计规范，也不要求复制任何第三方产品外观。

## 1. Design Context

### 目标用户

- 在企业内部配置出库单、标签、票据、报表和业务打印模板的实施、运营与开发人员。
- 用户通常在桌面浏览器中连续工作，重视精确、效率、可预测性和键盘操作。
- 用户可能不了解组件 Schema，但熟悉纸张、字段、层级、对齐、数据源和打印预览。

### 核心任务

1. 从组件库创建文本、图形、图片、条码、二维码和表格。
2. 在真实纸张尺度上完成选中、移动、缩放、旋转、对齐、组合和层级调整。
3. 编辑组件属性、页面设置和数据字段绑定。
4. 通过结构树理解复杂模板，并可靠撤销误操作。
5. 在导出或保存前确认模板的页面边界、数据内容和最终视觉结果。

### 品牌语气

产品对外品牌名为 **Foliq**，默认中文类别说明为“结构化文档设计器”；`PTD` 继续作为内部工程代号、
包命名空间和稳定技术前缀。用户可见文案不得再把 `PTD` 当作产品品牌，也不得为了品牌迁移修改
`@ptd/*`、`--ptd-*`、`data-ptd-*`、MIME、环境变量或数据合同。

Foliq 是一张数字化的制版工作台：**精密、轻快、可信，带有纸张与校样工具的触感**。品牌核心定位
是“不是设计一张图，而是定义一种文档”；对外完整描述为“面向打印与出版的专业结构化文档设计器”。

- 主体是与落地页一致的暖纸灰与近中性暖石墨；`#f5f5f3` 是跨官网与工作台的标准暖灰基准，
  纯白只保留给模板纸张和需要清晰抬升的局部表面，不铺满整个界面。
- 当前品牌单元只使用 Cherry Bomb One 的 `Foliq` 字标，不再复用 Legacy P 图形，也不以临时单字母块、
  Emoji 或套准符号补位；未来如增加独立图形 Logo，必须通过单独品牌批次确定。
- 克制的档案墨蓝用于主要操作、选中、焦点和工具图标；它只表达明确交互状态，不得退化为
  大面积通用后台蓝。校样朱红只用于出血、校样与印刷提醒，必须稀少。
- 视觉记忆点是“纸张、标尺、套准与校样”，不是大面积玻璃、霓虹、渐变或 SaaS 卡片；局部悬浮
  Chrome 可以使用受控磨砂材质，但不能覆盖纸张工作台的主叙事。

## 2. 设计原则

1. **画布优先**：编辑对象永远是视觉中心；应用 Chrome 不与纸张争夺注意力。
2. **精确胜过装饰**：位置、尺寸、层级和状态必须清晰，装饰不得降低读数效率。
3. **高密度但不拥挤**：使用紧凑控件、清晰分组和稳定节奏，不靠大块留白制造高级感。
4. **表面表达层级**：优先使用 surface 明度、间距、排版和受控阴影；边线只保留给焦点、错误、
   画布几何、表格网格、纸张物理边界和无法由空间区分的必要结构分隔。
5. **渐进披露**：常用动作直接可见，高级配置、危险动作和次要命令按需展开。
6. **状态不能只靠颜色**：选中、锁定、错误和禁用同时通过图标、完整 surface、ring、shadow 或文本表达。
7. **沿用成熟心智模型**：保留 Legacy 已验证的画布工作流，把固定 Rail 重组为底部高频
   Floating Tool Dock 与 Pages/Layers/Data/Assets 按需资源面板。
8. **结构即装饰**：工程感来自网格、细线、刻度、节点和精确对齐，不来自无业务意义的工程编号。
9. **先定义契约再写局部样式**：尺寸、颜色、层级、滚动与交互状态必须使用统一 token。

## 3. 技术与边界

- React UI 使用 CSS Modules；画布动态几何使用 CSS Custom Properties。
- 交互原语优先使用 Radix UI；不引入带视觉意见的完整 UI 框架。
- 不引入 Tailwind 或 CSS-in-JS。Workshop 的 cva/Tailwind 写法只吸收“变体集中管理”的思想。
- React 组件变体使用显式 TypeScript union、`data-variant` 和 `data-size`；默认值必须显式声明。
- 静态颜色、间距、圆角和阴影禁止写入 JSX `style`；Schema 驱动或几何计算产生的 CSS 变量例外。
- 禁止 `!important`、`as any`、`@ts-ignore` 和运行时 CSS 注入。
- `@ptd/react-designer/styles.css` 是唯一公共样式入口。
- 应用级定制通过稳定的 `data-ptd-*` 属性和公共 token 完成，不依赖 CSS Module 生成类名。

### 3.1 Headless PTD 配置原语

`@ptd/react-ui` 是 Store-agnostic 的 PTD 配置控件包。它只发出受控事件，不导入
`EditorStore`/history，也不修改 `TemplateSchema`。业务宿主负责把事件接到
`beginGesture` → transient update → `commitGesture`/`cancelGesture`，并决定哪些值写入最近状态。

`PtdColorField` 的最小公开契约如下：

```tsx
<PtdColorField
  label="纸张颜色"
  value={page.background}
  defaultValue="#ffffff"
  recentColors={recentColors}
  documentColors={documentColors}
  onOpenChange={(open) => (open ? beginGesture() : commitGesture())}
  onValueChange={(color) => updatePageConfig({ background: color }, true)}
  onCancel={cancelGesture}
  onReset={() => resetPageColor()}
/>
```

- 颜色输入采用自有 HSV 取色器（饱和度/明度二维面板 + 色相滑条）与主题/标准/最近/文档调色板，
  同时保留 HEX draft：接受 `#RGB`/`#RRGGBB`，统一发出小写六位 HEX；
  非法 draft 只显示 invalid/error，不发出业务值。未知受控值必须原样展示，不能自动纠正。
- `allowTransparent` 未开启时不得接受 `transparent`；reset 是显式动作，不把空字符串当 reset。
- 最近颜色和文档颜色是 UI 派生数据，不写入 Schema/history；最近颜色由宿主在一次已提交 gesture 后调用
  `EditorStore.recordRecentColor`。
- ColorField 的 Trigger 与 Popover Portal Content 必须带 `data-ptd-editor-interactive="true"`；
  Portal Content 还必须应用 `ptdThemeClass`。Trigger 支持 Enter/Space，Popover 支持 Escape、outside click；
  Escape 通过 `onCancel` 恢复打开前值，disabled/locked 关闭已打开的 Portal。
- 颜色字段 CSS 使用 `--ptd-*` token 和 CSS Modules。动态样本色只能作为 `--ptd-color-field` 这类 CSS 变量，
  不能把静态视觉 token 写进 JSX inline style。
- HSV 面板必须提供 pointer 与键盘方向键两条操作路径；当前 Schema 颜色合同只接受六位 HEX 或
  `transparent`，因此 alpha 滑条不写入业务值，透明仍通过 `allowTransparent` 动作明确选择。

#### Inspector 颜色适配边界

Property Inspector、自由表格单元格、二维码、条形码和多选样式中的颜色字段统一使用业务适配器
`InspectorPtdColorField`，不得再消费旧 `InspectorColorControl` 或原生 `<input type="color">`。
适配器只负责把宿主的 `onStart`/`onFinish`/`onCancel`/`onValue` 手势回调接到 `PtdColorField`，并从
当前 Store 派生最近颜色与文档颜色；`@ptd/react-ui` 仍不可导入 Store 或 history。

表格和多选宿主必须继续使用 transient 更新，打开到关闭只提交一个 gesture；混合颜色用
`value={null}` 加可读 `placeholder` 表达，不得把第一个组件的颜色伪装成统一值。`allowTransparent`、
默认值和锁定状态按原字段 Schema 合同逐个保留，业务适配器不得扩展 alpha 或改变导出 DOM。

## 4. Token 架构

### 4.1 原始色板

使用 OKLCH 定义现代浏览器色板，并保持相同色相下的感知明度一致。

```css
.ptdTheme {
  /* Warm paper — paper-2 perceptually matches the landing-page #f5f5f3 baseline */
  --ptd-paper-0: oklch(99.35% 0.003 106);
  --ptd-paper-1: oklch(98.45% 0.003 106);
  --ptd-paper-2: oklch(96.96% 0.003 106);
  --ptd-paper-3: oklch(94.8% 0.004 100);
  --ptd-paper-4: oklch(89.5% 0.009 85);

  /* Near-neutral warm graphite */
  --ptd-graphite-950: oklch(21% 0.006 70);
  --ptd-graphite-900: oklch(27% 0.007 70);
  --ptd-graphite-800: oklch(35% 0.008 70);
  --ptd-graphite-700: oklch(44% 0.008 70);
  --ptd-graphite-600: oklch(53% 0.007 75);
  --ptd-graphite-500: oklch(62% 0.006 80);
  --ptd-graphite-400: oklch(71% 0.006 85);
  --ptd-graphite-300: oklch(82% 0.006 90);

  /* Proof vermilion */
  --ptd-vermilion-700: oklch(45% 0.16 35);
  --ptd-vermilion-600: oklch(52% 0.175 35);
  --ptd-vermilion-500: oklch(59% 0.17 35);
  --ptd-vermilion-100: oklch(94% 0.035 35);

  /* Archival ink blue */
  --ptd-ink-blue-700: oklch(44% 0.1 258);
  --ptd-ink-blue-600: oklch(54% 0.12 258);
  --ptd-ink-blue-100: oklch(95% 0.025 258);
}
```

档案墨蓝与校样朱红均不得大面积铺底。中性 surface 应占视觉重量约 90%，明确状态色不超过
10%。档案墨蓝统一操作、选中与焦点；朱红仅保留印刷校样语义。Logo 的自身颜色不定义 UI
状态，也不要求组件跟随 Logo 换色。

### 4.2 语义颜色

```css
.ptdTheme {
  --ptd-surface-app: var(--ptd-paper-1);
  --ptd-surface-panel: var(--ptd-paper-0);
  --ptd-surface-raised: var(--ptd-paper-0);
  --ptd-surface-sunken: var(--ptd-paper-2);
  --ptd-surface-form: var(--ptd-paper-2);
  --ptd-surface-field: var(--ptd-paper-0);
  --ptd-surface-selection: var(--ptd-paper-0);
  --ptd-surface-canvas: oklch(91.5% 0.008 85);
  --ptd-surface-paper: oklch(100% 0 0);

  --ptd-text-strong: var(--ptd-graphite-950);
  --ptd-text: var(--ptd-graphite-800);
  --ptd-text-muted: var(--ptd-graphite-600);
  --ptd-text-disabled: var(--ptd-graphite-400);

  --ptd-border-strong: var(--ptd-graphite-400);
  --ptd-border: var(--ptd-graphite-300);
  --ptd-border-subtle: var(--ptd-paper-4);

  --ptd-action: var(--ptd-ink-blue-600);
  --ptd-action-hover: var(--ptd-ink-blue-700);
  --ptd-action-subtle: var(--ptd-ink-blue-100);
  --ptd-selection: var(--ptd-ink-blue-600);
  --ptd-selection-strong: var(--ptd-ink-blue-700);
  --ptd-selection-subtle: var(--ptd-ink-blue-100);
  --ptd-selection-border: oklch(74% 0.055 258);
  --ptd-context-active: var(--ptd-graphite-300);
  --ptd-context-active-hover: var(--ptd-graphite-400);
  --ptd-proof: var(--ptd-vermilion-600);
  --ptd-proof-subtle: var(--ptd-vermilion-100);

  --ptd-success: oklch(47% 0.105 145);
  --ptd-warning: oklch(58% 0.13 72);
  --ptd-danger: oklch(46% 0.17 27);
  --ptd-focus: var(--ptd-ink-blue-600);
}
```

- 正文对背景至少达到 WCAG AA 4.5:1。
- 图标、边框、焦点环和选中指示至少达到 3:1。
- Placeholder 不是标签，且颜色同样要满足正文对比度要求。
- 错误状态使用 `--ptd-danger`；校样朱红不能代替错误语义。
- 彩色状态与暖中性边框组合时优先使用显式语义 token；不得直接在 OKLCH 中混合两种带不同色相的
  颜色来生成状态边框，否则低彩度暖灰的隐藏色相可能把墨蓝插值为绿色。需要动态混色时应明确选择
  不产生色相绕行的插值空间，并通过实际浏览器检查结果。
- Floating Tool Dock 主浮岛使用近黑半透明 `header-bg`，Resource Panel、Inspector Header 与 Status Bar
  使用接近白色的 `surface-panel`；Context Shelf 使用 `surface-sunken`。Inspector 的连续滚动表单区使用
  `surface-form`，可编辑控件与 segmented track 使用白色 `surface-field`；导航 Tabs 的当前项使用
  白色 `surface-selection`，Floating Main Dock 工具当前项使用档案墨蓝 `selection` 实底；Context Shelf
  当前项使用中性 `context-active`，避免与 Main Dock 争夺焦点。Inspector segmented 当前项则回落到
  `surface-form`。不得在 `surface-form`
  中为每个 Section 再嵌套白色 Card。
- 黑色 App Bar、较深的暖灰 Pasteboard 和纯白 Paper 继续形成三个明确层级；“提高 Panel 明度”
  不等于将 Canvas 或整页宿主铺成纯白。Pasteboard 保持与旧版相近的明度，只把冷蓝偏色收敛为
  暖纸灰，避免与落地页割裂。

### 4.3 间距、尺寸与圆角

以 4px 为基本单位，只使用以下阶梯：

```css
.ptdTheme {
  --ptd-space-1: 4px;
  --ptd-space-2: 8px;
  --ptd-space-3: 12px;
  --ptd-space-4: 16px;
  --ptd-space-6: 24px;
  --ptd-space-8: 32px;

  --ptd-control-xs: 24px;
  --ptd-control-sm: 28px;
  --ptd-control-md: 32px;
  --ptd-control-touch: 40px;

  --ptd-radius-control-sm: 4px;
  --ptd-radius-control: 6px;
  --ptd-radius-surface: 8px;
  --ptd-radius-overlay: 12px;
  --ptd-radius-shell: 14px;
  --ptd-radius-round: 999px;

  /* Migration-only aliases; new UI code uses the semantic tokens above. */
  --ptd-radius-1: var(--ptd-radius-control-sm);
  --ptd-radius-2: var(--ptd-radius-control);
}
```

- 4px 只用于微型内部控件与紧密拼接段；普通 Field、Button、Tool item 和 Rail item 使用 6px。
- Disclosure、普通 surface 和 Floating Main Dock 使用 8px；Popover、Dropdown、Context Menu 使用 12px。
- App Bar、Modal 和 Sheet 外壳使用 14px。999px 只用于 Switch、头像、状态点、旋转控制点和真正圆形命中区。
- 禁止业务组件继续新增 1/2/3/5/7/9px 等硬编码半径。旧 `radius-1/2` 仅为分阶段迁移 alias，不能作为
  新组件的设计入口；完成 Designer/Web 迁移并确认 Canvas/output 不受影响后删除。
- Medium 圆角不等于 pill：常规 Button、Tab、Chip 和 Card 不得因参考 HeroUI 而统一使用 999px。

### 4.4 阴影与层级

```css
.ptdTheme {
  --ptd-shadow-paper:
    0 0 0 1px oklch(71% 0.006 85 / 78%), 4px 4px 0 oklch(21% 0.006 70 / 10%),
    0 18px 38px oklch(21% 0.006 70 / 10%);
  --ptd-shadow-field: 0 1px 2px rgb(0 0 0 / 2%), 0 0 1px rgb(0 0 0 / 3%);
  --ptd-shadow-field-hover:
    0 2px 4px rgb(0 0 0 / 4%), 0 1px 2px rgb(0 0 0 / 6%), 0 0 1px rgb(0 0 0 / 6%);
  --ptd-shadow-selection: 0 1px 2px rgb(0 0 0 / 5%), 0 0 1px rgb(0 0 0 / 5%);
  --ptd-shadow-floating: 0 8px 24px oklch(21% 0.006 70 / 16%);
  --ptd-shadow-tool-dock:
    0 3px 8px rgb(0 0 0 / 35%), 0 1px 3px rgb(0 0 0 / 50%), inset 0 0.5px 0 rgb(255 255 255 / 8%),
    inset 0 0 0.5px rgb(255 255 255 / 30%);
  --ptd-shadow-modal: 0 20px 56px oklch(21% 0.006 70 / 22%);

  --ptd-layer-canvas: 0;
  --ptd-layer-guide: 20;
  --ptd-layer-selection: 30;
  --ptd-layer-scrim: 80;
  --ptd-layer-sticky: 100;
  --ptd-layer-floating: 1200;
  --ptd-layer-context: 1250;
  --ptd-layer-modal-backdrop: 1400;
  --ptd-layer-modal: 1410;
  --ptd-layer-toast: 1600;
  --ptd-layer-tooltip: 1700;
}
```

阴影按语义分配：Field 默认使用几乎不可见的 `shadow-field`，hover/focus/invalid 提升为
`shadow-field-hover`；白色 selection surface 使用 `shadow-selection`；Paper、
Dropdown/Popover、Floating Dock、Modal/Sheet 与 Toast 使用各自更高层级阴影。普通 Button、Tool item、
List item、Section 和 Panel 默认平面；Primary/Danger 通过语义填充而非 field shadow 表达层级。

### 4.5 Border budget 与状态表面

- Form Field、普通 Button/Tool/List、导航类 selection surface、Floating Main Dock、Popover/Menu 默认
  `border: 0`。删除边框后必须通过 surface、spacing、typography 或语义 shadow 补足层级，不能让控件消失。
- Field default = `surface-field + shadow-field + 6px radius`，其中默认 shadow 只提供近乎不可见的轮廓；
  hover/focus/invalid 提升为参考 HeroUI 的 `shadow-field-hover`；
  focus-visible 和 invalid 使用不参与盒模型的完整 ring/outline 与文字反馈，不通过切换 `border-width`。
- Floating Main Dock 当前项使用档案墨蓝 `selection` 实底与白色前景；Context Shelf 当前项使用
  `context-active` 中性灰实底与 `text-strong` 前景。两者都不投影、不加边框，下层主 Dock 保持更高视觉权重；
  Rail、Tabs 与 Status Bar 的当前项位于灰色 track/container 中，使用白色
  `surface-selection + shadow-selection` 和档案墨蓝前景。Inspector 内的二至四项 Button Group 使用完整
  白色 `surface-field` track；当前项回落到 `surface-form`，使用一条低对比中性完整边界且不投影。
  两种选择语言都禁止 inset bottom indicator、蓝色下边条、大面积浅蓝填充或非聚焦蓝框。
- Canvas selection、参考线、表格网格、Paper 物理边界、颜色样本必要轮廓以及无法由 surface/spacing
  区分的单一结构分隔属于功能性线，可以保留。每条保留线必须能说明该语义，不能为“更精致”重复套框。
- `--ptd-focus` 保持档案墨蓝色相并可独立校准亮度/对比度；它不与 Action/Selection 强制使用同一数值。

### 4.6 受控磨砂材质

- `backdrop-filter` 只用于确实覆盖在其他应用内容之上的 App Bar、Floating Dock、Popover/Menu、Modal/Sheet
  等少量 Chrome。Inspector form canvas、Field、Section、普通 Panel、Resource Panel、Paper、Canvas、模板预览
  和 output DOM 使用实色表面，不添加 blur。
- 同一视觉堆栈最多出现一层磨砂；禁止嵌套 blur、全屏 blur、在滚动画布上铺设大面积 blur，或让磨砂成为
  Field 与 Card 的默认材质。推荐从 12–16px 的低成本档位开始，必须以实际浏览器截图确认文字和图标对比度。
- 磨砂表面仍需使用高不透明度的暖灰/黑色底色与语义 shadow。`backdrop-filter` 只是增强，不能承担唯一的
  层级或可读性；不支持该属性、开启 reduced transparency 或性能不足时，回退到同层级的不透明 surface。
- 该效果不得进入打印、PDF 或截图导出的内容树；不得为“像 iOS”引入发光边框、彩色玻璃或多层半透明噪声。

## 5. 字体与数值

```css
.ptdTheme {
  --ptd-font-ui:
    'Outfit', 'Outfit Variable', 'Sarasa UI SC', 'Sarasa Gothic SC', 'Microsoft YaHei UI',
    'PingFang SC', sans-serif;
  --ptd-font-metric:
    'Outfit', 'Outfit Variable', 'Sarasa UI SC', 'Sarasa Gothic SC', 'Microsoft YaHei UI',
    sans-serif;
  --ptd-font-brand: var(--foliq-font-brand, 'Cherry Bomb One', 'Outfit', sans-serif);
  --ptd-font-serif: 'Noto Serif SC', 'Noto Serif CJK SC', 'Source Han Serif SC', 'Songti SC', serif;

  --ptd-text-10: 0.625rem;
  --ptd-text-11: 0.6875rem;
  --ptd-text-12: 0.75rem;
  --ptd-text-13: 0.8125rem;
  --ptd-text-15: 0.9375rem;
  --ptd-text-18: 1.125rem;
}
```

- 产品 UI 使用固定字号，避免流式字号破坏工具布局。
- 中文操作 UI 以 Sarasa UI SC 为主；Outfit 负责普通拉丁字母和数字。作为品牌字标单独出现的
  `Foliq` 使用 Cherry Bomb One 400，并通过共享 `--foliq-font-brand` / `--ptd-font-brand` Token
  覆盖落地页、文件工作台、帮助面板与设计器 App Bar；正文或“关于 Foliq”等普通菜单文案不整行
  切换展示字体，也不把等宽字体当作“工程感”。
- 衬线内容统一使用 Noto Serif SC 系列，仅用于模板叙事、预览标题或明确要求衬线的内容；
  表单、工具栏、坐标和快捷键仍使用 UI sans。
- Cherry Bomb One、Outfit 与 Noto Serif SC 由宿主通过 Google Fonts 或等价 Web Font 服务引入；离线部署必须
  提供可控的本地镜像或依赖系统 fallback。Sarasa UI SC 没有可靠的通用 Web 服务版本，示例 Web
  通过 `@font-face` 自托管完整 `SarasaUiSC.ttf`。可复用设计器包只提供字体栈，不强制注入大型
  CJK 字体资产。
- 常规控件正文为 12–13px；面板标题 13px；文档标题 15px；产品名不超过 18px。
- 标尺、坐标、尺寸和缩放使用 `font-variant-numeric: tabular-nums`。
- 画布内部字体由 `TemplateSchema` 控制，不继承设计器 Chrome 的字体决策。
- 浏览器 200% 缩放必须仍可操作；窄空间通过布局折叠解决，不能禁止页面缩放。

### 5.1 品牌资产

- Landing Header/Footer、文件工作台与 Designer App Bar 只使用 `Foliq` 拉丁字标；中文产品说明使用 UI
  字体，二者可以组成品牌单元，但不得再并列放置旧 PTD/P 图形。
- `Foliq` 字标使用 Cherry Bomb One 400，并通过共享 `--foliq-font-brand` / `--ptd-font-brand` token
  渲染；工作区 Chrome 保持 15–18px，营销页 Hero 可以按响应式构图放大为主标题。
- 当前不声明旧 P favicon，也不把完整字标强塞入小尺寸 favicon；等待正式、可在 16–32px 清晰识别的
  图形品牌资产。
- 朱红套准、裁切或校样符号可以出现在功能场景，但不能冒充产品 Logo。

### 5.2 结构装饰语汇

从 Vidorra Blueprint、Zed 与 Workshop 只吸收适合密集工具台的结构原子：

- **Hairline**：只在两个 surface 无法通过明度、间距或 shadow 区分时使用一条暖中性结构分隔；
  Floating Tool Dock、普通 Panel、Field 和每个 Section 不因组件边界而自动获得外框。
- **Engineering grid**：Pasteboard 可使用极淡工程纸网格；纸张本身保持干净，网格不能穿入模板。
- **Mount texture**：Pasteboard 可叠加低对比 135° 斜线，表达纸张装配区而非真实打印材质；
  斜线、工程网格、工作区内框和节点均必须 `pointer-events: none`。
- **Workbench frame**：Pasteboard 不添加包围纸张和标尺的重复工作区外框；Paper 边缘、真实标尺
  基线和应用分区线已经提供足够边界。禁止菱形、空心方块、纸张角点等纯装饰节点。
- **Selection surface**：选中行/段/工具使用完整白色抬升 surface、轻 shadow 与墨蓝前景；禁止点阵、
  inset 底边、蓝色下划线或高饱和色块成为默认 selection 语言。
- **Physical press**：可交互 tile/按钮可在 active 时下压 `translateY(1px) scale(0.99)`；默认与 hover
  不添加模拟实体厚度的 inset 底边，普通平面按钮也不获得 field shadow。
- **Ruler/ticks**：任何视觉上类似标尺的刻线都必须对应真实毫米尺寸、页面方向和当前画布缩放；
  禁止使用无数字、固定间距且与纸张尺寸无关的伪标尺。
- 禁止 `PRO / 01`、坐标角标、伪图纸编号、无意义英文缩写等装饰性工程文字。

## 6. 工作区布局合同

### 6.0 文件工作台 Home 与 Editor

- 受保护应用包含三个一级空间：`/app` 是文件工作台 Home，`/design/new` 与
  `/design/:key/:slug` 是未保存/已保存 Editor，`/preview/new` 与 `/preview/:key/:slug` 是独立
  Preview。opaque key 是资源身份，slug 只是规范化后的可读标题；`/app?new=blank` 和
  `/app?template=<id>` 仅作为兼容迁移输入。裸 `/app` 不得隐式创建空白模板，文件浏览也不得作为
  覆盖 Editor 的大型 Modal。
- Home 使用与 Editor 相同的暖纸灰、暖石墨和档案墨蓝体系。宽屏采用稳定侧栏与文件主区，窄屏重组为
  真正的 compact top shell；不能只隐藏桌面元素，也不能用营销页大标题、无意义英文 eyebrow、工程编号、
  规则线或矩形框装饰制造“专业感”。专业感来自真实信息架构、内容、层级、对齐与状态。
- “最近更新”使用真实 `TemplateSchema` 与包内只读 Renderer 生成第一页内容预览；不得用静态纸张占位或
  假组件冒充缩略图。“全部模板”使用准确标题、版本和更新时间的高效列表。Host 最多并发读取 4 份最近
  模板详情，必须传递 AbortSignal、在卸载/刷新时取消、隔离单项失败；全部列表不得产生无界 N+1 请求。
- 当前 Server 只有 `updatedAt`，因此默认区必须命名为“最近更新”，并显示标题、版本和更新时间；在增加
  owner/user 维度的 `lastOpenedAt` 前，不得称为“最近打开”“继续编辑”或暗示跨设备活动历史。
- Home 至少提供新建空白、最近更新、全部模板、真实标题过滤、清除/无结果、loading、empty、error/retry
  和打开文档路径。标题过滤不得声称为正文全文搜索；排序、重命名、复制和硬删除在真实能力接入后留在
  Home，不进入 Canvas Toolbar 或 Inspector。
- Home 与 Editor 复用 Web Host 提供的真实账户 Popover。头像/身份触发器只负责展开和收起菜单，不能
  直接执行退出等破坏性动作；GitHub 身份才显示显式退出，本地 Dev Bypass 不显示无效退出入口。
- Editor App Bar 的账户触发器只显示圆形头像，通过 `aria-label` 保留账户名称，不再并列显示昵称或
  下拉箭头；Home 侧栏入口空间充足，可以继续显示头像、昵称和披露图标。
- 普通部署根路径是专用登录页；演示部署才显示产品落地页。两者复用 44px 高、8px 圆角、18px GitHub
  图标、单行标签和小箭头的紧凑登录操作，不能使用超大 SVG、换成三行中文或厚重胶囊。
- 演示部署在 `/app` 内容区显示完整提示，明确每日北京时间 08:00 恢复访客模板、管理员不受影响，并
  提供 GitHub Fork 操作；Design/Preview 深层路由使用不遮挡主工具栏的紧凑提示，允许关闭并在当前
  浏览器会话内保持关闭状态。
- Editor 的 Open/Template Browser 用户语义统一为“文件工作台”：clean 文档直接返回 `/app`；dirty 或
  conflict 文档先进入未保存决策。兼容 Host command 可以暂时保留 alias，但不得显示两个等价入口或分叉
  状态合同。
- Modal 只用于用户必须先决策才能安全继续的节点，例如离开 dirty/conflict 文档、不可恢复硬删除、409
  覆盖/重新载入或恢复会丢弃当前内容。Home/文件浏览、一般 loading/error、Save As、搜索、排序和版本查看
  不使用 Modal；Save As 使用非模态 Command Sheet，版本历史使用 Drawer/Side Sheet，普通反馈使用 inline
  status 或 Toast。Modal 必须 trap focus、支持 Escape、提供文本风险说明并在关闭后恢复焦点。应用内的
  Modal、Sheet 和 Popover 也不得使用仅作装饰的英文 eyebrow；标题应直接说明当前任务或风险。

### 6.1 桌面结构

```text
┌────────────────────────────────────────────────────────────────────┐
│ App Bar：品牌、应用菜单、载入/保存、账户入口                        │ 42
│ └─ Application Menu：点击展开/收起，真实下压下方工作区              │ auto
├────┬──────────────┬──────────────────────────┬─────────────────────┤
│Rail│ Resource     │ Canvas / Ruler / Paper   │ Inspector           │
│ 42 │ 280, 按需    │ ┌─ Context Shelf ─────┐  │ 304, 按需           │
│    │              │ └━ Floating Main Dock ━┘  │                     │
├────┴──────────────┴──────────────────────────┴─────────────────────┤
│ Status Bar：页码、选择、页面尺寸、参考线、缩放                      │ 24
└────────────────────────────────────────────────────────────────────┘
```

```css
.ptdTheme {
  --ptd-app-bar-height: 42px;
  --ptd-app-bar-height-compact: 38px;
  --ptd-status-bar-height: 24px;
  --ptd-tool-dock-width: 42px;
  --ptd-tool-dock-width-compact: 36px;
  --ptd-resource-panel-width: 280px;
  --ptd-inspector-width: 304px;
  --ptd-floating-tool-dock-offset: var(--ptd-space-6);
  --ptd-floating-tool-dock-safe-area: 128px;
}
```

- App Bar 复用 ChemViz 桌面导航的材质合同：`rgb(0 0 0 / 88%)` 背景、16px backdrop blur、
  `rgb(255 255 255 / 6%)` hairline 与 `0 10px 28px rgb(0 0 0 / 12%)` 阴影；根据 PTD 高密度
  工作台语境将高度收紧为 42px、底角收紧为 14px。
- App Bar 折叠时高 42px，第一行轨道使用内容高度；展开菜单必须参与 Designer Grid 布局并真实
  下压 Canvas 和 Panel，禁止使用 fixed/absolute 覆盖工作区。
- App Bar 保留品牌与真实载入/保存动作；认证账户由 Web Host 在 Designer 外层提供，Designer 内不得
  再渲染假账户占位或引入 Auth 客户端。App Bar 不重复展示当前模板标题、页码、纸张方向和尺寸，这些
  信息由 Context Shelf、Inspector 与 Status Bar 承担。不存在的云保存、同步或运行状态不得占位。
- 同一 Header 中的“文件工作台”和“保存模板”属于同一文档动作控件家族，必须使用相同高度、圆角、
  字重和状态节奏，只通过填充与明度表达主次，不得靠不同外框或把一个做成 Pill 来制造层级。两项动作
  与宿主头像组成紧凑右侧操作组；头像命中区与保存动作之间只保留一个常规控件间距，不预留昵称按钮宽度。
- 当前应用菜单按低频工作流组织为文件(F)、模板(T)、视图(V)、帮助(H)，靠左排列在品牌之后并提供
  `accessKey`/`aria-keyshortcuts` 助记键语义。File 集中 New/Open/Save/Save As 与版本历史；Template
  承载页面设置、页面管理、素材资源、数据源与模板检查；View 聚焦标尺、参考线显隐/锁定/清空和页面
  适配；Help 提供快捷键、产品介绍与关于信息。单选高频对象命令只保留在组件 Quick Bar、画布右键菜单
  和键盘路径；多选对齐、分布和组合等专属命令可保留在 Context Shelf。App Bar 不再建立 Object 分类
  形成重复入口；同理不建立 Window 分类堆叠面板开关，也不
  重复 Status Bar 的放大/缩小。展开区直接显示命令名称、简短用途与 Windows 风格快捷键，不增加
  “应用命令”“界面预览”等解释性标题。稳定且已进入近期产品合同的少量能力可用“即将提供”Disabled
  状态预告，但不得出现开发批次、等待合同或接入状态等内部文案，也不得让一个分类全部由占位项组成。
  Host 命令通过统一能力表声明 Enabled/Pending/Reason；编辑器与工作区命令必须复用 Toolbar、快捷键、
  面板和上下文菜单使用的同一 EditorStore/layout 方法。
- 桌面应用菜单只能通过触发器 click/键盘激活显式展开；hover 只提供视觉反馈，Tab focus 不得自动
  展开。点击已打开的同一分类收起，点击另一分类保持面板打开并切换内容；点击 Header 外部、焦点
  移出 Header 或 Escape 收起。左右方向键/Home/End 在关闭时只移动焦点，在展开时同时切换分类。
  App Bar 必须声明编辑器交互边界，禁止 Designer 根节点在菜单 pointer down 时抢回画布焦点。
  Touch/Pen 不依赖任何 hover 自动开合，避免触摸浏览器合成 mouse/hover 事件扰动菜单状态。
  `prefers-reduced-motion` 下取消轨道和位移动画。
- 窄容器将四个桌面分类折叠为汉堡按钮；点击在原位展开菜单，并在展开区顶部显示可横向滚动的
  分类条。Touch/Pen 下汉堡按钮显式切换开合，分类点击只切换内容并保持打开，命令点击或 Escape
  收起。载入、保存、账户等关键入口适配成紧凑图标，不因响应式布局被删除。
- Host 提供文档元数据时，Status Bar 显示标题、版本和中文状态文本；状态可以同时使用语义色点，
  但不能只依赖颜色传达。窄容器可隐藏标题和版本，必须保留保存、载入、错误或冲突等关键状态。
- 披露节奏与 ChemViz 一致：轨道使用 340ms `cubic-bezier(0.22, 1, 0.36, 1)`，内容从
  `translateY(-8px)` 与透明态进入；实现优先使用 `grid-template-rows: 0fr → 1fr`，不测量或动画
  固定高度。
- Floating Tool Dock 固定在 Canvas viewport 底部中央，由两层组成：下方 Main Dock 常驻并承载
  `历史 / 交互工具 / 创建工具 / 工作区` 四组；上方 Context Shelf 常驻但依据 effective tool、页面、
  单选、多选和参考线选择切换命令。Main Dock 使用 `max-content` 按当前可见工具组适配宽度，并受 Canvas
  可用宽度约束；不得用固定宽度在工具两侧制造空白。Context Shelf 绝对定位在其后方，左右各内缩 24px，
  不参与浮岛的 intrinsic width 计算。它使用灰色 `surface-sunken`，完全无边框和阴影，并向下压入 Main Dock 5px。
  Main Dock 使用 8px radius 的无边框近黑半透明 surface、14px 单层受控 backdrop blur 和专用四层重阴影
  （两层黑色外投影 + 两层白色 inset 高光），两层通过遮挡形成一个稳定整体。上下文变化不得移动
  或撑宽 Main Dock，桌面上下文内容不得被裁切；单选上下文只显示面向用户的目录类型与 X/Y/W/H，
  不展示自定义图层名称、`RoySimpleText` 等内部 Schema 类型，也不重复组件 Quick Bar、画布右键菜单
  和键盘路径已有的复制、锁定、层级与删除动作。
- Select/Hand/Text/Shape/Image/Table/More 与 Inspector 开关属于 Main Dock；Undo/Redo 也迁入历史组。
  左 Rail 只保留 Assets/Pages/Layers/Data 四个入口并全部靠上排列。四个入口使用 `role="group"` 与
  `aria-label` 保持可理解性，打开状态的短标记朝向相邻 Resource Panel。
- 精细指针下 Main Dock 的 Persistent Tool 激活使用档案墨蓝 `selection` 主色实底与白色图标/文字；
  Context Shelf 使用更深的中性灰 surface 与暖石墨前景，不能复用主色实底。两者都不使用边线、浅蓝底、
  选中阴影或 inset 底标记；Rail 打开的资源面板入口仍使用白色抬升语言，并可在
  邻近 Panel 一侧保留单一位置标识。状态不得改变按钮尺寸，也不得只靠颜色表达。
- Floating Tool Dock 的 z-index 位于 Selection 与 compact Scrim 之间：正常编辑时高于 Paper/Selection，
  打开 Resource/Inspector overlay 时必须被 Scrim 覆盖。完整组件 Picker 作为 Portal 使用 floating
  layer，仍可在明确触发后位于工作区浮岛之上。
- Canvas 滚动内容必须通过 `--ptd-floating-tool-dock-safe-area` 保留底部空间；Main Dock 与 Status Bar/
  水平滚动条之间使用 `--ptd-floating-tool-dock-offset` 保持可点击间隙，不能只靠视觉阴影假装避让。
- Resource Panel 默认宽 280px、限制在 240–360px；Inspector 默认 304px、限制在 280–420px。
  两者均可折叠和拖动调整，最后宽度在当前 Designer 实例中保留。
- 无组件选择时 Inspector 必须展示真实 Page Inspector，而不是空状态；只读信息不得伪装成输入框。
- 左侧面板和右侧 Inspector 各自只有一个主滚动容器；标题、搜索和底栏不参与滚动。
- 画布滚动只发生在 Canvas viewport，不能让整个应用页面滚动。
- 中央列必须 `min-width: 0`；固定面板不能挤破画布，而应触发自身响应式策略。
- 活动资源、开合和宽度属于实例级 UI state，不写入 `TemplateSchema`、不触发 `onChange`，也不
  进入模板撤销历史。

### 6.2 面板原语

所有左侧面板和右侧 Inspector 复用相同结构：

```text
PanelRoot
├─ PanelHeader      面板身份、数量、折叠/关闭动作
├─ PanelTools?      搜索、筛选或上下文操作
├─ PanelBody        唯一主滚动容器
└─ PanelFooter?     固定的创建/应用动作
```

- `PanelHeader` 高 40px，不能在内容区重复同名标题。
- 列表使用平面行或紧凑 tile；不使用卡片套卡片。
- 左侧 Resource Panel 的当前 Page/Layer 使用中性 raised surface、上下 hairline 与字重表达；不得
  使用墨蓝左竖线叠加浅蓝底。Canvas 对象选择仍使用专属墨蓝 overlay，两者不能混为后台导航态。
- Hover 才出现的次要动作必须提供键盘可达的替代入口。
- 空状态包含：当前状态、下一步价值和一个明确动作。

### 6.3 数据源与 Data Panel

Data Panel 是面向模板作者的字段绑定工作区，不是后台 CRUD 表格，也不能堆叠未经封装的原始
`input`、`select` 或 `textarea`。它沿用第 6.2 节面板原语，按以下顺序组织：

```text
DataPanel
├─ 数据来源摘要
├─ 设计内容 / 数据校样 segmented control
├─ sample record 上一条 / 下一条
├─ JSON 导入与候选预检
├─ 当前绑定摘要
├─ 可搜索的嵌套字段树
├─ 字段编辑与格式化
└─ 诊断
```

- JSON 导入同时支持拖入 `.json`、文件选择和粘贴 JSON。解析成功后先展示根结构、记录数、字段数、
  byte size、diagnostics，以及现有 binding 的 valid / invalid 影响；只有用户明确执行“应用数据”才
  修改模板。选择文件、粘贴、解析、推断字段和预检候选都保持本地，不触发 dirty、History 或 Host change。
- 无效 JSON、primitive root、混合类型 root array、超过共享限制的数据、危险字段名及其他结构问题，
  必须在导入表面就地显示原因和恢复方式，不能等到保存或渲染阶段才报错。
- 字段树支持搜索、嵌套展开和明确的键盘可达绑定按钮。拖拽绑定可以作为效率增强，但不能成为唯一
  入口；所有状态与动作必须有可访问名称和 focus-visible 状态。
- 简单文本使用支持 literal 与多个 fields 混排的 composer。图片、二维码、条形码和自由表格 cell
  仅展示与当前组件兼容的 binding target，不能让用户先创建必然无效的映射再靠保存报错。
- 当前绑定摘要同时说明组件、target、field path 和 formatter。missing、type mismatch 与失效 binding
  必须在组件 Frame 和 Data Panel 内提供文字状态及修复入口，不能只用颜色或警告图标表达。
- 在 compact 模式中，Data Panel 作为 Resource overlay 仍必须完整支持导入、字段搜索、键盘绑定与
  诊断，且在 390px 宽度下不产生页面级横向溢出。Resource/Inspector overlay 使用
  `--ptd-layer-sticky`，高于 `--ptd-layer-scrim`；Scrim 仍覆盖 Canvas 与 Selection，并可点击关闭
  当前 overlay。

### 6.4 Web 文件工作台与文档级表面

- 受保护的 `/app` 默认进入文件工作台，未保存新文档和已保存文档分别使用明确的 Editor URL；文件
  浏览不能继续作为覆盖画布的大型 Modal。当前只有 `updatedAt` 时必须称为“最近更新”，不得伪称
  “最近打开”或“继续编辑”。
- 文件卡片预览复用公共只读 `TemplatePreview` 和真实 `TemplateSchema`；不得绘制假缩略图或维护第二套
  Renderer。最近区的详情请求有明确上限并取消过期请求，全部文件区保持 metadata-only。
- 打开文件是卡片主动作；重命名、创建副本和永久删除位于独立轻量 Popover，不与主动作形成嵌套按钮。
  Popover 使用与实际键盘合同相符的语义，支持 Escape 恢复触发器焦点、外部 pointer 关闭和 coarse
  pointer 至少 40px 命中区；不能声明 ARIA menu 却缺少 roving focus/方向键合同。
- 重命名和 Save As 使用非模态 Side Sheet；浏览历史使用非模态 History Side Sheet；离开 dirty/conflict、
  覆盖未保存内容的恢复以及不可恢复硬删除才使用 Modal。一般成功、失败、载入和重试留在触发表面或
  inline 状态，错误不能只藏在被 Modal backdrop 遮住的 Toast 后面。
- 历史列表按需读取历史详情，并用真实 `TemplatePreview` 预览不可变快照。切换选择必须立即隔离旧预览；
  AbortSignal 和请求身份共同阻止 stale response 覆盖新选择。当前版本不可重复恢复。
- 恢复旧快照必须说明它会创建新的最新版本而非改写历史；dirty 文档还要说明当前未保存内容会被替换。
  恢复携带当前 `expectedVersion`；409 后保留历史浏览但禁止使用过期基线重复恢复，直到用户重新打开
  服务器文档。删除失败保留文件和确认表面，重命名失败保留输入 Sheet，异步确认必须拒绝重复提交。
- 同一 Host 区域的 Save As、Help、Version History 与顶层确认表面必须互斥；打开新文档、返回工作台或
  开始受保护导航时关闭不再相关的 Sheet。每个表面只处理自己的 Escape，关闭后恢复到仍连接 DOM 的
  合理焦点目标。

## 7. 组件工具选择器与素材面板

- Catalog 使用独立于持久 Schema category 的五组 taxonomy：文本、表格、图像、编码、图形；
  `common/data/shape` 与既有 `ComponentType` 只承担模板兼容，不能直接决定工具分组。
- Select、Hand、Text Group、Shape Group、Image、Simple Table 是位置稳定的高频 Dock 工具；其下的
  More 按钮打开完整组件工具 Picker。文本组记忆本 Designer 实例最近使用的简单文本或富文本，
  图形组继续记忆最近 Shape；两者的 disclosure 都不能挤偏主图标。
- Picker 是锚定 Dock 的非模态 Portal，而不是 Resource Panel 或大型 Modal。它提供搜索、最近使用和
  五组紧凑二列工具项，只显示 `kind: available` 的真实组件；planned 项保留在产品 Catalog/文档，
  不进入可操作浮层，也不以禁用按钮伪装为当前能力。
- Picker 打开后聚焦搜索；Arrow/Home/End 在工具项间移动，Enter/Space 选择，Escape 关闭并恢复
  More 焦点。鼠标支持 light-dismiss；Touch/Pen 的外部 pointerdown 不关闭，避免轻触误关，必须通过
  关闭按钮、选择工具或 Escape 明确结束。
- Picker 根据 Designer 容器、触发按钮和自身尺寸实时定位并 clamp；Portal 必须应用共享主题和
  `data-ptd-editor-interactive`，不能被全局画布快捷键抢占。搜索、最近使用与开合只属于实例 UI state。
- 原 Components 资源入口改为 Assets。正式资产引用、去重与持久化合同建立前，素材面板只提供诚实
  空态和真实可执行的图片框入口，不创建刷新即丢失的伪上传、收藏、文件夹或服务端同步。
- 所有可用组件点击后只激活对应创作工具，不得立即在页面中心插入，也不得通过 Sidebar native
  drag 绕过拖框。用户必须在 Paper 上拖动定义组件 Frame；无效短拖和取消不创建组件。
- 新建 Shape 必须在取消选中时仍然可见：Line 默认使用 2px 暖石墨填充，Rect/Circle 默认透明填充
  与 1px 暖石墨实线描边，Star 默认暖石墨填充。默认值来自 Core Registry，不能只在 Designer
  preview 或 React Overlay 中补视觉假象。
- Shape Renderer 必须自包含实际几何；Star 等轮廓使用包内 SVG，不能依赖宿主是否加载某套图标
  字体来决定画布内容是否可见。
- Shape 使用一个 Main Dock 工具组和四个面板 preset；精细指针下主按钮为完整 30×30、图标
  16×16 居中，disclosure 作为右下角 13×13 覆盖目标。coarse pointer 下恢复 40×40 主目标、
  20×20 图标与 16×16 disclosure。任何尺寸都不能压缩主按钮或把图标挤偏。
- 当前 Shape preset 使用中性 graphite 边缘/字重与 inset edge，不使用蓝色左线或浅蓝填充。
- 创建 Schema 只能调用统一 Component Catalog/Factory，面板不能自己拼接默认属性。
- 有效 Draw 每次只添加一个完整 Schema、写入一个历史节点并发出一次最终 `onChange`；tool
  activation、preview、Hand/pan、short/cancelled draw 不发出模板变更，也不自动退出当前工具。
- 四种 Shape 完成后保持连续绘制；文本、富文本、图像、编码和表格完成一次后回到 Select。
  普通文本和富文本创建完成立即进入内容编辑，其他一次性工具保留新组件选中态供属性配置。
- 自由表格对象第一次点击仍只选择组件；选中后单元格表面接管精细操作。单击/拖动/Shift 扩展建立
  单元格选区，双击或 Enter/F2 原位编辑纯文本，Arrow/Tab 导航。选区使用浅墨蓝蒙版和精确描边，
  不能用不透明填充遮住单元格内容。
- 行列分隔线 hover 才显示细窄拖动命中区，拖动即时改变相邻轨道且形成一个 Gesture 历史节点。
  高频增删、合并、拆分与单元格排版位于 Inspector；不为表格打开遮断画布的大型 Modal。
- 表格结构命令使用完整动作名称和明确 disabled 状态；至少一行一列不能删除。`RoyComplexTable`
  在完整数据/分页合同完成前只作为规划项展示，旧 Schema 的只读渲染兼容不等于可创作能力。

### 7.1 Pages 资源面板

- Pages 面板管理手动设计页，而不是展示数据溢出产生的运行时页。页面列表保持有序，显示页码、
  对象数量和明确当前页；切页是 UI 导航，不触发模板 `onChange` 或撤销历史。
- 固定 Footer 提供新增、复制、上移、下移和删除。图标动作必须有 `aria-label`、Tooltip、
  focus-visible 与正确 disabled 状态；最后一页的删除始终禁用。
- 拖动排序是效率入口，不是唯一入口；上移/下移按钮必须始终提供等价的鼠标和键盘路径。
- 新增空白页与复制页插入当前页之后并切换到新页。复制页递归生成新的页面、组件和组合子项 id，
  不能共享可变 Schema 引用。
- 页面排序必须按 page id 保持当前页，不因位置索引变化跳到其他页面；删除当前页后选择同位置的
  下一页，删除末页时选择新的末页。
- 页面结构命令每次只创建一个历史节点并发出一次最终 `onChange`；Undo/Redo 后页码、App Bar、
  Page Inspector 和 Status Bar 必须保持一致，不能出现越界 currentPageIndex。
- Word 式自动分页属于数据预览/打印渲染：表格、列表或长文本以后可以生成只读派生页，但不得把
  运行时页写回手动 Pages 列表，也不得因为测试数据变化污染模板历史。

## 8. 工具栏与图标

- 图标系统统一为 Remix Icon line 风格；激活态可使用对应 fill 图标，但不得混用多套图标语言。
- 标准工具图标 16px，重要文档级动作 18px；描边粗细保持一致。
- 禁止使用 Emoji、Unicode 箭头或“左齐/中齐/横分”等文字缩写代替正式图标。
- 每个图标按钮必须有 `aria-label` 和 Tooltip；Tooltip 同时展示名称与快捷键。
- 常规命令栏图标按钮视觉尺寸 28px；Context Shelf 在精细指针下使用 24×24 target 与 14×14 glyph，
  通过灰条上下留白保持命中区可辨识，并服从同一 Tooltip/键盘入口合同。较宽的 coarse pointer 工作区将可点击区域提升到至少 40px。
  `<= 480px` 的 Designer 容器使用 32×32 紧凑视觉控件和 15–16px glyph，避免按钮填满整条
  36–38px Chrome；这是一项仅限手机宽度的高密度例外，不能扩散到平板或桌面触屏。
- Floating Main Dock 的主入口在精细指针下使用 30×30 target 和 16×16 图标，coarse pointer 下使用
  40×40 target 和 20×20 图标；`<= 480px` 容器覆盖为 32×32 与 15×15。所有 glyph 共用同一
  光学中心。组合工具的 disclosure 只能叠加在角落，不能改变主图标 grid cell。Shape 菜单必须消费 Arrow/Home/End、
  Enter/Space 与 Escape，禁止继续冒泡到对象移动、临时 Hand 或全局退出工具快捷键。
- 命令按领域分组：历史、剪贴板、排列、层级、组合、视图。
- 低频排列命令可进入 Dropdown；撤销、重做、删除、锁定、组合和缩放保持可发现。
- 禁用按钮保留位置，使用 `opacity: 0.45` 并移除事件；不靠 `cursor: not-allowed` 表达状态。
- Status Bar 的缩放减/选择/增保持一个紧凑语义组，但不绘制表单式整组外框和固定竖分隔线；
  单个动作只在 hover/focus 时出现局部 surface 或 focus ring，避免与状态文本争夺视觉重量。

## 9. 表单与属性检查器

- Label 始终可见，Placeholder 只给示例，不能承担字段名称。
- Inspector 常规 Field 高 32px，明确标记为 compact 或表格内部的微型 Field 可为 28px，coarse pointer
  为 40px；三者都使用 6px 常规 Field radius、白色无边框 surface 和同一 shadow/ring 状态矩阵。
- Page、Single 与 Multi Inspector 复用固定 Header、单一滚动 Body 和可选固定 Footer；切换状态
  不得改变主面板的滚动与定位合同。
- Inspector 的滚动 Body 是连续暖灰 `surface-form`。Section 通过标题、间距和克制分隔组织，不建立
  独立白色 Card；相邻 Section 之间允许一条与内容左右对齐、低对比的单一 1px 结构分隔线。Input、
  Select、Number、Textarea、Color 等 Field 才使用白色 `surface-field`。
- 几何属性优先组成 X/Y/W/H 二列网格，使用带增减动作、等宽数值和清晰单位后缀的紧凑步进器。
  合法的编辑中间态在焦点内保留，完成编辑时才提交一个历史手势。
- 文档显示单位默认 `mm`，Status Bar 提供全局 `mm / PTD Canvas px` 切换。页面、组件、表格、标尺、
  参考线、Context Shelf 与 Status Bar 必须同步；切换只改变显示和输入合同，不写模板、不发 Host change、
  不进入历史。字号继续使用 `pt`，旋转使用度，透明度使用百分比，行高保持无单位。
- 可编辑数值的 Label 同时作为水平拖动热区：每次拖动只提交一个历史手势，Shift 加速，
  Alt/Option 精调，Escape 恢复拖动起点且不写入历史；触屏和键盘用户继续使用输入框与增减动作。
- 混合数值在没有相对调整语义时禁用 Label 拖动和增减动作，仅保留明确录入；不能用拖动把多选值
  意外压平成同一个绝对值。
- 二至四项的小型枚举优先使用 segmented control；约束选项使用紧凑 Select；颜色同时提供可视
  色板和可编辑值。Inspector segmented/Button Group 整条使用白色 track，当前项使用与表单画布一致的
  暖灰 surface 和低对比中性 1px 边界，不使用抬升阴影。只有真正的长内容使用 textarea，不能把
  Inspector 退化成原始输入框列表。
- Page、Single、Multi 与 Table 业务面板必须组合共享 `InspectorControls`；原生 `input`、`select`、
  `textarea` 和 `color` 只能存在于控件实现内部，不能在业务面板重复拼装视觉与 Gesture。
- Field default 无可见 border；focus-visible/invalid 使用完整 ring/outline，disabled/locked 降低 surface
  和 shadow 层级但保留可辨识性。业务面板不得复制 raw box-shadow、重新添加常驻轮廓或维护第三套高度。
- 颜色控件闭合态保持紧凑色样、精确值和展开动作；展开态提供透明/无色（仅适用属性）、恢复默认、
  最近使用和文档颜色。最近颜色是 Designer 实例状态；文档颜色从当前模板派生、按频次和稳定顺序去重，
  两者都不写入 Schema 或历史。锁定或禁用时已展开面板必须收起。
- 混合值、锁定、禁用与非法草稿必须同时通过文字、图标或控件状态表达，不能只改变颜色。
- 高频且与当前组件相关的内容、几何、排版和基础外观分区保持展开和位置稳定；不适用的分区直接
  隐藏。Disclosure 只用于低频高级属性（如描边与圆角），不能把所有主分区都做成折叠面板。
- 图片、二维码和条形码必须在内容分区提供专用配置，不得用“结构化内容由专用编辑器维护”占位。
  图片支持稳定 URL/Data URL、本地文件读取、替代文本、适配方式和对象位置；二维码支持内容、
  纠错等级、静区与前/背景色；条形码支持内容、码制、前景色和可读文字开关。
- 本地图片通过 `FileReader` 转换为可持久化 Data URL；临时 `blob:` URL、脚本协议和非图片 Data URL
  必须在字段附近显示文字错误并拒绝提交。图片未设置、载入中和载入失败都要在组件 Frame 内显示
  可理解状态，不能展示浏览器破图图标或静默空白。empty/loading/ready/error 四态互斥；地址更新时
  必须立即移除旧图，旧请求迟到的 load/error 回调不能覆盖当前地址或已销毁组件。
- 二维码和条形码创建后必须带合法、可见的默认内容。码制校验错误与渲染模块错误使用紧凑的字段
  状态和 Frame 内状态呈现；内容背景与组件外观背景语义重复时，只保留专用内容字段。
- 混合值显示明确的“多值”状态，不能伪造默认颜色或数字。
- 数字输入在提交前保留草稿；空值、越界值或非法值不能静默写成 0，也不能夹紧成 min/max 后写入。
  Stepper 与 scrub 可以在明确边界停止，但键入值必须要求用户修正。
- 锁定组件的字段禁用，并在面板顶部提供明确的“解锁组件”动作。
- 错误在 blur/commit 时显示在字段下方，并通过 `aria-describedby` 关联。

## 10. 画布视觉合同

- Pasteboard 使用较深的暖纸灰 `--ptd-surface-canvas`；模板纸张使用纯白
  `--ptd-surface-paper` 和唯一的 paper shadow。
- Starter/Demo Schema 也必须使用中性白，不能通过 `pageConfig.background` 把默认纸张覆盖为
  奶油色或暖白；示例内容的正文使用近中性暖石墨，朱红仅保留真实校样语义。
- Paper shadow 由 1px 硬边框、约 4px 右下实体偏移与一层柔和长阴影组成，表达装配在工作台上的
  纸张；阴影不能复制到面板或组件卡片。
- Pasteboard 可以同时包含低对比斜线材质和 24px 工程网格；不使用包围标尺的工作区外框、
  菱形、纸张角点或无语义边缘刻线。所有装饰必须停留在应用 Chrome/Pasteboard，绝不能进入
  Paper 内容或导出结果。斜线和网格只承担接近不可察觉的装配区质感，其对比度必须明显低于标尺的
  次刻度、主刻度和数字；两层纹理叠加处也不得形成抢夺标尺读数的深色交点。
- 标尺打开时，在 Paper 顶部与左侧显示真实物理标尺。默认毫米模式使用 5mm 次刻度、10mm 主刻度、
  20mm 数字标签；px 模式以等价的 25/50/100 PTD Canvas px 标签显示。两种模式始终显示 `0`、
  实际页面终点和当前单位；横竖方向随 `pageDirection` 交换，切换不改变物理位置。
- 标尺关闭时，刻度、数字、基线和单位必须整体移除，不能残留一层“装饰版标尺”。
- 标尺是工具，不是装饰：刻度低对比，主刻度和当前指针读数清晰，数字使用 tabular nums。
- 水平标尺创建 X 轴位置的垂直参考线，垂直标尺创建 Y 轴位置的水平参考线；支持点击或拖拽
  创建、拖动调整、点击选择、双击或 Delete 删除。选中态必须在标尺显示三角标点，并显示
  `X/Y + 0.1mm` 精度位置标签。
- 指针在水平或垂直标尺移动时，应以当前新建颜色显示一条低透明临时参考线和 `X/Y + 0.1mm`
  位置标签；该预览只存在于组件本地状态，点击后才写入参考线会话。固定参考线的位置标签在
  选中或 Hover 该线时显示，不能要求先选中才能读取位置。
- 参考线提供墨蓝、朱红、翠绿、琥珀四种颜色，并支持整体显隐、锁定和清空。颜色既是新建默认色，
  也可修改当前选中参考线；锁定后禁止创建、移动、换色、删除和清空。
- 参考线位置必须被限制在当前页面物理边界内；普通方向键按 0.1mm 微调，Shift + 方向键按 1mm
  微调。页面方向变化时，超出新边界的参考线必须收回页面内。
- 参考线属于宿主编辑会话的 UI 状态，不写入 `TemplateSchema`、不进入打印/导出结果，也不创建
  模板撤销历史节点。后续若需持久化，应由宿主保存独立的编辑会话数据。
- 页面边距使用弱朱红虚线；选中框与控制点使用主题墨蓝。墨蓝只服务于交互，不作为面板或画布
  的大面积底色；朱红参考线是用户显式选择的编辑标记，不等同于固定校样装饰。
- 校样朱红可用于出血/危险边界、套准裁切标记和关键提醒，不用于普通选中框。
- 旋转、缩放和移动反馈不得改变组件本身的 Schema 样式。
- Editor tool 分为 persistent `activeTool` 与临时覆盖后的 `effectiveTool`。`H` 激活 persistent Hand，
  `V`/Escape 返回 Select；可编辑控件外按住 Space 只临时令 effective tool 为 Hand，keyup、blur 或
  卸载必须恢复原 Creation/Shape/Select，且不得修改 last-used Shape。
- Hand 只通过 pointer drag 改变 Canvas viewport 的 `scrollLeft/scrollTop`，idle 使用 `grab`、drag
  使用 `grabbing`；不得清除选择、移动 Paper/对象/参考线、触发 `onChange` 或写历史。pointer cancel、
  lost capture、工具切换与 window blur 都必须清理 pan session。
- 所有可用目录组件都是 draw tools。Pointer down/move 产生本地 preview；4 CSS px 以下、Escape、
  Hand/Space、pointer cancel、lost capture 与 blur 都只取消。有效 pointer up 归一化并 clamp 页面几何，
  再调用一次 `completeDrawnComponent()`。四种 Shape 连续绘制；其余工具完成一次后回到 Select；
  `RoySimpleText` / `RoyText` 同时进入内容编辑。内容 Frame 支持正反拖框且 Shift 不约束，QR 始终
  保持正方形；闭合 Shape 的 Shift 等比，Line 使用中点、欧氏长度与 `atan2` 角度。
- 框选区域使用清晰边框和不超过 8% 的选中色透明填充，不能遮挡待选组件。拖动接近 Canvas
  viewport 边缘时应按距离渐进自动滚动；滚动后的框选坐标必须使用实时 Paper 矩形重新换算，
  并限制在未缩放纸张边界内，不能继续沿用按下瞬间缓存的屏幕矩形。
- 画布 Overlay 测量需监听滚动、`window.resize`、DOM mutation、画布层与滚动容器的
  `ResizeObserver`，并通过 `requestAnimationFrame` 节流。
- 画布缩放只改变 stage/paper，不缩放应用 Chrome、Tooltip 或面板。

### 10.1 单选组件快捷条

- 单选组件时，选中框与 Selection Quick Bar 共享同一墨蓝语义；未激活组件常态不显示边界，
  Hover 才显示弱墨蓝虚线和不超过 5% 的墨蓝透明蒙版。Hover/选中边界必须由不参与盒模型的
  Overlay 绘制，不能用实体 `border` 缩小组件内容区域；多选只显示一套多选移动入口，不能为
  每个对象重复浮条。
- Quick Bar 显示组件名称，并提供拖动、锁定/解锁、复制、上移一层和删除五个高频动作；
  每个图标动作必须有 `aria-label`、Tooltip、focus-visible、disabled 和危险态。
- 锁定组件仍显示 Quick Bar，但除“解锁”外的破坏性或几何动作全部禁用。
- Quick Bar 必须作为独立 Selection Overlay 保持屏幕水平，不能继承组件旋转或画布缩放。
- Overlay 位置以 Canvas viewport 为可视边界：监听 viewport 滚动、`window.resize`、组件与 viewport
  的 `ResizeObserver`，经 `requestAnimationFrame` 节流；顶部空间不足时放到组件下方，水平位置
  必须 clamp，不能被侧栏或滚动视口裁切。
- Quick Bar 只改变编辑器 UI，不得写入 `TemplateSchema`、修改组件样式或出现在打印/导出结果中。

### 10.2 画布右键菜单

- 右击未选中的组件时，先把该组件设为当前单选；右击现有多选中的任一成员时，必须保留完整多选；
  右击 Paper 空白时清空组件选择并进入页面上下文。仅打开菜单或属性 Inspector 不写模板历史。
- 组件上下文复用现有编辑命令，提供属性、复制、剪切、锁定/解锁、适用时的组合/拆分、四种层级
  操作和删除；不能出现无实现的装饰菜单项。层级使用子菜单披露，危险删除使用明确危险态。
- 选择中包含锁定对象时，只允许属性、复制和明确解锁。剪切、删除、组合/拆分和层级调整在 UI 中
  不可用，并由 Store 保留第二层 no-op 防护，不能出现点击后无反馈的伪可用命令。
- 空白上下文提供页面属性和“粘贴到此处”。剪贴板为空时粘贴禁用；多选粘贴以所选对象的可视
  包围盒左上角对齐点击位置，保持内部相对布局，并在整体可容纳时限制到纸张物理边界。
- Paper 必须有可访问名称和可聚焦入口，同时支持鼠标右键、`Shift+F10` 与 Context Menu 键。
  菜单交互沿用 Radix roving focus，支持方向键、Enter 和 Escape，焦点态不能只依赖颜色。
- ContextMenu Portal 应用共享 `ptdTheme`，使用 `--ptd-layer-context`；在 compact Inspector/Resource
  Scrim 上方可见可操作，但仍低于 Modal、Toast 与 Tooltip。
- ContextMenu 主菜单与每一级子菜单都属于独立的 Portal 交互边界。Designer 根节点不得在其
  `pointerdown` 捕获阶段抢回焦点，全局快捷键也不得消费菜单的方向键、Enter 或 Escape；鼠标从
  父菜单移入子菜单后，子项必须保持可悬停、可点击并完成命令选择。

## 11. Portal 与主题合同

Radix Tooltip、DropdownMenu、ContextMenu、Popover 和 Dialog 通过 Portal 离开 Designer DOM
后，不会继承根节点 token。因此：

- Designer 根节点和每个 Portal Content 必须同时应用共享 `ptdTheme` 类。
- 每个可交互 Portal Content 必须声明统一的交互边界，使 Designer 根节点的焦点捕获和全局快捷键
  跳过该子树。React Portal 的事件仍沿 React 树传播，不能仅凭 DOM 已挂载到 `document.body`
  就假定事件与 Designer 隔离。
- 禁止在单个浮层内重新声明一套颜色或写 magic-number `z-index`。
- 浮层使用第 4.4 节语义 layer token。
- ContextMenu 必须高于普通 floating，低于 Modal、Toast 和 Tooltip。
- 新增 Portal 组件时至少验证：在左侧面板、右侧 Inspector、画布和 Modal 内均可见、可点、可键盘操作。

## 12. 交互状态与无障碍

每个交互组件至少实现：default、hover、focus-visible、active、disabled；异步组件还需
loading、error、success。

- `focus-visible` 使用 2px `--ptd-focus` 外环和 1px offset，不能裸写 `outline: none`。
- 无边框默认态不能削弱 focus/invalid：ring 必须覆盖完整控件外形且不参与盒模型，白色 Field、暖灰
  form canvas、深色 Header 和 Portal surface 都需要实际对比度验收。
- Radix Tabs/Menu/Radio 使用其 roving tabindex 和键盘语义，不重新发明键盘模型。
- 删除组件优先立即执行并允许撤销；批量或不可逆删除才使用确认对话框。
- 所有拖拽动作必须有点击、菜单或键盘替代路径。
- 锁定、警告和错误不能仅通过颜色表达。
- 可交互图标必须有可访问名称；装饰图标设置 `aria-hidden="true"`。

## 13. Motion

```css
.ptdTheme {
  --ptd-duration-instant: 120ms;
  --ptd-duration-state: 180ms;
  --ptd-duration-panel: 240ms;
  --ptd-ease-out: cubic-bezier(0.25, 1, 0.5, 1);
  --ptd-ease-in: cubic-bezier(0.7, 0, 0.84, 0);
}
```

- Hover、按下和颜色变化使用 120–180ms。
- 面板开合和浮层进入使用 180–240ms；退出约为进入的 75%。
- 只动画 `transform` 与 `opacity`。折叠内容使用 grid row 技术，不直接动画 height。
- 禁止 bounce、elastic、持续 pulse 和装饰性入场动画。
- `prefers-reduced-motion: reduce` 下移除空间位移，保留瞬时状态反馈。

## 14. 响应式与输入方式

PTD 是桌面优先的生产工具，但不能假设所有桌面设备都有精细鼠标。响应阈值以 Designer
容器宽度为准，不读取设备类型，也不只依赖 `window.innerWidth`。

- `>= 1440px`：wide；Rail、Floating Tool Dock、Resource Panel、Canvas、Inspector 默认同时显示。
- `1180–1439px`：standard；Rail、Floating Tool Dock 与 Inspector 默认显示，Resource Panel 默认折叠。
- `< 1180px`：compact；Rail 与 Floating Tool Dock 保持，Resource Panel 与 Inspector 作为互斥 overlay 打开。
- 从一个档位切到另一个档位时采用该档位的安全默认开合；用户使用 Rail 恢复资源面板，使用
  Floating Main Dock 的工作区组恢复 Inspector。
- compact overlay 打开一个必须关闭另一个；Scrim 或 Escape 可关闭当前 overlay。overlay 宽度以
  Designer 容器为边界，禁止使用 `100vw` 推算嵌入式设计器宽度。
- compact Scrim 位于 Selection 与 Sticky Panel 两个语义层之间：它必须覆盖 Quick Bar、选框和
  画布编辑 Chrome，但不能盖住当前打开的 Resource/Inspector overlay。
- 不因窄屏删除关键功能；只改变入口和披露层级。
- compact 的 Floating Main Dock 保留 Undo/Redo、Select/Hand、Text、Shape、More 与 Inspector；
  Image/Simple Table 可隐藏直接入口，但必须继续存在于 More Picker 的完整可用目录中。
- `pointer: coarse` 时取消依赖 Hover 才可发现的操作；正常宽度控件命中区域至少 40px。仅当 Designer
  容器 `<= 480px` 时，App Bar 高 38px、Rail 宽 36px，Floating Main Dock 的主要
  控件收紧为 32px、glyph 为 15–16px。组件级响应以容器查询为主；顶层全屏 Web 宿主允许额外使用
  `(pointer: coarse) and (max-width: 480px)` 作为手机 viewport fallback，但不能替代容器查询。
  fallback 必须以更高选择器优先级明确覆盖 40px coarse 合同，不能依赖构建后的规则排序，也不能通过
  UA 或设备型号猜测。
- 浏览器缩放到 200% 时，工具栏允许分组折叠，不能产生不可达的横向命令。

## 15. 稳定定制入口

核心区域必须提供稳定属性：

```tsx
<div data-ptd-region="designer" />
<header data-ptd-region="app-bar" />
<div data-ptd-region="application-menu" />
<div data-ptd-region="floating-tool-dock" />
<nav data-ptd-region="context-shelf" />
<aside data-ptd-region="left-sidebar" />
<div data-ptd-region="resource-panel" />
<div data-ptd-region="pages-panel" />
<div data-ptd-region="structure-panel" />
<div data-ptd-region="data-panel" />
<div data-ptd-region="asset-panel" />
<div data-ptd-region="component-tool-picker" />
<div data-ptd-region="canvas-viewport" />
<div data-ptd-region="paper" />
<aside data-ptd-region="inspector" />
<aside data-ptd-region="page-inspector" />
<footer data-ptd-region="status-bar" />
```

- CSS Module 类名是内部实现，不是宿主定制 API。
- 宿主可以在 Designer 外层覆盖公开 token，但不能依赖内部 DOM 顺序。
- 动态 Schema 样式仍具有画布内容内的最高优先级，不得污染应用 Chrome。

## 16. UX 文案与术语

- 统一使用：组件、结构、属性、数据源、全局设置、组合、拆分、锁定、解锁、置顶、置底。
- 按钮使用明确动作，如“添加文本”“解锁组件”“删除 3 个组件”，不用“确定”“提交”。
- 空状态说明下一步：`画布中还没有组件。选择一个组件工具，然后在纸张上拖动绘制。`
- 错误信息包含发生了什么、原因和恢复方式，不能只写“操作失败”。
- Tooltip 可补充快捷键，但不能承载完成任务所必需的唯一说明。

## 17. 禁止模式

- 大圆角 Card、Chip、Pill 成为默认构图。
- 多层卡片嵌套、每个区域都有阴影。
- 用装饰性 border 包围每个 Field、Button、Section、Dock 或 Popover；删除 border 后又用 inset bottom
  shadow 模拟蓝色下边条。
- 大面积/嵌套玻璃拟态、发光边框、彩色玻璃、紫蓝渐变、渐变文字或装饰性 blob；受控磨砂材质只按
  4.6 节用于少量真实悬浮 Chrome。
- 在工作台中使用营销页式大标题和大面积无功能留白。
- 文本缩写冒充图标；混用 Remix、Emoji 和不同描边风格。
- 依赖 Hover 的唯一操作入口。
- 每个面板维护不同的 Header、滚动区和空状态实现。
- Portal 内硬编码 `z-index`，或因层级问题关闭焦点陷阱。
- 为视觉方便修改 `TemplateSchema` 或把 UI 状态写入模板。

## 18. 验收门槛

每个 PR4 UI 切片至少完成：

1. 1600×1000、1366×768、1024×768 三种尺寸截图。
2. 无选择、单选、多选、锁定、面板折叠和画布滚动状态检查。
3. 键盘 Tab/Arrow/Escape、Tooltip、Menu 和 Focus Ring 检查。
4. 100% 与 200% 浏览器缩放检查；50%、75%、100%、150% 画布缩放检查。
5. CSS 扫描：无 `!important`、无静态 inline style、无未 token 化颜色和 magic z-index；应用 UI 中每个
   保留 border 均有功能语义，Field/selection/Dock 无常驻外框或 inset bottom indicator。
6. TypeScript、Vitest、ESLint、包构建、CSS Module 映射断言和 Web 生产构建通过。
7. 浏览器实际截图确认，而不是只验证 CSS 文件存在。
8. App Bar 浏览器断言覆盖 hover/focus 不展开、同一分类 click 开关、跨分类 click 切换、Header
   外部与 Escape 收起，以及 Designer 根节点不会在菜单 pointer down 时抢回焦点。
9. Data Panel 覆盖 JSON drop / file / paste、导入预检后显式应用、键盘字段绑定、record switch
   history-free、Frame 与面板双处文字诊断，以及 390px compact overlay 在 Scrim 上可操作且点击
   Scrim 能关闭。

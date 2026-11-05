# `apps/web`

React + Vite 的设计器 Host，也是 GHCR Web 镜像和完整自托管栈的浏览器入口。

## 当前行为

`src/App.tsx` 当前负责：

1. Web 先读取匿名 `/api/runtime`。演示模式下 `/` 展示公开产品落地页；普通自托管只显示紧凑登录页，
   已有 Session 仍由用户明确进入工作台。
2. `/app` 是受保护的文件工作台 Home；`/design/new` 是未保存编辑器，
   `/design/:key/:slug` 是已保存编辑器，`/preview/new` 与 `/preview/:key/:slug` 是独立打印预览路由。
   `/app?new=blank` 和 `/app?template=<id>` 只作为旧链接迁移输入，载入后替换为 canonical key URL。
3. Web 直接调用 `/api/account/me`，以服务端返回的账户、`authMode` 与 `isAdmin` 作为身份权威；不使用
   浏览器 Token、伪造身份请求头或前端认证开关。
4. GitHub OAuth 身份默认可直接试用。登录 CTA 在落地页与普通登录页复用同一个 44px 紧凑横向操作，
   使用明确尺寸的 GitHub 图标、单行标签和箭头。
5. Server 启用受限 Dev Auth Bypass 时，`/api/account/me` 返回 `authMode: 'dev-bypass'`，根页面 CTA
   显示“进入本地工作台”，直接访问 `/app` 无需 OAuth 跳转。
6. 登录后由 Web Document Controller 持有当前模板、服务器保存基线、文档 ID、opaque key、版本和
   `clean | dirty | saving | loading | error | conflict` 状态，并以 controlled 方式渲染 Designer。
7. New、Open、Save、Save As、Template Browser 与 Version History 通过 `DesignerHost` 接入同源
   模板 API。Open 与 Template Browser 统一返回文件工作台；clean 文档不阻断，dirty/conflict 文档
   先显示未保存确认。
8. 第一次 Save 直接使用当前页面标题 POST，不弹命名框；后续保存携带 `expectedVersion`；Save As 使用
   非模态 Command Sheet。409 会停止保存并进入 Conflict，不会自动覆盖。
9. 首次保存、另存为和文件工作台打开会同步 canonical URL。key 是资源身份，slug 只负责可读性并在
   载入后规范化；刷新、前进与后退都会恢复明确的 Home、Editor 或 Preview 状态。
10. Home 与 Editor 复用真实账户 Popover；GitHub 身份可从显式菜单项退出，Dev Auth Bypass 只标识本地
    身份而不显示无效退出。最近区最多读取 4 份模板详情并在卸载时取消，全部列表不追加详情请求。
11. 文件卡片提供轻量操作 Popover：重命名会以 `expectedVersion` 创建新版本，创建副本会建立独立文档，
    永久删除必须经过明确的风险确认；普通成功与失败反馈不额外打断文件浏览。
12. File → Version History 打开非模态 Side Sheet，按需读取版本详情并使用真实 `TemplatePreview` 预览；
    恢复旧快照前明确确认，并把快照写成新的最新版本。恢复携带当前 `expectedVersion`，409 后停止恢复、
    保留历史浏览并要求重新打开服务器文档，不会静默覆盖。
13. Designer 数据面板支持拖入、选择或粘贴 JSON object/object array，在应用前展示记录数、字段推断、
    共享限制诊断和现有绑定影响；应用后可搜索嵌套字段树、编辑字段名称/格式化、绑定当前组件属性、
    切换样例记录并在“设计内容 / 数据校样”之间切换。
14. Web 持久化 `TemplateSchema.data` canonical v2、组件结构化 bindings 与受限 sample records。旧
    `dataSource/dataSet/[::field::]` 可兼容读取，并只在显式保存边界迁移；单纯打开、缩略图或版本预览
    不会偷偷改写模板。
15. File → 打印预览导航到独立 `/preview/...` 路由，并在同一已挂载 Document Controller 中取得最新
    内存模板；返回设计路由保留未保存修改，直接刷新则重新读取最近一次服务器保存版本。
16. File → 导出 PDF 把同一结构化模板、显式 RenderContext 与 OutputOptions 发送到认证
    `POST /api/output/pdf` 并下载 Blob；未保存模板同样可用，预览/导出不改变 Dirty、History 或版本。
17. v1 的“打印”命令保持禁用并明确引导先导出 PDF，避免把 `window.print()` 误当成权威输出。
18. 演示模式在 `/app` 展示完整重置说明和 GitHub Fork 操作，在设计/预览深层路由展示可关闭的紧凑提示；
    文案明确访客模板每日北京时间 08:00 恢复，管理员数据不受影响。关闭状态在当前浏览器会话内保留。

`src/api/templateApi.ts` 覆盖模板 CRUD 和版本 list/get/restore 合同，负责 Cookie、AbortSignal、成功响应
运行时校验和结构化 HTTP/网络错误。`src/documents/useDocumentController.ts` 负责文档状态机和请求竞态；Dirty
通过 `@ptd/core` 的规范化序列化与保存基线比较，因此 Undo 回已保存内容会准确恢复 Clean。
Datasource 字段、样例和绑定属于模板更改，会自然进入 Dirty/History 和不可变版本；校样模式、字段搜索、
展开状态与当前记录索引是 Designer 实例状态，不写入模板或版本。

落地页中的产品画面来自真实 Designer 和真实 `TemplateSchema`。仅在 Vite DEV 模式下，
`/app?capture=product` 会跳过认证壳并渲染确定性的产品捕获文档；该入口不会进入生产构建的运行路径，
生成的截图资产位于 `public/assets/product/designer-proof-sheet.png`。

## 本地运行

从仓库根运行：

```bash
corepack pnpm dev
```

根脚本会先构建 Web 所依赖的 `core`、`components`、`export` 和 `react-designer`，再启动它们的 watch
与 Vite。默认地址通常为 <http://localhost:5173>。

只做生产构建：

```bash
corepack pnpm --filter @ptd/core build
corepack pnpm --filter @ptd/components build
corepack pnpm --filter @ptd/export build
corepack pnpm --filter @ptd/react-designer build
corepack pnpm --filter web typecheck
corepack pnpm --filter web test
corepack pnpm --filter web build
```

构建产物位于 `apps/web/dist/`，由 `docker/Dockerfile.web` 复制到 Nginx 镜像。

## 依赖边界

- Web 可以组合应用级路由、API client、身份与通知，但不应把这些职责塞进 `@ptd/react-designer`。
- 认证使用同源 `/api` 和 HttpOnly Cookie；不在浏览器存储 Token。
- Host 必须持有 `TemplateSchema`，并决定何时保存、载入和处理错误。
- 打印预览可在浏览器运行 framework-free compiler/renderer；PDF HTTP、认证和下载只属于 Web Host，
  不进入 `@ptd/react-designer`。
- 打印预览必须调用 `@ptd/export` 的 `preflightOutputDocument()`；它统一 compiler、字体/组件/图片 readiness、
  `TEXT_OVERFLOW`、资源阻断、空页和页面 bounds 诊断。预览会显示页码与 source component，error 诊断禁止导出。
- `RoySimpleText` 与 `RoyText` 的 `columnCount`、`columnGap`、`columnFill` 由共享 Components DOM/CSS 渲染，
  Web 预览不维护第二套多列实现；调整后仍保留单一组件 ID 和统一溢出诊断。
- Web/Server 持久化的是 canonical Datasource v2 定义、结构化绑定和用户明确保存的受限 sample records；
  临时 Host 运行时记录默认不写入模板。
- `<Designer renderContext={...}>` 是 Host 注入临时运行时数据、当前记录、locale、timeZone 和显式 `now`
  的类型安全入口。文件工作台与历史 `TemplatePreview` 默认不继承当前 Editor 的临时上下文；只有 Host
  明确传入时才渲染对应数据。
- 数据连接 Secret、Token、Cookie 和认证头不得进入 `TemplateSchema`、Web Local Storage 或模板版本；
  未来 REST 连接器必须由 Server 代理并独立设计安全合同。
- Host 需要声明 React、React DOM 和 `@preact/signals-react`，因为 peer dependency 不会经 `@ptd/react-designer` 传递。
- 本 Host 已在 `src/main.tsx` 显式导入设计器样式；其他 consumer 同样必须导入 `@ptd/react-designer/styles.css`。

## 下一阶段

当前持久化闭环之后的独立增强包括：

- 文件排序、服务端全文搜索、收藏、预设模板与真正的最近打开活动；当前只能准确使用 `updatedAt`
  表达“最近更新”。
- 409 Conflict 的服务器版本差异对比和更细的解决界面；当前已经保证不覆盖，并允许另存为或返回工作台
  重新打开服务器版本。
- 作为独立能力设计的本地崩溃恢复草稿与自动保存。
- 软删除与回收站；在 Server 仍使用不可恢复硬删除时不提供假的回收站入口。

Datasource v2 的 JSON 导入、字段树、组件绑定和实时校样现已完成。尚未实现的相邻能力包括：

- Excel/XLS/XLSX 与 CSV 本地文件解析。
- REST、GraphQL、SQL、Webhook 或其他 Server 数据源代理。
- 完整长文本逐行分页、复杂表格分组/小计和跨页合并规则。
- Word、批量导出与直接打印工作流；当前权威路径是先生成 PDF 再交给专业 PDF 阅读器打印。

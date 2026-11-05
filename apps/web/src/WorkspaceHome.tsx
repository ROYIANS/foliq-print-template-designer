import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { TemplatePreview } from '@ptd/react-designer'
import {
  RiAddLine,
  RiArrowRightUpLine,
  RiCloseLine,
  RiFileTextLine,
  RiFolder3Line,
  RiLoader4Line,
  RiMore2Line,
  RiSearchLine,
  RiTimeLine,
} from '@remixicon/react'
import {
  TemplateApiError,
  templateApi,
  type TemplateApi,
  type TemplateSummary,
} from './templateApi'
import { MAX_RECENT_TEMPLATE_PREVIEWS, useRecentTemplateDetails } from './useRecentTemplateDetails'
import { SaveAsSheet } from './SaveAsSheet'
import { DeleteTemplateDialog } from './WorkspaceDialogs'
import styles from './WorkspaceHome.module.css'

type HomeState =
  | { kind: 'loading' }
  | { kind: 'ready'; templates: TemplateSummary[] }
  | { kind: 'error'; message: string }

const EMPTY_TEMPLATES: TemplateSummary[] = []
type FileAction = 'rename' | 'duplicate' | 'delete'

interface WorkspaceHomeProps {
  api?: TemplateApi
  accountControl?: ReactNode
  demoNotice?: ReactNode
  onNew(): void
  onOpen(template: TemplateSummary): void
}

function loadError(error: unknown): string {
  if (!(error instanceof TemplateApiError)) return '模板列表载入失败，请稍后重试。'
  if (error.kind === 'unauthorized') return '登录状态已失效，请重新登录。'
  if (error.kind === 'forbidden') return '当前账户没有读取模板的权限。'
  if (error.kind === 'network') return '无法连接模板服务，请检查网络后重试。'
  return error.message
}

function actionError(error: unknown, action: FileAction): string {
  const label = action === 'rename' ? '重命名' : action === 'duplicate' ? '创建副本' : '删除'
  if (!(error instanceof TemplateApiError)) return `${label}模板失败，请稍后重试。`
  switch (error.kind) {
    case 'unauthorized':
      return '登录状态已失效，请重新登录后继续。'
    case 'forbidden':
      return `当前账户没有${label}模板的权限。`
    case 'not-found':
      return '模板已不存在，请重新载入文件列表。'
    case 'conflict':
      return `模板已在其他位置更新，请重新载入后再${label}。`
    case 'network':
      return `无法连接模板服务，${label}未完成，请检查网络后重试。`
    case 'bad-request':
      return `${label}内容未通过服务端校验，请检查后重试。`
    case 'invalid-response':
      return `模板服务返回了异常数据，无法确认${label}结果。`
    case 'server':
      return `模板服务暂时不可用，${label}未完成，请稍后重试。`
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function formatUpdatedAt(value: string, includeTime = true) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(new Date(value))
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <a className={styles.brand} data-compact={compact} href="/" aria-label="Foliq 首页">
      <span>
        <strong>Foliq</strong>
        {!compact ? <small>结构化文档设计器</small> : null}
      </span>
    </a>
  )
}

function FilePlaceholder() {
  return (
    <span className={styles.filePlaceholder} aria-hidden="true">
      <RiFileTextLine />
    </span>
  )
}

function TemplateGallery({
  title,
  templates,
  totalCount,
  details,
  onOpen,
  onRetry,
  actionMenuId,
  pendingId,
  actionsPending,
  onToggleActions,
  onRename,
  onDuplicate,
  onDelete,
}: {
  title: string
  templates: TemplateSummary[]
  totalCount: number
  details: ReturnType<typeof useRecentTemplateDetails>
  onOpen(template: TemplateSummary): void
  onRetry(): void
  actionMenuId?: number
  pendingId?: number
  actionsPending: boolean
  onToggleActions(templateId?: number): void
  onRename(template: TemplateSummary): void
  onDuplicate(template: TemplateSummary): void
  onDelete(template: TemplateSummary): void
}) {
  const actionRootRefs = useRef(new Map<number, HTMLDivElement>())
  const actionTriggerRefs = useRef(new Map<number, HTMLButtonElement>())

  useEffect(() => {
    if (actionMenuId === undefined) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && actionRootRefs.current.get(actionMenuId)?.contains(target))
        return
      onToggleActions(undefined)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onToggleActions(undefined)
      actionTriggerRefs.current.get(actionMenuId)?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [actionMenuId, onToggleActions])

  return (
    <section className={styles.gallerySection} aria-labelledby="workspace-gallery-title">
      <header className={styles.sectionHeader}>
        <h2 id="workspace-gallery-title">{title}</h2>
        <span>
          {templates.length === totalCount
            ? `${totalCount} 份`
            : `${templates.length} / ${totalCount} 份`}
        </span>
      </header>
      <div className={styles.fileGrid}>
        {templates.map((summary) => {
          const detail = details.get(summary.id)
          return (
            <article className={styles.fileCard} key={summary.id}>
              <button
                type="button"
                aria-label={`打开模板 ${summary.title}`}
                onClick={() => onOpen(summary)}
              >
                <span className={styles.cardPreview}>
                  {detail?.kind === 'ready' ? (
                    <TemplatePreview
                      template={detail.template.content}
                      label={`${summary.title} 预览`}
                      className={styles.templatePreview}
                    />
                  ) : null}
                  {detail?.kind === 'loading' ? (
                    <span className={styles.previewLoading} role="status">
                      <span aria-hidden="true" />
                      正在载入预览
                    </span>
                  ) : null}
                  {detail?.kind === 'error' ? (
                    <span className={styles.previewError} role="alert">
                      <strong>预览暂不可用</strong>
                      <span>{detail.message}</span>
                    </span>
                  ) : null}
                  {!detail ? <FilePlaceholder /> : null}
                </span>
                <span className={styles.cardMeta}>
                  <strong>{summary.title}</strong>
                  <span>
                    版本 {summary.version}
                    <time dateTime={summary.updatedAt}>
                      {formatUpdatedAt(summary.updatedAt, false)}
                    </time>
                  </span>
                </span>
                <RiArrowRightUpLine className={styles.cardArrow} aria-hidden="true" />
              </button>
              {detail?.kind === 'error' ? (
                <button className={styles.retryPreview} type="button" onClick={onRetry}>
                  重试预览
                </button>
              ) : null}
              <div
                ref={(node) => {
                  if (node) actionRootRefs.current.set(summary.id, node)
                  else actionRootRefs.current.delete(summary.id)
                }}
                className={styles.cardActions}
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  ref={(node) => {
                    if (node) actionTriggerRefs.current.set(summary.id, node)
                    else actionTriggerRefs.current.delete(summary.id)
                  }}
                  type="button"
                  aria-label={`模板操作 ${summary.title}`}
                  aria-haspopup="dialog"
                  aria-expanded={actionMenuId === summary.id}
                  aria-controls={`template-actions-${summary.id}`}
                  disabled={actionsPending}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() =>
                    onToggleActions(actionMenuId === summary.id ? undefined : summary.id)
                  }
                  aria-busy={pendingId === summary.id || undefined}
                >
                  {pendingId === summary.id ? (
                    <RiLoader4Line className={styles.actionSpinner} aria-hidden="true" />
                  ) : (
                    <RiMore2Line aria-hidden="true" />
                  )}
                </button>
                {actionMenuId === summary.id ? (
                  <div
                    id={`template-actions-${summary.id}`}
                    className={styles.actionMenu}
                    role="dialog"
                    aria-label={`${summary.title} 操作`}
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <button type="button" onClick={() => onRename(summary)}>
                      重命名
                    </button>
                    <button type="button" onClick={() => onDuplicate(summary)}>
                      创建副本
                    </button>
                    <button type="button" data-danger onClick={() => onDelete(summary)}>
                      删除模板
                    </button>
                  </div>
                ) : null}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

export function WorkspaceHome({
  api = templateApi,
  accountControl,
  demoNotice,
  onNew,
  onOpen,
}: WorkspaceHomeProps) {
  const [reloadToken, setReloadToken] = useState(0)
  const [previewRetryToken, setPreviewRetryToken] = useState(0)
  const [query, setQuery] = useState('')
  const [activeSection, setActiveSection] = useState<'recent' | 'all'>('recent')
  const [state, setState] = useState<HomeState>({ kind: 'loading' })
  const [actionMenuId, setActionMenuId] = useState<number>()
  const [pendingAction, setPendingAction] = useState<{ kind: FileAction; templateId: number }>()
  const [renameTarget, setRenameTarget] = useState<TemplateSummary>()
  const [renameError, setRenameError] = useState<string>()
  const [deleteTarget, setDeleteTarget] = useState<TemplateSummary>()
  const [deleteError, setDeleteError] = useState<string>()
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; message: string }>()
  const actionRequestRef = useRef<AbortController | undefined>(undefined)
  const actionPendingRef = useRef(false)

  useEffect(() => () => actionRequestRef.current?.abort(), [])

  useEffect(() => {
    const controller = new AbortController()
    void api
      .list(controller.signal)
      .then((templates) => setState({ kind: 'ready', templates }))
      .catch((error: unknown) => {
        if (!isAbortError(error)) setState({ kind: 'error', message: loadError(error) })
      })
    return () => controller.abort()
  }, [api, reloadToken])

  const retry = () => {
    setState({ kind: 'loading' })
    setReloadToken((value) => value + 1)
  }

  const replaceSummary = (record: TemplateSummary) => {
    setState((current) =>
      current.kind === 'ready'
        ? {
            kind: 'ready',
            templates: current.templates
              .map((item) => (item.id === record.id ? record : item))
              .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
          }
        : current,
    )
  }

  const runAction = async (
    kind: FileAction,
    templateId: number,
    action: (signal: AbortSignal) => Promise<void>,
    onError: (message: string) => void,
  ) => {
    if (actionPendingRef.current) return false
    actionPendingRef.current = true
    const controller = new AbortController()
    actionRequestRef.current = controller
    setActionMenuId(undefined)
    setPendingAction({ kind, templateId })
    setNotice(undefined)
    try {
      await action(controller.signal)
      return true
    } catch (error) {
      if (!isAbortError(error)) onError(actionError(error, kind))
      return false
    } finally {
      if (actionRequestRef.current === controller) {
        actionPendingRef.current = false
        actionRequestRef.current = undefined
        if (!controller.signal.aborted) setPendingAction(undefined)
      }
    }
  }

  const rename = async (target: TemplateSummary, title: string) => {
    setRenameError(undefined)
    return runAction(
      'rename',
      target.id,
      async (signal) => {
        const record = await api.get(target.id, signal)
        const content = { ...record.content, pageConfig: { ...record.content.pageConfig, title } }
        const updated = await api.update(
          target.id,
          { title, content, expectedVersion: record.version },
          signal,
        )
        replaceSummary(updated)
        setPreviewRetryToken((value) => value + 1)
        setRenameTarget(undefined)
        setNotice({ kind: 'success', message: `已重命名为“${updated.title}”` })
      },
      setRenameError,
    )
  }

  const duplicate = (target: TemplateSummary) =>
    runAction(
      'duplicate',
      target.id,
      async (signal) => {
        const record = await api.get(target.id, signal)
        const title = `${record.title} 副本`.slice(0, 120)
        const content = { ...record.content, pageConfig: { ...record.content.pageConfig, title } }
        const created = await api.create({ title, content }, signal)
        setState((current) =>
          current.kind === 'ready'
            ? { kind: 'ready', templates: [created, ...current.templates] }
            : current,
        )
        setNotice({ kind: 'success', message: `已创建“${created.title}”` })
      },
      (message) => setNotice({ kind: 'error', message }),
    )

  const remove = async (target: TemplateSummary) => {
    setDeleteError(undefined)
    return runAction(
      'delete',
      target.id,
      async (signal) => {
        await api.delete(target.id, signal)
        setState((current) =>
          current.kind === 'ready'
            ? {
                kind: 'ready',
                templates: current.templates.filter((item) => item.id !== target.id),
              }
            : current,
        )
        setDeleteTarget(undefined)
        setNotice({ kind: 'success', message: `已删除“${target.title}”` })
        document.getElementById('workspace-files')?.focus()
      },
      setDeleteError,
    )
  }

  const templates = state.kind === 'ready' ? state.templates : EMPTY_TEMPLATES
  const normalizedQuery = query.trim().toLocaleLowerCase('zh-CN')
  const filteredTemplates = useMemo(
    () =>
      normalizedQuery
        ? templates.filter((template) =>
            template.title.toLocaleLowerCase('zh-CN').includes(normalizedQuery),
          )
        : templates,
    [normalizedQuery, templates],
  )
  const previewIds = useMemo(
    () => filteredTemplates.slice(0, MAX_RECENT_TEMPLATE_PREVIEWS).map((template) => template.id),
    [filteredTemplates],
  )
  const details = useRecentTemplateDetails(api, previewIds, previewRetryToken)
  const displayedTemplates =
    activeSection === 'recent'
      ? filteredTemplates.slice(0, MAX_RECENT_TEMPLATE_PREVIEWS)
      : filteredTemplates

  return (
    <main className={styles.home}>
      <a className={styles.skipLink} href="#workspace-files">
        跳到文件列表
      </a>

      <aside className={styles.sidebar} aria-label="工作台导航">
        <Brand />
        <nav aria-label="文件导航">
          <button
            type="button"
            aria-pressed={activeSection === 'recent'}
            onClick={() => setActiveSection('recent')}
          >
            <RiTimeLine aria-hidden="true" />
            最近更新
          </button>
          <button
            type="button"
            aria-pressed={activeSection === 'all'}
            onClick={() => setActiveSection('all')}
          >
            <RiFolder3Line aria-hidden="true" />
            全部模板
          </button>
        </nav>
      </aside>

      <header className={styles.compactBar} data-ptd-home-shell="compact">
        <Brand compact />
        <div className={styles.compactActions}>
          <button type="button" aria-label="新建空白模板" onClick={onNew}>
            <RiAddLine aria-hidden="true" />
          </button>
          <div className={styles.accountSlot}>{accountControl}</div>
        </div>
      </header>

      <div id="workspace-files" className={styles.content} tabIndex={-1}>
        <header className={styles.pageHeader}>
          <div className={styles.pageTitle}>
            <h1>文件</h1>
          </div>
          <div className={styles.headerActions}>
            <div className={styles.searchField}>
              <RiSearchLine aria-hidden="true" />
              <input
                type="search"
                aria-label="按标题搜索模板"
                value={query}
                placeholder="搜索文件…"
                onChange={(event) => setQuery(event.currentTarget.value)}
              />
              {query ? (
                <button type="button" aria-label="清除搜索" onClick={() => setQuery('')}>
                  <RiCloseLine aria-hidden="true" />
                </button>
              ) : null}
            </div>
            <button className={styles.newButton} type="button" onClick={onNew}>
              <RiAddLine aria-hidden="true" />
              新建模板
            </button>
          </div>
        </header>

        {demoNotice ? <div className={styles.demoNotice}>{demoNotice}</div> : null}

        {state.kind === 'loading' ? (
          <section className={styles.systemState} role="status" aria-label="正在载入文件工作台">
            <span className={styles.spinner} aria-hidden="true" />
            <div>
              <strong>正在读取模板</strong>
              <p>正在同步服务器中的文件列表。</p>
            </div>
          </section>
        ) : null}

        {state.kind === 'error' ? (
          <section className={styles.systemState} role="alert">
            <div>
              <strong>文件暂时无法载入</strong>
              <p>{state.message}</p>
            </div>
            <button type="button" onClick={retry}>
              重新载入
            </button>
          </section>
        ) : null}

        {state.kind === 'ready' && templates.length === 0 ? (
          <section className={styles.emptyState}>
            <div>
              <h2>创建第一份模板</h2>
              <p>从空白 A4 页面开始设计，首次保存后会出现在这里。</p>
            </div>
            <button type="button" onClick={onNew}>
              <RiAddLine aria-hidden="true" />
              新建空白模板
            </button>
          </section>
        ) : null}

        {state.kind === 'ready' && templates.length > 0 && filteredTemplates.length === 0 ? (
          <section className={styles.noResults} role="status">
            <h2>没有匹配的模板</h2>
            <p>没有标题包含“{query.trim()}”的模板。</p>
            <button type="button" onClick={() => setQuery('')}>
              清除搜索
            </button>
          </section>
        ) : null}

        {state.kind === 'ready' && filteredTemplates.length > 0 ? (
          <div className={styles.documentSections}>
            <TemplateGallery
              title={activeSection === 'recent' ? '最近更新' : '全部模板'}
              templates={displayedTemplates}
              totalCount={templates.length}
              details={details}
              onOpen={onOpen}
              onRetry={() => setPreviewRetryToken((value) => value + 1)}
              actionMenuId={actionMenuId}
              pendingId={pendingAction?.templateId}
              actionsPending={pendingAction !== undefined}
              onToggleActions={setActionMenuId}
              onRename={(template) => {
                setActionMenuId(undefined)
                setRenameError(undefined)
                setRenameTarget(template)
              }}
              onDuplicate={(template) => void duplicate(template)}
              onDelete={(template) => {
                setActionMenuId(undefined)
                setDeleteError(undefined)
                setDeleteTarget(template)
              }}
            />
          </div>
        ) : null}
      </div>
      {notice ? (
        <div
          className={styles.notice}
          data-kind={notice.kind}
          role={notice.kind === 'error' ? 'alert' : 'status'}
        >
          {notice.message}
          <button type="button" aria-label="关闭文件操作提示" onClick={() => setNotice(undefined)}>
            <RiCloseLine aria-hidden="true" />
          </button>
        </div>
      ) : null}
      {renameTarget ? (
        <SaveAsSheet
          mode="rename"
          defaultValue={renameTarget.title}
          pending={pendingAction?.kind === 'rename'}
          error={renameError}
          onClose={() => setRenameTarget(undefined)}
          onConfirm={(title) => rename(renameTarget, title).then(() => undefined)}
        />
      ) : null}
      {deleteTarget ? (
        <DeleteTemplateDialog
          title={deleteTarget.title}
          pending={pendingAction?.kind === 'delete'}
          error={deleteError}
          onCancel={() => setDeleteTarget(undefined)}
          onDelete={() => remove(deleteTarget).then(() => undefined)}
        />
      ) : null}
    </main>
  )
}

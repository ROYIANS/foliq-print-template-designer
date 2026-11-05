import { useEffect, useRef, useState } from 'react'
import { TemplatePreview } from '@ptd/react-designer'
import { RiCloseLine } from '@remixicon/react'
import {
  TemplateApiError,
  templateApi,
  type TemplateApi,
  type TemplateVersionRecord,
  type TemplateVersionSummary,
} from '../../api/templateApi'
import styles from './VersionHistorySheet.module.css'

interface VersionHistorySheetProps {
  api?: TemplateApi
  templateId: number
  currentVersion: number
  title: string
  canRestore?: boolean
  disabledReason?: string
  restorePending?: boolean
  suspended?: boolean
  onClose(): void
  onRequestRestore(version: number): void | Promise<void>
}

type VersionListResult =
  | { key: string; kind: 'ready'; versions: TemplateVersionSummary[] }
  | { key: string; kind: 'error'; message: string }

type VersionPreviewResult =
  | { key: string; kind: 'ready'; preview: TemplateVersionRecord }
  | { key: string; kind: 'error'; message: string }

function message(error: unknown) {
  if (!(error instanceof TemplateApiError)) return '版本历史载入失败，请稍后重试。'
  if (error.kind === 'unauthorized') return '登录状态已失效，请重新登录。'
  if (error.kind === 'forbidden') return '当前账户没有读取版本历史的权限。'
  if (error.kind === 'network') return '无法连接模板服务，请检查网络后重试。'
  if (error.kind === 'not-found') return '模板或版本已不存在。'
  if (error.kind === 'invalid-response') return '模板服务返回了异常数据，请稍后重试。'
  if (error.kind === 'bad-request') return '版本请求未通过服务端校验，请重新打开模板后再试。'
  if (error.kind === 'conflict') return '服务器版本已变化，请重新打开模板后再试。'
  return '模板服务暂时不可用，请稍后重试。'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function VersionHistorySheet({
  api = templateApi,
  templateId,
  currentVersion,
  title,
  canRestore = true,
  disabledReason,
  restorePending = false,
  suspended = false,
  onClose,
  onRequestRestore,
}: VersionHistorySheetProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  const restorePendingRef = useRef(restorePending)
  const suspendedRef = useRef(suspended)
  const listGenerationRef = useRef(0)
  const previewGenerationRef = useRef(0)
  const [listReloadToken, setListReloadToken] = useState(0)
  const [previewReloadToken, setPreviewReloadToken] = useState(0)
  const [listResult, setListResult] = useState<VersionListResult>()
  const [selection, setSelection] = useState<{ key: string; version?: number }>()
  const [previewResult, setPreviewResult] = useState<VersionPreviewResult>()

  useEffect(() => {
    onCloseRef.current = onClose
    restorePendingRef.current = restorePending
    suspendedRef.current = suspended
  }, [onClose, restorePending, suspended])

  const listKey = `${templateId}:${listReloadToken}`
  const activeList = listResult?.key === listKey ? listResult : undefined
  const versions = activeList?.kind === 'ready' ? activeList.versions : undefined
  const selectedVersion = selection?.key === listKey ? selection.version : undefined
  const previewKey =
    selectedVersion === undefined
      ? undefined
      : `${listKey}:${selectedVersion}:${previewReloadToken}`
  const activePreview = previewResult?.key === previewKey ? previewResult : undefined
  const preview = activePreview?.kind === 'ready' ? activePreview.preview : undefined

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || restorePendingRef.current || suspendedRef.current) return
      event.preventDefault()
      onCloseRef.current()
    }
    document.addEventListener('keydown', onKeyDown)
    closeRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previous?.focus()
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const generation = ++listGenerationRef.current
    void api
      .listVersions(templateId, controller.signal)
      .then((items) => {
        if (controller.signal.aborted || listGenerationRef.current !== generation) return
        setListResult({ key: listKey, kind: 'ready', versions: items })
        setSelection({ key: listKey, version: items[0]?.version })
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted || listGenerationRef.current !== generation) return
        setListResult({ key: listKey, kind: 'error', message: message(cause) })
        setSelection({ key: listKey })
      })
    return () => controller.abort()
  }, [api, listKey, templateId])

  useEffect(() => {
    if (selectedVersion === undefined || previewKey === undefined) return
    const controller = new AbortController()
    const generation = ++previewGenerationRef.current
    void api
      .getVersion(templateId, selectedVersion, controller.signal)
      .then((record) => {
        if (controller.signal.aborted || previewGenerationRef.current !== generation) return
        setPreviewResult({ key: previewKey, kind: 'ready', preview: record })
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted || previewGenerationRef.current !== generation) return
        setPreviewResult({ key: previewKey, kind: 'error', message: message(cause) })
      })
    return () => controller.abort()
  }, [api, previewKey, selectedVersion, templateId])

  const previewMatchesSelection = preview?.version === selectedVersion
  const restoreUnavailableReason = restorePending
    ? '正在恢复所选版本…'
    : !canRestore
      ? (disabledReason ?? '当前文档状态不允许恢复版本')
      : selectedVersion === undefined
        ? '请选择一个历史版本'
        : selectedVersion === currentVersion
          ? '这是当前服务器版本'
          : !previewMatchesSelection
            ? activePreview?.kind === 'error'
              ? '所选版本预览载入失败，请重试预览'
              : '请等待所选版本预览载入完成'
            : undefined

  return (
    <aside
      className={styles.sheet}
      aria-label="版本历史"
      aria-busy={restorePending || undefined}
      data-suspended={suspended || undefined}
      data-ptd-editor-interactive
    >
      <header>
        <div>
          <h2>版本历史</h2>
          <p>{title}</p>
        </div>
        <button
          ref={closeRef}
          type="button"
          aria-label="关闭版本历史"
          disabled={restorePending || suspended}
          onClick={onClose}
        >
          <RiCloseLine aria-hidden="true" />
        </button>
      </header>
      <div className={styles.body}>
        <nav aria-label="历史版本列表">
          {!activeList ? <p role="status">正在读取版本历史…</p> : null}
          {activeList?.kind === 'error' ? (
            <div className={styles.stateMessage}>
              <p role="alert">{activeList.message}</p>
              <button type="button" onClick={() => setListReloadToken((value) => value + 1)}>
                重试版本列表
              </button>
            </div>
          ) : null}
          {versions?.length === 0 ? <p role="status">这个模板还没有可用的历史版本。</p> : null}
          {versions?.map((version) => (
            <button
              key={version.version}
              type="button"
              aria-pressed={selectedVersion === version.version}
              onClick={() => setSelection({ key: listKey, version: version.version })}
            >
              <span>
                <strong>版本 {version.version}</strong>
                {version.version === currentVersion ? <small>当前版本</small> : null}
              </span>
              <span>{version.title}</span>
              <time dateTime={version.createdAt}>{formatDate(version.createdAt)}</time>
            </button>
          ))}
        </nav>
        <section className={styles.preview} aria-label="历史版本预览">
          {previewMatchesSelection && preview ? (
            <TemplatePreview
              template={preview.content}
              label={`版本 ${preview.version} 预览`}
              className={styles.templatePreview}
            />
          ) : null}
          {selectedVersion === undefined ? (
            <p role="status">
              {versions?.length === 0 ? '暂无可预览版本。' : '从左侧选择一个版本以查看快照。'}
            </p>
          ) : null}
          {selectedVersion !== undefined && !activePreview ? (
            <p role="status">正在载入版本预览…</p>
          ) : null}
          {activePreview?.kind === 'error' ? (
            <div className={styles.stateMessage}>
              <p role="alert">{activePreview.message}</p>
              <button type="button" onClick={() => setPreviewReloadToken((value) => value + 1)}>
                重试版本预览
              </button>
            </div>
          ) : null}
        </section>
      </div>
      <footer>
        <span>{restoreUnavailableReason ?? `将版本 ${selectedVersion} 恢复为新的最新版本`}</span>
        <button
          type="button"
          disabled={restoreUnavailableReason !== undefined}
          onClick={() => {
            if (selectedVersion !== undefined && restoreUnavailableReason === undefined) {
              void onRequestRestore(selectedVersion)
            }
          }}
        >
          {restorePending ? '正在恢复…' : '恢复此版本'}
        </button>
      </footer>
    </aside>
  )
}

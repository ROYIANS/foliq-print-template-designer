import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Designer,
  type DesignerHost,
  type DesignerHostCommandId,
  type TemplateSchema,
} from '@ptd/react-designer'
import { AccountMenu } from './pages/workspace/AccountMenu'
import { authClient } from './auth/auth-client'
import { DemoModeNotice } from './pages/workspace/DemoModeNotice'
import { HelpSheet, type HelpSheetView } from './pages/workspace/HelpSheet'
import { LandingPage, type AccessState, type AccountUser } from './pages/landing/LandingPage'
import { LoginPage } from './pages/login/LoginPage'
import {
  documentUrl,
  isProductCaptureSearch,
  landingNoticeFromSearch,
  landingUrl,
  newDocumentUrl,
  routeFromPathname,
  workspaceViewFromLocation,
  type WorkspaceView,
} from './routing/navigation'
import { SaveAsSheet } from './pages/workspace/SaveAsSheet'
import { createOutputJob } from './output/outputJob'
import { OutputPreview } from './pages/preview/OutputPreview'
import { downloadOutputPdf, outputApi, outputApiErrorMessage } from './output/outputApi'
import {
  PRODUCT_CAPTURE_KEYS,
  PRODUCT_CAPTURE_TEMPLATES,
  type ProductCaptureKey,
} from './documents/templates'
import {
  downloadTemplateJson,
  readTemplateJsonFile,
  templateJsonErrorMessage,
} from './documents/templateJson'
import {
  documentHostCommandStates,
  shouldConfirmDocumentExit,
  useDocumentController,
  type TemplateLocator,
} from './documents/useDocumentController'
import { RestoreVersionDialog, UnsavedDialog } from './pages/workspace/WorkspaceDialogs'
import { WorkspaceHome } from './pages/workspace/WorkspaceHome'
import { VersionHistorySheet } from './pages/workspace/VersionHistorySheet'
import { useRuntimeConfig } from './api/runtimeConfig'
import type { TemplateRecord } from './api/templateApi'
import styles from './App.module.css'

interface LocationState {
  pathname: string
  search: string
}

type NavigationBlocker = (proceed: () => void) => boolean

const HISTORY_INDEX_KEY = '__foliqNavigationIndex'

function currentLocation(): LocationState {
  return { pathname: window.location.pathname, search: window.location.search }
}

function parseAccountUser(value: unknown): AccountUser {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Account response must be an object')
  }
  const record = value as Record<string, unknown>
  if (
    typeof record['id'] !== 'string' ||
    typeof record['name'] !== 'string' ||
    typeof record['email'] !== 'string' ||
    !(record['image'] === null || typeof record['image'] === 'string') ||
    (record['authMode'] !== 'github' && record['authMode'] !== 'dev-bypass') ||
    typeof record['isAdmin'] !== 'boolean'
  ) {
    throw new Error('Account response is missing required user fields')
  }
  return {
    id: record['id'],
    name: record['name'],
    email: record['email'],
    image: record['image'],
    authMode: record['authMode'],
    isAdmin: record['isAdmin'],
  }
}

function historyIndex(state: unknown): number | undefined {
  if (typeof state !== 'object' || state === null || Array.isArray(state)) return undefined
  const value = (state as Record<string, unknown>)[HISTORY_INDEX_KEY]
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined
}

function historyState(index: number): Record<string, unknown> {
  const current = window.history.state
  const base =
    typeof current === 'object' && current !== null && !Array.isArray(current)
      ? (current as Record<string, unknown>)
      : {}
  return { ...base, [HISTORY_INDEX_KEY]: index }
}

export function useBrowserLocation() {
  const initialIndex = historyIndex(window.history.state) ?? 0
  const [location, setLocation] = useState(currentLocation)
  const currentIndexRef = useRef(initialIndex)
  const blockerRef = useRef<NavigationBlocker | undefined>(undefined)
  const restoringPopRef = useRef(false)
  const bypassPopRef = useRef(false)

  if (historyIndex(window.history.state) === undefined) {
    window.history.replaceState(historyState(initialIndex), '', window.location.href)
  }

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const target = currentLocation()
      const current = location
      const targetIndex = historyIndex(event.state)

      if (restoringPopRef.current) {
        restoringPopRef.current = false
        setLocation(current)
        return
      }

      if (bypassPopRef.current) {
        bypassPopRef.current = false
        if (targetIndex !== undefined) currentIndexRef.current = targetIndex
        setLocation(target)
        window.scrollTo({ top: 0, behavior: 'auto' })
        return
      }

      if (target.pathname === current.pathname && target.search === current.search) {
        if (targetIndex !== undefined) currentIndexRef.current = targetIndex
        setLocation(target)
        return
      }

      const delta = targetIndex === undefined ? -1 : targetIndex - currentIndexRef.current
      const proceed = () => {
        bypassPopRef.current = true
        window.history.go(delta)
      }
      if (delta !== 0 && blockerRef.current?.(proceed)) {
        restoringPopRef.current = true
        window.history.go(-delta)
        return
      }

      if (targetIndex !== undefined) currentIndexRef.current = targetIndex
      setLocation(target)
      window.scrollTo({ top: 0, behavior: 'auto' })
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [location])

  const commitNavigation = useCallback((href: string, replace: boolean) => {
    const nextIndex = replace ? currentIndexRef.current : currentIndexRef.current + 1
    window.history[replace ? 'replaceState' : 'pushState'](historyState(nextIndex), '', href)
    currentIndexRef.current = nextIndex
    setLocation(currentLocation())
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  const navigate = useCallback(
    (href: string, replace = false, force = false) => {
      const proceed = () => commitNavigation(href, replace)
      if (!force && blockerRef.current?.(proceed)) return
      proceed()
    },
    [commitNavigation],
  )

  const runGuarded = useCallback((action: () => void) => {
    if (blockerRef.current?.(action)) return
    action()
  }, [])

  const registerBlocker = useCallback((blocker: NavigationBlocker) => {
    blockerRef.current = blocker
    return () => {
      if (blockerRef.current === blocker) blockerRef.current = undefined
    }
  }, [])

  return { location, navigate, registerBlocker, runGuarded }
}

function useAccountAccess() {
  const session = authClient.useSession()
  const sessionUserId = session.data?.user.id
  const [retryToken, setRetryToken] = useState(0)
  const [snapshot, setSnapshot] = useState<{
    sessionUserId: string | null
    access: AccessState
  }>()

  useEffect(() => {
    const controller = new AbortController()
    const checkedSessionUserId = sessionUserId ?? null

    void fetch('/api/account/me', { credentials: 'include', signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401 || response.status === 403) {
          setSnapshot({
            sessionUserId: checkedSessionUserId,
            access:
              sessionUserId || response.status === 403 ? { kind: 'denied' } : { kind: 'signedOut' },
          })
          return
        }
        if (!response.ok) throw new Error(`Account request failed: ${response.status}`)
        setSnapshot({
          sessionUserId: checkedSessionUserId,
          access: { kind: 'allowed', user: parseAccountUser(await response.json()) },
        })
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setSnapshot({ sessionUserId: checkedSessionUserId, access: { kind: 'error' } })
        }
      })

    return () => controller.abort()
  }, [retryToken, sessionUserId])

  const retry = useCallback(() => {
    setSnapshot(undefined)
    setRetryToken((value) => value + 1)
  }, [])
  const access =
    snapshot?.sessionUserId === (sessionUserId ?? null)
      ? snapshot.access
      : ({ kind: 'checking' } satisfies AccessState)
  return { access, retry }
}

type WorkspaceDialog = 'new' | 'leave' | 'import'

function signOut() {
  return authClient.signOut().then(() => window.location.assign('/'))
}

function WorkspaceEditor({
  user,
  demoMode,
  view,
  navigate,
  registerBlocker,
  runGuarded,
}: {
  user: AccountUser
  demoMode: boolean
  view: Exclude<WorkspaceView, { kind: 'home' }>
  navigate(href: string, replace?: boolean, force?: boolean): void
  registerBlocker(blocker: NavigationBlocker): () => void
  runGuarded(action: () => void): void
}) {
  const [dialog, setDialog] = useState<WorkspaceDialog>()
  const [helpSheet, setHelpSheet] = useState<HelpSheetView>()
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | undefined>()
  const [saveAsOpen, setSaveAsOpen] = useState(false)
  const [saveAsPending, setSaveAsPending] = useState(false)
  const [saveAsError, setSaveAsError] = useState<string>()
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false)
  const [restoreVersion, setRestoreVersion] = useState<number>()
  const [restorePending, setRestorePending] = useState(false)
  const [restoreError, setRestoreError] = useState<string>()
  const [pendingImport, setPendingImport] = useState<TemplateSchema>()
  const [templateExchangeError, setTemplateExchangeError] = useState<string>()
  const [outputExporting, setOutputExporting] = useState(false)
  const [outputExportError, setOutputExportError] = useState<string>()
  const templateFileInputRef = useRef<HTMLInputElement>(null)
  const allowUnloadRef = useRef(false)
  const surface = view.kind === 'template' || view.kind === 'new' ? view.surface : 'design'
  const requestedTemplate = useMemo<TemplateLocator | undefined>(() => {
    if (view.kind === 'template') return { kind: 'key', value: view.templateKey }
    if (view.kind === 'legacy-template') return { kind: 'id', value: view.templateId }
    if (view.kind === 'invalid-template') return { kind: 'invalid' }
    return undefined
  }, [view])
  const document = useDocumentController({
    requestedTemplate,
    onLocationChange: (record: TemplateRecord | undefined, replace) => {
      navigate(
        record ? documentUrl('design', record.key, record.title) : newDocumentUrl('design'),
        replace,
        true,
      )
    },
  })

  useEffect(() => {
    if (
      view.kind !== 'template' ||
      document.state.key !== view.templateKey ||
      document.state.status === 'loading' ||
      document.state.status === 'error'
    ) {
      return
    }
    const canonical = documentUrl(view.surface, view.templateKey, document.state.title)
    if (window.location.pathname !== canonical) navigate(canonical, true, true)
  }, [document.state.key, document.state.status, document.state.title, navigate, view])
  const hasUnsavedChanges = shouldConfirmDocumentExit(document.state)
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges)
  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges
  }, [hasUnsavedChanges])
  const restoreDisabledReason =
    document.state.status === 'conflict'
      ? '服务器版本已变化，请重新打开模板后再恢复'
      : document.state.status === 'error'
        ? '当前模板处于错误状态，请重新打开后再恢复'
        : document.state.status === 'loading'
          ? '请等待模板载入完成'
          : document.state.status === 'saving'
            ? '请等待当前操作完成'
            : document.state.id === undefined || document.state.serverVersion === undefined
              ? '请先保存模板'
              : undefined
  const canRestore = restoreDisabledReason === undefined

  const closeTransientSurfaces = useCallback(() => {
    setSaveAsOpen(false)
    setSaveAsError(undefined)
    setHelpSheet(undefined)
    setVersionHistoryOpen(false)
    setRestoreVersion(undefined)
    setRestoreError(undefined)
    setOutputExportError(undefined)
  }, [])

  useEffect(
    () =>
      registerBlocker((proceed) => {
        if (!hasUnsavedChanges) return false
        closeTransientSurfaces()
        setPendingNavigation(() => () => {
          allowUnloadRef.current = true
          proceed()
        })
        setDialog('leave')
        return true
      }),
    [closeTransientSurfaces, hasUnsavedChanges, registerBlocker],
  )

  useEffect(() => {
    if (!hasUnsavedChanges) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowUnloadRef.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [hasUnsavedChanges])

  const requestHome = useCallback(() => {
    closeTransientSurfaces()
    navigate('/app')
  }, [closeTransientSurfaces, navigate])

  const applyImportedTemplate = useCallback(
    (template: TemplateSchema) => {
      closeTransientSurfaces()
      setDialog(undefined)
      setPendingImport(undefined)
      setTemplateExchangeError(undefined)
      document.importDocument(template)
    },
    [closeTransientSurfaces, document],
  )

  const exportOutput = useCallback(async (template: TemplateSchema, now?: string) => {
    setOutputExporting(true)
    setOutputExportError(undefined)
    try {
      const job = createOutputJob(template, 'export', now)
      const download = await outputApi.createPdf(job, template.pageConfig.title)
      downloadOutputPdf(download)
    } catch (error) {
      setOutputExportError(outputApiErrorMessage(error))
      throw error
    } finally {
      setOutputExporting(false)
    }
  }, [])

  const host = useMemo<DesignerHost>(
    () => ({
      document: {
        id: document.state.id?.toString(),
        title: document.state.title,
        version: document.state.serverVersion,
        status: document.state.status,
        message: document.state.message,
      },
      commands: {
        ...documentHostCommandStates(document.state),
        preview:
          document.state.status === 'loading'
            ? { enabled: false, reason: '请等待模板载入完成' }
            : { enabled: true },
        print: { enabled: false, reason: '请先导出 PDF 后打印' },
        exportDocument:
          document.state.status === 'loading'
            ? { enabled: false, reason: '请等待模板载入完成' }
            : { enabled: true, pending: outputExporting },
        keyboardShortcuts: { enabled: true },
        documentation: { enabled: true },
        about: { enabled: true },
      },
      onCommandError: (command, error) => {
        if (command === 'importTemplate' || command === 'exportTemplate') {
          setTemplateExchangeError(templateJsonErrorMessage(error))
        }
        if (command === 'exportDocument') setOutputExportError(outputApiErrorMessage(error))
      },
      onCommand: async (command: DesignerHostCommandId, context) => {
        switch (command) {
          case 'new':
            closeTransientSurfaces()
            if (hasUnsavedChanges) setDialog('new')
            else document.newDocument()
            return
          case 'open':
          case 'templateBrowser':
            requestHome()
            return
          case 'save':
            await document.save(context.template)
            return
          case 'saveAs':
            closeTransientSurfaces()
            setSaveAsError(undefined)
            setSaveAsOpen(true)
            return
          case 'versionHistory':
            closeTransientSurfaces()
            setVersionHistoryOpen(true)
            return
          case 'importTemplate':
            closeTransientSurfaces()
            setTemplateExchangeError(undefined)
            if (templateFileInputRef.current) {
              templateFileInputRef.current.value = ''
              templateFileInputRef.current.click()
            }
            return
          case 'exportTemplate':
            setTemplateExchangeError(undefined)
            downloadTemplateJson(context.template, document.state.title)
            return
          case 'preview':
            closeTransientSurfaces()
            navigate(
              document.state.key
                ? documentUrl('preview', document.state.key, document.state.title)
                : newDocumentUrl('preview'),
              false,
              true,
            )
            return
          case 'exportDocument':
            await exportOutput(context.template)
            return
          case 'keyboardShortcuts':
            closeTransientSurfaces()
            setHelpSheet('shortcuts')
            return
          case 'documentation':
            closeTransientSurfaces()
            runGuarded(() => window.location.assign('/#product'))
            return
          case 'about':
            closeTransientSurfaces()
            setHelpSheet('about')
            return
          default:
            return
        }
      },
    }),
    [
      closeTransientSurfaces,
      document,
      exportOutput,
      hasUnsavedChanges,
      outputExporting,
      requestHome,
      runGuarded,
      navigate,
    ],
  )

  const routedPreviewJob = useMemo(
    () => createOutputJob(document.state.currentTemplate, 'print'),
    [document.state.currentTemplate],
  )

  if (surface === 'preview') {
    if (document.state.status === 'loading' || document.state.status === 'error') {
      return (
        <main
          className={styles.workspaceLoading}
          role={document.state.status === 'error' ? 'alert' : 'status'}
        >
          {document.state.status === 'loading' ? <span aria-hidden="true" /> : null}
          {document.state.message ?? '正在准备打印预览…'}
        </main>
      )
    }
    return (
      <main className={styles.app}>
        <OutputPreview
          template={routedPreviewJob.template}
          renderContext={routedPreviewJob.renderContext}
          options={routedPreviewJob.options}
          exporting={outputExporting}
          exportError={outputExportError}
          onClose={() =>
            navigate(
              document.state.key
                ? documentUrl('design', document.state.key, document.state.title)
                : newDocumentUrl('design'),
              false,
              true,
            )
          }
          onExport={() => {
            void exportOutput(routedPreviewJob.template, routedPreviewJob.options.now).catch(
              () => undefined,
            )
          }}
        />
        {demoMode ? <DemoModeNotice compact /> : null}
      </main>
    )
  }

  return (
    <main className={styles.app}>
      <a className={styles.workspaceSkipLink} href="#designer-workspace">
        跳到设计器
      </a>
      <div id="designer-workspace" className={styles.designerHost} tabIndex={-1}>
        <Designer
          value={document.state.currentTemplate}
          onChange={document.setCurrentTemplate}
          host={host}
        />
      </div>
      <input
        ref={templateFileInputRef}
        className={styles.templateFileInput}
        type="file"
        accept="application/json,.json,.foliq.json"
        tabIndex={-1}
        aria-hidden="true"
        onChange={async (event) => {
          const input = event.currentTarget
          const file = input.files?.[0]
          input.value = ''
          if (!file) return
          setTemplateExchangeError(undefined)
          try {
            const template = await readTemplateJsonFile(file)
            if (hasUnsavedChangesRef.current) {
              setPendingImport(template)
              setDialog('import')
              return
            }
            applyImportedTemplate(template)
          } catch (error) {
            setTemplateExchangeError(templateJsonErrorMessage(error))
          }
        }}
      />
      {templateExchangeError ? (
        <div className={styles.templateExchangeError} role="alert">
          <div>
            <strong>模板 JSON 操作未完成</strong>
            <span>{templateExchangeError}</span>
          </div>
          <button
            type="button"
            aria-label="关闭模板 JSON 错误提示"
            onClick={() => setTemplateExchangeError(undefined)}
          >
            关闭
          </button>
        </div>
      ) : null}
      {outputExportError ? (
        <div className={styles.templateExchangeError} role="alert">
          <div>
            <strong>PDF 导出未完成</strong>
            <span>{outputExportError}</span>
          </div>
          <button
            type="button"
            aria-label="关闭 PDF 导出错误提示"
            onClick={() => setOutputExportError(undefined)}
          >
            关闭
          </button>
        </div>
      ) : null}
      <AccountMenu
        user={user}
        surface="editor"
        onReturnHome={() => navigate('/app')}
        onSignOut={user.authMode === 'github' ? () => runGuarded(signOut) : undefined}
      />
      {demoMode ? <DemoModeNotice compact /> : null}
      {saveAsOpen ? (
        <SaveAsSheet
          defaultValue={`${document.state.title} 副本`}
          pending={saveAsPending}
          error={saveAsError}
          onClose={() => setSaveAsOpen(false)}
          onConfirm={async (title) => {
            if (saveAsPending) return
            setSaveAsPending(true)
            setSaveAsError(undefined)
            const saved = await document.saveAs(title, document.state.currentTemplate)
            setSaveAsPending(false)
            if (saved) {
              setSaveAsOpen(false)
              return
            }
            setSaveAsError('另存为失败，请检查文档状态与网络连接后重试。')
          }}
        />
      ) : null}
      {helpSheet ? <HelpSheet view={helpSheet} onClose={() => setHelpSheet(undefined)} /> : null}
      {versionHistoryOpen && document.state.id && document.state.serverVersion ? (
        <VersionHistorySheet
          templateId={document.state.id}
          currentVersion={document.state.serverVersion}
          title={document.state.title}
          canRestore={canRestore}
          disabledReason={restoreDisabledReason}
          restorePending={restorePending}
          suspended={restoreVersion !== undefined}
          onClose={() => {
            setVersionHistoryOpen(false)
            setRestoreVersion(undefined)
            setRestoreError(undefined)
          }}
          onRequestRestore={(version) => {
            setRestoreError(undefined)
            setRestoreVersion(version)
          }}
        />
      ) : null}
      {restoreVersion !== undefined ? (
        <RestoreVersionDialog
          version={restoreVersion}
          hasUnsavedChanges={hasUnsavedChanges}
          pending={restorePending}
          error={restoreError}
          disabled={!canRestore}
          onCancel={() => setRestoreVersion(undefined)}
          onRestore={async () => {
            if (restorePending || !canRestore) return
            const version = restoreVersion
            setRestorePending(true)
            setRestoreError(undefined)
            const restored = await document.restoreVersion(version)
            setRestorePending(false)
            if (restored) {
              setRestoreVersion(undefined)
              setVersionHistoryOpen(false)
              return
            }
            setRestoreError('恢复失败，请根据文档状态提示重新打开模板或检查网络后再试。')
          }}
        />
      ) : null}
      {dialog ? (
        <UnsavedDialog
          action={dialog === 'new' ? 'new' : dialog === 'import' ? 'import' : 'home'}
          onCancel={() => {
            setDialog(undefined)
            setPendingNavigation(undefined)
            setPendingImport(undefined)
          }}
          onDiscard={() => {
            const action = dialog
            setDialog(undefined)
            if (action === 'new') {
              setPendingNavigation(undefined)
              document.newDocument()
              return
            }
            if (action === 'import') {
              setPendingNavigation(undefined)
              const template = pendingImport
              setPendingImport(undefined)
              if (template) applyImportedTemplate(template)
              return
            }
            const proceed = pendingNavigation
            setPendingNavigation(undefined)
            proceed?.()
          }}
        />
      ) : null}
    </main>
  )
}

function ProductCapture({ captureKey }: { captureKey: ProductCaptureKey }) {
  const [template, setTemplate] = useState<TemplateSchema>(PRODUCT_CAPTURE_TEMPLATES[captureKey])
  const host = useMemo<DesignerHost>(
    () => ({
      document: {
        id: `product-capture-${captureKey}`,
        title: PRODUCT_CAPTURE_TEMPLATES[captureKey].pageConfig.title,
        version: 7,
        status: 'clean',
      },
      commands: {
        new: {},
        open: {},
        save: {},
        saveAs: {},
        templateBrowser: {},
        versionHistory: {},
      },
      onCommand: async () => undefined,
    }),
    [captureKey],
  )

  return (
    <main className={styles.capture} aria-label="Foliq 产品截图捕获视图">
      <Designer value={template} onChange={setTemplate} host={host} />
    </main>
  )
}

function App() {
  const { location, navigate, registerBlocker, runGuarded } = useBrowserLocation()
  const { access, retry } = useAccountAccess()
  const runtime = useRuntimeConfig()
  const demoMode = runtime.state.kind === 'ready' && runtime.state.config.demoMode
  const route = routeFromPathname(location.pathname)
  const captureTemplate = new URLSearchParams(location.search).get('template')
  const captureKey =
    PRODUCT_CAPTURE_KEYS.find((key) => key === captureTemplate) ?? PRODUCT_CAPTURE_KEYS[0]
  const captureMode =
    route === 'workspace' && isProductCaptureSearch(location.search, import.meta.env.DEV)

  useEffect(() => {
    if (captureMode || route !== 'workspace' || access.kind === 'checking') return
    if (access.kind === 'signedOut') navigate(landingUrl('auth-required'), true)
    if (access.kind === 'denied') navigate(landingUrl('access-denied'), true)
    if (access.kind === 'error') navigate(landingUrl('unavailable'), true)
  }, [access.kind, captureMode, navigate, route])

  if (captureMode) return <ProductCapture captureKey={captureKey} />

  if (route === 'workspace') {
    if (access.kind === 'allowed') {
      const view = workspaceViewFromLocation(location.pathname, location.search)
      if (view.kind === 'home') {
        return (
          <WorkspaceHome
            accountControl={
              <AccountMenu
                user={access.user}
                surface="home"
                onReturnHome={() => navigate('/')}
                onSignOut={access.user.authMode === 'github' ? signOut : undefined}
              />
            }
            demoNotice={demoMode ? <DemoModeNotice /> : undefined}
            onNew={() => navigate(newDocumentUrl('design'))}
            onOpen={(template) => navigate(documentUrl('design', template.key, template.title))}
          />
        )
      }
      return (
        <WorkspaceEditor
          user={access.user}
          demoMode={demoMode}
          view={view}
          navigate={navigate}
          registerBlocker={registerBlocker}
          runGuarded={runGuarded}
        />
      )
    }
    return (
      <main className={styles.workspaceLoading} role="status">
        <span aria-hidden="true" />
        正在校验工作台访问权限…
      </main>
    )
  }

  const enterApp = () => {
    if (access.kind === 'allowed') navigate('/app')
    else document.querySelector<HTMLButtonElement>('[data-state] button')?.focus()
  }
  const retryRuntimeAndAccount = () => {
    retry()
    runtime.retry()
  }

  if (runtime.state.kind === 'checking') {
    return (
      <main className={styles.workspaceLoading} role="status">
        <span aria-hidden="true" />
        正在读取部署模式…
      </main>
    )
  }

  if (demoMode) {
    return (
      <LandingPage
        access={access}
        notice={landingNoticeFromSearch(location.search)}
        onEnterApp={enterApp}
        onRetry={retryRuntimeAndAccount}
      />
    )
  }

  return (
    <LoginPage
      access={access}
      runtimeError={runtime.state.kind === 'error'}
      onEnterApp={enterApp}
      onRetry={retryRuntimeAndAccount}
    />
  )
}

export default App

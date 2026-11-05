import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { deserialize, serialize, type TemplateSchema } from '@ptd/core'
import type { DesignerDocumentStatus, DesignerHostCommandStates } from '@ptd/react-designer'
import { INITIAL_TEMPLATE } from './templates'
import { TemplateApiError, templateApi, type TemplateApi, type TemplateRecord } from '../api/templateApi'

export interface DocumentState {
  id?: number
  key?: string
  title: string
  serverVersion?: number
  savedTemplate: TemplateSchema
  currentTemplate: TemplateSchema
  requiresSave: boolean
  status: DesignerDocumentStatus
  message?: string
}

export type TemplateLocator =
  { kind: 'id'; value: number } | { kind: 'key'; value: string } | { kind: 'invalid' }

interface UseDocumentControllerOptions {
  requestedTemplate?: TemplateLocator
  api?: TemplateApi
  onLocationChange: (record: TemplateRecord | undefined, replace: boolean) => void
}

export interface DocumentController {
  state: DocumentState
  setCurrentTemplate(template: TemplateSchema): void
  importDocument(template: TemplateSchema): void
  newDocument(): void
  save(template?: TemplateSchema): Promise<boolean>
  saveAs(title: string, template?: TemplateSchema): Promise<boolean>
  restoreVersion(version: number): Promise<boolean>
}

function cloneTemplate(template: TemplateSchema): TemplateSchema {
  return deserialize(serialize(template))
}

function blankTemplate(): TemplateSchema {
  return cloneTemplate(INITIAL_TEMPLATE)
}

function initialState(): DocumentState {
  const template = blankTemplate()
  return {
    title: template.pageConfig.title,
    savedTemplate: template,
    currentTemplate: template,
    requiresSave: false,
    status: 'clean',
    message: '尚未保存到服务器',
  }
}

function loadingState(locator: TemplateLocator): DocumentState {
  const template = blankTemplate()
  const label = locator.kind === 'id' ? `#${locator.value}` : '所选模板'
  return {
    id: locator.kind === 'id' ? locator.value : undefined,
    key: locator.kind === 'key' ? locator.value : undefined,
    title: `模板 ${label}`,
    savedTemplate: template,
    currentTemplate: template,
    requiresSave: false,
    status: 'loading',
    message: `正在载入模板 ${label}…`,
  }
}

function invalidRouteState(): DocumentState {
  const template = blankTemplate()
  return {
    title: template.pageConfig.title,
    savedTemplate: template,
    currentTemplate: template,
    requiresSave: false,
    status: 'error',
    message: '地址中的模板编号无效，请从模板库重新选择。',
  }
}

export function isDocumentDirty(
  state: Pick<DocumentState, 'savedTemplate' | 'currentTemplate' | 'requiresSave'>,
) {
  return state.requiresSave || serialize(state.savedTemplate) !== serialize(state.currentTemplate)
}

export function shouldConfirmDocumentExit(state: DocumentState): boolean {
  return isDocumentDirty(state) || state.status === 'conflict'
}

export function documentHostCommandStates(state: DocumentState): DesignerHostCommandStates {
  const busy = state.status === 'loading' || state.status === 'saving'
  const busyReason = busy ? '请等待当前操作完成' : undefined
  const unavailable = state.status === 'error'
  const unavailableReason = unavailable ? '当前模板未成功载入，无法保存' : undefined
  return {
    new: { enabled: !busy, pending: busy, reason: busyReason },
    open: { enabled: !busy, pending: busy, reason: busyReason },
    templateBrowser: { enabled: !busy, pending: busy, reason: busyReason },
    save: {
      enabled:
        !busy &&
        !unavailable &&
        state.status !== 'conflict' &&
        (state.id === undefined || (state.serverVersion !== undefined && state.status !== 'clean')),
      pending: state.status === 'saving',
      reason: unavailable
        ? unavailableReason
        : state.status === 'conflict'
          ? '服务器版本已变化，请另存为或重新打开'
          : state.id !== undefined && state.serverVersion === undefined
            ? '模板尚未成功载入'
            : state.id !== undefined && state.status === 'clean'
              ? '没有需要保存的更改'
              : busyReason,
    },
    saveAs: {
      enabled: !busy && !unavailable,
      pending: state.status === 'saving',
      reason: unavailableReason ?? busyReason,
    },
    versionHistory: {
      enabled: !busy && !unavailable && state.id !== undefined && state.serverVersion !== undefined,
      pending: busy,
      reason:
        state.id === undefined
          ? '请先保存模板'
          : state.serverVersion === undefined
            ? '模板尚未成功载入'
            : (unavailableReason ?? busyReason),
    },
    restoreVersion: { enabled: false, reason: '请先从版本历史选择要恢复的版本' },
    importTemplate: { enabled: !busy, pending: busy, reason: busyReason },
    exportTemplate: {
      enabled: !busy && !unavailable,
      pending: busy,
      reason: unavailableReason ?? busyReason,
    },
  }
}

function settledStatus(
  state: Pick<DocumentState, 'savedTemplate' | 'currentTemplate' | 'requiresSave'>,
) {
  return isDocumentDirty(state) ? ('dirty' as const) : ('clean' as const)
}

function titleFromTemplate(template: TemplateSchema, fallback: string): string {
  const title = template.pageConfig.title.trim()
  return title || fallback
}

function templateWithTitle(template: TemplateSchema, title: string): TemplateSchema {
  return {
    ...template,
    pageConfig: { ...template.pageConfig, title },
  }
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

function errorMessage(error: unknown, action: '载入' | '保存' | '恢复'): string {
  if (!(error instanceof TemplateApiError)) return `${action}模板时发生未知错误，请重试。`
  switch (error.kind) {
    case 'unauthorized':
      return '登录状态已失效，请重新登录后继续。'
    case 'forbidden':
      return '当前账户没有执行此操作的权限。'
    case 'not-found':
      return '模板不存在，或当前账户无权访问。'
    case 'bad-request':
      return `模板数据未通过服务端校验：${error.message}`
    case 'network':
      return '无法连接模板服务，请检查网络后重试。'
    case 'invalid-response':
      return error.message
    case 'server':
      return '模板服务暂时不可用，请稍后重试。'
    case 'conflict':
      return action === '恢复'
        ? '服务器上的模板已有更新。为避免覆盖新版本，本次恢复已停止；请重新打开模板后再试。'
        : '服务器上的模板已有更新。为避免覆盖他人修改，本次保存已停止。'
  }
}

export function useDocumentController({
  requestedTemplate,
  api = templateApi,
  onLocationChange,
}: UseDocumentControllerOptions): DocumentController {
  const requestedTemplateInvalid = requestedTemplate?.kind === 'invalid'
  const requestedTemplateId = requestedTemplate?.kind === 'id' ? requestedTemplate.value : undefined
  const requestedTemplateKey =
    requestedTemplate?.kind === 'key' ? requestedTemplate.value : undefined
  const [state, setState] = useState<DocumentState>(initialState)
  const stateRef = useRef(state)
  const operationRef = useRef(0)
  const requestRef = useRef<AbortController | undefined>(undefined)
  const restoreOperationRef = useRef<number | undefined>(undefined)
  const mountedRef = useRef(true)
  const onLocationChangeRef = useRef(onLocationChange)

  useEffect(() => {
    onLocationChangeRef.current = onLocationChange
  }, [onLocationChange])

  const commit = useCallback((update: (previous: DocumentState) => DocumentState) => {
    setState((previous) => {
      const next = update(previous)
      stateRef.current = next
      return next
    })
  }, [])

  const cancelRequest = useCallback(() => {
    operationRef.current += 1
    requestRef.current?.abort()
    requestRef.current = undefined
    restoreOperationRef.current = undefined
  }, [])

  const beginRequest = useCallback(() => {
    cancelRequest()
    const controller = new AbortController()
    requestRef.current = controller
    return { controller, operation: operationRef.current }
  }, [cancelRequest])

  const isCurrentOperation = useCallback((operation: number) => {
    return mountedRef.current && operationRef.current === operation
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      requestRef.current?.abort()
    }
  }, [])

  const applyRecord = useCallback(
    (record: TemplateRecord, message: string) => {
      const template = cloneTemplate(record.content)
      commit(() => ({
        id: record.id,
        key: record.key,
        title: record.title,
        serverVersion: record.version,
        savedTemplate: template,
        currentTemplate: template,
        requiresSave: false,
        status: 'clean',
        message,
      }))
    },
    [commit],
  )

  const load = useCallback(
    async (locator: Exclude<TemplateLocator, { kind: 'invalid' }>) => {
      const { controller, operation } = beginRequest()
      commit(() => loadingState(locator))
      try {
        const record =
          locator.kind === 'id'
            ? await api.get(locator.value, controller.signal)
            : await api.getByKey(locator.value, controller.signal)
        if (!isCurrentOperation(operation)) return
        applyRecord(record, `已载入版本 ${record.version}`)
        if (locator.kind === 'id') onLocationChangeRef.current(record, true)
      } catch (error) {
        if (isAbortError(error) || !isCurrentOperation(operation)) return
        commit((previous) => ({
          ...previous,
          status: 'error',
          message: errorMessage(error, '载入'),
        }))
      }
    },
    [api, applyRecord, beginRequest, commit, isCurrentOperation],
  )

  useEffect(() => {
    if (requestedTemplateInvalid) {
      cancelRequest()
      commit(() => invalidRouteState())
      return
    }
    if (requestedTemplateId === undefined && requestedTemplateKey === undefined) {
      if (stateRef.current.id !== undefined || stateRef.current.status === 'error') {
        const next = initialState()
        cancelRequest()
        commit(() => next)
      }
      return
    }
    const locator: Exclude<TemplateLocator, { kind: 'invalid' }> | undefined =
      requestedTemplateId !== undefined
        ? { kind: 'id', value: requestedTemplateId }
        : requestedTemplateKey !== undefined
          ? { kind: 'key', value: requestedTemplateKey }
          : undefined
    if (!locator) return
    const currentMatches =
      (locator.kind === 'id' && stateRef.current.id === locator.value) ||
      (locator.kind === 'key' && stateRef.current.key === locator.value)
    if (currentMatches) {
      if (
        stateRef.current.status === 'loading' &&
        (!requestRef.current || requestRef.current.signal.aborted)
      ) {
        void load(locator)
      }
      return
    }
    void load(locator)
  }, [
    cancelRequest,
    commit,
    load,
    requestedTemplateId,
    requestedTemplateInvalid,
    requestedTemplateKey,
  ])

  const setCurrentTemplate = useCallback(
    (template: TemplateSchema) => {
      commit((previous) => {
        if (previous.status === 'loading' || previous.status === 'error') return previous
        const next = {
          ...previous,
          title: titleFromTemplate(template, previous.title),
          currentTemplate: template,
        }
        if (previous.status === 'saving' || previous.status === 'conflict') {
          return next
        }
        const status = settledStatus(next)
        return {
          ...next,
          status,
          message:
            status === 'dirty'
              ? '有未保存的更改'
              : previous.id
                ? `所有更改已保存 · 版本 ${previous.serverVersion}`
                : '尚未保存到服务器',
        }
      })
    },
    [commit],
  )

  const newDocument = useCallback(() => {
    cancelRequest()
    commit(() => initialState())
    onLocationChangeRef.current(undefined, false)
  }, [cancelRequest, commit])

  const importDocument = useCallback(
    (source: TemplateSchema) => {
      const template = cloneTemplate(source)
      cancelRequest()
      commit(() => ({
        title: titleFromTemplate(template, '导入模板'),
        savedTemplate: template,
        currentTemplate: template,
        requiresSave: true,
        status: 'dirty',
        message: '已导入模板 JSON · 尚未保存到服务器',
      }))
      onLocationChangeRef.current(undefined, false)
    },
    [cancelRequest, commit],
  )

  const persist = useCallback(
    async (mode: 'save' | 'saveAs', requestedTitle?: string, template?: TemplateSchema) => {
      const previous = stateRef.current
      if (
        previous.status === 'saving' ||
        previous.status === 'loading' ||
        previous.status === 'error'
      ) {
        return false
      }
      if (mode === 'save' && previous.status === 'conflict') return false
      if (mode === 'save' && previous.id !== undefined && previous.serverVersion === undefined) {
        return false
      }

      const source = template ?? previous.currentTemplate
      const title = (requestedTitle ?? titleFromTemplate(source, previous.title)).trim()
      if (!title) {
        commit((current) => ({
          ...current,
          status: 'error',
          message: '模板名称不能为空。',
        }))
        return false
      }
      const content = templateWithTitle(source, title)
      const create = mode === 'saveAs' || previous.id === undefined
      const { controller, operation } = beginRequest()

      commit((current) => ({
        ...current,
        title,
        currentTemplate: content,
        status: 'saving',
        message: create ? '正在创建服务器模板…' : `正在保存版本 ${previous.serverVersion}…`,
      }))

      try {
        let record: TemplateRecord
        if (create) {
          record = await api.create({ title, content }, controller.signal)
        } else {
          const id = previous.id
          const expectedVersion = previous.serverVersion
          if (id === undefined || expectedVersion === undefined) return false
          record = await api.update(id, { title, content, expectedVersion }, controller.signal)
        }
        if (!isCurrentOperation(operation)) return false

        const savedTemplate = cloneTemplate(record.content)
        commit((latest) => {
          const unchangedWhileSaving = serialize(latest.currentTemplate) === serialize(content)
          const currentTemplate = unchangedWhileSaving ? savedTemplate : latest.currentTemplate
          const next = {
            ...latest,
            id: record.id,
            key: record.key,
            title: unchangedWhileSaving
              ? record.title
              : titleFromTemplate(currentTemplate, record.title),
            serverVersion: record.version,
            savedTemplate,
            currentTemplate,
            requiresSave: false,
          }
          const status = settledStatus(next)
          return {
            ...next,
            status,
            message:
              status === 'clean'
                ? `所有更改已保存 · 版本 ${record.version}`
                : `版本 ${record.version} 已保存，另有新的未保存更改`,
          }
        })
        if (create) onLocationChangeRef.current(record, mode === 'save')
        return true
      } catch (error) {
        if (isAbortError(error) || !isCurrentOperation(operation)) return false
        const conflict = error instanceof TemplateApiError && error.kind === 'conflict'
        commit((current) => ({
          ...current,
          status: conflict ? 'conflict' : 'error',
          message: errorMessage(error, '保存'),
        }))
        return false
      }
    },
    [api, beginRequest, commit, isCurrentOperation],
  )

  const save = useCallback(
    (template?: TemplateSchema) => persist('save', undefined, template),
    [persist],
  )
  const saveAs = useCallback(
    (title: string, template?: TemplateSchema) => persist('saveAs', title, template),
    [persist],
  )

  const restoreVersion = useCallback(
    async (version: number) => {
      const previous = stateRef.current
      if (
        restoreOperationRef.current !== undefined ||
        previous.id === undefined ||
        previous.serverVersion === undefined ||
        previous.status === 'loading' ||
        previous.status === 'saving' ||
        previous.status === 'error' ||
        previous.status === 'conflict'
      ) {
        return false
      }
      const { controller, operation } = beginRequest()
      restoreOperationRef.current = operation
      commit((current) => ({
        ...current,
        status: 'saving',
        message: `正在将版本 ${version} 恢复为最新版本…`,
      }))
      try {
        const record = await api.restore(
          previous.id,
          version,
          previous.serverVersion,
          controller.signal,
        )
        if (!isCurrentOperation(operation)) return false
        applyRecord(record, `已从版本 ${version} 恢复 · 当前版本 ${record.version}`)
        return true
      } catch (error) {
        if (isAbortError(error) || !isCurrentOperation(operation)) return false
        const conflict = error instanceof TemplateApiError && error.kind === 'conflict'
        commit((current) => ({
          ...current,
          status: conflict ? 'conflict' : 'error',
          message: errorMessage(error, '恢复'),
        }))
        return false
      } finally {
        if (restoreOperationRef.current === operation) restoreOperationRef.current = undefined
      }
    },
    [api, applyRecord, beginRequest, commit, isCurrentOperation],
  )

  return useMemo(
    () => ({
      state,
      setCurrentTemplate,
      importDocument,
      newDocument,
      save,
      saveAs,
      restoreVersion,
    }),
    [importDocument, newDocument, restoreVersion, save, saveAs, setCurrentTemplate, state],
  )
}

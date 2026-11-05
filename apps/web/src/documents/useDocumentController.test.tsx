import { act, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { INITIAL_TEMPLATE } from './templates'
import { parseTemplateJson } from './templateJson'
import { TemplateApiError, type TemplateApi, type TemplateRecord } from '../api/templateApi'
import {
  documentHostCommandStates,
  shouldConfirmDocumentExit,
  useDocumentController,
  type DocumentController,
} from './useDocumentController'

const NOW = '2026-07-31T08:30:00.000Z'

function changedTemplate(title = '已编辑模板') {
  return {
    ...INITIAL_TEMPLATE,
    pageConfig: { ...INITIAL_TEMPLATE.pageConfig, title },
  }
}

function record(overrides: Partial<TemplateRecord> = {}): TemplateRecord {
  return {
    id: 7,
    key: 'template-key-7',
    title: '服务器模板',
    content: changedTemplate('服务器模板'),
    version: 3,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}

function fakeApi(overrides: Partial<TemplateApi> = {}): TemplateApi {
  return {
    list: vi.fn(async () => []),
    create: vi.fn(async (input) =>
      record({ id: 8, title: input.title, content: input.content, version: 1 }),
    ),
    get: vi.fn(async (id) => record({ id })),
    getByKey: vi.fn(async (key) => record({ key })),
    update: vi.fn(async (id, input) =>
      record({
        id,
        title: input.title,
        content: input.content,
        version: input.expectedVersion + 1,
      }),
    ),
    delete: vi.fn(async () => undefined),
    listVersions: vi.fn(async () => []),
    getVersion: vi.fn(async () => ({ ...record(), templateId: 7 })),
    restore: vi.fn(async () => record({ version: 4 })),
    ...overrides,
  }
}

interface HarnessProps {
  api: TemplateApi
  requestedTemplateId?: number | 'invalid'
  requestedTemplateKey?: string
  onLocationChange: (templateId: number | undefined, replace: boolean) => void
  expose(controller: DocumentController): void
}

function Harness({
  api,
  requestedTemplateId,
  requestedTemplateKey,
  onLocationChange,
  expose,
}: HarnessProps) {
  expose(
    useDocumentController({
      api,
      requestedTemplate:
        requestedTemplateKey !== undefined
          ? { kind: 'key', value: requestedTemplateKey }
          : requestedTemplateId === 'invalid'
            ? { kind: 'invalid' }
            : requestedTemplateId === undefined
              ? undefined
              : { kind: 'id', value: requestedTemplateId },
      onLocationChange: (record, replace) => onLocationChange(record?.id, replace),
    }),
  )
  return null
}

describe('Web document controller', () => {
  let container: HTMLDivElement
  let root: Root
  let controller: DocumentController

  beforeEach(() => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  async function render(
    api: TemplateApi,
    requestedTemplateId?: number | 'invalid',
    onLocationChange = vi.fn(),
    requestedTemplateKey?: string,
  ) {
    await act(async () => {
      root.render(
        <StrictMode>
          <Harness
            api={api}
            requestedTemplateId={requestedTemplateId}
            requestedTemplateKey={requestedTemplateKey}
            onLocationChange={onLocationChange}
            expose={(value) => {
              controller = value
            }}
          />
        </StrictMode>,
      )
    })
    return onLocationChange
  }

  it('marks edits dirty and returns to clean when Undo restores the saved value', async () => {
    await render(fakeApi())
    const original = controller.state.currentTemplate

    await act(async () => controller.setCurrentTemplate(changedTemplate()))
    expect(controller.state.status).toBe('dirty')
    expect(shouldConfirmDocumentExit(controller.state)).toBe(true)

    await act(async () => controller.setCurrentTemplate(original))
    expect(controller.state.status).toBe('clean')
    expect(shouldConfirmDocumentExit(controller.state)).toBe(false)
    expect(documentHostCommandStates(controller.state).save).toMatchObject({ enabled: true })
  })

  it('loads /app?template=<id> and rejects invalid URL identifiers', async () => {
    const get = vi.fn(async (id: number) => record({ id }))
    await render(fakeApi({ get }), 12)

    expect(get).toHaveBeenCalledWith(12, expect.any(AbortSignal))
    expect(controller.state).toMatchObject({
      id: 12,
      serverVersion: 3,
      status: 'clean',
      title: '服务器模板',
    })
  })

  it('loads canonical document routes by opaque key without rewriting the location', async () => {
    const getByKey = vi.fn(async (key: string) => record({ key }))
    const locationChange = await render(fakeApi({ getByKey }), undefined, vi.fn(), 'template-key-7')

    expect(getByKey).toHaveBeenCalledWith('template-key-7', expect.any(AbortSignal))
    expect(controller.state).toMatchObject({
      id: 7,
      key: 'template-key-7',
      status: 'clean',
    })
    expect(locationChange).not.toHaveBeenCalled()
  })

  it('resets an invalid template route when navigation enters the explicit blank editor', async () => {
    const create = vi.fn<TemplateApi['create']>()
    const api = fakeApi({ create })
    await render(api, 'invalid')
    expect(controller.state.id).toBeUndefined()
    expect(controller.state.status).toBe('error')
    expect(controller.state.currentTemplate.pageConfig.title).toBe('新建模板')
    expect(controller.state.message).toContain('模板编号无效')
    expect(documentHostCommandStates(controller.state)).toMatchObject({
      save: { enabled: false },
      saveAs: { enabled: false },
    })
    await expect(controller.save()).resolves.toBe(false)
    await expect(controller.saveAs('非法地址副本')).resolves.toBe(false)
    expect(create).not.toHaveBeenCalled()

    await render(api, undefined)
    expect(controller.state.id).toBeUndefined()
    expect(controller.state.status).toBe('clean')
    expect(controller.state.message).toBe('尚未保存到服务器')
  })

  it('clears document A before loading B and rejects edits or Save As while loading', async () => {
    const pendingB = deferred<TemplateRecord>()
    const get = vi.fn<TemplateApi['get']>((id) => {
      if (id === 7) {
        return Promise.resolve(
          record({ id: 7, title: '文档 A', content: changedTemplate('文档 A 内容') }),
        )
      }
      return pendingB.promise
    })
    const create = vi.fn<TemplateApi['create']>()
    const api = fakeApi({ get, create })
    await render(api, 7)
    expect(controller.state.title).toBe('文档 A')
    expect(controller.state.currentTemplate.pageConfig.title).toBe('文档 A 内容')

    await render(api, 8)
    const isolatedTemplate = controller.state.currentTemplate
    expect(controller.state).toMatchObject({ id: 8, title: '模板 #8', status: 'loading' })
    expect(isolatedTemplate.pageConfig.title).toBe('新建模板')
    expect(isolatedTemplate.pageConfig.title).not.toBe('文档 A 内容')

    await act(async () => controller.setCurrentTemplate(changedTemplate('不应写入')))
    expect(controller.state.currentTemplate).toBe(isolatedTemplate)
    expect(documentHostCommandStates(controller.state).saveAs).toMatchObject({ enabled: false })
    await expect(controller.saveAs('文档 A 副本')).resolves.toBe(false)
    expect(create).not.toHaveBeenCalled()

    await act(async () => pendingB.resolve(record({ id: 8, title: '文档 B' })))
    expect(controller.state).toMatchObject({ id: 8, title: '文档 B', status: 'clean' })
  })

  it('keeps failed B isolated and disables every persistence command', async () => {
    const get = vi.fn<TemplateApi['get']>(async (id) => {
      if (id === 7) {
        return record({ id: 7, title: '文档 A', content: changedTemplate('文档 A 内容') })
      }
      throw new TemplateApiError('not-found', 'missing', 404)
    })
    const create = vi.fn<TemplateApi['create']>()
    const update = vi.fn<TemplateApi['update']>()
    const api = fakeApi({ get, create, update })
    await render(api, 7)
    await render(api, 8)

    expect(controller.state).toMatchObject({ id: 8, status: 'error' })
    expect(controller.state.currentTemplate.pageConfig.title).toBe('新建模板')
    expect(controller.state.currentTemplate.pageConfig.title).not.toBe('文档 A 内容')
    expect(documentHostCommandStates(controller.state)).toMatchObject({
      save: { enabled: false, reason: '当前模板未成功载入，无法保存' },
      saveAs: { enabled: false, reason: '当前模板未成功载入，无法保存' },
    })
    await expect(controller.save()).resolves.toBe(false)
    await expect(controller.saveAs('失败副本')).resolves.toBe(false)
    expect(create).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('ignores a late response from A after B becomes the active document', async () => {
    const pendingA = deferred<TemplateRecord>()
    const pendingB = deferred<TemplateRecord>()
    const get = vi.fn<TemplateApi['get']>((id) => (id === 7 ? pendingA.promise : pendingB.promise))
    const api = fakeApi({ get })
    await render(api, 7)
    await render(api, 8)

    await act(async () => pendingB.resolve(record({ id: 8, title: '文档 B' })))
    expect(controller.state).toMatchObject({ id: 8, title: '文档 B', status: 'clean' })

    await act(async () => pendingA.resolve(record({ id: 7, title: '迟到的文档 A' })))
    expect(controller.state).toMatchObject({ id: 8, title: '文档 B', status: 'clean' })
  })

  it('creates a new server document and replaces the blank URL', async () => {
    const create = vi.fn(async (input: { title: string; content: typeof INITIAL_TEMPLATE }) =>
      record({ id: 21, title: input.title, content: input.content, version: 1 }),
    )
    const api = fakeApi({ create })
    const locationChange = await render(api)
    const template = changedTemplate('采购单')

    await act(async () => {
      await controller.save(template)
    })

    expect(create).toHaveBeenCalledWith(
      { title: '采购单', content: template },
      expect.any(AbortSignal),
    )
    expect(controller.state).toMatchObject({ id: 21, serverVersion: 1, status: 'clean' })
    expect(locationChange).toHaveBeenCalledWith(21, true)
  })

  it('opens imported JSON as a dirty unsaved document without retaining server identity', async () => {
    const create = vi.fn(async (input: { title: string; content: typeof INITIAL_TEMPLATE }) =>
      record({ id: 22, title: input.title, content: input.content, version: 1 }),
    )
    const api = fakeApi({ create })
    const locationChange = await render(api, 7)
    const imported = parseTemplateJson(JSON.stringify(changedTemplate('导入的出库单')))

    await act(async () => controller.importDocument(imported))

    expect(controller.state).toMatchObject({
      title: '导入的出库单',
      status: 'dirty',
      requiresSave: true,
      currentTemplate: imported,
    })
    expect(controller.state).not.toHaveProperty('id')
    expect(controller.state).not.toHaveProperty('serverVersion')
    expect(shouldConfirmDocumentExit(controller.state)).toBe(true)
    expect(documentHostCommandStates(controller.state)).toMatchObject({
      save: { enabled: true },
      importTemplate: { enabled: true },
      exportTemplate: { enabled: true },
    })
    expect(locationChange).toHaveBeenCalledWith(undefined, false)

    await act(async () => {
      await controller.save()
    })
    expect(create).toHaveBeenCalledWith(
      { title: '导入的出库单', content: imported },
      expect.any(AbortSignal),
    )
    expect(controller.state).toMatchObject({ status: 'clean', requiresSave: false, id: 22 })
  })

  it('keeps an imported blank template dirty even when it equals the blank baseline', async () => {
    await render(fakeApi())

    await act(async () => controller.importDocument(INITIAL_TEMPLATE))

    expect(controller.state.status).toBe('dirty')
    expect(shouldConfirmDocumentExit(controller.state)).toBe(true)
  })

  it('updates with expectedVersion and advances the saved baseline', async () => {
    const update = vi.fn(
      async (
        id: number,
        input: { title: string; content: typeof INITIAL_TEMPLATE; expectedVersion: number },
      ) => record({ id, title: input.title, content: input.content, version: 4 }),
    )
    await render(fakeApi({ update }), 7)
    const template = changedTemplate('服务器模板 · 修订')
    await act(async () => controller.setCurrentTemplate(template))

    await act(async () => {
      await controller.save(template)
    })

    expect(update).toHaveBeenCalledWith(
      7,
      { title: '服务器模板 · 修订', content: template, expectedVersion: 3 },
      expect.any(AbortSignal),
    )
    expect(controller.state).toMatchObject({ serverVersion: 4, status: 'clean' })
    expect(documentHostCommandStates(controller.state).save).toMatchObject({
      enabled: false,
      reason: '没有需要保存的更改',
    })
  })

  it('enters conflict on HTTP 409 and never retries or overwrites automatically', async () => {
    const update = vi.fn(async () => {
      throw new TemplateApiError('conflict', 'stale', 409)
    })
    await render(fakeApi({ update }), 7)
    const template = changedTemplate('冲突编辑')
    await act(async () => controller.setCurrentTemplate(template))

    await act(async () => {
      await controller.save(template)
    })

    expect(update).toHaveBeenCalledTimes(1)
    expect(controller.state.status).toBe('conflict')
    expect(shouldConfirmDocumentExit(controller.state)).toBe(true)
    expect(controller.state.message).toContain('避免覆盖')
    expect(documentHostCommandStates(controller.state)).toMatchObject({
      save: { enabled: false },
      saveAs: { enabled: true },
      versionHistory: { enabled: true },
      restoreVersion: { enabled: false },
    })

    await act(async () => controller.setCurrentTemplate(changedTemplate('继续编辑')))
    expect(controller.state.status).toBe('conflict')
    await act(async () => {
      await controller.save()
    })
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('restores a historical snapshot with expectedVersion and adopts the new baseline', async () => {
    const restore = vi.fn(async () =>
      record({
        title: '历史采购单',
        content: changedTemplate('历史采购单'),
        version: 4,
      }),
    )
    await render(fakeApi({ restore }), 7)

    await act(async () => {
      await controller.restoreVersion(1)
    })

    expect(restore).toHaveBeenCalledWith(7, 1, 3, expect.any(AbortSignal))
    expect(controller.state).toMatchObject({
      title: '历史采购单',
      serverVersion: 4,
      status: 'clean',
    })
    expect(controller.state.message).toContain('已从版本 1 恢复')
  })

  it('enters conflict on restore HTTP 409 and rejects later restore attempts without retrying', async () => {
    const restore = vi.fn<TemplateApi['restore']>(async () => {
      throw new TemplateApiError('conflict', 'stale', 409)
    })
    await render(fakeApi({ restore }), 7)

    await act(async () => {
      await controller.restoreVersion(1)
    })

    expect(controller.state.status).toBe('conflict')
    expect(controller.state.message).toContain('本次恢复已停止')
    expect(controller.state.message).toContain('重新打开模板')
    await expect(controller.restoreVersion(2)).resolves.toBe(false)
    expect(restore).toHaveBeenCalledTimes(1)
  })

  it('rejects an immediate duplicate restore while the first request is pending', async () => {
    const pending = deferred<TemplateRecord>()
    const restore = vi.fn<TemplateApi['restore']>(() => pending.promise)
    await render(fakeApi({ restore }), 7)
    let firstRestore: Promise<boolean>

    await act(async () => {
      firstRestore = controller.restoreVersion(1)
      await expect(controller.restoreVersion(2)).resolves.toBe(false)
    })

    expect(controller.state.status).toBe('saving')
    expect(restore).toHaveBeenCalledTimes(1)
    expect(restore).toHaveBeenCalledWith(7, 1, 3, expect.any(AbortSignal))
    await act(async () => {
      pending.resolve(record({ version: 4 }))
      await firstRestore!
    })
    expect(controller.state.status).toBe('clean')
  })

  it('publishes pending command state and rejects duplicate saves while a request is active', async () => {
    let resolveCreate: ((value: TemplateRecord) => void) | undefined
    const create = vi.fn(
      async () =>
        new Promise<TemplateRecord>((resolve) => {
          resolveCreate = resolve
        }),
    )
    await render(fakeApi({ create }))
    const template = changedTemplate('进行中的保存')
    let firstSave: Promise<boolean>

    await act(async () => {
      firstSave = controller.save(template)
      await Promise.resolve()
    })

    expect(controller.state.status).toBe('saving')
    expect(documentHostCommandStates(controller.state)).toMatchObject({
      new: { enabled: false, pending: true },
      open: { enabled: false, pending: true },
      save: { enabled: false, pending: true },
      saveAs: { enabled: false, pending: true },
    })
    await expect(controller.save(template)).resolves.toBe(false)
    expect(create).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveCreate?.(record({ id: 30, title: '进行中的保存', content: template, version: 1 }))
      await firstSave!
    })
    expect(controller.state.status).toBe('clean')
  })
})

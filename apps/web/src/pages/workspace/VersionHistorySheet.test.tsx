import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { INITIAL_TEMPLATE } from '../../documents/templates'
import { TemplateApiError, type TemplateApi, type TemplateVersionRecord } from '../../api/templateApi'
import { VersionHistorySheet } from './VersionHistorySheet'

const NOW = '2026-07-31T08:30:00.000Z'

function versionRecord(templateId: number, version: number): TemplateVersionRecord {
  const title = version === 3 ? '当前模板' : `历史模板 ${version}`
  return {
    id: version,
    templateId,
    version,
    title,
    createdAt: NOW,
    content: {
      ...INITIAL_TEMPLATE,
      pageConfig: { ...INITIAL_TEMPLATE.pageConfig, title },
    },
  }
}

function fakeApi(overrides: Partial<TemplateApi> = {}): TemplateApi {
  return {
    list: vi.fn(async () => []),
    create: vi.fn(),
    get: vi.fn(),
    getByKey: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    listVersions: vi.fn(async () => [
      { version: 3, title: '当前模板', createdAt: NOW },
      { version: 1, title: '初始模板', createdAt: NOW },
    ]),
    getVersion: vi.fn(async (id, version) => versionRecord(id, version)),
    restore: vi.fn(),
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

describe('VersionHistorySheet', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
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
    props: Partial<{
      templateId: number
      currentVersion: number
      title: string
      canRestore: boolean
      disabledReason: string
      restorePending: boolean
      suspended: boolean
      onClose: () => void
      onRequestRestore: (version: number) => void
    }> = {},
  ) {
    await act(async () => {
      root.render(
        <VersionHistorySheet
          api={api}
          templateId={props.templateId ?? 7}
          currentVersion={props.currentVersion ?? 3}
          title={props.title ?? '当前模板'}
          canRestore={props.canRestore}
          disabledReason={props.disabledReason}
          restorePending={props.restorePending}
          suspended={props.suspended}
          onClose={props.onClose ?? vi.fn()}
          onRequestRestore={props.onRequestRestore ?? vi.fn()}
        />,
      )
    })
  }

  function restoreButton() {
    return Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      button.textContent?.includes('恢复此版本'),
    )!
  }

  it('loads immutable versions, previews a selection and requests explicit restore', async () => {
    const api = fakeApi()
    const onRequestRestore = vi.fn()
    await render(api, { onRequestRestore })

    expect(api.listVersions).toHaveBeenCalledWith(7, expect.any(AbortSignal))
    expect(
      container.querySelector('button[aria-label="关闭版本历史"] svg[aria-hidden="true"]'),
    ).not.toBeNull()
    expect(container.textContent).toContain('当前版本')
    expect(restoreButton().disabled).toBe(true)
    const versionOne = Array.from(
      container.querySelectorAll<HTMLButtonElement>('nav[aria-label="历史版本列表"] button'),
    ).find((button) => button.textContent?.includes('版本 1'))!
    await act(async () => versionOne.click())
    expect(api.getVersion).toHaveBeenCalledWith(7, 1, expect.any(AbortSignal))
    expect(container.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('版本 1 预览')

    expect(restoreButton().disabled).toBe(false)
    await act(async () => restoreButton().click())
    expect(onRequestRestore).toHaveBeenCalledWith(1)
  })

  it('shows list errors with retry and a distinct empty result', async () => {
    const listVersions = vi
      .fn<TemplateApi['listVersions']>()
      .mockRejectedValueOnce(new TemplateApiError('network', 'offline'))
      .mockResolvedValueOnce([])
    await render(fakeApi({ listVersions }))

    expect(container.querySelector('nav [role="alert"]')?.textContent).toContain('无法连接模板服务')
    const retry = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent === '重试版本列表',
    )!
    await act(async () => retry.click())
    expect(listVersions).toHaveBeenCalledTimes(2)
    expect(container.textContent).toContain('还没有可用的历史版本')
    expect(container.textContent).toContain('暂无可预览版本')
  })

  it('resets selection and preview when the template changes and ignores a stale list response', async () => {
    const first = deferred<Awaited<ReturnType<TemplateApi['listVersions']>>>()
    const second = deferred<Awaited<ReturnType<TemplateApi['listVersions']>>>()
    const listVersions = vi.fn<TemplateApi['listVersions']>((id) =>
      id === 7 ? first.promise : second.promise,
    )
    await render(fakeApi({ listVersions }), { templateId: 7 })
    await render(fakeApi({ listVersions }), { templateId: 8, title: '模板八' })

    expect(container.textContent).toContain('正在读取版本历史')
    expect(container.querySelector('[role="img"]')).toBeNull()
    await act(async () => second.resolve([{ version: 8, title: '模板八', createdAt: NOW }]))
    expect(container.textContent).toContain('版本 8')

    await act(async () => first.resolve([{ version: 7, title: '迟到模板七', createdAt: NOW }]))
    expect(container.textContent).not.toContain('迟到模板七')
    expect(container.textContent).toContain('版本 8')
  })

  it('removes the old preview immediately and ignores a stale preview response', async () => {
    const pendingVersionOne = deferred<TemplateVersionRecord>()
    const getVersion = vi.fn<TemplateApi['getVersion']>((id, version) =>
      version === 1 ? pendingVersionOne.promise : Promise.resolve(versionRecord(id, version)),
    )
    const api = fakeApi({ getVersion })
    await render(api)
    expect(container.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('版本 3 预览')

    const buttons = () =>
      Array.from(
        container.querySelectorAll<HTMLButtonElement>('nav[aria-label="历史版本列表"] button'),
      )
    const versionOne = buttons().find((button) => button.textContent?.includes('版本 1'))!
    await act(async () => versionOne.click())
    expect(container.querySelector('[role="img"]')).toBeNull()
    expect(container.textContent).toContain('正在载入版本预览')

    const versionThree = buttons().find((button) => button.textContent?.includes('版本 3'))!
    await act(async () => versionThree.click())
    expect(container.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('版本 3 预览')
    await act(async () => pendingVersionOne.resolve(versionRecord(7, 1)))
    expect(container.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('版本 3 预览')
  })

  it('retries a failed preview and requires the returned preview to match the selection', async () => {
    const getVersion = vi
      .fn<TemplateApi['getVersion']>()
      .mockRejectedValueOnce(new TemplateApiError('server', 'failed', 500))
      .mockResolvedValueOnce(versionRecord(7, 3))
      .mockResolvedValueOnce(versionRecord(7, 99))
    await render(fakeApi({ getVersion }))

    expect(
      container.querySelector('section[aria-label="历史版本预览"] [role="alert"]')?.textContent,
    ).toContain('模板服务暂时不可用')
    const retry = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent === '重试版本预览',
    )!
    await act(async () => retry.click())
    expect(container.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('版本 3 预览')

    const versionOne = Array.from(
      container.querySelectorAll<HTMLButtonElement>('nav[aria-label="历史版本列表"] button'),
    ).find((button) => button.textContent?.includes('版本 1'))!
    await act(async () => versionOne.click())
    expect(restoreButton().disabled).toBe(true)
    expect(container.textContent).toContain('等待所选版本预览载入完成')
  })

  it('explains host restore restrictions and blocks close or restore while pending', async () => {
    const api = fakeApi()
    const onClose = vi.fn()
    const onRequestRestore = vi.fn()
    await render(api, {
      canRestore: false,
      disabledReason: '服务器版本已变化，请重新打开模板后再恢复',
      onClose,
      onRequestRestore,
    })
    const versionOne = Array.from(
      container.querySelectorAll<HTMLButtonElement>('nav[aria-label="历史版本列表"] button'),
    ).find((button) => button.textContent?.includes('版本 1'))!
    await act(async () => versionOne.click())
    expect(restoreButton().disabled).toBe(true)
    expect(container.textContent).toContain('服务器版本已变化')

    await render(api, { restorePending: true, onClose, onRequestRestore })
    expect(
      container.querySelector<HTMLButtonElement>('button[aria-label="关闭版本历史"]')?.disabled,
    ).toBe(true)
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
    expect(onClose).not.toHaveBeenCalled()
    expect(onRequestRestore).not.toHaveBeenCalled()
  })

  it('closes with Escape and restores focus when the sheet unmounts', async () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const onClose = vi.fn()
    await render(fakeApi(), { onClose })

    expect(document.activeElement).toBe(
      container.querySelector<HTMLButtonElement>('button[aria-label="关闭版本历史"]'),
    )
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
    expect(onClose).toHaveBeenCalledTimes(1)
    await act(async () => root.render(null))
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })

  it('leaves Escape to a restore confirmation while the history sheet is suspended', async () => {
    const onClose = vi.fn()
    await render(fakeApi(), { suspended: true, onClose })

    expect(container.querySelector('aside')?.hasAttribute('data-suspended')).toBe(true)
    expect(
      container.querySelector<HTMLButtonElement>('button[aria-label="关闭版本历史"]')?.disabled,
    ).toBe(true)
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
    expect(onClose).not.toHaveBeenCalled()
  })
})

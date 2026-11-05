import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { TemplateSchema } from '@ptd/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  TemplateApiError,
  type TemplateApi,
  type TemplateRecord,
  type TemplateSummary,
} from '../../api/templateApi'
import { WorkspaceHome } from './WorkspaceHome'

const NOW = '2026-07-31T08:30:00.000Z'

function schema(content: string): TemplateSchema {
  return {
    _version: 1,
    pageConfig: {
      pageSize: 'A4',
      pageDirection: 'p',
      pageLayout: 'fixed',
      pageWidth: 210,
      pageHeight: 297,
      pageCurHeight: 297,
      pageMarginBottom: 10,
      pageMarginTop: 10,
      pageMarginLeft: 10,
      pageMarginRight: 10,
      title: content,
      scale: 1,
      background: '#ffffff',
      color: '#222222',
      fontSize: 12,
      fontFamily: 'sans-serif',
      lineHeight: 1.4,
    },
    pages: [
      {
        id: 'page-1',
        componentData: [
          {
            id: `text-${content}`,
            component: 'RoySimpleText',
            name: '标题',
            code: 'RoySimpleText',
            group: 'common',
            propValue: content,
            style: {
              left: 20,
              top: 24,
              width: 180,
              height: 36,
              rotate: 0,
              opacity: 1,
              fontSize: 16,
            },
            groupStyle: {},
            position: { x: 20, y: 24 },
          },
        ],
      },
    ],
    dataSource: [],
    dataSet: {},
  }
}

function summary(id: number, title: string): TemplateSummary {
  return {
    id,
    key: `template-key-${id}`,
    title,
    version: id,
    createdAt: NOW,
    updatedAt: NOW,
  }
}

function record(id: number, title: string): TemplateRecord {
  return { ...summary(id, title), content: schema(`预览内容 ${title}`) }
}

function fakeApi(overrides: Partial<TemplateApi> = {}): TemplateApi {
  return {
    list: vi.fn<TemplateApi['list']>(async () => []),
    create: vi.fn<TemplateApi['create']>(),
    get: vi.fn<TemplateApi['get']>(async (id) => record(id, `模板 ${id}`)),
    getByKey: vi.fn<TemplateApi['getByKey']>(),
    update: vi.fn<TemplateApi['update']>(),
    delete: vi.fn<TemplateApi['delete']>(),
    listVersions: vi.fn<TemplateApi['listVersions']>(),
    getVersion: vi.fn<TemplateApi['getVersion']>(),
    restore: vi.fn<TemplateApi['restore']>(),
    ...overrides,
  }
}

function changeInput(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('Workspace Home', () => {
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

  async function render(api: TemplateApi, onNew = vi.fn(), onOpen = vi.fn()) {
    await act(async () => {
      root.render(
        <WorkspaceHome
          api={api}
          accountControl={<button type="button">账户</button>}
          onNew={onNew}
          onOpen={onOpen}
        />,
      )
    })
    return { onNew, onOpen }
  }

  it('provides a desktop file sidebar and a real compact mobile shell', async () => {
    await render(fakeApi())

    expect(container.querySelector('aside[aria-label="工作台导航"]')).not.toBeNull()
    const compactShell = container.querySelector('[data-ptd-home-shell="compact"]')
    expect(compactShell?.textContent).toContain('Foliq')
    expect(compactShell?.textContent).toContain('账户')
    expect(container.querySelector('a[aria-label="Foliq 首页"] img')).toBeNull()
    expect(container.querySelector('nav[aria-label="文件导航"] button svg')).not.toBeNull()
    expect(container.querySelector('button[aria-label="新建空白模板"] svg')).not.toBeNull()
    expect(container.textContent).not.toContain('DOCUMENT WORKSPACE')
    expect(container.textContent).not.toContain('0 DOCUMENTS')
    expect(container.textContent).not.toContain('01')
    expect(container.textContent).not.toContain('02')
  })

  it('shows deterministic loading and empty states with one meaningful create action', async () => {
    let resolveList: ((value: TemplateSummary[]) => void) | undefined
    const api = fakeApi({
      list: vi.fn(
        async () =>
          new Promise<TemplateSummary[]>((resolve) => {
            resolveList = resolve
          }),
      ),
    })
    const onNew = vi.fn()
    await render(api, onNew)

    expect(container.querySelector('[role="status"]')?.textContent).toContain('正在读取模板')

    await act(async () => resolveList?.([]))
    expect(container.textContent).toContain('创建第一份模板')
    const create = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.includes('新建空白模板') && button.textContent?.trim(),
    )
    await act(async () => create?.click())
    expect(onNew).toHaveBeenCalledTimes(1)
  })

  it('loads at most four real previews and reveals the complete list in the all-templates view', async () => {
    const templates = Array.from({ length: 6 }, (_, index) =>
      summary(index + 1, `服务器模板 ${index + 1}`),
    )
    const get = vi.fn<TemplateApi['get']>(async (id) => record(id, `服务器模板 ${id}`))
    const { onOpen } = await render(
      fakeApi({ list: vi.fn(async () => templates), get }),
      vi.fn(),
      vi.fn(),
    )

    expect(get).toHaveBeenCalledTimes(4)
    expect(get.mock.calls.map(([id]) => id)).toEqual([1, 2, 3, 4])
    expect(get.mock.calls.every(([, signal]) => signal instanceof AbortSignal)).toBe(true)
    expect(container.querySelector('.ptd-simple-text__inner')?.textContent).toContain('预览内容')
    expect(container.querySelector('button[aria-label="模板操作 服务器模板 1"] svg')).not.toBeNull()
    expect(container.textContent).not.toContain('•••')
    expect(container.textContent).not.toContain('服务器模板 6')
    const allTemplates = Array.from(
      container.querySelectorAll<HTMLButtonElement>('nav[aria-label="文件导航"] button'),
    ).find((button) => button.textContent?.trim() === '全部模板')
    await act(async () => allTemplates?.click())
    expect(container.textContent).toContain('服务器模板 6')
    expect(container.textContent).not.toContain('最近打开')

    const open = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.querySelector('strong')?.textContent === '服务器模板 6',
    )
    await act(async () => open?.click())
    expect(onOpen).toHaveBeenCalledWith(summary(6, '服务器模板 6'))
    expect(get).toHaveBeenCalledTimes(4)
  })

  it('filters previews and the complete list by title and exposes a no-results reset', async () => {
    const templates = [summary(1, '采购验收单'), summary(2, '发货通知单')]
    const get = vi.fn<TemplateApi['get']>(async (id) => record(id, templates[id - 1]!.title))
    await render(fakeApi({ list: vi.fn(async () => templates), get }))

    const input = container.querySelector<HTMLInputElement>('input[type="search"]')!
    expect(input.getAttribute('aria-label')).toBe('按标题搜索模板')
    await act(async () => changeInput(input, '采购'))
    expect(input.getAttribute('aria-label')).toBe('按标题搜索模板')
    expect(container.querySelector('button[aria-label="清除搜索"] svg')).not.toBeNull()
    expect(container.textContent).toContain('采购验收单')
    expect(container.textContent).not.toContain('发货通知单')

    await act(async () => changeInput(input, '不存在'))
    expect(container.querySelector('[role="status"]')?.textContent).toContain('没有匹配的模板')
    const clear = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.includes('清除搜索'),
    )
    await act(async () => clear?.click())
    expect(input.value).toBe('')
    expect(container.textContent).toContain('发货通知单')
  })

  it('isolates a failed recent preview and retries without losing the file list', async () => {
    const templates = [summary(1, '损坏预览'), summary(2, '正常预览')]
    const get = vi
      .fn<TemplateApi['get']>()
      .mockRejectedValueOnce(new Error('detail unavailable'))
      .mockResolvedValueOnce(record(2, '正常预览'))
      .mockResolvedValue(record(1, '恢复预览'))
    await render(fakeApi({ list: vi.fn(async () => templates), get }))

    expect(container.querySelector('[role="alert"]')?.textContent).toContain('预览暂不可用')
    expect(container.textContent).toContain('损坏预览')
    expect(container.querySelector('.ptd-simple-text__inner')?.textContent).toContain('正常预览')

    const retry = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.includes('重试预览'),
    )
    await act(async () => retry?.click())
    expect(get).toHaveBeenCalledTimes(4)
  })

  it('renames, duplicates and permanently deletes files through explicit card actions', async () => {
    const get = vi.fn<TemplateApi['get']>(async () => record(1, '原模板'))
    const update = vi.fn<TemplateApi['update']>(async (id, input) => ({
      ...record(id, input.title),
      version: input.expectedVersion + 1,
    }))
    const create = vi.fn<TemplateApi['create']>(async (input) => record(9, input.title))
    const remove = vi.fn<TemplateApi['delete']>(async () => undefined)
    await render(
      fakeApi({
        list: vi.fn(async () => [summary(1, '原模板')]),
        get,
        update,
        create,
        delete: remove,
      }),
    )

    const openActions = async (title: string) => {
      const trigger = container.querySelector<HTMLButtonElement>(
        `button[aria-label="模板操作 ${title}"]`,
      )
      await act(async () => trigger?.click())
    }

    await openActions('原模板')
    const rename = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'),
    ).find((button) => button.textContent === '重命名')
    await act(async () => rename?.click())
    const renameInput = container.querySelector<HTMLInputElement>('aside input')!
    await act(async () => changeInput(renameInput, '采购模板'))
    const saveName = Array.from(container.querySelectorAll<HTMLButtonElement>('aside button')).find(
      (button) => button.textContent === '保存名称',
    )
    await act(async () => saveName?.click())
    expect(update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ title: '采购模板', expectedVersion: 1 }),
      expect.any(AbortSignal),
    )
    expect(container.textContent).toContain('已重命名为“采购模板”')
    expect(get).toHaveBeenCalledTimes(3)

    await openActions('采购模板')
    const duplicate = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'),
    ).find((button) => button.textContent === '创建副本')
    await act(async () => duplicate?.click())
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ title: '原模板 副本' }),
      expect.any(AbortSignal),
    )
    expect(container.textContent).toContain('原模板 副本')

    await openActions('采购模板')
    const deleteAction = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'),
    ).find((button) => button.textContent === '删除模板')
    await act(async () => deleteAction?.click())
    expect(container.querySelector('[role="alertdialog"]')?.textContent).toContain('无法撤销')
    const confirmDelete = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent === '永久删除',
    )
    await act(async () => confirmDelete?.click())
    expect(remove).toHaveBeenCalledWith(1, expect.any(AbortSignal))
    expect(document.activeElement).toBe(container.querySelector('#workspace-files'))
    expect(container.querySelector('[role="menu"]')).toBeNull()
    expect(container.querySelector('[role="menuitem"]')).toBeNull()
  })

  it('dismisses the card action popover on Escape or outside pointer and restores trigger focus', async () => {
    const onOpen = vi.fn()
    await render(fakeApi({ list: vi.fn(async () => [summary(1, '采购模板')]) }), vi.fn(), onOpen)
    const trigger = container.querySelector<HTMLButtonElement>(
      'button[aria-label="模板操作 采购模板"]',
    )!

    trigger.focus()
    await act(async () => trigger.click())
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
    expect(container.querySelector('[role="dialog"]')).not.toBeNull()
    expect(onOpen).not.toHaveBeenCalled()

    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(trigger)

    await act(async () => trigger.click())
    await act(async () =>
      container
        .querySelector('#workspace-files')
        ?.dispatchEvent(new Event('pointerdown', { bubbles: true })),
    )
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('keeps a failed rename sheet open with its draft and prevents duplicate submission', async () => {
    let rejectUpdate: ((reason?: unknown) => void) | undefined
    const update = vi.fn<TemplateApi['update']>(
      () =>
        new Promise<TemplateRecord>((_resolve, reject) => {
          rejectUpdate = reject
        }),
    )
    await render(
      fakeApi({
        list: vi.fn(async () => [summary(1, '原模板')]),
        get: vi.fn(async () => record(1, '原模板')),
        update,
      }),
    )

    const trigger = container.querySelector<HTMLButtonElement>(
      'button[aria-label="模板操作 原模板"]',
    )!
    await act(async () => trigger.click())
    const rename = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'),
    ).find((button) => button.textContent === '重命名')!
    await act(async () => rename.click())
    const input = container.querySelector<HTMLInputElement>('aside input')!
    await act(async () => changeInput(input, '采购模板'))
    const form = container.querySelector<HTMLFormElement>('aside form')!
    await act(async () => form.requestSubmit())

    const pendingSubmit = container.querySelector<HTMLButtonElement>('aside button[type="submit"]')!
    expect(pendingSubmit.disabled).toBe(true)
    await act(async () => form.requestSubmit())
    expect(update).toHaveBeenCalledTimes(1)

    await act(async () => rejectUpdate?.(new TemplateApiError('network', 'offline', undefined)))
    expect(container.querySelector('aside')).not.toBeNull()
    expect(container.querySelector<HTMLInputElement>('aside input')?.value).toBe('采购模板')
    expect(container.querySelector('aside [role="alert"]')?.textContent).toContain('重命名未完成')
  })

  it('keeps a failed delete dialog open and prevents duplicate destructive requests', async () => {
    let rejectDelete: ((reason?: unknown) => void) | undefined
    const remove = vi.fn<TemplateApi['delete']>(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectDelete = reject
        }),
    )
    await render(fakeApi({ list: vi.fn(async () => [summary(1, '采购模板')]), delete: remove }))

    const trigger = container.querySelector<HTMLButtonElement>(
      'button[aria-label="模板操作 采购模板"]',
    )!
    await act(async () => trigger.click())
    const removeAction = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'),
    ).find((button) => button.textContent === '删除模板')!
    await act(async () => removeAction.click())
    const confirm = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent === '永久删除',
    )!
    await act(async () => confirm.click())
    expect(confirm.disabled).toBe(true)
    await act(async () => confirm.click())
    expect(remove).toHaveBeenCalledTimes(1)

    await act(async () => rejectDelete?.(new TemplateApiError('server', 'failed', 500)))
    expect(container.querySelector('[role="alertdialog"]')).not.toBeNull()
    expect(container.querySelector('[role="alertdialog"] [role="alert"]')?.textContent).toContain(
      '删除未完成',
    )
  })

  it('aborts bounded detail requests when the recent section is replaced', async () => {
    const signals: AbortSignal[] = []
    const pendingGet = vi.fn<TemplateApi['get']>(
      async (_id, signal) =>
        new Promise<TemplateRecord>(() => {
          if (signal) signals.push(signal)
        }),
    )
    const firstApi = fakeApi({
      list: vi.fn(async () => [summary(1, '待取消一'), summary(2, '待取消二')]),
      get: pendingGet,
    })
    await render(firstApi)
    expect(signals).toHaveLength(2)

    await act(async () => {
      root.render(<WorkspaceHome api={fakeApi()} onNew={vi.fn()} onOpen={vi.fn()} />)
    })
    expect(signals.every((signal) => signal.aborted)).toBe(true)
  })

  it('maps list errors and retries the canonical list request', async () => {
    const list = vi
      .fn<TemplateApi['list']>()
      .mockRejectedValueOnce(new TemplateApiError('network', 'offline'))
      .mockResolvedValueOnce([])
    await render(fakeApi({ list }))

    expect(container.querySelector('[role="alert"]')?.textContent).toContain('无法连接模板服务')
    const retry = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.includes('重新载入'),
    )
    await act(async () => retry?.click())
    expect(list).toHaveBeenCalledTimes(2)
    expect(container.textContent).toContain('创建第一份模板')
  })
})

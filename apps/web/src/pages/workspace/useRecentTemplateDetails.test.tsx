import { StrictMode, act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { INITIAL_TEMPLATE } from '../../documents/templates'
import type { TemplateApi, TemplateRecord } from '../../api/templateApi'
import { useRecentTemplateDetails } from './useRecentTemplateDetails'

const IDS = [1, 2, 3, 4, 5, 6] as const
const NOW = '2026-07-31T08:30:00.000Z'

function record(id: number): TemplateRecord {
  return {
    id,
    key: `template-key-${id}`,
    title: `模板 ${id}`,
    content: INITIAL_TEMPLATE,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  }
}

function fakeApi(get: TemplateApi['get']): TemplateApi {
  return {
    list: vi.fn<TemplateApi['list']>(),
    create: vi.fn<TemplateApi['create']>(),
    get,
    getByKey: vi.fn<TemplateApi['getByKey']>(),
    update: vi.fn<TemplateApi['update']>(),
    delete: vi.fn<TemplateApi['delete']>(),
    listVersions: vi.fn<TemplateApi['listVersions']>(),
    getVersion: vi.fn<TemplateApi['getVersion']>(),
    restore: vi.fn<TemplateApi['restore']>(),
  }
}

function Harness({ api }: { api: TemplateApi }) {
  useRecentTemplateDetails(api, IDS)
  return null
}

describe('useRecentTemplateDetails', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('does not duplicate bounded detail calls during StrictMode effect cleanup', async () => {
    const get = vi.fn<TemplateApi['get']>(async (id) => record(id))
    const api = fakeApi(get)

    await act(async () => {
      root.render(
        <StrictMode>
          <Harness api={api} />
        </StrictMode>,
      )
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(get).toHaveBeenCalledTimes(4)
    expect(get.mock.calls.map(([id]) => id)).toEqual([1, 2, 3, 4])
    expect(get.mock.calls.every(([, signal]) => signal instanceof AbortSignal)).toBe(true)
  })
})

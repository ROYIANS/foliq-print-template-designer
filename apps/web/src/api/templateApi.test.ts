import { describe, expect, it, vi } from 'vitest'
import type { TemplateSchema } from '@ptd/core'
import { INITIAL_TEMPLATE } from '../documents/templates'
import { createTemplateApi, TemplateApiError } from './templateApi'

const NOW = '2026-07-31T08:30:00.000Z'

const CANONICAL_TEMPLATE: TemplateSchema = {
  _version: 2,
  pageConfig: { ...INITIAL_TEMPLATE.pageConfig, title: '数据校样模板' },
  pages: [
    {
      id: 'canonical-page',
      componentData: [
        {
          id: 'order-number',
          component: 'RoySimpleText',
          propValue: '订单编号',
          style: { width: 160, height: 32, rotate: 0, opacity: 1 },
          groupStyle: {},
          position: { x: 12, y: 18 },
          bindings: [
            {
              id: 'order-number-binding',
              target: { kind: 'text' },
              expression: { kind: 'field', fieldId: 'order-number-field' },
            },
          ],
        },
      ],
    },
  ],
  data: {
    version: 1,
    fields: [
      {
        id: 'order-number-field',
        name: '订单编号',
        path: ['order', 'number'],
        valueType: 'string',
      },
    ],
    sampleRecords: [{ order: { number: 'FQ-20260801-01' } }],
  },
}

function record(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    key: 'template-key-7',
    title: '出库单',
    content: INITIAL_TEMPLATE,
    version: 3,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('template API client', () => {
  it('parses records, sends same-origin cookies and forwards AbortSignal', async () => {
    const controller = new AbortController()
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(record()),
    )
    const api = createTemplateApi(fetcher)

    const result = await api.update(
      7,
      { title: '出库单', content: INITIAL_TEMPLATE, expectedVersion: 2 },
      controller.signal,
    )

    expect(result).toMatchObject({ id: 7, title: '出库单', version: 3 })
    expect(result.content.pages).toHaveLength(1)
    expect(fetcher).toHaveBeenCalledWith(
      '/api/templates/7',
      expect.objectContaining({
        method: 'PUT',
        credentials: 'include',
        signal: controller.signal,
      }),
    )
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toMatchObject({
      title: '出库单',
      expectedVersion: 2,
    })
  })

  it('accepts canonical v2 content without requiring deprecated legacy keys', async () => {
    const api = createTemplateApi(
      vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(record({ content: CANONICAL_TEMPLATE })),
      ),
    )

    const result = await api.get(7)

    expect(result.content).toEqual(CANONICAL_TEMPLATE)
    expect(result.content).not.toHaveProperty('dataSource')
    expect(result.content).not.toHaveProperty('dataSet')
    expect(result.content.data?.sampleRecords).toEqual([{ order: { number: 'FQ-20260801-01' } }])
    expect(result.content.pages[0]?.componentData[0]?.bindings).toHaveLength(1)
  })

  it('keeps accepting legacy v0 content through Core deserialization', async () => {
    const { _version: _legacyVersion, ...legacyV0 } = INITIAL_TEMPLATE
    void _legacyVersion
    const api = createTemplateApi(
      vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(record({ content: legacyV0 })),
      ),
    )

    const result = await api.get(7)

    expect(result.content).toMatchObject({ _version: 0, dataSource: [], dataSet: {} })
    expect(result.content.data).toBeUndefined()
  })

  it('covers list, create, delete and version endpoint contracts', async () => {
    const responses = [
      jsonResponse([record()]),
      jsonResponse(record({ id: 8, version: 1 })),
      jsonResponse({ deleted: true }),
      jsonResponse([{ version: 3, title: '出库单', createdAt: NOW }]),
      jsonResponse({ ...record(), templateId: 7 }),
      jsonResponse(record({ version: 4 })),
    ]
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      responses.shift()!,
    )
    const api = createTemplateApi(fetcher)

    await expect(api.list()).resolves.toHaveLength(1)
    await expect(api.create({ title: '副本', content: INITIAL_TEMPLATE })).resolves.toMatchObject({
      id: 8,
      version: 1,
    })
    await expect(api.delete(8)).resolves.toBeUndefined()
    await expect(api.listVersions(7)).resolves.toEqual([
      { version: 3, title: '出库单', createdAt: NOW },
    ])
    await expect(api.getVersion(7, 3)).resolves.toMatchObject({ templateId: 7, version: 3 })
    await expect(api.restore(7, 2, 3)).resolves.toMatchObject({ version: 4 })

    expect(fetcher.mock.calls.map(([path]) => path)).toEqual([
      '/api/templates',
      '/api/templates',
      '/api/templates/8',
      '/api/templates/7/versions',
      '/api/templates/7/versions/3',
      '/api/templates/7/versions/2/restore',
    ])
    expect(JSON.parse(String(fetcher.mock.calls[5]?.[1]?.body))).toEqual({ expectedVersion: 3 })
  })

  it.each([
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [404, 'not-found'],
    [409, 'conflict'],
    [503, 'server'],
  ] as const)('maps HTTP %s to a structured %s error', async (status, kind) => {
    const api = createTemplateApi(
      vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse({ statusCode: status, message: `failure-${status}` }, status),
      ),
    )

    const error = await api.get(7).catch((reason: unknown) => reason)
    expect(error).toBeInstanceOf(TemplateApiError)
    expect(error).toMatchObject({ kind, status, message: `failure-${status}` })
  })

  it('rejects malformed success bodies instead of trusting TypeScript types', async () => {
    const api = createTemplateApi(
      vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(record({ content: null })),
      ),
    )

    const error = await api.get(7).catch((reason: unknown) => reason)
    expect(error).toBeInstanceOf(TemplateApiError)
    expect(error).toMatchObject({ kind: 'invalid-response' })
  })

  it('rejects structurally invalid nested template content', async () => {
    const invalidContent = {
      ...INITIAL_TEMPLATE,
      pages: [
        {
          id: 'page-1',
          componentData: [
            {
              id: 'broken-component',
              component: 'RoySimpleText',
              propValue: '内容',
              style: { width: 'wide', height: 40, rotate: 0, opacity: 1 },
              groupStyle: {},
              position: { x: 0, y: 0 },
            },
          ],
        },
      ],
    }
    const api = createTemplateApi(
      vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(record({ content: invalidContent })),
      ),
    )

    await expect(api.get(7)).rejects.toMatchObject({ kind: 'invalid-response' })
  })

  it('rejects canonical responses that also contain non-empty legacy datasource truth', async () => {
    const api = createTemplateApi(
      vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(
          record({
            content: {
              ...CANONICAL_TEMPLATE,
              dataSource: [{ id: 'legacy', title: 'Legacy', field: 'legacy', typeName: 'String' }],
              dataSet: { legacy: 'stale' },
            },
          }),
        ),
      ),
    )

    await expect(api.get(7)).rejects.toMatchObject({ kind: 'invalid-response' })
  })

  it.each(['2026-07-31', '2026-07-31T08:30:00Z', '2026-02-30T08:30:00.000Z'])(
    'rejects non-canonical or impossible timestamps: %s',
    async (invalidDate) => {
      const api = createTemplateApi(
        vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
          jsonResponse([record({ updatedAt: invalidDate })]),
        ),
      )

      await expect(api.list()).rejects.toMatchObject({ kind: 'invalid-response' })
    },
  )

  it('distinguishes network failures and preserves aborts', async () => {
    const networkApi = createTemplateApi(
      vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
        throw new TypeError('offline')
      }),
    )
    const networkError = await networkApi.list().catch((reason: unknown) => reason)
    expect(networkError).toMatchObject({ kind: 'network' })

    const abort = new DOMException('aborted', 'AbortError')
    const abortApi = createTemplateApi(
      vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
        throw abort
      }),
    )
    await expect(abortApi.list()).rejects.toBe(abort)
  })
})

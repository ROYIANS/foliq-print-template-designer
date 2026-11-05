import { afterEach, describe, expect, it, vi } from 'vitest'
import { createOutputJob } from './outputJob'
import {
  createOutputApi,
  downloadOutputPdf,
  OutputApiError,
  outputApiErrorMessage,
} from './outputApi'
import { INITIAL_TEMPLATE } from '../documents/templates'

const NOW = '2026-08-03T08:30:00.000Z'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('outputApi', () => {
  it('posts a structured export job and returns a non-empty PDF download', async () => {
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(new Blob(['%PDF-1.7'], { type: 'application/pdf' }), {
          status: 200,
          headers: { 'Content-Type': 'application/pdf' },
        }),
    )
    const api = createOutputApi(fetcher)
    const job = createOutputJob(INITIAL_TEMPLATE, 'export', NOW)

    const result = await api.createPdf(job, '采购送货单')

    expect(result.fileName).toBe('采购送货单.pdf')
    expect(result.blob.size).toBeGreaterThan(0)
    expect(fetcher).toHaveBeenCalledWith(
      '/api/output/pdf',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/pdf',
          'Content-Type': 'application/json',
        },
      }),
    )
    const request = fetcher.mock.calls[0]?.[1]
    const body = JSON.parse(String(request?.body)) as Record<string, unknown>
    expect(body).not.toHaveProperty('html')
    expect(body).not.toHaveProperty('renderUrl')
    expect(body['renderContext']).toMatchObject({ mode: 'export', now: NOW })
  })

  it('preserves layout diagnostics from a 422 response for actionable UI copy', async () => {
    const api = createOutputApi(
      async () =>
        new Response(
          JSON.stringify({
            message: 'The output document contains fatal layout diagnostics',
            diagnosticCodes: ['ROW_TOO_TALL'],
          }),
          { status: 422, headers: { 'Content-Type': 'application/json' } },
        ),
    )

    const error = await api
      .createPdf(createOutputJob(INITIAL_TEMPLATE, 'export', NOW), 'test')
      .catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(OutputApiError)
    expect(error).toMatchObject({ kind: 'layout', diagnosticCodes: ['ROW_TOO_TALL'] })
    expect(outputApiErrorMessage(error)).toContain('ROW_TOO_TALL')
  })

  it('downloads with an object URL and always schedules its release', () => {
    const createObjectURL = vi.fn(() => 'blob:foliq-pdf')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)

    downloadOutputPdf({
      blob: new Blob(['%PDF'], { type: 'application/pdf' }),
      fileName: 'proof.pdf',
    })

    expect(click).toHaveBeenCalledTimes(1)
    expect(document.querySelector('a[download="proof.pdf"]')).toBeNull()
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    return new Promise<void>((resolve) =>
      queueMicrotask(() => {
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:foliq-pdf')
        resolve()
      }),
    )
  })
})

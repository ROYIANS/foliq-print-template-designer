import type { OutputJob } from './outputJob'

export type OutputApiErrorKind =
  | 'bad-request'
  | 'unauthorized'
  | 'layout'
  | 'saturated'
  | 'timeout'
  | 'unavailable'
  | 'network'
  | 'invalid-response'

export class OutputApiError extends Error {
  readonly kind: OutputApiErrorKind
  readonly status?: number
  readonly diagnosticCodes: readonly string[]

  constructor(
    kind: OutputApiErrorKind,
    message: string,
    status?: number,
    diagnosticCodes: readonly string[] = [],
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'OutputApiError'
    this.kind = kind
    this.status = status
    this.diagnosticCodes = diagnosticCodes
  }
}

export interface OutputPdfDownload {
  readonly blob: Blob
  readonly fileName: string
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function fileName(value: string): string {
  const trimmed = value.trim().replace(/\.pdf$/i, '')
  return `${trimmed || 'foliq-output'}.pdf`
}

function errorKind(status: number): OutputApiErrorKind {
  if (status === 400) return 'bad-request'
  if (status === 401 || status === 403) return 'unauthorized'
  if (status === 422) return 'layout'
  if (status === 429) return 'saturated'
  if (status === 504) return 'timeout'
  return 'unavailable'
}

async function responseError(response: Response): Promise<OutputApiError> {
  let message = response.statusText || `HTTP ${response.status}`
  let diagnosticCodes: string[] = []
  try {
    const body: unknown = await response.json()
    if (isRecord(body)) {
      if (typeof body['message'] === 'string') message = body['message']
      if (
        Array.isArray(body['diagnosticCodes']) &&
        body['diagnosticCodes'].every((code) => typeof code === 'string')
      ) {
        diagnosticCodes = body['diagnosticCodes']
      }
    }
  } catch {
    // The status remains authoritative when a proxy returns HTML or an empty body.
  }
  return new OutputApiError(errorKind(response.status), message, response.status, diagnosticCodes)
}

export function createOutputApi(fetcher: Fetcher = window.fetch.bind(window)) {
  return {
    async createPdf(job: OutputJob, requestedFileName: string, signal?: AbortSignal) {
      let response: Response
      try {
        response = await fetcher('/api/output/pdf', {
          method: 'POST',
          credentials: 'include',
          headers: {
            Accept: 'application/pdf',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ...job, fileName: requestedFileName }),
          signal,
        })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error
        throw new OutputApiError('network', '无法连接 PDF 输出服务。', undefined, [], {
          cause: error,
        })
      }
      if (!response.ok) throw await responseError(response)
      if (!response.headers.get('Content-Type')?.toLowerCase().startsWith('application/pdf')) {
        throw new OutputApiError('invalid-response', 'PDF 输出服务返回了无法识别的文件。')
      }
      const blob = await response.blob()
      if (blob.size === 0) {
        throw new OutputApiError('invalid-response', 'PDF 输出服务返回了空文件。')
      }
      return { blob, fileName: fileName(requestedFileName) } satisfies OutputPdfDownload
    },
  }
}

export const outputApi = createOutputApi()

export function downloadOutputPdf(download: OutputPdfDownload): void {
  const url = URL.createObjectURL(download.blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = download.fileName
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  queueMicrotask(() => URL.revokeObjectURL(url))
}

export function outputApiErrorMessage(error: unknown): string {
  if (!(error instanceof OutputApiError)) {
    return 'PDF 导出未完成。请检查模板内容与网络连接后重试。'
  }
  if (error.kind === 'layout') {
    const codes = error.diagnosticCodes.length > 0 ? `（${error.diagnosticCodes.join('、')}）` : ''
    return `模板存在阻止导出的排版问题${codes}。请在打印预览中检查后重试。`
  }
  if (error.kind === 'saturated') return 'PDF 输出任务已满，请稍后重试。'
  if (error.kind === 'timeout') return 'PDF 生成超过 30 秒。请减少页面内容后重试。'
  if (error.kind === 'unauthorized') return '登录状态已失效，请重新登录后导出。'
  if (error.kind === 'network') return '无法连接 PDF 输出服务，请检查网络后重试。'
  if (error.kind === 'invalid-response') return error.message
  return 'PDF 输出服务暂时不可用，请稍后重试。'
}

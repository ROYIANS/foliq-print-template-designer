import { deserialize, isTemplateSchema, type TemplateSchema } from '@ptd/core'

export interface TemplateSummary {
  id: number
  key: string
  title: string
  version: number
  createdAt: string
  updatedAt: string
}

export interface TemplateRecord extends TemplateSummary {
  content: TemplateSchema
}

export interface TemplateVersionSummary {
  version: number
  title: string
  createdAt: string
}

export interface TemplateVersionRecord extends TemplateVersionSummary {
  id: number
  templateId: number
  content: TemplateSchema
}

export interface TemplateWriteInput {
  title: string
  content: TemplateSchema
}

export interface TemplateUpdateInput extends TemplateWriteInput {
  expectedVersion: number
}

export type TemplateApiErrorKind =
  | 'bad-request'
  | 'unauthorized'
  | 'forbidden'
  | 'not-found'
  | 'conflict'
  | 'server'
  | 'network'
  | 'invalid-response'

export class TemplateApiError extends Error {
  readonly kind: TemplateApiErrorKind
  readonly status?: number

  constructor(
    kind: TemplateApiErrorKind,
    message: string,
    status?: number,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'TemplateApiError'
    this.kind = kind
    this.status = status
  }
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export interface TemplateApi {
  list(signal?: AbortSignal): Promise<TemplateSummary[]>
  create(input: TemplateWriteInput, signal?: AbortSignal): Promise<TemplateRecord>
  get(id: number, signal?: AbortSignal): Promise<TemplateRecord>
  getByKey(key: string, signal?: AbortSignal): Promise<TemplateRecord>
  update(id: number, input: TemplateUpdateInput, signal?: AbortSignal): Promise<TemplateRecord>
  delete(id: number, signal?: AbortSignal): Promise<void>
  listVersions(id: number, signal?: AbortSignal): Promise<TemplateVersionSummary[]>
  getVersion(id: number, version: number, signal?: AbortSignal): Promise<TemplateVersionRecord>
  restore(
    id: number,
    version: number,
    expectedVersion: number,
    signal?: AbortSignal,
  ): Promise<TemplateRecord>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function positiveInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw invalidResponse(`${field} must be a positive integer`)
  }
  return value
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw invalidResponse(`${field} must be a non-empty string`)
  }
  return value
}

function templateKey(value: unknown): string {
  const key = text(value, 'key')
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(key)) throw invalidResponse('key must be a template key')
  return key
}

function timestamp(value: unknown, field: string): string {
  const result = text(value, field)
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(result) ||
    !Number.isFinite(Date.parse(result)) ||
    new Date(result).toISOString() !== result
  ) {
    throw invalidResponse(`${field} must be an ISO timestamp`)
  }
  return result
}

function invalidResponse(message: string, cause?: unknown): TemplateApiError {
  return new TemplateApiError(
    'invalid-response',
    `模板服务返回了无法识别的数据：${message}`,
    undefined,
    {
      cause,
    },
  )
}

function parseTemplate(value: unknown): TemplateSchema {
  if (!isRecord(value)) throw invalidResponse('content must be an object')

  try {
    const template = deserialize(JSON.stringify(value))
    if (!isTemplateSchema(template)) throw new Error('normalized template is structurally invalid')
    return template
  } catch (error) {
    throw invalidResponse('content could not be normalized', error)
  }
}

function parseSummary(value: unknown): TemplateSummary {
  if (!isRecord(value)) throw invalidResponse('template summary must be an object')
  return {
    id: positiveInteger(value['id'], 'id'),
    key: templateKey(value['key']),
    title: text(value['title'], 'title'),
    version: positiveInteger(value['version'], 'version'),
    createdAt: timestamp(value['createdAt'], 'createdAt'),
    updatedAt: timestamp(value['updatedAt'], 'updatedAt'),
  }
}

function parseTemplateRecord(value: unknown): TemplateRecord {
  if (!isRecord(value)) throw invalidResponse('template must be an object')
  return { ...parseSummary(value), content: parseTemplate(value['content']) }
}

function parseVersionSummary(value: unknown): TemplateVersionSummary {
  if (!isRecord(value)) throw invalidResponse('template version summary must be an object')
  return {
    version: positiveInteger(value['version'], 'version'),
    title: text(value['title'], 'title'),
    createdAt: timestamp(value['createdAt'], 'createdAt'),
  }
}

function parseVersionRecord(value: unknown): TemplateVersionRecord {
  if (!isRecord(value)) throw invalidResponse('template version must be an object')
  return {
    ...parseVersionSummary(value),
    id: positiveInteger(value['id'], 'id'),
    templateId: positiveInteger(value['templateId'], 'templateId'),
    content: parseTemplate(value['content']),
  }
}

function errorKind(status: number): TemplateApiErrorKind {
  if (status === 400) return 'bad-request'
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not-found'
  if (status === 409) return 'conflict'
  return 'server'
}

async function responseError(response: Response): Promise<TemplateApiError> {
  let detail = response.statusText || `HTTP ${response.status}`
  try {
    const body: unknown = await response.json()
    if (isRecord(body)) {
      const message = body['message']
      if (typeof message === 'string') detail = message
      if (Array.isArray(message) && message.every((item) => typeof item === 'string')) {
        detail = message.join('；')
      }
    }
  } catch {
    // A proxy may return HTML or an empty response. The HTTP status remains authoritative.
  }
  return new TemplateApiError(errorKind(response.status), detail, response.status)
}

async function request(
  fetcher: Fetcher,
  path: string,
  init: RequestInit,
  parse: (value: unknown) => unknown,
): Promise<unknown> {
  let response: Response
  try {
    response = await fetcher(path, { ...init, credentials: 'include' })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new TemplateApiError('network', '无法连接模板服务，请检查网络后重试。', undefined, {
      cause: error,
    })
  }

  if (!response.ok) throw await responseError(response)
  try {
    return parse(await response.json())
  } catch (error) {
    if (error instanceof TemplateApiError) throw error
    throw invalidResponse('response body is not valid JSON', error)
  }
}

function jsonBody(value: unknown): Pick<RequestInit, 'body' | 'headers'> {
  return {
    body: JSON.stringify(value),
    headers: { 'Content-Type': 'application/json' },
  }
}

export function createTemplateApi(
  fetcher: Fetcher = (input, init) => window.fetch(input, init),
): TemplateApi {
  return {
    async list(signal) {
      return (await request(fetcher, '/api/templates', { method: 'GET', signal }, (value) => {
        if (!Array.isArray(value)) throw invalidResponse('template list must be an array')
        return value.map(parseSummary)
      })) as TemplateSummary[]
    },
    async create(input, signal) {
      return (await request(
        fetcher,
        '/api/templates',
        { method: 'POST', signal, ...jsonBody(input) },
        parseTemplateRecord,
      )) as TemplateRecord
    },
    async get(id, signal) {
      return (await request(
        fetcher,
        `/api/templates/${id}`,
        { method: 'GET', signal },
        parseTemplateRecord,
      )) as TemplateRecord
    },
    async getByKey(key, signal) {
      return (await request(
        fetcher,
        `/api/templates/by-key/${encodeURIComponent(key)}`,
        { method: 'GET', signal },
        parseTemplateRecord,
      )) as TemplateRecord
    },
    async update(id, input, signal) {
      return (await request(
        fetcher,
        `/api/templates/${id}`,
        { method: 'PUT', signal, ...jsonBody(input) },
        parseTemplateRecord,
      )) as TemplateRecord
    },
    async delete(id, signal) {
      await request(fetcher, `/api/templates/${id}`, { method: 'DELETE', signal }, (value) => {
        if (!isRecord(value) || value['deleted'] !== true) {
          throw invalidResponse('delete acknowledgement is invalid')
        }
        return undefined
      })
    },
    async listVersions(id, signal) {
      return (await request(
        fetcher,
        `/api/templates/${id}/versions`,
        { method: 'GET', signal },
        (value) => {
          if (!Array.isArray(value)) throw invalidResponse('version list must be an array')
          return value.map(parseVersionSummary)
        },
      )) as TemplateVersionSummary[]
    },
    async getVersion(id, version, signal) {
      return (await request(
        fetcher,
        `/api/templates/${id}/versions/${version}`,
        { method: 'GET', signal },
        parseVersionRecord,
      )) as TemplateVersionRecord
    },
    async restore(id, version, expectedVersion, signal) {
      return (await request(
        fetcher,
        `/api/templates/${id}/versions/${version}/restore`,
        { method: 'POST', signal, ...jsonBody({ expectedVersion }) },
        parseTemplateRecord,
      )) as TemplateRecord
    },
  }
}

export const templateApi = createTemplateApi()

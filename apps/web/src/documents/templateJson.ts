import {
  CURRENT_TEMPLATE_VERSION,
  TEMPLATE_SCHEMA_JSON_LIMIT_BYTES,
  deserialize,
  serialize,
  type TemplateSchema,
} from '@ptd/core'

export type TemplateJsonErrorCode =
  | 'file-type'
  | 'too-large'
  | 'read-failed'
  | 'syntax'
  | 'root'
  | 'version'
  | 'pages'
  | 'schema'

export class TemplateJsonError extends Error {
  constructor(
    readonly code: TemplateJsonErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'TemplateJsonError'
  }
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizedTemplateTitle(title: string): string {
  const withoutExtension = title.replace(/(?:\.foliq)?\.json$/iu, '')
  const sanitized = withoutExtension
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .replace(/[. ]+$/gu, '')
  const bounded = Array.from(sanitized || '未命名模板')
    .slice(0, 80)
    .join('')
  return /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/iu.test(bounded) ? `Foliq ${bounded}` : bounded
}

export function templateJsonFilename(title: string): string {
  return `${normalizedTemplateTitle(title)}.foliq.json`
}

export function serializeTemplateJson(template: TemplateSchema): string {
  const compact = serialize(template)
  const canonical = JSON.parse(compact) as unknown
  const readable = `${JSON.stringify(canonical, null, 2)}\n`
  if (byteLength(readable) <= TEMPLATE_SCHEMA_JSON_LIMIT_BYTES) return readable

  const portable = `${compact}\n`
  if (byteLength(portable) <= TEMPLATE_SCHEMA_JSON_LIMIT_BYTES) return portable
  throw new TemplateJsonError('too-large', '当前模板超过 4 MiB，无法导出为可重新导入的模板 JSON。')
}

export function parseTemplateJson(source: string): TemplateSchema {
  if (byteLength(source) > TEMPLATE_SCHEMA_JSON_LIMIT_BYTES) {
    throw new TemplateJsonError('too-large', '模板 JSON 超过 4 MiB，无法导入或保存。')
  }
  const json = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source

  let parsed: unknown
  try {
    parsed = JSON.parse(json) as unknown
  } catch (error) {
    throw new TemplateJsonError('syntax', 'JSON 语法有误，请检查缺失的逗号、引号或括号。', {
      cause: error,
    })
  }

  if (!isRecord(parsed)) {
    throw new TemplateJsonError('root', '模板 JSON 的根节点必须是对象。')
  }

  const version = parsed['_version'] ?? 0
  if (
    typeof version !== 'number' ||
    !Number.isInteger(version) ||
    version < 0 ||
    version > CURRENT_TEMPLATE_VERSION
  ) {
    throw new TemplateJsonError(
      'version',
      `不支持模板版本 ${String(version)}；当前最高支持 v${CURRENT_TEMPLATE_VERSION}。`,
    )
  }

  if (!Array.isArray(parsed['pages']) || parsed['pages'].length === 0) {
    throw new TemplateJsonError('pages', '模板至少需要一个页面，请检查 pages 字段。')
  }

  try {
    const compatible = deserialize(json)
    return deserialize(serialize(compatible))
  } catch (error) {
    throw new TemplateJsonError('schema', '模板结构不合法，请检查页面组件、数据定义与绑定合同。', {
      cause: error,
    })
  }
}

export async function readTemplateJsonFile(file: File): Promise<TemplateSchema> {
  if (!/\.json$/iu.test(file.name)) {
    throw new TemplateJsonError('file-type', '请选择 `.json` 或 `.foliq.json` 模板文件。')
  }
  if (file.size > TEMPLATE_SCHEMA_JSON_LIMIT_BYTES) {
    throw new TemplateJsonError('too-large', '模板 JSON 超过 4 MiB，无法导入或保存。')
  }
  try {
    return parseTemplateJson(await file.text())
  } catch (error) {
    if (error instanceof TemplateJsonError) throw error
    throw new TemplateJsonError('read-failed', '无法读取模板文件，请重新选择本地 JSON 文件。', {
      cause: error,
    })
  }
}

export function downloadTemplateJson(template: TemplateSchema, title: string): void {
  const content = serializeTemplateJson(template)
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = templateJsonFilename(title)
  link.hidden = true
  document.body.append(link)
  try {
    link.click()
  } finally {
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}

export function templateJsonErrorMessage(error: unknown): string {
  return error instanceof TemplateJsonError
    ? error.message
    : '模板 JSON 操作未完成，请检查文件后重试。'
}

import { CURRENT_TEMPLATE_VERSION, TEMPLATE_SCHEMA_JSON_LIMIT_BYTES } from '@ptd/core'
import { describe, expect, it } from 'vitest'
import { INITIAL_TEMPLATE } from './templates'
import {
  TemplateJsonError,
  parseTemplateJson,
  serializeTemplateJson,
  templateJsonFilename,
} from './templateJson'

describe('template JSON exchange', () => {
  it('exports readable canonical JSON without server document metadata', () => {
    const output = serializeTemplateJson(INITIAL_TEMPLATE)
    const parsed = JSON.parse(output) as Record<string, unknown>

    expect(parsed['_version']).toBe(CURRENT_TEMPLATE_VERSION)
    expect(parsed['data']).toEqual({ version: 1, fields: [] })
    expect(parsed).not.toHaveProperty('dataSource')
    expect(parsed).not.toHaveProperty('dataSet')
    expect(parsed).not.toHaveProperty('id')
    expect(output).toContain('\n  "pageConfig"')
    expect(output).toMatch(/\n$/u)
  })

  it('imports legacy templates as canonical current-version templates', () => {
    const imported = parseTemplateJson(`\ufeff${JSON.stringify(INITIAL_TEMPLATE)}`)

    expect(imported._version).toBe(CURRENT_TEMPLATE_VERSION)
    expect(imported.data).toEqual({ version: 1, fields: [] })
    expect(imported.dataSource).toBeUndefined()
    expect(imported.dataSet).toBeUndefined()
  })

  it('distinguishes syntax, unsupported versions, missing pages and invalid contracts', () => {
    expectTemplateError('{"pages":', 'syntax')
    expectTemplateError(
      JSON.stringify({ ...INITIAL_TEMPLATE, _version: CURRENT_TEMPLATE_VERSION + 1 }),
      'version',
    )
    expectTemplateError(JSON.stringify({ ...INITIAL_TEMPLATE, pages: [] }), 'pages')
    expectTemplateError(
      JSON.stringify({
        ...INITIAL_TEMPLATE,
        pages: [{ id: 'page-1', componentData: [{ id: 'broken' }] }],
      }),
      'schema',
    )
  })

  it('rejects content that exceeds the shared 4 MiB persistence boundary', () => {
    expectTemplateError(' '.repeat(TEMPLATE_SCHEMA_JSON_LIMIT_BYTES + 1), 'too-large')
    expect(() =>
      serializeTemplateJson({
        ...INITIAL_TEMPLATE,
        pageConfig: {
          ...INITIAL_TEMPLATE.pageConfig,
          title: '超'.repeat(TEMPLATE_SCHEMA_JSON_LIMIT_BYTES),
        },
      }),
    ).toThrow('无法导出')
  })

  it('creates cross-platform safe Foliq template filenames', () => {
    expect(templateJsonFilename('  采购/入库:* 单  ')).toBe('采购 入库 单.foliq.json')
    expect(templateJsonFilename('CON')).toBe('Foliq CON.foliq.json')
    expect(templateJsonFilename('layout.foliq.json')).toBe('layout.foliq.json')
    expect(templateJsonFilename('...')).toBe('未命名模板.foliq.json')
  })
})

function expectTemplateError(source: string, code: TemplateJsonError['code']): void {
  try {
    parseTemplateJson(source)
    throw new Error('Expected template JSON parsing to fail')
  } catch (error) {
    expect(error).toBeInstanceOf(TemplateJsonError)
    expect((error as TemplateJsonError).code).toBe(code)
  }
}

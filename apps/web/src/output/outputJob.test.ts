import type { TemplateSchema } from '@ptd/core'
import { describe, expect, it } from 'vitest'
import { createOutputJob } from './outputJob'
import { INITIAL_TEMPLATE } from '../documents/templates'

const NOW = '2026-08-03T08:30:00.000Z'

describe('createOutputJob', () => {
  it('captures deterministic output inputs and the first saved proof record once', () => {
    const template: TemplateSchema = {
      ...INITIAL_TEMPLATE,
      data: {
        version: 1,
        fields: [],
        sampleRecords: [{ orderNo: 'FQ-001' }, { orderNo: 'FQ-002' }],
      },
    }

    const job = createOutputJob(template, 'print', NOW)

    expect(job.template).toBe(template)
    expect(job.renderContext).toEqual({
      data: { orderNo: 'FQ-001' },
      record: { orderNo: 'FQ-001' },
      recordIndex: 0,
      locale: 'zh-CN',
      timeZone: 'Asia/Shanghai',
      now: NOW,
      mode: 'print',
    })
    expect(job.options).toEqual({
      locale: 'zh-CN',
      timeZone: 'Asia/Shanghai',
      now: NOW,
      title: template.pageConfig.title,
    })
  })

  it('uses an empty runtime payload without writing proof state into the template', () => {
    const before = JSON.stringify(INITIAL_TEMPLATE)
    const job = createOutputJob(INITIAL_TEMPLATE, 'export', NOW)

    expect(job.renderContext).toMatchObject({ data: {}, mode: 'export' })
    expect(job.renderContext.record).toBeUndefined()
    expect(JSON.stringify(INITIAL_TEMPLATE)).toBe(before)
  })
})

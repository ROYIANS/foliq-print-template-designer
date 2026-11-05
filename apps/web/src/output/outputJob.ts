import type {
  DataRecord,
  OutputOptions,
  RenderContext,
  RenderMode,
  TemplateSchema,
} from '@ptd/core'

export interface OutputJob {
  readonly template: TemplateSchema
  readonly renderContext: RenderContext
  readonly options: OutputOptions
}

const OUTPUT_LOCALE = 'zh-CN'
const OUTPUT_TIME_ZONE = 'Asia/Shanghai'

function firstProofRecord(template: TemplateSchema): DataRecord | undefined {
  return template.data?.sampleRecords?.[0]
}

/** Captures every non-deterministic output input once, at Host-command execution time. */
export function createOutputJob(
  template: TemplateSchema,
  mode: Extract<RenderMode, 'print' | 'export'>,
  now = new Date().toISOString(),
): OutputJob {
  const record = firstProofRecord(template)
  const renderContext: RenderContext = {
    data: record ?? {},
    ...(record ? { record, recordIndex: 0 } : {}),
    locale: OUTPUT_LOCALE,
    timeZone: OUTPUT_TIME_ZONE,
    now,
    mode,
  }

  return {
    template,
    renderContext,
    options: {
      locale: renderContext.locale,
      timeZone: renderContext.timeZone,
      now: renderContext.now,
      title: template.pageConfig.title,
    },
  }
}

import type { OutputOptions, RenderContext, TemplateSchema } from '@ptd/core'
import {
  compileOutputDocument,
  mountOutputDocument,
  preflightOutputDocument,
  type MountedOutputDocument,
} from '@ptd/export'

export interface OutputRenderJob {
  readonly template: TemplateSchema
  readonly renderContext: RenderContext
  readonly options: OutputOptions
}

export interface OutputRenderResult {
  readonly pageCount: number
  readonly diagnostics: Awaited<ReturnType<typeof preflightOutputDocument>>
}

declare global {
  interface Window {
    __FOLIQ_OUTPUT_RENDER__?: (job: OutputRenderJob) => Promise<OutputRenderResult>
  }
}

const root = document.getElementById('foliq-output-render-root')
if (!(root instanceof HTMLElement)) throw new Error('Foliq output render root is missing')

let mounted: MountedOutputDocument | undefined

window.__FOLIQ_OUTPUT_RENDER__ = async (job) => {
  mounted?.destroy()
  const output = await compileOutputDocument(job)
  mounted = mountOutputDocument(root, output)
  const diagnostics = await preflightOutputDocument(mounted.root, output)
  document.documentElement.dataset.foliqOutputReady = diagnostics.some(
    (diagnostic) => diagnostic.severity === 'error',
  )
    ? 'error'
    : 'ready'
  return { pageCount: output.pages.length, diagnostics }
}

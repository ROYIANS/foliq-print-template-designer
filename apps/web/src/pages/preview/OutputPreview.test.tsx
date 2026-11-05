import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { OutputDocument, OutputDiagnostic } from '@ptd/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createOutputJob } from '../../output/outputJob'
import { OutputPreview } from './OutputPreview'
import { INITIAL_TEMPLATE } from '../../documents/templates'

const exportMocks = vi.hoisted(() => ({
  compile: vi.fn(),
  mount: vi.fn(),
  preflight: vi.fn(),
}))

vi.mock('@ptd/export', () => ({
  compileOutputDocument: exportMocks.compile,
  mountOutputDocument: exportMocks.mount,
  preflightOutputDocument: exportMocks.preflight,
}))

const NOW = '2026-08-03T08:30:00.000Z'

function output(diagnostics: readonly OutputDiagnostic[] = []): OutputDocument {
  return {
    pages: [
      {
        id: 'page-1',
        pageNumber: 1,
        totalPages: 1,
        widthMm: 210,
        heightMm: 297,
        style: {
          background: '#ffffff',
          color: '#222222',
          fontSizePx: 12,
          fontFamily: 'sans-serif',
          lineHeight: 1.4,
        },
        regions: {
          header: {
            kind: 'header',
            bounds: { left: 0, top: 0, width: 0, height: 0 },
            fragments: [],
          },
          body: {
            kind: 'body',
            bounds: { left: 0, top: 0, width: 0, height: 0 },
            fragments: [],
          },
          footer: {
            kind: 'footer',
            bounds: { left: 0, top: 0, width: 0, height: 0 },
            fragments: [],
          },
        },
      },
    ],
    diagnostics,
    metadata: {
      title: '新建模板',
      generatedAt: NOW,
      locale: 'zh-CN',
      timeZone: 'Asia/Shanghai',
    },
  }
}

describe('OutputPreview', () => {
  let container: HTMLDivElement
  let root: Root
  let destroy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    destroy = vi.fn()

    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: vi.fn(function (this: HTMLDialogElement) {
        this.setAttribute('open', '')
      }),
    })
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value: vi.fn(function (this: HTMLDialogElement) {
        this.removeAttribute('open')
      }),
    })
    class ResizeObserverStub {
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)

    exportMocks.compile.mockReset().mockResolvedValue(output())
    exportMocks.preflight
      .mockReset()
      .mockImplementation((_root: HTMLElement, current: OutputDocument) =>
        Promise.resolve(current.diagnostics),
      )
    exportMocks.mount.mockReset().mockImplementation((host: HTMLElement) => {
      const outputRoot = document.createElement('div')
      outputRoot.dataset.ptdOutputDocument = ''
      host.append(outputRoot)
      return { root: outputRoot, destroy }
    })
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    vi.unstubAllGlobals()
    container.remove()
  })

  async function renderPreview(
    props: Partial<{
      onClose: () => void
      onExport: () => void
      exporting: boolean
      exportError: string
    }> = {},
  ) {
    const job = createOutputJob(INITIAL_TEMPLATE, 'print', NOW)
    await act(async () => {
      root.render(
        <OutputPreview
          {...job}
          onClose={props.onClose ?? vi.fn()}
          onExport={props.onExport}
          exporting={props.exporting}
          exportError={props.exportError}
        />,
      )
      await Promise.resolve()
      await Promise.resolve()
    })
    return job
  }

  it('opens a modal proof surface and mounts the derived output without changing the job', async () => {
    const job = await renderPreview()

    expect(container.querySelector('dialog')?.hasAttribute('open')).toBe(true)
    expect(container.querySelector('dialog')?.hasAttribute('data-ptd-theme')).toBe(true)
    expect(container.querySelector('[role="toolbar"]')?.getAttribute('aria-label')).toBe(
      '打印预览工具栏',
    )
    expect(exportMocks.compile).toHaveBeenCalledWith(job)
    expect(container.textContent).toContain('1 页')
    expect(container.textContent).toContain('版面已稳定')
    expect(container.textContent).not.toContain('PRINT PROOF')
    expect(container.querySelector('[data-ptd-output-document]')).not.toBeNull()

    const fitWidth = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('适合宽度'),
    )
    await act(async () => fitWidth?.click())
    expect(fitWidth?.getAttribute('aria-pressed')).toBe('true')

    const actualSize = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === '100%',
    )
    await act(async () => actualSize?.click())
    expect(actualSize?.getAttribute('aria-pressed')).toBe('true')

    const zoomIn = container.querySelector<HTMLButtonElement>('[aria-label="放大预览"]')
    await act(async () => zoomIn?.click())
    expect(container.querySelector('output')?.textContent).toBe('125%')
  })

  it('shows fatal diagnostics and prevents exporting an invalid proof', async () => {
    exportMocks.compile.mockResolvedValue(
      output([
        {
          severity: 'error',
          code: 'ROW_TOO_TALL',
          message: '明细行高于完整正文区域。',
          sourceComponentId: 'detail-table',
          pageNumber: 2,
        },
      ]),
    )
    const onExport = vi.fn()
    await renderPreview({ onExport })

    expect(container.textContent).toContain('发现阻止导出的排版问题')
    expect(container.textContent).toContain('ROW_TOO_TALL')
    expect(container.textContent).toContain('第 2 页 · detail-table')
    const exportButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent === '导出 PDF',
    )
    expect(exportButton?.disabled).toBe(true)
    await act(async () => exportButton?.click())
    expect(onExport).not.toHaveBeenCalled()
  })

  it('closes through the explicit action and destroys mounted component instances', async () => {
    const onClose = vi.fn()
    await renderPreview({ onClose })

    const close = container.querySelector<HTMLButtonElement>('[aria-label="关闭打印预览"]')
    await act(async () => close?.click())
    expect(onClose).toHaveBeenCalledTimes(1)

    await act(async () => root.unmount())
    expect(destroy).toHaveBeenCalledTimes(1)
    root = createRoot(container)
  })
})

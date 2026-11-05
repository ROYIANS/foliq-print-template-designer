import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  RiAddLine,
  RiAspectRatioLine,
  RiCloseLine,
  RiExpandWidthLine,
  RiFilePdf2Line,
  RiSubtractLine,
} from '@remixicon/react'
import {
  getPageDimensions,
  pxToMm,
  type OutputDiagnostic,
  type OutputOptions,
  type RenderContext,
  type TemplateSchema,
} from '@ptd/core'
import {
  compileOutputDocument,
  mountOutputDocument,
  preflightOutputDocument,
  type MountedOutputDocument,
} from '@ptd/export'
import styles from './OutputPreview.module.css'

type PreviewScaleMode = 'fit-page' | 'fit-width' | 'manual'

const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2] as const
const CSS_PIXELS_PER_MILLIMETER = 96 / 25.4

export interface OutputPreviewProps {
  template: TemplateSchema
  renderContext: RenderContext
  options: OutputOptions
  exporting?: boolean
  exportError?: string
  onClose(): void
  onExport?(): void
}

interface PreviewResult {
  pageCount: number
  diagnostics: readonly OutputDiagnostic[]
}

export function OutputPreview({
  template,
  renderContext,
  options,
  exporting = false,
  exportError,
  onClose,
  onExport,
}: OutputPreviewProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const outputHostRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef<MountedOutputDocument | undefined>(undefined)
  const [scaleMode, setScaleMode] = useState<PreviewScaleMode>('fit-page')
  const [fitPageScale, setFitPageScale] = useState(1)
  const [fitWidthScale, setFitWidthScale] = useState(1)
  const [manualScale, setManualScale] = useState(1)
  const [result, setResult] = useState<PreviewResult>()
  const [error, setError] = useState<string>()
  const dimensions = useMemo(() => {
    const canvas = getPageDimensions(template.pageConfig)
    return {
      width: pxToMm(canvas.width) * CSS_PIXELS_PER_MILLIMETER,
      height: pxToMm(canvas.height) * CSS_PIXELS_PER_MILLIMETER,
    }
  }, [template.pageConfig])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    return () => dialog.close()
  }, [])

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const update = () => {
      const bounds = viewport.getBoundingClientRect()
      const horizontalRoom = Math.max(240, bounds.width - 64)
      const verticalRoom = Math.max(320, bounds.height - 64)
      setFitPageScale(
        Math.min(1, horizontalRoom / dimensions.width, verticalRoom / dimensions.height),
      )
      setFitWidthScale(Math.min(1, horizontalRoom / dimensions.width))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [dimensions.height, dimensions.width])

  useEffect(() => {
    const host = outputHostRef.current
    if (!host) return
    let cancelled = false
    mountedRef.current?.destroy()
    mountedRef.current = undefined
    setResult(undefined)
    setError(undefined)

    void compileOutputDocument({ template, renderContext, options })
      .then(async (output) => {
        if (cancelled) return
        const mounted = mountOutputDocument(host, output)
        mountedRef.current = mounted
        const diagnostics = await preflightOutputDocument(mounted.root, output)
        if (cancelled) return
        setResult({ pageCount: output.pages.length, diagnostics })
      })
      .catch(() => {
        if (!cancelled) setError('没有生成打印预览。请检查模板内容后重试。')
      })

    return () => {
      cancelled = true
      mountedRef.current?.destroy()
      mountedRef.current = undefined
    }
  }, [options, renderContext, template])

  const scale =
    scaleMode === 'fit-page'
      ? fitPageScale
      : scaleMode === 'fit-width'
        ? fitWidthScale
        : manualScale
  const setScale = (value: number) => {
    setManualScale(Math.min(2, Math.max(0.25, value)))
    setScaleMode('manual')
  }
  const zoomOut = () => {
    const next = [...ZOOM_STEPS].reverse().find((step) => step < scale - 0.005)
    if (next !== undefined) setScale(next)
  }
  const zoomIn = () => {
    const next = ZOOM_STEPS.find((step) => step > scale + 0.005)
    if (next !== undefined) setScale(next)
  }
  const fatal = result?.diagnostics.some((diagnostic) => diagnostic.severity === 'error') ?? false

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      data-ptd-theme
      aria-labelledby="output-preview-title"
      onCancel={(event) => {
        event.preventDefault()
        if (!exporting) onClose()
      }}
    >
      <div className={styles.shell}>
        <header className={styles.toolbar}>
          <div className={styles.documentMeta}>
            <h2 id="output-preview-title">打印预览</h2>
            <span title={options.title || template.pageConfig.title}>
              {options.title || template.pageConfig.title}
            </span>
          </div>
          <div className={styles.tools} role="toolbar" aria-label="打印预览工具栏">
            <span className={styles.pageCount} aria-live="polite">
              {result ? `共 ${result.pageCount} 页` : '正在排版'}
            </span>
            <span className={styles.toolbarDivider} aria-hidden="true" />
            <div className={styles.fitControls} role="group" aria-label="页面适配方式">
              <button
                type="button"
                aria-pressed={scaleMode === 'fit-page'}
                onClick={() => setScaleMode('fit-page')}
              >
                <RiAspectRatioLine aria-hidden="true" />
                适合页面
              </button>
              <button
                type="button"
                aria-pressed={scaleMode === 'fit-width'}
                onClick={() => setScaleMode('fit-width')}
              >
                <RiExpandWidthLine aria-hidden="true" />
                适合宽度
              </button>
            </div>
            <div className={styles.zoomControls} role="group" aria-label="连续缩放">
              <button
                type="button"
                aria-label="缩小预览"
                disabled={scale <= ZOOM_STEPS[0]}
                onClick={zoomOut}
              >
                <RiSubtractLine aria-hidden="true" />
              </button>
              <output aria-label="当前缩放比例">{Math.round(scale * 100)}%</output>
              <button
                type="button"
                aria-label="放大预览"
                disabled={scale >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
                onClick={zoomIn}
              >
                <RiAddLine aria-hidden="true" />
              </button>
              <button
                type="button"
                className={styles.actualSizeButton}
                aria-pressed={scaleMode === 'manual' && manualScale === 1}
                onClick={() => setScale(1)}
              >
                100%
              </button>
            </div>
            <span className={styles.toolbarDivider} aria-hidden="true" />
            {onExport ? (
              <button
                type="button"
                className={styles.exportButton}
                disabled={!result || fatal || exporting}
                onClick={onExport}
              >
                <RiFilePdf2Line aria-hidden="true" />
                {exporting ? '正在生成 PDF…' : '导出 PDF'}
              </button>
            ) : null}
            <button
              type="button"
              className={styles.closeButton}
              disabled={exporting}
              aria-label="关闭打印预览"
              title="关闭打印预览"
              onClick={onClose}
            >
              <RiCloseLine aria-hidden="true" />
            </button>
          </div>
        </header>

        <div ref={viewportRef} className={styles.viewport} data-scale-mode={scaleMode}>
          {!result && !error ? (
            <div className={styles.preparing} role="status">
              <div className={styles.paperSkeleton} aria-hidden="true" />
              <div>
                <strong>正在生成派生页面</strong>
                <span>测量正文、表格与页眉页脚…</span>
              </div>
            </div>
          ) : null}
          {error ? (
            <div className={styles.failure} role="alert">
              <strong>打印预览未完成</strong>
              <span>{error}</span>
            </div>
          ) : null}
          <div
            ref={outputHostRef}
            className={styles.outputHost}
            style={{ '--foliq-proof-scale': String(scale) } as CSSProperties}
            aria-busy={!result && !error}
          />
        </div>

        <footer className={styles.statusBar}>
          <div>
            <span
              className={styles.statusMark}
              data-state={fatal ? 'error' : result ? 'ready' : 'busy'}
            />
            <span>
              {fatal ? '发现阻止导出的排版问题' : result ? '版面已稳定' : '正在等待版面稳定'}
            </span>
          </div>
          {result && result.diagnostics.length > 0 ? (
            <details className={styles.diagnostics}>
              <summary>{result.diagnostics.length} 条排版诊断</summary>
              <ul>
                {result.diagnostics.map((diagnostic, index) => (
                  <li key={`${diagnostic.code}-${index}`} data-severity={diagnostic.severity}>
                    <code>{diagnostic.code}</code>
                    <span>
                      {diagnostic.pageNumber ? `第 ${diagnostic.pageNumber} 页 · ` : ''}
                      {diagnostic.sourceComponentId ? `${diagnostic.sourceComponentId} · ` : ''}
                      {diagnostic.message}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          {exportError ? <span className={styles.exportError}>{exportError}</span> : null}
        </footer>
      </div>
    </dialog>
  )
}

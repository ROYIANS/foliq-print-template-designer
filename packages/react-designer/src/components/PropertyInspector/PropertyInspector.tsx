import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSignals } from '@preact/signals-react/runtime'
import {
  BAR_CODE_FORMATS,
  DEFAULT_PAGE_CONFIG,
  PAGE_SIZES,
  barCodeContentError,
  formatMeasurement,
  getPageDimensions,
  imageSourceError,
  mmToPx,
  normalizeBarCodeProps,
  normalizeImageProps,
  normalizeQRCodeProps,
  qrCodeContentError,
  pxToMm,
  type BarCodeProps,
  type ComponentSchema,
  type ComponentStyle,
  type ImageProps,
  type PageConfig,
  type PageSize,
  type QRCodeProps,
  type TextColumnFill,
} from '@ptd/core'
import { RiDeleteBinLine, RiLandscapeLine, RiRuler2Line, RiUpload2Line } from '@remixicon/react'
import { PtdColorField, PtdSegmented, PtdSelect, normalizePtdColor } from '@ptd/react-ui'
import {
  CJK_FONT_FAMILY_OPTIONS,
  composeFontFamily,
  DEFAULT_CJK_FONT_FAMILY,
  LATIN_FONT_FAMILY_OPTIONS,
  resolveFontFamily,
} from '../../config/typography'
import { useEditorStore } from '../../state'
import { PanelBody, PanelFooter, PanelHeader, PanelRoot } from '../Panel'
import {
  InspectorFileAction,
  InspectorMetricInput as MetricInput,
  InspectorNumberInput as NumberInput,
  InspectorSegmentedInput as SegmentedInput,
  InspectorSelectInput as SelectInput,
  InspectorTextArea,
  InspectorTextInput,
} from './InspectorControls'
import { InspectorPtdColorField } from './InspectorPtdColorField'
import { isEditableTextPropValue, isHexColor, parseTextPropValue } from './propertyValue'
import styles from './PropertyInspector.module.css'
import { TableContentFields } from './TableContentFields'
import { deriveDocumentColors } from './inspectorColors'

function SectionHeading({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className={styles.sectionHeading}>
      <span>{title}</span>
      {meta && <small>{meta}</small>}
    </div>
  )
}

function InspectorSection({
  title,
  meta,
  children,
}: {
  title: string
  meta?: string
  children: ReactNode
}) {
  return (
    <section className={styles.section}>
      <SectionHeading title={title} meta={meta} />
      <div className={styles.sectionBody}>{children}</div>
    </section>
  )
}

function InspectorDisclosure({
  title,
  meta,
  children,
}: {
  title: string
  meta?: string
  children: ReactNode
}) {
  return (
    <details className={styles.disclosure}>
      <summary>
        <span>{title}</span>
        {meta && <small>{meta}</small>}
      </summary>
      <div className={styles.disclosureBody}>{children}</div>
    </details>
  )
}

function InspectorShell({
  label,
  title,
  meta,
  page = false,
  children,
  footer,
}: {
  label: string
  title: string
  meta: string
  page?: boolean
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <aside className={styles.inspector} aria-label={label} data-ptd-region="inspector">
      <PanelRoot className={styles.inspectorPanel}>
        <PanelHeader title={title} meta={meta} />
        <PanelBody className={styles.inspectorBody}>
          <div
            className={styles.inspectorView}
            data-ptd-region={page ? 'page-inspector' : undefined}
          >
            {children}
          </div>
        </PanelBody>
        {footer && <PanelFooter className={styles.inspectorFooter}>{footer}</PanelFooter>}
      </PanelRoot>
    </aside>
  )
}

const GEOMETRY_FIELDS: Array<{
  key: keyof ComponentStyle
  label: string
}> = [
  { key: 'left', label: 'X' },
  { key: 'top', label: 'Y' },
  { key: 'width', label: '宽度' },
  { key: 'height', label: '高度' },
]

const CONTENT_COMPONENTS = new Set<ComponentSchema['component']>([
  'RoySimpleText',
  'RoyText',
  'RoySimpleTable',
  'RoyComplexTable',
  'RoyImage',
  'RoyQRCode',
  'RoyBarCode',
])
const TYPOGRAPHY_COMPONENTS = new Set<ComponentSchema['component']>([
  'RoySimpleText',
  'RoyText',
  'RoyComplexTable',
])
const TEXT_COLUMN_COMPONENTS = new Set<ComponentSchema['component']>(['RoySimpleText', 'RoyText'])
const ALIGNMENT_COMPONENTS = new Set<ComponentSchema['component']>(['RoySimpleText'])
const BACKGROUND_COMPONENTS = new Set<ComponentSchema['component']>([
  'RoySimpleText',
  'RoyText',
  'RoyComplexTable',
  'RoyLine',
  'RoyRect',
  'RoyCircle',
  'RoyStar',
  'RoyImage',
  'RoyBarCode',
])
const BORDER_COMPONENTS = new Set<ComponentSchema['component']>([
  'RoySimpleText',
  'RoyText',
  'RoyComplexTable',
  'RoyRect',
  'RoyCircle',
  'RoyImage',
  'RoyQRCode',
  'RoyBarCode',
])
const BORDER_STYLE_COMPONENTS = new Set<ComponentSchema['component']>([
  'RoySimpleText',
  'RoyText',
  'RoyRect',
  'RoyCircle',
  'RoyImage',
  'RoyQRCode',
  'RoyBarCode',
])
const RADIUS_COMPONENTS = new Set<ComponentSchema['component']>([
  'RoySimpleText',
  'RoyText',
  'RoyRect',
  'RoyImage',
])
const CONFIGURABLE_CONTENT_COMPONENTS = new Set<ComponentSchema['component']>([
  'RoySimpleTable',
  'RoyImage',
  'RoyQRCode',
  'RoyBarCode',
])

export function PropertyInspector() {
  useSignals()
  const store = useEditorStore()
  const selected = store.selectedComponents.value
  if (selected.length === 0) return <PageInspector />
  if (selected.length > 1) return <BatchInspector components={selected} />
  return <SingleInspector component={selected[0]!} />
}

function PageInspector() {
  useSignals()
  const store = useEditorStore()
  const page = store.pageConfig.value
  const documentColors = useMemo(
    () => deriveDocumentColors(store.template.value),
    [store.template.value],
  )
  const recentColors = store.recentColors.value
  const dimensions = getPageDimensions(page)
  const unit = store.measurementUnit.value
  const [titleDraft, setTitleDraft] = useState<string | null>(null)
  const [marginsLinked, setMarginsLinked] = useState(true)
  const start = () => store.beginGesture()
  const finish = () => store.commitGesture()
  const cancel = () => store.cancelGesture()
  const update = (patch: Partial<PageConfig>) => store.updatePageConfig(patch, true)
  const updateDiscrete = (patch: Partial<PageConfig>) => {
    start()
    update(patch)
    finish()
  }
  const pageWidthMm = page.pageDirection === 'l' ? page.pageHeight : page.pageWidth
  const pageHeightMm = page.pageDirection === 'l' ? page.pageWidth : page.pageHeight
  const pageMetric = `${formatMeasurement(dimensions.width, unit)} × ${formatMeasurement(dimensions.height, unit)} ${unit}`

  useEffect(() => () => store.commitGesture(), [store])

  const updatePageSize = (pageSize: PageSize) => {
    const preset = PAGE_SIZES[pageSize]
    updateDiscrete(
      preset
        ? {
            pageSize,
            pageWidth: preset.w,
            pageHeight: preset.h,
            pageCurHeight: preset.h,
          }
        : { pageSize: 'custom' },
    )
  }

  const updateMargin = (
    key: 'pageMarginTop' | 'pageMarginRight' | 'pageMarginBottom' | 'pageMarginLeft',
    canvasValue: number,
  ) => {
    const value = pxToMm(canvasValue)
    update(
      marginsLinked
        ? {
            pageMarginTop: value,
            pageMarginRight: value,
            pageMarginBottom: value,
            pageMarginLeft: value,
          }
        : { [key]: value },
    )
  }

  const marginMax = (
    key: 'pageMarginTop' | 'pageMarginRight' | 'pageMarginBottom' | 'pageMarginLeft',
  ): number => {
    if (marginsLinked) return Math.min(pageWidthMm, pageHeightMm) / 2 - 0.01
    if (key === 'pageMarginLeft') return pageWidthMm - page.pageMarginRight - 0.01
    if (key === 'pageMarginRight') return pageWidthMm - page.pageMarginLeft - 0.01
    if (key === 'pageMarginTop') return pageHeightMm - page.pageMarginBottom - 0.01
    return pageHeightMm - page.pageMarginTop - 0.01
  }

  return (
    <InspectorShell
      label="文档页面设置"
      title="文档页面设置"
      meta={page.title || '未命名模板'}
      page
      footer={
        <FooterSetting
          icon={<RiRuler2Line />}
          label="页面标尺"
          detail="拖出参考线"
          checked={store.showRuler.value}
          onChange={() => store.toggleRuler()}
        />
      }
    >
      {store.outOfBoundsComponents.value.length > 0 && (
        <div className={styles.pageWarning} role="status">
          <strong>{store.outOfBoundsComponents.value.length} 个组件超出页面</strong>
          <span>组件位置和尺寸已保留；可在画布中逐一调整。</span>
        </div>
      )}
      <InspectorSection title="文档" meta="所有页面共用">
        <InspectorTextInput
          label="模板标题"
          wide
          value={titleDraft ?? page.title}
          disabled={false}
          onStart={() => {
            setTitleDraft(page.title)
            start()
          }}
          onValue={(title) => {
            setTitleDraft(title)
            update({ title })
          }}
          onFinish={() => {
            setTitleDraft(null)
            finish()
          }}
          onCancel={() => {
            setTitleDraft(null)
            cancel()
          }}
        />
      </InspectorSection>

      <InspectorSection title="页面方向" meta={page.pageDirection === 'p' ? '纵向' : '横向'}>
        <PtdSegmented
          label="页面方向"
          value={page.pageDirection}
          options={[
            {
              value: 'p',
              label: '纵向',
              icon: <RiLandscapeLine className={styles.portraitIcon} aria-hidden="true" />,
            },
            { value: 'l', label: '横向', icon: <RiLandscapeLine aria-hidden="true" /> },
          ]}
          onValueChange={(value) => store.setPageDirection(value as 'p' | 'l')}
        />
      </InspectorSection>

      <InspectorSection title="页面规格" meta={pageMetric}>
        <div className={styles.fieldGrid}>
          <PtdSelect
            label="纸张规格"
            wide
            value={page.pageSize}
            options={[
              ...Object.values(PAGE_SIZES).map((size) => ({
                value: size.name,
                label: `${size.name} · ${size.w} × ${size.h} mm`,
              })),
              { value: 'custom', label: '自定义尺寸' },
            ]}
            onOpenChange={(open) => (open ? start() : finish())}
            onValueChange={(value) => updatePageSize(value as PageSize)}
          />
          {page.pageSize === 'custom' && (
            <>
              <MetricInput
                label="页面宽度"
                canvasValue={mmToPx(page.pageWidth)}
                unit={unit}
                minCanvasPx={1}
                disabled={false}
                onStart={start}
                onFinish={finish}
                onCancel={cancel}
                onCanvasValue={(value) => update({ pageWidth: pxToMm(value) })}
              />
              <MetricInput
                label="页面高度"
                canvasValue={mmToPx(page.pageHeight)}
                unit={unit}
                minCanvasPx={1}
                disabled={false}
                onStart={start}
                onFinish={finish}
                onCancel={cancel}
                onCanvasValue={(value) =>
                  update({ pageHeight: pxToMm(value), pageCurHeight: pxToMm(value) })
                }
              />
            </>
          )}
        </div>
      </InspectorSection>

      <InspectorSection title="内容安全区" meta={marginsLinked ? '四边联动' : '独立设置'}>
        <div className={styles.fieldGrid}>
          <PtdSegmented
            label="边距模式"
            value={marginsLinked ? 'linked' : 'separate'}
            wide
            options={[
              { value: 'linked', label: '四边联动' },
              { value: 'separate', label: '独立设置' },
            ]}
            onValueChange={(value) => setMarginsLinked(value === 'linked')}
          />
          {(
            [
              ['pageMarginTop', '上边距'],
              ['pageMarginRight', '右边距'],
              ['pageMarginBottom', '下边距'],
              ['pageMarginLeft', '左边距'],
            ] as const
          ).map(([key, label]) => (
            <MetricInput
              key={key}
              label={label}
              canvasValue={mmToPx(page[key])}
              unit={unit}
              minCanvasPx={0}
              maxCanvasPx={mmToPx(marginMax(key))}
              disabled={false}
              onStart={start}
              onFinish={finish}
              onCancel={cancel}
              onCanvasValue={(value) => updateMargin(key, value)}
            />
          ))}
        </div>
      </InspectorSection>

      <InspectorSection title="纸张与排版" meta={primaryFontName(page.fontFamily)}>
        <div className={styles.fieldGrid}>
          <PtdColorField
            label="纸张颜色"
            value={page.background}
            defaultValue={DEFAULT_PAGE_CONFIG.background}
            disabled={false}
            recentColors={recentColors}
            documentColors={documentColors}
            onOpenChange={(open) => {
              if (open) start()
              else {
                finish()
                const normalized = normalizePtdColor(store.pageConfig.value.background)
                if (normalized) store.recordRecentColor(normalized)
              }
            }}
            onCancel={cancel}
            onValueChange={(background) => update({ background })}
            onReset={() => {
              start()
              update({ background: DEFAULT_PAGE_CONFIG.background })
              finish()
            }}
          />
          <PtdColorField
            label="默认文字"
            value={page.color}
            defaultValue={DEFAULT_PAGE_CONFIG.color}
            disabled={false}
            recentColors={recentColors}
            documentColors={documentColors}
            onOpenChange={(open) => {
              if (open) start()
              else {
                finish()
                const normalized = normalizePtdColor(store.pageConfig.value.color)
                if (normalized) store.recordRecentColor(normalized)
              }
            }}
            onCancel={cancel}
            onValueChange={(color) => update({ color })}
            onReset={() => {
              start()
              update({ color: DEFAULT_PAGE_CONFIG.color })
              finish()
            }}
          />
          <PtdSelect
            label="默认字体"
            value={page.fontFamily}
            options={CJK_FONT_FAMILY_OPTIONS.map(([value, label]) => ({ value, label }))}
            onOpenChange={(open) => (open ? start() : finish())}
            onValueChange={(fontFamily) => update({ fontFamily })}
          />
          <NumberInput
            label="默认字号"
            value={page.fontSize}
            unit="pt"
            min={1}
            disabled={false}
            onStart={start}
            onFinish={finish}
            onCancel={cancel}
            onValue={(fontSize) => update({ fontSize })}
          />
          <NumberInput
            label="默认行高"
            value={page.lineHeight}
            step={0.1}
            min={0.1}
            disabled={false}
            onStart={start}
            onFinish={finish}
            onCancel={cancel}
            onValue={(lineHeight) => update({ lineHeight })}
          />
        </div>
      </InspectorSection>
    </InspectorShell>
  )
}

function primaryFontName(fontFamily: string): string {
  return (fontFamily.split(',')[0]?.trim() || fontFamily).replace(/^['"]|['"]$/g, '')
}

function SingleInspector({ component }: { component: ComponentSchema }) {
  const store = useEditorStore()
  const measurementUnit = store.measurementUnit.value
  const locked = Boolean(component.isLock)
  const [textDraft, setTextDraft] = useState<string | null>(null)
  const start = () => store.beginGesture()
  const finish = () => store.commitGesture()
  const cancel = () => store.cancelGesture()
  const updateStyle = (key: keyof ComponentStyle, value: unknown) =>
    store.updateComponentStyle(component.id, { [key]: value }, true)
  const updateDiscreteStyle = (key: keyof ComponentStyle, value: unknown) => {
    start()
    updateStyle(key, value)
    finish()
  }
  const updateContent = (value: unknown) =>
    store.updateComponent(component.id, { propValue: value }, true)
  const updateDiscreteContent = (value: unknown) => {
    start()
    updateContent(value)
    finish()
  }

  useEffect(() => () => store.commitGesture(), [store])

  const editableText = isEditableTextPropValue(component)
  const configurableContent = isConfigurableContentComponent(component)
  const showsContent = CONTENT_COMPONENTS.has(component.component)
  const showsTypography = TYPOGRAPHY_COMPONENTS.has(component.component)
  const showsTextColumns = TEXT_COLUMN_COMPONENTS.has(component.component)
  const showsAlignment = ALIGNMENT_COMPONENTS.has(component.component)
  const showsTextColor = TYPOGRAPHY_COMPONENTS.has(component.component)
  const showsBackground = BACKGROUND_COMPONENTS.has(component.component)
  const showsBorder = BORDER_COMPONENTS.has(component.component)
  const showsBorderStyle = BORDER_STYLE_COMPONENTS.has(component.component)
  const showsRadius = RADIUS_COMPONENTS.has(component.component)
  const showsAppearance = showsTextColor || showsBackground || showsBorder
  const fontValue = text(component.style.fontFamily, DEFAULT_CJK_FONT_FAMILY)
  const fontSelection = resolveFontFamily(fontValue)
  const cjkFontOptions = fontSelection.recognized
    ? CJK_FONT_FAMILY_OPTIONS
    : [
        [fontSelection.cjk, primaryFontName(fontSelection.cjk)] as [string, string],
        ...CJK_FONT_FAMILY_OPTIONS,
      ]

  return (
    <InspectorShell
      label="属性面板"
      title={component.name || '未命名组件'}
      meta={component.component}
      footer={
        <FooterSetting
          label={locked ? '组件已锁定' : '锁定组件'}
          detail={locked ? '仅允许解锁' : '保护几何与内容'}
          checked={locked}
          onChange={(checked) => store.updateComponent(component.id, { isLock: checked })}
        />
      }
    >
      {component.component === 'RoyGroup' && (
        <div className={styles.summary} role="note">
          <strong>组合对象</strong>
          <span>
            包含 {Array.isArray(component.propValue) ? component.propValue.length : 0}{' '}
            个子对象；此处只修改组合框的安全属性。
          </span>
        </div>
      )}
      {showsContent && (
        <InspectorSection
          title="内容"
          meta={
            component.component === 'RoyText'
              ? '画布富文本编辑'
              : editableText
                ? '可编辑'
                : component.component === 'RoySimpleTable'
                  ? '单元格编辑'
                  : configurableContent
                    ? '实时预览'
                    : '专用编辑器'
          }
        >
          {configurableContent ? (
            <ConfigurableContentFields
              key={component.id}
              component={component}
              disabled={locked}
              onStart={start}
              onFinish={finish}
              onCancel={cancel}
              onValue={updateContent}
              onDiscreteValue={updateDiscreteContent}
            />
          ) : component.component === 'RoyText' ? (
            <div className={styles.structuredNotice} role="note">
              <strong>在画布中编辑富文本</strong>
              <span>双击内容进入排版工具栏；属性面板负责组件级默认排版与外观。</span>
            </div>
          ) : editableText ? (
            <InspectorTextInput
              label="文本值"
              wide
              value={textDraft ?? printable(component.propValue)}
              disabled={locked}
              onStart={() => {
                setTextDraft(printable(component.propValue))
                start()
              }}
              onValue={(draft) => {
                setTextDraft(draft)
                const value = parseTextPropValue(component.propValue, draft)
                if (value !== null) store.updateComponent(component.id, { propValue: value }, true)
              }}
              onFinish={() => {
                setTextDraft(null)
                finish()
              }}
              onCancel={() => {
                setTextDraft(null)
                cancel()
              }}
            />
          ) : component.component === 'RoyComplexTable' ? (
            <div className={styles.structuredNotice} role="note">
              <strong>兼容表格为只读内容</strong>
              <span>当前版本保留渲染与几何调整，不提供尚未闭环的数据区编辑入口。</span>
            </div>
          ) : (
            <div className={styles.structuredNotice} role="note">
              <strong>结构化内容由专用编辑器维护</strong>
              <span>此面板仍可调整几何、层级与视觉样式。</span>
            </div>
          )}
        </InspectorSection>
      )}

      <InspectorSection title="几何" meta="位置与尺寸">
        <div className={styles.fieldGrid}>
          {GEOMETRY_FIELDS.map(({ key, label }) => (
            <MetricInput
              key={key}
              label={
                component.component === 'RoyLine' && key === 'width'
                  ? '线条长度'
                  : component.component === 'RoyLine' && key === 'height'
                    ? '线条厚度'
                    : label
              }
              canvasValue={numeric(component.style[key])}
              unit={measurementUnit}
              minCanvasPx={key === 'width' || key === 'height' ? 1 : undefined}
              disabled={locked}
              onStart={start}
              onFinish={finish}
              onCancel={cancel}
              onCanvasValue={(value) => updateStyle(key, value)}
            />
          ))}
          <NumberInput
            label="旋转"
            value={numeric(component.style.rotate)}
            unit="°"
            disabled={locked}
            onStart={start}
            onFinish={finish}
            onCancel={cancel}
            onValue={(value) => updateStyle('rotate', value)}
          />
          <NumberInput
            label="透明度"
            value={numeric(component.style.opacity) * 100}
            unit="%"
            step={5}
            scrubStep={1}
            min={0}
            max={100}
            disabled={locked}
            onStart={start}
            onFinish={finish}
            onCancel={cancel}
            onValue={(value) => updateStyle('opacity', value / 100)}
          />
        </div>
      </InspectorSection>

      {showsTypography && (
        <InspectorSection title="排版" meta="文字与对齐">
          <div className={styles.fieldGrid}>
            <NumberInput
              label="字号"
              value={numeric(component.style.fontSize)}
              unit="pt"
              min={1}
              disabled={locked}
              onStart={start}
              onFinish={finish}
              onCancel={cancel}
              onValue={(value) => updateStyle('fontSize', value)}
            />
            <SelectInput
              label="中文字体"
              value={fontSelection.cjk}
              disabled={locked}
              options={cjkFontOptions}
              onStart={start}
              onFinish={finish}
              onValue={(value) =>
                updateStyle('fontFamily', composeFontFamily(value, fontSelection.latin))
              }
            />
            <SelectInput
              label="西文字体"
              value={fontSelection.latin}
              disabled={locked}
              options={LATIN_FONT_FAMILY_OPTIONS}
              onStart={start}
              onFinish={finish}
              onValue={(value) =>
                updateStyle('fontFamily', composeFontFamily(fontSelection.cjk, value))
              }
            />
            <SegmentedInput
              label="字重"
              value={text(component.style.fontWeight, 'normal')}
              disabled={locked}
              options={[
                { value: 'normal', label: '常规' },
                { value: 'bold', label: '粗体' },
              ]}
              onValue={(value) => updateDiscreteStyle('fontWeight', value)}
            />
            <SegmentedInput
              label="字形"
              value={text(component.style.fontStyle, 'normal')}
              disabled={locked}
              options={[
                { value: 'normal', label: '常规' },
                { value: 'italic', label: '斜体' },
              ]}
              onValue={(value) => updateDiscreteStyle('fontStyle', value)}
            />
            <SegmentedInput
              label="下划线"
              value={component.style.isUnderLine ? 'show' : 'hide'}
              disabled={locked}
              options={[
                { value: 'hide', label: '无' },
                { value: 'show', label: '启用' },
              ]}
              onValue={(value) => updateDiscreteStyle('isUnderLine', value === 'show')}
            />
            <SegmentedInput
              label="删除线"
              value={component.style.isDelLine ? 'show' : 'hide'}
              disabled={locked}
              options={[
                { value: 'hide', label: '无' },
                { value: 'show', label: '启用' },
              ]}
              onValue={(value) => updateDiscreteStyle('isDelLine', value === 'show')}
            />
            <NumberInput
              label="行高"
              value={cssNumber(component.style.lineHeight) || 1}
              step={0.1}
              min={0.1}
              disabled={locked}
              onStart={start}
              onFinish={finish}
              onCancel={cancel}
              onValue={(value) => updateStyle('lineHeight', String(value))}
            />
            <MetricInput
              label="字距"
              canvasValue={cssNumber(component.style.letterSpacing)}
              unit={measurementUnit}
              disabled={locked}
              onStart={start}
              onFinish={finish}
              onCancel={cancel}
              onCanvasValue={(value) => updateStyle('letterSpacing', String(value))}
            />
            <MetricInput
              label="内边距"
              canvasValue={cssNumber(component.style.padding)}
              unit={measurementUnit}
              minCanvasPx={0}
              disabled={locked}
              onStart={start}
              onFinish={finish}
              onCancel={cancel}
              onCanvasValue={(value) => updateStyle('padding', String(value))}
            />
            {showsTextColumns && (
              <>
                <NumberInput
                  label="文字分栏"
                  value={numeric(component.style.columnCount ?? 1)}
                  min={1}
                  max={6}
                  step={1}
                  disabled={locked}
                  onStart={start}
                  onFinish={finish}
                  onCancel={cancel}
                  onValue={(value) => updateStyle('columnCount', Math.round(value))}
                />
                <NumberInput
                  label="栏间距"
                  value={numeric(component.style.columnGap ?? 24)}
                  unit="px"
                  min={0}
                  step={1}
                  disabled={locked}
                  onStart={start}
                  onFinish={finish}
                  onCancel={cancel}
                  onValue={(value) => updateStyle('columnGap', value)}
                />
                <SegmentedInput
                  label="分栏填充"
                  value={text(component.style.columnFill, 'auto')}
                  disabled={locked}
                  wide
                  options={[
                    { value: 'auto', label: '顺序填充' },
                    { value: 'balance', label: '均衡填充' },
                  ]}
                  onValue={(value) => updateDiscreteStyle('columnFill', value as TextColumnFill)}
                />
              </>
            )}
            {showsAlignment && (
              <>
                <SegmentedInput
                  label="水平对齐"
                  value={text(component.style.justifyContent, 'flex-start')}
                  disabled={locked}
                  wide
                  options={[
                    { value: 'flex-start', label: '左' },
                    { value: 'center', label: '中' },
                    { value: 'flex-end', label: '右' },
                  ]}
                  onValue={(value) => updateDiscreteStyle('justifyContent', value)}
                />
                <SegmentedInput
                  label="垂直对齐"
                  value={text(component.style.alignItems, 'flex-start')}
                  disabled={locked}
                  wide
                  options={[
                    { value: 'flex-start', label: '上' },
                    { value: 'center', label: '中' },
                    { value: 'flex-end', label: '下' },
                  ]}
                  onValue={(value) => updateDiscreteStyle('alignItems', value)}
                />
              </>
            )}
          </div>
        </InspectorSection>
      )}

      {showsAppearance && (
        <InspectorSection title="外观" meta={showsBorder ? '颜色与描边' : '填充'}>
          <div className={styles.fieldGrid}>
            {showsTextColor && (
              <InspectorPtdColorField
                label="文字"
                value={color(component.style.color, '#1d2735')}
                defaultValue="#1d2735"
                disabled={locked}
                onStart={start}
                onFinish={finish}
                onCancel={cancel}
                onValue={(value) => updateStyle('color', value)}
              />
            )}
            {showsBackground && (
              <InspectorPtdColorField
                label={component.component === 'RoyLine' ? '线条' : '背景'}
                value={paint(component.style.background, '#f8fafc')}
                defaultValue="#f8fafc"
                allowTransparent
                disabled={locked}
                onStart={start}
                onFinish={finish}
                onCancel={cancel}
                onValue={(value) => updateStyle('background', value)}
              />
            )}
            {showsBorder && (
              <div className={styles.advancedWrap}>
                <InspectorDisclosure title="高级描边与圆角" meta="按需展开">
                  <div className={styles.fieldGrid}>
                    <InspectorPtdColorField
                      label="边框色"
                      value={color(component.style.borderColor, '#7d8999')}
                      defaultValue="#7d8999"
                      disabled={locked}
                      onStart={start}
                      onFinish={finish}
                      onCancel={cancel}
                      onValue={(value) => updateStyle('borderColor', value)}
                    />
                    <MetricInput
                      label="边框宽"
                      canvasValue={numeric(component.style.borderWidth)}
                      unit={measurementUnit}
                      minCanvasPx={0}
                      disabled={locked}
                      onStart={start}
                      onFinish={finish}
                      onCancel={cancel}
                      onCanvasValue={(value) => updateStyle('borderWidth', value)}
                    />
                    {showsRadius && (
                      <MetricInput
                        label="圆角"
                        canvasValue={cssNumber(component.style.borderRadius)}
                        unit={measurementUnit}
                        minCanvasPx={0}
                        disabled={locked}
                        onStart={start}
                        onFinish={finish}
                        onCancel={cancel}
                        onCanvasValue={(value) => updateStyle('borderRadius', `${value}px`)}
                      />
                    )}
                    {showsBorderStyle && (
                      <SegmentedInput
                        label="边框样式"
                        value={text(component.style.borderType, 'solid')}
                        disabled={locked}
                        wide
                        options={[
                          { value: 'solid', label: '实线' },
                          { value: 'dashed', label: '虚线' },
                          { value: 'dotted', label: '点线' },
                          { value: 'none', label: '无' },
                        ]}
                        onValue={(value) => updateDiscreteStyle('borderType', value)}
                      />
                    )}
                  </div>
                </InspectorDisclosure>
              </div>
            )}
          </div>
        </InspectorSection>
      )}
    </InspectorShell>
  )
}

type ConfigurableContentComponent =
  | (ComponentSchema & { component: 'RoySimpleTable' })
  | (ComponentSchema & { component: 'RoyImage' })
  | (ComponentSchema & { component: 'RoyQRCode' })
  | (ComponentSchema & { component: 'RoyBarCode' })

interface ConfigurableContentFieldsProps {
  component: ConfigurableContentComponent
  disabled: boolean
  onStart: () => void
  onFinish: () => void
  onCancel: () => void
  onValue: (value: unknown) => void
  onDiscreteValue: (value: unknown) => void
}

function isConfigurableContentComponent(
  component: ComponentSchema,
): component is ConfigurableContentComponent {
  return CONFIGURABLE_CONTENT_COMPONENTS.has(component.component)
}

function ConfigurableContentFields(props: ConfigurableContentFieldsProps) {
  switch (props.component.component) {
    case 'RoySimpleTable':
      return <TableContentFields {...props} component={props.component} />
    case 'RoyImage':
      return <ImageContentFields {...props} />
    case 'RoyQRCode':
      return <QRCodeContentFields {...props} />
    case 'RoyBarCode':
      return <BarCodeContentFields {...props} />
  }
}

function ImageContentFields({
  component,
  disabled,
  onStart,
  onFinish,
  onCancel,
  onValue,
  onDiscreteValue,
}: ConfigurableContentFieldsProps) {
  const value = normalizeImageProps(component.propValue)
  const [sourceDraft, setSourceDraft] = useState<string | null>(null)
  const [sourceStart, setSourceStart] = useState('')
  const [fileError, setFileError] = useState<string | null>(null)
  const shownSource = sourceDraft ?? value.src
  const sourceError = imageSourceError(shownSource)
  const patch = (next: Partial<ImageProps>) => onValue({ ...value, ...next })
  const patchDiscrete = (next: Partial<ImageProps>) => onDiscreteValue({ ...value, ...next })
  const loadFile = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setFileError('请选择浏览器支持的图片文件')
      return
    }
    const reader = new FileReader()
    reader.onerror = () => setFileError('图片读取失败，请重新选择')
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setFileError('图片读取结果无效')
        return
      }
      setFileError(null)
      patchDiscrete({
        src: reader.result,
        alt: value.alt || file.name.replace(/\.[^.]+$/, ''),
      })
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className={styles.contentEditor}>
      <div className={styles.fieldGrid}>
        <InspectorTextInput
          label="图片地址"
          wide
          spellCheck={false}
          value={shownSource}
          placeholder="https://… 或 data:image/…"
          error={sourceError}
          disabled={disabled}
          onStart={() => {
            setSourceStart(value.src)
            setSourceDraft(value.src)
            onStart()
          }}
          onValue={(next) => {
            setSourceDraft(next)
            if (!imageSourceError(next)) patch({ src: next })
          }}
          onFinish={() => {
            if (sourceError) patch({ src: sourceStart })
            setSourceDraft(null)
            onFinish()
          }}
          onCancel={() => {
            setSourceDraft(null)
            onCancel()
          }}
        />
        <InspectorTextInput
          label="图片替代文本"
          wide
          value={value.alt}
          placeholder="例如：公司 Logo"
          disabled={disabled}
          onStart={onStart}
          onFinish={onFinish}
          onCancel={onCancel}
          onValue={(alt) => patch({ alt })}
        />
        <SelectInput
          label="适配方式"
          value={value.fit}
          options={[
            ['contain', '完整显示'],
            ['cover', '填满裁切'],
            ['fill', '拉伸填满'],
          ]}
          disabled={disabled}
          onStart={onStart}
          onFinish={onFinish}
          onValue={(fit) => patch({ fit: fit as ImageProps['fit'] })}
        />
        <SelectInput
          label="对象位置"
          value={value.position}
          options={[
            ['center', '居中'],
            ['top', '顶部'],
            ['right', '右侧'],
            ['bottom', '底部'],
            ['left', '左侧'],
          ]}
          disabled={disabled}
          onStart={onStart}
          onFinish={onFinish}
          onValue={(position) => patch({ position: position as ImageProps['position'] })}
        />
      </div>
      <div className={styles.assetActions}>
        <InspectorFileAction
          label="选择本地图片"
          icon={<RiUpload2Line aria-hidden="true" />}
          accept="image/*"
          disabled={disabled}
          onFile={loadFile}
        />
        <button
          type="button"
          className={styles.assetAction}
          disabled={disabled || value.src === ''}
          onClick={() => patchDiscrete({ src: '' })}
        >
          <RiDeleteBinLine aria-hidden="true" />
          <span>清除图片</span>
        </button>
      </div>
      <ValidationMessage
        error={sourceError ?? fileError}
        idle={
          value.src === '' ? '绘制框已创建，请选择图片或输入稳定地址。' : '图片内容已写入模板。'
        }
      />
    </div>
  )
}

function QRCodeContentFields({
  component,
  disabled,
  onStart,
  onFinish,
  onCancel,
  onValue,
}: ConfigurableContentFieldsProps) {
  const value = normalizeQRCodeProps(component.propValue)
  const patch = (next: Partial<QRCodeProps>) => onValue({ ...value, ...next })
  const error = qrCodeContentError(value)
  return (
    <div className={styles.contentEditor}>
      <div className={styles.fieldGrid}>
        <InspectorTextArea
          label="二维码内容"
          value={value.text}
          error={error}
          disabled={disabled}
          onStart={onStart}
          onFinish={onFinish}
          onCancel={onCancel}
          onValue={(text) => patch({ text })}
        />
        <SelectInput
          label="纠错等级"
          value={value.correctLevel}
          options={[
            ['L', 'L · 约 7%'],
            ['M', 'M · 约 15%'],
            ['Q', 'Q · 约 25%'],
            ['H', 'H · 约 30%'],
          ]}
          disabled={disabled}
          onStart={onStart}
          onFinish={onFinish}
          onValue={(correctLevel) =>
            patch({ correctLevel: correctLevel as QRCodeProps['correctLevel'] })
          }
        />
        <NumberInput
          label="静区"
          value={value.margin}
          min={0}
          max={32}
          disabled={disabled}
          onStart={onStart}
          onFinish={onFinish}
          onCancel={onCancel}
          onValue={(margin) => patch({ margin })}
        />
        <InspectorPtdColorField
          label="前景"
          value={value.colorDark}
          defaultValue="#1d2735"
          disabled={disabled}
          onStart={onStart}
          onFinish={onFinish}
          onCancel={onCancel}
          onValue={(colorDark) => patch({ colorDark })}
        />
        <InspectorPtdColorField
          label="背景"
          value={value.colorLight}
          defaultValue="#ffffff"
          disabled={disabled}
          onStart={onStart}
          onFinish={onFinish}
          onCancel={onCancel}
          onValue={(colorLight) => patch({ colorLight })}
        />
      </div>
      <ValidationMessage error={error} idle="内容与样式会实时生成二维码。" />
    </div>
  )
}

function BarCodeContentFields({
  component,
  disabled,
  onStart,
  onFinish,
  onCancel,
  onValue,
  onDiscreteValue,
}: ConfigurableContentFieldsProps) {
  const value = normalizeBarCodeProps(component.propValue)
  const patch = (next: Partial<BarCodeProps>) => onValue({ ...value, ...next })
  const error = barCodeContentError(value)
  return (
    <div className={styles.contentEditor}>
      <div className={styles.fieldGrid}>
        <InspectorTextInput
          label="条形码内容"
          wide
          spellCheck={false}
          value={value.text}
          error={error}
          disabled={disabled}
          onStart={onStart}
          onFinish={onFinish}
          onCancel={onCancel}
          onValue={(text) => patch({ text })}
        />
        <SelectInput
          label="码制"
          value={value.bcid}
          options={BAR_CODE_FORMATS.map(
            (format) => [format, barCodeFormatLabel(format)] as [string, string],
          )}
          disabled={disabled}
          onStart={onStart}
          onFinish={onFinish}
          onValue={(bcid) => patch({ bcid: bcid as BarCodeProps['bcid'] })}
        />
        <InspectorPtdColorField
          label="前景"
          value={value.colorDark}
          defaultValue="#1d2735"
          disabled={disabled}
          onStart={onStart}
          onFinish={onFinish}
          onCancel={onCancel}
          onValue={(colorDark) => patch({ colorDark })}
        />
        <SegmentedInput
          label="可读文字"
          value={value.includeText ? 'show' : 'hide'}
          wide
          disabled={disabled}
          options={[
            { value: 'show', label: '显示' },
            { value: 'hide', label: '隐藏' },
          ]}
          onValue={(next) => onDiscreteValue({ ...value, includeText: next === 'show' })}
        />
      </div>
      <ValidationMessage error={error} idle="当前内容符合所选码制。" />
    </div>
  )
}

function ValidationMessage({ error, idle }: { error: string | null; idle: string }) {
  return (
    <div
      className={styles.validationMessage}
      data-error={Boolean(error) || undefined}
      role="status"
    >
      <strong>{error ? '需要修正' : '配置有效'}</strong>
      <span>{error ?? idle}</span>
    </div>
  )
}

function barCodeFormatLabel(format: BarCodeProps['bcid']): string {
  const labels: Record<BarCodeProps['bcid'], string> = {
    code128: 'Code 128',
    code39: 'Code 39',
    ean13: 'EAN-13',
    ean8: 'EAN-8',
    upca: 'UPC-A',
    itf14: 'ITF-14',
  }
  return labels[format]
}

function BatchInspector({ components }: { components: ComponentSchema[] }) {
  const store = useEditorStore()
  const locked = components.some((component) => component.isLock)
  const start = () => store.beginGesture()
  const finish = () => store.commitGesture()
  const cancel = () => store.cancelGesture()
  useEffect(() => () => store.commitGesture(), [store])

  const shared = (key: keyof ComponentStyle): { mixed: boolean; value: unknown } => {
    const first = components[0]!.style[key]
    return {
      mixed: !components.every((component) => component.style[key] === first),
      value: first,
    }
  }
  const opacity = shared('opacity')
  const fontSize = shared('fontSize')
  const sharedColor = shared('color')
  const allSupportTypography = components.every((component) =>
    TYPOGRAPHY_COMPONENTS.has(component.component),
  )

  return (
    <InspectorShell
      label="属性面板"
      title={`${components.length} 个对象`}
      meta="MULTI SELECT"
      footer={
        <button
          type="button"
          className={styles.footerAction}
          disabled={!locked}
          onClick={() => store.setLock(false)}
        >
          {locked ? '解锁所选对象' : '所选对象均可编辑'}
        </button>
      }
    >
      <div className={styles.summary} role="note">
        <strong>{locked ? '选择中包含锁定对象' : '批量编辑共同属性'}</strong>
        <span>
          {locked ? '先解锁后再修改共同样式。' : '混合值保持为空，录入后应用到全部所选对象。'}
        </span>
      </div>
      <InspectorSection title="共同属性" meta={`${components.length} 项`}>
        <div className={styles.fieldGrid}>
          <NumberInput
            label="透明度"
            value={opacity.mixed ? null : numeric(opacity.value) * 100}
            placeholder={opacity.mixed ? '混合' : '未设置'}
            unit="%"
            step={5}
            min={0}
            max={100}
            scrubStep={1}
            disabled={locked}
            onStart={start}
            onFinish={finish}
            onCancel={cancel}
            onValue={(value) => store.updateSelectedStyles({ opacity: value / 100 }, true)}
          />
          {allSupportTypography && (
            <>
              <NumberInput
                label="字号"
                value={fontSize.mixed ? null : numeric(fontSize.value)}
                placeholder={fontSize.mixed ? '混合' : '未设置'}
                unit="pt"
                min={1}
                disabled={locked}
                onStart={start}
                onFinish={finish}
                onCancel={cancel}
                onValue={(value) => store.updateSelectedStyles({ fontSize: value }, true)}
              />
              <InspectorPtdColorField
                label="文字"
                value={
                  sharedColor.mixed || !isHexColor(sharedColor.value) ? null : sharedColor.value
                }
                placeholder={sharedColor.mixed ? '混合：输入颜色' : '未设置'}
                disabled={locked}
                onStart={start}
                onFinish={finish}
                onCancel={cancel}
                onValue={(value) => store.updateSelectedStyles({ color: value }, true)}
              />
            </>
          )}
        </div>
      </InspectorSection>
    </InspectorShell>
  )
}

function FooterSetting({
  icon,
  label,
  detail,
  checked,
  onChange,
}: {
  icon?: ReactNode
  label: string
  detail: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className={styles.footerSetting}>
      {icon && <span className={styles.footerIcon}>{icon}</span>}
      <span className={styles.footerCopy}>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
      <button
        type="button"
        className={styles.switchControl}
        role="switch"
        aria-label={label}
        aria-checked={checked}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </div>
  )
}

function numeric(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function cssNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return 0
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function printable(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function color(value: unknown, fallback: string): string {
  return isHexColor(value) ? value : fallback
}

function paint(value: unknown, fallback: string): string {
  return value === 'transparent' ? value : color(value, fallback)
}

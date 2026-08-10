import * as Popover from '@radix-ui/react-popover'
import { RiArrowDownSLine, RiCheckLine, RiCloseLine, RiRestartLine } from '@remixicon/react'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'
import { ptdThemeClass } from './theme'
import styles from './primitives.module.css'
import { PtdField } from './Field'

export interface PtdColorFieldProps {
  label: string
  value?: string | null
  defaultValue?: string
  open?: boolean
  defaultOpen?: boolean
  placeholder?: string
  disabled?: boolean
  locked?: boolean
  allowTransparent?: boolean
  wide?: boolean
  recentColors?: readonly string[]
  documentColors?: readonly string[]
  onOpenChange?: (open: boolean) => void
  onValueChange?: (value: string) => void
  onCancel?: () => void
  onReset?: () => void
}

export function normalizePtdColor(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(normalized)) return normalized
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(normalized)
  return short ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}` : null
}

function isTransparent(value: string | null | undefined, allowTransparent: boolean): boolean {
  return allowTransparent && value?.trim().toLowerCase() === 'transparent'
}

function swatchStyle(color: string): CSSProperties {
  return { '--ptd-color-field': color } as CSSProperties
}

function cleanColors(colors: readonly string[] | undefined): string[] {
  if (!colors) return []
  return [
    ...new Set(
      colors.map((color) => normalizePtdColor(color)).filter((color): color is string => !!color),
    ),
  ]
}

interface RgbColor {
  r: number
  g: number
  b: number
}

interface HsvColor {
  h: number
  s: number
  v: number
}

const THEME_COLORS = [
  '#000000',
  '#ffffff',
  '#eeece1',
  '#1e497b',
  '#4e81bb',
  '#e2534d',
  '#9aba60',
  '#8165a0',
  '#47acc5',
  '#f9974c',
]

const STANDARD_COLORS = [
  '#c21401',
  '#ff1e02',
  '#ffc12a',
  '#ffff3a',
  '#90cf5b',
  '#00af57',
  '#00afee',
  '#0071be',
  '#00215f',
  '#72349d',
]

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function hexToRgb(value: string): RgbColor | null {
  const normalized = normalizePtdColor(value)
  if (!normalized) return null
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  }
}

function rgbToHex({ r, g, b }: RgbColor): string {
  return `#${[r, g, b]
    .map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0'))
    .join('')}`
}

function rgbToHsv({ r, g, b }: RgbColor): HsvColor {
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min
  let hue = 0

  if (delta !== 0) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6)
    else if (max === green) hue = 60 * ((blue - red) / delta + 2)
    else hue = 60 * ((red - green) / delta + 4)
  }

  return {
    h: hue < 0 ? hue + 360 : hue,
    s: max === 0 ? 0 : delta / max,
    v: max,
  }
}

function hsvToHex({ h, s, v }: HsvColor): string {
  const hue = ((h % 360) + 360) % 360
  const chroma = v * s
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1))
  const match = v - chroma
  let rgb: RgbColor

  if (hue < 60) rgb = { r: chroma, g: x, b: 0 }
  else if (hue < 120) rgb = { r: x, g: chroma, b: 0 }
  else if (hue < 180) rgb = { r: 0, g: chroma, b: x }
  else if (hue < 240) rgb = { r: 0, g: x, b: chroma }
  else if (hue < 300) rgb = { r: x, g: 0, b: chroma }
  else rgb = { r: chroma, g: 0, b: x }

  return rgbToHex({
    r: (rgb.r + match) * 255,
    g: (rgb.g + match) * 255,
    b: (rgb.b + match) * 255,
  })
}

export function PtdColorField({
  label,
  value,
  defaultValue,
  open,
  defaultOpen = false,
  placeholder = '#RRGGBB',
  disabled = false,
  locked = false,
  allowTransparent = false,
  wide = false,
  recentColors,
  documentColors,
  onOpenChange,
  onValueChange,
  onCancel,
  onReset,
}: PtdColorFieldProps) {
  const effectiveDisabled = disabled || locked
  const [internalValue, setInternalValue] = useState(value ?? '')
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const [draft, setDraft] = useState(value ?? '')
  const [invalid, setInvalid] = useState(false)
  const startValueRef = useRef(value ?? '')
  const escapeRef = useRef(false)
  const closeHandledRef = useRef(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const errorId = useId()
  const currentValue = value === undefined ? internalValue : (value ?? '')
  const currentOpen = open === undefined ? internalOpen : open
  const effectiveOpen = effectiveDisabled ? false : currentOpen
  const normalizedValue = normalizePtdColor(currentValue)
  const normalizedDefault = normalizePtdColor(defaultValue)
  const recent = useMemo(() => cleanColors(recentColors), [recentColors])
  const documentPalette = useMemo(() => cleanColors(documentColors), [documentColors])
  const fallback = normalizedValue ?? normalizedDefault ?? '#ffffff'
  const transparent = isTransparent(currentValue, allowTransparent)
  const displayedValue = currentOpen ? draft : currentValue
  const draftColor = normalizePtdColor(draft)
  const pickerHsv = useMemo(() => {
    const source = draftColor ?? normalizedValue ?? fallback
    return rgbToHsv(hexToRgb(source) ?? { r: 255, g: 255, b: 255 })
  }, [draftColor, fallback, normalizedValue])
  const spectrumStyle = {
    '--ptd-color-field-hue': `${pickerHsv.h}deg`,
    '--ptd-color-field-saturation': `${pickerHsv.s * 100}%`,
    '--ptd-color-field-brightness': `${(1 - pickerHsv.v) * 100}%`,
    '--ptd-color-field-hue-position': `${(pickerHsv.h / 360) * 100}%`,
  } as CSSProperties

  useEffect(() => {
    if (!effectiveDisabled || !currentOpen) return
    // A controlled lock/disabled transition must close an already-open Portal immediately.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronize the uncontrolled open contract
    setInternalOpen(false)
    onOpenChange?.(false)
  }, [currentOpen, effectiveDisabled, onOpenChange])

  const setValue = (next: string) => {
    if (value === undefined) setInternalValue(next)
    onValueChange?.(next)
  }

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (effectiveDisabled && nextOpen) return
      if (!nextOpen) {
        if (closeHandledRef.current) return
        closeHandledRef.current = true
        queueMicrotask(() => {
          closeHandledRef.current = false
        })
      }
      if (nextOpen) {
        startValueRef.current = currentValue
        setDraft(currentValue)
        setInvalid(false)
      } else if (escapeRef.current) {
        escapeRef.current = false
        setDraft(startValueRef.current)
        setInvalid(false)
        onCancel?.()
      } else {
        setDraft(currentValue)
        setInvalid(false)
      }
      if (open === undefined) setInternalOpen(nextOpen)
      onOpenChange?.(nextOpen)
    },
    [currentValue, effectiveDisabled, onCancel, onOpenChange, open],
  )

  useEffect(() => {
    if (!effectiveOpen || typeof document === 'undefined') return
    const dismissOutside = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (triggerRef.current?.contains(target) || contentRef.current?.contains(target)) return
      handleOpenChange(false)
    }
    document.addEventListener('pointerdown', dismissOutside, true)
    return () => document.removeEventListener('pointerdown', dismissOutside, true)
  }, [effectiveOpen, handleOpenChange])

  const applyDraft = (next: string) => {
    setDraft(next)
    const normalized = normalizePtdColor(next)
    const transparentDraft = isTransparent(next, allowTransparent)
    setInvalid(next.trim() !== '' && !normalized && !transparentDraft)
    if (normalized) setValue(normalized)
    else if (transparentDraft) setValue('transparent')
  }

  const applyPalette = (next: string) => {
    if (effectiveDisabled) return
    setDraft(next)
    setInvalid(false)
    setValue(next)
  }

  const applyVisualColor = (next: HsvColor) => {
    applyPalette(hsvToHex(next))
  }

  const updateSpectrumFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    applyVisualColor({
      ...pickerHsv,
      s: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      v: clamp(1 - (event.clientY - rect.top) / rect.height, 0, 1),
    })
  }

  const updateHueFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width <= 0) return
    applyVisualColor({
      ...pickerHsv,
      h: clamp((event.clientX - rect.left) / rect.width, 0, 1) * 360,
    })
  }

  const handleSpectrumKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return
    event.preventDefault()
    const step = event.shiftKey ? 0.1 : 0.02
    applyVisualColor({
      ...pickerHsv,
      s: clamp(
        pickerHsv.s + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0),
        0,
        1,
      ),
      v: clamp(
        pickerHsv.v + (event.key === 'ArrowUp' ? step : event.key === 'ArrowDown' ? -step : 0),
        0,
        1,
      ),
    })
  }

  const handleHueKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const step = event.shiftKey ? 15 : 1
    const nextHue =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? 360
          : pickerHsv.h + (event.key === 'ArrowRight' ? step : -step)
    applyVisualColor({ ...pickerHsv, h: (nextHue + 360) % 360 })
  }

  return (
    <PtdField
      label={label}
      wide={wide || effectiveOpen}
      disabled={effectiveDisabled}
      locked={locked}
      invalid={invalid}
      error={
        invalid
          ? `请输入三位或六位 HEX 颜色${allowTransparent ? '，或 transparent' : ''}`
          : undefined
      }
    >
      <Popover.Root open={effectiveOpen} onOpenChange={handleOpenChange}>
        <Popover.Trigger
          ref={triggerRef}
          className={styles.colorFieldTrigger}
          type="button"
          aria-label={label}
          disabled={effectiveDisabled}
          data-ptd-editor-interactive="true"
          data-transparent={transparent || undefined}
        >
          <span
            className={styles.colorFieldSwatch}
            style={swatchStyle(fallback)}
            aria-hidden="true"
          />
          <span className={styles.colorFieldValue}>{displayedValue || placeholder}</span>
          <span className={styles.colorFieldIcon} aria-hidden="true">
            {effectiveOpen ? <RiCloseLine /> : <RiArrowDownSLine />}
          </span>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            ref={contentRef}
            className={`${styles.colorFieldContent} ${ptdThemeClass}`}
            sideOffset={4}
            align="start"
            data-ptd-editor-interactive="true"
            aria-label={`${label}颜色面板`}
            onEscapeKeyDown={() => {
              escapeRef.current = true
            }}
          >
            <div className={styles.colorFieldEditor}>
              <label className={styles.colorFieldInputLabel} htmlFor={errorId}>
                HEX
              </label>
              <input
                id={errorId}
                className={styles.colorFieldInput}
                type="text"
                inputMode="text"
                spellCheck={false}
                value={draft}
                placeholder={placeholder}
                aria-label={`${label}颜色值`}
                aria-invalid={invalid || undefined}
                onChange={(event) => applyDraft(event.currentTarget.value)}
              />
              <span
                className={styles.colorFieldPreview}
                style={swatchStyle(draftColor ?? fallback)}
                aria-hidden="true"
              />
            </div>
            <div className={styles.colorFieldPicker} aria-label={`${label}可视化取色器`}>
              <div
                className={styles.colorFieldSpectrum}
                role="slider"
                tabIndex={0}
                aria-label="饱和度和明度"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(pickerHsv.s * 100)}
                style={spectrumStyle}
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId)
                  updateSpectrumFromPointer(event)
                }}
                onPointerMove={(event) => {
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    updateSpectrumFromPointer(event)
                  }
                }}
                onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}
                onKeyDown={handleSpectrumKeyDown}
              >
                <span className={styles.colorFieldSpectrumThumb} aria-hidden="true" />
              </div>
              <div
                className={styles.colorFieldHue}
                role="slider"
                tabIndex={0}
                aria-label="色相"
                aria-valuemin={0}
                aria-valuemax={360}
                aria-valuenow={Math.round(pickerHsv.h)}
                style={spectrumStyle}
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId)
                  updateHueFromPointer(event)
                }}
                onPointerMove={(event) => {
                  if (event.currentTarget.hasPointerCapture(event.pointerId))
                    updateHueFromPointer(event)
                }}
                onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}
                onKeyDown={handleHueKeyDown}
              >
                <span className={styles.colorFieldHueThumb} aria-hidden="true" />
              </div>
            </div>
            <div className={styles.colorFieldActions}>
              {allowTransparent && (
                <button
                  type="button"
                  className={styles.colorFieldAction}
                  data-active={transparent || undefined}
                  onClick={() => applyPalette('transparent')}
                >
                  <span className={styles.colorFieldTransparent} aria-hidden="true" />
                  无色
                </button>
              )}
              {normalizedDefault && (
                <button
                  type="button"
                  className={styles.colorFieldAction}
                  disabled={normalizedValue === normalizedDefault}
                  onClick={() => (onReset ? onReset() : applyPalette(normalizedDefault))}
                >
                  <RiRestartLine aria-hidden="true" />
                  恢复默认
                </button>
              )}
            </div>
            <ColorSwatchSection
              title="主题颜色"
              colors={THEME_COLORS}
              current={normalizedValue}
              onColor={applyPalette}
            />
            <ColorSwatchSection
              title="标准颜色"
              colors={STANDARD_COLORS}
              current={normalizedValue}
              onColor={applyPalette}
            />
            <ColorSwatchSection
              title="最近使用"
              colors={recent}
              current={normalizedValue}
              onColor={applyPalette}
            />
            <ColorSwatchSection
              title="文档颜色"
              colors={documentPalette}
              current={normalizedValue}
              onColor={applyPalette}
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </PtdField>
  )
}

function ColorSwatchSection({
  title,
  colors,
  current,
  onColor,
}: {
  title: string
  colors: readonly string[]
  current: string | null
  onColor: (color: string) => void
}) {
  if (colors.length === 0) return null
  return (
    <section className={styles.colorFieldSection} aria-label={title}>
      <span className={styles.colorFieldSectionTitle}>{title}</span>
      <div className={styles.colorFieldSwatches}>
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            className={styles.colorFieldSwatchButton}
            style={swatchStyle(color)}
            aria-label={`${title} ${color}`}
            aria-pressed={color === current}
            title={color}
            data-ptd-editor-interactive="true"
            onClick={() => onColor(color)}
          >
            {color === current && <RiCheckLine aria-hidden="true" />}
          </button>
        ))}
      </div>
    </section>
  )
}

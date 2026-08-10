import {
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { fromDisplayMeasurement, getMeasurementStep, toDisplayMeasurement } from '@ptd/core'
import { RiAddLine, RiSubtractLine } from '@remixicon/react'
import { parseFiniteNumber, scrubNumberValue } from './propertyValue'
import styles from './PropertyInspector.module.css'
import type { MeasurementUnit } from '@ptd/core'

export interface InspectorFieldProps {
  label: string
  labelControl?: ReactNode
  wide?: boolean
  children: ReactNode
}

export function InspectorField({
  label,
  labelControl,
  wide = false,
  children,
}: InspectorFieldProps) {
  return (
    <div className={styles.field} data-wide={wide || undefined}>
      {labelControl ?? <span className={styles.fieldLabel}>{label}</span>}
      {children}
    </div>
  )
}

interface InspectorTextInputProps {
  label: string
  value: string
  disabled: boolean
  onValue: (value: string) => void
  onStart: () => void
  onFinish: () => void
  onCancel?: () => void
  placeholder?: string
  error?: string | null
  wide?: boolean
  spellCheck?: boolean
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode']
}

export function InspectorTextInput({
  label,
  value,
  disabled,
  onValue,
  onStart,
  onFinish,
  onCancel,
  placeholder,
  error,
  wide = false,
  spellCheck,
  inputMode,
}: InspectorTextInputProps) {
  const errorId = useId()
  const cancelRef = useRef(false)
  return (
    <InspectorField label={label} wide={wide}>
      <>
        <input
          className={styles.textControl}
          type="text"
          inputMode={inputMode}
          spellCheck={spellCheck}
          aria-label={label}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errorId : undefined}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => {
            cancelRef.current = false
            onStart()
          }}
          onChange={(event) => onValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Escape' || !onCancel) return
            event.preventDefault()
            cancelRef.current = true
            onCancel()
            event.currentTarget.blur()
          }}
          onBlur={() => {
            if (cancelRef.current) {
              cancelRef.current = false
              return
            }
            onFinish()
          }}
        />
        {error && (
          <span id={errorId} className={styles.fieldError} role="status">
            {error}
          </span>
        )}
      </>
    </InspectorField>
  )
}

interface InspectorTextAreaProps extends Omit<InspectorTextInputProps, 'inputMode'> {
  rows?: number
}

export function InspectorTextArea({
  label,
  value,
  disabled,
  onValue,
  onStart,
  onFinish,
  onCancel,
  placeholder,
  error,
  wide = true,
  spellCheck,
  rows,
}: InspectorTextAreaProps) {
  const errorId = useId()
  const cancelRef = useRef(false)
  return (
    <InspectorField label={label} wide={wide}>
      <>
        <textarea
          className={styles.textArea}
          aria-label={label}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errorId : undefined}
          value={value}
          rows={rows}
          placeholder={placeholder}
          spellCheck={spellCheck}
          disabled={disabled}
          onFocus={() => {
            cancelRef.current = false
            onStart()
          }}
          onChange={(event) => onValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Escape' || !onCancel) return
            event.preventDefault()
            cancelRef.current = true
            onCancel()
            event.currentTarget.blur()
          }}
          onBlur={() => {
            if (cancelRef.current) {
              cancelRef.current = false
              return
            }
            onFinish()
          }}
        />
        {error && (
          <span id={errorId} className={styles.fieldError} role="status">
            {error}
          </span>
        )}
      </>
    </InspectorField>
  )
}

export function InspectorFileAction({
  label,
  icon,
  accept,
  disabled,
  onFile,
}: {
  label: string
  icon?: ReactNode
  accept: string
  disabled: boolean
  onFile: (file: File | undefined) => void
}) {
  return (
    <label className={styles.assetAction} data-disabled={disabled || undefined}>
      {icon}
      <span>{label}</span>
      <input
        className={styles.visuallyHidden}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={(event) => {
          onFile(event.currentTarget.files?.[0])
          event.currentTarget.value = ''
        }}
      />
    </label>
  )
}

export interface InspectorNumberInputProps {
  label: string
  value: number | null
  disabled: boolean
  placeholder?: string
  unit?: string
  step?: number
  scrubStep?: number
  min?: number
  max?: number
  onStart: () => void
  onFinish: () => void
  onCancel: () => void
  onValue: (value: number) => void
}

interface ScrubSession {
  pointerId: number
  startX: number
  startValue: number
  lastValue: number
  moved: boolean
}

export function InspectorNumberInput({
  label,
  value,
  disabled,
  placeholder,
  unit,
  step = 1,
  scrubStep = step,
  min,
  max,
  onStart,
  onFinish,
  onCancel,
  onValue,
}: InspectorNumberInputProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [scrubbing, setScrubbing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const inputCancelRef = useRef(false)
  const scrubRef = useRef<ScrubSession | null>(null)
  const errorId = useId()
  const shownValue = editing ? draft : value === null ? '' : formatNumber(value)
  const parsedDraft = parseFiniteNumber(draft, { min, max })
  const invalid = editing && parsedDraft === null
  const scrubbable = !disabled && value !== null

  const apply = (nextDraft: string) => {
    const parsed = parseFiniteNumber(nextDraft, { min, max })
    if (parsed !== null) onValue(parsed)
  }
  const nudge = (direction: -1 | 1) => {
    if (value === null) return
    const next = clamp(roundForStep(value + direction * step, step), min, max)
    onStart()
    onValue(next)
    onFinish()
  }
  const clearPointerCapture = (target: HTMLButtonElement, pointerId: number) => {
    scrubRef.current = null
    if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId)
  }
  const cancelScrub = (target: HTMLButtonElement, pointerId: number) => {
    const session = scrubRef.current
    if (!session || session.pointerId !== pointerId) return
    clearPointerCapture(target, pointerId)
    if (!session.moved) return
    setScrubbing(false)
    onCancel()
  }
  const handleScrubPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!scrubbable || value === null || event.button !== 0 || event.pointerType === 'touch') return
    event.preventDefault()
    event.currentTarget.focus({ preventScroll: true })
    event.currentTarget.setPointerCapture(event.pointerId)
    scrubRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startValue: value,
      lastValue: value,
      moved: false,
    }
  }
  const handleScrubPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const session = scrubRef.current
    if (!session || session.pointerId !== event.pointerId) return
    const deltaX = event.clientX - session.startX
    if (!session.moved) {
      if (Math.abs(deltaX) < 3) return
      session.moved = true
      setScrubbing(true)
      onStart()
    }
    const next = scrubNumberValue(session.startValue, deltaX, {
      step: scrubStep,
      min,
      max,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
    })
    if (next === session.lastValue) return
    session.lastValue = next
    onValue(next)
  }
  const handleScrubPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const session = scrubRef.current
    if (!session || session.pointerId !== event.pointerId) return
    const moved = session.moved
    clearPointerCapture(event.currentTarget, event.pointerId)
    if (moved) {
      setScrubbing(false)
      onFinish()
      return
    }
    inputRef.current?.focus({ preventScroll: true })
  }
  const handleScrubKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const session = scrubRef.current
    if (event.key !== 'Escape' || !session) return
    event.preventDefault()
    cancelScrub(event.currentTarget, session.pointerId)
  }

  return (
    <InspectorField
      label={label}
      labelControl={
        <button
          type="button"
          className={styles.scrubLabel}
          tabIndex={-1}
          aria-label={`${label}，左右拖动调整数值`}
          title={scrubbable ? '左右拖动调整；Shift 加速，Alt 精调' : undefined}
          disabled={!scrubbable}
          data-active={scrubbing || undefined}
          onPointerDown={handleScrubPointerDown}
          onPointerMove={handleScrubPointerMove}
          onPointerUp={handleScrubPointerUp}
          onPointerCancel={(event) => cancelScrub(event.currentTarget, event.pointerId)}
          onLostPointerCapture={(event) => cancelScrub(event.currentTarget, event.pointerId)}
          onKeyDown={handleScrubKeyDown}
        >
          {label}
        </button>
      }
    >
      <>
        <div
          className={styles.numberControl}
          data-disabled={disabled || undefined}
          data-has-unit={Boolean(unit) || undefined}
        >
          <button
            type="button"
            aria-label={`${label}减少${step}`}
            disabled={disabled || value === null}
            onClick={() => nudge(-1)}
          >
            <RiSubtractLine aria-hidden="true" />
          </button>
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            aria-label={label}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? errorId : undefined}
            value={shownValue}
            placeholder={placeholder}
            disabled={disabled}
            onFocus={(event) => {
              inputCancelRef.current = false
              setEditing(true)
              setDraft(event.currentTarget.value)
              onStart()
            }}
            onChange={(event) => {
              setDraft(event.target.value)
              apply(event.target.value)
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Escape') return
              event.preventDefault()
              inputCancelRef.current = true
              setEditing(false)
              onCancel()
              event.currentTarget.blur()
            }}
            onBlur={(event) => {
              if (inputCancelRef.current) {
                inputCancelRef.current = false
                setEditing(false)
                return
              }
              apply(event.currentTarget.value)
              setEditing(false)
              onFinish()
            }}
          />
          {unit && <span className={styles.unit}>{unit}</span>}
          <button
            type="button"
            aria-label={`${label}增加${step}`}
            disabled={disabled || value === null}
            onClick={() => nudge(1)}
          >
            <RiAddLine aria-hidden="true" />
          </button>
        </div>
        {invalid && (
          <span id={errorId} className={styles.fieldError} role="status">
            {numberRangeMessage(min, max, unit)}
          </span>
        )}
      </>
    </InspectorField>
  )
}

export interface InspectorMetricInputProps {
  label: string
  canvasValue: number | null
  unit: MeasurementUnit
  disabled: boolean
  placeholder?: string
  minCanvasPx?: number
  maxCanvasPx?: number
  onStart: () => void
  onFinish: () => void
  onCancel: () => void
  onCanvasValue: (value: number) => void
}

export function InspectorMetricInput({
  label,
  canvasValue,
  unit,
  disabled,
  placeholder,
  minCanvasPx,
  maxCanvasPx,
  onStart,
  onFinish,
  onCancel,
  onCanvasValue,
}: InspectorMetricInputProps) {
  const step = getMeasurementStep(unit)
  return (
    <InspectorNumberInput
      label={label}
      value={canvasValue === null ? null : toDisplayMeasurement(canvasValue, unit)}
      placeholder={placeholder}
      unit={unit}
      step={step}
      scrubStep={step}
      min={minCanvasPx === undefined ? undefined : toDisplayMeasurement(minCanvasPx, unit)}
      max={maxCanvasPx === undefined ? undefined : toDisplayMeasurement(maxCanvasPx, unit)}
      disabled={disabled}
      onStart={onStart}
      onFinish={onFinish}
      onCancel={onCancel}
      onValue={(value) => onCanvasValue(fromDisplayMeasurement(value, unit))}
    />
  )
}

export function InspectorSegmentedInput({
  label,
  value,
  options,
  disabled = false,
  wide = false,
  onValue,
}: {
  label: string
  value: string
  options: Array<{ value: string; label: string; icon?: ReactNode }>
  disabled?: boolean
  wide?: boolean
  onValue: (value: string) => void
}) {
  return (
    <InspectorField label={label} wide={wide}>
      <div className={styles.segmented} role="group" aria-label={label} data-count={options.length}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={option.value === value}
            disabled={disabled}
            onClick={() => onValue(option.value)}
          >
            {option.icon}
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </InspectorField>
  )
}

export function InspectorSelectInput({
  label,
  value,
  options,
  disabled,
  wide = false,
  onStart,
  onFinish,
  onValue,
}: {
  label: string
  value: string
  options: Array<[string, string]>
  disabled: boolean
  wide?: boolean
  onStart: () => void
  onFinish: () => void
  onValue: (value: string) => void
}) {
  return (
    <InspectorField label={label} wide={wide}>
      <select
        className={styles.selectControl}
        aria-label={label}
        value={value}
        disabled={disabled}
        onFocus={onStart}
        onBlur={onFinish}
        onChange={(event) => onValue(event.target.value)}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </InspectorField>
  )
}

function formatNumber(value: number): string {
  return String(Math.round(value * 100) / 100)
}

function numberRangeMessage(min?: number, max?: number, unit?: string): string {
  const suffix = unit ? ` ${unit}` : ''
  if (min !== undefined && max !== undefined) {
    return `请输入 ${formatNumber(min)}–${formatNumber(max)}${suffix} 之间的数值`
  }
  if (min !== undefined) return `请输入不小于 ${formatNumber(min)}${suffix} 的数值`
  if (max !== undefined) return `请输入不大于 ${formatNumber(max)}${suffix} 的数值`
  return '请输入有效数值'
}

function roundForStep(value: number, step: number): number {
  const decimals = String(step).split('.')[1]?.length ?? 0
  return Number(value.toFixed(decimals))
}

function clamp(value: number, min?: number, max?: number): number {
  return Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, value))
}

import { useMemo, useRef } from 'react'
import { useSignals } from '@preact/signals-react/runtime'
import { PtdColorField, normalizePtdColor } from '@ptd/react-ui'
import { useEditorStore } from '../../state'
import { deriveDocumentColors } from './inspectorColors'

export interface InspectorPtdColorFieldProps {
  label: string
  value: string | null
  disabled: boolean
  placeholder?: string
  defaultValue?: string
  allowTransparent?: boolean
  wide?: boolean
  onStart: () => void
  onFinish: () => void
  onCancel: () => void
  onValue: (value: string) => void
}

/**
 * Adapts the Store-agnostic primitive to an Inspector gesture and palette host.
 * The primitive remains unaware of Store/history; this wrapper is the only
 * shared business boundary for migrated Inspector color fields.
 */
export function InspectorPtdColorField({
  label,
  value,
  disabled,
  placeholder,
  defaultValue,
  allowTransparent = false,
  wide = false,
  onStart,
  onFinish,
  onCancel,
  onValue,
}: InspectorPtdColorFieldProps) {
  useSignals()
  const store = useEditorStore()
  const template = store.template.value
  const recentColors = store.recentColors.value
  const documentColors = useMemo(() => deriveDocumentColors(template), [template])
  const cancelledRef = useRef(false)

  const rememberValue = (next: string | null) => {
    const normalized = normalizePtdColor(next)
    if (normalized) store.recordRecentColor(normalized)
  }

  return (
    <PtdColorField
      label={label}
      value={value}
      placeholder={placeholder}
      defaultValue={defaultValue}
      allowTransparent={allowTransparent}
      wide={wide}
      disabled={disabled}
      recentColors={recentColors}
      documentColors={documentColors}
      onOpenChange={(open) => {
        if (open) {
          cancelledRef.current = false
          onStart()
          return
        }
        if (cancelledRef.current) {
          cancelledRef.current = false
          return
        }
        onFinish()
        rememberValue(value)
      }}
      onValueChange={onValue}
      onCancel={() => {
        cancelledRef.current = true
        onCancel()
      }}
      onReset={() => {
        if (defaultValue) onValue(defaultValue)
      }}
    />
  )
}

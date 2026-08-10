import { useMemo } from 'react'
import { useSignals } from '@preact/signals-react/runtime'
import {
  deleteTableColumn,
  deleteTableRow,
  expandTableCellRange,
  getTableCellAt,
  getTableCellIdsInRange,
  insertTableColumn,
  insertTableRow,
  mergeTableCells,
  normalizeSimpleTableProps,
  resizeTableColumn,
  resizeTableRow,
  splitTableCell,
  updateTableCellText,
  updateTableCellsStyle,
  type ComponentSchema,
  type SimpleTableProps,
  type TableCellStyle,
} from '@ptd/core'
import {
  CJK_FONT_FAMILY_OPTIONS,
  composeFontFamily,
  LATIN_FONT_FAMILY_OPTIONS,
  resolveFontFamily,
} from '../../config/typography'
import { useEditorStore } from '../../state'
import {
  InspectorMetricInput as MetricField,
  InspectorNumberInput as NumberField,
  InspectorSegmentedInput as SegmentedField,
  InspectorSelectInput as SelectField,
  InspectorTextArea,
} from './InspectorControls'
import { InspectorPtdColorField } from './InspectorPtdColorField'
import styles from './PropertyInspector.module.css'

export interface TableContentFieldsProps {
  component: ComponentSchema & { component: 'RoySimpleTable' }
  disabled: boolean
  onStart: () => void
  onFinish: () => void
  onCancel: () => void
  onValue: (value: unknown) => void
  onDiscreteValue: (value: unknown) => void
}

export function TableContentFields({
  component,
  disabled,
  onStart,
  onFinish,
  onCancel,
  onValue,
  onDiscreteValue,
}: TableContentFieldsProps) {
  useSignals()
  const store = useEditorStore()
  const measurementUnit = store.measurementUnit.value
  const value = useMemo(() => normalizeSimpleTableProps(component.propValue), [component.propValue])
  const selection =
    store.tableCellSelection.value?.componentId === component.id
      ? store.tableCellSelection.value
      : null
  const range = selection
    ? expandTableCellRange(value, {
        startRow: selection.anchorRow,
        startColumn: selection.anchorColumn,
        endRow: selection.focusRow,
        endColumn: selection.focusColumn,
      })
    : null
  const cellIds = range ? getTableCellIdsInRange(value, range) : []
  const cells = cellIds.flatMap((id) => (value.cells[id] ? [value.cells[id]!] : []))
  const primary = selection
    ? getTableCellAt(value, selection.focusRow, selection.focusColumn)
    : null
  const primaryStyle = primary?.style
  const fontSelection = resolveFontFamily(primaryStyle?.fontFamily ?? '')
  const rowIndex = clamp(selection?.focusRow ?? value.grid.length - 1, 0, value.grid.length - 1)
  const columnIndex = clamp(
    selection?.focusColumn ?? value.columnWidths.length - 1,
    0,
    value.columnWidths.length - 1,
  )

  const applyDiscrete = (next: SimpleTableProps, row = rowIndex, column = columnIndex) => {
    if (next === value) return
    onDiscreteValue(next)
    store.selectTableCell(
      component.id,
      clamp(row, 0, next.grid.length - 1),
      clamp(column, 0, next.columnWidths.length - 1),
    )
  }
  const patchCells = (patch: Partial<TableCellStyle>, discrete = true) => {
    if (cellIds.length === 0) return
    const next = updateTableCellsStyle(value, cellIds, patch)
    if (discrete) onDiscreteValue(next)
    else onValue(next)
  }
  const insertRowAt = (index: number) =>
    applyDiscrete(insertTableRow(value, index), index, columnIndex)
  const insertColumnAt = (index: number) =>
    applyDiscrete(insertTableColumn(value, index), rowIndex, index)

  return (
    <div className={styles.tableContentEditor}>
      <div className={styles.tableSummary} role="status">
        <span>
          {value.grid.length} 行 × {value.columnWidths.length} 列
        </span>
        <strong>{cellIds.length > 0 ? `已选 ${cellIds.length} 格` : '选择画布中的单元格'}</strong>
      </div>

      <div className={styles.tableActionGrid} aria-label="表格结构命令">
        <button type="button" disabled={disabled} onClick={() => insertRowAt(rowIndex)}>
          上方插入行
        </button>
        <button type="button" disabled={disabled} onClick={() => insertRowAt(rowIndex + 1)}>
          下方插入行
        </button>
        <button type="button" disabled={disabled} onClick={() => insertColumnAt(columnIndex)}>
          左侧插入列
        </button>
        <button type="button" disabled={disabled} onClick={() => insertColumnAt(columnIndex + 1)}>
          右侧插入列
        </button>
        <button
          type="button"
          disabled={disabled || value.grid.length <= 1}
          data-danger
          onClick={() => applyDiscrete(deleteTableRow(value, rowIndex), rowIndex - 1, columnIndex)}
        >
          删除当前行
        </button>
        <button
          type="button"
          disabled={disabled || value.columnWidths.length <= 1}
          data-danger
          onClick={() =>
            applyDiscrete(deleteTableColumn(value, columnIndex), rowIndex, columnIndex - 1)
          }
        >
          删除当前列
        </button>
      </div>

      <div className={styles.tableActionRow}>
        <button
          type="button"
          disabled={disabled || !range || cellIds.length <= 1}
          onClick={() => {
            if (range)
              applyDiscrete(mergeTableCells(value, range), range.startRow, range.startColumn)
          }}
        >
          合并所选单元格
        </button>
        <button
          type="button"
          disabled={disabled || !primary || (primary.rowSpan === 1 && primary.colSpan === 1)}
          onClick={() => {
            if (primary) applyDiscrete(splitTableCell(value, primary.id))
          }}
        >
          拆分单元格
        </button>
      </div>

      {primary ? (
        <>
          <div className={styles.tableSubheading}>
            <span>单元格</span>
            <small>{cells.length > 1 ? '混合值 · 修改将应用到所选区域' : primary.id}</small>
          </div>
          {cells.length === 1 && (
            <InspectorTextArea
              label="单元格内容"
              value={primary.text}
              disabled={disabled}
              onStart={onStart}
              onFinish={onFinish}
              onCancel={onCancel}
              onValue={(text) => onValue(updateTableCellText(value, primary.id, text))}
            />
          )}

          <div className={styles.tableFieldGrid}>
            <MetricField
              label="当前行高"
              canvasValue={value.rowHeights[rowIndex] ?? 0}
              unit={measurementUnit}
              minCanvasPx={8}
              disabled={disabled}
              onStart={onStart}
              onFinish={onFinish}
              onCancel={onCancel}
              onCanvasValue={(next) => onValue(resizeTableRow(value, rowIndex, next))}
            />
            <MetricField
              label="当前列宽"
              canvasValue={value.columnWidths[columnIndex] ?? 0}
              unit={measurementUnit}
              minCanvasPx={8}
              disabled={disabled}
              onStart={onStart}
              onFinish={onFinish}
              onCancel={onCancel}
              onCanvasValue={(next) => onValue(resizeTableColumn(value, columnIndex, next))}
            />
            <NumberField
              label="字号"
              value={primaryStyle?.fontSize ?? 10}
              unit="pt"
              min={1}
              disabled={disabled}
              onStart={onStart}
              onFinish={onFinish}
              onCancel={onCancel}
              onValue={(next) => patchCells({ fontSize: next }, false)}
            />
            <MetricField
              label="内边距"
              canvasValue={primaryStyle?.padding ?? 4}
              unit={measurementUnit}
              minCanvasPx={0}
              disabled={disabled}
              onStart={onStart}
              onFinish={onFinish}
              onCancel={onCancel}
              onCanvasValue={(next) => patchCells({ padding: next }, false)}
            />
            <SelectField
              label="中文字体"
              value={fontSelection.cjk}
              options={CJK_FONT_FAMILY_OPTIONS}
              disabled={disabled}
              onStart={onStart}
              onFinish={onFinish}
              onValue={(font) =>
                patchCells({ fontFamily: composeFontFamily(font, fontSelection.latin) }, false)
              }
            />
            <SelectField
              label="西文字体"
              value={fontSelection.latin}
              options={LATIN_FONT_FAMILY_OPTIONS}
              disabled={disabled}
              onStart={onStart}
              onFinish={onFinish}
              onValue={(font) =>
                patchCells({ fontFamily: composeFontFamily(fontSelection.cjk, font) }, false)
              }
            />
          </div>

          <div className={styles.tableSegmented} aria-label="字形样式">
            <ToggleButton
              label="粗体"
              active={primaryStyle?.fontWeight === 'bold'}
              disabled={disabled}
              onClick={() =>
                patchCells({
                  fontWeight: primaryStyle?.fontWeight === 'bold' ? 'normal' : 'bold',
                })
              }
            />
            <ToggleButton
              label="斜体"
              active={primaryStyle?.fontStyle === 'italic'}
              disabled={disabled}
              onClick={() =>
                patchCells({
                  fontStyle: primaryStyle?.fontStyle === 'italic' ? 'normal' : 'italic',
                })
              }
            />
            <ToggleButton
              label="下划线"
              active={primaryStyle?.textDecoration === 'underline'}
              disabled={disabled}
              onClick={() =>
                patchCells({
                  textDecoration:
                    primaryStyle?.textDecoration === 'underline' ? 'none' : 'underline',
                })
              }
            />
            <ToggleButton
              label="删除线"
              active={primaryStyle?.textDecoration === 'line-through'}
              disabled={disabled}
              onClick={() =>
                patchCells({
                  textDecoration:
                    primaryStyle?.textDecoration === 'line-through' ? 'none' : 'line-through',
                })
              }
            />
          </div>

          <div className={styles.tableFieldGrid}>
            <SegmentedField
              label="水平对齐"
              value={primaryStyle?.horizontalAlign ?? 'left'}
              disabled={disabled}
              wide
              options={[
                { value: 'left', label: '左' },
                { value: 'center', label: '中' },
                { value: 'right', label: '右' },
              ]}
              onValue={(next) =>
                patchCells({ horizontalAlign: next as TableCellStyle['horizontalAlign'] })
              }
            />
            <SegmentedField
              label="垂直对齐"
              value={primaryStyle?.verticalAlign ?? 'middle'}
              disabled={disabled}
              wide
              options={[
                { value: 'top', label: '上' },
                { value: 'middle', label: '中' },
                { value: 'bottom', label: '下' },
              ]}
              onValue={(next) =>
                patchCells({ verticalAlign: next as TableCellStyle['verticalAlign'] })
              }
            />
            <InspectorPtdColorField
              label="文字颜色"
              value={primaryStyle?.color ?? '#1d2735'}
              defaultValue="#1d2735"
              disabled={disabled}
              onStart={onStart}
              onFinish={onFinish}
              onCancel={onCancel}
              onValue={(next) => patchCells({ color: next }, false)}
            />
            <InspectorPtdColorField
              label="背景颜色"
              value={primaryStyle?.background ?? '#ffffff'}
              defaultValue="#ffffff"
              disabled={disabled}
              onStart={onStart}
              onFinish={onFinish}
              onCancel={onCancel}
              onValue={(next) => patchCells({ background: next }, false)}
            />
            <InspectorPtdColorField
              label="边框颜色"
              value={primaryStyle?.borderColor ?? '#8d99a8'}
              defaultValue="#8d99a8"
              disabled={disabled}
              onStart={onStart}
              onFinish={onFinish}
              onCancel={onCancel}
              onValue={(next) => patchCells({ borderColor: next }, false)}
            />
            <MetricField
              label="边框宽度"
              canvasValue={primaryStyle?.borderWidth ?? 1}
              unit={measurementUnit}
              minCanvasPx={0}
              disabled={disabled}
              onStart={onStart}
              onFinish={onFinish}
              onCancel={onCancel}
              onCanvasValue={(next) => patchCells({ borderWidth: next }, false)}
            />
            <SegmentedField
              label="边框样式"
              value={primaryStyle?.borderStyle ?? 'solid'}
              disabled={disabled}
              wide
              options={[
                { value: 'solid', label: '实线' },
                { value: 'dashed', label: '虚线' },
                { value: 'dotted', label: '点线' },
                { value: 'none', label: '无' },
              ]}
              onValue={(next) => patchCells({ borderStyle: next as TableCellStyle['borderStyle'] })}
            />
          </div>
        </>
      ) : (
        <div className={styles.structuredNotice} role="note">
          <strong>在画布中选择单元格</strong>
          <span>拖动可选择区域；双击单元格直接编辑文字。</span>
        </div>
      )}
    </div>
  )
}

function ToggleButton({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string
  active: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button type="button" aria-pressed={active} disabled={disabled} onClick={onClick}>
      {label}
    </button>
  )
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

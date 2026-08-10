/** @vitest-environment jsdom */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import {
  DEFAULT_BAR_CODE_PROPS,
  DEFAULT_PAGE_CONFIG,
  DEFAULT_QR_CODE_PROPS,
  createSimpleTableProps,
  type ComponentSchema,
  type TemplateSchema,
} from '@ptd/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PropertyInspector } from '../components/PropertyInspector/PropertyInspector'
import { EditorStore, EditorStoreProvider } from '../state'

function template(): TemplateSchema {
  return {
    _version: 2,
    pageConfig: { ...DEFAULT_PAGE_CONFIG },
    pages: [{ id: 'page-1', componentData: [] }],
    data: { version: 1, fields: [] },
  }
}

function component(
  id: string,
  componentType: ComponentSchema['component'],
  propValue: unknown,
  style: Partial<ComponentSchema['style']> = {},
  isLock = false,
): ComponentSchema {
  return {
    id,
    component: componentType,
    name: id,
    propValue,
    style: { width: 200, height: 80, rotate: 0, opacity: 1, ...style },
    groupStyle: {},
    position: {},
    isLock,
  }
}

function templateWithComponents(components: ComponentSchema[]): TemplateSchema {
  return {
    ...template(),
    pages: [{ id: 'page-1', componentData: components }],
  }
}

describe('PropertyInspector headless page settings', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    Element.prototype.scrollIntoView ??= () => undefined
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    document.body.replaceChildren()
  })

  it('uses PTD headless Select and Segmented wrappers for page settings', async () => {
    const store = new EditorStore(template())
    await act(async () => {
      root.render(
        <EditorStoreProvider store={store}>
          <PropertyInspector />
        </EditorStoreProvider>,
      )
    })

    expect(container.querySelector('[role="combobox"][aria-label="纸张规格"]')).not.toBeNull()
    expect(container.querySelector('[role="combobox"][aria-label="默认字体"]')).not.toBeNull()
    expect(container.querySelector('[role="group"][aria-label="页面方向"]')).not.toBeNull()
    expect(container.querySelector('[role="group"][aria-label="边距模式"]')).not.toBeNull()
    expect(container.querySelector('select')).toBeNull()
  })

  it('commits a paper-size selection as one history step and keeps undo parity', async () => {
    const initial = template()
    const store = new EditorStore(initial)
    await act(async () => {
      root.render(
        <EditorStoreProvider store={store}>
          <PropertyInspector />
        </EditorStoreProvider>,
      )
    })

    const trigger = container.querySelector<HTMLButtonElement>(
      '[role="combobox"][aria-label="纸张规格"]',
    )
    expect(trigger).not.toBeNull()
    const initialHistoryLength = store.history.value.length
    const initialHistoryIndex = store.historyIndex.value

    trigger?.focus()
    await act(async () => {
      trigger?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    const custom = [...document.body.querySelectorAll('[role="option"]')].find((option) =>
      option.textContent?.includes('自定义尺寸'),
    )
    expect(custom).not.toBeNull()
    await act(async () => {
      ;(custom as HTMLElement | undefined)?.focus()
      custom?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })

    expect(store.pageConfig.value.pageSize).toBe('custom')
    expect(store.history.value).toHaveLength(initialHistoryLength + 1)
    expect(store.historyIndex.value).toBe(initialHistoryIndex + 1)

    await act(async () => {
      store.undo()
    })
    expect(store.pageConfig.value.pageSize).toBe(initial.pageConfig.pageSize)
    expect(store.historyIndex.value).toBe(initialHistoryIndex)
  })

  it('commits a continuous page color gesture once and restores it with undo', async () => {
    const initial = template()
    const store = new EditorStore(initial)
    await act(async () => {
      root.render(
        <EditorStoreProvider store={store}>
          <PropertyInspector />
        </EditorStoreProvider>,
      )
    })

    const trigger = container.querySelector<HTMLButtonElement>('[aria-label="纸张颜色"]')
    expect(trigger).not.toBeNull()
    const initialHistoryLength = store.history.value.length
    await act(async () => {
      trigger?.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    const input = document.body.querySelector<HTMLInputElement>('[aria-label="纸张颜色颜色值"]')
    expect(input).not.toBeNull()
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(input, '#ABC')
      input?.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(store.pageConfig.value.background).toBe('#aabbcc')

    const outside = document.createElement('div')
    document.body.append(outside)
    await act(async () => {
      outside.dispatchEvent(
        new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }),
      )
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(store.history.value).toHaveLength(initialHistoryLength + 1)

    await act(async () => store.undo())
    expect(store.pageConfig.value.background).toBe(initial.pageConfig.background)
    await act(async () => store.redo())
    expect(store.pageConfig.value.background).toBe('#aabbcc')
  })

  it('renders migrated single-object color fields without native color inputs', async () => {
    const text = component('text-1', 'RoySimpleText', '示例', {
      color: '#123456',
      background: '#ffffff',
      borderColor: '#8d99a8',
    })
    const store = new EditorStore(templateWithComponents([text]))
    store.selectComponent(text.id)
    const initialHistoryLength = store.history.value.length
    const initialRecentLength = store.recentColors.value.length
    await act(async () => {
      root.render(
        <EditorStoreProvider store={store}>
          <PropertyInspector />
        </EditorStoreProvider>,
      )
    })

    expect(container.querySelector('input[type="color"]')).toBeNull()
    expect(container.querySelector('[aria-label="文字"]')).not.toBeNull()
    expect(container.querySelector('[aria-label="背景"]')).not.toBeNull()
    expect(container.querySelector('[aria-label="边框色"]')).not.toBeNull()

    const trigger = container.querySelector<HTMLButtonElement>('[aria-label="文字"]')
    await act(async () => trigger?.click())
    expect(document.body.querySelector('[role="slider"][aria-label="饱和度和明度"]')).not.toBeNull()
    expect(document.body.querySelector('[role="slider"][aria-label="色相"]')).not.toBeNull()

    const input = document.body.querySelector<HTMLInputElement>('[aria-label="文字颜色值"]')
    expect(input).not.toBeNull()
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(input, '#ABC')
      input?.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(store.components.value[0]?.style.color).toBe('#aabbcc')

    await act(async () => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      )
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(store.components.value[0]?.style.color).toBe('#123456')
    expect(store.history.value).toHaveLength(initialHistoryLength)
    expect(store.recentColors.value).toHaveLength(initialRecentLength)
  })

  it('keeps mixed batch colors explicit and applies one new color to the selection', async () => {
    const first = component('text-1', 'RoySimpleText', '一', { color: '#123456' })
    const second = component('text-2', 'RoySimpleText', '二', { color: '#abcdef' })
    const store = new EditorStore(templateWithComponents([first, second]))
    store.selectComponents([first.id, second.id])
    await act(async () => {
      root.render(
        <EditorStoreProvider store={store}>
          <PropertyInspector />
        </EditorStoreProvider>,
      )
    })

    const trigger = container.querySelector<HTMLButtonElement>('[aria-label="文字"]')
    expect(trigger).not.toBeNull()
    expect(trigger?.textContent).toContain('混合：输入颜色')
    await act(async () => trigger?.click())
    const input = document.body.querySelector<HTMLInputElement>('[aria-label="文字颜色值"]')
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(input, '#00FF00')
      input?.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(store.components.value.map((item) => item.style.color)).toEqual(['#00ff00', '#00ff00'])
  })

  it('uses migrated color fields for QR, barcode, and table cell styles', async () => {
    const table = component('table-1', 'RoySimpleTable', createSimpleTableProps(1, 1))
    const qr = component('qr-1', 'RoyQRCode', DEFAULT_QR_CODE_PROPS)
    const barcode = component('barcode-1', 'RoyBarCode', DEFAULT_BAR_CODE_PROPS)
    const store = new EditorStore(templateWithComponents([table, qr, barcode]))

    store.selectComponent(qr.id)
    await act(async () => {
      root.render(
        <EditorStoreProvider store={store}>
          <PropertyInspector />
        </EditorStoreProvider>,
      )
    })
    expect(container.querySelector('[aria-label="前景"]')).not.toBeNull()
    expect(container.querySelector('[aria-label="背景"]')).not.toBeNull()
    expect(container.querySelector('input[type="color"]')).toBeNull()

    await act(async () => store.selectComponent(barcode.id))
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
    expect(container.querySelector('[aria-label="前景"]')).not.toBeNull()
    expect(container.querySelector('[aria-label="背景"]')).not.toBeNull()
    expect(container.querySelectorAll('[aria-label="前景"]').length).toBe(1)

    await act(async () => store.selectTableCell(table.id, 0, 0))
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
    expect(container.querySelector('[aria-label="文字颜色"]')).not.toBeNull()
    expect(container.querySelector('[aria-label="背景颜色"]')).not.toBeNull()
    expect(container.querySelector('[aria-label="边框颜色"]')).not.toBeNull()
    expect(container.querySelector('input[type="color"]')).toBeNull()
  })
})

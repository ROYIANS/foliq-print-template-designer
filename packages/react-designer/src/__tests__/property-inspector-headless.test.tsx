/** @vitest-environment jsdom */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { DEFAULT_PAGE_CONFIG, type TemplateSchema } from '@ptd/core'
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
})

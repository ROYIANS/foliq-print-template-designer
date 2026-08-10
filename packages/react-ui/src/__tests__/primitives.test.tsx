/** @vitest-environment jsdom */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PtdField, PtdSegmented, PtdSelect, ptdThemeClass } from '../index'

describe('@ptd/react-ui primitives', () => {
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

  it('renders a stable field shell with wide and state attributes', async () => {
    await act(async () => {
      root.render(
        <PtdField label="纸张规格" wide locked>
          <span>内容</span>
        </PtdField>,
      )
    })

    const field = container.querySelector('[data-ptd-region="field"]')
    expect(field).not.toBeNull()
    expect(field?.getAttribute('data-wide')).toBe('true')
    expect(field?.getAttribute('data-locked')).toBe('true')
    expect(field?.textContent).toContain('纸张规格')
  })

  it('keeps segmented selection controlled and emits only non-empty values', async () => {
    const values: string[] = []
    await act(async () => {
      root.render(
        <PtdSegmented
          label="页面方向"
          value="p"
          options={[
            { value: 'p', label: '纵向' },
            { value: 'l', label: '横向' },
          ]}
          onValueChange={(value) => values.push(value)}
        />,
      )
    })

    const buttons = [...container.querySelectorAll<HTMLButtonElement>('button')]
    expect(buttons[0]?.getAttribute('data-state')).toBe('on')
    act(() => buttons[1]?.click())
    expect(values).toEqual(['l'])
    expect(buttons[0]?.getAttribute('data-state')).toBe('on')
  })

  it('fails closed for an empty select and locked segmented control', async () => {
    await act(async () => {
      root.render(
        <>
          <PtdSelect label="纸张规格" options={[]} />
          <PtdSegmented
            label="页面方向"
            value="p"
            locked
            options={[
              { value: 'p', label: '纵向' },
              { value: 'l', label: '横向' },
            ]}
          />
        </>,
      )
    })

    const buttons = [...container.querySelectorAll<HTMLButtonElement>('button')]
    expect(buttons[0]?.disabled).toBe(true)
    expect(buttons.slice(1).every((button) => button.disabled)).toBe(true)
  })

  it('keeps Select keyboard interactions in the themed Portal and supports dismissal', async () => {
    const values: string[] = []
    const opens: boolean[] = []
    await act(async () => {
      root.render(
        <PtdSelect
          label="纸张规格"
          value="A4"
          options={[
            { value: 'A4', label: 'A4 · 210 × 297 mm' },
            { value: 'custom', label: '自定义尺寸' },
          ]}
          onValueChange={(value) => values.push(value)}
          onOpenChange={(open) => opens.push(open)}
        />,
      )
    })

    const trigger = container.querySelector<HTMLButtonElement>('[role="combobox"]')
    expect(trigger).not.toBeNull()

    trigger?.focus()
    await act(async () => {
      trigger?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    const content = document.body.querySelector(
      '[role="listbox"][data-ptd-editor-interactive="true"]',
    )
    expect(content).not.toBeNull()
    expect(content?.classList.contains(ptdThemeClass)).toBe(true)
    expect(opens).toEqual([true])

    const custom = [...document.body.querySelectorAll('[role="option"]')].find((option) =>
      option.textContent?.includes('自定义尺寸'),
    )
    expect(custom).not.toBeNull()
    await act(async () => {
      ;(custom as HTMLElement | undefined)?.focus()
      custom?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    expect(values).toEqual(['custom'])
    expect(opens.at(-1)).toBe(false)

    trigger?.focus()
    await act(async () => {
      trigger?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(opens.at(-1)).toBe(true)
    await act(async () => {
      document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }))
    })
    expect(opens.at(-1)).toBe(false)

    trigger?.focus()
    await act(async () => {
      trigger?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    await act(async () => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      )
    })
    expect(opens.at(-1)).toBe(false)
  })
})

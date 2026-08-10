/** @vitest-environment jsdom */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PtdColorField, PtdField, PtdSegmented, PtdSelect, ptdThemeClass } from '../index'

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

  it('keeps ColorField keyboard and Portal boundaries stable', async () => {
    const values: string[] = []
    const opens: boolean[] = []
    const cancels: number[] = []
    await act(async () => {
      root.render(
        <PtdColorField
          label="纸张颜色"
          value="#123456"
          defaultValue="#ffffff"
          recentColors={['#AABBCC', '#aabbcc', 'not-a-color']}
          documentColors={['#112233']}
          onValueChange={(value) => values.push(value)}
          onOpenChange={(open) => opens.push(open)}
          onCancel={() => cancels.push(1)}
        />,
      )
    })

    const trigger = container.querySelector<HTMLButtonElement>('[aria-label="纸张颜色"]')
    expect(trigger).not.toBeNull()
    trigger?.focus()
    await act(async () => {
      trigger?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      trigger?.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }))
      trigger?.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    const content = document.body.querySelector(
      '[data-ptd-editor-interactive="true"][role="dialog"]',
    )
    expect(content).not.toBeNull()
    expect(content?.classList.contains(ptdThemeClass)).toBe(true)
    expect(opens).toEqual([true])
    expect(document.body.querySelectorAll('[aria-label="最近使用 #aabbcc"]').length).toBe(1)

    const input = document.body.querySelector<HTMLInputElement>('[aria-label="纸张颜色颜色值"]')
    expect(input).not.toBeNull()
    await act(async () => {
      if (!input) return
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(input, '#ABC')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(values).toContain('#aabbcc')

    await act(async () => {
      const outside = document.createElement('div')
      document.body.append(outside)
      outside.dispatchEvent(
        new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }),
      )
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(opens.at(-1)).toBe(false)

    await act(async () => {
      trigger?.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(opens.at(-1)).toBe(true)
    await act(async () => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      )
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(opens.at(-1)).toBe(false)
    expect(cancels).toHaveLength(1)
  })

  it('provides a visual HSV picker with keyboard color adjustment', async () => {
    const values: string[] = []
    await act(async () => {
      root.render(
        <PtdColorField
          label="颜色"
          value="#336699"
          onValueChange={(value) => values.push(value)}
        />,
      )
    })

    const trigger = container.querySelector<HTMLButtonElement>('[aria-label="颜色"]')
    await act(async () => trigger?.click())

    const spectrum = document.body.querySelector<HTMLDivElement>(
      '[role="slider"][aria-label="饱和度和明度"]',
    )
    const hue = document.body.querySelector<HTMLDivElement>('[role="slider"][aria-label="色相"]')
    expect(spectrum).not.toBeNull()
    expect(hue).not.toBeNull()
    expect(spectrum?.getAttribute('aria-valuenow')).toBe('67')
    expect(hue?.getAttribute('aria-valuenow')).toBe('210')

    await act(async () => {
      spectrum?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
      hue?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    })

    expect(values).toHaveLength(2)
    expect(values.every((value) => /^#[0-9a-f]{6}$/.test(value))).toBe(true)
  })

  it('rejects invalid drafts and exposes transparent/reset actions explicitly', async () => {
    const values: string[] = []
    const resets: number[] = []
    await act(async () => {
      root.render(
        <PtdColorField
          label="颜色"
          value="#123456"
          defaultValue="#ffffff"
          allowTransparent
          documentColors={['#112233']}
          onValueChange={(value) => values.push(value)}
          onReset={() => resets.push(1)}
        />,
      )
    })
    const trigger = container.querySelector<HTMLButtonElement>('[aria-label="颜色"]')
    await act(async () => trigger?.click())
    const input = document.body.querySelector<HTMLInputElement>('[aria-label="颜色颜色值"]')
    await act(async () => {
      if (!input) return
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(input, 'oops')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(values).toEqual([])
    expect(input?.getAttribute('aria-invalid')).toBe('true')
    const transparent = document.body.querySelector<HTMLButtonElement>('[data-active="true"]')
    const transparentAction = [...document.body.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent?.includes('无色'),
    )
    expect(transparent).toBeNull()
    expect(transparentAction).not.toBeNull()
    await act(async () => transparentAction?.click())
    expect(values).toContain('transparent')
    const reset = [...document.body.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
      button.textContent?.includes('恢复默认'),
    )
    expect(reset).not.toBeNull()
    await act(async () => reset?.click())
    expect(resets).toEqual([1])
  })

  it('fails closed when disabled or locked, including an open-to-locked transition', async () => {
    const opens: boolean[] = []
    await act(async () => {
      root.render(
        <PtdColorField
          label="颜色"
          value="#123456"
          disabled
          onOpenChange={(open) => opens.push(open)}
        />,
      )
    })
    const disabledTrigger = container.querySelector<HTMLButtonElement>('[aria-label="颜色"]')
    expect(disabledTrigger?.disabled).toBe(true)
    await act(async () => disabledTrigger?.click())
    expect(opens).toEqual([])

    await act(async () => {
      root.render(
        <PtdColorField
          label="颜色"
          value="#123456"
          locked
          onOpenChange={(open) => opens.push(open)}
        />,
      )
    })
    const lockedTrigger = container.querySelector<HTMLButtonElement>('[aria-label="颜色"]')
    expect(lockedTrigger?.disabled).toBe(true)
  })
})

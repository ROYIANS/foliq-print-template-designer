import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DemoModeNotice } from './DemoModeNotice'

describe('DemoModeNotice', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    window.sessionStorage.clear()
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it('explains the reset boundary and links the full workspace notice to GitHub', async () => {
    await act(async () => root.render(<DemoModeNotice />))

    expect(container.textContent).toContain('每日 08:00（北京时间）')
    expect(container.textContent).toContain('管理员内容不受影响')
    const link = container.querySelector<HTMLAnchorElement>('a')!
    expect(link.href).toBe('https://github.com/ROYIANS/foliq-print-template-designer')
    expect(link.textContent).toContain('Fork')
  })

  it('keeps deep document routes compact and dismissed for the current session', async () => {
    await act(async () => root.render(<DemoModeNotice compact />))

    expect(container.querySelector('aside')?.dataset['compact']).toBe('true')
    expect(container.querySelector('a')).toBeNull()
    const close = container.querySelector<HTMLButtonElement>(
      'button[aria-label="关闭演示环境提示"]',
    )!
    await act(async () => close.click())
    expect(container.querySelector('aside')).toBeNull()

    await act(async () => root.unmount())
    root = createRoot(container)
    await act(async () => root.render(<DemoModeNotice compact />))
    expect(container.querySelector('aside')).toBeNull()
  })
})

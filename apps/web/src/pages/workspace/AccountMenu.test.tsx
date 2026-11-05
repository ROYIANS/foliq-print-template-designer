import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountMenu } from './AccountMenu'
import type { AccountUser } from '../landing/LandingPage'

const githubUser: AccountUser = {
  id: 'user-1',
  name: '小孟',
  email: 'xiaomeng@example.com',
  image: null,
  authMode: 'github',
  isAdmin: false,
}

const devUser: AccountUser = {
  ...githubUser,
  id: 'dev-user',
  name: 'Local Developer',
  email: 'dev@foliq.local',
  authMode: 'dev-bypass',
}

describe('AccountMenu', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    document.body.replaceChildren()
  })

  function trigger() {
    const button = container.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')
    if (!button) throw new Error('Missing account trigger')
    return button
  }

  it('opens and closes by clicking the same trigger', () => {
    act(() => root.render(<AccountMenu user={githubUser} surface="home" onSignOut={vi.fn()} />))

    expect(trigger().getAttribute('aria-label')).toBe('账户菜单，小孟')
    expect(trigger().querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    expect(trigger().textContent).not.toContain('▾')
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    act(() => trigger().click())
    expect(trigger().getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain(
      'xiaomeng@example.com',
    )

    act(() => trigger().click())
    expect(trigger().getAttribute('aria-expanded')).toBe('false')
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('keeps pointer-open focus on the trigger while keyboard activation enters the menu', () => {
    act(() => root.render(<AccountMenu user={githubUser} surface="home" onSignOut={vi.fn()} />))
    act(() => {
      trigger().focus()
      trigger().dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
    })
    expect(document.activeElement).toBe(trigger())

    act(() => trigger().click())
    act(() => trigger().click())
    expect(document.activeElement?.textContent).toContain('返回 Foliq 官网')
  })

  it('uses only the avatar as the editor header trigger', () => {
    act(() => root.render(<AccountMenu user={githubUser} surface="editor" onSignOut={vi.fn()} />))

    expect(trigger().getAttribute('aria-label')).toBe('账户菜单，小孟')
    expect(trigger().textContent).toBe('小')
    expect(trigger().querySelector('svg')).toBeNull()
  })

  it('closes through outside pointer input and Escape, restoring trigger focus', () => {
    act(() => root.render(<AccountMenu user={githubUser} surface="editor" onSignOut={vi.fn()} />))
    expect(container.querySelector('[data-surface="editor"]')).not.toBeNull()

    act(() => trigger().click())
    act(() => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })))
    expect(container.querySelector('[role="dialog"]')).toBeNull()

    act(() => trigger().click())
    expect(document.activeElement?.textContent).toContain('返回 Foliq 官网')
    act(() =>
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
    )
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(trigger())
  })

  it('shows real GitHub identity and signs out only from an explicit menu action', async () => {
    const onSignOut = vi.fn(async () => undefined)
    act(() => root.render(<AccountMenu user={githubUser} surface="home" onSignOut={onSignOut} />))
    act(() => trigger().click())

    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('GitHub 账户')
    expect(container.querySelector('a[href="/"]')?.textContent).toContain('返回 Foliq 官网')
    const signOut = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.includes('退出登录'),
    )
    await act(async () => signOut?.click())
    expect(onSignOut).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('routes the website action through the host navigation guard', () => {
    const onReturnHome = vi.fn()
    act(() =>
      root.render(<AccountMenu user={githubUser} surface="editor" onReturnHome={onReturnHome} />),
    )
    act(() => trigger().click())

    const returnHome = container.querySelector<HTMLAnchorElement>('a[href="/"]')!
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    act(() => returnHome.dispatchEvent(click))
    expect(click.defaultPrevented).toBe(true)
    expect(onReturnHome).toHaveBeenCalledTimes(1)
  })

  it('does not expose a meaningless sign-out action for development bypass identity', () => {
    act(() => root.render(<AccountMenu user={devUser} surface="home" onSignOut={vi.fn()} />))
    act(() => trigger().click())

    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('本地开发身份')
    expect(container.querySelector('[role="dialog"]')?.textContent).not.toContain('退出登录')
  })
})

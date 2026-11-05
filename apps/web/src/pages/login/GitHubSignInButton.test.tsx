import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const authMocks = vi.hoisted(() => ({ social: vi.fn() }))

vi.mock('../../auth/auth-client', () => ({
  authClient: { signIn: { social: authMocks.social } },
}))

import { GitHubSignInButton } from './GitHubSignInButton'

describe('GitHubSignInButton', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    authMocks.social.mockReset()
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it('renders one compact horizontal action and requests the workspace callback', async () => {
    authMocks.social.mockResolvedValue({})
    await act(async () => root.render(<GitHubSignInButton />))

    const button = container.querySelector<HTMLButtonElement>('button')!
    expect(button.textContent).toBe('使用 GitHub 登录')
    expect(button.querySelectorAll('svg')).toHaveLength(2)
    expect(button.querySelectorAll('span')).toHaveLength(1)

    await act(async () => button.click())
    expect(authMocks.social).toHaveBeenCalledWith({
      provider: 'github',
      callbackURL: `${window.location.origin}/app`,
    })
    expect(button.getAttribute('aria-busy')).toBe('true')
  })

  it('restores the action and shows an inline error when sign-in fails', async () => {
    authMocks.social.mockResolvedValue({ error: { message: 'OAuth unavailable' } })
    await act(async () => root.render(<GitHubSignInButton />))
    const button = container.querySelector<HTMLButtonElement>('button')!

    await act(async () => button.click())

    expect(button.disabled).toBe(false)
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('OAuth unavailable')
  })
})

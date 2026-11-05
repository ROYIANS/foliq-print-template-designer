import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const authMocks = vi.hoisted(() => ({ social: vi.fn(), signOut: vi.fn() }))

vi.mock('../../auth/auth-client', () => ({
  authClient: {
    signIn: { social: authMocks.social },
    signOut: authMocks.signOut,
  },
}))

import { LoginPage } from './LoginPage'

describe('LoginPage', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    authMocks.social.mockReset()
    authMocks.signOut.mockReset()
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it('uses the shared compact GitHub action for a signed-out normal deployment', async () => {
    await act(async () =>
      root.render(
        <LoginPage
          access={{ kind: 'signedOut' }}
          runtimeError={false}
          onEnterApp={vi.fn()}
          onRetry={vi.fn()}
        />,
      ),
    )

    const signIn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent === '使用 GitHub 登录',
    )
    expect(signIn).toBeDefined()
    expect(signIn?.querySelectorAll('svg')).toHaveLength(2)
  })

  it('lets an existing session enter the workspace explicitly', async () => {
    const onEnterApp = vi.fn()
    await act(async () =>
      root.render(
        <LoginPage
          access={{
            kind: 'allowed',
            user: {
              id: 'user-1',
              name: 'Foliq Tester',
              email: 'tester@example.com',
              image: null,
              authMode: 'github',
              isAdmin: false,
            },
          }}
          runtimeError={false}
          onEnterApp={onEnterApp}
          onRetry={vi.fn()}
        />,
      ),
    )

    const enter = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.includes('进入工作台'),
    )!
    await act(async () => enter.click())
    expect(onEnterApp).toHaveBeenCalledOnce()
  })

  it('offers a retry when anonymous runtime configuration is unavailable', async () => {
    const onRetry = vi.fn()
    await act(async () =>
      root.render(
        <LoginPage
          access={{ kind: 'signedOut' }}
          runtimeError
          onEnterApp={vi.fn()}
          onRetry={onRetry}
        />,
      ),
    )

    const retry = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.includes('重新连接'),
    )!
    await act(async () => retry.click())
    expect(onRetry).toHaveBeenCalledOnce()
  })
})

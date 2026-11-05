import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LandingPage } from './LandingPage'

class TestObserver {
  observe() {}
  disconnect() {}
}

describe('Landing page brand hero', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    vi.stubGlobal('IntersectionObserver', TestObserver)
    vi.stubGlobal('ResizeObserver', TestObserver)
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  it('uses one accessible Foliq wordmark as the hero title without the legacy P mark', async () => {
    await act(async () => {
      root.render(
        <LandingPage
          access={{
            kind: 'allowed',
            user: {
              id: 'user-1',
              name: 'Foliq Tester',
              email: 'foliq@example.test',
              image: null,
              authMode: 'dev-bypass',
              isAdmin: false,
            },
          }}
          onEnterApp={vi.fn()}
          onRetry={vi.fn()}
        />,
      )
    })

    const hero = container.querySelector('section[aria-labelledby="hero-title"]')
    const titles = container.querySelectorAll('h1')
    expect(hero).not.toBeNull()
    expect(titles).toHaveLength(1)
    expect(titles[0]?.id).toBe('hero-title')
    expect(titles[0]?.textContent?.trim()).toBe('Foliq')
    expect(titles[0]?.querySelector('pre[aria-hidden="true"]')).not.toBeNull()
    expect(hero?.textContent).toContain('不是设计一张图')
    expect(container.querySelector('[aria-label="Foliq 首页"] svg')).toBeNull()
    expect(container.querySelector('[aria-label="返回 Foliq 首页"] svg')).toBeNull()
    expect(container.querySelector('img[src*="ptd-mark"]')).toBeNull()
  })

  it('describes the current access, persistence, data and output capabilities', async () => {
    await act(async () => {
      root.render(
        <LandingPage
          access={{
            kind: 'allowed',
            user: {
              id: 'user-1',
              name: 'Foliq Tester',
              email: 'foliq@example.test',
              image: null,
              authMode: 'github',
              isAdmin: false,
            },
          }}
          onEnterApp={vi.fn()}
          onRetry={vi.fn()}
        />,
      )
    })

    expect(container.textContent).toContain(
      '版本历史、JSON 数据绑定、打印预览和服务端 PDF 已形成闭环',
    )
    expect(container.textContent).toContain('有效账户默认可以进入，各自的模板按 owner 隔离')
    expect(container.textContent).toContain('Word、批量输出、外部数据连接器、直接打印')
    expect(container.textContent).not.toContain('保存与版本流程仍在接入')
    expect(container.textContent).not.toContain('谁能登录、谁能看到什么，也由你自己的名单说了算')

    const collaborationQuestion = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button'),
    ).find((button) => button.textContent === '除了我自己，还能让同事一起用吗？')
    expect(collaborationQuestion).toBeDefined()
    await act(async () => collaborationQuestion?.click())
    expect(container.textContent).toContain('PTD_ADMIN_EMAILS 只用于识别管理员，不是登录白名单')
    expect(container.textContent).not.toContain('允许登录的名单')
  })
})

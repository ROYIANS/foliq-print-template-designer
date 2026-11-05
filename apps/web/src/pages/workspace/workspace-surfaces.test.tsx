import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HelpSheet } from './HelpSheet'
import { SaveAsSheet } from './SaveAsSheet'
import { DeleteTemplateDialog, RestoreVersionDialog, UnsavedDialog } from './WorkspaceDialogs'

describe('workspace decision surfaces', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it('uses a non-modal command sheet for Save As', async () => {
    const onConfirm = vi.fn()
    await act(async () => {
      root.render(
        <SaveAsSheet defaultValue="采购单 副本" onClose={vi.fn()} onConfirm={onConfirm} />,
      )
    })

    expect(container.querySelector('aside')).not.toBeNull()
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(container.textContent).not.toContain('DOCUMENT COMMAND')
    expect(container.querySelector('button[aria-label="关闭命名面板"] svg')).not.toBeNull()
    const input = container.querySelector<HTMLInputElement>('input')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
        input,
        '采购单 2026',
      )
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => container.querySelector<HTMLFormElement>('form')?.requestSubmit())
    expect(onConfirm).toHaveBeenCalledWith('采购单 2026')
  })

  it('reserves a blocking alert dialog for discarding dirty content', async () => {
    const onDiscard = vi.fn()
    await act(async () => {
      root.render(<UnsavedDialog action="home" onCancel={vi.fn()} onDiscard={onDiscard} />)
    })

    expect(container.querySelector('[role="alertdialog"]')).not.toBeNull()
    expect(container.textContent).not.toContain('UNSAVED CHANGES')
    const discard = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('丢弃并返回'),
    )
    await act(async () => discard?.click())
    expect(onDiscard).toHaveBeenCalledTimes(1)
  })

  it('uses accessible vector icons for help controls and decision warnings', async () => {
    await act(async () => {
      root.render(<HelpSheet view="shortcuts" onClose={vi.fn()} />)
    })
    const close = container.querySelector<HTMLButtonElement>('button[aria-label="关闭帮助面板"]')
    expect(close?.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    expect(close?.textContent).not.toContain('×')

    await act(async () => {
      root.render(<UnsavedDialog action="home" onCancel={vi.fn()} onDiscard={vi.fn()} />)
    })
    expect(container.querySelector('[role="alertdialog"] svg[aria-hidden="true"]')).not.toBeNull()
    expect(container.querySelector('[role="alertdialog"]')?.textContent).not.toContain('!')
  })

  it('uses the same discard protection before replacing content with imported JSON', async () => {
    const onDiscard = vi.fn()
    await act(async () => {
      root.render(<UnsavedDialog action="import" onCancel={vi.fn()} onDiscard={onDiscard} />)
    })

    expect(container.textContent).toContain('导入所选模板 JSON')
    const discard = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('丢弃并导入'),
    )
    await act(async () => discard?.click())
    expect(onDiscard).toHaveBeenCalledTimes(1)
  })

  it('keeps Save As errors visible and blocks editing, closing and duplicate submit while pending', async () => {
    const onClose = vi.fn()
    const onConfirm = vi.fn()
    await act(async () => {
      root.render(
        <SaveAsSheet
          defaultValue="采购单 副本"
          pending
          error="另存为失败，请检查网络后重试。"
          onClose={onClose}
          onConfirm={onConfirm}
        />,
      )
    })

    expect(container.querySelector('[role="alert"]')?.textContent).toContain('另存为失败')
    expect(container.querySelector<HTMLInputElement>('input')?.disabled).toBe(true)
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true)
    await act(async () => container.querySelector<HTMLFormElement>('form')?.requestSubmit())
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('keeps decision errors visible and prevents pending destructive or restore decisions', async () => {
    const onCancel = vi.fn()
    const onDelete = vi.fn()
    await act(async () => {
      root.render(
        <DeleteTemplateDialog
          title="采购单"
          pending
          error="删除未完成，请稍后重试。"
          onCancel={onCancel}
          onDelete={onDelete}
        />,
      )
    })

    expect(container.querySelector('[role="alert"]')?.textContent).toContain('删除未完成')
    expect(
      Array.from(container.querySelectorAll('button')).every((button) => button.disabled),
    ).toBe(true)
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
    expect(onCancel).not.toHaveBeenCalled()
    expect(onDelete).not.toHaveBeenCalled()

    const onRestore = vi.fn()
    await act(async () => {
      root.render(
        <RestoreVersionDialog
          version={2}
          hasUnsavedChanges={false}
          disabled
          error="服务器版本已变化"
          onCancel={vi.fn()}
          onRestore={onRestore}
        />,
      )
    })
    const restore = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent === '确认恢复',
    )
    expect(restore?.disabled).toBe(true)
    await act(async () => restore?.click())
    expect(onRestore).not.toHaveBeenCalled()
  })
})

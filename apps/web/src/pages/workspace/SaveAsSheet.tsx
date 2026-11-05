import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { RiCloseLine } from '@remixicon/react'
import styles from './SaveAsSheet.module.css'

interface SaveAsSheetProps {
  mode?: 'saveAs' | 'rename'
  defaultValue: string
  pending?: boolean
  error?: string
  onClose(): void
  onConfirm(title: string): void | Promise<void>
}

export function SaveAsSheet({
  mode = 'saveAs',
  defaultValue,
  pending = false,
  error,
  onClose,
  onConfirm,
}: SaveAsSheetProps) {
  const [title, setTitle] = useState(defaultValue)
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const onCloseRef = useRef(onClose)
  const pendingRef = useRef(pending)
  const submittingRef = useRef(false)
  const normalized = title.trim()
  const valid = normalized.length > 0 && normalized.length <= 120

  useEffect(() => {
    onCloseRef.current = onClose
    pendingRef.current = pending
  }, [onClose, pending])

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || pendingRef.current) return
      event.preventDefault()
      onCloseRef.current()
    }
    document.addEventListener('keydown', onKeyDown)
    inputRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previous?.focus()
    }
  }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!valid || pending || submittingRef.current) return
    submittingRef.current = true
    try {
      await onConfirm(normalized)
    } finally {
      submittingRef.current = false
    }
  }

  return (
    <aside
      className={styles.sheet}
      aria-labelledby={`${inputId}-title`}
      data-ptd-editor-interactive
    >
      <header>
        <h2 id={`${inputId}-title`}>{mode === 'rename' ? '重命名模板' : '另存为'}</h2>
        <button type="button" disabled={pending} onClick={onClose} aria-label="关闭命名面板">
          <RiCloseLine aria-hidden="true" />
        </button>
      </header>
      <p className={styles.description}>
        {mode === 'rename'
          ? '名称会同步到模板页面标题，并作为一个新的服务器版本保存。'
          : '创建一份独立服务器文档；当前模板和版本历史不会改变。'}
      </p>
      <form onSubmit={submit}>
        <label htmlFor={inputId}>{mode === 'rename' ? '模板名称' : '新模板名称'}</label>
        <span className={styles.inputShell}>
          <input
            ref={inputRef}
            id={inputId}
            value={title}
            maxLength={120}
            disabled={pending}
            autoComplete="off"
            onChange={(event) => setTitle(event.target.value)}
            aria-describedby={`${inputId}-hint${error ? ` ${inputId}-error` : ''}`}
          />
          <span>{title.length}/120</span>
        </span>
        <small id={`${inputId}-hint`} data-error={!valid || undefined}>
          {normalized ? '名称会同步为新模板的页面标题' : '请输入模板名称'}
        </small>
        {error ? (
          <small id={`${inputId}-error`} role="alert" data-error>
            {error}
          </small>
        ) : null}
        <footer>
          <button type="button" disabled={pending} onClick={onClose}>
            取消
          </button>
          <button type="submit" disabled={!valid || pending}>
            {pending ? '正在保存…' : mode === 'rename' ? '保存名称' : '创建副本'}
          </button>
        </footer>
      </form>
    </aside>
  )
}

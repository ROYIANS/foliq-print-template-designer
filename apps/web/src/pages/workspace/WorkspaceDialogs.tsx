import { useEffect, useId, useRef } from 'react'
import { RiErrorWarningLine } from '@remixicon/react'
import styles from './WorkspaceDialogs.module.css'

interface UnsavedDialogProps {
  action: 'new' | 'home' | 'import'
  onCancel(): void
  onDiscard(): void
}

interface DecisionDialogProps {
  title: string
  description: string
  cancelLabel: string
  confirmLabel: string
  danger?: boolean
  pending?: boolean
  error?: string
  confirmDisabled?: boolean
  onCancel(): void
  onConfirm(): void | Promise<void>
}

function DecisionDialog({
  title,
  description,
  cancelLabel,
  confirmLabel,
  danger = false,
  pending = false,
  error,
  confirmDisabled = false,
  onCancel,
  onConfirm,
}: DecisionDialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const onCancelRef = useRef(onCancel)
  const pendingRef = useRef(pending)
  const confirmingRef = useRef(false)

  useEffect(() => {
    onCancelRef.current = onCancel
    pendingRef.current = pending
  }, [onCancel, pending])

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pendingRef.current) {
        event.preventDefault()
        onCancelRef.current()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
      )
      const first = focusable[0]
      const last = focusable.at(-1)
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    cancelRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previous?.focus()
    }
  }, [])

  return (
    <div className={styles.backdrop} role="presentation">
      <section
        ref={dialogRef}
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={`${descriptionId}${error ? ` ${descriptionId}-error` : ''}`}
        aria-busy={pending || undefined}
      >
        <header>
          <h2 id={titleId}>{title}</h2>
        </header>
        <div className={styles.notice}>
          <RiErrorWarningLine className={styles.warningIcon} aria-hidden="true" />
          <p id={descriptionId}>{description}</p>
        </div>
        {error ? (
          <p id={`${descriptionId}-error`} className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <footer>
          <button ref={cancelRef} type="button" disabled={pending} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            data-danger={danger || undefined}
            data-primary
            disabled={pending || confirmDisabled}
            onClick={async () => {
              if (confirmingRef.current || pendingRef.current || confirmDisabled) return
              confirmingRef.current = true
              try {
                await onConfirm()
              } finally {
                confirmingRef.current = false
              }
            }}
          >
            {pending ? '正在处理…' : confirmLabel}
          </button>
        </footer>
      </section>
    </div>
  )
}

export function UnsavedDialog({ action, onCancel, onDiscard }: UnsavedDialogProps) {
  const target =
    action === 'new' ? '新建空白模板' : action === 'import' ? '导入所选模板 JSON' : '返回文件工作台'
  const confirmAction = action === 'new' ? '新建' : action === 'import' ? '导入' : '返回'
  return (
    <DecisionDialog
      title="要丢弃未保存的更改吗？"
      description={`当前设计包含未保存的更改。${target}会永久丢弃这些更改，但不会影响已保存的历史版本。`}
      cancelLabel="继续编辑"
      confirmLabel={`丢弃并${confirmAction}`}
      danger
      onCancel={onCancel}
      onConfirm={onDiscard}
    />
  )
}

export function RestoreVersionDialog({
  version,
  hasUnsavedChanges,
  pending = false,
  error,
  disabled = false,
  onCancel,
  onRestore,
}: {
  version: number
  hasUnsavedChanges: boolean
  pending?: boolean
  error?: string
  disabled?: boolean
  onCancel(): void
  onRestore(): void | Promise<void>
}) {
  return (
    <DecisionDialog
      title={`恢复版本 ${version}？`}
      description={`该历史快照会被保存为一个新的最新版本，现有历史不会被删除。${hasUnsavedChanges ? '当前未保存的画布更改将被替换。' : ''}`}
      cancelLabel="取消"
      confirmLabel="确认恢复"
      pending={pending}
      error={error}
      confirmDisabled={disabled}
      onCancel={onCancel}
      onConfirm={onRestore}
    />
  )
}

export function DeleteTemplateDialog({
  title,
  pending = false,
  error,
  onCancel,
  onDelete,
}: {
  title: string
  pending?: boolean
  error?: string
  onCancel(): void
  onDelete(): void | Promise<void>
}) {
  return (
    <DecisionDialog
      title={`永久删除“${title}”？`}
      description="模板及其全部历史版本都会被永久删除，此操作无法撤销。"
      cancelLabel="取消"
      confirmLabel="永久删除"
      danger
      pending={pending}
      error={error}
      onCancel={onCancel}
      onConfirm={onDelete}
    />
  )
}

import { useEffect, useId, useRef } from 'react'
import { RiCloseLine } from '@remixicon/react'
import styles from './HelpSheet.module.css'

export type HelpSheetView = 'shortcuts' | 'about'

interface HelpSheetProps {
  view: HelpSheetView
  onClose(): void
}

const SHORTCUTS = [
  ['保存模板', 'Ctrl / ⌘ + S'],
  ['新建模板', 'Ctrl / ⌘ + N'],
  ['打开文件工作台', 'Ctrl / ⌘ + O'],
  ['另存为', 'Ctrl / ⌘ + Shift + S'],
  ['撤销 / 重做', 'Ctrl / ⌘ + Z / Shift + Z'],
  ['复制 / 粘贴', 'Ctrl / ⌘ + C / V'],
  ['组合 / 拆分', 'Ctrl / ⌘ + G / Shift + G'],
  ['显示标尺', 'Ctrl / ⌘ + R'],
] as const

export function HelpSheet({ view, onClose }: HelpSheetProps) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    closeRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previous?.focus()
    }
  }, [onClose])

  return (
    <aside className={styles.sheet} aria-labelledby={titleId} data-ptd-editor-interactive>
      <header>
        <h2 id={titleId}>
          {view === 'shortcuts' ? (
            '快捷键'
          ) : (
            <>
              关于 <span className={styles.brandWord}>Foliq</span>
            </>
          )}
        </h2>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="关闭帮助面板">
          <RiCloseLine aria-hidden="true" />
        </button>
      </header>
      {view === 'shortcuts' ? (
        <dl className={styles.shortcuts}>
          {SHORTCUTS.map(([label, shortcut]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{shortcut}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className={styles.about}>
          <strong className={styles.brandWord}>Foliq</strong>
          <p>面向结构化文档与打印模板的专业 Web 设计器。</p>
          <dl>
            <div>
              <dt>版本</dt>
              <dd>0.1.0</dd>
            </div>
            <div>
              <dt>许可</dt>
              <dd>MIT</dd>
            </div>
          </dl>
        </div>
      )}
    </aside>
  )
}

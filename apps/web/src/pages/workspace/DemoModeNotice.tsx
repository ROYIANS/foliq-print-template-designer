import { useState } from 'react'
import { RiCloseLine, RiGithubFill, RiRefreshLine } from '@remixicon/react'
import styles from './DemoModeNotice.module.css'

const REPOSITORY_URL = 'https://github.com/ROYIANS/foliq-print-template-designer'
const COMPACT_DISMISSED_KEY = 'foliq.demo-notice-dismissed'

function compactNoticeDismissed(): boolean {
  try {
    return window.sessionStorage.getItem(COMPACT_DISMISSED_KEY) === 'true'
  } catch {
    return false
  }
}

export function DemoModeNotice({ compact = false }: { compact?: boolean }) {
  const [dismissed, setDismissed] = useState(() => compact && compactNoticeDismissed())
  if (compact && dismissed) return null

  const dismiss = () => {
    try {
      window.sessionStorage.setItem(COMPACT_DISMISSED_KEY, 'true')
    } catch {
      // The notice still closes for this mount when browser storage is unavailable.
    }
    setDismissed(true)
  }

  return (
    <aside className={styles.notice} data-compact={compact} aria-label="演示环境说明">
      <RiRefreshLine className={styles.resetIcon} aria-hidden="true" />
      <div>
        <strong>当前为演示环境</strong>
        <span>访客模板每日 08:00（北京时间）恢复为示例数据，管理员内容不受影响。</span>
      </div>
      {!compact ? (
        <a href={REPOSITORY_URL} target="_blank" rel="noreferrer">
          <RiGithubFill aria-hidden="true" />在 GitHub Fork
        </a>
      ) : (
        <button type="button" aria-label="关闭演示环境提示" onClick={dismiss}>
          <RiCloseLine aria-hidden="true" />
        </button>
      )}
    </aside>
  )
}

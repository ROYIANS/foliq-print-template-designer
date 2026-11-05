import { useEffect, useId, useRef, useState } from 'react'
import { RiArrowDownSLine } from '@remixicon/react'
import type { AccountUser } from '../landing/LandingPage'
import styles from './AccountMenu.module.css'

interface AccountMenuProps {
  user: AccountUser
  surface: 'home' | 'editor'
  onReturnHome?: () => void
  onSignOut?: () => void | Promise<void>
}

export function AccountMenu({ user, surface, onReturnHome, onSignOut }: AccountMenuProps) {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const firstActionRef = useRef<HTMLAnchorElement>(null)
  const focusMenuOnOpenRef = useRef(false)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    if (focusMenuOnOpenRef.current) firstActionRef.current?.focus()
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const identityLabel = user.authMode === 'github' ? 'GitHub 账户' : '本地开发身份'

  return (
    <div ref={rootRef} className={styles.account} data-surface={surface}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-controls={menuId}
        aria-expanded={open}
        aria-label={`账户菜单，${user.name}`}
        onClick={(event) => {
          focusMenuOnOpenRef.current = event.detail === 0
          setOpen((value) => !value)
        }}
      >
        <span className={styles.avatar} aria-hidden="true">
          {user.image ? <img src={user.image} alt="" /> : user.name.slice(0, 1)}
        </span>
        {surface === 'home' ? (
          <>
            <span className={styles.triggerName}>{user.name}</span>
            <RiArrowDownSLine className={styles.chevron} aria-hidden="true" />
          </>
        ) : null}
      </button>

      {open ? (
        <div id={menuId} className={styles.popover} role="dialog" aria-label="账户信息与操作">
          <header>
            <span className={styles.avatar} aria-hidden="true">
              {user.image ? <img src={user.image} alt="" /> : user.name.slice(0, 1)}
            </span>
            <div>
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>
          </header>
          <p className={styles.identity}>
            <span aria-hidden="true" />
            {identityLabel}
          </p>
          <div className={styles.actions}>
            <a
              ref={firstActionRef}
              href="/"
              onClick={(event) => {
                setOpen(false)
                if (!onReturnHome) return
                event.preventDefault()
                onReturnHome()
              }}
            >
              返回 Foliq 官网
            </a>
            {user.authMode === 'github' && onSignOut ? (
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  void onSignOut()
                }}
              >
                退出登录
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

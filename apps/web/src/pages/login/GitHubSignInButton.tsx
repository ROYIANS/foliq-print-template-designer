import { useState } from 'react'
import { RiArrowRightLine, RiGithubFill } from '@remixicon/react'
import { authClient } from '../../auth/auth-client'
import styles from './GitHubSignInButton.module.css'

export function GitHubSignInButton({ callbackURL = '/app' }: { callbackURL?: string }) {
  const [signingIn, setSigningIn] = useState(false)
  const [message, setMessage] = useState<string>()

  const signIn = async () => {
    setSigningIn(true)
    setMessage(undefined)
    try {
      const result = await authClient.signIn.social({
        provider: 'github',
        callbackURL: `${window.location.origin}${callbackURL}`,
      })
      if (!result.error) return
      setMessage(result.error.message ?? 'GitHub 登录没有完成，请重试。')
      setSigningIn(false)
    } catch {
      setMessage('暂时无法连接 GitHub，请稍后重试。')
      setSigningIn(false)
    }
  }

  return (
    <div className={styles.root}>
      <button
        type="button"
        aria-busy={signingIn}
        disabled={signingIn}
        onClick={() => void signIn()}
      >
        <RiGithubFill aria-hidden="true" />
        <span>{signingIn ? '正在前往 GitHub…' : '使用 GitHub 登录'}</span>
        <RiArrowRightLine aria-hidden="true" />
      </button>
      <p>HttpOnly Cookie · 服务端会话 · 浏览器不保存 Token</p>
      {message ? (
        <p className={styles.error} role="alert">
          {message}
        </p>
      ) : null}
    </div>
  )
}

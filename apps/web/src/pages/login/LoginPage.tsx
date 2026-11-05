import { RiArrowRightLine, RiRefreshLine } from '@remixicon/react'
import { authClient } from '../../auth/auth-client'
import { GitHubSignInButton } from './GitHubSignInButton'
import type { AccessState } from '../landing/LandingPage'
import styles from './LoginPage.module.css'

export function LoginPage({
  access,
  runtimeError,
  onEnterApp,
  onRetry,
}: {
  access: AccessState
  runtimeError: boolean
  onEnterApp(): void
  onRetry(): void
}) {
  const signOut = async () => {
    await authClient.signOut()
    onRetry()
  }

  return (
    <main className={styles.page}>
      <section className={styles.login} aria-labelledby="login-title">
        <a className={styles.brand} href="/" aria-label="Foliq 首页">
          Foliq
        </a>
        <div className={styles.copy}>
          <p>结构化文档设计器</p>
          <h1 id="login-title">进入你的文档工作台</h1>
          <span>使用 GitHub 身份建立安全的服务端会话。</span>
        </div>

        {access.kind === 'allowed' ? (
          <div className={styles.ready}>
            <p>{access.user.name}</p>
            <span>{access.user.email}</span>
            <button type="button" onClick={onEnterApp}>
              进入工作台
              <RiArrowRightLine aria-hidden="true" />
            </button>
            {access.user.authMode === 'github' ? (
              <button type="button" className={styles.signOut} onClick={() => void signOut()}>
                更换 GitHub 账户
              </button>
            ) : null}
          </div>
        ) : access.kind === 'checking' ? (
          <p className={styles.status} role="status">
            正在检查登录状态…
          </p>
        ) : access.kind === 'error' || runtimeError ? (
          <div className={styles.failure} role="alert">
            <p>暂时无法连接工作台服务。</p>
            <button type="button" onClick={onRetry}>
              <RiRefreshLine aria-hidden="true" />
              重新连接
            </button>
          </div>
        ) : (
          <GitHubSignInButton />
        )}
      </section>
      <p className={styles.footer}>不是设计一张图，而是定义一种文档。</p>
    </main>
  )
}

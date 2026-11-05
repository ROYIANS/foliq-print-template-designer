export type AppRoute = 'landing' | 'workspace'
export type DocumentSurface = 'design' | 'preview'

export type WorkspaceView =
  | { kind: 'home' }
  | { kind: 'new'; surface: DocumentSurface }
  | { kind: 'template'; surface: DocumentSurface; templateKey: string; slug: string }
  | { kind: 'legacy-template'; templateId: number }
  | { kind: 'invalid-template' }

export type LandingNotice =
  'auth-required' | 'access-denied' | 'session-expired' | 'sign-in-failed' | 'unavailable'

const TEMPLATE_KEY_PATTERN = /^[A-Za-z0-9_-]{8,64}$/

export function routeFromPathname(pathname: string): AppRoute {
  return pathname === '/app' ||
    pathname.startsWith('/app/') ||
    pathname === '/design' ||
    pathname.startsWith('/design/') ||
    pathname === '/preview' ||
    pathname.startsWith('/preview/')
    ? 'workspace'
    : 'landing'
}

function legacyWorkspaceView(search: string): WorkspaceView {
  const parameters = new URLSearchParams(search)
  const rawTemplateId = parameters.get('template')
  if (rawTemplateId !== null) {
    if (!/^[1-9]\d*$/.test(rawTemplateId)) return { kind: 'invalid-template' }
    const templateId = Number(rawTemplateId)
    if (!Number.isSafeInteger(templateId) || templateId > 2_147_483_647) {
      return { kind: 'invalid-template' }
    }
    return { kind: 'legacy-template', templateId }
  }
  if (parameters.get('new') === 'blank') return { kind: 'new', surface: 'design' }
  return { kind: 'home' }
}

function decodedSegment(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  try {
    return decodeURIComponent(value)
  } catch {
    return undefined
  }
}

export function workspaceViewFromLocation(pathname: string, search: string): WorkspaceView {
  if (pathname === '/app' || pathname.startsWith('/app/')) return legacyWorkspaceView(search)

  const segments = pathname.split('/').filter(Boolean)
  const surface = segments[0]
  if ((surface !== 'design' && surface !== 'preview') || segments.length < 2) {
    return { kind: 'invalid-template' }
  }
  if (segments.length === 2 && segments[1] === 'new') return { kind: 'new', surface }
  if (segments.length > 3) return { kind: 'invalid-template' }

  const templateKey = segments[1]
  const slug = decodedSegment(segments[2] ?? '')
  if (!templateKey || !TEMPLATE_KEY_PATTERN.test(templateKey) || slug === undefined) {
    return { kind: 'invalid-template' }
  }
  return { kind: 'template', surface, templateKey, slug }
}

export function workspaceViewFromSearch(search: string): WorkspaceView {
  return legacyWorkspaceView(search)
}

export function templateSlug(title: string): string {
  const slug = title
    .normalize('NFKC')
    .trim()
    .replace(/[\s/\\]+/g, '-')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '')
  return [...slug].slice(0, 64).join('') || 'untitled'
}

export function documentUrl(surface: DocumentSurface, key: string, title: string): string {
  return `/${surface}/${encodeURIComponent(key)}/${encodeURIComponent(templateSlug(title))}`
}

export function newDocumentUrl(surface: DocumentSurface): string {
  return `/${surface}/new`
}

export function isProductCaptureSearch(search: string, development: boolean): boolean {
  return development && new URLSearchParams(search).get('capture') === 'product'
}

export function landingNoticeFromSearch(search: string): LandingNotice | undefined {
  const parameters = new URLSearchParams(search)
  if (parameters.has('error') || parameters.has('error_description')) return 'sign-in-failed'
  const value = parameters.get('notice')
  switch (value) {
    case 'auth-required':
    case 'access-denied':
    case 'session-expired':
    case 'sign-in-failed':
    case 'unavailable':
      return value
    default:
      return undefined
  }
}

export function landingUrl(notice?: LandingNotice): string {
  return notice ? `/?notice=${notice}` : '/'
}

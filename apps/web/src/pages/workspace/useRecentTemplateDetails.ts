import { useEffect, useState } from 'react'
import type { TemplateApi, TemplateRecord } from '../../api/templateApi'

export const MAX_RECENT_TEMPLATE_PREVIEWS = 4

export type RecentTemplateDetailState =
  | { kind: 'loading' }
  | { kind: 'ready'; template: TemplateRecord }
  | { kind: 'error'; message: string }

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function detailErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return '无法读取模板内容。'
}

export function useRecentTemplateDetails(
  api: TemplateApi,
  recentIds: readonly number[],
  retryToken = 0,
): ReadonlyMap<number, RecentTemplateDetailState> {
  const [details, setDetails] = useState<ReadonlyMap<number, RecentTemplateDetailState>>(new Map())

  useEffect(() => {
    const boundedIds = recentIds.slice(0, MAX_RECENT_TEMPLATE_PREVIEWS)
    const controller = new AbortController()
    let active = true

    void Promise.resolve().then(() => {
      if (active) {
        setDetails(new Map(boundedIds.map((id) => [id, { kind: 'loading' } as const])))
      }
    })

    for (const id of boundedIds) {
      void Promise.resolve()
        .then(() => {
          if (!active || controller.signal.aborted) return undefined
          return api.get(id, controller.signal)
        })
        .then((template) => {
          if (!active || !template) return
          setDetails((current) => {
            const next = new Map(current)
            next.set(id, { kind: 'ready', template })
            return next
          })
        })
        .catch((error: unknown) => {
          if (!active || isAbortError(error)) return
          setDetails((current) => {
            const next = new Map(current)
            next.set(id, { kind: 'error', message: detailErrorMessage(error) })
            return next
          })
        })
    }

    return () => {
      active = false
      controller.abort()
    }
  }, [api, recentIds, retryToken])

  return details
}

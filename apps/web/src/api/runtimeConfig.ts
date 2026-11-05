import { useCallback, useEffect, useState } from 'react'

export interface RuntimeConfig {
  demoMode: boolean
  demoResetTime: string
}

type RuntimeConfigState =
  { kind: 'checking' } | { kind: 'ready'; config: RuntimeConfig } | { kind: 'error' }

export function parseRuntimeConfig(value: unknown): RuntimeConfig {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Runtime config must be an object')
  }
  const record = value as Record<string, unknown>
  if (typeof record['demoMode'] !== 'boolean' || typeof record['demoResetTime'] !== 'string') {
    throw new Error('Runtime config is missing required fields')
  }
  return { demoMode: record['demoMode'], demoResetTime: record['demoResetTime'] }
}

export function useRuntimeConfig() {
  const [retryToken, setRetryToken] = useState(0)
  const [state, setState] = useState<RuntimeConfigState>({ kind: 'checking' })

  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/runtime', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Runtime config request failed: ${response.status}`)
        setState({ kind: 'ready', config: parseRuntimeConfig(await response.json()) })
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError'))
          setState({ kind: 'error' })
      })
    return () => controller.abort()
  }, [retryToken])

  const retry = useCallback(() => {
    setState({ kind: 'checking' })
    setRetryToken((value) => value + 1)
  }, [])

  return { state, retry }
}

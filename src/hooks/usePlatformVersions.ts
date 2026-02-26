import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'

export interface PlatformVersion {
  platform: string
  installed: boolean
  version: string | null
}

export function usePlatformVersions() {
  const [versions, setVersions] = useState<PlatformVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchVersions = async () => {
      try {
        setLoading(true)
        const result = await invoke<PlatformVersion[]>('get_platform_versions')
        setVersions(result)
        setError(null)
      } catch (err) {
        console.error('Failed to fetch platform versions:', err)
        setError(err as string)
      } finally {
        setLoading(false)
      }
    }

    fetchVersions()
  }, [])

  return { versions, loading, error }
}

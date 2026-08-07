import { useCallback, useEffect, useState } from 'react'
import { db } from '../db/db'

type DbStatus =
  | { state: 'checking' }
  | { state: 'connected'; noteCount: number }
  | { state: 'error'; message: string }

export function useDbStatus() {
  const [status, setStatus] = useState<DbStatus>({ state: 'checking' })

  const refresh = useCallback(() => {
    db.notes
      .count()
      .then((noteCount) => setStatus({ state: 'connected', noteCount }))
      .catch((error: unknown) => {
        setStatus({
          state: 'error',
          message: error instanceof Error ? error.message : String(error),
        })
      })
  }, [])

  useEffect(() => {
    let cancelled = false

    db.open()
      .then(() => db.notes.count())
      .then((noteCount) => {
        if (!cancelled) setStatus({ state: 'connected', noteCount })
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setStatus({
            state: 'error',
            message: error instanceof Error ? error.message : String(error),
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { status, refresh }
}

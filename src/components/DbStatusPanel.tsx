import { db } from '../db/db'
import { useDbStatus } from '../hooks/useDbStatus'

export function DbStatusPanel() {
  const { status, refresh } = useDbStatus()

  const addTestNote = async () => {
    const now = new Date()
    await db.notes.add({
      title: `Test note ${now.toLocaleTimeString()}`,
      content: 'Created to confirm Dexie reads/writes work.',
      createdAt: now,
      updatedAt: now,
    })
    refresh()
  }

  const clearNotes = async () => {
    await db.notes.clear()
    refresh()
  }

  return (
    <div className="db-status-panel">
      <h1>Noter</h1>
      <p>This is a scaffold checkpoint, not the notes app yet.</p>

      {status.state === 'checking' && <p>Connecting to IndexedDB…</p>}

      {status.state === 'error' && (
        <p className="db-status-panel__error">Failed to connect: {status.message}</p>
      )}

      {status.state === 'connected' && (
        <>
          <p>
            Connected to Dexie database <code>NoterDatabase</code>. Notes table has{' '}
            <strong>{status.noteCount}</strong> row(s).
          </p>
          <div className="db-status-panel__actions">
            <button type="button" onClick={addTestNote}>
              Add test note
            </button>
            <button type="button" onClick={clearNotes}>
              Clear notes
            </button>
          </div>
        </>
      )}
    </div>
  )
}

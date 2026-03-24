import { useCallback, useEffect, useRef, useState } from 'react'
import { hasSupabaseConfig, supabase } from '../../Api/supabase'
import './testRealtime.css'
function TestRealtime() {
  const [testInput, setTestInput] = useState('')
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('disconnected')
  const [isLoading, setIsLoading] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')
  const [lastRealtimeLag, setLastRealtimeLag] = useState(null)
  const pendingInsertAtRef = useRef(null)

  const loadRows = useCallback(async () => {
    if (!supabase) return

    const { data, error: fetchError } = await supabase
      .from('pruebas')
      .select('id, test, created_at')
      .order('id', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      return
    }

    setRows(data ?? [])
    setError('')
  }, [])

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) return undefined

    loadRows()

    const channel = supabase
      .channel('realtime-pruebas')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pruebas' },
        (payload) => {
          setRows((currentRows) => {
            if (payload.eventType === 'INSERT') {
              if (pendingInsertAtRef.current) {
                setLastRealtimeLag(Date.now() - pendingInsertAtRef.current)
                pendingInsertAtRef.current = null
              }
              if (currentRows.some((row) => row.id === payload.new.id)) return currentRows
              return [payload.new, ...currentRows]
            }
            if (payload.eventType === 'UPDATE') {
              return currentRows.map((row) =>
                row.id === payload.new.id ? payload.new : row
              )
            }
            if (payload.eventType === 'DELETE') {
              return currentRows.filter((row) => row.id !== payload.old.id)
            }
            return currentRows
          })
        }
      )
      .subscribe((channelStatus) => {
        setStatus(channelStatus)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadRows])

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase || status === 'SUBSCRIBED') return undefined
    const intervalId = setInterval(() => { loadRows() }, 2500)
    return () => clearInterval(intervalId)
  }, [status, loadRows])

  const handleAddTest = async (event) => {
    event.preventDefault()
    const cleanValue = testInput.trim()
    if (!cleanValue || !supabase) return

    setIsLoading(true)
    setError('')
    pendingInsertAtRef.current = Date.now()

    const { data: insertedRow, error: insertError } = await supabase
      .from('pruebas')
      .insert({ test: cleanValue })
      .select('id, test, created_at')
      .single()

    setIsLoading(false)
    if (insertError) {
      pendingInsertAtRef.current = null
      setError(insertError.message)
      return
    }
    setTestInput('')
    if (insertedRow) {
      setRows((currentRows) => {
        if (currentRows.some((row) => row.id === insertedRow.id)) return currentRows
        return [insertedRow, ...currentRows]
      })
    }
  }

  const handleDeleteTest = async (id) => {
    if (!supabase || deletingId !== null) return
    setDeletingId(id)
    setError('')
    const previousRows = rows
    setRows((currentRows) => currentRows.filter((row) => row.id !== id))

    const { error: deleteError } = await supabase
      .from('pruebas')
      .delete()
      .eq('id', id)

    setDeletingId(null)
    if (deleteError) {
      setRows(previousRows)
      setError(deleteError.message)
    }
  }

  return (
    <main className="app-shell">
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Supabase Realtime: pruebas</h1>
          <p>Inserta valores y observa los cambios en vivo.</p>
        </div>
        <button 
          onClick={() => supabase.auth.signOut()} 
          className="danger-btn"
          style={{ padding: '10px 20px' }}
        >
          Cerrar Sesión
        </button>
      </header>

      {!hasSupabaseConfig ? (
        <section className="card warning">
          <h2>Falta configuración</h2>
          <p>Revisa tu archivo .env</p>
        </section>
      ) : (
        <>
          <section className="card">
            <form onSubmit={handleAddTest} className="form-row">
              <input
                type="text"
                value={testInput}
                onChange={(event) => setTestInput(event.target.value)}
                placeholder="Escribe un test..."
                maxLength={140}
              />
              <button type="submit" disabled={isLoading || !testInput.trim()}>
                {isLoading ? 'Guardando...' : 'Insertar'}
              </button>
            </form>

            <div className="stats">
              <span>Estado realtime: <strong>{status}</strong></span>
              <span>Filas cargadas: <strong>{rows.length}</strong></span>
              <span>Latencia: <strong>{lastRealtimeLag ?? '-'} ms</strong></span>
            </div>
            {error ? <p className="error">Error: {error}</p> : null}
          </section>

          <section className="card">
            <h2>Eventos en tabla pruebas</h2>
            <ul className="rows-list">
              {rows.map((row) => (
                <li key={row.id}>
                  <div className="row-head">
                    <p>{row.test}</p>
                    <button
                      className="danger-btn"
                      onClick={() => handleDeleteTest(row.id)}
                      disabled={deletingId === row.id}
                    >
                      {deletingId === row.id ? 'Eliminando...' : 'Eliminar'}
                    </button>
                  </div>
                  <small>id: {row.id} | {new Date(row.created_at).toLocaleString()}</small>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  )
}

export default TestRealtime
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import DashboardHeader from '../components/common/DashboardHeader'
import StrictExamAdminPanel from '../components/StrictExamAdminPanel'
import { supabase } from '../lib/supabase'

export default function StrictControlPage() {
  const navigate = useNavigate()
  const { public_id } = useParams()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formRecord, setFormRecord] = useState(null)
  const [userEmail, setUserEmail] = useState('')
  const [userName, setUserName] = useState('')

  useEffect(() => {
    const loadStrictForm = async () => {
      if (!public_id) {
        setError('No se encontro el formulario.')
        setLoading(false)
        return
      }

      try {
        const { data: authData } = await supabase.auth.getUser()
        const authUser = authData?.user
        if (authUser?.email) {
          setUserEmail(authUser.email)
          setUserName(authUser.user_metadata?.full_name || authUser.user_metadata?.name || '')
        }

        const { data, error: formError } = await supabase
          .from('forms')
          .select('id, title, description, form_mode')
          .eq('public_id', public_id)
          .single()

        if (formError) throw formError
        if (String(data?.form_mode || '') !== 'strict') {
          setError('Este formulario no esta en modo estricto.')
          setLoading(false)
          return
        }

        setFormRecord(data)
      } catch (err) {
        setError(err.message || 'No se pudo abrir el panel estricto.')
      } finally {
        setLoading(false)
      }
    }

    loadStrictForm()
  }, [public_id])

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-slate-100">
        <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-4">
          <p className="text-sm text-slate-300">Cargando panel estricto...</p>
        </div>
      </main>
    )
  }

  if (error || !formRecord?.id) {
    return (
      <main className="min-h-screen bg-black text-slate-100">
        <div className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="text-sm text-rose-200">{error || 'No se encontro el formulario.'}</p>
          <button
            type="button"
            onClick={() => navigate(`/form/${public_id}/edit`)}
            className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
          >
            Volver al editor
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-black text-slate-100">
      <DashboardHeader email={userEmail} name={userName} showSearch={false} />
      <StrictExamAdminPanel
        formId={formRecord.id}
        publicId={public_id}
        formTitle={formRecord.title}
        formDescription={formRecord.description}
        onClose={() => navigate(`/form/${public_id}/edit`)}
      />
    </main>
  )
}

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function FormAnswersPage() {
  const { public_id } = useParams();
  const [form, setForm] = useState(null);
  const [blockedByQuizMode, setBlockedByQuizMode] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      // Obtener el formulario por public_id
      const { data: formData } = await supabase
        .from('forms')
        .select('id, title, description, form_mode')
        .eq('public_id', public_id)
        .single();
      if (!formData) {
        setLoading(false);
        return;
      }

      if (String(formData.form_mode || '').toLowerCase() === 'quiz') {
        setBlockedByQuizMode(true);
        setLoading(false);
        return;
      }

      setForm(formData);
      // Obtener preguntas
      const { data: questionsData } = await supabase
        .from('form_questions')
        .select('id, title, type')
        .eq('form_id', formData.id)
        .order('position', { ascending: true });
      setQuestions(questionsData || []);
      // Obtener envíos
      const { data: submissionsData } = await supabase
        .from('form_submissions')
        .select('id, respondent_email, respondent_user_id, started_at, submitted_at')
        .eq('form_id', formData.id)
        .order('submitted_at', { ascending: false });
      setSubmissions(submissionsData || []);
      setLoading(false);
    }
    fetchData();
  }, [public_id]);

  if (loading) return <div className="p-8 text-center">Cargando...</div>;
  if (blockedByQuizMode) return <div className="p-8 text-center">Las respuestas no estan disponibles para formularios tipo quiz.</div>;
  if (!form) return <div className="p-8 text-center">Formulario no encontrado</div>;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-2">Respuestas de: {form.title}</h1>
      <p className="mb-6 text-gray-600">{form.description}</p>
      <table className="w-full border text-sm mb-8">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border">#</th>
            <th className="p-2 border">Usuario/Email</th>
            <th className="p-2 border">Fecha envío</th>
            <th className="p-2 border">Ver detalle</th>
          </tr>
        </thead>
        <tbody>
          {submissions.map((s, idx) => (
            <tr key={s.id} className="odd:bg-gray-50">
              <td className="p-2 border">{idx + 1}</td>
              <td className="p-2 border">{s.respondent_email || s.respondent_user_id || 'Anónimo'}</td>
              <td className="p-2 border">{s.submitted_at ? new Date(s.submitted_at).toLocaleString() : '-'}</td>
              <td className="p-2 border">
                <a href={`/form/${public_id}/respuestas/${s.id}`} className="text-blue-600 underline">Ver</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {submissions.length === 0 && <div className="text-center text-gray-500">No hay respuestas aún.</div>}
    </div>
  );
}

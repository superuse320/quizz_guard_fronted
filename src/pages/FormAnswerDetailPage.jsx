import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function FormAnswerDetailPage() {
  const { public_id, submission_id } = useParams();
  const [form, setForm] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [options, setOptions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      // Obtener el formulario
      const { data: formData } = await supabase
        .from('forms')
        .select('id, title, description')
        .eq('public_id', public_id)
        .single();
      if (!formData) {
        setLoading(false);
        return;
      }
      setForm(formData);
      // Obtener preguntas
      const { data: questionsData } = await supabase
        .from('form_questions')
        .select('id, title, type, description')
        .eq('form_id', formData.id)
        .order('position', { ascending: true });
      setQuestions(questionsData || []);
      // Obtener opciones
      const { data: optionsData } = await supabase
        .from('form_question_options')
        .select('*');
      setOptions(optionsData || []);
      // Obtener submission
      const { data: submissionData } = await supabase
        .from('form_submissions')
        .select('id, respondent_email, respondent_user_id, started_at, submitted_at')
        .eq('id', submission_id)
        .single();
      setSubmission(submissionData);
      // Obtener respuestas
      const { data: answersData } = await supabase
        .from('form_submission_answers')
        .select('question_id, answer_value, is_correct, points_earned')
        .eq('submission_id', submission_id);
      setAnswers(answersData || []);
      setLoading(false);
    }
    fetchData();
  }, [public_id, submission_id]);

  if (loading) return <div className="p-8 text-center">Cargando...</div>;
  if (!form || !submission) return <div className="p-8 text-center">No encontrado</div>;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <Link to={`/form/${public_id}/respuestas`} className="text-blue-600 underline">← Volver a respuestas</Link>
      <h1 className="text-2xl font-bold mb-2 mt-4">Detalle de respuesta</h1>
      <div className="mb-4 text-gray-600">{form.title}</div>
      <div className="mb-4 text-sm text-gray-500">Respondido por: {submission.respondent_email || submission.respondent_user_id || 'Anónimo'}<br/>Enviado: {submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : '-'}</div>
      <div className="space-y-6">
        {questions.map(q => {
          const ans = answers.find(a => a.question_id === q.id);
          let val = ans ? ans.answer_value : null;
          try { if (typeof val === 'string') val = JSON.parse(val); } catch {}
          // Opciones de la pregunta (si aplica)
          const qOptions = options.filter(opt => opt.question_id === q.id).sort((a, b) => a.position - b.position);
          // Renderizado de opciones seleccionadas
          const renderOptions = () => {
            if (['multiple_choice', 'dropdown'].includes(q.type)) {
              return (
                <div className="mt-2 flex flex-col gap-1">
                  {qOptions.map((opt, idx) => {
                    const selected = val === idx;
                    return (
                      <div key={opt.id} className={`px-3 py-2 rounded border ${selected ? 'bg-blue-100 border-blue-400 font-semibold' : 'bg-white border-gray-200'}`}>{opt.label || `Opción ${idx + 1}`}{selected && <span className="ml-2 text-blue-700">✓</span>}</div>
                    );
                  })}
                </div>
              );
            }
            if (q.type === 'checkboxes') {
              return (
                <div className="mt-2 flex flex-col gap-1">
                  {qOptions.map((opt, idx) => {
                    const selected = Array.isArray(val) && val.includes(idx);
                    return (
                      <div key={opt.id} className={`px-3 py-2 rounded border ${selected ? 'bg-emerald-100 border-emerald-400 font-semibold' : 'bg-white border-gray-200'}`}>{opt.label || `Opción ${idx + 1}`}{selected && <span className="ml-2 text-emerald-700">✓</span>}</div>
                    );
                  })}
                </div>
              );
            }
            if (q.type === 'ranking') {
              // val es un array de índices
              return (
                <div className="mt-2 flex flex-col gap-1">
                  {Array.isArray(val) && val.map((optIdx, pos) => {
                    const opt = qOptions[optIdx];
                    return (
                      <div key={opt?.id || pos} className="px-3 py-2 rounded border bg-purple-50 border-purple-300 flex items-center gap-2">
                        <span className="w-6 text-xs text-gray-500">{pos + 1}</span>
                        <span>{opt?.label || `Opción ${optIdx + 1}`}</span>
                      </div>
                    );
                  })}
                </div>
              );
            }
            return null;
          };
          return (
            <div key={q.id} className="p-4 border rounded-xl bg-gray-50">
              <div className="font-semibold mb-1">{q.title}</div>
              <div className="text-xs text-gray-500 mb-2">{q.description}</div>
              <div className="text-sm">
                <span className="font-medium">Respuesta:</span>{' '}
                {val === null || val === undefined ? <span className="italic text-gray-400">Sin respuesta</span> :
                  ['multiple_choice', 'dropdown', 'checkboxes', 'ranking'].includes(q.type)
                    ? renderOptions()
                    : Array.isArray(val) ? val.map((v, i) => <span key={i} className="inline-block mr-2">{String(v)}</span>) : String(val)}
              </div>
              {typeof ans?.is_correct === 'boolean' && (
                <div className={ans.is_correct ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                  {ans.is_correct ? 'Correcta' : 'Incorrecta'}
                </div>
              )}
              {typeof ans?.points_earned === 'number' && (
                <div className="text-xs text-amber-700">Puntos: {ans.points_earned}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

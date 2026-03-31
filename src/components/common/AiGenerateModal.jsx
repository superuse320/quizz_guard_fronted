import { useEffect, useState } from 'react'
import { getPreviewComponent } from '../QuestionTypes/index.jsx'
import { normalizeFormPayload } from '../../utils/formTemplateLoader'
import { useGenerateQuizMutation, useRegenerateQuestionMutation } from '../../redux/services/quizGeneratorApi'
import GenerateAiIcon from '../../assets/icons/GenerateAiIcon.jsx'

export default function AiGenerateModal({
    isOpen,
    accessToken,
    onClose,
    onUseTemplate,
}) {
    const [prompt, setPrompt] = useState('')
    const [error, setError] = useState('')
    const [previewTemplate, setPreviewTemplate] = useState(null)
    const [regenQuestionNumber, setRegenQuestionNumber] = useState(1)
    const [regenInstruction, setRegenInstruction] = useState('')
    const [showRegenPopup, setShowRegenPopup] = useState(false)

    const [generateQuiz, { isLoading: generatingWithAi }] = useGenerateQuizMutation()
    const [regenerateQuestion, { isLoading: regeneratingQuestion }] = useRegenerateQuestionMutation()

    const isBusy = generatingWithAi || regeneratingQuestion

    const previewQuestions = previewTemplate?.questions || []
    const selectedQuestionIndex = Math.max(0, Number(regenQuestionNumber || 1) - 1)

    useEffect(() => {
        if (!isOpen) return undefined
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = previousOverflow
        }
    }, [isOpen])

    if (!isOpen) return null

    const handleClose = () => {
        setError('')
        setRegenInstruction('')
        setShowRegenPopup(false)
        onClose()
    }

    const openRegenPopupForQuestion = (questionNumber) => {
        setRegenQuestionNumber(questionNumber)
        setRegenInstruction('')
        setShowRegenPopup(true)
    }

    const handleGenerate = async () => {
        const cleanPrompt = String(prompt || '').trim()
        if (!cleanPrompt) {
            setError('Escribe un prompt para generar el cuestionario.')
            return
        }

        if (!accessToken) {
            setError('No hay sesion activa. Inicia sesion nuevamente.')
            return
        }

        setError('')

        try {
            const payload = await generateQuiz({
                prompt: cleanPrompt,
                accessToken,
            }).unwrap()

            const normalized = normalizeFormPayload(payload)
            setPreviewTemplate(normalized)
            setRegenQuestionNumber(1)
            setRegenInstruction('')
            setShowRegenPopup(false)
        } catch (apiError) {
            const message = apiError?.data?.mensaje || apiError?.data?.message || apiError?.message
            setError(message || 'No se pudo generar el cuestionario con IA.')
        }
    }

    const handleRegenerateQuestion = async () => {
        if (!previewTemplate || previewQuestions.length === 0) {
            setError('Primero genera un cuestionario para poder regenerar preguntas.')
            return
        }

        const cleanInstruction = String(regenInstruction || '').trim()
        if (!cleanInstruction) {
            setError('Escribe una instruccion para mejorar la pregunta seleccionada.')
            return
        }

        setError('')

        try {
            const regenPayload = {
                version: previewTemplate.version || '1.0',
                title: previewTemplate.title || 'Cuestionario',
                description: previewTemplate.description || '',
                questions: previewQuestions.map((q) => ({
                    title: q.title,
                    description: q.description,
                    type: q.type,
                    required: q.required,
                    options: q.options,
                    correctAnswers: q.correctAnswers,
                    scaleMin: q.scaleMin,
                    scaleMax: q.scaleMax,
                    scaleMinLabel: q.scaleMinLabel,
                    scaleMaxLabel: q.scaleMaxLabel,
                })),
                questionIndex: regenQuestionNumber,
                instruction: cleanInstruction,
            }

            const response = await regenerateQuestion({
                accessToken,
                ...regenPayload,
            }).unwrap()

            const normalized = normalizeFormPayload(response)
            if (normalized.questions.length > 0) {
                setPreviewTemplate((current) => ({
                    ...current,
                    ...normalized,
                    title: normalized.title || current?.title,
                    description: normalized.description || current?.description,
                }))
            }

            const singleQuestion = response?.data?.question || response?.question
            if (normalized.questions.length === 0 && singleQuestion) {
                const normalizedOne = normalizeFormPayload({
                    title: previewTemplate.title,
                    description: previewTemplate.description,
                    questions: [singleQuestion],
                })
                const nextQuestion = normalizedOne.questions[0]

                if (nextQuestion) {
                    setPreviewTemplate((current) => {
                        const nextQuestions = [...(current?.questions || [])]
                        nextQuestions[selectedQuestionIndex] = { ...nextQuestions[selectedQuestionIndex], ...nextQuestion }
                        return {
                            ...current,
                            questions: nextQuestions,
                        }
                    })
                }
            }

            setShowRegenPopup(false)
            setRegenInstruction('')
        } catch (apiError) {
            const message = apiError?.data?.mensaje || apiError?.data?.message || apiError?.message
            setError(message || 'No se pudo regenerar la pregunta.')
        }
    }

    const handleUseTemplate = () => {
        if (!previewTemplate) return
        onUseTemplate(previewTemplate)
    }

    const renderQuestionPreview = (question, index) => {
        const isRequired = Boolean(question?.required)
        const correct = Array.isArray(question?.correctAnswers) ? question.correctAnswers : []
        const options = Array.isArray(question?.options) ? question.options : []

        const isSingleChoice = question?.type === 'choice_unique' || question?.type === 'dropdown'
        const isMultipleChoice = question?.type === 'multiple_choice' || question?.type === 'checkboxes'

        if (isSingleChoice || isMultipleChoice) {
            return (
                <div className="space-y-2">
                    {options.map((option, optionIndex) => {
                        const checked = correct.includes(optionIndex)
                        return (
                            <label
                                key={`prev-opt-${index}-${optionIndex}`}
                                className={`flex items-center gap-2 rounded-md px-2 py-1 text-sm ${checked ? 'bg-emerald-500/15 text-emerald-200' : 'text-gray-200'}`}
                            >
                                <input
                                    type={isSingleChoice ? 'radio' : 'checkbox'}
                                    checked={checked}
                                    readOnly
                                />
                                <span className="flex-1">{option || `Opcion ${optionIndex + 1}`}</span>
                                {checked ? <span className="text-xs font-semibold text-emerald-300">Correcta</span> : null}
                            </label>
                        )
                    })}
                </div>
            )
        }

        if (question?.type === 'short_answer') {
            return (
                <div className="space-y-2">
                    <input
                        className="w-full rounded-lg border border-gray-600 bg-[#0d1424] px-3 py-2 text-sm text-gray-100"
                        value={question?.shortAnswerCorrect || ''}
                        placeholder="Respuesta correcta"
                        readOnly
                    />
                    {question?.shortAnswerVariants ? (
                        <p className="text-xs text-green-400">
                            <span className="font-semibold text-white/70">Variantes correctas:</span> {question.shortAnswerVariants}
                        </p>
                    ) : null}
                </div>
            )
        }

        return (
            <div>
                {getPreviewComponent({ ...question, id: question.id || `preview-${index}` })}
                {isRequired ? <p className="mt-2 text-xs text-rose-300">* Obligatoria</p> : null}
            </div>
        )
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/85 p-2 sm:p-4">
            <div className="mx-auto h-[88vh] w-full max-w-330 rounded-2xl border border-white/15 mt-10 bg-black p-4 shadow-2xl">
                <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">

                        <h3 className="text-2xl font-semibold text-white">Generar con IA</h3>
                    </div>
                    <button
                        type="button"
                        className="rounded-full p-1.5 text-gray-300 hover:bg-white/10"
                        onClick={handleClose}
                    >
                        ✕
                    </button>
                </div>

                <div className="grid h-[calc(100%-56px)] grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
                    <aside className="rounded-2xl flex flex-col  border-white/12 bg-white/5 p-4">


                        <label className="mt-5 mb-3 text-sm block  font-semibold text-white/60">¿Qué quieres crear?</label>
                        <textarea
                            value={prompt}
                            onChange={(event) => setPrompt(event.target.value)}
                            placeholder="Generame un formulario..."
                            className="h-52 w-full resize-none rounded-xl border border-white/10 bg-black px-3 py-3  text-gray-100 outline-none focus:border-primary-400"
                        />

                        <button
                            type="button"
                            className="mt-4 w-full cursor-pointer rounded-xl bg-linear-to-r from-primary-500/35 via-indigo-500/30 to-primary-400/30 px-4 py-2.5 text-lg font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={handleGenerate}
                            disabled={isBusy}
                        >

                            <GenerateAiIcon className={"size-5 inline-block mr-2 -translate-y-0.5"} />
                            {generatingWithAi ? 'Generando...' : 'Generar'}
                        </button>



                        {error ? (
                            <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                                {error}
                            </div>
                        ) : null}
                        <div className='flex-1'></div>
                        {previewTemplate ? (
                            <div>
                                <button
                                    type="button"
                                    className="mt-10 w-full rounded-xl border border-green-500 px-4 py-2.5 text-sm font-bold text-green-400 hover:border-green-300 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                                    onClick={handleUseTemplate}
                                    disabled={isBusy}
                                >
                                    Usar este formulario
                                </button>
                            </div>
                        ) : null}
                    </aside>

                    <section className="relative overflow-hidden rounded-2xl   p-3">
                        {isBusy ? (
                            <div className="ai-spark-field flex h-full flex-col items-center justify-center">
                                <div className="text-6xl">🪄</div>
                                <p className="mt-4 text-sm tracking-[0.25em] text-primary-300">{generatingWithAi ? 'GENERANDO CUESTIONARIO' : 'REGENERANDO PREGUNTA'}</p>
                                <div className="mt-6 flex gap-2">
                                    <span className="ai-dot h-2 w-2 rounded-full bg-primary-300" />
                                    <span className="ai-dot ai-dot-delay-1 h-2 w-2 rounded-full bg-primary-300" />
                                    <span className="ai-dot ai-dot-delay-2 h-2 w-2 rounded-full bg-emerald-300" />
                                </div>
                            </div>
                        ) : null}

                        {!isBusy && !previewTemplate ? (
                            <div className="flex h-full items-center justify-center text-center text-gray-400">
                                <div>
                                    <GenerateAiIcon className={"size-10 inline-block mb-4"} />
                                    <p className="mt-4 text-lg text-gray-300">Tu vista previa aparecera aqui</p>
                                    <p className="mt-1 text-sm">Escribe el prompt y pulsa Generar</p>
                                </div>
                            </div>
                        ) : null}

                        {!isBusy && previewTemplate ? (
                            <div className="h-full overflow-auto pr-2">
                                <div className='flex justify-between '>

                                    <div className="mb-5 flex-1 border-b border-white/10 pb-4">
                                        <h4 className="text-2xl font-bold text-white">{previewTemplate.title || 'Formulario generado'}</h4>
                                        <p className="mt-1 text-sm text-gray-300">{previewTemplate.description || 'Sin descripcion'}</p>
                                    </div>

                                </div>

                                <div className="space-y-4">
                                    {(previewTemplate.questions || []).map((question, index) => (
                                        <article key={`home-prev-${question.id || index}`} className={`rounded-xl border p-4 ${index === selectedQuestionIndex ? 'border-primary-400/70 bg-primary-400/10' : 'border-white/15 bg-white/4'}`}>
                                            <div className="flex items-start justify-between gap-3">
                                                <h5 className="text-sm font-semibold text-white">
                                                    {index + 1}. {question.title || 'Pregunta sin titulo'}
                                                    {question?.required ? <span className="ml-1 text-rose-400">*</span> : null}
                                                </h5>
                                                <button
                                                    type="button"
                                                    className="rounded-md cursor-pointer border border-indigo-400/50 bg-indigo-500/20 px-2 py-1 text-xs font-semibold text-indigo-200 hover:bg-indigo-500/30"
                                                    onClick={() => openRegenPopupForQuestion(index + 1)}
                                                    disabled={isBusy}
                                                    title="Regenerar esta pregunta con IA"
                                                >
                                                    <GenerateAiIcon className={"size-3 inline-block mr-1 -translate-y-px"} />
                                                    Regenerar
                                                </button>
                                            </div>
                                            {question.description ? <p className="mt-1 text-xs text-gray-300">{question.description}</p> : null}
                                            <div className="mt-3 rounded-lg border border-white/10 bg-[#0a0f1d] p-3 text-gray-200">
                                                {renderQuestionPreview(question, index)}
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </section>
                </div>
            </div>

            {showRegenPopup ? (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/55 p-4">
                    <div className="w-full overflow-hidden relative max-w-xl rounded-xl border border-white/15 bg-black p-5 shadow-2xl">
                        <div className='pointer-events-none select-none absolute top-0 left-0 w-full h-full z-0'>
                            <div className='absolute left-1/2 -translate-x-1/2 -top-25 bg-white size-40 rounded-full shadow-2xl shadow-white blur-[140px] opacity-60'></div>
                        </div>

                        <div className="mb-2 flex items-center justify-between">
                            <h4 className="text-lg font-semibold text-white">Regenerar pregunta #{regenQuestionNumber}</h4>
                            <button
                                type="button"
                                className="rounded-md px-2 py-1 text-gray-300 hover:bg-white/10"
                                onClick={() => setShowRegenPopup(false)}
                            >
                                ✕
                            </button>
                        </div>

                        <p className="mb-2 text-xs text-gray-300">Escribe la instruccion para mejorar solo esta pregunta.</p>
                        <textarea
                            value={regenInstruction}
                            onChange={(event) => setRegenInstruction(event.target.value)}
                            placeholder="Ejemplo: conviertela en checks con enfoque practico"
                            className="h-24 w-full resize-none rounded-xl border border-white/10 bg-black px-3 py-3  text-gray-100 outline-none focus:border-primary-400"

                        />

                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                type="button"
                                className="rounded-lg border border-white/20 px-3 py-2 text-sm text-gray-200 hover:bg-white/10"
                                onClick={() => setShowRegenPopup(false)}
                                disabled={isBusy}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className=" cursor-pointer rounded-xl bg-linear-to-r from-primary-500/35 via-indigo-500/30 to-primary-400/30 px-10   font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"

                                onClick={handleRegenerateQuestion}
                                disabled={isBusy}
                            >
                                {regeneratingQuestion ? 'Regenerando...' : 'Regenerar con IA'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    )
}

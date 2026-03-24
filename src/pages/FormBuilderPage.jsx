import { useMemo, useState } from 'react'
import '../App.css'

const QUESTION_TYPES = [
  {
    value: 'short',
    label: 'Respuesta corta',
    help: 'Campo de texto en una sola linea para respuestas breves.',
  },
  {
    value: 'long',
    label: 'Parrafo',
    help: 'Texto largo para explicaciones completas.',
  },
  {
    value: 'choice',
    label: 'Opcion multiple',
    help: 'El usuario elige solo una opcion.',
  },
  {
    value: 'checks',
    label: 'Casillas de verificacion',
    help: 'Permite seleccionar multiples respuestas.',
  },
  {
    value: 'select',
    label: 'Lista desplegable',
    help: 'Opciones compactas en un selector.',
  },
  {
    value: 'scale',
    label: 'Escala lineal',
    help: 'Evalua de menor a mayor en una escala numerica.',
  },
  {
    value: 'grid_single',
    label: 'Cuadricula opcion multiple',
    help: 'Una respuesta por fila, organizada por columnas.',
  },
  {
    value: 'grid_multi',
    label: 'Cuadricula casillas',
    help: 'Multiples selecciones por fila dentro de una cuadricula.',
  },
  {
    value: 'date',
    label: 'Fecha',
    help: 'Entrada de calendario para fechas.',
  },
  {
    value: 'time',
    label: 'Hora',
    help: 'Entrada para horas y minutos.',
  },
  {
    value: 'file',
    label: 'Subida de archivo',
    help: 'Adjuntar documentos o imagenes desde el formulario.',
  },
]

const DEFAULT_OPTIONS = ['Opcion 1', 'Opcion 2']
const DEFAULT_GRID_ROWS = ['Fila 1', 'Fila 2']
const DEFAULT_GRID_COLUMNS = ['Columna 1', 'Columna 2']

const LEGACY_TYPE_MAP = {
  short_answer: 'short',
  paragraph: 'long',
  multiple_choice: 'choice',
  checkboxes: 'checks',
  dropdown: 'select',
  linear_scale: 'scale',
  multiple_choice_grid: 'grid_single',
  checkbox_grid: 'grid_multi',
  file_upload: 'file',
}

const VALID_TYPES = new Set(QUESTION_TYPES.map((questionType) => questionType.value))

const normalizeType = (rawType) => {
  const nextType = LEGACY_TYPE_MAP[rawType] ?? rawType
  return VALID_TYPES.has(nextType) ? nextType : 'short'
}

const createQuestion = (type = 'choice') => ({
  id: crypto.randomUUID(),
  title: 'Pregunta sin titulo',
  description: '',
  type,
  required: false,
  correctAnswers: [],
  options: [...DEFAULT_OPTIONS],
  rows: [...DEFAULT_GRID_ROWS],
  columns: [...DEFAULT_GRID_COLUMNS],
  scaleMin: 1,
  scaleMax: 5,
  scaleMinLabel: 'Nada probable',
  scaleMaxLabel: 'Muy probable',
})

const isChoiceType = (type) =>
  type === 'choice' || type === 'checks' || type === 'select'

const isGridType = (type) =>
  type === 'grid_single' || type === 'grid_multi'

// Exportar formulario a JSON
const exportFormToJSON = (title, description, questions) => {
  const exportData = {
    version: '1.0',
    title,
    description,
    questions: questions.map((q) => {
      const baseQuestion = {
        title: q.title,
        description: q.description,
        type: q.type,
        required: q.required,
      }

      if (isChoiceType(q.type)) {
        return {
          ...baseQuestion,
          options: q.options,
          correctAnswers: q.correctAnswers,
        }
      }

      if (q.type === 'scale') {
        return {
          ...baseQuestion,
          scaleMin: q.scaleMin,
          scaleMax: q.scaleMax,
          scaleMinLabel: q.scaleMinLabel,
          scaleMaxLabel: q.scaleMaxLabel,
        }
      }

      if (isGridType(q.type)) {
        return {
          ...baseQuestion,
          rows: q.rows,
          columns: q.columns,
        }
      }

      return baseQuestion
    }),
  }

  return JSON.stringify(exportData, null, 2)
}

// Importar formulario desde JSON
const loadFormFromJSON = (jsonString) => {
  const data = JSON.parse(jsonString)
  
  if (!data.title || !Array.isArray(data.questions)) {
    throw new Error('Formato JSON invalido. Debe contener "title" y "questions".')
  }

  const processedQuestions = data.questions.map((q) => {
    const normalizedType = normalizeType(q.type)

    const baseQuestion = {
      id: crypto.randomUUID(),
      title: q.title || 'Pregunta sin titulo',
      description: q.description || '',
      type: normalizedType,
      required: q.required || false,
      correctAnswers: [],
      options: [...DEFAULT_OPTIONS],
      rows: [...DEFAULT_GRID_ROWS],
      columns: [...DEFAULT_GRID_COLUMNS],
      scaleMin: 1,
      scaleMax: 5,
      scaleMinLabel: 'Nada probable',
      scaleMaxLabel: 'Muy probable',
    }

    if (isChoiceType(normalizedType) && Array.isArray(q.options)) {
      baseQuestion.options = q.options
      baseQuestion.correctAnswers = q.correctAnswers || []
    }

    if (normalizedType === 'scale') {
      baseQuestion.scaleMin = q.scaleMin ?? 1
      baseQuestion.scaleMax = q.scaleMax ?? 5
      baseQuestion.scaleMinLabel = q.scaleMinLabel || 'Nada probable'
      baseQuestion.scaleMaxLabel = q.scaleMaxLabel || 'Muy probable'
    }

    if (isGridType(normalizedType)) {
      if (Array.isArray(q.rows)) baseQuestion.rows = q.rows
      if (Array.isArray(q.columns)) baseQuestion.columns = q.columns
    }

    return baseQuestion
  })

  return {
    title: data.title || '',
    description: data.description || '',
    questions: processedQuestions,
  }
}

function FormBuilderPage() {
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [questions, setQuestions] = useState([])
  const [activeQuestionId, setActiveQuestionId] = useState(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  const totalRequired = useMemo(
    () => questions.filter((question) => question.required).length,
    [questions],
  )

  const handleExportJSON = () => {
    const json = exportFormToJSON(formTitle, formDescription, questions)
    const element = document.createElement('a')
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(json))
    element.setAttribute('download', `${formTitle || 'formulario'}.json`)
    element.style.display = 'none'
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  const handleImportJSON = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (event) => {
      const file = event.target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const content = e.target?.result
          const formData = loadFormFromJSON(content)
          setFormTitle(formData.title)
          setFormDescription(formData.description)
          setQuestions(formData.questions)
          setActiveQuestionId(null)
          setIsPreviewOpen(false)
          alert('Formulario importado exitosamente!')
        } catch (error) {
          alert(`Error al importar: ${error.message}`)
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  const handleExportJSONText = () => {
    const json = exportFormToJSON(formTitle, formDescription, questions)
    const textarea = document.createElement('textarea')
    textarea.value = json
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    alert('JSON copiado al portapapeles!')
  }

  const handleShowJSONExample = () => {
    const exampleJSON = {
      version: '1.0',
      title: 'Mi Formulario',
      description: 'Una descripcion de ejemplo',
      questions: [
        {
          title: 'Cual es tu nombre?',
          description: '',
          type: 'short',
          required: true,
        },
        {
          title: 'Cual es tu email?',
          description: '',
          type: 'short',
          required: true,
        },
        {
          title: 'Que te gusto?',
          description: 'Selecciona todas las opciones que apliquen',
          type: 'checks',
          required: false,
          options: ['Opcion 1', 'Opcion 2', 'Opcion 3'],
          correctAnswers: [],
        },
        {
          title: 'Que tan satisfecho estas?',
          description: '',
          type: 'scale',
          required: true,
          scaleMin: 1,
          scaleMax: 5,
          scaleMinLabel: 'Nada satisfecho',
          scaleMaxLabel: 'Muy satisfecho',
        },
      ],
    }
    const json = JSON.stringify(exampleJSON, null, 2)
    const textarea = document.createElement('textarea')
    textarea.value = json
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    alert('Ejemplo JSON copiado al portapapeles!')
  }

  const updateQuestion = (id, updater) => {
    setQuestions((current) =>
      current.map((question) => {
        if (question.id !== id) {
          return question
        }

        return typeof updater === 'function'
          ? updater(question)
          : { ...question, ...updater }
      }),
    )
  }

  const addQuestion = (type = 'choice') => {
    const newQuestion = createQuestion(type)
    setQuestions((current) => [...current, newQuestion])
    setActiveQuestionId(newQuestion.id)
  }

  const duplicateQuestion = (id) => {
    setQuestions((current) => {
      const index = current.findIndex((question) => question.id === id)
      if (index === -1) {
        return current
      }

      const duplicated = {
        ...current[index],
        id: crypto.randomUUID(),
        title: `${current[index].title} (copia)`,
        correctAnswers: [...current[index].correctAnswers],
        options: [...current[index].options],
        rows: [...current[index].rows],
        columns: [...current[index].columns],
      }

      const next = [...current]
      next.splice(index + 1, 0, duplicated)
      return next
    })
  }

  const removeQuestion = (id) => {
    setQuestions((current) => {
      if (current.length === 1) {
        return current
      }
      return current.filter((question) => question.id !== id)
    })
    setActiveQuestionId((current) => (current === id ? null : current))
  }

  const changeQuestionType = (id, type) => {
    updateQuestion(id, (question) => {
      const nextScaleMin = type === 'scale' ? 1 : question.scaleMin
      const nextScaleMax = type === 'scale' ? 5 : question.scaleMax

      return {
        ...question,
        type,
        correctAnswers: isChoiceType(type) ? [] : question.correctAnswers,
        options: isChoiceType(type) ? [...DEFAULT_OPTIONS] : question.options,
        rows: isGridType(type) ? [...DEFAULT_GRID_ROWS] : question.rows,
        columns: isGridType(type) ? [...DEFAULT_GRID_COLUMNS] : question.columns,
        scaleMin: nextScaleMin,
        scaleMax: nextScaleMax,
      }
    })
  }

  const updateArrayValue = (id, field, index, value) => {
    updateQuestion(id, (question) => {
      const next = [...question[field]]
      next[index] = value
      return { ...question, [field]: next }
    })
  }

  const addArrayValue = (id, field, fallbackLabel) => {
    updateQuestion(id, (question) => {
      const nextCount = question[field].length + 1
      return {
        ...question,
        [field]: [...question[field], `${fallbackLabel} ${nextCount}`],
      }
    })
  }

  const removeArrayValue = (id, field, index) => {
    updateQuestion(id, (question) => {
      if (question[field].length <= 2) {
        return question
      }

      if (field === 'options') {
        const nextCorrectAnswers = question.correctAnswers
          .filter((answerIndex) => answerIndex !== index)
          .map((answerIndex) => (answerIndex > index ? answerIndex - 1 : answerIndex))

        return {
          ...question,
          correctAnswers: nextCorrectAnswers,
          [field]: question[field].filter((_, itemIndex) => itemIndex !== index),
        }
      }

      return {
        ...question,
        [field]: question[field].filter((_, itemIndex) => itemIndex !== index),
      }
    })
  }

  const toggleCorrectAnswer = (questionId, optionIndex) => {
    updateQuestion(questionId, (question) => {
      if (!isChoiceType(question.type)) {
        return question
      }

      if (question.type === 'checks') {
        const exists = question.correctAnswers.includes(optionIndex)
        return {
          ...question,
          correctAnswers: exists
            ? question.correctAnswers.filter((index) => index !== optionIndex)
            : [...question.correctAnswers, optionIndex],
        }
      }

      return {
        ...question,
        correctAnswers: [optionIndex],
      }
    })
  }

  const updateScaleEdge = (id, edge, rawValue) => {
    const value = Number(rawValue)
    updateQuestion(id, (question) => {
      if (edge === 'min') {
        const nextMin = Math.min(value, question.scaleMax - 1)
        return { ...question, scaleMin: nextMin }
      }

      const nextMax = Math.max(value, question.scaleMin + 1)
      return { ...question, scaleMax: nextMax }
    })
  }

  const renderQuestionPreview = (question) => {
    if (question.type === 'short') {
      return <input className="preview-input" type="text" placeholder="Respuesta corta" disabled />
    }

    if (question.type === 'long') {
      return <textarea className="preview-input" placeholder="Respuesta larga" rows={3} disabled />
    }

    if (isChoiceType(question.type)) {
      const markerType = question.type === 'checks' ? 'checkbox' : 'radio'
      return (
        <div className="preview-options">
          {question.options.map((option, index) => (
            <label key={`${question.id}-${option}-${index}`} className="preview-option">
              {question.type === 'select' ? (
                <span className="preview-index">{index + 1}.</span>
              ) : (
                <input type={markerType} disabled />
              )}
              <span>{option || `Opcion ${index + 1}`}</span>
            </label>
          ))}
        </div>
      )
    }

    if (question.type === 'scale') {
      const items = Array.from(
        { length: question.scaleMax - question.scaleMin + 1 },
        (_, index) => question.scaleMin + index,
      )
      return (
        <div className="scale-block">
          <span>{question.scaleMinLabel}</span>
          <div className="scale-points">
            {items.map((item) => (
              <label key={`${question.id}-scale-${item}`}>
                <input type="radio" name={`scale-${question.id}`} disabled />
                {item}
              </label>
            ))}
          </div>
          <span>{question.scaleMaxLabel}</span>
        </div>
      )
    }

    if (isGridType(question.type)) {
      const markerType = question.type === 'grid_multi' ? 'checkbox' : 'radio'
      return (
        <div className="grid-preview">
          <div
            className="grid-head"
            style={{
              gridTemplateColumns: `minmax(140px, 1fr) repeat(${question.columns.length}, minmax(80px, auto))`,
            }}
          >
            <span />
            {question.columns.map((column, index) => (
              <strong key={`${question.id}-column-${index}`}>{column}</strong>
            ))}
          </div>
          {question.rows.map((row, rowIndex) => (
            <div
              key={`${question.id}-row-${rowIndex}`}
              className="grid-row"
              style={{
                gridTemplateColumns: `minmax(140px, 1fr) repeat(${question.columns.length}, minmax(80px, auto))`,
              }}
            >
              <span>{row}</span>
              {question.columns.map((_, columnIndex) => (
                <input
                  key={`${question.id}-cell-${rowIndex}-${columnIndex}`}
                  type={markerType}
                  name={`grid-${question.id}-${rowIndex}`}
                  disabled
                />
              ))}
            </div>
          ))}
        </div>
      )
    }

    if (question.type === 'date') {
      return <input className="preview-input" type="date" disabled />
    }

    if (question.type === 'time') {
      return <input className="preview-input" type="time" disabled />
    }

    if (question.type === 'file') {
      return (
        <div className="file-upload-preview">
          <p>Los usuarios podran adjuntar archivos en esta pregunta.</p>
          <button type="button" disabled>
            Agregar archivo
          </button>
        </div>
      )
    }

    return null
  }

  const renderRespondentField = (question) => {
    if (question.type === 'short') {
      return <input className="preview-input" type="text" placeholder="Tu respuesta" />
    }

    if (question.type === 'long') {
      return <textarea className="preview-input" rows={4} placeholder="Tu respuesta" />
    }

    if (question.type === 'choice') {
      return (
        <div className="preview-options">
          {question.options.map((option, index) => (
            <label key={`${question.id}-respond-radio-${index}`} className="preview-option">
              <input type="radio" name={`respond-${question.id}`} />
              <span>{option || `Opcion ${index + 1}`}</span>
            </label>
          ))}
        </div>
      )
    }

    if (question.type === 'checks') {
      return (
        <div className="preview-options">
          {question.options.map((option, index) => (
            <label key={`${question.id}-respond-check-${index}`} className="preview-option">
              <input type="checkbox" />
              <span>{option || `Opcion ${index + 1}`}</span>
            </label>
          ))}
        </div>
      )
    }

    if (question.type === 'select') {
      return (
        <select className="preview-select" defaultValue="">
          <option value="" disabled>
            Elegir
          </option>
          {question.options.map((option, index) => (
            <option key={`${question.id}-respond-drop-${index}`} value={index}>
              {option || `Opcion ${index + 1}`}
            </option>
          ))}
        </select>
      )
    }

    if (question.type === 'scale') {
      const items = Array.from(
        { length: question.scaleMax - question.scaleMin + 1 },
        (_, index) => question.scaleMin + index,
      )
      return (
        <div className="scale-block">
          <span>{question.scaleMinLabel}</span>
          <div className="scale-points">
            {items.map((item) => (
              <label key={`${question.id}-respond-scale-${item}`}>
                <input type="radio" name={`respond-scale-${question.id}`} />
                {item}
              </label>
            ))}
          </div>
          <span>{question.scaleMaxLabel}</span>
        </div>
      )
    }

    if (isGridType(question.type)) {
      const markerType = question.type === 'grid_multi' ? 'checkbox' : 'radio'
      return (
        <div className="grid-preview">
          <div
            className="grid-head"
            style={{
              gridTemplateColumns: `minmax(140px, 1fr) repeat(${question.columns.length}, minmax(80px, auto))`,
            }}
          >
            <span />
            {question.columns.map((column, index) => (
              <strong key={`${question.id}-respond-column-${index}`}>{column}</strong>
            ))}
          </div>
          {question.rows.map((row, rowIndex) => (
            <div
              key={`${question.id}-respond-row-${rowIndex}`}
              className="grid-row"
              style={{
                gridTemplateColumns: `minmax(140px, 1fr) repeat(${question.columns.length}, minmax(80px, auto))`,
              }}
            >
              <span>{row}</span>
              {question.columns.map((_, columnIndex) => (
                <input
                  key={`${question.id}-respond-cell-${rowIndex}-${columnIndex}`}
                  type={markerType}
                  name={`respond-grid-${question.id}-${rowIndex}`}
                />
              ))}
            </div>
          ))}
        </div>
      )
    }

    if (question.type === 'date') {
      return <input className="preview-input" type="date" />
    }

    if (question.type === 'time') {
      return <input className="preview-input" type="time" />
    }

    if (question.type === 'file') {
      return <input className="preview-input" type="file" />
    }

    return null
  }

  return (
    <main className="form-builder-shell">
      <header className="builder-topbar">
        <div>
          <p className="brand">FormFlow</p>
          <h1>Editor de formulario</h1>
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className="ghost-btn"
            onClick={() => setIsPreviewOpen((current) => !current)}
          >
            {isPreviewOpen ? 'Cerrar vista previa' : 'Mostrar vista previa'}
          </button>
          <button
            type="button"
            className="ghost-btn"
            onClick={handleImportJSON}
            title="Cargar formulario desde JSON"
          >
            Importar JSON
          </button>
          <button
            type="button"
            className="ghost-btn"
            onClick={handleExportJSONText}
            title="Copiar JSON al portapapeles"
          >
            Copiar JSON
          </button>
          <button
            type="button"
            className="ghost-btn"
            onClick={handleExportJSON}
            title="Descargar JSON"
          >
            Descargar JSON
          </button>
          <button
            type="button"
            className="publish-btn"
            disabled={!formTitle.trim() || questions.length === 0}
          >
            Publicar
          </button>
        </div>
      </header>

      {isPreviewOpen ? (
        <section className="preview-page-card">
          <h2>{formTitle.trim() || 'Formulario sin titulo'}</h2>
          <p>{formDescription.trim() || 'Sin descripcion'}</p>

          {questions.length === 0 ? (
            <p className="preview-empty">Agrega preguntas para ver la vista previa.</p>
          ) : (
            <div className="preview-question-stack">
              {questions.map((question, index) => (
                <article key={`preview-${question.id}`} className="preview-question-card">
                  <div className="preview-question-head">
                    <h3>
                      {index + 1}. {question.title || 'Pregunta sin titulo'}
                    </h3>
                    {question.required ? <span className="required-dot">Obligatoria</span> : null}
                  </div>
                  {question.description ? (
                    <p className="preview-question-description">{question.description}</p>
                  ) : null}
                  {renderRespondentField(question)}
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {!isPreviewOpen ? (
        <>
      <section className="title-card">
        <div className="title-accent" />
        <input
          className="title-input"
          value={formTitle}
          onChange={(event) => setFormTitle(event.target.value)}
          placeholder="Formulario sin titulo"
          aria-label="Titulo del formulario"
        />
        <textarea
          className="description-input"
          value={formDescription}
          onChange={(event) => setFormDescription(event.target.value)}
          placeholder="Descripcion del formulario"
          aria-label="Descripcion del formulario"
          rows={2}
        />
        <p className="meta-info">
          {questions.length === 0
            ? 'Agrega tu primera pregunta para empezar.'
            : `${questions.length} preguntas | ${totalRequired} obligatorias`}
        </p>
      </section>

      <section className="questions-stack">
        {questions.length === 0 ? (
          <article className="empty-state-card">
            <h2>Tu formulario esta vacio</h2>
            <p>
              Elige un tipo para crear la primera pregunta. Luego podras cambiarlo en
              cualquier momento.
            </p>
            <div className="empty-state-actions">
              <button type="button" onClick={() => addQuestion('choice')}>
                + Opcion multiple
              </button>
              <button type="button" onClick={() => addQuestion('short')}>
                + Respuesta corta
              </button>
              <button type="button" onClick={() => addQuestion('long')}>
                + Parrafo
              </button>
              <button type="button" onClick={() => addQuestion('checks')}>
                + Casillas
              </button>
            </div>
          </article>
        ) : null}

        {questions.map((question, index) => {
          const currentType =
            QUESTION_TYPES.find((type) => type.value === question.type) ?? QUESTION_TYPES[0]

          return (
            <article
              key={question.id}
              className={`question-card ${
                activeQuestionId === question.id ? 'question-card-active' : ''
              }`}
              onClick={() => setActiveQuestionId(question.id)}
            >
              <div className="question-header">
                <span className="question-number">Pregunta {index + 1}</span>
                <select
                  value={question.type}
                  onChange={(event) => changeQuestionType(question.id, event.target.value)}
                >
                  {QUESTION_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="type-hint" key={`${question.id}-${question.type}`}>
                <strong>{currentType.label}</strong>
                <p>{currentType.help}</p>
              </div>

              <div className="question-main-fields">
                <input
                  type="text"
                  value={question.title}
                  onChange={(event) =>
                    updateQuestion(question.id, { title: event.target.value })
                  }
                  aria-label={`Titulo de la pregunta ${index + 1}`}
                />
                <input
                  type="text"
                  value={question.description}
                  onChange={(event) =>
                    updateQuestion(question.id, { description: event.target.value })
                  }
                  placeholder="Descripcion opcional"
                  aria-label={`Descripcion de la pregunta ${index + 1}`}
                />
              </div>

              {isChoiceType(question.type) ? (
                <div className="editor-group">
                  <p className="group-title">Opciones de respuesta</p>
                  {question.options.map((option, optionIndex) => (
                    <div key={`${question.id}-option-${optionIndex}`} className="array-row">
                      <input
                        value={option}
                        onChange={(event) =>
                          updateArrayValue(question.id, 'options', optionIndex, event.target.value)
                        }
                      />
                      <button
                        type="button"
                        className={`correct-toggle ${
                          question.correctAnswers.includes(optionIndex) ? 'is-correct' : ''
                        }`}
                        onClick={() => toggleCorrectAnswer(question.id, optionIndex)}
                      >
                        {question.correctAnswers.includes(optionIndex)
                          ? 'Correcta'
                          : 'Marcar correcta'}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeArrayValue(question.id, 'options', optionIndex)}
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="outline-btn"
                    onClick={() => addArrayValue(question.id, 'options', 'Opcion')}
                  >
                    Agregar opcion
                  </button>
                </div>
              ) : null}

              {question.type === 'scale' ? (
                <div className="editor-group scale-config">
                  <p className="group-title scale-title">Configuracion de escala</p>
                  <label>
                    Minimo
                    <select
                      value={question.scaleMin}
                      onChange={(event) => updateScaleEdge(question.id, 'min', event.target.value)}
                    >
                      {[0, 1].map((value) => (
                        <option key={`${question.id}-min-${value}`} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Maximo
                    <select
                      value={question.scaleMax}
                      onChange={(event) => updateScaleEdge(question.id, 'max', event.target.value)}
                    >
                      {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                        <option key={`${question.id}-max-${value}`} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                  <input
                    value={question.scaleMinLabel}
                    onChange={(event) =>
                      updateQuestion(question.id, { scaleMinLabel: event.target.value })
                    }
                    placeholder="Etiqueta minima"
                  />
                  <input
                    value={question.scaleMaxLabel}
                    onChange={(event) =>
                      updateQuestion(question.id, { scaleMaxLabel: event.target.value })
                    }
                    placeholder="Etiqueta maxima"
                  />
                </div>
              ) : null}

              {isGridType(question.type) ? (
                <div className="editor-group grid-config">
                  <div>
                    <p className="group-title">Filas</p>
                    {question.rows.map((row, rowIndex) => (
                      <div key={`${question.id}-row-edit-${rowIndex}`} className="array-row">
                        <input
                          value={row}
                          onChange={(event) =>
                            updateArrayValue(question.id, 'rows', rowIndex, event.target.value)
                          }
                        />
                        <button
                          type="button"
                          onClick={() => removeArrayValue(question.id, 'rows', rowIndex)}
                        >
                          Quitar
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="outline-btn"
                      onClick={() => addArrayValue(question.id, 'rows', 'Fila')}
                    >
                      Agregar fila
                    </button>
                  </div>
                  <div>
                    <p className="group-title">Columnas</p>
                    {question.columns.map((column, columnIndex) => (
                      <div
                        key={`${question.id}-column-edit-${columnIndex}`}
                        className="array-row"
                      >
                        <input
                          value={column}
                          onChange={(event) =>
                            updateArrayValue(
                              question.id,
                              'columns',
                              columnIndex,
                              event.target.value,
                            )
                          }
                        />
                        <button
                          type="button"
                          onClick={() => removeArrayValue(question.id, 'columns', columnIndex)}
                        >
                          Quitar
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="outline-btn"
                      onClick={() => addArrayValue(question.id, 'columns', 'Columna')}
                    >
                      Agregar columna
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="preview-box" key={`preview-${question.id}-${question.type}`}>
                {renderQuestionPreview(question)}
              </div>

              {isChoiceType(question.type) ? (
                <p className="correct-summary">
                  Respuestas correctas:{' '}
                  {question.correctAnswers.length === 0
                    ? 'ninguna marcada'
                    : question.correctAnswers
                        .map((answerIndex) => question.options[answerIndex] || `Opcion ${answerIndex + 1}`)
                        .join(', ')}
                </p>
              ) : null}

              <footer className="question-footer">
                <label className="required-toggle">
                  <input
                    type="checkbox"
                    checked={question.required}
                    onChange={(event) =>
                      updateQuestion(question.id, { required: event.target.checked })
                    }
                  />
                  Obligatoria
                </label>
                <div className="question-actions">
                  <button type="button" onClick={() => duplicateQuestion(question.id)}>
                    Duplicar
                  </button>
                  <button type="button" onClick={() => removeQuestion(question.id)}>
                    Eliminar
                  </button>
                </div>
              </footer>
            </article>
          )
        })}
      </section>

      <aside className="floating-tools">
        <button type="button" onClick={() => addQuestion('choice')}>
          + Opcion multiple
        </button>
        <button type="button" onClick={() => addQuestion('short')}>
          + Respuesta corta
        </button>
        <button type="button" onClick={() => addQuestion('checks')}>
          + Casillas
        </button>
        <button type="button" onClick={() => addQuestion('scale')}>
          + Escala lineal
        </button>
      </aside>

      <section className="live-summary">
        <h2>Resumen rapido</h2>
        <div>
          <strong>Titulo:</strong> {formTitle || 'Sin titulo'}
        </div>
        <div>
          <strong>Descripcion:</strong> {formDescription || 'Sin descripcion'}
        </div>
        <div>
          <strong>Preguntas:</strong> {questions.length}
        </div>
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: '12px', color: '#666', margin: '0 0 8px' }}>
            Puedes importar/exportar tu formulario como JSON para:
          </p>
          <ul style={{ fontSize: '12px', margin: '0', paddingLeft: '20px', color: '#666' }}>
            <li>Compartir plantillas</li>
            <li>Guardar versiones</li>
            <li>Automatizar creacion</li>
          </ul>
          <button
            type="button"
            className="outline-btn"
            onClick={handleShowJSONExample}
            style={{ marginTop: '8px', fontSize: '12px', padding: '6px 10px' }}
          >
            Ver ejemplo JSON
          </button>
        </div>
      </section>
        </>
      ) : null}
    </main>
  )
}

export default FormBuilderPage


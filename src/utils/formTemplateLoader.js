import formTemplateData from '../../form-template-complete.json'

/**
 * Template completo con todos los tipos de preguntas
 */
export const FORM_TEMPLATE_COMPLETE = formTemplateData

const DEFAULT_THEME = {
  primary: '#2563eb',
  accent: '#14b8a6',
  surface: '#ffffff',
  bgFrom: '#f8fbff',
  bgTo: '#e8f1ff',
  coverImage: '',
}

const TYPE_ALIASES = {
  multiplechoice: 'multiple_choice',
  multiple_choice: 'multiple_choice',
  short: 'short_answer',
  single_choice: 'choice_unique',
  choice: 'choice_unique',
  radio: 'choice_unique',
  checkbox: 'checkboxes',
  checks: 'checkboxes',
  scale: 'linear_scale',
  stars: 'star_rating',
  grid_single: 'choice_unique',
}

const normalizeType = (value) => {
  const raw = String(value || 'multiple_choice').trim().toLowerCase()
  return TYPE_ALIASES[raw] || raw
}

const normalizeCorrectAnswers = (question) => {
  const options = Array.isArray(question.options) ? question.options : []
  const incoming = Array.isArray(question.correctAnswers) ? question.correctAnswers : []

  // If answers are already numeric indexes, keep valid ones only.
  if (incoming.every((item) => Number.isInteger(item))) {
    return incoming.filter((idx) => idx >= 0 && idx < options.length)
  }

  // Accept labels/strings and convert them to option indexes.
  const mapped = incoming
    .map((item) => {
      const matchIndex = options.findIndex(
        (opt) => String(opt).trim().toLowerCase() === String(item).trim().toLowerCase(),
      )
      return matchIndex
    })
    .filter((idx) => idx >= 0)

  return Array.from(new Set(mapped))
}

const getTextAnswersFromPayload = (question) => {
  const incoming = Array.isArray(question?.correctAnswers) ? question.correctAnswers : []
  const cleaned = incoming
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)

  const explicitMain = String(question?.shortAnswerCorrect || '').trim()
  const explicitVariants = String(question?.shortAnswerVariants || '').trim()

  const main = explicitMain || cleaned[0] || ''

  if (explicitVariants) {
    return {
      shortAnswerCorrect: main,
      shortAnswerVariants: explicitVariants,
    }
  }

  return {
    shortAnswerCorrect: main,
    shortAnswerVariants: cleaned.slice(1).join(', '),
  }
}

const normalizeQuestion = (question, index) => {
  const type = normalizeType(question?.type)
  const options = Array.isArray(question?.options)
    ? question.options
    : (type === 'choice_unique' && Array.isArray(question?.columns) ? question.columns : [])
  const isTextQuestion = ['short_answer', 'paragraph', 'email', 'url', 'phone'].includes(type)
  const textAnswers = isTextQuestion
    ? getTextAnswersFromPayload(question)
    : {
        shortAnswerCorrect: String(question?.shortAnswerCorrect || ''),
        shortAnswerVariants: String(question?.shortAnswerVariants || ''),
      }

  return {
    id: question?.id || `import-q-${index + 1}`,
    section: Number(question?.section) > 0 ? Number(question.section) : 1,
    title: String(question?.title || `Pregunta ${index + 1}`),
    description: String(question?.description || ''),
    type,
    required: Boolean(question?.required),
    requiredConditionEnabled: Boolean(question?.requiredConditionEnabled),
    requiredConditionQuestionId: String(question?.requiredConditionQuestionId || ''),
    requiredConditionValue: String(question?.requiredConditionValue || ''),
    options,
    correctAnswers: normalizeCorrectAnswers({ ...question, options }),
    scaleMin: Number.isFinite(Number(question?.scaleMin)) ? Number(question.scaleMin) : 1,
    scaleMax: Number.isFinite(Number(question?.scaleMax)) ? Number(question.scaleMax) : 5,
    scaleMinLabel: String(question?.scaleMinLabel || 'Bajo'),
    scaleMaxLabel: String(question?.scaleMaxLabel || 'Alto'),
    minLength: question?.minLength ?? '',
    maxLength: question?.maxLength ?? '',
    regexPattern: String(question?.regexPattern || ''),
    shortAnswerCorrect: textAnswers.shortAnswerCorrect,
    shortAnswerVariants: textAnswers.shortAnswerVariants,
    minValue: question?.minValue ?? '',
    maxValue: question?.maxValue ?? '',
    minSelections: question?.minSelections ?? '',
    maxSelections: question?.maxSelections ?? '',
    points: Number.isFinite(Number(question?.points)) ? Number(question.points) : 1,
  }
}

export const normalizeFormPayload = (json) => {
  const root = json && typeof json === 'object' ? json : {}
  const payload = root.data && typeof root.data === 'object' ? root.data : root
  const rawQuestions = Array.isArray(payload.questions) ? payload.questions : []
  const questions = rawQuestions.map(normalizeQuestion)

  return {
    title: String(payload.title || root.title || ''),
    description: String(payload.description || root.description || ''),
    formMode: String(payload.formMode || root.formMode || 'normal'),
    sections: Array.isArray(payload.sections) ? payload.sections : [],
    questions,
    theme:
      payload.theme && typeof payload.theme === 'object'
        ? { ...DEFAULT_THEME, ...payload.theme }
        : DEFAULT_THEME,
  }
}

/**
 * Importa el template de formulario y lo transforma al formato esperado por FormBuilderPage
 */
export function loadFormTemplate() {
  return normalizeFormPayload(FORM_TEMPLATE_COMPLETE)
}

/**
 * Descarga el template como archivo JSON
 */
export function downloadTemplate() {
  const dataStr = JSON.stringify(FORM_TEMPLATE_COMPLETE, null, 2)
  const dataBlob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(dataBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'form-template.json'
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Importa un JSON de un archivo y lo carga como formulario
 */
export async function importFormFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result)
        const normalized = normalizeFormPayload(json)
        if (!Array.isArray(normalized.questions) || normalized.questions.length === 0) {
          throw new Error('El JSON no contiene preguntas validas en questions o data.questions')
        }
        resolve(normalized)
      } catch (error) {
        reject(new Error(`Error al parsear el JSON: ${error.message}`))
      }
    }
    reader.onerror = () => reject(new Error('Error al leer el archivo'))
    reader.readAsText(file)
  })
}

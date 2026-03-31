import { useMemo, useState, useEffect } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import QuizAdminPanel from './components/QuizAdminPanel'
import FormBuilderHeader from './components/FormBuilderHeader'
import AiPromptSidebar from './components/AiPromptSidebar'
import { getPreviewComponent, getRespondentComponent } from './components/QuestionTypes/index.jsx'
import { loadFormTemplate, importFormFromFile, normalizeFormPayload } from './utils/formTemplateLoader'
import { useGenerateQuizMutation } from './redux/services/quizGeneratorApi'
import { CloseIcon } from './assets/icons/CloseIcon.jsx'
import { DuplicateIcon } from './assets/icons/DuplicateIcon.jsx'
import { TrashIcon } from './assets/icons/TrashIcon.jsx'
import { QuestionTypeIcon } from './assets/icons/QuestionTypeIcon.jsx'

const THEME_PRESETS = {
  midnight_blue: {
    primary: '#4f7cff',
    accent: '#38bdf8',
    surface: '#0d1424',
    bgFrom: '#02040b',
    bgTo: '#090f1e',
  },
  ember_fire: {
    primary: '#f97316',
    accent: '#fb7185',
    surface: '#1b1311',
    bgFrom: '#070403',
    bgTo: '#130b09',
  },
  jade_forest: {
    primary: '#34d399',
    accent: '#22d3ee',
    surface: '#0f1d18',
    bgFrom: '#040a08',
    bgTo: '#0d1714',
  },
  magenta_dusk: {
    primary: '#f472b6',
    accent: '#c084fc',
    surface: '#1d1324',
    bgFrom: '#07040d',
    bgTo: '#140d1e',
  },
  sunset_peach: {
    primary: '#fb923c',
    accent: '#facc15',
    surface: '#211811',
    bgFrom: '#080603',
    bgTo: '#16100b',
  },
  graphite_mono: {
    primary: '#9ca3af',
    accent: '#f8fafc',
    surface: '#131823',
    bgFrom: '#03060c',
    bgTo: '#0c111a',
  },
}

const THEME_PRESET_OPTIONS = [
  { value: 'midnight_blue', label: 'Midnight Blue' },
  { value: 'ember_fire', label: 'Ember Fire' },
  { value: 'jade_forest', label: 'Jade Forest' },
  { value: 'magenta_dusk', label: 'Magenta Dusk' },
  { value: 'sunset_peach', label: 'Sunset Peach' },
  { value: 'graphite_mono', label: 'Graphite Mono' },
  { value: 'custom', label: 'Personalizado' },
]

const COVER_IMAGE_OPTIONS = [
  'https://t3.ftcdn.net/jpg/06/98/72/46/360_F_698724644_iZQkEEKlImcOyHmucCusMM0QbD8mWUl0.jpg',
  'https://images.unsplash.com/photo-1620121692029-d088224ddc74?fm=jpg&q=60&w=3000&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Zm9uZG9zJTIwZGUlMjBwYW50YWxsYSUyMGFic3RyYWN0b3N8ZW58MHx8MHx8fDA%3D',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSbPwKHHKvrISGldrZ-rpPEyTf-cmkqxI8b5g&s',
  'https://image.slidesdocs.com/responsive-images/background/art-wave-abstract-images-wallpapers-3d-hd-880p-powerpoint-background_bfb41db28f__960_540.jpg',
  'https://png.pngtree.com/background/20230422/original/pngtree-abstract-blue-background-free-download-wallpaper-hd-vector-picture-image_2454990.jpg',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTWlC5mPadbSD30PO_5w0yogkVSHcYEWsaYxg&s',
]

const THEME_COLOR_FIELDS = ['primary', 'accent', 'surface', 'bgFrom', 'bgTo']

const getPresetNameFromTheme = (theme) => {
  const match = Object.entries(THEME_PRESETS).find(([, preset]) =>
    THEME_COLOR_FIELDS.every((field) => theme?.[field] === preset[field]),
  )
  return match ? match[0] : 'custom'
}

const DEFAULT_FORM_THEME = {
  primary: '#4f7cff',
  accent: '#38bdf8',
  surface: '#0d1424',
  bgFrom: '#02040b',
  bgTo: '#090f1e',
  coverImage: '',
}

const parseThemeValue = (value) => {
  if (!value) return {}
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }
  return typeof value === 'object' ? value : {}
}

const parseSettingsValue = (value) => {
  if (!value) return {}
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }
  return typeof value === 'object' ? value : {}
}

const toDateTimeInputValue = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offsetMs = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

const toIsoDateTimeOrNull = (value) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

const FORM_MODES = [
  { value: 'normal', label: 'Normal', help: 'Formulario clasico.' },
  { value: 'quiz', label: 'Quiz', help: 'Modo juego con dinamica tipo quiz.' },
  { value: 'strict', label: 'Estricto', help: 'Modo examen con control mas riguroso.' },
]

const QUESTION_TYPES = [
  { value: 'short_answer', label: 'Respuesta corta', help: 'Texto breve en una linea.' },
  { value: 'paragraph', label: 'Parrafo', help: 'Texto largo para desarrollar una idea.' },
  { value: 'multiple_choice', label: 'Opcion multiple', help: 'Varias respuestas posibles (checkbox).' },
  { value: 'checkboxes', label: 'Casillas', help: 'Varias respuestas posibles.' },
  { value: 'choice_unique', label: 'Opcion unica', help: 'Una sola opcion con radio buttons (redonditos).' },
  { value: 'dropdown', label: 'Desplegable', help: 'Seleccion compacta en lista.' },
  { value: 'linear_scale', label: 'Escala lineal', help: 'Valor de menor a mayor en rango numerico.' },
  { value: 'emoji_scale', label: 'Escala con emojis', help: 'Escala visual con caritas.' },
  { value: 'star_rating', label: 'Calificacion con estrellas', help: 'Puntuar usando estrellas.' },
  { value: 'ranking', label: 'Ranking', help: 'Ordenar opciones por prioridad.' },
  { value: 'number', label: 'Numero', help: 'Respuesta numerica con rango.' },
  { value: 'email', label: 'Email', help: 'Valida automaticamente correo electronico.' },
  { value: 'url', label: 'URL', help: 'Valida automaticamente enlace web.' },
  { value: 'phone', label: 'Telefono', help: 'Valida formato de telefono.' },
  { value: 'date', label: 'Fecha', help: 'Entrada de fecha.' },
  { value: 'time', label: 'Hora', help: 'Entrada de hora.' },
]

const DEFAULT_OPTIONS = ['Opcion 1', 'Opcion 2']
const SCOREABLE_TYPES = new Set(['short_answer', 'multiple_choice', 'choice_unique', 'dropdown', 'ranking', 'number', 'date', 'time'])

const isChoiceType = (type) => type === 'multiple_choice' || type === 'checkboxes' || type === 'choice_unique' || type === 'dropdown'
const isTextType = (type) =>
  type === 'short_answer' || type === 'paragraph' || type === 'email' || type === 'url' || type === 'phone'

const OPTION_COLORS = [
  '#3b82f6', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6', '#06b6d4', '#ef4444', '#f97316',
  '#6366f1', '#14b8a6', '#d946ef', '#ea580c', '#0ea5e9', '#84cc16', '#f43f5e', '#a855f7',
]

const getRandomColor = (index) => OPTION_COLORS[index % OPTION_COLORS.length]

const createQuestion = (type = 'multiple_choice', section = 1) => ({
  id: crypto.randomUUID(),
  section,
  title: 'Pregunta sin titulo',
  description: '',
  type,
  required: false,
  requiredConditionEnabled: false,
  requiredConditionQuestionId: '',
  requiredConditionValue: '',
  options: [...DEFAULT_OPTIONS],
  correctAnswers: [],
  scaleMin: 1,
  scaleMax: 5,
  scaleMinLabel: 'Bajo',
  scaleMaxLabel: 'Alto',
  minLength: '',
  maxLength: '',
  regexPattern: '',
  shortAnswerCorrect: '',
  shortAnswerVariants: '',
  numberCorrect: '',
  dateCorrect: '',
  timeCorrect: '',
  minValue: '',
  maxValue: '',
  minSelections: '',
  maxSelections: '',
  points: 1,
})

const areArraysEqual = (a = [], b = []) => {
  if (a.length !== b.length) return false
  return a.every((value, index) => value === b[index])
}

const isBlank = (value) => value === null || value === undefined || String(value).trim() === ''

const normalizeAnswerText = (value) => String(value ?? '').trim().toLowerCase()

const parseShortAnswerVariants = (value) =>
  String(value ?? '')
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean)

const isResponseEmpty = (question, response) => {
  if (Array.isArray(response)) return response.length === 0
  if (question.type === 'number') return response === '' || response === null || response === undefined
  return isBlank(response)
}



function FormBuilderPage(props) {
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formMode, setFormMode] = useState('normal')
  const [strictDurationEnabled, setStrictDurationEnabled] = useState(false)
  const [strictDurationMinutes, setStrictDurationMinutes] = useState('60')
  const [strictWindowEnabled, setStrictWindowEnabled] = useState(false)
  const [strictStartsAt, setStrictStartsAt] = useState('')
  const [strictEndsAt, setStrictEndsAt] = useState('')
  const [strictRequireAuth, setStrictRequireAuth] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveIntent, setSaveIntent] = useState('draft')
  const [formStatus, setFormStatus] = useState('draft')
  const [currentPublicId, setCurrentPublicId] = useState('')
  const [saveError, setSaveError] = useState(null)
  const [successToast, setSuccessToast] = useState('')
  const [session, setSession] = useState(props.session || null)
  const [checkingSession, setCheckingSession] = useState(!props.session)
  const [loadingForm, setLoadingForm] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { public_id } = useParams();
  const editMode = props.editMode !== undefined ? props.editMode : !!public_id;
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [showQuizPanel, setShowQuizPanel] = useState(false);
  const [creatingQuizSession, setCreatingQuizSession] = useState(false);
  const [formUUID, setFormUUID] = useState(null);
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiGenerationError, setAiGenerationError] = useState('')
  const [isAiSidebarOpen, setIsAiSidebarOpen] = useState(true)
  const [showAddQuestionModal, setShowAddQuestionModal] = useState(false)
  const [showCoverPickerModal, setShowCoverPickerModal] = useState(false)
  const [showCustomThemeModal, setShowCustomThemeModal] = useState(false)
  const [selectedThemePreset, setSelectedThemePreset] = useState('midnight_blue')
  const [formTheme, setFormTheme] = useState(DEFAULT_FORM_THEME)
  const [openQuestionSettings, setOpenQuestionSettings] = useState({})
  const [uploadingCover, setUploadingCover] = useState(false)
  const [generateQuiz, { isLoading: isGeneratingWithAi }] = useGenerateQuizMutation()

  // Si no recibimos session por props, la obtenemos de Supabase
  useEffect(() => {
    if (!session) {
      setCheckingSession(true)
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session)
        setCheckingSession(false)
      }).catch(() => setCheckingSession(false))
    }
  }, [])

  useEffect(() => {
    const incomingToast = location.state?.successToast
    if (!incomingToast) return

    setSuccessToast(incomingToast)
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])

  useEffect(() => {
    if (!successToast) return
    const timeoutId = setTimeout(() => setSuccessToast(''), 3200)
    return () => clearTimeout(timeoutId)
  }, [successToast])

  useEffect(() => {
    if (!showAddQuestionModal && !showCustomThemeModal && !showCoverPickerModal) return
    const handleEscape = (event) => {
      if (event.key === 'Escape') setShowAddQuestionModal(false)
      if (event.key === 'Escape') setShowCustomThemeModal(false)
      if (event.key === 'Escape') setShowCoverPickerModal(false)
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [showAddQuestionModal, showCustomThemeModal, showCoverPickerModal])

  useEffect(() => {
    setSelectedThemePreset(getPresetNameFromTheme(formTheme))
  }, [formTheme])

  // Si hay public_id en la URL, cargar el formulario para edición o responder
  useEffect(() => {
    async function fetchForm() {
      if (public_id) {
        setLoadingForm(true);
        // Traer datos del formulario principal
        const { data: formData, error } = await supabase
          .from('forms')
          .select('*')
          .eq('public_id', public_id)
          .single();
        if (error || !formData) {
          setNotFound(true);
          setLoadingForm(false);
          return;
        }
        setFormTitle(formData.title || '');
        setFormDescription(formData.description || '');
        setFormStatus(formData.status || 'draft')
        setCurrentPublicId(formData.public_id || public_id || '')
        setFormMode(formData.form_mode || 'normal');
        setJoinCode(formData.join_code || '');
        setFormUUID(formData.id);
        const formSettings = parseSettingsValue(formData.settings)
        setStrictDurationEnabled(Boolean(formSettings.strict_duration_enabled))
        setStrictDurationMinutes(
          Number.isFinite(Number(formSettings.strict_duration_minutes))
            ? String(Math.max(1, Number(formSettings.strict_duration_minutes)))
            : '60',
        )
        setStrictWindowEnabled(Boolean(formSettings.strict_window_enabled))
        setStrictStartsAt(toDateTimeInputValue(formSettings.strict_starts_at || formData.opened_at))
        setStrictEndsAt(toDateTimeInputValue(formSettings.strict_ends_at || formData.closed_at))
        setStrictRequireAuth(formSettings.strict_require_auth !== false)
        setFormTheme((current) => {
          const parsedTheme = parseThemeValue(formData.theme)
          const coverImage = parsedTheme.coverImage || formData.cover_image_url || ''
          return { ...current, ...parsedTheme, coverImage }
        })
        // Traer secciones
        const { data: sectionsData } = await supabase
          .from('form_sections')
          .select('*')
          .eq('form_id', formData.id)
          .order('position', { ascending: true });
        // Traer preguntas
        const { data: questionsData } = await supabase
          .from('form_questions')
          .select('*')
          .eq('form_id', formData.id)
          .order('position', { ascending: true });
        // Traer opciones
        const { data: optionsData } = await supabase
          .from('form_question_options')
          .select('*');
        // Mapear preguntas con opciones y secciones
        const questionsWithOptions = (questionsData || []).map((q) => {
          const parsedSettings = typeof q.settings === 'string'
            ? (() => {
              try {
                return JSON.parse(q.settings)
              } catch {
                return {}
              }
            })()
            : (q.settings && typeof q.settings === 'object' ? q.settings : {})

          const questionOptions = (optionsData || [])
            .filter((opt) => opt.question_id === q.id)
            .sort((a, b) => a.position - b.position)

          return {
            ...q,
            options: questionOptions.map((opt) => opt.label),
            correctAnswers: questionOptions
              .map((opt, index) => (opt.is_correct ? index : -1))
              .filter((index) => index !== -1),
            shortAnswerCorrect: typeof parsedSettings.short_answer_correct === 'string' ? parsedSettings.short_answer_correct : '',
            shortAnswerVariants: Array.isArray(parsedSettings.short_answer_variants)
              ? parsedSettings.short_answer_variants.join('\n')
              : (typeof parsedSettings.short_answer_variants === 'string' ? parsedSettings.short_answer_variants : ''),
            numberCorrect: typeof parsedSettings.number_correct === 'number' || typeof parsedSettings.number_correct === 'string'
              ? String(parsedSettings.number_correct)
              : '',
            dateCorrect: typeof parsedSettings.date_correct === 'string' ? parsedSettings.date_correct : '',
            timeCorrect: typeof parsedSettings.time_correct === 'string' ? parsedSettings.time_correct : '',
          }
        });
        setQuestions(questionsWithOptions);
        setNotFound(false);
        setLoadingForm(false);
      }
    }
    fetchForm();
  }, [public_id]);
  const [questions, setQuestions] = useState([])
  const [activeQuestionId, setActiveQuestionId] = useState(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [selectedSection, setSelectedSection] = useState(1)

  const [responses, setResponses] = useState({})
  const [responseErrors, setResponseErrors] = useState({})
  const [previewSection, setPreviewSection] = useState(1)

  // Debug: verificar cuando cambian las preguntas
  useEffect(() => {
    if (questions.length > 0) {
      console.log('📝 Preguntas actualizadas:', {
        total: questions.length,
        porSeccion: Array.from(
          new Map(questions.map((q) => [q.section, null])).keys()
        ),
        unaPregunta: questions[0],
      })
    }
  }, [questions])
  const [showResults, setShowResults] = useState(false)
  const [scoreSummary, setScoreSummary] = useState(null)
  const [showDetailedResults, setShowDetailedResults] = useState(true)

  const sectionCount = useMemo(() => {
    const maxInQuestions = questions.reduce((max, question) => Math.max(max, question.section || 1), 1)
    return Math.max(maxInQuestions, selectedSection)
  }, [questions, selectedSection])

  const questionsBySection = useMemo(() => {
    const grouped = new Map()
    for (let section = 1; section <= sectionCount; section += 1) {
      grouped.set(section, [])
    }

    for (const question of questions) {
      const section = question.section || 1
      if (!grouped.has(section)) grouped.set(section, [])
      grouped.get(section).push(question)
    }

    return grouped
  }, [questions, sectionCount])

  const totalRequired = useMemo(() => questions.filter((question) => question.required).length, [questions])

  // Generar código de quiz único
  const generateQuizCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = ''
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  const updateQuestion = (id, updater) => {
    setQuestions((current) =>
      current.map((question) => {
        if (question.id !== id) return question
        return typeof updater === 'function' ? updater(question) : { ...question, ...updater }
      }),
    )
  }

  const addQuestion = (type = 'multiple_choice') => {
    const next = createQuestion(type, selectedSection)
    setQuestions((current) => [...current, next])
    setActiveQuestionId(next.id)
  }

  const duplicateQuestion = (id) => {
    setQuestions((current) => {
      const index = current.findIndex((question) => question.id === id)
      if (index === -1) return current

      const copy = {
        ...current[index],
        id: crypto.randomUUID(),
        title: `${current[index].title} (copia)`,
        options: [...current[index].options],
        correctAnswers: [...current[index].correctAnswers],
        shortAnswerCorrect: current[index].shortAnswerCorrect || '',
        shortAnswerVariants: current[index].shortAnswerVariants || '',
        numberCorrect: current[index].numberCorrect || '',
        dateCorrect: current[index].dateCorrect || '',
        timeCorrect: current[index].timeCorrect || '',
      }

      const next = [...current]
      next.splice(index + 1, 0, copy)
      return next
    })
  }

  const removeQuestion = (id) => {
    setQuestions((current) => current.filter((question) => question.id !== id))
    setResponses((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
    setResponseErrors((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
    setActiveQuestionId((current) => (current === id ? null : current))
  }

  const addSection = () => {
    setSelectedSection(sectionCount + 1)
  }

  const removeSection = (sectionToRemove) => {
    if (sectionCount <= 1) return

    const removedQuestionIds = new Set(
      questions
        .filter((question) => (question.section || 1) === sectionToRemove)
        .map((question) => question.id),
    )

    setQuestions((current) =>
      current
        .filter((question) => (question.section || 1) !== sectionToRemove)
        .map((question) => {
          const section = question.section || 1
          if (section > sectionToRemove) {
            return { ...question, section: section - 1 }
          }
          return question
        }),
    )

    if (removedQuestionIds.size > 0) {
      setResponses((current) => {
        const next = { ...current }
        removedQuestionIds.forEach((id) => {
          delete next[id]
        })
        return next
      })

      setResponseErrors((current) => {
        const next = { ...current }
        removedQuestionIds.forEach((id) => {
          delete next[id]
        })
        return next
      })

      setActiveQuestionId((current) => (removedQuestionIds.has(current) ? null : current))
    }

    setSelectedSection((current) => {
      if (current === sectionToRemove) return Math.max(1, sectionToRemove - 1)
      if (current > sectionToRemove) return current - 1
      return current
    })

    setPreviewSection((current) => {
      if (current === sectionToRemove) return Math.max(1, sectionToRemove - 1)
      if (current > sectionToRemove) return current - 1
      return current
    })
  }

  const changeQuestionType = (id, type) => {
    updateQuestion(id, (question) => ({
      ...question,
      type,
      options: isChoiceType(type) || type === 'ranking' ? [...DEFAULT_OPTIONS] : question.options,
      correctAnswers: [],
      minSelections: type === 'checkboxes' ? question.minSelections : '',
      maxSelections: type === 'checkboxes' ? question.maxSelections : '',
      minValue: type === 'number' ? question.minValue : '',
      maxValue: type === 'number' ? question.maxValue : '',
      minLength: isTextType(type) ? question.minLength : '',
      maxLength: isTextType(type) ? question.maxLength : '',
      regexPattern: isTextType(type) ? question.regexPattern : '',
      shortAnswerCorrect: type === 'short_answer' ? question.shortAnswerCorrect : '',
      shortAnswerVariants: type === 'short_answer' ? question.shortAnswerVariants : '',
      numberCorrect: type === 'number' ? question.numberCorrect : '',
      dateCorrect: type === 'date' ? question.dateCorrect : '',
      timeCorrect: type === 'time' ? question.timeCorrect : '',
      scaleMin: type === 'emoji_scale' || type === 'star_rating' ? 1 : question.scaleMin,
      scaleMax: type === 'emoji_scale' || type === 'star_rating' ? 5 : question.scaleMax,
    }))

    setResponses((current) => ({ ...current, [id]: undefined }))
    setResponseErrors((current) => ({ ...current, [id]: '' }))
  }

  const updateArrayValue = (id, index, value) => {
    updateQuestion(id, (question) => {
      const next = [...question.options]
      next[index] = value
      return { ...question, options: next }
    })
  }

  const addOption = (id) => {
    updateQuestion(id, (question) => {
      const nextIndex = question.options.length + 1
      return { ...question, options: [...question.options, `Opcion ${nextIndex}`] }
    })
  }

  const removeOption = (id, optionIndex) => {
    updateQuestion(id, (question) => {
      if (question.options.length <= 2) return question

      const nextCorrect = question.correctAnswers
        .filter((value) => value !== optionIndex)
        .map((value) => (value > optionIndex ? value - 1 : value))

      const nextOptions = question.options.filter((_, index) => index !== optionIndex)
      return { ...question, options: nextOptions, correctAnswers: nextCorrect }
    })
  }

  const moveOption = (id, optionIndex, direction) => {
    updateQuestion(id, (question) => {
      const nextIndex = optionIndex + direction
      if (nextIndex < 0 || nextIndex >= question.options.length) return question

      const nextOptions = [...question.options]
        ;[nextOptions[optionIndex], nextOptions[nextIndex]] = [nextOptions[nextIndex], nextOptions[optionIndex]]

      const corrected = question.correctAnswers.map((value) => {
        if (value === optionIndex) return nextIndex
        if (value === nextIndex) return optionIndex
        return value
      })

      return { ...question, options: nextOptions, correctAnswers: corrected }
    })
  }

  const toggleCorrectAnswer = (questionId, optionIndex) => {
    updateQuestion(questionId, (question) => {
      if (question.type === 'checkboxes' || question.type === 'multiple_choice') {
        const exists = question.correctAnswers.includes(optionIndex)
        return {
          ...question,
          correctAnswers: exists
            ? question.correctAnswers.filter((value) => value !== optionIndex)
            : [...question.correctAnswers, optionIndex],
        }
      }

      if (question.type === 'choice_unique' || question.type === 'dropdown') {
        return { ...question, correctAnswers: [optionIndex] }
      }

      return question
    })
  }

  const setRankingCorrectOrder = (questionId) => {
    updateQuestion(questionId, (question) => ({
      ...question,
      correctAnswers: question.options.map((_, index) => index),
    }))
  }

  const updateResponse = (questionId, value) => {
    setResponses((current) => ({ ...current, [questionId]: value }))
    setResponseErrors((current) => ({ ...current, [questionId]: '' }))
  }

  const toggleCheckboxResponse = (questionId, optionIndex) => {
    const currentResponse = responses[questionId]
    const asArray = Array.isArray(currentResponse) ? currentResponse : []
    const exists = asArray.includes(optionIndex)
    const next = exists ? asArray.filter((value) => value !== optionIndex) : [...asArray, optionIndex]
    updateResponse(questionId, next)
  }

  const handleRankingMove = (question, index, direction) => {
    const defaultOrder = question.options.map((_, idx) => idx)
    const current = Array.isArray(responses[question.id]) ? responses[question.id] : defaultOrder
    const valid = current.filter((value) => Number.isInteger(value) && value >= 0 && value < defaultOrder.length)
    const missing = defaultOrder.filter((value) => !valid.includes(value))
    const base = [...valid, ...missing]

    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= base.length) return

      ;[base[index], base[nextIndex]] = [base[nextIndex], base[index]]
    updateResponse(question.id, base)
  }

  const isRequiredByCondition = (question) => {
    return Boolean(question.required)
  }

  const validateQuestion = (question, response) => {
    const shouldBeRequired = isRequiredByCondition(question)

    if (shouldBeRequired && isResponseEmpty(question, response)) {
      return 'Esta pregunta es obligatoria.'
    }

    if (isResponseEmpty(question, response)) {
      return ''
    }

    if (isTextType(question.type)) {
      const text = String(response)
      const minLength = Number(question.minLength)
      const maxLength = Number(question.maxLength)

      if (!Number.isNaN(minLength) && question.minLength !== '' && text.length < minLength) {
        return `Debe tener al menos ${minLength} caracteres.`
      }

      if (!Number.isNaN(maxLength) && question.maxLength !== '' && text.length > maxLength) {
        return `Debe tener como maximo ${maxLength} caracteres.`
      }

      if (question.regexPattern.trim()) {
        try {
          const pattern = new RegExp(question.regexPattern)
          if (!pattern.test(text)) {
            return 'No cumple el formato requerido (regex).'
          }
        } catch {
          return 'La expresion regex configurada no es valida.'
        }
      }

      if (question.type === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(text)) return 'Email invalido.'
      }

      if (question.type === 'url') {
        try {
          const parsed = new URL(text)
          if (!['http:', 'https:'].includes(parsed.protocol)) {
            return 'La URL debe iniciar con http o https.'
          }
        } catch {
          return 'URL invalida.'
        }
      }

      if (question.type === 'phone') {
        const phoneRegex = /^\+?[0-9\s-]{7,20}$/
        if (!phoneRegex.test(text)) return 'Telefono invalido.'
      }
    }

    if (question.type === 'number') {
      const value = Number(response)
      if (Number.isNaN(value)) return 'Debe ser un numero valido.'

      const minValue = Number(question.minValue)
      const maxValue = Number(question.maxValue)

      if (!Number.isNaN(minValue) && question.minValue !== '' && value < minValue) {
        return `El numero debe ser mayor o igual a ${minValue}.`
      }

      if (!Number.isNaN(maxValue) && question.maxValue !== '' && value > maxValue) {
        return `El numero debe ser menor o igual a ${maxValue}.`
      }
    }

    if (question.type === 'checkboxes') {
      const selected = Array.isArray(response) ? response : []
      const minSelections = Number(question.minSelections)
      const maxSelections = Number(question.maxSelections)

      if (!Number.isNaN(minSelections) && question.minSelections !== '' && selected.length < minSelections) {
        return `Selecciona al menos ${minSelections} opciones.`
      }

      if (!Number.isNaN(maxSelections) && question.maxSelections !== '' && selected.length > maxSelections) {
        return `Selecciona como maximo ${maxSelections} opciones.`
      }
    }

    return ''
  }

  const validateSection = (section) => {
    const sectionQuestions = questionsBySection.get(section) ?? []
    const nextErrors = {}
    let hasErrors = false

    for (const question of sectionQuestions) {
      const error = validateQuestion(question, responses[question.id])
      nextErrors[question.id] = error
      if (error) hasErrors = true
    }

    setResponseErrors((current) => ({ ...current, ...nextErrors }))
    return !hasErrors
  }

  const calculateScore = () => {
    let earned = 0
    let total = 0

    for (const question of questions) {
      if (!SCOREABLE_TYPES.has(question.type)) continue

      const normalizedShortAnswerSet = question.type === 'short_answer'
        ? new Set([
          normalizeAnswerText(question.shortAnswerCorrect),
          ...parseShortAnswerVariants(question.shortAnswerVariants).map(normalizeAnswerText),
        ].filter(Boolean))
        : new Set()

      if (question.type === 'short_answer' && normalizedShortAnswerSet.size === 0) {
        continue
      }

      const points = Number(question.points) || 0
      total += points

      const response = responses[question.id]
      if (question.type === 'dropdown' || question.type === 'choice_unique') {
        const selected = Number(response)
        if (!Number.isNaN(selected) && selected === question.correctAnswers[0]) {
          earned += points
        }
      }

      if (question.type === 'multiple_choice' || question.type === 'checkboxes') {
        const selected = Array.isArray(response) ? [...response].sort((a, b) => a - b) : []
        const expected = [...question.correctAnswers].sort((a, b) => a - b)
        if (areArraysEqual(selected, expected)) {
          earned += points
        }
      }

      if (question.type === 'short_answer') {
        if (normalizedShortAnswerSet.has(normalizeAnswerText(response))) {
          earned += points
        }
      }

      if (question.type === 'ranking') {
        const selected = Array.isArray(response) ? response : []
        const expected = question.correctAnswers
        if (expected.length > 0 && areArraysEqual(selected, expected)) {
          earned += points
        }
      }

      if (question.type === 'number') {
        const selected = Number(response)
        const expected = Number(question.numberCorrect)
        if (!Number.isNaN(selected) && !Number.isNaN(expected) && selected === expected) {
          earned += points
        }
      }

      if (question.type === 'date') {
        const selected = String(response ?? '').trim()
        const expected = String(question.dateCorrect ?? '').trim()
        if (selected && expected && selected === expected) {
          earned += points
        }
      }

      if (question.type === 'time') {
        const selected = String(response ?? '').trim()
        const expected = String(question.timeCorrect ?? '').trim()
        if (selected && expected && selected === expected) {
          earned += points
        }
      }
    }

    return { earned, total }
  }

  const goNextSection = () => {
    const ok = validateSection(previewSection)
    if (!ok) return
    setPreviewSection((current) => Math.min(sectionCount, current + 1))
  }

  const goPreviousSection = () => {
    if (previewSection === 1) {
      setIsPreviewOpen(false)
      setPreviewSection(1)
      setResponses({})
      setResponseErrors({})
    } else {
      setPreviewSection((current) => Math.max(1, current - 1))
    }
  }

  const submitResponses = () => {
    let allValid = true
    for (let section = 1; section <= sectionCount; section += 1) {
      const sectionValid = validateSection(section)
      if (!sectionValid) allValid = false
    }

    if (!allValid) return

    setScoreSummary(calculateScore())
    setShowResults(true)
  }

  const previewProgress = Math.round((previewSection / sectionCount) * 100)

  const getTypeBadgeClass = (type) => {
    const tones = {
      short_answer: 'border-primary-300/35 bg-primary-500/18 text-primary-100',
      paragraph: 'border-slate-300/35 bg-slate-500/16 text-slate-100',
      multiple_choice: 'border-blue-300/35 bg-blue-500/18 text-blue-100',
      checkboxes: 'border-emerald-300/35 bg-emerald-500/18 text-emerald-100',
      choice_unique: 'border-cyan-300/35 bg-cyan-500/18 text-cyan-100',
      dropdown: 'border-primary-300/35 bg-primary-500/18 text-primary-100',
      linear_scale: 'border-amber-300/35 bg-amber-500/18 text-amber-100',
      emoji_scale: 'border-yellow-300/35 bg-yellow-500/18 text-yellow-100',
      star_rating: 'border-orange-300/35 bg-orange-500/18 text-orange-100',
      ranking: 'border-fuchsia-300/35 bg-fuchsia-500/18 text-fuchsia-100',
      number: 'border-lime-300/35 bg-lime-500/18 text-lime-100',
      email: 'border-sky-300/35 bg-sky-500/18 text-sky-100',
      url: 'border-teal-300/35 bg-teal-500/18 text-teal-100',
      phone: 'border-rose-300/35 bg-rose-500/18 text-rose-100',
      date: 'border-purple-300/35 bg-purple-500/18 text-purple-100',
      time: 'border-pink-300/35 bg-pink-500/18 text-pink-100',
    }

    return tones[type] || 'border-white/25 bg-white/10 text-slate-100'
  }

  const getQuickAddButtonClass = (type) => {
    const tones = {
      short_answer: 'border-primary-300/25 bg-primary-500/12 text-primary-100 hover:bg-primary-500/20',
      paragraph: 'border-slate-300/25 bg-slate-500/12 text-slate-100 hover:bg-slate-500/20',
      multiple_choice: 'border-blue-300/25 bg-blue-500/12 text-blue-100 hover:bg-blue-500/20',
      checkboxes: 'border-emerald-300/25 bg-emerald-500/12 text-emerald-100 hover:bg-emerald-500/20',
      choice_unique: 'border-cyan-300/25 bg-cyan-500/12 text-cyan-100 hover:bg-cyan-500/20',
      dropdown: 'border-primary-300/25 bg-primary-500/12 text-primary-100 hover:bg-primary-500/20',
      linear_scale: 'border-amber-300/25 bg-amber-500/12 text-amber-100 hover:bg-amber-500/20',
      emoji_scale: 'border-yellow-300/25 bg-yellow-500/12 text-yellow-100 hover:bg-yellow-500/20',
      star_rating: 'border-orange-300/25 bg-orange-500/12 text-orange-100 hover:bg-orange-500/20',
      ranking: 'border-fuchsia-300/25 bg-fuchsia-500/12 text-fuchsia-100 hover:bg-fuchsia-500/20',
      number: 'border-lime-300/25 bg-lime-500/12 text-lime-100 hover:bg-lime-500/20',
      email: 'border-sky-300/25 bg-sky-500/12 text-sky-100 hover:bg-sky-500/20',
      url: 'border-teal-300/25 bg-teal-500/12 text-teal-100 hover:bg-teal-500/20',
      phone: 'border-rose-300/25 bg-rose-500/12 text-rose-100 hover:bg-rose-500/20',
      date: 'border-purple-300/25 bg-purple-500/12 text-purple-100 hover:bg-purple-500/20',
      time: 'border-pink-300/25 bg-pink-500/12 text-pink-100 hover:bg-pink-500/20',
    }

    return tones[type] || 'border-white/20 bg-white/8 text-slate-100 hover:bg-white/15'
  }

  const updateThemeField = (field, value) => {
    if (THEME_COLOR_FIELDS.includes(field)) {
      setSelectedThemePreset('custom')
    }
    setFormTheme((current) => ({ ...current, [field]: value }))
  }

  const applyThemePreset = (presetName) => {
    const preset = THEME_PRESETS[presetName]
    if (!preset) return

    setSelectedThemePreset(presetName)
    setFormTheme((current) => ({
      ...current,
      ...preset,
    }))
  }

  const handleThemeSelectChange = (value) => {
    if (value === 'custom') {
      setSelectedThemePreset('custom')
      setShowCustomThemeModal(true)
      return
    }
    applyThemePreset(value)
  }

  const handleCoverUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setUploadingCover(true)

      const sanitizedName = (file.name || 'cover.jpg').replace(/[^a-zA-Z0-9._-]/g, '_')
      const userId = session?.user?.id || 'anon'
      const filePath = `covers/${userId}/${Date.now()}-${sanitizedName}`

      const { error: uploadError } = await supabase.storage.from('photos').upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      })

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('photos').getPublicUrl(filePath)
      if (!data?.publicUrl) {
        throw new Error('No se pudo obtener la URL publica de la portada.')
      }

      updateThemeField('coverImage', data.publicUrl)
      setShowCoverPickerModal(false)
    } catch (error) {
      console.error('Error al subir portada:', error)
      alert(`No se pudo subir la portada: ${error.message || 'Error desconocido'}`)
    } finally {
      setUploadingCover(false)
      if (event.target) event.target.value = ''
    }
  }

  const applyImportedTemplateToForm = (template, preserveTheme = false) => {
    const normalized = normalizeFormPayload(template)

    const newQuestions = (normalized.questions || []).map((q) => ({
      ...q,
      id: q.id || uuidv4(),
      section: Number(q.section) > 0 ? Number(q.section) : 1,
    }))

    setFormTitle(normalized.title || '')
    setFormDescription(normalized.description || '')
    setFormMode(normalized.formMode || 'normal')
    if (!preserveTheme) {
      setFormTheme(normalized.theme || DEFAULT_FORM_THEME)
    }
    setQuestions(newQuestions)
    setSelectedSection(1)
    setActiveQuestionId(newQuestions[0]?.id || null)
  }

  useEffect(() => {
    const incomingTemplate = location.state?.aiGeneratedTemplate
    if (!incomingTemplate) return

    applyImportedTemplateToForm(incomingTemplate, true)
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])

  const handleLoadTemplate = () => {
    const template = loadFormTemplate()
    applyImportedTemplateToForm(template)
  }

  const handleImportFile = async (file) => {
    try {
      const template = await importFormFromFile(file)
      applyImportedTemplateToForm(template)
      alert('Formulario importado exitosamente')
    } catch (error) {
      console.error('Error al importar:', error)
      alert(`Error al importar: ${error.message}`)
    }
  }

  const handleGenerateFromAi = async () => {
    const prompt = String(aiPrompt || '').trim()
    if (!prompt) {
      setAiGenerationError('Escribe un prompt antes de generar.')
      return
    }

    if (!session?.access_token) {
      setAiGenerationError('No hay sesion activa. Inicia sesion para usar la generacion con IA.')
      return
    }

    setAiGenerationError('')

    try {
      const data = await generateQuiz({
        prompt,
        accessToken: session.access_token,
      }).unwrap()

      applyImportedTemplateToForm(data, true)
    } catch (error) {
      const apiMessage = error?.data?.mensaje || error?.data?.message
      setAiGenerationError(apiMessage || error?.message || 'Error al generar cuestionario con IA')
    }
  }

  const handleExportFile = () => {
    const exportSections = Array.from({ length: sectionCount }, (_, index) => ({
      id: index + 1,
      title: `Seccion ${index + 1}`,
    }))

    const formData = {
      title: formTitle,
      description: formDescription,
      formMode: formMode,
      sections: exportSections,
      questions: questions.map((q) => ({
        id: q.id,
        title: q.title,
        description: q.description,
        type: q.type,
        section: q.section,
        required: q.required,
        requiredConditionEnabled: q.requiredConditionEnabled,
        requiredConditionQuestionId: q.requiredConditionQuestionId,
        requiredConditionValue: q.requiredConditionValue,
        options: q.options || [],
        correctAnswers: q.correctAnswers || [],
        points: q.points || 0,
        minLength: q.minLength,
        maxLength: q.maxLength,
        regexPattern: q.regexPattern,
        shortAnswerCorrect: q.shortAnswerCorrect,
        shortAnswerVariants: q.shortAnswerVariants,
        numberCorrect: q.numberCorrect,
        dateCorrect: q.dateCorrect,
        timeCorrect: q.timeCorrect,
        minValue: q.minValue,
        maxValue: q.maxValue,
        scaleMin: q.scaleMin,
        scaleMax: q.scaleMax,
        scaleMinLabel: q.scaleMinLabel,
        scaleMaxLabel: q.scaleMaxLabel,
        minSelections: q.minSelections,
        maxSelections: q.maxSelections,
      })),
      theme: formTheme,
    }

    const dataStr = JSON.stringify(formData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `formulario-${formTitle.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const renderEditorPreview = (question) => {
    if (question.type === 'short_answer' || question.type === 'email' || question.type === 'url' || question.type === 'phone') {
      return <input className="w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="Respuesta" disabled />
    }

    if (question.type === 'paragraph') {
      return <textarea className="w-full rounded-lg border border-gray-300 px-3 py-2" rows={3} placeholder="Respuesta" disabled />
    }

    if (question.type === 'number') {
      return <input className="w-full rounded-lg border border-gray-300 px-3 py-2" type="number" placeholder="123" disabled />
    }

    if (isChoiceType(question.type)) {
      return (
        <div className="space-y-2">
          {question.options.map((option, index) => (
            <label key={`${question.id}-preview-${index}`} className="flex items-center gap-2 text-sm text-gray-700">
              <input type={question.type === 'checkboxes' || question.type === 'multiple_choice' ? 'checkbox' : 'radio'} disabled />
              {(question.type === 'dropdown' || question.type === 'choice_unique') ? `${index + 1}. ` : ''}
              {option || `Opcion ${index + 1}`}
            </label>
          ))}
        </div>
      )
    }

    if (question.type === 'linear_scale') {
      return (
        <div className="space-y-3">
          <div className="flex justify-between text-xs text-gray-500">
            <span>{question.scaleMinLabel}</span>
            <span>{question.scaleMaxLabel}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            {Array.from({ length: question.scaleMax - question.scaleMin + 1 }, (_, index) => question.scaleMin + index).map((value) => (
              <label key={`${question.id}-lin-${value}`} className="flex flex-col items-center gap-1 text-xs">
                <input type="radio" disabled />
                {value}
              </label>
            ))}
          </div>
        </div>
      )
    }

    if (question.type === 'emoji_scale') {
      const emojis = ['😡', '🙁', '😐', '🙂', '😍']
      return (
        <div className="flex items-center gap-2 text-2xl">
          {emojis.slice(0, Math.min(5, question.scaleMax)).map((emoji, index) => (
            <span key={`${question.id}-emoji-${index}`} className="opacity-70">
              {emoji}
            </span>
          ))}
        </div>
      )
    }

    if (question.type === 'star_rating') {
      return (
        <div className="flex items-center gap-1 text-2xl text-amber-400">
          {Array.from({ length: Math.min(10, question.scaleMax) }, (_, index) => (
            <span key={`${question.id}-star-${index}`}>★</span>
          ))}
        </div>
      )
    }

    if (question.type === 'ranking') {
      return (
        <ol className="space-y-2 text-sm text-gray-700 list-decimal pl-6">
          {question.options.map((option, index) => (
            <li key={`${question.id}-rank-${index}`}>{option || `Opcion ${index + 1}`}</li>
          ))}
        </ol>
      )
    }

    if (question.type === 'date') {
      return <input className="w-full rounded-lg border border-gray-300 px-3 py-2" type="date" disabled />
    }

    if (question.type === 'time') {
      return <input className="w-full rounded-lg border border-gray-300 px-3 py-2" type="time" disabled />
    }

    return null
  }

  const renderRespondentField = (question) => {
    const error = responseErrors[question.id]

    if (question.type === 'short_answer' || question.type === 'email' || question.type === 'url' || question.type === 'phone') {
      return (
        <input
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
          type={question.type === 'phone' ? 'tel' : question.type}
          value={responses[question.id] ?? ''}
          onChange={(event) => updateResponse(question.id, event.target.value)}
          placeholder="Tu respuesta"
        />
      )
    }

    if (question.type === 'paragraph') {
      return (
        <textarea
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
          rows={4}
          value={responses[question.id] ?? ''}
          onChange={(event) => updateResponse(question.id, event.target.value)}
          placeholder="Tu respuesta"
        />
      )
    }

    if (question.type === 'number') {
      return (
        <input
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
          type="number"
          value={responses[question.id] ?? ''}
          onChange={(event) => updateResponse(question.id, event.target.value)}
          placeholder="Numero"
        />
      )
    }

    if (question.type === 'multiple_choice') {
      const selected = Array.isArray(responses[question.id]) ? responses[question.id] : []
      return (
        <div className="space-y-2">
          {question.options.map((option, index) => (
            <label key={`${question.id}-ans-check-${index}`} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={selected.includes(index)}
                onChange={() => toggleCheckboxResponse(question.id, index)}
              />
              {option || `Opcion ${index + 1}`}
            </label>
          ))}
        </div>
      )
    }

    if (question.type === 'checkboxes') {
      const selected = Array.isArray(responses[question.id]) ? responses[question.id] : []
      return (
        <div className="space-y-2">
          {question.options.map((option, index) => (
            <label key={`${question.id}-ans-check-${index}`} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={selected.includes(index)}
                onChange={() => toggleCheckboxResponse(question.id, index)}
              />
              {option || `Opcion ${index + 1}`}
            </label>
          ))}
        </div>
      )
    }

    if (question.type === 'dropdown') {
      return (
        <select
          className="w-full rounded-lg border border-white/20 bg-[#111827] px-3 py-2 text-slate-100 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20"
          value={responses[question.id] ?? ''}
          onChange={(event) => updateResponse(question.id, Number(event.target.value))}
        >
          <option value="" disabled>
            Elegir opcion
          </option>
          {question.options.map((option, index) => (
            <option key={`${question.id}-ans-drop-${index}`} value={index}>
              {option || `Opcion ${index + 1}`}
            </option>
          ))}
        </select>
      )
    }

    if (question.type === 'choice_unique') {
      return (
        <div className="space-y-2">
          {question.options.map((option, index) => (
            <label key={`${question.id}-ans-unique-${index}`} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                name={`answer-${question.id}`}
                checked={Number(responses[question.id]) === index}
                onChange={() => updateResponse(question.id, index)}
              />
              {option || `Opcion ${index + 1}`}
            </label>
          ))}
        </div>
      )
    }

    if (question.type === 'linear_scale') {
      return (
        <div className="space-y-3">
          <div className="flex justify-between text-xs text-gray-500">
            <span>{question.scaleMinLabel}</span>
            <span>{question.scaleMaxLabel}</span>
          </div>
          <div className="flex justify-between gap-2">
            {Array.from({ length: question.scaleMax - question.scaleMin + 1 }, (_, index) => question.scaleMin + index).map((value) => (
              <label key={`${question.id}-ans-lin-${value}`} className="flex flex-col items-center gap-1 text-xs">
                <input
                  type="radio"
                  name={`answer-${question.id}`}
                  checked={Number(responses[question.id]) === value}
                  onChange={() => updateResponse(question.id, value)}
                />
                {value}
              </label>
            ))}
          </div>
        </div>
      )
    }

    if (question.type === 'emoji_scale') {
      const emojis = ['😡', '🙁', '😐', '🙂', '😍']
      return (
        <div className="flex items-center gap-2 text-2xl">
          {emojis.slice(0, Math.min(5, question.scaleMax)).map((emoji, index) => {
            const value = index + 1
            const selected = Number(responses[question.id]) === value
            return (
              <button
                key={`${question.id}-ans-emoji-${value}`}
                type="button"
                onClick={() => updateResponse(question.id, value)}
                className={`rounded-lg border px-2 py-1 transition ${selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                {emoji}
              </button>
            )
          })}
        </div>
      )
    }

    if (question.type === 'star_rating') {
      const maxStars = Math.min(10, question.scaleMax)
      return (
        <div className="flex items-center gap-1 text-2xl text-amber-400">
          {Array.from({ length: maxStars }, (_, index) => {
            const value = index + 1
            const selected = Number(responses[question.id]) >= value
            return (
              <button
                key={`${question.id}-ans-star-${value}`}
                type="button"
                onClick={() => updateResponse(question.id, value)}
                className={selected ? 'opacity-100' : 'opacity-40'}
              >
                ★
              </button>
            )
          })}
        </div>
      )
    }

    if (question.type === 'ranking') {
      const defaultOrder = question.options.map((_, index) => index)
      const current = Array.isArray(responses[question.id]) ? responses[question.id] : defaultOrder
      const valid = current.filter((value) => Number.isInteger(value) && value >= 0 && value < defaultOrder.length)
      const missing = defaultOrder.filter((value) => !valid.includes(value))
      const order = [...valid, ...missing]

      return (
        <div className="space-y-2">
          {order.map((optionIndex, position) => (
            <div key={`${question.id}-ans-rank-${position}`} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
              <span className="w-6 text-sm font-semibold text-gray-500">{position + 1}</span>
              <span className="flex-1 text-sm text-gray-700">{question.options[optionIndex] || `Opcion ${optionIndex + 1}`}</span>
              <button
                type="button"
                disabled={position === 0}
                onClick={() => handleRankingMove(question, position, -1)}
                className="rounded border border-gray-200 px-2 py-1 text-xs disabled:opacity-40"
              >
                Subir
              </button>
              <button
                type="button"
                disabled={position === order.length - 1}
                onClick={() => handleRankingMove(question, position, 1)}
                className="rounded border border-gray-200 px-2 py-1 text-xs disabled:opacity-40"
              >
                Bajar
              </button>
            </div>
          ))}
        </div>
      )
    }

    if (question.type === 'date') {
      return (
        <input
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
          type="date"
          value={responses[question.id] ?? ''}
          onChange={(event) => updateResponse(question.id, event.target.value)}
        />
      )
    }

    if (question.type === 'time') {
      return (
        <input
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
          type="time"
          value={responses[question.id] ?? ''}
          onChange={(event) => updateResponse(question.id, event.target.value)}
        />
      )
    }

    return null
  }

  const persistForm = async (nextStatus = 'draft') => {
    if (!session?.user?.id) {
      setSaveError('Debes iniciar sesión para crear o editar un formulario.')
      return
    }

    setSaveIntent(nextStatus)
    setSaving(true)
    setSaveError(null)

    try {
      let formId = null
      let currentPublicId = public_id
      const normalizedDurationMinutes = Math.max(1, Number(strictDurationMinutes) || 60)
      const strictSettings = {
        strict_duration_enabled: Boolean(strictDurationEnabled),
        strict_duration_minutes: normalizedDurationMinutes,
        strict_window_enabled: Boolean(strictWindowEnabled),
        strict_starts_at: strictWindowEnabled ? toIsoDateTimeOrNull(strictStartsAt) : null,
        strict_ends_at: strictWindowEnabled ? toIsoDateTimeOrNull(strictEndsAt) : null,
        strict_require_auth: formMode === 'strict' ? (strictDurationEnabled ? true : Boolean(strictRequireAuth)) : false,
      }

      const formData = {
        title: formTitle,
        description: formDescription,
        status: nextStatus,
        form_mode: formMode,
        is_quiz: formMode === 'quiz',
        requires_auth: formMode === 'strict' ? (strictDurationEnabled ? true : Boolean(strictRequireAuth)) : false,
        opened_at: strictWindowEnabled ? toIsoDateTimeOrNull(strictStartsAt) : null,
        closed_at: strictWindowEnabled ? toIsoDateTimeOrNull(strictEndsAt) : null,
        settings: strictSettings,
        theme: formTheme,
        cover_image_url: formTheme.coverImage || null,
        join_code: formMode === 'quiz' && !joinCode ? generateQuizCode() : (formMode === 'quiz' ? joinCode : null),
      }

      if (editMode && public_id) {
        const { data: formRow, error: formErr } = await supabase
          .from('forms')
          .update(formData)
          .eq('public_id', public_id)
          .select('id,public_id,join_code,status')
          .single()
        if (formErr) throw formErr
        formId = formRow.id
        currentPublicId = formRow.public_id
        if (formRow.join_code) setJoinCode(formRow.join_code)
        setFormUUID(formRow.id)
        setFormStatus(formRow.status || nextStatus)
        setCurrentPublicId(formRow.public_id || '')
      } else {
        const { data, error } = await supabase
          .from('forms')
          .insert([formData])
          .select('id,public_id,join_code,status')
          .single()
        if (error) throw error
        formId = data.id
        currentPublicId = data.public_id
        if (data.join_code) setJoinCode(data.join_code)
        setFormUUID(data.id)
        setFormStatus(data.status || nextStatus)
        setCurrentPublicId(data.public_id || '')
      }

      if (formId) {
        if (editMode && public_id) {
          await supabase.from('form_question_options').delete().in('question_id',
            (await supabase.from('form_questions').select('id').eq('form_id', formId)).data.map((q) => q.id),
          )
          await supabase.from('form_questions').delete().eq('form_id', formId)
          await supabase.from('form_sections').delete().eq('form_id', formId)
        }

        const sectionMap = new Map()
        let sectionPosition = 1
        for (let section = 1; section <= sectionCount; section += 1) {
          const sectionId = uuidv4()
          sectionMap.set(section, sectionId)
          await supabase.from('form_sections').insert({
            id: sectionId,
            form_id: formId,
            title: `Sección ${section}`,
            description: '',
            position: sectionPosition++,
          })
        }

        for (let idx = 0; idx < questions.length; idx += 1) {
          const q = questions[idx]
          const questionId = uuidv4()
          await supabase.from('form_questions').insert({
            id: questionId,
            form_id: formId,
            section_id: sectionMap.get(q.section || 1),
            position: idx + 1,
            type: q.type,
            title: q.title,
            description: q.description,
            required: q.required,
            required_condition_enabled: q.requiredConditionEnabled,
            required_condition_question_id: null,
            required_condition_operator: '=',
            required_condition_value: q.requiredConditionValue,
            points: q.points,
            settings: {
              short_answer_correct: q.type === 'short_answer' ? (q.shortAnswerCorrect || '').trim() : null,
              short_answer_variants: q.type === 'short_answer' ? parseShortAnswerVariants(q.shortAnswerVariants) : [],
              number_correct: q.type === 'number' && q.numberCorrect !== '' ? Number(q.numberCorrect) : null,
              date_correct: q.type === 'date' ? (q.dateCorrect || null) : null,
              time_correct: q.type === 'time' ? (q.timeCorrect || null) : null,
            },
          })

          if (Array.isArray(q.options) && q.options.length > 0) {
            for (let optIdx = 0; optIdx < q.options.length; optIdx += 1) {
              await supabase.from('form_question_options').insert({
                id: uuidv4(),
                question_id: questionId,
                position: optIdx + 1,
                label: q.options[optIdx],
                value: null,
                is_correct: Array.isArray(q.correctAnswers) ? q.correctAnswers.includes(optIdx) : false,
                metadata: {},
              })
            }
          }
        }
      }

      const successMessage = nextStatus === 'published'
        ? 'Formulario publicado con exito.'
        : 'Borrador guardado con exito.'

      // Replace evita que "atras" vuelva a /form despues de guardar.
      navigate(`/form/${currentPublicId}/edit`, {
        replace: true,
        state: { successToast: successMessage },
      })
    } catch (err) {
      console.error('Error inesperado al guardar:', err)
      setSaveError('Error inesperado al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main
      className={`min-h-screen ${isAiSidebarOpen ? 'lg:pl-90' : 'lg:pl-20'}`}
      style={{
        backgroundImage: `linear-gradient(135deg, ${formTheme.bgFrom}, ${formTheme.bgTo})`,
      }}
    >
      {checkingSession ? (
        <div className="flex items-center justify-center min-h-screen text-gray-700 text-lg">Verificando sesión...</div>
      ) : null}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-20 top-16 h-72 w-72 rounded-full bg-primary-500/20 blur-3xl" />
        <div className="absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-fuchsia-500/15 blur-3xl" />
      </div>

      {isAiSidebarOpen ? (
        <AiPromptSidebar
          prompt={aiPrompt}
          onChangePrompt={setAiPrompt}
          onGenerate={handleGenerateFromAi}
          generating={isGeneratingWithAi}
          error={aiGenerationError}
          onClose={() => setIsAiSidebarOpen(false)}
        />
      ) : null}

      {!isAiSidebarOpen ? (
        <aside className="fixed left-4 top-4 bottom-4 z-30 hidden w-16 lg:flex flex-col items-center rounded-2xl border border-white/15 bg-[#181818] backdrop-blur-xl shadow-[0_18px_38px_rgba(2,6,23,0.55)]">


          <button
            type="button"
            onClick={() => setIsAiSidebarOpen(true)}
            className="mt-3 h-10 w-10 rounded-xl   text-white grid place-items-center transition hover:bg-white/10 cursor-pointer"
            title="Abrir panel IA"
            aria-label="Abrir panel IA"
          >
            <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="5" width="18" height="14" rx="3" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 5v14" />
            </svg>
          </button>



        </aside>
      ) : null}

      <FormBuilderHeader
        formTheme={formTheme}
        isPreviewOpen={isPreviewOpen}
        setIsPreviewOpen={setIsPreviewOpen}
        setShowResults={setShowResults}
        setPreviewSection={setPreviewSection}
        formTitle={formTitle}
        saving={saving}
        checkingSession={checkingSession}
        saveIntent={saveIntent}
        formStatus={formStatus}
        publicFormUrl={currentPublicId ? `${window.location.origin}/form/${currentPublicId}` : ''}
        persistForm={persistForm}
        saveError={saveError}
        onLoadTemplate={handleLoadTemplate}
        onImportFile={handleImportFile}
        onExportFile={handleExportFile}
      />

      {successToast ? (
        <div className="fixed right-5 top-20 z-50 max-w-sm rounded-xl border border-emerald-200 bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
          {successToast}
        </div>
      ) : null}

      {isPreviewOpen ? (formMode === 'quiz' ? (
        <section className="min-h-screen px-5 py-8" style={{ backgroundImage: `linear-gradient(135deg, ${formTheme.bgFrom}, ${formTheme.bgTo})` }}>
          <div className="mx-auto max-w-5xl">
            <div className="mb-8 text-center">
              {formTheme.coverImage ? (
                <div className="mb-6 overflow-hidden rounded-3xl">
                  <img src={formTheme.coverImage} alt="Portada del quiz" className="h-52 w-full object-cover" />
                </div>
              ) : null}
              <h1 className="text-5xl font-bold" style={{ color: formTheme.primary }}>
                {formTitle.trim() || 'Quiz sin titulo'}
              </h1>
              <p className="mt-3 text-lg text-slate-200">{formDescription.trim() || ''}</p>
            </div>

            <div className="space-y-12">
              {questions.map((question) => {
              const shouldBeRequired = isRequiredByCondition(question)
              return (
                <div key={`quiz-respond-${question.id}`} className="space-y-6">
                  <div className="text-center">
                    <h2 className="mb-2 text-3xl font-bold text-white">{question.title || 'Pregunta sin titulo'}</h2>
                    {question.description ? <p className="text-slate-300">{question.description}</p> : null}
                    {shouldBeRequired ? (
                      <span className="mt-3 inline-block rounded-full border border-red-300/40 bg-red-500/15 px-4 py-1 text-sm font-semibold text-red-200">
                        Obligatoria
                      </span>
                    ) : null}
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2 place-items-center">
                    {question.type === 'multiple_choice' || question.type === 'checkboxes' || question.type === 'choice_unique' ? (
                      question.options.map((option, optIndex) => {
                        const isSelected = question.type === 'checkboxes' || question.type === 'multiple_choice'
                          ? Array.isArray(responses[question.id]) && responses[question.id].includes(optIndex)
                          : Number(responses[question.id]) === optIndex
                        const optionColor = getRandomColor(optIndex)
                        return (
                          <button
                            key={`quiz-option-${optIndex}`}
                            onClick={() => {
                              if (question.type === 'checkboxes' || question.type === 'multiple_choice') {
                                toggleCheckboxResponse(question.id, optIndex)
                              } else {
                                updateResponse(question.id, optIndex)
                              }
                            }}
                            className={`relative transform rounded-3xl px-8 py-8 text-center text-xl font-bold transition duration-200 flex items-center justify-center w-full h-24 ${
                              isSelected
                                ? 'shadow-lg hover:scale-105 active:scale-95'
                                : 'hover:scale-105 active:scale-95 opacity-70 hover:opacity-100'
                            }`}
                            style={{
                              backgroundColor: isSelected ? optionColor : 'rgba(0,0,0,0.3)',
                              borderColor: optionColor,
                              borderWidth: isSelected ? '3px' : '2px',
                              color: '#fff',
                            }}
                          >
                            <span>{option || `Opción ${optIndex + 1}`}</span>
                            {isSelected && (
                              <svg className="absolute top-2 right-2 w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>
                        )
                      })
                    ) : (
                      <div className="col-span-full w-full max-w-md">
                        {getRespondentComponent(question, responses, responseErrors, updateResponse, toggleCheckboxResponse, handleRankingMove)}
                      </div>
                    )}
                  </div>

                  {responseErrors[question.id] ? (
                    <p className="rounded-lg border border-red-400/40 bg-red-500/15 p-3 text-sm font-medium text-red-300">
                      ⚠ {responseErrors[question.id]}
                    </p>
                  ) : null}
                </div>
              )
            })}
            </div>

            <div className="mt-12 flex justify-center gap-4">
              <button
                type="button"
                onClick={() => {
                  setIsPreviewOpen(false)
                  setPreviewSection(1)
                  setResponses({})
                  setResponseErrors({})
                }}
                className="rounded-xl border-2 px-6 py-3 text-lg font-bold transition hover:opacity-80"
                style={{ borderColor: formTheme.primary, color: formTheme.primary }}
              >
                ✕ Cerrar
              </button>

              <button
                type="button"
                onClick={submitResponses}
                className="rounded-xl px-6 py-3 text-lg font-bold text-white transition hover:shadow-lg"
                style={{ backgroundColor: formTheme.primary }}
              >
                Enviar
              </button>
            </div>

            {showResults && scoreSummary ? (
              <div className="mt-12 rounded-3xl border-2 p-8 text-center" style={{ borderColor: formTheme.accent, backgroundColor: formTheme.surface }}>
                <h3 className="mb-4 text-4xl font-bold" style={{ color: formTheme.accent }}>
                  ¡Resultado!
                </h3>
                <p className="mb-6 text-5xl font-bold text-white">
                  {scoreSummary.earned} / {scoreSummary.total}
                </p>
                <p className="mb-6 text-lg" style={{ color: formTheme.primary }}>
                  {Math.round((scoreSummary.earned / (scoreSummary.total || 1)) * 100)}% correcto
                </p>

                <div className="mt-4 flex items-center gap-2">
                  <input
                    id="show-detailed-results-quiz"
                    type="checkbox"
                    checked={showDetailedResults}
                    onChange={(event) => setShowDetailedResults(event.target.checked)}
                  />
                  <label htmlFor="show-detailed-results-quiz" className="text-slate-200">
                    Ver detalles por pregunta
                  </label>
                </div>

                {showDetailedResults ? (
                  <ul className="mt-4 space-y-2 text-left text-sm text-slate-300">
                    {questions
                      .filter((question) => SCOREABLE_TYPES.has(question.type))
                      .map((question) => (
                        <li key={`result-quiz-${question.id}`} className="rounded-lg border border-white/20 px-3 py-2">
                          {question.title} ({question.points} pts)
                        </li>
                      ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="min-h-screen px-5 py-8" style={{ backgroundImage: `linear-gradient(135deg, ${formTheme.bgFrom}, ${formTheme.bgTo})` }}>
          <div className="mx-auto max-w-3xl">
            <div className="mb-8">
              {formTheme.coverImage ? (
                <div className="mb-6 overflow-hidden rounded-xl border border-white/10">
                  <img src={formTheme.coverImage} alt="Portada del formulario" className="h-48 w-full object-cover" />
                </div>
              ) : null}
              <h2 className="text-4xl font-bold text-white">{formTitle.trim() || 'Formulario sin titulo'}</h2>
              <p className="mt-3 text-slate-200">{formDescription.trim() || 'Sin descripcion'}</p>

              <div className="mt-6 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold uppercase text-slate-300">
                  <span>Sección {previewSection} de {sectionCount}</span>
                  <span>{previewProgress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${previewProgress}%`,
                      backgroundImage: `linear-gradient(90deg, ${formTheme.primary}, ${formTheme.accent})`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {(questionsBySection.get(previewSection) ?? []).map((question, index) => {
                const shouldBeRequired = isRequiredByCondition(question)
                return (
                  <article
                    key={`respond-${question.id}`}
                    className="space-y-3 py-4"
                  >
                    <div className="mb-3 flex items-start justify-between gap-4">
                      <h3 className="text-lg font-semibold text-white">
                        {index + 1}. {question.title || 'Pregunta sin titulo'}
                        {shouldBeRequired ? <span className="ml-2 text-red-300">*</span> : null}
                      </h3>
                    </div>

                    {question.description ? <p className="mb-4 text-sm text-slate-300">{question.description}</p> : null}
                    <div className="p-0">
                      {getRespondentComponent(question, responses, responseErrors, updateResponse, toggleCheckboxResponse, handleRankingMove)}
                    </div>

                    {responseErrors[question.id] ? (
                      <p className="mt-3 rounded-lg border border-red-400/30 bg-red-500/10 p-2 text-sm font-medium text-red-300">⚠ {responseErrors[question.id]}</p>
                    ) : null}
                  </article>
                )
              })}
            </div>

            <div className="mt-8 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={goPreviousSection}
                className="rounded-lg border-2 px-6 py-2 text-sm font-semibold transition hover:opacity-80 active:scale-95"
                style={{ borderColor: formTheme.primary, color: formTheme.primary }}
              >
                {previewSection === 1 ? '✕ Cerrar' : '← Atrás'}
              </button>

              {previewSection < sectionCount ? (
                <button
                  type="button"
                  onClick={goNextSection}
                  className="rounded-lg px-6 py-2 text-sm font-semibold text-white transition hover:shadow-lg hover:scale-105 active:scale-95"
                  style={{ backgroundColor: formTheme.primary }}
                >
                  Siguiente →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submitResponses}
                  disabled
                  className="rounded-lg px-6 py-2 text-sm font-semibold text-white transition opacity-50 cursor-not-allowed"
                  style={{ backgroundColor: formTheme.primary }}
                >
                  Enviar
                </button>
              )}
            </div>

            {showResults && scoreSummary ? (
              <div className="mt-8 rounded-2xl border border-white/10 bg-white/8 p-8 text-center backdrop-blur-sm">
                <h3 className="text-3xl font-bold text-white">Resultados</h3>
                <p className="mt-4 text-5xl font-bold" style={{ color: formTheme.primary }}>
                  {scoreSummary.earned} / {scoreSummary.total}
                </p>
                <p className="mt-4 text-lg text-slate-200">
                  {Math.round((scoreSummary.earned / (scoreSummary.total || 1)) * 100)}% correcto
                </p>

                <div className="mt-6 flex items-center justify-center gap-2">
                  <input
                    id="show-detailed-results"
                    type="checkbox"
                    checked={showDetailedResults}
                    onChange={(event) => setShowDetailedResults(event.target.checked)}
                  />
                  <label htmlFor="show-detailed-results" className="text-sm text-slate-300">
                    Ver detalles por pregunta
                  </label>
                </div>

                {showDetailedResults ? (
                  <ul className="mt-4 space-y-2 text-left text-sm text-slate-300">
                    {questions
                      .filter((question) => SCOREABLE_TYPES.has(question.type))
                      .map((question) => (
                        <li key={`result-${question.id}`} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2">
                          {question.title} ({question.points} pts)
                        </li>
                      ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      )) : (
        <section className="mx-auto max-w-6xl px-5 py-8 pb-28 lg:pr-[23rem]">
          <article className="mb-7 rounded-2xl border border-white/10 bg-[#0b1324]/90 p-6 shadow-[0_16px_40px_rgba(2,6,23,0.45)] lg:fixed lg:right-5 lg:top-24 lg:z-20 lg:w-[21rem] lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-100">Configuración</h2>
            </div>

            <div className="mb-4 rounded-xl ">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                Tema 
                <select
                  value={selectedThemePreset}
                  onChange={(event) => handleThemeSelectChange(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-white/15 bg-[#111827] px-3 py-2 text-sm text-slate-100 outline-none focus:border-primary-400"
                >
                  {THEME_PRESET_OPTIONS.map((preset) => (
                    <option key={preset.value} value={preset.value}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {selectedThemePreset === 'custom' ? (
              <button
                type="button"
                onClick={() => setShowCustomThemeModal(true)}
                className="mt-3 w-full rounded-lg border border-cyan-300/30 bg-cyan-500/12 px-3 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
              >
                Ajustar colores personalizados
              </button>
            ) : null}

            <div className="mt-4 rounded-xl ">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Portada</p>
              <div className="mt-3 space-y-2">
                <button
                  type="button"
                  onClick={() => setShowCoverPickerModal(true)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <circle cx="8.5" cy="10" r="1.5" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 16l-5-5-4 4-2-2-4 4" />
                  </svg>
                  Seleccionar portada
                </button>
                {formTheme.coverImage ? (
                  <button
                    type="button"
                    onClick={() => updateThemeField('coverImage', '')}
                    className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                  >
                    Quitar portada
                  </button>
                ) : null}
              </div>
            </div>

            {formMode === 'strict' || formMode === 'quiz' ? (
              <p className="mt-4 rounded-lg border border-white/15 bg-[#0f172a]/70 px-3 py-2 text-xs text-slate-300">
                Los controles de este modo se muestran en un panel flotante abajo a la derecha.
              </p>
            ) : null}

    
          </article>
          <div className="mb-5 rounded-xl ">
                   <p className="mt-2 text-xs text-slate-400">
              {(FORM_MODES.find((mode) => mode.value === formMode) || FORM_MODES[0]).help}
            </p>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {FORM_MODES.map((mode) => {
                const isActiveMode = formMode === mode.value
                return (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => setFormMode(mode.value)}
                    className={`cursor-pointer rounded-xl border px-3 py-2 text-sm font-semibold transition ${isActiveMode
                      ? 'border-primary-300/35 bg-linear-to-r from-primary-600 to-primary-600 text-white shadow-[0_8px_22px_rgba(79,70,229,0.35)]'
                      : 'border-white/20 bg-[#111827] text-slate-300 hover:bg-[#1a2336]'
                      }`}
                  >
                    {mode.label}
                  </button>
                )
              })}
            </div>
     
          </div>
          <article
            className="mt-10 mb-7 rounded-2xl "
          >


            {formTheme.coverImage ? (
              <div className="mb-6 overflow-hidden rounded-2xl ">
                <img src={formTheme.coverImage} alt="Portada del formulario" className="h-44 w-full object-cover" />
              </div>
            ) : null}
            <input
              value={formTitle}
              onChange={(event) => setFormTitle(event.target.value)}
              className="w-full border-b border-white/20 bg-transparent pb-2 text-3xl font-bold text-slate-100 outline-none transition focus:border-primary-400"
              placeholder="Formulario sin titulo"
              aria-label="Titulo del formulario"
            />
            <textarea
              value={formDescription}
              onChange={(event) => setFormDescription(event.target.value)}
              className="mt-3 w-full resize-none bg-transparent text-slate-300 outline-none"
              rows={2}
              placeholder="Descripcion del formulario"
              aria-label="Descripcion del formulario"
            />

            <p className="mt-4 text-sm text-gray-500">
              {questions.length} preguntas | {totalRequired} obligatorias | {sectionCount} secciones
            </p>
          </article>

          <article
            className="mb-7  "
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-200">Secciones</p>
                <button
                  type="button"
                  onClick={() => setShowAddQuestionModal(true)}
                  className="rounded-xl border border-primary-300/30 bg-linear-to-r from-primary-600 to-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:from-primary-500 hover:to-primary-500"
                >
                  + Agregar pregunta
                </button>
              </div>

              <div className="border-b border-slate-500/30">
                <div className="flex items-center gap-5 overflow-x-auto pb-0">
                  {Array.from({ length: sectionCount }, (_, index) => index + 1).map((section) => {
                    const isActiveSection = selectedSection === section
                    return (
                      <div key={`section-tab-${section}`} className="group relative flex items-center">
                        <button
                          type="button"
                          onClick={() => setSelectedSection(section)}
                          className={`border-b-2 px-4 pb-3 pt-1 text-sm font-semibold whitespace-nowrap transition ${isActiveSection
                            ? 'border-primary-400 text-primary-300'
                            : 'border-transparent text-slate-400 hover:text-slate-200'
                            }`}
                        >
                          Sección {section}
                        </button>

                        {sectionCount > 1 ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              removeSection(section)
                            }}
                            className="ml-1 inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-full   font-bold text-red-400 opacity-0 transition group-hover:opacity-100"
                            title={`Eliminar sección ${section}`}
                            aria-label={`Eliminar sección ${section}`}
                          >
                            <CloseIcon className="size-4" />
                          </button>
                        ) : null}
                      </div>
                    )
                  })}

                  <button
                    type="button"
                    onClick={addSection}
                    className="border-b-2 border-transparent px-1 pb-3 pt-1 text-sm font-semibold whitespace-nowrap text-cyan-300 transition hover:text-cyan-200"
                  >
                    + Nueva sección
                  </button>
                </div>
              </div>
            </div>
          </article>

          <section className="space-y-6">
            {isGeneratingWithAi ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }, (_, idx) => (
                  <article
                    key={`ai-skeleton-${idx}`}
                    className="overflow-hidden rounded-2xl border border-white/70 bg-white/85 p-5 shadow-[0_12px_24px_rgba(15,23,42,0.08)]"
                  >
                    <div className="mb-3 h-4 w-1/3 rounded bg-gray-200/80 shimmer-strip" />
                    <div className="mb-5 h-6 w-4/5 rounded bg-gray-200/80 shimmer-strip" />
                    <div className="space-y-2">
                      <div className="h-3 w-full rounded bg-gray-200/70 shimmer-strip" />
                      <div className="h-3 w-11/12 rounded bg-gray-200/70 shimmer-strip" />
                      <div className="h-3 w-9/12 rounded bg-gray-200/70 shimmer-strip" />
                    </div>
                  </article>
                ))}
              </div>
            ) : null}

            {(questionsBySection.get(selectedSection) ?? []).length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-white/20 bg-[#0b1324]/80 p-10 text-center shadow-[0_12px_28px_rgba(2,6,23,0.35)]">
                <h2 className="text-xl font-bold text-slate-100">No hay preguntas en esta seccion</h2>
                <p className="mt-2 text-sm text-slate-400">Agrega preguntas para comenzar.</p>
              </div>
            ) : null}

            {!isGeneratingWithAi && (questionsBySection.get(selectedSection) ?? []).map((question, index) => {
              const currentType = QUESTION_TYPES.find((item) => item.value === question.type) ?? QUESTION_TYPES[0]
              const isActive = activeQuestionId === question.id
              const showSettings = Boolean(openQuestionSettings[question.id])
              const hasConfigSettings = isTextType(question.type) || question.type === 'number'

              return (
                <article
                  key={question.id}
                  className={`soft-enter overflow-hidden rounded-2xl border-2 bg-white/3 shadow-[0_14px_30px_rgba(2,6,23,0.2)] transition ${isActive ? 'border-primary-800 ring-2 ring-primary-400/20' : 'border-white/5 hover:border-white/15'}`}
                  onClick={() => setActiveQuestionId(question.id)}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-linear-to-r from-[#0f172a] to-[#111827] px-5 py-3">
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-300">Pregunta {index + 1}</p>
                      <p className="text-xs text-slate-400">Seccion {question.section}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={question.section}
                        onChange={(event) => {
                          event.stopPropagation()
                          updateQuestion(question.id, { section: Number(event.target.value) })
                        }}
                        className="rounded-lg border border-white/20 bg-[#111827] px-2 py-1 text-xs text-slate-100 outline-none focus:border-primary-400"
                      >
                        {Array.from({ length: sectionCount }, (_, idx) => idx + 1).map((section) => (
                          <option key={`${question.id}-section-${section}`} value={section}>
                            Seccion {section}
                          </option>
                        ))}
                      </select>

                      <div className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-[#111827] px-2 py-1.5">
                        <QuestionTypeIcon type={question.type} className="h-4 w-4 text-slate-300" />
                        <select
                          value={question.type}
                          onChange={(event) => {
                            event.stopPropagation()
                            changeQuestionType(question.id, event.target.value)
                          }}
                          className="bg-transparent pr-1 text-sm text-slate-100 outline-none focus:text-primary-300"
                        >
                          {QUESTION_TYPES.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="border-b border-white/10 px-5 py-2.5 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <strong className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${getTypeBadgeClass(question.type)}`}>
                          <QuestionTypeIcon type={question.type} className="h-3.5 w-3.5 mr-1" />
                          {currentType.label}
                        </strong>
                        <p className="truncate text-xs text-slate-400">{currentType.help}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-300">
                          Puntaje
                          <input
                            type="number"
                            min={0}
                            value={question.points}
                            onChange={(event) => updateQuestion(question.id, { points: Number(event.target.value) || 0 })}
                            className="ml-2 w-16 rounded-md border border-white/20 bg-[#111827] px-2 py-1 text-xs text-slate-100"
                          />
                        </label>
                        {hasConfigSettings ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              setOpenQuestionSettings((current) => ({ ...current, [question.id]: !current[question.id] }))
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-[#111827] px-2 py-1 text-xs font-semibold text-slate-200 transition hover:border-primary-300/35 hover:text-primary-200"
                          >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.7 1.7 0 00.33 1.87l.06.06a2 2 0 01-2.82 2.82l-.06-.06a1.7 1.7 0 00-1.87-.33 1.7 1.7 0 00-1 1.55V21a2 2 0 11-4 0v-.09a1.7 1.7 0 00-1-1.55 1.7 1.7 0 00-1.87.33l-.06.06a2 2 0 11-2.82-2.82l.06-.06A1.7 1.7 0 004.6 15a1.7 1.7 0 00-1.55-1H3a2 2 0 110-4h.09A1.7 1.7 0 004.64 9a1.7 1.7 0 00-.33-1.87l-.06-.06a2 2 0 112.82-2.82l.06.06a1.7 1.7 0 001.87.33h.01A1.7 1.7 0 0010 3.09V3a2 2 0 114 0v.09a1.7 1.7 0 001 1.55 1.7 1.7 0 001.87-.33l.06-.06a2 2 0 112.82 2.82l-.06.06A1.7 1.7 0 0019.36 9v.01A1.7 1.7 0 0020.91 10H21a2 2 0 110 4h-.09a1.7 1.7 0 00-1.52 1z" />
                            </svg>
                            Ajustes
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 border-b border-white/10 px-5 py-5">
                    <textarea
                      value={question.title}
                      onChange={(event) => updateQuestion(question.id, { title: event.target.value })}
                      className="w-full resize-none border-b border-white/20 bg-transparent pb-2 text-lg font-semibold leading-6 text-slate-100 outline-none"
                      rows={2}
                      placeholder="Titulo de la pregunta"
                    />
                    <textarea
                      value={question.description}
                      onChange={(event) => updateQuestion(question.id, { description: event.target.value })}
                      className="w-full resize-none bg-transparent text-sm leading-5 text-slate-300 outline-none"
                      rows={2}
                      placeholder="Descripcion opcional"
                    />
                  </div>

                  {(isChoiceType(question.type) || question.type === 'ranking') ? (
                    <div className="space-y-3 border-b border-white/10 px-5 py-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-100">Opciones</p>
                        {question.type === 'ranking' ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              setRankingCorrectOrder(question.id)
                            }}
                            className="rounded border border-emerald-400/30 bg-emerald-500/15 px-2 py-1 text-xs font-medium text-emerald-200"
                          >
                            Guardar orden actual como correcta
                          </button>
                        ) : (question.type === 'multiple_choice' || question.type === 'choice_unique') ? (
                          <span className="rounded-full border border-primary-300/30 bg-primary-500/15 px-3 py-1 text-xs font-semibold text-primary-100">
                            Correctas: {question.correctAnswers.length}
                          </span>
                        ) : null}
                      </div>

                      {question.type === 'dropdown' ? (
                        <label className="block text-sm text-slate-300">
                          Respuesta correcta
                          <select
                            value={question.correctAnswers[0] ?? ''}
                            onChange={(event) => {
                              const value = event.target.value
                              updateQuestion(question.id, {
                                correctAnswers: value === '' ? [] : [Number(value)],
                              })
                            }}
                            className="mt-1 w-full rounded-lg border border-white/20 bg-[#111827] px-3 py-2 text-slate-100"
                          >
                            <option value="">Sin respuesta correcta</option>
                            {question.options.map((option, optionIndex) => (
                              <option key={`${question.id}-dropdown-correct-${optionIndex}`} value={optionIndex}>
                                {option || `Opcion ${optionIndex + 1}`}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}

                      {question.options.map((option, optionIndex) => (
                        <div key={`${question.id}-option-${optionIndex}`} className="flex flex-wrap items-center gap-2">
                          {question.type === 'ranking' ? (
                            <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-fuchsia-300/35 bg-fuchsia-500/15 px-2 text-xs font-bold text-fuchsia-100">
                              {optionIndex + 1}
                            </span>
                          ) : null}
                          <input
                            value={option}
                            onChange={(event) => updateArrayValue(question.id, optionIndex, event.target.value)}
                            className="min-w-55 flex-1 rounded-lg border border-white/20 bg-[#111827] px-3 py-2 text-sm text-slate-100"
                          />

                          {question.type !== 'ranking' && question.type !== 'checkboxes' ? (
                            <button
                              type="button"
                              onClick={() => toggleCorrectAnswer(question.id, optionIndex)}
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition hover:-translate-y-0.5 ${question.correctAnswers.includes(optionIndex)
                                ? 'border-emerald-300/35 bg-emerald-500/20 text-emerald-100'
                                : 'border-white/20 bg-white/5 text-slate-200 hover:bg-white/10'
                                }`}
                            >
                              {question.correctAnswers.includes(optionIndex) ? (
                                <>
                                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.2 7.2a1 1 0 01-1.415 0l-3-3a1 1 0 111.414-1.42l2.293 2.294 6.493-6.494a1 1 0 011.415 0z" clipRule="evenodd" />
                                  </svg>
                                  Correcta
                                </>
                              ) : (
                                'Marcar correcta'
                              )}
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                disabled={optionIndex === 0}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  moveOption(question.id, optionIndex, -1)
                                }}
                                className="rounded-lg border border-white/20 bg-[#111827] px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-primary-300/35 hover:bg-[#1a2336] disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                disabled={optionIndex === question.options.length - 1}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  moveOption(question.id, optionIndex, 1)
                                }}
                                className="rounded-lg border border-white/20 bg-[#111827] px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-primary-300/35 hover:bg-[#1a2336] disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                ↓
                              </button>
                            </>
                          )}

                          <button
                            type="button"
                            onClick={() => removeOption(question.id, optionIndex)}
                            className="rounded-lg px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/10"
                          >
                            Quitar
                          </button>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => addOption(question.id)}
                        className="w-full rounded-lg border-2 border-dashed border-primary-300/35 px-3 py-2 text-sm font-medium text-primary-200"
                      >
                        + Agregar opcion
                      </button>
                    </div>
                  ) : null}

                  {(question.type === 'linear_scale' || question.type === 'emoji_scale' || question.type === 'star_rating') ? (
                    <div className="grid gap-2 border-b border-white/10 px-5 py-3 md:grid-cols-2">
                      {question.type === 'linear_scale' ? (
                        <>
                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Min
                            <input
                              type="number"
                              value={question.scaleMin}
                              onChange={(event) => updateQuestion(question.id, { scaleMin: Number(event.target.value) || 1 })}
                              className="mt-1 w-full rounded-md border border-white/20 bg-[#111827] px-2.5 py-1.5 text-sm text-slate-100 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20"
                            />
                          </label>
                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Max
                            <input
                              type="number"
                              value={question.scaleMax}
                              onChange={(event) => updateQuestion(question.id, { scaleMax: Math.max(Number(event.target.value) || 2, question.scaleMin + 1) })}
                              className="mt-1 w-full rounded-md border border-white/20 bg-[#111827] px-2.5 py-1.5 text-sm text-slate-100 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20"
                            />
                          </label>
                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Etiqueta min
                            <input
                              value={question.scaleMinLabel}
                              onChange={(event) => updateQuestion(question.id, { scaleMinLabel: event.target.value })}
                              className="mt-1 w-full rounded-md border border-white/20 bg-[#111827] px-2.5 py-1.5 text-sm text-slate-100 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20"
                            />
                          </label>
                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Etiqueta max
                            <input
                              value={question.scaleMaxLabel}
                              onChange={(event) => updateQuestion(question.id, { scaleMaxLabel: event.target.value })}
                              className="mt-1 w-full rounded-md border border-white/20 bg-[#111827] px-2.5 py-1.5 text-sm text-slate-100 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20"
                            />
                          </label>
                          <div className="md:col-span-2 rounded-lg border border-amber-300/20 bg-amber-500/8 px-3 py-2 text-xs text-amber-100">
                            Vista: {question.scaleMin} {question.scaleMinLabel || 'Inicio'} - {question.scaleMax} {question.scaleMaxLabel || 'Fin'}
                          </div>
                        </>
                      ) : (
                        <div className="md:col-span-2 rounded-xl border border-white/15 bg-[#111827] px-4 py-3 text-sm text-slate-300">
                          {question.type === 'emoji_scale' ? (
                            <>
                              Escala fija de 1 a 5.
                              <div className="mt-2 text-lg">😞 😐 🙂 😊 😄</div>
                            </>
                          ) : (
                            <>
                              Escala fija de 1 a 5 estrellas.
                              <div className="mt-2 text-lg text-amber-300">★ ★ ★ ★ ★</div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ) : null}

                  {isTextType(question.type) && showSettings ? (
                    <div className="grid gap-2 border-b border-white/10 px-5 py-3 md:grid-cols-3">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Min
                        <input
                          value={question.minLength}
                          onChange={(event) => updateQuestion(question.id, { minLength: event.target.value })}
                          className="mt-1 w-full rounded-md border border-white/20 bg-[#111827] px-2.5 py-1.5 text-sm text-slate-100 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20"
                          type="number"
                        />
                      </label>
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Max
                        <input
                          value={question.maxLength}
                          onChange={(event) => updateQuestion(question.id, { maxLength: event.target.value })}
                          className="mt-1 w-full rounded-md border border-white/20 bg-[#111827] px-2.5 py-1.5 text-sm text-slate-100 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20"
                          type="number"
                        />
                      </label>
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400 md:col-span-3">
                        Regex personalizada
                        <input
                          value={question.regexPattern}
                          onChange={(event) => updateQuestion(question.id, { regexPattern: event.target.value })}
                          className="mt-1 w-full rounded-md border border-white/20 bg-[#111827] px-2.5 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20"
                          placeholder="Ejemplo: ^[A-Z]{3}[0-9]{3}$"
                        />
                      </label>

                    </div>
                  ) : null}

                  {question.type === 'short_answer' ? (
                    <div className="grid gap-2 border-b border-white/10 px-5 py-3 md:grid-cols-3">
                      <label className="text-sm text-slate-300 md:col-span-3">
                        Respuesta correcta
                        <input
                          value={question.shortAnswerCorrect || ''}
                          onChange={(event) => updateQuestion(question.id, { shortAnswerCorrect: event.target.value })}
                          className="mt-1 w-full rounded-lg border border-emerald-300/30 bg-[#0f172a] px-3 py-2 text-emerald-100 placeholder:text-emerald-200/50 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
                          placeholder="Escribe la respuesta valida"
                        />
                      </label>

                      <label className="text-sm text-slate-300 md:col-span-3">
                        Variantes validas
                        <textarea
                          value={question.shortAnswerVariants || ''}
                          onChange={(event) => updateQuestion(question.id, { shortAnswerVariants: event.target.value })}
                          className="mt-1 w-full rounded-lg border border-white/20 bg-[#111827] px-3 py-2 text-slate-100 placeholder:text-slate-500 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20"
                          rows={3}
                          placeholder="Una variante por linea o separadas por coma."
                        />
                      </label>
                    </div>
                  ) : null}

                  {question.type === 'number' ? (
                    <>
                      {showSettings ? (
                        <div className="grid gap-2 border-b border-white/10 px-5 py-3 md:grid-cols-2">
                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Min
                            <input
                              type="number"
                              value={question.minValue}
                              onChange={(event) => updateQuestion(question.id, { minValue: event.target.value })}
                              className="mt-1 w-full rounded-md border border-white/20 bg-[#111827] px-2.5 py-1.5 text-sm text-slate-100 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20"
                            />
                          </label>
                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Max
                            <input
                              type="number"
                              value={question.maxValue}
                              onChange={(event) => updateQuestion(question.id, { maxValue: event.target.value })}
                              className="mt-1 w-full rounded-md border border-white/20 bg-[#111827] px-2.5 py-1.5 text-sm text-slate-100 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20"
                            />
                          </label>
                        </div>
                      ) : null}

                      <div className="grid gap-3 border-b border-white/10 px-5 py-4 md:grid-cols-2">
                        <label className="text-sm text-slate-300 md:col-span-2">
                          Respuesta correcta
                          <input
                            type="number"
                            value={question.numberCorrect || ''}
                            onChange={(event) => updateQuestion(question.id, { numberCorrect: event.target.value })}
                            className="mt-1 w-full rounded-lg border border-emerald-300/30 bg-[#0f172a] px-3 py-2 text-emerald-100 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
                            placeholder="Ejemplo: 42"
                          />
                        </label>
                      </div>
                    </>
                  ) : null}

                  {question.type === 'date' ? (
                    <div className="grid gap-3 border-b border-white/10 px-5 py-4 md:grid-cols-2">
                      <label className="text-sm text-slate-300 md:col-span-2">
                        Respuesta correcta
                        <input
                          type="date"
                          value={question.dateCorrect || ''}
                          onChange={(event) => updateQuestion(question.id, { dateCorrect: event.target.value })}
                          className="mt-1 w-full rounded-lg border border-emerald-300/30 bg-[#0f172a] px-3 py-2 text-emerald-100 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
                        />
                      </label>
                    </div>
                  ) : null}

                  {question.type === 'time' ? (
                    <div className="grid gap-3 border-b border-white/10 px-5 py-4 md:grid-cols-2">
                      <label className="text-sm text-slate-300 md:col-span-2">
                        Respuesta correcta
                        <input
                          type="time"
                          value={question.timeCorrect || ''}
                          onChange={(event) => updateQuestion(question.id, { timeCorrect: event.target.value })}
                          className="mt-1 w-full rounded-lg border border-emerald-300/30 bg-[#0f172a] px-3 py-2 text-emerald-100 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
                        />
                      </label>
                    </div>
                  ) : null}

                  {question.type === 'checkboxes' ? (
                    <div className="grid gap-2 border-b border-white/10 px-5 py-3 md:grid-cols-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Min selecciones
                        <input
                          type="number"
                          value={question.minSelections}
                          onChange={(event) => updateQuestion(question.id, { minSelections: event.target.value })}
                          className="mt-1 w-full rounded-md border border-white/20 bg-[#111827] px-2.5 py-1.5 text-sm text-slate-100 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20"
                        />
                      </label>
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Max selecciones
                        <input
                          type="number"
                          value={question.maxSelections}
                          onChange={(event) => updateQuestion(question.id, { maxSelections: event.target.value })}
                          className="mt-1 w-full rounded-md border border-white/20 bg-[#111827] px-2.5 py-1.5 text-sm text-slate-100 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20"
                        />
                      </label>
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between gap-3 bg-transparent px-5 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => duplicateQuestion(question.id)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-white/5 text-slate-200 transition hover:bg-white/10"
                        aria-label="Duplicar pregunta"
                        title="Duplicar"
                      >
                        <DuplicateIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeQuestion(question.id)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-300/30 bg-red-500/8 text-red-300 transition hover:bg-red-500/15"
                        aria-label="Eliminar pregunta"
                        title="Eliminar"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>

                    <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                      Obligatorio
                      <span className="relative inline-flex items-center">
                        <input
                          type="checkbox"
                          checked={question.required}
                          onChange={(event) => updateQuestion(question.id, { required: event.target.checked })}
                          className="peer sr-only"
                        />
                        <span className="h-6 w-11 rounded-full bg-slate-600/60 transition peer-checked:bg-primary-500" />
                        <span className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
                      </span>
                    </label>
                  </div>

                </article>
              )
            })}
          </section>
        </section>
      )}

      {showAddQuestionModal && !isPreviewOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setShowAddQuestionModal(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-white/15 bg-black shadow-[0_24px_60px_rgba(2,6,23,0.8)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-100">Agregar pregunta</h3>
                <p className="text-xs text-slate-400">Selecciona el tipo que deseas insertar en la sección actual.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddQuestionModal(false)}
                className="h-9 w-9 rounded-full border border-white/20 bg-white/5 text-slate-300 transition hover:bg-white/10"
                aria-label="Cerrar modal"
              >
                ×
              </button>
            </div>

            <div className="max-h-[62vh] overflow-y-auto p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                {QUESTION_TYPES.map((type) => (
                  <div key={`modal-add-${type.value}`} className="group relative">
                    <button
                      type="button"
                      onClick={() => {
                        addQuestion(type.value)
                        setShowAddQuestionModal(false)
                      }}
                      className="w-full rounded-xl border border-white/15 bg-[#111827] px-4 py-3 text-left text-sm font-semibold text-slate-100 transition hover:border-primary-300/40 hover:bg-[#172034]"
                    >
                      <span className="inline-flex items-center gap-2.5">
                        <QuestionTypeIcon type={type.value} className="h-4 w-4 text-slate-300" />
                        {type.label}
                      </span>
                    </button>

                    <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 rounded-lg border border-white/15 bg-[#0f172a] px-3 py-2 text-xs text-slate-200 opacity-0 shadow-[0_10px_30px_rgba(2,6,23,0.5)] transition group-hover:opacity-100">
                      {type.help}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showCoverPickerModal && !isPreviewOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          onClick={() => setShowCoverPickerModal(false)}
        >
          <div
            className="w-full max-w-3xl rounded-3xl border border-white/20 bg-black shadow-[0_28px_70px_rgba(0,0,0,0.7)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
              <div>
                <h3 className="text-xl font-bold tracking-tight text-slate-100">Selector de portada</h3>
                <p className="mt-1 text-xs text-slate-400">Elige una portada predefinida o sube una imagen propia.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCoverPickerModal(false)}
                className="h-9 w-9 rounded-full border border-white/20 bg-white/5 text-slate-300 transition hover:bg-white/10"
                aria-label="Cerrar selector de portada"
              >
                ×
              </button>
            </div>

            <div className="max-h-[65vh] space-y-4 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {COVER_IMAGE_OPTIONS.map((coverUrl, index) => {
                  const isSelected = formTheme.coverImage === coverUrl
                  return (
                    <button
                      key={`cover-modal-option-${index + 1}`}
                      type="button"
                      onClick={() => {
                        updateThemeField('coverImage', coverUrl)
                        setShowCoverPickerModal(false)
                      }}
                      className={`group relative overflow-hidden rounded-xl border bg-[#0f0f10] transition ${isSelected
                        ? 'border-primary-300 ring-2 ring-primary-400/40'
                        : 'border-white/15 hover:border-white/35 hover:-translate-y-0.5'
                        }`}
                    >
                      <img src={coverUrl} alt={`Portada predefinida ${index + 1}`} className="h-28 w-full object-cover transition duration-200 group-hover:scale-[1.03]" />
                      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent px-2 py-1 text-left text-[11px] font-semibold text-slate-200">
                        Portada {index + 1}
                      </div>
                      {isSelected ? (
                        <span className="absolute right-2 top-2 rounded-full bg-primary-500/90 px-2 py-0.5 text-[10px] font-bold text-white">
                          Activa
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>

              <div className="rounded-xl border border-white/10 bg-[#0f0f10] p-4">
                <label className="block text-sm font-semibold text-slate-200">
                  Subir portada propia
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCoverUpload}
                    disabled={uploadingCover}
                    className="mt-2 block w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-slate-200 disabled:opacity-60"
                  />
                </label>
                <p className="mt-2 text-xs text-slate-500">Se sube al bucket photos y se usa su URL publica.</p>
              </div>

              {uploadingCover ? (
                <p className="text-xs text-cyan-200">Subiendo portada a Supabase...</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {showCustomThemeModal && !isPreviewOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setShowCustomThemeModal(false)}
        >
          <div
            className="w-full max-w-xl rounded-2xl border border-white/15 bg-[#0b1324] shadow-[0_24px_60px_rgba(2,6,23,0.6)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-100">Tema personalizado</h3>
                <p className="text-xs text-slate-400">Ajusta tus colores base para este formulario.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomThemeModal(false)}
                className="h-9 w-9 rounded-full border border-white/20 bg-white/5 text-slate-300 transition hover:bg-white/10"
                aria-label="Cerrar modal de tema"
              >
                ×
              </button>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                Primario
                <input
                  type="color"
                  value={formTheme.primary}
                  onChange={(event) => updateThemeField('primary', event.target.value)}
                  className="mt-2 h-11 w-full cursor-pointer rounded-md border border-white/15 bg-[#0a1020]"
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                Acento
                <input
                  type="color"
                  value={formTheme.accent}
                  onChange={(event) => updateThemeField('accent', event.target.value)}
                  className="mt-2 h-11 w-full cursor-pointer rounded-md border border-white/15 bg-[#0a1020]"
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                Tarjetas
                <input
                  type="color"
                  value={formTheme.surface}
                  onChange={(event) => updateThemeField('surface', event.target.value)}
                  className="mt-2 h-11 w-full cursor-pointer rounded-md border border-white/15 bg-[#0a1020]"
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                Fondo 1
                <input
                  type="color"
                  value={formTheme.bgFrom}
                  onChange={(event) => updateThemeField('bgFrom', event.target.value)}
                  className="mt-2 h-11 w-full cursor-pointer rounded-md border border-white/15 bg-[#0a1020]"
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-300 sm:col-span-2">
                Fondo 2
                <input
                  type="color"
                  value={formTheme.bgTo}
                  onChange={(event) => updateThemeField('bgTo', event.target.value)}
                  className="mt-2 h-11 w-full cursor-pointer rounded-md border border-white/15 bg-[#0a1020]"
                />
              </label>
            </div>

            <div className="flex justify-end border-t border-white/10 px-5 py-4">
              <button
                type="button"
                onClick={() => setShowCustomThemeModal(false)}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!isPreviewOpen && (formMode === 'quiz' || formMode === 'strict') ? (
        <aside className="fixed bottom-5 left-5 right-5 z-40 rounded-2xl border border-white/15 bg-[#091225]/92 p-4 shadow-[0_18px_48px_rgba(2,6,23,0.65)] backdrop-blur-xl lg:left-auto lg:right-5 lg:w-[21rem]">
          {formMode === 'quiz' ? (
            <>
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-cyan-100">Control en vivo del quiz</p>
                <span className="rounded-full border border-cyan-300/30 bg-cyan-500/15 px-2 py-0.5 text-[11px] font-semibold text-cyan-100">
                  Tiempo real
                </span>
              </div>

              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-300">
                Código de invitación
              </label>
              <div className="mb-3 flex gap-2">
                <input
                  type="text"
                  value={joinCode}
                  readOnly
                  placeholder="Se generará al guardar..."
                  className="flex-1 rounded-lg border border-white/20 bg-[#111827] px-3 py-2 text-center font-mono text-base font-bold text-slate-100"
                />
                {joinCode ? (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(joinCode)
                      alert('Código copiado al portapapeles!')
                    }}
                    className="rounded-lg border border-cyan-300/35 bg-cyan-500/20 px-3 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/30"
                  >
                    Copiar
                  </button>
                ) : null}
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setShowQuizPanel(true)}
                  disabled={!editMode || !public_id}
                  className="w-full cursor-pointer mt-10 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-emerald-500 disabled:bg-gray-500"
                >
                  Ver sala de espera
                </button>
              
              </div>
            </>
          ) : null}

          {formMode === 'strict' ? (
            <>
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-amber-100">Control de modo estricto</p>
                <span className="rounded-full border border-amber-300/30 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-100">
                  Examen
                </span>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={strictDurationEnabled}
                  onChange={(event) => setStrictDurationEnabled(event.target.checked)}
                />
                Duración por usuario
              </label>

              {strictDurationEnabled ? (
                <label className="mt-2 block text-sm text-slate-200">
                  Duración (minutos)
                  <input
                    type="number"
                    min="1"
                    value={strictDurationMinutes}
                    onChange={(event) => setStrictDurationMinutes(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/20 bg-[#111827] px-3 py-2 text-slate-100 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-300/20"
                  />
                  <span className="mt-1 block text-xs text-slate-400">Requiere cuenta logueada.</span>
                </label>
              ) : null}

              <label className="mt-3 flex items-center gap-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={strictWindowEnabled}
                  onChange={(event) => setStrictWindowEnabled(event.target.checked)}
                />
                Ventana global inicio/fin
              </label>

              {strictWindowEnabled ? (
                <div className="mt-2 grid gap-2">
                  <label className="text-sm text-slate-200">
                    Inicio
                    <input
                      type="datetime-local"
                      value={strictStartsAt}
                      onChange={(event) => setStrictStartsAt(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/20 bg-[#111827] px-3 py-2 text-slate-100 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-300/20"
                    />
                  </label>
                  <label className="text-sm text-slate-200">
                    Fin
                    <input
                      type="datetime-local"
                      value={strictEndsAt}
                      onChange={(event) => setStrictEndsAt(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/20 bg-[#111827] px-3 py-2 text-slate-100 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-300/20"
                    />
                  </label>
                </div>
              ) : null}

              <label className="mt-3 flex items-center gap-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={strictRequireAuth}
                  onChange={(event) => setStrictRequireAuth(event.target.checked)}
                  disabled={strictDurationEnabled}
                />
                Requerir login para responder
              </label>
            </>
          ) : null}
        </aside>
      ) : null}

      {/* Panel de control de sesión de quiz */}
      {showQuizPanel && formMode === 'quiz' && formUUID && (
        <QuizAdminPanel
          formId={formUUID}
          onClose={() => setShowQuizPanel(false)}
        />
      )}
    </main>
  )
}

export default FormBuilderPage

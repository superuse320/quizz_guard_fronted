// Componentes de vista previa (deshabilitados)
export function PreviewShortAnswer() {
  return <input className="w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="Respuesta" disabled />
}

export function PreviewParagraph() {
  return <textarea className="w-full rounded-lg border border-gray-300 px-3 py-2" rows={3} placeholder="Respuesta" disabled />
}

export function PreviewNumber() {
  return <input className="w-full rounded-lg border border-gray-300 px-3 py-2" type="number" placeholder="123" disabled />
}

export function PreviewEmail() {
  return <input className="w-full rounded-lg border border-gray-300 px-3 py-2" type="email" placeholder="email@ejemplo.com" disabled />
}

export function PreviewUrl() {
  return <input className="w-full rounded-lg border border-gray-300 px-3 py-2" type="url" placeholder="https://..." disabled />
}

export function PreviewPhone() {
  return <input className="w-full rounded-lg border border-gray-300 px-3 py-2" type="tel" placeholder="Telefono" disabled />
}

export function PreviewDate() {
  return <input className="w-full rounded-lg border border-gray-300 px-3 py-2" type="date" disabled />
}

export function PreviewTime() {
  return <input className="w-full rounded-lg border border-gray-300 px-3 py-2" type="time" disabled />
}

export function PreviewMultipleChoice({ question }) {
  return (
    <div className="space-y-2">
      {question.options.map((option, index) => (
        <label key={`preview-${question.id}-choice-${index}`} className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" disabled />
          {option || `Opcion ${index + 1}`}
        </label>
      ))}
    </div>
  )
}

export function PreviewCheckboxes({ question }) {
  return (
    <div className="space-y-2">
      {question.options.map((option, index) => (
        <label key={`preview-${question.id}-checkbox-${index}`} className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" disabled />
          {option || `Opcion ${index + 1}`}
        </label>
      ))}
    </div>
  )
}

export function PreviewChoiceUnique({ question }) {
  return (
    <div className="space-y-2">
      {question.options.map((option, index) => (
        <label key={`preview-${question.id}-unique-${index}`} className="flex items-center gap-2 text-sm text-gray-700">
          <input type="radio" disabled />
          {index + 1}. {option || `Opcion ${index + 1}`}
        </label>
      ))}
    </div>
  )
}

export function PreviewDropdown({ question }) {
  return (
    <div className="space-y-2">
      {question.options.map((option, index) => (
        <label key={`preview-${question.id}-drop-${index}`} className="flex items-center gap-2 text-sm text-gray-700">
          <input type="radio" disabled />
          {index + 1}. {option || `Opcion ${index + 1}`}
        </label>
      ))}
    </div>
  )
}

export function PreviewLinearScale({ question }) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{question.scaleMinLabel}</span>
        <span>{question.scaleMaxLabel}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        {Array.from(
          { length: question.scaleMax - question.scaleMin + 1 },
          (_, index) => question.scaleMin + index,
        ).map((value) => (
          <label key={`preview-${question.id}-scale-${value}`} className="flex flex-col items-center gap-1 text-xs">
            <input type="radio" disabled />
            {value}
          </label>
        ))}
      </div>
    </div>
  )
}

export function PreviewEmojiScale() {
  const emojis = ['😡', '🙁', '😐', '🙂', '😍']
  return (
    <div className="flex items-center gap-2 text-2xl">
      {emojis.slice(0, 5).map((emoji, index) => (
        <span key={`preview-emoji-${index}`} className="opacity-70">
          {emoji}
        </span>
      ))}
    </div>
  )
}

export function PreviewStarRating({ question }) {
  const maxStars = Math.min(10, question.scaleMax)
  return (
    <div className="flex items-center gap-1 text-2xl text-amber-400">
      {Array.from({ length: maxStars }, (_, index) => (
        <span key={`preview-star-${index}`}>★</span>
      ))}
    </div>
  )
}

export function PreviewRanking({ question }) {
  return (
    <ol className="list-decimal space-y-2 pl-6 text-sm text-gray-700">
      {question.options.map((option, index) => (
        <li key={`preview-${question.id}-rank-${index}`}>{option || `Opcion ${index + 1}`}</li>
      ))}
    </ol>
  )
}

// Componentes interactivos para respuestas
export function RespondentShortAnswer({ question, value, onChange }) {
  return (
    <input
      className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-slate-100 outline-none focus:border-white/40 focus:ring-2 focus:ring-white/10"
      type="text"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Tu respuesta"
    />
  )
}

export function RespondentEmail({ question, value, onChange }) {
  return (
    <input
      className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-slate-100 outline-none focus:border-white/40 focus:ring-2 focus:ring-white/10"
      type="email"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder="tu@email.com"
    />
  )
}

export function RespondentUrl({ question, value, onChange }) {
  return (
    <input
      className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-slate-100 outline-none focus:border-white/40 focus:ring-2 focus:ring-white/10"
      type="url"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder="https://ejemplo.com"
    />
  )
}

export function RespondentPhone({ question, value, onChange }) {
  return (
    <input
      className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-slate-100 outline-none focus:border-white/40 focus:ring-2 focus:ring-white/10"
      type="tel"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder="+1234567890"
    />
  )
}

export function RespondentParagraph({ question, value, onChange }) {
  return (
    <textarea
      className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-slate-100 outline-none focus:border-white/40 focus:ring-2 focus:ring-white/10"
      rows={4}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Tu respuesta"
    />
  )
}

export function RespondentNumber({ question, value, onChange }) {
  return (
    <input
      className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-slate-100 outline-none focus:border-white/40 focus:ring-2 focus:ring-white/10"
      type="number"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Numero"
    />
  )
}

export function RespondentDate({ question, value, onChange }) {
  return (
    <input
      className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-slate-100 outline-none focus:border-white/40 focus:ring-2 focus:ring-white/10"
      type="date"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export function RespondentTime({ question, value, onChange }) {
  return (
    <input
      className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-slate-100 outline-none focus:border-white/40 focus:ring-2 focus:ring-white/10"
      type="time"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export function RespondentMultipleChoice({ question, value, onToggle }) {
  const selected = Array.isArray(value) ? value : []
  return (
    <div className="space-y-2">
      {question.options.map((option, index) => (
        <label key={`answer-${question.id}-choice-${index}`} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 cursor-pointer hover:bg-white/10 transition">
          <input
            type="checkbox"
            checked={selected.includes(index)}
            onChange={() => onToggle(question.id, index)}
            className="cursor-pointer"
          />
          {option || `Opcion ${index + 1}`}
        </label>
      ))}
    </div>
  )
}

export function RespondentCheckboxes({ question, value, onToggle }) {
  const selected = Array.isArray(value) ? value : []
  return (
    <div className="space-y-2">
      {question.options.map((option, index) => (
        <label key={`answer-${question.id}-checkbox-${index}`} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 cursor-pointer hover:bg-white/10 transition">
          <input
            type="checkbox"
            checked={selected.includes(index)}
            onChange={() => onToggle(question.id, index)}
            className="cursor-pointer"
          />
          {option || `Opcion ${index + 1}`}
        </label>
      ))}
    </div>
  )
}

export function RespondentChoiceUnique({ question, value, onChange }) {
  return (
    <div className="space-y-2">
      {question.options.map((option, index) => (
        <label key={`answer-${question.id}-unique-${index}`} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 cursor-pointer hover:bg-white/10 transition">
          <input
            type="radio"
            name={`answer-${question.id}`}
            checked={Number(value) === index}
            onChange={() => onChange(index)}
            className="cursor-pointer"
          />
          {option || `Opcion ${index + 1}`}
        </label>
      ))}
    </div>
  )
}

export function RespondentDropdown({ question, value, onChange }) {
  return (
    <select
      className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-slate-100 outline-none focus:border-white/40 focus:ring-2 focus:ring-white/10 appearance-none cursor-pointer"
      value={value ?? ''}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 8px center',
        paddingRight: '28px',
      }}
    >
      <option value="" disabled style={{ color: '#cbd5e0' }}>
        ─ Elegir opción ─
      </option>
      {question.options.map((option, index) => (
        <option key={`answer-${question.id}-drop-${index}`} value={index} style={{ color: '#e2e8f0' }}>
          {option || `Opcion ${index + 1}`}
        </option>
      ))}
    </select>
  )
}

export function RespondentLinearScale({ question, value, onChange }) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between text-xs text-slate-300">
        <span>{question.scaleMinLabel}</span>
        <span>{question.scaleMaxLabel}</span>
      </div>
      <div className="flex justify-between gap-2">
        {Array.from(
          { length: question.scaleMax - question.scaleMin + 1 },
          (_, index) => question.scaleMin + index,
        ).map((val) => (
          <label key={`answer-${question.id}-scale-${val}`} className="flex flex-col items-center gap-1 text-xs text-slate-100 cursor-pointer">
            <input
              type="radio"
              name={`answer-${question.id}`}
              checked={Number(value) === val}
              onChange={() => onChange(val)}
              className="cursor-pointer"
            />
            {val}
          </label>
        ))}
      </div>
    </div>
  )
}

export function RespondentEmojiScale({ question, value, onChange }) {
  const emojis = ['😡', '🙁', '😐', '🙂', '😍']
  return (
    <div className="flex items-center gap-2 text-2xl">
      {emojis.slice(0, Math.min(5, question.scaleMax)).map((emoji, index) => {
        const val = index + 1
        const selected = Number(value) === val
        return (
          <button
            key={`answer-${question.id}-emoji-${val}`}
            type="button"
            onClick={() => onChange(val)}
            className={`rounded-lg border px-2 py-1 transition cursor-pointer ${selected ? 'border-white/40 bg-white/10' : 'border-white/15 hover:bg-white/5'}`}
          >
            {emoji}
          </button>
        )
      })}
    </div>
  )
}

export function RespondentStarRating({ question, value, onChange }) {
  const maxStars = Math.min(10, question.scaleMax)
  const currentValue = Number(value)
  return (
    <div className="flex items-center gap-1 text-2xl text-amber-400">
      {Array.from({ length: maxStars }, (_, index) => {
        const val = index + 1
        const selected = currentValue >= val
        return (
          <button
            key={`answer-${question.id}-star-${val}`}
            type="button"
            onClick={() => onChange(val)}
            className={selected ? 'opacity-100' : 'opacity-40'}
          >
            ★
          </button>
        )
      })}
    </div>
  )
}

export function RespondentRanking({ question, value, onMove }) {
  const defaultOrder = question.options.map((_, index) => index)
  const current = Array.isArray(value) ? value : defaultOrder
  const valid = current.filter((v) => Number.isInteger(v) && v >= 0 && v < defaultOrder.length)
  const missing = defaultOrder.filter((v) => !valid.includes(v))
  const order = [...valid, ...missing]

  return (
    <div className="space-y-2">
      {order.map((optionIndex, position) => (
        <div key={`answer-${question.id}-rank-${position}`} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
          <span className="w-6 text-sm font-semibold text-slate-300">{position + 1}</span>
          <span className="flex-1 text-sm text-slate-100">{question.options[optionIndex] || `Opcion ${optionIndex + 1}`}</span>
          <button
            type="button"
            disabled={position === 0}
            onClick={() => onMove(question, position, -1)}
            className="rounded border border-white/15 bg-white/5 px-2 py-1 text-xs text-slate-300 hover:bg-white/10 disabled:opacity-40 cursor-pointer transition"
          >
            Subir
          </button>
          <button
            type="button"
            disabled={position === order.length - 1}
            onClick={() => onMove(question, position, 1)}
            className="rounded border border-white/15 bg-white/5 px-2 py-1 text-xs text-slate-300 hover:bg-white/10 disabled:opacity-40 cursor-pointer transition"
          >
            Bajar
          </button>
        </div>
      ))}
    </div>
  )
}


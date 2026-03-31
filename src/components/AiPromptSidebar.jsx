import GenerateAiIcon from "../assets/icons/GenerateAiIcon";

export default function AiPromptSidebar({
  prompt,
  onChangePrompt,
  onGenerate,
  generating,
  error,
  onClose,
}) {
  return (
    <aside className="fixed left-4 top-3 bottom-4 z-30 hidden w-85 flex-col rounded-2xl border border-white/15 bg-[#181818] backdrop-blur-xl shadow-[0_18px_38px_rgba(2,6,23,0.55)] lg:flex">
      <style>{`
        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        .shimmer-dark {
          background: linear-gradient(90deg, #1f2937 0%, #374151 50%, #1f2937 100%);
          background-size: 1000px 100%;
          animation: shimmer 2s infinite;
        }
        .pulse-dot {
          display: inline-block;
          animation: pulse-dot 1.4s infinite;
        }
        .pulse-dot:nth-child(2) {
          animation-delay: 0.2s;
        }
        .pulse-dot:nth-child(3) {
          animation-delay: 0.4s;
        }
      `}</style>
      
      <div className="border-b border-white/10 px-4 py-4">
        <div className="flex justify-between w-full">
          <GenerateAiIcon className="size-5 text-gray-400" />
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full  text-slate-300 shadow-sm transition  "
            aria-label="Cerrar panel de IA"
            title="Cerrar panel"
          >
            <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="5" width="18" height="14" rx="3" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 5v14" />
            </svg>
          </button>
        </div>
        <div className="flex items-start mt-5 justify-between gap-3">
          <div>
            <h2 className="mt-1 text-lg font-bold text-white">Generar desde prompt</h2>
            <p className="mt-1 text-xs text-slate-400">
              Escribe una instruccion y se crearan preguntas automaticamente.
            </p>
          </div>

        </div>
      </div>

      <div className="flex-1 px-4 py-4">
        <label className="text-sm font-medium text-slate-200" htmlFor="ai-prompt-input">
          Prompt
        </label>
        <textarea
          id="ai-prompt-input"
          value={prompt}
          onChange={(event) => onChangePrompt(event.target.value)}
          placeholder="Ejemplo: Genera un quiz de 5 preguntas sobre marketing digital con opciones"
          disabled={generating}
          className="mt-2 h-48 w-full resize-none rounded-xl border border-white/15 bg-black px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed"
        />

        {error ? (
          <div className="mt-3 rounded-lg border border-red-300/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {error}
          </div>
        ) : null}

        {generating ? (
          <div className="mt-4 space-y-3">
            <div className="shimmer-dark h-12 rounded-lg"></div>
            <div className="shimmer-dark h-12 rounded-lg"></div>
            <div className="shimmer-dark h-12 rounded-lg"></div>
            
            <div className="mt-4 flex items-center justify-center gap-1 text-xs text-slate-300">
              <span>La IA está trabajando</span>
              <span className="pulse-dot">.</span>
              <span className="pulse-dot">.</span>
              <span className="pulse-dot">.</span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t border-white/10 px-4 py-4">
        <button
          type="button"
          onClick={onGenerate}
          disabled={generating || !String(prompt).trim()}
          className="w-full rounded-xl cursor-pointer bg-linear-to-r from-primary-700  to-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:from-primary-500 hover:to-primary-500 disabled:cursor-not-allowed disabled:bg-slate-700"
        >
          <GenerateAiIcon className={"size-4 inline-block mr-2"} />
          {generating ? 'Generando preguntas...' : 'Generar '}
        </button>
      </div>
    </aside>
  )
}

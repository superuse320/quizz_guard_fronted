const getMode = (mode) => String(mode || 'normal').toLowerCase();

const getOptionLabel = (index) => ['A', 'B', 'C', 'D'][index] || String(index + 1);

const parseThemeValue = (value) => {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof value === 'object' ? value : {};
};

const normalizeHex = (hex) => {
  if (!hex || typeof hex !== 'string') return null;
  let normalized = hex.replace('#', '').trim();
  if (normalized.length === 3) {
    normalized = normalized.split('').map((char) => `${char}${char}`).join('');
  }
  return normalized.length === 6 ? normalized : null;
};

const hexToRgb = (hex) => {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return null;
  return { r, g, b };
};

const hexToRgba = (hex, alpha, fallback = `rgba(15, 23, 42, ${alpha})`) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return fallback;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
};

const getLuminance = (hex) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0.2;
  return ((0.2126 * rgb.r) + (0.7152 * rgb.g) + (0.0722 * rgb.b)) / 255;
};

export default function FormCardThumbnail({
  formMode,
  previewQuestions = [],
  formTheme,
  formTitle,
  formDescription,
}) {
  const mode = getMode(formMode);
  const parsedTheme = parseThemeValue(formTheme);
  const firstQuestion = previewQuestions[0];
  const quizOptions = Array.isArray(firstQuestion?.options) && firstQuestion.options.length > 0
    ? firstQuestion.options.slice(0, 4)
    : Array.from({ length: 4 }).map((_, idx) => `Opcion ${getOptionLabel(idx)}`);
  const surface = parsedTheme.surface || '#0f172a';
  const primary = parsedTheme.primary || '#2563eb';
  const accent = parsedTheme.accent || '#14b8a6';
  const bgFrom = parsedTheme.bgFrom || '#0f172a';
  const bgTo = parsedTheme.bgTo || '#1e293b';
  const isSurfaceDark = getLuminance(surface) < 0.56;
  const shellText = isSurfaceDark ? '#e2e8f0' : '#0f172a';
  const shellMuted = isSurfaceDark ? '#cbd5e1' : '#334155';
  const shellBg = hexToRgba(surface, isSurfaceDark ? 0.66 : 0.74, isSurfaceDark ? 'rgba(15, 23, 42, 0.66)' : 'rgba(248, 250, 252, 0.74)');
  const titleText = String(formTitle || 'Cuestionario').trim() || 'Cuestionario';
  const descriptionText = String(formDescription || 'Completa las siguientes preguntas').trim() || 'Completa las siguientes preguntas';
  const tinyQuestionFallback = previewQuestions.length > 0
    ? previewQuestions
    : [{ title: 'Pregunta 1' }, { title: 'Pregunta 2' }, { title: 'Pregunta 3' }];

  if (mode === 'quiz') {
    return (
      <div className="relative h-full overflow-hidden rounded-sm px-2 py-1.5" style={{ backgroundImage: `linear-gradient(135deg, ${bgFrom}, ${bgTo})` }}>
        <div className="absolute inset-0" style={{ backgroundColor: shellBg }} />
        <div className="relative">
          <p className="truncate text-[8px] font-bold" style={{ color: shellText }}>{titleText}</p>
          <p className="line-clamp-1 text-[7px]" style={{ color: shellMuted }}>{descriptionText}</p>
          <div className="my-1 h-px w-full" style={{ backgroundColor: hexToRgba(accent, 0.42) }} />
          <p className="line-clamp-1 text-[8px] font-semibold leading-tight" style={{ color: shellText }}>
            {firstQuestion?.title || 'Selecciona la opcion correcta para esta pregunta.'}
          </p>
          <div className="mt-0.5 space-y-0.5">
            {quizOptions.slice(0, 2).map((optionLabel, idx) => (
              <div
                key={`quiz-opt-${idx}`}
                className="flex items-center gap-1 rounded-sm px-1 py-0.5 text-[7px]"
                style={idx === 1
                  ? {
                      backgroundColor: hexToRgba(primary, 0.24),
                      color: isSurfaceDark ? '#dbeafe' : '#1e3a8a',
                    }
                  : {
                      backgroundColor: hexToRgba(surface, isSurfaceDark ? 0.22 : 0.45),
                      color: shellMuted,
                    }}
              >
                <span className="font-bold" style={{ color: isSurfaceDark ? '#bfdbfe' : '#1d4ed8' }}>{getOptionLabel(idx)}</span>
                <span className="truncate">{optionLabel}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'strict') {
    return (
      <div className="relative h-full overflow-hidden rounded-sm px-2 py-1.5" style={{ backgroundImage: `linear-gradient(135deg, ${hexToRgba(primary, 0.45)}, ${hexToRgba('#1f2937', 1)})` }}>
        <div className="absolute inset-0" style={{ backgroundColor: hexToRgba('#111827', 0.72) }} />
        <div className="relative blur-[1.2px]">
          <p className="truncate text-[8px] font-bold text-amber-100">{titleText}</p>
          <p className="line-clamp-1 text-[7px] text-amber-200/90">{descriptionText}</p>
          <div className="my-1 h-px w-full bg-amber-300/40" />
          <div className="space-y-0.5">
            {tinyQuestionFallback.slice(0, 2).map((question, index) => (
              <p key={`strict-q-${index}`} className="truncate text-[7px] text-amber-100/80">
                {index + 1}. {question.title || `Pregunta ${index + 1}`}
              </p>
            ))}
          </div>
        </div>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rounded-full border border-amber-300/40 bg-amber-500/20 px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.14em] text-amber-200">
            Vista protegida
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-hidden rounded-sm px-2 py-1.5" style={{ backgroundImage: `linear-gradient(135deg, ${bgFrom}, ${bgTo})` }}>
      <div className="absolute inset-0" style={{ backgroundColor: shellBg }} />
      <div className="relative">
        <p className="truncate text-[8px] font-bold" style={{ color: shellText }}>{titleText}</p>
        <p className="line-clamp-1 text-[7px]" style={{ color: shellMuted }}>{descriptionText}</p>
        <div className="my-1 h-px w-full" style={{ backgroundColor: hexToRgba(accent, 0.42) }} />
        <div className="space-y-1">
          {tinyQuestionFallback.slice(0, 2).map((question, index) => {
            const hasOptions = Array.isArray(question?.options) && question.options.length > 0;
            return (
              <div key={`normal-q-${index}`}>
                <p
                  className="truncate text-[8px] font-semibold"
                  style={{ color: shellText }}
                  title={question.title || `Pregunta ${index + 1}`}
                >
                  {index + 1}. {question.title || `Pregunta ${index + 1}`}
                </p>
                {hasOptions ? (
                  <div className="mt-0.5 space-y-0.5">
                    {question.options.slice(0, 2).map((optionLabel, optionIndex) => (
                      <div
                        key={`normal-q-${index}-opt-${optionIndex}`}
                        className="flex items-center gap-1 text-[7px]"
                        style={{ color: shellMuted }}
                      >
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full border"
                          style={{ borderColor: hexToRgba(primary, isSurfaceDark ? 0.8 : 0.6) }}
                        />
                        <span className="truncate">{optionLabel}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    className="mt-0.5 h-1.5 rounded-sm"
                    style={{ backgroundColor: hexToRgba(primary, isSurfaceDark ? 0.24 : 0.2) }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

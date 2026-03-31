import * as Components from './QuestionRenderer'

/**
 * Retorna el componente de preview para un tipo de pregunta
 */
export function getPreviewComponent(question) {
  const { type, id } = question

  if (type === 'short_answer') return <Components.PreviewShortAnswer key={id} />
  if (type === 'paragraph') return <Components.PreviewParagraph key={id} />
  if (type === 'number') return <Components.PreviewNumber key={id} />
  if (type === 'email') return <Components.PreviewEmail key={id} />
  if (type === 'url') return <Components.PreviewUrl key={id} />
  if (type === 'phone') return <Components.PreviewPhone key={id} />
  if (type === 'date') return <Components.PreviewDate key={id} />
  if (type === 'time') return <Components.PreviewTime key={id} />
  if (type === 'multiple_choice') return <Components.PreviewMultipleChoice key={id} question={question} />
  if (type === 'checkboxes') return <Components.PreviewCheckboxes key={id} question={question} />
  if (type === 'choice_unique') return <Components.PreviewChoiceUnique key={id} question={question} />
  if (type === 'dropdown') return <Components.PreviewDropdown key={id} question={question} />
  if (type === 'linear_scale') return <Components.PreviewLinearScale key={id} question={question} />
  if (type === 'emoji_scale') return <Components.PreviewEmojiScale key={id} />
  if (type === 'star_rating') return <Components.PreviewStarRating key={id} question={question} />
  if (type === 'ranking') return <Components.PreviewRanking key={id} question={question} />

  return null
}

/**
 * Retorna el componente respondent (interactivo) para un tipo de pregunta
 */
export function getRespondentComponent(question, responses, responseErrors, updateResponse, toggleCheckboxResponse, handleRankingMove) {
  const { type, id } = question
  const value = responses[id]
  const error = responseErrors[id]

  if (type === 'short_answer') return <Components.RespondentShortAnswer key={id} question={question} value={value} onChange={(v) => updateResponse(id, v)} />
  if (type === 'email') return <Components.RespondentEmail key={id} question={question} value={value} onChange={(v) => updateResponse(id, v)} />
  if (type === 'url') return <Components.RespondentUrl key={id} question={question} value={value} onChange={(v) => updateResponse(id, v)} />
  if (type === 'phone') return <Components.RespondentPhone key={id} question={question} value={value} onChange={(v) => updateResponse(id, v)} />
  if (type === 'paragraph') return <Components.RespondentParagraph key={id} question={question} value={value} onChange={(v) => updateResponse(id, v)} />
  if (type === 'number') return <Components.RespondentNumber key={id} question={question} value={value} onChange={(v) => updateResponse(id, v)} />
  if (type === 'date') return <Components.RespondentDate key={id} question={question} value={value} onChange={(v) => updateResponse(id, v)} />
  if (type === 'time') return <Components.RespondentTime key={id} question={question} value={value} onChange={(v) => updateResponse(id, v)} />
  if (type === 'multiple_choice') return <Components.RespondentMultipleChoice key={id} question={question} value={value} onToggle={toggleCheckboxResponse} />
  if (type === 'checkboxes') return <Components.RespondentCheckboxes key={id} question={question} value={value} onToggle={toggleCheckboxResponse} />
  if (type === 'choice_unique') return <Components.RespondentChoiceUnique key={id} question={question} value={value} onChange={(v) => updateResponse(id, v)} />
  if (type === 'dropdown') return <Components.RespondentDropdown key={id} question={question} value={value} onChange={(v) => updateResponse(id, v)} />
  if (type === 'linear_scale') return <Components.RespondentLinearScale key={id} question={question} value={value} onChange={(v) => updateResponse(id, v)} />
  if (type === 'emoji_scale') return <Components.RespondentEmojiScale key={id} question={question} value={value} onChange={(v) => updateResponse(id, v)} />
  if (type === 'star_rating') return <Components.RespondentStarRating key={id} question={question} value={value} onChange={(v) => updateResponse(id, v)} />
  if (type === 'ranking') return <Components.RespondentRanking key={id} question={question} value={value} onMove={handleRankingMove} />

  return null
}

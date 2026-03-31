const Base = ({ children, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
)

const ShortAnswerIcon = ({ className }) => (
  <Base className={className}>
    <path d="M4 7h16" />
    <path d="M4 12h10" />
    <path d="M4 17h7" />
  </Base>
)

const ParagraphIcon = ({ className }) => (
  <Base className={className}>
    <path d="M4 7h16" />
    <path d="M4 11h16" />
    <path d="M4 15h12" />
    <path d="M4 19h10" />
  </Base>
)

const MultipleChoiceIcon = ({ className }) => (
  <Base className={className}>
    <circle cx="6" cy="7" r="2" />
    <circle cx="6" cy="12" r="2" />
    <circle cx="6" cy="17" r="2" />
    <path d="M11 7h9" />
    <path d="M11 12h9" />
    <path d="M11 17h9" />
  </Base>
)

const CheckboxesIcon = ({ className }) => (
  <Base className={className}>
    <rect x="4" y="5" width="4" height="4" rx="1" />
    <rect x="4" y="10" width="4" height="4" rx="1" />
    <rect x="4" y="15" width="4" height="4" rx="1" />
    <path d="M12 7h8" />
    <path d="M12 12h8" />
    <path d="M12 17h8" />
  </Base>
)

const DropdownIcon = ({ className }) => (
  <Base className={className}>
    <rect x="4" y="6" width="16" height="12" rx="2" />
    <path d="M10 11l2 2 2-2" />
  </Base>
)

const LinearScaleIcon = ({ className }) => (
  <Base className={className}>
    <circle cx="5" cy="12" r="1.6" />
    <circle cx="12" cy="12" r="1.6" />
    <circle cx="19" cy="12" r="1.6" />
    <path d="M6.6 12h3.8" />
    <path d="M13.6 12h3.8" />
  </Base>
)

const EmojiScaleIcon = ({ className }) => (
  <Base className={className}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="10" r="1" fill="currentColor" stroke="none" />
    <path d="M8.5 15c1 .9 2.2 1.5 3.5 1.5s2.5-.6 3.5-1.5" />
  </Base>
)

const StarRatingIcon = ({ className }) => (
  <Base className={className}>
    <path d="M12 4l2.2 4.5 5 .7-3.6 3.6.9 5.1-4.5-2.4-4.5 2.4.9-5.1L4.8 9.2l5-.7L12 4z" />
  </Base>
)

const RankingIcon = ({ className }) => (
  <Base className={className}>
    <path d="M8 6h12" />
    <path d="M8 12h12" />
    <path d="M8 18h12" />
    <path d="M4 5v2" />
    <path d="M3 6h2" />
    <path d="M4 11v2" />
    <path d="M3 12h2" />
    <path d="M4 17v2" />
    <path d="M3 18h2" />
  </Base>
)

const NumberIcon = ({ className }) => (
  <Base className={className}>
    <path d="M8 7l-2 10" />
    <path d="M14 7l-2 10" />
    <path d="M4 10h12" />
    <path d="M3 14h12" />
  </Base>
)

const EmailIcon = ({ className }) => (
  <Base className={className}>
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <path d="M4 8l8 6 8-6" />
  </Base>
)

const UrlIcon = ({ className }) => (
  <Base className={className}>
    <path d="M10 14l4-4" />
    <path d="M7.5 16.5l-2 2a3 3 0 104.2 4.2l2-2" />
    <path d="M16.5 7.5l2-2a3 3 0 00-4.2-4.2l-2 2" />
  </Base>
)

const PhoneIcon = ({ className }) => (
  <Base className={className}>
    <rect x="8" y="3" width="8" height="18" rx="2" />
    <path d="M11 6h2" />
    <circle cx="12" cy="18" r="0.8" fill="currentColor" stroke="none" />
  </Base>
)

const DateIcon = ({ className }) => (
  <Base className={className}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M8 3v4" />
    <path d="M16 3v4" />
    <path d="M3 10h18" />
  </Base>
)

const TimeIcon = ({ className }) => (
  <Base className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Base>
)

const ICONS = {
  short_answer: ShortAnswerIcon,
  paragraph: ParagraphIcon,
  multiple_choice: MultipleChoiceIcon,
  choice_unique: MultipleChoiceIcon,
  checkboxes: CheckboxesIcon,
  dropdown: DropdownIcon,
  linear_scale: LinearScaleIcon,
  emoji_scale: EmojiScaleIcon,
  star_rating: StarRatingIcon,
  ranking: RankingIcon,
  number: NumberIcon,
  email: EmailIcon,
  url: UrlIcon,
  phone: PhoneIcon,
  date: DateIcon,
  time: TimeIcon,
}

export const QuestionTypeIcon = ({ type, className = 'h-4 w-4' }) => {
  const Icon = ICONS[type] || ShortAnswerIcon
  return <Icon className={className} />
}

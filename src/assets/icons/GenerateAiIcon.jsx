export default function GenerateAiIcon({ className = 'w-5 h-5 text-[#5f6470]' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 3l1.5 3.5L16 8l-3.5 1.5L11 13l-1.5-3.5L6 8l3.5-1.5L11 3Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 13l.9 2.1L21 16l-2.1.9L18 19l-.9-2.1L15 16l2.1-.9L18 13Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 14l.7 1.6L7.3 16l-1.6.7L5 18.3l-.7-1.6L2.7 16l1.6-.4L5 14Z" />
    </svg>
  );
}

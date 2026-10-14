import { CLINIC_LOGO_SRC, CLINIC_MARK_NAME } from '../lib/clinic.ts'

type LogoSize = 'sm' | 'md' | 'lg'

const heights: Record<LogoSize, number> = {
  sm: 32,
  md: 40,
  lg: 52,
}

type LogoProps = {
  size?: LogoSize
  iconOnly?: boolean
  className?: string
}

/** Clinic mark for staff chrome. DentaFlow wordmark/icon hidden for now. */
export function Logo({ size = 'md', iconOnly = false, className = '' }: LogoProps) {
  const height = heights[size]

  return (
    <span
      className={`inline-flex items-center ${iconOnly ? '' : 'rounded-dentaflow bg-white px-2 py-1'} ${className}`}
    >
      <img
        src={CLINIC_LOGO_SRC}
        alt={CLINIC_MARK_NAME}
        height={height}
        className="w-auto object-contain"
        style={{ height }}
      />
    </span>
  )
}

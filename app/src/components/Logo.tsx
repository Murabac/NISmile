import iconUrl from '../../../Brand/dentaflow-icon.svg'
import logoUrl from '../../../Brand/dentaflow-logo.svg'

type LogoSize = 'sm' | 'md' | 'lg'

const heights: Record<LogoSize, number> = {
  sm: 28,
  md: 36,
  lg: 48,
}

type LogoProps = {
  size?: LogoSize
  iconOnly?: boolean
  className?: string
}

export function Logo({ size = 'md', iconOnly = false, className = '' }: LogoProps) {
  const height = heights[size]

  const image = (
    <img
      src={iconOnly ? iconUrl : logoUrl}
      alt="DentaFlow"
      height={height}
      className={`w-auto ${iconOnly ? className : ''}`}
      style={{ height }}
    />
  )

  if (iconOnly) return image

  return (
    <span
      className={`inline-flex items-center rounded-dentaflow bg-enamel px-2.5 py-1.5 ${className}`}
    >
      {image}
    </span>
  )
}

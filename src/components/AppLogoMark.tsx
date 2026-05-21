interface AppLogoMarkProps {
  alt?: string
  className?: string
  theme?: 'dark' | 'light'
  title?: string
  variant?: 'mark' | 'wordmark'
}

export default function AppLogoMark({ alt = '', className = '', theme = 'dark', title, variant = 'mark' }: AppLogoMarkProps) {
  const src = variant === 'wordmark'
    ? `/app-logo-wordmark-${theme === 'light' ? 'light' : 'dark'}.png`
    : '/app-logo.png'

  return (
    <img
      src={src}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      title={title}
      draggable={false}
      className={`app-logo-mark ${className}`.trim()}
    />
  )
}

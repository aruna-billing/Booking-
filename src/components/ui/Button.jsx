export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  block = false,
  href,
  className = '',
  children,
  disabled,
  ...rest
}) {
  const cls = ['btn', `btn--${variant}`, `btn--${size}`, block && 'btn--block', loading && 'is-loading', className]
    .filter(Boolean)
    .join(' ');
  if (href) {
    return (
      <a className={cls} href={href} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <button className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <span className="btn__spinner" aria-hidden="true" />}
      <span>{children}</span>
    </button>
  );
}

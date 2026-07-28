import type { ReactNode, SelectHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { useEffect, useRef } from 'react'
import { initials } from '../lib/format'

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('rounded-lg border border-edge bg-surface', className)}>{children}</div>
  )
}

const buttonVariants = {
  primary: 'bg-series-1 text-white hover:opacity-90',
  secondary: 'border border-edge bg-surface text-ink hover:bg-surface-2',
  ghost: 'text-ink-2 hover:bg-surface-2',
  danger: 'border border-edge text-critical hover:bg-surface-2',
} as const

export function Button({
  variant = 'secondary',
  className,
  type = 'button',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof buttonVariants }) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        buttonVariants[variant],
        className,
      )}
      {...props}
    />
  )
}

// No width here on purpose: call sites set their own, and a `w-full` baked in
// would win over them regardless of class order.
const fieldClass =
  'rounded-md border border-edge bg-surface px-2.5 py-1.5 text-sm text-ink placeholder:text-muted focus:border-series-1 focus:outline-none'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(fieldClass, className)} {...props} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(fieldClass, 'min-h-20', className)} {...props} />
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(fieldClass, className)} {...props} />
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-ink-2">
      {children}
    </label>
  )
}

/** A labelled control that fills the width it is given. */
export function Field({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cx(className, '[&_input]:w-full [&_select]:w-full [&_textarea]:w-full')}>
      <Label>{label}</Label>
      {children}
    </div>
  )
}

export function Pill({
  children,
  color,
  className,
}: {
  children: ReactNode
  color?: string
  className?: string
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border border-edge px-2 py-0.5 text-xs font-medium text-ink-2',
        className,
      )}
    >
      {color && (
        <span
          aria-hidden
          className="h-2 w-2 shrink-0 rounded-full ring-2 ring-surface"
          style={{ background: color }}
        />
      )}
      {children}
    </span>
  )
}

export function Avatar({ name, title }: { name: string; title?: string }) {
  return (
    <span
      title={title ?? name}
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[10px] font-semibold text-ink-2"
    >
      {initials(name)}
    </span>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="px-1 py-6 text-center text-sm text-muted">{children}</p>
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return <p className="px-1 py-6 text-center text-sm text-muted">{label}</p>
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null
  const message = error instanceof Error ? error.message : String(error)
  return (
    <p role="alert" className="rounded-md border border-edge px-3 py-2 text-sm text-critical">
      {message}
    </p>
  )
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    ref.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          'w-full rounded-lg border border-edge bg-surface shadow-xl focus:outline-none',
          wide ? 'max-w-3xl' : 'max-w-lg',
        )}
      >
        <div className="flex items-center justify-between border-b border-edge px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          <Button variant="ghost" onClick={onClose} aria-label="Close">
            ✕
          </Button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

import { Link } from '@inertiajs/react';
import { Eye, EyeOff, Loader2, X } from 'lucide-react';
import type {
    ButtonHTMLAttributes,
    InputHTMLAttributes,
    ReactNode,
    SelectHTMLAttributes,
    TextareaHTMLAttributes,
} from 'react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { Paginated } from '@/types';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

const variants: Record<Variant, string> = {
    primary:
        'bg-ink text-white hover:bg-stone-800 focus-visible:ring-stone-900/30',
    secondary:
        'bg-white text-stone-800 ring-1 ring-stone-200 hover:bg-stone-50 focus-visible:ring-stone-400',
    ghost: 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500/40',
    success:
        'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500/40',
};

export function Button({
    variant = 'primary',
    size = 'md',
    loading,
    className,
    children,
    ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
    size?: 'sm' | 'md';
    loading?: boolean;
}) {
    return (
        <button
            type="button"
            {...props}
            disabled={props.disabled || loading}
            className={cn(
                'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition focus-visible:ring-4 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
                size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm',
                variants[variant],
                className,
            )}
        >
            {loading && <Loader2 className="size-4 animate-spin" />}
            {children}
        </button>
    );
}

export function ButtonLink({
    href,
    variant = 'secondary',
    size = 'md',
    className,
    children,
    external,
}: {
    href: string;
    variant?: Variant;
    size?: 'sm' | 'md';
    className?: string;
    children: ReactNode;
    external?: boolean;
}) {
    const cls = cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition',
        size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm',
        variants[variant],
        className,
    );
    if (external) {
        return (
            <a href={href} className={cls}>
                {children}
            </a>
        );
    }
    return (
        <Link href={href} className={cls}>
            {children}
        </Link>
    );
}

export function Field({
    label,
    error,
    hint,
    children,
    className,
}: {
    label?: string;
    error?: string;
    hint?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return (
        <label className={cn('block', className)}>
            {label && (
                <span className="mb-1.5 block text-sm font-medium text-stone-700">
                    {label}
                </span>
            )}
            {children}
            {hint && !error && (
                <span className="mt-1 block text-xs text-stone-500">{hint}</span>
            )}
            {error && (
                <span className="mt-1 block text-xs font-medium text-red-600">
                    {error}
                </span>
            )}
        </label>
    );
}

const control =
    'block w-full rounded-lg border-0 bg-white px-3 text-sm text-stone-900 ring-1 ring-stone-200 transition ring-inset placeholder:text-stone-400 focus:ring-2 focus:ring-brand-500 focus:outline-none disabled:bg-stone-50 disabled:text-stone-500';

export function Input({
    className,
    ...props
}: InputHTMLAttributes<HTMLInputElement>) {
    return <input {...props} className={cn(control, 'h-10', className)} />;
}

/** Password field with an eye button to show or hide what was typed. */
export function PasswordInput({ className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
    const [shown, setShown] = useState(false);
    return (
        <div className="relative">
            <input {...props} type={shown ? 'text' : 'password'} className={cn(control, 'h-10 pr-10', className)} />
            <button
                type="button"
                tabIndex={-1}
                onClick={() => setShown((v) => !v)}
                aria-label={shown ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                title={shown ? 'Masquer' : 'Afficher'}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-stone-400 hover:text-stone-700"
            >
                {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
        </div>
    );
}

/** Copies text, also on plain http (shared hosting without SSL) where navigator.clipboard is missing. */
export async function copyText(text: string): Promise<boolean> {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch {
        // fall through to the legacy path
    }
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
        ok = document.execCommand('copy');
    } catch {
        ok = false;
    }
    area.remove();
    return ok;
}

export function MoneyInput({
    value,
    onChange,
    className,
    ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
    value: number | string;
    onChange: (v: number | '') => void;
}) {
    return (
        <div className="relative">
            <input
                {...props}
                inputMode="numeric"
                value={
                    value === '' || value === null
                        ? ''
                        : Number(value).toLocaleString('fr-FR').replace(/ | /g, ' ')
                }
                onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '');
                    onChange(digits === '' ? '' : Number(digits));
                }}
                className={cn(control, 'tabular h-10 pr-16', className)}
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-stone-400">
                FCFA
            </span>
        </div>
    );
}

export function Textarea({
    className,
    ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
    return (
        <textarea
            rows={3}
            {...props}
            className={cn(control, 'py-2', className)}
        />
    );
}

export function Select({
    className,
    children,
    ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
    return (
        <select {...props} className={cn(control, 'h-10 pr-8', className)}>
            {children}
        </select>
    );
}

export function Card({
    title,
    actions,
    children,
    className,
    bodyClassName,
}: {
    title?: ReactNode;
    actions?: ReactNode;
    children: ReactNode;
    className?: string;
    bodyClassName?: string;
}) {
    return (
        <section
            className={cn(
                'min-w-0 rounded-2xl bg-white shadow-sm ring-1 ring-stone-200/70',
                className,
            )}
        >
            {(title || actions) && (
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-3.5">
                    <h2 className="text-sm font-semibold text-stone-900">
                        {title}
                    </h2>
                    {actions && (
                        <div className="flex flex-wrap items-center gap-2">
                            {actions}
                        </div>
                    )}
                </header>
            )}
            <div className={cn('p-5', bodyClassName)}>{children}</div>
        </section>
    );
}

const badgeTones = {
    stone: 'bg-stone-100 text-stone-700 ring-stone-200',
    amber: 'bg-amber-50 text-amber-800 ring-amber-200',
    blue: 'bg-sky-50 text-sky-800 ring-sky-200',
    green: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    red: 'bg-red-50 text-red-700 ring-red-200',
    violet: 'bg-violet-50 text-violet-800 ring-violet-200',
};

export type Tone = keyof typeof badgeTones;

export function Badge({
    tone = 'stone',
    children,
    className,
}: {
    tone?: Tone;
    children: ReactNode;
    className?: string;
}) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
                badgeTones[tone],
                className,
            )}
        >
            {children}
        </span>
    );
}

export const taskTone: Record<string, Tone> = {
    todo: 'amber',
    in_progress: 'violet',
    review: 'blue',
    done: 'green',
};

export const projectTone: Record<string, Tone> = {
    draft: 'stone',
    in_progress: 'blue',
    delivered: 'green',
    cancelled: 'red',
};

export function TaskStatusBadge({
    status,
    label,
    late,
    waiting,
}: {
    status: string;
    label: string;
    late?: boolean;
    waiting?: boolean;
}) {
    return (
        <span className="inline-flex flex-wrap gap-1">
            {waiting ? <Badge tone="stone">En attente</Badge> : <Badge tone={taskTone[status]}>{label}</Badge>}
            {late && <Badge tone="red">En retard</Badge>}
        </span>
    );
}

/**
 * Accessible dialog built on <dialog>:
 * - Escape / backdrop / ✕ close it, but a dirty form asks before discarding changes;
 * - with `onSubmit`, body + footer are a real <form> (Enter submits, buttons type="submit");
 * - page scroll is locked while open; on phones it opens as a bottom sheet.
 */
export function Modal({
    open,
    onClose,
    title,
    description,
    children,
    footer,
    size = 'md',
    onSubmit,
    dirty = false,
    errorBanner,
}: {
    open: boolean;
    onClose: () => void;
    title: ReactNode;
    description?: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    onSubmit?: () => void;
    dirty?: boolean;
    errorBanner?: string | null;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    const [confirmDiscard, setConfirmDiscard] = useState(false);

    const requestClose = () => {
        if (dirty && !confirmDiscard) {
            setConfirmDiscard(true);
            return;
        }
        setConfirmDiscard(false);
        onClose();
    };

    useEffect(() => {
        const dialog = ref.current;
        if (!dialog) {
            return;
        }
        if (open && !dialog.open) {
            dialog.showModal();
        } else if (!open && dialog.open) {
            dialog.close();
        }
        if (!open) {
            setConfirmDiscard(false);
        }
    }, [open]);

    useEffect(() => {
        if (!open) {
            return;
        }
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previous;
        };
    }, [open]);

    const body = (
        <>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                {errorBanner && (
                    <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
                        {errorBanner}
                    </p>
                )}
                {children}
            </div>
            {confirmDiscard ? (
                <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-amber-200 bg-amber-50 px-5 py-3">
                    <span className="text-sm text-amber-900">Abandonner les modifications ?</span>
                    <span className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setConfirmDiscard(false)}>
                            Continuer l'édition
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => { setConfirmDiscard(false); onClose(); }}>
                            Abandonner
                        </Button>
                    </span>
                </footer>
            ) : (
                footer && (
                    <footer className="flex flex-wrap justify-end gap-2 border-t border-stone-100 bg-stone-50/60 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                        {footer}
                    </footer>
                )
            )}
        </>
    );

    return (
        <dialog
            ref={ref}
            aria-labelledby="modal-title"
            onCancel={(e) => {
                e.preventDefault();
                requestClose();
            }}
            onClick={(e) => {
                if (e.target === ref.current) {
                    requestClose();
                }
            }}
            className={cn(
                'w-full rounded-2xl bg-white p-0 shadow-2xl backdrop:bg-stone-950/40 backdrop:backdrop-blur-sm',
                // Phone: bottom sheet. Larger screens: centred card.
                'mx-auto mt-auto mb-0 max-w-none rounded-b-none sm:m-auto sm:w-[calc(100%-2rem)] sm:rounded-b-2xl',
                size === 'xl' ? 'sm:max-w-4xl' : size === 'lg' ? 'sm:max-w-2xl' : size === 'sm' ? 'sm:max-w-md' : 'sm:max-w-lg',
            )}
        >
            {open && (
                <div className="flex max-h-[90dvh] flex-col sm:max-h-[85vh]">
                    <header className="flex items-start justify-between gap-3 border-b border-stone-100 px-5 py-4">
                        <div className="min-w-0">
                            <h3 id="modal-title" className="text-base font-semibold">{title}</h3>
                            {description && <p className="mt-0.5 text-sm text-stone-500">{description}</p>}
                        </div>
                        <button
                            type="button"
                            onClick={requestClose}
                            className="-mr-1 rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                            aria-label="Fermer"
                        >
                            <X className="size-5" />
                        </button>
                    </header>
                    {onSubmit ? (
                        <form
                            noValidate
                            className="flex min-h-0 flex-1 flex-col"
                            onSubmit={(e) => {
                                e.preventDefault();
                                onSubmit();
                            }}
                        >
                            {body}
                        </form>
                    ) : (
                        body
                    )}
                </div>
            )}
        </dialog>
    );
}

/** Shown in a modal when the server rejected the form, so the user knows to look for red fields. */
export function formErrorBanner(errors: Record<string, string | undefined>): string | null {
    const messages = Object.values(errors).filter(Boolean);
    if (messages.length === 0) {
        return null;
    }
    return messages.length === 1 ? (messages[0] as string) : `${messages.length} champs à corriger : ${messages[0]}`;
}

export function Stat({
    label,
    value,
    hint,
    tone,
    icon,
}: {
    label: string;
    value: ReactNode;
    hint?: ReactNode;
    tone?: 'positive' | 'negative' | 'warning';
    icon?: ReactNode;
}) {
    return (
        <div className="min-w-0 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200/70">
            <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium tracking-wide text-stone-500 uppercase">
                    {label}
                </p>
                {icon && <span className="text-stone-400">{icon}</span>}
            </div>
            <p
                className={cn(
                    'tabular mt-2 text-xl font-semibold tracking-tight sm:text-2xl',
                    tone === 'positive' && 'text-emerald-700',
                    tone === 'negative' && 'text-red-600',
                    tone === 'warning' && 'text-amber-700',
                )}
            >
                {value}
            </p>
            {hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
        </div>
    );
}

export function Empty({
    icon,
    title,
    children,
}: {
    icon?: ReactNode;
    title: string;
    children?: ReactNode;
}) {
    return (
        <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            {icon && <div className="mb-3 text-stone-300">{icon}</div>}
            <p className="text-sm font-medium text-stone-700">{title}</p>
            {children && (
                <div className="mt-1 text-sm text-stone-500">{children}</div>
            )}
        </div>
    );
}

export function Pagination<T>({ page }: { page: Paginated<T> }) {
    if (page.last_page <= 1) {
        return null;
    }
    return (
        <nav className="flex flex-wrap items-center justify-between gap-3 pt-4 text-sm">
            <span className="text-stone-500">
                {page.from}–{page.to} sur {page.total}
            </span>
            <div className="flex flex-wrap gap-1">
                {page.links.map((l, i) =>
                    l.url ? (
                        <Link
                            key={i}
                            href={l.url}
                            preserveScroll
                            className={cn(
                                'rounded-md px-3 py-1.5',
                                l.active
                                    ? 'bg-ink text-white'
                                    : 'text-stone-600 hover:bg-stone-100',
                            )}
                        >
                            <span
                                dangerouslySetInnerHTML={{
                                    __html: l.label
                                        .replace('&laquo; Previous', '‹')
                                        .replace('Next &raquo;', '›'),
                                }}
                            />
                        </Link>
                    ) : null,
                )}
            </div>
        </nav>
    );
}

export function Table({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('-mx-5 overflow-x-auto', className)}>
            <table className="w-full min-w-max text-left text-sm">
                {children}
            </table>
        </div>
    );
}

export function Th({
    children,
    className,
}: {
    children?: ReactNode;
    className?: string;
}) {
    return (
        <th
            className={cn(
                'border-b border-stone-100 px-5 py-2.5 text-xs font-medium tracking-wide whitespace-nowrap text-stone-500 uppercase',
                className,
            )}
        >
            {children}
        </th>
    );
}

export function Td({
    children,
    className,
    colSpan,
}: {
    children?: ReactNode;
    className?: string;
    colSpan?: number;
}) {
    return (
        <td
            colSpan={colSpan}
            className={cn(
                'border-b border-stone-100 px-5 py-3 align-top',
                className,
            )}
        >
            {children}
        </td>
    );
}

export function PageHeader({
    title,
    subtitle,
    actions,
    back,
}: {
    title: ReactNode;
    subtitle?: ReactNode;
    actions?: ReactNode;
    back?: { href: string; label: string };
}) {
    return (
        <div className="mb-6">
            {back && (
                <Link
                    href={back.href}
                    className="mb-2 inline-block text-sm text-stone-500 hover:text-stone-900"
                >
                    ← {back.label}
                </Link>
            )}
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                    <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
                        {title}
                    </h1>
                    {subtitle && (
                        <div className="mt-1 text-sm text-stone-500">
                            {subtitle}
                        </div>
                    )}
                </div>
                {actions && (
                    <div className="flex flex-wrap items-center gap-2">
                        {actions}
                    </div>
                )}
            </div>
        </div>
    );
}

export function Progress({ value, max }: { value: number; max: number }) {
    const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
    return (
        <div className="flex items-center gap-2">
            <div className="h-1.5 w-full min-w-16 overflow-hidden rounded-full bg-stone-100">
                <div
                    className="h-full rounded-full bg-brand-500"
                    style={{ width: `${pct}%` }}
                />
            </div>
            <span className="tabular text-xs text-stone-500">
                {value}/{max}
            </span>
        </div>
    );
}

export function Checkbox({
    label,
    checked,
    onChange,
}: {
    label: ReactNode;
    checked: boolean;
    onChange: (v: boolean) => void;
}) {
    return (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-700">
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="size-4 rounded border-stone-300 accent-stone-900"
            />
            {label}
        </label>
    );
}

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

const NBSP = '\u00a0';

/** 1250000 -> "1 250 000 FCFA", with non-breaking spaces so an amount never wraps mid-number. */
export function fcfa(amount: number | null | undefined): string {
    return `${num(amount)}${NBSP}FCFA`;
}

export function num(amount: number | null | undefined): string {
    return nf.format(amount ?? 0).replace(/[\s\u202f\u00a0]/g, NBSP);
}

/** Compact for charts: 1 250 000 -> "1,3 M". */
export function compact(amount: number): string {
    const abs = Math.abs(amount);
    if (abs >= 1_000_000) {
        return `${(amount / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}${NBSP}M`;
    }
    if (abs >= 1_000) {
        return `${Math.round(amount / 1_000)}${NBSP}k`;
    }
    return String(amount);
}

export function date(value: string | null | undefined): string {
    if (!value) {
        return '—';
    }
    const d = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function dateTime(value: string | null | undefined): string {
    if (!value) {
        return '—';
    }
    return new Date(value).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function relative(value: string): string {
    const diff = (Date.now() - new Date(value).getTime()) / 1000;
    if (diff < 60) {
        return "à l'instant";
    }
    if (diff < 3600) {
        return `il y a ${Math.floor(diff / 60)} min`;
    }
    if (diff < 86400) {
        return `il y a ${Math.floor(diff / 3600)} h`;
    }
    if (diff < 86400 * 7) {
        return `il y a ${Math.floor(diff / 86400)} j`;
    }
    return date(value);
}

export function dueLabel(daysLeft: number, isLate: boolean, daysLate: number): string {
    if (isLate) {
        return `${daysLate} j de retard`;
    }
    if (daysLeft === 0) {
        return "Aujourd'hui";
    }
    if (daysLeft === 1) {
        return 'Demain';
    }
    if (daysLeft < 0) {
        return 'Échue';
    }
    return `Dans ${daysLeft} j`;
}

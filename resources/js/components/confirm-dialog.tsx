import { router } from '@inertiajs/react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState, useSyncExternalStore } from 'react';
import { Button, Modal } from '@/components/ui';

type Request = {
    method: 'post' | 'put' | 'delete';
    url: string;
    data?: Record<string, unknown>;
};

export type ConfirmOptions = {
    title: string;
    message: ReactNode;
    confirmLabel: string;
    tone?: 'danger' | 'primary';
    /** Runs this request when confirmed; the dialog shows a spinner and closes when it finishes. */
    request?: Request;
};

type State = (ConfirmOptions & { resolve: (ok: boolean) => void }) | null;

// Tiny global store so any component (even a page outside the layout tree) can open the dialog.
let state: State = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/**
 * Opens the app's confirmation dialog (instead of the browser's confirm()).
 * Resolves true when confirmed (after the request finished, if any), false when cancelled.
 */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
        state?.resolve(false);
        state = { ...options, resolve };
        emit();
    });
}

function close(ok: boolean) {
    state?.resolve(ok);
    state = null;
    emit();
}

/** Mounted once in the app layout. */
export function ConfirmHost() {
    const current = useSyncExternalStore(
        (l) => {
            listeners.add(l);
            return () => listeners.delete(l);
        },
        () => state,
    );
    const [busy, setBusy] = useState(false);

    const confirm = () => {
        if (!current?.request) {
            close(true);
            return;
        }
        const { method, url, data } = current.request;
        setBusy(true);
        router.visit(url, {
            method,
            data: data as never,
            preserveScroll: true,
            onFinish: () => {
                setBusy(false);
                close(true);
            },
        });
    };

    const danger = (current?.tone ?? 'danger') === 'danger';

    return (
        <Modal
            open={current !== null}
            onClose={() => !busy && close(false)}
            size="sm"
            title={
                <span className="flex items-center gap-2">
                    {danger ? <AlertTriangle className="size-5 text-red-600" /> : <HelpCircle className="size-5 text-stone-500" />}
                    {current?.title}
                </span>
            }
            onSubmit={confirm}
            footer={
                <>
                    <Button variant="secondary" onClick={() => close(false)} disabled={busy}>
                        Annuler
                    </Button>
                    <Button type="submit" variant={danger ? 'danger' : 'primary'} loading={busy} autoFocus>
                        {current?.confirmLabel}
                    </Button>
                </>
            }
        >
            <div className="text-sm leading-relaxed text-stone-600">{current?.message}</div>
        </Modal>
    );
}

import type { Auth } from '@/types/auth';

declare module 'react' {
    interface InputHTMLAttributes<T> {
        passwordrules?: string;
    }
}

declare module '@inertiajs/core' {
    export interface InertiaConfig {
        sharedPageProps: {
            name: string;
            auth: Auth;
            studio: { name: string; logo: string | null } | null;
            unreadNotifications: number;
            vapidPublicKey: string | null;
            features: { templates: boolean };
            flash: {
                success: string | null;
                error: string | null;
                credentials: { id: number; name: string; email: string; phone: string | null; password: string; new: boolean; login_url: string; mail_sent: boolean } | null;
            };
            [key: string]: unknown;
        };
    }
}

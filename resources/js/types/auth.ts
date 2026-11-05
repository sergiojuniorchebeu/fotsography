export type User = {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    role: 'admin' | 'assistant' | 'photographe' | 'videaste' | 'monteur';
    role_label: string;
    is_active: boolean;
    is_admin: boolean;
    is_staff: boolean;
    must_change_password: boolean;
};

export type Auth = {
    user: User | null;
};

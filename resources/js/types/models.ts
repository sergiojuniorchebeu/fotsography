export type Option = { value: string; label: string };

export type Paginated<T> = {
    data: T[];
    current_page: number;
    last_page: number;
    total: number;
    from: number | null;
    to: number | null;
    links: { url: string | null; label: string; active: boolean }[];
};

export type Member = { id: number; name: string; role: string; role_label: string; open_count?: number; waiting_count?: number; review_count?: number; late_count?: number };

export type SiblingTask = { id: number; name: string; activity: string | null; assignee: string | null; due_date: string; status_label: string };

export type Project = {
    id: number;
    name: string;
    location: string | null;
    event_date: string | null;
    delivery_date: string;
    status: string;
    status_label: string;
    notes: string | null;
    client: { id: number; name: string } | null;
    tasks_total?: number;
    tasks_done?: number;
    total_amount?: number;
    advance_pct?: number;
    intermediate_pct?: number;
    balance_pct?: number;
    paid?: number;
    remaining?: number;
};

export type Review = {
    id: number;
    action: 'started' | 'submitted' | 'validated' | 'returned';
    comment: string | null;
    corrections: string | null;
    proof_url: string | null;
    user: string | null;
    created_at: string;
};

export type MemberPayment = {
    id: number;
    receipt_number: string;
    gross_amount: number;
    penalty_deducted: number;
    net_amount: number;
    method: string;
    method_label: string;
    reference: string | null;
    note: string | null;
    paid_at: string;
    paid_by: string | null;
    member?: string | null;
    task?: { id: number; name: string } | null;
};

export type ClientPayment = {
    id: number;
    receipt_number: string;
    type: string;
    type_label: string;
    amount: number;
    method: string;
    method_label: string;
    reference: string | null;
    note: string | null;
    paid_at: string;
    recorded_by: string | null;
    project?: { id: number; name: string } | null;
};

export type PenaltyRow = {
    id: number;
    period: number;
    amount: number;
    days_late: number;
    accrued_at: string;
    cancelled_at: string | null;
    cancel_reason: string | null;
    cancelled_by: string | null;
};

export type Task = {
    id: number;
    name: string;
    status: 'todo' | 'in_progress' | 'review' | 'done';
    status_label: string;
    due_date: string;
    started_at: string | null;
    depends_on_id: number | null;
    is_waiting: boolean;
    dependency: { id: number; name: string; status: string; status_label: string; assignee: string | null; due_date: string; delivery_url: string | null; delivery_note: string | null } | null;
    dependents?: { id: number; name: string; assignee: string | null; status: string; status_label: string }[];
    is_late: boolean;
    days_late: number;
    days_left: number;
    submitted_at: string | null;
    validated_at: string | null;
    proof_url: string | null;
    proof_note: string | null;
    assignee: { id: number; name: string; role_label: string } | null;
    activity: { id: number; name: string } | null;
    project: { id: number; name: string } | null;
    penalty_periods: number;
    instructions?: string | null;
    reviews?: Review[];
    member_fee?: number;
    client_share?: number;
    paid_gross?: number;
    remaining_fee?: number;
    payments?: MemberPayment[];
    penalties?: PenaltyRow[];
};

export type Expense = {
    id: number;
    description: string;
    supplier: string | null;
    amount: number;
    spent_at: string;
    recorded_by: string | null;
};

export type Activity = {
    id: number;
    name: string;
    description: string | null;
    tasks: Task[];
    expenses: Expense[];
};

export type FinanceSummary = {
    revenue: number;
    collected: number;
    remaining: number;
    expenses: number;
    fees_paid: number;
    withheld: number;
    penalties_collected: number;
    penalty_refunds: number;
    margin: number;
};

export type MonthPoint = {
    month: string;
    label: string;
    collected: number;
    expenses: number;
    fees: number;
    margin: number;
};

export type MemberStat = {
    id: number;
    name: string;
    role_label: string;
    is_active: boolean;
    tasks: number;
    done: number;
    late: number;
    penalized: number;
    fees_total: number;
    gross_paid: number;
    net_paid: number;
    remaining: number;
    penalties: number;
    penalty_debt: number;
};

export type AppNotification = {
    id: string;
    kind: string;
    title: string;
    body: string;
    url: string | null;
    read_at: string | null;
    created_at: string;
};

export type TemplateTask = {
    key: string;
    name: string;
    instructions: string | null;
    role: string | null;
    from: 'event' | 'delivery';
    days: number;
    member_fee: number;
    client_pct: number;
    after: string | null;
};

export type ProjectTemplate = {
    id: number;
    name: string;
    description: string | null;
    structure: { activities: { name: string; tasks: TemplateTask[] }[] };
    tasks_count: number;
    client_pct_total: number;
    updated_at: string | null;
};

/** A template as it would land on a given project (dates computed, people suggested). */
export type TemplatePreview = {
    id: number;
    name: string;
    description: string | null;
    tasks: { key: string; name: string; activity: string; role: string | null; role_label: string | null; after: string | null; due_date: string; assigned_to: number | null; member_fee?: number; client_share?: number }[];
};

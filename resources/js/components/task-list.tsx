import { Link } from '@inertiajs/react';
import { CalendarClock, Hourglass } from 'lucide-react';
import { Empty, TaskStatusBadge } from '@/components/ui';
import { date, dueLabel, fcfa } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Task } from '@/types';

export function DueChip({ task }: { task: Task }) {
    if (task.status === 'done') {
        return <span className="text-xs text-stone-400">{date(task.due_date)}</span>;
    }
    if (task.is_waiting) {
        return (
            <span className="inline-flex items-center gap-1 text-xs whitespace-nowrap text-stone-500" title={task.dependency ? `Démarre quand « ${task.dependency.name} » est validée` : undefined}>
                <Hourglass className="size-3.5" />En attente · {date(task.due_date)}
            </span>
        );
    }
    const urgent = task.is_late || task.days_left <= 1;
    return (
        <span className={cn('inline-flex items-center gap-1 text-xs whitespace-nowrap', task.is_late ? 'font-medium text-red-600' : urgent ? 'font-medium text-amber-700' : 'text-stone-500')}>
            <CalendarClock className="size-3.5" />
            {dueLabel(task.days_left, task.is_late, task.days_late)} · {date(task.due_date)}
        </span>
    );
}

export function TaskList({ tasks, empty, showFee, showProject = true }: { tasks: Task[]; empty: string; showFee?: boolean; showProject?: boolean }) {
    if (tasks.length === 0) {
        return <Empty title={empty} />;
    }
    return (
        <ul className="-my-2 divide-y divide-stone-100">
            {tasks.map((t) => (
                <li key={t.id}>
                    <Link href={`/tasks/${t.id}`} className="-mx-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-2 py-2.5 hover:bg-stone-50">
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-stone-900">{t.name}</p>
                            <p className="truncate text-xs text-stone-500">
                                {showProject && t.project ? `${t.project.name} · ` : ''}
                                {t.activity?.name}
                                {t.assignee ? ` · ${t.assignee.name}` : ''}
                                {t.is_waiting && t.dependency ? ` · après « ${t.dependency.name} »` : ''}
                            </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <TaskStatusBadge status={t.status} label={t.status_label} late={t.is_late} waiting={t.is_waiting} />
                            <DueChip task={t} />
                        </div>
                        {showFee && t.member_fee !== undefined && <span className="tabular w-full text-right text-xs text-stone-500 sm:w-auto">{fcfa(t.member_fee)}</span>}
                    </Link>
                </li>
            ))}
        </ul>
    );
}

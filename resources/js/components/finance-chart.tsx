import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { compact, fcfa } from '@/lib/format';
import type { MonthPoint } from '@/types';

const SERIES = [
    { key: 'collected', name: 'Encaissé', color: '#1f6f5c' },
    { key: 'expenses', name: 'Dépenses', color: '#d77d26' },
    { key: 'fees', name: 'Versé aux membres', color: '#a8a29e' },
] as const;
const MARGIN_COLOR = '#17130f';

/** Round a range to "nice" ticks so the axis never wastes a whole step below zero. */
function niceTicks(min: number, max: number, count = 5): number[] {
    const span = Math.max(max - min, 1);
    const raw = span / count;
    const pow = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
    const ticks: number[] = [];
    for (let v = Math.floor(min / step) * step; v <= Math.ceil(max / step) * step + step / 2; v += step) {
        ticks.push(Math.round(v));
    }
    return ticks;
}

export function MonthlyChart({ data }: { data: MonthPoint[] }) {
    const values = data.flatMap((d) => [d.collected, d.expenses, d.fees, d.margin]);
    const hasData = values.some((v) => v !== 0);

    if (!hasData) {
        return (
            <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-stone-200 text-sm text-stone-500">
                Aucun mouvement d'argent sur les 12 derniers mois.
            </div>
        );
    }

    const ticks = niceTicks(Math.min(0, ...values), Math.max(0, ...values));

    return (
        <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: 288 }}>
                <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
                    <CartesianGrid vertical={false} stroke="#ece9e6" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={12} tick={{ fontSize: 11, fill: '#78716c' }} />
                    <YAxis
                        ticks={ticks}
                        domain={[ticks[0], ticks[ticks.length - 1]]}
                        tickFormatter={compact}
                        tickLine={false}
                        axisLine={false}
                        width={58}
                        tick={{ fontSize: 11, fill: '#78716c' }}
                    />
                    <ReferenceLine y={0} stroke="#d6d3d1" />
                    <Tooltip
                        formatter={(v, name) => [fcfa(Number(v)), name]}
                        contentStyle={{ borderRadius: 12, border: '1px solid #e7e5e4', fontSize: 12 }}
                        cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                    />
                    <Legend
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                        itemSorter={null}
                    />
                    {SERIES.map((s) => (
                        <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
                    ))}
                    <Line dataKey="margin" name="Marge nette" stroke={MARGIN_COLOR} strokeWidth={2} type="linear" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}

const STATUS = [
    { key: 'todo', name: 'À faire', color: '#d97706' },
    { key: 'in_progress', name: 'En cours', color: '#7c3aed' },
    { key: 'waiting', name: 'En attente', color: '#a8a29e' },
    { key: 'review', name: 'À vérifier', color: '#0284c7' },
    { key: 'done', name: 'Terminées', color: '#059669' },
] as const;

export function StatusBars({ counts }: { counts: { todo: number; in_progress?: number; waiting?: number; review: number; done: number } }) {
    const data = STATUS.map((s) => ({ name: s.name, value: counts[s.key] ?? 0, color: s.color }));
    if (data.every((d) => d.value === 0)) {
        return <p className="py-8 text-center text-sm text-stone-500">Aucune tâche pour l'instant.</p>;
    }
    return (
        <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 400, height: 208 }}>
                <BarChart data={data} layout="vertical" margin={{ top: 4, right: 32, left: 0, bottom: 4 }}>
                    <XAxis type="number" hide allowDecimals={false} domain={[0, 'dataMax']} />
                    <YAxis type="category" dataKey="name" width={120} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#57534e' }} />
                    <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} contentStyle={{ borderRadius: 12, fontSize: 12 }} formatter={(v) => [v, 'Tâches']} />
                    <Bar dataKey="value" isAnimationActive={false} radius={[0, 6, 6, 0]} barSize={18} minPointSize={2} label={{ position: 'right', fontSize: 12, fill: '#44403c' }}>
                        {data.map((d) => <Cell key={d.name} fill={d.color} />)}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

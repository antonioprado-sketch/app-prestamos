import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface WeeklyTrendPoint {
  weekStart: string;
  capitalCobrado: number;
}

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

function formatWeekLabel(weekStart: string) {
  const date = new Date(`${weekStart}T00:00:00`);
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

export default function WeeklyTrendChart({ data }: { data: WeeklyTrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="weekStart"
          tickFormatter={formatWeekLabel}
          tick={{ fontSize: 11 }}
        />
        <YAxis tickFormatter={(v: number) => currency.format(v)} tick={{ fontSize: 11 }} width={80} />
        <Tooltip
          formatter={(value) => currency.format(Number(value))}
          labelFormatter={(label) => formatWeekLabel(String(label))}
        />
        <Line
          type="monotone"
          dataKey="capitalCobrado"
          name="Capital cobrado"
          stroke="#0F8B5F"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '../../utils/insightsEngine';

const COLORS = [
  '#22C55E', '#16A34A', '#4ADE80', '#86EFAC',
  '#0EA5E9', '#6366F1', '#F59E0B', '#EF4444',
];

interface DataPoint { name: string; amount: number; count: number; }
interface Props { data: DataPoint[]; currency: string; }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, currency }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)', padding: '10px 14px',
      fontSize: 12,
    }}>
      <p style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{d.name}</p>
      <p style={{ color: d.payload.fill, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
        {formatCurrency(d.value, currency)}
      </p>
      <p style={{ color: 'var(--text3)', marginTop: 2 }}>
        {d.payload.count} donations · {d.payload.pct}%
      </p>
    </div>
  );
};

export function CategoryBreakdown({ data, currency }: Props) {
  const total = data.reduce((s, d) => s + d.amount, 0);
  const topItems = data.slice(0, 7);
  const restAmount = data.slice(7).reduce((s, d) => s + d.amount, 0);
  const restCount  = data.slice(7).reduce((s, d) => s + d.count, 0);
  const chartData = [
    ...topItems,
    ...(restAmount > 0 ? [{ name: 'Other', amount: restAmount, count: restCount }] : []),
  ].map(d => ({ ...d, pct: ((d.amount / total) * 100).toFixed(1) }));

  return (
    <div>
      {/* Donut */}
      <div style={{ width: '100%', height: 180 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={chartData} cx="50%" cy="50%"
              innerRadius="50%" outerRadius="80%"
              dataKey="amount" nameKey="name"
              paddingAngle={2} strokeWidth={0}
            >
              {chartData.map((entry, i) => (
                <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip currency={currency} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
        {chartData.map((entry, i) => (
          <div key={entry.name} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '5px 0',
            borderBottom: i < chartData.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 12, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {entry.name}
            </span>
            <span className="num" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', flexShrink: 0 }}>
              {entry.pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

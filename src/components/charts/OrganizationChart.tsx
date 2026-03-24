import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { formatCurrency } from '../../utils/insightsEngine';

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
      <p style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{d.payload.name}</p>
      <p style={{ color: 'var(--green)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
        {formatCurrency(d.value, currency)}
      </p>
      <p style={{ color: 'var(--text3)', marginTop: 2 }}>
        {d.payload.count} donation{d.payload.count !== 1 ? 's' : ''}
      </p>
    </div>
  );
};

const truncate = (s: string, max = 20) => s.length > max ? s.slice(0, max) + '…' : s;

export function OrganizationChart({ data, currency }: Props) {
  const top8 = data.slice(0, 8);

  return (
    <div style={{ width: '100%', height: Math.max(180, top8.length * 40 + 30) }}>
      <ResponsiveContainer>
        <BarChart
          layout="vertical"
          data={top8.map(d => ({ ...d, displayName: truncate(d.name) }))}
          margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: 'var(--text3)' }}
            axisLine={false} tickLine={false}
            tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
          />
          <YAxis
            type="category" dataKey="displayName"
            tick={{ fontSize: 12, fill: 'var(--text2)' }}
            axisLine={false} tickLine={false}
            width={110}
          />
          <Tooltip content={<CustomTooltip currency={currency} />} cursor={false} />
          <Bar dataKey="amount" radius={[0, 4, 4, 0]} maxBarSize={24} activeBar={false}>
            {top8.map((_, i) => (
              <Cell
                key={i}
                fill={`rgba(34,197,94,${1 - i * 0.1})`}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

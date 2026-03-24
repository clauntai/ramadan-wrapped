import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { formatShortDate, formatCurrency } from '../../utils/insightsEngine';

interface DataPoint { date: Date; amount: number; count: number; }
interface Props { data: DataPoint[]; currency: string; last10Start?: Date; }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label, currency }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)', padding: '10px 14px',
      fontSize: 12,
    }}>
      <p style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{label}</p>
      <p style={{ color: 'var(--green)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        {formatCurrency(payload[0]?.value || 0, currency)}
      </p>
      <p style={{ color: 'var(--text3)', marginTop: 2 }}>
        {payload[0]?.payload?.count} donation{payload[0]?.payload?.count !== 1 ? 's' : ''}
      </p>
    </div>
  );
};

export function DonationTimeline({ data, currency, last10Start }: Props) {
  const chartData = data.map(d => ({
    label: formatShortDate(d.date),
    amount: d.amount,
    count: d.count,
  }));

  const last10Ref = last10Start
    ? chartData[data.findIndex(d => d.date >= last10Start!)]?.label
    : undefined;

  return (
    <div style={{ width: '100%', flex: 1, minHeight: 220 }}>
      <ResponsiveContainer>
        <AreaChart data={chartData} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22C55E" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#22C55E" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: 'var(--text3)' }}
            axisLine={false} tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--text3)' }}
            axisLine={false} tickLine={false}
            tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
            width={38}
          />
          <Tooltip content={<CustomTooltip currency={currency} />} />
          {last10Ref && (
            <ReferenceLine
              x={last10Ref}
              stroke="var(--green)"
              strokeDasharray="3 4"
              strokeWidth={1.5}
              label={{ value: 'Last 10', position: 'insideTopRight', fontSize: 10, fill: 'var(--green)', dy: -4 }}
            />
          )}
          <Area
            type="monotone"
            dataKey="amount"
            stroke="var(--green)"
            strokeWidth={2}
            fill="url(#greenGrad)"
            dot={data.length <= 35 ? { r: 2.5, fill: 'var(--green)', strokeWidth: 0 } : false}
            activeDot={{ r: 4, fill: 'var(--green)', strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

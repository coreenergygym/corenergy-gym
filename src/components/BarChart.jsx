// Deliberately simple: plain divs sized by percentage, no charting
// library. Keeps the app lightweight and matches the spec's
// "keep charts simple, do not create complicated analytics" rule.
export default function BarChart({ data, formatValue = (v) => v, color = 'var(--accent)', emptyLabel = 'No data yet' }) {
  const max = Math.max(1, ...data.map((d) => Number(d.value) || 0))

  return (
    <div className="bar-chart">
      {data.length === 0 ? (
        <p style={{ color: 'var(--muted)', margin: 0 }}>{emptyLabel}</p>
      ) : (
        <div className="bar-chart-track">
          {data.map((d, i) => {
            const pct = Math.max(2, Math.round((Number(d.value) / max) * 100))
            return (
              <div className="bar-chart-col" key={d.label + i}>
                <div className="bar-chart-value">{formatValue(d.value)}</div>
                <div className="bar-chart-bar-wrap">
                  <div className="bar-chart-bar" style={{ height: `${pct}%`, background: color }} />
                </div>
                <div className="bar-chart-label">{d.label}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

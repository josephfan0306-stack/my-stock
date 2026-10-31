/** 迷你走勢線（純 SVG） */
export default function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <div className="h-10" />;

  const width = 120;
  const height = 40;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((v, i) => [
    (i / (values.length - 1)) * width,
    height - 2 - ((v - min) / span) * (height - 4),
  ]);
  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `0,${height} ${line} ${width},${height}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-10 w-full">
      <polygon points={area} fill={color} opacity={0.12} />
      <polyline points={line} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

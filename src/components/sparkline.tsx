type Props = {
  data: readonly number[];
  width?: number;
  height?: number;
  /** Stroke color. Defaults to brand blue. */
  color?: string;
  /** Gradient fill under the line. Defaults to a faint brand-blue wash. */
  fill?: boolean;
  className?: string;
};

/**
 * A deliberately tiny sparkline — 28–32px tall, inline SVG. We don't need a
 * charting library for 7–30 datapoints rendered statically; a stretched
 * polyline with a matching gradient area gives you 95% of the visual value
 * at zero runtime cost.
 *
 * The line is always drawn from left-to-right across the full width. Flat or
 * degenerate series (all zero, all equal) render a single mid-height line
 * rather than collapsing to the bottom edge.
 */
export function Sparkline({
  data,
  width = 80,
  height = 28,
  color = "#005bf7",
  fill = true,
  className = "",
}: Props) {
  if (!data || data.length === 0) {
    return <svg aria-hidden className={className} width={width} height={height} />;
  }

  // Normalize into a 0-1 range. Protect against flat series dividing by 0.
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = data.length > 1 ? width / (data.length - 1) : 0;

  const points = data.map((v, i) => {
    const x = data.length > 1 ? i * stepX : width / 2;
    // Invert y so larger values sit higher on the chart.
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const linePath = `M ${points.join(" L ")}`;
  const areaPath = `${linePath} L ${width},${height} L 0,${height} Z`;

  const gradId = `spark-${Math.random().toString(36).slice(2, 9)}`;

  return (
    <svg
      aria-hidden
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      preserveAspectRatio="none"
    >
      {fill ? (
        <>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gradId})`} />
        </>
      ) : null}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

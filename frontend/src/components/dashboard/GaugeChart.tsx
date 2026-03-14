import { useEffect, useRef } from "react";
import * as d3 from "d3";

interface GaugeChartProps {
  value: number; // 0-100
  size?: number;
}

function gaugeColor(v: number): string {
  if (v >= 80) return "#ef4444";
  if (v >= 60) return "#f59e0b";
  return "#34d399";
}

export default function GaugeChart({ value, size = 120 }: GaugeChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;

    const w = size;
    const h = size * 0.6;
    const r = size * 0.45;
    const cx = w / 2;
    const cy = h * 0.95;
    const startAngle = -Math.PI * 0.75;
    const endAngle = Math.PI * 0.75;

    d3.select(el).selectAll("*").remove();

    const svg = d3
      .select(el)
      .attr("width", w)
      .attr("height", h)
      .attr("viewBox", `0 0 ${w} ${h}`);

    // Track arc
    const trackArc = d3
      .arc<{ startAngle: number; endAngle: number }>()
      .innerRadius(r * 0.72)
      .outerRadius(r)
      .startAngle(startAngle)
      .endAngle(endAngle)
      .cornerRadius(4);

    svg
      .append("path")
      .datum({ startAngle, endAngle })
      .attr("d", trackArc)
      .attr("fill", "currentColor")
      .attr("class", "text-muted/30")
      .attr("transform", `translate(${cx},${cy})`);

    // Value arc
    const valAngle = startAngle + (endAngle - startAngle) * (Math.min(Math.max(value, 0), 100) / 100);
    const valueArc = d3
      .arc<{ startAngle: number; endAngle: number }>()
      .innerRadius(r * 0.72)
      .outerRadius(r)
      .startAngle(startAngle)
      .endAngle(valAngle)
      .cornerRadius(4);

    svg
      .append("path")
      .datum({ startAngle, endAngle: valAngle })
      .attr("d", valueArc)
      .attr("fill", gaugeColor(value))
      .attr("transform", `translate(${cx},${cy})`);

    // Center value text
    svg
      .append("text")
      .attr("x", cx)
      .attr("y", cy - r * 0.18)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("fill", gaugeColor(value))
      .attr("font-size", r * 0.38)
      .attr("font-weight", "700")
      .attr("font-family", "monospace")
      .text(`${Math.round(value)}%`);
  }, [value, size]);

  return <svg ref={svgRef} style={{ overflow: "visible" }} />;
}

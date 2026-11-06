"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function VolumeChart({ data }: { data: Array<{ day: string; volume: number }> }) {
  if (data.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        Not enough demo points for a chart. Showing metrics only.
      </p>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid stroke="hsl(220 12% 18%)" strokeDasharray="3 3" />
          <XAxis dataKey="day" tick={{ fill: "hsl(220 8% 58%)", fontSize: 11 }} />
          <YAxis tick={{ fill: "hsl(220 8% 58%)", fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              background: "hsl(220 14% 9%)",
              border: "1px solid hsl(220 12% 18%)",
              borderRadius: 8,
            }}
          />
          <Area
            type="monotone"
            dataKey="volume"
            stroke="hsl(24 92% 52%)"
            fill="hsl(24 92% 52% / 0.15)"
            name="Settled volume (demo)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

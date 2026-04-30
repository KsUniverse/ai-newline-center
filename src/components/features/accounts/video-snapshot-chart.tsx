"use client";

import { TrendingUp } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { VideoSnapshotDTO } from "@/types/video-link";
import { formatNumber } from "@/lib/utils";

interface VideoSnapshotChartProps {
  snapshots: VideoSnapshotDTO[];
  loading: boolean;
}

const LINE_COLORS = {
  playsCount: "hsl(var(--primary))",
  likesCount: "hsl(var(--chart-orange))",
  commentsCount: "hsl(var(--chart-purple))",
  sharesCount: "hsl(var(--chart-cyan))",
} as const;

const LINE_LABELS = {
  playsCount: "播放",
  likesCount: "点赞",
  commentsCount: "评论",
  sharesCount: "转发",
} as const;

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hour = String(d.getHours()).padStart(2, "0");
  const minute = String(d.getMinutes()).padStart(2, "0");
  return `${month}/${day} ${hour}:${minute}`;
}

export function VideoSnapshotChart({ snapshots, loading }: VideoSnapshotChartProps) {
  if (loading) {
    return (
      <div className="h-56 w-full animate-pulse rounded-lg border border-border/45 bg-background" />
    );
  }

  if (snapshots.length < 2) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/45 bg-background text-center">
        <TrendingUp className="h-6 w-6 text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground/80">数据采集中，稍后刷新可查看趋势</p>
      </div>
    );
  }

  const chartData = snapshots.map((s) => ({
    time: formatTimestamp(s.timestamp),
    playsCount: s.playsCount,
    likesCount: s.likesCount,
    commentsCount: s.commentsCount,
    sharesCount: s.sharesCount,
  }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.35)" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => formatNumber(v)}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border)/0.55)",
              borderRadius: "8px",
              fontSize: 12,
            }}
            formatter={(value, name) => [
              typeof value === "number" ? formatNumber(value) : String(value),
              LINE_LABELS[name as keyof typeof LINE_LABELS] ?? String(name),
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            formatter={(value: string) =>
              LINE_LABELS[value as keyof typeof LINE_LABELS] ?? value
            }
          />
          {(Object.keys(LINE_COLORS) as (keyof typeof LINE_COLORS)[]).map((key) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={LINE_COLORS[key]}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

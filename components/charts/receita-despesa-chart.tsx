"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ResumoMensal } from "@/lib/data/dashboard";
import { formatBRL } from "@/lib/format";

export function ReceitaDespesaChart({ data }: { data: ResumoMensal[] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={12} />
        <YAxis
          tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
          tickLine={false}
          axisLine={false}
          fontSize={12}
          width={44}
        />
        <Tooltip
          formatter={(value) => formatBRL(Number(value))}
          labelClassName="font-medium"
          contentStyle={{
            borderRadius: 8,
            border: "1px solid var(--border)",
            fontSize: 13,
          }}
        />
        <Legend />
        <Bar dataKey="receita" name="Receita" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="despesa" name="Despesa" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

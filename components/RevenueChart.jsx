"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const data = [
  { day: "T2", revenue: 10 },
  { day: "T3", revenue: 20 },
  { day: "T4", revenue: 15 },
  { day: "T5", revenue: 30 },
  { day: "T6", revenue: 25 },
];

export default function RevenueChart() {
  return (
    <div className="bg-white p-5 rounded-2xl shadow">
      <h2 className="font-semibold mb-3">Doanh thu tuần</h2>

      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="day" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="revenue" strokeWidth={3} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
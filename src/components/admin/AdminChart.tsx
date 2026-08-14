'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';

const data = [
  { name: 'Mon', visitors: 400 },
  { name: 'Tue', visitors: 650 },
  { name: 'Wed', visitors: 300 },
  { name: 'Thu', visitors: 1000 },
  { name: 'Fri', visitors: 550 },
  { name: 'Sat', visitors: 800 },
  { name: 'Sun', visitors: 450 },
];

export function AdminChart() {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis 
          dataKey="name" 
          axisLine={false} 
          tickLine={false} 
          tick={{ fontSize: 12, fill: '#94a3b8' }} 
          dy={10}
        />
        <YAxis 
          axisLine={false} 
          tickLine={false} 
          tick={{ fontSize: 12, fill: '#94a3b8' }} 
        />
        <Tooltip
          cursor={{ fill: '#f8fafc' }}
          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
        />
        <Bar 
          dataKey="visitors" 
          fill="#a7f3d0" 
          radius={[4, 4, 0, 0]} 
          activeBar={{ fill: '#1b4d3e' }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

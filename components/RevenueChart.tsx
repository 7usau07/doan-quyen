'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts'

export default function RevenueChart() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchChartData() {
      // Lấy dữ liệu đơn hàng từ Supabase
      const { data: orders, error } = await supabase
        .from('orders')
        .select('created_at, revenue, profit')
        .order('created_at', { ascending: true }) 

      if (error) {
        console.error("Lỗi lấy dữ liệu chart:", error)
        setLoading(false)
        return
      }

      if (orders && orders.length > 0) {
        // Gom nhóm theo ngày
        const groupedData: Record<string, { name: string, Doanh_thu: number, Loi_nhuan: number }> = {}
        
        orders.forEach(order => {
          const dateObj = new Date(order.created_at)
          const dateStr = `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}`
          
          if (!groupedData[dateStr]) {
            groupedData[dateStr] = { name: dateStr, Doanh_thu: 0, Loi_nhuan: 0 }
          }
          groupedData[dateStr].Doanh_thu += Number(order.revenue) || 0
          groupedData[dateStr].Loi_nhuan += Number(order.profit) || 0
        })

        setData(Object.values(groupedData))
      }
      setLoading(false)
    }

    fetchChartData()
  }, [])

  if (loading) return <div className="h-full w-full flex items-center justify-center italic text-gray-400 font-medium animate-pulse">Đang vẽ biểu đồ dòng tiền...</div>
  if (data.length === 0) return <div className="h-full w-full flex items-center justify-center italic text-gray-400">Chưa có dữ liệu để vẽ biểu đồ</div>

  return (
    <div className="h-full w-full min-h-[350px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 13, fill: '#6b7280', fontWeight: 'bold' }} 
            dy={10}
          />
          <YAxis 
            tickFormatter={(value) => `${value / 1000000}M`} 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 13, fill: '#6b7280', fontWeight: 'bold' }}
            width={60}
          />
          <Tooltip 
            formatter={(value: any) => [`${Number(value).toLocaleString('vi-VN')}đ`]}
            cursor={{ fill: '#f3f4f6' }}
            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
          />
          <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '14px', fontWeight: 'bold' }} />
          
          <Bar dataKey="Doanh_thu" name="Doanh Thu" fill="#d946ef" radius={[6, 6, 0, 0]} maxBarSize={45} />
          <Bar dataKey="Loi_nhuan" name="Lợi Nhuận" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={45} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
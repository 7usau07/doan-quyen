'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts'
import { 
  Package, DollarSign, TrendingUp, Receipt, Truck, Wallet, Scale, Droplet, X, History, ShoppingBag, FileWarning, Clock
} from 'lucide-react'

export default function DashboardPage() {
  const [data, setData] = useState({ orders: [] as any[], batches: [] as any[] })
  const [loading, setLoading] = useState(true)
  const [hasMounted, setHasMounted] = useState(false)
  const [selectedMetric, setSelectedMetric] = useState<{ title: string, type: string } | null>(null)

  useEffect(() => { setHasMounted(true) }, [])

  const fetchData = async () => {
    try {
      const [ordersRes, batchesRes] = await Promise.all([
        supabase.from('orders').select('*, customers(name)').order('created_at', { ascending: false }),
        supabase.from('batches').select('*')
      ])
      if (ordersRes.data && batchesRes.data) {
        setData({ orders: ordersRes.data, batches: batchesRes.data })
      }
    } catch (err) {
      console.error("Lỗi Dashboard Duy ơi:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`
  }

  const stats = useMemo(() => {
    const totalWeightPurchased = data.batches.reduce((sum, b) => sum + Number(b.total_weight || 0), 0)
    const totalPurchaseMoney = data.batches.reduce((sum, b) => sum + (Number(b.total_weight) * Number(b.cost_per_kg)), 0)
    
    const totalSoldWeight = data.orders.reduce((sum, o) => sum + Number(o.weight || 0), 0)
    const totalLossWeight = data.orders.reduce((sum, o) => sum + Number(o.weight_loss || 0), 0)
    const remainingWeight = totalWeightPurchased - totalSoldWeight - totalLossWeight

    const weightWithReceipt = data.batches.filter(b => b.has_receipt).reduce((sum, b) => sum + Number(b.total_weight || 0), 0)
    const weightWithoutReceipt = data.batches.filter(b => !b.has_receipt).reduce((sum, b) => sum + Number(b.total_weight || 0), 0)

    const completedOrders = data.orders.filter(o => o.status === 'Hoàn tất');
    const pendingOrders = data.orders.filter(o => o.status !== 'Hoàn tất');

    const totalRevenue = completedOrders.reduce((sum, o) => sum + Number(o.revenue || 0), 0)
    const totalTax = completedOrders.reduce((sum, o) => sum + Number(o.tax_amount || 0), 0)
    const totalShip = completedOrders.reduce((sum, o) => sum + Number(o.shipping_fee || 0), 0)
    const totalProfit = completedOrders.reduce((sum, o) => sum + Number(o.profit || 0), 0)

    const pendingRevenue = pendingOrders.reduce((sum, o) => sum + Number(o.revenue || 0), 0)
    const pendingProfit = pendingOrders.reduce((sum, o) => sum + Number(o.profit || 0), 0)

    // Gộp dữ liệu cho Biểu Đồ
    const groupedChart: Record<string, any> = {}
    completedOrders.slice().reverse().forEach(o => {
      const d = formatDate(o.created_at)
      if (!groupedChart[d]) groupedChart[d] = { name: d, Doanh_thu: 0, Loi_nhuan: 0 }
      groupedChart[d].Doanh_thu += Number(o.revenue || 0)
      groupedChart[d].Loi_nhuan += Number(o.profit || 0)
    })

    return { 
      totalWeightPurchased, totalPurchaseMoney, totalSoldWeight, totalLossWeight, 
      remainingWeight, totalRevenue, totalTax, totalShip, totalProfit,
      pendingRevenue, pendingProfit, 
      weightWithReceipt, weightWithoutReceipt,
      chartData: Object.values(groupedChart)
    }
  }, [data])

  if (!hasMounted) return null
  if (loading) return <div className="p-10 font-black text-gray-300 animate-pulse text-center uppercase tracking-widest">Hệ thống YẾN SÀO ĐOÀN QUYÊN đang tổng hợp sổ sách...</div>

  return (
    <div className="p-6 space-y-8 animate-in fade-in duration-700 pb-20 max-w-7xl mx-auto">
      <div className="flex flex-col gap-1">
        <h1 className="text-4xl font-black text-gray-900 tracking-tighter uppercase italic">Trung tâm điều hành YẾN SÀO ĐOÀN QUYÊN</h1>
        <p className="text-gray-500 font-bold text-[10px] uppercase tracking-widest">Báo cáo tài chính & Tồn kho thực tế</p>
      </div>

      {stats.weightWithoutReceipt > 0 && (
        <div className="bg-red-50 border border-red-200 p-6 rounded-[30px] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm animate-in zoom-in-95">
            <div className="flex gap-4 items-center">
                <div className="bg-red-100 p-3 rounded-2xl"><FileWarning className="text-red-500" size={28} /></div>
                <div>
                   <h4 className="font-black text-red-800 text-sm uppercase tracking-wider">Cảnh báo thiếu Bảng Kê (Chứng từ)</h4>
                   <p className="text-red-600 text-xs font-bold mt-1">Đang có <span className="text-xl font-black">{stats.weightWithoutReceipt.toFixed(3)}kg</span> yến mua vào chưa có bảng kê hợp lệ thuế.</p>
                </div>
            </div>
            <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="text-right hidden md:block">
                    <p className="text-[10px] text-red-400 font-black uppercase">Đã có bảng kê</p>
                    <p className="text-sm font-black text-green-600">{stats.weightWithReceipt.toFixed(3)}kg an toàn</p>
                </div>
                <Link href="/dashboard/inventory" className="bg-red-600 text-white px-6 py-3 rounded-xl text-xs font-black uppercase hover:bg-red-700 w-full md:w-auto text-center shadow-lg shadow-red-500/30">Đi bổ sung ngay</Link>
            </div>
        </div>
      )}

      {/* LƯỚI 9 CHỈ SỐ KINH DOANH (GIỮ NGUYÊN MÀU SẾP THÍCH) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <MetricCard title="Tổng kg yến nhập" value={`${stats.totalWeightPurchased.toFixed(3)} kg`} icon={<Package size={20}/>} color="bg-slate-800" onClick={() => setSelectedMetric({title: 'Lịch sử nhập lô', type: 'batches'})} />
        <MetricCard title="Tổng kg đã xuất" value={`${stats.totalSoldWeight.toFixed(3)} kg`} icon={<ShoppingBag size={20}/>} color="bg-cyan-500" onClick={() => setSelectedMetric({title: 'Lịch sử khách mua', type: 'sold'})} />
        <MetricCard title="Hao hụt thực tế" value={`${stats.totalLossWeight.toFixed(3)} kg`} icon={<Scale size={20}/>} color="bg-red-500" onClick={() => setSelectedMetric({title: 'Lịch sử hao hụt đơn hàng', type: 'loss'})} />
        <MetricCard title="Tồn kho hiện tại" value={`${stats.remainingWeight.toFixed(3)} kg`} icon={<Droplet size={20}/>} color="bg-blue-600" />
        
        <MetricCard title="Tổng vốn đầu tư" value={`${stats.totalPurchaseMoney.toLocaleString()}đ`} icon={<DollarSign size={20}/>} color="bg-slate-700" />
        
        <MetricCard 
          title="Doanh thu (Thực thu)" 
          value={`${stats.totalRevenue.toLocaleString()}đ`} 
          icon={<TrendingUp size={24}/>} 
          color="bg-fuchsia-600" 
          subText={`Đang chờ thu: ${stats.pendingRevenue.toLocaleString()}đ`}
          onClick={() => setSelectedMetric({title: 'Chi tiết doanh thu', type: 'revenue'})} 
        />
        
        <MetricCard title="Quỹ Thuế đã xuất (5%)" value={`-${stats.totalTax.toLocaleString()}đ`} icon={<Receipt size={20}/>} color="bg-orange-500" onClick={() => setSelectedMetric({title: 'Lịch sử nộp thuế', type: 'tax'})} />
        <MetricCard title="Phí ship đã xuất" value={`-${stats.totalShip.toLocaleString()}đ`} icon={<Truck size={20}/>} color="bg-purple-600" onClick={() => setSelectedMetric({title: 'Lịch sử phí ship', type: 'ship'})} />
        
        {/* LỢI NHUẬN */}
        <div className="col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-4">
            <MetricCard 
              title="LỢI NHUẬN RÒNG (TRONG TÚI)" 
              value={`+${stats.totalProfit.toLocaleString()}đ`} 
              icon={<Wallet size={32}/>} 
              color="bg-green-600" 
              isMain 
              subText={`Khoản lãi đang kẹt ngoài đường (Chưa giao/Nợ): +${stats.pendingProfit.toLocaleString()}đ`}
              onClick={() => setSelectedMetric({title: 'Báo cáo lãi ròng từng đơn', type: 'profit'})} 
            />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* ĐÃ SỬA THÀNH BIỂU ĐỒ ĐƯỜNG (LINE CHART) ĐỂ KHÔNG BỊ BẸP CỘT LỢI NHUẬN NỮA */}
        <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm min-h-[400px]">
          <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter mb-6 flex items-center justify-between">
            <span>📊 Dòng tiền thực tế</span>
            <span className="text-[10px] bg-blue-100 text-blue-600 px-3 py-1 rounded-full tracking-widest">BIỂU ĐỒ ĐƯỜNG</span>
          </h3>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 'bold' }} dy={10} />
              <YAxis tickFormatter={(v) => `${v / 1000000}M`} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 'bold' }} />
              
              <Tooltip 
                cursor={{ stroke: '#e2e8f0', strokeWidth: 1, strokeDasharray: '4 4' }} 
                contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold', fontSize: '12px' }} 
                formatter={(value: any, name: any) => [`${Number(value).toLocaleString('vi-VN')}đ`, name]} 
              />
              
              <Legend wrapperStyle={{paddingTop: '20px', fontSize: '11px', fontWeight: 'black', textTransform: 'uppercase'}} />
              
              {/* Thay Bar bằng Line */}
              <Line type="monotone" dataKey="Doanh_thu" name="Thực Thu" stroke="#d946ef" strokeWidth={4} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="Loi_nhuan" name="Lãi Bỏ Túi" stroke="#10b981" strokeWidth={4} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm space-y-6">
          <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter flex items-center gap-2">🔥 Đơn mới nhất</h3>
          <div className="space-y-4">
            {data.orders.slice(0, 5).map((o) => (
              <div key={o.id} className="flex justify-between items-center p-5 bg-gray-50 rounded-[30px] hover:border-blue-200 border border-transparent transition-all">
                <div className="flex items-center gap-4">
                  <div className="bg-blue-100 text-blue-600 w-10 h-10 rounded-2xl flex items-center justify-center font-black text-[10px]">{formatDate(o.created_at)}</div>
                  <div>
                    <p className="font-black text-gray-900 leading-none">{o.customers?.name}</p>
                    <p className={`text-[10px] font-bold mt-1 uppercase flex items-center gap-1 ${o.status === 'Hoàn tất' ? 'text-green-600' : 'text-orange-500'}`}>
                      {o.weight} kg • {o.status === 'Hoàn tất' ? 'Đã thu tiền' : 'Đang chờ thu'}
                    </p>
                  </div>
                </div>
                <p className={`font-black ${o.status === 'Hoàn tất' ? 'text-emerald-600' : 'text-gray-400'}`}>
                  +{Number(o.profit).toLocaleString()}đ
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* POPUP LỊCH SỬ ĐỐI SOÁT */}
      {selectedMetric && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white rounded-[40px] p-8 w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col relative shadow-2xl animate-in zoom-in-95">
            <button onClick={() => setSelectedMetric(null)} className="absolute top-6 right-6 p-2 bg-gray-100 rounded-full hover:bg-red-50 hover:text-red-500 transition-colors"><X size={24}/></button>
            <div className="mb-8"><h2 className="text-3xl font-black uppercase tracking-tighter text-gray-900 flex items-center gap-3"><History className="text-blue-500" /> {selectedMetric.title}</h2><p className="text-gray-400 font-bold text-[10px] uppercase mt-1 tracking-widest">Dữ liệu đối soát DD PRIME</p></div>
            <div className="overflow-y-auto pr-2">
                <table className="w-full text-left">
                  <thead className="text-[10px] font-black uppercase text-gray-400 border-b">
                    <tr>
                      <th className="p-4">{selectedMetric.type === 'batches' ? 'Mã Lô' : 'Khách hàng'}</th>
                      <th className="p-4">Trạng thái</th>
                      {selectedMetric.type === 'tax' && <th className="p-4">Thuế (5%)</th>}
                      {selectedMetric.type === 'ship' && <th className="p-4">Phí ship</th>}
                      {selectedMetric.type === 'loss' && <th className="p-4">Hao hụt (kg)</th>}
                      {selectedMetric.type === 'profit' && <th className="p-4">Lãi ròng</th>}
                      <th className="p-4">{selectedMetric.type === 'batches' ? 'Số kg nhập' : 'Số kg mua'}</th>
                      <th className="p-4">Doanh thu</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm font-bold">
                    {selectedMetric.type === 'batches' ? data.batches.map(b => (
                      <tr key={b.id} className="border-b hover:bg-gray-50">
                        <td className="p-4 text-blue-600">{b.batch_code}</td>
                        <td className="p-4"><span className="bg-gray-100 px-2 py-1 rounded text-xs">Kho</span></td>
                        <td className="p-4">{Number(b.total_weight).toFixed(3)}kg</td>
                        <td className="p-4">{Number(b.total_weight * b.cost_per_kg).toLocaleString()}đ</td>
                      </tr>
                    )) : data.orders.map(o => (
                      <tr key={o.id} className="border-b hover:bg-gray-50">
                        <td className="p-4 text-gray-900">{o.customers?.name}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-[10px] uppercase ${o.status === 'Hoàn tất' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                            {o.status}
                          </span>
                        </td>
                        {selectedMetric.type === 'tax' && <td className="p-4 text-red-500">-{Number(o.tax_amount).toLocaleString()}đ</td>}
                        {selectedMetric.type === 'ship' && <td className="p-4 text-purple-600">-{Number(o.shipping_fee).toLocaleString()}đ</td>}
                        {selectedMetric.type === 'loss' && <td className="p-4 text-red-500">{Number(o.weight_loss).toFixed(3)}kg</td>}
                        {selectedMetric.type === 'profit' && <td className="p-4 text-emerald-600">+{Number(o.profit).toLocaleString()}đ</td>}
                        <td className="p-4">{Number(o.weight).toFixed(3)}kg</td><td className="p-4 text-blue-600">{Number(o.revenue).toLocaleString()}đ</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MetricCard({ title, value, icon, color, isMain, subText, onClick }: any) {
  return (
    <div onClick={onClick} className={`${color} ${isMain ? 'p-10' : 'p-6'} rounded-[40px] text-white shadow-xl flex flex-col justify-between transition-all duration-300 ${onClick ? 'cursor-pointer hover:scale-[1.03]' : ''}`}>
      <div className="flex justify-between items-start">
        <div className="bg-white/20 p-3 rounded-2xl">{icon}</div>
        {onClick && <div className="text-[8px] font-black uppercase bg-black/20 px-2 py-1 rounded-full hover:bg-black/40 transition">Xem đối soát</div>}
      </div>
      <div className="mt-6">
        <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">{title}</p>
        <h2 className={`${isMain ? 'text-4xl' : 'text-3xl'} font-black tracking-tighter truncate`} title={value}>{value}</h2>
        
        {/* HIỆN THÔNG BÁO TIỀN ĐANG CHỜ THU */}
        {subText && (
          <div className="mt-4 pt-3 border-t border-white/20 flex items-center gap-2 text-xs font-bold opacity-90">
            <Clock size={14} className="animate-pulse" /> {subText}
          </div>
        )}
      </div>
    </div>
  )
}
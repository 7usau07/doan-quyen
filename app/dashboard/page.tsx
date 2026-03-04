'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { 
  BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
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
  if (loading) return <div className="p-10 font-bold text-gray-400 animate-pulse text-center uppercase tracking-widest text-sm">Hệ thống ĐOÀN QUYÊN đang tải dữ liệu...</div>

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-20 max-w-7xl mx-auto font-sans">
      
      <div className="flex flex-col gap-1 mb-2">
        <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tighter uppercase">Trung tâm điều hành</h1>
        <p className="text-gray-500 font-bold text-[10px] md:text-xs uppercase tracking-widest">Báo cáo tài chính & Tồn kho thực tế</p>
      </div>

      {stats.weightWithoutReceipt > 0 && (
        <div className="bg-red-50 border border-red-200 p-4 md:p-6 rounded-[24px] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm animate-in zoom-in-95">
            <div className="flex gap-3 md:gap-4 items-center">
                <div className="bg-red-100 p-2.5 rounded-2xl"><FileWarning className="text-red-500" size={24} /></div>
                <div>
                   <h4 className="font-bold text-red-800 text-xs md:text-sm uppercase tracking-wider">Cảnh báo thiếu Chứng từ Thuế</h4>
                   <p className="text-red-600 text-[10px] md:text-xs font-semibold mt-0.5">Đang có <span className="text-sm md:text-base font-black">{stats.weightWithoutReceipt.toFixed(3)}kg</span> mua vào chưa có bảng kê.</p>
                </div>
            </div>
            <div className="flex items-center justify-between w-full md:w-auto gap-4">
                <div className="text-left md:text-right">
                    <p className="text-[9px] text-red-400 font-bold uppercase">Đã có bảng kê</p>
                    <p className="text-xs font-black text-green-600">{stats.weightWithReceipt.toFixed(3)}kg an toàn</p>
                </div>
                <Link href="/dashboard/inventory" className="bg-red-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase hover:bg-red-700 transition-colors shadow-md">Bổ sung ngay</Link>
            </div>
        </div>
      )}

      {/* LƯỚI 8 CHỈ SỐ KINH DOANH (MÀU SẮC GRADIENT SANG TRỌNG) */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <MetricCard title="Tổng yến nhập" value={`${stats.totalWeightPurchased.toFixed(3)} kg`} icon={<Package size={18}/>} color="bg-gradient-to-br from-slate-700 to-slate-900" onClick={() => setSelectedMetric({title: 'Lịch sử nhập lô', type: 'batches'})} />
        <MetricCard title="Tổng đã xuất" value={`${stats.totalSoldWeight.toFixed(3)} kg`} icon={<ShoppingBag size={18}/>} color="bg-gradient-to-br from-cyan-500 to-cyan-700" onClick={() => setSelectedMetric({title: 'Lịch sử khách mua', type: 'sold'})} />
        <MetricCard title="Hao hụt thực tế" value={`${stats.totalLossWeight.toFixed(3)} kg`} icon={<Scale size={18}/>} color="bg-gradient-to-br from-red-500 to-rose-600" onClick={() => setSelectedMetric({title: 'Lịch sử hao hụt đơn hàng', type: 'loss'})} />
        <MetricCard title="Tồn kho hiện tại" value={`${stats.remainingWeight.toFixed(3)} kg`} icon={<Droplet size={18}/>} color="bg-gradient-to-br from-blue-500 to-indigo-600" />
        
        <MetricCard title="Tổng vốn đầu tư" value={`${stats.totalPurchaseMoney.toLocaleString()}đ`} icon={<DollarSign size={18}/>} color="bg-gradient-to-br from-gray-700 to-gray-800" />
        <MetricCard title="Thực thu" value={`${stats.totalRevenue.toLocaleString()}đ`} icon={<TrendingUp size={18}/>} color="bg-gradient-to-br from-fuchsia-500 to-purple-700" subText={`Chờ thu: ${stats.pendingRevenue.toLocaleString()}đ`} onClick={() => setSelectedMetric({title: 'Chi tiết doanh thu', type: 'revenue'})} />
        <MetricCard title="Quỹ Thuế (5%)" value={`-${stats.totalTax.toLocaleString()}đ`} icon={<Receipt size={18}/>} color="bg-gradient-to-br from-orange-400 to-orange-600" onClick={() => setSelectedMetric({title: 'Lịch sử nộp thuế', type: 'tax'})} />
        <MetricCard title="Phí vận chuyển" value={`-${stats.totalShip.toLocaleString()}đ`} icon={<Truck size={18}/>} color="bg-gradient-to-br from-violet-500 to-purple-600" onClick={() => setSelectedMetric({title: 'Lịch sử phí ship', type: 'ship'})} />
      </div>

      {/* LỢI NHUẬN RÒNG (FULL WIDTH) */}
      <div className="w-full">
         <MetricCard 
            title="LỢI NHUẬN RÒNG (TRONG TÚI)" 
            value={`+${stats.totalProfit.toLocaleString()}đ`} 
            icon={<Wallet size={24}/>} 
            color="bg-gradient-to-br from-emerald-500 to-green-700" 
            isMain 
            subText={`Lãi kẹt ngoài đường (Chưa giao/Nợ): +${stats.pendingProfit.toLocaleString()}đ`}
            onClick={() => setSelectedMetric({title: 'Báo cáo lãi ròng từng đơn', type: 'profit'})} 
         />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* BIỂU ĐỒ CỘT (BAR CHART) - RÕ RÀNG, CHUYÊN NGHIỆP */}
        <div className="bg-white p-5 md:p-8 rounded-[24px] border border-gray-100 shadow-sm min-h-[350px] flex flex-col">
          <div className="mb-6 flex items-center justify-between">
             <h3 className="text-base md:text-lg font-black text-gray-900 uppercase tracking-tight">Dòng tiền thực tế</h3>
             <span className="text-[9px] bg-blue-50 text-blue-600 px-2 py-1 rounded-md font-bold uppercase border border-blue-100">Biểu Đồ Cột</span>
          </div>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBarChart data={stats.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barGap={6}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} dy={10} />
                <YAxis tickFormatter={(v) => `${v / 1000000}Tr`} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} />
                
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }} 
                  contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold', fontSize: '11px' }} 
                  formatter={(value: any, name: any) => [`${Number(value).toLocaleString('vi-VN')}đ`, name === 'Doanh_thu' ? 'Thực Thu' : 'Lãi Bỏ Túi']} 
                />
                
                <Legend wrapperStyle={{paddingTop: '15px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase'}} />
                
                <Bar dataKey="Doanh_thu" name="Thực Thu" fill="#d946ef" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Loi_nhuan" name="Lãi Bỏ Túi" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </RechartsBarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* DANH SÁCH ĐƠN MỚI */}
        <div className="bg-white p-5 md:p-8 rounded-[24px] border border-gray-100 shadow-sm flex flex-col max-h-[450px]">
          <h3 className="text-base md:text-lg font-black text-gray-900 uppercase tracking-tight mb-5">Đơn mới nhất</h3>
          <div className="space-y-3 overflow-y-auto custom-scrollbar pr-2 flex-1">
            {data.orders.slice(0, 10).map((o) => (
              <div key={o.id} className="flex justify-between items-center p-4 bg-gray-50/50 hover:bg-blue-50/30 rounded-xl border border-gray-100 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="bg-white border border-gray-200 text-gray-600 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-[9px] shrink-0 shadow-sm">{formatDate(o.created_at)}</div>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 text-sm truncate">{o.customers?.name}</p>
                    <p className={`text-[9px] font-bold mt-0.5 uppercase flex items-center gap-1 ${o.status === 'Hoàn tất' ? 'text-emerald-600' : 'text-orange-500'}`}>
                      {o.weight} kg • {o.status === 'Hoàn tất' ? 'Đã thu tiền' : 'Đang chờ thu'}
                    </p>
                  </div>
                </div>
                <div className="text-right pl-2">
                   <p className="font-black text-blue-600 text-sm">{Number(o.revenue).toLocaleString()}đ</p>
                   <p className={`text-[9px] font-bold mt-0.5 ${o.status === 'Hoàn tất' ? 'text-emerald-600' : 'text-gray-400'}`}>
                     +{Number(o.profit).toLocaleString()}đ
                   </p>
                </div>
              </div>
            ))}
            {data.orders.length === 0 && <p className="text-center text-sm text-gray-400 py-10">Chưa có dữ liệu.</p>}
          </div>
        </div>
      </div>

      {/* POPUP LỊCH SỬ ĐỐI SOÁT */}
      {selectedMetric && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 md:p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[24px] p-6 md:p-8 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col relative shadow-2xl animate-in zoom-in-95">
            <button onClick={() => setSelectedMetric(null)} className="absolute top-5 right-5 p-1.5 bg-gray-100 rounded-full hover:bg-red-50 hover:text-red-500 transition-colors"><X size={20}/></button>
            <div className="mb-6 border-b border-gray-100 pb-4">
               <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-gray-900 flex items-center gap-2"><History className="text-blue-500" size={24} /> {selectedMetric.title}</h2>
            </div>
            <div className="overflow-x-auto overflow-y-auto pr-1 flex-1 custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead className="bg-gray-50 text-[9px] font-black uppercase text-gray-500">
                    <tr>
                      <th className="p-3 rounded-l-lg">{selectedMetric.type === 'batches' ? 'Mã Lô' : 'Khách hàng'}</th>
                      <th className="p-3">Trạng thái</th>
                      {selectedMetric.type === 'tax' && <th className="p-3 text-right text-orange-500">Thuế (5%)</th>}
                      {selectedMetric.type === 'ship' && <th className="p-3 text-right text-purple-600">Phí ship</th>}
                      {selectedMetric.type === 'loss' && <th className="p-3 text-right text-red-500">Hao hụt (kg)</th>}
                      {selectedMetric.type === 'profit' && <th className="p-3 text-right text-emerald-600">Lãi ròng</th>}
                      <th className="p-3 text-right">{selectedMetric.type === 'batches' ? 'Số kg nhập' : 'Số kg mua'}</th>
                      <th className="p-3 text-right rounded-r-lg">Doanh thu</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs md:text-sm font-semibold">
                    {selectedMetric.type === 'batches' ? data.batches.map(b => (
                      <tr key={b.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="p-3 text-blue-600 font-black">{b.batch_code}</td>
                        <td className="p-3"><span className="bg-gray-100 px-2 py-0.5 rounded text-[10px]">Kho</span></td>
                        <td className="p-3 text-right">{Number(b.total_weight).toFixed(3)}kg</td>
                        <td className="p-3 text-right font-black text-gray-800">{Number(b.total_weight * b.cost_per_kg).toLocaleString()}đ</td>
                      </tr>
                    )) : data.orders.map(o => (
                      <tr key={o.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="p-3 text-gray-900 truncate max-w-[120px]">{o.customers?.name}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${o.status === 'Hoàn tất' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-orange-50 text-orange-700 border border-orange-100'}`}>
                            {o.status}
                          </span>
                        </td>
                        {selectedMetric.type === 'tax' && <td className="p-3 text-right text-orange-600">-{Number(o.tax_amount).toLocaleString()}đ</td>}
                        {selectedMetric.type === 'ship' && <td className="p-3 text-right text-purple-600">-{Number(o.shipping_fee).toLocaleString()}đ</td>}
                        {selectedMetric.type === 'loss' && <td className="p-3 text-right text-red-600">{Number(o.weight_loss).toFixed(3)}kg</td>}
                        {selectedMetric.type === 'profit' && <td className="p-3 text-right text-emerald-600 font-black">+{Number(o.profit).toLocaleString()}đ</td>}
                        <td className="p-3 text-right">{Number(o.weight).toFixed(3)}kg</td>
                        <td className="p-3 text-right font-black text-blue-600">{Number(o.revenue).toLocaleString()}đ</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {((selectedMetric.type === 'batches' && data.batches.length === 0) || (selectedMetric.type !== 'batches' && data.orders.length === 0)) && (
                   <p className="text-center py-10 text-gray-400 text-xs font-medium">Chưa có dữ liệu đối soát.</p>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MetricCard({ title, value, icon, color, isMain, subText, onClick }: any) {
  return (
    <div onClick={onClick} className={`${color} ${isMain ? 'p-6 md:p-8' : 'p-4 md:p-5'} rounded-[20px] md:rounded-[24px] text-white shadow-md flex flex-col justify-between transition-all duration-300 ${onClick ? 'cursor-pointer hover:-translate-y-1 hover:shadow-xl' : ''}`}>
      <div className="flex justify-between items-start">
        <div className="bg-white/20 p-2 md:p-2.5 rounded-xl backdrop-blur-sm">{icon}</div>
        {onClick && <div className="text-[8px] md:text-[9px] font-bold uppercase bg-black/20 px-2 py-1 rounded-md hover:bg-black/40 transition-colors backdrop-blur-sm">Xem đối soát</div>}
      </div>
      <div className="mt-4 md:mt-5">
        <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest opacity-80 mb-1">{title}</p>
        <h2 className={`${isMain ? 'text-2xl md:text-4xl' : 'text-xl md:text-2xl'} font-black tracking-tight truncate`} title={value}>{value}</h2>
        
        {subText && (
          <div className="mt-3 pt-2 border-t border-white/20 flex items-center gap-1.5 text-[9px] md:text-xs font-medium opacity-90">
            <Clock size={12} className="animate-pulse" /> <span className="truncate">{subText}</span>
          </div>
        )}
      </div>
    </div>
  )
}
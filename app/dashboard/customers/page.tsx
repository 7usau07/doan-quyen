'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  User, Phone, Wallet, TrendingUp, Search, Crown, 
  AlertCircle, Trash2, UserX, DollarSign, Package, 
  History, X, MapPin 
} from 'lucide-react'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null)

  const VIP_THRESHOLD = 10000000; // Mốc 10 triệu là VIP

  const fetchCustomerData = async () => {
    const { data } = await supabase
      .from('customers')
      // Lấy thêm address và thông tin lô hàng từ bảng batches
      .select(`
        id, name, phone, address, note, customer_type, product_pref, 
        orders (
          id, created_at, revenue, profit, status, weight, moisture_level, weight_loss,
          batches(batch_code)
        )
      `)

    if (data) {
      const processed = data.map((c: any) => {
        const totalSpent = c.orders?.reduce((sum: number, o: any) => sum + Number(o.revenue || 0), 0) || 0
        const totalProfit = c.orders?.reduce((sum: number, o: any) => sum + Number(o.profit || 0), 0) || 0
        const totalWeight = c.orders?.reduce((sum: number, o: any) => sum + Number(o.weight || 0), 0) || 0
        const totalDebt = c.orders?.filter((o: any) => o.status === 'Đã giao - Còn nợ')
                                  .reduce((sum: number, o: any) => sum + Number(o.revenue || 0), 0) || 0
        
        const isVip = totalSpent >= VIP_THRESHOLD;
        const avgPrice = totalWeight > 0 ? (totalSpent / totalWeight) : 0;
        const sortedOrders = c.orders?.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) || [];

        return { ...c, totalSpent, totalProfit, totalWeight, totalDebt, orderCount: c.orders?.length || 0, isVip, avgPrice, orders: sortedOrders }
      })
      processed.sort((a, b) => b.totalSpent - a.totalSpent)
      setCustomers(processed)
    }
    setLoading(false)
  }

  useEffect(() => { fetchCustomerData() }, [])

  const deleteCustomer = async (id: string, orderCount: number) => {
    if (orderCount > 0) {
      alert("Lỗi: Khách này đang có đơn hàng! Phải xóa hết đơn của họ trước để bảo vệ sổ sách.");
      return;
    }
    if (confirm("Chắc chắn muốn xóa khách hàng này?")) {
      await supabase.from('customers').delete().eq('id', id);
      fetchCustomerData();
    }
  }

  const updateCustomerField = async (id: string, field: string, value: string) => {
    await supabase.from('customers').update({ [field]: value }).eq('id', id);
  }

  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone?.includes(searchTerm) || 
    c.address?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) return <div className="p-10 text-center font-black text-gray-400 animate-pulse uppercase tracking-widest">Đang tải sổ khách hàng YẾN SÀO ĐOÀN QUYÊN...</div>

  return (
    <div className="p-6 space-y-8 animate-in fade-in duration-500 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tighter uppercase">Sổ Khách Hàng</h1>
          <p className="text-gray-500 font-bold">Quản lý VIP, Lợi nhuận & Lịch sử mua</p>
        </div>
        
        <div className="relative w-full md:w-96 shadow-xl shadow-gray-200/50 rounded-3xl overflow-hidden border border-gray-100">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={22} />
          <input 
            type="text" 
            placeholder="Tìm tên, SĐT hoặc địa chỉ..." 
            className="w-full pl-14 pr-6 py-4 bg-white outline-none font-bold text-gray-800"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filtered.map((c) => {
          const isBadCustomer = c.note?.toLowerCase().includes('bom') || c.note?.toLowerCase().includes('xấu');

          return (
            <div key={c.id} className="relative bg-white p-6 rounded-[40px] border border-gray-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 group flex flex-col justify-between">
              
              <button onClick={() => deleteCustomer(c.id, c.orderCount)} className="absolute top-6 right-6 text-gray-200 hover:text-red-500 p-2 rounded-xl transition-colors z-10">
                <Trash2 size={20} />
              </button>

              <div>
                {c.isVip && (
                  <div className="inline-flex bg-yellow-400 text-yellow-900 px-4 py-1.5 rounded-full font-black text-[10px] uppercase items-center gap-1.5 mb-6 shadow-md shadow-yellow-100">
                    <Crown size={14} /> KHÁCH VIP
                  </div>
                )}

                <div className="flex items-center gap-4 mb-4">
                  <div className={`w-14 h-14 rounded-3xl flex items-center justify-center text-white shadow-lg shrink-0 ${isBadCustomer ? 'bg-red-600' : 'bg-gray-900'}`}>
                    {isBadCustomer ? <UserX size={24} /> : <User size={24} />}
                  </div>
                  <div className="space-y-1 pr-8 w-full">
                    <h3 className="text-xl font-black text-gray-900 truncate leading-none">{c.name}</h3>
                    
                    {/* Sửa SĐT */}
                    <div className="flex items-center gap-2 text-gray-400 font-bold mt-2">
                      <Phone size={14} className="shrink-0" />
                      <input 
                        type="text" 
                        defaultValue={c.phone || ''} 
                        onBlur={(e) => updateCustomerField(c.id, 'phone', e.target.value)}
                        className="bg-transparent outline-none hover:border-b border-gray-300 w-full text-sm focus:text-blue-600"
                        placeholder="Số điện thoại..."
                      />
                    </div>

                    {/* Sửa Địa chỉ */}
                    <div className="flex items-center gap-2 text-gray-400 font-bold mt-1">
                      <MapPin size={14} className="shrink-0" />
                      <input 
                        type="text" 
                        defaultValue={c.address || ''} 
                        onBlur={(e) => updateCustomerField(c.id, 'address', e.target.value)}
                        className="bg-transparent outline-none hover:border-b border-gray-300 w-full text-xs focus:text-blue-600 truncate"
                        placeholder="Địa chỉ giao hàng..."
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mb-4">
                  <select defaultValue={c.customer_type} onChange={(e) => updateCustomerField(c.id, 'customer_type', e.target.value)} className="bg-blue-50 text-blue-700 text-[10px] font-black uppercase px-3 py-2 rounded-xl outline-none border border-blue-100 flex-1">
                    <option value="Khách lẻ">Khách Lẻ</option>
                    <option value="Khách sỉ">Khách Sỉ</option>
                    <option value="Cộng tác viên">Cộng tác viên</option>
                  </select>
                  <select defaultValue={c.product_pref} onChange={(e) => updateCustomerField(c.id, 'product_pref', e.target.value)} className="bg-purple-50 text-purple-700 text-[10px] font-black uppercase px-3 py-2 rounded-xl outline-none border border-purple-100 flex-1">
                    <option value="Chưa rõ">Thích loại nào?</option>
                    <option value="Hàng tinh chế đẹp">Hàng Đẹp</option>
                    <option value="Hàng xô / Rút lông">Hàng Xô</option>
                    <option value="Hàng vụn / Gãy">Hàng Vụn</option>
                  </select>
                </div>

                <div className={`mb-4 p-3 rounded-2xl border flex items-center gap-3 ${isBadCustomer ? 'bg-red-50 border-red-200' : 'bg-gray-50'}`}>
                  <AlertCircle size={18} className={isBadCustomer ? 'text-red-500' : 'text-gray-400'} />
                  <input type="text" placeholder="Ghi chú phốt..." defaultValue={c.note || ''} onBlur={(e) => updateCustomerField(c.id, 'note', e.target.value)} className={`flex-1 bg-transparent text-sm font-bold outline-none ${isBadCustomer ? 'text-red-700' : 'text-gray-600'}`} />
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-blue-50/50 p-3 rounded-2xl border border-blue-50">
                    <p className="text-[10px] font-black text-blue-400 uppercase">Đã chi tiêu</p>
                    <p className="text-base font-black text-blue-700">{c.totalSpent.toLocaleString()}đ</p>
                  </div>
                  <div className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-50">
                    <p className="text-[10px] font-black text-emerald-500 uppercase">Lợi nhuận</p>
                    <p className="text-base font-black text-emerald-600">+{c.totalProfit.toLocaleString()}đ</p>
                  </div>
                </div>
              </div>

              <button onClick={() => setSelectedCustomer(c)} className="w-full bg-black text-white py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2">
                <History size={16} /> Xem lịch sử ({c.orderCount} đơn)
              </button>
            </div>
          )
        })}
      </div>

      {/* MODAL LỊCH SỬ CHI TIẾT */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-[40px] p-8 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col relative animate-in zoom-in-95">
            
            <button onClick={() => setSelectedCustomer(null)} className="absolute top-6 right-6 bg-gray-100 p-2 rounded-full"><X size={24} /></button>

            <div className="mb-6">
              <h2 className="text-3xl font-black text-gray-900 uppercase">Chi tiết khách: {selectedCustomer.name}</h2>
              {selectedCustomer.address && <p className="text-xs font-bold text-gray-400 mt-2 flex items-center gap-1"><MapPin size={12}/> {selectedCustomer.address}</p>}
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6 bg-gray-50 p-4 rounded-3xl border">
               <div><p className="text-[10px] font-black text-gray-400 uppercase">Tổng mua</p><p className="text-lg font-black">{selectedCustomer.totalWeight.toFixed(2)} kg</p></div>
               <div><p className="text-[10px] font-black text-gray-400 uppercase">Giá mua TB / 1kg</p><p className="text-lg font-black text-green-600">{selectedCustomer.avgPrice.toLocaleString()}đ</p></div>
               <div><p className="text-[10px] font-black text-gray-400 uppercase">Phân loại</p><p className="text-lg font-black text-purple-600">{selectedCustomer.customer_type}</p></div>
            </div>

            <div className="overflow-y-auto space-y-3 pr-2">
              {selectedCustomer.orders?.map((order: any) => (
                <div key={order.id} className="bg-white border p-5 rounded-3xl flex justify-between items-center hover:border-blue-300 transition-colors shadow-sm">
                  <div className="flex gap-4 items-center">
                    <div className="bg-blue-50 text-blue-700 px-3 py-2 rounded-xl text-xs font-black">{new Date(order.created_at).toLocaleDateString('vi-VN')}</div>
                    <div>
                      <p className="font-black text-gray-900">{order.weight} kg {order.batches?.batch_code && <span className="ml-2 bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-[10px] uppercase">Lô: {order.batches.batch_code}</span>}</p>
                      <p className={`text-[10px] font-bold ${order.status === 'Đã giao - Còn nợ' ? 'text-red-500' : 'text-gray-400'}`}>Ẩm: {order.moisture_level}% | Hao: {order.weight_loss}kg</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-lg text-green-600">{Number(order.revenue).toLocaleString()}đ</p>
                    <p className="text-[10px] font-bold text-gray-400">Lời: +{Number(order.profit).toLocaleString()}đ</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
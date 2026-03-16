'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  User, Phone, Wallet, TrendingUp, Search, Crown, 
  AlertCircle, Trash2, UserX, DollarSign, Package, 
  History, X, MapPin, MessageCircle
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

        return { 
          ...c, 
          totalSpent: Math.round(totalSpent), 
          totalProfit: Math.round(totalProfit), 
          totalWeight, 
          totalDebt: Math.round(totalDebt), 
          orderCount: c.orders?.length || 0, 
          isVip, 
          avgPrice: Math.round(avgPrice), 
          orders: sortedOrders 
        }
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

  if (loading) return <div className="p-10 text-center font-medium text-gray-400 animate-pulse uppercase tracking-widest text-sm">Đang tải sổ khách hàng YẾN SÀO ĐOÀN QUYÊN...</div>

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-500 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-4xl font-black text-gray-900 tracking-tighter uppercase">Sổ Khách Hàng</h1>
          <p className="text-gray-500 font-medium text-xs md:text-sm mt-1">Quản lý VIP, Lợi nhuận & Lịch sử mua</p>
        </div>
        
        <div className="relative w-full md:w-96 shadow-sm rounded-2xl overflow-hidden border border-gray-200">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Tìm tên, SĐT hoặc địa chỉ..." 
            className="w-full pl-12 pr-4 py-3 bg-white outline-none font-medium text-gray-800 text-sm md:text-base"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((c) => {
          const isBadCustomer = c.note?.toLowerCase().includes('bom') || c.note?.toLowerCase().includes('xấu');
          const isProfitable = c.totalProfit >= 0;

          return (
            <div key={c.id} className={`relative bg-white p-5 md:p-6 rounded-[24px] border ${isBadCustomer ? 'border-red-200' : 'border-gray-200'} shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between`}>
              
              <button onClick={() => deleteCustomer(c.id, c.orderCount)} className="absolute top-5 right-5 text-gray-300 hover:text-red-500 p-1.5 rounded-lg transition-colors z-10" title="Xóa khách hàng">
                <Trash2 size={16} />
              </button>

              <div>
                <div className="flex justify-between items-center mb-5">
                   {c.isVip ? (
                     <div className="inline-flex bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full font-bold text-[10px] uppercase items-center gap-1 border border-yellow-200 shadow-sm">
                       <Crown size={12} /> KHÁCH VIP
                     </div>
                   ) : <div className="h-6"></div>}
                   
                   {c.phone && (
                     <a 
                       href={`https://zalo.me/${c.phone.replace(/\s/g, '')}`} 
                       target="_blank" 
                       rel="noreferrer"
                       className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 font-bold bg-blue-50 px-2 py-1 rounded-md border border-blue-100 transition-colors"
                     >
                       <MessageCircle size={12} /> Nhắn Zalo
                     </a>
                   )}
                </div>

                <div className="flex items-start gap-4 mb-4">
                  <div className={`w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm ${isBadCustomer ? 'bg-red-500' : 'bg-gray-800'}`}>
                    {isBadCustomer ? <UserX size={20} /> : <User size={20} />}
                  </div>
                  <div className="space-y-1.5 pr-6 w-full">
                    <h3 className="text-lg md:text-xl font-bold text-gray-900 truncate leading-none">{c.name}</h3>
                    
                    <div className="flex items-center gap-1.5 text-gray-500 font-medium">
                      <Phone size={12} className="shrink-0" />
                      <input 
                        type="text" 
                        defaultValue={c.phone || ''} 
                        onBlur={(e) => updateCustomerField(c.id, 'phone', e.target.value)}
                        className="bg-transparent outline-none hover:border-b border-gray-300 w-full text-xs focus:text-blue-600 transition-colors"
                        placeholder="Số điện thoại..."
                      />
                    </div>

                    <div className="flex items-center gap-1.5 text-gray-500 font-medium">
                      <MapPin size={12} className="shrink-0" />
                      <input 
                        type="text" 
                        defaultValue={c.address || ''} 
                        onBlur={(e) => updateCustomerField(c.id, 'address', e.target.value)}
                        className="bg-transparent outline-none hover:border-b border-gray-300 w-full text-xs focus:text-blue-600 truncate transition-colors"
                        placeholder="Địa chỉ giao hàng..."
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mb-4">
                  <select defaultValue={c.customer_type} onChange={(e) => updateCustomerField(c.id, 'customer_type', e.target.value)} className="bg-blue-50/50 text-blue-700 text-[10px] font-bold uppercase px-2 py-2 rounded-lg outline-none border border-blue-100 flex-1 cursor-pointer">
                    <option value="Khách lẻ">Khách Lẻ</option>
                    <option value="Khách sỉ">Khách Sỉ</option>
                    <option value="Cộng tác viên">Cộng tác viên</option>
                  </select>
                  <select defaultValue={c.product_pref} onChange={(e) => updateCustomerField(c.id, 'product_pref', e.target.value)} className="bg-purple-50/50 text-purple-700 text-[10px] font-bold uppercase px-2 py-2 rounded-lg outline-none border border-purple-100 flex-1 cursor-pointer">
                    <option value="Chưa rõ">Thích loại nào?</option>
                    <option value="Hàng tinh chế đẹp">Hàng Đẹp</option>
                    <option value="Hàng xô / Rút lông">Hàng Xô</option>
                    <option value="Hàng vụn / Gãy">Hàng Vụn</option>
                  </select>
                </div>

                <div className={`mb-4 p-2 rounded-lg border flex items-center gap-2 ${isBadCustomer ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                  <AlertCircle size={14} className={isBadCustomer ? 'text-red-500' : 'text-gray-400'} />
                  <input type="text" placeholder="Ghi chú (bấm để lưu)..." defaultValue={c.note || ''} onBlur={(e) => updateCustomerField(c.id, 'note', e.target.value)} className={`flex-1 bg-transparent text-xs font-medium outline-none ${isBadCustomer ? 'text-red-700' : 'text-gray-600'}`} />
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 flex flex-col justify-center items-center">
                    <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5">Đã chi tiêu</p>
                    <p className="text-sm font-black text-blue-700 truncate w-full text-center" title={`${c.totalSpent.toLocaleString()}đ`}>{c.totalSpent.toLocaleString()}đ</p>
                  </div>
                  {/* BỘ LỌC LÃI/LỖ ĐÃ SỬA LỖI +- */}
                  <div className={`p-2.5 rounded-xl border flex flex-col justify-center items-center ${isProfitable ? 'bg-emerald-50/50 border-emerald-100' : 'bg-red-50/50 border-red-100'}`}>
                    <p className={`text-[9px] font-bold uppercase mb-0.5 ${isProfitable ? 'text-emerald-600' : 'text-red-600'}`}>Lợi nhuận</p>
                    <p className={`text-sm font-black truncate w-full text-center ${isProfitable ? 'text-emerald-700' : 'text-red-700'}`} title={`${isProfitable ? '+' : '-'}${Math.abs(c.totalProfit).toLocaleString()}đ`}>
                      {isProfitable ? '+' : '-'}{Math.abs(c.totalProfit).toLocaleString()}đ
                    </p>
                  </div>
                </div>
              </div>

              <button onClick={() => setSelectedCustomer(c)} className="w-full bg-gray-900 hover:bg-black text-white py-3 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-colors">
                <History size={14} /> Lịch sử mua ({c.orderCount})
              </button>
            </div>
          )
        })}
      </div>

      {/* MODAL LỊCH SỬ CHI TIẾT */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 md:p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-[24px] p-6 md:p-8 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col relative shadow-2xl">
            
            <button onClick={() => setSelectedCustomer(null)} className="absolute top-4 right-4 bg-gray-100 hover:bg-gray-200 text-gray-600 p-1.5 rounded-full transition-colors"><X size={20} /></button>

            <div className="mb-5 pr-8">
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 uppercase truncate">Chi tiết: {selectedCustomer.name}</h2>
              {selectedCustomer.address && <p className="text-xs font-medium text-gray-500 mt-1 flex items-center gap-1 truncate"><MapPin size={12}/> {selectedCustomer.address}</p>}
            </div>

            <div className="grid grid-cols-3 gap-2 mb-5 bg-gray-50 p-3 rounded-xl border border-gray-200">
               <div className="text-center border-r border-gray-200"><p className="text-[8px] md:text-[9px] font-bold text-gray-500 uppercase">Tổng mua</p><p className="text-sm md:text-base font-black text-gray-900">{selectedCustomer.totalWeight.toFixed(2)} kg</p></div>
               <div className="text-center border-r border-gray-200"><p className="text-[8px] md:text-[9px] font-bold text-gray-500 uppercase">Giá TB/1kg</p><p className="text-sm md:text-base font-black text-green-600">{selectedCustomer.avgPrice.toLocaleString()}đ</p></div>
               <div className="text-center"><p className="text-[8px] md:text-[9px] font-bold text-gray-500 uppercase">Phân loại</p><p className="text-[10px] md:text-xs mt-1 font-bold text-purple-600 uppercase bg-purple-50 px-1 py-0.5 rounded inline-block">{selectedCustomer.customer_type}</p></div>
            </div>

            <div className="overflow-y-auto space-y-2 pr-1 custom-scrollbar flex-1">
              {selectedCustomer.orders?.length === 0 ? (
                 <p className="text-center text-gray-400 text-xs py-10 font-medium">Khách hàng chưa có lịch sử mua sắm.</p>
              ) : (
                 selectedCustomer.orders?.map((order: any) => {
                   const roundedRev = Math.round(Number(order.revenue || 0));
                   const roundedProf = Math.round(Number(order.profit || 0));
                   const isOrderProfit = roundedProf >= 0;

                   return (
                     <div key={order.id} className="bg-white border border-gray-200 p-3 md:p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center hover:border-blue-300 transition-colors shadow-sm gap-3">
                       <div className="flex gap-3 items-center w-full sm:w-auto">
                         <div className="bg-gray-50 text-gray-600 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border border-gray-200 shrink-0">{new Date(order.created_at).toLocaleDateString('vi-VN')}</div>
                         <div className="flex-1">
                           <p className="font-bold text-gray-900 text-sm">{Number(order.weight).toFixed(3)} kg {order.batches?.batch_code && <span className="ml-1 bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded text-[9px] uppercase border border-blue-100">Lô: {order.batches.batch_code}</span>}</p>
                           <p className={`text-[9px] font-medium mt-0.5 ${order.status === 'Đã giao - Còn nợ' ? 'text-red-500 font-bold' : 'text-gray-500'}`}>Ẩm: {order.moisture_level || 0}% | Hao: {order.weight_loss || 0}kg</p>
                         </div>
                       </div>
                       <div className="text-left sm:text-right w-full sm:w-auto border-t sm:border-t-0 border-dashed border-gray-200 pt-2 sm:pt-0 flex sm:flex-col justify-between items-center sm:items-end">
                         <p className="font-black text-sm md:text-base text-blue-600">{roundedRev.toLocaleString()}đ</p>
                         {/* FIX LỖI +- TRONG TỪNG ĐƠN HÀNG */}
                         <p className={`text-[9px] font-bold px-1.5 py-0.5 rounded border mt-1 ${isOrderProfit ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-red-600 bg-red-50 border-red-100'}`}>
                           {isOrderProfit ? 'Lời: +' : 'Lỗ: -'}{Math.abs(roundedProf).toLocaleString()}đ
                         </p>
                       </div>
                     </div>
                   );
                 })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
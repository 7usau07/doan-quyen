'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { 
  Trash2, PlusCircle, Scale, Package, FileSpreadsheet, 
  Printer, X, Search, Save, Pencil, ListFilter, CheckCircle2,
  UserCircle2, Droplet, Calendar, MessageCircle
} from 'lucide-react'

// Hàm đọc số thành chữ chuẩn Kế toán VN
const readNumberToText = (number: number) => {
  if (number === 0) return 'Không đồng'
  const units = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ']
  const readGroup = (num: number, isFull: boolean) => {
      const digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']
      let result = ''
      const hundred = Math.floor(num / 100)
      const ten = Math.floor((num % 100) / 10)
      const unit = num % 10
      if (hundred > 0 || isFull) result += digits[hundred] + ' trăm '
      if (ten === 0 && hundred > 0 && unit > 0) result += 'lẻ '
      else if (ten === 1) result += 'mười '
      else if (ten > 1) result += digits[ten] + ' mươi '
      if (unit === 1 && ten > 1) result += 'mốt '
      else if (unit === 5 && ten > 0) result += 'lăm '
      else if (unit > 0 || (unit === 0 && ten === 0 && hundred === 0)) result += digits[unit] + ' '
      return result.trim()
  }
  let str = ''
  let groupIndex = 0
  let tempNumber = number
  while (tempNumber > 0) {
      const group = tempNumber % 1000
      tempNumber = Math.floor(tempNumber / 1000)
      if (group > 0) {
          const groupText = readGroup(group, tempNumber > 0)
          str = groupText + ' ' + units[groupIndex] + ' ' + str
      }
      groupIndex++
  }
  str = str.replace(/\s+/g, ' ').trim()
  return str.charAt(0).toUpperCase() + str.slice(1) + ' đồng'
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [batches, setBatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)

  const [editingOrder, setEditingOrder] = useState<any>(null)
  const [editForm, setEditForm] = useState({
    id: '', created_at: '', batch_id: '', grade_type: '',
    weight: '', unitPrice: '', weight_loss: '', tax_amount: '', shipping_fee: '', status: '', note: '',
    seller: '' 
  })

  const fetchOrders = async () => {
    setLoading(true)
    const { data: ordersData } = await supabase
      .from('orders')
      .select('*, customers(id, name, phone, address), batches(batch_code, cost_per_kg)')
      .order('created_at', { ascending: false });
    
    if (ordersData) setOrders(ordersData);

    const { data: batchesData } = await supabase.from('batches').select('id, batch_code, cost_per_kg');
    if (batchesData) setBatches(batchesData);

    setLoading(false)
  }

  useEffect(() => { fetchOrders() }, [])

  const groupedOrders = useMemo(() => {
    const groups: Record<string, any> = {};

    orders.forEach(order => {
      const dateStr = new Date(order.created_at).toLocaleDateString('vi-VN');
      const customerId = order.customers?.id || 'unknown';
      const groupKey = `${customerId}_${dateStr}`;

      if (!groups[groupKey]) {
        groups[groupKey] = {
          groupKey: groupKey,
          customer: order.customers,
          dateValue: dateStr,
          rawDate: order.created_at,
          status: order.status,
          note: order.note,
          seller: order.seller || 'Quyên', 
          items: [],
          totalRevenue: 0,
          totalTax: 0,
          totalShip: 0,
          totalProfit: 0,
          totalLossMoney: 0
        };
      }

      groups[groupKey].items.push(order);
      groups[groupKey].totalRevenue += Number(order.revenue || 0);
      groups[groupKey].totalTax += Number(order.tax_amount || 0);
      groups[groupKey].totalShip += Number(order.shipping_fee || 0);
      groups[groupKey].totalProfit += Number(order.profit || 0);
      
      const costPerKg = Number(order.weight) > 0 ? (Number(order.cost) / Number(order.weight)) : 0;
      groups[groupKey].totalLossMoney += Number(order.weight_loss || 0) * costPerKg;
      
      if (order.seller === 'Duy') {
          groups[groupKey].seller = 'Duy';
      }
    });

    return Object.values(groups).filter(g => 
      g.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      g.customer?.phone?.includes(searchTerm) ||
      g.items.some((i: any) => i.batches?.batch_code?.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [orders, searchTerm]);

  const deleteGroupOrder = async (group: any) => { 
    if (confirm(`Duy chắc chắn muốn xóa TOÀN BỘ đơn hàng này của khách ${group.customer?.name} không? (Sẽ hoàn lại kho tất cả các Lô trong đơn)`)) { 
      setLoading(true);
      const idsToDelete = group.items.map((i: any) => i.id);
      await supabase.from('orders').delete().in('id', idsToDelete); 
      fetchOrders(); 
    } 
  }

  const updateGroupStatus = async (group: any, newStatus: string) => { 
    setLoading(true);
    const idsToUpdate = group.items.map((i: any) => i.id);
    await supabase.from('orders').update({ status: newStatus }).in('id', idsToUpdate); 
    fetchOrders(); 
  }

  const updateFinancials = async (order: any, field: string, value: string) => {
    const valNum = Number(value) || 0;
    const currentWeightLoss = field === 'weight_loss' ? valNum : Number(order.weight_loss);
    
    const dataToUpdate: any = { [field]: valNum };

    if (field === 'weight_loss') {
        const costPerKg = Number(order.weight) > 0 ? (Number(order.cost) / Number(order.weight)) : 0;
        const moneyLostToShrinkage = currentWeightLoss * costPerKg;
        const newProfit = Number(order.revenue) - Number(order.cost) - Number(order.tax_amount || 0) - Number(order.shipping_fee || 0) - moneyLostToShrinkage;
        dataToUpdate.profit = newProfit;
    }

    await supabase.from('orders').update(dataToUpdate).eq('id', order.id);
    fetchOrders(); 
  }

  const openEditModal = (order: any) => {
    const unitPrice = order.weight > 0 ? (order.revenue / order.weight) : 0;
    setEditForm({
      id: order.id, 
      created_at: new Date(order.created_at).toISOString().split('T')[0], 
      batch_id: order.batch_id, grade_type: order.grade_type || 'Xô',
      weight: order.weight.toString(), unitPrice: Math.round(unitPrice).toString(),
      weight_loss: (order.weight_loss || 0).toString(), tax_amount: (order.tax_amount || 0).toString(),
      shipping_fee: (order.shipping_fee || 0).toString(), status: order.status || 'Hoàn tất', 
      note: order.note || '', seller: order.seller || 'Quyên'
    });
    setEditingOrder(order);
  }

  const handleUpdateOrderItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const weightNum = Number(editForm.weight) || 0;
    const priceNum = Number(editForm.unitPrice) || 0;
    const lossNum = Number(editForm.weight_loss) || 0;
    const taxNum = Number(editForm.tax_amount) || 0;
    const shipNum = Number(editForm.shipping_fee) || 0;

    const selectedBatch = batches.find(b => b.id === editForm.batch_id);
    const costPerKg = selectedBatch ? Number(selectedBatch.cost_per_kg) : 0;

    const newCost = weightNum * costPerKg;
    const newRevenue = weightNum * priceNum;
    const lossCost = lossNum * costPerKg; 
    const newProfit = newRevenue - newCost - taxNum - shipNum - lossCost;

    const newDate = new Date(editForm.created_at);
    newDate.setHours(new Date().getHours());
    newDate.setMinutes(new Date().getMinutes());

    await supabase.from('orders').update({
      created_at: newDate.toISOString(), 
      batch_id: editForm.batch_id, 
      grade_type: editForm.grade_type,
      weight: weightNum, 
      revenue: newRevenue, 
      cost: newCost, 
      weight_loss: lossNum, 
      tax_amount: taxNum, 
      shipping_fee: shipNum, 
      profit: newProfit, 
      status: editForm.status, 
      note: editForm.note, 
      seller: editForm.seller 
    }).eq('id', editForm.id);

    setEditingOrder(null);
    fetchOrders();
  }

  const handleSaveCustomerInfo = async () => {
    if (!selectedInvoice || !selectedInvoice.customer?.id) return;
    try {
      await supabase.from('customers').update({
        name: selectedInvoice.customer.name, phone: selectedInvoice.customer.phone, address: selectedInvoice.customer.address
      }).eq('id', selectedInvoice.customer.id);
      alert("Đã cập nhật thông tin khách hàng vào hệ thống thành công!");
      fetchOrders(); 
    } catch (error) { alert("Lỗi khi lưu thông tin!"); }
  }

  const getStatusColor = (status: string) => {
    if (status === 'Hoàn tất') return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    if (status === 'Đang giao') return 'bg-blue-100 text-blue-700 border-blue-200'
    if (status === 'Đã giao - Còn nợ') return 'bg-amber-100 text-amber-700 border-amber-200'
    return 'bg-gray-100 text-gray-700 border-gray-200'
  }

  const handleExportExcel = () => {
    const exportData = orders.map((o, index) => ({
      "STT": index + 1, "Mã Đơn Lẻ": `DD-${o.id.slice(0, 6).toUpperCase()}`, "Ngày chốt": new Date(o.created_at).toLocaleDateString('vi-VN'),
      "Khách hàng": o.customers?.name, "Điện thoại": o.customers?.phone, "Địa chỉ giao": o.customers?.address || '',
      "Mã Lô Xuất": o.batches?.batch_code || '', "Phân loại hàng": o.grade_type || 'Xô',
      "Độ ẩm (%)": o.moisture_level || 0,
      "Số Kg Yến": Number(o.weight).toFixed(3), "Hao hụt (Kg)": Number(o.weight_loss || 0).toFixed(3),
      "Doanh thu món": Number(o.revenue).toLocaleString('vi-VN'), "Thuế 5%": Number(o.tax_amount || 0).toLocaleString('vi-VN'),
      "Phí Ship": Number(o.shipping_fee || 0).toLocaleString('vi-VN'), "Lợi Nhuận Ròng": Number(o.profit).toLocaleString('vi-VN'),
      "Người bán": o.seller || 'Quyên', "Trạng thái": o.status, "Ghi chú": o.note || ''
    }))
    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Danh_Sach_Don_Hang")
    XLSX.writeFile(workbook, `Bao_Cao_Doanh_Thu_DDPRIME_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.xlsx`)
  }

  if (loading) return <div className="p-10 font-medium text-gray-400 animate-pulse text-center uppercase tracking-widest">ĐANG TẢI ĐƠN HÀNG...</div>

  return (
    <div className="p-3 md:p-8 space-y-6 md:space-y-8 bg-gray-50 min-h-screen animate-in fade-in max-w-6xl mx-auto pb-24">
      
      {/* CSS DÀNH CHO IN ẤN TỐI ƯU CỠ GIẤY A4 / A5 */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: A5; margin: 10mm; }
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body * { visibility: hidden; }
          #invoice-print-area, #invoice-print-area * { visibility: visible; }
          #invoice-print-area { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none; margin: 0; padding: 0; }
          .no-print { display: none !important; }
          input { border: none !important; background: transparent !important; padding: 0 !important; color: inherit !important; }
        }
      `}} />

      {/* HEADER TỐI GIẢN */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-5 md:p-8 rounded-[24px] md:rounded-[30px] shadow-sm border border-gray-200 gap-4 no-print">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-gray-900 flex items-center gap-2 md:gap-3">
             <Package size={24} className="text-blue-500"/> Quản lý Đơn hàng
          </h1>
          <p className="text-gray-500 text-[11px] md:text-sm mt-1">Theo dõi giao dịch, xuất hóa đơn và đối soát lợi nhuận.</p>
        </div>
        <div className="flex flex-row items-center gap-2 w-full md:w-auto">
          <button onClick={handleExportExcel} className="flex-1 md:flex-none bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 text-xs md:text-sm shadow-sm">
            <FileSpreadsheet size={16}/> Xuất Excel
          </button>
          <Link href="/dashboard/orders/new" className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-semibold shadow-md transition-all flex items-center justify-center gap-2 text-xs md:text-sm">
            <PlusCircle size={16}/> Lên đơn mới
          </Link>
        </div>
      </div>

      {/* TÌM KIẾM */}
      <div className="bg-white px-4 md:px-5 py-3 md:py-4 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3 no-print">
        <Search className="text-gray-400" size={18} />
        <input 
           placeholder="Tìm khách hàng, SĐT hoặc mã lô..." 
           className="w-full bg-transparent outline-none font-medium text-gray-700 text-sm md:text-base placeholder:text-gray-400" 
           value={searchTerm} 
           onChange={(e) => setSearchTerm(e.target.value)} 
        />
      </div>

      {/* DANH SÁCH GOM NHÓM (GROUPED ORDERS) */}
      <div className="grid gap-5 md:gap-6 no-print">
        {groupedOrders.map((group: any) => (
          <div key={group.groupKey} className="bg-white rounded-[20px] md:rounded-[24px] border border-gray-200 shadow-sm overflow-hidden relative">
            
            {/* NHÃN NGƯỜI BÁN */}
            <div className={`absolute top-0 right-0 px-3 py-1 md:px-4 md:py-1.5 rounded-bl-xl font-bold text-[9px] md:text-[11px] flex items-center gap-1 ${group.seller === 'Duy' ? 'bg-orange-50 text-orange-600 border-b border-l border-orange-100' : 'bg-pink-50 text-pink-600 border-b border-l border-pink-100'}`}>
              <UserCircle2 size={12}/> {group.seller === 'Duy' ? 'Sếp Duy chốt' : 'Quyên chốt'}
            </div>

            {/* HEADER ĐƠN GỘP */}
            <div className="p-4 md:p-6 pb-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mt-4 md:mt-0">
               <div className="flex gap-3 items-center w-full">
                  <div className="bg-blue-50 text-blue-700 p-2 md:p-3 rounded-lg flex flex-col items-center justify-center min-w-[60px] border border-blue-100 shrink-0">
                    <span className="text-[8px] font-semibold uppercase text-blue-500">Ngày chốt</span>
                    <span className="font-bold text-xs md:text-sm">{group.dateValue}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-lg md:text-xl text-gray-900 leading-tight truncate">{group.customer?.name}</h3>
                      {group.customer?.phone && (
                        <a 
                          href={`https://zalo.me/${group.customer.phone.replace(/\s/g, '')}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[9px] md:text-[10px] text-blue-600 hover:text-blue-800 font-bold bg-blue-50/80 px-2 py-0.5 rounded-md border border-blue-100 transition-colors"
                        >
                          <MessageCircle size={12} /> Nhắn Zalo
                        </a>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                       <select value={group.status} onChange={(e) => updateGroupStatus(group, e.target.value)} className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold outline-none cursor-pointer border ${getStatusColor(group.status)}`}>
                         <option>Chưa giao</option><option>Đang giao</option><option>Đã giao - Còn nợ</option><option>Hoàn tất</option>
                       </select>
                       <span className="text-[10px] font-medium text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full">{group.items.length} kiện hàng</span>
                    </div>
                  </div>
               </div>

               {/* NÚT THAO TÁC CHUNG */}
               <div className="flex items-center gap-2 w-full md:w-auto mt-2 md:mt-0">
                  <button onClick={() => setSelectedInvoice(group)} className="flex-1 md:flex-none bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-700 px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors text-xs font-semibold">
                     <Printer size={14} /> In Hóa Đơn
                  </button>
                  <button onClick={() => deleteGroupOrder(group)} className="p-2 bg-white border border-gray-200 text-gray-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 rounded-lg transition-colors shrink-0" title="Xóa đơn hàng này">
                     <Trash2 size={16} />
                  </button>
               </div>
            </div>

            {/* DANH SÁCH MÓN HÀNG */}
            <div className="px-3 md:px-6 py-2">
               <div className="space-y-3">
                  {group.items.map((item: any) => (
                     <div key={item.id} className="bg-gray-50/70 border border-gray-200 p-3 rounded-xl hover:bg-blue-50/30 transition-colors group/item">
                        
                        <div className="flex justify-between items-center mb-2">
                           <div className="flex items-center gap-1.5">
                              <span className="text-gray-800 font-semibold text-xs flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-gray-200 shadow-sm"><Package size={12} className="text-blue-500"/> <span className="uppercase">{item.batches?.batch_code || 'N/A'}</span></span>
                              <span className="text-orange-600 font-bold text-[9px] uppercase bg-orange-100 px-1.5 py-0.5 rounded">{item.grade_type || 'Xô'}</span>
                           </div>
                           <button onClick={() => openEditModal(item)} className="text-gray-400 hover:text-blue-600 bg-white border border-gray-200 p-1.5 rounded-md transition-all shadow-sm" title="Sửa nâng cao">
                              <Pencil size={12}/>
                           </button>
                        </div>

                        <div className="flex justify-between items-end mb-3 px-1">
                           <div className="text-xs text-gray-600 font-medium">Bán: <b className="text-gray-900">{Number(item.weight).toFixed(3)} kg</b></div>
                           <div className="text-right">
                              <p className="font-black text-blue-600 text-sm md:text-base leading-none">{Number(item.revenue).toLocaleString('vi-VN')}đ</p>
                           </div>
                        </div>

                        <div className="flex flex-row items-center gap-2 border-t border-gray-200/60 pt-2.5">
                           <div className="flex items-center justify-between gap-1 text-[10px] font-semibold text-blue-700 bg-blue-100/50 px-2 py-1.5 rounded-lg border border-blue-100 w-1/2">
                               <span className="flex items-center gap-1"><Droplet size={12}/> Độ ẩm:</span>
                               <div className="flex items-center">
                                 <input type="number" defaultValue={item.moisture_level || ''} onBlur={(e) => updateFinancials(item, 'moisture_level', e.target.value)} className="w-8 bg-white border border-blue-200 rounded px-1 outline-none text-center font-bold" placeholder="0"/> <span className="ml-0.5">%</span>
                               </div>
                           </div>
                           <div className="flex items-center justify-between gap-1 text-[10px] font-semibold text-red-700 bg-red-50/50 px-2 py-1.5 rounded-lg border border-red-100 w-1/2">
                               <span className="flex items-center gap-1"><Scale size={12}/> Hụt:</span>
                               <div className="flex items-center">
                                 <input type="number" step="0.001" defaultValue={item.weight_loss || ''} onBlur={(e) => updateFinancials(item, 'weight_loss', e.target.value)} className="w-10 bg-white border border-red-200 rounded px-1 outline-none text-center font-bold text-red-600" placeholder="0"/> <span className="ml-0.5 text-[8px]">kg</span>
                               </div>
                           </div>
                        </div>

                     </div>
                  ))}
               </div>
            </div>

            {/* TỔNG KẾT TÀI CHÍNH */}
            <div className="bg-white p-4 md:p-6 border-t border-gray-100 flex flex-col gap-2 mt-1">
               <div className="flex flex-wrap justify-between gap-2 border-b border-dashed border-gray-100 pb-2">
                  <div className="text-[10px] md:text-[11px] text-gray-500 font-medium">Thuế: <b className="text-gray-700">-{group.totalTax.toLocaleString('vi-VN')}đ</b></div>
                  <div className="text-[10px] md:text-[11px] text-gray-500 font-medium">Ship: <b className="text-gray-700">-{group.totalShip.toLocaleString('vi-VN')}đ</b></div>
                  {group.totalLossMoney > 0 && <div className="text-[10px] md:text-[11px] text-red-500 font-medium">Lỗ hụt: <b className="text-red-600">-{group.totalLossMoney.toLocaleString('vi-VN')}đ</b></div>}
               </div>
               <div className="flex justify-between items-end pt-1">
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Khách trả</p>
                  <div className="text-right">
                     <p className="text-xl md:text-2xl font-black text-gray-900 leading-none mb-1.5">{group.totalRevenue.toLocaleString('vi-VN')}đ</p>
                     <p className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 inline-block">Lãi: +{group.totalProfit.toLocaleString('vi-VN')}đ</p>
                  </div>
               </div>
            </div>

          </div>
        ))}

        {groupedOrders.length === 0 && orders.length > 0 && (
          <div className="text-center py-20 text-gray-400 font-medium text-sm border-2 border-dashed border-gray-200 rounded-[30px] bg-white">
            Không tìm thấy đơn hàng nào phù hợp.
          </div>
        )}
      </div>

      {/* --- MODAL SỬA MỘT MÓN TRONG ĐƠN --- */}
      {editingOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3 md:p-4 backdrop-blur-sm animate-in fade-in no-print">
          <div className="bg-white rounded-[24px] p-6 md:p-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative">
            <button onClick={() => setEditingOrder(null)} className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 p-2 rounded-full transition-colors"><X size={20}/></button>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-6">
              <Pencil className="text-blue-500" size={22}/> Sửa chi tiết nâng cao
            </h2>
            
            <form onSubmit={handleUpdateOrderItem} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 p-5 rounded-2xl border border-gray-200">
                <div>
                  <label className="text-xs font-semibold text-blue-600 mb-1.5 flex items-center gap-1"><Calendar size={14}/> Ngày Bán</label>
                  <input required type="date" className="w-full border border-gray-300 rounded-xl p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white transition-all" value={editForm.created_at} onChange={e => setEditForm({...editForm, created_at: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Đổi Lô Hàng</label>
                  <select required className="w-full border border-gray-300 rounded-xl p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white transition-all" value={editForm.batch_id} onChange={e => setEditForm({...editForm, batch_id: e.target.value})}>
                    {batches.map(b => (<option key={b.id} value={b.id}>{b.batch_code}</option>))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Phân Loại Yến</label>
                  <select required className="w-full border border-gray-300 rounded-xl p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white transition-all" value={editForm.grade_type} onChange={e => setEditForm({...editForm, grade_type: e.target.value})}>
                    <option value="Xô">Hàng Xô Zin</option><option value="Đẹp">Hàng Đẹp (VIP)</option><option value="Vừa">Hàng Vừa</option><option value="Xấu">Hàng Xấu (Gãy/Vụn)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-orange-600 mb-1.5 block">Người Chốt Đơn</label>
                  <select required className="w-full border border-orange-300 rounded-xl p-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 bg-orange-50 font-bold transition-all text-orange-800" value={editForm.seller} onChange={e => setEditForm({...editForm, seller: e.target.value})}>
                    <option value="Quyên">Quyên</option>
                    <option value="Duy">Sếp Duy</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <div className="col-span-2">
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Kg Xuất Bán</label>
                    <input required type="number" step="0.001" className="w-full border border-gray-300 rounded-xl p-3 text-base font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all" value={editForm.weight} onChange={e => setEditForm({...editForm, weight: e.target.value})} />
                 </div>
                 <div className="col-span-2">
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Giá Bán / 1kg (VNĐ)</label>
                    <input required type="number" className="w-full border border-gray-300 rounded-xl p-3 text-base font-bold text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all" value={editForm.unitPrice} onChange={e => setEditForm({...editForm, unitPrice: e.target.value})} />
                 </div>
                 <div className="col-span-1">
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Kg Hao Hụt</label>
                    <input type="number" step="0.001" className="w-full border border-gray-300 rounded-xl p-3 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-all" value={editForm.weight_loss} onChange={e => setEditForm({...editForm, weight_loss: e.target.value})} />
                 </div>
                 <div className="col-span-1">
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Phí Ship</label>
                    <input type="number" className="w-full border border-gray-300 rounded-xl p-3 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all" value={editForm.shipping_fee} onChange={e => setEditForm({...editForm, shipping_fee: e.target.value})} />
                 </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-100">
                <button type="button" onClick={() => setEditingOrder(null)} className="px-6 py-3 rounded-xl font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">Hủy</button>
                <button type="submit" disabled={loading} className="bg-blue-600 text-white font-semibold px-8 py-3 rounded-xl hover:bg-blue-700 transition-all shadow-md">
                   Lưu Thay Đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL HÓA ĐƠN PDF CHUẨN CÔNG TY TNHH --- */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-gray-900/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm no-print">
          <div className="bg-white w-full max-w-3xl max-h-[95vh] overflow-y-auto rounded-[20px] shadow-2xl relative flex flex-col">
            
            <div className="sticky top-0 bg-white/95 backdrop-blur-md p-4 border-b border-gray-100 flex justify-between items-center z-10 rounded-t-[20px]">
               <h3 className="font-bold text-sm text-gray-700">Tùy chỉnh Hóa Đơn Doanh Nghiệp</h3>
               <div className="flex gap-2">
                 <button onClick={handleSaveCustomerInfo} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-semibold text-xs flex items-center gap-2 transition-colors" title="Lưu thông tin khách hàng">
                    <Save size={16}/> LƯU THÔNG TIN
                 </button>
                 <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold text-xs shadow-sm flex items-center gap-2 transition-colors">
                    <Printer size={16}/> IN BILL
                 </button>
                 <button onClick={() => setSelectedInvoice(null)} className="bg-red-50 hover:bg-red-100 text-red-500 p-2 rounded-lg transition-colors">
                    <X size={18}/>
                 </button>
               </div>
            </div>

            <div id="invoice-print-area" className="p-8 md:p-12 bg-white text-gray-900 w-full font-sans">
                {/* HEADER HÓA ĐƠN CHUẨN CÔNG TY */}
                <div className="flex flex-col md:flex-row justify-between items-start border-b-2 border-gray-800 pb-6 mb-8 gap-4">
                   <div>
                      <h1 className="text-xl md:text-2xl font-black uppercase mb-1 text-gray-900">CÔNG TY TNHH TMDV ĐOÀN QUYÊN</h1>
                      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3">YẾN SÀO ĐOÀN QUYÊN - HỆ THỐNG YẾN SÀO CAO CẤP</p>
                      <p className="text-sm text-gray-700 leading-relaxed"><span className="font-semibold">Mã số thuế:</span> 1102145101</p>
                      <p className="text-sm text-gray-700 leading-relaxed"><span className="font-semibold">Địa chỉ:</span> Số 290, Ấp Bình Phong Thạnh 2, Xã Mộc Hóa, Tỉnh Tây Ninh, Việt Nam</p>
                      <p className="text-sm text-gray-700 leading-relaxed"><span className="font-semibold">Điện thoại:</span> 084.2304.158</p>
                   </div>
                   <div className="text-left md:text-right w-full md:w-auto bg-gray-50 p-4 md:p-0 md:bg-transparent rounded-xl">
                      <h2 className="text-xl md:text-2xl font-black uppercase text-gray-800 mb-1">HÓA ĐƠN BÁN HÀNG</h2>
                      <p className="text-xs text-gray-500 italic mb-2">Bản thể hiện của hóa đơn điện tử</p>
                      <p className="text-sm text-gray-600"><span className="font-semibold">Số HD:</span> HD{selectedInvoice.items[0]?.id.substring(0, 8).toUpperCase()}</p>
                      <p className="text-sm text-gray-600"><span className="font-semibold">Ngày lập:</span> {selectedInvoice.dateValue}</p>
                   </div>
                </div>

                {/* THÔNG TIN KHÁCH HÀNG */}
                <div className="mb-6 p-5 bg-gray-50 rounded-xl border border-gray-200">
                   <h3 className="text-xs font-bold uppercase text-gray-500 mb-3 flex items-center justify-between">
                      <span>THÔNG TIN KHÁCH HÀNG</span>
                      <span className="text-blue-500 font-normal capitalize text-[10px] no-print">(Click vào chữ để sửa)</span>
                   </h3>
                   <div className="grid grid-cols-1 gap-2 text-sm">
                      <div className="flex items-center gap-2 border-b border-gray-200 pb-1.5">
                        <span className="font-semibold text-gray-700 w-24">Khách hàng:</span> 
                        <input value={selectedInvoice.customer?.name || ''} onChange={e => setSelectedInvoice({...selectedInvoice, customer: {...selectedInvoice.customer, name: e.target.value}})} className="font-bold text-gray-900 bg-transparent outline-none w-full hover:bg-white px-1 transition-colors"/>
                      </div>
                      <div className="flex items-center gap-2 border-b border-gray-200 pb-1.5">
                        <span className="font-semibold text-gray-700 w-24">SĐT:</span> 
                        <input value={selectedInvoice.customer?.phone || ''} onChange={e => setSelectedInvoice({...selectedInvoice, customer: {...selectedInvoice.customer, phone: e.target.value}})} className="font-bold text-gray-900 bg-transparent outline-none w-full hover:bg-white px-1 transition-colors"/>
                      </div>
                      <div className="flex items-center gap-2 border-b border-gray-200 pb-1.5">
                        <span className="font-semibold text-gray-700 w-24">Địa chỉ:</span> 
                        <input value={selectedInvoice.customer?.address || ''} onChange={e => setSelectedInvoice({...selectedInvoice, customer: {...selectedInvoice.customer, address: e.target.value}})} className="font-bold text-gray-900 bg-transparent outline-none w-full hover:bg-white px-1 transition-colors"/>
                      </div>
                   </div>
                </div>

                {/* BẢNG SẢN PHẨM */}
                <div className="overflow-x-auto mb-6">
                  <table className="w-full text-left border-collapse min-w-[500px]">
                    <thead>
                      <tr className="border-y-2 border-gray-800 text-xs font-bold text-gray-800 bg-gray-50/50">
                        <th className="py-3 px-2 w-12 text-center">STT</th>
                        <th className="py-3 px-2">Tên Hàng Hóa / Dịch vụ</th>
                        <th className="py-3 px-2 text-center">Loại</th>
                        <th className="py-3 px-2 text-right">Số Lượng</th>
                        <th className="py-3 px-2 text-right">Đơn Giá</th>
                        <th className="py-3 px-2 text-right">Thành Tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInvoice.items.map((item: any, index: number) => {
                          const unitPrice = item.weight > 0 ? (item.revenue / item.weight) : 0;
                          return (
                            <tr key={item.id} className="border-b border-gray-200 text-sm">
                              <td className="py-3 px-2 text-gray-600 text-center font-medium">{index + 1}</td>
                              <td className="py-3 px-2 font-bold text-gray-800">Yến sào nguyên chất <span className="text-[10px] text-gray-400 font-normal block mt-0.5">Mã lô: {item.batches?.batch_code || '---'}</span></td>
                              <td className="py-3 px-2 text-center text-gray-600 uppercase text-[10px] font-semibold">{item.grade_type || 'Xô'}</td>
                              <td className="py-3 px-2 text-right font-semibold text-gray-800">{Number(item.weight).toFixed(3)} kg</td>
                              <td className="py-3 px-2 text-right text-gray-600">{Math.round(unitPrice).toLocaleString('vi-VN')}</td>
                              <td className="py-3 px-2 text-right font-bold text-gray-900">{Number(item.revenue).toLocaleString('vi-VN')}</td>
                            </tr>
                          )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* TỔNG KẾT TÀI CHÍNH KẾ TOÁN */}
                <div className="flex justify-end mb-6">
                   <div className="w-full md:w-1/2 space-y-2 text-sm text-gray-800">
                      {/* Tiền hàng chưa tính phí */}
                      <div className="flex justify-between border-b border-dashed border-gray-200 pb-2">
                         <span className="font-semibold">Cộng tiền hàng hóa:</span>
                         <span className="font-bold">{Number(selectedInvoice.totalRevenue - selectedInvoice.totalTax - selectedInvoice.totalShip).toLocaleString('vi-VN')} đ</span>
                      </div>
                      
                      {/* Dòng Thuế GTGT 5% bóc tách rõ ràng */}
                      {Number(selectedInvoice.totalTax) > 0 ? (
                        <div className="flex justify-between border-b border-dashed border-gray-200 pb-2 text-gray-600">
                           <span>Tiền Thuế GTGT (5%):</span>
                           <span>{Number(selectedInvoice.totalTax).toLocaleString('vi-VN')} đ</span>
                        </div>
                      ) : (
                        <div className="flex justify-between border-b border-dashed border-gray-200 pb-2 text-gray-600">
                           <span>Tiền Thuế GTGT:</span>
                           <span className="italic text-gray-400">Không xuất hóa đơn VAT</span>
                        </div>
                      )}

                      {/* Phí vận chuyển */}
                      {Number(selectedInvoice.totalShip) > 0 && (
                        <div className="flex justify-between border-b border-dashed border-gray-200 pb-2 text-gray-600">
                           <span>Phí vận chuyển:</span>
                           <span>{Number(selectedInvoice.totalShip).toLocaleString('vi-VN')} đ</span>
                        </div>
                      )}
                      
                      {/* TỔNG TIỀN */}
                      <div className="flex justify-between items-end border-b-2 border-gray-800 pb-3 pt-2 bg-gray-50 px-3 rounded-t-lg">
                         <span className="text-sm font-bold uppercase text-gray-900">TỔNG THANH TOÁN:</span>
                         <span className="text-2xl font-black text-gray-900">{Number(selectedInvoice.totalRevenue).toLocaleString('vi-VN')} đ</span>
                      </div>
                   </div>
                </div>

                {/* SỐ TIỀN BẰNG CHỮ CỰC KỲ QUAN TRỌNG */}
                <div className="mb-10 text-sm font-semibold text-gray-800 bg-blue-50/50 p-3 rounded-lg border border-blue-100 flex gap-2">
                   <span className="shrink-0 italic">Số tiền viết bằng chữ: </span>
                   <span className="font-bold text-blue-900 uppercase">
                     {readNumberToText(selectedInvoice.totalRevenue)}
                   </span>
                </div>

                {/* CHỮ KÝ ĐÓNG DẤU */}
                <div className="grid grid-cols-2 text-center pt-4">
                   <div>
                      <p className="font-bold text-sm uppercase text-gray-800">Người Mua Hàng</p>
                      <p className="text-[11px] text-gray-500 italic mt-0.5">(Ký, ghi rõ họ tên)</p>
                      <div className="h-24"></div>
                   </div>
                   <div>
                      <p className="font-bold text-sm uppercase text-gray-800">Đại diện Công Ty</p>
                      <p className="text-[11px] text-gray-500 italic mt-0.5">(Ký, ghi rõ họ tên)</p>
                      <div className="h-24 flex items-center justify-center">
                         {selectedInvoice.status === 'Hoàn tất' && (
                           <div className="border-4 border-red-500 text-red-500 font-black uppercase text-xl px-4 py-2 rotate-[-15deg] opacity-60 inline-block">
                              ĐÃ THANH TOÁN
                           </div>
                         )}
                      </div>
                   </div>
                </div>
            </div>
            
          </div>
        </div>
      )}

    </div>
  )
}
'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { 
  Trash2, PlusCircle, Scale, Package, FileSpreadsheet, 
  Printer, X, Search, Save, Pencil, CheckCircle2,
  UserCircle2, Droplet, Calendar, MessageCircle, Clock, Weight, Plus
} from 'lucide-react'

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
  let tempNumber = Math.round(number) 
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
    seller: '', moisture_level: ''
  })

  // STATE CHO TÍNH NĂNG THÊM MÓN VÀO ĐƠN CŨ
  const [addingToGroup, setAddingToGroup] = useState<any>(null)
  const [newItemForm, setNewItemForm] = useState({
    batch_id: '', grade_type: 'Xô', weight: '', unitPrice: '', shipping_fee: '0'
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
      const dateObj = new Date(order.created_at);
      const dateStr = dateObj.toLocaleDateString('vi-VN');
      const timeStr = dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
      
      const timeKey = dateObj.toISOString().slice(0, 16); 
      const customerId = order.customers?.id || 'unknown';
      const groupKey = `${customerId}_${timeKey}`;

      if (!groups[groupKey]) {
        groups[groupKey] = {
          groupKey: groupKey,
          customer: order.customers,
          dateStr: dateStr,
          timeStr: timeStr,
          rawDate: order.created_at,
          status: order.status,
          note: order.note,
          seller: order.seller || 'Quyên', 
          items: [],
          totalRevenue: 0,
          totalTax: 0,
          totalShip: 0,
          totalProfit: 0,
          totalWeight: 0, 
          totalLossMoney: 0
        };
      }

      groups[groupKey].items.push(order);
      groups[groupKey].totalRevenue += Number(order.revenue || 0);
      groups[groupKey].totalTax += Number(order.tax_amount || 0);
      groups[groupKey].totalShip += Number(order.shipping_fee || 0);
      groups[groupKey].totalProfit += Number(order.profit || 0);
      groups[groupKey].totalWeight += Number(order.weight || 0); 
      
      const costPerKg = Number(order.weight) > 0 ? (Number(order.cost) / Number(order.weight)) : 0;
      groups[groupKey].totalLossMoney += Number(order.weight_loss || 0) * costPerKg;
      
      if (order.seller === 'Duy') {
          groups[groupKey].seller = 'Duy';
      }
    });

    let resultArray = Object.values(groups).filter(g => 
      g.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      g.customer?.phone?.includes(searchTerm) ||
      g.items.some((i: any) => i.batches?.batch_code?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const statusPriority: Record<string, number> = {
      'Chưa giao': 1,
      'Đang giao': 2,
      'Đã giao - Còn nợ': 3,
      'Hoàn tất': 4
    };

    resultArray.sort((a, b) => {
       const priorityA = statusPriority[a.status] || 5;
       const priorityB = statusPriority[b.status] || 5;
       if (priorityA !== priorityB) {
          return priorityA - priorityB;
       }
       return new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime();
    });

    return resultArray;
  }, [orders, searchTerm]);

  // XÓA CẢ ĐƠN
  const deleteGroupOrder = async (group: any) => { 
    if (confirm(`Duy chắc chắn muốn xóa TOÀN BỘ đơn hàng này của khách ${group.customer?.name} không?`)) { 
      setLoading(true);
      const idsToDelete = group.items.map((i: any) => i.id);
      await supabase.from('orders').delete().in('id', idsToDelete); 
      fetchOrders(); 
    } 
  }

  // XÓA 1 MÓN LẺ TRONG ĐƠN
  const deleteSingleItem = async (item: any, group: any) => {
    if (group.items.length === 1) {
       if(!confirm('Đây là món duy nhất. Nếu xóa thì toàn bộ đơn hàng này sẽ biến mất. Chắc chưa sếp?')) return;
    } else {
       if(!confirm('Xác nhận xóa món này ra khỏi đơn? Kho sẽ được hoàn lại số Kg.')) return;
    }
    setLoading(true);
    await supabase.from('orders').delete().eq('id', item.id);
    fetchOrders();
  }

  const updateGroupStatus = async (group: any, newStatus: string) => { 
    setLoading(true);
    const idsToUpdate = group.items.map((i: any) => i.id);
    await supabase.from('orders').update({ status: newStatus }).in('id', idsToUpdate); 
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
      note: order.note || '', seller: order.seller || 'Quyên',
      moisture_level: (order.moisture_level || 0).toString()
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
      seller: editForm.seller,
      moisture_level: Number(editForm.moisture_level) 
    }).eq('id', editForm.id);

    setEditingOrder(null);
    fetchOrders();
  }

  // HÀM XỬ LÝ THÊM MÓN VÀO ĐƠN HIỆN TẠI
  const handleAddNewItemToGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!addingToGroup) return;
    setLoading(true);

    const baseItem = addingToGroup.items[0]; // Lấy thông tin nền của đơn hiện tại

    const weightNum = Number(newItemForm.weight) || 0;
    const priceNum = Number(newItemForm.unitPrice) || 0;
    const shipNum = Number(newItemForm.shipping_fee) || 0;

    const selectedBatch = batches.find(b => b.id === newItemForm.batch_id);
    const costPerKg = selectedBatch ? Number(selectedBatch.cost_per_kg) : 0;

    const cost = weightNum * costPerKg;
    const revenue = weightNum * priceNum;
    
    // Nếu đơn cũ có tính thuế thì món mới cũng tính thuế
    const isTaxed = addingToGroup.totalTax > 0;
    const tax = isTaxed ? revenue * 0.05 : 0;

    const profit = revenue - cost - tax - shipNum;

    await supabase.from('orders').insert([{
      customer_id: baseItem.customer_id,
      batch_id: newItemForm.batch_id,
      grade_type: newItemForm.grade_type,
      weight: weightNum,
      cost: cost,
      revenue: revenue,
      tax_amount: tax,
      shipping_fee: shipNum,
      profit: profit,
      status: baseItem.status,
      seller: baseItem.seller,
      note: (baseItem.note || '') + ' (Thêm bổ sung)',
      created_at: baseItem.created_at // GIỮ ĐÚNG THỜI GIAN ĐỂ NẰM CHUNG 1 NHÓM
    }]);

    setAddingToGroup(null);
    setNewItemForm({ batch_id: '', grade_type: 'Xô', weight: '', unitPrice: '', shipping_fee: '0' });
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

  const handleExportExcel = () => {
    const exportData = orders.map((o, index) => {
      const orderDate = new Date(o.created_at);
      const timeStr = orderDate.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit', hour12: false});
      const dateStr = orderDate.toLocaleDateString('vi-VN');

      return {
        "STT": index + 1, 
        "Mã Đơn": `DD-${o.id.slice(0, 6).toUpperCase()}`, 
        "Ngày chốt": `${timeStr} ${dateStr}`,
        "Khách hàng": o.customers?.name || '', 
        "Điện thoại": o.customers?.phone || '', 
        "Địa chỉ giao": o.customers?.address || '',
        "Mã Lô Xuất": o.batches?.batch_code || '', 
        "Phân loại": o.grade_type || 'Xô',
        "Độ ẩm (%)": Number(o.moisture_level || 0),
        "Số Kg Yến": Number(o.weight), 
        "Hao hụt (Kg)": Number(o.weight_loss || 0),
        "Doanh thu (VNĐ)": Math.round(Number(o.revenue)), 
        "Thuế 5% (VNĐ)": Math.round(Number(o.tax_amount || 0)),
        "Phí Ship (VNĐ)": Math.round(Number(o.shipping_fee || 0)), 
        "Lợi Nhuận Ròng (VNĐ)": Math.round(Number(o.profit)),
        "Người bán": o.seller || 'Quyên', 
        "Trạng thái": o.status, 
        "Ghi chú": o.note || ''
      }
    })
    
    const worksheet = XLSX.utils.json_to_sheet(exportData)
    
    const wscols = [
      { wch: 5 }, { wch: 15 }, { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 45 }, 
      { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, 
      { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 50 }, 
    ];
    worksheet['!cols'] = wscols;

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Bao_Cao_Doanh_Thu")
    XLSX.writeFile(workbook, `Bao_Cao_Doanh_Thu_DDPRIME_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.xlsx`)
  }

  if (loading) return <div className="p-10 font-bold text-gray-400 animate-pulse text-center uppercase tracking-widest text-xs">Đang tải dữ liệu Đoàn Quyên...</div>

  return (
    <div className="p-3 md:p-8 space-y-6 bg-gray-50 min-h-screen max-w-5xl mx-auto pb-24 font-sans">
      
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

      {/* HEADER TỐI ƯU MOBILE */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-5 md:p-6 rounded-[24px] md:rounded-[30px] shadow-sm border border-gray-100 gap-4 no-print">
        <div>
          <h1 className="text-xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2 md:gap-3">
             <div className="p-1.5 md:p-2 bg-blue-600 text-white rounded-xl md:rounded-2xl shadow-lg shadow-blue-200"><Package size={20} className="md:w-6 md:h-6"/></div> 
             Quản Lý Đơn Hàng
          </h1>
          <p className="text-gray-400 text-[9px] md:text-[10px] font-bold uppercase tracking-widest mt-1.5 ml-1">Lưu trữ giao dịch thực tế</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button onClick={handleExportExcel} className="flex-1 md:flex-none bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 md:px-5 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-bold transition-all flex items-center justify-center gap-1.5 md:gap-2 text-xs">
            <FileSpreadsheet size={14}/> Xuất Excel
          </button>
          <Link href="/dashboard/orders/new" className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white px-4 md:px-5 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-bold shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-1.5 md:gap-2 text-xs">
            <PlusCircle size={14}/> Lên đơn mới
          </Link>
        </div>
      </div>

      {/* TÌM KIẾM */}
      <div className="bg-white px-4 md:px-5 py-3 md:py-4 rounded-[16px] md:rounded-[20px] border border-gray-100 shadow-sm flex items-center gap-3 no-print">
        <Search className="text-gray-300 shrink-0" size={18} />
        <input 
           placeholder="Tìm tên, SĐT hoặc mã lô..." 
           className="w-full bg-transparent outline-none font-bold text-slate-700 text-sm placeholder:text-gray-300" 
           value={searchTerm} 
           onChange={(e) => setSearchTerm(e.target.value)} 
        />
      </div>

      {/* DANH SÁCH ĐƠN HÀNG */}
      <div className="grid gap-5 md:gap-6 no-print">
        {groupedOrders.map((group: any) => (
          <div key={group.groupKey} className="bg-white rounded-[24px] md:rounded-[32px] border border-gray-100 shadow-sm overflow-hidden relative hover:shadow-md transition-shadow">
            
            {/* NHÃN NGƯỜI BÁN (Góc phải) */}
            <div className="absolute top-0 right-0 flex z-10">
               <div className={`px-3 md:px-4 py-1 md:py-1.5 rounded-bl-xl md:rounded-bl-2xl font-black text-[8px] md:text-[9px] uppercase tracking-widest ${group.seller === 'Duy' ? 'bg-orange-500 text-white' : 'bg-pink-500 text-white'}`}>
                  {group.seller === 'Duy' ? 'Duy chốt' : 'Quyên chốt'}
               </div>
            </div>

            {/* HEADER ĐƠN HÀNG */}
            <div className="p-4 md:p-6 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-dashed border-gray-100 mt-2 md:mt-0">
               <div className="flex gap-3 md:gap-4 items-start w-full md:w-auto">
                  
                  {/* GIỜ GIẤC */}
                  <div className="bg-slate-900 text-white p-2.5 md:p-3 rounded-xl md:rounded-2xl flex flex-col items-center justify-center min-w-[65px] md:min-w-[75px] shadow-lg shrink-0">
                    <span className="text-[12px] md:text-[14px] font-black leading-none flex items-center gap-1"><Clock size={10} className="md:w-3 md:h-3 text-blue-400"/> {group.timeStr}</span>
                    <span className="text-[8px] md:text-[9px] font-bold uppercase mt-1 opacity-60 tracking-tighter">{group.dateStr}</span>
                  </div>
                  
                  {/* THÔNG TIN KHÁCH & TRẠNG THÁI */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5 md:mb-2 pr-12 md:pr-0">
                      <h3 className="font-black text-lg md:text-xl text-slate-800 leading-tight truncate">{group.customer?.name}</h3>
                      {group.customer?.phone && (
                        <a href={`https://zalo.me/${group.customer.phone.replace(/\s/g, '')}`} target="_blank" rel="noreferrer" className="p-1 md:p-1.5 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors">
                          <MessageCircle size={12} className="md:w-3.5 md:h-3.5" />
                        </a>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2">
                       <select value={group.status} onChange={(e) => updateGroupStatus(group, e.target.value)} className={`text-[9px] md:text-[10px] px-2 md:px-3 py-1 rounded-md md:rounded-full font-black uppercase tracking-wider outline-none cursor-pointer border shadow-sm transition-all ${group.status === 'Hoàn tất' ? 'bg-emerald-500 text-white border-emerald-600' : (group.status === 'Đã giao - Còn nợ' ? 'bg-amber-100 text-amber-700 border-amber-200 animate-pulse' : 'bg-blue-100 text-blue-700 border-blue-200')}`}>
                         <option>Chưa giao</option><option>Đang giao</option><option>Đã giao - Còn nợ</option><option>Hoàn tất</option>
                       </select>
                       
                       {/* TỔNG KÝ */}
                       <div className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-md border border-blue-100">
                          <Weight size={10} className="opacity-70"/>
                          <span className="text-[9px] md:text-[10px] font-black uppercase tracking-tight">{group.totalWeight.toFixed(3)} KG</span>
                       </div>
                    </div>
                  </div>
               </div>

               {/* NÚT THAO TÁC CẢ ĐƠN */}
               <div className="flex items-center gap-2 w-full md:w-auto">
                  <button onClick={() => setSelectedInvoice(group)} className="flex-1 md:flex-none bg-slate-50 hover:bg-slate-100 text-slate-600 px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 md:gap-2 transition-colors text-xs font-bold border border-slate-200">
                     <Printer size={14} /> In Hóa Đơn
                  </button>
                  <button onClick={() => deleteGroupOrder(group)} className="p-2.5 bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl transition-all border border-rose-100 shrink-0" title="Xóa toàn bộ đơn">
                     <Trash2 size={16} />
                  </button>
               </div>
            </div>

            {/* DANH SÁCH MÓN HÀNG CHI TIẾT CỦA ĐƠN NÀY */}
            <div className="px-4 md:px-6 py-2">
               <div className="space-y-1">
                  {group.items.map((item: any, idx: number) => (
                     <div key={item.id} className="flex justify-between items-start md:items-center py-2.5 md:py-3 border-b border-gray-50 last:border-b-0 group/item gap-2">
                        
                        <div className="flex items-start md:items-center gap-2 md:gap-4 flex-1 min-w-0">
                           <span className="text-[10px] md:text-xs font-black text-slate-300 w-3 md:w-4 text-right pt-0.5 md:pt-0 shrink-0">{idx + 1}.</span>
                           <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                 <span className="text-slate-900 font-black text-xs md:text-sm uppercase tracking-tight truncate">{item.batches?.batch_code || 'N/A'}</span>
                                 <span className={`text-[8px] md:text-[9px] font-black uppercase px-1.5 py-0.5 rounded shrink-0 ${item.grade_type === 'Đẹp' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>{item.grade_type || 'Xô'}</span>
                              </div>
                              <p className="text-[10px] md:text-[11px] font-bold text-slate-400 mt-0.5 truncate">Khối lượng: <span className="text-slate-600">{Number(item.weight).toFixed(3)} kg</span></p>
                           </div>
                        </div>

                        <div className="flex flex-col md:flex-row items-end md:items-center gap-1.5 md:gap-3 shrink-0">
                           <p className="font-black text-slate-800 text-xs md:text-sm">{Math.round(Number(item.revenue)).toLocaleString('vi-VN')}đ</p>
                           <div className="flex items-center gap-1">
                              {/* BÚT CHÌ ĐỂ SỬA MÓN NÀY */}
                              <button onClick={() => openEditModal(item)} className="p-1 md:p-1.5 text-slate-300 hover:bg-blue-50 hover:text-blue-600 rounded-md md:rounded-lg transition-colors flex items-center justify-center" title="Sửa chi tiết món này">
                                 <Pencil size={12} className="md:w-3.5 md:h-3.5"/>
                              </button>
                              {/* THÙNG RÁC XÓA MÓN LẺ (TÍNH NĂNG MỚI) */}
                              <button onClick={() => deleteSingleItem(item, group)} className="p-1 md:p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-600 rounded-md md:rounded-lg transition-colors flex items-center justify-center" title="Xóa bỏ món này khỏi đơn">
                                 <Trash2 size={12} className="md:w-3.5 md:h-3.5"/>
                              </button>
                           </div>
                        </div>
                     </div>
                  ))}
               </div>
               
               {/* NÚT THÊM MÓN MỚI NGAY TẠI ĐƠN NÀY */}
               <div className="mt-2 mb-1">
                  <button onClick={() => setAddingToGroup(group)} className="w-full py-2 border border-dashed border-slate-300 rounded-xl text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest hover:bg-slate-50 hover:text-blue-600 transition-colors flex justify-center items-center gap-1.5">
                     <Plus size={14}/> Thêm kiện khác vào đơn này
                  </button>
               </div>
            </div>

            {/* TỔNG KẾT TÀI CHÍNH */}
            <div className="bg-slate-50 p-4 md:p-6 flex flex-col gap-3">
               <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 sm:gap-0">
                  <div className="w-full sm:w-auto flex justify-between sm:block items-end">
                     <p className="text-[9px] md:text-[10px] text-slate-500 uppercase tracking-[0.15em] font-black mb-1">Khách cần trả</p>
                     <p className="text-2xl md:text-3xl font-black text-slate-900 leading-none tracking-tighter">{Math.round(group.totalRevenue).toLocaleString('vi-VN')}đ</p>
                  </div>
                  
                  <div className="w-full sm:w-auto text-right border-t border-slate-200 sm:border-0 pt-3 sm:pt-0">
                     <div className="flex justify-between sm:justify-end gap-4 text-[10px] md:text-[11px] mb-2.5">
                        <div className="font-bold text-slate-500 uppercase tracking-wider">Thuế: <span className="text-slate-800 font-black">-{Math.round(group.totalTax).toLocaleString('vi-VN')}đ</span></div>
                        <div className="font-bold text-slate-500 uppercase tracking-wider">Ship: <span className="text-slate-800 font-black">-{Math.round(group.totalShip).toLocaleString('vi-VN')}đ</span></div>
                     </div>
                     <p className={`text-[11px] font-black px-3 py-1.5 rounded-lg border shadow-sm block sm:inline-block w-full sm:w-auto text-center sm:text-right ${group.totalProfit >= 0 ? 'text-emerald-700 bg-emerald-100 border-emerald-200' : 'text-rose-700 bg-rose-100 border-rose-200'}`}>
                         {group.totalProfit >= 0 ? 'LỢI NHUẬN: +' : 'THẤT THOÁT: -'}{Math.abs(Math.round(group.totalProfit)).toLocaleString('vi-VN')}đ
                     </p>
                  </div>
               </div>
            </div>

          </div>
        ))}

        {groupedOrders.length === 0 && orders.length > 0 && (
          <div className="text-center py-20 text-gray-400 font-bold text-sm border-2 border-dashed border-gray-200 rounded-[32px] bg-white">
            Không tìm thấy đơn hàng nào phù hợp.
          </div>
        )}
      </div>

      {/* =========================================================
          MODAL 1: THÊM MÓN MỚI VÀO ĐƠN CŨ (TÍNH NĂNG MỚI) 
          ========================================================= */}
      {addingToGroup && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-3 md:p-4 backdrop-blur-sm animate-in fade-in no-print">
          <div className="bg-white rounded-[24px] md:rounded-[32px] p-5 md:p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative border border-white">
            <button onClick={() => setAddingToGroup(null)} className="absolute top-4 right-4 md:top-6 md:right-6 text-slate-400 hover:text-slate-900 bg-slate-100 p-2 rounded-full transition-colors"><X size={18}/></button>
            <h2 className="text-lg md:text-xl font-black text-slate-900 flex items-center gap-2 mb-2 uppercase tracking-tight">
              <PlusCircle className="text-blue-600" size={20}/> Thêm hàng vào đơn
            </h2>
            <p className="text-xs font-bold text-slate-500 mb-6">Thêm vào bill của: <span className="text-slate-800">{addingToGroup.customer?.name}</span></p>
            
            <form onSubmit={handleAddNewItemToGroup} className="space-y-4 md:space-y-6">
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div className="space-y-1 md:space-y-1.5">
                  <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase ml-1">Chọn Mã Lô</label>
                  <select required className="w-full border border-slate-200 rounded-xl md:rounded-2xl p-2.5 md:p-3 font-bold text-xs md:text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-blue-100" value={newItemForm.batch_id} onChange={e => setNewItemForm({...newItemForm, batch_id: e.target.value})}>
                    <option value="">-- Chọn lô --</option>
                    {batches.map(b => (<option key={b.id} value={b.id}>{b.batch_code}</option>))}
                  </select>
                </div>
                <div className="space-y-1 md:space-y-1.5">
                  <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase ml-1">Phân Loại</label>
                  <select required className="w-full border border-slate-200 rounded-xl md:rounded-2xl p-2.5 md:p-3 font-bold text-xs md:text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-blue-100" value={newItemForm.grade_type} onChange={e => setNewItemForm({...newItemForm, grade_type: e.target.value})}>
                    <option value="Xô">Hàng Xô Zin</option><option value="Đẹp">Hàng Đẹp</option><option value="Vừa">Hàng Vừa</option><option value="Xấu">Hàng Xấu</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:gap-4 p-4 bg-slate-50 rounded-[20px] md:rounded-[24px] border border-slate-100">
                 <div className="space-y-1 md:space-y-1.5">
                    <label className="text-[9px] md:text-[10px] font-black text-blue-600 uppercase ml-1">Số Kg Bán</label>
                    <input required type="number" step="0.001" placeholder="VD: 0.5" className="w-full border-none rounded-xl p-2.5 md:p-3 text-sm font-black bg-white shadow-sm outline-none" value={newItemForm.weight} onChange={e => setNewItemForm({...newItemForm, weight: e.target.value})} />
                 </div>
                 <div className="space-y-1 md:space-y-1.5">
                    <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase ml-1">Giá Bán/Kg</label>
                    <input required type="number" placeholder="VNĐ" className="w-full border border-slate-200 rounded-xl p-2.5 md:p-3 text-sm font-black bg-white shadow-sm outline-none" value={newItemForm.unitPrice} onChange={e => setNewItemForm({...newItemForm, unitPrice: e.target.value})} />
                 </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2 md:pt-4">
                <button type="button" onClick={() => setAddingToGroup(null)} className="w-full sm:w-auto px-6 py-3 rounded-xl md:rounded-2xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors text-sm">Hủy bỏ</button>
                <button type="submit" disabled={loading} className="w-full sm:w-auto bg-blue-600 text-white font-black px-8 py-3 rounded-xl md:rounded-2xl hover:bg-blue-700 transition-all shadow-lg text-sm disabled:opacity-50">THÊM VÀO ĐƠN NÀY</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL 2: SỬA CHI TIẾT CHUYÊN SÂU CỦA 1 MÓN
          ========================================================= */}
      {editingOrder && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-3 md:p-4 backdrop-blur-sm animate-in fade-in no-print">
          <div className="bg-white rounded-[24px] md:rounded-[32px] p-5 md:p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative border border-white">
            <button onClick={() => setEditingOrder(null)} className="absolute top-4 right-4 md:top-6 md:right-6 text-slate-400 hover:text-slate-900 bg-slate-100 p-2 rounded-full transition-colors"><X size={18}/></button>
            <h2 className="text-lg md:text-xl font-black text-slate-900 flex items-center gap-2 mb-6 uppercase tracking-tight">
              <Pencil className="text-blue-600" size={20}/> Chỉnh sửa chuyên sâu
            </h2>
            
            <form onSubmit={handleUpdateOrderItem} className="space-y-4 md:space-y-6">
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div className="space-y-1 md:space-y-1.5">
                  <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase ml-1">Mã Lô</label>
                  <select required className="w-full border border-slate-200 rounded-xl md:rounded-2xl p-2.5 md:p-3 font-bold text-xs md:text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-blue-100" value={editForm.batch_id} onChange={e => setEditForm({...editForm, batch_id: e.target.value})}>
                    {batches.map(b => (<option key={b.id} value={b.id}>{b.batch_code}</option>))}
                  </select>
                </div>
                <div className="space-y-1 md:space-y-1.5">
                  <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase ml-1">Người Chốt</label>
                  <select required className="w-full border border-slate-200 rounded-xl md:rounded-2xl p-2.5 md:p-3 font-bold text-xs md:text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-blue-100" value={editForm.seller} onChange={e => setEditForm({...editForm, seller: e.target.value})}>
                    <option value="Quyên">Quyên</option><option value="Duy">Sếp Duy</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 p-4 bg-slate-50 rounded-[20px] md:rounded-[24px] border border-slate-100">
                 <div className="space-y-1 md:space-y-1.5 col-span-2 md:col-span-1">
                    <label className="text-[9px] md:text-[10px] font-black text-blue-600 uppercase ml-1">Số Kg Bán</label>
                    <input required type="number" step="0.001" className="w-full border-none rounded-xl p-2.5 md:p-3 text-sm font-black bg-white shadow-sm outline-none" value={editForm.weight} onChange={e => setEditForm({...editForm, weight: e.target.value})} />
                 </div>
                 <div className="space-y-1 md:space-y-1.5">
                    <label className="text-[9px] md:text-[10px] font-black text-orange-600 uppercase ml-1">Độ ẩm (%)</label>
                    <input type="number" className="w-full border-none rounded-xl p-2.5 md:p-3 text-sm font-black bg-white shadow-sm outline-none" value={editForm.moisture_level} onChange={e => setEditForm({...editForm, moisture_level: e.target.value})} />
                 </div>
                 <div className="space-y-1 md:space-y-1.5">
                    <label className="text-[9px] md:text-[10px] font-black text-rose-600 uppercase ml-1">Hao hụt (Kg)</label>
                    <input type="number" step="0.001" className="w-full border-none rounded-xl p-2.5 md:p-3 text-sm font-black bg-white shadow-sm outline-none text-rose-600" value={editForm.weight_loss} onChange={e => setEditForm({...editForm, weight_loss: e.target.value})} />
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:gap-4">
                 <div className="space-y-1 md:space-y-1.5">
                    <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase ml-1">Giá Bán/Kg</label>
                    <input required type="number" className="w-full border border-slate-200 rounded-xl md:rounded-2xl p-2.5 md:p-3 font-bold text-xs md:text-sm outline-none focus:ring-2 focus:ring-blue-100" value={editForm.unitPrice} onChange={e => setEditForm({...editForm, unitPrice: e.target.value})} />
                 </div>
                 <div className="space-y-1 md:space-y-1.5">
                    <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase ml-1">Phí Ship (Cho cả bill)</label>
                    <input type="number" className="w-full border border-slate-200 rounded-xl md:rounded-2xl p-2.5 md:p-3 font-bold text-xs md:text-sm outline-none focus:ring-2 focus:ring-blue-100" value={editForm.shipping_fee} onChange={e => setEditForm({...editForm, shipping_fee: e.target.value})} />
                 </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2 md:pt-4">
                <button type="button" onClick={() => setEditingOrder(null)} className="w-full sm:w-auto px-6 py-3 rounded-xl md:rounded-2xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors text-sm">Hủy</button>
                <button type="submit" disabled={loading} className="w-full sm:w-auto bg-slate-900 text-white font-black px-8 py-3 rounded-xl md:rounded-2xl hover:bg-black transition-all shadow-lg text-sm disabled:opacity-50">LƯU THAY ĐỔI</button>
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
                    <Save size={16}/> LƯU
                 </button>
                 <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold text-xs shadow-sm flex items-center gap-2 transition-colors">
                    <Printer size={16}/> IN
                 </button>
                 <button onClick={() => setSelectedInvoice(null)} className="bg-red-50 hover:bg-red-100 text-red-500 p-2 rounded-lg transition-colors">
                    <X size={18}/>
                 </button>
               </div>
            </div>

            <div id="invoice-print-area" className="p-6 md:p-12 bg-white text-gray-900 w-full font-sans">
                {/* HEADER HÓA ĐƠN CHUẨN CÔNG TY */}
                <div className="flex flex-col md:flex-row justify-between items-start border-b-2 border-gray-800 pb-6 mb-8 gap-4">
                   <div>
                      <h1 className="text-xl md:text-2xl font-black uppercase mb-1 text-gray-900">CÔNG TY TNHH TMDV ĐOÀN QUYÊN</h1>
                      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3">YẾN SÀO ĐOÀN QUYÊN - HỆ THỐNG YẾN SÀO CAO CẤP</p>
                      <p className="text-sm text-gray-700 leading-relaxed"><span className="font-semibold">Mã số thuế:</span> 1102145101</p>
                      <p className="text-sm text-gray-700 leading-relaxed"><span className="font-semibold">Địa chỉ:</span> Số 290, Ấp Bình Phong Thạnh 2, Xã Tân Thạnh, Tỉnh Long An, Việt Nam</p>
                      <p className="text-sm text-gray-700 leading-relaxed"><span className="font-semibold">Điện thoại:</span> 084.2304.158</p>
                   </div>
                   <div className="text-left md:text-right w-full md:w-auto bg-gray-50 p-4 md:p-0 md:bg-transparent rounded-xl">
                      <h2 className="text-xl md:text-2xl font-black uppercase text-gray-800 mb-1">HÓA ĐƠN BÁN HÀNG</h2>
                      <p className="text-xs text-gray-500 italic mb-2">Bản thể hiện của hóa đơn điện tử</p>
                      <p className="text-sm text-gray-600"><span className="font-semibold">Số HD:</span> HD{selectedInvoice.items[0]?.id.substring(0, 8).toUpperCase()}</p>
                      <p className="text-sm text-gray-600"><span className="font-semibold">Ngày lập:</span> {selectedInvoice.timeStr} ngày {selectedInvoice.dateStr}</p>
                   </div>
                </div>

                {/* THÔNG TIN KHÁCH HÀNG */}
                <div className="mb-6 p-5 bg-gray-50 rounded-xl border border-gray-200">
                   <h3 className="text-xs font-bold uppercase text-gray-500 mb-3 flex items-center justify-between">
                      <span>THÔNG TIN KHÁCH HÀNG</span>
                      <span className="text-blue-500 font-normal capitalize text-[10px] no-print">(Click vào chữ để sửa)</span>
                   </h3>
                   <div className="grid grid-cols-1 gap-2 text-sm">
                      <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 border-b border-gray-200 pb-1.5">
                        <span className="font-semibold text-gray-700 md:w-24">Khách hàng:</span> 
                        <input value={selectedInvoice.customer?.name || ''} onChange={e => setSelectedInvoice({...selectedInvoice, customer: {...selectedInvoice.customer, name: e.target.value}})} className="font-bold text-gray-900 bg-transparent outline-none w-full hover:bg-white md:px-1 transition-colors"/>
                      </div>
                      <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 border-b border-gray-200 pb-1.5">
                        <span className="font-semibold text-gray-700 md:w-24">SĐT:</span> 
                        <input value={selectedInvoice.customer?.phone || ''} onChange={e => setSelectedInvoice({...selectedInvoice, customer: {...selectedInvoice.customer, phone: e.target.value}})} className="font-bold text-gray-900 bg-transparent outline-none w-full hover:bg-white md:px-1 transition-colors"/>
                      </div>
                      <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 border-b border-gray-200 pb-1.5">
                        <span className="font-semibold text-gray-700 md:w-24">Địa chỉ:</span> 
                        <input value={selectedInvoice.customer?.address || ''} onChange={e => setSelectedInvoice({...selectedInvoice, customer: {...selectedInvoice.customer, address: e.target.value}})} className="font-bold text-gray-900 bg-transparent outline-none w-full hover:bg-white md:px-1 transition-colors"/>
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
                              <td className="py-3 px-2 text-right font-bold text-gray-900">{Math.round(Number(item.revenue)).toLocaleString('vi-VN')}</td>
                            </tr>
                          )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* TỔNG KẾT TÀI CHÍNH KẾ TOÁN */}
                <div className="flex justify-end mb-6">
                   <div className="w-full md:w-1/2 space-y-2 text-sm text-gray-800">
                      <div className="flex justify-between border-b border-dashed border-gray-200 pb-2">
                         <span className="font-semibold">Cộng tiền hàng hóa:</span>
                         <span className="font-bold">{Math.round(Number(selectedInvoice.totalRevenue - selectedInvoice.totalTax - selectedInvoice.totalShip)).toLocaleString('vi-VN')} đ</span>
                      </div>
                      
                      {Number(selectedInvoice.totalTax) > 0 ? (
                        <div className="flex justify-between border-b border-dashed border-gray-200 pb-2 text-gray-600">
                           <span>Tiền Thuế GTGT (5%):</span>
                           <span>{Math.round(Number(selectedInvoice.totalTax)).toLocaleString('vi-VN')} đ</span>
                        </div>
                      ) : (
                        <div className="flex justify-between border-b border-dashed border-gray-200 pb-2 text-gray-600">
                           <span>Tiền Thuế GTGT:</span>
                           <span className="italic text-gray-400">Không xuất hóa đơn VAT</span>
                        </div>
                      )}

                      {Number(selectedInvoice.totalShip) > 0 && (
                        <div className="flex justify-between border-b border-dashed border-gray-200 pb-2 text-gray-600">
                           <span>Phí vận chuyển:</span>
                           <span>{Math.round(Number(selectedInvoice.totalShip)).toLocaleString('vi-VN')} đ</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between items-end border-b-2 border-gray-800 pb-3 pt-2 bg-gray-50 px-3 rounded-t-lg">
                         <span className="text-sm font-bold uppercase text-gray-900">TỔNG THANH TOÁN:</span>
                         <span className="text-2xl font-black text-gray-900">{Math.round(Number(selectedInvoice.totalRevenue)).toLocaleString('vi-VN')} đ</span>
                      </div>
                   </div>
                </div>

                {/* SỐ TIỀN BẰNG CHỮ */}
                <div className="mb-10 text-sm font-semibold text-gray-800 bg-blue-50/50 p-3 rounded-lg border border-blue-100 flex gap-2">
                   <span className="shrink-0 italic">Số tiền bằng chữ: </span>
                   <span className="font-bold text-blue-900 uppercase">
                     {readNumberToText(Math.round(selectedInvoice.totalRevenue))}
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
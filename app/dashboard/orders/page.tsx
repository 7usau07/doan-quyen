'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { 
  Trash2, PlusCircle, Droplet, Scale, Package, FileSpreadsheet, 
  Printer, X, MapPin, Phone, CheckCircle2, Clock, Search, Save
} from 'lucide-react'

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Trạng thái cho việc in Hóa Đơn
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, customers(id, name, phone, address), batches(batch_code)')
      .order('created_at', { ascending: false });
    
    if (data) setOrders(data);
    setLoading(false)
  }

  useEffect(() => { fetchOrders() }, [])

  const deleteOrder = async (id: string) => { 
    if (confirm("Duy chắc chắn muốn xóa đơn này không?")) { 
      await supabase.from('orders').delete().eq('id', id); 
      fetchOrders(); 
    } 
  }

  const updateStatus = async (id: string, newStatus: string) => { 
    await supabase.from('orders').update({ status: newStatus }).eq('id', id); 
    fetchOrders(); 
  }

  // CẬP NHẬT TÀI CHÍNH KÈM HAO HỤT & ĐỘ ẨM
  const updateFinancials = async (order: any, field: string, value: string) => {
    const valNum = Number(value) || 0;
    const currentWeightLoss = field === 'weight_loss' ? valNum : Number(order.weight_loss);
    const currentShipping = field === 'shipping_fee' ? valNum : Number(order.shipping_fee);
    
    // Thuần túy cập nhật dữ liệu, nếu là độ ẩm thì chỉ lưu lại chứ không trừ tiền
    const dataToUpdate: any = { [field]: valNum };

    // Nếu thay đổi hao hụt kg hoặc phí ship thì mới phải tính lại tiền lời
    if (field === 'weight_loss' || field === 'shipping_fee') {
        const costPerKg = Number(order.cost) / Number(order.weight);
        const moneyLostToShrinkage = currentWeightLoss * costPerKg;
        const newProfit = Number(order.revenue) - Number(order.cost) - Number(order.tax_amount || 0) - currentShipping - moneyLostToShrinkage;
        dataToUpdate.profit = newProfit;
    }

    await supabase.from('orders').update(dataToUpdate).eq('id', order.id);
    fetchOrders(); 
  }

  // LƯU THÔNG TIN KHÁCH TỪ HÓA ĐƠN
  const handleSaveCustomerInfo = async () => {
    if (!selectedInvoice || !selectedInvoice.customers?.id) return;
    try {
      await supabase.from('customers').update({
        name: selectedInvoice.customers.name,
        phone: selectedInvoice.customers.phone,
        address: selectedInvoice.customers.address
      }).eq('id', selectedInvoice.customers.id);
      
      alert("Đã cập nhật thông tin khách hàng vào hệ thống thành công!");
      fetchOrders(); 
    } catch (error) {
      alert("Lỗi khi lưu thông tin!");
    }
  }

  const getStatusColor = (status: string) => {
    if (status === 'Hoàn tất') return 'bg-green-100 text-green-700'
    if (status === 'Đang giao') return 'bg-blue-100 text-blue-700'
    if (status === 'Đã giao - Còn nợ') return 'bg-yellow-100 text-yellow-700'
    return 'bg-gray-100 text-gray-700'
  }

  // XUẤT EXCEL KÈM PHÂN LOẠI & ĐỘ ẨM
  const handleExportExcel = () => {
    const exportData = orders.map((o, index) => ({
      "STT": index + 1,
      "Mã Đơn": `DD-${o.id.slice(0, 6).toUpperCase()}`,
      "Ngày chốt": new Date(o.created_at).toLocaleDateString('vi-VN'),
      "Khách hàng": o.customers?.name,
      "Điện thoại": o.customers?.phone,
      "Địa chỉ giao": o.customers?.address || '',
      "Mã Lô Xuất": o.batches?.batch_code?.replace(',', '') || '',
      "Phân loại hàng": o.grade_type || 'Xô',
      "Độ ẩm khách báo (%)": o.moisture_level || 0,
      "Số Kg Yến": Number(o.weight).toFixed(3),
      "Tổng Tiền Khách Trả": Number(o.revenue).toLocaleString('vi-VN'), 
      "Thuế 5%": Number(o.tax_amount || 0).toLocaleString('vi-VN'),
      "Phí Ship": Number(o.shipping_fee || 0).toLocaleString('vi-VN'),
      "Hao hụt (Kg)": Number(o.weight_loss || 0).toFixed(3),
      "Lợi Nhuận Ròng": Number(o.profit).toLocaleString('vi-VN'),
      "Trạng thái": o.status,
      "Ghi chú": o.note || ''
    }))

    const worksheet = XLSX.utils.json_to_sheet(exportData)

    const wscols = [
      { wch: 5 }, { wch: 15 }, { wch: 12 }, { wch: 20 }, { wch: 15 }, 
      { wch: 35 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, 
      { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 20 }, 
      { wch: 15 }, { wch: 20 }
    ];
    worksheet['!cols'] = wscols;

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Danh_Sach_Don_Hang")
    XLSX.writeFile(workbook, `Bao_Cao_Doanh_Thu_DDPRIME_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.xlsx`)
  }

  const filteredOrders = orders.filter(o => 
    o.customers?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    o.customers?.phone?.includes(searchTerm) ||
    o.batches?.batch_code?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) return <div className="p-10 font-black text-gray-400 animate-pulse text-center uppercase tracking-widest">ĐANG TẢI ĐƠN HÀNG ĐOÀN QUYÊN...</div>

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen animate-in fade-in max-w-7xl mx-auto pb-20">
      
      {/* CSS DÀNH CHO IN ẤN */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          #invoice-print-area, #invoice-print-area * { visibility: visible; }
          #invoice-print-area { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none; margin: 0; padding: 20px; }
          .no-print { display: none !important; }
          input { border: none !important; background: transparent !important; padding: 0 !important; color: inherit !important; }
        }
      `}} />

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-900 text-white p-8 rounded-[40px] shadow-2xl gap-6 no-print">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
             <Package size={32} className="text-blue-400"/> Quản lý Đơn hàng
          </h1>
          <p className="text-gray-400 font-bold mt-1 uppercase text-[10px] tracking-widest">Kiểm soát Hao hụt, Thuế & Xuất hóa đơn</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button onClick={handleExportExcel} className="flex-1 md:flex-none bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-4 rounded-2xl font-black shadow-lg shadow-emerald-500/30 transition-all flex items-center justify-center gap-2 uppercase text-xs">
            <FileSpreadsheet size={18}/> Xuất Excel
          </button>
          <Link href="/dashboard/orders/new" className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-500 text-white px-6 py-4 rounded-2xl font-black shadow-lg shadow-blue-500/30 transition-all flex items-center justify-center gap-2 uppercase text-xs">
            <PlusCircle size={18}/> Lên đơn mới
          </Link>
        </div>
      </div>

      {/* TÌM KIẾM */}
      <div className="bg-white p-4 rounded-3xl border border-gray-200 shadow-sm flex items-center gap-3 no-print">
        <Search className="text-gray-400 ml-2" size={20} />
        <input 
          placeholder="Tìm theo tên khách, SĐT hoặc Mã Lô..." 
          className="w-full bg-transparent outline-none font-bold text-gray-700"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* DANH SÁCH */}
      <div className="grid gap-6 no-print">
        {filteredOrders.map((order) => {
          const orderDateValue = new Date(order.created_at).toLocaleDateString('vi-VN');
          const lossMoney = Number(order.weight_loss || 0) * (Number(order.cost) / Number(order.weight));

          return (
            <div key={order.id} className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm flex flex-col gap-6 hover:shadow-xl transition-all group relative">
              <div className="flex flex-col lg:flex-row justify-between gap-6">
                
                {/* CỘT 1: KHÁCH HÀNG & MÃ LÔ */}
                <div className="flex gap-4 items-start w-full lg:w-1/4">
                  <div className="bg-blue-50 border border-blue-100 p-3 rounded-2xl flex flex-col items-center justify-center min-w-[100px]">
                    <span className="text-[10px] font-black text-blue-400 uppercase mb-1">Ngày bán</span>
                    <span className="text-blue-700 font-black text-sm">{orderDateValue}</span>
                  </div>
                  <div className="space-y-2 overflow-hidden">
                    <p className="font-black text-2xl text-gray-900 truncate tracking-tight">{order.customers?.name}</p>
                    <div className="flex flex-wrap gap-2">
                      <select 
                        value={order.status} 
                        onChange={(e) => updateStatus(order.id, e.target.value)} 
                        className={`text-[10px] px-3 py-1.5 rounded-full font-black uppercase outline-none cursor-pointer ${getStatusColor(order.status)}`}
                      >
                        <option>Chưa giao</option>
                        <option>Đang giao</option>
                        <option>Đã giao - Còn nợ</option>
                        <option>Hoàn tất</option>
                      </select>
                      {order.batches?.batch_code && (
                        <span className="bg-purple-600 text-white text-[10px] px-3 py-1.5 rounded-full font-black flex items-center gap-1 shadow-sm uppercase">
                          <Package size={12}/> Lô: {order.batches.batch_code}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* CỘT 2: KHỐI LƯỢNG - ĐỘ ẨM - HAO HỤT */}
                <div className="w-full lg:w-1/3 bg-orange-50/30 p-5 rounded-3xl border border-orange-100 space-y-3">
                  <div className="flex justify-between items-center text-sm font-bold text-gray-700 border-b border-orange-100 pb-2">
                    <span className="flex items-center gap-2 uppercase tracking-widest text-[10px]"><Package size={16} className="text-orange-500"/> Trọng lượng & Phân loại:</span>
                    <span className="text-gray-900 font-black bg-white px-3 py-1 rounded-lg border border-gray-200">
                      {Number(order.weight).toFixed(3)} kg <span className="text-xs text-orange-500 uppercase ml-1">({order.grade_type || 'Xô'})</span>
                    </span>
                  </div>
                  
                  {/* Ô NHẬP ĐỘ ẨM KHÁCH BÁO */}
                  <div className="flex justify-between items-center text-sm font-bold text-blue-600">
                    <span className="flex items-center gap-2"><Droplet size={16}/> Độ ẩm khách báo (%):</span>
                    <input 
                      type="number" 
                      defaultValue={order.moisture_level || ''} 
                      placeholder="0" 
                      onBlur={(e) => updateFinancials(order, 'moisture_level', e.target.value)} 
                      className="w-16 text-right bg-white border border-blue-100 rounded-lg p-1 outline-none font-black text-blue-600 focus:border-blue-400"
                    />
                  </div>

                  <div className="flex justify-between items-center text-sm font-bold text-red-600">
                    <span className="flex items-center gap-2"><Scale size={16}/> Ký hao hụt (Kg):</span>
                    <input 
                      type="number" 
                      step="0.001" 
                      defaultValue={order.weight_loss || ''} 
                      placeholder="0" 
                      onBlur={(e) => updateFinancials(order, 'weight_loss', e.target.value)} 
                      className="w-20 text-right bg-white border border-red-100 rounded-lg p-1 outline-none font-black text-red-600 focus:border-red-400"
                    />
                  </div>
                  {lossMoney > 0 && <p className="text-[10px] font-black text-red-400 text-right italic">Thất thoát vốn: -{lossMoney.toLocaleString('vi-VN')}đ</p>}
                </div>

                {/* CỘT 3: TÀI CHÍNH */}
                <div className="w-full lg:w-1/3 bg-blue-50/20 p-5 rounded-3xl border border-blue-50 space-y-2">
                  <div className="flex justify-between text-sm font-bold text-gray-500">
                    <span>Tổng khách trả:</span>
                    <span className="text-gray-900">{Number(order.revenue).toLocaleString('vi-VN')}đ</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-red-400">
                    <span>Thuế VAT (5%):</span>
                    <span>-{Number(order.tax_amount || 0).toLocaleString('vi-VN')}đ</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-purple-600 items-center">
                    <span>Phí ship:</span>
                    <div className="flex items-center gap-1">
                      <span>-</span>
                      <input 
                        type="number" 
                        defaultValue={order.shipping_fee || ''} 
                        onBlur={(e) => updateFinancials(order, 'shipping_fee', e.target.value)} 
                        className="w-20 text-right bg-transparent border-b border-purple-200 outline-none font-black text-purple-600 focus:border-purple-500"
                      />
                      <span>đ</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center border-t border-blue-100 pt-3 mt-2">
                    <span className="text-gray-900 font-black uppercase text-[10px] tracking-widest">Lợi nhuận ròng:</span>
                    <span className="font-black text-blue-600 text-2xl tracking-tighter">+{Number(order.profit).toLocaleString('vi-VN')}đ</span>
                  </div>
                </div>

                {/* BỘ NÚT */}
                <div className="flex flex-row lg:flex-col gap-2 justify-end w-full lg:w-auto pt-4 lg:pt-0 border-t lg:border-t-0 border-gray-100">
                    <button onClick={() => setSelectedInvoice(order)} className="flex-1 lg:flex-none bg-gray-900 hover:bg-black text-white p-4 rounded-2xl flex items-center justify-center gap-2 transition-colors shadow-md" title="In Hóa Đơn">
                        <Printer size={20} /> <span className="text-xs font-black uppercase lg:hidden">In Bill</span>
                    </button>
                    <button onClick={() => deleteOrder(order.id)} className="p-4 bg-red-50 text-red-400 hover:text-red-600 hover:bg-red-100 rounded-2xl transition-all flex items-center justify-center" title="Xóa Đơn">
                        <Trash2 size={20} />
                    </button>
                </div>
              </div>
            </div>
          )
        })}

        {filteredOrders.length === 0 && orders.length > 0 && (
          <div className="text-center py-20 text-gray-400 font-bold uppercase tracking-widest border-2 border-dashed border-gray-200 rounded-[40px] bg-white">
            Không tìm thấy đơn hàng phù hợp
          </div>
        )}
      </div>

      {/* --- MODAL HÓA ĐƠN PDF --- */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm no-print">
          <div className="bg-white w-full max-w-2xl max-h-[95vh] overflow-y-auto rounded-[30px] shadow-2xl relative flex flex-col">
            
            <div className="sticky top-0 bg-white/90 backdrop-blur-md p-4 border-b flex justify-between items-center z-10 rounded-t-[30px]">
               <h3 className="font-black uppercase tracking-widest text-xs text-gray-500">Sửa & In Hóa Đơn</h3>
               <div className="flex gap-2">
                 <button onClick={handleSaveCustomerInfo} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-black text-xs uppercase shadow-md flex items-center gap-2" title="Lưu thông tin vừa sửa vào hệ thống">
                    <Save size={16}/> Lưu Thông Tin
                 </button>
                 <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-black text-xs uppercase shadow-lg shadow-blue-500/30 flex items-center gap-2">
                    <Printer size={16}/> IN RA A4
                 </button>
                 <button onClick={() => setSelectedInvoice(null)} className="bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-500 p-2 rounded-xl transition-colors">
                    <X size={20}/>
                 </button>
               </div>
            </div>

            <div id="invoice-print-area" className="p-10 bg-white text-gray-900 w-full font-sans">
                <div className="flex justify-between items-start border-b-2 border-gray-900 pb-6 mb-8">
                   <div>
                      <h1 className="text-3xl font-black tracking-tighter uppercase mb-1">CÔNG TY TNHH TMDV ĐOÀN QUYÊN</h1>
                      <p className="text-xs font-bold text-gray-500 tracking-widest mb-1">HỆ THỐNG YẾN SÀO CAO CẤP ĐOÀN QUYÊN</p>
                      <p className="text-xs text-gray-600 mt-2"><span className="font-bold">Địa chỉ:</span> Số 290, Ấp Bình Phong Thạnh 2, Xã Mộc Hóa, Tỉnh Tây Ninh, Việt Nam</p>
                      <p className="text-xs text-gray-600"><span className="font-bold">Điện thoại:</span> 084.2304.158</p>
                   </div>
                   <div className="text-right">
                      <h2 className="text-2xl font-black uppercase text-blue-600 tracking-widest mb-2">HÓA ĐƠN BÁN HÀNG</h2>
                      <p className="text-xs font-bold text-gray-600"><span className="uppercase text-gray-400">Mã Đơn:</span> DD-{selectedInvoice.id.slice(0, 8).toUpperCase()}</p>
                      <p className="text-xs font-bold text-gray-600"><span className="uppercase text-gray-400">Ngày xuất:</span> {new Date(selectedInvoice.created_at).toLocaleDateString('vi-VN')}</p>
                   </div>
                </div>

                <div className="mb-8 p-5 bg-gray-50 rounded-2xl border border-gray-100">
                   <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 flex items-center justify-between">
                     <span>Thông tin khách hàng</span>
                     <span className="text-blue-500 lowercase no-print">(*Click vào chữ để sửa*)</span>
                   </h3>
                   <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-500 whitespace-nowrap">Họ và tên:</span> 
                        <input 
                          value={selectedInvoice.customers?.name || ''} 
                          onChange={e => setSelectedInvoice({...selectedInvoice, customers: {...selectedInvoice.customers, name: e.target.value}})}
                          className="font-black text-gray-900 bg-transparent border-b border-dashed border-gray-300 outline-none w-full hover:bg-white px-1 transition-colors"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-500 whitespace-nowrap">Điện thoại:</span> 
                        <input 
                          value={selectedInvoice.customers?.phone || ''} 
                          onChange={e => setSelectedInvoice({...selectedInvoice, customers: {...selectedInvoice.customers, phone: e.target.value}})}
                          className="font-black text-gray-900 bg-transparent border-b border-dashed border-gray-300 outline-none w-full hover:bg-white px-1 transition-colors"
                        />
                      </div>
                      <div className="col-span-2 flex items-center gap-2">
                        <span className="font-bold text-gray-500 whitespace-nowrap">Địa chỉ:</span> 
                        <input 
                          value={selectedInvoice.customers?.address || ''} 
                          onChange={e => setSelectedInvoice({...selectedInvoice, customers: {...selectedInvoice.customers, address: e.target.value}})}
                          className="font-bold text-gray-900 bg-transparent border-b border-dashed border-gray-300 outline-none w-full hover:bg-white px-1 transition-colors"
                        />
                      </div>
                   </div>
                </div>

                <table className="w-full text-left mb-8 border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-900 text-xs font-black uppercase text-gray-600">
                      <th className="py-3 px-2">STT</th>
                      <th className="py-3 px-2">Tên sản phẩm</th>
                      <th className="py-3 px-2 text-center">Phân loại</th>
                      <th className="py-3 px-2 text-right">Mã Lô</th>
                      <th className="py-3 px-2 text-right">Số lượng (Kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-200 text-sm font-bold">
                      <td className="py-4 px-2">1</td>
                      <td className="py-4 px-2">Yến sào nguyên chất ĐOÀN QUYÊN</td>
                      <td className="py-4 px-2 text-center text-orange-600 uppercase text-xs">{selectedInvoice.grade_type || 'Xô'}</td>
                      <td className="py-4 px-2 text-right text-gray-500">{selectedInvoice.batches?.batch_code || '---'}</td>
                      <td className="py-4 px-2 text-right">{Number(selectedInvoice.weight).toFixed(3)}</td>
                    </tr>
                  </tbody>
                </table>

                <div className="flex justify-end mb-16">
                   <div className="w-full max-w-sm space-y-3">
                      {Number(selectedInvoice.shipping_fee) > 0 && (
                        <div className="flex justify-between text-xs font-bold text-gray-500 border-b pb-2">
                           <span className="uppercase tracking-widest">Phí vận chuyển:</span>
                           <span>{Number(selectedInvoice.shipping_fee).toLocaleString('vi-VN')} đ</span>
                        </div>
                      )}
                      {Number(selectedInvoice.tax_amount) > 0 && (
                        <div className="flex justify-between text-xs font-bold text-gray-500 border-b pb-2">
                           <span className="uppercase tracking-widest">Thuế GTGT (5%):</span>
                           <span>Đã bao gồm</span>
                        </div>
                      )}
                      <div className="flex justify-between items-end border-b-2 border-gray-900 pb-2">
                         <span className="text-sm font-black uppercase tracking-widest text-gray-900">Tổng thanh toán:</span>
                         <span className="text-2xl font-black text-blue-600">{Number(selectedInvoice.revenue).toLocaleString('vi-VN')} VNĐ</span>
                      </div>
                      <p className="text-[10px] text-gray-400 italic text-right">* Giá trên đã bao gồm các loại thuế, phí liên quan theo quy định.</p>
                   </div>
                </div>

                <div className="grid grid-cols-2 text-center pt-8">
                   <div>
                      <p className="font-black text-sm uppercase mb-24">Khách hàng</p>
                      <p className="text-xs text-gray-400 italic">(Ký & ghi rõ họ tên)</p>
                   </div>
                   <div>
                      <p className="font-black text-sm uppercase mb-24">Đại diện YẾN SÀO ĐOÀN QUYÊN</p>
                      <p className="text-xs font-black uppercase">{selectedInvoice.status === 'Hoàn tất' ? 'ĐÃ THU TIỀN' : ''}</p>
                   </div>
                </div>
                
                <div className="mt-20 pt-4 border-t border-gray-200 text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cảm ơn quý khách đã tin dùng sản phẩm của hệ thống Yến sào ĐOÀN QUYÊN!</p>
                </div>
            </div>
            
          </div>
        </div>
      )}

    </div>
  )
}
'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  MapPin, Phone, UserCircle2, PlusCircle, Trash2, Pencil, 
  History, Search, MessageCircle, AlertTriangle, CheckCircle2, Factory, CalendarClock
} from 'lucide-react'

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [batches, setBatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('All')

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  const [form, setForm] = useState({
    name: '', phone: '', address: '', personality: '', 
    status: 'Đang hợp tác', last_contact_date: new Date().toISOString().split('T')[0]
  })

  // Khóa an toàn chống chạy hàm đồng bộ 2 lần liên tiếp gây trùng lặp
  const hasSynced = useRef(false);

  const fetchData = async () => {
    setLoading(true)
    
    // Lấy dữ liệu từ Kho
    const { data: batchData } = await supabase.from('batches').select('batch_code, supplier_name, total_weight, purchase_date')
    
    // Lấy dữ liệu từ Sổ Trạm Yến (Ưu tiên lấy thằng tạo cũ nhất lên đầu để giữ lại, xóa mấy thằng đẻ sau)
    const { data: supData } = await supabase.from('suppliers').select('*').order('created_at', { ascending: true })

    if (batchData && supData) {
       // =================================================================
       // 1. CỖ MÁY DỌN RÁC (TỰ ĐỘNG XÓA TRÙNG LẶP TRONG DATABASE)
       // =================================================================
       const uniqueNames = new Set();
       const duplicateIdsToDelete: string[] = [];
       const cleanSuppliers: any[] = [];

       supData.forEach(sup => {
          const nameKey = sup.name?.trim().toLowerCase();
          if (nameKey && !uniqueNames.has(nameKey)) {
             uniqueNames.add(nameKey);
             cleanSuppliers.push(sup); // Chỉ giữ lại bản gốc
          } else {
             duplicateIdsToDelete.push(sup.id); // Gom ID của mấy bản sao để đem đi hủy
          }
       });

       // Lệnh trảm: Âm thầm xóa vĩnh viễn các bản sao bị lặp dưới Két sắt Supabase
       if (duplicateIdsToDelete.length > 0) {
           await supabase.from('suppliers').delete().in('id', duplicateIdsToDelete);
       }

       // =================================================================
       // 2. AUTO-SYNC TỪ KHO SANG (ĐÃ KHÓA AN TOÀN)
       // =================================================================
       if (!hasSynced.current) {
           hasSynced.current = true; // Khóa lại ngay
           
           const namesInBatches = [...new Set(batchData.map(b => b.supplier_name?.trim()).filter(name => name && name !== 'N/A' && name !== ''))];
           const namesInSuppliers = cleanSuppliers.map(s => s.name?.trim().toLowerCase());

           const missingNames = namesInBatches.filter(name => !namesInSuppliers.includes(name.toLowerCase()));

           if (missingNames.length > 0) {
               const insertData = missingNames.map(name => ({
                   name: name,
                   status: 'Đang hợp tác',
                   last_contact_date: new Date().toISOString().split('T')[0] 
               }));
               
               await supabase.from('suppliers').insert(insertData);
               
               // Load lại data sạch sẽ lần cuối
               const { data: finalData } = await supabase.from('suppliers').select('*').order('last_contact_date', { ascending: true });
               if (finalData) {
                   // Bộ lọc hiển thị (đề phòng)
                   const finalUnique = Array.from(new Map(finalData.map(item => [item.name.toLowerCase().trim(), item])).values());
                   setSuppliers(finalUnique);
               }
           } else {
               // Sắp xếp lại danh sách sạch theo ngày để hiển thị
               cleanSuppliers.sort((a, b) => {
                   const dateA = a.last_contact_date ? new Date(a.last_contact_date).getTime() : 0;
                   const dateB = b.last_contact_date ? new Date(b.last_contact_date).getTime() : 0;
                   return dateA - dateB;
               });
               setSuppliers(cleanSuppliers);
           }
       } else {
           // Nếu đã sync rồi thì chỉ hiển thị danh sách sạch
           cleanSuppliers.sort((a, b) => {
               const dateA = a.last_contact_date ? new Date(a.last_contact_date).getTime() : 0;
               const dateB = b.last_contact_date ? new Date(b.last_contact_date).getTime() : 0;
               return dateA - dateB;
           });
           setSuppliers(cleanSuppliers);
       }
    }
    
    if (batchData) setBatches(batchData);
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    if (editingId) {
      await supabase.from('suppliers').update(form).eq('id', editingId)
    } else {
      // Trước khi thêm bằng tay, check xem có bị trùng không
      const isExist = suppliers.some(s => s.name.toLowerCase().trim() === form.name.toLowerCase().trim());
      if (isExist) {
          alert("Trạm yến này đã có trong danh bạ rồi Sếp ơi!");
          setLoading(false);
          return;
      }
      await supabase.from('suppliers').insert([form])
    }
    setForm({ name: '', phone: '', address: '', personality: '', status: 'Đang hợp tác', last_contact_date: new Date().toISOString().split('T')[0] })
    setEditingId(null)
    setShowForm(false)
    fetchData()
  }

  const openEdit = (sup: any) => {
    setForm({
      name: sup.name, phone: sup.phone || '', address: sup.address || '', 
      personality: sup.personality || '', status: sup.status, 
      last_contact_date: sup.last_contact_date || new Date().toISOString().split('T')[0]
    })
    setEditingId(sup.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (window.confirm("Xóa nhà yến này khỏi danh bạ?")) {
      await supabase.from('suppliers').delete().eq('id', id)
      fetchData()
    }
  }

  const updateContactDate = async (id: string) => {
    const today = new Date().toISOString().split('T')[0];
    await supabase.from('suppliers').update({ last_contact_date: today }).eq('id', id);
    fetchData();
  }

  // Thuật toán: Cảnh báo nếu > 14 ngày chưa gọi điện
  const checkNeedsContact = (dateStr: string) => {
    if (!dateStr) return true;
    const lastDate = new Date(dateStr);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - lastDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 14; 
  }

  const filteredSuppliers = suppliers.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || (s.phone && s.phone.includes(searchTerm)) || (s.address && s.address.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchStatus = filterStatus === 'All' ? true : s.status === filterStatus;
    return matchSearch && matchStatus;
  })

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 bg-gray-50 min-h-screen animate-in fade-in max-w-7xl mx-auto pb-24">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-900 p-6 md:p-8 rounded-[24px] md:rounded-[30px] shadow-xl text-white gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black uppercase flex items-center gap-3">
             <Factory size={28} className="text-emerald-400"/> Sổ Trạm Yến
          </h1>
          <p className="text-gray-400 text-xs md:text-sm mt-1 font-medium">Quản lý nguồn nhập, nhắc nhở lịch hái yến định kỳ.</p>
        </div>
        <button onClick={() => {setShowForm(!showForm); setEditingId(null); setForm({ name: '', phone: '', address: '', personality: '', status: 'Đang hợp tác', last_contact_date: new Date().toISOString().split('T')[0] })}} className="w-full md:w-auto bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2">
          {showForm ? 'Đóng form' : <><PlusCircle size={18}/> Thêm Trạm Yến</>}
        </button>
      </div>

      {/* FILTER & TÌM KIẾM */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
         <div className="flex bg-gray-100 p-1 rounded-xl w-full md:w-auto font-bold text-sm">
            <button onClick={() => setFilterStatus('All')} className={`flex-1 md:flex-none px-6 py-2 rounded-lg transition-all ${filterStatus === 'All' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500'}`}>Tất cả</button>
            <button onClick={() => setFilterStatus('Đang hợp tác')} className={`flex-1 md:flex-none px-6 py-2 rounded-lg transition-all ${filterStatus === 'Đang hợp tác' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500'}`}>Đang thu mua</button>
            <button onClick={() => setFilterStatus('Tiềm năng')} className={`flex-1 md:flex-none px-6 py-2 rounded-lg transition-all ${filterStatus === 'Tiềm năng' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500'}`}>Nhà mới (Tiềm năng)</button>
         </div>
         <div className="flex w-full md:w-1/3 bg-gray-50 rounded-xl px-4 py-2 border border-gray-200 focus-within:border-emerald-400 transition-colors">
            <Search className="text-gray-400 mr-2 mt-0.5" size={18}/>
            <input placeholder="Tìm tên cô chú, SĐT, địa chỉ..." className="bg-transparent w-full outline-none font-medium text-gray-700" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
         </div>
      </div>

      {/* FORM THÊM / SỬA */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-[24px] border border-emerald-100 shadow-lg space-y-5 animate-in slide-in-from-top-4">
          <div className="flex items-center gap-2 border-b pb-3 mb-4">
             <UserCircle2 className="text-emerald-500"/>
             <h3 className="font-black text-lg text-gray-800">{editingId ? 'Sửa thông tin Nhà Yến' : 'Thêm Nhà Yến / Mối buôn mới'}</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">Tên cô chú / Trạm yến</label>
              <input required placeholder="VD: Chú Bảy - Mộc Hóa" className="w-full border rounded-xl p-3 font-semibold focus:border-emerald-500 outline-none" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">Số điện thoại (Zalo)</label>
              <input placeholder="09xxxx..." className="w-full border rounded-xl p-3 font-semibold focus:border-emerald-500 outline-none" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">Tình trạng</label>
              <select className="w-full border rounded-xl p-3 font-bold focus:border-emerald-500 outline-none" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                <option value="Đang hợp tác">Đã từng mua (Đang hợp tác)</option>
                <option value="Tiềm năng">Chưa mua (Tiềm năng)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">Ngày gọi gần nhất</label>
              <input type="date" className="w-full border rounded-xl p-3 font-semibold focus:border-emerald-500 outline-none" value={form.last_contact_date} onChange={e => setForm({...form, last_contact_date: e.target.value})} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
               <label className="text-xs font-bold text-gray-500 mb-1 block">Địa chỉ nhà yến</label>
               <input placeholder="VD: Gần chợ Tân Thạnh..." className="w-full border rounded-xl p-3 font-semibold focus:border-emerald-500 outline-none" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
            </div>
            <div>
               <label className="text-xs font-bold text-purple-500 mb-1 block">Ghi chú Tính Cách / Thói quen</label>
               <input placeholder="VD: Khó tính, hay đòi ép giá, hái yến vào giữa tháng..." className="w-full border border-purple-200 bg-purple-50/30 rounded-xl p-3 font-semibold text-purple-800 focus:border-purple-500 outline-none" value={form.personality} onChange={e => setForm({...form, personality: e.target.value})} />
            </div>
          </div>
          
          <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-black shadow-md w-full md:w-auto transition-colors">
            {editingId ? 'CẬP NHẬT THÔNG TIN' : 'LƯU VÀO DANH BẠ'}
          </button>
        </form>
      )}

      {/* DANH SÁCH NHÀ YẾN CHÍNH */}
      {loading ? <div className="text-center font-bold text-gray-400 py-10 animate-pulse">ĐANG TẢI & DỌN DẸP DANH BẠ NHÀ YẾN...</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSuppliers.map(sup => {
            const needsContact = checkNeedsContact(sup.last_contact_date);
            // Tìm lịch sử mua của người này trong bảng Kho (batches)
            const boughtBatches = batches.filter(b => b.supplier_name && b.supplier_name.toLowerCase().includes(sup.name.toLowerCase()));
            const totalKgBought = boughtBatches.reduce((sum, b) => sum + Number(b.total_weight || 0), 0);

            return (
              <div key={sup.id} className={`bg-white rounded-[24px] border ${needsContact ? 'border-red-300 shadow-red-100/50' : 'border-gray-200'} shadow-sm overflow-hidden flex flex-col relative`}>
                
                {/* BADGE BÁO ĐỘNG GỌI ĐIỆN */}
                {needsContact ? (
                   <div className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-black uppercase px-3 py-1.5 rounded-bl-xl flex items-center gap-1 shadow-sm animate-pulse">
                     <AlertTriangle size={12}/> Đã Hơn 14 Ngày Chưa Gọi!
                   </div>
                ) : (
                   <div className="absolute top-0 right-0 bg-gray-100 text-gray-500 text-[9px] font-bold uppercase px-3 py-1.5 rounded-bl-xl flex items-center gap-1">
                     <CheckCircle2 size={12}/> Đã liên hệ gần đây
                   </div>
                )}

                <div className="p-5 flex-1">
                   <div className="flex items-start justify-between mb-3 mt-2">
                      <div>
                         <h3 className="text-xl font-black text-gray-900">{sup.name}</h3>
                         <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md mt-1 inline-block ${sup.status === 'Tiềm năng' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>
                           {sup.status}
                         </span>
                      </div>
                      <div className="flex gap-1 opacity-100 lg:opacity-50 hover:opacity-100 transition-opacity">
                         <button onClick={() => openEdit(sup)} className="p-1.5 bg-gray-100 text-blue-600 rounded-lg"><Pencil size={14}/></button>
                         <button onClick={() => handleDelete(sup.id)} className="p-1.5 bg-gray-100 text-red-500 rounded-lg"><Trash2 size={14}/></button>
                      </div>
                   </div>

                   <div className="space-y-2 mt-4 text-sm font-medium text-gray-600">
                      <p className="flex items-start gap-2"><Phone size={16} className="text-blue-400 mt-0.5 shrink-0"/> {sup.phone || 'Chưa lưu SĐT (Bấm sửa để thêm)'}</p>
                      <p className="flex items-start gap-2"><MapPin size={16} className="text-red-400 mt-0.5 shrink-0"/> {sup.address || 'Chưa rõ địa chỉ (Bấm sửa để thêm)'}</p>
                      {sup.personality && (
                         <div className="bg-purple-50 border border-purple-100 p-2 rounded-lg mt-2 text-purple-800 text-xs flex items-start gap-2">
                            <span className="font-black shrink-0">Tính cách:</span> {sup.personality}
                         </div>
                      )}
                   </div>

                   {/* KHỐI LỊCH SỬ THU MUA RÚT GỌN */}
                   {sup.status === 'Đang hợp tác' && (
                     <div className="mt-4 pt-4 border-t border-gray-100 border-dashed">
                        <div className="flex justify-between items-end mb-2">
                           <p className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1"><History size={12}/> Lịch sử thu mua</p>
                           <p className="text-xs font-black text-emerald-600">Tổng: {totalKgBought.toFixed(2)} kg</p>
                        </div>
                        {boughtBatches.length > 0 ? (
                           <div className="max-h-24 overflow-y-auto space-y-1 custom-scrollbar pr-1">
                              {boughtBatches.map((b, idx) => (
                                 <div key={idx} className="flex justify-between items-center bg-gray-50 px-2 py-1.5 rounded-md text-xs">
                                    <span className="font-bold text-gray-700">{b.batch_code} <span className="font-normal text-[10px] text-gray-400">({new Date(b.purchase_date).toLocaleDateString('vi-VN')})</span></span>
                                    <span className="font-bold">{Number(b.total_weight).toFixed(2)}kg</span>
                                 </div>
                              ))}
                           </div>
                        ) : (
                           <p className="text-[10px] text-gray-400 italic">Chưa có dữ liệu lô hàng khớp tên trên Kho.</p>
                        )}
                     </div>
                   )}
                </div>

                {/* HÀNG NÚT BẤM (GỌI / ZALO / LÀM MỚI NGÀY) */}
                <div className="grid grid-cols-3 gap-0 border-t border-gray-200 bg-gray-50/50">
                   <a href={`tel:${sup.phone}`} className="flex flex-col items-center justify-center p-3 text-blue-600 hover:bg-blue-50 transition-colors border-r border-gray-200">
                      <Phone size={18} className="mb-1"/>
                      <span className="text-[9px] font-black uppercase tracking-widest">Gọi Điện</span>
                   </a>
                   <a href={`https://zalo.me/${sup.phone}`} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center p-3 text-indigo-600 hover:bg-indigo-50 transition-colors border-r border-gray-200">
                      <MessageCircle size={18} className="mb-1"/>
                      <span className="text-[9px] font-black uppercase tracking-widest">Nhắn Zalo</span>
                   </a>
                   <button onClick={() => updateContactDate(sup.id)} className="flex flex-col items-center justify-center p-3 text-emerald-600 hover:bg-emerald-50 transition-colors" title="Đánh dấu là hôm nay đã gọi điện thăm hỏi">
                      <CalendarClock size={18} className="mb-1"/>
                      <span className="text-[9px] font-black uppercase tracking-widest">Đã Liên Hệ</span>
                   </button>
                </div>

              </div>
            )
          })}
          
          {filteredSuppliers.length === 0 && (
             <div className="col-span-full py-20 text-center border-2 border-dashed border-gray-200 rounded-[30px] bg-white text-gray-400 font-bold">
                Chưa có dữ liệu trạm yến nào. Hãy bấm "Thêm Trạm Yến" hoặc nhập kho mới để hệ thống tự đồng bộ!
             </div>
          )}
        </div>
      )}
    </div>
  )
}
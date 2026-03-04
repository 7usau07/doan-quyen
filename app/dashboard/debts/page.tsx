'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  Landmark, Users, HandCoins, History, X, PlusCircle, 
  Wallet, CheckCircle2, AlertCircle, CalendarClock, ArrowRightLeft,
  Pencil, Trash2, ArrowRightCircle
} from 'lucide-react'

export default function DebtsPage() {
  const [debts, setDebts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // Modals
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedPerson, setSelectedPerson] = useState<any>(null) // Modal liệt kê chi tiết từng món nợ của 1 người
  const [paymentModal, setPaymentModal] = useState<any>(null) // Modal Ghi chép thanh toán
  const [editingDebt, setEditingDebt] = useState<any>(null)

  // FORM TẠO MỚI
  const [form, setForm] = useState({
    target_name: '', debt_type: 'vay_vao', item_type: 'tien',
    total_amount: '', interest_day: '', interest_amount: '', note: '', start_date: new Date().toISOString().split('T')[0]
  })

  // FORM SỬA
  const [editForm, setEditForm] = useState({
    target_name: '', debt_type: 'vay_vao', item_type: 'tien',
    total_amount: '', interest_day: '', interest_amount: '', note: '', start_date: ''
  })

  // FORM GHI CHÉP
  const [payForm, setPayForm] = useState({
    amount: '', transaction_type: 'tra_goc', transaction_date: new Date().toISOString().split('T')[0], note: ''
  })

  const fetchDebts = async () => {
    setLoading(true)
    const { data } = await supabase.from('debts').select('*, debt_transactions(*)').order('created_at', { ascending: false })
    if (data) setDebts(data)
    setLoading(false)
  }

  useEffect(() => { fetchDebts() }, [])

  // THUẬT TOÁN GỘP CÔNG NỢ THEO TÊN VÀ LOẠI
  const groupedDebts = useMemo(() => {
    const groups: Record<string, any> = {}
    
    debts.forEach(d => {
      const rawName = d.target_name || 'Không tên'
      const nameKey = rawName.trim().toLowerCase()
      // Gom theo Tên + Loại (Vay / Cho vay) + Loại tài sản (Tiền / Yến)
      const groupKey = `${nameKey}_${d.debt_type}_${d.item_type}` 

      if (!groups[groupKey]) {
        groups[groupKey] = {
          groupKey,
          displayName: rawName.trim(),
          debt_type: d.debt_type,
          item_type: d.item_type,
          totalOriginal: 0,
          totalRemaining: 0,
          items: [] 
        }
      }
      
      groups[groupKey].totalOriginal += Number(d.total_amount || 0)
      groups[groupKey].totalRemaining += Number(d.remaining_amount || 0)
      groups[groupKey].items.push(d)
    })

    // Sắp xếp: Ai còn nợ nhiều đưa lên đầu
    return Object.values(groups).sort((a, b) => b.totalRemaining - a.totalRemaining)
  }, [debts])


  // 1. TẠO KHOẢN NỢ MỚI
  const handleAddDebt = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const amount = Number(form.total_amount)
    await supabase.from('debts').insert([{
      target_name: form.target_name, debt_type: form.debt_type, item_type: form.item_type,
      total_amount: amount, remaining_amount: amount, 
      interest_day: form.interest_day ? Number(form.interest_day) : null,
      interest_amount: form.interest_amount ? Number(form.interest_amount) : 0,
      note: form.note,
      start_date: form.start_date || new Date().toISOString()
    }])
    setForm({ target_name: '', debt_type: 'vay_vao', item_type: 'tien', total_amount: '', interest_day: '', interest_amount: '', note: '', start_date: new Date().toISOString().split('T')[0] })
    setShowAddForm(false); fetchDebts()
  }

  // 2. MỞ FORM SỬA KHOẢN NỢ (Bên trong chi tiết Person)
  const openEditModal = (d: any) => {
    setEditingDebt(d);
    setEditForm({
      target_name: d.target_name,
      debt_type: d.debt_type,
      item_type: d.item_type,
      total_amount: d.total_amount.toString(),
      interest_day: d.interest_day ? d.interest_day.toString() : '',
      interest_amount: d.interest_amount ? d.interest_amount.toString() : '',
      note: d.note || '',
      start_date: d.start_date ? new Date(d.start_date).toISOString().split('T')[0] : ''
    });
  }

  // 3. LƯU CẬP NHẬT KHOẢN NỢ
  const handleUpdateDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const newTotal = Number(editForm.total_amount);
    const diff = newTotal - Number(editingDebt.total_amount);
    let newRemaining = Number(editingDebt.remaining_amount) + diff;
    if (newRemaining < 0) newRemaining = 0;

    await supabase.from('debts').update({
      target_name: editForm.target_name,
      debt_type: editForm.debt_type,
      item_type: editForm.item_type,
      total_amount: newTotal,
      remaining_amount: newRemaining,
      interest_day: editForm.interest_day ? Number(editForm.interest_day) : null,
      interest_amount: editForm.interest_amount ? Number(editForm.interest_amount) : 0,
      note: editForm.note,
      start_date: editForm.start_date,
      status: newRemaining <= 0 ? 'hoan_tat' : 'dang_no'
    }).eq('id', editingDebt.id);

    setEditingDebt(null);
    
    // Tắt modal chi tiết người luôn để lấy data mới cho an toàn
    setSelectedPerson(null);
    fetchDebts();
  }

  // 4. XÓA KHOẢN NỢ
  const handleDeleteDebt = async (id: string) => {
    if (confirm("Duy chắc chắn muốn xóa hẳn sổ nợ này không? Mọi lịch sử thu/chi cũng sẽ bị xóa vĩnh viễn!")) {
      setLoading(true);
      await supabase.from('debts').delete().eq('id', id);
      setSelectedPerson(null);
      fetchDebts();
    }
  }

  // 5. TRẢ NỢ / ĐÓNG LÃI
  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const payAmount = Number(payForm.amount)
    
    await supabase.from('debt_transactions').insert([{
      debt_id: paymentModal.id, amount: payAmount, 
      transaction_type: payForm.transaction_type, transaction_date: payForm.transaction_date, note: payForm.note
    }])

    if (payForm.transaction_type === 'tra_goc') {
       const newRemaining = Number(paymentModal.remaining_amount) - payAmount;
       const newStatus = newRemaining <= 0 ? 'hoan_tat' : 'dang_no';
       
       await supabase.from('debts').update({
         remaining_amount: newRemaining < 0 ? 0 : newRemaining,
         status: newStatus
       }).eq('id', paymentModal.id)
    }

    setPayForm({ amount: '', transaction_type: 'tra_goc', transaction_date: new Date().toISOString().split('T')[0], note: '' })
    setPaymentModal(null); 
    setSelectedPerson(null); // Đóng lại để re-fetch cho an toàn
    fetchDebts()
  }

  const myDebts = groupedDebts.filter(g => g.debt_type === 'vay_vao') 
  const othersDebts = groupedDebts.filter(g => g.debt_type === 'cho_vay') 

  const getNextInterestDate = (day: number) => {
    const today = new Date();
    const currentDay = today.getDate();
    const month = currentDay > day ? today.getMonth() + 2 : today.getMonth() + 1;
    const year = month > 12 ? today.getFullYear() + 1 : today.getFullYear();
    const finalMonth = month > 12 ? 1 : month;
    return `Ngày ${day} tháng ${finalMonth}/${year}`;
  }

  if (loading && debts.length === 0) return <div className="p-10 font-black animate-pulse text-gray-400 text-center uppercase tracking-widest text-sm">Đang lật sổ công nợ...</div>

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto pb-24 font-sans bg-gray-50 min-h-screen">
      
      {/* HEADER TỐI ƯU MOBILE */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-900 text-white p-6 md:p-8 rounded-[24px] md:rounded-[40px] shadow-xl gap-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter flex items-center gap-2 md:gap-3"><Landmark size={28} className="text-blue-400"/> Sổ Công Nợ</h1>
          <p className="text-gray-400 font-bold mt-1.5 tracking-widest uppercase text-[10px] md:text-xs">Gộp Nhóm • Kiểm soát gốc & Lãi suất</p>
        </div>
        <button onClick={() => setShowAddForm(!showAddForm)} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 px-5 py-3.5 rounded-xl font-black shadow-md uppercase text-[11px] md:text-xs flex justify-center items-center gap-2 transition-all">
          {showAddForm ? 'Đóng Form' : <><PlusCircle size={16}/> Thêm Khoản Vay</>}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddDebt} className="bg-white p-6 md:p-8 rounded-[24px] md:rounded-[30px] border border-gray-200 shadow-sm space-y-5 animate-in slide-in-from-top-4">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              <div className="space-y-4 bg-gray-50 p-5 rounded-2xl border border-gray-100">
                 <h3 className="font-black text-gray-800 uppercase tracking-tighter border-b border-gray-200 pb-2 text-sm">1. Phân loại</h3>
                 <div className="flex flex-col gap-3">
                    <label className="flex items-center gap-2.5 font-bold cursor-pointer text-red-600 text-sm"><input type="radio" checked={form.debt_type === 'vay_vao'} onChange={() => setForm({...form, debt_type: 'vay_vao'})} className="accent-red-500 w-4 h-4"/> Mình Đi Vay (Nợ người ta)</label>
                    <label className="flex items-center gap-2.5 font-bold cursor-pointer text-blue-600 text-sm"><input type="radio" checked={form.debt_type === 'cho_vay'} onChange={() => setForm({...form, debt_type: 'cho_vay'})} className="accent-blue-500 w-4 h-4"/> Mình Cho Vay (Người ta nợ)</label>
                 </div>
                 <div className="flex gap-4 pt-2 border-t border-dashed border-gray-200 mt-2">
                    <label className="flex items-center gap-2 font-bold cursor-pointer text-gray-600 text-xs"><input type="radio" checked={form.item_type === 'tien'} onChange={() => setForm({...form, item_type: 'tien'})} className="w-3.5 h-3.5"/> VNĐ</label>
                    <label className="flex items-center gap-2 font-bold cursor-pointer text-orange-600 text-xs"><input type="radio" checked={form.item_type === 'yen'} onChange={() => setForm({...form, item_type: 'yen'})} className="w-3.5 h-3.5"/> Yến (Kg)</label>
                 </div>
              </div>

              <div className="space-y-4">
                 <div>
                    <label className="text-[10px] font-black uppercase text-gray-500 ml-1">Đối tác (Ngân hàng / Tên người)</label>
                    <input required placeholder="VD: Sacombank, Mẹ..." className="w-full border border-gray-300 rounded-xl p-3 font-bold text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 mt-1 bg-white" value={form.target_name} onChange={e => setForm({...form, target_name: e.target.value})} />
                 </div>
                 <div>
                    <label className="text-[10px] font-black uppercase text-gray-500 ml-1">Ngày bắt đầu</label>
                    <input required type="date" className="w-full border border-gray-300 rounded-xl p-3 font-bold text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 mt-1 bg-white" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} />
                 </div>
                 <div>
                    <label className="text-[10px] font-black uppercase text-gray-500 ml-1">Tổng số {form.item_type === 'tien' ? 'Tiền (VNĐ)' : 'Ký Yến (Kg)'} gốc</label>
                    <input required type="number" step="0.001" placeholder={form.item_type === 'tien' ? '50000000' : '5.5'} className="w-full border border-gray-300 rounded-xl p-3 font-black text-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 mt-1 bg-blue-50" value={form.total_amount} onChange={e => setForm({...form, total_amount: e.target.value})} />
                 </div>
              </div>

           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div>
                 <label className="text-[10px] font-black uppercase text-gray-500 ml-1">Ngày đóng lãi hàng tháng (1-31)</label>
                 <input type="number" min="1" max="31" placeholder="VD: 15" className="w-full border border-gray-300 rounded-xl p-3 font-bold text-sm outline-none mt-1 focus:border-blue-500" value={form.interest_day} onChange={e => setForm({...form, interest_day: e.target.value})} />
              </div>
              <div>
                 <label className="text-[10px] font-black uppercase text-orange-500 ml-1">Số tiền lãi mỗi tháng (VNĐ)</label>
                 <input type="number" placeholder="VD: 2000000" className="w-full border border-orange-200 rounded-xl p-3 font-bold text-sm outline-none mt-1 bg-orange-50 focus:border-orange-500" value={form.interest_amount} onChange={e => setForm({...form, interest_amount: e.target.value})} disabled={form.item_type === 'yen'} />
              </div>
              <div>
                 <label className="text-[10px] font-black uppercase text-gray-500 ml-1">Ghi chú (Tùy chọn)</label>
                 <input placeholder="Thế chấp..." className="w-full border border-gray-300 rounded-xl p-3 font-medium text-sm outline-none mt-1 focus:border-blue-500" value={form.note} onChange={e => setForm({...form, note: e.target.value})} />
              </div>
           </div>

           <button type="submit" className="w-full bg-gray-900 text-white font-black rounded-xl py-3.5 uppercase tracking-widest text-[11px] md:text-xs hover:bg-black transition-colors shadow-md mt-2">Lưu Vào Sổ</button>
        </form>
      )}

      {/* DANH SÁCH GỘP (UI CỰC KỲ GỌN GÀNG) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
         
         {/* CỘT NỢ NGƯỜI TA */}
         <div className="space-y-4">
            <div className="flex items-center gap-3 mb-5 bg-red-50 p-4 md:p-5 rounded-[24px] border border-red-100">
               <div className="bg-red-500 p-2.5 rounded-xl text-white"><HandCoins size={20}/></div>
               <div><h2 className="text-lg md:text-xl font-black text-red-700 uppercase tracking-tighter">Khoản Mình Vay</h2><p className="text-[9px] md:text-[10px] font-bold text-red-500 uppercase">Ngân hàng, Cha mẹ (Phải trả)</p></div>
            </div>

            {myDebts.filter(g => g.totalRemaining > 0).map(group => (
               <GroupCard key={group.groupKey} group={group} onClick={() => setSelectedPerson(group)} />
            ))}
            {myDebts.filter(g => g.totalRemaining > 0).length === 0 && <p className="text-center font-bold text-gray-300 py-8 border-2 border-dashed border-gray-200 rounded-[20px] text-xs">Mày không mang cục nợ nào!</p>}
         </div>

         {/* CỘT NGƯỜI TA NỢ MÌNH */}
         <div className="space-y-4">
            <div className="flex items-center gap-3 mb-5 bg-blue-50 p-4 md:p-5 rounded-[24px] border border-blue-100">
               <div className="bg-blue-600 p-2.5 rounded-xl text-white"><Users size={20}/></div>
               <div><h2 className="text-lg md:text-xl font-black text-blue-800 uppercase tracking-tighter">Khoản Cho Vay</h2><p className="text-[9px] md:text-[10px] font-bold text-blue-500 uppercase">Đối tác, Cha mẹ mượn (Chờ thu)</p></div>
            </div>

            {othersDebts.filter(g => g.totalRemaining > 0).map(group => (
               <GroupCard key={group.groupKey} group={group} onClick={() => setSelectedPerson(group)} />
            ))}
            {othersDebts.filter(g => g.totalRemaining > 0).length === 0 && <p className="text-center font-bold text-gray-300 py-8 border-2 border-dashed border-gray-200 rounded-[20px] text-xs">Chưa ai mượn đồ của mày!</p>}
         </div>

      </div>

      {/* POPUP CHI TIẾT 1 NGƯỜI (Liệt kê các khoản lắt nhắt bên trong) */}
      {selectedPerson && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-4 backdrop-blur-sm animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:fade-in">
          <div className="bg-white w-full sm:max-w-2xl max-h-[90vh] rounded-t-[30px] sm:rounded-[30px] flex flex-col shadow-2xl relative">
            
            <div className="p-5 md:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-[30px]">
               <div>
                  <h2 className="text-xl md:text-2xl font-black text-gray-900 capitalize tracking-tight">{selectedPerson.displayName}</h2>
                  <p className="text-[10px] md:text-xs font-bold text-gray-500 mt-1">Tổng Gốc Đã Vay: {selectedPerson.totalOriginal.toLocaleString('vi-VN')} {selectedPerson.item_type === 'tien' ? 'đ' : 'kg'}</p>
               </div>
               <button onClick={() => setSelectedPerson(null)} className="p-2 bg-white rounded-full text-gray-500 shadow-sm border border-gray-200 hover:text-gray-900"><X size={18}/></button>
            </div>

            <div className="overflow-y-auto p-4 md:p-6 space-y-4 custom-scrollbar flex-1">
               <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                 <History size={12}/> Chi tiết các khoản nợ lắt nhắt ({selectedPerson.items.length})
               </h3>
               
               {selectedPerson.items.map((item: any, index: number) => {
                  const isPaidOff = Number(item.remaining_amount) <= 0;
                  const unit = item.item_type === 'tien' ? 'đ' : 'kg';

                  return (
                     <div key={item.id} className={`p-4 md:p-5 rounded-[20px] border ${isPaidOff ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-white border-blue-100 shadow-sm'}`}>
                        <div className="flex justify-between items-start mb-3 border-b border-gray-100 pb-2">
                           <div>
                              <p className="text-xs md:text-sm font-bold text-gray-900">
                                Lần {index + 1} 
                                <span className="text-[10px] text-gray-500 font-medium ml-1">({new Date(item.start_date || item.created_at).toLocaleDateString('vi-VN')})</span>
                              </p>
                              {item.note && <p className="text-[9px] text-gray-400 mt-0.5 italic">{item.note}</p>}
                           </div>
                           <div className="flex gap-2">
                              <button onClick={() => openEditModal(item)} className="text-gray-400 hover:text-blue-600"><Pencil size={14}/></button>
                              <button onClick={() => handleDeleteDebt(item.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14}/></button>
                           </div>
                        </div>

                        <div className="flex justify-between items-end mb-3">
                           <div>
                              <p className="text-[10px] text-gray-500 font-bold uppercase">Gốc: {Number(item.total_amount).toLocaleString('vi-VN')}{unit}</p>
                              <p className="text-sm md:text-base font-black text-gray-900 mt-0.5">Còn nợ: <span className={selectedPerson.debt_type === 'vay_vao' ? 'text-red-600' : 'text-emerald-600'}>{Number(item.remaining_amount).toLocaleString('vi-VN')}{unit}</span></p>
                           </div>
                           {!isPaidOff ? (
                              <button onClick={() => { setPaymentModal(item); setPayForm({...payForm, amount: item.remaining_amount.toString()}) }} className="bg-gray-900 text-white text-[10px] font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 hover:bg-gray-800 shadow-sm uppercase">
                                 <HandCoins size={14}/> Ghi Chép
                              </button>
                           ) : (
                              <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">ĐÃ XONG</span>
                           )}
                        </div>

                        {!isPaidOff && item.interest_day && item.item_type === 'tien' && (
                           <div className="flex items-center gap-2 bg-orange-50 text-orange-700 text-[9px] font-bold p-2 rounded-lg border border-orange-100 mt-2">
                              <CalendarClock size={12}/> Hàng tháng: {Number(item.interest_amount).toLocaleString('vi-VN')}đ (Đóng vào {getNextInterestDate(item.interest_day)})
                           </div>
                        )}

                        {/* Lịch sử trả nợ nhỏ của khoản này */}
                        {item.debt_transactions && item.debt_transactions.length > 0 && (
                           <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 mt-3 space-y-1.5">
                              {item.debt_transactions.sort((a:any, b:any) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()).map((tx: any) => (
                                 <div key={tx.id} className="flex justify-between items-center text-[10px] border-b border-gray-200/50 last:border-0 pb-1.5 last:pb-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className={`px-1.5 rounded text-[8px] font-black uppercase ${tx.transaction_type === 'tra_lai' ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                        {tx.transaction_type === 'tra_lai' ? 'Lãi' : 'Gốc'}
                                      </span>
                                      <span className="text-gray-500 font-medium">{new Date(tx.transaction_date).toLocaleDateString('vi-VN')}</span>
                                    </div>
                                    <span className="font-bold text-gray-800">{Number(tx.amount).toLocaleString('vi-VN')} {unit}</span>
                                 </div>
                              ))}
                           </div>
                        )}
                     </div>
                  )
               })}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL CHỈNH SỬA KHOẢN NỢ --- */}
      {editingDebt && (
        <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-[30px] p-6 w-full max-w-md shadow-2xl relative animate-in zoom-in-95">
            <button onClick={() => setEditingDebt(null)} className="absolute top-5 right-5 bg-gray-100 p-1.5 rounded-full text-gray-500"><X size={18}/></button>
            <h2 className="text-lg font-black uppercase mb-4 text-gray-900 flex items-center gap-2 border-b pb-3">
              <Pencil className="text-blue-500" size={18}/> Sửa thông tin gốc
            </h2>
            
            <form onSubmit={handleUpdateDebt} className="space-y-4">
               <div>
                  <label className="text-[10px] font-black uppercase text-gray-500 ml-1 block">Tên người vay</label>
                  <input required className="w-full border border-gray-200 rounded-xl p-3 font-bold text-sm outline-none focus:border-blue-500" value={editForm.target_name} onChange={e => setEditForm({...editForm, target_name: e.target.value})} />
               </div>
               <div>
                  <label className="text-[10px] font-black uppercase text-gray-500 ml-1 block">Ngày bắt đầu</label>
                  <input required type="date" className="w-full border border-gray-200 rounded-xl p-3 font-bold text-sm outline-none focus:border-blue-500" value={editForm.start_date} onChange={e => setEditForm({...editForm, start_date: e.target.value})} />
               </div>
               <div>
                  <label className="text-[10px] font-black uppercase text-gray-500 ml-1 block">Tổng Mượn Gốc Ban Đầu</label>
                  <input required type="number" step="0.001" className="w-full border-2 border-blue-100 bg-blue-50 rounded-xl p-3 font-black text-lg outline-none focus:border-blue-500 text-blue-800" value={editForm.total_amount} onChange={e => setEditForm({...editForm, total_amount: e.target.value})} />
               </div>
               
               <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="text-[9px] font-black uppercase text-gray-500 ml-1 block">Ngày đóng lãi</label>
                    <input type="number" min="1" max="31" className="w-full border border-gray-200 rounded-lg p-2.5 font-bold text-xs outline-none" value={editForm.interest_day} onChange={e => setEditForm({...editForm, interest_day: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase text-orange-500 ml-1 block">Tiền lãi (VNĐ)</label>
                    <input type="number" className="w-full border border-orange-200 rounded-lg p-2.5 font-bold text-xs outline-none" value={editForm.interest_amount} onChange={e => setEditForm({...editForm, interest_amount: e.target.value})} disabled={editForm.item_type === 'yen'} />
                  </div>
               </div>
               
               <button type="submit" className="w-full bg-blue-600 text-white font-black rounded-xl py-3.5 uppercase tracking-widest text-xs mt-2 shadow-md">Lưu Thay Đổi</button>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL GHI CHÉP THU CHI --- */}
      {paymentModal && (
         <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <form onSubmit={handlePayment} className="bg-white p-6 md:p-8 rounded-[30px] w-full max-w-sm shadow-2xl relative animate-in zoom-in-95">
               <button type="button" onClick={() => setPaymentModal(null)} className="absolute top-5 right-5 bg-gray-100 p-1.5 rounded-full text-gray-500"><X size={18}/></button>
               <h3 className="font-black text-lg md:text-xl text-gray-900 mb-1 flex items-center gap-2"><ArrowRightLeft className="text-blue-500" size={20}/> Ghi chép thanh toán</h3>
               <p className="text-[10px] md:text-xs text-gray-500 mb-5 font-medium border-b border-gray-100 pb-3">
                  Khoản vay ngày {new Date(paymentModal.start_date || paymentModal.created_at).toLocaleDateString('vi-VN')}<br/>
                  <span className="text-red-500 font-bold">Cần trả gốc: {Number(paymentModal.remaining_amount).toLocaleString('vi-VN')} {paymentModal.item_type === 'tien' ? 'đ' : 'kg'}</span>
               </p>
               
               <div className="space-y-4">
                  <div>
                     <label className="text-[10px] font-black uppercase text-gray-500 block mb-1.5">Mày muốn Ghi Chép cái gì?</label>
                     <div className="flex gap-2">
                        <label className="flex-1 text-center bg-white border border-gray-200 p-2.5 rounded-xl cursor-pointer font-bold text-xs text-blue-600 hover:border-blue-500 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 transition-colors">
                           <input type="radio" className="hidden" checked={payForm.transaction_type === 'tra_goc'} onChange={() => setPayForm({...payForm, transaction_type: 'tra_goc', amount: paymentModal.remaining_amount.toString()})} /> Trừ Gốc
                        </label>
                        {paymentModal.item_type === 'tien' && paymentModal.interest_day && (
                           <label className="flex-1 text-center bg-white border border-gray-200 p-2.5 rounded-xl cursor-pointer font-bold text-xs text-orange-600 hover:border-orange-500 has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50 transition-colors">
                              <input type="radio" className="hidden" checked={payForm.transaction_type === 'tra_lai'} onChange={() => setPayForm({...payForm, transaction_type: 'tra_lai', amount: paymentModal.interest_amount?.toString() || ''})} /> Đóng Lãi
                           </label>
                        )}
                     </div>
                  </div>

                  <div>
                     <label className="text-[10px] font-black uppercase text-gray-500 mb-1 block">
                        {payForm.transaction_type === 'tra_goc' ? `Số ${paymentModal.item_type === 'tien' ? 'Tiền' : 'Kg'} Gốc Trả` : 'Số Tiền Lãi Trả'}
                     </label>
                     <input required type="number" step="0.001" max={payForm.transaction_type === 'tra_goc' ? paymentModal.remaining_amount : undefined} className="w-full border-2 border-blue-100 bg-blue-50 rounded-xl p-3 font-black text-xl text-blue-800 outline-none focus:border-blue-500 text-center" value={payForm.amount} onChange={e => setPayForm({...payForm, amount: e.target.value})} />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                     <div>
                        <label className="text-[10px] font-black uppercase text-gray-500 mb-1 block">Ngày đưa tiền</label>
                        <input type="date" required className="w-full border border-gray-200 rounded-xl p-2.5 font-bold text-xs outline-none" value={payForm.transaction_date} onChange={e => setPayForm({...payForm, transaction_date: e.target.value})} />
                     </div>
                     <div>
                        <label className="text-[10px] font-black uppercase text-gray-500 mb-1 block">Ghi chú</label>
                        <input placeholder="CK Vietcombank..." className="w-full border border-gray-200 rounded-xl p-2.5 font-bold text-xs outline-none" value={payForm.note} onChange={e => setPayForm({...payForm, note: e.target.value})} />
                     </div>
                  </div>
                  
                  <button type="submit" className="w-full bg-gray-900 text-white font-black rounded-xl py-3.5 uppercase tracking-widest text-xs hover:bg-black transition-colors mt-2 shadow-md">Xác nhận</button>
               </div>
            </form>
         </div>
      )}

    </div>
  )

  // THẺ RÚT GỌN HIỂN THỊ NGOÀI MÀN HÌNH CHÍNH (GROUP CARD)
  function GroupCard({ group, onClick }: any) {
    const isMoney = group.item_type === 'tien';
    const unit = isMoney ? 'đ' : 'kg';

    return (
      <div onClick={onClick} className="bg-white p-4 md:p-5 rounded-[24px] border border-gray-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all cursor-pointer flex items-center justify-between group/card active:scale-[0.98]">
         <div className="flex items-center gap-3">
            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center shrink-0 ${group.debt_type === 'vay_vao' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
               <Wallet size={20}/>
            </div>
            <div>
               <h3 className="text-sm md:text-base font-black text-gray-900 capitalize leading-tight truncate max-w-[120px] md:max-w-[200px]">{group.displayName}</h3>
               <div className="flex items-center gap-1.5 mt-1">
                  <span className={`text-[8px] md:text-[9px] font-black px-1.5 py-0.5 rounded uppercase border ${isMoney ? 'bg-yellow-50 text-yellow-700 border-yellow-100' : 'bg-orange-50 text-orange-700 border-orange-100'}`}>
                     Mượn {isMoney ? 'Tiền' : 'Yến'}
                  </span>
                  <span className="text-[9px] text-gray-400 font-bold bg-gray-50 px-1.5 py-0.5 rounded">{group.items.length} món nợ</span>
               </div>
            </div>
         </div>
         <div className="text-right flex items-center gap-2 md:gap-3">
            <div className="flex flex-col items-end">
               <p className="text-[8px] md:text-[9px] font-bold text-gray-400 uppercase mb-0.5 tracking-widest">Tổng đang nợ</p>
               <p className={`text-base md:text-xl font-black tracking-tighter ${group.debt_type === 'vay_vao' ? 'text-red-600' : 'text-blue-600'}`}>
                  {group.totalRemaining.toLocaleString('vi-VN')}<span className="text-xs ml-0.5">{unit}</span>
               </p>
            </div>
            <ArrowRightCircle className="text-gray-200 group-hover/card:text-blue-500 transition-colors shrink-0" size={20}/>
         </div>
      </div>
    )
  }
}
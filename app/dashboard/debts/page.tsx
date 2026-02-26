'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  Landmark, Users, HandCoins, History, X, PlusCircle, 
  Wallet, CheckCircle2, AlertCircle, CalendarClock, ArrowRightLeft,
  Pencil, Trash2 // Thêm icon Sửa & Xóa
} from 'lucide-react'

export default function DebtsPage() {
  const [debts, setDebts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  
  // Modals
  const [paymentModal, setPaymentModal] = useState<any>(null)
  const [historyModal, setHistoryModal] = useState<any>(null)
  const [editingDebt, setEditingDebt] = useState<any>(null) // Thêm state cho Sửa Nợ

  // FORM TẠO MỚI
  const [form, setForm] = useState({
    target_name: '', debt_type: 'vay_vao', item_type: 'tien',
    total_amount: '', interest_day: '', interest_amount: '', note: ''
  })

  // FORM SỬA
  const [editForm, setEditForm] = useState({
    target_name: '', debt_type: 'vay_vao', item_type: 'tien',
    total_amount: '', interest_day: '', interest_amount: '', note: ''
  })

  // FORM GHI CHÉP
  const [payForm, setPayForm] = useState({
    amount: '', transaction_type: 'tra_goc', transaction_date: new Date().toISOString().split('T')[0], note: ''
  })

  const fetchDebts = async () => {
    const { data } = await supabase.from('debts').select('*, debt_transactions(*)').order('created_at', { ascending: false })
    if (data) setDebts(data)
    setLoading(false)
  }

  useEffect(() => { fetchDebts() }, [])

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
      note: form.note
    }])
    setForm({ target_name: '', debt_type: 'vay_vao', item_type: 'tien', total_amount: '', interest_day: '', interest_amount: '', note: '' })
    setShowAddForm(false); fetchDebts()
  }

  // 2. MỞ FORM SỬA KHOẢN NỢ
  const openEditModal = (d: any) => {
    setEditingDebt(d);
    setEditForm({
      target_name: d.target_name,
      debt_type: d.debt_type,
      item_type: d.item_type,
      total_amount: d.total_amount.toString(),
      interest_day: d.interest_day ? d.interest_day.toString() : '',
      interest_amount: d.interest_amount ? d.interest_amount.toString() : '',
      note: d.note || ''
    });
  }

  // 3. LƯU CẬP NHẬT KHOẢN NỢ
  const handleUpdateDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const newTotal = Number(editForm.total_amount);
    // Tính lại số tiền còn nợ (đề phòng trường hợp mày nhập sai tiền gốc)
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
      status: newRemaining <= 0 ? 'hoan_tat' : 'dang_no'
    }).eq('id', editingDebt.id);

    setEditingDebt(null);
    fetchDebts();
  }

  // 4. XÓA KHOẢN NỢ
  const handleDeleteDebt = async (id: string) => {
    if (confirm("Duy chắc chắn muốn xóa hẳn sổ nợ này không? Mọi lịch sử thu/chi của sổ này cũng sẽ bị xóa vĩnh viễn!")) {
      setLoading(true);
      await supabase.from('debts').delete().eq('id', id);
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
    setPaymentModal(null); fetchDebts()
  }

  const myDebts = debts.filter(d => d.debt_type === 'vay_vao') 
  const othersDebts = debts.filter(d => d.debt_type === 'cho_vay') 

  const getNextInterestDate = (day: number) => {
    const today = new Date();
    const currentDay = today.getDate();
    const month = currentDay > day ? today.getMonth() + 2 : today.getMonth() + 1;
    const year = month > 12 ? today.getFullYear() + 1 : today.getFullYear();
    const finalMonth = month > 12 ? 1 : month;
    return `Ngày ${day} tháng ${finalMonth}/${year}`;
  }

  const openPaymentModal = (d: any) => {
    setPaymentModal(d);
    setPayForm({
        amount: '', 
        transaction_type: 'tra_goc', 
        transaction_date: new Date().toISOString().split('T')[0], 
        note: ''
    });
  }

  if (loading && debts.length === 0) return <div className="p-10 font-black animate-pulse text-gray-400 text-center uppercase tracking-widest">Đang lật sổ công nợ...</div>

  return (
    <div className="p-6 space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto pb-20">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-900 text-white p-8 rounded-[40px] shadow-2xl gap-6">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-3"><Landmark size={32} className="text-blue-400"/> Sổ Công Nợ ĐOÀN QUYÊN</h1>
          <p className="text-gray-400 font-bold mt-1 tracking-widest uppercase text-[10px]">Kiểm soát gốc, lãi suất & Lịch sử trả nợ</p>
        </div>
        <button onClick={() => setShowAddForm(!showAddForm)} className="bg-blue-600 hover:bg-blue-500 px-6 py-4 rounded-2xl font-black shadow-lg uppercase text-xs flex items-center gap-2">
          {showAddForm ? 'Hủy bỏ' : <><PlusCircle size={18}/> Thêm Khoản Nợ / Cho Vay</>}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddDebt} className="bg-white p-8 rounded-[40px] border border-gray-200 shadow-sm space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="space-y-4 bg-gray-50 p-6 rounded-3xl border">
                 <h3 className="font-black text-gray-800 uppercase tracking-tighter border-b pb-2">1. Phân loại khoản vay</h3>
                 <div className="flex gap-4">
                    <label className="flex items-center gap-2 font-bold cursor-pointer text-red-600"><input type="radio" checked={form.debt_type === 'vay_vao'} onChange={() => setForm({...form, debt_type: 'vay_vao'})} className="accent-red-500 w-4 h-4"/> Mình Đi Vay (Nợ người ta)</label>
                    <label className="flex items-center gap-2 font-bold cursor-pointer text-blue-600"><input type="radio" checked={form.debt_type === 'cho_vay'} onChange={() => setForm({...form, debt_type: 'cho_vay'})} className="accent-blue-500 w-4 h-4"/> Mình Cho Vay (Người ta nợ)</label>
                 </div>
                 <div className="flex gap-4 pt-2">
                    <label className="flex items-center gap-2 font-bold cursor-pointer text-gray-600"><input type="radio" checked={form.item_type === 'tien'} onChange={() => setForm({...form, item_type: 'tien'})} className="w-4 h-4"/> Mượn Tiền (VNĐ)</label>
                    <label className="flex items-center gap-2 font-bold cursor-pointer text-orange-600"><input type="radio" checked={form.item_type === 'yen'} onChange={() => setForm({...form, item_type: 'yen'})} className="w-4 h-4"/> Mượn Yến (Kg)</label>
                 </div>
              </div>

              <div className="space-y-4">
                 <div>
                    <label className="text-[10px] font-black uppercase text-gray-500 ml-2">Đối tác (Ngân hàng / Tên người nhà)</label>
                    <input required placeholder="VD: Sacombank, Mẹ, Cha..." className="w-full border rounded-2xl p-4 font-bold text-sm outline-none focus:border-blue-500 mt-1 bg-white" value={form.target_name} onChange={e => setForm({...form, target_name: e.target.value})} />
                 </div>
                 <div>
                    <label className="text-[10px] font-black uppercase text-gray-500 ml-2">Tổng số {form.item_type === 'tien' ? 'Tiền (VNĐ)' : 'Ký Yến (Kg)'} cho mượn/vay</label>
                    <input required type="number" step="0.001" placeholder={form.item_type === 'tien' ? '50000000' : '5.5'} className="w-full border-2 rounded-2xl p-4 font-black text-xl outline-none focus:border-blue-500 mt-1 bg-white" value={form.total_amount} onChange={e => setForm({...form, total_amount: e.target.value})} />
                 </div>
              </div>

           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                 <label className="text-[10px] font-black uppercase text-gray-500 ml-2">Ngày đóng lãi hàng tháng (1-31)</label>
                 <input type="number" min="1" max="31" placeholder="VD: 15" className="w-full border rounded-2xl p-4 font-bold text-sm outline-none mt-1" value={form.interest_day} onChange={e => setForm({...form, interest_day: e.target.value})} />
              </div>
              <div>
                 <label className="text-[10px] font-black uppercase text-blue-500 ml-2">Số tiền lãi mỗi tháng (VNĐ)</label>
                 <input type="number" placeholder="VD: 2000000" className="w-full border rounded-2xl p-4 font-bold text-sm outline-none mt-1 bg-blue-50 focus:border-blue-500" value={form.interest_amount} onChange={e => setForm({...form, interest_amount: e.target.value})} disabled={form.item_type === 'yen'} />
              </div>
              <div>
                 <label className="text-[10px] font-black uppercase text-gray-500 ml-2">Ghi chú thêm</label>
                 <input placeholder="Thế chấp sổ đỏ..." className="w-full border rounded-2xl p-4 font-bold text-sm outline-none mt-1" value={form.note} onChange={e => setForm({...form, note: e.target.value})} />
              </div>
           </div>

           <button type="submit" className="w-full bg-gray-900 text-white font-black rounded-2xl py-4 uppercase tracking-widest hover:bg-black transition-colors shadow-xl">Tạo Sổ Nợ Mới</button>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
         
         <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6 bg-red-50 p-4 rounded-3xl border border-red-100">
               <div className="bg-red-500 p-3 rounded-2xl text-white"><HandCoins size={24}/></div>
               <div><h2 className="text-xl font-black text-red-700 uppercase tracking-tighter">Khoản Mình Vay</h2><p className="text-[10px] font-bold text-red-500 uppercase">Ngân hàng, Cha mẹ (Phải trả)</p></div>
            </div>

            {myDebts.map(d => (
              <DebtCard 
                 key={d.id} d={d} 
                 onPay={() => openPaymentModal(d)} 
                 onHistory={() => setHistoryModal(d)}
                 onEdit={() => openEditModal(d)}
                 onDelete={() => handleDeleteDebt(d.id)}
              />
            ))}
            {myDebts.length === 0 && <p className="text-center font-bold text-gray-300 py-10 border-2 border-dashed rounded-3xl">Mày không mang cục nợ nào!</p>}
         </div>

         <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6 bg-blue-50 p-4 rounded-3xl border border-blue-100">
               <div className="bg-blue-600 p-3 rounded-2xl text-white"><Users size={24}/></div>
               <div><h2 className="text-xl font-black text-blue-800 uppercase tracking-tighter">Khoản Cho Vay</h2><p className="text-[10px] font-bold text-blue-500 uppercase">Đối tác, Cha mẹ mượn (Chờ thu)</p></div>
            </div>

            {othersDebts.map(d => (
              <DebtCard 
                 key={d.id} d={d} 
                 onPay={() => openPaymentModal(d)} 
                 onHistory={() => setHistoryModal(d)}
                 onEdit={() => openEditModal(d)}
                 onDelete={() => handleDeleteDebt(d.id)}
              />
            ))}
            {othersDebts.length === 0 && <p className="text-center font-bold text-gray-300 py-10 border-2 border-dashed rounded-3xl">Chưa ai mượn đồ của mày!</p>}
         </div>

      </div>

      {/* --- MODAL CHỈNH SỬA KHOẢN NỢ --- */}
      {editingDebt && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-[40px] p-8 w-full max-w-2xl shadow-2xl relative animate-in zoom-in-95">
            <button onClick={() => setEditingDebt(null)} className="absolute top-6 right-6 bg-gray-100 p-2 rounded-full hover:bg-red-100 hover:text-red-500 transition-colors"><X size={20}/></button>
            <h2 className="text-2xl font-black uppercase tracking-tighter mb-6 text-gray-900 flex items-center gap-2">
              <Pencil className="text-blue-500"/> Sửa thông tin sổ nợ
            </h2>
            
            <form onSubmit={handleUpdateDebt} className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                     <div>
                        <label className="text-[10px] font-black uppercase text-gray-500 ml-2">Đối tác (Tên người nhà/NH)</label>
                        <input required className="w-full border rounded-2xl p-4 font-bold text-sm outline-none focus:border-blue-500 mt-1" value={editForm.target_name} onChange={e => setEditForm({...editForm, target_name: e.target.value})} />
                     </div>
                     <div>
                        <label className="text-[10px] font-black uppercase text-gray-500 ml-2">Tổng Mượn Gốc Ban Đầu</label>
                        <input required type="number" step="0.001" className="w-full border-2 border-blue-100 rounded-2xl p-4 font-black text-xl outline-none focus:border-blue-500 mt-1" value={editForm.total_amount} onChange={e => setEditForm({...editForm, total_amount: e.target.value})} />
                     </div>
                  </div>
                  <div className="space-y-4">
                     <div>
                       <label className="text-[10px] font-black uppercase text-gray-500 ml-2">Ngày đóng lãi hàng tháng (1-31)</label>
                       <input type="number" min="1" max="31" className="w-full border rounded-2xl p-4 font-bold text-sm outline-none mt-1" value={editForm.interest_day} onChange={e => setEditForm({...editForm, interest_day: e.target.value})} />
                     </div>
                     <div>
                       <label className="text-[10px] font-black uppercase text-blue-500 ml-2">Số tiền lãi mỗi tháng (VNĐ)</label>
                       <input type="number" className="w-full border rounded-2xl p-4 font-bold text-sm outline-none mt-1 bg-blue-50 focus:border-blue-500" value={editForm.interest_amount} onChange={e => setEditForm({...editForm, interest_amount: e.target.value})} disabled={editForm.item_type === 'yen'} />
                     </div>
                  </div>
               </div>
               <div>
                 <label className="text-[10px] font-black uppercase text-gray-500 ml-2">Ghi chú</label>
                 <input className="w-full border rounded-2xl p-4 font-bold text-sm outline-none mt-1" value={editForm.note} onChange={e => setEditForm({...editForm, note: e.target.value})} />
               </div>
               
               <button type="submit" className="w-full bg-blue-600 text-white font-black rounded-2xl py-4 uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30">Cập Nhật Ghi Chép</button>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL GHI CHÉP GIAO DỊCH --- */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-[30px] p-8 w-full max-w-md shadow-2xl relative animate-in zoom-in-95">
            <button onClick={() => setPaymentModal(null)} className="absolute top-6 right-6 bg-gray-100 p-2 rounded-full hover:bg-red-100 hover:text-red-500 transition-colors"><X size={20}/></button>
            <h2 className="text-2xl font-black uppercase tracking-tighter mb-1 text-gray-900 flex items-center gap-2">
              <ArrowRightLeft className="text-blue-500"/> Ghi chép thu/chi
            </h2>
            <p className="text-gray-500 font-bold text-xs mb-6">Sổ: {paymentModal.target_name} • Còn nợ gốc: <span className="text-red-500">{paymentModal.item_type === 'tien' ? Number(paymentModal.remaining_amount).toLocaleString('vi-VN') + 'đ' : paymentModal.remaining_amount + 'kg'}</span></p>
            
            <form onSubmit={handlePayment} className="space-y-4 bg-gray-50 p-6 rounded-3xl border border-gray-100">
              <div>
                <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block">Loại giao dịch</label>
                <div className="flex gap-2">
                  <label className="flex-1 text-center bg-white border p-3 rounded-xl cursor-pointer font-bold text-sm text-blue-600 hover:border-blue-500 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
                     <input type="radio" className="hidden" checked={payForm.transaction_type === 'tra_goc'} onChange={() => setPayForm({...payForm, transaction_type: 'tra_goc', amount: ''})} /> Trừ nợ gốc
                  </label>
                  {paymentModal.item_type === 'tien' && paymentModal.interest_day && (
                    <label className="flex-1 text-center bg-white border p-3 rounded-xl cursor-pointer font-bold text-sm text-orange-600 hover:border-orange-500 has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50">
                      <input type="radio" className="hidden" checked={payForm.transaction_type === 'tra_lai'} onChange={() => setPayForm({...payForm, transaction_type: 'tra_lai', amount: paymentModal.interest_amount?.toString() || ''})} /> Đóng lãi tháng
                    </label>
                  )}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-gray-500 mb-1 block">
                    {payForm.transaction_type === 'tra_goc' ? `Số ${paymentModal.item_type === 'tien' ? 'Tiền' : 'Kg'} Gốc Trả/Thu` : 'Số Tiền Lãi Bằng Chữ Số'}
                </label>
                <input required type="number" step="0.001" max={payForm.transaction_type === 'tra_goc' ? paymentModal.remaining_amount : undefined} className="w-full border border-gray-200 rounded-xl p-4 font-black text-lg outline-none focus:border-blue-500" value={payForm.amount} onChange={e => setPayForm({...payForm, amount: e.target.value})} placeholder="Nhập số..." />
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                   <label className="text-[10px] font-black uppercase text-gray-500 mb-1 block">Ngày giao dịch</label>
                   <input type="date" required className="w-full border border-gray-200 rounded-xl p-3 font-bold text-sm outline-none" value={payForm.transaction_date} onChange={e => setPayForm({...payForm, transaction_date: e.target.value})} />
                </div>
                <div>
                   <label className="text-[10px] font-black uppercase text-gray-500 mb-1 block">Ghi chú (Tùy chọn)</label>
                   <input placeholder="Ghi chú..." className="w-full border border-gray-200 rounded-xl p-3 font-bold text-sm outline-none" value={payForm.note} onChange={e => setPayForm({...payForm, note: e.target.value})} />
                </div>
              </div>
              
              <button type="submit" className="w-full bg-blue-600 text-white font-black rounded-xl py-4 uppercase text-sm hover:bg-blue-700 shadow-lg shadow-blue-500/30 mt-2">Xác nhận Lưu</button>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL LỊCH SỬ GIAO DỊCH --- */}
      {historyModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-[40px] p-8 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative animate-in zoom-in-95">
            <button onClick={() => setHistoryModal(null)} className="absolute top-8 right-8 bg-gray-100 p-2 rounded-full hover:bg-red-100 hover:text-red-500 transition-colors"><X size={24}/></button>
            <div className="mb-6 border-b pb-4">
               <h2 className="text-2xl font-black uppercase tracking-tighter text-gray-900 flex items-center gap-2"><History className="text-gray-500"/> Lịch sử sổ: {historyModal.target_name}</h2>
               <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Liệt kê tất cả các lần đóng lãi và trừ gốc</p>
            </div>
            <div className="overflow-y-auto pr-2 custom-scrollbar">
               {historyModal.debt_transactions?.length === 0 ? <p className="text-center py-10 font-bold text-gray-400">Chưa có giao dịch nào được ghi nhận.</p> : (
                 <div className="space-y-3">
                   {historyModal.debt_transactions?.sort((a:any, b:any) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()).map((t: any) => (
                      <div key={t.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border hover:border-blue-200 transition-colors">
                         <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-xl font-black text-[10px] uppercase text-white shadow-sm ${t.transaction_type === 'tra_lai' ? 'bg-orange-500' : 'bg-emerald-500'}`}>
                               {t.transaction_type === 'tra_lai' ? 'Đóng lãi' : 'Trừ gốc'}
                            </div>
                            <div>
                               <p className="font-black text-gray-900 text-sm">{new Date(t.transaction_date).toLocaleDateString('vi-VN')}</p>
                               <p className="text-xs text-gray-500">{t.note || '---'}</p>
                            </div>
                         </div>
                         <p className={`font-black text-lg ${t.transaction_type === 'tra_lai' ? 'text-orange-600' : 'text-emerald-600'}`}>
                           {Number(t.amount).toLocaleString('vi-VN')} {historyModal.item_type === 'tien' ? 'đ' : 'kg'}
                         </p>
                      </div>
                   ))}
                 </div>
               )}
            </div>
          </div>
        </div>
      )}

    </div>
  )

  // THẺ HIỂN THỊ NỢ (ĐÃ THÊM NÚT SỬA VÀ XÓA)
  function DebtCard({ d, onPay, onHistory, onEdit, onDelete }: any) {
    const isDone = d.status === 'hoan_tat';
    const isMoney = d.item_type === 'tien';
    const progress = ((d.total_amount - d.remaining_amount) / d.total_amount) * 100;
    const unit = isMoney ? 'đ' : 'kg';

    return (
      <div className={`bg-white p-6 rounded-[30px] border shadow-sm flex flex-col gap-4 relative overflow-hidden transition-colors ${isDone ? 'border-green-200 bg-green-50/30' : 'hover:border-gray-300'}`}>
        
        {isDone && <div className="absolute -right-10 top-5 bg-green-500 text-white font-black text-[10px] uppercase py-1 px-10 rotate-45 z-10 shadow-md">Đã thanh toán</div>}

        <div className="flex justify-between items-start">
           <div>
              <div className="flex items-center gap-2">
                 <h3 className="text-2xl font-black text-gray-900 tracking-tight">{d.target_name}</h3>
                 {/* BỘ NÚT SỬA VÀ XÓA ẨN TRÊN TIÊU ĐỀ */}
                 <div className="flex gap-1 ml-2">
                    <button onClick={onEdit} className="p-2 bg-gray-100 hover:bg-blue-100 text-gray-500 hover:text-blue-600 rounded-full transition-colors" title="Sửa sổ nợ"><Pencil size={14}/></button>
                    <button onClick={onDelete} className="p-2 bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-600 rounded-full transition-colors" title="Xóa sổ nợ"><Trash2 size={14}/></button>
                 </div>
              </div>
              <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md mt-1 inline-block ${isMoney ? 'bg-yellow-100 text-yellow-700' : 'bg-orange-100 text-orange-700'}`}>
                 Mượn {isMoney ? 'Tiền' : 'Yến sào'}
              </span>
           </div>
           <div className="text-right">
              <p className="text-[10px] font-black text-gray-400 uppercase">Tổng mượn gốc</p>
              <p className="text-lg font-black text-gray-900">{Number(d.total_amount).toLocaleString('vi-VN')}{unit}</p>
           </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
           <div className="flex justify-between items-end mb-2">
             <span className="text-[10px] font-black uppercase text-gray-500">Còn lại nợ gốc:</span>
             <span className={`text-2xl font-black ${isDone ? 'text-green-500' : 'text-red-500'}`}>{Number(d.remaining_amount).toLocaleString('vi-VN')}{unit}</span>
           </div>
           <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden"><div className="bg-emerald-500 h-full transition-all" style={{ width: `${progress}%` }}></div></div>
        </div>

        {/* HIỂN THỊ CHI TIẾT NGÀY & TIỀN LÃI */}
        {!isDone && d.interest_day && isMoney && (
           <div className="flex flex-col gap-1 bg-orange-50 text-orange-800 p-3 rounded-xl border border-orange-100 text-xs font-bold">
              <div className="flex items-center gap-2">
                 <CalendarClock size={16}/> Lịch đóng lãi tiếp theo: <span className="font-black underline">{getNextInterestDate(d.interest_day)}</span>
              </div>
              {d.interest_amount > 0 && (
                 <div className="ml-6 text-[10px] uppercase font-black text-orange-600 tracking-widest">
                    Mỗi tháng: {Number(d.interest_amount).toLocaleString('vi-VN')} VNĐ
                 </div>
              )}
           </div>
        )}

        <div className="flex gap-2 mt-2">
           {!isDone && (
             <button onClick={onPay} className="flex-1 bg-gray-900 hover:bg-black text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-colors shadow-md">Ghi chép</button>
           )}
           <button onClick={onHistory} className="flex-none bg-white border-2 border-gray-100 hover:bg-gray-50 text-gray-600 p-3 rounded-xl transition-colors title='Xem lịch sử đóng lãi/trả gốc'"><History size={18}/></button>
        </div>
      </div>
    )
  }
}   
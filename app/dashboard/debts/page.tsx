'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'
import { 
  Landmark, Users, HandCoins, History, X, PlusCircle, 
  Wallet, CheckCircle2, AlertCircle, CalendarClock, ArrowRightLeft,
  Pencil, Trash2, ArrowRightCircle
} from 'lucide-react'

export default function DebtsPage() {
  const [debts, setDebts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedPerson, setSelectedPerson] = useState<any>(null) 
  const [paymentModal, setPaymentModal] = useState<any>(null) 
  const [editingDebt, setEditingDebt] = useState<any>(null) 

  const [form, setForm] = useState({
    target_name: '', debt_type: 'vay_vao', item_type: 'tien',
    total_amount: '', interest_day: '', interest_amount: '', note: '', start_date: new Date().toISOString().split('T')[0]
  })

  const [editForm, setEditForm] = useState({
    target_name: '', debt_type: 'vay_vao', item_type: 'tien',
    total_amount: '', interest_day: '', interest_amount: '', note: '', start_date: ''
  })

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

  const groupedDebts = useMemo(() => {
    const groups: Record<string, any> = {}
    
    debts.forEach(d => {
      const rawName = d.target_name || 'Không tên'
      const cleanName = rawName.trim()
      const nameKey = cleanName.toLowerCase()
      const groupKey = `${nameKey}_${d.debt_type}_${d.item_type}` 

      if (!groups[groupKey]) {
        groups[groupKey] = {
          groupKey,
          displayName: cleanName,
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

    return Object.values(groups).sort((a, b) => b.totalRemaining - a.totalRemaining)
  }, [debts])

  const handleAddDebt = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const amount = Number(form.total_amount)
    
    const { data, error } = await supabase.from('debts').insert([{
      target_name: form.target_name.trim(),
      debt_type: form.debt_type,
      item_type: form.item_type,
      total_amount: amount,
      remaining_amount: amount, 
      interest_day: form.interest_day ? Number(form.interest_day) : null,
      interest_amount: form.interest_amount ? Number(form.interest_amount) : 0,
      note: form.note,
      created_at: form.start_date ? new Date(form.start_date).toISOString() : new Date().toISOString()
    }]).select()

    if (error) {
      alert("Lỗi khi ghi nợ: " + error.message)
      setLoading(false)
      return
    }

    if (data && data.length > 0) {
      const newRecord = { ...data[0], debt_transactions: [] }
      setDebts(prev => [newRecord, ...prev]) 
    }

    setForm({ target_name: '', debt_type: 'vay_vao', item_type: 'tien', total_amount: '', interest_day: '', interest_amount: '', note: '', start_date: new Date().toISOString().split('T')[0] })
    setShowAddForm(false)
    setLoading(false)
  }

  const openEditModal = (d: any) => {
    setEditingDebt(d);
    setEditForm({
      target_name: d.target_name, debt_type: d.debt_type, item_type: d.item_type,
      total_amount: d.total_amount.toString(),
      interest_day: d.interest_day ? d.interest_day.toString() : '',
      interest_amount: d.interest_amount ? d.interest_amount.toString() : '',
      note: d.note || '',
      start_date: d.created_at ? new Date(d.created_at).toISOString().split('T')[0] : ''
    });
  }

  const handleUpdateDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const newTotal = Number(editForm.total_amount);
    const diff = newTotal - Number(editingDebt.total_amount);
    let newRemaining = Number(editingDebt.remaining_amount) + diff;
    const newStatus = newRemaining <= 0 ? 'hoan_tat' : 'dang_no';

    const updatedFields = {
      target_name: editForm.target_name.trim(),
      total_amount: newTotal,
      remaining_amount: newRemaining < 0 ? 0 : newRemaining,
      interest_day: editForm.interest_day ? Number(editForm.interest_day) : null,
      interest_amount: editForm.interest_amount ? Number(editForm.interest_amount) : 0,
      note: editForm.note,
      created_at: editForm.start_date ? new Date(editForm.start_date).toISOString() : new Date().toISOString(),
      status: newStatus
    };

    const { error } = await supabase.from('debts').update(updatedFields).eq('id', editingDebt.id);

    if (!error) {
      setDebts(prev => prev.map(d => d.id === editingDebt.id ? { ...d, ...updatedFields } : d));
    }

    setEditingDebt(null);
    setSelectedPerson(null);
    setLoading(false);
  }

  const handleDeleteDebt = async (id: string) => {
    if (confirm("Sếp Duy chắc chắn muốn xóa hẳn món nợ này? Mất luôn lịch sử trả nợ đấy!")) {
      setLoading(true);
      const { error } = await supabase.from('debts').delete().eq('id', id);
      if (!error) {
         setDebts(prev => prev.filter(d => d.id !== id));
      }
      setSelectedPerson(null);
      setLoading(false);
    }
  }

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const payAmount = Number(payForm.amount)
    
    const { data: newTx } = await supabase.from('debt_transactions').insert([{
      debt_id: paymentModal.id,
      amount: payAmount, 
      transaction_type: payForm.transaction_type,
      transaction_date: payForm.transaction_date,
      note: payForm.note
    }]).select()

    let newRemaining = Number(paymentModal.remaining_amount);
    let newStatus = paymentModal.status;

    if (payForm.transaction_type === 'tra_goc') {
       newRemaining = newRemaining - payAmount;
       if (newRemaining < 0) newRemaining = 0;
       newStatus = newRemaining <= 0 ? 'hoan_tat' : 'dang_no';

       await supabase.from('debts').update({
         remaining_amount: newRemaining,
         status: newStatus
       }).eq('id', paymentModal.id)
    }

    setDebts(prev => prev.map(d => {
       if (d.id === paymentModal.id) {
           return {
               ...d,
               remaining_amount: newRemaining,
               status: newStatus,
               debt_transactions: newTx ? [...(d.debt_transactions || []), newTx[0]] : d.debt_transactions
           }
       }
       return d;
    }))

    setPayForm({ amount: '', transaction_type: 'tra_goc', transaction_date: new Date().toISOString().split('T')[0], note: '' })
    setPaymentModal(null); 
    setSelectedPerson(null);
    setLoading(false)
  }

  const getNextInterestDate = (day: number) => {
    const today = new Date();
    const currentDay = today.getDate();
    const month = currentDay > day ? today.getMonth() + 2 : today.getMonth() + 1;
    const finalMonth = month > 12 ? 1 : month;
    const year = month > 12 ? today.getFullYear() + 1 : today.getFullYear();
    return `Ngày ${day}/${finalMonth}/${year}`;
  }

  if (loading && debts.length === 0) return <div className="p-10 text-center font-bold text-gray-400 animate-pulse uppercase tracking-widest text-xs">Đang mở sổ công nợ...</div>

  return (
    <div className="p-3 md:p-8 space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto pb-24 font-sans bg-gray-50 min-h-screen">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-900 text-white p-6 md:p-8 rounded-[24px] md:rounded-[40px] shadow-xl gap-4">
        <div>
          <h1 className="text-xl md:text-3xl font-black uppercase tracking-tight flex items-center gap-2"><Landmark size={24} className="text-blue-400"/> Quản lý Công Nợ</h1>
          <p className="text-gray-400 font-medium text-[10px] md:text-xs uppercase tracking-widest mt-1">Gộp nhóm thông minh • Hiển thị tức thời</p>
        </div>
        <button onClick={() => setShowAddForm(!showAddForm)} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 px-5 py-3 rounded-xl font-black shadow-md uppercase text-[10px] md:text-xs flex justify-center items-center gap-2 transition-all">
          {showAddForm ? 'Đóng Form' : <><PlusCircle size={16}/> Thêm Khoản Vay</>}
        </button>
      </div>

      {/* FORM THÊM NỢ (ĐÃ PHỤC HỒI NHẮC LÃI + GHI CHÚ) */}
      {showAddForm && (
        <form onSubmit={handleAddDebt} className="bg-white p-6 md:p-8 rounded-[24px] md:rounded-[30px] border border-gray-200 shadow-sm space-y-5 animate-in slide-in-from-top-2">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-4 bg-gray-50 p-5 rounded-2xl border border-gray-100">
                 <h3 className="font-bold text-gray-800 uppercase text-xs border-b pb-2">1. Phân loại mượn</h3>
                 <div className="flex flex-col gap-3">
                    <label className="flex items-center gap-2 font-bold cursor-pointer text-red-600 text-sm"><input type="radio" checked={form.debt_type === 'vay_vao'} onChange={() => setForm({...form, debt_type: 'vay_vao'})} className="accent-red-500 w-4 h-4"/> Mình Đi Vay (Nợ người ta)</label>
                    <label className="flex items-center gap-2 font-bold cursor-pointer text-blue-600 text-sm"><input type="radio" checked={form.debt_type === 'cho_vay'} onChange={() => setForm({...form, debt_type: 'cho_vay'})} className="accent-blue-500 w-4 h-4"/> Mình Cho Vay (Người ta nợ)</label>
                 </div>
                 <div className="flex gap-4 pt-2 border-t border-dashed border-gray-200 mt-2">
                    <label className="flex items-center gap-2 font-bold cursor-pointer text-gray-600 text-xs"><input type="radio" checked={form.item_type === 'tien'} onChange={() => setForm({...form, item_type: 'tien'})} className="w-3.5 h-3.5"/> Tiền (VNĐ)</label>
                    <label className="flex items-center gap-2 font-bold cursor-pointer text-orange-600 text-xs"><input type="radio" checked={form.item_type === 'yen'} onChange={() => setForm({...form, item_type: 'yen'})} className="w-3.5 h-3.5"/> Yến (Kg)</label>
                 </div>
              </div>
              <div className="space-y-4">
                 <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Tên đối tác (Nhập đúng để gộp nhóm)</label>
                    <input required placeholder="VD: Mẹ, Cake Bank, Cha..." className="w-full border border-gray-300 rounded-xl p-3 font-bold text-sm outline-none focus:border-blue-500 bg-white" value={form.target_name} onChange={e => setForm({...form, target_name: e.target.value})} />
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Số tiền/Số Kg</label>
                        <input required type="number" step="0.001" className="w-full border border-gray-300 rounded-xl p-3 font-black text-blue-800 outline-none focus:border-blue-500 bg-blue-50" value={form.total_amount} onChange={e => setForm({...form, total_amount: e.target.value})} />
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Ngày bắt đầu</label>
                        <input required type="date" className="w-full border border-gray-300 rounded-xl p-3 font-bold text-sm outline-none focus:border-blue-500 bg-white" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} />
                    </div>
                 </div>
              </div>
           </div>

           {/* --- HÀNG LÃI SUẤT ĐÃ ĐƯỢC PHỤC HỒI --- */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-100">
              <div>
                 <label className="text-[10px] font-black uppercase text-gray-500 ml-1">Ngày đóng lãi (1-31)</label>
                 <input type="number" min="1" max="31" placeholder="VD: 15" className="w-full border border-gray-300 rounded-xl p-3 font-bold text-sm outline-none mt-1 focus:border-blue-500" value={form.interest_day} onChange={e => setForm({...form, interest_day: e.target.value})} />
              </div>
              <div>
                 <label className="text-[10px] font-black uppercase text-orange-500 ml-1">Tiền lãi mỗi tháng (VNĐ)</label>
                 <input type="number" placeholder="VD: 2000000" className="w-full border border-orange-200 rounded-xl p-3 font-bold text-sm outline-none mt-1 bg-orange-50 focus:border-orange-500" value={form.interest_amount} onChange={e => setForm({...form, interest_amount: e.target.value})} disabled={form.item_type === 'yen'} />
              </div>
              <div>
                 <label className="text-[10px] font-black uppercase text-gray-500 ml-1">Ghi chú (Tùy chọn)</label>
                 <input placeholder="VD: Thế chấp..." className="w-full border border-gray-300 rounded-xl p-3 font-medium text-sm outline-none mt-1 focus:border-blue-500" value={form.note} onChange={e => setForm({...form, note: e.target.value})} />
              </div>
           </div>

           <button type="submit" disabled={loading} className="w-full bg-gray-900 text-white font-black rounded-xl py-4 uppercase tracking-widest text-[11px] hover:bg-black transition-all disabled:opacity-50 mt-4 shadow-md">
             {loading ? 'Đang xử lý...' : 'Ghi vào sổ'}
           </button>
        </form>
      )}

      {/* DANH SÁCH THẺ BÀI GỘP NHÓM */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
         <div className="space-y-3">
            <h2 className="text-sm font-black text-red-700 uppercase px-2 flex items-center gap-2"><HandCoins size={16}/> Khoản Mình Đang Nợ</h2>
            {groupedDebts.filter(g => g.debt_type === 'vay_vao' && g.totalRemaining > 0).map(group => (
               <GroupCard key={group.groupKey} group={group} onClick={() => setSelectedPerson(group)} />
            ))}
            {groupedDebts.filter(g => g.debt_type === 'vay_vao' && g.totalRemaining > 0).length === 0 && <p className="text-center text-gray-400 py-6 border-2 border-dashed rounded-2xl text-[10px] font-bold">Không có nợ vay.</p>}
         </div>

         <div className="space-y-3">
            <h2 className="text-sm font-black text-blue-800 uppercase px-2 flex items-center gap-2"><Users size={16}/> Khoản Cho Người Ta Mượn</h2>
            {groupedDebts.filter(g => g.debt_type === 'cho_vay' && g.totalRemaining > 0).map(group => (
               <GroupCard key={group.groupKey} group={group} onClick={() => setSelectedPerson(group)} />
            ))}
            {groupedDebts.filter(g => g.debt_type === 'cho_vay' && g.totalRemaining > 0).length === 0 && <p className="text-center text-gray-400 py-6 border-2 border-dashed rounded-2xl text-[10px] font-bold">Không có nợ cho vay.</p>}
         </div>
      </div>

      {/* POPUP CHI TIẾT */}
      {selectedPerson && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-4 backdrop-blur-sm animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:fade-in">
          <div className="bg-white w-full sm:max-w-2xl max-h-[85vh] rounded-t-[30px] sm:rounded-[30px] flex flex-col shadow-2xl relative">
            
            <div className="p-5 md:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-[30px]">
               <div>
                  <h2 className="text-lg md:text-xl font-black text-gray-900 capitalize tracking-tight">{selectedPerson.displayName}</h2>
                  <p className="text-[10px] font-bold text-gray-500 mt-1 uppercase">Tổng dư nợ: {selectedPerson.totalRemaining.toLocaleString('vi-VN')} {selectedPerson.item_type === 'tien' ? 'đ' : 'kg'}</p>
               </div>
               <button onClick={() => setSelectedPerson(null)} className="p-2 bg-white rounded-full shadow-sm border border-gray-200"><X size={18}/></button>
            </div>

            <div className="overflow-y-auto p-4 space-y-4 custom-scrollbar flex-1">
               {selectedPerson.items.map((item: any, index: number) => {
                  const isPaidOff = Number(item.remaining_amount) <= 0;
                  const unit = item.item_type === 'tien' ? 'đ' : 'kg';

                  return (
                     <div key={item.id} className={`p-4 rounded-[20px] border ${isPaidOff ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-white border-blue-100 shadow-sm'}`}>
                        <div className="flex justify-between items-start mb-3 border-b border-gray-50 pb-2">
                           <div>
                              <p className="text-xs font-bold text-gray-900">Món thứ {selectedPerson.items.length - index} <span className="text-[10px] text-gray-400 ml-1">({new Date(item.created_at).toLocaleDateString('vi-VN')})</span></p>
                              {item.note && <p className="text-[10px] text-gray-500 italic mt-0.5">{item.note}</p>}
                           </div>
                           <div className="flex gap-2">
                              <button onClick={() => openEditModal(item)} className="text-gray-400 hover:text-blue-600"><Pencil size={14}/></button>
                              <button onClick={() => handleDeleteDebt(item.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14}/></button>
                           </div>
                        </div>

                        <div className="flex justify-between items-end mb-3">
                           <div>
                              <p className="text-[10px] text-gray-400 font-bold uppercase">Gốc: {Number(item.total_amount).toLocaleString('vi-VN')}{unit}</p>
                              <p className={`text-sm font-black mt-0.5 ${selectedPerson.debt_type === 'vay_vao' ? 'text-red-600' : 'text-emerald-600'}`}>Còn lại: {Number(item.remaining_amount).toLocaleString('vi-VN')}{unit}</p>
                           </div>
                           {!isPaidOff ? (
                              <button onClick={() => { setPaymentModal(item); setPayForm({...payForm, amount: item.remaining_amount.toString()}) }} className="bg-gray-900 text-white text-[10px] font-black px-3 py-2 rounded-lg uppercase shadow-md">Ghi Trả</button>
                           ) : (
                              <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded border">ĐÃ XONG</span>
                           )}
                        </div>

                        {!isPaidOff && item.interest_day && item.item_type === 'tien' && (
                           <div className="flex items-center gap-2 bg-orange-50 text-orange-700 text-[10px] font-bold p-2.5 rounded-xl border border-orange-100 mt-2">
                              <CalendarClock size={12}/> Đóng lãi {Number(item.interest_amount).toLocaleString('vi-VN')}đ vào {getNextInterestDate(item.interest_day)}
                           </div>
                        )}

                        {/* Lịch sử trả nợ nhỏ lẻ */}
                        {item.debt_transactions && item.debt_transactions.length > 0 && (
                           <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 mt-3 space-y-1.5">
                              {item.debt_transactions.sort((a:any, b:any) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()).map((tx: any) => (
                                 <div key={tx.id} className="flex justify-between items-center text-[10px] border-b border-gray-200 last:border-0 pb-1.5 last:pb-0">
                                    <div className="flex items-center gap-1.5 text-gray-500">
                                      <span className={`px-1 rounded text-[8px] font-black uppercase ${tx.transaction_type === 'tra_lai' ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                        {tx.transaction_type === 'tra_lai' ? 'Lãi' : 'Gốc'}
                                      </span>
                                      {new Date(tx.transaction_date).toLocaleDateString('vi-VN')}
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

      {/* MODAL GHI CHÉP GIAO DỊCH */}
      {paymentModal && (
         <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
            <form onSubmit={handlePayment} className="bg-white p-6 md:p-8 rounded-[30px] w-full max-w-sm shadow-2xl relative animate-in zoom-in-95">
               <button type="button" onClick={() => setPaymentModal(null)} className="absolute top-5 right-5 text-gray-400"><X size={18}/></button>
               <h3 className="font-black text-lg text-gray-900 mb-5 flex items-center gap-2"><ArrowRightLeft className="text-blue-500" size={20}/> Thu / Chi nợ</h3>
               <div className="space-y-4">
                  <div className="flex gap-2">
                      <label className="flex-1 text-center border-2 p-2.5 rounded-xl cursor-pointer font-bold text-xs has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 transition-all">
                        <input type="radio" className="hidden" checked={payForm.transaction_type === 'tra_goc'} onChange={() => setPayForm({...payForm, transaction_type: 'tra_goc', amount: paymentModal.remaining_amount.toString()})} /> Trừ Gốc
                      </label>
                      {paymentModal.item_type === 'tien' && paymentModal.interest_day && (
                        <label className="flex-1 text-center border-2 p-2.5 rounded-xl cursor-pointer font-bold text-xs has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50 transition-all">
                           <input type="radio" className="hidden" checked={payForm.transaction_type === 'tra_lai'} onChange={() => setPayForm({...payForm, transaction_type: 'tra_lai', amount: paymentModal.interest_amount?.toString() || ''})} /> Đóng Lãi
                        </label>
                      )}
                  </div>
                  <input required type="number" placeholder="Nhập số..." className="w-full border-2 border-blue-100 bg-blue-50 rounded-xl p-3 font-black text-xl text-blue-800 outline-none focus:border-blue-500 text-center" value={payForm.amount} onChange={e => setPayForm({...payForm, amount: e.target.value})} />
                  <button type="submit" disabled={loading} className="w-full bg-gray-900 text-white font-black rounded-xl py-4 uppercase tracking-widest text-[10px] shadow-md disabled:opacity-50">
                    {loading ? 'Đang xử lý...' : 'Xác nhận giao dịch'}
                  </button>
               </div>
            </form>
         </div>
      )}

      {/* MODAL SỬA THÔNG TIN GỐC */}
      {editingDebt && (
        <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-[30px] p-6 w-full max-w-md shadow-2xl relative animate-in zoom-in-95">
            <button onClick={() => setEditingDebt(null)} className="absolute top-5 right-5 bg-gray-100 p-1.5 rounded-full text-gray-500"><X size={18}/></button>
            <h2 className="text-lg font-black uppercase mb-4 text-gray-900 border-b pb-3">Sửa thông tin nợ</h2>
            <form onSubmit={handleUpdateDebt} className="space-y-4">
               <input required placeholder="Tên đối tác" className="w-full border border-gray-200 rounded-xl p-3 font-bold text-sm outline-none focus:border-blue-500" value={editForm.target_name} onChange={e => setEditForm({...editForm, target_name: e.target.value})} />
               <div className="grid grid-cols-2 gap-3">
                  <input required type="number" step="0.001" placeholder="Số mượn gốc" className="w-full border-2 border-blue-100 bg-blue-50 rounded-xl p-3 font-black text-lg outline-none focus:border-blue-500" value={editForm.total_amount} onChange={e => setEditForm({...editForm, total_amount: e.target.value})} />
                  <input required type="date" className="w-full border border-gray-200 rounded-xl p-3 font-bold text-sm outline-none" value={editForm.start_date} onChange={e => setEditForm({...editForm, start_date: e.target.value})} />
               </div>
               <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-black rounded-xl py-3.5 uppercase text-xs shadow-md disabled:opacity-50">
                 {loading ? 'Đang lưu...' : 'Lưu Thay Đổi'}
               </button>
            </form>
          </div>
        </div>
      )}

    </div>
  )

  function GroupCard({ group, onClick }: any) {
    const isMoney = group.item_type === 'tien';
    const unit = isMoney ? 'đ' : 'kg';

    return (
      <div onClick={onClick} className="bg-white p-4 md:p-5 rounded-[24px] border border-gray-200 shadow-sm hover:border-blue-300 transition-all cursor-pointer flex items-center justify-between group/card active:scale-[0.98]">
         <div className="flex items-center gap-3">
            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center shrink-0 ${group.debt_type === 'vay_vao' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
               <Wallet size={20}/>
            </div>
            <div>
               <h3 className="text-sm md:text-base font-black text-gray-900 capitalize leading-tight truncate max-w-[120px] md:max-w-[200px]">{group.displayName}</h3>
               <p className="text-[9px] text-gray-400 font-bold bg-gray-50 px-2 py-0.5 rounded inline-block mt-1 border border-gray-100 uppercase">{group.items.length} món mượn {isMoney ? 'Tiền' : 'Yến'}</p>
            </div>
         </div>
         <div className="text-right flex items-center gap-2 md:gap-3">
            <div className="flex flex-col items-end">
               <p className="text-[8px] font-bold text-gray-400 uppercase mb-0.5 tracking-widest">Dư nợ</p>
               <p className={`text-base md:text-xl font-black tracking-tighter ${group.debt_type === 'vay_vao' ? 'text-red-600' : 'text-blue-600'}`}>
                  {group.totalRemaining.toLocaleString('vi-VN')}<span className="text-[10px] ml-0.5">{unit}</span>
               </p>
            </div>
            <ArrowRightCircle className="text-gray-200 group-hover/card:text-blue-500 transition-colors shrink-0" size={20}/>
         </div>
      </div>
    )
  }
}
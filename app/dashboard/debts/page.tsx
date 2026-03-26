'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db' 
import { 
  Landmark, Users, HandCoins, History, X, PlusCircle, 
  Wallet, AlertCircle, ArrowRightLeft, Pencil, Trash2, 
  ArrowRightCircle, ArrowDownCircle, ArrowUpCircle, Package
} from 'lucide-react'

export default function DebtsPage() {
  const [debts, setDebts] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedPerson, setSelectedPerson] = useState<any>(null) 
  
  const [form, setForm] = useState({
    target_name: '', debt_type: 'vay_vao', item_type: 'tien',
    total_amount: '', note: '', start_date: new Date().toISOString().split('T')[0]
  })

  const [payForm, setPayForm] = useState({
    amount: '', action_type: 'tra_no', transaction_date: new Date().toISOString().split('T')[0], note: ''
  })

  const fetchData = async () => {
    setLoading(true)
    const [debtsRes, txRes] = await Promise.all([
      supabase.from('debts').select('*').order('created_at', { ascending: false }),
      supabase.from('debt_transactions').select('*').order('transaction_date', { ascending: false })
    ])
    if (debtsRes.data) setDebts(debtsRes.data)
    if (txRes.data) setTransactions(txRes.data)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

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
          totalRemaining: 0,
          originalDebts: [], 
        }
      }
      
      groups[groupKey].totalRemaining += Number(d.remaining_amount || 0)
      groups[groupKey].originalDebts.push(d)
    })

    return Object.values(groups).sort((a, b) => b.totalRemaining - a.totalRemaining)
  }, [debts])

  const getPersonTransactions = (group: any) => {
    const debtIds = group.originalDebts.map((d: any) => d.id);
    return transactions.filter(tx => debtIds.includes(tx.debt_id)).sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());
  }

  const handleAddDebt = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const amount = Number(form.total_amount)
    
    const newDebtData = {
      target_name: form.target_name.trim(),
      debt_type: form.debt_type,
      item_type: form.item_type,
      total_amount: amount,
      remaining_amount: amount, 
      note: form.note,
      status: 'dang_no',
      created_at: form.start_date ? new Date(form.start_date).toISOString() : new Date().toISOString()
    }

    const { data, error, isOffline } = await db.insert('debts', newDebtData)

    if (error) {
      alert("Lỗi khi ghi nợ: " + error.message)
    } else {
      if (data && data[0]) {
        setDebts(prev => [data[0], ...prev])
      }
      if (isOffline) alert("⚠️ Đang mất mạng! Đã cất tạm vào điện thoại.");
    }

    setForm({ target_name: '', debt_type: 'vay_vao', item_type: 'tien', total_amount: '', note: '', start_date: new Date().toISOString().split('T')[0] })
    setShowAddForm(false)
    setLoading(false)
  }

  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!navigator.onLine) {
      alert("🛑 Vui lòng bật 4G/Wifi để thực hiện giao dịch mượn/trả!");
      return;
    }
    if (!selectedPerson || selectedPerson.originalDebts.length === 0) return;

    setLoading(true)
    const txAmount = Number(payForm.amount)
    
    const representativeDebt = selectedPerson.originalDebts[0]; 
    let newRemaining = Number(representativeDebt.remaining_amount);

    if (payForm.action_type === 'muon_them') {
        newRemaining += txAmount; 
    } else if (payForm.action_type === 'tra_no') {
        newRemaining -= txAmount; 
        if (newRemaining < 0) newRemaining = 0; 
    }

    await supabase.from('debts').update({
        remaining_amount: newRemaining,
        status: newRemaining <= 0 ? 'hoan_tat' : 'dang_no'
    }).eq('id', representativeDebt.id);

    const txTypeToSave = payForm.action_type === 'muon_them' ? 'vay_them' : 'tra_goc';

    const { data: newTx } = await supabase.from('debt_transactions').insert([{
      debt_id: representativeDebt.id,
      amount: txAmount, 
      transaction_type: txTypeToSave, 
      transaction_date: payForm.transaction_date,
      note: payForm.note
    }]).select()

    setDebts(prev => prev.map(d => d.id === representativeDebt.id ? { ...d, remaining_amount: newRemaining } : d))
    if (newTx) setTransactions(prev => [newTx[0], ...prev])

    setSelectedPerson({
        ...selectedPerson,
        totalRemaining: selectedPerson.totalRemaining + (payForm.action_type === 'muon_them' ? txAmount : -txAmount),
        originalDebts: selectedPerson.originalDebts.map((d:any) => d.id === representativeDebt.id ? {...d, remaining_amount: newRemaining} : d)
    })

    setPayForm({ amount: '', action_type: 'tra_no', transaction_date: new Date().toISOString().split('T')[0], note: '' })
    setLoading(false)
  }

  const handleDeleteTransaction = async (tx: any, representativeDebtId: string) => {
    if (!navigator.onLine) return alert("🛑 Vui lòng bật 4G/Wifi!");
    if (!confirm("Hủy bỏ giao dịch này? Số dư nợ sẽ được hoàn lại như cũ!")) return;
    
    setLoading(true);
    await supabase.from('debt_transactions').delete().eq('id', tx.id);

    const targetDebt = debts.find(d => d.id === representativeDebtId);
    if (targetDebt) {
        let revertRemaining = Number(targetDebt.remaining_amount);
        if (tx.transaction_type === 'vay_them') {
            revertRemaining -= Number(tx.amount); 
        } else if (tx.transaction_type === 'tra_goc') {
            revertRemaining += Number(tx.amount); 
        }
        if (revertRemaining < 0) revertRemaining = 0;

        await supabase.from('debts').update({ remaining_amount: revertRemaining }).eq('id', representativeDebtId);
        
        setDebts(prev => prev.map(d => d.id === representativeDebtId ? { ...d, remaining_amount: revertRemaining } : d));
        setTransactions(prev => prev.filter(t => t.id !== tx.id));
        
        setSelectedPerson({
            ...selectedPerson,
            totalRemaining: selectedPerson.totalRemaining + (tx.transaction_type === 'vay_them' ? -Number(tx.amount) : Number(tx.amount)),
            originalDebts: selectedPerson.originalDebts.map((d:any) => d.id === representativeDebtId ? {...d, remaining_amount: revertRemaining} : d)
        })
    }
    setLoading(false);
  }

  const handleDeletePerson = async (group: any) => {
    if (!navigator.onLine) return alert("🛑 Vui lòng bật 4G!");
    if (!confirm(`Cảnh báo: XÓA SẠCH toàn bộ nợ và lịch sử của [${group.displayName}]? Không thể khôi phục!`)) return;
    
    setLoading(true);
    const debtIds = group.originalDebts.map((d: any) => d.id);
    await supabase.from('debts').delete().in('id', debtIds);
    setDebts(prev => prev.filter(d => !debtIds.includes(d.id)));
    setSelectedPerson(null);
    setLoading(false);
  }

  if (loading && debts.length === 0) return <div className="p-10 text-center font-bold text-gray-400 animate-pulse uppercase tracking-widest text-xs">Đang mở sổ công nợ...</div>

  return (
    <div className="p-3 md:p-8 space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto pb-24 font-sans bg-gray-50 min-h-screen">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-900 text-white p-6 md:p-8 rounded-[24px] md:rounded-[40px] shadow-xl gap-4">
        <div>
          <h1 className="text-xl md:text-3xl font-black uppercase tracking-tight flex items-center gap-2"><Landmark size={24} className="text-blue-400"/> Quản lý Công Nợ</h1>
          <p className="text-gray-400 font-medium text-[10px] md:text-xs uppercase tracking-widest mt-1">Hệ thống Tổng Dư Nợ Thông Minh</p>
        </div>
        <button onClick={() => setShowAddForm(!showAddForm)} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 px-5 py-3 rounded-xl font-black shadow-md uppercase text-[10px] md:text-xs flex justify-center items-center gap-2 transition-all">
          {showAddForm ? 'Đóng Form' : <><PlusCircle size={16}/> Thêm Đối Tác Nợ</>}
        </button>
      </div>

      {/* FORM THÊM ĐỐI TÁC NỢ MỚI */}
      {showAddForm && (
        <form onSubmit={handleAddDebt} className="bg-white p-6 md:p-8 rounded-[24px] md:rounded-[30px] border border-gray-200 shadow-sm space-y-5 animate-in slide-in-from-top-2">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-4 bg-gray-50 p-5 rounded-2xl border border-gray-100">
                 <h3 className="font-bold text-gray-800 uppercase text-xs border-b pb-2">1. Phân loại đối tác</h3>
                 <div className="flex flex-col gap-3">
                    <label className="flex items-center gap-2 font-bold cursor-pointer text-red-600 text-sm"><input type="radio" checked={form.debt_type === 'vay_vao'} onChange={() => setForm({...form, debt_type: 'vay_vao'})} className="accent-red-500 w-4 h-4"/> Mình Nợ Người Ta</label>
                    <label className="flex items-center gap-2 font-bold cursor-pointer text-blue-600 text-sm"><input type="radio" checked={form.debt_type === 'cho_vay'} onChange={() => setForm({...form, debt_type: 'cho_vay'})} className="accent-blue-500 w-4 h-4"/> Người Ta Nợ Mình</label>
                 </div>
                 <div className="flex gap-4 pt-2 border-t border-dashed border-gray-200 mt-2">
                    <label className="flex items-center gap-2 font-bold cursor-pointer text-gray-600 text-xs"><input type="radio" checked={form.item_type === 'tien'} onChange={() => setForm({...form, item_type: 'tien'})} className="w-3.5 h-3.5"/> Tiền (VNĐ)</label>
                    <label className="flex items-center gap-2 font-bold cursor-pointer text-orange-600 text-xs"><input type="radio" checked={form.item_type === 'yen'} onChange={() => setForm({...form, item_type: 'yen'})} className="w-3.5 h-3.5"/> Yến (Kg)</label>
                 </div>
              </div>
              <div className="space-y-4">
                 <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Tên đối tác (VD: Mẹ, Anh Hai...)</label>
                    <input required placeholder="Gõ tên..." className="w-full border border-gray-300 rounded-xl p-3 font-bold text-sm outline-none focus:border-blue-500 bg-white" value={form.target_name} onChange={e => setForm({...form, target_name: e.target.value})} />
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Dư Nợ Ban Đầu</label>
                        <input required type="number" step="0.001" className="w-full border border-gray-300 rounded-xl p-3 font-black text-blue-800 outline-none focus:border-blue-500 bg-blue-50" value={form.total_amount} onChange={e => setForm({...form, total_amount: e.target.value})} />
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Ngày lập sổ</label>
                        <input required type="date" className="w-full border border-gray-300 rounded-xl p-3 font-bold text-sm outline-none focus:border-blue-500 bg-white" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} />
                    </div>
                 </div>
              </div>
           </div>
           <button type="submit" disabled={loading} className="w-full bg-gray-900 text-white font-black rounded-xl py-4 uppercase tracking-widest text-[11px] hover:bg-black transition-all disabled:opacity-50 mt-4 shadow-md">
             {loading ? 'Đang xử lý...' : 'Tạo Sổ Nợ Mới'}
           </button>
        </form>
      )}

      {/* DANH SÁCH THẺ BÀI GỘP NHÓM TỔNG NỢ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
         <div className="space-y-3">
            <h2 className="text-sm font-black text-red-700 uppercase px-2 flex items-center gap-2"><HandCoins size={16}/> Khoản Mình Đang Nợ</h2>
            {groupedDebts.filter(g => g.debt_type === 'vay_vao' && g.totalRemaining > 0).map(group => (
               <GroupCard key={group.groupKey} group={group} onClick={() => setSelectedPerson(group)} />
            ))}
         </div>

         <div className="space-y-3">
            <h2 className="text-sm font-black text-blue-800 uppercase px-2 flex items-center gap-2"><Users size={16}/> Khoản Người Ta Nợ Mình</h2>
            {groupedDebts.filter(g => g.debt_type === 'cho_vay' && g.totalRemaining > 0).map(group => (
               <GroupCard key={group.groupKey} group={group} onClick={() => setSelectedPerson(group)} />
            ))}
         </div>
      </div>

      {/* MODAL CHI TIẾT TỔNG DƯ NỢ */}
      {selectedPerson && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-gray-50 w-full sm:max-w-md max-h-[90vh] rounded-[30px] flex flex-col shadow-2xl relative overflow-hidden border border-gray-200">
            
            {/* HEADER CỦA BẢNG NỢ */}
            <div className="bg-gray-900 text-white p-6 relative rounded-b-[20px] shadow-md z-10 shrink-0">
               <button onClick={() => setSelectedPerson(null)} className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"><X size={18}/></button>
               <h2 className="text-2xl font-black uppercase tracking-tight">{selectedPerson.displayName}</h2>
               <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-widest">Sổ Quản Lý Dư Nợ</p>
               
               <div className="mt-6 flex flex-col items-center justify-center bg-gray-800/50 p-4 rounded-2xl border border-gray-700">
                  <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Tổng Dư Nợ Hiện Tại</p>
                  <p className={`text-4xl font-black tracking-tighter ${selectedPerson.debt_type === 'vay_vao' ? 'text-red-400' : 'text-blue-400'}`}>
                     {selectedPerson.totalRemaining.toLocaleString('vi-VN')}
                     <span className="text-sm ml-1">{selectedPerson.item_type === 'tien' ? 'đ' : 'kg'}</span>
                  </p>
               </div>
            </div>

            {/* HAI NÚT BẤM QUYỀN LỰC: MƯỢN THÊM & TRẢ BỚT */}
            <div className="px-6 py-4 bg-white border-b border-gray-200 flex gap-3 shrink-0">
               <button onClick={() => setPayForm({...payForm, action_type: 'muon_them'})} className={`flex-1 py-3 rounded-xl font-black text-xs uppercase flex justify-center items-center gap-1.5 transition-colors ${payForm.action_type === 'muon_them' ? 'bg-red-500 text-white shadow-md' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>
                  <ArrowUpCircle size={16}/> Mượn Thêm
               </button>
               <button onClick={() => setPayForm({...payForm, action_type: 'tra_no'})} className={`flex-1 py-3 rounded-xl font-black text-xs uppercase flex justify-center items-center gap-1.5 transition-colors ${payForm.action_type === 'tra_no' ? 'bg-emerald-500 text-white shadow-md' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>
                  <ArrowDownCircle size={16}/> Trả Nợ
               </button>
            </div>

            {/* FORM NHẬP TIỀN */}
            <div className="px-6 pt-4 pb-4 bg-white shrink-0 shadow-sm z-10 border-b border-gray-200">
               <form onSubmit={handleTransaction} className="flex gap-2 items-start">
                  <div className="flex-1">
                     <input required type="number" step="0.001" placeholder={payForm.action_type === 'muon_them' ? 'Nhập số tiền mượn thêm...' : 'Nhập số tiền trả bớt...'} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-black text-gray-900 outline-none focus:border-blue-500" value={payForm.amount} onChange={e => setPayForm({...payForm, amount: e.target.value})}/>
                     <input type="text" placeholder="Ghi chú (Tùy chọn)" className="w-full bg-transparent border-b border-gray-200 px-2 py-1.5 text-[10px] font-medium outline-none focus:border-blue-500 mt-1 text-gray-500" value={payForm.note} onChange={e => setPayForm({...payForm, note: e.target.value})}/>
                  </div>
                  <button type="submit" disabled={loading || !payForm.amount} className={`w-14 h-12 rounded-xl flex justify-center items-center text-white font-black shadow-md disabled:opacity-50 ${payForm.action_type === 'muon_them' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                     LƯU
                  </button>
               </form>
            </div>

            {/* KHU VỰC CUỘN: CHỨA LỊCH SỬ & CÁC MÓN GỐC */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50 custom-scrollbar space-y-6">
               
               {/* NÚT XÓA SỔ NẰM Ở ĐẦU */}
               <div className="flex justify-end">
                  <button onClick={() => handleDeletePerson(selectedPerson)} className="text-[9px] font-bold text-red-500 hover:text-red-700 flex items-center gap-1 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors border border-red-100"><Trash2 size={12}/> Xóa toàn bộ sổ của {selectedPerson.displayName}</button>
               </div>

               {/* 1. LỊCH SỬ GIAO DỊCH (VAY/TRẢ) */}
               <div>
                  <h3 className="text-[11px] font-black uppercase text-gray-500 mb-3 flex items-center gap-1.5"><ArrowRightLeft size={14}/> Lịch sử Vay / Trả</h3>
                  <div className="space-y-2.5">
                     {getPersonTransactions(selectedPerson).length === 0 ? (
                        <p className="text-center text-gray-400 text-[10px] py-4 font-bold italic border border-dashed border-gray-200 rounded-xl">Chưa có giao dịch thu/chi nào.</p>
                     ) : (
                        getPersonTransactions(selectedPerson).map((tx: any) => {
                           const isAdd = tx.transaction_type === 'vay_them'; 
                           
                           return (
                              <div key={tx.id} className="bg-white p-3 rounded-[16px] border border-gray-100 shadow-sm flex items-center justify-between group">
                                 <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isAdd ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}>
                                       {isAdd ? <ArrowUpCircle size={16}/> : <ArrowDownCircle size={16}/>}
                                    </div>
                                    <div>
                                       <p className="text-xs font-bold text-gray-900">{isAdd ? 'Mượn thêm' : 'Đã trả nợ'}</p>
                                       <div className="flex items-center gap-1 mt-0.5">
                                          <p className="text-[9px] font-bold text-gray-400">{new Date(tx.transaction_date).toLocaleDateString('vi-VN')}</p>
                                          {tx.note && <span className="text-[9px] text-gray-500 truncate max-w-[100px] italic border-l border-gray-200 pl-1">- {tx.note}</span>}
                                       </div>
                                    </div>
                                 </div>
                                 <div className="flex items-center gap-2">
                                    <p className={`text-sm font-black ${isAdd ? 'text-red-600' : 'text-emerald-600'}`}>
                                       {isAdd ? '+' : '-'}{Number(tx.amount).toLocaleString('vi-VN')}
                                    </p>
                                    <button onClick={() => handleDeleteTransaction(tx, selectedPerson.originalDebts[0].id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" title="Xóa giao dịch này (Hoàn tiền)">
                                       <X size={14}/>
                                    </button>
                                 </div>
                              </div>
                           )
                        })
                     )}
                  </div>
               </div>

               {/* 2. CHI TIẾT CÁC MÓN NỢ GỐC BAN ĐẦU */}
               <div>
                  <h3 className="text-[11px] font-black uppercase text-gray-500 mb-3 flex items-center gap-1.5"><Package size={14}/> Bảng kê các khoản nợ gốc</h3>
                  <div className="space-y-2.5">
                     {selectedPerson.originalDebts.sort((a:any, b:any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((item: any, index: number) => {
                        const unit = item.item_type === 'tien' ? 'đ' : 'kg';
                        return (
                           <div key={item.id} className="bg-white p-3.5 rounded-[16px] border border-gray-200 shadow-sm flex justify-between items-center opacity-80 hover:opacity-100 transition-opacity">
                              <div>
                                 <p className="text-xs font-bold text-gray-700">Khởi tạo món nợ</p>
                                 <div className="flex items-center gap-1 mt-1 text-[9px] text-gray-500 font-medium">
                                    <span>{new Date(item.created_at).toLocaleDateString('vi-VN')}</span>
                                    {item.note && <span className="border-l border-gray-300 pl-1 italic">- {item.note}</span>}
                                 </div>
                              </div>
                              <div className="text-right">
                                 <p className="text-sm font-black text-gray-900">{Number(item.total_amount).toLocaleString('vi-VN')}<span className="text-[10px] ml-0.5">{unit}</span></p>
                              </div>
                           </div>
                        )
                     })}
                  </div>
               </div>

            </div>

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
               <p className="text-[9px] text-gray-400 font-bold bg-gray-50 px-2 py-0.5 rounded inline-block mt-1 border border-gray-100 uppercase">SỔ {isMoney ? 'TIỀN' : 'YẾN'}</p>
            </div>
         </div>
         <div className="text-right flex items-center gap-2 md:gap-3">
            <div className="flex flex-col items-end">
               <p className="text-[8px] font-bold text-gray-400 uppercase mb-0.5 tracking-widest">Tổng Dư nợ</p>
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
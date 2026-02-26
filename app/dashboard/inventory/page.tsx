'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  Package, Target, Image as ImageIcon, PlusCircle, History, X, 
  DollarSign, TrendingUp, Scale, Droplet, Truck, Receipt, Wallet,
  CheckCircle2, AlertCircle, Pencil, ListFilter, Trash2
} from 'lucide-react'

export default function InventoryPage() {
  const [batches, setBatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [modalData, setModalData] = useState<{ batch: any, type: string } | null>(null)

  const [form, setForm] = useState({ 
    batch_code: '', cost_per_kg: '', image_url: '', note: '', 
    purchase_date: new Date().toISOString().split('T')[0],
    supplier_name: '', has_receipt: false,
    weight_xo: '', weight_dep: '', weight_vua: '', weight_xau: '' 
  })

  // TRẠNG THÁI CHO TÍNH NĂNG CẬP NHẬT (SỬA FULL LÔ)
  const [editingBatch, setEditingBatch] = useState<any>(null)
  const [editBatchForm, setEditBatchForm] = useState({ 
    batch_code: '', cost_per_kg: '', supplier_name: '', has_receipt: false,
    weight_xo: '', weight_dep: '', weight_vua: '', weight_xau: ''
  })

  const fetchBatches = async () => {
    const { data } = await supabase
      .from('batches')
      .select('*, orders(*, customers(name, phone))')
      .order('created_at', { ascending: false })

    if (data) {
      const processed = data.map((b: any) => {
        const totalPurchaseCost = Number(b.total_weight) * Number(b.cost_per_kg); 
        const totalLossWeight = b.orders?.reduce((sum: number, o: any) => sum + Number(o.weight_loss || 0), 0) || 0;
        const totalRevenue = b.orders?.reduce((sum: number, o: any) => sum + Number(o.revenue || 0), 0) || 0;
        const totalTax = b.orders?.reduce((sum: number, o: any) => sum + Number(o.tax_amount || 0), 0) || 0;
        const totalShip = b.orders?.reduce((sum: number, o: any) => sum + Number(o.shipping_fee || 0), 0) || 0;
        const totalProfit = b.orders?.reduce((sum: number, o: any) => sum + Number(o.profit || 0), 0) || 0;

        const sold_xo = b.orders?.filter((o:any) => o.grade_type === 'Xô').reduce((sum: number, o: any) => sum + Number(o.weight || 0), 0) || 0;
        const sold_dep = b.orders?.filter((o:any) => o.grade_type === 'Đẹp').reduce((sum: number, o: any) => sum + Number(o.weight || 0), 0) || 0;
        const sold_vua = b.orders?.filter((o:any) => o.grade_type === 'Vừa').reduce((sum: number, o: any) => sum + Number(o.weight || 0), 0) || 0;
        const sold_xau = b.orders?.filter((o:any) => o.grade_type === 'Xấu').reduce((sum: number, o: any) => sum + Number(o.weight || 0), 0) || 0;

        const totalSoldWeight = sold_xo + sold_dep + sold_vua + sold_xau;
        const remainingWeight = Number(b.total_weight) - totalSoldWeight - totalLossWeight; 
        const progress = totalPurchaseCost > 0 ? Math.min((totalRevenue / totalPurchaseCost) * 100, 100) : 0;
        const breakevenGap = totalPurchaseCost - totalRevenue;

        return { 
          ...b, totalPurchaseCost, totalSoldWeight, totalLossWeight, totalRevenue, totalTax, totalShip, totalProfit, remainingWeight, progress, breakevenGap,
          sold_xo, sold_dep, sold_vua, sold_xau 
        }
      })
      setBatches(processed)
    }
    setLoading(false)
  }

  useEffect(() => { fetchBatches() }, [])

  const handleAddBatch = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    const total_kg = Number(form.weight_xo || 0) + Number(form.weight_dep || 0) + Number(form.weight_vua || 0) + Number(form.weight_xau || 0);
    if (total_kg <= 0) { alert("Duy ơi, nhập số Kg vào đi!"); setLoading(false); return; }

    await supabase.from('batches').insert([{
      batch_code: form.batch_code.toUpperCase(), 
      total_weight: total_kg,
      weight_xo: Number(form.weight_xo || 0),
      weight_dep: Number(form.weight_dep || 0),
      weight_vua: Number(form.weight_vua || 0),
      weight_xau: Number(form.weight_xau || 0),
      cost_per_kg: Number(form.cost_per_kg),
      image_url: form.image_url, note: form.note, purchase_date: form.purchase_date,
      supplier_name: form.supplier_name, has_receipt: form.has_receipt      
    }])
    setForm({ batch_code: '', cost_per_kg: '', image_url: '', note: '', purchase_date: new Date().toISOString().split('T')[0], supplier_name: '', has_receipt: false, weight_xo: '', weight_dep: '', weight_vua: '', weight_xau: '' })
    setShowAddForm(false); fetchBatches()
  }

  // MỞ FORM SỬA FULL THÔNG TIN LÔ
  const openEditBatch = (batch: any) => {
    setEditingBatch(batch);
    setEditBatchForm({ 
      batch_code: batch.batch_code,
      cost_per_kg: batch.cost_per_kg.toString(),
      supplier_name: batch.supplier_name || '', 
      has_receipt: batch.has_receipt || false,
      weight_xo: batch.weight_xo?.toString() || '0',
      weight_dep: batch.weight_dep?.toString() || '0',
      weight_vua: batch.weight_vua?.toString() || '0',
      weight_xau: batch.weight_xau?.toString() || '0',
    });
  }

  // LƯU CẬP NHẬT LÔ
  const handleUpdateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const total_kg = Number(editBatchForm.weight_xo || 0) + Number(editBatchForm.weight_dep || 0) + Number(editBatchForm.weight_vua || 0) + Number(editBatchForm.weight_xau || 0);

    await supabase.from('batches').update({ 
      batch_code: editBatchForm.batch_code.toUpperCase(),
      cost_per_kg: Number(editBatchForm.cost_per_kg),
      supplier_name: editBatchForm.supplier_name, 
      has_receipt: editBatchForm.has_receipt,
      weight_xo: Number(editBatchForm.weight_xo || 0),
      weight_dep: Number(editBatchForm.weight_dep || 0),
      weight_vua: Number(editBatchForm.weight_vua || 0),
      weight_xau: Number(editBatchForm.weight_xau || 0),
      total_weight: total_kg
    }).eq('id', editingBatch.id);
    
    setEditingBatch(null); fetchBatches();
  }

  // HÀM XÓA LÔ HÀNG
  const handleDeleteBatch = async (id: string) => {
    if (window.confirm("Duy chắc chắn muốn xóa hẳn lô này? Sẽ mất luôn lịch sử đơn hàng của lô đó!")) {
        setLoading(true);
        await supabase.from('batches').delete().eq('id', id);
        fetchBatches();
    }
  }

  return (
    <div className="p-6 space-y-8 animate-in fade-in duration-500 pb-20 max-w-7xl mx-auto">
      <div className="flex justify-between items-center bg-gray-900 text-white p-8 rounded-[40px] shadow-2xl">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-3"><Package size={32} className="text-blue-400"/> Quản Lý Kho & Phân Loại</h1>
          <p className="text-gray-400 font-bold mt-1 tracking-tight">Kiểm soát chi tiết Hàng Xô, Đẹp, Vừa, Xấu</p>
        </div>
        <button onClick={() => setShowAddForm(!showAddForm)} className="bg-blue-600 hover:bg-blue-500 px-8 py-4 rounded-2xl font-black shadow-lg transition-all">
          {showAddForm ? 'Đóng' : 'NHẬP LÔ MỚI'}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddBatch} className="bg-white p-8 rounded-[40px] border-2 border-dashed border-gray-200 shadow-sm space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input required type="date" className="border rounded-2xl p-3 font-bold focus:border-blue-400" value={form.purchase_date} onChange={e => setForm({...form, purchase_date: e.target.value})} />
            <input required placeholder="Mã Lô (VD: LO-01)" className="border rounded-2xl p-3 font-bold uppercase focus:border-blue-400" value={form.batch_code} onChange={e => setForm({...form, batch_code: e.target.value})} />
            <input required type="number" placeholder="Giá nhập / 1kg" className="border rounded-2xl p-3 font-bold text-red-600" value={form.cost_per_kg} onChange={e => setForm({...form, cost_per_kg: e.target.value})} />
          </div>
          
          <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100">
             <h3 className="text-sm font-black uppercase text-blue-800 mb-4 flex items-center gap-2"><ListFilter size={18}/> Nhập số Kg theo phân loại (Bỏ trống nếu không có)</h3>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                   <label className="text-[10px] font-black uppercase text-gray-500 ml-2">Hàng Xô Zin</label>
                   <input type="number" step="0.001" placeholder="Số kg" className="w-full border rounded-2xl p-3 font-bold mt-1" value={form.weight_xo} onChange={e => setForm({...form, weight_xo: e.target.value})} />
                </div>
                <div>
                   <label className="text-[10px] font-black uppercase text-green-600 ml-2">Hàng Đẹp</label>
                   <input type="number" step="0.001" placeholder="Số kg" className="w-full border rounded-2xl p-3 font-bold mt-1" value={form.weight_dep} onChange={e => setForm({...form, weight_dep: e.target.value})} />
                </div>
                <div>
                   <label className="text-[10px] font-black uppercase text-orange-500 ml-2">Hàng Vừa</label>
                   <input type="number" step="0.001" placeholder="Số kg" className="w-full border rounded-2xl p-3 font-bold mt-1" value={form.weight_vua} onChange={e => setForm({...form, weight_vua: e.target.value})} />
                </div>
                <div>
                   <label className="text-[10px] font-black uppercase text-red-500 ml-2">Hàng Xấu</label>
                   <input type="number" step="0.001" placeholder="Số kg" className="w-full border rounded-2xl p-3 font-bold mt-1" value={form.weight_xau} onChange={e => setForm({...form, weight_xau: e.target.value})} />
                </div>
             </div>
             <div className="mt-4 text-right">
                <span className="text-xs font-bold text-gray-500">Hệ thống sẽ tự tính: </span>
                <span className="text-xl font-black text-blue-600 uppercase">Tổng nhập = {(Number(form.weight_xo || 0) + Number(form.weight_dep || 0) + Number(form.weight_vua || 0) + Number(form.weight_xau || 0)).toFixed(3)} Kg</span>
             </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <input required placeholder="Nguồn nhập (Tên khách bán)" className="w-full md:w-1/3 border border-blue-100 bg-blue-50/30 rounded-2xl p-3 font-bold" value={form.supplier_name} onChange={e => setForm({...form, supplier_name: e.target.value})} />
            
            <label className="flex items-center gap-3 border rounded-2xl p-3 cursor-pointer hover:bg-gray-50 w-full md:w-auto justify-center">
              <input type="checkbox" className="w-5 h-5 accent-green-500 rounded" checked={form.has_receipt} onChange={e => setForm({...form, has_receipt: e.target.checked})} />
              <span className="text-sm font-black text-gray-700 uppercase">Đã có bảng kê (Thuế)</span>
            </label>
            
            <button type="submit" className="w-full md:w-auto bg-black text-white px-10 rounded-2xl py-4 uppercase font-black hover:bg-gray-800 shadow-lg">Lưu kho ngay</button>
          </div>
        </form>
      )}

      {loading && batches.length === 0 ? <div className="p-10 text-center font-black animate-pulse">ĐANG TẢI KHO YẾN DD PRIME...</div> : (
        <div className="grid grid-cols-1 gap-12">
          {batches.map((b) => (
            <div key={b.id} className="bg-white p-8 rounded-[50px] border border-gray-100 shadow-sm flex flex-col gap-6 relative group hover:border-blue-200 transition-all">
              
              <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8">
                <div className="flex gap-6 items-center">
                  <div className="w-24 h-24 bg-gray-100 rounded-[30px] flex items-center justify-center border-2 border-dashed border-gray-200 shrink-0">
                    <ImageIcon className="text-gray-300"/>
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-4xl font-black text-gray-900 tracking-tighter">{b.batch_code}</h3>
                        
                        {/* NÚT SỬA & XÓA LÔ HÀNG */}
                        <div className="flex gap-1 ml-2">
                           <button onClick={() => openEditBatch(b)} className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-500 hover:text-blue-700 rounded-full transition-colors" title="Chỉnh sửa thông tin Lô"><Pencil size={16} /></button>
                           <button onClick={() => handleDeleteBatch(b.id)} className="p-2 bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 rounded-full transition-colors" title="Xóa Lô hàng"><Trash2 size={16} /></button>
                        </div>

                        {b.has_receipt ? <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1 ml-2"><CheckCircle2 size={12}/> Đã có bảng kê</span> : <span className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1 ml-2 animate-pulse"><AlertCircle size={12}/> Thiếu bảng kê</span>}
                    </div>
                    <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest mt-1">Ngày nhập: {new Date(b.purchase_date).toLocaleDateString('vi-VN')} • Nguồn: <span className="text-blue-500">{b.supplier_name || 'Chưa cập nhật'}</span></p>
                  </div>
                </div>

                {/* 4 ỐNG CHỈ SỐ LỚN */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
                   <div className="bg-gradient-to-br from-cyan-400 to-blue-600 text-white p-5 rounded-[30px] shadow-lg text-center">
                      <p className="text-[10px] font-black uppercase text-blue-100 mb-1">Tồn kho tổng</p>
                      <p className="text-2xl font-black">{b.remainingWeight.toFixed(3)} kg</p>
                   </div>
                   <div className="bg-slate-700 text-white p-5 rounded-[30px] shadow-lg text-center">
                      <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Vốn bỏ ra</p>
                      <p className="text-2xl font-black">{b.totalPurchaseCost.toLocaleString()}đ</p>
                   </div>
                   <div className="bg-blue-600 text-white p-5 rounded-[30px] shadow-lg text-center cursor-pointer hover:bg-blue-500 transition-colors" onClick={() => setModalData({ batch: b, type: 'sold' })}>
                      <p className="text-[10px] font-black uppercase text-blue-200 mb-1">Tổng kg xuất bán</p>
                      <p className="text-2xl font-black">{b.totalSoldWeight.toFixed(3)} kg</p>
                   </div>
                   <div className="bg-emerald-500 text-white p-5 rounded-[30px] shadow-lg text-center cursor-pointer hover:bg-emerald-400 transition-colors" onClick={() => setModalData({ batch: b, type: 'profit' })}>
                      <p className="text-[10px] font-black uppercase text-emerald-100 mb-1">Lời cuối cùng</p>
                      <p className="text-2xl font-black">+{b.totalProfit.toLocaleString()}đ</p>
                   </div>
                </div>
              </div>

              {/* THANH TIẾN ĐỘ THU HỒI VỐN */}
              <div className="space-y-3 bg-gray-50 p-4 rounded-3xl border border-gray-100">
                <div className="flex justify-between items-end">
                  <span className="text-xs font-black uppercase text-gray-400">Tiến độ thu hồi vốn lô hàng</span>
                  <span className={`font-black text-sm ${b.progress >= 100 ? 'text-emerald-500' : 'text-blue-600'}`}>
                     {b.progress >= 100 ? 'ĐÃ CÓ LÃI RÒNG 🚀' : `Cần thu thêm ${b.breakevenGap.toLocaleString()}đ để hòa vốn`}
                  </span>
                </div>
                <div className="w-full bg-white rounded-full h-4 overflow-hidden border">
                  <div className={`h-full transition-all duration-1000 ${b.progress >= 100 ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${b.progress}%` }}></div>
                </div>
              </div>

              {/* BẢNG HAO HỤT, THUẾ, SHIP */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                 <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Tổng kg nhập</p>
                    <p className="text-xl font-black text-gray-900 truncate">{Number(b.total_weight).toFixed(3)}kg</p>
                 </div>
                 <div className="bg-emerald-50 p-4 rounded-3xl border border-emerald-100 cursor-pointer hover:border-emerald-500 transition-colors" onClick={() => setModalData({ batch: b, type: 'sold' })}>
                    <p className="text-[10px] font-black text-emerald-500 uppercase mb-1">Đã bán</p>
                    <p className="text-xl font-black text-emerald-700 truncate">{b.totalSoldWeight.toFixed(3)}kg</p>
                 </div>
                 <div className="bg-red-50 p-4 rounded-3xl border border-red-100 cursor-pointer hover:border-red-500 transition-colors" onClick={() => setModalData({ batch: b, type: 'loss' })}>
                    <p className="text-[10px] font-black text-red-400 uppercase mb-1">Hao hụt</p>
                    <p className="text-xl font-black text-red-700 truncate">{b.totalLossWeight.toFixed(3)}kg</p>
                 </div>
                 <div className="bg-orange-50 p-4 rounded-3xl border border-orange-100 cursor-pointer hover:border-orange-500 transition-colors" onClick={() => setModalData({ batch: b, type: 'tax' })}>
                    <p className="text-[10px] font-black text-orange-400 uppercase mb-1">Tổng Thuế</p>
                    <p className="text-xl font-black text-orange-700 truncate">{b.totalTax.toLocaleString()}đ</p>
                 </div>
                 <div className="bg-pink-50 p-4 rounded-3xl border border-pink-100 cursor-pointer hover:border-pink-500 transition-colors" onClick={() => setModalData({ batch: b, type: 'ship' })}>
                    <p className="text-[10px] font-black text-pink-400 uppercase mb-1">Tổng Ship</p>
                    <p className="text-xl font-black text-pink-700 truncate">{b.totalShip.toLocaleString()}đ</p>
                 </div>
              </div>

              {/* BẢNG THEO DÕI TỒN KHO TỪNG LOẠI */}
              <div className="bg-white rounded-3xl border border-dashed border-gray-300 p-5">
                 <h4 className="text-xs font-black uppercase text-gray-500 mb-3 flex items-center gap-2"><ListFilter size={16}/> Chi tiết tồn kho theo phân loại</h4>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 p-3 rounded-2xl border text-center">
                       <p className="text-[10px] font-black text-gray-400 uppercase">Hàng Xô (Nhập {Number(b.weight_xo || 0).toFixed(2)}kg)</p>
                       <p className={`text-lg font-black mt-1 ${Number(b.weight_xo || 0) - b.sold_xo < 0 ? 'text-red-500' : 'text-gray-800'}`}>Còn: {(Number(b.weight_xo || 0) - b.sold_xo).toFixed(3)} kg</p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-2xl border border-green-100 text-center">
                       <p className="text-[10px] font-black text-green-600 uppercase">Hàng Đẹp (Nhập {Number(b.weight_dep || 0).toFixed(2)}kg)</p>
                       <p className={`text-lg font-black mt-1 ${Number(b.weight_dep || 0) - b.sold_dep < 0 ? 'text-red-500' : 'text-green-700'}`}>Còn: {(Number(b.weight_dep || 0) - b.sold_dep).toFixed(3)} kg</p>
                    </div>
                    <div className="bg-orange-50 p-3 rounded-2xl border border-orange-100 text-center">
                       <p className="text-[10px] font-black text-orange-600 uppercase">Hàng Vừa (Nhập {Number(b.weight_vua || 0).toFixed(2)}kg)</p>
                       <p className={`text-lg font-black mt-1 ${Number(b.weight_vua || 0) - b.sold_vua < 0 ? 'text-red-500' : 'text-orange-700'}`}>Còn: {(Number(b.weight_vua || 0) - b.sold_vua).toFixed(3)} kg</p>
                    </div>
                    <div className="bg-red-50 p-3 rounded-2xl border border-red-100 text-center">
                       <p className="text-[10px] font-black text-red-500 uppercase">Hàng Xấu (Nhập {Number(b.weight_xau || 0).toFixed(2)}kg)</p>
                       <p className={`text-lg font-black mt-1 ${Number(b.weight_xau || 0) - b.sold_xau < 0 ? 'text-red-500' : 'text-red-700'}`}>Còn: {(Number(b.weight_xau || 0) - b.sold_xau).toFixed(3)} kg</p>
                    </div>
                 </div>
                 {/* Hướng dẫn sửa lỗi âm */}
                 {(Number(b.weight_xo || 0) - b.sold_xo < 0 || Number(b.weight_dep || 0) - b.sold_dep < 0 || Number(b.weight_vua || 0) - b.sold_vua < 0 || Number(b.weight_xau || 0) - b.sold_xau < 0) && (
                     <p className="text-[10px] text-red-500 italic mt-3 text-center font-bold">Lưu ý: Có số ký bị Âm. Hãy bấm nút Cây Bút ở trên tên lô hàng để khai báo lại số Kg nhập vào cho loại hàng đó!</p>
                 )}
              </div>
              
              <button onClick={() => setModalData({ batch: b, type: 'sold' })} className="w-full bg-black text-white p-4 rounded-[25px] flex justify-center items-center gap-2 font-black text-xs uppercase tracking-widest hover:bg-gray-800 transition-colors shadow-lg">
                <History size={16}/> Xem chi tiết lịch sử xuất kho
              </button>
            </div>
          ))}
        </div>
      )}

      {/* MODAL CHỈNH SỬA FULL THÔNG TIN LÔ HÀNG */}
      {editingBatch && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-[30px] p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative animate-in zoom-in-95 custom-scrollbar">
            <button onClick={() => setEditingBatch(null)} className="absolute top-6 right-6 bg-gray-100 p-2 rounded-full hover:bg-red-100 hover:text-red-500 transition-colors"><X size={20}/></button>
            <h2 className="text-2xl font-black uppercase tracking-tighter mb-6 text-gray-900 flex items-center gap-2">
              <Pencil className="text-blue-500"/> Sửa Toàn Bộ Lô {editingBatch.batch_code}
            </h2>
            
            <form onSubmit={handleUpdateBatch} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Mã Lô</label>
                  <input required className="w-full border border-gray-200 rounded-xl p-3 font-bold text-sm uppercase" value={editBatchForm.batch_code} onChange={e => setEditBatchForm({...editBatchForm, batch_code: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-red-400 mb-1 ml-1">Giá nhập / 1kg</label>
                  <input required type="number" className="w-full border border-red-200 rounded-xl p-3 font-bold text-red-600 text-sm bg-red-50/30" value={editBatchForm.cost_per_kg} onChange={e => setEditBatchForm({...editBatchForm, cost_per_kg: e.target.value})} />
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                 <label className="text-[10px] font-black uppercase text-blue-600 mb-2 block">Chỉnh sửa số Kg nhập theo từng loại</label>
                 <div className="grid grid-cols-2 gap-4">
                    <div><span className="text-[10px] font-bold text-gray-500">Hàng Xô</span><input type="number" step="0.001" className="w-full border rounded-xl p-2 font-bold text-sm mt-1" value={editBatchForm.weight_xo} onChange={e => setEditBatchForm({...editBatchForm, weight_xo: e.target.value})} /></div>
                    <div><span className="text-[10px] font-bold text-green-600">Hàng Đẹp</span><input type="number" step="0.001" className="w-full border rounded-xl p-2 font-bold text-sm mt-1" value={editBatchForm.weight_dep} onChange={e => setEditBatchForm({...editBatchForm, weight_dep: e.target.value})} /></div>
                    <div><span className="text-[10px] font-bold text-orange-500">Hàng Vừa</span><input type="number" step="0.001" className="w-full border rounded-xl p-2 font-bold text-sm mt-1" value={editBatchForm.weight_vua} onChange={e => setEditBatchForm({...editBatchForm, weight_vua: e.target.value})} /></div>
                    <div><span className="text-[10px] font-bold text-red-500">Hàng Xấu</span><input type="number" step="0.001" className="w-full border rounded-xl p-2 font-bold text-sm mt-1" value={editBatchForm.weight_xau} onChange={e => setEditBatchForm({...editBatchForm, weight_xau: e.target.value})} /></div>
                 </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Nguồn nhập (Người bán)</label>
                <input required placeholder="Nhập tên người bán (VD: Chị Huệ)" className="w-full border border-gray-200 rounded-xl p-3 font-bold text-sm outline-none focus:border-blue-400" value={editBatchForm.supplier_name} onChange={e => setEditBatchForm({...editBatchForm, supplier_name: e.target.value})} />
              </div>
              
              <label className="flex items-center gap-3 border border-gray-200 rounded-xl p-4 cursor-pointer hover:bg-gray-50 transition-colors">
                <input type="checkbox" className="w-5 h-5 accent-green-500 rounded" checked={editBatchForm.has_receipt} onChange={e => setEditBatchForm({...editBatchForm, has_receipt: e.target.checked})} />
                <span className="text-sm font-black text-gray-700 uppercase">Đã có bảng kê (Chứng từ)</span>
              </label>
              
              <button type="submit" className="w-full bg-blue-600 text-white font-black rounded-xl py-4 uppercase text-sm hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30">Lưu tất cả thay đổi</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL LỊCH SỬ ĐỐI SOÁT */}
      {modalData && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-[40px] p-8 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative animate-in zoom-in-95">
            <button onClick={() => setModalData(null)} className="absolute top-8 right-8 bg-gray-100 p-2 rounded-full hover:bg-red-100 hover:text-red-500 transition-colors"><X size={24}/></button>
            <div className="mb-8">
               <h2 className="text-3xl font-black uppercase tracking-tighter text-gray-900">
                  {modalData.type === 'tax' ? 'Lịch sử Thuế đơn hàng' : 
                   modalData.type === 'loss' ? 'Chi tiết hao hụt yến' :
                   modalData.type === 'revenue' ? 'Danh sách doanh thu thu về' :
                   modalData.type === 'profit' ? 'Lợi nhuận ròng từng đơn' :
                   modalData.type === 'ship' ? 'Phí vận chuyển chi ra' : 'Lịch sử khách mua yến lô ' + modalData.batch.batch_code}
               </h2>
            </div>
            <div className="overflow-y-auto pr-2 space-y-3 custom-scrollbar">
              <table className="w-full text-left border-separate border-spacing-y-2">
                <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400">
                  <tr>
                    <th className="p-4 rounded-l-2xl">Khách hàng</th>
                    <th className="p-4">Ngày</th>
                    <th className="p-4">Phân loại</th>
                    <th className="p-4">Kg mua</th>
                    {modalData.type === 'tax' && <th className="p-4 text-orange-500">Thuế 5%</th>}
                    {modalData.type === 'loss' && <th className="p-4 text-red-500">Hao hụt</th>}
                    {modalData.type === 'ship' && <th className="p-4 text-purple-600">Phí ship</th>}
                    {modalData.type === 'profit' && <th className="p-4 text-emerald-600">Lãi ròng</th>}
                    <th className="p-4 rounded-r-2xl">Doanh thu</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-bold">
                  {modalData.batch.orders?.map((o: any) => (
                    <tr key={o.id} className="bg-gray-50/30 hover:bg-gray-50 transition-colors">
                      <td className="p-4 rounded-l-2xl text-gray-900">{o.customers?.name}</td>
                      <td className="p-4 text-gray-400 text-xs">{new Date(o.created_at).toLocaleDateString('vi-VN')}</td>
                      <td className="p-4 text-orange-600 uppercase text-xs">{o.grade_type || 'Xô'}</td>
                      <td className="p-4 text-blue-600">{Number(o.weight).toFixed(3)}kg</td>
                      {modalData.type === 'tax' && <td className="p-4 text-orange-500">-{Number(o.tax_amount).toLocaleString()}đ</td>}
                      {modalData.type === 'loss' && <td className="p-4 text-red-500">{Number(o.weight_loss).toFixed(3)}kg</td>}
                      {modalData.type === 'ship' && <td className="p-4 text-purple-600">-{Number(o.shipping_fee).toLocaleString()}đ</td>}
                      {modalData.type === 'profit' && <td className="p-4 text-emerald-600">+{Number(o.profit).toLocaleString()}đ</td>}
                      <td className="p-4 rounded-r-2xl text-gray-900">{Number(o.revenue).toLocaleString()}đ</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!modalData.batch.orders || modalData.batch.orders.length === 0) && <p className="text-center py-20 text-gray-400 font-bold italic uppercase tracking-widest">Lô này chưa xuất kho đơn nào</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
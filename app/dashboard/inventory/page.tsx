'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  Package, Image as ImageIcon, History, X, 
  CheckCircle2, AlertCircle, Pencil, ListFilter, Trash2, ArrowRightLeft, Upload, AlertTriangle, Calendar
} from 'lucide-react'

export default function InventoryPage() {
  const [batches, setBatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [modalData, setModalData] = useState<{ batch: any, type: string } | null>(null)

  const [form, setForm] = useState({ 
    batch_code: '', image_url: '', note: '', 
    purchase_date: new Date().toISOString().split('T')[0],
    supplier_name: '', has_receipt: false,
    weight_xo: '', cost_xo: '', 
    weight_dep: '', cost_dep: '', 
    weight_vua: '', cost_vua: '', 
    weight_xau: '', cost_xau: '' 
  })
  
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')

  const [editingBatch, setEditingBatch] = useState<any>(null)
  const [editBatchForm, setEditBatchForm] = useState({ 
    batch_code: '', supplier_name: '', has_receipt: false, purchase_date: '',
    weight_xo: '', cost_xo: '', 
    weight_dep: '', cost_dep: '', 
    weight_vua: '', cost_vua: '', 
    weight_xau: '', cost_xau: ''
  })

  const [transferModal, setTransferModal] = useState<{batch: any, gradeKey: string, gradeName: string, gradeValue: string, remain: number} | null>(null)
  const [transferForm, setTransferForm] = useState({ targetBatchId: '', kg: '' })

  const w_xo = Number(form.weight_xo?.replace(',', '.') || 0); const c_xo = Number(form.cost_xo || 0);
  const w_dep = Number(form.weight_dep?.replace(',', '.') || 0); const c_dep = Number(form.cost_dep || 0);
  const w_vua = Number(form.weight_vua?.replace(',', '.') || 0); const c_vua = Number(form.cost_vua || 0);
  const w_xau = Number(form.weight_xau?.replace(',', '.') || 0); const c_xau = Number(form.cost_xau || 0);

  const total_kg_input = w_xo + w_dep + w_vua + w_xau;
  const total_cost_input = (w_xo * c_xo) + (w_dep * c_dep) + (w_vua * c_vua) + (w_xau * c_xau);
  const average_price = total_kg_input > 0 ? (total_cost_input / total_kg_input) : 0;

  const fetchBatches = async () => {
    const { data } = await supabase
      .from('batches')
      .select('*, orders(*, customers(name, phone))')
      .order('purchase_date', { ascending: false }) 
      .order('created_at', { ascending: false })

    if (data) {
      const processed = data.map((b: any) => {
        const totalPurchaseCost = 
            (Number(b.weight_xo || 0) * Number(b.cost_xo || b.cost_per_kg || 0)) + 
            (Number(b.weight_dep || 0) * Number(b.cost_dep || b.cost_per_kg || 0)) + 
            (Number(b.weight_vua || 0) * Number(b.cost_vua || b.cost_per_kg || 0)) + 
            (Number(b.weight_xau || 0) * Number(b.cost_xau || b.cost_per_kg || 0));

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
        
        const currentAveragePrice = Number(b.total_weight) > 0 ? (totalPurchaseCost / Number(b.total_weight)) : 0;

        return { 
          ...b, totalPurchaseCost, totalSoldWeight, totalLossWeight, totalRevenue, totalTax, totalShip, totalProfit, remainingWeight, progress, breakevenGap, currentAveragePrice,
          sold_xo, sold_dep, sold_vua, sold_xau 
        }
      })
      setBatches(processed)
    }
    setLoading(false)
  }

  useEffect(() => { fetchBatches() }, [])

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  }

  const handleAddBatch = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    if (total_kg_input <= 0) { alert("Duy ơi, nhập số Kg vào đi!"); setLoading(false); return; }

    let finalImageUrl = form.image_url;

    if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage.from('images').upload(fileName, imageFile);
        
        if (uploadError) {
            alert("Lỗi tải ảnh! Sếp kiểm tra lại xem đã tạo Storage 'images' và bật Public chưa nhé.");
            console.error(uploadError);
        } else if (uploadData) {
            const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(fileName);
            finalImageUrl = publicUrl;
        }
    }

    await supabase.from('batches').insert([{
      batch_code: form.batch_code.toUpperCase(), 
      total_weight: total_kg_input,
      weight_xo: w_xo, cost_xo: c_xo,
      weight_dep: w_dep, cost_dep: c_dep,
      weight_vua: w_vua, cost_vua: c_vua,
      weight_xau: w_xau, cost_xau: c_xau,
      cost_per_kg: average_price, 
      image_url: finalImageUrl, note: form.note, purchase_date: form.purchase_date,
      supplier_name: form.supplier_name, has_receipt: form.has_receipt      
    }])
    
    setForm({ batch_code: '', image_url: '', note: '', purchase_date: new Date().toISOString().split('T')[0], supplier_name: '', has_receipt: false, weight_xo: '', cost_xo: '', weight_dep: '', cost_dep: '', weight_vua: '', cost_vua: '', weight_xau: '', cost_xau: '' })
    setImageFile(null); setImagePreview('');
    setShowAddForm(false); fetchBatches()
  }

  const openEditBatch = (batch: any) => {
    setEditingBatch(batch);
    setEditBatchForm({ 
      batch_code: batch.batch_code,
      supplier_name: batch.supplier_name || '', 
      has_receipt: batch.has_receipt || false,
      purchase_date: batch.purchase_date ? new Date(batch.purchase_date).toISOString().split('T')[0] : '',
      weight_xo: batch.weight_xo?.toString() || '0', cost_xo: batch.cost_xo?.toString() || batch.cost_per_kg?.toString() || '0',
      weight_dep: batch.weight_dep?.toString() || '0', cost_dep: batch.cost_dep?.toString() || batch.cost_per_kg?.toString() || '0',
      weight_vua: batch.weight_vua?.toString() || '0', cost_vua: batch.cost_vua?.toString() || batch.cost_per_kg?.toString() || '0',
      weight_xau: batch.weight_xau?.toString() || '0', cost_xau: batch.cost_xau?.toString() || batch.cost_per_kg?.toString() || '0',
    });
  }

  const handleUpdateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const wx = Number(editBatchForm.weight_xo?.toString().replace(',', '.') || 0);
    const wd = Number(editBatchForm.weight_dep?.toString().replace(',', '.') || 0);
    const wv = Number(editBatchForm.weight_vua?.toString().replace(',', '.') || 0);
    const wxau = Number(editBatchForm.weight_xau?.toString().replace(',', '.') || 0);
    const total_kg = wx + wd + wv + wxau;

    await supabase.from('batches').update({ 
      batch_code: editBatchForm.batch_code.toUpperCase(),
      supplier_name: editBatchForm.supplier_name, 
      has_receipt: editBatchForm.has_receipt,
      purchase_date: editBatchForm.purchase_date,
      weight_xo: wx, cost_xo: Number(editBatchForm.cost_xo || 0),
      weight_dep: wd, cost_dep: Number(editBatchForm.cost_dep || 0),
      weight_vua: wv, cost_vua: Number(editBatchForm.cost_vua || 0),
      weight_xau: wxau, cost_xau: Number(editBatchForm.cost_xau || 0),
      total_weight: total_kg
    }).eq('id', editingBatch.id);
    
    setEditingBatch(null); fetchBatches();
  }

  const handleDeleteBatch = async (id: string) => {
    if (window.confirm("Duy chắc chắn muốn xóa hẳn lô này? Sẽ mất luôn lịch sử đơn hàng của lô đó!")) {
        setLoading(true);
        await supabase.from('batches').delete().eq('id', id);
        fetchBatches();
    }
  }

  const handleDeleteOrderFromHistory = async (orderId: string) => {
    if (window.confirm("Sếp có chắc muốn XÓA giao dịch này? Xóa xong số Kg sẽ tự động CỘNG TRẢ LẠI vào kho nhé!")) {
        setLoading(true);
        await supabase.from('orders').delete().eq('id', orderId);
        setModalData(null); 
        fetchBatches();
    }
  }

  const formatNum = (num: number) => {
    if (num >= 1000000000) return (num / 1000000000).toFixed(2) + ' Tỷ'
    if (num >= 1000000) return (num / 1000000).toFixed(1) + ' Tr'
    return num.toLocaleString('vi-VN')
  }

  return (
    <div className="p-3 md:p-8 space-y-6 md:space-y-8 bg-gray-50 min-h-screen animate-in fade-in max-w-7xl mx-auto pb-24">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-5 md:p-8 rounded-[24px] md:rounded-[30px] shadow-sm border border-gray-200 gap-4">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-gray-900 flex items-center gap-2 md:gap-3">
             <Package size={24} className="text-blue-500"/> Quản Lý Kho Yến
          </h1>
          <p className="text-gray-500 text-[11px] md:text-sm mt-1">Kiểm soát nhập liệu, tồn kho và hao hụt chi tiết.</p>
        </div>
        <button onClick={() => setShowAddForm(!showAddForm)} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-semibold shadow-md transition-all flex items-center justify-center gap-2 text-sm">
          {showAddForm ? 'Đóng form nhập' : 'Nhập lô mới'}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddBatch} className="bg-white p-5 md:p-8 rounded-[24px] border border-gray-200 shadow-sm space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
               <label className="text-xs font-semibold text-gray-600 ml-1">Ngày Nhập</label>
               <input required type="date" className="w-full border border-gray-300 rounded-xl p-3 text-sm font-semibold outline-none focus:border-blue-500 transition-all" value={form.purchase_date} onChange={e => setForm({...form, purchase_date: e.target.value})} />
            </div>
            <div className="flex flex-col gap-1">
               <label className="text-xs font-semibold text-gray-600 ml-1">Mã Lô Hàng</label>
               <input required placeholder="Ví dụ: LO-01" className="w-full border border-gray-300 rounded-xl p-3 text-sm font-bold uppercase outline-none focus:border-blue-500 transition-all" value={form.batch_code} onChange={e => setForm({...form, batch_code: e.target.value})} />
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 md:p-6 rounded-2xl border border-gray-200">
             <h3 className="text-xs font-bold text-gray-800 mb-3 flex items-center gap-1.5"><ListFilter size={14} className="text-blue-500"/> Khai báo Số Lượng & Giá Vốn Riêng</h3>
             <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-1.5">
                   <label className="text-[10px] font-bold uppercase text-gray-600 block text-center">Xô Zin</label>
                   <input type="text" placeholder="Kg..." className="w-full border-b border-gray-200 pb-1 text-sm font-semibold outline-none text-center focus:border-blue-400" value={form.weight_xo} onChange={e => setForm({...form, weight_xo: e.target.value})} />
                   <input type="number" placeholder="Giá/1kg" className="w-full bg-gray-50 rounded p-1.5 text-xs font-semibold outline-none text-center focus:ring-1 focus:ring-blue-100" value={form.cost_xo} onChange={e => setForm({...form, cost_xo: e.target.value})} />
                </div>
                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-1.5">
                   <label className="text-[10px] font-bold uppercase text-green-600 block text-center">Hàng Đẹp</label>
                   <input type="text" placeholder="Kg..." className="w-full border-b border-gray-200 pb-1 text-sm font-semibold outline-none text-center focus:border-green-400" value={form.weight_dep} onChange={e => setForm({...form, weight_dep: e.target.value})} />
                   <input type="number" placeholder="Giá/1kg" className="w-full bg-gray-50 rounded p-1.5 text-xs font-semibold outline-none text-center focus:ring-1 focus:ring-green-100" value={form.cost_dep} onChange={e => setForm({...form, cost_dep: e.target.value})} />
                </div>
                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-1.5">
                   <label className="text-[10px] font-bold uppercase text-orange-500 block text-center">Hàng Vừa</label>
                   <input type="text" placeholder="Kg..." className="w-full border-b border-gray-200 pb-1 text-sm font-semibold outline-none text-center focus:border-orange-400" value={form.weight_vua} onChange={e => setForm({...form, weight_vua: e.target.value})} />
                   <input type="number" placeholder="Giá/1kg" className="w-full bg-gray-50 rounded p-1.5 text-xs font-semibold outline-none text-center focus:ring-1 focus:ring-orange-100" value={form.cost_vua} onChange={e => setForm({...form, cost_vua: e.target.value})} />
                </div>
                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-1.5">
                   <label className="text-[10px] font-bold uppercase text-red-500 block text-center">Hàng Xấu</label>
                   <input type="text" placeholder="Kg..." className="w-full border-b border-gray-200 pb-1 text-sm font-semibold outline-none text-center focus:border-red-400" value={form.weight_xau} onChange={e => setForm({...form, weight_xau: e.target.value})} />
                   <input type="number" placeholder="Giá/1kg" className="w-full bg-gray-50 rounded p-1.5 text-xs font-semibold outline-none text-center focus:ring-1 focus:ring-red-100" value={form.cost_xau} onChange={e => setForm({...form, cost_xau: e.target.value})} />
                </div>
             </div>
             
             <div className="mt-4 flex flex-row justify-between items-center bg-white p-3 rounded-xl border border-gray-200 gap-3 shadow-sm">
                <div className="text-right w-1/2 border-r pr-3">
                  <span className="text-[9px] uppercase font-bold text-gray-400 block">Tổng khối lượng</span>
                  <span className="text-base font-black text-gray-900">{total_kg_input.toFixed(3)} Kg</span>
                </div>
                <div className="text-left w-1/2 pl-3">
                  <span className="text-[9px] uppercase font-bold text-gray-400 block">Giá trung bình</span>
                  <span className="text-base font-black text-blue-600">{Math.round(average_price).toLocaleString()} đ/kg</span>
                </div>
             </div>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-3 bg-gray-50 p-4 rounded-xl border border-dashed border-gray-300">
             <div className="flex-1 w-full">
                <label className="text-[10px] font-semibold text-gray-600 mb-1 block">Tải ảnh lô hàng (Tùy chọn)</label>
                <div className="relative">
                    <input type="file" accept="image/*" onChange={handleImageSelect} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    <div className="bg-white border border-gray-300 rounded-lg p-2.5 flex items-center justify-center gap-2 font-medium text-gray-600 text-xs">
                        <Upload size={14}/> <span className="truncate">{imageFile ? imageFile.name : 'Chụp hoặc chọn ảnh...'}</span>
                    </div>
                </div>
             </div>
             {imagePreview && (
                 <div className="w-12 h-12 rounded-lg border border-gray-200 overflow-hidden shadow-sm shrink-0 bg-white">
                     <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                 </div>
             )}
          </div>

          <div className="flex flex-col md:flex-row justify-between gap-3">
            <input required placeholder="Nguồn nhập (Tên người bán)" className="w-full border border-gray-300 rounded-xl p-3 font-medium text-sm outline-none focus:border-blue-500" value={form.supplier_name} onChange={e => setForm({...form, supplier_name: e.target.value})} />
            
            <label className="flex items-center justify-center gap-2 border border-gray-200 rounded-xl p-3 cursor-pointer bg-gray-50 w-full">
              <input type="checkbox" className="w-4 h-4 accent-blue-600 rounded" checked={form.has_receipt} onChange={e => setForm({...form, has_receipt: e.target.checked})} />
              <span className="text-xs font-semibold text-gray-700">Đã khai báo Thuế</span>
            </label>
            
            <button type="submit" className="w-full bg-gray-900 text-white px-6 py-3 rounded-xl font-bold shadow-md">Lưu Kho</button>
          </div>
        </form>
      )}

      {loading && batches.length === 0 ? <div className="p-10 text-center font-medium text-gray-400 animate-pulse text-sm">ĐANG TẢI DỮ LIỆU KHO...</div> : (
        <div className="grid grid-cols-1 gap-6">
          {batches.map((b) => {
             // GIỮ NGUYÊN CODE TÍNH TOÁN BÊN TRONG MAP
             const diff_xo = Math.round((Number(b.weight_xo || 0) - b.sold_xo) * 1000) / 1000;
             const diff_dep = Math.round((Number(b.weight_dep || 0) - b.sold_dep) * 1000) / 1000;
             const diff_vua = Math.round((Number(b.weight_vua || 0) - b.sold_vua) * 1000) / 1000;
             const diff_xau = Math.round((Number(b.weight_xau || 0) - b.sold_xau) * 1000) / 1000;
             
             const hasNegative = diff_xo < 0 || diff_dep < 0 || diff_vua < 0 || diff_xau < 0;

             return (
              <div key={b.id} className="bg-white p-5 md:p-8 rounded-[24px] border border-gray-200 shadow-sm flex flex-col gap-5 relative group hover:shadow-md transition-shadow">
                
                {/* ĐÃ FIX Ở ĐÂY: lg:items-center và phân bổ lg:w-1/3 với lg:w-2/3 để khối dàn đều */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 w-full">
                  
                  {/* Cột trái: Tên Lô & Nguồn */}
                  <div className="flex flex-row gap-4 items-center w-full lg:w-1/3 border-b border-gray-100 pb-4 lg:border-none lg:pb-0">
                    <div className="w-20 h-20 md:w-24 md:h-24 bg-gray-50 rounded-2xl flex items-center justify-center border border-gray-200 shrink-0 overflow-hidden shadow-sm">
                      {b.image_url ? <img src={b.image_url} alt="Lô hàng" className="w-full h-full object-cover hover:scale-110 transition-transform" /> : <ImageIcon className="text-gray-300" size={32}/>}
                    </div>
                    
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                          <h3 className="text-2xl md:text-3xl font-black text-gray-900 uppercase truncate">{b.batch_code}</h3>
                          <div className="flex gap-1 shrink-0 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                             <button onClick={() => openEditBatch(b)} className="p-2 bg-gray-50 text-gray-400 hover:text-blue-600 rounded-lg border border-gray-200" title="Sửa Lô Hàng"><Pencil size={14} /></button>
                             <button onClick={() => handleDeleteBatch(b.id)} className="p-2 bg-gray-50 text-gray-400 hover:text-red-600 rounded-lg border border-gray-200" title="Xóa Lô Hàng"><Trash2 size={14} /></button>
                          </div>
                      </div>

                      <div className="flex items-center gap-1.5 mt-1">
                         <span className="bg-blue-50 text-blue-700 font-bold text-[10px] px-2.5 py-0.5 rounded border border-blue-100">
                            TB: {Math.round(b.currentAveragePrice).toLocaleString()} đ/kg
                         </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-gray-500 font-medium">
                          <span>Nhập: <b className="text-gray-900">{new Date(b.purchase_date || b.created_at).toLocaleDateString('vi-VN')}</b></span>
                          <span>•</span>
                          <span>Nguồn: <b className="text-blue-600">{b.supplier_name || 'N/A'}</b></span>
                          {b.has_receipt && <span className="bg-emerald-50 text-emerald-600 px-1.5 rounded border border-emerald-100 flex items-center gap-0.5 text-[10px]"><CheckCircle2 size={10}/> Thuế</span>}
                      </div>
                    </div>
                  </div>

                  {/* Cột phải: 4 thông số (Chia 4 cột trên PC, chia 2 cột trên Điện thoại) */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full lg:w-2/3">
                     <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl flex flex-col justify-center">
                        <p className="text-[10px] font-bold uppercase text-blue-500 mb-1">Tồn kho hiện tại</p>
                        <p className="text-lg md:text-xl font-black text-blue-900 truncate">{b.remainingWeight.toFixed(3)} kg</p>
                     </div>
                     <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl flex flex-col justify-center">
                        <p className="text-[10px] font-bold uppercase text-gray-500 mb-1">Tổng vốn bỏ ra</p>
                        <p className="text-lg md:text-xl font-black text-gray-800 truncate" title={`${b.totalPurchaseCost}đ`}>{formatNum(b.totalPurchaseCost)}</p>
                     </div>
                     <div className="bg-white border border-gray-200 shadow-sm p-4 rounded-xl cursor-pointer hover:border-blue-300 transition-colors flex flex-col justify-center" onClick={() => setModalData({ batch: b, type: 'sold' })}>
                        <p className="text-[10px] font-bold uppercase text-gray-500 mb-1">Đã xuất bán</p>
                        <p className="text-lg md:text-xl font-black text-gray-800 truncate">{b.totalSoldWeight.toFixed(3)} kg</p>
                     </div>
                     <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl cursor-pointer hover:border-emerald-300 transition-colors flex flex-col justify-center" onClick={() => setModalData({ batch: b, type: 'profit' })}>
                        <p className="text-[10px] font-bold uppercase text-emerald-600 mb-1">Lãi thực nhận</p>
                        <p className="text-lg md:text-xl font-black text-emerald-700 truncate" title={`+${b.totalProfit}đ`}>+{formatNum(b.totalProfit)}</p>
                     </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div className="flex justify-between items-end mb-2 gap-1">
                    <span className="text-[10px] font-bold uppercase text-gray-500">Tiến độ thu hồi vốn</span>
                    <span className={`font-bold text-xs ${b.progress >= 100 ? 'text-emerald-600' : 'text-blue-600'}`}>
                       {b.progress >= 100 ? 'Đã thu hồi đủ vốn' : `Cần thu thêm ${formatNum(b.breakevenGap)}`}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div className={`h-full transition-all duration-1000 ${b.progress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${b.progress}%` }}></div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                   <h4 className="text-xs font-bold uppercase text-gray-800 mb-4 flex items-center gap-1.5"><ListFilter size={14} className="text-gray-400"/> Tồn kho & Vốn chi tiết 4 loại</h4>
                   <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-gray-50/50 p-3 rounded-xl border border-gray-100 flex flex-col justify-between items-center text-center">
                         <p className="text-[10px] font-bold text-gray-500 uppercase">Xô (Nhập {Number(b.weight_xo || 0).toFixed(3)})</p>
                         <p className={`text-base font-black my-1.5 ${diff_xo < 0 ? 'text-red-500' : 'text-gray-800'}`}>{diff_xo.toFixed(3)} kg</p>
                         <p className="text-[10px] text-gray-400 font-semibold bg-white px-2 py-0.5 rounded border w-full truncate">Vốn: {formatNum(Number(b.cost_xo || b.cost_per_kg || 0))}</p>
                      </div>
                      <div className="bg-green-50/30 p-3 rounded-xl border border-green-100 flex flex-col justify-between items-center text-center">
                         <p className="text-[10px] font-bold text-green-600 uppercase">Đẹp (Nhập {Number(b.weight_dep || 0).toFixed(3)})</p>
                         <p className={`text-base font-black my-1.5 ${diff_dep < 0 ? 'text-red-500' : 'text-green-700'}`}>{diff_dep.toFixed(3)} kg</p>
                         <p className="text-[10px] text-gray-400 font-semibold bg-white px-2 py-0.5 rounded border w-full truncate">Vốn: {formatNum(Number(b.cost_dep || b.cost_per_kg || 0))}</p>
                      </div>
                      <div className="bg-orange-50/30 p-3 rounded-xl border border-orange-100 flex flex-col justify-between items-center text-center">
                         <p className="text-[10px] font-bold text-orange-500 uppercase">Vừa (Nhập {Number(b.weight_vua || 0).toFixed(3)})</p>
                         <p className={`text-base font-black my-1.5 ${diff_vua < 0 ? 'text-red-500' : 'text-orange-700'}`}>{diff_vua.toFixed(3)} kg</p>
                         <p className="text-[10px] text-gray-400 font-semibold bg-white px-2 py-0.5 rounded border w-full truncate">Vốn: {formatNum(Number(b.cost_vua || b.cost_per_kg || 0))}</p>
                      </div>
                      <div className="bg-red-50/30 p-3 rounded-xl border border-red-100 flex flex-col justify-between items-center text-center">
                         <p className="text-[10px] font-bold text-red-500 uppercase">Xấu (Nhập {Number(b.weight_xau || 0).toFixed(3)})</p>
                         <p className={`text-base font-black my-1.5 ${diff_xau < 0 ? 'text-red-500' : 'text-red-700'}`}>{diff_xau.toFixed(3)} kg</p>
                         <p className="text-[10px] text-gray-400 font-semibold bg-white px-2 py-0.5 rounded border w-full truncate">Vốn: {formatNum(Number(b.cost_xau || b.cost_per_kg || 0))}</p>
                      </div>
                   </div>
                   
                   {hasNegative && (
                       <div className="bg-red-50 p-3 rounded-xl mt-4 flex items-start gap-2 border border-red-200">
                           <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={16}/>
                           <p className="text-xs text-red-700 font-medium leading-tight">Có phân loại bị ÂM Kg! Hãy bấm Cây bút ở tên Lô để <b>Sửa lại gốc nhập</b> cho khớp số lượng đã bán.</p>
                       </div>
                   )}
                </div>
              </div>
             )
          })}
        </div>
      )}

      {/* FORM SỬA KHO CẬP NHẬT */}
      {editingBatch && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-[24px] p-6 md:p-8 w-full max-w-3xl max-h-[95vh] overflow-y-auto shadow-2xl relative custom-scrollbar">
            <button onClick={() => setEditingBatch(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 bg-gray-100 p-2 rounded-full"><X size={20}/></button>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-5">
              <Pencil className="text-blue-500" size={20}/> Sửa Thông Tin Lô
            </h2>
            
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl mb-5 flex gap-2">
               <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
               <div className="text-xs text-amber-800 leading-relaxed">
                 Chỉ sửa <b>Số lượng & Giá Vốn Mua Vào</b>. Muốn giảm tồn kho hiện tại hãy chốt Đơn Hao Hụt.
               </div>
            </div>
            
            <form onSubmit={handleUpdateBatch} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-5 rounded-2xl border border-gray-200">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Mã Lô</label>
                  <input required className="w-full border border-gray-300 rounded-xl p-3 font-bold text-sm uppercase outline-none focus:border-blue-500 bg-white" value={editBatchForm.batch_code} onChange={e => setEditBatchForm({...editBatchForm, batch_code: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-blue-600 mb-1 flex items-center gap-1"><Calendar size={14}/> Ngày Nhập</label>
                  <input required type="date" className="w-full border border-blue-200 rounded-xl p-3 font-bold text-sm outline-none focus:border-blue-500 bg-blue-50" value={editBatchForm.purchase_date} onChange={e => setEditBatchForm({...editBatchForm, purchase_date: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Nguồn nhập</label>
                  <input required className="w-full border border-gray-300 rounded-xl p-3 text-sm outline-none focus:border-blue-500 bg-white" value={editBatchForm.supplier_name} onChange={e => setEditBatchForm({...editBatchForm, supplier_name: e.target.value})} />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                 <label className="text-xs font-bold uppercase text-gray-800 mb-4 block">Sửa Khối Lượng & Giá Vốn</label>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                        <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Hàng Xô</span>
                        <input type="text" placeholder="Kg" className="w-full border border-gray-200 rounded-lg p-2 font-bold text-sm text-center outline-none focus:border-blue-400 mb-2" value={editBatchForm.weight_xo} onChange={e => setEditBatchForm({...editBatchForm, weight_xo: e.target.value})} />
                        <input type="number" placeholder="Giá gốc" className="w-full border border-gray-200 rounded-lg p-2 text-xs text-center outline-none focus:border-blue-400" value={editBatchForm.cost_xo} onChange={e => setEditBatchForm({...editBatchForm, cost_xo: e.target.value})} />
                    </div>
                    <div className="bg-green-50/50 p-3 rounded-xl border border-green-100">
                        <span className="text-[10px] font-bold text-green-600 uppercase block mb-1.5">Hàng Đẹp</span>
                        <input type="text" placeholder="Kg" className="w-full border border-green-200 rounded-lg p-2 font-bold text-sm text-center outline-none focus:border-green-400 mb-2" value={editBatchForm.weight_dep} onChange={e => setEditBatchForm({...editBatchForm, weight_dep: e.target.value})} />
                        <input type="number" placeholder="Giá gốc" className="w-full border border-green-200 rounded-lg p-2 text-xs text-center outline-none focus:border-green-400" value={editBatchForm.cost_dep} onChange={e => setEditBatchForm({...editBatchForm, cost_dep: e.target.value})} />
                    </div>
                    <div className="bg-orange-50/50 p-3 rounded-xl border border-orange-100">
                        <span className="text-[10px] font-bold text-orange-500 uppercase block mb-1.5">Hàng Vừa</span>
                        <input type="text" placeholder="Kg" className="w-full border border-orange-200 rounded-lg p-2 font-bold text-sm text-center outline-none focus:border-orange-400 mb-2" value={editBatchForm.weight_vua} onChange={e => setEditBatchForm({...editBatchForm, weight_vua: e.target.value})} />
                        <input type="number" placeholder="Giá gốc" className="w-full border border-orange-200 rounded-lg p-2 text-xs text-center outline-none focus:border-orange-400" value={editBatchForm.cost_vua} onChange={e => setEditBatchForm({...editBatchForm, cost_vua: e.target.value})} />
                    </div>
                    <div className="bg-red-50/50 p-3 rounded-xl border border-red-100">
                        <span className="text-[10px] font-bold text-red-500 uppercase block mb-1.5">Hàng Xấu</span>
                        <input type="text" placeholder="Kg" className="w-full border border-red-200 rounded-lg p-2 font-bold text-sm text-center outline-none focus:border-red-400 mb-2" value={editBatchForm.weight_xau} onChange={e => setEditBatchForm({...editBatchForm, weight_xau: e.target.value})} />
                        <input type="number" placeholder="Giá gốc" className="w-full border border-red-200 rounded-lg p-2 text-xs text-center outline-none focus:border-red-400" value={editBatchForm.cost_xau} onChange={e => setEditBatchForm({...editBatchForm, cost_xau: e.target.value})} />
                    </div>
                 </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-gray-100 items-center justify-between">
                 <label className="flex items-center gap-2 cursor-pointer bg-gray-50 p-3 rounded-xl border hover:bg-gray-100 transition-colors w-full sm:w-auto">
                   <input type="checkbox" className="w-4 h-4 accent-blue-600 rounded" checked={editBatchForm.has_receipt} onChange={e => setEditBatchForm({...editBatchForm, has_receipt: e.target.checked})} />
                   <span className="text-sm font-semibold text-gray-700">Lô này đã khai báo Thuế</span>
                 </label>
                 <div className="flex gap-3 w-full sm:w-auto">
                    <button type="button" onClick={() => setEditingBatch(null)} className="w-1/3 sm:w-auto px-6 py-3 rounded-xl font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">Hủy</button>
                    <button type="submit" className="w-2/3 sm:w-auto bg-blue-600 text-white font-bold rounded-xl px-8 py-3 shadow-md hover:bg-blue-700 transition-colors">Lưu Gốc Nhập</button>
                 </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP LỊCH SỬ KÈM NÚT "XÓA ĐỂ HOÀN KHO" */}
      {modalData && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-[24px] p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative">
            <button onClick={() => setModalData(null)} className="absolute top-5 right-5 text-gray-400 bg-gray-100 p-2 rounded-full hover:bg-gray-200 transition-colors"><X size={20}/></button>
            <div className="mb-5 pr-8 border-b border-gray-100 pb-4">
               <h2 className="text-lg font-bold text-gray-900">
                  {modalData.type === 'tax' ? 'Lịch sử Thuế' : 
                   modalData.type === 'loss' ? 'Chi tiết hao hụt' :
                   modalData.type === 'revenue' ? 'Doanh thu thu về' :
                   modalData.type === 'profit' ? 'Lợi nhuận ròng' :
                   modalData.type === 'ship' ? 'Phí vận chuyển' : 'Lịch sử xuất kho Lô ' + modalData.batch.batch_code}
               </h2>
            </div>
            <div className="overflow-x-auto overflow-y-auto pr-2 space-y-2 custom-scrollbar flex-1">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead className="bg-gray-50 text-[10px] font-bold uppercase text-gray-500">
                  <tr>
                    <th className="p-3 rounded-l-lg">Khách hàng</th>
                    <th className="p-3">Ngày</th>
                    <th className="p-3 text-center">Loại</th>
                    <th className="p-3 text-right">Kg mua</th>
                    {modalData.type === 'tax' && <th className="p-3 text-orange-500 text-right">Thuế 5%</th>}
                    {modalData.type === 'loss' && <th className="p-3 text-red-500 text-right">Hao hụt</th>}
                    {modalData.type === 'ship' && <th className="p-3 text-purple-600 text-right">Phí ship</th>}
                    {modalData.type === 'profit' && <th className="p-3 text-emerald-600 text-right">Lãi ròng</th>}
                    <th className="p-3 rounded-r-lg text-right">Doanh thu</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {modalData.batch.orders?.map((o: any) => (
                    <tr key={o.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors group">
                      <td className="p-3 font-semibold text-gray-800 truncate max-w-[120px]">{o.customers?.name}</td>
                      <td className="p-3 text-gray-500 text-xs">{new Date(o.created_at).toLocaleDateString('vi-VN')}</td>
                      <td className="p-3 text-center"><span className="text-orange-600 uppercase text-[10px] font-bold bg-orange-50 px-2 py-0.5 rounded">{o.grade_type || 'Xô'}</span></td>
                      <td className="p-3 text-gray-900 font-bold text-right">{Number(o.weight).toFixed(3)}kg</td>
                      {modalData.type === 'tax' && <td className="p-3 text-orange-600 text-right">-{Number(o.tax_amount).toLocaleString()}đ</td>}
                      {modalData.type === 'loss' && <td className="p-3 text-red-600 text-right">{Number(o.weight_loss).toFixed(3)}kg</td>}
                      {modalData.type === 'ship' && <td className="p-3 text-purple-600 text-right">-{Number(o.shipping_fee).toLocaleString()}đ</td>}
                      {modalData.type === 'profit' && <td className="p-3 text-emerald-600 font-bold text-right">+{Number(o.profit).toLocaleString()}đ</td>}
                      
                      <td className="p-3 text-right">
                         <span className="text-blue-600 font-bold block">{Number(o.revenue).toLocaleString()}đ</span>
                         <button onClick={() => handleDeleteOrderFromHistory(o.id)} className="mt-1 flex items-center justify-end gap-1 text-[10px] text-red-500 font-bold ml-auto opacity-50 hover:opacity-100 transition-opacity" title="Xóa để trả yến lại vào kho">
                            <Trash2 size={12}/> Hoàn Kho
                         </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!modalData.batch.orders || modalData.batch.orders.length === 0) && <p className="text-center py-8 text-gray-400 text-sm">Chưa xuất đơn nào.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
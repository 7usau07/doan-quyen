'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Calculator, ArrowRight, Droplet, Users, Target, Package, DollarSign, Info } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function ProductionPage() {
  const router = useRouter()
  const [batches, setBatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)

  // FORM NHẬP LIỆU GIA CÔNG
  const [form, setForm] = useState({
    batch_id: '',
    rawWeight: '',
    refinedWeight: '',
    laborCost: '',
    utilityCost: '',
    targetProfit100g: '400000' // Mặc định lời 400k / 100g
  })

  useEffect(() => {
    async function fetchBatches() {
      const { data: batchData } = await supabase
        .from('batches')
        .select('*, orders(weight, weight_loss)')
        .order('created_at', { ascending: false })

      if (batchData) {
        // Chỉ lọc giữ lại những lô có Tồn Kho > 0
        const activeBatches = batchData.map(batch => {
            const sold = batch.orders?.reduce((sum: number, o: any) => sum + Number(o.weight || 0), 0) || 0;
            const loss = batch.orders?.reduce((sum: number, o: any) => sum + Number(o.weight_loss || 0), 0) || 0;
            const remain = Number(batch.total_weight) - sold - loss;
            return { ...batch, remain }
        }).filter(b => b.remain > 0);

        setBatches(activeBatches)
      }
      setLoading(false)
    }
    fetchBatches()
  }, [])

  // --- LOGIC TÍNH TOÁN GIÁ VỐN TINH CHẾ THÔNG MINH ---
  const calculations = useMemo(() => {
    const selectedBatch = batches.find(b => b.id === form.batch_id)
    const rawWeight = Number(form.rawWeight) || 0
    const refinedWeight = Number(form.refinedWeight) || 0
    const labor = Number(form.laborCost) || 0
    const utility = Number(form.utilityCost) || 0
    const targetProfit = Number(form.targetProfit100g) || 0

    // 1. Tiền gốc của Yến Thô
    const rawCostPerKg = selectedBatch ? Number(selectedBatch.cost_per_kg) : 0
    const totalRawCost = rawWeight * rawCostPerKg

    // 2. Tỷ lệ hao hụt lông & tạp chất
    const shrinkageKg = rawWeight - refinedWeight
    const shrinkagePercent = rawWeight > 0 ? (shrinkageKg / rawWeight) * 100 : 0

    // 3. Tổng chi phí sản xuất mẻ này
    const totalProductionCost = totalRawCost + labor + utility

    // 4. GIÁ VỐN TINH CHẾ MỚI (VNĐ / Kg)
    const newCostPerKg = refinedWeight > 0 ? (totalProductionCost / refinedWeight) : 0
    const newCostPer100g = newCostPerKg / 10

    // 5. GIÁ BÁN ĐỀ XUẤT ĐỂ ĐẠT TARGET LỢI NHUẬN
    const minSellPrice100g = newCostPer100g + targetProfit
    const minSellPriceKg = minSellPrice100g * 10

    return {
      selectedBatch, rawCostPerKg, totalRawCost, shrinkageKg, shrinkagePercent,
      totalProductionCost, newCostPerKg, newCostPer100g, minSellPrice100g, minSellPriceKg
    }
  }, [form, batches])

  // --- HÀM XUẤT KHO THÔ & NHẬP KHO TINH CHẾ ---
  const handleFinalizeProduction = async () => {
    if (!form.batch_id || !form.rawWeight || !form.refinedWeight) {
      alert("Sếp điền đủ Lô, Kg xuất và Kg thu về nhé!"); return;
    }
    
    // Kiểm tra xem xuất lố số lượng tồn kho không
    if (Number(form.rawWeight) > calculations.selectedBatch.remain) {
        alert(`Lô này chỉ còn ${calculations.selectedBatch.remain.toFixed(3)}kg, sếp không thể xuất ${form.rawWeight}kg được!`); return;
    }

    if (calculations.shrinkageKg < 0) {
      alert("Vô lý! Số kg tinh chế thu về không thể lớn hơn số kg thô xuất ra được."); return;
    }
    if (!window.confirm(`Xác nhận chốt gia công mẻ này?\nHệ thống sẽ trừ ${form.rawWeight}kg ở lô cũ và tạo một Lô Tinh Chế mới với giá vốn mới.`)) return;

    setIsProcessing(true)
    try {
      // 1. Tạo Khách Hàng Nội Bộ (Xưởng Gia Công) để lưu lịch sử
      let { data: sysCust } = await supabase.from('customers').select('id').eq('phone', '0000000001').maybeSingle()
      let sysCustId = sysCust?.id
      if (!sysCustId) {
        const { data: newCust } = await supabase.from('customers').insert([{ name: 'XƯỞNG GIA CÔNG DD PRIME', phone: '0000000001', address: 'Nội bộ' }]).select().single()
        sysCustId = newCust?.id
      }

      // 2. Xuất đơn hàng để trừ Kho Thô (Lưu ý: Doanh thu = Chi phí để không làm sai Lợi Nhuận)
      await supabase.from('orders').insert([{
        customer_id: sysCustId,
        batch_id: form.batch_id,
        grade_type: 'Xô', // Xuất từ hàng Xô
        weight: Number(form.rawWeight),
        cost: calculations.totalRawCost,
        revenue: calculations.totalRawCost, // Hòa vốn nội bộ
        profit: 0,
        status: 'Hoàn tất',
        note: `Xuất gia công tinh chế. Thu về ${form.refinedWeight}kg. Tiền công: ${form.laborCost}đ`,
        created_at: new Date().toISOString()
      }])

      // 3. Tạo Lô Tinh Chế Mới trong Kho
      await supabase.from('batches').insert([{
        batch_code: `TC-${calculations.selectedBatch.batch_code}`, // Ví dụ: TC-L0-05
        total_weight: Number(form.refinedWeight),
        weight_dep: Number(form.refinedWeight), // Cho hết vào hàng Đẹp
        weight_xo: 0, weight_vua: 0, weight_xau: 0,
        cost_per_kg: calculations.newCostPerKg, // Giá vốn đã gánh hao hụt & công thợ
        supplier_name: `Gia công từ ${calculations.selectedBatch.batch_code}`,
        purchase_date: new Date().toISOString().split('T')[0]
      }])

      alert("🎉 Đã chốt gia công thành công! Lô Tinh Chế mới đã có trong kho.")
      router.push('/dashboard/inventory')
    } catch (error) {
      alert("Có lỗi hệ thống khi lưu mẻ gia công!");
    } finally {
      setIsProcessing(false)
    }
  }

  if (loading) return <div className="p-10 font-bold text-gray-400 animate-pulse text-center uppercase tracking-widest text-sm">Đang khởi động Máy Tính Gia Công...</div>

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-24 max-w-6xl mx-auto font-sans bg-gray-50 min-h-screen">
      
      {/* HEADER (MOBILE TỐI ƯU) */}
      <div className="bg-gray-900 rounded-[24px] md:rounded-[40px] p-6 md:p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
         <div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter flex items-center gap-2"><Calculator className="text-orange-400" size={28}/> Sổ Gia Công</h1>
            <p className="text-gray-400 font-medium text-xs md:text-sm mt-1 tracking-tight">Tính chính xác giá vốn Tinh Chế sau hao hụt & Định giá bán</p>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
        
        {/* KHU VỰC NHẬP LIỆU (CỘT TRÁI) */}
        <div className="lg:col-span-5 space-y-5 md:space-y-6">
           
           {/* BƯỚC 1 */}
           <div className="bg-white p-5 md:p-6 rounded-[24px] border border-gray-200 shadow-sm space-y-4 md:space-y-5">
              <h3 className="font-bold uppercase text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3 text-sm md:text-base"><Package className="text-blue-500" size={18}/> 1. Xuất Yến Thô</h3>
              
              <div>
                <label className="text-[10px] md:text-xs font-bold uppercase text-gray-500 mb-1 block ml-1">Lấy từ lô thô nào?</label>
                <select className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-semibold text-gray-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all text-sm md:text-base" value={form.batch_id} onChange={e => setForm({...form, batch_id: e.target.value})}>
                  <option value="">-- Chọn lô thô --</option>
                  {batches.map(b => (
                     <option key={b.id} value={b.id}>
                        {b.batch_code} (Còn: {b.remain.toFixed(2)}kg | Vốn: {Math.round(b.cost_per_kg).toLocaleString()}đ)
                     </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] md:text-xs font-bold uppercase text-blue-600 mb-1 block ml-1">Số Kg thô lấy ra làm</label>
                <input type="number" step="0.001" placeholder="VD: 0.5 (Nửa ký)" className="w-full border border-blue-200 bg-blue-50/50 rounded-xl p-3 md:p-4 font-black text-blue-800 text-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all" value={form.rawWeight} onChange={e => setForm({...form, rawWeight: e.target.value})} />
              </div>
           </div>

           {/* BƯỚC 2 */}
           <div className="bg-white p-5 md:p-6 rounded-[24px] border border-gray-200 shadow-sm space-y-4 md:space-y-5">
              <h3 className="font-bold uppercase text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3 text-sm md:text-base"><Users className="text-orange-500" size={18}/> 2. Chi Phí Gia Công</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                 <div>
                   <label className="text-[10px] md:text-xs font-bold uppercase text-gray-500 mb-1 block ml-1">Tiền công thợ nhặt</label>
                   <input type="number" placeholder="VNĐ" className="w-full border border-gray-200 rounded-xl p-3 font-semibold text-gray-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all text-sm md:text-base" value={form.laborCost} onChange={e => setForm({...form, laborCost: e.target.value})} />
                 </div>
                 <div>
                   <label className="text-[10px] md:text-xs font-bold uppercase text-gray-500 mb-1 block ml-1">Điện, Nước, Khấu hao</label>
                   <input type="number" placeholder="VNĐ" className="w-full border border-gray-200 rounded-xl p-3 font-semibold text-gray-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all text-sm md:text-base" value={form.utilityCost} onChange={e => setForm({...form, utilityCost: e.target.value})} />
                 </div>
              </div>
           </div>

           {/* BƯỚC 3 */}
           <div className="bg-emerald-50 p-5 md:p-6 rounded-[24px] border border-emerald-200 shadow-sm space-y-4 md:space-y-5 relative overflow-hidden">
              <div className="absolute -right-4 -top-4 opacity-10 text-emerald-500"><Droplet size={80}/></div>
              <h3 className="font-bold uppercase text-emerald-900 flex items-center gap-2 border-b border-emerald-200/50 pb-3 relative z-10 text-sm md:text-base"><Droplet className="text-emerald-500" size={18}/> 3. Thu Thành Phẩm</h3>
              
              <div className="relative z-10">
                <label className="text-[10px] md:text-xs font-bold uppercase text-emerald-700 mb-1 block ml-1">Số Kg Tinh Chế thu được</label>
                <input type="number" step="0.001" placeholder="VD: 0.35" className="w-full border border-emerald-300 bg-white rounded-xl p-3 md:p-4 font-black text-emerald-800 text-lg outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-all shadow-inner" value={form.refinedWeight} onChange={e => setForm({...form, refinedWeight: e.target.value})} />
              </div>
           </div>
        </div>

        {/* KHU VỰC KẾT QUẢ ĐỊNH GIÁ (CỘT PHẢI) */}
        <div className="lg:col-span-7 space-y-6">
           <div className="bg-gray-900 p-6 md:p-8 rounded-[24px] md:rounded-[40px] shadow-2xl border border-gray-800 text-white relative">
              <h2 className="text-lg md:text-xl font-black uppercase tracking-widest text-gray-400 mb-6 md:mb-8 flex items-center gap-2"><DollarSign/> Định Giá Thành Phẩm</h2>
              
              {/* KHỐI HAO HỤT MOBILE 2 CỘT */}
              <div className="grid grid-cols-2 gap-3 md:gap-6 mb-6 md:mb-8">
                 <div className="bg-gray-800 p-3 md:p-4 rounded-2xl md:rounded-3xl border border-gray-700 flex flex-col justify-center">
                    <p className="text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Gốc yến thô</p>
                    <p className="text-base md:text-xl font-black truncate">{calculations.totalRawCost.toLocaleString()}đ</p>
                 </div>
                 <div className="bg-gray-800 p-3 md:p-4 rounded-2xl md:rounded-3xl border border-gray-700 relative overflow-hidden flex flex-col justify-center">
                    <p className="text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Hao hụt lông/tạp chất</p>
                    <p className={`text-base md:text-xl font-black ${calculations.shrinkagePercent > 30 ? 'text-red-400' : 'text-orange-400'}`}>{calculations.shrinkagePercent.toFixed(1)}%</p>
                    <span className="absolute bottom-1 md:bottom-2 right-2 md:right-4 text-[8px] md:text-[10px] text-gray-500 font-bold">{calculations.shrinkageKg.toFixed(3)}kg bay màu</span>
                 </div>
              </div>

              {/* BÁO CÁO GIÁ VỐN */}
              <div className="space-y-4 mb-6 md:mb-8">
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end border-b border-gray-700 pb-4 gap-2">
                    <div>
                       <p className="text-[10px] md:text-xs font-black uppercase text-blue-400 tracking-widest">Giá Vốn Mới (1 KG Tinh Chế)</p>
                       <p className="text-[9px] md:text-[10px] text-gray-500 italic mt-0.5 md:mt-1">Đã gánh hao hụt + công thợ + điện nước</p>
                    </div>
                    <p className="text-2xl md:text-3xl font-black text-blue-400">{Math.round(calculations.newCostPerKg).toLocaleString()}đ</p>
                 </div>
                 <div className="flex justify-between items-end pb-2">
                    <p className="text-[10px] md:text-xs font-black uppercase text-gray-300">Giá vốn 1 Lạng (100g)</p>
                    <p className="text-xl md:text-2xl font-black text-white">{Math.round(calculations.newCostPer100g).toLocaleString()}đ</p>
                 </div>
              </div>

              {/* KHỐI ĐỊNH GIÁ BÁN (MÀU NỔI BẬT) */}
              <div className="bg-gradient-to-r from-orange-500 to-red-500 p-5 md:p-6 rounded-[20px] md:rounded-[24px] shadow-inner mt-6 md:mt-8">
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                    <h3 className="font-black uppercase tracking-widest text-xs md:text-sm flex items-center gap-1.5"><Target size={16}/> Mức Lời Kỳ Vọng (/100g)</h3>
                    <input type="number" className="w-full sm:w-28 bg-white/20 border border-white/30 rounded-xl px-3 py-2 text-left sm:text-right font-black text-white outline-none focus:bg-white/30 transition-colors" value={form.targetProfit100g} onChange={e => setForm({...form, targetProfit100g: e.target.value})}/>
                 </div>
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-t border-white/20 pt-4 gap-1">
                    <p className="font-black uppercase text-[10px] md:text-[11px] tracking-widest text-orange-100">Giá Bán Tối Thiểu<br className="hidden sm:block"/>(1 Lạng)</p>
                    <p className="text-3xl md:text-4xl font-black tracking-tighter drop-shadow-md">
                       {Math.round(calculations.minSellPrice100g).toLocaleString()}đ
                    </p>
                 </div>
                 <p className="text-left sm:text-right text-[9px] md:text-[10px] mt-2 font-bold opacity-90 text-orange-100">Bán 1Kg tinh chế thu về: {Math.round(calculations.minSellPriceKg).toLocaleString()}đ</p>
              </div>
           </div>

           {/* NÚT CHỐT LƯU KHO (MOBILE CHUYỂN DỌC) */}
           <div className="bg-blue-50 border border-blue-200 p-5 md:p-6 rounded-[24px] md:rounded-[30px] flex flex-col md:flex-row items-center justify-between gap-4 md:gap-5 shadow-sm">
              <div className="flex items-start gap-2.5 w-full">
                 <Info className="text-blue-500 mt-0.5 shrink-0" size={18}/>
                 <p className="text-[11px] md:text-xs font-medium text-blue-800 leading-relaxed">Khi bấm Chốt, hệ thống sẽ <b>trừ số yến thô</b> ở kho, và tạo một <b>Mã Lô Tinh Chế Mới</b> với giá vốn đã được cập nhật.</p>
              </div>
              <button onClick={handleFinalizeProduction} disabled={isProcessing} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest px-6 py-4 rounded-xl md:rounded-2xl shadow-md transition-all flex justify-center items-center gap-2 shrink-0 disabled:opacity-50 text-xs md:text-sm">
                 {isProcessing ? 'Đang xử lý...' : 'Chốt Lô Tinh Chế'} <ArrowRight size={16}/>
              </button>
           </div>

        </div>
      </div>
    </div>
  )
}
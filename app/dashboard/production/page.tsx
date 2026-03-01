'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Calculator, ArrowRight, Droplet, Users, Zap, Target, Package, DollarSign, Info } from 'lucide-react'
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
    targetProfit100g: '400000' // Mặc định lời 400k / 100g như sếp muốn
  })

  useEffect(() => {
    async function fetchBatches() {
      // ĐÃ FIX: Lấy Lô hàng kèm theo Đơn hàng để tính Tồn Kho Thực Tế
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

  if (loading) return <div className="p-10 font-black text-gray-400 animate-pulse text-center uppercase tracking-widest">Đang khởi động Máy Tính Gia Công...</div>

  return (
    <div className="p-6 space-y-8 animate-in fade-in duration-500 pb-20 max-w-6xl mx-auto">
      
      <div className="bg-gray-900 rounded-[40px] p-8 text-white shadow-2xl flex flex-col md:flex-row justify-between items-center gap-6">
         <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-3"><Calculator className="text-orange-400" size={32}/> Máy Tính Gia Công</h1>
            <p className="text-gray-400 font-bold mt-1 tracking-tight">Tính chính xác giá vốn Tinh Chế sau hao hụt & Định giá bán</p>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* KHU VỰC NHẬP LIỆU (CỘT TRÁI) */}
        <div className="lg:col-span-5 space-y-6">
           <div className="bg-white p-6 rounded-[30px] border border-gray-200 shadow-sm space-y-5">
              <h3 className="font-black uppercase tracking-tighter text-gray-900 flex items-center gap-2 border-b pb-4"><Package className="text-blue-500" size={18}/> 1. Xuất Yến Thô</h3>
              
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block ml-1">Lấy từ lô thô nào?</label>
                <select className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl p-3 font-bold text-gray-900 outline-none focus:border-blue-400" value={form.batch_id} onChange={e => setForm({...form, batch_id: e.target.value})}>
                  <option value="">-- Chọn lô thô --</option>
                  {batches.map(b => (
                     <option key={b.id} value={b.id}>
                        {b.batch_code} (Còn: {b.remain.toFixed(2)}kg | Vốn: {Math.round(b.cost_per_kg).toLocaleString()}đ)
                     </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-blue-600 mb-1 block ml-1">Số Kg thô lấy ra làm</label>
                <input type="number" step="0.001" placeholder="VD: 0.5 (Nửa ký)" className="w-full border-2 border-blue-100 bg-blue-50/50 rounded-xl p-4 font-black text-blue-800 text-lg outline-none focus:border-blue-400" value={form.rawWeight} onChange={e => setForm({...form, rawWeight: e.target.value})} />
              </div>
           </div>

           <div className="bg-white p-6 rounded-[30px] border border-gray-200 shadow-sm space-y-5">
              <h3 className="font-black uppercase tracking-tighter text-gray-900 flex items-center gap-2 border-b pb-4"><Users className="text-orange-500" size={18}/> 2. Chi Phí Gia Công</h3>
              
              <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block ml-1">Tiền công thợ nhặt</label>
                   <input type="number" placeholder="VNĐ" className="w-full border-2 border-gray-100 rounded-xl p-3 font-bold text-gray-900 outline-none focus:border-orange-400" value={form.laborCost} onChange={e => setForm({...form, laborCost: e.target.value})} />
                 </div>
                 <div>
                   <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block ml-1">Điện, Nước, Khấu hao</label>
                   <input type="number" placeholder="VNĐ" className="w-full border-2 border-gray-100 rounded-xl p-3 font-bold text-gray-900 outline-none focus:border-orange-400" value={form.utilityCost} onChange={e => setForm({...form, utilityCost: e.target.value})} />
                 </div>
              </div>
           </div>

           <div className="bg-emerald-50 p-6 rounded-[30px] border border-emerald-200 shadow-sm space-y-5 relative overflow-hidden">
              <div className="absolute -right-4 -top-4 opacity-10 text-emerald-500"><Droplet size={100}/></div>
              <h3 className="font-black uppercase tracking-tighter text-emerald-900 flex items-center gap-2 border-b border-emerald-200/50 pb-4 relative z-10"><Droplet className="text-emerald-500" size={18}/> 3. Thu Thành Phẩm</h3>
              
              <div className="relative z-10">
                <label className="text-[10px] font-black uppercase text-emerald-600 mb-1 block ml-1">Số Kg Tinh Chế thu được</label>
                <input type="number" step="0.001" placeholder="VD: 0.35" className="w-full border-2 border-emerald-300 bg-white rounded-xl p-4 font-black text-emerald-800 text-lg outline-none focus:border-emerald-500 shadow-inner" value={form.refinedWeight} onChange={e => setForm({...form, refinedWeight: e.target.value})} />
              </div>
           </div>
        </div>

        {/* KHU VỰC KẾT QUẢ ĐỊNH GIÁ (CỘT PHẢI) */}
        <div className="lg:col-span-7 space-y-6">
           <div className="bg-gray-900 p-8 rounded-[40px] shadow-2xl border border-gray-800 text-white relative">
              <h2 className="text-xl font-black uppercase tracking-widest text-gray-400 mb-8 flex items-center gap-2"><DollarSign/> Báo Cáo Định Giá Thành Phẩm</h2>
              
              <div className="grid grid-cols-2 gap-6 mb-8">
                 <div className="bg-gray-800 p-4 rounded-3xl border border-gray-700">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Gốc yến thô bỏ ra</p>
                    <p className="text-xl font-black">{calculations.totalRawCost.toLocaleString()}đ</p>
                 </div>
                 <div className="bg-gray-800 p-4 rounded-3xl border border-gray-700 relative overflow-hidden">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Hao hụt tạp chất/lông</p>
                    <p className={`text-xl font-black ${calculations.shrinkagePercent > 30 ? 'text-red-400' : 'text-orange-400'}`}>{calculations.shrinkagePercent.toFixed(1)}%</p>
                    <span className="absolute bottom-2 right-4 text-[10px] text-gray-500 font-bold">{calculations.shrinkageKg.toFixed(3)}kg bay màu</span>
                 </div>
              </div>

              <div className="space-y-4 mb-8">
                 <div className="flex justify-between items-end border-b border-gray-700 pb-4">
                    <div>
                       <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest">Giá Vốn Mới (VNĐ / 1 KG Tinh Chế)</p>
                       <p className="text-[10px] text-gray-500 italic mt-1">Đã gánh hao hụt + công thợ + điện nước</p>
                    </div>
                    <p className="text-3xl font-black text-blue-400">{Math.round(calculations.newCostPerKg).toLocaleString()}đ</p>
                 </div>
                 <div className="flex justify-between items-end pb-2">
                    <p className="text-xs font-black uppercase text-gray-300">Giá vốn 1 Lạng (100g)</p>
                    <p className="text-2xl font-black text-white">{Math.round(calculations.newCostPer100g).toLocaleString()}đ</p>
                 </div>
              </div>

              <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6 rounded-3xl shadow-inner mt-8">
                 <div className="flex justify-between items-center mb-4">
                    <h3 className="font-black uppercase tracking-widest text-sm flex items-center gap-2"><Target size={18}/> Mức Lời Kỳ Vọng (/100g)</h3>
                    <input type="number" className="w-24 bg-white/20 border border-white/30 rounded-xl px-2 py-1 text-right font-black text-white outline-none" value={form.targetProfit100g} onChange={e => setForm({...form, targetProfit100g: e.target.value})}/>
                 </div>
                 <div className="flex justify-between items-center border-t border-white/20 pt-4">
                    <p className="font-black uppercase text-[11px] tracking-widest">Giá Bán Tối Thiểu<br/>(1 Lạng)</p>
                    <p className="text-4xl font-black tracking-tighter drop-shadow-md">
                       {Math.round(calculations.minSellPrice100g).toLocaleString()}đ
                    </p>
                 </div>
                 <p className="text-right text-[10px] mt-2 font-bold opacity-80">Bán 1Kg tinh chế thu về: {Math.round(calculations.minSellPriceKg).toLocaleString()}đ</p>
              </div>
           </div>

           {/* NÚT CHỐT LƯU KHO */}
           <div className="bg-blue-50 border border-blue-200 p-6 rounded-[30px] flex items-center justify-between gap-4 shadow-sm">
              <div className="flex items-start gap-3">
                 <Info className="text-blue-500 mt-1 shrink-0"/>
                 <p className="text-xs font-bold text-blue-800 leading-relaxed">Khi bấm Chốt, hệ thống sẽ <b>trừ số yến thô</b> ở kho, và tạo một <b>Mã Lô Tinh Chế Mới</b> với giá vốn đã được cập nhật chính xác như trên.</p>
              </div>
              <button onClick={handleFinalizeProduction} disabled={isProcessing} className="bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest px-8 py-5 rounded-2xl shadow-lg shadow-blue-500/40 transition-all flex items-center gap-2 shrink-0 disabled:opacity-50">
                 {isProcessing ? 'Đang xử lý...' : 'Chốt Lô Tinh Chế'} <ArrowRight size={18}/>
              </button>
           </div>

        </div>
      </div>
    </div>
  )
}
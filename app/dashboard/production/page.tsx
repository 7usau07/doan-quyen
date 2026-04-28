'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Calculator, ArrowRight, Droplet, Users, Target, Package, DollarSign, Info, Layers, PlusCircle, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function ProductionPage() {
  const router = useRouter()
  const [batches, setBatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)

  // CHUYỂN FORM THÀNH MẢNG ĐỂ TRỘN NHIỀU LÔ (MIXER)
  const [mixItems, setMixItems] = useState([
    { id: Date.now(), batch_id: '', grade_type: '', weight_used: '' }
  ])

  const [form, setForm] = useState({
    refinedWeight: '',
    laborCost: '',
    utilityCost: '',
    targetProfit100g: '400000' 
  })

  useEffect(() => {
    async function fetchBatches() {
      const { data: batchData } = await supabase
        .from('batches')
        .select('*, orders(weight, weight_loss, grade_type)')
        .order('created_at', { ascending: false })

      if (batchData) {
        const activeBatches = batchData.map(batch => {
            const ext_xo = batch.orders?.filter((o:any) => o.grade_type === 'Xô').reduce((sum: number, o: any) => sum + Number(o.weight || 0) + Number(o.weight_loss || 0), 0) || 0;
            const ext_dep = batch.orders?.filter((o:any) => o.grade_type === 'Đẹp').reduce((sum: number, o: any) => sum + Number(o.weight || 0) + Number(o.weight_loss || 0), 0) || 0;
            const ext_vua = batch.orders?.filter((o:any) => o.grade_type === 'Vừa').reduce((sum: number, o: any) => sum + Number(o.weight || 0) + Number(o.weight_loss || 0), 0) || 0;
            const ext_xau = batch.orders?.filter((o:any) => o.grade_type === 'Xấu').reduce((sum: number, o: any) => sum + Number(o.weight || 0) + Number(o.weight_loss || 0), 0) || 0;

            const remain_xo = Number(batch.weight_xo || 0) - ext_xo;
            const remain_dep = Number(batch.weight_dep || 0) - ext_dep;
            const remain_vua = Number(batch.weight_vua || 0) - ext_vua;
            const remain_xau = Number(batch.weight_xau || 0) - ext_xau;

            const remain = remain_xo + remain_dep + remain_vua + remain_xau;
            return { ...batch, remain, remain_xo, remain_dep, remain_vua, remain_xau }
        }).filter(b => b.remain > 0);

        setBatches(activeBatches)
      }
      setLoading(false)
    }
    fetchBatches()
  }, [])

  const getCostForGrade = (batch: any, grade: string) => {
      if (!batch) return 0;
      if (grade === 'Xô') return Number(batch.cost_xo || batch.cost_per_kg || 0);
      if (grade === 'Đẹp') return Number(batch.cost_dep || batch.cost_per_kg || 0);
      if (grade === 'Vừa') return Number(batch.cost_vua || batch.cost_per_kg || 0);
      if (grade === 'Xấu') return Number(batch.cost_xau || batch.cost_per_kg || 0);
      return Number(batch.cost_per_kg || 0);
  }

  const getRemainForGrade = (batch: any, grade: string) => {
      if (!batch) return 0;
      if (grade === 'Xô') return batch.remain_xo;
      if (grade === 'Đẹp') return batch.remain_dep;
      if (grade === 'Vừa') return batch.remain_vua;
      if (grade === 'Xấu') return batch.remain_xau;
      return batch.remain;
  }

  // --- CÁC HÀM XỬ LÝ TRỘN LÔ ---
  const handleAddMixItem = () => {
      setMixItems([...mixItems, { id: Date.now(), batch_id: '', grade_type: '', weight_used: '' }]);
  }

  const handleRemoveMixItem = (idToRemove: number) => {
      if (mixItems.length === 1) {
          alert("Phải có ít nhất 1 nguồn nguyên liệu chứ sếp!"); return;
      }
      setMixItems(mixItems.filter(item => item.id !== idToRemove));
  }

  const updateMixItem = (id: number, field: string, value: string) => {
      setMixItems(mixItems.map(item => {
          if (item.id === id) {
              const updatedItem = { ...item, [field]: value };
              // Nếu đổi lô mới, chọn luôn phân loại đầu tiên còn hàng và xoá số kg cũ
              if (field === 'batch_id') {
                  const b = batches.find(x => x.id === value);
                  if (b) {
                      if (b.remain_xo > 0) updatedItem.grade_type = 'Xô';
                      else if (b.remain_dep > 0) updatedItem.grade_type = 'Đẹp';
                      else if (b.remain_vua > 0) updatedItem.grade_type = 'Vừa';
                      else if (b.remain_xau > 0) updatedItem.grade_type = 'Xấu';
                  }
                  updatedItem.weight_used = '';
              }
              // Nếu đổi loại, xoá số kg cũ
              if (field === 'grade_type') {
                  updatedItem.weight_used = '';
              }
              return updatedItem;
          }
          return item;
      }));
  }

  const handleMaxWeight = (id: number) => {
      setMixItems(mixItems.map(item => {
          if (item.id === id && item.batch_id && item.grade_type) {
              const b = batches.find(x => x.id === item.batch_id);
              const maxVal = getRemainForGrade(b, item.grade_type);
              return { ...item, weight_used: maxVal.toString() };
          }
          return item;
      }));
  }

  // --- LOGIC TÍNH TOÁN GIÁ VỐN TRỘN HỖN HỢP TỪ NHIỀU LÔ ---
  const calculations = useMemo(() => {
    let totalRawWeight = 0;
    let totalRawCost = 0;

    mixItems.forEach(item => {
        if (item.batch_id && item.weight_used) {
            const batch = batches.find(b => b.id === item.batch_id);
            const weight = Math.abs(Number(item.weight_used) || 0);
            if (batch && weight > 0) {
                totalRawWeight += weight;
                // Cộng dồn Vốn (Khối lượng * Giá vốn của loại đó trong lô đó)
                totalRawCost += weight * getCostForGrade(batch, item.grade_type);
            }
        }
    });

    const refinedWeight = Math.abs(Number(form.refinedWeight) || 0)
    const labor = Math.abs(Number(form.laborCost) || 0)
    const utility = Math.abs(Number(form.utilityCost) || 0)
    const targetProfit = Math.abs(Number(form.targetProfit100g) || 0)

    // Tỷ lệ hao hụt
    const shrinkageKg = totalRawWeight - refinedWeight
    const shrinkagePercent = totalRawWeight > 0 ? (shrinkageKg / totalRawWeight) * 100 : 0

    // Tổng chi phí sản xuất mẻ này
    const totalProductionCost = totalRawCost + labor + utility

    // GIÁ VỐN TINH CHẾ MỚI
    const newCostPerKg = refinedWeight > 0 ? (totalProductionCost / refinedWeight) : 0
    const newCostPer100g = newCostPerKg / 10

    // GIÁ BÁN ĐỀ XUẤT 
    const minSellPrice100g = newCostPer100g + targetProfit
    const minSellPriceKg = minSellPrice100g * 10

    return {
      totalRawWeight, totalRawCost, shrinkageKg, shrinkagePercent,
      totalProductionCost, newCostPerKg, newCostPer100g, minSellPrice100g, minSellPriceKg
    }
  }, [mixItems, form, batches])

  // --- HÀM XUẤT KHO & NHẬP KHO TINH CHẾ TỪ MẢNG MIX ---
  const handleFinalizeProduction = async () => {
    // Lọc ra những thành phần có nhập đủ thông tin
    const validItems = mixItems.filter(item => item.batch_id && Number(item.weight_used) > 0);

    if (validItems.length === 0 || !form.refinedWeight) {
      alert("Sếp phải chọn ít nhất 1 lô xuất đi và nhập Số Kg thành phẩm thu về nhé!"); return;
    }
    
    // Validate không cho xuất lố kho
    for (const item of validItems) {
        const b = batches.find(x => x.id === item.batch_id);
        const maxRemain = getRemainForGrade(b, item.grade_type);
        if (Number(item.weight_used) > maxRemain + 0.0001) {
            alert(`Lô ${b.batch_code} loại ${item.grade_type} chỉ còn ${maxRemain}kg, không thể xuất lố ${item.weight_used}kg!`);
            return;
        }
    }

    if (calculations.shrinkageKg < 0) {
      alert("Vô lý! Số kg tinh chế thu về không thể lớn hơn tổng số kg thô xuất ra được."); return;
    }

    // Gộp tên các lô lại làm Ghi chú cho dễ nhớ
    const batchCodesUsed = Array.from(new Set(validItems.map(i => {
        const b = batches.find(x => x.id === i.batch_id);
        return b?.batch_code;
    }))).join(', ');

    if (!window.confirm(`Xác nhận chốt mẻ này?\nHệ thống sẽ trừ tổng cộng ${calculations.totalRawWeight}kg từ các lô ${batchCodesUsed} và tạo ra 1 Lô Tinh Chế mới.`)) return;

    setIsProcessing(true)
    try {
      let { data: sysCust } = await supabase.from('customers').select('id').eq('phone', '0000000001').maybeSingle()
      let sysCustId = sysCust?.id
      if (!sysCustId) {
        const { data: newCust } = await supabase.from('customers').insert([{ name: 'XƯỞNG GIA CÔNG DD PRIME', phone: '0000000001', address: 'Nội bộ' }]).select().single()
        sysCustId = newCust?.id
      }

      // XUẤT ĐƠN CHO TỪNG ITEM MIX ĐỂ TRỪ KHO CHUẨN XÁC
      const orderPromises = validItems.map(item => {
          const b = batches.find(x => x.id === item.batch_id);
          const weight = Number(item.weight_used);
          const costPerKg = getCostForGrade(b, item.grade_type);

          return supabase.from('orders').insert([{
            customer_id: sysCustId, batch_id: item.batch_id, grade_type: item.grade_type, 
            weight: weight, cost: weight * costPerKg, revenue: weight * costPerKg, 
            profit: 0, status: 'Hoàn tất',
            note: `Gia công từ loại ${item.grade_type}. Nằm trong mẻ trộn chung thu về ${form.refinedWeight}kg.`,
            created_at: new Date().toISOString()
          }]);
      });

      await Promise.all(orderPromises); 

      // Tạo Lô Tinh Chế Mới
      await supabase.from('batches').insert([{
        batch_code: `TC-${Date.now().toString().slice(-6)}`, // Tự sinh mã random vì trộn nhiều lô
        total_weight: Math.abs(Number(form.refinedWeight)),
        weight_dep: Math.abs(Number(form.refinedWeight)), 
        weight_xo: 0, weight_vua: 0, weight_xau: 0,
        cost_per_kg: calculations.newCostPerKg, 
        supplier_name: `Gia công hỗn hợp từ các lô: ${batchCodesUsed}`,
        purchase_date: new Date().toISOString().split('T')[0]
      }])

      alert("🎉 Đã chốt gia công thành công! Kho đã trừ đúng các loại, đẻ lô Tinh chế mới!")
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
      
      {/* HEADER */}
      <div className="bg-gray-900 rounded-[24px] md:rounded-[40px] p-6 md:p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
         <div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter flex items-center gap-2"><Calculator className="text-orange-400" size={28}/> Sổ Gia Công</h1>
            <p className="text-gray-400 font-medium text-xs md:text-sm mt-1 tracking-tight">Trộn nhiều loại yến & Tính giá vốn Tinh Chế sau hao hụt</p>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
        
        {/* KHU VỰC NHẬP LIỆU (CỘT TRÁI) */}
        <div className="lg:col-span-5 space-y-5 md:space-y-6">
           
           {/* BƯỚC 1: BỘ TRỘN ĐA NĂNG */}
           <div className="bg-white p-5 md:p-6 rounded-[24px] border border-gray-200 shadow-sm space-y-4 md:space-y-5">
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                 <h3 className="font-bold uppercase text-gray-900 flex items-center gap-2 text-sm md:text-base"><Package className="text-blue-500" size={18}/> 1. Nguồn Gốc Yến</h3>
                 <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded font-bold text-gray-500 uppercase">{mixItems.length} nguồn</span>
              </div>

              {mixItems.map((item, index) => {
                 const currentBatch = batches.find(b => b.id === item.batch_id);
                 return (
                    <div key={item.id} className="p-3 bg-gray-50/80 border border-gray-200 rounded-2xl relative group">
                        {mixItems.length > 1 && (
                            <button onClick={() => handleRemoveMixItem(item.id)} className="absolute -top-2 -right-2 bg-white text-red-500 p-1 rounded-full border border-gray-200 shadow-sm hover:bg-red-50 hover:border-red-200 transition-colors z-10"><Trash2 size={12}/></button>
                        )}
                        <div className="flex flex-col gap-2 mb-2">
                           <select className="w-full bg-white border border-gray-200 rounded-xl p-2.5 font-bold text-gray-900 text-xs md:text-sm outline-none focus:border-blue-400 cursor-pointer" value={item.batch_id} onChange={e => updateMixItem(item.id, 'batch_id', e.target.value)}>
                              <option value="">-- Lấy từ lô nào? --</option>
                              {batches.map(b => (
                                 <option key={b.id} value={b.id}>{b.batch_code} (Còn: {b.remain.toFixed(2)}kg)</option>
                              ))}
                           </select>
                           <div className="flex gap-2">
                               <select className="flex-1 bg-white border border-gray-200 rounded-xl p-2.5 font-bold text-gray-700 text-xs outline-none disabled:opacity-50 cursor-pointer" value={item.grade_type} onChange={e => updateMixItem(item.id, 'grade_type', e.target.value)} disabled={!item.batch_id}>
                                  <option value="Xô" disabled={currentBatch && currentBatch.remain_xo <= 0}>Xô Zin</option>
                                  <option value="Đẹp" disabled={currentBatch && currentBatch.remain_dep <= 0}>Đẹp</option>
                                  <option value="Vừa" disabled={currentBatch && currentBatch.remain_vua <= 0}>Vừa</option>
                                  <option value="Xấu" disabled={currentBatch && currentBatch.remain_xau <= 0}>Xấu</option>
                               </select>
                               <div className="flex-1 relative">
                                  <input type="number" step="0.001" placeholder="Số Kg Xuất..." className="w-full border border-orange-300 rounded-xl p-2.5 outline-none font-bold text-orange-700 text-xs bg-orange-50 focus:border-orange-500 pr-10" value={item.weight_used} onChange={e => updateMixItem(item.id, 'weight_used', e.target.value)} disabled={!item.batch_id}/>
                                  <button onClick={() => handleMaxWeight(item.id)} disabled={!item.batch_id} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] bg-orange-200 hover:bg-orange-300 text-orange-800 font-bold px-1.5 py-1 rounded disabled:opacity-50 transition-colors">Vét</button>
                               </div>
                           </div>
                        </div>
                        {item.batch_id && item.grade_type && (
                            <div className="text-right text-[9px] text-gray-400 font-medium">Kho loại này còn: <b className="text-gray-600">{getRemainForGrade(currentBatch, item.grade_type).toFixed(3)}kg</b></div>
                        )}
                    </div>
                 )
              })}

              <button type="button" onClick={handleAddMixItem} className="w-full border border-dashed border-blue-300 text-blue-600 bg-blue-50/50 hover:bg-blue-50 p-2.5 rounded-xl flex justify-center items-center gap-1.5 font-bold uppercase tracking-wider text-[10px] transition-colors"><PlusCircle size={14}/> Trộn Thêm Lô Khác</button>

              <div className="text-right text-[11px] font-bold text-gray-500 mt-2 border-t border-gray-100 pt-3">
                 TỔNG LƯỢNG YẾN ĐEM TRỘN: <span className="text-blue-600 text-base md:text-lg font-black ml-1">{calculations.totalRawWeight.toFixed(3)} kg</span>
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
              
              {/* KHỐI HAO HỤT */}
              <div className="grid grid-cols-2 gap-3 md:gap-6 mb-6 md:mb-8">
                 <div className="bg-gray-800 p-3 md:p-4 rounded-2xl md:rounded-3xl border border-gray-700 flex flex-col justify-center relative">
                    <p className="text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Gốc yến hỗn hợp</p>
                    <p className="text-base md:text-xl font-black truncate">{Math.round(calculations.totalRawCost).toLocaleString()}đ</p>
                    {calculations.totalRawWeight > 0 && <span className="absolute bottom-2 right-4 text-[8px] text-gray-500 font-bold bg-gray-900 px-1.5 py-0.5 rounded">Tổng: {calculations.totalRawWeight.toFixed(3)}kg</span>}
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

              {/* KHỐI ĐỊNH GIÁ BÁN */}
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

           {/* NÚT CHỐT LƯU KHO */}
           <div className="bg-blue-50 border border-blue-200 p-5 md:p-6 rounded-[24px] md:rounded-[30px] flex flex-col md:flex-row items-center justify-between gap-4 md:gap-5 shadow-sm">
              <div className="flex items-start gap-2.5 w-full">
                 <Info className="text-blue-500 mt-0.5 shrink-0" size={18}/>
                 <p className="text-[11px] md:text-xs font-medium text-blue-800 leading-relaxed">Khi bấm Chốt, hệ thống sẽ trừ sạch kho của <b>các loại nguyên liệu</b> vừa trộn, và tạo một <b>Mã Lô Tinh Chế Mới (TC)</b> với giá vốn đã được cập nhật.</p>
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
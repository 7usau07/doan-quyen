'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { ArrowLeft, MapPin, Calendar, Package, ListFilter, PlusCircle, Trash2, ShoppingCart, CheckCircle2, UserCircle2 } from 'lucide-react' 

async function getCoords(address: string) {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`);
    const data = await response.json();
    if (data && data.length > 0) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    return null;
  } catch (error) { return null; }
}

export default function NewOrderPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [existingCustomers, setExistingCustomers] = useState<any[]>([])
  const [activeBatches, setActiveBatches] = useState<any[]>([]) 
  const [showDropdown, setShowDropdown] = useState(false)

  const [customerType, setCustomerType] = useState('khach_le')
  const [customerForm, setCustomerForm] = useState({ 
    name: '', phone: '', address: '', 
    shippingFee: '', status: 'Chưa giao', note: '', seller: 'Quyên',
    orderDate: new Date().toISOString().split('T')[0] 
  })

  const [cartItems, setCartItems] = useState<any[]>([
    { id: Date.now(), batch_id: '', grade_type: 'Xô', weight: '', unitPrice: '', unitCost: '' }
  ])

  useEffect(() => {
    async function fetchData() {
      const { data: custData } = await supabase.from('customers').select('id, name, phone, address')
      if (custData) setExistingCustomers(custData)

      const { data: batchData } = await supabase.from('batches').select('*, orders(weight, weight_loss, grade_type)').order('created_at', { ascending: false })
      
      if (batchData) {
        const processedBatches = batchData.map(batch => {
            const sold_xo = batch.orders?.filter((o:any) => o.grade_type === 'Xô').reduce((sum: number, o: any) => sum + Number(o.weight || 0), 0) || 0;
            const sold_dep = batch.orders?.filter((o:any) => o.grade_type === 'Đẹp').reduce((sum: number, o: any) => sum + Number(o.weight || 0), 0) || 0;
            const sold_vua = batch.orders?.filter((o:any) => o.grade_type === 'Vừa').reduce((sum: number, o: any) => sum + Number(o.weight || 0), 0) || 0;
            const sold_xau = batch.orders?.filter((o:any) => o.grade_type === 'Xấu').reduce((sum: number, o: any) => sum + Number(o.weight || 0), 0) || 0;
            
            const remain_xo = Number(batch.weight_xo || 0) - sold_xo;
            const remain_dep = Number(batch.weight_dep || 0) - sold_dep;
            const remain_vua = Number(batch.weight_vua || 0) - sold_vua;
            const remain_xau = Number(batch.weight_xau || 0) - sold_xau;
            const total_sold = sold_xo + sold_dep + sold_vua + sold_xau;
            const total_loss = batch.orders?.reduce((sum: number, o: any) => sum + Number(o.weight_loss || 0), 0) || 0;
            const total_remain = Number(batch.total_weight) - total_sold - total_loss;

            return { ...batch, remain_xo, remain_dep, remain_vua, remain_xau, total_remain }
        });
        setActiveBatches(processedBatches.filter(b => b.total_remain > 0));
      }
    }
    fetchData()
  }, [])

  const getCostForGrade = (batch: any, grade: string) => {
    if (!batch) return 0;
    if (grade === 'Xô') return Number(batch.cost_xo || batch.cost_per_kg || 0);
    if (grade === 'Đẹp') return Number(batch.cost_dep || batch.cost_per_kg || 0);
    if (grade === 'Vừa') return Number(batch.cost_vua || batch.cost_per_kg || 0);
    if (grade === 'Xấu') return Number(batch.cost_xau || batch.cost_per_kg || 0);
    return 0;
  }

  const handleBatchChange = (itemId: number, batchId: string) => {
    const selectedBatch = activeBatches.find(b => b.id === batchId);
    let firstAvailableGrade = 'Xô'; 
    if (selectedBatch) {
        if (selectedBatch.remain_xo > 0) firstAvailableGrade = 'Xô';
        else if (selectedBatch.remain_dep > 0) firstAvailableGrade = 'Đẹp';
        else if (selectedBatch.remain_vua > 0) firstAvailableGrade = 'Vừa';
        else if (selectedBatch.remain_xau > 0) firstAvailableGrade = 'Xấu';
    }

    setCartItems(prev => prev.map(item => {
      if (item.id === itemId) return { ...item, batch_id: batchId, grade_type: firstAvailableGrade, unitCost: selectedBatch ? getCostForGrade(selectedBatch, firstAvailableGrade).toString() : '' }
      return item;
    }))
  }

  const handleGradeChange = (itemId: number, grade: string) => {
    setCartItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const selectedBatch = activeBatches.find(b => b.id === item.batch_id);
        return { ...item, grade_type: grade, unitCost: selectedBatch ? getCostForGrade(selectedBatch, grade).toString() : '' }
      }
      return item;
    }))
  }

  const handleAddItem = () => {
    setCartItems([...cartItems, { id: Date.now(), batch_id: '', grade_type: 'Xô', weight: '', unitPrice: '', unitCost: '' }]);
  }

  const handleRemoveItem = (idToRemove: number) => {
    if (cartItems.length === 1) {
      alert("Đơn hàng phải có ít nhất 1 sản phẩm chứ sếp!"); return;
    }
    setCartItems(cartItems.filter(item => item.id !== idToRemove));
  }

  const handleUpdateItem = (itemId: number, field: string, value: string) => {
    setCartItems(prev => prev.map(item => item.id === itemId ? { ...item, [field]: value } : item))
  }

  const calculateTotals = () => {
    let totalCost = 0; let totalRevenue = 0;
    cartItems.forEach(item => {
      totalCost += (Number(item.weight) || 0) * (Number(item.unitCost) || 0);
      totalRevenue += (Number(item.weight) || 0) * (Number(item.unitPrice) || 0);
    });
    const taxAmount = customerType === 'khach_le' ? totalRevenue * 0.05 : 0; 
    const shippingFeeNum = Number(customerForm.shippingFee) || 0;
    const expectedProfit = totalRevenue - totalCost - taxAmount - shippingFeeNum;
    return { totalCost, totalRevenue, taxAmount, shippingFeeNum, expectedProfit };
  }
  const totals = calculateTotals();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const invalidItems = cartItems.filter(item => !item.batch_id || !item.weight || !item.unitPrice);
    if (invalidItems.length > 0) { alert("Vui lòng điền đủ thông tin Sản Phẩm trước khi chốt!"); return; }

    setLoading(true)
    try {
      const coords = await getCoords(customerForm.address);
      let { data: cust } = await supabase.from('customers').select('id').eq('phone', customerForm.phone).maybeSingle();
      let customerId = cust?.id;

      if (!customerId) {
        const { data: newCust } = await supabase.from('customers').insert([{ name: customerForm.name, phone: customerForm.phone, address: customerForm.address, lat: coords?.lat || null, lng: coords?.lng || null }]).select().single();
        customerId = newCust?.id;
      } else {
        await supabase.from('customers').update({ address: customerForm.address, name: customerForm.name, lat: coords?.lat || null, lng: coords?.lng || null }).eq('id', customerId);
      }

      for (let i = 0; i < cartItems.length; i++) {
        const item = cartItems[i];
        const weightNum = Number(item.weight);
        const itemCost = weightNum * Number(item.unitCost);
        const itemRevenue = weightNum * Number(item.unitPrice);
        let itemTax = 0; let itemShip = 0; let itemNote = customerForm.note;

        if (i === 0) {
            itemTax = totals.taxAmount; itemShip = totals.shippingFeeNum;
            if (cartItems.length > 1) itemNote += ` (Giao gộp chung với kiện khác)`;
        } else { itemNote = `(Giao gộp chung hóa đơn chính)`; }

        const itemProfit = itemRevenue - itemCost - itemTax - itemShip;

        await supabase.from('orders').insert([{
            customer_id: customerId, batch_id: item.batch_id, grade_type: item.grade_type, 
            weight: weightNum, cost: itemCost, revenue: itemRevenue,
            profit: itemProfit, status: customerForm.status, 
            tax_amount: itemTax, shipping_fee: itemShip, note: itemNote,
            seller: customerForm.seller,
            created_at: new Date(customerForm.orderDate).toISOString()
        }]);
      }
      router.push('/dashboard/orders'); router.refresh();
    } catch (err) { alert("Lỗi hệ thống rồi Duy ơi!") } finally { setLoading(false) }
  }

  const filteredCustomers = existingCustomers.filter(c => c.name.toLowerCase().includes(customerForm.name.toLowerCase()) || c.phone?.includes(customerForm.name));

  return (
    <div className="p-3 md:p-8 max-w-3xl mx-auto bg-gray-50 min-h-screen relative pb-20 animate-in fade-in">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-gray-400 hover:text-black mb-4 transition-colors font-bold uppercase text-[10px] md:text-xs"><ArrowLeft size={14} /> Quay lại</button>
      <div className="mb-5 text-center"><h1 className="text-2xl md:text-4xl font-black text-gray-900 tracking-tighter uppercase italic">Lên Đơn Yến Mới</h1></div>

      <form onSubmit={handleSubmit} className="bg-white p-4 md:p-8 rounded-[24px] md:rounded-[40px] border border-gray-200 shadow-xl space-y-6">
        
        {/* KHỐI 1: KHÁCH HÀNG & NGƯỜI BÁN NẰM CHUNG 1 HÀNG HEADER */}
        <div className="bg-gray-50 p-4 rounded-[20px] border border-gray-200 space-y-3">
          
          <div className="flex justify-between items-center border-b border-gray-200 pb-2 mb-1">
             <div className="flex gap-3">
               <label className="flex items-center gap-1.5 font-bold text-[10px] md:text-xs cursor-pointer"><input type="radio" checked={customerType === 'khach_le'} onChange={() => setCustomerType('khach_le')} className="w-3 h-3" /> Khách lẻ</label>
               <label className="flex items-center gap-1.5 font-bold text-[10px] md:text-xs cursor-pointer text-blue-600"><input type="radio" checked={customerType === 'cong_ty'} onChange={() => setCustomerType('cong_ty')} className="w-3 h-3" /> Công ty</label>
             </div>
             
             {/* ĐÃ CHUYỂN NÚT CHỌN NGƯỜI BÁN VÀO ĐÂY, VỪA VẶN KHÔNG LƠ LỬNG */}
             <div className="bg-white border border-blue-200 px-2 py-1 rounded-lg shadow-sm flex items-center gap-1">
                <UserCircle2 size={12} className={customerForm.seller === 'Duy' ? 'text-orange-500' : 'text-pink-500'} />
                <select className="font-bold text-[10px] md:text-xs uppercase outline-none bg-transparent cursor-pointer" value={customerForm.seller} onChange={e => setCustomerForm({...customerForm, seller: e.target.value})}>
                   <option value="Quyên">Quyên Chốt</option>
                   <option value="Duy">Duy Chốt</option>
                </select>
             </div>
          </div>

          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 text-gray-700 shadow-sm w-full"><Calendar size={14} className="text-gray-400"/><input type="date" required className="bg-transparent font-bold outline-none text-xs w-full cursor-pointer" value={customerForm.orderDate} onChange={(e) => setCustomerForm({...customerForm, orderDate: e.target.value})} /></div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative">
            <div className="relative">
              <input required placeholder="Tên khách..." className="w-full border border-gray-300 rounded-xl p-3 font-bold text-xs md:text-sm outline-none focus:border-blue-500 bg-white" value={customerForm.name} onChange={e => { setCustomerForm({...customerForm, name: e.target.value}); setShowDropdown(true); }} onFocus={() => setShowDropdown(true)} />
              {showDropdown && customerForm.name && filteredCustomers.length > 0 && (
                <ul className="absolute z-50 w-full bg-white border shadow-xl rounded-xl mt-1 max-h-48 overflow-y-auto border-gray-100">
                  {filteredCustomers.map(c => (
                    <li key={c.id} className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0" onClick={() => { setCustomerForm({...customerForm, name: c.name, phone: c.phone || '', address: c.address || ''}); setShowDropdown(false); }}>
                      <div className="font-bold text-gray-800 text-xs">{c.name}</div><div className="text-[9px] text-gray-400 font-black uppercase">{c.phone}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <input required placeholder="Số điện thoại" className="w-full border border-gray-300 rounded-xl p-3 font-bold text-xs md:text-sm outline-none focus:border-blue-500 bg-white" value={customerForm.phone} onChange={e => setCustomerForm({...customerForm, phone: e.target.value})} />
            <div className="sm:col-span-2 flex items-center bg-white border border-gray-300 rounded-xl px-3 focus-within:border-blue-500"><MapPin size={14} className="text-gray-400 shrink-0" /><input required placeholder="Địa chỉ giao hàng..." className="w-full p-3 font-bold text-xs md:text-sm outline-none bg-transparent" value={customerForm.address} onChange={e => setCustomerForm({...customerForm, address: e.target.value})} /></div>
          </div>
        </div>

        {/* KHỐI 2: GIỎ HÀNG THU GỌN LẠI */}
        <div className="space-y-3">
           <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h3 className="font-black uppercase text-gray-900 flex items-center gap-1.5 text-xs md:text-sm"><ShoppingCart className="text-blue-500" size={14}/> Món hàng</h3>
              <span className="text-[9px] font-bold text-gray-400 uppercase bg-gray-50 px-2 py-0.5 rounded border border-gray-200">{cartItems.length} Món</span>
           </div>

           {cartItems.map((item) => {
              const currentBatch = activeBatches.find(b => b.id === item.batch_id);
              return (
                 <div key={item.id} className="bg-white border-2 border-gray-100 rounded-[20px] p-3 md:p-4 relative shadow-sm">
                    {cartItems.length > 1 && (<button type="button" onClick={() => handleRemoveItem(item.id)} className="absolute -top-2 -right-2 bg-red-100 text-red-500 p-1.5 rounded-full hover:bg-red-500 hover:text-white shadow-sm"><Trash2 size={12}/></button>)}
                    
                    <div className="flex flex-col sm:flex-row gap-2 mb-3">
                        <div className="flex-1 flex flex-col gap-1">
                            <label className="text-[9px] font-bold uppercase text-purple-600 flex items-center gap-1"><Package size={10}/> Chọn Lô Kho</label>
                            <select required className="bg-purple-50 border border-purple-100 rounded-lg p-2 font-bold text-purple-900 outline-none w-full text-xs cursor-pointer" value={item.batch_id} onChange={(e) => handleBatchChange(item.id, e.target.value)}>
                               <option value="">-- Bấm chọn --</option>
                               {activeBatches.map(b => (<option key={b.id} value={b.id}>{b.batch_code} (Còn: Xô {b.remain_xo > 0 ? b.remain_xo.toFixed(1) : 0} | Đẹp {b.remain_dep > 0 ? b.remain_dep.toFixed(1) : 0} | Vừa {b.remain_vua > 0 ? b.remain_vua.toFixed(1) : 0} | Xấu {b.remain_xau > 0 ? b.remain_xau.toFixed(1) : 0})</option>))}
                            </select>
                        </div>
                        <div className="flex-1 flex flex-col gap-1">
                            <label className="text-[9px] font-bold uppercase text-orange-500 flex items-center gap-1"><ListFilter size={10}/> Loại</label>
                            <select className="bg-orange-50 border border-orange-100 rounded-lg p-2 font-bold text-orange-900 outline-none w-full text-xs cursor-pointer disabled:opacity-50" value={item.grade_type} onChange={(e) => handleGradeChange(item.id, e.target.value)} disabled={!item.batch_id}>
                               <option value="Xô" disabled={currentBatch && currentBatch.remain_xo <= 0}>Xô Zin</option><option value="Đẹp" disabled={currentBatch && currentBatch.remain_dep <= 0}>Hàng Đẹp</option><option value="Vừa" disabled={currentBatch && currentBatch.remain_vua <= 0}>Hàng Vừa</option><option value="Xấu" disabled={currentBatch && currentBatch.remain_xau <= 0}>Hàng Xấu</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 items-end">
                       <div className="col-span-1">
                          <label className="text-[9px] font-bold uppercase text-blue-600 mb-1 block text-center">Số Kg Xuất</label>
                          <input required type="number" step="0.001" placeholder="VD: 0.5" className="w-full border-2 border-blue-100 bg-white rounded-lg p-2 text-sm font-black text-blue-700 outline-none focus:border-blue-400 text-center" value={item.weight} onChange={(e) => handleUpdateItem(item.id, 'weight', e.target.value)} />
                       </div>
                       <div className="col-span-1">
                          <label className="text-[8px] font-bold uppercase text-gray-400 mb-1 block text-center">Giá vốn (/kg)</label>
                          <input required type="number" className="w-full border border-gray-100 bg-gray-50 rounded-lg p-2 text-[10px] font-bold text-gray-400 outline-none text-center" value={item.unitCost} readOnly />
                       </div>
                       <div className="col-span-1">
                          <label className="text-[9px] font-bold uppercase text-green-600 mb-1 block text-center">Giá Bán (/kg)</label>
                          <input required type="number" placeholder="VNĐ" className="w-full border-2 border-green-100 bg-white rounded-lg p-2 text-xs font-black text-green-700 outline-none focus:border-green-400 text-center" value={item.unitPrice} onChange={(e) => handleUpdateItem(item.id, 'unitPrice', e.target.value)} />
                       </div>
                    </div>
                 </div>
              )
           })}
           <button type="button" onClick={handleAddItem} className="w-full border border-dashed border-blue-300 text-blue-600 hover:bg-blue-50 p-2.5 rounded-xl flex justify-center items-center gap-1.5 font-bold uppercase tracking-wider text-[10px] transition-colors"><PlusCircle size={14}/> Thêm kiện khác</button>
        </div>

        {/* KHỐI 3: GIAO HÀNG */}
        <div className="grid grid-cols-2 gap-3 bg-gray-50 p-4 rounded-[20px] border border-gray-200">
          <div className="col-span-1"><label className="text-[9px] font-bold text-gray-500 uppercase mb-1 block">Tình trạng</label><select className="w-full border border-gray-300 rounded-lg p-2.5 font-bold text-xs outline-none bg-white" value={customerForm.status} onChange={e => setCustomerForm({...customerForm, status: e.target.value})}><option>Chưa giao</option><option>Đang giao</option><option>Đã giao - Còn nợ</option><option>Hoàn tất</option></select></div>
          <div className="col-span-1"><label className="text-[9px] font-bold text-purple-600 uppercase mb-1 block">Phí Ship (VNĐ)</label><input type="number" placeholder="0" className="w-full border border-purple-200 bg-white rounded-lg p-2.5 font-bold text-xs text-purple-700 outline-none focus:border-purple-400" value={customerForm.shippingFee} onChange={e => setCustomerForm({...customerForm, shippingFee: e.target.value})} /></div>
          <div className="col-span-2"><label className="text-[9px] font-bold text-orange-500 uppercase mb-1 block">Ghi chú vận chuyển</label><input type="text" placeholder="Giao hỏa tốc, bọc kỹ..." className="w-full border border-orange-200 bg-white rounded-lg p-2.5 font-medium text-xs text-orange-800 outline-none focus:border-orange-400" value={customerForm.note} onChange={e => setCustomerForm({...customerForm, note: e.target.value})} /></div>
        </div>

        {/* TỔNG KẾT & NÚT CHỐT */}
        <div className="bg-gray-900 p-5 rounded-[24px] shadow-2xl space-y-3 border-t-4 border-blue-500 relative overflow-hidden">
            <div className="absolute -right-8 -bottom-8 opacity-10 text-white"><ShoppingCart size={100}/></div>
            <div className="relative z-10 space-y-2 border-b border-gray-700 pb-3">
                <div className="flex justify-between items-center text-xs md:text-sm font-bold text-gray-300 uppercase"><span>Doanh thu ({cartItems.length}):</span><span className="text-white text-sm md:text-base">{totals.totalRevenue.toLocaleString('vi-VN')}đ</span></div>
                <div className="flex justify-between items-center text-[9px] md:text-[10px] font-bold text-gray-400"><span>- Vốn nhập yến:</span><span>-{totals.totalCost.toLocaleString('vi-VN')}đ</span></div>
                {totals.taxAmount > 0 && (<div className="flex justify-between items-center text-[9px] md:text-[10px] font-bold text-red-400"><span>- Thuế (5%):</span><span>-{totals.taxAmount.toLocaleString('vi-VN')}đ</span></div>)}
                {totals.shippingFeeNum > 0 && (<div className="flex justify-between items-center text-[9px] md:text-[10px] font-bold text-purple-400"><span>- Phí ship:</span><span>-{totals.shippingFeeNum.toLocaleString('vi-VN')}đ</span></div>)}
            </div>
            <div className="relative z-10 flex justify-between items-end pt-1">
                <span className="text-[10px] md:text-xs font-black uppercase text-blue-400 tracking-widest">Tiền Lãi:</span>
                <span className="text-xl md:text-3xl font-black text-green-400 tracking-tighter">+{totals.expectedProfit.toLocaleString('vi-VN')}đ</span>
            </div>
        </div>

        <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-4 rounded-[20px] font-black text-sm md:text-base hover:bg-blue-700 transition-all shadow-xl uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? 'Đang xử lý...' : <><CheckCircle2 size={18}/> Chốt Đơn Hàng</>}
        </button>
      </form>
    </div>
  )
}
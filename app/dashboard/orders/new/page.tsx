'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { ArrowLeft, MapPin, Calendar, Package, ListFilter, PlusCircle, Trash2, ShoppingCart, CheckCircle2, UserCircle2, Sparkles } from 'lucide-react' 

async function getCoords(address: string) {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`);
    const data = await response.json();
    if (data && data.length > 0) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    return null;
  } catch (error) { return null; }
}

const formatVND = (val: string | number) => {
  if (!val) return '';
  const num = String(val).replace(/\D/g, ''); 
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, "."); 
};

export default function NewOrderPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [existingCustomers, setExistingCustomers] = useState<any[]>([])
  const [activeBatches, setActiveBatches] = useState<any[]>([]) 
  const [showDropdown, setShowDropdown] = useState(false)

  const [orderCategory, setOrderCategory] = useState<'tinh_che' | 'yen_tho'>('tinh_che')

  const [customerType, setCustomerType] = useState('khach_le')
  const [customerForm, setCustomerForm] = useState({ 
    name: '', phone: '', address: '', 
    shippingFee: '', status: 'Chưa giao', note: '', seller: 'Quyên',
    orderDate: new Date().toISOString().split('T')[0] 
  })

  const [cartItems, setCartItems] = useState<any[]>([
    { id: Date.now(), batch_id: '', grade_type: '', weight: '', priceInput: '', unitCost: '' }
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

  const displayBatches = activeBatches.filter(b => {
      if (orderCategory === 'tinh_che') return b.batch_code?.startsWith('TC');
      return !b.batch_code?.startsWith('TC');
  })

  const handleCategoryChange = (category: 'tinh_che' | 'yen_tho') => {
      setOrderCategory(category);
      setCartItems([{ id: Date.now(), batch_id: '', grade_type: '', weight: '', priceInput: '', unitCost: '' }]);
  }

  const getCostForGrade = (batch: any, grade: string) => {
    if (!batch) return 0;
    if (grade === 'Xô') return Number(batch.cost_xo || batch.cost_per_kg || 0);
    if (grade === 'Đẹp') return Number(batch.cost_dep || batch.cost_per_kg || 0);
    if (grade === 'Vừa') return Number(batch.cost_vua || batch.cost_per_kg || 0);
    if (grade === 'Xấu') return Number(batch.cost_xau || batch.cost_per_kg || 0);
    return Number(batch.cost_per_kg || 0);
  }

  const handleBatchChange = (itemId: number, batchId: string) => {
    const selectedBatch = displayBatches.find(b => b.id === batchId);
    let firstAvailableGrade = ''; 
    if (selectedBatch) {
        if (selectedBatch.remain_xo > 0) firstAvailableGrade = 'Xô';
        else if (selectedBatch.remain_dep > 0) firstAvailableGrade = 'Đẹp';
        else if (selectedBatch.remain_vua > 0) firstAvailableGrade = 'Vừa';
        else if (selectedBatch.remain_xau > 0) firstAvailableGrade = 'Xấu';
    }

    setCartItems(prev => prev.map(item => {
      if (item.id === itemId) return { ...item, batch_id: batchId, grade_type: firstAvailableGrade, unitCost: selectedBatch ? Math.round(getCostForGrade(selectedBatch, firstAvailableGrade)).toString() : '' }
      return item;
    }))
  }

  const handleGradeChange = (itemId: number, grade: string) => {
    setCartItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const selectedBatch = displayBatches.find(b => b.id === item.batch_id);
        return { ...item, grade_type: grade, unitCost: selectedBatch ? Math.round(getCostForGrade(selectedBatch, grade)).toString() : '' }
      }
      return item;
    }))
  }

  const handleAddItem = () => {
    setCartItems([...cartItems, { id: Date.now(), batch_id: '', grade_type: '', weight: '', priceInput: '', unitCost: '' }]);
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

  // --- CÔNG THỨC TÍNH TIỀN CHUẨN ĐÃ FIX KHỐI LƯỢNG LÀ KG ---
  const calculateTotals = () => {
    let totalCost = 0; let totalRevenue = 0;
    cartItems.forEach(item => {
      // Sếp gõ 0.1 nghĩa là 0.1 Kg
      const weightKg = Number(item.weight) || 0; 
      const costPerKg = Number(item.unitCost) || 0;
      
      // Vốn lúc nào cũng = Kg * Giá 1 Kg
      totalCost += weightKg * costPerKg;
      
      const inputPrice = Number(item.priceInput) || 0;
      if (orderCategory === 'tinh_che') {
         // Tinh chế: Bán 0.1kg (1 Lạng), Giá bán là giá của 1 Lạng
         // Doanh thu = 0.1kg * 10 * Giá 1 Lạng = 1 * Giá 1 Lạng
         totalRevenue += (weightKg * 10) * inputPrice;
      } else {
         // Yến thô: Bán theo Kg
         totalRevenue += weightKg * inputPrice;
      }
    });
    
    totalCost = Math.round(totalCost);
    totalRevenue = Math.round(totalRevenue);
    
    const taxAmount = Math.round(customerType === 'khach_le' ? totalRevenue * 0.05 : 0); 
    const shippingFeeNum = Math.round(Number(customerForm.shippingFee) || 0);
    const expectedProfit = totalRevenue - totalCost - taxAmount - shippingFeeNum;
    
    return { totalCost, totalRevenue, taxAmount, shippingFeeNum, expectedProfit };
  }
  const totals = calculateTotals();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const invalidItems = cartItems.filter(item => !item.batch_id || !item.weight || !item.priceInput);
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
        
        // Database luôn lưu trọng lượng là Kg để thống nhất kho
        const weightKg = Number(item.weight); 
        
        const itemCost = Math.round(weightKg * Number(item.unitCost));
        const itemRevenue = Math.round(orderCategory === 'tinh_che' 
            ? (weightKg * 10) * Number(item.priceInput) 
            : weightKg * Number(item.priceInput));
        
        let itemTax = 0; let itemShip = 0; let itemNote = customerForm.note;

        if (i === 0) {
            itemTax = totals.taxAmount; itemShip = totals.shippingFeeNum;
            if (cartItems.length > 1) itemNote += ` (Giao gộp chung với kiện khác)`;
        } else { itemNote = `(Giao gộp chung hóa đơn chính)`; }

        const itemProfit = itemRevenue - itemCost - itemTax - itemShip;

        const categoryTag = orderCategory === 'tinh_che' ? '[ĐƠN TINH CHẾ]' : '[ĐƠN YẾN THÔ]';
        const finalNote = `${categoryTag} ${itemNote}`;

        await supabase.from('orders').insert([{
            customer_id: customerId, batch_id: item.batch_id, grade_type: item.grade_type, 
            weight: weightKg,
            cost: itemCost, revenue: itemRevenue,
            profit: itemProfit, status: customerForm.status, 
            tax_amount: itemTax, shipping_fee: itemShip, note: finalNote.trim(),
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
      
      <div className="mb-6 text-center">
         <h1 className="text-2xl md:text-4xl font-black text-gray-900 tracking-tighter uppercase italic mb-4">Lên Đơn Hàng</h1>
         
         <div className="flex bg-gray-200/60 p-1.5 rounded-2xl max-w-sm mx-auto shadow-inner relative">
            <button 
              type="button"
              onClick={() => handleCategoryChange('tinh_che')}
              className={`flex-1 py-3 text-xs md:text-sm font-black uppercase tracking-widest rounded-xl transition-all flex justify-center items-center gap-1.5 z-10 ${orderCategory === 'tinh_che' ? 'bg-white text-blue-600 shadow-md scale-100' : 'text-gray-400 hover:text-gray-600 scale-95'}`}
            >
               <Sparkles size={16}/> Tinh Chế
            </button>
            <button 
              type="button"
              onClick={() => handleCategoryChange('yen_tho')}
              className={`flex-1 py-3 text-xs md:text-sm font-black uppercase tracking-widest rounded-xl transition-all flex justify-center items-center gap-1.5 z-10 ${orderCategory === 'yen_tho' ? 'bg-white text-orange-600 shadow-md scale-100' : 'text-gray-400 hover:text-gray-600 scale-95'}`}
            >
               <Package size={16}/> Yến Thô
            </button>
         </div>
      </div>

      <form onSubmit={handleSubmit} className={`p-4 md:p-8 rounded-[24px] md:rounded-[40px] shadow-xl space-y-6 transition-colors border-2 ${orderCategory === 'tinh_che' ? 'bg-white border-blue-100/50' : 'bg-white border-orange-100/50'}`}>
        
        {/* KHỐI 1: KHÁCH HÀNG & NGƯỜI BÁN */}
        <div className="bg-gray-50 p-4 rounded-[20px] border border-gray-200 space-y-3">
          <div className="flex justify-between items-center border-b border-gray-200 pb-2 mb-1">
             <div className="flex gap-3">
               <label className="flex items-center gap-1.5 font-bold text-[10px] md:text-xs cursor-pointer"><input type="radio" checked={customerType === 'khach_le'} onChange={() => setCustomerType('khach_le')} className="w-3 h-3" /> Khách lẻ</label>
               <label className="flex items-center gap-1.5 font-bold text-[10px] md:text-xs cursor-pointer text-blue-600"><input type="radio" checked={customerType === 'cong_ty'} onChange={() => setCustomerType('cong_ty')} className="w-3 h-3" /> Công ty</label>
             </div>
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

        {/* KHỐI 2: GIỎ HÀNG */}
        <div className="space-y-3">
           <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h3 className={`font-black uppercase flex items-center gap-1.5 text-xs md:text-sm ${orderCategory === 'tinh_che' ? 'text-blue-600' : 'text-orange-600'}`}>
                 <ShoppingCart size={14}/> {orderCategory === 'tinh_che' ? 'Món Hàng Tinh Chế' : 'Món Hàng Yến Thô'}
              </h3>
              <span className="text-[9px] font-bold text-gray-400 uppercase bg-gray-50 px-2 py-0.5 rounded border border-gray-200">{cartItems.length} Món</span>
           </div>

           {cartItems.map((item) => {
              const currentBatch = displayBatches.find(b => b.id === item.batch_id);
              
              // Tính toán động để hiển thị UI
              const itemRev = orderCategory === 'tinh_che' 
                ? (Number(item.weight) * 10) * Number(item.priceInput)
                : Number(item.weight) * Number(item.priceInput);

              return (
                 <div key={item.id} className="bg-white border-2 border-gray-100 rounded-[20px] p-3 md:p-4 relative shadow-sm hover:border-gray-300 transition-colors">
                    {cartItems.length > 1 && (<button type="button" onClick={() => handleRemoveItem(item.id)} className="absolute -top-2 -right-2 bg-red-100 text-red-500 p-1.5 rounded-full hover:bg-red-500 hover:text-white shadow-sm"><Trash2 size={12}/></button>)}
                    
                    <div className="flex flex-col sm:flex-row gap-2 mb-3">
                        <div className="flex-1 flex flex-col gap-1">
                            <label className={`text-[9px] font-bold uppercase flex items-center gap-1 ${orderCategory === 'tinh_che' ? 'text-blue-600' : 'text-orange-600'}`}>
                               <Package size={10}/> Chọn Lô Kho {orderCategory === 'tinh_che' ? 'Thành Phẩm' : 'Thô'}
                            </label>
                            <select required className="bg-gray-50 border border-gray-200 rounded-lg p-2 font-bold text-gray-900 outline-none w-full text-xs cursor-pointer focus:border-gray-400" value={item.batch_id} onChange={(e) => handleBatchChange(item.id, e.target.value)}>
                               <option value="">-- Bấm chọn mã lô --</option>
                               {displayBatches.map(b => (<option key={b.id} value={b.id}>{b.batch_code} (Còn: Xô {b.remain_xo > 0 ? b.remain_xo.toFixed(1) : 0} | Đẹp {b.remain_dep > 0 ? b.remain_dep.toFixed(1) : 0} | Vừa {b.remain_vua > 0 ? b.remain_vua.toFixed(1) : 0} | Xấu {b.remain_xau > 0 ? b.remain_xau.toFixed(1) : 0})</option>))}
                            </select>
                        </div>
                        <div className="flex-1 flex flex-col gap-1">
                            <label className="text-[9px] font-bold uppercase text-gray-500 flex items-center gap-1"><ListFilter size={10}/> Loại</label>
                            <select className="bg-gray-50 border border-gray-200 rounded-lg p-2 font-bold text-gray-900 outline-none w-full text-xs cursor-pointer disabled:opacity-50 focus:border-gray-400" value={item.grade_type} onChange={(e) => handleGradeChange(item.id, e.target.value)} disabled={!item.batch_id}>
                               {orderCategory === 'yen_tho' && <option value="Xô" disabled={currentBatch && currentBatch.remain_xo <= 0}>Xô Zin</option>}
                               <option value="Đẹp" disabled={currentBatch && currentBatch.remain_dep <= 0}>Hàng Đẹp</option>
                               <option value="Vừa" disabled={currentBatch && currentBatch.remain_vua <= 0}>Hàng Vừa</option>
                               <option value="Xấu" disabled={currentBatch && currentBatch.remain_xau <= 0}>Hàng Xấu</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 items-end">
                       <div className="col-span-1">
                          <label className="text-[8px] md:text-[9px] font-bold uppercase text-gray-600 mb-1 block text-center truncate">
                              {orderCategory === 'tinh_che' ? 'SỐ KG (0.1 = 1 Lạng)' : 'SỐ KG XUẤT'}
                          </label>
                          {/* ĐÃ FIX: Nhập theo KG, 0.1 nghĩa là 1 Lạng */}
                          <input required type="number" step="any" placeholder={orderCategory === 'tinh_che' ? 'VD: 0.1' : 'VD: 0.5'} className="w-full border-2 border-gray-200 bg-white rounded-lg p-2 text-sm font-black text-gray-800 outline-none focus:border-gray-500 text-center" value={item.weight} onChange={(e) => handleUpdateItem(item.id, 'weight', e.target.value)} />
                       </div>
                       <div className="col-span-1">
                          <label className="text-[8px] font-bold uppercase text-gray-400 mb-1 block text-center truncate">
                              {orderCategory === 'tinh_che' ? 'GIÁ VỐN (/100g)' : 'GIÁ VỐN (/kg)'}
                          </label>
                          <input required type="text" className="w-full border border-gray-100 bg-gray-50 rounded-lg p-2 text-[10px] font-bold text-gray-400 outline-none text-center" value={formatVND(orderCategory === 'tinh_che' ? Math.round(Number(item.unitCost)/10) : Math.round(Number(item.unitCost)))} readOnly />
                       </div>
                       <div className="col-span-1">
                          <label className="text-[8px] md:text-[9px] font-bold uppercase text-green-600 mb-1 block text-center truncate">
                              {orderCategory === 'tinh_che' ? 'GIÁ BÁN (/1 LẠNG)' : 'GIÁ BÁN (/KG)'}
                          </label>
                          <input required type="text" placeholder="VND" className="w-full border-2 border-green-100 bg-white rounded-lg p-2 text-xs font-black text-green-700 outline-none focus:border-green-400 text-center" value={formatVND(item.priceInput)} onChange={(e) => handleUpdateItem(item.id, 'priceInput', e.target.value.replace(/\D/g, ''))} />
                       </div>
                    </div>
                    {item.weight && item.priceInput && (
                        <div className="mt-2 text-[10px] font-bold text-right text-gray-500">
                            Thành tiền: <span className="text-gray-900">{formatVND(Math.round(itemRev))}đ</span>
                        </div>
                    )}
                 </div>
              )
           })}
           <button type="button" onClick={handleAddItem} className="w-full border border-dashed border-gray-300 text-gray-500 hover:bg-gray-100 p-2.5 rounded-xl flex justify-center items-center gap-1.5 font-bold uppercase tracking-wider text-[10px] transition-colors"><PlusCircle size={14}/> Thêm kiện khác</button>
        </div>

        {/* KHỐI 3: GIAO HÀNG */}
        <div className="grid grid-cols-2 gap-3 bg-gray-50 p-4 rounded-[20px] border border-gray-200">
          <div className="col-span-1"><label className="text-[9px] font-bold text-gray-500 uppercase mb-1 block">Tình trạng</label><select className="w-full border border-gray-300 rounded-lg p-2.5 font-bold text-xs outline-none bg-white" value={customerForm.status} onChange={e => setCustomerForm({...customerForm, status: e.target.value})}><option>Chưa giao</option><option>Đang giao</option><option>Đã giao - Còn nợ</option><option>Hoàn tất</option></select></div>
          <div className="col-span-1">
             <label className="text-[9px] font-bold text-purple-600 uppercase mb-1 block">Phí Ship (VNĐ)</label>
             <input type="text" placeholder="0" className="w-full border border-purple-200 bg-white rounded-lg p-2.5 font-bold text-xs text-purple-700 outline-none focus:border-purple-400" value={formatVND(customerForm.shippingFee)} onChange={e => setCustomerForm({...customerForm, shippingFee: e.target.value.replace(/\D/g, '')})} />
          </div>
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
                <span className={`${totals.expectedProfit >= 0 ? 'text-green-400' : 'text-red-400'} text-xl md:text-3xl font-black tracking-tighter`}>
                   {totals.expectedProfit >= 0 ? '+' : '-'}{Math.abs(totals.expectedProfit).toLocaleString('vi-VN')}đ
                </span>
            </div>
        </div>

        <button type="submit" disabled={loading} className={`w-full text-white py-4 rounded-[20px] font-black text-sm md:text-base transition-all shadow-xl uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2 ${orderCategory === 'tinh_che' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-600 hover:bg-orange-700'}`}>
            {loading ? 'Đang xử lý...' : <><CheckCircle2 size={18}/> {orderCategory === 'tinh_che' ? 'Chốt Đơn Tinh Chế' : 'Chốt Đơn Yến Thô'}</>}
        </button>
      </form>
    </div>
  )
}
'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, MapPin, Calendar, Package, ListFilter } from 'lucide-react' // Thêm ListFilter icon

// HÀM TỰ LẤY TỌA ĐỘ TỪ ĐỊA CHỈ (Geocoding)
async function getCoords(address: string) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
    );
    const data = await response.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return null;
  } catch (error) {
    console.error("Lỗi lấy tọa độ:", error);
    return null;
  }
}

export default function NewOrderPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [existingCustomers, setExistingCustomers] = useState<any[]>([])
  const [activeBatches, setActiveBatches] = useState<any[]>([]) 
  const [showDropdown, setShowDropdown] = useState(false)

  const [customerType, setCustomerType] = useState('khach_le')
  
  // BỔ SUNG TRƯỜNG grade_type (PHÂN LOẠI YẾN) VÀO FORM
  const [form, setForm] = useState({ 
    name: '', phone: '', address: '', 
    weight: '', unitPrice: '', unitCost: '', 
    shippingFee: '', status: 'Chưa giao', note: '',
    batch_id: '', grade_type: 'Xô', // Mặc định bán hàng Xô zin
    orderDate: new Date().toISOString().split('T')[0] 
  })

  useEffect(() => {
    async function fetchData() {
      // 1. Lấy khách hàng cũ
      const { data: custData } = await supabase.from('customers').select('id, name, phone, address')
      if (custData) setExistingCustomers(custData)

      // 2. Lấy Lô hàng kèm theo các đơn đã bán để tính tồn kho thực tế
      const { data: batchData } = await supabase
        .from('batches')
        .select('*, orders(weight, weight_loss)')
        .order('created_at', { ascending: false })
      
      if (batchData) {
        // Lọc: Chỉ hiện những lô thực sự còn yến trong kho
        const filtered = batchData.filter(batch => {
            const sold = batch.orders?.reduce((sum: number, o: any) => sum + Number(o.weight || 0), 0) || 0;
            const loss = batch.orders?.reduce((sum: number, o: any) => sum + Number(o.weight_loss || 0), 0) || 0;
            return (Number(batch.total_weight) - sold - loss) > 0;
        });
        setActiveBatches(filtered)
      }
    }
    fetchData()
  }, [])

  // TỰ ĐIỀN GIÁ VỐN KHI CHỌN LÔ
  const handleBatchChange = (batchId: string) => {
    const selectedBatch = activeBatches.find(b => b.id === batchId);
    setForm(prev => ({
      ...prev,
      batch_id: batchId,
      unitCost: selectedBatch ? selectedBatch.cost_per_kg.toString() : ''
    }));
  }

  // LOGIC TÍNH TOÁN DÒNG TIỀN CHI TIẾT
  const weightNum = Number(form.weight) || 0;
  const unitCostNum = Number(form.unitCost) || 0;
  const unitPriceNum = Number(form.unitPrice) || 0;
  const shippingFeeNum = Number(form.shippingFee) || 0;

  const totalCost = weightNum * unitCostNum; 
  const totalRevenue = weightNum * unitPriceNum; 
  const taxAmount = customerType === 'khach_le' ? totalRevenue * 0.05 : 0; 
  const expectedProfit = totalRevenue - totalCost - taxAmount - shippingFeeNum; 

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.batch_id) {
        alert("Duy ơi, phải chọn mã lô còn hàng mới chốt được nhé!");
        return;
    }
    setLoading(true)
    try {
      // Tự động lấy tọa độ cho bản đồ thị phần
      const coords = await getCoords(form.address);

      let { data: cust } = await supabase.from('customers').select('id').eq('phone', form.phone).maybeSingle();
      let customerId = cust?.id;

      if (!customerId) {
        const { data: newCust } = await supabase.from('customers').insert([{ 
          name: form.name, phone: form.phone, address: form.address,
          lat: coords?.lat || null, lng: coords?.lng || null
        }]).select().single();
        customerId = newCust?.id;
      } else {
        await supabase.from('customers').update({ 
          address: form.address, name: form.name,
          lat: coords?.lat || null, lng: coords?.lng || null
        }).eq('id', customerId);
      }

      await supabase.from('orders').insert([{
        customer_id: customerId, batch_id: form.batch_id, 
        grade_type: form.grade_type, // ĐƯA PHÂN LOẠI VÀO DATABASE
        weight: weightNum, cost: totalCost, revenue: totalRevenue,
        profit: expectedProfit, status: form.status, tax_amount: taxAmount,
        shipping_fee: shippingFeeNum, note: form.note,
        created_at: new Date(form.orderDate).toISOString()
      }]);

      router.push('/dashboard/orders');
      router.refresh();
    } catch (err) { alert("Lỗi hệ thống rồi Duy ơi!") }
    finally { setLoading(false) }
  }

  const filteredCustomers = existingCustomers.filter(c => 
    c.name.toLowerCase().includes(form.name.toLowerCase()) || c.phone?.includes(form.name)
  );

  return (
    <div className="p-8 max-w-2xl mx-auto bg-gray-50 min-h-screen relative pb-20 animate-in fade-in">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-400 hover:text-black mb-10 transition-colors font-black uppercase text-xs">
        <ArrowLeft size={16} /> Quay lại
      </button>

      <div className="mb-8 text-center">
        <h1 className="text-4xl font-black text-gray-900 tracking-tighter uppercase italic">Chốt Đơn Yến Mới</h1>
        <p className="text-gray-500 font-bold mt-2 uppercase text-[10px] tracking-widest">YẾN SÀO ĐOÀN QUYÊN - Quản trị tự động & Minh bạch</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-[40px] border shadow-2xl space-y-6">
        
        {/* KHU VỰC CHỌN LÔ & PHÂN LOẠI */}
        <div className="flex flex-col md:flex-row justify-between gap-4 bg-purple-50/50 p-4 rounded-3xl border border-purple-100">
          <div className="flex-1 flex items-center gap-2">
            <Package size={18} className="text-purple-500" />
            <span className="text-xs font-black uppercase text-purple-700 whitespace-nowrap">Kho lô:</span>
            <select 
              required
              className="bg-transparent font-bold text-purple-900 outline-none w-full text-sm cursor-pointer"
              value={form.batch_id}
              onChange={(e) => handleBatchChange(e.target.value)}
            >
              <option value="">-- Chọn lô --</option>
              {activeBatches.map(b => (
                  <option key={b.id} value={b.id}>{b.batch_code}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 flex items-center gap-2 border-l-0 md:border-l border-purple-200 pl-0 md:pl-4">
            <ListFilter size={18} className="text-orange-500" />
            <span className="text-xs font-black uppercase text-orange-700 whitespace-nowrap">Phân loại:</span>
            <select 
              className="bg-transparent font-bold text-orange-900 outline-none w-full text-sm cursor-pointer" 
              value={form.grade_type} 
              onChange={(e) => setForm({...form, grade_type: e.target.value})}
            >
              <option value="Xô">Hàng Xô Zin</option>
              <option value="Đẹp">Hàng Đẹp (VIP)</option>
              <option value="Vừa">Hàng Vừa</option>
              <option value="Xấu">Hàng Xấu (Gãy/Vụn)</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end mt-[-10px]">
           <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-2 text-blue-700 w-full md:w-auto">
             <Calendar size={18} />
             <input type="date" required className="bg-transparent font-bold outline-none text-sm cursor-pointer w-full" value={form.orderDate} onChange={(e) => setForm({...form, orderDate: e.target.value})} />
           </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100 space-y-4">
          <div className="flex gap-4 mb-2">
            <label className="flex items-center gap-2 font-bold text-sm cursor-pointer"><input type="radio" checked={customerType === 'khach_le'} onChange={() => setCustomerType('khach_le')} /> Khách lẻ (Thuế 5%)</label>
            <label className="flex items-center gap-2 font-bold text-sm cursor-pointer text-blue-600"><input type="radio" checked={customerType === 'cong_ty'} onChange={() => setCustomerType('cong_ty')} /> Khách Công ty</label>
          </div>
          
          <div className="grid grid-cols-2 gap-4 relative">
            <div className="relative col-span-2 md:col-span-1">
              <input required placeholder="Tên khách hàng" className="w-full border rounded-xl p-3 font-bold outline-none" value={form.name} onChange={e => { setForm({...form, name: e.target.value}); setShowDropdown(true); }} onFocus={() => setShowDropdown(true)} />
              {showDropdown && form.name && filteredCustomers.length > 0 && (
                <ul className="absolute z-50 w-full bg-white border shadow-xl rounded-xl mt-1 max-h-48 overflow-y-auto border-gray-100">
                  {filteredCustomers.map(c => (
                    <li key={c.id} className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0" onClick={() => { setForm({...form, name: c.name, phone: c.phone || '', address: c.address || ''}); setShowDropdown(false); }}>
                      <div className="font-bold text-gray-800">{c.name}</div><div className="text-[10px] text-gray-400 font-black uppercase">{c.phone}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <input required placeholder="Số điện thoại" className="w-full border rounded-xl p-3 font-bold outline-none col-span-2 md:col-span-1" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
            <div className="col-span-2 flex items-center bg-white border rounded-xl px-3 focus-within:border-blue-500 transition-colors">
                <MapPin size={18} className="text-gray-400" />
                <input required placeholder="Địa chỉ chi tiết để chấm bản đồ..." className="w-full p-3 font-bold outline-none bg-transparent" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
            </div>
          </div>
        </div>

        <input required type="number" step="0.001" placeholder="Số kg yến - VD: 0.1" className="w-full border-2 border-blue-100 bg-blue-50 rounded-2xl p-4 text-xl font-black text-blue-700 outline-none focus:border-blue-300" value={form.weight} onChange={e => setForm({...form, weight: e.target.value})} />

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="text-[10px] font-black text-red-400 uppercase ml-2">Giá vốn nhập (Tự điền)</label>
            <input required type="number" className="w-full border-2 border-red-50 rounded-2xl p-3 font-bold text-red-600 outline-none bg-red-50/30" value={form.unitCost} onChange={e => setForm({...form, unitCost: e.target.value})} />
          </div>
          <div>
            <label className="text-[10px] font-black text-green-400 uppercase ml-2">Giá bán / 1kg</label>
            <input required type="number" className="w-full border-2 border-green-50 rounded-2xl p-3 font-bold text-green-600 outline-none" value={form.unitPrice} onChange={e => setForm({...form, unitPrice: e.target.value})} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-1"><label className="text-[10px] font-black text-gray-400 uppercase ml-2">Trạng thái</label><select className="w-full border-2 rounded-2xl p-3 font-bold outline-none" value={form.status} onChange={e => setForm({...form, status: e.target.value})}><option>Chưa giao</option><option>Đang giao</option><option>Đã giao - Còn nợ</option><option>Hoàn tất</option></select></div>
          <div className="col-span-1"><label className="text-[10px] font-black text-orange-400 uppercase ml-2">Ghi chú</label><input type="text" className="w-full border-2 bg-orange-50 rounded-2xl p-3 font-bold text-orange-700 outline-none" value={form.note} onChange={e => setForm({...form, note: e.target.value})} /></div>
          <div className="col-span-1"><label className="text-[10px] font-black text-purple-500 uppercase ml-2">Phí Ship</label><input type="number" className="w-full border-2 bg-purple-50 rounded-2xl p-3 font-bold text-purple-700 outline-none" value={form.shippingFee} onChange={e => setForm({...form, shippingFee: e.target.value})} /></div>
        </div>

        {/* BẢNG TÍNH TIỀN MINH BẠCH */}
        <div className="bg-gray-900 p-6 rounded-[35px] shadow-2xl space-y-3 border-t-4 border-blue-500">
            <div className="flex justify-between text-sm font-bold text-gray-300 uppercase">
                <span>Doanh thu khách trả:</span>
                <span className="text-white">{totalRevenue.toLocaleString('vi-VN')}đ</span>
            </div>
            <div className="flex justify-between text-xs font-black text-gray-400">
                <span>- Tổng tiền vốn:</span>
                <span>-{totalCost.toLocaleString('vi-VN')}đ</span>
            </div>
            {taxAmount > 0 && (
              <div className="flex justify-between text-xs font-black text-red-400">
                  <span>- Thuế cá nhân (5%):</span>
                  <span>-{taxAmount.toLocaleString('vi-VN')}đ</span>
              </div>
            )}
            {shippingFeeNum > 0 && (
              <div className="flex justify-between text-xs font-black text-purple-400">
                  <span>- Phí vận chuyển:</span>
                  <span>-{shippingFeeNum.toLocaleString('vi-VN')}đ</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-4 border-t border-gray-700 mt-2">
                <span className="text-xs font-black uppercase text-blue-400 tracking-widest">Lợi nhuận bỏ túi:</span>
                <span className="text-3xl font-black text-green-400">+{expectedProfit.toLocaleString('vi-VN')}đ</span>
            </div>
        </div>

        <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-5 rounded-[30px] font-black text-xl hover:bg-blue-700 transition-all shadow-xl uppercase tracking-widest">{loading ? 'Hệ thống đang xử lý...' : 'Chốt đơn ngay'}</button>
      </form>
    </div>
  )
}
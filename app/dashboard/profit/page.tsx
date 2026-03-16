'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar
} from 'recharts'
import { DollarSign, TrendingUp, ArrowDownRight, Receipt, Wallet, PlusCircle, PieChart, Filter, Pencil, Trash2, X, Activity, BarChart as BarChartIcon, UserCheck, Heart, Landmark } from 'lucide-react'

export default function ProfitPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // BỘ LỌC THỜI GIAN
  const [filterType, setFilterType] = useState('all')
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString())
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7))

  // STATE BẬT TẮT LỊCH SỬ HOA HỒNG SẾP DUY & QUYÊN
  const [showDuyHistory, setShowDuyHistory] = useState(false)
  const [showQuyenHistory, setShowQuyenHistory] = useState(false)

  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [expenseForm, setExpenseForm] = useState({
    title: '', amount: '', category: 'Bao bì & Hộp quà', expense_date: new Date().toISOString().split('T')[0], note: ''
  })

  const [editingExpense, setEditingExpense] = useState<any>(null)
  const [editForm, setEditForm] = useState({
    title: '', amount: '', category: '', expense_date: ''
  })

  const fetchData = async () => {
    setLoading(true)
    const [ordersRes, expensesRes] = await Promise.all([
      supabase.from('orders').select('*, customers(name)').order('created_at', { ascending: false }),
      supabase.from('expenses').select('*').order('expense_date', { ascending: false })
    ])
    if (ordersRes.data) setOrders(ordersRes.data)
    if (expensesRes.data) setExpenses(expensesRes.data)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    await supabase.from('expenses').insert([{
      title: expenseForm.title, amount: Number(expenseForm.amount), 
      category: expenseForm.category, expense_date: expenseForm.expense_date, note: expenseForm.note
    }])
    setShowExpenseForm(false)
    setExpenseForm({ title: '', amount: '', category: 'Bao bì & Hộp quà', expense_date: new Date().toISOString().split('T')[0], note: '' })
    fetchData()
  }

  const handleDeleteExpense = async (id: string) => {
    if (!window.confirm("Duy có chắc chắn muốn xóa khoản chi này không? Xóa xong hệ thống sẽ cộng lại tiền đó vào Lợi nhuận nhé!")) return;
    await supabase.from('expenses').delete().eq('id', id);
    fetchData();
  }

  const handleOpenEdit = (expense: any) => {
    setEditingExpense(expense);
    setEditForm({
      title: expense.title,
      amount: expense.amount.toString(),
      category: expense.category,
      expense_date: expense.expense_date
    });
  }

  const handleUpdateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from('expenses').update({
      title: editForm.title,
      amount: Number(editForm.amount),
      category: editForm.category,
      expense_date: editForm.expense_date
    }).eq('id', editingExpense.id);
    setEditingExpense(null);
    fetchData();
  }

  const formatCompactNumber = (number: number) => {
    if (number >= 1e9) return (number / 1e9).toFixed(2) + ' Tỷ'
    if (number >= 1e6) return (number / 1e6).toFixed(1) + ' Tr'
    return number.toLocaleString('vi-VN') + 'đ'
  }

  const availableYears = useMemo(() => {
    const years = new Set<string>()
    orders.forEach(o => years.add(new Date(o.created_at).getFullYear().toString()))
    expenses.forEach(e => years.add(new Date(e.expense_date).getFullYear().toString()))
    const yearArr = Array.from(years).sort().reverse()
    return yearArr.length > 0 ? yearArr : [new Date().getFullYear().toString()]
  }, [orders, expenses])

  const { filteredOrders, filteredExpenses } = useMemo(() => {
    const fOrders = orders.filter(o => {
      if (filterType === 'all') return true;
      const d = new Date(o.created_at);
      if (filterType === 'year') return d.getFullYear().toString() === filterYear;
      if (filterType === 'month') return d.toISOString().slice(0, 7) === filterMonth;
      return true;
    })
    const fExpenses = expenses.filter(e => {
      if (filterType === 'all') return true;
      const d = new Date(e.expense_date);
      if (filterType === 'year') return d.getFullYear().toString() === filterYear;
      if (filterType === 'month') return d.toISOString().slice(0, 7) === filterMonth;
      return true;
    })
    return { filteredOrders: fOrders, filteredExpenses: fExpenses }
  }, [orders, expenses, filterType, filterYear, filterMonth])

  // --- THUẬT TOÁN TÍNH TOÁN DÒNG TIỀN TRƯỚC/SAU THUẾ ---
  const stats = useMemo(() => {
    const totalRevenue = filteredOrders.reduce((sum, o) => sum + Number(o.revenue || 0), 0)
    const totalCOGS = filteredOrders.reduce((sum, o) => sum + Number(o.cost || 0), 0)
    const totalTax = filteredOrders.reduce((sum, o) => sum + Number(o.tax_amount || 0), 0)
    const totalShip = filteredOrders.reduce((sum, o) => sum + Number(o.shipping_fee || 0), 0)
    
    const totalLossCost = filteredOrders.reduce((sum, o) => {
        const costPerKg = Number(o.weight) > 0 ? (Number(o.cost) / Number(o.weight)) : 0;
        return sum + (Number(o.weight_loss || 0) * costPerKg);
    }, 0)

    const totalOutsideExpenses = filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)
    
    // 1. LỢI NHUẬN TRƯỚC THUẾ (LÃI GỘP): Bán hàng lời bao nhiêu
    const profitBeforeTax = totalRevenue - totalCOGS - totalShip - totalLossCost;
    
    // 2. LỢI NHUẬN TỔNG RÒNG: Cục Lãi Gộp đem đi đóng thuế và trừ chi phí sổ chi
    const netProfit = profitBeforeTax - totalTax - totalOutsideExpenses;
    
    const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0.0'

    // LẤY DANH SÁCH VÀ TÍNH TIỀN CÁ NHÂN (HƯỞNG TRỌN 100%, KHÔNG TRỪ THUẾ)
    const duyOrders = filteredOrders.filter(o => o.seller === 'Duy').sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const quyenOrders = filteredOrders.filter(o => o.seller !== 'Duy').sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    const totalDuyProfitRaw = duyOrders.reduce((sum, o) => {
        const lossCost = Number(o.weight) > 0 ? (Number(o.weight_loss || 0) * (Number(o.cost) / Number(o.weight))) : 0;
        return sum + (Number(o.revenue) - Number(o.cost) - Number(o.shipping_fee || 0) - lossCost);
    }, 0);

    const totalQuyenProfitRaw = quyenOrders.reduce((sum, o) => {
        const lossCost = Number(o.weight) > 0 ? (Number(o.weight_loss || 0) * (Number(o.cost) / Number(o.weight))) : 0;
        return sum + (Number(o.revenue) - Number(o.cost) - Number(o.shipping_fee || 0) - lossCost);
    }, 0);

    // DỮ LIỆU BIỂU ĐỒ
    const isMonthView = filterType === 'month'
    const chartDataMap: Record<string, any> = {}
    
    filteredOrders.forEach(o => {
      const d = new Date(o.created_at)
      const key = isMonthView ? d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : `T${d.getMonth() + 1}/${d.getFullYear()}`

      if (!chartDataMap[key]) chartDataMap[key] = { name: key, Doanh_thu: 0, Chi_phi: 0, Loi_nhuan_rong: 0, gross: 0 }
      chartDataMap[key].Doanh_thu += Number(o.revenue || 0)
      
      const costPerKg = Number(o.weight) > 0 ? (Number(o.cost) / Number(o.weight)) : 0;
      const loss = Number(o.weight_loss || 0) * costPerKg;
      chartDataMap[key].gross += (Number(o.revenue || 0) - Number(o.cost || 0) - Number(o.tax_amount || 0) - Number(o.shipping_fee || 0) - loss)
      chartDataMap[key].Loi_nhuan_rong = chartDataMap[key].gross
    })

    filteredExpenses.forEach(e => {
      const d = new Date(e.expense_date)
      const key = isMonthView ? d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : `T${d.getMonth() + 1}/${d.getFullYear()}`

      if (!chartDataMap[key]) chartDataMap[key] = { name: key, Doanh_thu: 0, Chi_phi: 0, Loi_nhuan_rong: 0, gross: 0 }
      chartDataMap[key].Chi_phi += Number(e.amount || 0)
    })

    Object.keys(chartDataMap).forEach(k => {
      chartDataMap[k].Loi_nhuan_rong = chartDataMap[k].gross - chartDataMap[k].Chi_phi
    })

    const chartData = Object.values(chartDataMap).sort((a, b) => {
      if (isMonthView) {
        const [d1, m1] = a.name.split('/'); const [d2, m2] = b.name.split('/')
        return new Date(2000, Number(m1)-1, Number(d1)).getTime() - new Date(2000, Number(m2)-1, Number(d2)).getTime()
      } else {
        const [m1, y1] = a.name.replace('T', '').split('/'); const [m2, y2] = b.name.replace('T', '').split('/')
        return new Date(Number(y1), Number(m1)-1).getTime() - new Date(Number(y2), Number(m2)-1).getTime()
      }
    })

    return { 
        totalRevenue, totalCOGS, totalTax, totalShip, totalLossCost, 
        totalOutsideExpenses, profitBeforeTax, netProfit, profitMargin, 
        chartData, duyOrders, quyenOrders, totalDuyProfitRaw, totalQuyenProfitRaw
    }
  }, [filteredOrders, filteredExpenses, filterType])

  if (loading) return <div className="p-10 font-black text-gray-400 animate-pulse text-center uppercase tracking-widest">Đang tải báo cáo tài chính...</div>

  const periodText = filterType === 'all' ? 'TẤT CẢ THỜI GIAN' : filterType === 'year' ? `NĂM ${filterYear}` : `THÁNG ${filterMonth.split('-')[1]}/${filterMonth.split('-')[0]}`

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-500 pb-20 max-w-7xl mx-auto">
      
      {/* HEADER & FILTER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-900 text-white p-8 rounded-3xl shadow-xl gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase flex items-center gap-3">
            <Activity size={32} className="text-blue-400"/> Báo Cáo Hiệu Quả
          </h1>
          <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest mt-2">Kỳ báo cáo: <span className="text-white">{periodText}</span></p>
        </div>
        <button onClick={() => setShowExpenseForm(!showExpenseForm)} className="bg-red-500 hover:bg-red-400 px-6 py-3 rounded-xl font-black shadow-lg shadow-red-500/30 transition-all flex items-center gap-2 text-sm uppercase tracking-wider shrink-0">
          {showExpenseForm ? 'Đóng form chi' : <><PlusCircle size={18}/> Ghi Chi Phí</>}
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
         <div className="flex items-center gap-2 text-gray-500 font-bold uppercase text-xs tracking-widest">
            <Filter size={16} /> Lọc dữ liệu:
         </div>
         <div className="flex gap-2 flex-wrap w-full md:w-auto">
            <button onClick={() => setFilterType('all')} className={`px-6 py-2 rounded-xl text-xs font-black uppercase transition-all ${filterType === 'all' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>Tất cả</button>
            <button onClick={() => setFilterType('year')} className={`px-6 py-2 rounded-xl text-xs font-black uppercase transition-all ${filterType === 'year' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>Theo Năm</button>
            <button onClick={() => setFilterType('month')} className={`px-6 py-2 rounded-xl text-xs font-black uppercase transition-all ${filterType === 'month' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>Theo Tháng</button>
         </div>
         <div className="flex gap-2 w-full md:w-auto">
            {filterType === 'year' && (
              <select className="bg-blue-50 border border-blue-200 text-blue-700 font-black rounded-xl px-4 py-2 outline-none w-full md:w-auto" value={filterYear} onChange={e => setFilterYear(e.target.value)}>
                {availableYears.map(y => <option key={y} value={y}>Năm {y}</option>)}
              </select>
            )}
            {filterType === 'month' && (
              <input type="month" className="bg-blue-50 border border-blue-200 text-blue-700 font-black rounded-xl px-4 py-2 outline-none uppercase w-full md:w-auto" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} />
            )}
         </div>
      </div>

      {showExpenseForm && (
        <form onSubmit={handleAddExpense} className="bg-white p-6 rounded-3xl border border-gray-200 grid grid-cols-1 md:grid-cols-5 gap-4 shadow-sm animate-in slide-in-from-top-4">
          <input required type="date" className="border border-gray-200 rounded-xl p-3 font-bold text-sm outline-none focus:border-red-400" value={expenseForm.expense_date} onChange={e => setExpenseForm({...expenseForm, expense_date: e.target.value})} />
          <input required placeholder="Tên chi phí (VD: Tiền điện)" className="border border-gray-200 rounded-xl p-3 font-bold text-sm outline-none focus:border-red-400" value={expenseForm.title} onChange={e => setExpenseForm({...expenseForm, title: e.target.value})} />
          <input required type="number" placeholder="Số tiền (đ)" className="border border-gray-200 rounded-xl p-3 font-bold text-red-600 text-sm outline-none focus:border-red-400 bg-red-50/30" value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} />
          <select className="border border-gray-200 rounded-xl p-3 font-bold text-sm outline-none focus:border-red-400" value={expenseForm.category} onChange={e => setExpenseForm({...expenseForm, category: e.target.value})}>
            <option>Bao bì & Hộp quà</option><option>Vận hành (Điện, Nước)</option><option>Marketing & Quảng cáo</option><option>Lương thưởng</option><option>Khác</option>
          </select>
          <button type="submit" className="bg-gray-900 text-white font-black rounded-xl py-3 uppercase text-xs hover:bg-black transition-colors">Lưu Chi Phí</button>
        </form>
      )}

      {/* ==================================================== */}
      {/* TẦNG 1: TÀI CHÍNH TỔNG XƯỞNG (DOANH THU & LỢI NHUẬN)   */}
      {/* ==================================================== */}
      <div>
        <h3 className="font-black uppercase text-gray-500 text-xs tracking-widest mb-3 flex items-center gap-2"><Landmark size={16}/> TÀI CHÍNH TỔNG XƯỞNG</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          
          {/* Ô 1: TỔNG DOANH THU */}
          <div className="bg-white p-6 rounded-[30px] border border-gray-100 shadow-sm relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 text-blue-50 opacity-50 group-hover:scale-110 transition-transform"><TrendingUp size={100}/></div>
            <p className="text-xs font-black uppercase text-gray-400 tracking-widest mb-2 relative z-10">Tổng Doanh Thu</p>
            <h2 className="text-3xl lg:text-4xl font-black text-blue-600 truncate relative z-10" title={stats.totalRevenue.toLocaleString() + 'đ'}>
                {formatCompactNumber(stats.totalRevenue)}
            </h2>
            <p className="text-[10px] text-gray-400 mt-2 font-bold relative z-10 uppercase">Tổng tiền khách đã trả</p>
          </div>

          {/* Ô 2: LỢI NHUẬN GỘP (TRƯỚC THUẾ) */}
          <div className="bg-white p-6 rounded-[30px] border border-gray-100 shadow-sm relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 text-orange-50 opacity-50 group-hover:scale-110 transition-transform"><Wallet size={100}/></div>
            <p className="text-xs font-black uppercase text-gray-400 tracking-widest mb-2 relative z-10">Lợi Nhuận Gộp</p>
            <h2 className="text-3xl lg:text-4xl font-black text-gray-900 truncate relative z-10" title={stats.profitBeforeTax.toLocaleString() + 'đ'}>
                {formatCompactNumber(stats.profitBeforeTax)}
            </h2>
            <p className="text-[10px] text-gray-400 mt-2 font-bold relative z-10 uppercase">(Chưa trừ Thuế và Sổ chi)</p>
          </div>

          {/* Ô 3: LỢI NHUẬN RÒNG (SAU THUẾ & CHI PHÍ) */}
          <div className="bg-gradient-to-br from-emerald-400 to-emerald-600 p-6 rounded-[30px] shadow-lg border-2 border-emerald-300 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 text-emerald-300 opacity-30 group-hover:scale-110 transition-transform"><DollarSign size={100}/></div>
            <p className="text-xs font-black uppercase text-emerald-100 tracking-widest mb-2 relative z-10">LỢI NHUẬN RÒNG (BỎ TÚI)</p>
            <h2 className="text-3xl lg:text-4xl font-black text-white truncate relative z-10" title={stats.netProfit.toLocaleString() + 'đ'}>
                {formatCompactNumber(stats.netProfit)}
            </h2>
            <p className="text-[10px] text-emerald-100 mt-2 font-bold relative z-10 uppercase bg-emerald-800/20 inline-block px-2 py-1 rounded">
                (Đã trừ sạch Thuế & Sổ chi)
            </p>
          </div>

        </div>
      </div>

      {/* ==================================================== */}
      {/* TẦNG 2: CHIA TIỀN CÁ NHÂN (HƯỞNG 100% KHÔNG THUẾ)      */}
      {/* ==================================================== */}
      <div>
        <h3 className="font-black uppercase text-gray-500 text-xs tracking-widest mb-3 flex items-center gap-2"><UserCheck size={16}/> TIỀN BỎ TÚI CÁ NHÂN (100%)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* KÉT 1: QUYÊN */}
          <div onClick={() => setShowQuyenHistory(true)} className="bg-white p-6 rounded-[30px] border-2 border-pink-200 shadow-sm relative overflow-hidden group cursor-pointer hover:shadow-md transition-all">
            <div className="absolute -right-4 -top-4 text-pink-50 opacity-50 group-hover:scale-110 transition-transform"><Heart size={100}/></div>
            <p className="text-xs font-black uppercase text-gray-500 tracking-widest mb-2 relative z-10 flex items-center gap-1">Lãi Bỏ Túi Quyên <span className="bg-pink-100 text-pink-600 px-1.5 py-0.5 rounded text-[8px] ml-1">BẤM XEM ĐƠN</span></p>
            <h2 className="text-3xl lg:text-4xl font-black text-pink-600 truncate relative z-10" title={stats.totalQuyenProfitRaw.toLocaleString() + 'đ'}>
                +{formatCompactNumber(stats.totalQuyenProfitRaw)}
            </h2>
            <p className="text-[10px] text-gray-400 mt-2 font-bold relative z-10 uppercase">
                Hưởng trọn vẹn (Không trừ Thuế)
            </p>
          </div>

          {/* KÉT 2: DUY */}
          <div onClick={() => setShowDuyHistory(true)} className="bg-white p-6 rounded-[30px] border-2 border-orange-200 shadow-sm relative overflow-hidden group cursor-pointer hover:shadow-md transition-all">
            <div className="absolute -right-4 -top-4 text-orange-50 opacity-50 group-hover:scale-110 transition-transform"><UserCheck size={100}/></div>
            <p className="text-xs font-black uppercase text-gray-500 tracking-widest mb-2 relative z-10 flex items-center gap-1">Lãi Bỏ Túi Duy <span className="bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded text-[8px] ml-1">BẤM XEM ĐƠN</span></p>
            <h2 className="text-3xl lg:text-4xl font-black text-orange-600 truncate relative z-10" title={stats.totalDuyProfitRaw.toLocaleString() + 'đ'}>
                +{formatCompactNumber(Math.round(stats.totalDuyProfitRaw))}
            </h2>
            <p className="text-[10px] text-gray-400 mt-2 font-bold relative z-10 uppercase">
                Hưởng trọn vẹn (Không trừ Thuế)
            </p>
          </div>

        </div>
      </div>

      {/* MODAL LỊCH SỬ BÁN HÀNG CỦA DUY */}
      {showDuyHistory && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-[30px] p-6 md:p-8 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative">
            <button onClick={() => setShowDuyHistory(false)} className="absolute top-5 right-5 text-gray-400 hover:text-red-500 bg-gray-100 hover:bg-red-50 p-2 rounded-full transition-colors"><X size={20}/></button>
            <div className="mb-6 pr-8 border-b border-gray-100 pb-4">
               <h2 className="text-xl font-black uppercase tracking-tighter text-orange-600 flex items-center gap-2">
                  <UserCheck size={24}/> Lịch sử Chiết Khấu Sếp Duy
               </h2>
               <p className="text-xs font-bold text-gray-500 mt-1">Danh sách các đơn hàng do Sếp Duy chốt (Không trừ thuế, Hưởng trọn 100%)</p>
            </div>
            <div className="overflow-x-auto overflow-y-auto pr-2 space-y-2 custom-scrollbar flex-1">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead className="bg-orange-50 text-[10px] font-black uppercase text-orange-800">
                  <tr>
                    <th className="p-3 rounded-l-lg">Khách hàng</th>
                    <th className="p-3">Ngày bán</th>
                    <th className="p-3 text-center">Phân Loại</th>
                    <th className="p-3 text-right">Doanh Thu Đơn</th>
                    <th className="p-3 rounded-r-lg text-right text-orange-600">Duy Bỏ Túi (100%)</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-bold text-gray-700">
                  {stats.duyOrders.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-10 text-gray-400">Sếp chưa chốt đơn nào trong kỳ này!</td></tr>
                  ) : (
                      stats.duyOrders.map((o: any) => {
                          const lossCost = Number(o.weight) > 0 ? (Number(o.weight_loss || 0) * (Number(o.cost) / Number(o.weight))) : 0;
                          const realProfit = Number(o.revenue) - Number(o.cost) - Number(o.shipping_fee || 0) - lossCost;
                          return (
                            <tr key={o.id} className="border-b border-gray-100 last:border-0 hover:bg-orange-50/30 transition-colors">
                              <td className="p-3 text-gray-900">{o.customers?.name}</td>
                              <td className="p-3 text-gray-500 text-xs">{new Date(o.created_at).toLocaleDateString('vi-VN')}</td>
                              <td className="p-3 text-center"><span className="text-orange-500 uppercase text-[10px] font-black border border-orange-200 px-2 py-0.5 rounded">{o.grade_type || 'Xô'}</span></td>
                              <td className="p-3 text-right text-gray-500">{Number(o.revenue).toLocaleString()}đ</td>
                              <td className="p-3 text-right text-orange-600 font-black text-base" title="Đã trừ Vốn, Ship, Hao hụt. KHÔNG trừ Thuế.">+{Math.round(realProfit).toLocaleString()}đ</td>
                            </tr>
                          )
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL LỊCH SỬ BÁN HÀNG CỦA QUYÊN */}
      {showQuyenHistory && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-[30px] p-6 md:p-8 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative">
            <button onClick={() => setShowQuyenHistory(false)} className="absolute top-5 right-5 text-gray-400 hover:text-red-500 bg-gray-100 hover:bg-red-50 p-2 rounded-full transition-colors"><X size={20}/></button>
            <div className="mb-6 pr-8 border-b border-gray-100 pb-4">
               <h2 className="text-xl font-black uppercase tracking-tighter text-pink-600 flex items-center gap-2">
                  <Heart size={24}/> Lịch sử Chiết Khấu Quyên
               </h2>
               <p className="text-xs font-bold text-gray-500 mt-1">Danh sách các đơn hàng do Quyên chốt (Không trừ thuế, Hưởng trọn 100%)</p>
            </div>
            <div className="overflow-x-auto overflow-y-auto pr-2 space-y-2 custom-scrollbar flex-1">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead className="bg-pink-50 text-[10px] font-black uppercase text-pink-800">
                  <tr>
                    <th className="p-3 rounded-l-lg">Khách hàng</th>
                    <th className="p-3">Ngày bán</th>
                    <th className="p-3 text-center">Phân Loại</th>
                    <th className="p-3 text-right">Doanh Thu Đơn</th>
                    <th className="p-3 rounded-r-lg text-right text-pink-600">Quyên Bỏ Túi (100%)</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-bold text-gray-700">
                  {stats.quyenOrders.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-10 text-gray-400">Quyên chưa chốt đơn nào trong kỳ này!</td></tr>
                  ) : (
                      stats.quyenOrders.map((o: any) => {
                          const lossCost = Number(o.weight) > 0 ? (Number(o.weight_loss || 0) * (Number(o.cost) / Number(o.weight))) : 0;
                          const realProfit = Number(o.revenue) - Number(o.cost) - Number(o.shipping_fee || 0) - lossCost;
                          return (
                            <tr key={o.id} className="border-b border-gray-100 last:border-0 hover:bg-pink-50/30 transition-colors">
                              <td className="p-3 text-gray-900">{o.customers?.name}</td>
                              <td className="p-3 text-gray-500 text-xs">{new Date(o.created_at).toLocaleDateString('vi-VN')}</td>
                              <td className="p-3 text-center"><span className="text-orange-500 uppercase text-[10px] font-black border border-orange-200 px-2 py-0.5 rounded">{o.grade_type || 'Xô'}</span></td>
                              <td className="p-3 text-right text-gray-500">{Number(o.revenue).toLocaleString()}đ</td>
                              <td className="p-3 text-right text-pink-600 font-black text-base" title="Đã trừ Vốn, Ship, Hao hụt. KHÔNG trừ Thuế.">+{Math.round(realProfit).toLocaleString()}đ</td>
                            </tr>
                          )
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-4">
        
        {/* BIỂU ĐỒ CỘT */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
           <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-2">
              <div>
                 <h3 className="text-xl font-black uppercase tracking-tight text-gray-900 flex items-center gap-2"><BarChartIcon size={24} className="text-blue-500"/> Biểu Đồ Tăng Trưởng</h3>
                 <p className="text-xs font-bold text-gray-400 uppercase mt-1">So sánh Tốc độ kiếm tiền {filterType === 'month' ? 'Theo Ngày' : 'Theo Tháng'}</p>
              </div>
              {stats.chartData.length <= 1 && <span className="text-[10px] bg-gray-100 text-gray-500 px-3 py-1 rounded-full font-bold uppercase">Cần thêm dữ liệu</span>}
           </div>
           
           <div className="h-[350px] w-full">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barGap={8}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                   <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 'bold'}} dy={10} />
                   <YAxis tickFormatter={(val) => `${val / 1e6}Tr`} axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 'bold'}} />
                   <Tooltip 
                     cursor={{fill: '#f8fafc'}}
                     contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                     formatter={(value: any) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(value) || 0)}
                   />
                   <Legend wrapperStyle={{paddingTop: '20px', fontSize: '12px', fontWeight: 'bold'}} />
                   <Bar dataKey="Doanh_thu" name="Doanh Thu Bán Hàng" fill="#3b82f6" radius={[8, 8, 8, 8]} maxBarSize={50} />
                   <Bar dataKey="Loi_nhuan_rong" name="Lợi Nhuận Ròng" fill="#10b981" radius={[8, 8, 8, 8]} maxBarSize={50} />
                </BarChart>
             </ResponsiveContainer>
           </div>
        </div>

        {/* CƠ CẤU CHI PHÍ DÒNG TIỀN */}
        <div className="bg-gray-900 p-8 rounded-[40px] shadow-xl text-white flex flex-col justify-between">
           <div>
              <h3 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2 mb-1"><PieChart size={24} className="text-orange-400"/> Cơ cấu chi phí</h3>
              <p className="text-xs font-bold text-gray-400 uppercase mb-8">Tính trên 100% Doanh Thu ({formatCompactNumber(stats.totalRevenue)})</p>

              {stats.totalRevenue > 0 ? (
                <div className="space-y-6">
                   {/* Thanh tiến độ */}
                   <div className="h-6 w-full flex rounded-full overflow-hidden mb-8 shadow-inner bg-gray-800">
                      <div style={{width: `${(stats.totalCOGS/stats.totalRevenue)*100}%`}} className="bg-slate-500 hover:opacity-80 transition-opacity" title="Tiền Vốn Yến Kho"></div>
                      <div style={{width: `${((stats.totalTax + stats.totalShip + stats.totalLossCost)/stats.totalRevenue)*100}%`}} className="bg-orange-500 hover:opacity-80 transition-opacity" title="Thuế, Ship, Khấu hao"></div>
                      <div style={{width: `${(stats.totalOutsideExpenses/stats.totalRevenue)*100}%`}} className="bg-red-500 hover:opacity-80 transition-opacity" title="Chi phí Vận hành ngoài"></div>
                      <div style={{width: `${(stats.netProfit/stats.totalRevenue)*100}%`}} className="bg-emerald-500 hover:opacity-80 transition-opacity" title="Lợi Nhuận Ròng Tổng Xưởng"></div>
                   </div>

                   {/* Chú giải */}
                   <div className="space-y-4">
                      <div className="flex justify-between items-center">
                         <div className="flex items-center gap-3"><span className="w-4 h-4 rounded-full bg-slate-500"></span> <span className="text-sm font-bold text-gray-300">Tiền Vốn Yến Kho</span></div>
                         <div className="text-right">
                            <span className="block font-black text-white">{((stats.totalCOGS/stats.totalRevenue)*100).toFixed(1)}%</span>
                            <span className="text-[10px] text-gray-500">{formatCompactNumber(stats.totalCOGS)}</span>
                         </div>
                      </div>
                      <div className="flex justify-between items-center">
                         <div className="flex items-center gap-3"><span className="w-4 h-4 rounded-full bg-orange-500"></span> <span className="text-sm font-bold text-gray-300">Thuế, Ship, Khấu hao</span></div>
                         <div className="text-right">
                            <span className="block font-black text-white">{(((stats.totalTax + stats.totalShip + stats.totalLossCost)/stats.totalRevenue)*100).toFixed(1)}%</span>
                            <span className="text-[10px] text-gray-500">{formatCompactNumber(stats.totalTax + stats.totalShip + stats.totalLossCost)}</span>
                         </div>
                      </div>
                      <div className="flex justify-between items-center">
                         <div className="flex items-center gap-3"><span className="w-4 h-4 rounded-full bg-red-500"></span> <span className="text-sm font-bold text-gray-300">Phí Vận hành (Sổ chi)</span></div>
                         <div className="text-right">
                            <span className="block font-black text-white">{((stats.totalOutsideExpenses/stats.totalRevenue)*100).toFixed(1)}%</span>
                            <span className="text-[10px] text-gray-500">{formatCompactNumber(stats.totalOutsideExpenses)}</span>
                         </div>
                      </div>
                      <div className="flex justify-between items-center border-t border-gray-700 pt-4 mt-2">
                         <div className="flex items-center gap-3"><span className="w-4 h-4 rounded-full bg-emerald-500"></span> <span className="text-sm font-black text-white uppercase tracking-widest">Lợi Nhuận Ròng</span></div>
                         <div className="text-right">
                            <span className="font-black text-emerald-400 text-xl block">{((stats.netProfit/stats.totalRevenue)*100).toFixed(1)}%</span>
                            <span className="text-[10px] text-gray-500">{formatCompactNumber(stats.netProfit)}</span>
                         </div>
                      </div>
                   </div>
                </div>
              ) : (
                <div className="text-center py-10 text-gray-600 font-bold italic uppercase tracking-widest">Chưa có dữ liệu doanh thu</div>
              )}
           </div>
        </div>
      </div>

      {/* SỔ CHI TIỀN */}
      <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 mt-4">
         <div className="flex items-center justify-between mb-6 pb-6 border-b border-dashed border-gray-200">
            <div>
               <h3 className="text-xl font-black uppercase tracking-tight text-gray-900 flex items-center gap-2"><Receipt className="text-red-500"/> Sổ Chi Tiền Ngoài</h3>
               <p className="text-xs font-bold text-gray-400 uppercase mt-1">Quản lý lương, bao bì, quảng cáo...</p>
            </div>
            <div className="bg-red-50 text-red-600 px-4 py-2 rounded-2xl font-black text-sm border border-red-100 flex items-center gap-2">
               <span className="hidden sm:inline">Tổng chi:</span> {stats.totalOutsideExpenses.toLocaleString()}đ
            </div>
         </div>
         
         {filteredExpenses.length === 0 ? (
            <p className="text-center py-10 text-gray-400 font-bold uppercase tracking-widest">Không có khoản chi ngoài nào.</p>
         ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredExpenses.map(e => (
                <div key={e.id} className="flex justify-between items-center bg-gray-50 hover:bg-red-50/50 transition-colors p-5 rounded-3xl border border-gray-100 group relative">
                   <div className="flex-1 truncate pr-4">
                      <h4 className="font-black text-gray-900 uppercase truncate">{e.title || 'Chi phí ngoài'}</h4>
                      <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-widest truncate">{new Date(e.expense_date).toLocaleDateString('vi-VN')} • {e.category}</p>
                   </div>
                   <div className="flex items-center gap-3">
                      <span className="font-black text-red-600 text-base">-{Number(e.amount).toLocaleString()}đ</span>
                      <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity absolute -right-2 bg-white p-1 rounded-xl shadow-lg border border-red-100">
                         <button onClick={() => handleOpenEdit(e)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-colors" title="Sửa"><Pencil size={14}/></button>
                         <button onClick={() => handleDeleteExpense(e.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-colors" title="Xóa"><Trash2 size={14}/></button>
                      </div>
                   </div>
                </div>
              ))}
            </div>
         )}
      </div>

      {/* MODAL SỬA CHI PHÍ */}
      {editingExpense && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl relative animate-in zoom-in-95">
            <button onClick={() => setEditingExpense(null)} className="absolute top-6 right-6 text-gray-400 hover:text-red-500 bg-gray-100 p-2 rounded-full transition-colors"><X size={20}/></button>
            <h2 className="text-2xl font-black uppercase tracking-tighter mb-6 text-gray-900 flex items-center gap-2"><Pencil className="text-blue-500"/> Sửa Khoản Chi</h2>
            <form onSubmit={handleUpdateExpense} className="flex flex-col gap-4">
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Ngày chi</label>
                <input required type="date" className="border border-gray-200 rounded-xl p-3 font-bold text-sm w-full outline-none focus:border-blue-400" value={editForm.expense_date} onChange={e => setEditForm({...editForm, expense_date: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Tên chi phí</label>
                <input required placeholder="Tên chi phí" className="border border-gray-200 rounded-xl p-3 font-bold text-sm w-full outline-none focus:border-blue-400" value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Số tiền (VNĐ)</label>
                <input required type="number" placeholder="Số tiền (đ)" className="border border-red-200 rounded-xl p-3 font-bold text-red-600 text-sm w-full bg-red-50/30 outline-none focus:border-red-400" value={editForm.amount} onChange={e => setEditForm({...editForm, amount: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Phân loại</label>
                <select className="border border-gray-200 rounded-xl p-3 font-bold text-sm w-full outline-none focus:border-blue-400" value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value})}>
                  <option>Bao bì & Hộp quà</option><option>Vận hành (Điện, Nước)</option><option>Marketing & Quảng cáo</option><option>Lương thưởng</option><option>Khác</option>
                </select>
              </div>
              <button type="submit" className="bg-blue-600 text-white font-black rounded-xl py-4 uppercase text-sm hover:bg-blue-700 transition-colors mt-2 shadow-lg shadow-blue-500/30">Cập nhật ngay</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
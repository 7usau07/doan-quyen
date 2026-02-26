'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line
} from 'recharts'
import { DollarSign, TrendingUp, TrendingDown, Receipt, Wallet, PlusCircle, PieChart, Filter, Pencil, Trash2, X } from 'lucide-react'

export default function ProfitPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // BỘ LỌC THỜI GIAN
  const [filterType, setFilterType] = useState('all')
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString())
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7))

  // FORM THÊM MỚI
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [expenseForm, setExpenseForm] = useState({
    title: '', amount: '', category: 'Bao bì & Hộp quà', expense_date: new Date().toISOString().split('T')[0], note: ''
  })

  // TRẠNG THÁI SỬA (EDIT) CHI PHÍ
  const [editingExpense, setEditingExpense] = useState<any>(null)
  const [editForm, setEditForm] = useState({
    title: '', amount: '', category: '', expense_date: ''
  })

  const fetchData = async () => {
    setLoading(true)
    const [ordersRes, expensesRes] = await Promise.all([
      supabase.from('orders').select('*'),
      supabase.from('expenses').select('*').order('expense_date', { ascending: false })
    ])
    if (ordersRes.data) setOrders(ordersRes.data)
    if (expensesRes.data) setExpenses(expensesRes.data)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  // HÀM THÊM CHI PHÍ
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

  // HÀM XÓA CHI PHÍ
  const handleDeleteExpense = async (id: string) => {
    if (!window.confirm("Duy có chắc chắn muốn xóa khoản chi này không? Xóa xong sẽ tính lại tiền đó nhé!")) return;
    await supabase.from('expenses').delete().eq('id', id);
    fetchData();
  }

  // HÀM MỞ FORM SỬA
  const handleOpenEdit = (expense: any) => {
    setEditingExpense(expense);
    setEditForm({
      title: expense.title,
      amount: expense.amount.toString(),
      category: expense.category,
      expense_date: expense.expense_date
    });
  }

  // HÀM CẬP NHẬT CHI PHÍ
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

  const stats = useMemo(() => {
    const totalRevenue = filteredOrders.reduce((sum, o) => sum + Number(o.revenue || 0), 0)
    const totalCost = filteredOrders.reduce((sum, o) => sum + Number(o.cost || 0), 0)
    const totalTax = filteredOrders.reduce((sum, o) => sum + Number(o.tax_amount || 0), 0)
    const totalShip = filteredOrders.reduce((sum, o) => sum + Number(o.shipping_fee || 0), 0)
    
    const grossProfit = totalRevenue - totalCost - totalTax - totalShip
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)
    const netProfit = grossProfit - totalExpenses

    const isMonthView = filterType === 'month'
    const chartDataMap: Record<string, any> = {}
    
    filteredOrders.forEach(o => {
      const d = new Date(o.created_at)
      const key = isMonthView ? d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : d.toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' })

      if (!chartDataMap[key]) chartDataMap[key] = { name: key, Doanh_thu: 0, Chi_phi_ngoai: 0, Loi_nhuan_rong: 0, gross: 0 }
      chartDataMap[key].Doanh_thu += Number(o.revenue || 0)
      chartDataMap[key].gross += (Number(o.revenue || 0) - Number(o.cost || 0) - Number(o.tax_amount || 0) - Number(o.shipping_fee || 0))
      chartDataMap[key].Loi_nhuan_rong = chartDataMap[key].gross
    })

    filteredExpenses.forEach(e => {
      const d = new Date(e.expense_date)
      const key = isMonthView ? d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : d.toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' })

      if (!chartDataMap[key]) chartDataMap[key] = { name: key, Doanh_thu: 0, Chi_phi_ngoai: 0, Loi_nhuan_rong: 0, gross: 0 }
      chartDataMap[key].Chi_phi_ngoai += Number(e.amount || 0)
    })

    Object.keys(chartDataMap).forEach(k => {
      chartDataMap[k].Loi_nhuan_rong = chartDataMap[k].gross - chartDataMap[k].Chi_phi_ngoai
    })

    const chartData = Object.values(chartDataMap).sort((a, b) => {
      if (isMonthView) {
        const [d1, m1] = a.name.split('/'); const [d2, m2] = b.name.split('/')
        return new Date(2000, Number(m1)-1, Number(d1)).getTime() - new Date(2000, Number(m2)-1, Number(d2)).getTime()
      } else {
        const [m1, y1] = a.name.split('/'); const [m2, y2] = b.name.split('/')
        return new Date(Number(y1), Number(m1)-1).getTime() - new Date(Number(y2), Number(m2)-1).getTime()
      }
    })

    return { totalRevenue, grossProfit, totalExpenses, netProfit, chartData }
  }, [filteredOrders, filteredExpenses, filterType])

  if (loading) return <div className="p-10 font-black text-gray-400 animate-pulse text-center uppercase">Đang tải báo cáo tài chính...</div>

  const periodText = filterType === 'all' ? 'TẤT CẢ THỜI GIAN' : filterType === 'year' ? `NĂM ${filterYear}` : `THÁNG ${filterMonth.split('-')[1]}/${filterMonth.split('-')[0]}`

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-500 pb-20 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-900 text-white p-8 rounded-3xl shadow-xl gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase flex items-center gap-3">
            <PieChart size={32} className="text-blue-400"/> Báo Cáo Tài Chính
          </h1>
          <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest mt-2">Kỳ báo cáo: <span className="text-white">{periodText}</span></p>
        </div>
        <button onClick={() => setShowExpenseForm(!showExpenseForm)} className="bg-red-500 hover:bg-red-400 px-6 py-3 rounded-xl font-black shadow-lg shadow-red-500/30 transition-all flex items-center gap-2 text-sm uppercase tracking-wider shrink-0">
          {showExpenseForm ? 'Hủy bỏ' : <><PlusCircle size={18}/> Ghi Chi Phí</>}
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-center">
          <p className="text-[10px] font-black uppercase text-gray-400 mb-2 flex items-center gap-2"><TrendingUp size={14} className="text-blue-500"/> Tổng Doanh Thu</p>
          <h2 className="text-2xl lg:text-3xl font-black text-gray-900 truncate" title={`${stats.totalRevenue}đ`}>{stats.totalRevenue.toLocaleString()}đ</h2>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-center">
          <p className="text-[10px] font-black uppercase text-gray-400 mb-2 flex items-center gap-2"><Wallet size={14} className="text-green-500"/> Lãi Gộp Đơn Hàng</p>
          <h2 className="text-2xl lg:text-3xl font-black text-gray-900 truncate" title={`${stats.grossProfit}đ`}>{stats.grossProfit.toLocaleString()}đ</h2>
        </div>
        <div className="bg-red-50 p-6 rounded-3xl border border-red-100 flex flex-col justify-center">
          <p className="text-[10px] font-black uppercase text-red-400 mb-2 flex items-center gap-2"><TrendingDown size={14}/> Tổng Chi Phí Ngoài</p>
          <h2 className="text-2xl lg:text-3xl font-black text-red-600 truncate" title={`-${stats.totalExpenses}đ`}>-{stats.totalExpenses.toLocaleString()}đ</h2>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-green-600 p-6 rounded-3xl text-white shadow-xl shadow-green-200 flex flex-col justify-center transform hover:scale-[1.02] transition-transform">
          <p className="text-[10px] font-black uppercase text-green-100 mb-2 flex items-center gap-2"><DollarSign size={14}/> LỢI NHUẬN RÒNG CUỐI</p>
          <h2 className="text-2xl lg:text-3xl font-black truncate" title={`+${stats.netProfit}đ`}>+{stats.netProfit.toLocaleString()}đ</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col">
          <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <h3 className="text-lg font-black uppercase tracking-tighter text-gray-900 flex items-center gap-2">
                 📊 Biểu Đồ Dòng Tiền <span className="text-blue-500 bg-blue-50 px-2 py-1 rounded-md text-xs">{filterType === 'month' ? 'Theo Ngày' : 'Theo Tháng'}</span>
              </h3>
              {stats.chartData.length <= 1 && <span className="text-[10px] bg-gray-100 text-gray-500 px-3 py-1 rounded-full font-bold uppercase">Cần thêm dữ liệu để vẽ biểu đồ</span>}
          </div>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 'bold' }} dy={10} />
                <YAxis tickFormatter={(v) => `${v / 1000000}M`} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 'bold' }} />
                <Tooltip cursor={{ stroke: '#f8fafc', strokeWidth: 2 }} contentStyle={{ borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold', fontSize: '12px' }} formatter={(v: any) => [`${Number(v).toLocaleString()}đ`]} />
                <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '20px' }}/>
                <Line type="monotone" dataKey="Doanh_thu" name="Doanh Thu" stroke="#3b82f6" strokeWidth={3} dot={{ r: 5, strokeWidth: 2 }} activeDot={{ r: 7 }} />
                <Line type="monotone" dataKey="Loi_nhuan_rong" name="Lợi Nhuận Ròng" stroke="#10b981" strokeWidth={3} dot={{ r: 5, strokeWidth: 2 }} />
                <Line type="monotone" dataKey="Chi_phi_ngoai" name="Chi Phí Ngoài" stroke="#ef4444" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* LỊCH SỬ CHI PHÍ ĐÃ ĐƯỢC THÊM NÚT SỬA/XÓA */}
        <div className="bg-gray-50 p-6 rounded-3xl border border-gray-200 flex flex-col h-[400px]">
          <h3 className="text-lg font-black uppercase tracking-tighter mb-4 flex items-center justify-between text-gray-900 border-b pb-4">
            <span className="flex items-center gap-2"><Receipt className="text-red-500" size={20} /> Sổ Chi Tiền</span>
            <span className="text-[10px] text-gray-400 bg-white px-2 py-1 rounded-md border">{filteredExpenses.length} khoản</span>
          </h3>
          <div className="overflow-y-auto pr-2 space-y-3 flex-1 custom-scrollbar">
            {filteredExpenses.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50">
                    <Receipt size={48} className="mb-2"/>
                    <p className="font-bold text-xs uppercase tracking-widest text-center">Không có khoản chi nào<br/>trong kỳ này</p>
                </div>
            ) : null}
            {filteredExpenses.map(e => (
              <div key={e.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center hover:border-red-200 transition-colors group h-[72px]">
                <div className="truncate pr-4 flex-1">
                  <p className="font-black text-gray-900 text-sm truncate">{e.title}</p>
                  <p className="text-[10px] font-bold text-gray-400 mt-1">{new Date(e.expense_date).toLocaleDateString('vi-VN')} • {e.category}</p>
                </div>
                
                {/* Khu vực hiển thị tiền & Nút Sửa/Xóa */}
                <div className="flex items-center shrink-0">
                  <p className="font-black text-red-600 text-sm group-hover:hidden block">-{Number(e.amount).toLocaleString()}đ</p>
                  
                  {/* Nút hành động chỉ hiện khi hover */}
                  <div className="hidden group-hover:flex gap-1.5 animate-in fade-in zoom-in-95 duration-200">
                    <button onClick={() => handleOpenEdit(e)} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-200 transition-colors" title="Sửa khoản chi"><Pencil size={14}/></button>
                    <button onClick={() => handleDeleteExpense(e.id)} className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-200 transition-colors" title="Xóa khoản chi"><Trash2 size={14}/></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MODAL SỬA CHI PHÍ (POPUP CỰC GỌN) */}
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
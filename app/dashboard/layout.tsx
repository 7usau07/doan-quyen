'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  LayoutDashboard, ShoppingCart, Users, LineChart, LogOut, 
  Package, Map, Landmark, ShieldCheck, 
  Menu, X 
} from 'lucide-react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)
  
  // TRẠNG THÁI ĐÓNG/MỞ MENU TRÊN ĐIỆN THOẠI
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false) 

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login') 
      } else {
        setIsChecking(false) 
      }
    }
    
    checkAuth()

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        router.push('/login')
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [router])

  // TỰ ĐỘNG ĐÓNG MENU KHI BẤM CHUYỂN TRANG TRÊN ĐIỆN THOẠI
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // ĐÃ CHỐT CỨNG 7 MỤC (CÓ SỔ CÔNG NỢ)
  const menuItems = [
    { name: 'Tổng quan', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Kho & Lô Hàng', href: '/dashboard/inventory', icon: Package },
    { name: 'Bản đồ khách', href: '/dashboard/map', icon: Map },
    { name: 'Đơn hàng', href: '/dashboard/orders', icon: ShoppingCart },
    { name: 'Khách hàng', href: '/dashboard/customers', icon: Users },
    { name: 'Lợi nhuận', href: '/dashboard/profit', icon: LineChart },
    { name: 'Sổ Công Nợ', href: '/dashboard/debts', icon: Landmark }, 
  ]

  if (isChecking) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white">
         <ShieldCheck size={48} className="text-blue-500 animate-pulse mb-4"/>
         <h2 className="font-black text-xl tracking-widest uppercase">Đang quét mã bảo mật DD PRIME...</h2>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900 animate-in fade-in duration-500">
      
      {/* THANH TOP BAR DÀNH RIÊNG CHO MOBILE */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-gray-900 text-white z-40 flex items-center justify-between px-6 shadow-md">
         <div className="font-black tracking-tighter text-xl">ĐOÀN QUYÊN <span className="text-blue-500 text-sm">®</span></div>
         <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 -mr-2 text-gray-300 hover:text-white">
            <Menu size={28} />
         </button>
      </div>

      {/* LỚP PHỦ MÀU ĐEN (Khi mở menu trên điện thoại, bấm ra ngoài để đóng) */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* SIDEBAR MENU (Tự động giấu đi trên Mobile, luôn hiện trên Laptop) */}
      <aside className={`w-64 bg-black text-white flex flex-col fixed h-full shadow-2xl z-50 transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="p-8 flex justify-between items-start">
          <div>
            <Link href="/dashboard" className="text-2xl font-black tracking-tighter hover:text-blue-400 transition-colors">
              ĐOÀN QUYÊN <span className="text-blue-500 text-xs">®</span>
            </Link>
            <p className="text-[10px] text-gray-500 font-bold uppercase mt-1 tracking-widest leading-tight">
              Hệ thống Yến Sào <br/>
            </p>
          </div>
          {/* Nút đóng Menu chữ X trên Mobile */}
          <button className="md:hidden text-gray-400 hover:text-white bg-white/10 p-2 rounded-full" onClick={() => setIsMobileMenuOpen(false)}>
             <X size={18}/>
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto custom-scrollbar pb-20 md:pb-0">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
            
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex items-center gap-4 px-6 py-4 rounded-2xl font-black text-sm transition-all ${
                  isActive 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20 md:scale-[1.02]' 
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon size={20} />
                {item.name}
              </Link>
            )
          })}
        </nav>

        <div className="p-6 md:p-8 border-t border-white/5 mt-auto">
          <button onClick={handleLogout} className="flex items-center justify-center md:justify-start gap-4 text-gray-500 font-bold text-sm hover:text-red-400 transition-colors w-full p-3 rounded-xl bg-white/5 hover:bg-red-500/10">
            <LogOut size={18} /> Đăng xuất
          </button>
        </div>
      </aside>

      {/* NỘI DUNG CHÍNH (Thêm khoảng cách pt-20 trên mobile để không bị thanh Topbar che mất) */}
      <main className="flex-1 w-full md:ml-64 p-4 pt-20 md:pt-4 min-h-screen relative overflow-x-hidden">
        <div className="max-w-7xl mx-auto h-full">
          {children}
        </div>
      </main>

    </div>
  )
}
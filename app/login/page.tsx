'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Lock, Mail, KeyRound, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError('Sai email hoặc mật khẩu rồi sếp ơi!')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-[40px] p-8 shadow-2xl animate-in zoom-in-95">
        <div className="text-center mb-8">
          <div className="bg-gray-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-gray-900/30">
             <Lock className="text-white" size={28} />
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tighter uppercase">YẾN SÀO ĐOÀN QUYÊN</h1>
          <p className="text-gray-500 font-bold text-[10px] uppercase tracking-widest mt-1">Khu vực quản trị nội bộ</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-2xl flex items-center gap-2 text-sm font-bold border border-red-100 animate-pulse">
            <AlertCircle size={18} /> {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 block">Tài khoản Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input 
                required 
                type="email" 
                placeholder="admin@ddprime.com" 
                className="w-full border-2 border-gray-100 rounded-2xl p-4 pl-12 font-bold outline-none focus:border-blue-500 transition-colors"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 block">Mật khẩu</label>
            <div className="relative">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input 
                required 
                type="password" 
                placeholder="••••••••" 
                className="w-full border-2 border-gray-100 rounded-2xl p-4 pl-12 font-bold outline-none focus:border-blue-500 transition-colors"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 text-white font-black text-lg py-4 rounded-2xl uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/30 mt-4"
          >
            {loading ? 'Đang mở khóa...' : 'Đăng nhập'}
          </button>
        </form>

        <p className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-8">
          Hệ thống được bảo mật ĐÔNG DUY
        </p>
      </div>
    </div>
  )
}
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const [status, setStatus] = useState('đang kết nối...')
  const router = useRouter()

  useEffect(() => {
    const run = async () => {
      const { data, error } = await supabase.from('test').select('*')

      if (error) {
        console.log(error)
        setStatus('❌ lỗi kết nối supabase')
      } else {
        console.log(data)
        setStatus('✅ supabase kết nối OK')
      }
    }

    run()
  }, [])

  return (
    <main className="min-h-screen bg-zinc-50 flex items-center justify-center">
      <div className="bg-white shadow-xl rounded-2xl p-10 w-[420px] text-center space-y-6">
        <h1 className="text-2xl font-bold">Yến Manager Dashboard</h1>

        <p className="text-zinc-500">
          hệ thống quản lý kho + đơn + lợi nhuận yến
        </p>

        <div className="p-4 rounded-xl bg-zinc-100">
          {status}
        </div>

        <button
          onClick={() => router.push('/dashboard')}
          className="w-full bg-black text-white py-3 rounded-xl hover:opacity-80 active:scale-95 transition"
        >
          bắt đầu quản lý
        </button>
      </div>
    </main>
  )
}
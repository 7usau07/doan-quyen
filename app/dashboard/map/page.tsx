'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import dynamic from 'next/dynamic'
import 'leaflet/dist/leaflet.css'
import { Map as MapIcon, Package, Target } from 'lucide-react'

// TẢI BẢN ĐỒ DYNAMIC (Né lỗi Window is not defined của Next.js)
const MapContainer = dynamic(() => import('react-leaflet').then((mod) => mod.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then((mod) => mod.TileLayer), { ssr: false })
const CircleMarker = dynamic(() => import('react-leaflet').then((mod) => mod.CircleMarker), { ssr: false })
const Tooltip = dynamic(() => import('react-leaflet').then((mod) => mod.Tooltip), { ssr: false })

export default function CustomerMapPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => { 
    setHasMounted(true) 
  }, [])

  useEffect(() => {
    async function fetchMapData() {
      const { data } = await supabase
        .from('customers')
        .select(`id, name, address, lat, lng, orders (weight)`)
      
      if (data) {
        const processed = data.map((c: any) => ({
          ...c,
          totalWeight: c.orders?.reduce((sum: number, o: any) => sum + Number(o.weight || 0), 0) || 0,
          // Nếu khách chưa có tọa độ, mặc định chấm ở khu vực trung tâm HCM hoặc VN
          lat: Number(c.lat) || (c.address?.includes('HCM') ? 10.8231 : 16.047),
          lng: Number(c.lng) || (c.address?.includes('HCM') ? 106.6297 : 108.206)
        }))
        setCustomers(processed)
      }
      setLoading(false)
    }
    if (hasMounted) fetchMapData()
  }, [hasMounted])

  if (!hasMounted || loading) return <div className="p-10 font-black text-gray-400 animate-pulse text-center uppercase tracking-widest">ĐANG TẢI BẢN ĐỒ THỊ PHẦN DD PRIME...</div>

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-700 max-w-7xl mx-auto pb-20">
      <div className="flex flex-col gap-1">
        <h1 className="text-4xl font-black text-gray-900 tracking-tighter uppercase italic">Thị phần YẾN SÀO ĐOÀN QUYÊN</h1>
        <p className="text-gray-500 font-bold text-xs uppercase tracking-widest">Bản đồ phân bổ khách hàng toàn quốc</p>
      </div>

      <div className="h-[70vh] w-full rounded-[40px] overflow-hidden border border-gray-200 shadow-xl z-0 relative">
        <MapContainer 
          center={[16.047, 108.206]} // Căn giữa bản đồ vào Việt Nam
          zoom={6} 
          style={{ height: '100%', width: '100%' }}
        >
          {/* ĐÃ ĐỔI NGUỒN BẢN ĐỒ ĐỂ HIỂN THỊ RÕ BIỂN ĐẢO VIỆT NAM */}
          <TileLayer 
            url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" 
            attribution="&copy; Google Maps"
          />

          {customers.map((c) => (
            <CircleMarker
              key={c.id}
              center={[c.lat, c.lng]}
              radius={Math.max(8, Math.min(c.totalWeight * 3, 25))} 
              pathOptions={{
                fillColor: c.totalWeight > 5 ? '#ef4444' : '#3b82f6', 
                color: 'white',
                weight: 2,
                fillOpacity: 0.8
              }}
            >
              <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                <div className="p-2 font-bold min-w-[150px]">
                    <p className="text-blue-600 text-sm uppercase font-black">{c.name}</p>
                    <p className="text-[10px] text-gray-500">{c.address}</p>
                    <div className="flex items-center gap-2 mt-1 border-t border-gray-100 pt-1">
                        <Package size={12} className="text-orange-500"/>
                        <span className="text-xs font-black">Tổng: {c.totalWeight.toFixed(3)} kg</span>
                    </div>
                </div>
              </Tooltip>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      {/* CHÚ THÍCH BẢN ĐỒ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-5 h-5 bg-blue-500 rounded-full shadow-lg shadow-blue-200 border-2 border-white"></div>
              <p className="font-black text-gray-800 uppercase text-xs tracking-widest">Điểm xanh: Khách mua lẻ (Dưới 5kg)</p>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-gray-100 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-5 h-5 bg-red-500 rounded-full shadow-lg shadow-red-200 border-2 border-white animate-pulse"></div>
              <p className="font-black text-gray-800 uppercase text-xs tracking-widest">Điểm đỏ: Khách VIP / Sỉ (Trên 5kg)</p>
          </div>
      </div>
    </div>
  )
}
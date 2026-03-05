'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function NetworkRadar() {
  const [isOnline, setIsOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncCount, setSyncCount] = useState(0);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    // Cập nhật số lượng thao tác đang bị kẹt
    const checkQueue = () => {
      const queue = JSON.parse(localStorage.getItem('dd_offline_queue') || '[]');
      setSyncCount(queue.length);
    };
    checkQueue();

    const handleOffline = () => setIsOnline(false);

    // TỰ ĐỘNG ĐỒNG BỘ KHI CÓ MẠNG
    const handleOnline = async () => {
      setIsOnline(true);
      const queue = JSON.parse(localStorage.getItem('dd_offline_queue') || '[]');

      if (queue.length > 0) {
        setSyncing(true);
        for (let i = 0; i < queue.length; i++) {
          const action = queue[i];
          try {
            await supabase.from(action.table).insert([action.payload]);
          } catch (err) {
            console.error("Lỗi đồng bộ", err);
          }
        }
        // Xong xuôi thì đốt sạch thùng rác
        localStorage.removeItem('dd_offline_queue');
        setSyncCount(0);
        setSyncing(false);
        alert("🎉 Đã đồng bộ toàn bộ dữ liệu Offline!");
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline_action', checkQueue); // Nghe tín hiệu từ Phễu

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline_action', checkQueue);
    };
  }, []);

  if (isOnline && !syncing && syncCount === 0) return null;

  return (
    <div className="fixed top-0 left-0 w-full z-[9999] flex flex-col shadow-lg">
      {!isOnline && (
        <div className="bg-red-600 text-white text-center py-2 font-black text-[10px] md:text-xs">
          🔴 BẠN ĐANG OFFLINE {syncCount > 0 && `| Có ${syncCount} thao tác đang đợi đồng bộ!`}
        </div>
      )}
      {syncing && (
        <div className="bg-blue-600 text-white text-center py-2 font-black text-[10px] md:text-xs">
          🔄 ĐANG CÓ MẠNG LẠI! Đang đẩy {syncCount} thao tác lên Két sắt...
        </div>
      )}
    </div>
  );
}
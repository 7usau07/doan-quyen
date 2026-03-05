import { supabase } from './supabase'

export const db = {
  // Thêm Promise<any> để báo TypeScript: "Tao trả về cái gì kệ tao, cấm gạch đỏ!"
  insert: async (tableName: string, payload: any): Promise<any> => {
    
    // NẾU MẤT MẠNG -> CẤT KÉT PHỤ
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const queue = JSON.parse(localStorage.getItem('dd_offline_queue') || '[]')
      queue.push({ table: tableName, payload: payload, time: Date.now() })
      localStorage.setItem('dd_offline_queue', JSON.stringify(queue))
      
      // Báo động cho Cục Radar trên nóc nhà biết
      window.dispatchEvent(new Event('offline_action'))
      
      // Trả về báo cáo Offline
      return { data: [payload], error: null, isOffline: true }
    } 
    
    // NẾU CÓ MẠNG -> BƠM THẲNG LÊN SUPABASE
    else {
      const res = await supabase.from(tableName).insert([payload]).select()
      // Ép nó luôn trả về isOffline: false để đồng bộ cấu trúc, VS Code hết bắt bẻ
      return { data: res.data, error: res.error, isOffline: false }
    }
  }
}
'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Bot, Send, Brain, Sparkles, AlertTriangle, Lightbulb, Save, Trash2, Mic, ImagePlus, X, Database, TrendingUp, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'

// ĐÃ CHỈNH SANG LẤY TỪ KÉT SẮT .env.local - CẤM SẾP DÁN CHÌA CỨNG VÀO ĐÂY NỮA NHÉ!
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';

const formatAIResponse = (text: string) => {
  if (!text) return '';
  return text
    .replace(/^### (.*$)/gim, '<h3 class="text-lg font-black text-blue-900 mt-4 mb-2 uppercase">$1</h3>') 
    .replace(/^## (.*$)/gim, '<h2 class="text-xl font-black text-blue-900 mt-4 mb-2 uppercase">$1</h2>') 
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-blue-700 font-bold">$1</strong>') 
    .replace(/\*(.*?)\*/g, '<em class="text-gray-700">$1</em>') 
    .replace(/^---/gm, '<hr class="my-4 border-gray-300 border-dashed" />') 
    .replace(/^\*\s+(.*$)/gim, '<div class="ml-2 my-1.5 flex items-start gap-2"><span class="text-blue-500 font-bold mt-0.5">»</span> <span class="flex-1">$1</span></div>') 
    .replace(/^- \s+(.*$)/gim, '<div class="ml-2 my-1.5 flex items-start gap-2"><span class="text-blue-500 font-bold mt-0.5">»</span> <span class="flex-1">$1</span></div>') 
    .replace(/\n/g, '<br/>') 
    .replace(/(<br\/>\s*){3,}/g, '<br/><br/>'); 
};

export default function AIPage() {
  const [messages, setMessages] = useState<{role: string, content: string, image?: string}[]>([
    { role: 'model', content: 'Chào sếp Duy! Động cơ đã được nâng cấp lên Gemini 2.5 Flash Tối Thượng. Mọi lỗi hệ thống đã được dọn sạch. Sếp cần tính toán rủi ro lô yến nào?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [memories, setMemories] = useState<any[]>([]);
  const [newMemory, setNewMemory] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageBase64, setImageBase64] = useState<string>('');
  const [isListening, setIsListening] = useState(false);
  
  const [businessContext, setBusinessContext] = useState<string>('Đang tải dữ liệu Két sắt...');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchAllDataForAI = async () => {
    try {
      const [memRes, invRes, custRes, orderRes] = await Promise.all([
        supabase.from('ai_memory').select('*').order('created_at', { ascending: false }),
        supabase.from('inventory').select('*'), 
        supabase.from('customers').select('*'),
        supabase.from('orders').select('*')
      ]);
      
      if (memRes.data) setMemories(memRes.data);

      let context = `DỮ LIỆU HIỆN TẠI CỦA XƯỞNG ĐOÀN QUYÊN:\n`;
      context += `- Tổng số khách hàng: ${custRes.data?.length || 0} người.\n`;
      context += `- Tổng số đơn hàng: ${orderRes.data?.length || 0} đơn.\n`;
      
      const totalRev = orderRes.data?.reduce((sum, o) => sum + Number(o.revenue || o.tong_tien || 0), 0) || 0;
      const totalProfit = orderRes.data?.reduce((sum, o) => sum + Number(o.profit || o.loi_nhuan || 0), 0) || 0;
      const totalCost = totalRev - totalProfit;

      context += `- Tổng doanh thu: ${totalRev.toLocaleString()} VNĐ.\n`;
      context += `- Tổng giá vốn (chi phí nhập/sản xuất): ${totalCost.toLocaleString()} VNĐ.\n`;
      context += `- Tổng lợi nhuận ròng: ${totalProfit.toLocaleString()} VNĐ.\n`;
      
      // BỘ ĐẾM KÝ TỒN KHO CỰC CHUẨN NHƯ MÀN HÌNH TỔNG QUAN
      const totalInventoryKg = invRes.data?.reduce((sum, item) => sum + Number(item.khoi_luong || item.weight || item.so_luong || item.kg || 0), 0) || 0;
      const totalInventoryItems = invRes.data?.length || 0;
      
      context += `- Tình trạng kho: Đang tồn tổng cộng ${totalInventoryKg.toFixed(3)} kg yến (chi tiết gồm ${totalInventoryItems} lô hàng).\n`;

      setBusinessContext(context);
    } catch (err) {
      setBusinessContext('Không thể móc két Supabase lúc này.');
    }
  }

  useEffect(() => { fetchAllDataForAI() }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleVoiceInput = () => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Trình duyệt không hỗ trợ Voice. Thử xài Chrome nhé!");
    const recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.continuous = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (e: any) => setInput(prev => prev + " " + e.results[0][0].transcript);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImageBase64(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !imageBase64) || loading) return;

    // CHẶN NGAY TỪ CỬA NẾU SERVER CHƯA ĐƯỢC RESET
    if (!API_KEY) {
       setMessages(prev => [...prev, { role: 'model', content: `❌ Sếp chưa Tắt/Mở lại server (npm run dev) sau khi sửa file .env.local!` }]);
       return;
    }

    const userMsg = input.trim();
    const currentImage = imageBase64;
    
    setInput('');
    setImageFile(null);
    setImageBase64('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg, image: currentImage }]);
    setLoading(true);

    try {
      const rules = memories.map(m => `- ${m.note}`).join('\n');
      const systemInstructionText = `Bạn là Giám đốc AI của Yến Sào ĐOÀN QUYÊN. Tư duy: Sắc bén, thực dụng. Cách trình bày: Viết ngắn gọn, cách dòng rõ ràng.\nTHÔNG TIN NỘI BỘ (Chính xác 100% từ Database): ${businessContext}\nQUY TẮC BẮT BUỘC DO SẾP DUY DẶN: ${rules}`;

      const contents = messages.slice(1).map(m => ({
        role: m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.content || 'Ảnh tổ yến sếp Duy vừa gửi' }]
      }));

      const currentParts: any[] = [];
      if (userMsg) currentParts.push({ text: userMsg });
      if (currentImage) {
        currentParts.push({ 
          inlineData: { 
            data: currentImage.split(',')[1], 
            mimeType: currentImage.substring(currentImage.indexOf(':') + 1, currentImage.indexOf(';')) 
          } 
        });
      }
      contents.push({ role: 'user', parts: currentParts });

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstructionText }] },
          contents: contents
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || "Lỗi máy chủ Google");
      }
      
      const botReply = data.candidates[0].content.parts[0].text;
      setMessages(prev => [...prev, { role: 'model', content: botReply }]);
      
    } catch (error: any) {
      console.error("LỖI GỐC TỪ GOOGLE:", error);
      setMessages(prev => [...prev, { role: 'model', content: `❌ Cáp quang bị đứt: ${error.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  const handleSaveMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemory.trim()) return;
    await supabase.from('ai_memory').insert([{ note: newMemory.trim() }]);
    setNewMemory('');
    fetchAllDataForAI();
  }

  return (
    <div className="p-3 md:p-8 max-w-7xl mx-auto flex flex-col lg:flex-row gap-6 h-auto lg:h-[calc(100vh-80px)] pb-24 lg:pb-8">
      
      {/* CỘT TRÁI CHAT */}
      <div className="flex-1 h-[75vh] lg:h-auto bg-white rounded-[30px] shadow-xl border border-gray-200 flex flex-col overflow-hidden relative shrink-0 lg:shrink">
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-4 md:p-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-500/50 animate-pulse"><Brain size={24} /></div>
            <div>
              <h2 className="font-black uppercase tracking-widest text-base md:text-lg text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Giám Đốc AI (God Mode)</h2>
              <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase flex items-center gap-1">
                <Database size={10}/> Đã đồng bộ Két Sắt
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-gray-50/50 custom-scrollbar">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-3 md:gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'model' && <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center shrink-0 text-blue-600 shadow-sm"><Bot size={18}/></div>}
              
              <div className={`flex flex-col gap-2 max-w-[90%] md:max-w-[85%]`}>
                {msg.image && (
                  <img src={msg.image} alt="Yến sào" className="w-48 h-48 object-cover rounded-2xl shadow-md border-2 border-white" />
                )}
                {msg.content && (
                  <div className={`p-4 rounded-3xl text-sm leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white font-medium rounded-tr-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'}`}>
                    <div dangerouslySetInnerHTML={{ __html: msg.role === 'model' ? formatAIResponse(msg.content) : msg.content.replace(/\n/g, '<br/>') }} />
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
             <div className="flex gap-3 items-center text-blue-500 font-bold text-xs uppercase tracking-widest bg-blue-50 w-fit px-4 py-2 rounded-full border border-blue-100">
               <Sparkles size={16} className="animate-spin" /> AI đang đọc Két Sắt...
             </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {imageBase64 && (
          <div className="px-6 py-2 bg-gray-100 border-t border-gray-200 flex items-center gap-4">
            <div className="relative">
               <img src={imageBase64} className="w-16 h-16 object-cover rounded-xl border-2 border-blue-400" />
               <button onClick={() => {setImageBase64(''); setImageFile(null);}} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"><X size={12}/></button>
            </div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Đã đính kèm ảnh</span>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="p-3 md:p-4 bg-white border-t border-gray-200 flex items-end gap-2 shrink-0">
          <label className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-2xl cursor-pointer transition-colors" title="Phân tích ảnh tổ yến">
            <ImagePlus size={22} />
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </label>
          <button type="button" onClick={handleVoiceInput} className={`p-2.5 rounded-2xl transition-colors ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`} title="Bấm để nói">
            <Mic size={22} />
          </button>
          <textarea
            rows={1}
            className="flex-1 bg-gray-100 border-none rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none overflow-hidden max-h-32"
            placeholder={isListening ? "Đang nghe sếp nói..." : "Hỏi tồn kho, ảnh yến..."}
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={loading}
            onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); } }}
          />
          <button disabled={loading || (!input.trim() && !imageBase64)} type="submit" className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-2xl transition-all disabled:opacity-50 disabled:hover:bg-blue-600 shadow-md shadow-blue-500/30">
            <Send size={22} />
          </button>
        </form>
      </div>

      {/* CỘT PHẢI NÃO BỘ & BẢNG GIÁ */}
      <div className="w-full lg:w-96 flex flex-col gap-6 shrink-0 lg:h-full lg:overflow-y-auto custom-scrollbar">
        
        {/* Module Nhắc việc */}
        <div className="bg-emerald-50 text-emerald-900 p-6 rounded-[30px] border-2 border-emerald-200 shadow-sm relative overflow-hidden shrink-0">
           <div className="absolute -right-4 -top-4 text-emerald-200 opacity-50"><Sparkles size={100}/></div>
           <h3 className="text-sm font-black uppercase flex items-center gap-2 mb-2 relative z-10"><AlertTriangle size={18}/> Móc Két Sắt Khảo Sát</h3>
           <p className="text-xs font-bold opacity-80 mb-4 relative z-10">AI đã đọc toàn bộ dữ liệu. Thử bấm 1 câu hỏi để test:</p>
           <button onClick={() => setInput('Dựa vào dữ liệu hệ thống, hãy báo cáo tình hình TỒN KHO BAO NHIÊU KÝ và doanh thu hiện tại cho tôi.')} className="w-full text-left bg-white/60 hover:bg-white px-4 py-3 rounded-2xl text-xs font-bold transition-colors relative z-10 border border-emerald-100 shadow-sm">
             👉 Báo cáo tình hình làm ăn xưởng
           </button>
        </div>

        {/* Module Dạy Luật */}
        <div className="bg-white p-6 rounded-[30px] shadow-sm border border-gray-200 shrink-0">
          <h3 className="text-sm font-black uppercase text-gray-900 flex items-center gap-2 border-b pb-4 mb-4"><Lightbulb size={18} className="text-orange-500"/> Dạy Luật Bán Hàng</h3>
          <form onSubmit={handleSaveMemory} className="flex gap-2 mb-4">
            <input required type="text" placeholder="Gõ quy tắc vào đây..." className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-orange-500 bg-gray-50" value={newMemory} onChange={e => setNewMemory(e.target.value)} />
            <button type="submit" className="bg-gray-900 text-white px-3 rounded-xl hover:bg-black transition-colors"><Save size={16}/></button>
          </form>
          <div className="space-y-2">
            {memories.map(m => (
              <div key={m.id} className="bg-white border border-gray-100 shadow-sm p-3 rounded-2xl flex justify-between items-start gap-2 group">
                <span className="text-[11px] font-bold text-gray-700 flex-1">{m.note}</span>
                <button onClick={async () => { await supabase.from('ai_memory').delete().eq('id', m.id); fetchAllDataForAI(); }} className="text-gray-300 hover:text-red-500 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"><Trash2 size={14}/></button>
              </div>
            ))}
          </div>
        </div>

        {/* BẢNG GIÁ ĐÃ CẬP NHẬT CHUẨN ĐOÀN QUYÊN */}
        <div className="bg-white p-6 rounded-[30px] shadow-sm border border-gray-200 shrink-0">
          <h3 className="text-sm font-black uppercase text-gray-900 flex items-center justify-between border-b pb-4 mb-4">
            <span className="flex items-center gap-2"><TrendingUp size={18} className="text-blue-500"/> Giá Xưởng Báo Giá</span>
            <span className="text-[9px] bg-blue-100 text-blue-600 px-2 py-1 rounded-full">Hôm Nay</span>
          </h3>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center group">
              <div>
                <p className="text-xs font-bold text-gray-800">Yến Xô (Thô)</p>
                <p className="text-[10px] text-gray-400">Hàng xô chưa nhặt</p>
              </div>
              <div className="flex flex-col items-end">
                 <span className="text-sm font-black text-blue-600 flex items-center gap-1">7.0tr - 9.0tr <ArrowUpRight size={14} className="text-red-500"/></span>
              </div>
            </div>

            <div className="flex justify-between items-center group">
              <div>
                <p className="text-xs font-bold text-gray-800">Yến Tinh Chế</p>
                <p className="text-[10px] text-gray-400">Làm sạch chuẩn</p>
              </div>
              <div className="flex flex-col items-end">
                 <span className="text-sm font-black text-blue-600 flex items-center gap-1">10.0tr - 11.5tr <Minus size={14} className="text-gray-400"/></span>
              </div>
            </div>

            <div className="flex justify-between items-center group">
              <div>
                <p className="text-xs font-bold text-gray-800">Yến Rút Lông (Đẹp)</p>
                <p className="text-[10px] text-gray-400">Nguyên tổ giữ form</p>
              </div>
              <div className="flex flex-col items-end">
                 <span className="text-sm font-black text-blue-600 flex items-center gap-1">12.0tr - 13.5tr <ArrowUpRight size={14} className="text-red-500"/></span>
              </div>
            </div>

            <div className="flex justify-between items-center group">
              <div>
                <p className="text-xs font-bold text-gray-800">Yến Vụn / Chân</p>
                <p className="text-[10px] text-gray-400">Hàng dạt, vỡ</p>
              </div>
              <div className="flex flex-col items-end">
                 <span className="text-sm font-black text-blue-600 flex items-center gap-1">4.5tr - 5.5tr <ArrowDownRight size={14} className="text-emerald-500"/></span>
              </div>
            </div>
          </div>

          <button onClick={() => setInput('Dựa vào bảng giá hiện tại (Xô 7-9tr, Đẹp 12-13.5tr), hãy tư vấn cho tôi chiến lược bán hàng để tối ưu lợi nhuận nhất trong tháng này.')} className="w-full mt-6 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-bold py-3 rounded-2xl transition-colors flex items-center justify-center gap-2">
            <Sparkles size={14} /> AI Tư Vấn Chiến Lược Giá
          </button>
        </div>
      </div>

    </div>
  )
}
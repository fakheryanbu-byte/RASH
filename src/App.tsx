/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Pencil, Trash2, X, RefreshCw, Hotel, ClipboardList, CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight, History, Cloud, CloudOff } from 'lucide-react';
import { supabase } from './lib/supabase';

interface Room {
  id: number;
  number: string;
  isSprayed: boolean;
  lastSprayed?: string;
}

interface SpraySession {
  id: number;
  timestamp: string;
  sprayedRooms: string[];
  missedRooms: string[];
}

interface HotelData {
  id: number;
  name: string;
  rooms: Room[];
  history: SpraySession[];
}

export default function App() {
  const [hotels, setHotels] = useState<HotelData[]>([]);
  const [activeHotelId, setActiveHotelId] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [showAddHotel, setShowAddHotel] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [roomInputNumber, setRoomInputNumber] = useState('');
  const [hotelInputName, setHotelInputName] = useState('');
  const [view, setView] = useState<'grid' | 'log'>('grid');

  // Load initial data from local storage as fallback
  useEffect(() => {
    const savedHotels = localStorage.getItem('hotel_spray_all_data');
    const savedActiveId = localStorage.getItem('hotel_spray_active_id');
    
    if (savedHotels) {
      const parsedHotels = JSON.parse(savedHotels);
      setHotels(parsedHotels);
      if (savedActiveId) setActiveHotelId(Number(savedActiveId));
      else if (parsedHotels.length > 0) setActiveHotelId(parsedHotels[0].id);
    } else {
      // Default initial state if nothing in local storage either
      const initialHotel = {
        id: Date.now(),
        name: 'فندق الياسمين',
        rooms: Array.from({ length: 20 }, (_, i) => ({
          id: i + 1,
          number: `${101 + i}`,
          isSprayed: false,
        })),
        history: []
      };
      setHotels([initialHotel]);
      setActiveHotelId(initialHotel.id);
    }
    
    fetchFromSupabase();
  }, []);

  const fetchFromSupabase = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('hotels_data')
        .select('data')
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows found"

      if (data?.data) {
        setHotels(data.data.hotels);
        setActiveHotelId(data.data.activeHotelId || data.data.hotels[0]?.id);
      }
    } catch (err) {
      console.error('Error fetching from Supabase:', err);
    } finally {
      setLoading(false);
    }
  };

  const syncToSupabase = async (currentHotels: HotelData[], currentActiveId: number) => {
    try {
      setSyncing(true);
      const { error } = await supabase
        .from('hotels_data')
        .upsert({ 
          id: 1, // Using fixed ID for now as a single-user app
          data: { hotels: currentHotels, activeHotelId: currentActiveId },
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
    } catch (err) {
      console.error('Error syncing to Supabase:', err);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (hotels.length > 0) {
      localStorage.setItem('hotel_spray_all_data', JSON.stringify(hotels));
      localStorage.setItem('hotel_spray_active_id', activeHotelId.toString());
      
      // Debounce Sync
      const timeout = setTimeout(() => {
        syncToSupabase(hotels, activeHotelId);
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [hotels, activeHotelId]);

  if (loading && hotels.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" dir="rtl">
        <div className="text-center animate-pulse">
          <Hotel className="mx-auto text-indigo-600 mb-4" size={48} />
          <p className="text-slate-500 font-bold">جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  const activeHotel = hotels.find(h => h.id === activeHotelId) || hotels[0];
  if (!activeHotel) return null;

  const rooms = activeHotel.rooms;
  const history = activeHotel.history;

  const updateActiveHotel = (updatedFields: Partial<HotelData>) => {
    setHotels(prev => prev.map(h => 
      h.id === activeHotelId ? { ...h, ...updatedFields } : h
    ));
  };

  const toggleSpray = (roomId: number) => {
    const updatedRooms = rooms.map(room => 
      room.id === roomId ? { ...room, isSprayed: !room.isSprayed } : room
    );
    updateActiveHotel({ rooms: updatedRooms });
  };

  const submitSession = () => {
    const sprayed = rooms.filter(r => r.isSprayed).map(r => r.number);
    const missed = rooms.filter(r => !r.isSprayed).map(r => r.number);
    
    if (sprayed.length === 0) return;

    const newSession: SpraySession = {
      id: Date.now(),
      timestamp: new Date().toLocaleString('ar-EG'),
      sprayedRooms: sprayed,
      missedRooms: missed
    };

    updateActiveHotel({
      history: [newSession, ...history],
      rooms: rooms.map(r => ({ ...r, isSprayed: false }))
    });
    setView('log');
  };

  const addRoom = () => {
    if (!roomInputNumber.trim()) return;
    const newRoom: Room = {
      id: Date.now(),
      number: roomInputNumber,
      isSprayed: false,
    };
    updateActiveHotel({ rooms: [...rooms, newRoom] });
    setRoomInputNumber('');
    setShowAddRoom(false);
  };

  const updateRoomNumber = () => {
    if (!editingRoom || !roomInputNumber.trim()) return;
    const updatedRooms = rooms.map(room => 
      room.id === editingRoom.id ? { ...room, number: roomInputNumber } : room
    );
    updateActiveHotel({ rooms: updatedRooms });
    setEditingRoom(null);
    setRoomInputNumber('');
  };

  const deleteRoom = (id: number) => {
    const updatedRooms = rooms.filter(room => room.id !== id);
    updateActiveHotel({ rooms: updatedRooms });
    setEditingRoom(null);
    setRoomInputNumber('');
  };

  const addHotel = () => {
    if (!hotelInputName.trim()) return;
    const newHotel: HotelData = {
      id: Date.now(),
      name: hotelInputName,
      rooms: [],
      history: []
    };
    setHotels([...hotels, newHotel]);
    setActiveHotelId(newHotel.id);
    setHotelInputName('');
    setShowAddHotel(false);
  };

  const deleteHotel = (id: number) => {
    if (hotels.length <= 1) return;
    const filtered = hotels.filter(h => h.id !== id);
    setHotels(filtered);
    if (activeHotelId === id) {
      setActiveHotelId(filtered[0].id);
    }
  };

  const sprayedCount = rooms.filter(r => r.isSprayed).length;
  const pendingCount = rooms.length - sprayedCount;
  
  const lastSession = history[0];
  const missedPreviously = lastSession?.missedRooms || [];

  const checkCriticallyMissed = (roomNumber: string, sessions: SpraySession[], startIndex: number = 0) => {
    if (sessions.length < startIndex + 2) return false;
    return sessions[startIndex].missedRooms.includes(roomNumber) && 
           sessions[startIndex + 1].missedRooms.includes(roomNumber);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans pb-24" dir="rtl">
      <div className="max-w-md mx-auto min-h-screen flex flex-col p-4">
        
        {/* Header Container */}
        <header className="flex flex-col items-center mb-6 card-container py-5">
          <div className="flex items-center justify-between w-full mb-4 px-2">
            <div className="flex items-center gap-2 overflow-hidden flex-1 ml-4">
              <Hotel className="text-slate-800 shrink-0" size={24} />
              <div className="flex flex-col overflow-hidden">
                <select 
                  value={activeHotelId}
                  onChange={(e) => setActiveHotelId(Number(e.target.value))}
                  className="text-lg font-bold text-slate-800 bg-transparent border-none focus:ring-0 p-0 cursor-pointer w-full text-right"
                >
                  {hotels.map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 font-bold -mt-1">تتبع رش الغرف</span>
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <div className="flex items-center gap-1 ml-2">
                {syncing ? (
                  <Cloud className="text-indigo-400 animate-pulse" size={12} />
                ) : (
                  <Cloud className="text-slate-200" size={12} />
                )}
                <span className="text-[8px] text-slate-300 font-bold uppercase">
                  {syncing ? 'جاري المزامنة' : 'متزامن'}
                </span>
              </div>
              {hotels.length > 1 && (
                <button 
                  onClick={() => deleteHotel(activeHotelId)}
                  className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors"
                  title="حذف الفندق الحالي"
                >
                  <Trash2 size={18} />
                </button>
              )}
              <button 
                onClick={() => setShowAddHotel(true)}
                className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"
                title="إضافة فندق"
              >
                <Plus size={20} />
              </button>
              <button 
                onClick={() => setView(view === 'grid' ? 'log' : 'grid')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  view === 'log' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {view === 'grid' ? <History size={14} /> : <ClipboardList size={14} />}
                {view === 'grid' ? 'السجل' : 'الغرف'}
              </button>
            </div>
          </div>
          
          <div className="flex w-full justify-around items-center border-t border-slate-50 pt-4 mt-2">
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">تم الآن</div>
              <div className="text-xl font-black text-green-600">{sprayedCount}</div>
            </div>
            <div className="w-px h-8 bg-slate-100"></div>
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">متبقي</div>
              <div className="text-xl font-black text-amber-500">{pendingCount}</div>
            </div>
            <div className="w-px h-8 bg-slate-100"></div>
            <button 
              onClick={() => {
                setRoomInputNumber('');
                setShowAddRoom(true);
              }}
              className="p-2 text-emerald-600 hover:text-emerald-700 transition-all bg-emerald-50 rounded-xl border border-emerald-100 flex items-center gap-1 active:scale-95"
              title="إضافة غرفة"
            >
              <Plus size={18} />
              <span className="text-[10px] font-bold">إضافة</span>
            </button>
          </div>
        </header>

        {view === 'grid' ? (
          /* Main Grid View */
          <main className="flex-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-2 gap-3 pb-4">
              {rooms.map((room) => (
                <motion.button
                  key={room.id}
                  layout
                  onClick={() => toggleSpray(room.id)}
                  whileTap={{ scale: 0.95 }}
                  className={`room-card ${room.isSprayed ? 'sprayed' : checkCriticallyMissed(room.number, history) ? 'bg-slate-900 text-white shadow-xl scale-[1.02]' : 'pending'} !min-h-[100px] py-3`}
                >
                  <span className={`text-[10px] font-bold mb-0.5 ${room.isSprayed || checkCriticallyMissed(room.number, history) ? 'opacity-60' : 'opacity-60'}`}>الغرفة</span>
                  <span className="text-2xl font-black tracking-tighter">{room.number}</span>
                  
                  <span className={`mt-2 px-3 py-1 rounded-full text-[9px] font-bold uppercase transition-colors ${
                    room.isSprayed ? 'bg-green-500 text-white shadow-sm shadow-green-100' : 
                    checkCriticallyMissed(room.number, history) ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {room.isSprayed ? 'تم الاختيار' : checkCriticallyMissed(room.number, history) ? 'خطر: تجاوز دورتين' : 'انتظار'}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingRoom(room);
                      setRoomInputNumber(room.number);
                    }}
                    className="absolute top-2 right-2 p-1.5 text-slate-300 hover:text-indigo-500 transition-colors z-10"
                  >
                    <Pencil size={12} />
                  </button>

                  {missedPreviously.includes(room.number) && !room.isSprayed && (
                    <div className="absolute top-1 left-1">
                      <AlertTriangle size={14} className="text-amber-500" />
                    </div>
                  )}
                </motion.button>
              ))}
            </div>

            {/* Warning for missed rooms in previous cycle */}
            {missedPreviously.length > 0 && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-100 rounded-xl flex gap-3 items-start animate-in zoom-in-95">
                <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
                <div>
                  <h4 className="text-xs font-bold text-amber-800 mb-1">تنبيه: غرف فائتة من الدورة السابقة</h4>
                  <p className="text-[10px] text-amber-600 leading-tight">
                    الغرف التالية لم يتم رشها في الزيارة الماضية: <span className="font-bold">{missedPreviously.join('، ')}</span>
                  </p>
                </div>
              </div>
            )}

            {/* Bottom Actions Floating Bar */}
            <div className="fixed bottom-0 left-0 right-0 p-4 max-w-md mx-auto z-40">
              <button
                onClick={submitSession}
                disabled={sprayedCount === 0}
                className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl transition-all active:scale-95 ${
                  sprayedCount > 0 
                  ? 'bg-emerald-600 text-white shadow-emerald-200 cursor-pointer' 
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <CheckCircle2 size={20} />
                تأكيد وبدء رشة جديدة
              </button>
            </div>
          </main>
        ) : (
          /* History/Log View */
          <main className="flex-1 animate-in fade-in slide-in-from-left-2 duration-300">
            <div className="space-y-4">
              {history.length === 0 ? (
                <div className="py-20 text-center space-y-3 opacity-50">
                  <ClipboardList size={48} className="mx-auto text-slate-300" />
                  <p className="text-sm font-medium">لا توجد سجلات بعد</p>
                </div>
              ) : (
                history.map((session, idx) => (
                  <div key={session.id} className="card-container !p-0 overflow-hidden">
                    <div className="bg-slate-50 p-3 flex justify-between items-center border-b border-slate-100">
                      <div>
                        <h3 className="text-xs font-bold text-slate-800">الرشة رقم {history.length - idx}</h3>
                        <p className="text-[10px] text-slate-400 uppercase tracking-tighter">{session.timestamp}</p>
                      </div>
                      <div className="text-[10px] font-bold px-2 py-1 bg-green-100 text-green-700 rounded-md">
                        {session.sprayedRooms.length} غرفة
                      </div>
                    </div>
                    <div className="p-3 space-y-3">
                      <div>
                        <div className="text-[9px] font-bold text-slate-400 mb-1 uppercase tracking-wider">تم الرش:</div>
                        <div className="flex flex-wrap gap-1">
                          {session.sprayedRooms.map(num => (
                            <span key={num} className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                              {num}
                            </span>
                          ))}
                        </div>
                      </div>
                      {session.missedRooms.length > 0 && (
                        <div>
                          <div className="text-[9px] font-bold text-slate-400 mb-1 uppercase tracking-wider">لم يتم رشها (تنبيه):</div>
                          <div className="flex flex-wrap gap-1">
                            {session.missedRooms.map(num => {
                              const isCritical = checkCriticallyMissed(num, history, idx);
                              return (
                                <span 
                                  key={num} 
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                    isCritical 
                                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm' 
                                    : 'bg-rose-50 text-rose-500 border-rose-100'
                                  }`}
                                >
                                  {num}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </main>
        )}

        {/* Footer info (only visible when not in log mode to save space) */}
        {view === 'grid' && (
          <footer className="flex flex-col items-center py-6 border-t border-slate-200 text-slate-400 text-[10px] italic gap-1">
            <p>نظام إدارة الرش اليدوي • {rooms.length} غرفة</p>
            <p>اضغط "تأكيد" لحفظ الجولة وبدء دورة جديدة</p>
          </footer>
        )}
      </div>


      {/* Add/Edit Room Modal */}
      <AnimatePresence>
        {(showAddRoom || editingRoom) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl relative"
            >
              <button 
                onClick={() => {
                  setShowAddRoom(false);
                  setEditingRoom(null);
                }}
                className="absolute top-4 left-4 text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>

              <div className="text-center">
                <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${showAddRoom ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                  {showAddRoom ? <Plus size={24} /> : <Pencil size={24} />}
                </div>
                <h2 className="text-lg font-bold text-slate-800 mb-1">
                  {showAddRoom ? 'إضافة غرفة جديدة' : 'تعديل رقم الغرفة'}
                </h2>
                <p className="text-slate-500 text-[11px] mb-6">
                  {showAddRoom ? 'أدخل رقم الغرفة التي ترغب في إضافتها للقائمة.' : 'تغيير المسمى لرقم الغرفة الحالي.'}
                </p>
                
                <div className="space-y-4 text-right">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 mr-1 mb-1 block">رقم الغرفة</label>
                    <input 
                      type="text" 
                      value={roomInputNumber}
                      onChange={(e) => setRoomInputNumber(e.target.value)}
                      placeholder="مثال: 305"
                      autoFocus
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-center font-black text-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          showAddRoom ? addRoom() : updateRoomNumber();
                        }
                      }}
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    {editingRoom && (
                      <button
                        onClick={() => deleteRoom(editingRoom.id)}
                        className="p-3 rounded-xl font-bold bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors"
                        title="حذف الغرفة"
                      >
                        <Trash2 size={20} />
                      </button>
                    )}
                    <button
                      onClick={showAddRoom ? addRoom : updateRoomNumber}
                      className={`flex-1 py-3 rounded-xl font-bold text-white transition-all active:scale-[0.98] ${
                        showAddRoom ? 'bg-emerald-600 shadow-emerald-100' : 'bg-indigo-600 shadow-indigo-100'
                      } shadow-lg`}
                    >
                      {showAddRoom ? 'إضافة الغرفة' : 'حفظ التعديلات'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Add Hotel Modal */}
      <AnimatePresence>
        {showAddHotel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl relative"
            >
              <button 
                onClick={() => setShowAddHotel(false)}
                className="absolute top-4 left-4 text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>

              <div className="text-center">
                <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 bg-indigo-50 text-indigo-600">
                  <Hotel size={24} />
                </div>
                <h2 className="text-lg font-bold text-slate-800 mb-1">إضافة فندق جديد</h2>
                <p className="text-slate-500 text-[11px] mb-6">أدخل اسم الفندق لإنشاء قائمة تتبع خاصة به.</p>
                
                <div className="space-y-4 text-right">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 mr-1 mb-1 block">اسم الفندق</label>
                    <input 
                      type="text" 
                      value={hotelInputName}
                      onChange={(e) => setHotelInputName(e.target.value)}
                      placeholder="مثال: فندق هيلتون"
                      autoFocus
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-center font-bold text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') addHotel();
                      }}
                    />
                  </div>
                  
                  <button
                    onClick={addHotel}
                    className="w-full py-3 rounded-xl font-bold text-white bg-indigo-600 shadow-lg shadow-indigo-100 transition-all active:scale-[0.98]"
                  >
                    إنشاء الفندق
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

'use client';

import { Bell, Settings, Search } from 'lucide-react';

export function AdminTopbar({ title = "SIKESEK Admin" }: { title?: string }) {
  return (
    <header className="h-20 border-b bg-white flex items-center justify-between px-8 sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-bold text-[#0a4226]">{title}</h2>
      </div>

      <div className="flex-1 max-w-xl mx-8">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search..." 
            className="w-full bg-slate-100 border-none rounded-full py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-[#0a4226] outline-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="w-10 h-10 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors">
          <Bell className="w-5 h-5" />
        </button>
        <button className="w-10 h-10 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors">
          <Settings className="w-5 h-5" />
        </button>
        <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden border-2 border-white shadow-sm ml-2">
          <img src="https://i.pravatar.cc/150?img=11" alt="Admin" className="w-full h-full object-cover" />
        </div>
      </div>
    </header>
  );
}

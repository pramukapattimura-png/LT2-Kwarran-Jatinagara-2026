import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import { APP_LOGO_URL } from './constants';

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-brown-50/30 font-sans text-brown-900">
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/admin" element={<AdminDashboard />} />
          </Routes>
        </main>
        <footer className="bg-brown-900 text-brown-300 py-8 sm:py-16 mt-20">
          <div className="max-w-7xl mx-auto px-4 space-y-8 sm:space-y-12">
            <div className="flex flex-row items-center justify-between gap-2 sm:gap-12">
              {/* Logo & Title */}
              <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 flex-1">
                <div className="h-10 w-10 sm:h-20 sm:w-20 rounded-xl sm:rounded-2xl bg-white p-1 sm:p-2 shadow-xl shrink-0">
                  <img 
                    src={APP_LOGO_URL} 
                    alt="Logo LT2 Jatinagara" 
                    className="h-full w-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="font-black text-[10px] sm:text-2xl lg:text-3xl text-white tracking-tighter sm:tracking-widest uppercase text-center sm:text-left leading-none">
                  LT2 <span className="text-brown-500">JATINAGARA</span>
                </div>
              </div>

              {/* Description */}
              <div className="flex-1 hidden sm:flex flex-col items-center text-center px-4">
                <p className="text-[10px] sm:text-sm opacity-70 leading-tight sm:leading-relaxed max-w-sm font-medium">
                  Sistem Informasi Nilai & Rekapitulasi Lomba Tingkat 2<br className="hidden sm:block" />
                  <span className="text-brown-400 font-bold">Kwarran Jatinagara</span>
                </p>
              </div>

              {/* Social/Contact or Extra Info */}
              <div className="flex flex-col items-center sm:items-end text-center sm:text-right space-y-1 sm:space-y-2 flex-1">
                <div className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest sm:tracking-[0.3em] text-brown-600">Official</div>
                <div className="h-0.5 w-8 sm:h-1 sm:w-12 bg-brown-600 rounded-full"></div>
                <p className="text-[8px] sm:text-[10px] font-bold text-brown-400 uppercase tracking-tighter sm:tracking-widest whitespace-nowrap">Scout Competition 2026</p>
              </div>
            </div>

            <div className="pt-8 sm:pt-12 border-t border-brown-800 text-center text-[8px] sm:text-[10px] uppercase tracking-[0.2em] sm:tracking-[0.3em] opacity-40">
              © 2026 Panitia LT2 Kwarran Jatinagara. All rights reserved.
            </div>
          </div>
        </footer>
      </div>
    </Router>
  );
}

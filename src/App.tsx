import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import { APP_LOGO_URL } from './constants';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <div className="min-h-screen flex flex-col bg-white font-sans text-black relative">
          <Navbar />
          <main className="flex-grow">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/admin" element={<AdminDashboard />} />
            </Routes>
          </main>
          <footer className="bg-black text-white py-8 sm:py-12 mt-auto border-t border-gray-800">
            <div className="max-w-7xl mx-auto px-4 space-y-8 sm:space-y-12">
              {/* Maps Section */}
              <div className="w-full space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-1 w-8 bg-emerald-500 rounded-full"></div>
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Lokasi Kegiatan</h4>
                </div>
                <div className="w-full h-64 sm:h-80 rounded-3xl overflow-hidden border border-gray-800 bg-gray-900 shadow-2xl relative group">
                  <iframe
                    src="https://maps.google.com/maps?q=-7.1754470,108.3879570&t=k&z=17&ie=UTF8&iwloc=&output=embed"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Lokasi Kwarran Jatinagara"
                    className="contrast-125 opacity-90 group-hover:opacity-100 transition-all duration-700"
                  ></iframe>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-8">
                {/* Logo & Title */}
                <div className="flex flex-row items-center gap-3 sm:gap-4 flex-1">
                  <div className="h-8 w-8 sm:h-12 sm:w-12 rounded-md bg-white p-1 shadow-lg shrink-0">
                    <img 
                      src={APP_LOGO_URL} 
                      alt="Logo LT2 Jatinagara" 
                      className="h-full w-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="font-black text-xs sm:text-xl text-white tracking-tighter uppercase leading-none">
                    LT2 <span className="text-gray-400">JATINAGARA</span>
                  </div>
                </div>

                {/* Description */}
                <div className="flex-1 hidden md:flex flex-col items-center text-center px-4">
                  <p className="text-[10px] sm:text-xs opacity-70 leading-relaxed font-medium">
                    Sistem Informasi Nilai & Rekapitulasi Lomba Tingkat 2<br className="hidden sm:block" />
                    <span className="text-gray-400 font-bold">Kwarran Jatinagara</span>
                  </p>
                </div>

                {/* Social/Contact or Extra Info */}
                <div className="flex flex-col items-center sm:items-end text-center sm:text-right flex-1">
                  <div className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-gray-500">Official</div>
                  <p className="text-[8px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-tighter whitespace-nowrap">Scout Competition 2026</p>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-800 text-center text-[8px] sm:text-[10px] uppercase tracking-[0.1em] opacity-60 flex flex-col sm:flex-row justify-center items-center gap-2 sm:gap-4">
                <span>© 2026 Panitia LT2 Kwarran Jatinagara</span>
                <span className="hidden sm:block opacity-30">|</span>
                <span className="text-gray-400 font-bold">Penyusun Web: Muhammad Imam Syafi'i</span>
              </div>
            </div>
          </footer>
        </div>
      </Router>
    </ErrorBoundary>
  );
}

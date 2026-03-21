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
        <div className="min-h-screen flex flex-col bg-brown-50/30 font-sans text-brown-900 relative">
          <Navbar />
          <main className="flex-grow">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/admin" element={<AdminDashboard />} />
            </Routes>
          </main>
          <footer className="bg-brown-900 text-brown-300 py-1 sm:py-2 mt-auto sticky bottom-0 z-50 border-t border-brown-800/50 backdrop-blur-sm bg-brown-900/95">
            <div className="max-w-7xl mx-auto px-4 space-y-1 sm:space-y-2">
              <div className="flex flex-row items-center justify-between gap-2 sm:gap-8">
                {/* Logo & Title */}
                <div className="flex flex-row items-center gap-2 sm:gap-3 flex-1">
                  <div className="h-6 w-6 sm:h-10 sm:w-10 rounded-md bg-white p-0.5 shadow-lg shrink-0">
                    <img 
                      src={APP_LOGO_URL} 
                      alt="Logo LT2 Jatinagara" 
                      className="h-full w-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="font-black text-[7px] sm:text-base text-white tracking-tighter uppercase leading-none">
                    LT2 <span className="text-brown-500">JATINAGARA</span>
                  </div>
                </div>

                {/* Description */}
                <div className="flex-1 hidden md:flex flex-col items-center text-center px-4">
                  <p className="text-[7px] sm:text-[10px] opacity-70 leading-none font-medium">
                    Sistem Informasi Nilai & Rekapitulasi Lomba Tingkat 2<br className="hidden sm:block" />
                    <span className="text-brown-400 font-bold">Kwarran Jatinagara</span>
                  </p>
                </div>

                {/* Social/Contact or Extra Info */}
                <div className="flex flex-col items-center sm:items-end text-center sm:text-right flex-1">
                  <div className="text-[5px] sm:text-[7px] font-black uppercase tracking-widest text-brown-600">Official</div>
                  <p className="text-[5px] sm:text-[7px] font-bold text-brown-400 uppercase tracking-tighter whitespace-nowrap">Scout Competition 2026</p>
                </div>
              </div>

              <div className="pt-1 border-t border-brown-800 text-center text-[5px] sm:text-[7px] uppercase tracking-[0.1em] opacity-60 flex flex-col sm:flex-row justify-center items-center gap-1 sm:gap-3">
                <span>© 2026 Panitia LT2 Kwarran Jatinagara</span>
                <span className="hidden sm:block opacity-30">|</span>
                <span className="text-brown-400 font-bold">Penyusun Web: Muhammad Imam Syafi'i</span>
              </div>
            </div>
          </footer>
        </div>
      </Router>
    </ErrorBoundary>
  );
}

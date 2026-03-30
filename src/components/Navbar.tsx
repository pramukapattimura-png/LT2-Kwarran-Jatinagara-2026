import { Link } from 'react-router-dom';
import { LogIn, LayoutDashboard, LogOut, MoreVertical } from 'lucide-react';
import { auth, signOut, db, doc, onSnapshot } from '../firebase';
import { useEffect, useState, useRef, useMemo } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { APP_LOGO_URL } from '../constants';

interface AppConfig {
  adminEmails?: string[];
}

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, 'settings', 'global'), (s) => {
      if (s.exists()) {
        setConfig(s.data() as AppConfig);
      }
    });
    return () => unsubConfig();
  }, []);

  const isAdmin = useMemo(() => {
    if (!user) return false;
    if (user.email === 'pramukapattimura@gmail.com') return true;
    if (!config || !config.adminEmails) return false;
    return config.adminEmails.includes(user.email || '');
  }, [user, config]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <nav className="bg-black border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 sm:h-20 items-center">
          <Link to="/" className="flex items-center gap-2 sm:gap-3 group">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl overflow-hidden shadow-lg shadow-gray-200 group-hover:scale-110 transition-transform duration-300 flex items-center justify-center bg-white">
              <img 
                src={APP_LOGO_URL} 
                alt="Logo LT2 Jatinagara" 
                className="h-full w-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-lg sm:text-2xl font-black text-white tracking-tighter leading-none">
                LT2 <span className="text-gray-400">Jatinagara</span>
              </span>
              <span className="text-[8px] sm:text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mt-0.5">
                {" 28 s.d 30 Juli 2026 "}
              </span>
            </div>
          </Link>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <Link to="/" className="text-xs sm:text-sm font-bold text-gray-300 hover:text-white px-2 sm:px-3 py-2 transition-colors">Scoreboard</Link>
            {user ? (
              <>
                {isAdmin && (
                  <Link 
                    to="/admin" 
                    className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl bg-gray-800 text-white hover:bg-gray-700 transition-all text-xs sm:text-sm font-bold border border-gray-700"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    <span className="hidden xs:inline">Admin</span>
                  </Link>
                )}
                <button 
                  onClick={handleLogout}
                  className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-red-50 text-red-600 hover:bg-red-100 transition-all border border-red-100"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
              </>
            ) : (
              <div className="relative" ref={menuRef}>
                <button 
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl hover:bg-gray-800 text-white transition-all border border-transparent hover:border-gray-700"
                  title="Menu"
                >
                  <MoreVertical className="h-5 w-5" />
                </button>
                {showMenu && (
                  <div className="absolute right-0 mt-2 w-32 bg-black rounded-xl shadow-xl border border-gray-800 py-1 z-50 animate-in fade-in zoom-in-95 duration-200">
                    <Link 
                      to="/login" 
                      onClick={() => setShowMenu(false)}
                      className="flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold text-white hover:bg-gray-800 transition-all"
                    >
                      <LogIn className="h-4 w-4" />
                      <span>Login</span>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

import { useState, useEffect } from 'react';
import { auth, googleProvider, signInWithPopup, signInWithRedirect, getRedirectResult, db, doc, getDoc } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Info } from 'lucide-react';
import { APP_LOGO_URL } from '../constants';

export default function Login() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          await handleUserResult(result.user);
        }
      } catch (err) {
        console.error('Redirect result error:', err);
      } finally {
        setLoading(false);
      }
    };
    checkRedirect();
  }, []);

  const handleUserResult = async (user: any) => {
    try {
      // Check main admin
      if (user.email === 'pramukapattimura@gmail.com') {
        navigate('/admin');
        return;
      }

      // Check other admins from Firestore
      const configDoc = await getDoc(doc(db, 'settings', 'global'));
      if (configDoc.exists()) {
        const data = configDoc.data();
        const adminEmails = data.adminEmails || [];
        if (adminEmails.includes(user.email)) {
          navigate('/admin');
          return;
        }
      }

      setError('Maaf, email Anda tidak terdaftar sebagai admin.');
      await auth.signOut();
    } catch (err) {
      console.error('Error checking admin status:', err);
      setError('Gagal memverifikasi status admin. Silakan coba lagi.');
      await auth.signOut();
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      // Try popup first
      const result = await signInWithPopup(auth, googleProvider);
      handleUserResult(result.user);
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code === 'auth/popup-blocked') {
        setError('Popup diblokir oleh browser. Silakan izinkan popup atau coba lagi.');
      } else if (err.code === 'auth/unauthorized-domain') {
        setError('Domain ini belum terdaftar di Firebase Console. Silakan tambahkan domain ini ke Authorized Domains.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Koneksi internet bermasalah. Silakan coba lagi.');
      } else {
        setError('Gagal login. Silakan coba lagi atau buka di tab baru.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRedirectLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (err: any) {
      console.error('Redirect error:', err);
      setError('Gagal mengalihkan ke Google. Silakan coba lagi.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[90vh] flex items-center justify-center px-4 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-gray-200/20 rounded-full blur-[100px] -z-10 animate-pulse"></div>
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-gray-300/20 rounded-full blur-[100px] -z-10 animate-pulse delay-1000"></div>

      <div className="max-w-md w-full bg-white/80 backdrop-blur-xl rounded-[3rem] shadow-2xl shadow-gray-200/50 border border-gray-100 p-8 sm:p-12 space-y-8 relative">
        <div className="text-center space-y-4">
          <div className="mx-auto h-20 w-20 sm:h-24 sm:w-24 bg-white rounded-[2rem] flex items-center justify-center p-3 shadow-xl shadow-gray-200 rotate-3 overflow-hidden">
            <img 
              src={APP_LOGO_URL} 
              alt="Logo LT2 Jatinagara" 
              className="h-full w-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl sm:text-4xl font-black text-black uppercase tracking-tighter leading-none">Admin <span className="text-gray-500">Access</span></h2>
            <p className="text-[10px] sm:text-xs text-gray-400 font-black uppercase tracking-[0.2em]">LT2 Jatinagara Panel</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 sm:px-5 sm:py-4 rounded-2xl flex items-center gap-3 sm:gap-4 text-[10px] sm:text-xs font-black uppercase tracking-wider animate-in shake duration-500">
            <ShieldAlert className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-4 bg-white border-2 border-gray-100 py-4 sm:py-5 rounded-2xl font-black text-black uppercase tracking-widest text-[10px] sm:text-xs hover:bg-gray-50 hover:border-gray-300 hover:scale-[1.02] transition-all disabled:opacity-50 shadow-sm group"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="h-5 w-5 group-hover:rotate-12 transition-transform" />
            {loading ? 'Processing...' : 'Sign in with Google'}
          </button>

          <button
            onClick={handleRedirectLogin}
            disabled={loading}
            className="w-full py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            Gunakan Metode Redirect (Mobile)
          </button>

          <div className="pt-4 border-t border-gray-100 space-y-4">
            <p className="text-center text-[9px] sm:text-[10px] text-gray-400 font-bold uppercase tracking-[0.15em] leading-relaxed">
              Akses terbatas hanya untuk panitia yang telah terdaftar dalam sistem.
            </p>

            <div className="bg-gray-50 p-4 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-gray-600">
                <Info className="h-3 w-3" />
                <span className="text-[9px] font-black uppercase tracking-wider">Bantuan Login Mobile</span>
              </div>
              <ul className="text-[8px] text-gray-500 font-bold uppercase tracking-tight space-y-1 list-disc pl-4">
                <li>Pastikan browser mengizinkan popup</li>
                <li>Gunakan browser Chrome atau Safari versi terbaru</li>
                <li>Jika gagal, coba buka aplikasi di tab baru</li>
                <li>Pastikan domain ini sudah terdaftar di Firebase Console</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

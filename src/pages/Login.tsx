import { useState } from 'react';
import { auth, googleProvider, signInWithPopup } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { APP_LOGO_URL } from '../constants';

export default function Login() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user.email === 'pramukapattimura@gmail.com') {
        navigate('/admin');
      } else {
        setError('Maaf, email Anda tidak terdaftar sebagai admin.');
        await auth.signOut();
      }
    } catch (err) {
      setError('Gagal login. Silakan coba lagi.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[90vh] flex items-center justify-center px-4 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-brown-200/20 rounded-full blur-[100px] -z-10 animate-pulse"></div>
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-brown-300/20 rounded-full blur-[100px] -z-10 animate-pulse delay-1000"></div>

      <div className="max-w-md w-full bg-white/80 backdrop-blur-xl rounded-[3rem] shadow-2xl shadow-brown-200/50 border border-brown-100 p-10 sm:p-12 space-y-10 relative">
        <div className="text-center space-y-4">
          <div className="mx-auto h-24 w-24 bg-white rounded-[2rem] flex items-center justify-center p-3 shadow-xl shadow-brown-200 rotate-3 overflow-hidden">
            <img 
              src={APP_LOGO_URL} 
              alt="Logo LT2 Jatinagara" 
              className="h-full w-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="space-y-2">
            <h2 className="text-4xl font-black text-brown-900 uppercase tracking-tighter">Admin <span className="text-brown-500">Access</span></h2>
            <p className="text-sm text-brown-400 font-black uppercase tracking-[0.2em]">LT2 Jatinagara Panel</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 px-5 py-4 rounded-2xl flex items-center gap-4 text-xs font-black uppercase tracking-wider animate-in shake duration-500">
            <ShieldAlert className="h-5 w-5 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-6">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-4 bg-white border-2 border-brown-100 py-4 rounded-2xl font-black text-brown-900 uppercase tracking-widest text-xs hover:bg-brown-50 hover:border-brown-300 hover:scale-[1.02] transition-all disabled:opacity-50 shadow-sm group"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="h-5 w-5 group-hover:rotate-12 transition-transform" />
            Sign in with Google
          </button>

          <div className="pt-4 border-t border-brown-50">
            <p className="text-center text-[10px] text-brown-400 font-bold uppercase tracking-[0.15em] leading-relaxed">
              Akses terbatas hanya untuk panitia yang telah terdaftar dalam sistem.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { db, collection, addDoc, setDoc, doc, onSnapshot, query, orderBy, auth, serverTimestamp, deleteDoc } from '../firebase';
import { Regu, Lomba, Nilai, Kategori, Berita } from '../types';
import { useNavigate } from 'react-router-dom';
import { Plus, Save, Users, Trophy, ClipboardList, AlertCircle, Download, Upload, FileSpreadsheet, Lock, Unlock, Newspaper, Trash2, Settings, Play } from 'lucide-react';
import { cn } from '../lib/utils';
import * as XLSX from 'xlsx';
import { AppConfig } from '../types';
import ConfirmModal from '../components/ConfirmModal';

export default function AdminDashboard() {
  const [regus, setRegus] = useState<Regu[]>([]);
  const [lombas, setLombas] = useState<Lomba[]>([]);
  const [nilais, setNilais] = useState<Nilai[]>([]);
  const [berita, setBerita] = useState<Berita[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [activeTab, setActiveTab] = useState<'regu' | 'lomba' | 'nilai' | 'berita' | 'settings'>('nilai');
  const [selectedKategori, setSelectedKategori] = useState<Kategori>('SD Putra');
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // News Form State
  const [newsTitle, setNewsTitle] = useState('');
  const [newsContent, setNewsContent] = useState('');
  const [newsMediaUrl, setNewsMediaUrl] = useState('');
  const [newsMediaType, setNewsMediaType] = useState<'image' | 'video'>('image');
  const [marqueeText, setMarqueeText] = useState('');
  const [aboutContent, setAboutContent] = useState('');
  const [aboutImage, setAboutImage] = useState('');
  const [adminEmails, setAdminEmails] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(user => {
      if (!user) {
        navigate('/login');
        return;
      }
      
      // We'll check admin status once config is loaded
    });
    return () => unsub();
  }, [navigate]);

  useEffect(() => {
    const unsubRegu = onSnapshot(collection(db, 'regu'), (s) => setRegus(s.docs.map(d => ({ id: d.id, ...d.data() } as Regu))));
    const unsubLomba = onSnapshot(query(collection(db, 'lomba'), orderBy('hari', 'asc')), (s) => setLombas(s.docs.map(d => ({ id: d.id, ...d.data() } as Lomba))));
    const unsubNilai = onSnapshot(collection(db, 'nilai'), (s) => setNilais(s.docs.map(d => ({ id: d.id, ...d.data() } as Nilai))));
    const unsubBerita = onSnapshot(query(collection(db, 'berita'), orderBy('timestamp', 'desc')), (s) => setBerita(s.docs.map(d => ({ id: d.id, ...d.data() } as Berita))));
    const unsubConfig = onSnapshot(doc(db, 'settings', 'global'), (s) => {
      if (s.exists()) {
        const data = s.data() as AppConfig;
        setConfig({ id: s.id, ...data } as AppConfig);
        setMarqueeText(data.marqueeText || '');
        setAboutContent(data.aboutContent || '');
        setAboutImage(data.aboutImage || '');
        setAdminEmails(data.adminEmails?.join(', ') || '');

        // Check if current user is admin
        const currentUser = auth.currentUser;
        if (currentUser) {
          const isAdmin = currentUser.email === 'pramukapattimura@gmail.com' || data.adminEmails?.includes(currentUser.email || '');
          if (!isAdmin) navigate('/');
        }
      } else {
        // Initial config
        const initialConfig: Partial<AppConfig> = {
          isLocked: false,
          lockedCategories: {
            'SD Putra': false,
            'SD Putri': false,
            'SMP Putra': false,
            'SMP Putri': false
          },
          marqueeText: 'Selamat Datang di Portal Hasil LT2 Jatinagara - Junjung Tinggi Sportivitas!',
          aboutImage: 'https://i.imgur.com/bOD7Igj.png',
          aboutContent: `Assalamu'alaiakum Wr Wb
Salam Pramuka
Kakak - Kakak pembina pramuka semua dan seluruh pramuka di kwarran jatinagara dan yang berada diseluruh indonesia, kwarran Jatinagara Kwarcab Ciamis pada tahun 2026 ini akan menyelenggarakan LT2 lomba tingkat 2 pramuka penggalang. platform ini kami sediakan untuk memberikan akses informasi secara transparan mulai dari persiapan sampai pasca kegiatan. untuk itu silahkan kakak kakak update untuk mendapatkan informasi dan bersilaturahmi dengan sesama pramuka yang berada di kwarcab ciamis.

kami menyadari pasti ada kekurangan yang perlu dibenahi agar kegiatan LT2 ini dapat mendekati sempurna, kritik dan saran kami harapkan agar menjadi bahan berbenah bagi kami dari pramuka kwarran jatinagara, pramuka ciamis atau pramuka diseluruh indonesia.

H. dadi Supriadi, S.Pd, SD
Ketua Kwarran Jatinagara`
        };
        setDoc(doc(db, 'settings', 'global'), initialConfig);
      }
    });
    return () => { unsubRegu(); unsubLomba(); unsubNilai(); unsubBerita(); unsubConfig(); };
  }, []);

  const isCurrentCategoryLocked = config?.lockedCategories?.[selectedKategori] || false;

  const toggleLock = async () => {
    if (!config) return;
    const newLocked = !isCurrentCategoryLocked;
    await setDoc(doc(db, 'settings', 'global'), {
      ...config,
      lockedCategories: {
        ...config.lockedCategories,
        [selectedKategori]: newLocked
      }
    }, { merge: true });
  };

  const filteredRegus = regus.filter(r => r.kategori === selectedKategori);
  const filteredLombas = lombas.filter(l => l.kategori === selectedKategori);
  const filteredNilais = nilais.filter(n => {
    const regu = regus.find(r => r.id === n.reguId);
    return regu?.kategori === selectedKategori;
  });

  const downloadTemplate = (type: 'regu' | 'lomba' | 'nilai') => {
    let data: any[] = [];
    let filename = '';

    if (type === 'regu') {
      data = [{
        'NO': 1,
        'Nama Regu': '',
        'Pangkalan': '',
        'Nomor Tenda': '',
        'Nama Pinru': '',
        'Nama Wapinru': '',
        'Nama Anggota 1': '',
        'Nama Anggota 2': '',
        'Nama Anggota 3': '',
        'Nama Anggota 4': '',
        'Nama Anggota 5': '',
        'Nama Anggota 6': '',
        'Kategori': selectedKategori
      }];
      filename = `Template_Data_Regu_${selectedKategori.replace(' ', '_')}.xlsx`;
    } else if (type === 'lomba') {
      data = [{
        'No': 1,
        'Bidang Lomba': '',
        'nama Lomba': '',
        'Penilaian 1': 0,
        'Penilaian 2': 0,
        'Penilaian 3': 0,
        'Penilaian 4': 0,
        'Hari': 1,
        'Kategori': selectedKategori
      }];
      filename = `Template_Data_Lomba_${selectedKategori.replace(' ', '_')}.xlsx`;
    } else if (type === 'nilai') {
      if (filteredRegus.length === 0) {
        alert('Mohon isi data regu terlebih dahulu untuk kategori ini.');
        return;
      }
      
      data = filteredRegus.map((r, i) => ({
        'No': i + 1,
        'Nama Regu': r.nama,
        'Nomor Tenda': r.nomorTenda || '',
        'Bidang Lomba': '',
        'nama Lomba': '',
        'Penilaian 1': 0,
        'Penilaian 2': 0,
        'Penilaian 3': 0,
        'Penilaian 4': 0,
        'Rata-Rata Nilai': 0
      }));
      filename = `Template_Input_Nilai_${selectedKategori.replace(' ', '_')}.xlsx`;
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, filename);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isCurrentCategoryLocked) {
      alert('Data untuk kategori ini sedang dikunci. Silakan buka kunci terlebih dahulu.');
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);

      if (activeTab === 'regu') {
        for (const row of data as any[]) {
          await addDoc(collection(db, 'regu'), {
            nama: row['Nama Regu'] || '',
            pangkalan: row['Pangkalan'] || '',
            nomorTenda: row['Nomor Tenda'] || '',
            pinru: row['Nama Pinru'] || '',
            wapinru: row['Nama Wapinru'] || '',
            kategori: row['Kategori'] || selectedKategori,
            anggota: [
              row['Nama Anggota 1'], row['Nama Anggota 2'], row['Nama Anggota 3'],
              row['Nama Anggota 4'], row['Nama Anggota 5'], row['Nama Anggota 6']
            ].filter(Boolean)
          });
        }
      } else if (activeTab === 'lomba') {
        for (const row of data as any[]) {
          await addDoc(collection(db, 'lomba'), {
            nama: row['nama Lomba'] || row['Jenis Lomba'] || '',
            bidangLomba: row['Bidang Lomba'] || '',
            hari: Number(row['Hari']) || 1,
            kategori: row['Kategori'] || selectedKategori
          });
        }
      } else if (activeTab === 'nilai') {
        for (const row of data as any[]) {
          const regu = regus.find(r => r.nama === row['Nama Regu'] && r.nomorTenda === row['Nomor Tenda'] && r.kategori === selectedKategori);
          const lomba = lombas.find(l => (l.nama === row['nama Lomba'] || l.nama === row['Jenis Lomba']) && l.kategori === selectedKategori);
          
          if (regu && lomba) {
            const id = `${regu.id}_${lomba.id}`;
            await setDoc(doc(db, 'nilai', id), {
              reguId: regu.id,
              lombaId: lomba.id,
              p1: Number(row['Penilaian 1']) || 0,
              p2: Number(row['Penilaian 2']) || 0,
              p3: Number(row['Penilaian 3']) || 0,
              p4: Number(row['Penilaian 4']) || 0,
              score: Number(row['Rata-Rata Nilai']) || 0
            });
          }
        }
      }
      alert('Import Berhasil!');
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const handleUpdateMarquee = async () => {
    const emailList = adminEmails.split(',').map(e => e.trim()).filter(Boolean);
    await setDoc(doc(db, 'settings', 'global'), { 
      marqueeText,
      aboutContent,
      aboutImage,
      adminEmails: emailList
    }, { merge: true });
    alert('Settings updated!');
  };

  const handleAddNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    
    await addDoc(collection(db, 'berita'), {
      title: newsTitle,
      content: newsContent,
      mediaUrl: newsMediaUrl,
      mediaType: newsMediaType,
      timestamp: serverTimestamp(),
      authorId: auth.currentUser.uid,
      authorName: auth.currentUser.displayName || 'Admin',
      authorEmail: auth.currentUser.email || '',
      authorPhoto: auth.currentUser.photoURL || '',
      likes: []
    });
    setNewsTitle('');
    setNewsContent('');
    setNewsMediaUrl('');
    setNewsMediaType('image');
    alert('Berita berhasil diposting!');
  };

  const handleDeleteNews = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'berita', id));
      // Update state manually for immediate feedback
      setBerita(prev => prev.filter(news => news.id !== id));
      // alert('Berita berhasil dihapus!');
    } catch (error) {
      console.error('Error deleting news:', error);
      alert('Gagal menghapus berita. Pastikan Anda memiliki izin.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16 space-y-10 sm:space-y-20">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 border-b border-brown-100 pb-10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brown-50 text-brown-600 text-[10px] font-black uppercase tracking-[0.2em] border border-brown-100">
            Admin Control Panel
          </div>
          <h1 className="text-4xl sm:text-6xl font-black text-brown-900 uppercase tracking-tighter leading-[0.85]">
            Dashboard <br className="hidden sm:block" /> <span className="text-brown-500">Panitia</span>
          </h1>
          <p className="text-sm sm:text-lg text-brown-600 font-medium max-w-md leading-relaxed">
            Pusat kendali rekapitulasi nilai, manajemen regu, dan pengaturan mata lomba LT2 Jatinagara.
          </p>
        </div>
        
        <div className="w-full lg:w-auto">
          <div className="flex bg-brown-50 p-1.5 rounded-[2rem] border border-brown-100 shadow-inner w-full sm:w-max overflow-x-auto custom-scrollbar">
            {(['nilai', 'regu', 'lomba', 'berita', 'settings'] as const).map((tab) => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex-1 sm:flex-none px-6 py-3.5 rounded-[1.5rem] text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap", 
                  activeTab === tab 
                    ? "bg-white text-brown-900 shadow-xl shadow-brown-200/50 scale-[1.02]" 
                    : "text-brown-400 hover:text-brown-600 hover:bg-white/50"
                )}
              >
                {tab === 'nilai' && <ClipboardList className="h-4 w-4" />}
                {tab === 'regu' && <Users className="h-4 w-4" />}
                {tab === 'lomba' && <Trophy className="h-4 w-4" />}
                {tab === 'berita' && <Newspaper className="h-4 w-4" />}
                {tab === 'settings' && <Settings className="h-4 w-4" />}
                <span className="hidden sm:inline">
                  {tab === 'nilai' ? 'Input Nilai' : tab === 'regu' ? 'Data Regu' : tab === 'lomba' ? 'Data Lomba' : tab === 'berita' ? 'Berita' : 'Settings'}
                </span>
                <span className="sm:hidden uppercase">{tab}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Category Selection & Lock Toggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div className="overflow-x-auto pb-4 md:pb-0 custom-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex gap-3 min-w-max">
            {(['SD Putra', 'SD Putri', 'SMP Putra', 'SMP Putri'] as Kategori[]).map((kat) => (
              <button
                key={kat}
                onClick={() => setSelectedKategori(kat)}
                className={cn(
                  "px-8 py-3 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-[0.15em] transition-all border-2",
                  selectedKategori === kat 
                    ? "bg-brown-900 text-white border-brown-900 shadow-2xl shadow-brown-300" 
                    : "bg-white text-brown-500 border-brown-100 hover:border-brown-300 hover:text-brown-700"
                )}
              >
                {kat}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={toggleLock}
          className={cn(
            "flex items-center justify-center gap-3 px-10 py-4 rounded-full text-xs font-black uppercase tracking-[0.2em] transition-all border-2 shadow-sm group",
            isCurrentCategoryLocked 
              ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100" 
              : "bg-brown-50 text-brown-600 border-brown-200 hover:bg-brown-100"
          )}
        >
          {isCurrentCategoryLocked ? (
            <><Lock className="h-4 w-4 group-hover:scale-110 transition-transform" /> Data Terkunci</>
          ) : (
            <><Unlock className="h-4 w-4 group-hover:scale-110 transition-transform" /> Data Terbuka</>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
        {/* Control Column */}
        <div className="lg:col-span-4">
          {activeTab === 'settings' ? (
            <div className="bg-[#151619] p-8 sm:p-10 rounded-[3rem] shadow-2xl border border-white/5 sticky top-28 overflow-hidden">
              <div className="space-y-8">
                <div className="flex items-center gap-4">
                  <div className="bg-brown-500/10 p-3 rounded-2xl border border-brown-500/20">
                    <Settings className="h-7 w-7 text-brown-400" />
                  </div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tight">Global Settings</h3>
                </div>
                
                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest">Running Text (Marquee)</label>
                  <textarea 
                    value={marqueeText}
                    onChange={(e) => setMarqueeText(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-sm outline-none focus:border-brown-500 transition-all"
                    rows={4}
                    placeholder="Masukkan teks berjalan..."
                  />
                </div>

                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest">Email Panitia (Pisahkan dengan koma)</label>
                  <textarea 
                    value={adminEmails}
                    onChange={(e) => setAdminEmails(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-sm outline-none focus:border-brown-500 transition-all"
                    rows={3}
                    placeholder="email1@gmail.com, email2@gmail.com"
                  />
                  <p className="text-[9px] text-white/30 font-medium italic">Akun ini akan memiliki akses penuh ke Dashboard Admin.</p>
                </div>

                <button 
                  onClick={handleUpdateMarquee}
                  className="w-full py-4 bg-brown-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-brown-500 transition-all"
                >
                  Simpan Settings
                </button>

                <div className="space-y-4 pt-4 border-t border-white/10">
                  <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest">Tentang LT2 (Gambar URL)</label>
                  <input 
                    type="text"
                    value={aboutImage}
                    onChange={(e) => setAboutImage(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-sm outline-none focus:border-brown-500 transition-all"
                    placeholder="https://..."
                  />
                </div>

                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest">Tentang LT2 (Artikel)</label>
                  <textarea 
                    value={aboutContent}
                    onChange={(e) => setAboutContent(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-sm outline-none focus:border-brown-500 transition-all"
                    rows={8}
                    placeholder="Tulis artikel tentang LT2..."
                  />
                </div>
              </div>
            </div>
          ) : activeTab === 'berita' ? (
            <div className="bg-[#151619] p-8 sm:p-10 rounded-[3rem] shadow-2xl border border-white/5 sticky top-28 overflow-hidden">
              <form onSubmit={handleAddNews} className="space-y-8">
                <div className="flex items-center gap-4">
                  <div className="bg-brown-500/10 p-3 rounded-2xl border border-brown-500/20">
                    <Newspaper className="h-7 w-7 text-brown-400" />
                  </div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tight">Post Berita</h3>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest">Judul Berita</label>
                    <input 
                      type="text"
                      value={newsTitle}
                      onChange={(e) => setNewsTitle(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-sm outline-none focus:border-brown-500 transition-all"
                      placeholder="Judul..."
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest">Konten / Artikel</label>
                    <textarea 
                      value={newsContent}
                      onChange={(e) => setNewsContent(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-sm outline-none focus:border-brown-500 transition-all"
                      rows={4}
                      placeholder="Tulis artikel..."
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest">Media URL (Img/Vid)</label>
                    <input 
                      type="text"
                      value={newsMediaUrl}
                      onChange={(e) => setNewsMediaUrl(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-sm outline-none focus:border-brown-500 transition-all"
                      placeholder="https://..."
                    />
                  </div>

                  <div className="flex gap-4">
                    {(['image', 'video'] as const).map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setNewsMediaType(type)}
                        className={cn(
                          "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                          newsMediaType === type ? "bg-brown-600 border-brown-600 text-white" : "border-white/10 text-white/40 hover:border-white/20"
                        )}
                      >
                        {type}
                      </button>
                    ))}
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-4 bg-white text-brown-900 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-brown-50 transition-all"
                  >
                    Publish Berita
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-[#151619] p-8 sm:p-10 rounded-[3rem] shadow-2xl border border-white/5 sticky top-28 overflow-hidden group">
            {/* Hardware-style decorative elements */}
            <div className="absolute top-0 right-0 p-6 opacity-10">
              <div className="w-20 h-20 border-2 border-dashed border-white rounded-full animate-spin-slow"></div>
            </div>
            
            <div className="relative space-y-10">
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="bg-brown-500/10 p-3 rounded-2xl border border-brown-500/20">
                    <FileSpreadsheet className="h-7 w-7 text-brown-400" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white leading-tight uppercase tracking-tight">
                      {activeTab === 'regu' ? 'Regu Manager' : activeTab === 'lomba' ? 'Lomba Manager' : 'Nilai Entry'}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <div className={cn("w-2 h-2 rounded-full animate-pulse", isCurrentCategoryLocked ? "bg-red-500" : "bg-emerald-500")}></div>
                      <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">System {isCurrentCategoryLocked ? 'Locked' : 'Active'}</span>
                    </div>
                  </div>
                </div>
                
                <p className="text-sm text-white/60 font-medium leading-relaxed">
                  Gunakan template Excel untuk melakukan import data {activeTab === 'regu' ? 'regu' : activeTab === 'lomba' ? 'lomba' : 'nilai'} secara massal ke dalam sistem.
                </p>
                
                <div className="space-y-8 pt-4">
                  <div className="relative pl-10 group/step">
                    <div className="absolute left-0 top-0 w-7 h-7 rounded-lg bg-white/5 border border-white/10 text-white/40 text-[10px] flex items-center justify-center font-black group-hover/step:bg-brown-500 group-hover/step:text-white transition-all">01</div>
                    <div className="space-y-4">
                      <p className="text-xs font-black text-white uppercase tracking-widest">Unduh Template</p>
                      <button 
                        onClick={() => downloadTemplate(activeTab)}
                        className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white/5 border border-white/10 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-white/10 hover:border-white/20 transition-all shadow-xl"
                      >
                        <Download className="h-4 w-4" /> Download .XLSX
                      </button>
                    </div>
                  </div>

                  <div className="relative pl-10 group/step">
                    <div className="absolute left-0 top-0 w-7 h-7 rounded-lg bg-white/5 border border-white/10 text-white/40 text-[10px] flex items-center justify-center font-black group-hover/step:bg-brown-500 group-hover/step:text-white transition-all">02</div>
                    <div className="space-y-2">
                      <p className="text-xs font-black text-white uppercase tracking-widest">Data Preparation</p>
                      <p className="text-[11px] text-white/40 font-medium leading-relaxed">Lengkapi semua kolom wajib pada file template yang telah diunduh.</p>
                    </div>
                  </div>

                  <div className="relative pl-10 group/step">
                    <div className="absolute left-0 top-0 w-7 h-7 rounded-lg bg-white/5 border border-white/10 text-white/40 text-[10px] flex items-center justify-center font-black group-hover/step:bg-brown-500 group-hover/step:text-white transition-all">03</div>
                    <div className="space-y-4">
                      <p className="text-xs font-black text-white uppercase tracking-widest">Upload & Sync</p>
                      <label className={cn(
                        "w-full inline-flex items-center justify-center gap-3 px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer shadow-2xl",
                        isCurrentCategoryLocked 
                          ? "bg-white/5 text-white/20 cursor-not-allowed border border-white/5" 
                          : "bg-brown-600 text-white hover:bg-brown-500 shadow-brown-900/50"
                      )}>
                        <Upload className="h-4 w-4" /> Import Data
                        <input 
                          type="file" 
                          onChange={handleFileUpload} 
                          accept=".xlsx, .xls" 
                          className="hidden" 
                          disabled={isCurrentCategoryLocked}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {isCurrentCategoryLocked && (
                <div className="p-5 bg-red-500/10 border border-red-500/20 rounded-2xl flex gap-4 text-[11px] text-red-400 font-bold uppercase tracking-wider leading-relaxed">
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  <span>Access Denied: Buka kunci kategori untuk memodifikasi data.</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

        {/* Data Display Column */}
        <div className="lg:col-span-8 space-y-8">
          {activeTab === 'berita' ? (
            <div className="space-y-6">
              {berita.map((item) => (
                <div key={item.id} className="bg-white rounded-[2.5rem] border border-brown-100 p-8 flex gap-6 items-start group">
                  {item.mediaUrl && (
                    <div className="h-24 w-24 rounded-2xl overflow-hidden flex-shrink-0 bg-brown-50">
                      {item.mediaType === 'video' ? (
                        <div className="h-full w-full bg-brown-900 flex items-center justify-center text-white">
                          <Play className="h-6 w-6" />
                        </div>
                      ) : (
                        <img src={item.mediaUrl} className="h-full w-full object-cover" />
                      )}
                    </div>
                  )}
                  <div className="flex-grow space-y-2">
                    <h4 className="text-xl font-black text-brown-900 leading-tight">{item.title}</h4>
                    <p className="text-sm text-brown-500 line-clamp-2 font-medium">{item.content}</p>
                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-[10px] font-black text-brown-400 uppercase tracking-widest">
                        {item.timestamp?.toDate().toLocaleDateString('id-ID')}
                      </span>
                      <button 
                        onClick={() => setConfirmDeleteId(item.id)}
                        className="flex items-center gap-1.5 text-red-500 hover:text-red-700 transition-colors"
                        title="Hapus Berita"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Hapus</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {berita.length === 0 && (
                <div className="py-20 text-center bg-white rounded-[3rem] border border-brown-100 border-dashed">
                  <p className="text-brown-400 font-black uppercase tracking-widest text-xs">Belum ada berita diposting</p>
                </div>
              )}
            </div>
          ) : activeTab === 'settings' ? (
            <div className="bg-white rounded-[3rem] border border-brown-100 p-12 space-y-8">
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-brown-900 uppercase tracking-tight">System Overview</h3>
                <p className="text-sm text-brown-500 font-medium">Konfigurasi global untuk portal LT2 Jatinagara.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="p-8 bg-brown-50 rounded-[2rem] border border-brown-100 space-y-4">
                  <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center text-brown-600 shadow-sm">
                    <Lock className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-brown-400 uppercase tracking-widest">Global Lock Status</p>
                    <p className="text-xl font-black text-brown-900">{config?.isLocked ? 'LOCKED' : 'UNLOCKED'}</p>
                  </div>
                </div>
                <div className="p-8 bg-brown-50 rounded-[2rem] border border-brown-100 space-y-4">
                  <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center text-brown-600 shadow-sm">
                    <Newspaper className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-brown-400 uppercase tracking-widest">Total News Posts</p>
                    <p className="text-xl font-black text-brown-900">{berita.length}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-[3rem] shadow-sm border border-brown-100 overflow-hidden">
            <div className="p-8 sm:p-12 bg-brown-50/30 border-b border-brown-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
              <div className="space-y-1">
                <h3 className="font-black text-brown-900 uppercase text-lg sm:text-xl tracking-tight">
                  {activeTab === 'regu' ? `Database Regu` : activeTab === 'lomba' ? `Master Data Lomba` : `Log Penilaian`}
                </h3>
                <p className="text-xs text-brown-400 font-bold uppercase tracking-widest">Kategori: {selectedKategori}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black text-brown-600 bg-white border border-brown-100 px-5 py-2 rounded-full shadow-sm uppercase tracking-widest">
                  {activeTab === 'regu' ? filteredRegus.length : activeTab === 'lomba' ? filteredLombas.length : filteredNilais.length} Records
                </span>
              </div>
            </div>
            
            <div className="max-h-[800px] overflow-y-auto custom-scrollbar">
              {activeTab === 'regu' && (
                <div className="divide-y divide-brown-50">
                  {filteredRegus.map((r, i) => (
                    <div key={r.id} className="p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:bg-brown-50/50 transition-all group">
                      <div className="flex items-start gap-6">
                        <div className="text-4xl font-black text-brown-100 group-hover:text-brown-200 transition-colors tabular-nums">
                          {(i + 1).toString().padStart(2, '0')}
                        </div>
                        <div className="space-y-1">
                          <div className="font-black text-brown-900 text-xl group-hover:text-brown-700 transition-colors flex items-center gap-3">
                            {r.nama} 
                            <span className="text-[10px] px-2 py-0.5 bg-brown-900 text-white rounded-md font-black">#{r.nomorTenda}</span>
                          </div>
                          <div className="text-xs sm:text-sm text-brown-500 font-medium flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {r.pangkalan}</span>
                            <span className="w-1 h-1 rounded-full bg-brown-200"></span>
                            <span>Pinru: <span className="text-brown-700 font-bold">{r.pinru || '-'}</span></span>
                          </div>
                        </div>
                      </div>
                      <div className="flex sm:flex-col items-center sm:items-end gap-2">
                        <span className="text-[10px] font-black uppercase px-4 py-2 bg-brown-50 text-brown-500 rounded-full tracking-[0.2em] border border-brown-100">
                          {r.kategori}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'lomba' && (
                <div className="divide-y divide-brown-50">
                  {filteredLombas.map((l, i) => (
                    <div key={l.id} className="p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:bg-brown-50/50 transition-all group">
                      <div className="flex items-start gap-6">
                        <div className="text-4xl font-black text-brown-100 group-hover:text-brown-200 transition-colors tabular-nums">
                          {(i + 1).toString().padStart(2, '0')}
                        </div>
                        <div className="space-y-1">
                          <div className="font-black text-brown-900 text-xl group-hover:text-brown-700 transition-colors uppercase tracking-tight">{l.nama}</div>
                          <div className="text-xs text-brown-400 font-black uppercase tracking-[0.2em]">{l.bidangLomba}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-brown-900 text-white flex flex-col items-center justify-center shadow-lg shadow-brown-200">
                          <span className="text-[8px] font-black uppercase leading-none opacity-60">Hari</span>
                          <span className="text-lg font-black leading-none mt-1">{l.hari}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'nilai' && (
                <div className="divide-y divide-brown-50">
                  {filteredNilais.slice(0, 100).map((n, i) => {
                    const regu = regus.find(r => r.id === n.reguId);
                    const lomba = lombas.find(l => l.id === n.lombaId);
                    return (
                      <div key={n.id} className="p-8 flex items-center justify-between gap-6 hover:bg-brown-50/50 transition-all group">
                        <div className="flex items-start gap-6">
                          <div className="text-4xl font-black text-brown-100 group-hover:text-brown-200 transition-colors tabular-nums">
                            {(i + 1).toString().padStart(2, '0')}
                          </div>
                          <div className="space-y-1">
                            <span className="font-black text-brown-900 text-lg sm:text-xl group-hover:text-brown-700 transition-colors block">{regu?.nama || 'Unknown Regu'}</span>
                            <span className="text-xs text-brown-400 font-bold uppercase tracking-widest block">{lomba?.nama || 'Unknown Lomba'}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <div className="text-3xl sm:text-5xl font-black text-brown-800 tabular-nums tracking-tighter">
                            {n.score}
                          </div>
                          <div className="text-[9px] font-black text-brown-400 uppercase tracking-widest">Final Score</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {(activeTab === 'regu' ? filteredRegus : activeTab === 'lomba' ? filteredLombas : filteredNilais).length === 0 && (
                <div className="py-32 text-center space-y-6">
                  <div className="bg-brown-50 h-24 w-24 rounded-full flex items-center justify-center mx-auto border border-brown-100">
                    <ClipboardList className="h-12 w-12 text-brown-200" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-brown-900 font-black uppercase tracking-[0.25em] text-sm">No Records Found</p>
                    <p className="text-brown-400 text-xs font-medium">Silakan unggah data melalui panel kontrol di sebelah kiri.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => confirmDeleteId && handleDeleteNews(confirmDeleteId)}
        title="Hapus Berita"
        message="Apakah Anda yakin ingin menghapus berita ini secara permanen? Tindakan ini tidak dapat dibatalkan."
        confirmLabel="Hapus Sekarang"
      />
    </div>
  </div>
  );
}

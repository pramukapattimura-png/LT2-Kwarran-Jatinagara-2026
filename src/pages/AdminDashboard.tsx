import React, { useState, useEffect, useRef } from 'react';
import { db, collection, addDoc, setDoc, doc, onSnapshot, query, orderBy, auth, serverTimestamp, deleteDoc, handleFirestoreError, OperationType } from '../firebase';
import { Regu, Lomba, Nilai, Kategori, Berita } from '../types';
import { useNavigate } from 'react-router-dom';
import { Plus, Save, Users, Trophy, ClipboardList, AlertCircle, Download, Upload, FileSpreadsheet, Lock, Unlock, Newspaper, Trash2, Settings, Play } from 'lucide-react';
import { cn } from '../lib/utils';
import * as XLSX from 'xlsx';
import { AppConfig, RekapNilai } from '../types';
import Spreadsheet from "react-spreadsheet";
import { Parser } from 'hot-formula-parser';
import ConfirmModal from '../components/ConfirmModal';

export default function AdminDashboard() {
  const [regus, setRegus] = useState<Regu[]>([]);
  const [lombas, setLombas] = useState<Lomba[]>([]);
  const [nilais, setNilais] = useState<Nilai[]>([]);
  const [berita, setBerita] = useState<Berita[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [activeTab, setActiveTab] = useState<'nilai' | 'berita' | 'settings'>('nilai');
  const [spreadsheetData, setSpreadsheetData] = useState<any[][]>([
    [{ value: "NO" }, { value: "NAMA REGU" }, { value: "LOMBA 1" }, { value: "LOMBA 2" }, { value: "TOTAL" }],
    [{ value: 1 }, { value: "Regu Elang" }, { value: 0 }, { value: 0 }, { value: "=C2+D2" }],
  ]);
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
    const unsubRegu = onSnapshot(collection(db, 'regu'), (s) => {
      setRegus(s.docs.map(d => ({ id: d.id, ...d.data() } as Regu)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'regu');
    });

    const unsubLomba = onSnapshot(query(collection(db, 'lomba'), orderBy('hari', 'asc')), (s) => {
      setLombas(s.docs.map(d => ({ id: d.id, ...d.data() } as Lomba)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'lomba');
    });

    const unsubNilai = onSnapshot(collection(db, 'nilai'), (s) => {
      setNilais(s.docs.map(d => ({ id: d.id, ...d.data() } as Nilai)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'nilai');
    });

    const unsubBerita = onSnapshot(query(collection(db, 'berita'), orderBy('timestamp', 'desc')), (s) => {
      setBerita(s.docs.map(d => ({ id: d.id, ...d.data() } as Berita)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'berita');
    });

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
        setDoc(doc(db, 'settings', 'global'), initialConfig).catch(error => {
          handleFirestoreError(error, OperationType.WRITE, 'settings/global');
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/global');
    });

    const unsubRekap = onSnapshot(doc(db, 'settings', `rekap_${selectedKategori.replace(' ', '_')}`), (s) => {
      if (s.exists()) {
        const data = s.data() as RekapNilai;
        if (data.grid) {
          setSpreadsheetData(data.grid);
        }
      }
    });

    return () => { unsubRegu(); unsubLomba(); unsubNilai(); unsubBerita(); unsubConfig(); unsubRekap(); };
  }, [navigate, selectedKategori]);

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

  const handleSaveSpreadsheet = async () => {
    try {
      await setDoc(doc(db, 'settings', `rekap_${selectedKategori.replace(' ', '_')}`), {
        grid: spreadsheetData,
        updatedAt: serverTimestamp()
      });
      alert('Rekap Nilai Berhasil Disimpan!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'rekap_nilai');
    }
  };

  const formulaParser = new Parser();
  formulaParser.on('callCellValue', (cellCoord, done) => {
    const { row, column } = cellCoord;
    const cell = spreadsheetData[row.index]?.[column.index];
    let value = cell?.value;
    if (typeof value === 'string' && value.startsWith('=')) {
      const result = formulaParser.parse(value.substring(1));
      done(result.error ? 0 : result.result);
    } else {
      done(Number(value) || 0);
    }
  });

  const evaluateGrid = (grid: any[][]) => {
    return grid.map((row, rIdx) => 
      row.map((cell, cIdx) => {
        if (typeof cell.value === 'string' && cell.value.startsWith('=')) {
          const result = formulaParser.parse(cell.value.substring(1));
          return { ...cell, displayValue: result.error ? '#ERR' : result.result };
        }
        return cell;
      })
    );
  };

  const handleSpreadsheetChange = (newData: any) => {
    setSpreadsheetData(newData);
  };

  const addRow = () => {
    const newRow = Array(spreadsheetData[0].length).fill({ value: "" });
    setSpreadsheetData([...spreadsheetData, newRow]);
  };

  const addColumn = () => {
    setSpreadsheetData(spreadsheetData.map(row => [...row, { value: "" }]));
  };

  const handleImportExcelToSpreadsheet = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
      
      const newGrid = (data as any[][]).map(row => 
        row.map(cell => ({ value: cell }))
      );
      setSpreadsheetData(newGrid);
    };
    reader.readAsBinaryString(file);
  };

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
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 border-b border-gray-100 pb-10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-50 text-gray-600 text-[10px] font-black uppercase tracking-[0.2em] border border-gray-100">
            Admin Control Panel
          </div>
          <h1 className="text-4xl sm:text-6xl font-black text-black uppercase tracking-tighter leading-[0.85]">
            Dashboard <br className="hidden sm:block" /> <span className="text-gray-600">Panitia</span>
          </h1>
          <p className="text-sm sm:text-lg text-gray-600 font-medium max-w-md leading-relaxed">
            Pusat kendali rekapitulasi nilai, manajemen regu, dan pengaturan mata lomba LT2 Jatinagara.
          </p>
        </div>
        
        <div className="w-full lg:w-auto">
          <div className="flex bg-gray-50 p-1.5 rounded-[2rem] border border-gray-100 shadow-inner w-full sm:w-max overflow-x-auto custom-scrollbar">
            {(['nilai', 'berita', 'settings'] as const).map((tab) => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex-1 sm:flex-none px-6 py-3.5 rounded-[1.5rem] text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap", 
                  activeTab === tab 
                    ? "bg-white text-black shadow-xl shadow-gray-200/50 scale-[1.02]" 
                    : "text-gray-400 hover:text-gray-600 hover:bg-white/50"
                )}
              >
                {tab === 'nilai' && <ClipboardList className="h-4 w-4" />}
                {tab === 'berita' && <Newspaper className="h-4 w-4" />}
                {tab === 'settings' && <Settings className="h-4 w-4" />}
                <span className="hidden sm:inline">
                  {tab === 'nilai' ? 'Input Nilai' : tab === 'berita' ? 'Berita' : 'Settings'}
                </span>
                <span className="sm:hidden uppercase">{tab}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
        {/* Control Column */}
        <div className="lg:col-span-4">
          {activeTab === 'settings' ? (
            <div className="bg-white p-8 sm:p-10 rounded-[3rem] shadow-2xl border border-gray-100 sticky top-28 overflow-hidden">
              <div className="space-y-8">
                <div className="flex items-center gap-4">
                  <div className="bg-gray-100 p-3 rounded-2xl border border-gray-200">
                    <Settings className="h-7 w-7 text-gray-600" />
                  </div>
                  <h3 className="text-2xl font-black text-black uppercase tracking-tight">Global Settings</h3>
                </div>
                
                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Running Text (Marquee)</label>
                  <textarea 
                    value={marqueeText}
                    onChange={(e) => setMarqueeText(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-black text-sm outline-none focus:border-black transition-all"
                    rows={4}
                    placeholder="Masukkan teks berjalan..."
                  />
                </div>

                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Email Panitia (Pisahkan dengan koma)</label>
                  <textarea 
                    value={adminEmails}
                    onChange={(e) => setAdminEmails(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-black text-sm outline-none focus:border-black transition-all"
                    rows={3}
                    placeholder="email1@gmail.com, email2@gmail.com"
                  />
                  <p className="text-[9px] text-gray-400 font-medium italic">Akun ini akan memiliki akses penuh ke Dashboard Admin.</p>
                </div>

                <button 
                  onClick={handleUpdateMarquee}
                  className="w-full py-4 bg-black text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-gray-900 transition-all"
                >
                  Simpan Settings
                </button>

                <div className="space-y-4 pt-4 border-t border-gray-100">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Tentang LT2 (Gambar URL)</label>
                  <input 
                    type="text"
                    value={aboutImage}
                    onChange={(e) => setAboutImage(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-black text-sm outline-none focus:border-black transition-all"
                    placeholder="https://..."
                  />
                </div>

                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Tentang LT2 (Artikel)</label>
                  <textarea 
                    value={aboutContent}
                    onChange={(e) => setAboutContent(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-black text-sm outline-none focus:border-black transition-all"
                    rows={8}
                    placeholder="Tulis artikel tentang LT2..."
                  />
                </div>
              </div>
            </div>
          ) : activeTab === 'berita' ? (
            <div className="bg-white p-8 sm:p-10 rounded-[3rem] shadow-2xl border border-gray-100 sticky top-28 overflow-hidden">
              <form onSubmit={handleAddNews} className="space-y-8">
                <div className="flex items-center gap-4">
                  <div className="bg-gray-100 p-3 rounded-2xl border border-gray-200">
                    <Newspaper className="h-7 w-7 text-gray-600" />
                  </div>
                  <h3 className="text-2xl font-black text-black uppercase tracking-tight">Post Berita</h3>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Judul Berita</label>
                    <input 
                      type="text"
                      value={newsTitle}
                      onChange={(e) => setNewsTitle(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-black text-sm outline-none focus:border-black transition-all"
                      placeholder="Judul..."
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Konten / Artikel</label>
                    <textarea 
                      value={newsContent}
                      onChange={(e) => setNewsContent(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-black text-sm outline-none focus:border-black transition-all"
                      rows={4}
                      placeholder="Tulis artikel..."
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Media URL (Img/Vid)</label>
                    <input 
                      type="text"
                      value={newsMediaUrl}
                      onChange={(e) => setNewsMediaUrl(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-black text-sm outline-none focus:border-black transition-all"
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
                          newsMediaType === type ? "bg-black border-black text-white" : "border-gray-200 text-gray-400 hover:border-black"
                        )}
                      >
                        {type}
                      </button>
                    ))}
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-4 bg-black text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-gray-900 transition-all"
                  >
                    Publish Berita
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-white p-8 sm:p-10 rounded-[3rem] shadow-2xl border border-gray-100 sticky top-28 overflow-hidden group">
            {/* Hardware-style decorative elements */}
            <div className="absolute top-0 right-0 p-6 opacity-5">
              <div className="w-20 h-20 border-2 border-dashed border-black rounded-full animate-spin-slow"></div>
            </div>
            
            <div className="relative space-y-10">
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="bg-gray-100 p-3 rounded-2xl border border-gray-200">
                    <FileSpreadsheet className="h-7 w-7 text-gray-600" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-black leading-tight uppercase tracking-tight">
                      {activeTab === 'regu' ? 'Regu Manager' : activeTab === 'lomba' ? 'Lomba Manager' : 'Nilai Entry'}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <div className={cn("w-2 h-2 rounded-full animate-pulse", isCurrentCategoryLocked ? "bg-red-500" : "bg-emerald-500")}></div>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">System {isCurrentCategoryLocked ? 'Locked' : 'Active'}</span>
                    </div>
                  </div>
                </div>
                
                <p className="text-sm text-gray-600 font-medium leading-relaxed">
                  Gunakan template Excel untuk melakukan import data {activeTab === 'regu' ? 'regu' : activeTab === 'lomba' ? 'lomba' : 'nilai'} secara massal ke dalam sistem.
                </p>
                
                <div className="space-y-8 pt-4">
                  <div className="relative pl-10 group/step">
                    <div className="absolute left-0 top-0 w-7 h-7 rounded-lg bg-gray-50 border border-gray-100 text-gray-400 text-[10px] flex items-center justify-center font-black group-hover/step:bg-black group-hover/step:text-white transition-all">01</div>
                    <div className="space-y-4">
                      <p className="text-xs font-black text-black uppercase tracking-widest">Unduh Template</p>
                      <button 
                        onClick={() => downloadTemplate(activeTab)}
                        className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gray-50 border border-gray-100 text-black rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-gray-100 hover:border-gray-200 transition-all shadow-xl"
                      >
                        <Download className="h-4 w-4" /> Download .XLSX
                      </button>
                    </div>
                  </div>

                  <div className="relative pl-10 group/step">
                    <div className="absolute left-0 top-0 w-7 h-7 rounded-lg bg-gray-50 border border-gray-100 text-gray-400 text-[10px] flex items-center justify-center font-black group-hover/step:bg-black group-hover/step:text-white transition-all">02</div>
                    <div className="space-y-2">
                      <p className="text-xs font-black text-black uppercase tracking-widest">Data Preparation</p>
                      <p className="text-[11px] text-gray-400 font-medium leading-relaxed">Lengkapi semua kolom wajib pada file template yang telah diunduh.</p>
                    </div>
                  </div>

                  <div className="relative pl-10 group/step">
                    <div className="absolute left-0 top-0 w-7 h-7 rounded-lg bg-gray-50 border border-gray-100 text-gray-400 text-[10px] flex items-center justify-center font-black group-hover/step:bg-black group-hover/step:text-white transition-all">03</div>
                    <div className="space-y-4">
                      <p className="text-xs font-black text-black uppercase tracking-widest">Upload & Sync</p>
                      <label className={cn(
                        "w-full inline-flex items-center justify-center gap-3 px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer shadow-2xl",
                        isCurrentCategoryLocked 
                          ? "bg-gray-50 text-gray-300 cursor-not-allowed border border-gray-100" 
                          : "bg-black text-white hover:bg-gray-900 shadow-gray-200"
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
                <div className="p-5 bg-red-50 border border-red-100 rounded-2xl flex gap-4 text-[11px] text-red-500 font-bold uppercase tracking-wider leading-relaxed">
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
                <div key={item.id} className="bg-white rounded-[2.5rem] border border-gray-100 p-8 flex gap-6 items-start group">
                  {item.mediaUrl && (
                    <div className="h-24 w-24 rounded-2xl overflow-hidden flex-shrink-0 bg-gray-50">
                      {item.mediaType === 'video' ? (
                        <div className="h-full w-full bg-black flex items-center justify-center text-white">
                          <Play className="h-6 w-6" />
                        </div>
                      ) : (
                        <img src={item.mediaUrl} className="h-full w-full object-cover" />
                      )}
                    </div>
                  )}
                  <div className="flex-grow space-y-2">
                    <h4 className="text-xl font-black text-black leading-tight">{item.title}</h4>
                    <p className="text-sm text-gray-500 line-clamp-2 font-medium">{item.content}</p>
                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
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
                <div className="py-20 text-center bg-white rounded-[3rem] border border-gray-100 border-dashed">
                  <p className="text-gray-400 font-black uppercase tracking-widest text-xs">Belum ada berita diposting</p>
                </div>
              )}
            </div>
          ) : activeTab === 'settings' ? (
            <div className="bg-white rounded-[3rem] border border-gray-100 p-12 space-y-8">
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-black uppercase tracking-tight">System Overview</h3>
                <p className="text-sm text-gray-500 font-medium">Konfigurasi global untuk portal LT2 Jatinagara.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="p-8 bg-gray-50 rounded-[2rem] border border-gray-100 space-y-4">
                  <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center text-gray-600 shadow-sm">
                    <Lock className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Global Lock Status</p>
                    <p className="text-xl font-black text-black">{config?.isLocked ? 'LOCKED' : 'UNLOCKED'}</p>
                  </div>
                </div>
                <div className="p-8 bg-gray-50 rounded-[2rem] border border-gray-100 space-y-4">
                  <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center text-gray-600 shadow-sm">
                    <Newspaper className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total News Posts</p>
                    <p className="text-xl font-black text-black">{berita.length}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-[3rem] shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-8 sm:p-12 bg-gray-50/30 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
              <div className="space-y-1">
                <h3 className="font-black text-black uppercase text-lg sm:text-xl tracking-tight">
                  {activeTab === 'regu' ? `Database Regu` : activeTab === 'lomba' ? `Master Data Lomba` : `Log Penilaian`}
                </h3>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Kategori: {selectedKategori}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black text-gray-600 bg-white border border-gray-100 px-5 py-2 rounded-full shadow-sm uppercase tracking-widest">
                  {activeTab === 'regu' ? filteredRegus.length : activeTab === 'lomba' ? filteredLombas.length : filteredNilais.length} Records
                </span>
              </div>
            </div>
            
            <div className="flex flex-col gap-4">
              <div className="flex gap-3">
                {(['SD Putra', 'SD Putri', 'SMP Putra', 'SMP Putri'] as Kategori[]).map((kat) => (
                  <button
                    key={kat}
                    onClick={() => setSelectedKategori(kat)}
                    className={cn(
                      "px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border",
                      selectedKategori === kat 
                        ? "bg-black text-white border-black" 
                        : "bg-white text-gray-500 border-gray-100 hover:border-gray-300"
                    )}
                  >
                    {kat}
                  </button>
                ))}
              </div>

              <div className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden shadow-sm">
                <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                  <div className="flex gap-2">
                    <button onClick={addRow} className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-all text-xs font-bold flex items-center gap-2">
                      <Plus className="h-3 w-3" /> Baris
                    </button>
                    <button onClick={addColumn} className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-all text-xs font-bold flex items-center gap-2">
                      <Plus className="h-3 w-3" /> Kolom
                    </button>
                    <label className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-all text-xs font-bold flex items-center gap-2 cursor-pointer">
                      <Upload className="h-3 w-3" /> Import Excel
                      <input type="file" className="hidden" onChange={handleImportExcelToSpreadsheet} accept=".xlsx, .xls" />
                    </label>
                  </div>
                  <button 
                    onClick={handleSaveSpreadsheet}
                    className="px-6 py-2 bg-black text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-800 transition-all flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" /> Simpan Rekap
                  </button>
                </div>
                <div className="overflow-auto max-h-[600px] spreadsheet-container">
                  <Spreadsheet 
                    data={spreadsheetData} 
                    onChange={handleSpreadsheetChange}
                  />
                </div>
              </div>
              <p className="text-[10px] text-gray-400 font-medium italic">
                * Gunakan "=" untuk rumus (contoh: =C2+D2). Simpan rekap untuk menampilkan di halaman depan.
              </p>
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

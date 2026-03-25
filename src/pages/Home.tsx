import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { db, collection, onSnapshot, query, orderBy, doc, auth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, addDoc, serverTimestamp, updateDoc, arrayUnion, arrayRemove, deleteDoc, handleFirestoreError, OperationType, ref, uploadBytes, getDownloadURL, storage, uploadBytesResumable } from '../firebase';
import { Regu, Lomba, Nilai, Kategori, ScoreSummary, Berita, AppConfig, RekapNilai } from '../types';
import { compressImage } from '../lib/imageUtils';
import { Trophy, Medal, Search, Filter, ChevronRight, ChevronDown, Newspaper, Play, Image as ImageIcon, ArrowDownCircle, Heart, MessageCircle, Share2, MoreHorizontal, Trash2, LogIn, User, Info, FileSpreadsheet, Download, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import CommentSection, { CommentSectionRef } from '../components/CommentSection';
import ConfirmModal from '../components/ConfirmModal';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { Parser } from 'hot-formula-parser';
import { GoogleGenAI } from "@google/genai";

export default function Home() {
  const [regus, setRegus] = useState<Regu[]>([]);
  const [lombas, setLombas] = useState<Lomba[]>([]);
  const [nilais, setNilais] = useState<Nilai[]>([]);
  const [berita, setBerita] = useState<Berita[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [rekapData, setRekapData] = useState<Record<string, any[][]>>({});
  const [laporanData, setLaporanData] = useState<any[][]>([]);
  const [dokumen, setDokumen] = useState<any[]>([]);
  const [activeKategori, setActiveKategori] = useState<Kategori | 'Semua'>('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRegu, setExpandedRegu] = useState<string | null>(null);
  const [activeMainTab, setActiveMainTab] = useState<'berita' | 'rekap' | 'laporan' | 'tentang' | 'drive'>('berita');
  const [user, setUser] = useState(auth.currentUser);

  const isAdmin = useMemo(() => {
    if (!user) return false;
    if (user.email === 'pramukapattimura@gmail.com') return true;
    if (!config || !config.adminEmails) return false;
    return config.adminEmails.includes(user.email || '');
  }, [user, config]);

  // Post creation state
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostMediaUrl, setNewPostMediaUrl] = useState('');
  const [newPostMediaType, setNewPostMediaType] = useState<'image' | 'video'>('image');
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((u) => setUser(u));
    
    // Check for redirect result
    const checkRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          setUser(result.user);
        }
      } catch (err) {
        console.error('Redirect result error:', err);
      }
    };
    checkRedirect();

    return () => unsubscribeAuth();
  }, []);

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
        setConfig({ id: s.id, ...s.data() } as AppConfig);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/global');
    });

    const unsubDokumen = onSnapshot(query(collection(db, 'dokumen'), orderBy('timestamp', 'desc')), (s) => {
      setDokumen(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'dokumen');
    });

    const unsubLaporan = onSnapshot(doc(db, 'settings', 'laporan'), (s) => {
      console.log('Laporan snapshot received:', s.exists(), s.data());
      if (s.exists()) {
        const data = s.data();
        if (data.grid) {
          try {
            const parsedGrid = typeof data.grid === 'string' ? JSON.parse(data.grid) : data.grid;
            setLaporanData(parsedGrid);
          } catch (e) {
            console.error("Error parsing laporan grid:", e);
            setLaporanData([]);
          }
        } else {
          setLaporanData([]);
        }
      } else {
        setLaporanData([]);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/laporan');
    });

    const categories: Kategori[] = ['SD Putra', 'SD Putri', 'SMP Putra', 'SMP Putri'];
    const unsubRekaps = categories.map(cat => 
      onSnapshot(doc(db, 'settings', `rekap_${cat.replace(' ', '_')}`), (s) => {
        if (s.exists()) {
          const data = s.data() as RekapNilai;
          if (data.grid) {
            try {
              const parsedGrid = typeof data.grid === 'string' ? JSON.parse(data.grid) : data.grid;
              setRekapData(prev => ({ ...prev, [cat]: parsedGrid }));
            } catch (e) {
              console.error(`Error parsing rekap grid for ${cat}:`, e);
            }
          }
        }
      })
    );

    return () => { 
      unsubRegu(); unsubLomba(); unsubNilai(); unsubBerita(); unsubConfig(); unsubLaporan();
      unsubRekaps.forEach(unsub => unsub());
    };
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      // Try popup first
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error('Login error:', error);
      // If popup blocked or on mobile, try redirect
      if (error.code === 'auth/popup-blocked' || /Android|iPhone|iPad/i.test(navigator.userAgent)) {
        try {
          await signInWithRedirect(auth, provider);
        } catch (redirectError) {
          console.error('Redirect login error:', redirectError);
          setToast({ message: 'Gagal login. Silakan coba lagi.', type: 'error' });
        }
      } else {
        setToast({ message: 'Gagal login. Silakan coba lagi.', type: 'error' });
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limit size to 10MB for Storage
    if (file.size > 10 * 1024 * 1024) {
      setToast({ message: 'Ukuran file terlalu besar (maks 10MB).', type: 'error' });
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setFilePreview(reader.result as string);
      setNewPostMediaType(file.type.startsWith('video') ? 'video' : 'image');
    };
    reader.readAsDataURL(file);
  };

  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);

  const uploadToCloudinary = async (file: File | Blob): Promise<string> => {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim();
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim();

    console.log('Cloudinary Config:', { 
      cloudName: cloudName ? `${cloudName.substring(0, 3)}...` : 'MISSING',
      preset: uploadPreset ? `${uploadPreset.substring(0, 3)}...` : 'MISSING'
    });

    if (!cloudName || !uploadPreset) {
      throw new Error('Konfigurasi Cloudinary belum lengkap. Pastikan VITE_CLOUDINARY_CLOUD_NAME dan VITE_CLOUDINARY_UPLOAD_PRESET sudah diatur di menu Settings > Secrets dengan benar.');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);

    const url = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
    console.log('Fetching Cloudinary URL:', url.replace(cloudName, '***'));

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        mode: 'cors', // Explicitly set cors mode
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Cloudinary API Error Response:', errorData);
        throw new Error(errorData.error?.message || errorData.message || `Gagal mengunggah ke Cloudinary (Status: ${response.status})`);
      }

      const data = await response.json();
      return data.secure_url;
    } catch (err: any) {
      console.error('Detailed Cloudinary Fetch Error:', err);
      if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
        throw new Error('Koneksi ke Cloudinary diblokir atau gagal. Pastikan koneksi internet stabil dan tidak ada AdBlocker yang memblokir api.cloudinary.com. Jika Anda menggunakan VPN, coba matikan sejenak.');
      }
      throw new Error(err.message || 'Terjadi kesalahan jaringan saat mengunggah ke Cloudinary');
    }
  };

  const handleGenerateAICaption = async () => {
    if (!selectedFile || !selectedFile.type.startsWith('image/')) {
      setToast({ message: 'Pilih foto terlebih dahulu untuk membuat caption AI.', type: 'error' });
      return;
    }

    setIsGeneratingCaption(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(selectedFile);
      });
      const base64Data = await base64Promise;

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              { text: "Berikan caption singkat, menarik, dan positif untuk foto kegiatan pramuka ini (maksimal 15 kata):" },
              { inlineData: { mimeType: selectedFile.type, data: base64Data } }
            ]
          }
        ]
      });
      
      if (response.text) {
        setNewPostContent(prev => prev ? `${prev}\n\n${response.text}` : response.text);
        setToast({ message: 'Caption AI berhasil dibuat!', type: 'success' });
      }
    } catch (err) {
      console.error('Gemini error:', err);
      setToast({ message: 'Gagal membuat caption AI.', type: 'error' });
    } finally {
      setIsGeneratingCaption(false);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!user) return;
    
    const content = newPostContent.trim();
    if (!content && !selectedFile) {
      setToast({ message: 'Tulis sesuatu atau pilih foto untuk diposting.', type: 'error' });
      return;
    }

    setIsSubmittingPost(true);
    setUploadProgress(0);
    console.log('Starting post creation...', { hasContent: !!content, hasFile: !!selectedFile });
    
    // Create a timeout promise - increased to 300 seconds (5 minutes)
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Waktu pengunggahan habis. Koneksi internet mungkin sangat lambat atau file terlalu besar. Silakan coba lagi dengan file yang lebih kecil.')), 300000)
    );

    try {
      let mediaUrl = '';
      
      // Upload file to Cloudinary if selected
      if (selectedFile) {
        let fileToUpload: Blob | File = selectedFile;
        
        // Compress image if it's an image and larger than 1MB
        if (selectedFile.type.startsWith('image/') && selectedFile.size > 1024 * 1024) {
          try {
            console.log('Compressing image before upload...');
            fileToUpload = await compressImage(selectedFile);
            console.log('Image compressed. Original size:', selectedFile.size, 'New size:', fileToUpload.size);
          } catch (compressErr) {
            console.error('Compression failed, using original file:', compressErr);
          }
        }

        console.log('Uploading file to Cloudinary:', selectedFile.name, 'Final Size:', fileToUpload.size);
        
        try {
          // Use Cloudinary for upload to avoid Firebase Storage costs/issues
          const uploadPromise = uploadToCloudinary(fileToUpload);
          
          // Simulate progress for Cloudinary upload since fetch doesn't give progress easily without XHR
          const progressInterval = setInterval(() => {
            setUploadProgress(prev => {
              if (prev >= 95) {
                clearInterval(progressInterval);
                return 95;
              }
              return prev + 5;
            });
          }, 500);

          mediaUrl = await Promise.race([
            uploadPromise,
            timeoutPromise
          ]) as string;
          
          clearInterval(progressInterval);
          setUploadProgress(100);
          console.log('File uploaded to Cloudinary successfully:', mediaUrl);
        } catch (error: any) {
          console.error('Cloudinary upload error:', error);
          setToast({ 
            message: `Gagal mengunggah ke Cloudinary: ${error.message}. Pastikan VITE_CLOUDINARY_CLOUD_NAME dan VITE_CLOUDINARY_UPLOAD_PRESET sudah benar.`, 
            type: 'error' 
          });
          throw error;
        }
      }

      console.log('Adding document to Firestore...');
      const path = 'berita';
      await Promise.race([
        addDoc(collection(db, path), {
          title: '',
          content: content,
          mediaUrl: mediaUrl,
          mediaType: newPostMediaType,
          timestamp: serverTimestamp(),
          authorId: user.uid,
          authorName: user.displayName || 'Anonim',
          authorEmail: user.email || '',
          authorPhoto: user.photoURL || '',
          likes: []
        }),
        timeoutPromise
      ]);
      
      console.log('Post created successfully!');
      setNewPostContent('');
      setNewPostMediaUrl('');
      setNewPostMediaType('image');
      setSelectedFile(null);
      setFilePreview(null);
      setIsCreatingPost(false);
      setToast({ message: 'Postingan berhasil dibagikan!', type: 'success' });
    } catch (error: any) {
      console.error('Error creating post:', error);
      let errorMessage = error.message || 'Gagal membuat postingan.';
      
      if (error.code === 'permission-denied') {
        errorMessage = 'Anda tidak memiliki izin untuk memposting. Pastikan Anda sudah login.';
      }

      setToast({ message: errorMessage, type: 'error' });
    } finally {
      setIsSubmittingPost(false);
      setUploadProgress(0);
    }
  };

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const commentRefs = useRef<Record<string, CommentSectionRef | null>>({});

  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const handleLikePost = async (post: Berita) => {
    if (!user) {
      handleLogin();
      return;
    }

    const postRef = doc(db, 'berita', post.id);
    const isLiked = post.likes?.includes(user.uid);

    try {
      await updateDoc(postRef, {
        likes: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid)
      });
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      await deleteDoc(doc(db, 'berita', postId));
      // Update state manually for immediate feedback
      setBerita(prev => prev.filter(post => post.id !== postId));
      setToast({ message: 'Postingan berhasil dihapus!', type: 'success' });
    } catch (error) {
      console.error('Error deleting post:', error);
      setToast({ message: 'Gagal menghapus postingan. Pastikan Anda memiliki izin.', type: 'error' });
    }
  };

  const handleSharePost = (postId: string) => {
    const url = `${window.location.origin}/?post=${postId}`;
    navigator.clipboard.writeText(url);
    setToast({ message: 'Tautan postingan telah disalin!', type: 'success' });
  };

  const summaries = useMemo(() => {
    return regus.map(regu => {
      const lombaScores: Record<string, number> = {};
      let totalScore = 0;
      
      nilais.filter(n => n.reguId === regu.id).forEach(n => {
        lombaScores[n.lombaId] = n.score;
        totalScore += n.score;
      });

      return { regu, totalScore, lombaScores };
    }).sort((a, b) => b.totalScore - a.totalScore);
  }, [regus, nilais]);

  const filteredSummaries = useMemo(() => {
    return summaries.filter(s => {
      const matchKategori = activeKategori === 'Semua' || s.regu.kategori === activeKategori;
      const matchSearch = s.regu.nama.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.regu.pangkalan.toLowerCase().includes(searchQuery.toLowerCase());
      return matchKategori && matchSearch;
    });
  }, [summaries, activeKategori, searchQuery]);

  const categories: (Kategori | 'Semua')[] = ['Semua', 'SD Putra', 'SD Putri', 'SMP Putra', 'SMP Putri'];

  const RekapTable = ({ grid }: { grid: any[][] }) => {
    const parser = new Parser();
    
    parser.on('callCellValue', (cellCoord, done) => {
      const { row, column } = cellCoord;
      const cell = grid[row.index]?.[column.index];
      let value = cell?.value;
      if (typeof value === 'string' && value.startsWith('=')) {
        const result = parser.parse(value.substring(1));
        done(result.error ? 0 : result.result);
      } else {
        done(Number(value) || value || 0);
      }
    });

    parser.on('callRangeValue', (startCellCoord, endCellCoord, done) => {
      const fragment: any[] = [];
      for (let row = startCellCoord.row.index; row <= endCellCoord.row.index; row++) {
        const rowData: any[] = [];
        for (let col = startCellCoord.column.index; col <= endCellCoord.column.index; col++) {
          const cell = grid[row]?.[col];
          let value = cell?.value;
          if (typeof value === 'string' && value.startsWith('=')) {
            const result = parser.parse(value.substring(1));
            rowData.push(result.error ? 0 : result.result);
          } else {
            rowData.push(Number(value) || value || 0);
          }
        }
        fragment.push(rowData);
      }
      done(fragment);
    });

    // Add RANK function support
    parser.setFunction('RANK', (params) => {
      if (params.length < 2) return 0;
      const value = params[0];
      const range = params[1]; // This will be the fragment from callRangeValue
      
      if (!Array.isArray(range)) return 0;
      
      // Flatten range and filter numbers
      const values = range.flat().filter(v => typeof v === 'number').sort((a, b) => b - a);
      const rank = values.indexOf(value) + 1;
      return rank > 0 ? rank : 0;
    });

    const getCellValue = (cell: any) => {
      if (typeof cell?.value === 'string' && cell.value.startsWith('=')) {
        const result = parser.parse(cell.value.substring(1));
        return result.error ? '#ERR' : result.result;
      }
      return cell?.value || "";
    };

    return (
      <div className="bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse spreadsheet-zebra spreadsheet-compact">
            <thead>
              <tr className="bg-gray-50/50 text-gray-500 uppercase text-[9px] font-black tracking-widest border-b border-gray-100">
                {grid[0]?.map((cell, i) => {
                  const isFreeze = cell.value?.toString().toLowerCase().includes('tenda') || i === 0 || i === 1;
                  return (
                    <th key={i} className={cn(
                      "px-6 py-3 border-r border-gray-100 last:border-r-0 text-center whitespace-nowrap",
                      isFreeze && "freeze-pane bg-gray-50/90"
                    )}>
                      {cell.value}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {grid.slice(1).map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-gray-50/80 transition-all group">
                  {row.map((cell, cIdx) => {
                    const isFreeze = grid[0]?.[cIdx]?.value?.toString().toLowerCase().includes('tenda') || cIdx === 0 || cIdx === 1;
                    return (
                      <td key={cIdx} className={cn(
                        "px-6 py-3 border-r border-gray-100 last:border-r-0 text-center whitespace-nowrap",
                        isFreeze && "freeze-pane"
                      )}>
                        <span className={cn(
                          "text-xs font-bold",
                          cIdx === 1 ? "text-black" : "text-gray-500"
                        )}>
                          {getCellValue(cell)}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 sm:space-y-12">
      {/* Marquee Text */}
      {config?.marqueeText && (
        <div className="bg-black text-white py-3 marquee-container border-y border-gray-800">
          <div className="marquee-content font-black uppercase tracking-[0.3em] text-[10px] sm:text-xs">
            {config.marqueeText} • {config.marqueeText} • {config.marqueeText} • {config.marqueeText}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-6 space-y-4 sm:space-y-8">
        {/* Hero Section */}
        <div className="space-y-3 sm:space-y-4">
          {/* Main Tab Navigation */}
          <div className="flex justify-center">
            <div className="flex w-full bg-gray-100 p-1 rounded-[2rem] border border-gray-200 shadow-xl max-w-2xl">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveMainTab('berita')}
                  className={cn(
                    "flex-1 px-1 sm:px-8 py-2.5 sm:py-3.5 rounded-[1.5rem] text-[clamp(8px,2.5vw,12px)] sm:text-xs font-black uppercase tracking-tighter sm:tracking-widest transition-all flex items-center justify-center gap-1 sm:gap-2",
                    activeMainTab === 'berita'
                      ? "bg-black text-white shadow-xl shadow-gray-200 scale-[1.02]"
                      : "text-gray-500 hover:text-black hover:bg-gray-200/50"
                  )}
                >
                  <Newspaper className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="truncate">Berita</span>
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveMainTab('rekap')}
                  className={cn(
                    "flex-1 px-1 sm:px-8 py-2.5 sm:py-3.5 rounded-[1.5rem] text-[clamp(8px,2.5vw,12px)] sm:text-xs font-black uppercase tracking-tighter sm:tracking-widest transition-all flex items-center justify-center gap-1 sm:gap-2",
                    activeMainTab === 'rekap'
                      ? "bg-black text-white shadow-xl shadow-gray-200 scale-[1.02]"
                      : "text-black hover:bg-gray-200/50"
                  )}
                >
                  <Trophy className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="truncate">Rekap</span>
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveMainTab('laporan')}
                  className={cn(
                    "flex-1 px-1 sm:px-8 py-2.5 sm:py-3.5 rounded-[1.5rem] text-[clamp(8px,2.5vw,12px)] sm:text-xs font-black uppercase tracking-tighter sm:tracking-widest transition-all flex items-center justify-center gap-1 sm:gap-2",
                    activeMainTab === 'laporan'
                      ? "bg-black text-white shadow-xl shadow-gray-200 scale-[1.02]"
                      : "text-black hover:bg-gray-200/50"
                  )}
                >
                  <Download className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="truncate">Dokumen</span>
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveMainTab('tentang')}
                  className={cn(
                    "flex-1 px-1 sm:px-8 py-2.5 sm:py-3.5 rounded-[1.5rem] text-[clamp(8px,2.5vw,12px)] sm:text-xs font-black uppercase tracking-tighter sm:tracking-widest transition-all flex items-center justify-center gap-1 sm:gap-2",
                    activeMainTab === 'tentang'
                      ? "bg-black text-white shadow-xl shadow-gray-200 scale-[1.02]"
                      : "text-black hover:bg-gray-200/50"
                  )}
                >
                  <Info className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="truncate">Info</span>
                </motion.button>
              </div>
            </div>
          </div>
          
          <div className="border-t border-gray-100"></div>
        
        {activeMainTab === 'berita' ?
          /* News Section */
          <div className="space-y-6">
            <div className="flex items-end justify-between px-2">
              <div className="space-y-1">
                <h2 className="text-lg sm:text-xl md:text-2xl font-black text-black tracking-tighter uppercase">
                  Berita & <span className="text-gray-600">Dokumentasi</span>
                </h2>
                <p className="text-[10px] sm:text-xs text-gray-500 font-bold uppercase tracking-[0.2em]">Kabar terbaru dari lapangan</p>
              </div>
            </div>

            {/* Create Post Input */}
            {user && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-gray-100 p-4 shadow-xl flex items-center gap-4 cursor-pointer hover:bg-gray-50 transition-all"
                onClick={() => setIsCreatingPost(true)}
              >
                <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-gray-400">
                      <User className="h-5 w-5" />
                    </div>
                  )}
                </div>
                <div className="flex-grow bg-gray-50 rounded-full px-4 py-2.5 text-sm text-gray-500 font-medium border border-gray-100">
                  Apa yang Anda pikirkan, {user.displayName?.split(' ')[0]}?
                </div>
                <div className="flex items-center gap-2 text-emerald-500">
                  <ImageIcon className="h-5 w-5" />
                  <span className="hidden sm:inline text-xs font-black uppercase tracking-widest">Foto</span>
                </div>
              </motion.div>
            )}

            {berita.length > 0 ? (
              <div className="grid grid-cols-1 gap-6">
                {berita.map((item) => (
                  <motion.div 
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xl"
                  >
                    {/* Post Header */}
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-50 border border-gray-100">
                          {item.authorPhoto ? (
                            <img src={item.authorPhoto} alt={item.authorName} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-gray-400">
                              <User className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-black text-black text-sm hover:underline cursor-pointer flex items-center gap-2">
                            {item.authorName || 'Panitia'}
                            {item.authorEmail && (
                              <span className="text-[9px] font-bold text-gray-500 lowercase bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200">
                                {item.authorEmail}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                            {item.timestamp ? formatDistanceToNow(item.timestamp.toDate(), { addSuffix: true, locale: id }) : 'Baru saja'}
                            <span>•</span>
                            <User className="h-2.5 w-2.5" />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 relative">
                        <motion.button 
                          whileTap={{ scale: 0.9 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === item.id ? null : item.id);
                          }}
                          className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-all"
                        >
                          <MoreHorizontal className="h-5 w-5" />
                        </motion.button>

                        {openMenuId === item.id && (
                          <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-2xl border border-gray-100 py-1 z-50 animate-in fade-in zoom-in-95 duration-200">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(null);
                                handleSharePost(item.id);
                              }}
                              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              <Share2 className="h-4 w-4" />
                              <span>Salin Tautan</span>
                            </button>
                            {(isAdmin || user?.uid === item.authorId) && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(null);
                                  setConfirmDeleteId(item.id);
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                                <span>Hapus Postingan</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Post Content */}
                    <div className="px-4 pb-3 space-y-3">
                      {item.title && <h3 className="text-lg font-black text-black leading-tight">{item.title}</h3>}
                      <div className="relative">
                        <p className={cn(
                          "text-sm text-gray-800 font-medium leading-relaxed whitespace-pre-wrap",
                          !expandedPosts.has(item.id) && item.content.length > 300 && "line-clamp-4"
                        )}>
                          {item.content}
                        </p>
                        {!expandedPosts.has(item.id) && item.content.length > 300 && (
                          <button 
                            onClick={() => setExpandedPosts(prev => new Set(prev).add(item.id))}
                            className="text-sm font-bold text-gray-500 hover:text-black mt-1"
                          >
                            Lihat selengkapnya...
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Post Media */}
                    {item.mediaUrl && (
                      <div className="bg-gray-50 border-y border-gray-100">
                        {item.mediaType === 'video' ? (
                          <video src={item.mediaUrl} controls className="w-full max-h-[600px] object-contain mx-auto" />
                        ) : (
                          <img src={item.mediaUrl} alt={item.title} className="w-full max-h-[600px] object-contain mx-auto" referrerPolicy="no-referrer" />
                        )}
                      </div>
                    )}

                    {/* Post Stats */}
                    {(item.likes?.length > 0) && (
                      <div className="px-4 py-2 flex items-center justify-between border-b border-gray-100">
                        <div className="flex items-center gap-1.5">
                          <div className="flex -space-x-1">
                            <div className="h-4 w-4 rounded-full bg-red-600 flex items-center justify-center ring-2 ring-white">
                              <Heart className="h-2.5 w-2.5 text-white fill-current" />
                            </div>
                          </div>
                          <span className="text-xs text-gray-500 font-bold">{item.likes.length}</span>
                        </div>
                      </div>
                    )}

                    {/* Post Actions */}
                    <div className="px-2 py-1 flex items-center justify-around border-b border-gray-100">
                      <motion.button 
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleLikePost(item)}
                        className={cn(
                          "flex-grow flex items-center justify-center gap-2 py-2 hover:bg-gray-50 rounded-lg transition-colors text-sm font-bold",
                          item.likes?.includes(user?.uid || '') ? "text-red-500" : "text-gray-500"
                        )}
                      >
                        <Heart className={cn("h-5 w-5", item.likes?.includes(user?.uid || '') && "fill-current")} />
                        <span>Suka</span>
                      </motion.button>
                      <motion.button 
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          commentRefs.current[item.id]?.focusInput();
                        }}
                        className="flex-grow flex items-center justify-center gap-2 py-2 hover:bg-gray-50 rounded-lg transition-colors text-gray-500 text-sm font-bold"
                      >
                        <MessageCircle className="h-5 w-5" />
                        <span>Komentar</span>
                      </motion.button>
                      <motion.button 
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleSharePost(item.id)}
                        className="flex-grow flex items-center justify-center gap-2 py-2 hover:bg-gray-50 rounded-lg transition-colors text-gray-500 text-sm font-bold"
                      >
                        <Share2 className="h-5 w-5" />
                        <span>Bagikan</span>
                      </motion.button>
                    </div>

                    {/* Comment Section */}
                    <div className="px-4 pb-4">
                      <CommentSection 
                        ref={el => commentRefs.current[item.id] = el}
                        postId={item.id} 
                        isAdmin={isAdmin} 
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="py-20 text-center bg-gray-50 rounded-2xl border border-gray-100 border-dashed shadow-sm">
                <div className="bg-gray-100 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Newspaper className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-gray-500 font-black uppercase tracking-widest text-xs">Belum ada berita diposting</p>
              </div>
            )}
          </div>
        : activeMainTab === 'rekap' ?
          /* Detailed Leaderboard Tables Section */
          <div id="leaderboard" className="scroll-mt-32 space-y-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="text-center space-y-4">
              <h2 className="text-3xl sm:text-5xl font-black text-black uppercase tracking-tighter leading-none">
                Rekapitulasi Nilai <span className="text-gray-500">LT2 Jatinagara</span>
              </h2>
              <div className="flex items-center justify-center gap-4">
                <div className="h-px w-12 bg-gray-200"></div>
                <p className="text-[10px] sm:text-xs text-gray-400 font-black uppercase tracking-[0.3em]">Update: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                <div className="h-px w-12 bg-gray-200"></div>
              </div>
            </div>

            <div className="space-y-20">
              {/* Global Report Section in Rekap Tab */}
              {laporanData.length > 0 && (
                <div className="space-y-8">
                  <div className="flex items-center gap-6 px-4">
                    <div className="h-1 w-12 bg-emerald-500 rounded-full"></div>
                    <h3 className="text-xl sm:text-2xl font-black text-black uppercase tracking-tight">Laporan Rekapitulasi Global</h3>
                    <div className="h-px flex-grow bg-gray-100"></div>
                    <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100 uppercase tracking-widest">
                      Global Report
                    </span>
                  </div>
                  <RekapTable grid={laporanData} />
                </div>
              )}

              {[
                { id: 'SD Putra', label: 'Putra SD/MI' },
                { id: 'SMP Putra', label: 'Putra SMP/MTS' },
                { id: 'SD Putri', label: 'Putri SD/MI' },
                { id: 'SMP Putri', label: 'Putri SMP/MTS' }
              ].map(cat => {
                const grid = rekapData[cat.id];
                if (!grid || grid.length <= 1) return null;

                return (
                  <div key={cat.id} className="space-y-8">
                    <div className="flex items-center gap-6 px-4">
                      <div className="h-1 w-12 bg-black rounded-full"></div>
                      <h3 className="text-xl sm:text-2xl font-black text-black uppercase tracking-tight">{cat.label}</h3>
                      <div className="h-px flex-grow bg-gray-100"></div>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-4 py-2 rounded-full border border-gray-100">
                        {grid.slice(1).filter(row => row[0]?.value && !isNaN(Number(row[0].value))).length} Regu
                      </span>
                    </div>
                    
                    <RekapTable grid={grid} />
                  </div>
                );
              })}

              {Object.keys(rekapData).length === 0 && (
                <div className="py-32 text-center space-y-6">
                  <div className="bg-gray-50 h-24 w-24 rounded-full flex items-center justify-center mx-auto border border-gray-100">
                    <FileSpreadsheet className="h-12 w-12 text-gray-200" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-black font-black uppercase tracking-[0.25em] text-sm">Belum Ada Rekap Nilai</p>
                    <p className="text-gray-400 text-xs font-medium">Panitia sedang memproses hasil penilaian.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        : activeMainTab === 'laporan' ?
          /* Dokumen Section */
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="text-center space-y-4">
              <h2 className="text-3xl sm:text-5xl font-black text-black uppercase tracking-tighter leading-none">
                Dokumen <span className="text-gray-500">Kegiatan</span>
              </h2>
              <div className="flex items-center justify-center gap-4">
                <div className="h-px w-12 bg-gray-200"></div>
                <p className="text-[10px] sm:text-xs text-gray-400 font-black uppercase tracking-[0.3em]">Unduh Petunjuk & Administrasi</p>
                <div className="h-px w-12 bg-gray-200"></div>
              </div>
            </div>
            
            <div className="bg-white rounded-[2.5rem] sm:rounded-[3.5rem] border border-gray-100 shadow-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-black text-white">
                      <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] w-16 text-center">No</th>
                      <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em]">Nama Dokumen</th>
                      <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em]">Kategori</th>
                      <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {dokumen.length > 0 ? (
                      dokumen.map((doc, index) => (
                        <tr key={doc.id} className="hover:bg-gray-50 transition-colors group">
                          <td className="px-6 py-5 text-sm font-black text-gray-400 text-center">{index + 1}</td>
                          <td className="px-6 py-5">
                            <div className="flex flex-col">
                              <span className="text-sm font-black text-black group-hover:text-blue-600 transition-colors">{doc.nama}</span>
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                                {doc.timestamp ? new Date(doc.timestamp.toDate()).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Baru saja'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <span className="px-3 py-1 bg-gray-100 rounded-full text-[10px] font-black text-gray-600 uppercase tracking-widest border border-gray-200">
                              {doc.kategori || 'Umum'}
                            </span>
                          </td>
                          <td className="px-6 py-5 text-center">
                            <motion.a
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 bg-black text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-gray-200 hover:bg-gray-800 transition-all"
                            >
                              <Download className="h-3 w-3" />
                              <span>Unduh</span>
                            </motion.a>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-32 text-center">
                          <div className="space-y-4">
                            <div className="bg-gray-50 h-16 w-16 rounded-full flex items-center justify-center mx-auto border border-gray-100">
                              <Download className="h-8 w-8 text-gray-200" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-black font-black uppercase tracking-widest text-xs">Belum Ada Dokumen</p>
                              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Silakan cek kembali nanti</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        :
          /* About Section */
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="space-y-1">
              <h2 className="text-[clamp(8px,3.5vw,24px)] sm:text-xl md:text-2xl font-black text-black tracking-tighter uppercase whitespace-nowrap">
                Tentang <span className="text-gray-500">LT2 Kwarran Jatinagara</span>
              </h2>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-[0.2em]">Informasi seputar kegiatan</p>
            </div>

            <div className="bg-white rounded-[3rem] border border-gray-200 overflow-hidden shadow-xl">
              <div className="p-8 sm:p-12">
                <div className="block">
                  {(config?.aboutImage || 'https://i.imgur.com/bOD7Igj.png') && (
                    <div className="w-full md:w-1/2 lg:w-2/5 md:float-right md:ml-8 mb-6 md:mb-4">
                      <img 
                        src={config?.aboutImage || 'https://i.imgur.com/bOD7Igj.png'} 
                        alt="LT2 Kwarran Jatinagara" 
                        className="w-full h-auto object-cover rounded-2xl shadow-lg border border-gray-100"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}
                  <div className="prose max-w-none">
                    {(config?.aboutContent || `Assalamu'alaiakum Wr Wb
Salam Pramuka
Kakak - Kakak pembina pramuka semua dan seluruh pramuka di kwarran jatinagara dan yang berada diseluruh indonesia, kwarran Jatinagara Kwarcab Ciamis pada tahun 2026 ini akan menyelenggarakan LT2 lomba tingkat 2 pramuka penggalang. platform ini kami sediakan untuk memberikan akses informasi secara transparan mulai dari persiapan sampai pasca kegiatan. untuk itu silahkan kakak kakak update untuk mendapatkan informasi dan bersilaturahmi dengan sesama pramuka yang berada di kwarcab ciamis.

kami menyadari pasti ada kekurangan yang perlu dibenahi agar kegiatan LT2 ini dapat mendekati sempurna, kritik dan saran kami harapkan agar menjadi bahan berbenah bagi kami dari pramuka kwarran jatinagara, pramuka ciamis atau pramuka diseluruh indonesia.

H. dadi Supriadi, S.Pd, SD
Ketua Kwarran Jatinagara`) ? (
                      <div className="text-black font-medium leading-relaxed whitespace-pre-wrap text-lg">
                        {config?.aboutContent || `Assalamu'alaiakum Wr Wb
Salam Pramuka
Kakak - Kakak pembina pramuka semua dan seluruh pramuka di kwarran jatinagara dan yang berada diseluruh indonesia, kwarran Jatinagara Kwarcab Ciamis pada tahun 2026 ini akan menyelenggarakan LT2 lomba tingkat 2 pramuka penggalang. platform ini kami sediakan untuk memberikan akses informasi secara transparan mulai dari persiapan sampai pasca kegiatan. untuk itu silahkan kakak kakak update untuk mendapatkan informasi dan bersilaturahmi dengan sesama pramuka yang berada di kwarcab ciamis.

kami menyadari pasti ada kekurangan yang perlu dibenahi agar kegiatan LT2 ini dapat mendekati sempurna, kritik dan saran kami harapkan agar menjadi bahan berbenah bagi kami dari pramuka kwarran jatinagara, pramuka ciamis atau pramuka diseluruh indonesia.

H. dadi Supriadi, S.Pd, SD
Ketua Kwarran Jatinagara`}
                      </div>
                    ) : (
                      <div className="py-20 text-center bg-gray-50 rounded-3xl border border-gray-200 border-dashed">
                        <p className="text-gray-400 font-black uppercase tracking-widest text-xs">Belum ada informasi yang ditambahkan</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        }
      </div>

      {/* Create Post Modal */}
      {isCreatingPost && user &&
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-gray-200"
          >
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-black text-black uppercase tracking-tight">Buat Postingan</h3>
              <motion.button 
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  setIsCreatingPost(false);
                  setSelectedFile(null);
                  setFilePreview(null);
                  setNewPostMediaUrl('');
                }} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <ChevronDown className="h-6 w-6 text-gray-400" />
              </motion.button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-100 border border-gray-200">
                  {user.photoURL && <img src={user.photoURL} alt="" className="h-full w-full object-cover" />}
                </div>
                <div>
                  <div className="font-black text-black text-sm">{user.displayName}</div>
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-gray-100 px-2 py-0.5 rounded-full inline-block">Publik</div>
                </div>
              </div>

              <textarea
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder={`Apa yang Anda pikirkan, ${user.displayName?.split(' ')[0]}?`}
                rows={4}
                className="w-full text-lg outline-none resize-none font-medium bg-transparent text-black placeholder:text-gray-400"
                autoFocus
              />

              {filePreview && (
                <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                  <div className="absolute top-2 right-2 flex gap-2 z-10">
                    {selectedFile?.type.startsWith('image/') && (
                      <motion.button 
                        whileTap={{ scale: 0.9 }}
                        onClick={handleGenerateAICaption}
                        disabled={isGeneratingCaption}
                        className={cn(
                          "p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg transition-all flex items-center gap-1 px-3",
                          isGeneratingCaption && "opacity-50 cursor-not-allowed"
                        )}
                        title="Buat Caption dengan AI"
                      >
                        <Sparkles className={cn("h-4 w-4", isGeneratingCaption && "animate-pulse")} />
                        <span className="text-[10px] font-black uppercase tracking-widest">AI Caption</span>
                      </motion.button>
                    )}
                    <motion.button 
                      whileTap={{ scale: 0.9 }}
                      onClick={() => {
                        setSelectedFile(null);
                        setFilePreview(null);
                        setNewPostMediaUrl('');
                      }}
                      className="p-1.5 bg-black/50 hover:bg-black text-white rounded-full transition-all"
                    >
                      <ChevronDown className="h-4 w-4 rotate-180" />
                    </motion.button>
                  </div>
                  {newPostMediaType === 'video' ? (
                    <video src={filePreview} className="w-full max-h-64 object-contain" controls />
                  ) : (
                    <img src={filePreview} alt="Preview" className="w-full max-h-64 object-contain" />
                  )}
                </div>
              )}

              <div className="space-y-3 p-4 border border-gray-200 rounded-xl bg-gray-50/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Tambahkan ke Postingan</span>
                  <div className="flex gap-2">
                    <motion.label 
                      whileTap={{ scale: 0.9 }}
                      className="p-2 rounded-lg transition-colors hover:bg-gray-100 text-emerald-500 cursor-pointer"
                    >
                      <ImageIcon className="h-5 w-5" />
                      <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                    </motion.label>
                    <motion.label 
                      whileTap={{ scale: 0.9 }}
                      className="p-2 rounded-lg transition-colors hover:bg-gray-100 text-red-500 cursor-pointer"
                    >
                      <Play className="h-5 w-5" />
                      <input type="file" accept="video/*" className="hidden" onChange={handleFileChange} />
                    </motion.label>
                  </div>
                </div>
              </div>

              {isSubmittingPost && (
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-500">
                    <span>{uploadProgress < 100 ? 'Sedang Mengunggah...' : 'Menyimpan Postingan...'}</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress}%` }}
                      className="h-full bg-emerald-500"
                    />
                  </div>
                </div>
              )}

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleCreatePost}
                disabled={isSubmittingPost || (!newPostContent.trim() && !selectedFile)}
                className="w-full py-3 rounded-xl bg-black text-white font-black uppercase tracking-widest hover:bg-gray-900 transition-all disabled:opacity-50 shadow-lg shadow-gray-200"
              >
                {isSubmittingPost ? (uploadProgress < 100 ? 'MENGUNGGAH...' : 'MEMPOSTING...') : 'Posting'}
              </motion.button>
            </div>
          </motion.div>
        </div>
      }

      {/* Toast Notification */}
      {toast &&
        <div className={cn(
          "fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-2xl shadow-2xl font-black uppercase tracking-widest text-xs animate-in slide-in-from-bottom-4 duration-300",
          toast.type === 'success' ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
        )}>
          {toast.message}
        </div>
      }
      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => confirmDeleteId && handleDeletePost(confirmDeleteId)}
        title="Hapus Postingan"
        message="Apakah Anda yakin ingin menghapus postingan ini secara permanen? Tindakan ini tidak dapat dibatalkan."
        confirmLabel="Hapus Sekarang"
      />
    </div>
  );
}

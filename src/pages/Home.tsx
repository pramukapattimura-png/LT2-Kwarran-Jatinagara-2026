import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { db, collection, onSnapshot, query, orderBy, doc, auth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, addDoc, serverTimestamp, updateDoc, arrayUnion, arrayRemove, deleteDoc, handleFirestoreError, OperationType } from '../firebase';
import { Regu, Lomba, Nilai, Kategori, ScoreSummary, Berita, AppConfig, RekapNilai } from '../types';
import { Trophy, Medal, Search, Filter, ChevronRight, ChevronDown, Newspaper, Play, Image as ImageIcon, ArrowDownCircle, Heart, MessageCircle, Share2, MoreHorizontal, Trash2, LogIn, User, Info, FileSpreadsheet, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import CommentSection, { CommentSectionRef } from '../components/CommentSection';
import ConfirmModal from '../components/ConfirmModal';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { Parser } from 'hot-formula-parser';

export default function Home() {
  const [regus, setRegus] = useState<Regu[]>([]);
  const [lombas, setLombas] = useState<Lomba[]>([]);
  const [nilais, setNilais] = useState<Nilai[]>([]);
  const [berita, setBerita] = useState<Berita[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [rekapData, setRekapData] = useState<Record<string, any[][]>>({});
  const [activeKategori, setActiveKategori] = useState<Kategori | 'Semua'>('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRegu, setExpandedRegu] = useState<string | null>(null);
  const [activeMainTab, setActiveMainTab] = useState<'berita' | 'rekap' | 'tentang' | 'drive'>('berita');
  const [user, setUser] = useState(auth.currentUser);

  const isAdmin = useMemo(() => {
    if (!user) return false;
    return config?.adminEmails?.includes(user.email || '') || user.email === 'pramukapattimura@gmail.com';
  }, [user, config]);

  // Post creation state
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostMediaUrl, setNewPostMediaUrl] = useState('');
  const [newPostMediaType, setNewPostMediaType] = useState<'image' | 'video'>('image');
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);
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

    const categories: Kategori[] = ['SD Putra', 'SD Putri', 'SMP Putra', 'SMP Putri'];
    const unsubRekaps = categories.map(cat => 
      onSnapshot(doc(db, 'settings', `rekap_${cat.replace(' ', '_')}`), (s) => {
        if (s.exists()) {
          const data = s.data() as RekapNilai;
          setRekapData(prev => ({ ...prev, [cat]: data.grid }));
        }
      })
    );

    return () => { 
      unsubRegu(); unsubLomba(); unsubNilai(); unsubBerita(); unsubConfig(); 
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

    // Limit size to 800KB for Firestore documents
    if (file.size > 500 * 1024) {
      setToast({ message: 'Ukuran file terlalu besar (maks 500KB).', type: 'error' });
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setFilePreview(reader.result as string);
      setNewPostMediaUrl(reader.result as string);
      setNewPostMediaType(file.type.startsWith('video') ? 'video' : 'image');
    };
    reader.readAsDataURL(file);
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newPostContent.trim()) return;

    setIsSubmittingPost(true);
    try {
      const path = 'berita';
      await addDoc(collection(db, path), {
        title: '', // Title is optional now
        content: newPostContent.trim(),
        mediaUrl: newPostMediaUrl.trim(),
        mediaType: newPostMediaType,
        timestamp: serverTimestamp(),
        authorId: user.uid,
        authorName: user.displayName || 'Anonim',
        authorEmail: user.email || '',
        authorPhoto: user.photoURL || '',
        likes: []
      });
      setNewPostContent('');
      setNewPostMediaUrl('');
      setSelectedFile(null);
      setFilePreview(null);
      setIsCreatingPost(false);
      setToast({ message: 'Postingan berhasil dibagikan!', type: 'success' });
    } catch (error) {
      console.error('Error creating post:', error);
      try {
        handleFirestoreError(error, OperationType.CREATE, 'berita');
      } catch (err: any) {
        let errorMessage = 'Gagal membuat postingan.';
        try {
          const parsed = JSON.parse(err.message);
          if (parsed.error) errorMessage = `Gagal: ${parsed.error}`;
        } catch {
          // Not JSON
        }
        setToast({ message: errorMessage, type: 'error' });
      }
    } finally {
      setIsSubmittingPost(false);
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
        done(Number(value) || 0);
      }
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
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 text-gray-500 uppercase text-[9px] font-black tracking-widest border-b border-gray-100">
                {grid[0]?.map((cell, i) => (
                  <th key={i} className="px-6 py-4 border-r border-gray-100 last:border-r-0 text-center">
                    {cell.value}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {grid.slice(1).map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-gray-50/80 transition-all group">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className={cn(
                      "px-6 py-4 text-sm font-black border-r border-gray-100 last:border-r-0 text-center tabular-nums",
                      cIdx === 0 ? "text-gray-400" : "text-gray-800"
                    )}>
                      {getCellValue(cell)}
                    </td>
                  ))}
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
                  onClick={() => setActiveMainTab('drive')}
                  className={cn(
                    "flex-1 px-1 sm:px-8 py-2.5 sm:py-3.5 rounded-[1.5rem] text-[clamp(8px,2.5vw,12px)] sm:text-xs font-black uppercase tracking-tighter sm:tracking-widest transition-all flex items-center justify-center gap-1 sm:gap-2",
                    activeMainTab === 'drive'
                      ? "bg-black text-white shadow-xl shadow-gray-200 scale-[1.02]"
                      : "text-black hover:bg-gray-200/50"
                  )}
                >
                  <FileSpreadsheet className="h-3 w-3 sm:h-4 sm:w-4" />
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
            {/* Create Post Section - Prominent and accessible */}
            <div className="z-30 -mx-2 px-2 pb-2 bg-white/80 backdrop-blur-sm">
              <div className="bg-white rounded-2xl border border-gray-200 p-3 sm:p-4 shadow-xl space-y-4 ring-1 ring-gray-100">
                <div className="flex gap-3">
                  <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0">
                    {user?.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName || ''} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-gray-400">
                        <User className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  {user ? (
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setIsCreatingPost(true)}
                      className="flex-grow bg-gray-50 hover:bg-gray-100 rounded-full px-4 py-2 text-left text-gray-500 font-medium transition-colors text-sm border border-gray-200"
                    >
                      Apa yang Anda pikirkan, {user.displayName?.split(' ')[0]}?
                    </motion.button>
                  ) : (
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={handleLogin}
                      className="flex-grow flex items-center gap-3 bg-black hover:bg-gray-900 text-white rounded-full px-4 py-2 text-left transition-colors text-sm font-black uppercase tracking-widest shadow-lg"
                    >
                      <LogIn className="h-4 w-4" />
                      <span>Login untuk Berbagi</span>
                    </motion.button>
                  )}
                </div>
                
                <div className="flex items-center gap-1 pt-2 border-t border-gray-100">
                  <motion.label 
                    whileTap={{ scale: 0.95 }}
                    className="flex-grow flex items-center justify-center gap-2 py-2 hover:bg-gray-50 rounded-lg transition-colors text-gray-600 text-xs sm:text-sm font-bold cursor-pointer"
                  >
                    <ImageIcon className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500" />
                    <span>Foto</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => {
                        if (user) {
                          handleFileChange(e);
                          setIsCreatingPost(true);
                        } else {
                          handleLogin();
                        }
                      }} 
                    />
                  </motion.label>
                  <motion.label 
                    whileTap={{ scale: 0.95 }}
                    className="flex-grow flex items-center justify-center gap-2 py-2 hover:bg-gray-50 rounded-lg transition-colors text-gray-600 text-xs sm:text-sm font-bold cursor-pointer"
                  >
                    <Play className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
                    <span>Video</span>
                    <input 
                      type="file" 
                      accept="video/*" 
                      className="hidden" 
                      onChange={(e) => {
                        if (user) {
                          handleFileChange(e);
                          setIsCreatingPost(true);
                        } else {
                          handleLogin();
                        }
                      }} 
                    />
                  </motion.label>
                </div>
              </div>
            </div>

            <div className="flex items-end justify-between px-2">
              <div className="space-y-1">
                <h2 className="text-lg sm:text-xl md:text-2xl font-black text-black tracking-tighter uppercase">
                  Berita & <span className="text-gray-600">Dokumentasi</span>
                </h2>
                <p className="text-[10px] sm:text-xs text-gray-500 font-bold uppercase tracking-[0.2em]">Kabar terbaru dari lapangan</p>
              </div>
            </div>

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
                        {grid.length - 1} Regu
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
        : activeMainTab === 'drive' ?
          /* Google Drive Section */
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="space-y-1">
              <h2 className="text-[clamp(8px,3.5vw,24px)] sm:text-xl md:text-2xl font-black text-black tracking-tighter uppercase whitespace-nowrap">
                Dokumen <span className="text-gray-500">LT2 Jatinagara</span>
              </h2>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-[0.2em]">Konten eksternal dari Google Drive</p>
            </div>
            
            <div className="bg-white rounded-[3rem] border border-gray-200 overflow-hidden shadow-2xl h-[80vh]">
              <iframe 
                src="https://drive.google.com/file/d/1mp3R59AdgntQM_B0xYCDeZUi2gfvsb5H/preview" 
                className="w-full h-full border-none"
                allow="autoplay"
              ></iframe>
            </div>
            <div className="flex justify-center">
              <motion.a 
                whileTap={{ scale: 0.95 }}
                href="https://drive.google.com/file/d/1mp3R59AdgntQM_B0xYCDeZUi2gfvsb5H/view?usp=sharing" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-black text-white text-xs font-black uppercase tracking-widest hover:bg-gray-900 transition-all shadow-xl shadow-gray-200"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Buka di Google Drive
              </motion.a>
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
                  <motion.button 
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      setSelectedFile(null);
                      setFilePreview(null);
                      setNewPostMediaUrl('');
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black text-white rounded-full transition-all z-10"
                  >
                    <ChevronDown className="h-4 w-4 rotate-180" />
                  </motion.button>
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

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleCreatePost}
                disabled={isSubmittingPost || !newPostContent.trim()}
                className="w-full py-3 rounded-xl bg-black text-white font-black uppercase tracking-widest hover:bg-gray-900 transition-all disabled:opacity-50 shadow-lg shadow-gray-200"
              >
                {isSubmittingPost ? 'Memposting...' : 'Posting'}
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

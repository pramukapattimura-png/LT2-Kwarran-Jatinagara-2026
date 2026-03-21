import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { db, collection, onSnapshot, query, orderBy, doc, auth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, addDoc, serverTimestamp, updateDoc, arrayUnion, arrayRemove, deleteDoc, handleFirestoreError, OperationType } from '../firebase';
import { Regu, Lomba, Nilai, Kategori, ScoreSummary, Berita, AppConfig } from '../types';
import { Trophy, Medal, Search, Filter, ChevronRight, ChevronDown, Newspaper, Play, Image as ImageIcon, ArrowDownCircle, Heart, MessageCircle, Share2, MoreHorizontal, Trash2, LogIn, User, Info, FileSpreadsheet } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import CommentSection, { CommentSectionRef } from '../components/CommentSection';
import ConfirmModal from '../components/ConfirmModal';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';

export default function Home() {
  const [regus, setRegus] = useState<Regu[]>([]);
  const [lombas, setLombas] = useState<Lomba[]>([]);
  const [nilais, setNilais] = useState<Nilai[]>([]);
  const [berita, setBerita] = useState<Berita[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
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

    return () => { unsubRegu(); unsubLomba(); unsubNilai(); unsubBerita(); unsubConfig(); };
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

  return (
    <div className="space-y-8 sm:space-y-12">
      {/* Marquee Text */}
      {config?.marqueeText && (
        <div className="bg-brown-900 text-white py-3 marquee-container border-y border-brown-800">
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
            <div className="flex w-full bg-brown-900/50 backdrop-blur-md p-1 rounded-[2rem] border border-brown-800 shadow-2xl max-w-2xl">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveMainTab('berita')}
                  className={cn(
                    "flex-1 px-1 sm:px-8 py-2.5 sm:py-3.5 rounded-[1.5rem] text-[clamp(8px,2.5vw,12px)] sm:text-xs font-black uppercase tracking-tighter sm:tracking-widest transition-all flex items-center justify-center gap-1 sm:gap-2",
                    activeMainTab === 'berita'
                      ? "bg-brown-500 text-white shadow-xl shadow-brown-900/50 scale-[1.02]"
                      : "text-brown-400 hover:text-brown-200 hover:bg-brown-800/50"
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
                      ? "bg-brown-500 text-white shadow-xl shadow-brown-900/50 scale-[1.02]"
                      : "text-brown-400 hover:text-brown-200 hover:bg-brown-800/50"
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
                      ? "bg-brown-500 text-white shadow-xl shadow-brown-900/50 scale-[1.02]"
                      : "text-brown-400 hover:text-brown-200 hover:bg-brown-800/50"
                  )}
                >
                  <FileSpreadsheet className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="truncate">Juknis</span>
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveMainTab('tentang')}
                  className={cn(
                    "flex-1 px-1 sm:px-8 py-2.5 sm:py-3.5 rounded-[1.5rem] text-[clamp(8px,2.5vw,12px)] sm:text-xs font-black uppercase tracking-tighter sm:tracking-widest transition-all flex items-center justify-center gap-1 sm:gap-2",
                    activeMainTab === 'tentang'
                      ? "bg-brown-500 text-white shadow-xl shadow-brown-900/50 scale-[1.02]"
                      : "text-brown-400 hover:text-brown-200 hover:bg-brown-800/50"
                  )}
                >
                  <Info className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="truncate">Info</span>
                </motion.button>
              </div>
            </div>
          </div>
          
          <div className="border-t border-brown-100"></div>
        
        {activeMainTab === 'berita' ?
          /* News Section */
          <div className="space-y-6">
            {/* Create Post Section - Prominent and accessible */}
            <div className="sticky top-[72px] sm:top-[88px] z-30 -mx-2 px-2 pb-2 bg-brown-50/30 backdrop-blur-sm">
              <div className="bg-brown-900/60 backdrop-blur-xl rounded-2xl border border-brown-800 p-3 sm:p-4 shadow-2xl space-y-4 ring-1 ring-brown-700/50">
                <div className="flex gap-3">
                  <div className="h-10 w-10 rounded-full overflow-hidden bg-brown-800 border border-brown-700 flex-shrink-0">
                    {user?.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName || ''} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-brown-400">
                        <User className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  {user ? (
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setIsCreatingPost(true)}
                      className="flex-grow bg-brown-800/50 hover:bg-brown-800 rounded-full px-4 py-2 text-left text-brown-300 font-medium transition-colors text-sm border border-brown-700/30"
                    >
                      Apa yang Anda pikirkan, {user.displayName?.split(' ')[0]}?
                    </motion.button>
                  ) : (
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={handleLogin}
                      className="flex-grow flex items-center gap-3 bg-brown-600 hover:bg-brown-500 text-white rounded-full px-4 py-2 text-left transition-colors text-sm font-black uppercase tracking-widest shadow-lg shadow-brown-950/20"
                    >
                      <LogIn className="h-4 w-4" />
                      <span>Login untuk Berbagi</span>
                    </motion.button>
                  )}
                </div>
                
                <div className="flex items-center gap-1 pt-2 border-t border-brown-800/50">
                  <motion.label 
                    whileTap={{ scale: 0.95 }}
                    className="flex-grow flex items-center justify-center gap-2 py-2 hover:bg-brown-800/50 rounded-lg transition-colors text-brown-300 text-xs sm:text-sm font-bold cursor-pointer"
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
                    className="flex-grow flex items-center justify-center gap-2 py-2 hover:bg-brown-800/50 rounded-lg transition-colors text-brown-300 text-xs sm:text-sm font-bold cursor-pointer"
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
                <h2 className="text-lg sm:text-xl md:text-2xl font-black text-brown-900 tracking-tighter uppercase">
                  Berita & <span className="text-brown-500">Dokumentasi</span>
                </h2>
                <p className="text-[10px] sm:text-xs text-brown-400 font-bold uppercase tracking-[0.2em]">Kabar terbaru dari lapangan</p>
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
                    className="bg-brown-900/40 backdrop-blur-md rounded-2xl border border-brown-800 overflow-hidden shadow-2xl"
                  >
                    {/* Post Header */}
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full overflow-hidden bg-brown-800 border border-brown-700">
                          {item.authorPhoto ? (
                            <img src={item.authorPhoto} alt={item.authorName} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-brown-400">
                              <User className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-black text-brown-50 text-sm hover:underline cursor-pointer flex items-center gap-2">
                            {item.authorName || 'Panitia'}
                            {item.authorEmail && (
                              <span className="text-[9px] font-bold text-brown-400 lowercase bg-brown-800 px-1.5 py-0.5 rounded border border-brown-700">
                                {item.authorEmail}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-bold text-brown-500 uppercase tracking-widest flex items-center gap-1">
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
                          className="p-2 text-brown-400 hover:bg-brown-800 rounded-full transition-all"
                        >
                          <MoreHorizontal className="h-5 w-5" />
                        </motion.button>

                        {openMenuId === item.id && (
                          <div className="absolute right-0 top-full mt-1 w-48 bg-brown-900 rounded-xl shadow-2xl border border-brown-800 py-1 z-50 animate-in fade-in zoom-in-95 duration-200">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(null);
                                handleSharePost(item.id);
                              }}
                              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-brown-300 hover:bg-brown-800 transition-colors"
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
                                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:bg-red-900/30 transition-colors"
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
                      {item.title && <h3 className="text-lg font-black text-brown-50 leading-tight">{item.title}</h3>}
                      <div className="relative">
                        <p className={cn(
                          "text-sm text-brown-200 font-medium leading-relaxed whitespace-pre-wrap",
                          !expandedPosts.has(item.id) && item.content.length > 300 && "line-clamp-4"
                        )}>
                          {item.content}
                        </p>
                        {!expandedPosts.has(item.id) && item.content.length > 300 && (
                          <button 
                            onClick={() => setExpandedPosts(prev => new Set(prev).add(item.id))}
                            className="text-sm font-bold text-brown-400 hover:text-brown-50 mt-1"
                          >
                            Lihat selengkapnya...
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Post Media */}
                    {item.mediaUrl && (
                      <div className="bg-brown-950/50 border-y border-brown-800">
                        {item.mediaType === 'video' ? (
                          <video src={item.mediaUrl} controls className="w-full max-h-[600px] object-contain mx-auto" />
                        ) : (
                          <img src={item.mediaUrl} alt={item.title} className="w-full max-h-[600px] object-contain mx-auto" referrerPolicy="no-referrer" />
                        )}
                      </div>
                    )}

                    {/* Post Stats */}
                    {(item.likes?.length > 0) && (
                      <div className="px-4 py-2 flex items-center justify-between border-b border-brown-800">
                        <div className="flex items-center gap-1.5">
                          <div className="flex -space-x-1">
                            <div className="h-4 w-4 rounded-full bg-red-600 flex items-center justify-center ring-2 ring-brown-900">
                              <Heart className="h-2.5 w-2.5 text-white fill-current" />
                            </div>
                          </div>
                          <span className="text-xs text-brown-400 font-bold">{item.likes.length}</span>
                        </div>
                      </div>
                    )}

                    {/* Post Actions */}
                    <div className="px-2 py-1 flex items-center justify-around border-b border-brown-800">
                      <motion.button 
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleLikePost(item)}
                        className={cn(
                          "flex-grow flex items-center justify-center gap-2 py-2 hover:bg-brown-800/50 rounded-lg transition-colors text-sm font-bold",
                          item.likes?.includes(user?.uid || '') ? "text-red-500" : "text-brown-400"
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
                        className="flex-grow flex items-center justify-center gap-2 py-2 hover:bg-brown-800/50 rounded-lg transition-colors text-brown-400 text-sm font-bold"
                      >
                        <MessageCircle className="h-5 w-5" />
                        <span>Komentar</span>
                      </motion.button>
                      <motion.button 
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleSharePost(item.id)}
                        className="flex-grow flex items-center justify-center gap-2 py-2 hover:bg-brown-800/50 rounded-lg transition-colors text-brown-400 text-sm font-bold"
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
              <div className="py-20 text-center bg-brown-900/40 backdrop-blur-md rounded-2xl border border-brown-800 border-dashed shadow-2xl">
                <div className="bg-brown-800 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Newspaper className="h-8 w-8 text-brown-600" />
                </div>
                <p className="text-brown-500 font-black uppercase tracking-widest text-xs">Belum ada berita diposting</p>
              </div>
            )}
          </div>
        : activeMainTab === 'rekap' ?
          /* Filters & Leaderboard Section */
          <div id="leaderboard" className="scroll-mt-32 space-y-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="sticky top-20 z-30 bg-brown-900/80 backdrop-blur-xl p-4 sm:p-6 rounded-[2.5rem] shadow-2xl shadow-brown-950/40 border border-brown-800 flex flex-col lg:flex-row gap-6 items-center justify-between">
              <div className="overflow-x-auto w-full lg:w-auto pb-2 lg:pb-0 custom-scrollbar">
                <div className="flex gap-2 min-w-max">
                  {categories.map(cat => (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      key={cat}
                      onClick={() => setActiveKategori(cat)}
                      className={cn(
                        "px-6 py-3 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all duration-300 border-2",
                        activeKategori === cat 
                          ? "bg-brown-600 text-white border-brown-600 shadow-xl shadow-brown-950" 
                          : "bg-brown-800/50 text-brown-400 border-brown-800 hover:border-brown-700 hover:text-brown-200"
                      )}
                    >
                      {cat}
                    </motion.button>
                  ))}
                </div>
              </div>
              <div className="relative w-full lg:w-96 group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-brown-500 group-focus-within:text-brown-300 transition-colors" />
                <input
                  type="text"
                  placeholder="Cari regu atau pangkalan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-14 pr-6 py-4 rounded-2xl border-2 border-brown-800 focus:border-brown-600 outline-none transition-all bg-brown-950/30 font-medium text-brown-50 placeholder:text-brown-600"
                />
              </div>
            </div>

            {/* Leaderboard Section */}
            <div className="space-y-8">
              <div className="flex items-end justify-between px-2">
                <div className="space-y-1">
                  <h2 className="text-[clamp(8px,3.5vw,24px)] sm:text-xl md:text-2xl font-black text-brown-900 tracking-tighter uppercase whitespace-nowrap">
                    Klasemen <span className="text-brown-500">Teratas</span>
                  </h2>
                  <p className="text-xs text-brown-400 font-bold uppercase tracking-[0.2em]">Update: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
              </div>

              <div className="bg-brown-900/40 backdrop-blur-md rounded-[3rem] shadow-2xl border border-brown-800 overflow-hidden">
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-brown-800/50 text-brown-400 uppercase text-[10px] font-black tracking-[0.3em] border-b border-brown-800">
                        <th className="px-10 py-6 w-32">Rank</th>
                        <th className="px-10 py-6">Identity</th>
                        <th className="px-10 py-6">Category</th>
                        <th className="px-10 py-6 text-right">Total Score</th>
                        <th className="px-10 py-6 w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brown-800">
                      {filteredSummaries.map((s, index) => (
                        <React.Fragment key={s.regu.id}>
                          <motion.tr 
                            whileHover={{ backgroundColor: "rgba(69, 26, 3, 0.4)" }}
                            className={cn(
                              "transition-all cursor-pointer group",
                              expandedRegu === s.regu.id && "bg-brown-800/60"
                            )}
                            onClick={() => setExpandedRegu(expandedRegu === s.regu.id ? null : s.regu.id)}
                          >
                            <td className="px-10 py-8">
                              <div className={cn(
                                "h-14 w-14 rounded-2xl flex items-center justify-center font-black text-2xl shadow-xl transition-transform group-hover:scale-110",
                                index === 0 ? "bg-gradient-to-br from-yellow-400 to-yellow-600 text-white rotate-3" :
                                index === 1 ? "bg-gradient-to-br from-slate-300 to-slate-500 text-white" :
                                index === 2 ? "bg-gradient-to-br from-amber-600 to-amber-800 text-white -rotate-3" :
                                "bg-brown-800 text-brown-300 border border-brown-700"
                              )}>
                                {index + 1}
                              </div>
                            </td>
                            <td className="px-10 py-8">
                              <div className="font-black text-brown-50 group-hover:text-brown-200 transition-colors text-xl tracking-tight leading-none">{s.regu.nama}</div>
                              <div className="text-xs text-brown-400 font-bold uppercase tracking-[0.15em] mt-2">{s.regu.pangkalan}</div>
                            </td>
                            <td className="px-10 py-8">
                              <span className="px-4 py-2 rounded-full bg-brown-800 text-brown-300 text-[10px] font-black uppercase tracking-widest border border-brown-700">
                                {s.regu.kategori}
                              </span>
                            </td>
                            <td className="px-10 py-8 text-right font-black text-brown-50 text-4xl tabular-nums tracking-tighter">
                              {s.totalScore.toLocaleString()}
                            </td>
                            <td className="px-10 py-8">
                              <div className={cn(
                                "p-2 rounded-full transition-all duration-300",
                                expandedRegu === s.regu.id ? "bg-brown-600 text-white rotate-180" : "bg-brown-800 text-brown-400 group-hover:text-brown-200"
                              )}>
                                <ChevronDown className="h-5 w-5" />
                              </div>
                            </td>
                          </motion.tr>
                          {expandedRegu === s.regu.id && (
                            <tr className="bg-brown-950/40">
                              <td colSpan={5} className="px-10 py-12">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                  {lombas.map(l => (
                                    <motion.div 
                                      initial={{ opacity: 0, y: 10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      key={l.id} 
                                      className="flex flex-col p-6 bg-brown-900/60 rounded-3xl border border-brown-800 shadow-xl hover:bg-brown-800/80 transition-all group/item"
                                    >
                                      <span className="text-[10px] text-brown-400 uppercase font-black tracking-widest mb-1">Hari {l.hari}</span>
                                      <span className="text-xs font-black text-brown-50 group-hover/item:text-brown-200 transition-colors mb-4 leading-tight">{l.nama}</span>
                                      <div className="mt-auto pt-4 border-t border-brown-800 flex justify-between items-end">
                                        <span className="text-[9px] font-bold text-brown-400 uppercase">Score</span>
                                        <span className="font-black text-brown-50 text-2xl tabular-nums leading-none">
                                          {s.lombaScores[l.id] || 0}
                                        </span>
                                      </div>
                                    </motion.div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-brown-800">
                  {filteredSummaries.map((s, index) => (
                    <div key={s.regu.id} className="p-6 space-y-6">
                      <div 
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => setExpandedRegu(expandedRegu === s.regu.id ? null : s.regu.id)}
                      >
                        <div className="flex items-center gap-5">
                          <div className={cn(
                            "h-16 w-16 rounded-3xl flex items-center justify-center font-black text-2xl shadow-xl flex-shrink-0",
                            index === 0 ? "bg-gradient-to-br from-yellow-400 to-yellow-600 text-white" :
                            index === 1 ? "bg-gradient-to-br from-slate-300 to-slate-500 text-white" :
                            index === 2 ? "bg-gradient-to-br from-amber-600 to-amber-800 text-white" :
                            "bg-brown-800 text-brown-300 border border-brown-700"
                          )}>
                            {index + 1}
                          </div>
                          <div className="space-y-1">
                            <div className="font-black text-brown-50 text-lg leading-none tracking-tight">{s.regu.nama}</div>
                            <div className="text-[10px] text-brown-400 font-bold uppercase tracking-widest">{s.regu.pangkalan}</div>
                            <div className="pt-2">
                              <span className="px-3 py-1 rounded-full bg-brown-800 text-brown-300 text-[9px] font-black uppercase tracking-widest border border-brown-700">
                                {s.regu.kategori}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex flex-col items-end gap-3">
                          <div className="font-black text-brown-50 text-2xl tabular-nums leading-none tracking-tighter">
                            {s.totalScore.toLocaleString()}
                          </div>
                          <div className={cn(
                            "p-2 rounded-full transition-all duration-300",
                            expandedRegu === s.regu.id ? "bg-brown-600 text-white rotate-180" : "bg-brown-800 text-brown-400"
                          )}>
                            <ChevronDown className="h-4 w-4" />
                          </div>
                        </div>
                      </div>

                      {expandedRegu === s.regu.id && (
                        <div className="pt-6 grid grid-cols-1 gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                          {lombas.map(l => (
                            <div key={l.id} className="flex justify-between items-center p-5 bg-brown-950/40 rounded-3xl border border-brown-800">
                              <div className="flex flex-col gap-1">
                                <span className="text-[9px] text-brown-400 uppercase font-black tracking-widest">Hari {l.hari}</span>
                                <span className="text-xs font-black text-brown-50 leading-tight">{l.nama}</span>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <span className="font-black text-brown-50 text-xl tabular-nums leading-none">
                                  {s.lombaScores[l.id] || 0}
                                </span>
                                <span className="text-[8px] font-bold text-brown-400 uppercase">Score</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {filteredSummaries.length === 0 && (
                  <div className="py-20 text-center space-y-3">
                    <div className="bg-brown-50 h-16 w-16 rounded-full flex items-center justify-center mx-auto">
                      <Search className="h-8 w-8 text-brown-200" />
                    </div>
                    <p className="text-brown-400 font-bold italic text-sm tracking-wide">
                      Tidak ada data regu ditemukan.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        : activeMainTab === 'drive' ?
          /* Google Drive Section */
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="space-y-1">
              <h2 className="text-[clamp(8px,3.5vw,24px)] sm:text-xl md:text-2xl font-black text-brown-50 tracking-tighter uppercase whitespace-nowrap">
                Juknis <span className="text-brown-500">LT2 Jatinagara</span>
              </h2>
              <p className="text-xs text-brown-400 font-bold uppercase tracking-[0.2em]">Konten eksternal dari Google Drive</p>
            </div>
            
            <div className="bg-brown-900/40 backdrop-blur-md rounded-[3rem] border border-brown-800 overflow-hidden shadow-2xl h-[80vh]">
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
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-brown-600 text-white text-xs font-black uppercase tracking-widest hover:bg-brown-500 transition-all shadow-xl shadow-brown-950/50"
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
              <h2 className="text-[clamp(8px,3.5vw,24px)] sm:text-xl md:text-2xl font-black text-brown-50 tracking-tighter uppercase whitespace-nowrap">
                Tentang <span className="text-brown-500">LT2 Kwarran Jatinagara</span>
              </h2>
              <p className="text-xs text-brown-400 font-bold uppercase tracking-[0.2em]">Informasi seputar kegiatan</p>
            </div>

            <div className="bg-brown-900/40 backdrop-blur-md rounded-[3rem] border border-brown-800 overflow-hidden shadow-2xl">
              <div className="flex flex-col md:flex-row items-stretch">
                <div className="flex-1 p-8 sm:p-12 order-2 md:order-1">
                  <div className="prose prose-invert max-w-none">
                    {(config?.aboutContent || `Assalamu'alaiakum Wr Wb
Salam Pramuka
Kakak - Kakak pembina pramuka semua dan seluruh pramuka di kwarran jatinagara dan yang berada diseluruh indonesia, kwarran Jatinagara Kwarcab Ciamis pada tahun 2026 ini akan menyelenggarakan LT2 lomba tingkat 2 pramuka penggalang. platform ini kami sediakan untuk memberikan akses informasi secara transparan mulai dari persiapan sampai pasca kegiatan. untuk itu silahkan kakak kakak update untuk mendapatkan informasi dan bersilaturahmi dengan sesama pramuka yang berada di kwarcab ciamis.

kami menyadari pasti ada kekurangan yang perlu dibenahi agar kegiatan LT2 ini dapat mendekati sempurna, kritik dan saran kami harapkan agar menjadi bahan berbenah bagi kami dari pramuka kwarran jatinagara, pramuka ciamis atau pramuka diseluruh indonesia.

H. dadi Supriadi, S.Pd, SD
Ketua Kwarran Jatinagara`) ? (
                      <div className="text-brown-200 font-medium leading-relaxed whitespace-pre-wrap text-lg">
                        {config?.aboutContent || `Assalamu'alaiakum Wr Wb
Salam Pramuka
Kakak - Kakak pembina pramuka semua dan seluruh pramuka di kwarran jatinagara dan yang berada diseluruh indonesia, kwarran Jatinagara Kwarcab Ciamis pada tahun 2026 ini akan menyelenggarakan LT2 lomba tingkat 2 pramuka penggalang. platform ini kami sediakan untuk memberikan akses informasi secara transparan mulai dari persiapan sampai pasca kegiatan. untuk itu silahkan kakak kakak update untuk mendapatkan informasi dan bersilaturahmi dengan sesama pramuka yang berada di kwarcab ciamis.

kami menyadari pasti ada kekurangan yang perlu dibenahi agar kegiatan LT2 ini dapat mendekati sempurna, kritik dan saran kami harapkan agar menjadi bahan berbenah bagi kami dari pramuka kwarran jatinagara, pramuka ciamis atau pramuka diseluruh indonesia.

H. dadi Supriadi, S.Pd, SD
Ketua Kwarran Jatinagara`}
                      </div>
                    ) : (
                      <div className="py-20 text-center bg-brown-950/30 rounded-3xl border border-brown-800 border-dashed">
                        <p className="text-brown-400 font-black uppercase tracking-widest text-xs">Belum ada informasi yang ditambahkan</p>
                      </div>
                    )}
                  </div>
                </div>
                {(config?.aboutImage || 'https://i.imgur.com/bOD7Igj.png') && (
                  <div className="w-full md:w-1/3 lg:w-2/5 bg-brown-950 order-1 md:order-2">
                    <img 
                      src={config?.aboutImage || 'https://i.imgur.com/bOD7Igj.png'} 
                      alt="LT2 Kwarran Jatinagara" 
                      className="w-full h-full object-cover opacity-80"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        }
      </div>

      {/* Create Post Modal */}
      {isCreatingPost && user &&
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-brown-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-brown-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-brown-800"
          >
            <div className="px-6 py-4 border-b border-brown-800 flex items-center justify-between">
              <h3 className="text-lg font-black text-brown-50 uppercase tracking-tight">Buat Postingan</h3>
              <motion.button 
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  setIsCreatingPost(false);
                  setSelectedFile(null);
                  setFilePreview(null);
                  setNewPostMediaUrl('');
                }} className="p-2 hover:bg-brown-800 rounded-full transition-colors">
                <ChevronDown className="h-6 w-6 text-brown-400" />
              </motion.button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full overflow-hidden bg-brown-800 border border-brown-700">
                  {user.photoURL && <img src={user.photoURL} alt="" className="h-full w-full object-cover" />}
                </div>
                <div>
                  <div className="font-black text-brown-50 text-sm">{user.displayName}</div>
                  <div className="text-[10px] font-bold text-brown-400 uppercase tracking-widest bg-brown-800 px-2 py-0.5 rounded-full inline-block">Publik</div>
                </div>
              </div>

              <textarea
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder={`Apa yang Anda pikirkan, ${user.displayName?.split(' ')[0]}?`}
                rows={4}
                className="w-full text-lg outline-none resize-none font-medium bg-transparent text-brown-50 placeholder:text-brown-600"
                autoFocus
              />

              {filePreview && (
                <div className="relative rounded-xl overflow-hidden border border-brown-800 bg-brown-950">
                  <motion.button 
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      setSelectedFile(null);
                      setFilePreview(null);
                      setNewPostMediaUrl('');
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-brown-950/50 hover:bg-brown-950 text-white rounded-full transition-all z-10"
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

              <div className="space-y-3 p-4 border border-brown-800 rounded-xl bg-brown-950/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-brown-400 uppercase tracking-widest">Tambahkan ke Postingan</span>
                  <div className="flex gap-2">
                    <motion.label 
                      whileTap={{ scale: 0.9 }}
                      className="p-2 rounded-lg transition-colors hover:bg-brown-800 text-emerald-500 cursor-pointer"
                    >
                      <ImageIcon className="h-5 w-5" />
                      <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                    </motion.label>
                    <motion.label 
                      whileTap={{ scale: 0.9 }}
                      className="p-2 rounded-lg transition-colors hover:bg-brown-800 text-red-500 cursor-pointer"
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
                className="w-full py-3 rounded-xl bg-brown-600 text-white font-black uppercase tracking-widest hover:bg-brown-500 transition-all disabled:opacity-50 shadow-lg shadow-brown-950/20"
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

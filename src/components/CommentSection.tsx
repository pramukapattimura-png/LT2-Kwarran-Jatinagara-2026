import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { db, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, where, auth, GoogleAuthProvider, signInWithPopup, deleteDoc, doc, handleFirestoreError, OperationType } from '../firebase';
import { Komentar } from '../types';
import { MessageSquare, Send, User, LogIn, Trash2, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import ConfirmModal from './ConfirmModal';

interface CommentSectionProps {
  postId: string;
  isAdmin?: boolean;
}

export interface CommentSectionRef {
  focusInput: () => void;
}

const CommentSection = forwardRef<CommentSectionRef, CommentSectionProps>(({ postId, isAdmin }, ref) => {
  const [comments, setComments] = useState<Komentar[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [user, setUser] = useState(auth.currentUser);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    focusInput: () => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  }));

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((u) => setUser(u));
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'komentar'), 
      where('postId', '==', postId),
      orderBy('timestamp', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Komentar[];
      setComments(data);
    });
    return () => unsubscribe();
  }, [postId]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !content.trim()) return;

    setLoading(true);
    try {
      const path = 'komentar';
      await addDoc(collection(db, path), {
        postId,
        author: user.displayName || 'Anonim',
        authorId: user.uid,
        authorEmail: user.email || '',
        authorPhoto: user.photoURL || '',
        content: content.trim(),
        timestamp: serverTimestamp()
      });
      setContent('');
    } catch (error) {
      console.error('Error adding comment:', error);
      handleFirestoreError(error, OperationType.CREATE, 'komentar');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      const path = 'komentar';
      await deleteDoc(doc(db, path, commentId));
    } catch (error) {
      console.error('Error deleting comment:', error);
      handleFirestoreError(error, OperationType.DELETE, 'komentar');
    }
  };

  return (
    <div className="space-y-4 pt-4 border-t border-gray-100">
      {/* Comment List */}
      <div className="space-y-3">
        {comments.map((comment) => (
          <div key={comment.id} className="flex gap-2 group">
            <div className="flex-shrink-0 h-8 w-8 rounded-full overflow-hidden bg-gray-100 border border-gray-200">
              {comment.authorPhoto ? (
                <img src={comment.authorPhoto} alt={comment.author} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-gray-400">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
            <div className="flex-grow space-y-1">
              <div className="bg-gray-50 rounded-2xl px-3 py-2 inline-block max-w-full">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-black text-black">{comment.author}</span>
                  {comment.authorEmail && (
                    <span className="text-[8px] font-bold text-gray-400 lowercase bg-white px-1 rounded border border-gray-100">
                      {comment.authorEmail}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-800 font-medium break-words leading-tight">
                  {comment.content}
                </p>
              </div>
              <div className="flex items-center gap-3 px-2">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                  {comment.timestamp ? formatDistanceToNow(comment.timestamp.toDate(), { addSuffix: true, locale: id }) : 'Baru saja'}
                </span>
                {isAdmin && (
                  <button onClick={() => setConfirmDeleteId(comment.id)} className="text-[9px] font-black text-red-500 uppercase hover:text-red-700 transition-colors">
                    Hapus
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input Section */}
      {user ? (
        <form onSubmit={handleSubmit} className="flex gap-2 items-start pt-2">
          <div className="flex-shrink-0 h-8 w-8 rounded-full overflow-hidden bg-gray-100 border border-gray-200">
            {user.photoURL ? (
              <img src={user.photoURL} alt={user.displayName || ''} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-gray-400">
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
          <div className="flex-grow relative">
            <textarea
              ref={inputRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Tulis komentar..."
              rows={1}
              className="w-full px-4 py-2 rounded-2xl bg-gray-50 border border-gray-100 focus:ring-4 focus:ring-black/5 focus:border-black outline-none transition-all resize-none font-medium text-black placeholder:text-gray-400 text-sm pr-10"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <button
              type="submit"
              disabled={loading || !content.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-black disabled:opacity-30 transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-center justify-center py-3 bg-gray-50 rounded-xl border border-gray-100 border-dashed">
          <button
            onClick={handleLogin}
            className="flex items-center gap-2 text-[10px] font-black text-black uppercase tracking-widest hover:text-gray-700 transition-colors"
          >
            <LogIn className="h-4 w-4" />
            Login untuk berkomentar
          </button>
        </div>
      )}

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => confirmDeleteId && handleDelete(confirmDeleteId)}
        title="Hapus Komentar"
        message="Apakah Anda yakin ingin menghapus komentar ini?"
        confirmLabel="Hapus"
      />
    </div>
  );
});

export default CommentSection;

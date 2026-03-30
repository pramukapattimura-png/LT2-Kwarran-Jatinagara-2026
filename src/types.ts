export type Kategori = 'SD Putra' | 'SD Putri' | 'SMP Putra' | 'SMP Putri';

export interface Regu {
  id: string;
  nama: string;
  pangkalan: string;
  kategori: Kategori;
  nomorTenda?: string;
  pinru?: string;
  wapinru?: string;
  anggota?: string[]; // Anggota 1-6
}

export interface Lomba {
  id: string;
  nama: string; // Jenis Lomba
  bidangLomba?: string;
  hari: number;
  bobot?: number;
  kategori: Kategori;
}

export interface Nilai {
  id?: string;
  reguId: string;
  lombaId: string;
  p1?: number;
  p2?: number;
  p3?: number;
  p4?: number;
  score: number; // Rata-rata
}

export interface Komentar {
  id: string;
  postId?: string;
  author: string;
  authorId: string;
  authorEmail?: string;
  authorPhoto?: string;
  content: string;
  timestamp: any;
}

export interface ScoreSummary {
  regu: Regu;
  totalScore: number;
  lombaScores: Record<string, number>;
}

export interface AppConfig {
  id: string; // 'global'
  isLocked: boolean;
  lockedCategories: Record<Kategori, boolean>;
  marqueeText?: string;
  adminEmails?: string[];
  aboutContent?: string;
  aboutImage?: string;
  aboutContent2?: string;
  aboutImage2?: string;
}

export interface Berita {
  id: string;
  title?: string;
  content: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  authorId: string;
  authorName?: string;
  authorEmail?: string;
  authorPhoto?: string;
  likes?: string[];
  timestamp: any;
}

export interface RekapNilai {
  id: string;
  grid: any[][];
  updatedAt: any;
}

export interface Dokumen {
  id: string;
  nama: string;
  kategori: string;
  url: string;
  timestamp: any;
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;
export const hasSupabase = Boolean(supabase);

export type UserRole = 'admin' | 'manager' | 'chef' | 'kitchen_staff';
export type OrderStatus = 'NEW' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED' | 'COMPLETED';
export type Variant = { id: string; name: string; price_delta: number; active?: boolean };
export type Addon = { id: string; name: string; price_delta: number; active?: boolean };
export type MenuItem = {
  id: string; name: string; description: string; price: number; image_url: string;
  category_id?: string | null; category_name?: string; available?: boolean; featured?: boolean; popular?: boolean;
  prep_minutes?: number; ingredients?: string | null; allergens?: string | null;
  variants?: Variant[]; addons?: Addon[];
};
export type Category = { id: string; name: string; image_url?: string | null; sort_order?: number; active?: boolean };
export type Table = { id: string; table_number: number; table_name?: string | null; seats?: number; status?: string; active?: boolean };
export type CartAddon = { id: string; name: string; price_delta: number };
export type CartItem = MenuItem & { cartId: string; qty: number; notes: string; addons: CartAddon[]; variant?: Variant };
export type Review = { id: string; customer_name: string; rating: number; review_text: string; image_url?: string | null; status: 'PENDING' | 'APPROVED' | 'REJECTED'; created_at?: string };
export type GalleryItem = { id: string; image_url: string; caption?: string | null; sort_order?: number; active?: boolean; created_at?: string };
export type SiteMedia = { id: string; section_key: string; media_type: 'image' | 'video'; media_url: string; thumbnail_url?: string | null; caption?: string | null; sort_order?: number; active?: boolean; created_at?: string; };
export type BrandTheme = { primary?: string; accent?: string; background?: string; text?: string; logo_only?: boolean };
export type Settings = {
  id?: number; restaurant_name: string; logo_url?: string | null; favicon_url?: string | null; brand_theme?: BrandTheme | null;
  phone?: string | null; email?: string | null; address?: string | null; opening_hours: string;
  currency: string; tax_percentage: number; restaurant_status: 'OPEN' | 'CLOSED'; social_links?: Record<string, string>;
};
export type SiteContent = Record<string, any>;
export type SiteSections = Record<string, { visible: boolean; order: number; title?: string; settings?: Record<string, any> }>;
export type OrderItem = { id?: string; menu_item_id?: string | null; item_name_snapshot: string; unit_price_snapshot: number; quantity: number; special_instruction?: string | null; addons?: any };
export type OrderMessage = { id: string; sender: 'customer' | 'staff'; sender_name: string; sender_role?: string | null; body: string; created_at: string };
export type OrderHistoryEntry = { status: OrderStatus; at: string; by?: string | null };
export type PaymentMethod = 'CASH' | 'MOMO' | 'CARD';
export type RestaurantOrder = {
  id: string; order_number: string; customer_name: string; customer_phone?: string | null; table_id?: string | null;
  table_number?: number | null; status: OrderStatus; subtotal: number; tax: number; total: number; general_note?: string | null;
  assigned_chef?: string | null; tracking_token?: string; created_at: string; updated_at?: string;
  order_items: OrderItem[]; restaurant_tables?: { table_number: number } | null;
  progress?: number; claimed_at?: string | null; payment_status?: 'UNPAID' | 'PAID'; payment_method?: string | null; paid_at?: string | null;
  assigned_chef_name?: string | null; assigned?: { full_name?: string | null; email?: string | null } | null;
  messages?: OrderMessage[]; history?: OrderHistoryEntry[]; chat_open?: boolean;
};
export type StaffInfo = { id: string; role: UserRole; name: string };

/* ---------- Order progress helpers (shared by guest, chef, kitchen staff and manager screens) ---------- */
export const stageDefaults: Record<OrderStatus, number> = { NEW: 8, CONFIRMED: 20, PREPARING: 40, READY: 90, SERVED: 100, COMPLETED: 100, CANCELLED: 0 };
export function orderProgress(o: Pick<RestaurantOrder, 'status' | 'progress'>): number {
  if (o.status === 'CANCELLED') return 0;
  if (o.status === 'SERVED' || o.status === 'COMPLETED') return 100;
  const p = Number(o.progress); return Math.min(99, Math.max(Number.isFinite(p) ? p : 0, stageDefaults[o.status]));
}
export const orderChefName = (o: Pick<RestaurantOrder, 'assigned_chef' | 'assigned_chef_name' | 'assigned'>): string | null =>
  o.assigned_chef_name || o.assigned?.full_name || (o.assigned_chef ? o.assigned?.email || 'A chef' : null) || null;
export const isFinished = (o: Pick<RestaurantOrder, 'status'>) => ['SERVED', 'COMPLETED', 'CANCELLED'].includes(o.status);

export const placeholderImages = {
  hero: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1800&q=86',
  burger: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1000&q=84',
  pizza: 'https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=1000&q=84',
  chicken: 'https://images.unsplash.com/photo-1527477396000-e27163b481c2?auto=format&fit=crop&w=1000&q=84',
  pasta: 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1000&q=84',
  drink: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=1000&q=84',
  dessert: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=1000&q=84'
};

export const sampleCategories: Category[] = [
  { id: 'cat-burger', name: 'Burgers', image_url: placeholderImages.burger, sort_order: 1, active: true },
  { id: 'cat-pizza', name: 'Pizza', image_url: placeholderImages.pizza, sort_order: 2, active: true },
  { id: 'cat-chicken', name: 'Chicken', image_url: placeholderImages.chicken, sort_order: 3, active: true },
  { id: 'cat-pasta', name: 'Pasta', image_url: placeholderImages.pasta, sort_order: 4, active: true },
  { id: 'cat-drinks', name: 'Drinks', image_url: placeholderImages.drink, sort_order: 5, active: true },
  { id: 'cat-dessert', name: 'Desserts', image_url: placeholderImages.dessert, sort_order: 6, active: true }
];

export const sampleMenu: MenuItem[] = [
  { id: 'm1', name: 'Bitecraft Classic', description: 'Char-grilled beef, cheddar, tomato, lettuce and house sauce.', price: 8500, image_url: placeholderImages.burger, category_id: 'cat-burger', category_name: 'Burgers', featured: true, popular: true, prep_minutes: 15, available: true, variants: [{ id: 'v1', name: 'Regular', price_delta: 0 }, { id: 'v2', name: 'Double', price_delta: 2500 }], addons: [{ id: 'a1', name: 'Extra cheese', price_delta: 800 }, { id: 'a2', name: 'Bacon', price_delta: 1200 }, { id: 'a3', name: 'Extra sauce', price_delta: 300 }] },
  { id: 'm2', name: 'Smoky Chicken Pizza', description: 'Roast chicken, smoked cheese, peppers and basil on our crisp crust.', price: 12000, image_url: placeholderImages.pizza, category_id: 'cat-pizza', category_name: 'Pizza', popular: true, prep_minutes: 22, available: true, variants: [{ id: 'v3', name: 'Medium', price_delta: 0 }, { id: 'v4', name: 'Large', price_delta: 3500 }], addons: [{ id: 'a4', name: 'Extra cheese', price_delta: 1000 }, { id: 'a5', name: 'Chilli flakes', price_delta: 200 }] },
  { id: 'm3', name: 'Crispy Chicken Basket', description: 'Golden chicken, fries, slaw and a bright herb dip.', price: 10500, image_url: placeholderImages.chicken, category_id: 'cat-chicken', category_name: 'Chicken', featured: true, prep_minutes: 18, available: true, addons: [{ id: 'a6', name: 'Extra dip', price_delta: 400 }, { id: 'a7', name: 'Extra fries', price_delta: 1200 }] },
  { id: 'm4', name: 'Creamy Alfredo', description: 'Silky parmesan cream, garlic, herbs and toasted crumbs.', price: 9750, image_url: placeholderImages.pasta, category_id: 'cat-pasta', category_name: 'Pasta', prep_minutes: 16, available: true, addons: [{ id: 'a8', name: 'Grilled chicken', price_delta: 1800 }, { id: 'a9', name: 'Extra parmesan', price_delta: 600 }] },
  { id: 'm5', name: 'Spicy Fire Wings', description: 'Crispy wings glazed with our smoky house chilli sauce.', price: 9250, image_url: placeholderImages.chicken, category_id: 'cat-chicken', category_name: 'Chicken', popular: true, prep_minutes: 17, available: true, addons: [{ id: 'a10', name: 'Blue cheese dip', price_delta: 700 }, { id: 'a11', name: 'Extra hot', price_delta: 0 }] },
  { id: 'm6', name: 'Sunset Lemonade', description: 'Fresh lemon, citrus peel, mint and sparkling water.', price: 4000, image_url: placeholderImages.drink, category_id: 'cat-drinks', category_name: 'Drinks', prep_minutes: 3, available: true, addons: [{ id: 'a12', name: 'Ginger shot', price_delta: 500 }] },
  { id: 'm7', name: 'Chocolate Lava Cake', description: 'Warm chocolate cake, molten center and vanilla ice cream.', price: 6500, image_url: placeholderImages.dessert, category_id: 'cat-dessert', category_name: 'Desserts', popular: true, prep_minutes: 10, available: true }
];

export const demoSettings: Settings = { restaurant_name: 'e-menu', phone: '+250 788 000 000', email: 'hello@bitecraft.rw', address: 'KG 7 Ave, Kigali, Rwanda', opening_hours: '10:00 – 22:00', currency: 'RWF', tax_percentage: 0, restaurant_status: 'OPEN', social_links: { instagram: '#', facebook: '#', whatsapp: '#' } };
export const demoContent: SiteContent = {
  'home.hero': { title: 'FLAVOR THAT FEELS LIKE HOME.', subtitle: 'Bold comfort food, made to order and served straight to your table.', image_url: placeholderImages.hero, primary_button: 'VIEW MENU', secondary_button: 'OUR STORY' },
  'home.warm': { label: 'ARE YOU HUNGRY?', title: "WE'RE READY.", text: 'Choose your table, build your meal, and send the order straight to our kitchen.' },
  'home.why': { title: 'Big flavor. Honest ingredients. Fast service.', text: 'Every dish starts with fresh ingredients and ends with a table worth lingering around.', items: ['Fresh daily ingredients', 'Made-to-order kitchen', 'Friendly table service'] },
  'home.about': { title: 'A neighborhood table with a kitchen that cares.', text: 'A warm restaurant experience built around comfort food, quick service and good company.' },
  'home.cta': { title: 'Make your table the best seat in the house.', text: 'Order directly from the menu and skip the wait.' },
  footer: { tagline: 'Good food, warm tables, memorable moments.' }
};

/* =========================================================
   Uploads — every photo / video is limited to 10 MB
   ========================================================= */
export const MAX_UPLOAD_MB = 10;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
const DEMO_IMAGE_LIMIT = 1_500_000; // characters of a data URL that demo-mode localStorage can comfortably hold
function checkUpload(file: File, kind: 'image' | 'media') {
  const ok = file.type.startsWith('image/') || (kind === 'media' && file.type.startsWith('video/'));
  if (!ok) throw new Error(`${file.name}: ${kind === 'media' ? 'only photos and videos can be uploaded.' : 'only photos can be uploaded here.'}`);
  if (!file.size) throw new Error(`${file.name} is empty.`);
  if (file.size > MAX_UPLOAD_BYTES) throw new Error(`${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is ${MAX_UPLOAD_MB} MB per file.`);
}

// Demo mode only: keep uploaded files in IndexedDB so a 10 MB video is not squeezed into localStorage.
const FILE_DB = 'bitecraft-demo-files';
const openFileDb = () => new Promise<IDBDatabase>((resolve, reject) => {
  const req = indexedDB.open(FILE_DB, 1);
  req.onupgradeneeded = () => req.result.createObjectStore('files');
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error || new Error('Browser file storage is unavailable.'));
});
async function fileDbPut(id: string, blob: Blob) {
  const db = await openFileDb();
  try { await new Promise<void>((resolve, reject) => { const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').put(blob, id); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error('Browser storage is full.')); }); }
  finally { db.close(); }
}
async function fileDbGet(id: string): Promise<Blob | undefined> {
  const db = await openFileDb();
  try { return await new Promise<Blob | undefined>((resolve, reject) => { const req = db.transaction('files').objectStore('files').get(id); req.onsuccess = () => resolve(req.result as Blob | undefined); req.onerror = () => reject(req.error); }); }
  finally { db.close(); }
}
async function fileDbDelete(id: string) {
  const db = await openFileDb();
  try { await new Promise<void>((resolve, reject) => { const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').delete(id); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); }
  finally { db.close(); }
}
const blobUrls = new Map<string, string>();
async function resolveStoredUrl(url: string) {
  if (!url.startsWith('idb:')) return url;
  const id = url.slice(4); const cached = blobUrls.get(id); if (cached) return cached;
  const blob = await fileDbGet(id).catch(() => undefined); if (!blob) return '';
  const objectUrl = URL.createObjectURL(blob); blobUrls.set(id, objectUrl); return objectUrl;
}
const resolveMediaRows = (rows: SiteMedia[]) => Promise.all(rows.map(async r => ({ ...r, media_url: await resolveStoredUrl(r.media_url) })));

// Demo mode only: photos become (downscaled) data URLs because they are stored directly in image_url fields.
async function imageToDataUrl(file: File, maxDim: number): Promise<string> {
  const raw = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(r.error || new Error('Could not read the file.')); r.readAsDataURL(file); });
  const tooBig = () => new Error(`${file.name} is too large for demo mode, which keeps files inside the browser. Connect Supabase to use full ${MAX_UPLOAD_MB} MB uploads.`);
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') { if (raw.length > DEMO_IMAGE_LIMIT) throw tooBig(); return raw; }
  const img = await new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error(`${file.name} could not be read as an image.`)); i.src = raw; });
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  if (scale === 1 && raw.length <= 600_000) return raw;
  const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d'); if (!ctx) { if (raw.length > DEMO_IMAGE_LIMIT) throw tooBig(); return raw; }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const hasAlpha = file.type === 'image/png' || file.type === 'image/webp';
  const out = canvas.toDataURL(hasAlpha ? 'image/webp' : 'image/jpeg', 0.86);
  if (out.length > DEMO_IMAGE_LIMIT) throw tooBig();
  return out;
}

/** Upload one photo (max 10 MB) and return a URL ready to store in an image_url field. */
export async function uploadImage(file: File, opts: { folder?: string; maxDim?: number } = {}): Promise<string> {
  checkUpload(file, 'image');
  if (!supabase) return imageToDataUrl(file, opts.maxDim ?? 1600);
  const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
  const path = `${opts.folder || 'images'}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from('site-media').upload(path, file, { upsert: false, contentType: file.type || undefined, cacheControl: '3600' });
  if (error) throw error;
  return supabase.storage.from('site-media').getPublicUrl(path).data.publicUrl;
}

/* =========================================================
   Brand theme (name, logo, colours)
   ========================================================= */
export const defaultBrandTheme = { primary: '#35130f', accent: '#e6ad3c', background: '#f7f1e8', text: '#211714' };
export const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const rgb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const toHex = (c: number[]) => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mixHex = (a: string, b: string, t: number) => { const x = rgb(a), y = rgb(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };
const luminance = (h: string) => { const [r, g, b] = rgb(h).map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrastRatio = (a: string, b: string) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const THEME_VARS = ['--wine', '--wine-deep', '--wine2', '--gold', '--gold-light', '--cream', '--paper', '--line', '--ink', '--muted'];
/** Applies the saved colours as CSS variables. Anything not customised keeps the stylesheet default. */
export function applyBrandTheme(theme?: BrandTheme | null) {
  const root = document.documentElement; const t = theme || {}; const set = (k: string, v: string) => root.style.setProperty(k, v);
  THEME_VARS.forEach(v => root.style.removeProperty(v));
  let custom = false;
  if (isHex(t.primary)) { custom = true; set('--wine', t.primary); set('--wine-deep', mixHex(t.primary, '#000000', 0.45)); set('--wine2', mixHex(t.primary, '#ffffff', 0.2)); }
  if (isHex(t.accent)) { custom = true; set('--gold', t.accent); set('--gold-light', mixHex(t.accent, '#ffffff', 0.4)); }
  if (isHex(t.background)) { custom = true; set('--cream', t.background); set('--paper', mixHex(t.background, '#ffffff', 0.6)); set('--line', mixHex(t.background, '#000000', 0.07)); }
  if (isHex(t.text)) { custom = true; set('--ink', t.text); set('--muted', mixHex(t.text, isHex(t.background) ? t.background : defaultBrandTheme.background, 0.42)); }
  if (custom) root.setAttribute('data-brand-custom', ''); else root.removeAttribute('data-brand-custom');
}
const BRAND_CACHE = 'bitecraft-brand-cache';
export function readBrandCache(): Partial<Settings> | null {
  try { const v = JSON.parse(localStorage.getItem(BRAND_CACHE) || 'null'); return v && typeof v === 'object' ? v : null; } catch { return null; }
}
export function writeBrandCache(s: Settings) {
  const web = (u?: string | null) => (u && /^https?:/i.test(u) ? u : null);
  try { localStorage.setItem(BRAND_CACHE, JSON.stringify({ restaurant_name: s.restaurant_name, logo_url: web(s.logo_url), favicon_url: web(s.favicon_url), brand_theme: s.brand_theme || null })); } catch { /* cache is optional */ }
}
export async function fetchBrand(): Promise<Settings> {
  if (!supabase) return demoDB().settings;
  const { data, error } = await supabase.from('site_settings').select('*').eq('id', 1).maybeSingle();
  if (error) throw error;
  return (data || demoSettings) as Settings;
}

const DB_KEY = 'bitecraft-demo-v4';
type DemoDB = {
  categories: Category[]; menu: MenuItem[]; tables: Table[]; settings: Settings; content: SiteContent; sections: SiteSections;
  reviews: Review[]; gallery: GalleryItem[]; siteMedia: SiteMedia[]; orders: RestaurantOrder[]; chefs: { id: string; full_name: string; email: string; role: UserRole; active: boolean }[];
};

const demoDB = (): DemoDB => {
  const raw = localStorage.getItem(DB_KEY);
  if (raw) {
    try { return JSON.parse(raw) as DemoDB; } catch { /* reset */ }
  }
  const db: DemoDB = {
    categories: [...sampleCategories],
    menu: [...sampleMenu],
    tables: Array.from({ length: 12 }, (_, i) => ({ id: `t${i + 1}`, table_number: i + 1, seats: i < 4 ? 2 : 4, status: 'AVAILABLE', active: true })),
    settings: { ...demoSettings },
    content: { ...demoContent },
    sections: Object.fromEntries(['hero', 'warm', 'featured_items', 'categories', 'why_choose_us', 'about', 'reviews', 'gallery', 'cta', 'footer'].map((x, i) => [x, { visible: true, order: i + 1, title: x, settings: {} }])),
    reviews: [
      { id: 'r1', customer_name: 'Sarah M.', rating: 5, review_text: 'The burgers were hot, fresh and full of flavor. Ordering by table was so simple.', status: 'APPROVED' },
      { id: 'r2', customer_name: 'Daniel K.', rating: 5, review_text: 'Great atmosphere and the kitchen screen kept everything moving quickly.', status: 'APPROVED' },
      { id: 'r3', customer_name: 'Aline N.', rating: 4, review_text: 'The spicy wings are a must. We will definitely come back.', status: 'APPROVED' }
    ],
    gallery: [
      { id: 'g1', image_url: placeholderImages.burger, caption: 'Bitecraft Classic', sort_order: 1, active: true },
      { id: 'g2', image_url: placeholderImages.pizza, caption: 'Smoky Chicken Pizza', sort_order: 2, active: true },
      { id: 'g3', image_url: placeholderImages.chicken, caption: 'Crispy Chicken Basket', sort_order: 3, active: true },
      { id: 'g4', image_url: placeholderImages.pasta, caption: 'Creamy Alfredo', sort_order: 4, active: true }
    ],
    siteMedia: [],
    orders: [], chefs: []
  };
  localStorage.setItem(DB_KEY, JSON.stringify(db));
  return db;
};
const saveDemo = (db: DemoDB) => localStorage.setItem(DB_KEY, JSON.stringify(db));
const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
function demoSetStatus(o: RestaurantOrder, status: OrderStatus, progress?: number) {
  o.status = status; if (progress !== undefined) o.progress = progress; o.updated_at = new Date().toISOString();
  o.history = [...(o.history || []), { status, at: o.updated_at, by: null }];
}

export function formatMoney(n: number, currency = 'RWF') {
  return `${currency === 'RWF' ? 'FRw' : currency} ${Math.round(Number(n) || 0).toLocaleString()}`;
}
export function itemUnit(item: MenuItem, variant?: Variant, addons: CartAddon[] = []) {
  return Number(item.price) + Number(variant?.price_delta || 0) + addons.reduce((sum, a) => sum + Number(a.price_delta || 0), 0);
}

export async function fetchPublicConfig() {
  if (!supabase) {
    const d = demoDB();
    return {
      items: d.menu.filter(x => x.available !== false), categories: d.categories.filter(x => x.active !== false), settings: d.settings,
      content: d.content, gallery: d.gallery.filter(x => x.active !== false), reviews: d.reviews.filter(x => x.status === 'APPROVED'), sections: d.sections, media: await resolveMediaRows(d.siteMedia.filter(x => x.active !== false))

    };
  }
  const [items, cats, settings, content, gallery, reviews, sections, media] = await Promise.all([
    supabase.from('menu_items').select('*, categories:category_id(name), menu_item_variants(*), menu_item_addons(*)').eq('available', true).order('featured', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('categories').select('*').eq('active', true).order('sort_order'),
    supabase.from('site_settings').select('*').eq('id', 1).maybeSingle(),
    supabase.from('site_content').select('*').eq('published', true),
    supabase.from('gallery').select('*').eq('active', true).order('sort_order'),
    supabase.from('reviews').select('*').eq('status', 'APPROVED').order('created_at', { ascending: false }).limit(8),
    supabase.from('site_sections').select('*').eq('published', true).order('display_order'),
    supabase.from('site_media').select('*').eq('active', true).order('section_key').order('sort_order')
  ]);
  if (items.error) throw items.error;
  if (cats.error) throw cats.error;
  if (settings.error) throw settings.error;
  if (content.error) throw content.error;
  if (gallery.error) throw gallery.error;
  if (reviews.error) throw reviews.error;
  if (sections.error) throw sections.error;
  if (media.error) throw media.error;
  const contentMap: SiteContent = {};
  (content.data || []).forEach((x: any) => { contentMap[x.content_key] = x.content_value; });
  const sectionMap: SiteSections = {};
  (sections.data || []).forEach((x: any) => { sectionMap[x.section_key] = { visible: x.is_visible, order: x.display_order, title: x.title, settings: x.settings || {} }; });
  return {
    items: (items.data || []).map((x: any) => ({ ...x, category_name: x.categories?.name, variants: x.menu_item_variants || [], addons: x.menu_item_addons || [] })) as MenuItem[],
    categories: (cats.data || []) as Category[], settings: (settings.data || demoSettings) as Settings,
    content: contentMap, gallery: (gallery.data || []) as GalleryItem[], reviews: (reviews.data || []) as Review[], sections: sectionMap, media: (media.data || []) as SiteMedia[]
  };
}
export async function fetchMenu() { const c = await fetchPublicConfig(); return { items: c.items, categories: c.categories }; }
export async function fetchTables() {
  if (!supabase) return demoDB().tables.filter(t => t.active !== false && t.status !== 'DISABLED');
  const { data, error } = await supabase.from('restaurant_tables').select('*').eq('active', true).neq('status', 'DISABLED').order('table_number');
  if (error) throw error;
  return (data || []) as Table[];
}

export async function createOrder(p: { customer_name: string; customer_phone: string; table_id: string; special_request: string; allergies: string; items: CartItem[] }) {
  if (!p.items.length) throw new Error('Your cart is empty.');
  if (!p.customer_name.trim()) throw new Error('Please enter your name.');
  if (!p.table_id) throw new Error('Please choose your table.');
  if (!supabase) {
    const d = demoDB();
    const table = d.tables.find(x => x.id === p.table_id);
    if (!table) throw new Error('Selected table is unavailable.');
    const id = newId('order'); const trackingToken = newId('track'); const created = new Date().toISOString();
    const subtotal = p.items.reduce((sum, i) => sum + itemUnit(i, i.variant, i.addons) * i.qty, 0);
    const note = [p.special_request, p.allergies ? `Allergies/Diet: ${p.allergies}` : ''].filter(Boolean).join(' · ');
    const order: RestaurantOrder = {
      id, order_number: `BC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`,
      tracking_token: trackingToken, customer_name: p.customer_name.trim(), customer_phone: p.customer_phone.trim(), table_id: p.table_id, table_number: table.table_number,
      status: 'NEW', progress: stageDefaults.NEW, payment_status: 'UNPAID', messages: [], history: [{ status: 'NEW', at: created }], subtotal, tax: 0, total: subtotal, general_note: note, created_at: created, updated_at: created,
      order_items: p.items.map(i => ({ menu_item_id: i.id, item_name_snapshot: `${i.name}${i.variant ? ` · ${i.variant.name}` : ''}`, unit_price_snapshot: itemUnit(i, i.variant, i.addons), quantity: i.qty, special_instruction: [i.notes, i.addons.length ? `Extras: ${i.addons.map(a => a.name).join(', ')}` : ''].filter(Boolean).join(' · '), addons: i.addons }))
    };
    d.orders.unshift(order); saveDemo(d); return { id, order_number: order.order_number, tracking_token: trackingToken, demo: true };
  }
  const { data, error } = await supabase.rpc('create_order_secure', {
    p_customer_name: p.customer_name.trim(), p_customer_phone: p.customer_phone.trim() || null, p_table_id: p.table_id,
    p_special_request: [p.special_request, p.allergies ? `Allergies/Diet: ${p.allergies}` : ''].filter(Boolean).join(' · '),
    p_items: p.items.map(i => ({ menu_item_id: i.id, quantity: i.qty, special_instruction: i.notes || '', addons: i.addons.map(a => ({ id: a.id })), variant: i.variant ? { id: i.variant.id } : null }))
  });
  if (error) throw error;
  return data as { id: string; order_number: string; tracking_token: string; demo: false };
}

export async function fetchOrderByToken(token: string) {
  if (!supabase) {
    const o = demoDB().orders.find(x => x.tracking_token === token); if (!o) throw new Error('Order not found.');
    return isFinished(o) ? { ...o, messages: [], chat_open: false } : { ...o, chat_open: true };
  }
  const { data, error } = await supabase.rpc('get_order_by_token', { p_tracking_token: token });
  if (error) throw error;
  if (!data) throw new Error('Order not found.');
  return data as RestaurantOrder;
}
export function subscribeOrder(token: string, callback: () => void) {
  if (!supabase) { const timer = window.setInterval(callback, 2500); return () => window.clearInterval(timer); }
  const channel = supabase.channel(`order-${token}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, callback).subscribe();
  return () => { void supabase.removeChannel(channel); };
}
export async function submitReview(p: { customer_name: string; rating: number; review_text: string }) {
  if (!p.customer_name.trim() || !p.review_text.trim()) throw new Error('Name and review are required.');
  if (!supabase) { const d = demoDB(); d.reviews.unshift({ id: newId('review'), ...p, status: 'PENDING', created_at: new Date().toISOString() }); saveDemo(d); return; }
  const { error } = await supabase.from('reviews').insert({ ...p, status: 'PENDING' });
  if (error) throw error;
}

export async function adminList(type: 'orders' | 'menu' | 'categories' | 'tables' | 'chefs' | 'customers' | 'reviews' | 'gallery') {
  if (!supabase) {
    const d = demoDB();
    if (type === 'customers') {
      const map = new Map<string, any>();
      d.orders.forEach(o => { const k = o.customer_phone || o.customer_name; const x = map.get(k) || { customer_name: o.customer_name, customer_phone: o.customer_phone, orders: 0, spend: 0, last_order: o.created_at }; x.orders += 1; x.spend += o.total; x.last_order = o.created_at > x.last_order ? o.created_at : x.last_order; map.set(k, x); });
      return [...map.values()];
    }
    if (type === 'orders') return d.orders;
    return (d as any)[type] || [];
  }
  if (type === 'orders') {
    const { data, error } = await supabase.from('orders').select('*, restaurant_tables(table_number), order_items(*), assigned:assigned_chef(full_name,email)').order('created_at', { ascending: false });
    if (error) throw error; return data || [];
  }
  if (type === 'menu') {
    const { data, error } = await supabase.from('menu_items').select('*, categories:category_id(name), menu_item_variants(*), menu_item_addons(*)').order('created_at', { ascending: false });
    if (error) throw error; return (data || []).map((x: any) => ({ ...x, category_name: x.categories?.name, variants: x.menu_item_variants || [], addons: x.menu_item_addons || [] }));
  }
  if (type === 'categories') { const { data, error } = await supabase.from('categories').select('*').order('sort_order'); if (error) throw error; return data || []; }
  if (type === 'tables') { const { data, error } = await supabase.from('restaurant_tables').select('*').order('table_number'); if (error) throw error; return data || []; }
  if (type === 'chefs') { const { data, error } = await supabase.from('profiles').select('id,full_name,email,role,active').in('role', ['chef', 'kitchen_staff', 'manager']).order('full_name'); if (error) throw error; return data || []; }
  if (type === 'customers') {
    const { data, error } = await supabase.from('orders').select('customer_name,customer_phone,total,created_at').order('created_at', { ascending: false });
    if (error) throw error; const map = new Map<string, any>();
    (data || []).forEach((o: any) => { const k = o.customer_phone || o.customer_name; const x = map.get(k) || { customer_name: o.customer_name, customer_phone: o.customer_phone, orders: 0, spend: 0, last_order: o.created_at }; x.orders += 1; x.spend += Number(o.total); x.last_order = o.created_at > x.last_order ? o.created_at : x.last_order; map.set(k, x); });
    return [...map.values()];
  }
  if (type === 'reviews') { const { data, error } = await supabase.from('reviews').select('*').order('created_at', { ascending: false }); if (error) throw error; return data || []; }
  const { data, error } = await supabase.from('gallery').select('*').order('sort_order'); if (error) throw error; return data || [];
}

export async function adminDashboard() {
  const orders = await adminList('orders') as RestaurantOrder[];
  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = orders.filter(o => String(o.created_at).slice(0, 10) === today);
  const active = orders.filter(o => ['NEW', 'CONFIRMED', 'PREPARING', 'READY'].includes(o.status));
  const completed = orders.filter(o => ['SERVED', 'COMPLETED'].includes(o.status));
  const revenue = completed.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const menu = await adminList('menu');
  return { todayOrders: todayOrders.length, active: active.length, revenue, menuCount: (menu as any[]).length, recent: orders.slice(0, 6), statusCounts: Object.fromEntries(['NEW', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'].map(s => [s, orders.filter(o => o.status === s).length])) };
}
export async function updateOrderStatus(id: string, status: OrderStatus, assigned_chef?: string | null) {
  const progress = status === 'CANCELLED' ? undefined : stageDefaults[status];
  if (!supabase) {
    const d = demoDB(); const o = d.orders.find(x => x.id === id);
    if (o) { demoSetStatus(o, status, progress); if (status === 'NEW') { o.assigned_chef = undefined; o.assigned_chef_name = null; } if (assigned_chef !== undefined) o.assigned_chef = assigned_chef || undefined; saveDemo(d); }
    return;
  }
  const patch: any = { status, updated_at: new Date().toISOString() };
  if (progress !== undefined) patch.progress = progress;
  if (status === 'NEW') { patch.assigned_chef = null; patch.claimed_at = null; }
  if (assigned_chef !== undefined) patch.assigned_chef = assigned_chef || null;
  const { error } = await supabase.from('orders').update(patch).eq('id', id); if (error) throw error;
}

export async function adminSaveMenuItem(item: Omit<MenuItem, 'id'> & { id?: string }, variants: Variant[] = [], addons: Addon[] = []) {
  if (!supabase) {
    const d = demoDB(); const payload: MenuItem = { ...(item as MenuItem), id: item.id || newId('menu') };
    if (item.id) { const index = d.menu.findIndex(x => x.id === item.id); if (index >= 0) d.menu[index] = payload; } else d.menu.unshift(payload);
    saveDemo(d); return payload;
  }
  const body: any = { ...item }; delete body.id; delete body.variants; delete body.addons;
  let id = item.id;
  if (id) { const { error } = await supabase.from('menu_items').update(body).eq('id', id); if (error) throw error; }
  else { const { data, error } = await supabase.from('menu_items').insert(body).select('id').single(); if (error) throw error; id = data.id; }
  const { error: dvError } = await supabase.from('menu_item_variants').delete().eq('menu_item_id', id); if (dvError) throw dvError;
  const { error: daError } = await supabase.from('menu_item_addons').delete().eq('menu_item_id', id); if (daError) throw daError;
  if (variants.length) { const { error } = await supabase.from('menu_item_variants').insert(variants.map(v => ({ menu_item_id: id, name: v.name, price_delta: v.price_delta, active: v.active !== false }))); if (error) throw error; }
  if (addons.length) { const { error } = await supabase.from('menu_item_addons').insert(addons.map(a => ({ menu_item_id: id, name: a.name, price_delta: a.price_delta, active: a.active !== false }))); if (error) throw error; }
  return { ...(item as MenuItem), id } as MenuItem;
}
export async function adminUpsert(type: 'categories' | 'tables' | 'reviews' | 'gallery', payload: any, id?: string) {
  if (!supabase) { const d = demoDB(); const arr = (d as any)[type] as any[]; if (id) { const index = arr.findIndex(x => x.id === id); if (index >= 0) arr[index] = { ...arr[index], ...payload }; } else arr.unshift({ id: newId(type), ...payload, created_at: new Date().toISOString() }); saveDemo(d); return; }
  const table = type === 'categories' ? 'categories' : type === 'tables' ? 'restaurant_tables' : type;
  const q = id ? supabase.from(table).update(payload).eq('id', id) : supabase.from(table).insert(payload);
  const { error } = await q; if (error) throw error;
}
export async function adminDelete(type: 'menu' | 'categories' | 'tables' | 'reviews' | 'gallery', id: string) {
  if (!supabase) { const d = demoDB(); const key = type === 'menu' ? 'menu' : type; (d as any)[key] = (d as any)[key].filter((x: any) => x.id !== id); saveDemo(d); return; }
  const table = type === 'menu' ? 'menu_items' : type === 'categories' ? 'categories' : type === 'tables' ? 'restaurant_tables' : type;
  const { error } = await supabase.from(table).delete().eq('id', id); if (error) throw error;
}
export async function updateSettings(settings: Partial<Settings>) {
  if (!supabase) { const d = demoDB(); d.settings = { ...d.settings, ...settings } as Settings; saveDemo(d); return; }
  const { error } = await supabase.from('site_settings').upsert({ ...settings, id: 1, updated_at: new Date().toISOString() }); if (error) throw error;
}
export async function fetchAdminContent() {
  if (!supabase) { const d = demoDB(); return { settings: d.settings, content: d.content, sections: d.sections, media: await resolveMediaRows(d.siteMedia) }; }
  const [s, c, se, m] = await Promise.all([
    supabase.from('site_settings').select('*').eq('id', 1).single(), supabase.from('site_content').select('*'), supabase.from('site_sections').select('*').order('display_order'), supabase.from('site_media').select('*').order('section_key').order('sort_order')
  ]);
  if (s.error) throw s.error; if (c.error) throw c.error; if (se.error) throw se.error; if (m.error) throw m.error;
  const map: SiteContent = {}; (c.data || []).forEach((x: any) => { map[x.content_key] = x.content_value; });
  const sections: SiteSections = {}; (se.data || []).forEach((x: any) => { sections[x.section_key] = { visible: x.is_visible, order: x.display_order, title: x.title, settings: x.settings || {} }; });
  return { settings: s.data as Settings, content: map, sections, media: (m.data || []) as SiteMedia[] };
}
export async function saveSiteContent(keyName: string, value: any) {
  if (!supabase) { const d = demoDB(); d.content[keyName] = value; saveDemo(d); return; }
  const { error } = await supabase.from('site_content').upsert({ content_key: keyName, content_value: value, published: true, updated_at: new Date().toISOString() }); if (error) throw error;
}
export async function saveSiteSection(keyName: string, patch: { is_visible?: boolean; display_order?: number; title?: string; settings?: Record<string, any> }) {
  if (!supabase) { const d = demoDB(); const current = d.sections[keyName] || { visible: true, order: 1, title: keyName, settings: {} }; d.sections[keyName] = { visible: patch.is_visible ?? current.visible, order: patch.display_order ?? current.order, title: patch.title || current.title || keyName, settings: patch.settings ?? current.settings ?? {} }; saveDemo(d); return; }
  const current = await supabase.from('site_sections').select('*').eq('section_key', keyName).maybeSingle();
  const { error } = await supabase.from('site_sections').upsert({ section_key: keyName, title: patch.title || current.data?.title || keyName, display_order: patch.display_order ?? current.data?.display_order ?? 1, is_visible: patch.is_visible ?? current.data?.is_visible ?? true, settings: patch.settings ?? current.data?.settings ?? {}, published: true, updated_at: new Date().toISOString() });
  if (error) throw error;
}
export async function uploadSiteMedia(file: File, sectionKey: string, caption = '') {
  checkUpload(file, 'media');
  const mediaType: SiteMedia['media_type'] = file.type.startsWith('video/') ? 'video' : 'image';
  if (!supabase) {
    const fileId = newId('file'); await fileDbPut(fileId, file);
    const d = demoDB(); const row: SiteMedia = { id: newId('media'), section_key: sectionKey, media_type: mediaType, media_url: `idb:${fileId}`, caption, sort_order: d.siteMedia.filter(x => x.section_key === sectionKey).length + 1, active: true, created_at: new Date().toISOString() }; d.siteMedia.push(row); saveDemo(d);
    return { ...row, media_url: await resolveStoredUrl(row.media_url) };
  }
  const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
  const path = `${sectionKey}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage.from('site-media').upload(path, file, { upsert: false, contentType: file.type || undefined, cacheControl: '3600' });
  if (uploadError) throw uploadError;
  const { data: publicData } = supabase.storage.from('site-media').getPublicUrl(path);
  const { data: last } = await supabase.from('site_media').select('sort_order').eq('section_key', sectionKey).order('sort_order', { ascending: false }).limit(1).maybeSingle();
  const nextOrder = Number(last?.sort_order || 0) + 1;
  const { data, error } = await supabase.from('site_media').insert({ section_key: sectionKey, media_type: mediaType, media_url: publicData.publicUrl, caption: caption || null, sort_order: nextOrder, active: true }).select('*').single();
  if (error) throw error;
  return data as SiteMedia;
}
export async function addSiteMediaUrl(sectionKey: string, mediaType: SiteMedia['media_type'], mediaUrl: string, caption = '') {
  if (!mediaUrl.trim()) throw new Error('Enter a media URL.');
  if (!supabase) { const d = demoDB(); const row: SiteMedia = { id: newId('media'), section_key: sectionKey, media_type: mediaType, media_url: mediaUrl.trim(), caption, sort_order: d.siteMedia.filter(x => x.section_key === sectionKey).length + 1, active: true, created_at: new Date().toISOString() }; d.siteMedia.push(row); saveDemo(d); return row; }
  const { data: last } = await supabase.from('site_media').select('sort_order').eq('section_key', sectionKey).order('sort_order', { ascending: false }).limit(1).maybeSingle();
  const nextOrder = Number(last?.sort_order || 0) + 1;
  const { data, error } = await supabase.from('site_media').insert({ section_key: sectionKey, media_type: mediaType, media_url: mediaUrl.trim(), caption: caption || null, sort_order: nextOrder, active: true }).select('*').single();
  if (error) throw error; return data as SiteMedia;
}
export async function deleteSiteMedia(id: string) {
  if (!supabase) {
    const d = demoDB(); const row = d.siteMedia.find(x => x.id === id);
    d.siteMedia = d.siteMedia.filter(x => x.id !== id); saveDemo(d);
    if (row?.media_url.startsWith('idb:')) { const fid = row.media_url.slice(4); const u = blobUrls.get(fid); if (u) { URL.revokeObjectURL(u); blobUrls.delete(fid); } await fileDbDelete(fid).catch(() => undefined); }
    return;
  }
  const { error } = await supabase.from('site_media').delete().eq('id', id); if (error) throw error;
}

export async function createChef(p: { email: string; password: string; full_name: string; role: 'chef' | 'kitchen_staff' | 'manager' }) {
  if (!supabase) { const d = demoDB(); d.chefs.unshift({ id: newId('chef'), full_name: p.full_name, email: p.email, role: p.role, active: true }); saveDemo(d); return; }
  const { data, error } = await supabase.functions.invoke('create-chef', { body: p }); if (error) throw error; if (data?.error) throw new Error(data.error);
}
export async function setProfileActive(id: string, active: boolean) {
  if (!supabase) { const d = demoDB(); const x = d.chefs.find(c => c.id === id); if (x) x.active = active; saveDemo(d); return; }
  const { error } = await supabase.from('profiles').update({ active, updated_at: new Date().toISOString() }).eq('id', id); if (error) throw error;
}
// Edit a staff member's name and role (admins only — enforced by the admin_profiles RLS policy).
export async function updateChef(id: string, p: { full_name: string; role: 'chef' | 'kitchen_staff' | 'manager' }) {
  if (!supabase) { const d = demoDB(); const x = d.chefs.find(c => c.id === id); if (x) { x.full_name = p.full_name; x.role = p.role; } saveDemo(d); return; }
  const { error } = await supabase.from('profiles').update({ full_name: p.full_name, role: p.role, updated_at: new Date().toISOString() }).eq('id', id); if (error) throw error;
}
// Remove a staff member's access. This deletes their staff profile (so they disappear from the
// Staff list and can no longer sign in to the admin/chef portal). Their underlying Supabase Auth
// login is left in place — deleting that entirely requires a server-side (service-role) function.
export async function deleteChef(id: string) {
  if (!supabase) { const d = demoDB(); d.chefs = d.chefs.filter(c => c.id !== id); saveDemo(d); return; }
  const { error } = await supabase.from('profiles').delete().eq('id', id); if (error) throw error;
}
// Admins can delete an order once it is at least 24 hours old (also enforced in the database
// by the admin_orders_delete policy, so this can't be bypassed from the browser).
export async function adminDeleteOrder(id: string) {
  if (!supabase) { const d = demoDB(); d.orders = d.orders.filter(o => o.id !== id); saveDemo(d); return; }
  const { error } = await supabase.from('orders').delete().eq('id', id); if (error) throw error;
}
export async function currentRole(): Promise<UserRole | null> {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser(); if (!user) return null;
  const { data, error } = await supabase.from('profiles').select('role,active').eq('id', user.id).maybeSingle(); if (error) throw error;
  return data?.active ? data.role as UserRole : null;
}


/* =========================================================
   Guests: remember my orders on this device so the order
   never disappears while it is still being prepared
   ========================================================= */
const MY_ORDERS_KEY = 'bitecraft:my-orders';
export type MyOrderRef = { token: string; number: string; placed_at: string };
export function getMyOrders(): MyOrderRef[] {
  try {
    const list = JSON.parse(localStorage.getItem(MY_ORDERS_KEY) || '[]') as MyOrderRef[]; const cutoff = Date.now() - 48 * 3600 * 1000;
    return list.filter(x => x && x.token && new Date(x.placed_at).getTime() > cutoff);
  } catch { return []; }
}
function writeMyOrders(list: MyOrderRef[]) {
  try { localStorage.setItem(MY_ORDERS_KEY, JSON.stringify(list.slice(0, 10))); window.dispatchEvent(new Event('bitecraft:my-orders')); } catch { /* storage may be blocked */ }
}
export function rememberOrder(ref: MyOrderRef) { writeMyOrders([ref, ...getMyOrders().filter(x => x.token !== ref.token)]); }
export function forgetOrder(token: string) { writeMyOrders(getMyOrders().filter(x => x.token !== token)); }

export async function sendCustomerMessage(token: string, body: string) {
  const text = body.trim(); if (!text) throw new Error('Type a message first.');
  if (!supabase) {
    const d = demoDB(); const o = d.orders.find(x => x.tracking_token === token); if (!o) throw new Error('Order not found.');
    if (isFinished(o)) throw new Error(o.status === 'CANCELLED' ? 'This order was cancelled.' : 'This order has been served, so messages are closed.');
    o.messages = [...(o.messages || []), { id: newId('msg'), sender: 'customer', sender_name: o.customer_name, body: text, created_at: new Date().toISOString() }]; saveDemo(d); return;
  }
  const { error } = await supabase.rpc('send_customer_message', { p_tracking_token: token, p_body: text }); if (error) throw error;
}

/* =========================================================
   Staff: chefs, kitchen staff and managers
   ========================================================= */
const demoStaff = (): StaffInfo => {
  const role = (sessionStorage.getItem('bitecraft:demo-role') as UserRole) || 'chef';
  const name = sessionStorage.getItem('bitecraft:demo-name') || (role === 'manager' ? 'Demo manager' : role === 'kitchen_staff' ? 'Demo kitchen staff' : 'Demo chef');
  return { id: sessionStorage.getItem('bitecraft:demo-id') || `demo-${role}`, role, name };
};
export async function currentStaff(): Promise<StaffInfo | null> {
  if (!supabase) {
    const r = sessionStorage.getItem('bitecraft:role'); if (!r) return null;
    return r === 'admin' ? { id: 'demo-admin', role: 'admin', name: 'Demo admin' } : demoStaff();
  }
  const { data: { user } } = await supabase.auth.getUser(); if (!user) return null;
  const { data, error } = await supabase.from('profiles').select('role,active,full_name,email').eq('id', user.id).maybeSingle(); if (error) throw error;
  if (!data?.active) return null;
  return { id: user.id, role: data.role as UserRole, name: data.full_name || data.email || 'Staff' };
}

const chunk = <T,>(list: T[], size: number) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

// Orders from the last 3 days with their status history, for the chef / kitchen staff / manager screens.
export async function fetchKitchenOrders(): Promise<RestaurantOrder[]> {
  if (!supabase) return [...demoDB().orders].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const since = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
  const { data, error } = await supabase.from('orders').select('*, restaurant_tables(table_number), order_items(*), assigned:assigned_chef(full_name,email)').gte('created_at', since).order('created_at', { ascending: false }).limit(250);
  if (error) throw error;
  const orders = ((data || []) as any[]).map(o => ({ ...o, table_number: o.restaurant_tables?.table_number ?? o.table_number ?? null })) as RestaurantOrder[];
  try {
    const rows: any[] = [];
    for (const ids of chunk(orders.map(o => o.id), 40)) {
      const { data: h } = await supabase.from('order_status_history').select('order_id,new_status,created_at,changed_by').in('order_id', ids).order('created_at'); rows.push(...(h || []));
    }
    const who = [...new Set(rows.map(r => r.changed_by).filter(Boolean))] as string[]; const names = new Map<string, string>();
    if (who.length) { const { data: ps } = await supabase.from('profiles').select('id,full_name,email').in('id', who); (ps || []).forEach((p: any) => names.set(p.id, p.full_name || p.email || 'Staff')); }
    const byOrder = new Map<string, OrderHistoryEntry[]>();
    rows.forEach(r => { const list = byOrder.get(r.order_id) || []; list.push({ status: r.new_status, at: r.created_at, by: r.changed_by ? names.get(r.changed_by) || null : null }); byOrder.set(r.order_id, list); });
    return orders.map(o => ({ ...o, history: byOrder.get(o.id) || [] }));
  } catch { return orders; } // the timeline is a nice-to-have; never block the order list
}

export async function claimOrder(orderId: string) {
  if (!supabase) {
    const d = demoDB(); const o = d.orders.find(x => x.id === orderId); const me = demoStaff(); if (!o) throw new Error('Order not found.');
    if (o.assigned_chef && o.assigned_chef !== me.id) throw new Error(`This order was just taken by ${o.assigned_chef_name || 'another chef'}.`);
    if (o.status !== 'NEW') throw new Error('This order is no longer available.');
    o.assigned_chef = me.id; o.assigned_chef_name = me.name; o.claimed_at = new Date().toISOString(); demoSetStatus(o, 'CONFIRMED', stageDefaults.CONFIRMED); saveDemo(d); return;
  }
  const { error } = await supabase.rpc('claim_order', { p_order_id: orderId }); if (error) throw error;
}
export async function releaseOrder(orderId: string) {
  if (!supabase) {
    const d = demoDB(); const o = d.orders.find(x => x.id === orderId); if (!o) return;
    o.assigned_chef = undefined; o.assigned_chef_name = null; o.claimed_at = null; demoSetStatus(o, 'NEW', stageDefaults.NEW); saveDemo(d); return;
  }
  const { error } = await supabase.rpc('release_order', { p_order_id: orderId }); if (error) throw error;
}
export async function setOrderStage(orderId: string, status: 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED', progress?: number) {
  if (!supabase) {
    const d = demoDB(); const o = d.orders.find(x => x.id === orderId); const me = demoStaff(); if (!o) throw new Error('Order not found.');
    if (['SERVED', 'COMPLETED', 'CANCELLED'].includes(o.status)) throw new Error('This order is already finished.');
    if (o.assigned_chef && o.assigned_chef !== me.id && sessionStorage.getItem('bitecraft:role') !== 'admin') throw new Error('This order belongs to another chef.');
    if (!o.assigned_chef && sessionStorage.getItem('bitecraft:role') !== 'admin') throw new Error('Take this order first.');
    const next = status === 'PREPARING' ? Math.min(85, Math.max(30, progress ?? (o.status === 'PREPARING' ? o.progress ?? 40 : 40))) : status === 'READY' ? 90 : status === 'SERVED' ? 100 : undefined;
    demoSetStatus(o, status, next); saveDemo(d); return;
  }
  const { error } = await supabase.rpc('set_order_stage', { p_order_id: orderId, p_status: status, p_progress: progress ?? null }); if (error) throw error;
}
export async function setOrderPayment(orderId: string, paid: boolean, method?: PaymentMethod) {
  if (!supabase) {
    const d = demoDB(); const o = d.orders.find(x => x.id === orderId); if (!o) return;
    o.payment_status = paid ? 'PAID' : 'UNPAID'; o.payment_method = paid ? method || 'CASH' : null; o.paid_at = paid ? new Date().toISOString() : null; saveDemo(d); return;
  }
  const { error } = await supabase.rpc('set_order_payment', { p_order_id: orderId, p_paid: paid, p_method: method || null }); if (error) throw error;
}
export async function sendStaffMessage(orderId: string, body: string) {
  const text = body.trim(); if (!text) throw new Error('Type a message first.');
  if (!supabase) {
    const d = demoDB(); const o = d.orders.find(x => x.id === orderId); const me = demoStaff(); if (!o) throw new Error('Order not found.');
    if (isFinished(o)) throw new Error('This order is closed, so messages with the guest are closed too.');
    o.messages = [...(o.messages || []), { id: newId('msg'), sender: 'staff', sender_name: me.name, sender_role: me.role, body: text, created_at: new Date().toISOString() }]; saveDemo(d); return;
  }
  const { error } = await supabase.rpc('send_staff_message', { p_order_id: orderId, p_body: text }); if (error) throw error;
}
export async function fetchOrderMessages(orderId: string): Promise<OrderMessage[]> {
  if (!supabase) {
    const o = demoDB().orders.find(x => x.id === orderId); if (!o) return [];
    if (isFinished(o) && sessionStorage.getItem('bitecraft:role') !== 'admin' && demoStaff().role === 'chef') return [];
    return o.messages || [];
  }
  const { data, error } = await supabase.from('order_messages').select('id,sender,sender_name,sender_role,body,created_at').eq('order_id', orderId).order('created_at'); if (error) throw error;
  return (data || []) as OrderMessage[];
}
// Latest guest message per order, so chefs can see which orders have something new to read.
export async function fetchMessageStats(orderIds: string[]): Promise<Record<string, { total: number; lastCustomerAt: string | null }>> {
  const out: Record<string, { total: number; lastCustomerAt: string | null }> = {};
  const add = (orderId: string, sender: string, at: string) => { const x = out[orderId] || (out[orderId] = { total: 0, lastCustomerAt: null }); x.total += 1; if (sender === 'customer' && (!x.lastCustomerAt || at > x.lastCustomerAt)) x.lastCustomerAt = at; };
  if (!supabase) { demoDB().orders.forEach(o => (o.messages || []).forEach(m => add(o.id, m.sender, m.created_at))); return out; }
  try {
    for (const ids of chunk(orderIds, 40)) {
      const { data } = await supabase.from('order_messages').select('order_id,sender,created_at').in('order_id', ids);
      (data || []).forEach((m: any) => add(m.order_id, m.sender, m.created_at));
    }
  } catch { /* unread badges are optional */ }
  return out;
}
export function subscribeKitchen(callback: () => void) {
  let timer = 0; const fire = () => { window.clearTimeout(timer); timer = window.setTimeout(callback, 250); };
  if (!supabase) { const t = window.setInterval(callback, 2500); return () => window.clearInterval(t); }
  const channel = supabase.channel(`kitchen-${Math.random().toString(36).slice(2, 10)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fire)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'order_messages' }, fire)
    .subscribe();
  const t = window.setInterval(callback, 12000); // safety net if a realtime message is missed
  return () => { window.clearTimeout(timer); window.clearInterval(t); void supabase?.removeChannel(channel); };
}

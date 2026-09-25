import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRight, Bell, Check, CheckCircle2, ChefHat, ChevronDown, ChevronLeft, CircleOff, Clock3, Edit3,
  Eye, Flame, Home as HomeIcon, ChevronsLeft, ChevronsRight, MessageCircle, PanelLeft, Image as ImageIcon, LayoutDashboard, LogOut, Mail, MapPin, Menu as MenuIcon,
  MessageSquare, Minus, PackageCheck, Phone, Plus, Search, Save, Settings as SettingsIcon, ShoppingBag,
  Star, Table2, Trash2, Users, Utensils, X, Zap, Monitor, Tablet, Smartphone, Upload, Video, ImagePlus, Link2, Palette, History as HistoryIcon, Printer, Wallet
} from 'lucide-react';
import {
  rememberOrder, setOrderPayment, fetchMessageStats, adminDashboard, adminDelete, adminDeleteOrder, adminDeleteOldOrders, adminList, adminSaveMenuItem, adminUpsert, createChef, createOrder, deleteChef, updateChef,
  currentRole, fetchAdminContent, fetchOrderByToken, fetchPublicConfig, fetchTables, formatMoney, hasSupabase,
  itemUnit, placeholderImages, saveSiteContent, saveSiteSection, setProfileActive, submitReview, supabase,
  updateOrderStatus, updateSettings, uploadSiteMedia, addSiteMediaUrl, deleteSiteMedia, demoContent,
  fetchBrand, uploadImage, MAX_UPLOAD_MB, applyBrandTheme, defaultBrandTheme, readBrandCache, writeBrandCache, contrastRatio, isHex, orderChefName, type BrandTheme, type CartItem, type Category, type GalleryItem, type MenuItem, type OrderStatus,
  type RestaurantOrder, type Review, type Settings, type SiteContent, type SiteSections, type SiteMedia, type Table, type UserRole, type Variant, type Addon
} from './lib';
import { ActiveOrderDock, ChefTag, OrderConversationModal, OrderTracking, PayChip, ProgressBar, StaffDashboard } from './orderflow';

const defaultSettings: Settings = {
  restaurant_name: 'e-menu', phone: '+250 788 000 000', email: 'hello@bitecraft.rw', address: 'KG 7 Ave, Kigali, Rwanda',
  opening_hours: '10:00 – 22:00', currency: 'RWF', tax_percentage: 0, restaurant_status: 'OPEN'
};

/* ---------- Brand: one source of truth for name, logo and colours ---------- */
type BrandCtx = { name: string; logoUrl: string; logoOnly: boolean; refresh: () => void; preview: (draft: Partial<Settings> | null) => void };
const BrandContext = createContext<BrandCtx>({ name: defaultSettings.restaurant_name, logoUrl: '', logoOnly: false, refresh: () => undefined, preview: () => undefined });
const useBrand = () => useContext(BrandContext);
applyBrandTheme(readBrandCache()?.brand_theme); // apply cached colours before first paint to avoid a colour flash

function BrandProvider({ children }: { children: React.ReactNode }) {
  const [saved, setSaved] = useState<Settings>(() => ({ ...defaultSettings, ...(readBrandCache() || {}) }) as Settings);
  const [draft, setDraft] = useState<Partial<Settings> | null>(null);
  const refresh = useCallback(() => {
    void fetchBrand().then(s => { setSaved(prev => ({ ...prev, ...s })); writeBrandCache(s); setDraft(null); }).catch(() => setDraft(null));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const eff = { ...saved, ...(draft || {}) };
  const name = (eff.restaurant_name || '').trim() || defaultSettings.restaurant_name;
  const logoUrl = eff.logo_url || '';
  const iconUrl = eff.favicon_url || eff.logo_url || '';
  const theme = eff.brand_theme || null;
  useEffect(() => { applyBrandTheme(theme); }, [theme]);
  useEffect(() => {
    document.title = `${name} · Restaurant`;
    document.querySelector('meta[name="description"]')?.setAttribute('content', `${name} restaurant digital menu, table ordering and kitchen management.`);
  }, [name]);
  useEffect(() => { document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isHex(theme?.primary) ? theme!.primary! : '#591c13'); }, [theme]);
  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!iconUrl) { link?.remove(); return; }
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
    link.href = iconUrl;
  }, [iconUrl]);
  const value = useMemo<BrandCtx>(() => ({ name, logoUrl, logoOnly: Boolean(theme?.logo_only), refresh, preview: setDraft }), [name, logoUrl, theme, refresh]);
  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

function BrandLogo() {
  const { name, logoUrl, logoOnly } = useBrand();
  return <>{logoUrl ? <img className="brand-logo" src={logoUrl} alt={logoOnly ? name : ''} /> : <span className="brand-mark">{name.charAt(0).toUpperCase()}</span>}{(!logoUrl || !logoOnly) && <span className="brand-name">{name}</span>}</>;
}

function ImageField({ label, value, onChange, required, folder = 'images', maxDim = 1600 }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; folder?: string; maxDim?: number }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const fileRef = useRef<HTMLInputElement>(null);
  const isData = value.startsWith('data:');
  const pick = async (file?: File) => { if (!file) return; setBusy(true); setError(''); try { onChange(await uploadImage(file, { folder, maxDim })); } catch (e: any) { setError(e?.message || 'Upload failed.'); } finally { setBusy(false); } };
  return <div className="field"><label>{label}</label>
    <div className="image-field">{value && <img className="image-field-thumb" src={value} alt="" />}
      <input required={required} readOnly={isData} value={isData ? 'Uploaded photo' : value} onChange={e => onChange(e.target.value)} placeholder="Upload a photo, or paste a link" />
      <button type="button" className="btn light-btn small" disabled={busy} onClick={() => fileRef.current?.click()}><Upload size={14} /> {busy ? 'UPLOADING…' : 'UPLOAD'}</button>
      {isData && <button type="button" className="ghost danger" title="Remove photo" onClick={() => onChange('')}><X size={15} /></button>}
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; void pick(f); }} />
    </div>
    <small className="field-hint">JPG, PNG, WEBP · up to {MAX_UPLOAD_MB} MB</small>{error && <div className="error">{error}</div>}
  </div>;
}
const sectionKeys = ['hero', 'warm', 'featured_items', 'categories', 'why_choose_us', 'about', 'reviews', 'gallery', 'cta', 'footer'];
const sectionLabels: Record<string, string> = {
  hero: 'Hero', warm: 'Hungry band', featured_items: 'Chef specials', categories: 'Categories', why_choose_us: 'Why choose us', about: 'About', reviews: 'Reviews', gallery: 'Gallery', cta: 'CTA', footer: 'Footer'
};
const statusLabels: Record<OrderStatus, string> = {
  NEW: 'New order', CONFIRMED: 'Confirmed', PREPARING: 'Preparing', READY: 'Ready', SERVED: 'Served', CANCELLED: 'Cancelled', COMPLETED: 'Completed'
};
const activeKitchen: OrderStatus[] = ['NEW', 'CONFIRMED', 'PREPARING', 'READY'];

function usePublicData() {
  const [data, setData] = useState<any>({ items: [], categories: [], settings: defaultSettings, content: {}, gallery: [], reviews: [], sections: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = () => { setLoading(true); setError(''); void fetchPublicConfig().then(setData).catch(e => setError(e?.message || 'Unable to load restaurant data.')).finally(() => setLoading(false)); };
  useEffect(() => { refresh(); }, []);
  return { ...data, loading, error, refresh };
}

function visible(sections: SiteSections | undefined, key: string) { return sections?.[key]?.visible !== false; }

/** Scrolls to the top on every page change, or to the section named in the link (for example /about#contact). */
function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) { window.scrollTo({ top: 0, left: 0 }); return; }
    const id = decodeURIComponent(hash.slice(1)); let tries = 0; let timer = 0;
    const go = () => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); else if (tries++ < 20) timer = window.setTimeout(go, 100); };
    go(); return () => window.clearTimeout(timer);
  }, [pathname, hash]);
  return null;
}

function Layout({ cartCount, settings }: { cartCount?: number; settings?: Settings }) {
  const [open, setOpen] = useState(false);
  const cart = cartCount || 0;
  const { pathname, hash } = useLocation();
  const is = (path: string, h = '') => pathname === path && (h ? hash === h : !hash);
  const items: { to: string; label: string; on: boolean }[] = [
    { to: '/', label: 'Home', on: is('/') }, { to: '/menu', label: 'Menu', on: pathname === '/menu' },
    { to: '/about', label: 'About', on: is('/about') }, { to: '/reviews', label: 'Reviews', on: pathname === '/reviews' },
    { to: '/about#contact', label: 'Contact', on: is('/about', '#contact') }
  ];
  return <>
    <header className="site-nav">
      <div className="container nav-inner">
        <Link to="/" className="brand light"><BrandLogo /></Link>
        <button className="mobile-menu" onClick={() => setOpen(v => !v)} aria-label="Toggle navigation"><MenuIcon size={22} /></button>
        <nav className={open ? 'nav-open' : ''}>
          {items.map(x => <Link key={x.to} to={x.to} className={x.on ? 'active' : ''} aria-current={x.on ? 'page' : undefined} onClick={() => setOpen(false)}>{x.label}</Link>)}
        </nav>
        <Link className="nav-order" to="/cart"><ShoppingBag size={16} /> Order {cart > 0 && <span className="cart-badge">{cart}</span>}</Link>
        {cart > 0 && <Link className="mobile-cart-float" to="/cart"><ShoppingBag size={17} /><span>View order</span><b>{cart} {cart === 1 ? 'item' : 'items'}</b><ArrowRight size={16} /></Link>}
      </div>
    </header>
    <ActiveOrderDock />
  </>;
}

function Footer({ settings, content }: { settings: Settings; content: SiteContent }) {
  return <footer className="footer" id="contact">
    <div className="container footer-grid">
      <div><Link to="/" className="brand light"><BrandLogo /></Link><p>{content.footer?.tagline || 'Good food, warm tables, memorable moments.'}</p></div>
      <div><b>Visit us</b><p><MapPin size={14} /> {settings.address || 'Kigali, Rwanda'}</p><p><Phone size={14} /> {settings.phone || '+250 788 000 000'}</p></div>
      <div><b>Hours</b><p>{settings.opening_hours || '10:00 – 22:00'}</p><p><Mail size={14} /> {settings.email || 'hello@bitecraft.rw'}</p></div>
    </div>
  </footer>;
}

function Home({ onPick }: { onPick: (item: MenuItem) => void }) {
  const data = usePublicData();
  const brand = useBrand();
  const featured = data.items.filter((x: MenuItem) => x.featured || x.popular).slice(0, 4);
  const hero = data.content['home.hero'] || {};
  const warm = data.content['home.warm'] || {};
  const why = data.content['home.why'] || {};
  const about = data.content['home.about'] || {};
  const featuredCopy = data.content['home.featured_items'] || {};
  const categoriesCopy = data.content['home.categories'] || {};
  const reviewsCopy = data.content['home.reviews'] || {};
  const cta = data.content['home.cta'] || {};
  const heroMedia = data.media?.filter((m: SiteMedia) => m.section_key === 'hero' && m.active !== false).sort((a: SiteMedia, b: SiteMedia) => Number(a.sort_order || 0) - Number(b.sort_order || 0))?.[0];
  const aboutMedia = data.media?.filter((m: SiteMedia) => m.section_key === 'about' && m.active !== false).sort((a: SiteMedia, b: SiteMedia) => Number(a.sort_order || 0) - Number(b.sort_order || 0))?.[0];
  const ctaMedia = data.media?.filter((m: SiteMedia) => m.section_key === 'cta' && m.active !== false).sort((a: SiteMedia, b: SiteMedia) => Number(a.sort_order || 0) - Number(b.sort_order || 0))?.[0];
  const galleryMedia = data.media?.filter((m: SiteMedia) => m.section_key === 'gallery' && m.active !== false).sort((a: SiteMedia, b: SiteMedia) => Number(a.sort_order || 0) - Number(b.sort_order || 0)) || [];
  const gallery = [
    ...data.gallery.map((g: GalleryItem) => ({ id: `gallery-${g.id}`, type: 'image' as const, url: g.image_url, caption: g.caption || `${brand.name} dish` })),
    ...galleryMedia.map((m: SiteMedia) => ({ id: m.id, type: m.media_type, url: m.media_url, caption: m.caption || `${brand.name} visual` }))
  ].slice(0, 8);
  const sectionSettings = data.sections || {};
  const resp = (key: string, device: 'desktop' | 'tablet' | 'mobile') => sectionSettings[key]?.settings?.responsive?.[device] || {};
  const heroCss = (() => {
    const d = resp('hero', 'desktop'), t = resp('hero', 'tablet'), m = resp('hero', 'mobile');
    const sectionRules = sectionKeys.filter(k => !['hero', 'footer'].includes(k)).map(key => {
      const sd = resp(key, 'desktop'), st = resp(key, 'tablet'), sm = resp(key, 'mobile');
      const dp = Number(sd.padding || 82), tp = Number(st.padding || 68), mp = Number(sm.padding || 54);
      return `.section-responsive-${key}{padding-top:${dp}px!important;padding-bottom:${dp}px!important;} @media(max-width:1024px){.section-responsive-${key}{padding-top:${tp}px!important;padding-bottom:${tp}px!important;}} @media(max-width:760px){.section-responsive-${key}{padding-top:${mp}px!important;padding-bottom:${mp}px!important;}}`;
    }).join('\n');
    return <style>{`
      .hero-live-editable .hero-copy { align-items:${d.align || 'flex-start'}; text-align:${d.textAlign || 'left'}; }
      .hero-live-editable .hero-copy h1 { font-size:${Number(d.headingSize || 82)}px; }
      .hero-live-editable { min-height:${Number(d.minHeight || 680)}px; }
      @media (max-width: 1024px) { .hero-live-editable .hero-copy { align-items:${t.align || 'flex-start'}; text-align:${t.textAlign || 'left'}; } .hero-live-editable .hero-copy h1 { font-size:${Number(t.headingSize || 68)}px; } .hero-live-editable { min-height:${Number(t.minHeight || 610)}px; } }
      @media (max-width: 760px) { .hero-live-editable .hero-copy { align-items:${m.align || 'flex-start'}; text-align:${m.textAlign || 'left'}; } .hero-live-editable .hero-copy h1 { font-size:${Number(m.headingSize || 52)}px; } .hero-live-editable { min-height:${Number(m.minHeight || 570)}px; } }
      ${sectionRules}
    `}</style>;
  })();
  if (data.loading) return <div className="loading"><div className="loader"><span></span><span></span><span></span></div></div>;
  return <div>
    {heroCss}
    <Layout settings={data.settings} />
    <main>
      {data.settings.restaurant_status === 'CLOSED' && <div className="closed-strip"><CircleOff size={15} /> We are currently closed. Browse the menu and plan your next visit.</div>}
      {visible(data.sections, 'hero') && <section className="hero hero-live-editable" style={{ backgroundImage: heroMedia?.media_type === 'image' ? `linear-gradient(90deg,rgba(43,16,10,.88),rgba(43,16,10,.26)),url(${heroMedia.media_url})` : `linear-gradient(90deg,rgba(43,16,10,.88),rgba(43,16,10,.26)),url(${hero.image_url || placeholderImages.hero})` }}>
        {heroMedia?.media_type === 'video' && <video className="section-video-bg" autoPlay muted loop playsInline src={heroMedia.media_url} />}
        <div className="container hero-copy"><span className="eyebrow warm">{hero.eyebrow || 'FRESHLY PREPARED · TABLE-SIDE ORDERING'}</span><h1>{hero.title || 'FLAVOR THAT FEELS LIKE HOME.'}</h1><p>{hero.subtitle || 'Bold comfort food, made to order and served straight to your table.'}</p><div className="hero-actions"><Link className="btn gold" to="/menu">{hero.primary_button || 'VIEW MENU'} <ArrowRight size={17} /></Link><Link className="btn outline" to="/about">{hero.secondary_button || 'OUR STORY'}</Link></div></div>
      </section>}
      {visible(data.sections, 'warm') && <section className="warm-band section-responsive-warm"><div className="container warm-inner"><div><span className="eyebrow">{warm.label || 'ARE YOU HUNGRY?'}</span><h2>{warm.title || "WE'RE READY."}</h2></div><p>{warm.text || 'Choose your table, build your meal and send the order straight to our kitchen.'}</p><Link className="btn dark" to="/menu">START AN ORDER <ArrowRight size={16} /></Link></div></section>}
      {visible(data.sections, 'featured_items') && <section className="section section-responsive-featured_items"><div className="container"><SectionHeading eyebrow={featuredCopy.eyebrow || "CHEF'S SPECIAL PICKS"} title={featuredCopy.title || 'Our meal menu'} link="View full menu" href="/menu"/><div className="cards four">{featured.map((item: MenuItem) => <FoodCard key={item.id} item={item} onPick={onPick} currency={data.settings.currency} />)}</div></div></section>}
      {visible(data.sections, 'categories') && <section className="section muted section-responsive-categories"><div className="container"><SectionHeading eyebrow={categoriesCopy.eyebrow || 'WHAT ARE YOU CRAVING?'} title={categoriesCopy.title || 'Pick your favorite'}/><div className="category-grid">{data.categories.slice(0, 6).map((cat: Category) => <Link key={cat.id} to={`/menu?category=${encodeURIComponent(cat.id)}`} className="category-card"><img src={cat.image_url || placeholderImages.burger} /><span>{cat.name}</span><ArrowRight size={16} /></Link>)}</div></div></section>}
      {visible(data.sections, 'why_choose_us') && <section className="section section-responsive-why"><div className="container split"><div><span className="eyebrow">WHY CHOOSE US</span><h2 className="display">{why.title || 'Big flavor. Honest ingredients. Fast service.'}</h2><p className="lead">{why.text || 'Every dish starts with fresh ingredients and ends with a table worth lingering around.'}</p></div><div className="feature-list">{(why.items || ['Fresh daily ingredients', 'Made-to-order kitchen', 'Friendly table service']).map((x: string, i: number) => <div className="feature" key={x}><span>{String(i + 1).padStart(2, '0')}</span><div><b>{x}</b><p>Carefully prepared for consistent flavor and a better table experience.</p></div></div>)}</div></div></section>}
      {visible(data.sections, 'about') && <section className="section cream section-responsive-about" id="about"><div className="container split reverse">{aboutMedia?.media_type === 'video' ? <video className="about-photo" autoPlay muted loop playsInline controls src={aboutMedia.media_url} /> : <img className="about-photo" src={aboutMedia?.media_url || placeholderImages.chicken} alt={aboutMedia?.caption || brand.name} />}<div><span className="eyebrow">OUR STORY</span><h2 className="display">{about.title || 'A neighborhood table with a kitchen that cares.'}</h2><p className="lead">{about.text || 'A warm restaurant experience built around comfort food, quick service and good company.'}</p><Link className="text-link" to="/about">Meet the restaurant <ArrowRight size={16} /></Link></div></div></section>}
      {visible(data.sections, 'reviews') && <section className="section section-responsive-reviews"><div className="container"><SectionHeading eyebrow={reviewsCopy.eyebrow || 'OUR HAPPY CUSTOMERS'} title={reviewsCopy.title || 'Words from the table'} link="Read all reviews" href="/reviews"/><div className="review-grid">{data.reviews.slice(0, 3).map((r: Review) => <ReviewCard key={r.id} review={r} />)}</div></div></section>}
      {visible(data.sections, 'gallery') && <section className="section muted section-responsive-gallery"><div className="container"><SectionHeading eyebrow="OUR DISH GALLERY" title={data.content['home.gallery']?.title || 'A little look inside'}/><div className="gallery-grid">{gallery.map((g: any) => g.type === 'video' ? <video key={g.id} src={g.url} autoPlay muted loop playsInline controls={false} /> : <img key={g.id} src={g.url} alt={g.caption} />)}</div></div></section>}
      {visible(data.sections, 'cta') && <section className="cta section-responsive-cta" style={ctaMedia ? { backgroundImage: ctaMedia.media_type === 'image' ? `linear-gradient(90deg,rgba(218,169,52,.92),rgba(218,169,52,.74)),url(${ctaMedia.media_url})` : undefined } : undefined}>{ctaMedia?.media_type === 'video' && <video className="section-video-bg section-video-bg-dark" autoPlay muted loop playsInline src={ctaMedia.media_url} />}<div className="container cta-inner"><div><span className="eyebrow">READY WHEN YOU ARE</span><h2>{cta.title || 'Make your table the best seat in the house.'}</h2><p>{cta.text || 'Order directly from the menu and skip the wait.'}</p></div><Link className="btn dark" to="/menu">ORDER NOW <ArrowRight size={18} /></Link></div></section>}
    </main><Footer settings={data.settings} content={data.content} />
  </div>;
}

function SectionHeading({ eyebrow, title, link, href }: { eyebrow: string; title: string; link?: string; href?: string }) {
  return <div className="section-head"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>{link && href && <Link className="text-link" to={href}>{link} <ArrowRight size={15} /></Link>}</div>;
}

function FoodCard({ item, onPick, currency = 'RWF' }: { item: MenuItem; onPick: (item: MenuItem) => void; currency?: string }) {
  const { name: brandName } = useBrand();
  return <article className="food-card">
    <button className="food-image" onClick={() => onPick(item)}><img src={item.image_url || placeholderImages.burger} alt={item.name} />{item.popular && <span className="badge">POPULAR</span>}</button>
    <div className="food-body"><div><small>{item.category_name || brandName}</small><h3>{item.name}</h3></div><strong>{formatMoney(item.price, currency)}</strong></div>
    <p>{item.description}</p>
    <div className="food-foot"><span><Clock3 size={14} /> {item.prep_minutes || 15} min</span><button className="mini-add" onClick={() => onPick(item)}><Plus size={15} /> Add</button></div>
  </article>;
}

function FoodModal({ item, currency, onClose, onAdd }: { item: MenuItem; currency: string; onClose: () => void; onAdd: (item: MenuItem, qty: number, notes: string, addons: any[], variant?: Variant) => void }) {
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');
  const [variant, setVariant] = useState<Variant | undefined>(item.variants?.find(v => v.active !== false));
  const [addons, setAddons] = useState<any[]>([]);
  const unit = itemUnit(item, variant, addons);
  const toggleAddon = (a: Addon) => setAddons(prev => prev.some(x => x.id === a.id) ? prev.filter(x => x.id !== a.id) : [...prev, a]);
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal food-modal" onMouseDown={e => e.stopPropagation()}>
    <button className="modal-close" onClick={onClose}><X size={19} /></button>
    <div className="food-modal-grid"><img src={item.image_url || placeholderImages.burger} className="modal-photo" alt={item.name} /><div className="modal-copy">
      <span className="eyebrow">{item.category_name || 'MENU'}</span><h2>{item.name}</h2><p className="lead small-lead">{item.description}</p>
      <div className="modal-price">{formatMoney(unit, currency)} <small>per plate</small></div>
      {item.variants?.length ? <div className="option-block"><h4>Choose a size</h4><div className="option-grid">{item.variants.filter(v => v.active !== false).map(v => <button key={v.id} className={variant?.id === v.id ? 'option selected' : 'option'} onClick={() => setVariant(v)}><span>{v.name}</span><b>{v.price_delta ? `+${formatMoney(v.price_delta, currency)}` : 'Included'}</b></button>)}</div></div> : null}
      {item.addons?.length ? <div className="option-block"><h4>Add extras</h4><div className="addon-list">{item.addons.filter(a => a.active !== false).map(a => <label key={a.id}><input type="checkbox" checked={addons.some(x => x.id === a.id)} onChange={() => toggleAddon(a)} /><span>{a.name}</span><b>+{formatMoney(a.price_delta, currency)}</b></label>)}</div></div> : null}
      <div className="field"><label>Special requirements for this plate</label><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="No onions, sauce on the side, extra spicy..." /></div>
      <div className="modal-actions"><div className="qty"><button onClick={() => setQty(q => Math.max(1, q - 1))}><Minus size={16} /></button><b>{qty}</b><button onClick={() => setQty(q => q + 1)}><Plus size={16} /></button></div><button className="btn dark grow" onClick={() => { onAdd(item, qty, notes, addons, variant); onClose(); }}>ADD TO ORDER · {formatMoney(unit * qty, currency)}</button></div>
    </div></div>
  </div></div>;
}

function MenuPage({ cartCount, onPick }: { cartCount: number; onPick: (item: MenuItem) => void }) {
  const data = usePublicData(); const params = new URLSearchParams(useLocation().search); const initialCat = params.get('category') || 'all';
  const [cat, setCat] = useState(initialCat); const [search, setSearch] = useState('');
  const list = data.items.filter((x: MenuItem) => (cat === 'all' || x.category_id === cat) && `${x.name} ${x.description}`.toLowerCase().includes(search.toLowerCase()));
  return <div><Layout cartCount={cartCount} settings={data.settings} /><main className="page"><div className="container"><div className="menu-hero"><div><span className="eyebrow">OUR MENU</span><h1>Choose your next favorite.</h1><p>Every dish can be customized, ordered to your table and sent directly to the kitchen.</p></div><div className="menu-search"><Search size={17} /><input placeholder="Search burgers, pizza, drinks..." value={search} onChange={e => setSearch(e.target.value)} /></div></div>
    {data.settings.restaurant_status === 'CLOSED' && <div className="closed-card"><CircleOff size={18} /><div><b>Ordering is paused</b><p>We are currently closed, but you can browse the full menu.</p></div></div>}
    <div className="category-tabs"><button className={cat === 'all' ? 'active' : ''} onClick={() => setCat('all')}>All</button>{data.categories.map((c: Category) => <button key={c.id} className={cat === c.id ? 'active' : ''} onClick={() => setCat(c.id)}>{c.name}</button>)}</div>
    <div className="cards three">{list.map((item: MenuItem) => <FoodCard key={item.id} item={item} onPick={data.settings.restaurant_status === 'OPEN' ? onPick : () => undefined} currency={data.settings.currency} />)}</div>
    {!list.length && <div className="empty"><Search size={30} /><h3>No dishes found</h3><p>Try another category or search term.</p></div>}
  </div></main></div>;
}

function CartPage({ cart, setCart, settings }: { cart: CartItem[]; setCart: React.Dispatch<React.SetStateAction<CartItem[]>>; settings?: Settings }) {
  const data = usePublicData(); const currency = settings?.currency || data.settings.currency; const s = settings || data.settings;
  const subtotal = cart.reduce((sum, i) => sum + itemUnit(i, i.variant, i.addons) * i.qty, 0); const tax = subtotal * Number(s.tax_percentage || 0) / 100; const total = subtotal + tax;
  return <div><Layout cartCount={cart.length} settings={s} /><main className="page"><div className="container narrow"><div className="page-title"><span className="eyebrow">STEP 2 OF 3 · YOUR ORDER</span><h1>Cart & table order</h1><p>Review each plate before sending it to our kitchen.</p><div className="checkout-steps"><span className="done">01 Menu</span><span className="active">02 Order</span><span>03 Confirm</span></div></div>{!cart.length ? <div className="empty"><ShoppingBag size={38} /><h2>Your basket is empty</h2><p>Pick a dish from the menu and build your order.</p><Link className="btn dark" to="/menu">BROWSE MENU</Link></div> : <div className="cart-layout"><div className="panel">{cart.map(item => <CartRow key={item.cartId} item={item} setCart={setCart} currency={currency} />)}</div><div className="panel order-summary"><span className="eyebrow">SUMMARY</span><div className="sum-row"><span>Subtotal</span><b>{formatMoney(subtotal, currency)}</b></div><div className="sum-row"><span>Tax ({s.tax_percentage || 0}%)</span><b>{formatMoney(tax, currency)}</b></div><div className="sum-total"><span>Total</span><strong>{formatMoney(total, currency)}</strong></div><Link className="btn dark wide" to="/checkout">CONTINUE TO CHECKOUT <ArrowRight size={16} /></Link></div></div>}</div></main></div>;
}

function CartRow({ item, setCart, currency }: { item: CartItem; setCart: React.Dispatch<React.SetStateAction<CartItem[]>>; currency: string }) {
  return <div className="cart-row"><img src={item.image_url} alt={item.name} /><div><h3>{item.name}</h3><small>{item.variant?.name || ''}{item.addons.length ? ` · ${item.addons.map(a => a.name).join(', ')}` : ''}</small>{item.notes && <p className="note">{item.notes}</p>}<strong>{formatMoney(itemUnit(item, item.variant, item.addons), currency)}</strong></div><div className="qty"><button onClick={() => setCart(c => c.map(x => x.cartId === item.cartId ? { ...x, qty: Math.max(1, x.qty - 1) } : x))}><Minus size={14} /></button><b>{item.qty}</b><button onClick={() => setCart(c => c.map(x => x.cartId === item.cartId ? { ...x, qty: x.qty + 1 } : x))}><Plus size={14} /></button></div><button className="ghost danger" title="Remove item" onClick={() => setCart(c => c.filter(x => x.cartId !== item.cartId))}><Trash2 size={16} /></button></div>;
}

function Checkout({ cart, setCart, settings }: { cart: CartItem[]; setCart: React.Dispatch<React.SetStateAction<CartItem[]>>; settings: Settings }) {
  const [tables, setTables] = useState<Table[]>([]); const [form, setForm] = useState({ name: '', phone: '', table: '', note: '', allergies: '' }); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const navigate = useNavigate(); const subtotal = cart.reduce((sum, i) => sum + itemUnit(i, i.variant, i.addons) * i.qty, 0); const tax = subtotal * Number(settings.tax_percentage || 0) / 100; const total = subtotal + tax;
  useEffect(() => { void fetchTables().then(setTables).catch(e => setError(e?.message || 'Could not load tables.')); }, []);
  useEffect(() => { if (!cart.length) navigate('/menu', { replace: true }); }, [cart.length, navigate]);
  const submit = async (e: React.FormEvent) => { e.preventDefault(); setError(''); setSaving(true); try { const result = await createOrder({ customer_name: form.name, customer_phone: form.phone, table_id: form.table, special_request: form.note, allergies: form.allergies, items: cart }); rememberOrder({ token: result.tracking_token, number: result.order_number, placed_at: new Date().toISOString() }); setCart([]); navigate(`/order/${result.tracking_token}`, { replace: true }); } catch (err: any) { setError(err?.message || 'We could not send the order. Please try again.'); } finally { setSaving(false); } };
  return <div><Layout cartCount={cart.length} settings={settings} /><main className="page"><div className="container"><div className="page-title"><span className="eyebrow">STEP 3 OF 3 · CONFIRM</span><h1>Send your order to the kitchen.</h1><p>Tell us who is ordering, choose your table and add any requirements.</p><div className="checkout-steps"><span className="done">01 Menu</span><span className="done">02 Order</span><span className="active">03 Confirm</span></div></div><form className="checkout-layout" onSubmit={submit}><div className="panel"><div className="form-section"><h3>1. Your details</h3><div className="form-grid"><div className="field"><label>Customer name *</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Jemuval" /></div><div className="field"><label>Phone number</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+250 7xx xxx xxx" /></div></div></div>
      <div className="form-section"><h3>2. Choose your table *</h3><div className="table-picker">{tables.map(t => <button type="button" key={t.id} className={form.table === t.id ? 'table-choice selected' : 'table-choice'} onClick={() => setForm({ ...form, table: t.id })}><Table2 size={17} /><b>Table {t.table_number}</b><small>{t.seats || 4} seats</small></button>)}</div>{!tables.length && <div className="info-box">No active tables are configured yet.</div>}</div>
      <div className="form-section"><h3>3. Kitchen notes</h3><div className="field"><label>Special requirements</label><textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Extra spicy, sauce on the side, no onions..." /></div><div className="field"><label>Allergies or dietary requirements</label><textarea value={form.allergies} onChange={e => setForm({ ...form, allergies: e.target.value })} placeholder="Peanuts, dairy, vegetarian..." /></div></div>
      {error && <div className="error"><b>Could not place order</b><span>{error}</span></div>}
      <button className="btn dark wide" disabled={saving || !form.table}>{saving ? 'SENDING ORDER…' : `PLACE ORDER · ${formatMoney(total, settings.currency)}`} <ArrowRight size={17} /></button>
    </div><aside className="panel order-summary sticky"><span className="eyebrow">ORDER SUMMARY</span>{cart.map(i => <div key={i.cartId} className="checkout-item"><div><b>{i.qty} × {i.name}</b><small>{i.variant?.name || ''}{i.addons.length ? ` · ${i.addons.map(a => a.name).join(', ')}` : ''}</small></div><strong>{formatMoney(itemUnit(i, i.variant, i.addons) * i.qty, settings.currency)}</strong></div>)}<div className="sum-row"><span>Subtotal</span><b>{formatMoney(subtotal, settings.currency)}</b></div><div className="sum-row"><span>Tax</span><b>{formatMoney(tax, settings.currency)}</b></div><div className="sum-total"><span>Total</span><strong>{formatMoney(total, settings.currency)}</strong></div></aside></form></div></main></div>;
}

function ReviewsPage() {
  const data = usePublicData(); const [name, setName] = useState(''); const [rating, setRating] = useState(5); const [text, setText] = useState(''); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const send = async (e: React.FormEvent) => { e.preventDefault(); setMessage(''); setError(''); try { await submitReview({ customer_name: name, rating, review_text: text }); setName(''); setText(''); setMessage('Thanks. Your review has been sent for approval.'); } catch (err: any) { setError(err?.message || 'Could not submit your review.'); } };
  return <div><Layout settings={data.settings} /><main className="page"><div className="container"><div className="page-title"><span className="eyebrow">OUR HAPPY CUSTOMERS</span><h1>Good food deserves good company.</h1><p>Read what guests have shared, then leave your own review after your visit.</p></div><div className="reviews-layout"><div>{data.reviews.map((r: Review) => <ReviewCard key={r.id} review={r} />)}</div><form className="panel" onSubmit={send}><span className="eyebrow">LEAVE A REVIEW</span><h2>How was your table?</h2><div className="rating-input">{[1,2,3,4,5].map(n => <button type="button" key={n} className={n <= rating ? 'star selected' : 'star'} onClick={() => setRating(n)}><Star size={20} fill="currentColor" /></button>)}</div><div className="field"><label>Your name *</label><input required value={name} onChange={e => setName(e.target.value)} /></div><div className="field"><label>Your review *</label><textarea required value={text} onChange={e => setText(e.target.value)} placeholder="Tell us what you loved." /></div>{message && <div className="success-message"><CheckCircle2 size={16} /> {message}</div>}{error && <div className="error">{error}</div>}<button className="btn dark wide">SEND REVIEW</button></form></div></div></main><Footer settings={data.settings} content={data.content} /></div>;
}
function ReviewCard({ review }: { review: Review }) { return <article className="review-card"><div className="stars">{[1,2,3,4,5].map(n => <Star key={n} size={15} fill={n <= review.rating ? 'currentColor' : 'none'} />)}</div><p>“{review.review_text}”</p><div><b>{review.customer_name}</b><span>Verified guest review</span></div></article>; }

function AboutPage() { const data = usePublicData(); const brand = useBrand(); return <div><Layout settings={data.settings} /><main className="page"><div className="container"><div className="about-hero"><img src={placeholderImages.hero} /><div><span className="eyebrow">OUR STORY</span><h1>A neighborhood table with a kitchen that cares.</h1><p className="lead">{brand.name} is built around bold comfort food, quick service and the simple idea that a good meal should feel easy to order and even better to share.</p><Link className="btn dark" to="/menu">EXPLORE THE MENU <ArrowRight size={17} /></Link></div></div><div className="split story-detail"><div><span className="eyebrow">WHAT WE DO</span><h2 className="display">From kitchen to table without the friction.</h2></div><div className="lead">Choose your table. Customize your plate. Send the order. Our kitchen sees the details in real time, so your team can focus on making the food right.</div></div></div></main><Footer settings={data.settings} content={data.content} /></div>; }

function Login({ role }: { role: 'admin' | 'chef' }) {
  const nav = useNavigate(); const [email, setEmail] = useState(role === 'admin' ? 'jemuvalos@gmail.com' : ''); const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [resetSent, setResetSent] = useState(false);
  const submit = async (e: React.FormEvent) => { e.preventDefault(); setBusy(true); setError(''); try { if (!supabase) { throw new Error('This site is not connected to its database yet. Please contact the site owner — sign-in is unavailable until that is fixed.'); } const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) throw error; const actual = await currentRole(); if (role === 'admin' && actual !== 'admin') throw new Error('This account does not have administrator access.'); if (role === 'chef' && !['chef', 'kitchen_staff', 'manager', 'admin'].includes(actual || '')) throw new Error('This account does not have staff access.'); nav(role === 'admin' ? '/admin/dashboard' : '/chef/dashboard'); } catch (err: any) { setError(err?.message || 'Login failed.'); } finally { setBusy(false); } };
  const forgotPassword = async () => { if (!supabase) { setError('This site is not connected to its database yet.'); return; } if (!email.trim()) { setError('Enter your email above first, then tap "Forgot password?".'); return; } setBusy(true); setError(''); try { const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` }); if (error) throw error; setResetSent(true); } catch (err: any) { setError(err?.message || 'Could not send the reset email.'); } finally { setBusy(false); } };
  return <div className="auth-page"><form className="auth-card" onSubmit={submit}><Link to="/" className="brand"><BrandLogo /></Link><span className="eyebrow">{role === 'admin' ? 'ADMIN PORTAL' : 'STAFF PORTAL'}</span><h1>{role === 'admin' ? 'Welcome back.' : 'Staff login.'}</h1><p>{role === 'admin' ? 'Manage the restaurant, staff, orders and website.' : 'Chefs, kitchen staff and managers sign in here.'}</p><div className="field"><label>Email</label><input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="name@restaurant.com" /></div><div className="field"><label>Password</label><input type="password" required minLength={4} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" /></div>{error && <div className="error">{error}</div>}{resetSent && <div className="notice">Check your email for a password reset link.</div>}<button className="btn dark wide" disabled={busy}>{busy ? 'SIGNING IN…' : 'SIGN IN'} <ArrowRight size={16} /></button><button type="button" className="link-btn" disabled={busy} onClick={forgotPassword}>Forgot password?</button><span className="demo-note">{hasSupabase ? 'Use the credentials created in Supabase Authentication.' : 'This site is not connected to its database yet.'}</span></form></div>;
}

function ResetPassword() {
  const nav = useNavigate(); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [done, setDone] = useState(false);
  const submit = async (e: React.FormEvent) => { e.preventDefault(); setError(''); if (password.length < 6) { setError('The password must be at least 6 characters.'); return; } if (password !== confirm) { setError('Passwords do not match.'); return; } if (!supabase) { setError('This site is not connected to its database yet.'); return; } setBusy(true); try { const { error } = await supabase.auth.updateUser({ password }); if (error) throw error; setDone(true); setTimeout(() => nav('/admin'), 2000); } catch (err: any) { setError(err?.message || 'Could not update the password. The reset link may have expired — request a new one.'); } finally { setBusy(false); } };
  return <div className="auth-page"><form className="auth-card" onSubmit={submit}><Link to="/" className="brand"><BrandLogo /></Link><span className="eyebrow">RESET PASSWORD</span><h1>Choose a new password.</h1>{done ? <p>Password updated. Redirecting to sign in…</p> : <><div className="field"><label>New password</label><input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" /></div><div className="field"><label>Confirm new password</label><input type="password" required minLength={6} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" /></div>{error && <div className="error">{error}</div>}<button className="btn dark wide" disabled={busy}>{busy ? 'SAVING…' : 'SAVE NEW PASSWORD'} <ArrowRight size={16} /></button></>}</form></div>;
}

function Guard({ role, children }: { role: 'admin' | 'chef'; children: React.ReactNode }) {
  const [ready, setReady] = useState(false); const [allowed, setAllowed] = useState(false); const nav = useNavigate();
  useEffect(() => { let alive = true; if (!supabase) { const demoRole = sessionStorage.getItem('bitecraft:role'); const okay = role === 'admin' ? demoRole === 'admin' : demoRole === 'chef'; if (alive) { setAllowed(okay); setReady(true); if (!okay) nav(role === 'admin' ? '/admin' : '/chef', { replace: true }); } return () => { alive = false; }; } void currentRole().then(actual => { const okay = role === 'admin' ? actual === 'admin' : ['chef', 'kitchen_staff', 'manager', 'admin'].includes(actual || ''); if (alive) { setAllowed(okay); setReady(true); if (!okay) nav(role === 'admin' ? '/admin' : '/chef', { replace: true }); } }).catch(() => { if (alive) { setAllowed(false); setReady(true); nav(role === 'admin' ? '/admin' : '/chef', { replace: true }); } }); return () => { alive = false; }; }, [role, nav]);
  if (!ready) return <div className="loading"><div className="loader"><span></span><span></span><span></span></div></div>;
  return allowed ? <>{children}</> : null;
}

const adminLinks = [
  ['/admin/dashboard', 'Dashboard', LayoutDashboard], ['/admin/orders', 'Orders', PackageCheck], ['/admin/history', 'Day history', HistoryIcon], ['/admin/menu', 'Menu', MenuIcon], ['/admin/categories', 'Categories', ChevronDown], ['/admin/tables', 'Tables', Table2], ['/admin/chefs', 'Staff', ChefHat],
  ['/admin/customers', 'Customers', Users], ['/admin/reviews', 'Reviews', MessageSquare], ['/admin/gallery', 'Gallery', ImageIcon], ['/admin/site-content', 'Site content', Edit3], ['/admin/site-editor', 'Visual editor', Eye], ['/admin/branding', 'Branding', Palette], ['/admin/settings', 'Settings', SettingsIcon]
] as const;

function AdminShell({ children }: { children: React.ReactNode }) {
  const nav = useNavigate(); const { pathname } = useLocation();
  const [folded, setFolded] = useState(() => { try { return localStorage.getItem('bitecraft:admin-folded') === '1'; } catch { return false; } });
  const [drawer, setDrawer] = useState(false);
  useEffect(() => { setDrawer(false); }, [pathname]);
  const toggle = () => {
    if (window.matchMedia('(max-width: 760px)').matches) { setDrawer(v => !v); return; }
    setFolded(v => { const next = !v; try { localStorage.setItem('bitecraft:admin-folded', next ? '1' : '0'); } catch { /* optional */ } return next; });
  };
  const signOut = async () => { if (supabase) await supabase.auth.signOut(); sessionStorage.removeItem('bitecraft:role'); nav('/admin'); };
  return <div className={`portal admin-portal ${folded ? 'is-folded' : ''} ${drawer ? 'drawer-open' : ''}`}>
    <aside className="sidebar admin-sidebar" aria-label="Admin navigation">
      <div className="admin-side-top"><Link className="brand light" to="/"><BrandLogo /></Link>
        <button type="button" className="side-fold" onClick={toggle} aria-label={folded ? 'Expand the menu' : 'Fold the menu'} title={folded ? 'Expand the menu' : 'Fold the menu'}>{folded ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}</button></div>
      <a className="side-item side-home" href="/" target="_blank" rel="noreferrer" title="Open the website" aria-label="Home"><HomeIcon size={17} /><span className="lbl">Home</span></a>
      <div className="side-label">ADMIN</div>
      <div className="admin-nav">{adminLinks.map(([href, label, Icon]) => <Link className={`side-item ${pathname === href ? 'active' : ''}`} key={href} to={href} title={label} aria-label={label}><Icon size={17} /><span className="lbl">{label}</span></Link>)}</div>
      <div className="side-spacer" />
      <button className="side-item" onClick={() => void signOut()} title="Sign out" aria-label="Sign out"><LogOut size={17} /><span className="lbl">Sign out</span></button>
    </aside>
    {drawer && <button type="button" className="admin-scrim" aria-label="Close the menu" onClick={() => setDrawer(false)} />}
    <main className="portal-main"><div className="portal-head admin-head">
      <div className="admin-head-left"><button type="button" className="head-fold" onClick={toggle} aria-label="Show or hide the menu" title="Show or hide the menu"><PanelLeft size={19} /></button>
        <div><span className="eyebrow">ADMINISTRATION</span><h1>Restaurant control center</h1></div></div>
      <Link className="btn primary" to="/admin/site-editor"><Eye size={16} /> Edit website</Link></div>{children}</main></div>;
}

function AdminPage({ title, children }: { title: string; children?: React.ReactNode }) { return <Guard role="admin"><AdminShell><div className="admin-body"><div className="page-heading"><span className="eyebrow">ADMIN</span><h2>{title}</h2></div>{children}</div></AdminShell></Guard>; }

function Dashboard() {
  const [data, setData] = useState<any>(null); const [error, setError] = useState(''); const load = () => void adminDashboard().then(setData).catch(e => setError(e?.message || 'Unable to load dashboard.'));
  useEffect(() => { load(); }, []);
  if (!data) return <AdminPage title="Overview"><div className="loading-box"><div className="loader"><span /><span /><span /></div>{error && <p className="error">{error}</p>}</div></AdminPage>;
  const max = Math.max(1, ...Object.values(data.statusCounts).map(Number));
  return <AdminPage title="Overview"><div className="stats-grid"><Stat label="Today's orders" value={data.todayOrders} note="Orders created today" icon={ShoppingBag} /><Stat label="Active now" value={data.active} note="New to ready" icon={Flame} /><Stat label="Revenue" value={formatMoney(data.revenue)} note="Served / completed" icon={Zap} /><Stat label="Menu items" value={data.menuCount} note="Visible in menu manager" icon={Utensils} /></div><div className="admin-dashboard-grid"><div className="panel"><div className="panel-head"><div><span className="eyebrow">LIVE FLOW</span><h3>Orders by status</h3></div><span className="live"><span /> Connected</span></div><div className="status-bars">{Object.entries(data.statusCounts).map(([s, value]: any) => <div className="status-bar-row" key={s}><div><span>{statusLabels[s as OrderStatus]}</span><b>{value}</b></div><div className="bar"><i style={{ width: `${(Number(value) / max) * 100}%` }} /></div></div>)}</div></div><div className="panel"><div className="panel-head"><div><span className="eyebrow">RECENT</span><h3>Latest orders</h3></div><Link className="text-link" to="/admin/orders">View all <ArrowRight size={14} /></Link></div><div className="recent-list">{data.recent.length ? data.recent.map((o: RestaurantOrder) => <Link key={o.id} to="/admin/orders" className="recent-row"><div><b>{o.order_number}</b><small>Table {o.table_number || '—'} · {o.customer_name}</small></div><span className="status-pill">{statusLabels[o.status]}</span><strong>{formatMoney(Number(o.total))}</strong></Link>) : <p className="muted">No orders yet.</p>}</div></div></div></AdminPage>;
}
function Stat({ label, value, note, icon: Icon }: { label: string; value: React.ReactNode; note: string; icon: any }) { return <div className="stat-card"><div className="stat-icon"><Icon size={18} /></div><span>{label}</span><strong>{value}</strong><small>{note}</small></div>; }

/** Admin: a printable summary of every order for one day, with a "Download as PDF" button (uses the browser's Save-as-PDF print option). */
function HistoryPage() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(todayStr);
  const [orders, setOrders] = useState<RestaurantOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { let alive = true; setLoading(true); void adminList('orders').then(x => { if (alive) { setOrders(x as RestaurantOrder[]); setError(''); } }).catch(e => { if (alive) setError(e?.message || 'Unable to load orders.'); }).finally(() => { if (alive) setLoading(false); }); return () => { alive = false; }; }, []);
  const dayOrders = useMemo(() => orders.filter(o => String(o.created_at).slice(0, 10) === date).sort((a, b) => a.created_at.localeCompare(b.created_at)), [orders, date]);
  const cancelled = dayOrders.filter(o => o.status === 'CANCELLED');
  const paid = dayOrders.filter(o => o.payment_status === 'PAID');
  const revenue = paid.reduce((s, o) => s + Number(o.total || 0), 0);
  const unpaid = dayOrders.filter(o => o.status !== 'CANCELLED' && o.payment_status !== 'PAID');
  const unpaidTotal = unpaid.reduce((s, o) => s + Number(o.total || 0), 0);
  const dishes = dayOrders.filter(o => o.status !== 'CANCELLED').reduce((s, o) => s + (o.order_items || []).reduce((n, i) => n + i.quantity, 0), 0);
  const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  return <AdminPage title="Day history">
    <div className="history-toolbar">
      <label className="history-date">Date<input type="date" value={date} max={todayStr} onChange={e => setDate(e.target.value)} /></label>
      <button type="button" className="btn dark" onClick={() => window.print()}><Printer size={16} /> Download as PDF</button>
    </div>
    <p className="history-hint">This opens your browser's print window — choose "Save as PDF" as the destination to download it.</p>
    {error && <div className="error">{error}</div>}
    {loading ? <div className="loading-box"><div className="loader"><span /><span /><span /></div></div> : <div className="history-report">
      <div className="history-print-head"><h1>{settingsForPrint()?.restaurant_name || 'e-menu'}</h1><p>Daily order history · {dateLabel}</p></div>
      <div className="stats-grid">
        <Stat label="Orders" value={dayOrders.length} note={`${cancelled.length} cancelled`} icon={ShoppingBag} />
        <Stat label="Dishes served" value={dishes} note="Across non-cancelled orders" icon={Utensils} />
        <Stat label="Collected" value={formatMoney(revenue)} note={`${paid.length} paid orders`} icon={Wallet} />
        <Stat label="Not yet paid" value={formatMoney(unpaidTotal)} note={`${unpaid.length} orders`} icon={Zap} />
      </div>
      {!dayOrders.length ? <div className="empty compact"><HistoryIcon size={28} /><h3>No orders on this day.</h3></div> : <div className="panel admin-table-wrap history-table-wrap">
        <div className="data-table history-table">
          <div className="data-head history-head"><span>Time</span><span>Order</span><span>Table / Guest</span><span>Items</span><span>Chef</span><span>Status</span><span>Payment</span><span>Total</span></div>
          {dayOrders.map(o => <div className="data-row history-row" key={o.id}>
            <span>{new Date(o.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
            <span><b>{o.order_number}</b></span>
            <span><b>Table {o.table_number || o.restaurant_tables?.table_number || '—'}</b><small>{o.customer_name}</small></span>
            <span className="history-items">{(o.order_items || []).map((i, n) => <small key={i.id || n}>{i.quantity}× {i.item_name_snapshot}</small>)}</span>
            <span>{orderChefName(o) || '—'}</span>
            <span className="status-pill">{statusLabels[o.status]}</span>
            <span>{o.payment_status === 'PAID' ? `Paid · ${o.payment_method || ''}` : o.status === 'CANCELLED' ? '—' : 'Unpaid'}</span>
            <span><b>{formatMoney(Number(o.total))}</b></span>
          </div>)}
        </div>
      </div>}
      <div className="history-print-foot">Printed {new Date().toLocaleString()}</div>
    </div>}
  </AdminPage>;
}
function settingsForPrint(): { restaurant_name?: string } | null { try { const cached = readBrandCache(); return cached ? { restaurant_name: cached.restaurant_name } : null; } catch { return null; } }

function ResourceShell({ type }: { type: 'orders' | 'menu' | 'categories' | 'tables' | 'chefs' | 'customers' | 'reviews' | 'gallery' }) {
  const [rows, setRows] = useState<any[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [modal, setModal] = useState<any | null>(null); const [refreshKey, setRefreshKey] = useState(0);
  const [chatOrder, setChatOrder] = useState<any | null>(null); const [msgCounts, setMsgCounts] = useState<Record<string, number>>({});
  const load = () => { setLoading(true); void adminList(type).then(x => { setRows(x as any[]); if (type === 'orders') void fetchMessageStats((x as any[]).map(o => o.id)).then(st => setMsgCounts(Object.fromEntries(Object.entries(st).map(([id, v]) => [id, v.total])))); }).catch(e => setError(e?.message || 'Unable to load data.')).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, [type, refreshKey]);
  const deleteRow = async (row: any) => {
    try {
      if (type === 'chefs') {
        if (!window.confirm(`Remove ${row.full_name || 'this staff member'}'s access? They will no longer be able to sign in.`)) return;
        await deleteChef(row.id);
      } else if (type === 'orders') {
        const ageMs = Date.now() - new Date(row.created_at).getTime();
        if (ageMs < 24 * 3600 * 1000) { setError('This order can only be deleted once it is at least 24 hours old.'); return; }
        if (!window.confirm(`Delete order ${row.order_number}? This cannot be undone.`)) return;
        await adminDeleteOrder(row.id);
      } else {
        if (!window.confirm('Delete this item? This cannot be undone.')) return;
        if (type === 'customers') return;
        await adminDelete(type as any, row.id);
      }
      setError(''); setRefreshKey(k => k + 1);
    } catch (e: any) { setError(e?.message || 'Delete failed.'); }
  };
  const changeOrderStatus = async (id: string, status: OrderStatus) => { try { await updateOrderStatus(id, status); setRefreshKey(k => k + 1); } catch (e: any) { setError(e?.message || 'Could not update order.'); } };
  const changePayment = async (id: string, method: '' | 'CASH' | 'MOMO' | 'CARD') => { try { await setOrderPayment(id, Boolean(method), method || undefined); setRefreshKey(k => k + 1); } catch (e: any) { setError(e?.message || 'Could not record the payment.'); } };
  const [cleaning, setCleaning] = useState(false);
  const cleanOldOrders = async () => {
    if (!window.confirm('Delete every order older than 30 days? This cannot be undone.')) return;
    setCleaning(true); setError('');
    try { const n = await adminDeleteOldOrders(30); setError(''); alert(n ? `Deleted ${n} old order${n === 1 ? '' : 's'}.` : 'No orders were old enough to delete.'); setRefreshKey(k => k + 1); }
    catch (e: any) { setError(e?.message || 'Could not clean up old orders.'); }
    finally { setCleaning(false); }
  };
  const titleMap: Record<string, string> = { orders: 'Orders', menu: 'Menu', categories: 'Categories', tables: 'Tables', chefs: 'Staff accounts', customers: 'Customers', reviews: 'Reviews', gallery: 'Gallery' };
  const descMap: Record<string, string> = { orders: 'Monitor every table order: who is cooking it, its progress and whether it is paid.', menu: 'Add meals, prices, images, variants and extras.', categories: 'Organize the digital menu into guest-friendly categories.', tables: 'Control table numbers, seats and table status.', chefs: 'Create and disable accounts for chefs, kitchen staff and managers. Public signup is disabled.', customers: 'See guest order history and spend summaries.', reviews: 'Approve or reject guest reviews before publishing.', gallery: 'Manage the food photography shown on the website.' };
  const noAdd = ['orders', 'customers'].includes(type); return <AdminPage title={titleMap[type]}><div className="toolbar"><div><p>{descMap[type]}</p></div>{type === 'orders' && <button className="btn light-btn" disabled={cleaning} onClick={cleanOldOrders}>{cleaning ? 'CLEANING…' : 'Delete orders older than 30 days'}</button>}{!noAdd && <button className="btn dark" onClick={() => setModal({ create: true })}><Plus size={16} /> Add {type === 'menu' ? 'dish' : type === 'chefs' ? 'staff member' : type === 'categories' ? 'category' : type === 'tables' ? 'table' : type === 'reviews' ? 'review' : 'photo'}</button>}</div>{error && <div className="error">{error}</div>}{loading ? <div className="loading-box"><div className="loader"><span /><span /><span /></div></div> : <div className="panel admin-table-wrap"><AdminTable type={type} rows={rows} onEdit={row => setModal(row)} onDelete={deleteRow} onOrderStatus={changeOrderStatus} onPay={changePayment} onConversation={setChatOrder} msgCounts={msgCounts} />{!rows.length && <div className="empty compact"><PackageCheck size={28} /><h3>Nothing here yet</h3><p>Use the action above to create the first record.</p></div>}</div>}{modal && <ResourceModal type={type} row={modal.create ? null : modal} onClose={() => setModal(null)} onSaved={() => { setModal(null); setRefreshKey(k => k + 1); }} />}{chatOrder && <OrderConversationModal order={rows.find(r => r.id === chatOrder.id) || chatOrder} onClose={() => setChatOrder(null)} />}</AdminPage>;
}

function AdminTable({ type, rows, onEdit, onDelete, onOrderStatus, onPay, onConversation, msgCounts }: { type: string; rows: any[]; onEdit: (row: any) => void; onDelete: (row: any) => void; onOrderStatus?: (id: string, status: OrderStatus) => void; onPay?: (id: string, method: '' | 'CASH' | 'MOMO' | 'CARD') => void; onConversation?: (row: any) => void; msgCounts?: Record<string, number> }) {
  if (type === 'orders') return <div className="data-table orders-table"><div className="data-head order-head"><span>Order</span><span>Table / Guest</span><span>Status</span><span>Chef</span><span>Payment</span><span>Total</span><span>Chat / View</span></div>{rows.map(o => <div className="data-row order-row" key={o.id}><span><b>{o.order_number}</b><small>{new Date(o.created_at).toLocaleString()}</small></span><span><b>Table {o.table_number || o.restaurant_tables?.table_number || '—'}</b><small>{o.customer_name}</small></span><span><select className="status-select" value={o.status} onChange={e => onOrderStatus?.(o.id, e.target.value as OrderStatus)}>{Object.keys(statusLabels).map(s => <option key={s} value={s}>{statusLabels[s as OrderStatus]}</option>)}</select><ProgressBar order={o} /></span><span><ChefTag order={o} /></span><span>{o.status === 'CANCELLED' ? <PayChip order={o} /> : <select className="status-select" value={o.payment_status === 'PAID' ? (o.payment_method || 'CASH') : ''} onChange={e => onPay?.(o.id, e.target.value as any)}><option value="">Unpaid</option><option value="CASH">Paid · Cash</option><option value="MOMO">Paid · MoMo</option><option value="CARD">Paid · Card</option></select>}</span><span><b>{formatMoney(Number(o.total))}</b></span><span className="order-actions"><button type="button" className="ghost chat-ghost" onClick={() => onConversation?.(o)} title="See the conversation and what was ordered" aria-label={`Conversation for ${o.order_number}`}><MessageCircle size={16} />{msgCounts?.[o.id] ? <i>{msgCounts[o.id]}</i> : null}</button><Link className="ghost" title="Open the guest tracking page" to={`/order/${o.tracking_token || ''}`} target={o.tracking_token ? '_blank' : undefined}><Eye size={16} /></Link>{Date.now() - new Date(o.created_at).getTime() >= 24 * 3600 * 1000 ? <button type="button" className="ghost danger" title="Delete this order" onClick={() => onDelete(o)}><Trash2 size={16} /></button> : <button type="button" className="ghost" disabled title="Orders can only be deleted once they are at least 24 hours old"><Trash2 size={16} /></button>}</span></div>)}</div>;
  if (type === 'menu') return <div className="data-table"><div className="data-head"><span>Dish</span><span>Category</span><span>Price</span><span>Availability</span><span>Action</span></div>{rows.map((r: MenuItem) => <div className="data-row" key={r.id}><span className="media-name"><img src={r.image_url} /><span><b>{r.name}</b><small>{r.description}</small></span></span><span>{r.category_name || 'Uncategorized'}</span><span>{formatMoney(Number(r.price))}</span><span><span className="status-pill">{r.available === false ? 'HIDDEN' : 'AVAILABLE'}</span></span><span><button className="ghost" onClick={() => onEdit(r)}><Edit3 size={16} /></button><button className="ghost danger" onClick={() => onDelete(r)}><Trash2 size={16} /></button></span></div>)}</div>;
  if (type === 'chefs') return <div className="data-table"><div className="data-head"><span>Name</span><span>Email</span><span>Role</span><span>Status</span><span>Action</span></div>{rows.map(r => <div className="data-row" key={r.id}><span><b>{r.full_name || 'Unnamed'}</b><small>{r.id}</small></span><span>{r.email}</span><span>{({ chef: 'Chef', kitchen_staff: 'Kitchen staff', manager: 'Manager', admin: 'Admin' } as Record<string, string>)[r.role] || r.role}</span><span><span className="status-pill">{r.active === false ? 'DISABLED' : 'ACTIVE'}</span></span><span>{r.role !== 'admin' && <><button className="ghost" onClick={() => onEdit(r)}><Edit3 size={16} /></button><button className="ghost danger" onClick={() => onDelete(r)}><Trash2 size={16} /></button></>}</span></div>)}</div>;
  if (type === 'customers') return <div className="data-table"><div className="data-head"><span>Customer</span><span>Phone</span><span>Orders</span><span>Spend</span><span>Last order</span></div>{rows.map(r => <div className="data-row" key={`${r.customer_name}-${r.customer_phone}`}><span><b>{r.customer_name}</b></span><span>{r.customer_phone || '—'}</span><span>{r.orders}</span><span>{formatMoney(Number(r.spend))}</span><span>{new Date(r.last_order).toLocaleString()}</span></div>)}</div>;
  if (type === 'reviews') return <div className="data-table"><div className="data-head"><span>Guest</span><span>Rating</span><span>Review</span><span>Status</span><span>Action</span></div>{rows.map(r => <div className="data-row" key={r.id}><span><b>{r.customer_name}</b><small>{new Date(r.created_at).toLocaleDateString()}</small></span><span className="stars">{r.rating}/5</span><span className="truncate">{r.review_text}</span><span><span className="status-pill">{r.status}</span></span><span><button className="ghost" onClick={() => onEdit(r)}><Edit3 size={16} /></button><button className="ghost danger" onClick={() => onDelete(r)}><Trash2 size={16} /></button></span></div>)}</div>;
  if (type === 'gallery') return <div className="data-table"><div className="data-head"><span>Photo</span><span>Caption</span><span>Order</span><span>Status</span><span>Action</span></div>{rows.map(r => <div className="data-row" key={r.id}><span className="media-name"><img src={r.image_url} /><span><b>Gallery image</b></span></span><span>{r.caption || '—'}</span><span>{r.sort_order}</span><span><span className="status-pill">{r.active === false ? 'HIDDEN' : 'LIVE'}</span></span><span><button className="ghost" onClick={() => onEdit(r)}><Edit3 size={16} /></button><button className="ghost danger" onClick={() => onDelete(r)}><Trash2 size={16} /></button></span></div>)}</div>;
  if (type === 'categories') return <div className="data-table"><div className="data-head"><span>Category</span><span>Order</span><span>Status</span><span>Image</span><span>Action</span></div>{rows.map(r => <div className="data-row" key={r.id}><span><b>{r.name}</b></span><span>{r.sort_order}</span><span>{r.active === false ? 'HIDDEN' : 'ACTIVE'}</span><span>{r.image_url ? 'Set' : '—'}</span><span><button className="ghost" onClick={() => onEdit(r)}><Edit3 size={16} /></button><button className="ghost danger" onClick={() => onDelete(r)}><Trash2 size={16} /></button></span></div>)}</div>;
  return <div className="data-table"><div className="data-head"><span>Table</span><span>Seats</span><span>Status</span><span>Active</span><span>Action</span></div>{rows.map(r => <div className="data-row" key={r.id}><span><b>Table {r.table_number}</b><small>{r.table_name || 'Dining table'}</small></span><span>{r.seats}</span><span>{r.status}</span><span>{r.active ? 'YES' : 'NO'}</span><span><button className="ghost" onClick={() => onEdit(r)}><Edit3 size={16} /></button><button className="ghost danger" onClick={() => onDelete(r)}><Trash2 size={16} /></button></span></div>)}</div>;
}

function ResourceModal({ type, row, onClose, onSaved }: { type: string; row: any; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const isMenu = type === 'menu'; const existing = row || {};
  const [form, setForm] = useState<any>(() => isMenu ? { name: existing.name || '', description: existing.description || '', price: existing.price || 0, image_url: existing.image_url || placeholderImages.burger, category_id: existing.category_id || '', prep_minutes: existing.prep_minutes || 15, available: existing.available !== false, featured: existing.featured || false, popular: existing.popular || false, ingredients: existing.ingredients || '', allergens: existing.allergens || '' } : type === 'categories' ? { name: existing.name || '', image_url: existing.image_url || placeholderImages.burger, sort_order: existing.sort_order || 1, active: existing.active !== false } : type === 'tables' ? { table_number: existing.table_number || 1, table_name: existing.table_name || '', seats: existing.seats || 4, status: existing.status || 'AVAILABLE', active: existing.active !== false } : type === 'reviews' ? { customer_name: existing.customer_name || '', rating: existing.rating || 5, review_text: existing.review_text || '', status: existing.status || 'PENDING' } : type === 'gallery' ? { image_url: existing.image_url || placeholderImages.burger, caption: existing.caption || '', sort_order: existing.sort_order || 1, active: existing.active !== false } : { full_name: existing.full_name || '', email: existing.email || '', password: '', role: existing.role || 'chef', active: existing.active !== false });
  const [variantsText, setVariantsText] = useState(() => (existing.variants || []).filter((x: any) => x.active !== false).map((x: any) => `${x.name}|${x.price_delta || 0}`).join('\n'));
  const [addonsText, setAddonsText] = useState(() => (existing.addons || []).filter((x: any) => x.active !== false).map((x: any) => `${x.name}|${x.price_delta || 0}`).join('\n'));
  const set = (key: string, value: any) => setForm((f: any) => ({ ...f, [key]: value }));
  const parseOptions = (text: string) => text.split('\n').map(x => x.trim()).filter(Boolean).map((line, i) => { const [name, delta = '0'] = line.split('|'); return { id: existing.variants?.[i]?.id || `local-${i}`, name: name.trim(), price_delta: Number(delta) || 0 }; });
  const save = async (e: React.FormEvent) => { e.preventDefault(); setSaving(true); setError(''); try {
    if (type === 'menu') await adminSaveMenuItem({ ...form, price: Number(form.price), prep_minutes: Number(form.prep_minutes), category_id: form.category_id || null, id: existing.id }, parseOptions(variantsText), parseOptions(addonsText));
    else if (type === 'chefs') { if (!existing.id) { if (!form.password || form.password.length < 6) throw new Error('The password must be at least 6 characters.'); await createChef({ email: form.email, password: form.password, full_name: form.full_name, role: form.role }); } else { await updateChef(existing.id, { full_name: form.full_name, role: form.role }); await setProfileActive(existing.id, Boolean(form.active)); } }
    else await adminUpsert(type as any, type === 'tables' ? { ...form, table_number: Number(form.table_number), seats: Number(form.seats) } : type === 'categories' ? { ...form, sort_order: Number(form.sort_order) } : form, existing.id);
    onSaved();
  } catch (err: any) { setError(err?.message || 'Save failed.'); } finally { setSaving(false); } };
  const title = row ? `Edit ${type === 'menu' ? 'dish' : type === 'chefs' ? 'staff account' : type === 'gallery' ? 'gallery photo' : type}` : `Add ${type === 'menu' ? 'dish' : type === 'chefs' ? 'staff account' : type}`;
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="modal admin-modal" onSubmit={save} onMouseDown={e => e.stopPropagation()}><button type="button" className="modal-close" onClick={onClose}><X size={19} /></button><span className="eyebrow">ADMIN</span><h2>{title}</h2>{error && <div className="error">{error}</div>}
    {type === 'menu' && <><div className="form-grid"><div className="field"><label>Dish name *</label><input required value={form.name} onChange={e => set('name', e.target.value)} /></div><div className="field"><label>Price ({'RWF'}) *</label><input required type="number" min="0" value={form.price} onChange={e => set('price', e.target.value)} /></div></div><div className="field"><label>Description</label><textarea value={form.description} onChange={e => set('description', e.target.value)} /></div><div className="form-grid"><div className="field"><label>Category</label><select value={form.category_id} onChange={e => set('category_id', e.target.value)}><option value="">Uncategorized</option><CategoryOptions /></select></div><div className="field"><label>Prep time (minutes)</label><input type="number" min="1" value={form.prep_minutes} onChange={e => set('prep_minutes', e.target.value)} /></div></div><ImageField label="Image" value={form.image_url || ''} onChange={v => set('image_url', v)} /><div className="field"><label>Variants — one per line: Name|price increase</label><textarea value={variantsText} onChange={e => setVariantsText(e.target.value)} placeholder="Regular|0\nLarge|3000" /></div><div className="field"><label>Add-ons — one per line: Name|price increase</label><textarea value={addonsText} onChange={e => setAddonsText(e.target.value)} placeholder="Extra cheese|800\nBacon|1200" /></div><div className="check-grid"><label><input type="checkbox" checked={form.available} onChange={e => set('available', e.target.checked)} /> Available</label><label><input type="checkbox" checked={form.featured} onChange={e => set('featured', e.target.checked)} /> Chef special</label><label><input type="checkbox" checked={form.popular} onChange={e => set('popular', e.target.checked)} /> Popular</label></div></>}
    {type === 'categories' && <><div className="field"><label>Name *</label><input required value={form.name} onChange={e => set('name', e.target.value)} /></div><ImageField label="Image" value={form.image_url || ''} onChange={v => set('image_url', v)} /><div className="form-grid"><div className="field"><label>Display order</label><input type="number" value={form.sort_order} onChange={e => set('sort_order', e.target.value)} /></div><div className="field"><label>Active</label><select value={String(form.active)} onChange={e => set('active', e.target.value === 'true')}><option value="true">Yes</option><option value="false">No</option></select></div></div></>}
    {type === 'tables' && <><div className="form-grid"><div className="field"><label>Table number *</label><input required type="number" min="1" value={form.table_number} onChange={e => set('table_number', e.target.value)} /></div><div className="field"><label>Seats</label><input type="number" min="1" value={form.seats} onChange={e => set('seats', e.target.value)} /></div></div><div className="field"><label>Table name</label><input value={form.table_name} onChange={e => set('table_name', e.target.value)} placeholder="Window, VIP, Patio…" /></div><div className="form-grid"><div className="field"><label>Status</label><select value={form.status} onChange={e => set('status', e.target.value)}><option>AVAILABLE</option><option>OCCUPIED</option><option>RESERVED</option><option>DISABLED</option></select></div><div className="field"><label>Active</label><select value={String(form.active)} onChange={e => set('active', e.target.value === 'true')}><option value="true">Yes</option><option value="false">No</option></select></div></div></>}
    {type === 'chefs' && <><div className="field"><label>Full name *</label><input required value={form.full_name} onChange={e => set('full_name', e.target.value)} /></div><div className="field"><label>Email *</label><input type="email" required disabled={Boolean(existing.id)} value={form.email} onChange={e => set('email', e.target.value)} />{existing.id && <small>Email can't be changed here.</small>}</div>{!existing.id && <div className="field"><label>Temporary password *</label><input type="password" required minLength={6} value={form.password} onChange={e => set('password', e.target.value)} /></div>}<div className="field"><label>Role</label><select value={form.role} onChange={e => set('role', e.target.value)}><option value="chef">Chef</option><option value="kitchen_staff">Kitchen staff</option><option value="manager">Manager</option></select></div>{existing.id && <div className="field"><label>Account status</label><select value={String(form.active)} onChange={e => set('active', e.target.value === 'true')}><option value="true">Active</option><option value="false">Disabled</option></select></div>}</>}
    {type === 'reviews' && <><div className="form-grid"><div className="field"><label>Guest name</label><input value={form.customer_name} onChange={e => set('customer_name', e.target.value)} /></div><div className="field"><label>Rating</label><select value={form.rating} onChange={e => set('rating', Number(e.target.value))}>{[1,2,3,4,5].map(n => <option key={n}>{n}</option>)}</select></div></div><div className="field"><label>Review</label><textarea value={form.review_text} onChange={e => set('review_text', e.target.value)} /></div><div className="field"><label>Moderation</label><select value={form.status} onChange={e => set('status', e.target.value)}><option>PENDING</option><option>APPROVED</option><option>REJECTED</option></select></div></>}
    {type === 'gallery' && <><ImageField label="Image *" required value={form.image_url || ''} onChange={v => set('image_url', v)} /><div className="field"><label>Caption</label><input value={form.caption} onChange={e => set('caption', e.target.value)} /></div><div className="form-grid"><div className="field"><label>Display order</label><input type="number" value={form.sort_order} onChange={e => set('sort_order', e.target.value)} /></div><div className="field"><label>Active</label><select value={String(form.active)} onChange={e => set('active', e.target.value === 'true')}><option value="true">Live</option><option value="false">Hidden</option></select></div></div></>}
    <div className="modal-actions"><button type="button" className="btn light-btn" onClick={onClose}>Cancel</button><button className="btn dark" disabled={saving}>{saving ? 'SAVING…' : 'SAVE CHANGES'} <Save size={16} /></button></div>
  </form></div>;
}
function CategoryOptions() { const [cats, setCats] = useState<Category[]>([]); useEffect(() => { void adminList('categories').then(x => setCats(x as Category[])).catch(() => undefined); }, []); return <>{cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</>; }

function SiteContentPage() {
  const [content, setContent] = useState<SiteContent>({}); const [settings, setSettings] = useState<Settings>(defaultSettings); const [sections, setSections] = useState<SiteSections>({}); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  useEffect(() => { void fetchAdminContent().then(x => { setContent(x.content); setSettings(x.settings || defaultSettings); setSections(x.sections); }).catch(e => setMessage(e?.message || 'Unable to load content.')); }, []);
  const update = (key: string, field: string, value: any) => setContent(c => ({ ...c, [key]: { ...(c[key] || {}), [field]: value } }));
  const saveAll = async () => { setBusy(true); setMessage(''); try { for (const key of ['home.hero','home.warm','home.why','home.about','home.cta','footer']) if (content[key]) await saveSiteContent(key, content[key]); for (const key of sectionKeys) await saveSiteSection(key, { is_visible: sections[key]?.visible !== false, display_order: sections[key]?.order || sectionKeys.indexOf(key) + 1 }); setMessage('All website content has been published.'); } catch (e: any) { setMessage(e?.message || 'Save failed.'); } finally { setBusy(false); } };
  return <AdminPage title="Site content"><div className="content-editor"><div className="content-editor-main"><div className="panel"><div className="panel-head"><div><span className="eyebrow">HOMEPAGE HERO</span><h3>First impression</h3></div><Link className="text-link" to="/admin/site-editor">Open visual editor <Eye size={14} /></Link></div><div className="field"><label>Headline</label><input value={content['home.hero']?.title || ''} onChange={e => update('home.hero','title',e.target.value)} /></div><div className="field"><label>Supporting text</label><textarea value={content['home.hero']?.subtitle || ''} onChange={e => update('home.hero','subtitle',e.target.value)} /></div><ImageField label="Hero image" value={content['home.hero']?.image_url || ''} onChange={v => update('home.hero','image_url',v)} /><div className="form-grid"><div className="field"><label>Primary button</label><input value={content['home.hero']?.primary_button || 'VIEW MENU'} onChange={e => update('home.hero','primary_button',e.target.value)} /></div><div className="field"><label>Secondary button</label><input value={content['home.hero']?.secondary_button || 'OUR STORY'} onChange={e => update('home.hero','secondary_button',e.target.value)} /></div></div></div>
  <ContentBlock title="Hungry band" keyName="home.warm" content={content} update={update} fields={['label','title','text']} /><ContentBlock title="Why choose us" keyName="home.why" content={content} update={update} fields={['title','text']} /><ContentBlock title="About" keyName="home.about" content={content} update={update} fields={['title','text']} /><ContentBlock title="Call to action" keyName="home.cta" content={content} update={update} fields={['title','text']} /><ContentBlock title="Footer" keyName="footer" content={content} update={update} fields={['tagline']} /></div>
  <aside className="panel section-control"><div className="panel-head"><div><span className="eyebrow">PUBLISHED SECTIONS</span><h3>Visibility</h3></div><button className="btn dark small" onClick={saveAll} disabled={busy}>{busy ? 'PUBLISHING…' : 'PUBLISH ALL'}</button></div>{sectionKeys.map((key, idx) => <div className="section-row" key={key}><div><b>{sectionLabels[key]}</b><small>Section {idx + 1}</small></div><label className="toggle"><input type="checkbox" checked={sections[key]?.visible !== false} onChange={e => setSections(s => ({ ...s, [key]: { visible: e.target.checked, order: s[key]?.order || idx + 1, title: s[key]?.title } }))} /><span /></label></div>)}{message && <div className="success-message">{message}</div>}<Link className="btn light-btn wide" to="/admin/site-editor"><Eye size={16} /> LIVE VISUAL EDITOR</Link></aside></div></AdminPage>;
}
function ContentBlock({ title, keyName, content, update, fields }: { title: string; keyName: string; content: SiteContent; update: (key: string, field: string, value: any) => void; fields: string[] }) { return <div className="panel"><div className="panel-head"><h3>{title}</h3><span className="status-pill">EDITABLE</span></div>{fields.map(f => <div className="field" key={f}><label>{f.replace('_',' ').replace(/\b\w/g, x => x.toUpperCase())}</label>{f === 'text' ? <textarea value={content[keyName]?.[f] || ''} onChange={e => update(keyName, f, e.target.value)} /> : <input value={content[keyName]?.[f] || ''} onChange={e => update(keyName, f, e.target.value)} />}</div>)}</div>; }

type EditorDevice = 'desktop' | 'tablet' | 'mobile';
const editorDevices: { key: EditorDevice; label: string; width: number; icon: any }[] = [
  { key: 'desktop', label: 'Desktop', width: 1120, icon: Monitor },
  { key: 'tablet', label: 'Tablet', width: 820, icon: Tablet },
  { key: 'mobile', label: 'Phone', width: 390, icon: Smartphone }
];
const editorTextFields: Record<string, { key: string; label: string; multiline?: boolean }[]> = {
  hero: [
    { key: 'eyebrow', label: 'Eyebrow' }, { key: 'title', label: 'Headline' }, { key: 'subtitle', label: 'Supporting text', multiline: true },
    { key: 'primary_button', label: 'Primary button' }, { key: 'secondary_button', label: 'Secondary button' }
  ],
  warm: [{ key: 'label', label: 'Label' }, { key: 'title', label: 'Headline' }, { key: 'text', label: 'Text', multiline: true }],
  featured_items: [{ key: 'eyebrow', label: 'Eyebrow' }, { key: 'title', label: 'Heading' }],
  categories: [{ key: 'eyebrow', label: 'Eyebrow' }, { key: 'title', label: 'Heading' }],
  why_choose_us: [{ key: 'title', label: 'Heading' }, { key: 'text', label: 'Text', multiline: true }],
  about: [{ key: 'title', label: 'Heading' }, { key: 'text', label: 'Text', multiline: true }],
  reviews: [{ key: 'eyebrow', label: 'Eyebrow' }, { key: 'title', label: 'Heading' }],
  gallery: [{ key: 'title', label: 'Heading' }],
  cta: [{ key: 'title', label: 'Heading' }, { key: 'text', label: 'Text', multiline: true }],
  footer: [{ key: 'tagline', label: 'Tagline', multiline: true }]
};
const contentKeyForSection = (key: string) => key === 'footer' ? 'footer' : key === 'why_choose_us' ? 'home.why' : `home.${key}`;
const defaultsForEditor: SiteContent = {
  'home.hero': demoContent['home.hero'],
  'home.warm': demoContent.warm,
  'home.featured_items': { eyebrow: "CHEF'S SPECIAL PICKS", title: 'Our meal menu' },
  'home.categories': { eyebrow: 'WHAT ARE YOU CRAVING?', title: 'Pick your favorite' },
  'home.why': demoContent['home.why'],
  'home.about': demoContent['home.about'],
  'home.reviews': { eyebrow: 'OUR HAPPY CUSTOMERS', title: 'Words from the table' },
  'home.gallery': { title: 'A little look inside' },
  'home.cta': demoContent['home.cta'],
  footer: demoContent.footer
};

function VisualEditor() {
  const [content, setContent] = useState<SiteContent>({});
  const [sections, setSections] = useState<SiteSections>({});
  const [media, setMedia] = useState<SiteMedia[]>([]);
  const [selected, setSelected] = useState('hero');
  const [device, setDevice] = useState<EditorDevice>('desktop');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaKind, setMediaKind] = useState<'image' | 'video'>('image');
  const [caption, setCaption] = useState('');

  const hydrate = async () => {
    try {
      const x = await fetchAdminContent();
      const merged: SiteContent = { ...defaultsForEditor, ...x.content };
      setContent(merged);
      setSections(x.sections);
      setMedia(x.media || []);
    } catch (e: any) { setMessage(e?.message || 'Unable to load editor.'); }
  };
  useEffect(() => { void hydrate(); }, []);

  const selectedContentKey = contentKeyForSection(selected);
  const current = { ...(defaultsForEditor[selectedContentKey] || {}), ...(content[selectedContentKey] || {}) };
  const section = sections[selected] || { visible: true, order: sectionKeys.indexOf(selected) + 1, title: selected, settings: {} };
  const responsive = section.settings?.responsive || {};
  const deviceSettings = responsive[device] || {};
  const selectedMedia = media.filter(m => m.section_key === selected).sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
  const mediaForPreview = media.filter(m => m.active !== false);

  const updateContent = (field: string, value: any) => setContent(c => ({ ...c, [selectedContentKey]: { ...current, [field]: value } }));
  const updateSection = (patch: any) => setSections(s => ({ ...s, [selected]: { ...section, ...patch } }));
  const updateResponsive = (field: string, value: any) => setSections(s => ({
    ...s,
    [selected]: { ...section, settings: { ...(section.settings || {}), responsive: { ...(section.settings?.responsive || {}), [device]: { ...deviceSettings, [field]: value } } } }
  }));

  const save = async () => {
    setBusy(true); setMessage('');
    try {
      for (const key of sectionKeys) {
        const s = sections[key] || { visible: true, order: sectionKeys.indexOf(key) + 1 };
        await saveSiteSection(key, { is_visible: s.visible !== false, display_order: s.order || sectionKeys.indexOf(key) + 1, title: s.title, settings: s.settings || {} });
      }
      for (const key of Object.keys(content)) await saveSiteContent(key, content[key]);
      setMessage('Published. The public website is now using these changes.');
    } catch (e: any) { setMessage(e?.message || 'Publish failed.'); }
    finally { setBusy(false); }
  };

  const handleFiles = async (incoming: File[]) => {
    if (!incoming.length) return;
    setUploading(true); setMessage('');
    const errors: string[] = []; let added = 0;
    for (const file of incoming) {
      try { const row = await uploadSiteMedia(file, selected, caption); setMedia(m => [...m, row]); added += 1; }
      catch (e: any) { errors.push(e?.message || `${file.name} could not be uploaded.`); }
    }
    if (added) setCaption('');
    setMessage(errors.length ? `${added ? `${added} added. ` : ''}${errors.join(' ')}` : added === 1 ? 'Visual added to this section.' : `${added} visuals added to this section.`);
    setUploading(false);
  };
  const addUrl = async () => {
    try { const row = await addSiteMediaUrl(selected, mediaKind, mediaUrl, caption); setMedia(m => [...m, row]); setMediaUrl(''); setCaption(''); setMessage('Visual added.'); }
    catch (e: any) { setMessage(e?.message || 'Could not add visual URL.'); }
  };
  const removeMedia = async (id: string) => {
    if (!window.confirm('Remove this visual from the website?')) return;
    try { await deleteSiteMedia(id); setMedia(m => m.filter(x => x.id !== id)); } catch (e: any) { setMessage(e?.message || 'Could not remove visual.'); }
  };

  return <AdminPage title="Visual website editor">
    <div className="visual-editor-toolbar panel">
      <div><span className="eyebrow">LIVE DESIGN MODE</span><h3>Edit the page while you see the page</h3><p>Choose a section, change its content or visuals, switch device size, then publish.</p></div>
      <div className="device-switcher">{editorDevices.map(d => { const Icon = d.icon; return <button key={d.key} className={device === d.key ? 'active' : ''} onClick={() => setDevice(d.key)}><Icon size={15} /> {d.label}</button>; })}</div>
      <div className="editor-toolbar-actions"><button className="btn dark" onClick={save} disabled={busy}>{busy ? 'PUBLISHING…' : 'PUBLISH CHANGES'} <Save size={15} /></button><Link className="btn light-btn" to="/admin/branding"><Palette size={15}/> BRANDING</Link><Link className="btn light-btn" to="/">VIEW LIVE <ArrowRight size={15}/></Link></div>
    </div>
    <div className="visual-editor-grid improved-editor">
      <aside className="panel editor-sections">
        <div className="panel-head"><div><span className="eyebrow">PAGE</span><h3>Sections</h3></div><Eye size={17} /></div>
        {sectionKeys.map(key => <button key={key} className={selected === key ? 'editor-section selected' : 'editor-section'} onClick={() => setSelected(key)}><span>{sectionLabels[key]}</span><small>{sections[key]?.visible === false ? 'Hidden' : 'Visible'}</small></button>)}
      </aside>

      <div className="panel preview-panel live-preview-panel">
        <div className="preview-bar"><b>LIVE VISUAL PREVIEW</b><span>{editorDevices.find(x => x.key === device)?.label} · {editorDevices.find(x => x.key === device)?.width}px</span></div>
        <div className="device-stage"><div className={`device-frame ${device}`} style={{ width: `${editorDevices.find(x => x.key === device)?.width || 390}px`, maxWidth: 'none' }}><SiteEditorPreview content={content} sections={sections} media={mediaForPreview} selected={selected} onSelect={setSelected} device={device} /></div></div>
      </div>

      <aside className="panel editor-props improved-props">
        <div className="panel-head"><div><span className="eyebrow">EDITING</span><h3>{sectionLabels[selected]}</h3></div><span className="status-pill">LIVE DRAFT</span></div>
        <div className="editor-tabs"><button className="active">Content</button><button>Layout</button><button>Visuals</button></div>
        <div className="field"><label>Section visibility</label><label className="toggle large"><input type="checkbox" checked={section.visible !== false} onChange={e => updateSection({ visible: e.target.checked })} /><span /></label></div>
        {(editorTextFields[selected] || []).map(field => <div className="field" key={field.key}><label>{field.label}</label>{field.multiline ? <textarea value={current[field.key] || ''} onChange={e => updateContent(field.key, e.target.value)} /> : <input value={current[field.key] || ''} onChange={e => updateContent(field.key, e.target.value)} />}</div>)}
        {selected === 'hero' && <ImageField label="Hero fallback image" value={current.image_url || ''} onChange={v => updateContent('image_url', v)} />}

        <div className="editor-subpanel">
          <div className="panel-head"><div><span className="eyebrow">RESPONSIVE</span><h4>{device === 'desktop' ? 'Desktop' : device === 'tablet' ? 'Tablet' : 'Phone'} styling</h4></div></div>
          {selected === 'hero' ? <>
            <div className="form-grid"><div className="field"><label>Heading size</label><input type="number" min="22" max="120" value={deviceSettings.headingSize ?? (device === 'desktop' ? 82 : device === 'tablet' ? 68 : 52)} onChange={e => updateResponsive('headingSize', Number(e.target.value))} /></div><div className="field"><label>Min height</label><input type="number" min="280" max="900" value={deviceSettings.minHeight ?? (device === 'desktop' ? 680 : device === 'tablet' ? 610 : 570)} onChange={e => updateResponsive('minHeight', Number(e.target.value))} /></div></div>
            <div className="form-grid"><div className="field"><label>Text align</label><select value={deviceSettings.textAlign || 'left'} onChange={e => updateResponsive('textAlign', e.target.value)}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></div><div className="field"><label>Content align</label><select value={deviceSettings.align || 'flex-start'} onChange={e => updateResponsive('align', e.target.value)}><option value="flex-start">Top</option><option value="center">Center</option><option value="flex-end">Bottom</option></select></div></div>
          </> : <>
            <div className="field"><label>Section vertical padding (px)</label><input type="number" min="20" max="180" value={deviceSettings.padding ?? (device === 'desktop' ? 94 : device === 'tablet' ? 76 : 58)} onChange={e => updateResponsive('padding', Number(e.target.value))} /></div>
            <p className="muted-note">These values are saved for this device size. More layout controls can be added section-by-section as needed.</p>
          </>}
        </div>

        <div className="editor-subpanel media-manager">
          <div className="panel-head"><div><span className="eyebrow">VISUALS</span><h4>Photos & videos</h4></div><ImagePlus size={17} /></div>
          <label className="upload-drop"><Upload size={17} /><strong>{uploading ? 'Uploading…' : 'Add photos or videos'}</strong><small>JPG, PNG, WEBP, MP4, MOV · up to {MAX_UPLOAD_MB} MB each</small><input type="file" accept="image/*,video/*" multiple onChange={e => { const files = Array.from(e.target.files || []); e.target.value = ''; void handleFiles(files); }} disabled={uploading} /></label>
          <div className="form-grid"><div className="field"><label>URL type</label><select value={mediaKind} onChange={e => setMediaKind(e.target.value as any)}><option value="image">Photo</option><option value="video">Video</option></select></div><div className="field"><label>Caption</label><input value={caption} onChange={e => setCaption(e.target.value)} placeholder="Optional" /></div></div>
          <div className="field"><label>Or paste a visual URL (optional)</label><div className="inline-field"><input value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} placeholder="https://…" /><button className="ghost" onClick={addUrl} title="Add visual"><Link2 size={16}/></button></div></div>
          <div className="media-stack">{selectedMedia.length ? selectedMedia.map(item => <div className="media-row" key={item.id}>{item.media_type === 'video' ? <div className="media-thumb video-thumb"><Video size={16}/></div> : <img className="media-thumb" src={item.media_url} alt={item.caption || 'Website visual'} />}<div className="media-meta"><b>{item.media_type === 'video' ? 'Video' : 'Photo'}</b><small>{item.caption || item.media_url}</small></div><button className="ghost danger" onClick={() => void removeMedia(item.id)}><Trash2 size={15}/></button></div>) : <div className="empty-mini">No extra visuals attached to this section yet.</div>}</div>
        </div>
        {message && <div className="success-message">{message}</div>}
      </aside>
    </div>
  </AdminPage>;
}

function SiteEditorPreview({ content, sections, media, selected, onSelect, device }: { content: SiteContent; sections: SiteSections; media: SiteMedia[]; selected: string; onSelect: (key: string) => void; device: EditorDevice }) {
  const brand = useBrand();
  const get = (key: string, fallback: any = {}) => ({ ...fallback, ...(content[key] || {}) });
  const hero = get('home.hero', defaultsForEditor['home.hero']);
  const warm = get('home.warm', defaultsForEditor['home.warm']);
  const featured = get('home.featured_items', defaultsForEditor['home.featured_items']);
  const categories = get('home.categories', defaultsForEditor['home.categories']);
  const why = get('home.why', defaultsForEditor['home.why']);
  const about = get('home.about', defaultsForEditor['home.about']);
  const reviews = get('home.reviews', defaultsForEditor['home.reviews']);
  const gallery = get('home.gallery', defaultsForEditor['home.gallery']);
  const cta = get('home.cta', defaultsForEditor['home.cta']);
  const heroResponsive = sections.hero?.settings?.responsive?.[device] || {};
  const selectedResponsive = sections[selected]?.settings?.responsive?.[device] || {};
  const heroMedia = media.find(m => m.section_key === 'hero');
  const aboutMedia = media.find(m => m.section_key === 'about');
  const ctaMedia = media.find(m => m.section_key === 'cta');
  const galleryMedia = media.filter(m => m.section_key === 'gallery');
  const selectedPad = Number(selectedResponsive.padding || (device === 'desktop' ? 72 : device === 'tablet' ? 60 : 48));
  const wrap = (key: string, children: React.ReactNode, className = '') => <section className={`preview-live-section ${selected === key ? 'is-selected' : ''} ${className}`} style={selected === key && key !== 'hero' ? { paddingTop: selectedPad, paddingBottom: selectedPad } : undefined} onClick={() => onSelect(key)}>{selected === key && <span className="preview-selection-label">EDITING {sectionLabels[key]}</span>}{children}</section>;
  return <div className={`preview-site preview-device-${device}` } style={{ '--editor-device-width': `${editorDevices.find(x => x.key === device)?.width || 390}px`, '--editor-section-padding': `${Number(selectedResponsive.padding || (device === 'desktop' ? 94 : device === 'tablet' ? 76 : 58))}px` } as React.CSSProperties}>
    <div className="preview-nav"><span className="preview-brand">{brand.logoUrl && <img src={brand.logoUrl} alt="" />}{!(brand.logoUrl && brand.logoOnly) && brand.name}</span><small>MENU · ABOUT · REVIEWS · CONTACT</small></div>
    {sections.hero?.visible !== false && wrap('hero', <div className="preview-hero" style={{ backgroundImage: heroMedia?.media_type === 'image' ? `linear-gradient(90deg,rgba(43,16,10,.88),rgba(43,16,10,.24)),url(${heroMedia.media_url})` : `linear-gradient(90deg,rgba(43,16,10,.88),rgba(43,16,10,.24)),url(${hero.image_url || placeholderImages.hero})`, minHeight: Number(heroResponsive.minHeight || (device === 'desktop' ? 680 : device === 'tablet' ? 610 : 570)) }}>{heroMedia?.media_type === 'video' && <video className="preview-video-bg" autoPlay muted loop playsInline src={heroMedia.media_url}/>}<div><span>{hero.eyebrow || 'FRESHLY PREPARED · TABLE-SIDE ORDERING'}</span><h1 style={{ fontSize: Number(heroResponsive.headingSize || (device === 'desktop' ? 82 : device === 'tablet' ? 68 : 52)), textAlign: heroResponsive.textAlign || 'left' }}>{hero.title || 'FLAVOR THAT FEELS LIKE HOME.'}</h1><p>{hero.subtitle || 'Bold comfort food, made to order and served straight to your table.'}</p><div className="preview-buttons"><b>{hero.primary_button || 'VIEW MENU'}</b><i>{hero.secondary_button || 'OUR STORY'}</i></div></div></div>)}
    {sections.warm?.visible !== false && wrap('warm', <div className="preview-warm"><span>{warm.label || 'ARE YOU HUNGRY?'}</span><strong>{warm.title || "WE'RE READY."}</strong><p>{warm.text || 'Choose your table, build your meal and send the order straight to our kitchen.'}</p></div>)}
    {sections.featured_items?.visible !== false && wrap('featured_items', <div className="preview-section-body"><span className="preview-eyebrow">{featured.eyebrow || "CHEF'S SPECIAL PICKS"}</span><h2>{featured.title || 'Our meal menu'}</h2><div className="preview-meal-grid">{[placeholderImages.burger,placeholderImages.pizza,placeholderImages.chicken].map((src,i)=><img key={i} src={src} alt="Dish preview" />)}</div></div>)}
    {sections.categories?.visible !== false && wrap('categories', <div className="preview-section-body"><span className="preview-eyebrow">{categories.eyebrow || 'WHAT ARE YOU CRAVING?'}</span><h2>{categories.title || 'Pick your favorite'}</h2><div className="preview-category-row">{['Burgers','Pizza','Chicken','Pasta'].map(x=><span key={x}>{x}</span>)}</div></div>, 'preview-muted')}
    {sections.why_choose_us?.visible !== false && wrap('why_choose_us', <div className="preview-section-body split-preview"><div><span className="preview-eyebrow">WHY CHOOSE US</span><h2>{why.title || 'Big flavor. Honest ingredients. Fast service.'}</h2><p>{why.text || 'Every dish starts with fresh ingredients and ends with a table worth lingering around.'}</p></div><div className="preview-numbers">{(why.items || ['Fresh daily ingredients','Made-to-order kitchen','Friendly table service']).slice(0,3).map((x:string,i:number)=><div key={x}><b>{String(i+1).padStart(2,'0')}</b><span>{x}</span></div>)}</div></div>)}
    {sections.about?.visible !== false && wrap('about', <div className="preview-section-body split-preview"><div className="preview-about-visual">{aboutMedia?.media_type === 'video' ? <video src={aboutMedia.media_url} autoPlay muted loop playsInline/> : <img src={aboutMedia?.media_url || placeholderImages.chicken} alt="About visual"/>}</div><div><span className="preview-eyebrow">OUR STORY</span><h2>{about.title || 'A neighborhood table with a kitchen that cares.'}</h2><p>{about.text || 'A warm restaurant experience built around comfort food, quick service and good company.'}</p></div></div>, 'preview-cream')}
    {sections.reviews?.visible !== false && wrap('reviews', <div className="preview-section-body"><span className="preview-eyebrow">{reviews.eyebrow || 'OUR HAPPY CUSTOMERS'}</span><h2>{reviews.title || 'Words from the table'}</h2><div className="preview-review-cards"><span>★★★★★<br/><small>Fresh, warm and delicious.</small></span><span>★★★★★<br/><small>Fast table-side ordering.</small></span></div></div>)}
    {sections.gallery?.visible !== false && wrap('gallery', <div className="preview-section-body"><span className="preview-eyebrow">OUR DISH GALLERY</span><h2>{gallery.title || 'A little look inside'}</h2><div className="preview-gallery">{galleryMedia.length ? galleryMedia.slice(0,6).map(m => m.media_type === 'video' ? <video key={m.id} src={m.media_url} autoPlay muted loop playsInline/> : <img key={m.id} src={m.media_url} alt={m.caption || 'Gallery visual'}/>) : [placeholderImages.burger,placeholderImages.pizza,placeholderImages.chicken,placeholderImages.pasta].map((src,i)=><img key={i} src={src} alt="Gallery"/>)}</div></div>, 'preview-muted')}
    {sections.cta?.visible !== false && wrap('cta', <div className="preview-cta" style={ctaMedia?.media_type === 'image' ? {backgroundImage:`linear-gradient(90deg,rgba(218,169,52,.94),rgba(218,169,52,.72)),url(${ctaMedia.media_url})`} : undefined}>{ctaMedia?.media_type === 'video' && <video className="preview-video-bg" autoPlay muted loop playsInline src={ctaMedia.media_url}/>}<div><span>READY WHEN YOU ARE</span><h2>{cta.title || 'Make your table the best seat in the house.'}</h2><p>{cta.text || 'Order directly from the menu and skip the wait.'}</p></div><b>ORDER NOW →</b></div>)}
    {sections.footer?.visible !== false && wrap('footer', <div className="preview-footer"><strong>{brand.name}</strong><p>{get('footer', defaultsForEditor.footer).tagline || 'Good food, warm tables, memorable moments.'}</p></div>)}
  </div>;
}

const brandColorFields = [
  { key: 'primary', label: 'Primary color', hint: 'Navigation bar, sidebar, dark buttons' },
  { key: 'accent', label: 'Accent color', hint: 'Highlights, badges, call-to-action bands' },
  { key: 'background', label: 'Page background', hint: 'Main website background' },
  { key: 'text', label: 'Text color', hint: 'Headings and body text' }
] as const;

function BrandingPage() {
  const { preview, refresh } = useBrand();
  const [name, setName] = useState(''); const [logo, setLogo] = useState(''); const [theme, setTheme] = useState<BrandTheme>({});
  const [loaded, setLoaded] = useState(false); const [busy, setBusy] = useState(false); const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null); const logoRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    void fetchAdminContent().then(x => { const s = x.settings || defaultSettings; setName(s.restaurant_name || ''); setLogo(s.logo_url || ''); setTheme(s.brand_theme || {}); setLoaded(true); })
      .catch(e => setMessage({ ok: false, text: e?.message || 'Unable to load branding.' }));
    return () => refresh(); // leaving the page discards anything that was not saved
  }, [refresh]);
  useEffect(() => { if (loaded) preview({ restaurant_name: name, logo_url: logo || null, brand_theme: theme }); }, [loaded, name, logo, theme, preview]);
  const val = (k: keyof typeof defaultBrandTheme) => isHex(theme[k]) ? theme[k]! : defaultBrandTheme[k];
  const setColor = (k: keyof typeof defaultBrandTheme, v: string) => setTheme(t => ({ ...t, [k]: v }));
  const warnings: string[] = [];
  if (contrastRatio('#ffffff', val('primary')) < 4.5) warnings.push('The primary color is too light for the white text used on the navigation bar and buttons.');
  if (contrastRatio(val('primary'), val('accent')) < 3) warnings.push('Primary and accent colors are too similar — text on accent areas will be hard to read.');
  if (contrastRatio(val('text'), val('background')) < 4.5) warnings.push('The text color has low contrast against the page background.');
  const onLogo = async (file?: File) => {
    if (!file) return; setUploading(true); setMessage(null);
    try { setLogo(await uploadImage(file, { folder: 'brand', maxDim: 600 })); } catch (e: any) { setMessage({ ok: false, text: e?.message || 'Logo upload failed.' }); } finally { setUploading(false); }
  };
  const save = async () => {
    setMessage(null);
    const trimmed = name.trim(); if (!trimmed) { setMessage({ ok: false, text: 'The website name cannot be empty.' }); return; }
    const clean: BrandTheme = {};
    for (const f of brandColorFields) { const v = (theme[f.key] || '').trim(); if (!v) continue; if (!isHex(v)) { setMessage({ ok: false, text: `${f.label} must be a 6-digit hex color such as ${defaultBrandTheme[f.key]}.` }); return; } clean[f.key] = v.toLowerCase(); }
    if (theme.logo_only && logo) clean.logo_only = true;
    setBusy(true);
    try {
      await updateSettings({ restaurant_name: trimmed, logo_url: logo || null, brand_theme: clean });
      setName(trimmed); setTheme(clean); refresh();
      setMessage({ ok: true, text: 'Saved. The new name, logo and colors are live across the whole website, kitchen and admin.' });
    } catch (e: any) {
      const m = String(e?.message || 'Could not save branding.');
      setMessage({ ok: false, text: /brand_theme/i.test(m) ? 'The database is missing the branding column. Run the updated supabase/schema.sql in the Supabase SQL Editor, then save again.' : m });
    } finally { setBusy(false); }
  };
  return <AdminPage title="Branding">
    <div className="settings-grid">
      <div className="panel">
        <span className="eyebrow">IDENTITY</span><h3>Name & logo</h3>
        <div className="field"><label>Website name</label><input value={name} maxLength={60} onChange={e => setName(e.target.value)} /><small className="field-hint">Shown in the navigation, footer, sign-in pages, kitchen and admin, and in the browser tab.</small></div>
        <div className="field"><label>Logo</label>
          <div className="logo-uploader">
            <div className="logo-well">{logo ? <img src={logo} alt="Logo preview" /> : <span className="brand-mark">{(name.trim() || 'B').charAt(0).toUpperCase()}</span>}</div>
            <div className="logo-actions">
              <button type="button" className="btn dark small" disabled={uploading} onClick={() => logoRef.current?.click()}><Upload size={14} /> {uploading ? 'UPLOADING…' : logo ? 'REPLACE LOGO' : 'UPLOAD LOGO'}</button>
              {logo && <button type="button" className="btn light-btn small" onClick={() => setLogo('')}><Trash2 size={14} /> REMOVE</button>}
              <input ref={logoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; void onLogo(f); }} />
            </div>
          </div>
          <small className="field-hint">PNG, SVG, JPG or WEBP · up to {MAX_UPLOAD_MB} MB. A transparent PNG or SVG works best. Without a logo, the first letter of the name is used.</small>
        </div>
        {logo && <label className="check-line"><input type="checkbox" checked={Boolean(theme.logo_only)} onChange={e => setTheme(t => ({ ...t, logo_only: e.target.checked }))} /> My logo already contains the name — show the logo only</label>}
      </div>
      <div className="panel">
        <span className="eyebrow">COLORS</span><h3>Website colors</h3>
        {brandColorFields.map(f => <div className="color-row" key={f.key}>
          <input type="color" aria-label={f.label} value={val(f.key)} onChange={e => setColor(f.key, e.target.value)} />
          <div><b>{f.label}</b><small>{f.hint}</small></div>
          <input className="hex" value={theme[f.key] || ''} placeholder={defaultBrandTheme[f.key]} maxLength={7} onChange={e => setColor(f.key, e.target.value.trim())} aria-label={`${f.label} hex value`} />
        </div>)}
        {warnings.map(w => <div className="warn-note" key={w}>{w}</div>)}
        <button type="button" className="btn light-btn small" onClick={() => setTheme(t => ({ logo_only: t.logo_only }))}>RESET COLORS TO DEFAULT</button>
      </div>
      <div className="panel" style={{ gridColumn: '1 / -1' }}>
        <div className="panel-head"><div><span className="eyebrow">PREVIEW</span><h3>How it will look</h3></div><span className="status-pill">LIVE DRAFT</span></div>
        <div className="brand-preview"><div className="brand-preview-nav"><span className="brand light"><BrandLogo /></span></div><div className="brand-preview-body"><h4>{name.trim() || 'Your restaurant'}</h4><p>Bold comfort food, made to order and served straight to your table.</p><div className="brand-preview-actions"><span className="btn gold">VIEW MENU</span><span className="btn dark">START AN ORDER</span></div></div></div>
        {message && <div className={message.ok ? 'success-message' : 'error'}>{message.text}</div>}
        <button className="btn dark" onClick={save} disabled={busy || !loaded}>{busy ? 'SAVING…' : 'SAVE BRANDING'} <Save size={16} /></button>
      </div>
    </div>
  </AdminPage>;
}

function SettingsPage() {
  const { refresh: refreshBrand } = useBrand();
  const [settings, setSettings] = useState<Settings>(defaultSettings); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  useEffect(() => { void fetchAdminContent().then(x => setSettings(x.settings || defaultSettings)).catch(e => setMessage(e?.message || 'Unable to load settings.')); }, []);
  const save = async () => { setBusy(true); setMessage(''); try { await updateSettings(settings); refreshBrand(); setMessage('Restaurant settings saved.'); } catch (e: any) { setMessage(e?.message || 'Could not save settings.'); } finally { setBusy(false); } };
  const set = (key: keyof Settings, value: any) => setSettings(s => ({ ...s, [key]: value }));
  return <AdminPage title="Restaurant settings"><div className="settings-grid"><div className="panel"><span className="eyebrow">BUSINESS PROFILE</span><h3>Public information</h3><div className="form-grid"><div className="field"><label>Restaurant name</label><input value={settings.restaurant_name || ''} onChange={e => set('restaurant_name', e.target.value)} /></div><div className="field"><label>Currency</label><input value={settings.currency || 'RWF'} onChange={e => set('currency', e.target.value)} /></div></div><div className="field"><label>Phone</label><input value={settings.phone || ''} onChange={e => set('phone', e.target.value)} /></div><div className="field"><label>Email</label><input type="email" value={settings.email || ''} onChange={e => set('email', e.target.value)} /></div><div className="field"><label>Address</label><input value={settings.address || ''} onChange={e => set('address', e.target.value)} /></div><div className="field"><label>Opening hours</label><input value={settings.opening_hours || ''} onChange={e => set('opening_hours', e.target.value)} /></div></div><div className="panel"><span className="eyebrow">ORDERING</span><h3>Service rules</h3><div className="form-grid"><div className="field"><label>Tax percentage</label><input type="number" min="0" step="0.01" value={settings.tax_percentage ?? 0} onChange={e => set('tax_percentage', Number(e.target.value))} /></div><div className="field"><label>Restaurant status</label><select value={settings.restaurant_status} onChange={e => set('restaurant_status', e.target.value)}><option value="OPEN">OPEN — accept orders</option><option value="CLOSED">CLOSED — browsing only</option></select></div></div><div className="status-explainer"><CheckCircle2 size={18} /><div><b>{settings.restaurant_status === 'OPEN' ? 'Online ordering is enabled.' : 'Online ordering is disabled.'}</b><p>Customers can still browse the menu when closed.</p></div></div>{message && <div className="success-message">{message}</div>}<button className="btn dark" onClick={save} disabled={busy}>{busy ? 'SAVING…' : 'SAVE SETTINGS'} <Save size={16} /></button></div></div></AdminPage>;
}

function OrdersAdmin() {
  return <ResourceShell type="orders" />;
}
function CategoriesAdmin() { return <ResourceShell type="categories" />; }
function MenuAdmin() { return <ResourceShell type="menu" />; }
function TablesAdmin() { return <ResourceShell type="tables" />; }
function ChefsAdmin() { return <ResourceShell type="chefs" />; }
function CustomersAdmin() { return <ResourceShell type="customers" />; }
function ReviewsAdmin() { return <ResourceShell type="reviews" />; }
function GalleryAdmin() { return <ResourceShell type="gallery" />; }

function App() {
  const [cart, setCart] = useState<CartItem[]>(() => { try { return JSON.parse(localStorage.getItem('bitecraft-cart') || '[]') as CartItem[]; } catch { return []; } });
  const [selectedFood, setSelectedFood] = useState<MenuItem | null>(null); const publicData = usePublicData();
  useEffect(() => { localStorage.setItem('bitecraft-cart', JSON.stringify(cart)); }, [cart]);
  const addConfigured = (item: MenuItem, qty: number, notes: string, addons: any[], variant?: Variant) => {
    const cartId = `${item.id}-${variant?.id || 'base'}-${addons.map(a => a.id).sort().join('-')}-${Date.now()}`;
    setCart(prev => [...prev, { ...item, cartId, qty, notes, addons, variant }]);
  };
  const addSimple = (item: MenuItem) => addConfigured(item, 1, '', [], item.variants?.find(v => v.active !== false));
  const setPublicCartSettings = publicData.settings || defaultSettings;
  return <BrandProvider>
    <ScrollManager />
    <Routes>
      <Route path="/" element={<Home onPick={setSelectedFood} />} />
      <Route path="/menu" element={<MenuPage cartCount={cart.length} onPick={setSelectedFood} />} />
      <Route path="/cart" element={<CartPage cart={cart} setCart={setCart} settings={setPublicCartSettings} />} />
      <Route path="/checkout" element={<Checkout cart={cart} setCart={setCart} settings={setPublicCartSettings} />} />
      <Route path="/order/:token" element={<OrderTracking header={<Layout />} />} />
      <Route path="/order-success" element={<Navigate to="/menu" replace />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/reviews" element={<ReviewsPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/chef" element={<Login role="chef" />} />
      <Route path="/chef/login" element={<Navigate to="/chef" replace />} />
      <Route path="/chef/dashboard" element={<Guard role="chef"><StaffDashboard logo={<Link className="brand light" to="/"><BrandLogo /></Link>} /></Guard>} />
      <Route path="/admin" element={<Login role="admin" />} />
      <Route path="/admin/login" element={<Navigate to="/admin" replace />} />
      <Route path="/admin/dashboard" element={<Dashboard />} />
      <Route path="/admin/history" element={<HistoryPage />} />
      <Route path="/admin/orders" element={<OrdersAdmin />} />
      <Route path="/admin/menu" element={<MenuAdmin />} />
      <Route path="/admin/categories" element={<CategoriesAdmin />} />
      <Route path="/admin/tables" element={<TablesAdmin />} />
      <Route path="/admin/chefs" element={<ChefsAdmin />} />
      <Route path="/admin/customers" element={<CustomersAdmin />} />
      <Route path="/admin/reviews" element={<ReviewsAdmin />} />
      <Route path="/admin/gallery" element={<GalleryAdmin />} />
      <Route path="/admin/site-content" element={<SiteContentPage />} />
      <Route path="/admin/site-editor" element={<VisualEditor />} />
      <Route path="/admin/branding" element={<BrandingPage />} />
      <Route path="/admin/settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    {selectedFood && <FoodModal item={selectedFood} currency={setPublicCartSettings.currency || 'RWF'} onClose={() => setSelectedFood(null)} onAdd={addConfigured} />}
  </BrandProvider>;
}

export default App;

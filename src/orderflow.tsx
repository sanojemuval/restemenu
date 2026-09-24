import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRight, Banknote, Bell, BellOff, Check, ChefHat, ChevronDown, ChevronUp, Clock3, CreditCard, Hand, LogOut, Menu as MenuIcon,
  MessageCircle, RotateCcw, Search, Send, Smartphone, Table2, Wallet, X, Zap
} from 'lucide-react';
import {
  claimOrder, currentStaff, fetchKitchenOrders, fetchMessageStats, fetchOrderByToken, fetchOrderMessages, fetchTables, forgetOrder, formatMoney,
  getMyOrders, isFinished, orderChefName, orderProgress, releaseOrder, sendCustomerMessage, sendStaffMessage, setOrderPayment,
  setOrderStage, subscribeKitchen, supabase,
  type MyOrderRef, type OrderMessage, type OrderStatus, type PaymentMethod, type RestaurantOrder, type StaffInfo, type Table
} from './lib';


/* =========================================================
   Small shared helpers
   ========================================================= */
const clock = (iso?: string | null) => iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
const minutesSince = (iso?: string | null) => iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000)) : 0;
const ago = (iso?: string | null) => { const m = minutesSince(iso); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.floor(m / 60)} h ${m % 60} min ago` : `${Math.floor(m / 1440)} d ago`; };
const tableOf = (o: RestaurantOrder) => o.table_number ?? o.restaurant_tables?.table_number ?? null;
const methodLabel: Record<string, string> = { CASH: 'Cash', MOMO: 'MoMo', CARD: 'Card' };
const stageLabel: Record<OrderStatus, string> = { NEW: 'Waiting', CONFIRMED: 'Taken', PREPARING: 'Cooking', READY: 'Ready', SERVED: 'Served', COMPLETED: 'Completed', CANCELLED: 'Cancelled' };

function useTick(ms: number) { const [, set] = useState(0); useEffect(() => { const t = window.setInterval(() => set(x => x + 1), ms); return () => window.clearInterval(t); }, [ms]); }

function useAnimatedNumber(target: number, ms = 950) {
  const [val, setVal] = useState(0); const from = useRef(0);
  useEffect(() => {
    const a = from.current; const b = target; if (a === b) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { from.current = b; setVal(b); return; }
    const start = performance.now(); let raf = 0;
    const tick = (t: number) => { const k = Math.min(1, (t - start) / ms); const v = a + (b - a) * (1 - Math.pow(1 - k, 3)); from.current = v; setVal(v); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return Math.round(val);
}

export function PayChip({ order }: { order: Pick<RestaurantOrder, 'payment_status' | 'payment_method' | 'status'> }) {
  if (order.status === 'CANCELLED') return <span className="pay-chip void">No payment</span>;
  const paid = order.payment_status === 'PAID';
  return <span className={`pay-chip ${paid ? 'paid' : 'unpaid'}`}>{paid ? <Check size={12} /> : <Wallet size={12} />}{paid ? `Paid${order.payment_method ? ` · ${methodLabel[order.payment_method] || order.payment_method}` : ''}` : 'Unpaid'}</span>;
}
export function ProgressBar({ order }: { order: Pick<RestaurantOrder, 'status' | 'progress'> }) {
  const cancelled = order.status === 'CANCELLED'; const pct = cancelled ? 100 : orderProgress(order);
  return <div className={`kx-bar st-${order.status.toLowerCase()}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><i style={{ width: `${pct}%` }} /><b>{cancelled ? 'Cancelled' : `${pct}%`}</b></div>;
}
export function ChefTag({ order, meId }: { order: Pick<RestaurantOrder, 'assigned_chef' | 'assigned_chef_name' | 'assigned'>; meId?: string }) {
  const name = orderChefName(order);
  if (!name) return <span className="kx-owner free"><Hand size={13} /> Waiting for a chef</span>;
  const mine = Boolean(meId) && order.assigned_chef === meId;
  return <span className={`kx-owner ${mine ? 'mine' : 'taken'}`}><span className="kx-avatar">{name.slice(0, 1).toUpperCase()}</span>{mine ? 'You' : name}</span>;
}

/* =========================================================
   Chat thread (used by the guest and by staff)
   ========================================================= */
// Label a message with who wrote it — Client, Admin, Manager, Chef or Kitchen staff.
const roleTitleMap: Record<string, string> = { admin: 'Admin', manager: 'Manager', chef: 'Chef', kitchen_staff: 'Kitchen staff' };
const roleTitle = (m: OrderMessage) => m.sender === 'customer' ? 'Client' : (roleTitleMap[m.sender_role || ''] || 'Staff');

function ChatThread({ messages, viewer, onSend, disabled, placeholder, quick, empty }: {
  messages: OrderMessage[]; viewer: 'guest' | 'staff'; onSend: (text: string) => Promise<void>; disabled?: string; placeholder: string; quick: string[]; empty: string;
}) {
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const listRef = useRef<HTMLDivElement>(null); const stick = useRef(true); const seenCount = useRef(0);
  const mineSender = viewer === 'guest' ? 'customer' : 'staff';
  useEffect(() => {
    const el = listRef.current; if (!el || messages.length === seenCount.current) return;
    const last = messages[messages.length - 1]; if (stick.current || last?.sender === mineSender) el.scrollTop = el.scrollHeight;
    seenCount.current = messages.length;
  }, [messages, mineSender]);
  const send = async (body: string) => {
    const t = body.trim(); if (!t || busy) return; setBusy(true); setError('');
    try { await onSend(t); setText(''); stick.current = true; } catch (e: any) { setError(e?.message || 'Your message was not sent. Please try again.'); } finally { setBusy(false); }
  };
  return <div className="chat">
    <div className="chat-list" ref={listRef} onScroll={e => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60; }} aria-live="polite">
      {messages.length === 0 && <p className="chat-empty">{empty}</p>}
      {messages.map(m => <div key={m.id} className={`chat-msg ${m.sender === mineSender ? 'mine' : 'theirs'}`}>
        <span className="chat-name">{roleTitle(m)}{m.sender_name ? ` · ${m.sender_name}` : ''}</span>
        <p>{m.body}</p><time>{clock(m.created_at)}</time>
      </div>)}
    </div>
    {disabled ? <p className="chat-off">{disabled}</p> : <>
      {quick.length > 0 && <div className="chat-quick">{quick.map(q => <button type="button" key={q} disabled={busy} onClick={() => void send(q)}>{q}</button>)}</div>}
      {error && <div className="error chat-error">{error}</div>}
      <form className="chat-form" onSubmit={e => { e.preventDefault(); void send(text); }}>
        <input value={text} maxLength={500} onChange={e => setText(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
        <button className="btn gold" disabled={busy || !text.trim()} aria-label="Send message"><Send size={16} /></button>
      </form>
    </>}
  </div>;
}

/* =========================================================
   GUEST — live order tracking
   ========================================================= */
const STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'NEW', label: 'Received' }, { status: 'CONFIRMED', label: 'Chef assigned' }, { status: 'PREPARING', label: 'Cooking' }, { status: 'READY', label: 'Ready' }, { status: 'SERVED', label: 'Served' }
];
const stepIndex = (s: OrderStatus) => s === 'COMPLETED' ? 4 : STEPS.findIndex(x => x.status === s);
const firstAt = (o: RestaurantOrder, s: OrderStatus) => (o.history || []).find(h => h.status === s)?.at;

function guestCopy(o: RestaurantOrder, pct: number): { title: string; text: string; label: string } {
  const chef = orderChefName(o); const table = tableOf(o);
  switch (o.status) {
    case 'NEW': return { title: 'Your order is in.', text: 'We are finding you a chef. This usually takes a moment.', label: 'Received' };
    case 'CONFIRMED': return { title: chef ? `${chef} took your order.` : 'A chef took your order.', text: 'The ingredients are being gathered and the station is being set up.', label: 'Confirmed' };
    case 'PREPARING': return pct >= 80 ? { title: 'Plating up.', text: 'Final touches, then it heads to your table.', label: 'Plating' }
      : pct >= 60 ? { title: 'On the heat now.', text: 'Your food is cooking.', label: 'Cooking' } : { title: 'Your food is being prepared.', text: 'The chef is working on your order.', label: 'Preparing' };
    case 'READY': return { title: 'Ready for your table.', text: table ? `It is on its way to Table ${table}.` : 'It is on its way to your table.', label: 'Ready' };
    case 'SERVED': case 'COMPLETED': return { title: 'Served. Enjoy your meal.', text: o.payment_status === 'PAID' ? 'Payment received. Thank you for dining with us.' : 'Tell the team if anything is missing. Your payment has not been recorded yet.', label: 'Served' };
    default: return { title: 'This order was cancelled.', text: 'Please speak with the restaurant team if you need help.', label: 'Cancelled' };
  }
}

function ProgressRing({ value, status, label }: { value: number; status: OrderStatus; label: string }) {
  const shown = useAnimatedNumber(value); const r = 88; const c = 2 * Math.PI * r; const [fill, setFill] = useState(0);
  useEffect(() => { const id = requestAnimationFrame(() => setFill(value)); return () => cancelAnimationFrame(id); }, [value]);
  return <div className={`ot-ring st-${status.toLowerCase()}`} role="img" aria-label={`Order ${value} percent complete`}>
    <svg viewBox="0 0 220 220" aria-hidden="true">
      <defs><linearGradient id="otGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffe29a" /><stop offset="1" stopColor="#f5b637" /></linearGradient></defs>
      <circle className="ot-ring-track" cx="110" cy="110" r={r} />
      <circle className="ot-ring-fill" cx="110" cy="110" r={r} transform="rotate(-90 110 110)" style={{ strokeDasharray: c, strokeDashoffset: c * (1 - fill / 100) }} />
    </svg>
    <div className="ot-ring-face"><b>{shown}<small>%</small></b><span>{label}</span></div>
  </div>;
}

const guestQuick = ['How long will it take?', 'Please make it less spicy', 'I have a food allergy', 'Can I add a drink?'];

export function OrderTracking({ header }: { header: React.ReactNode }) {
  const { token } = useParams(); const [order, setOrder] = useState<RestaurantOrder | null>(null); const [error, setError] = useState('');
  const loaded = useRef(false);
  const load = useCallback(async () => {
    if (!token) return;
    try { const o = await fetchOrderByToken(token); loaded.current = true; setOrder(o); setError(''); }
    catch (e: any) { if (!loaded.current) setError(e?.message || 'Order not found.'); }
  }, [token]);
  useEffect(() => {
    loaded.current = false; setOrder(null); setError(''); void load();
    const t = window.setInterval(() => { if (!document.hidden) void load(); }, 3000);
    const onVisible = () => { if (!document.hidden) void load(); }; document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(t); document.removeEventListener('visibilitychange', onVisible); };
  }, [load]);

  const pct = order ? orderProgress(order) : 0; const copy = order ? guestCopy(order, pct) : null; const idx = order ? stepIndex(order.status) : -1;
  const cancelled = order?.status === 'CANCELLED'; const done = order ? ['SERVED', 'COMPLETED'].includes(order.status) : false; const chef = order ? orderChefName(order) : null;
  const chatOpen = Boolean(order) && !cancelled && !done;
  const send = async (text: string) => { if (!token) return; await sendCustomerMessage(token, text); await load(); };
  const nav = useNavigate();

  return <div>{header}<main className="page ot-page"><div className="container ot-wrap">
    {error ? <div className="ot-card ot-state"><div className="success-icon error-icon"><X size={34} /></div><h1>We could not find that order.</h1><p className="lead">{error}</p><Link className="btn dark" to="/menu">Back to the menu</Link></div>
      : !order || !copy ? <div className="ot-card ot-state"><div className="loader"><span /><span /><span /></div><p>Loading your order…</p></div>
      : <>
        <section className={`ot-hero st-${order.status.toLowerCase()}`}>
          <div className="ot-hero-copy">
            <span className="ot-kicker">Order {order.order_number}{tableOf(order) ? ` · Table ${tableOf(order)}` : ''} · {order.customer_name}</span>
            <h1>{copy.title}</h1>
            <p>{copy.text}</p>
            <div className="ot-chips">
              {chef ? <span className="ot-chip"><span className="kx-avatar">{chef.slice(0, 1).toUpperCase()}</span>Chef {chef}</span> : !cancelled && !done ? <span className="ot-chip wait"><Hand size={14} /> Waiting for a chef</span> : null}
              <PayChip order={order} />
              <span className="ot-chip"><Clock3 size={14} /> Placed {clock(order.created_at)}</span>
            </div>
          </div>
          {cancelled ? <div className="ot-cancelled"><X size={44} /></div> : <ProgressRing value={pct} status={order.status} label={copy.label} />}
        </section>

        {!cancelled && <ol className="ot-rail" aria-label="Order stages">
          {STEPS.map((s, i) => {
            const reached = i <= idx; const current = i === idx && !done; const at = firstAt(order, s.status);
            return <li key={s.status} className={`${reached ? 'reached' : ''} ${current ? 'current' : ''}`}>
              <span className="ot-dot">{reached && !current ? <Check size={14} /> : i + 1}</span>
              <b>{s.status === 'CONFIRMED' && chef ? `Chef ${chef}` : s.label}</b>
              <small>{at ? clock(at) : reached && i === 0 ? clock(order.created_at) : ' '}</small>
            </li>;
          })}
        </ol>}

        {done && <div className="ot-closed" role="status"><span className="ot-chat-icon"><Check size={18} /></span>
          <div><b>Your order has been served. Enjoy your meal!</b><p>The chat with the kitchen is now closed. If you need anything else, please ask a member of our team at your table.</p></div></div>}

        <div className={`ot-grid ${chatOpen ? '' : 'no-chat'}`}>
          {chatOpen && <section className="ot-card ot-chat" aria-labelledby="chatTitle">
            <div className="ot-card-head">
              <span className="ot-chat-icon"><MessageCircle size={18} /></span>
              <div><h2 id="chatTitle">{chef ? `Talk to Chef ${chef}` : 'Message the kitchen'}</h2>
                <p>{chef ? 'Ask for a change or tell them about allergies. This chat closes when your order is served.' : 'A chef will read this as soon as they take your order.'}</p></div>
            </div>
            <ChatThread messages={order.messages || []} viewer="guest" onSend={send}
              placeholder="Write to your chef…" quick={guestQuick} empty="No messages yet. Say hello, or ask anything about your order." />
          </section>}

          <section className="ot-card ot-items">
            <div className="ot-card-head"><div><h2>Your order</h2><p>{order.order_items.length} {order.order_items.length === 1 ? 'dish' : 'dishes'}</p></div></div>
            <div className="ot-lines">
              {order.order_items.map((i, n) => <div className="ot-line" key={i.id || n}><div><b>{i.quantity} × {i.item_name_snapshot}</b>{i.special_instruction && <small>{i.special_instruction}</small>}</div><strong>{formatMoney(Number(i.unit_price_snapshot) * i.quantity)}</strong></div>)}
            </div>
            {order.general_note && <p className="ot-note"><Bell size={14} /> {order.general_note}</p>}
            <div className="ot-total"><span>Total</span><strong>{formatMoney(Number(order.total))}</strong></div>
            <div className="ot-pay"><PayChip order={order} />{order.payment_status !== 'PAID' && !cancelled && <small>The restaurant records your payment when you settle up.</small>}</div>
          </section>
        </div>

        <p className="ot-foot"><Clock3 size={14} /> This page updates by itself. Your order is saved on this device. Look for the order badge at the bottom of the screen to come back to it.
          {(done || cancelled) && <button type="button" className="text-link" onClick={() => { if (token) forgetOrder(token); nav('/menu'); }}>Remove from this device</button>}</p>
      </>}
  </div></main></div>;
}

/* =========================================================
   GUEST — floating badge that keeps the order in reach on every page
   ========================================================= */
export function ActiveOrderDock() {
  const loc = useLocation(); const [refs, setRefs] = useState<MyOrderRef[]>(() => getMyOrders()); const [orders, setOrders] = useState<Record<string, RestaurantOrder>>({}); const [open, setOpen] = useState(false);
  useEffect(() => { const on = () => setRefs(getMyOrders()); window.addEventListener('bitecraft:my-orders', on); window.addEventListener('storage', on); return () => { window.removeEventListener('bitecraft:my-orders', on); window.removeEventListener('storage', on); }; }, []);
  const key = refs.map(r => r.token).join(',');
  useEffect(() => {
    if (!refs.length) return; let alive = true;
    const pull = () => { if (document.hidden) return; refs.slice(0, 4).forEach(r => void fetchOrderByToken(r.token).then(o => { if (alive) setOrders(m => ({ ...m, [r.token]: o })); }).catch(e => { if (alive && /not found/i.test(String(e?.message || ''))) forgetOrder(r.token); })); };
    pull(); const t = window.setInterval(pull, 5000); return () => { alive = false; window.clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (loc.pathname.startsWith('/order/')) return null;
  const list = refs.slice(0, 4).map(r => ({ ref: r, order: orders[r.token] })).filter(x => x.order) as { ref: MyOrderRef; order: RestaurantOrder }[];
  if (!list.length) return null;
  const active = list.filter(x => !isFinished(x.order)); const first = (active[0] || list[0]);
  const o = first.order; const pct = orderProgress(o); const finished = isFinished(o);
  const rest = list.length - 1;
  return <div className="od-dock" data-open={open}>
    {open && rest > 0 && <div className="od-list">{list.filter(x => x.ref.token !== first.ref.token).map(x => <Link key={x.ref.token} to={`/order/${x.ref.token}`} className="od-item" onClick={() => setOpen(false)}>
      <b>{x.order.order_number}</b><span>{stageLabel[x.order.status]} · {orderProgress(x.order)}%</span><ArrowRight size={14} /></Link>)}</div>}
    <div className={`od-pill st-${o.status.toLowerCase()}`}>
      <Link to={`/order/${first.ref.token}`} className="od-main" aria-label={`Open order ${o.order_number}`}>
        <span className="od-icon"><ChefHat size={18} /></span>
        <span className="od-text"><b>{finished ? (o.status === 'CANCELLED' ? 'Order cancelled' : 'Order served') : `Order ${o.order_number}`}</b><small>{finished ? o.order_number : `${stageLabel[o.status]} · ${pct}%`}</small></span>
        <span className="od-pct">{o.status === 'CANCELLED' ? '' : `${pct}%`}</span>
      </Link>
      {rest > 0 && <button type="button" className="od-more" onClick={() => setOpen(v => !v)} aria-label="Show other orders">+{rest}</button>}
      {finished && <button type="button" className="od-x" onClick={() => forgetOrder(first.ref.token)} aria-label="Dismiss"><X size={15} /></button>}
      <i className="od-bar" style={{ width: `${o.status === 'CANCELLED' ? 0 : pct}%` }} />
    </div>
  </div>;
}

/* =========================================================
   STAFF — shared pieces
   ========================================================= */
const seenKey = (id: string) => `bitecraft:seen:${id}`;
const markSeen = (id: string) => { try { localStorage.setItem(seenKey(id), new Date().toISOString()); } catch { /* optional */ } };
const hasUnread = (id: string, last?: string | null) => {
  if (!last) return false;
  try { const s = localStorage.getItem(seenKey(id)); return !s || new Date(last).getTime() > new Date(s).getTime(); } catch { return true; }
};
type Stats = Record<string, { total: number; lastCustomerAt: string | null }>;

function useKitchenOrders(includeFinished = false) {
  const [orders, setOrders] = useState<RestaurantOrder[]>([]); const [stats, setStats] = useState<Stats>({}); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      const list = await fetchKitchenOrders(); setOrders(list); setError('');
      setStats(await fetchMessageStats((includeFinished ? list : list.filter(o => !isFinished(o))).map(o => o.id)));
    } catch (e: any) { setError(e?.message || 'Unable to load orders.'); } finally { setLoading(false); }
  }, [includeFinished]);
  useEffect(() => { void load(); return subscribeKitchen(() => void load()); }, [load]);
  return { orders, stats, error, loading, reload: load };
}

function playChime() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext; const ctx = new Ctx(); const o = ctx.createOscillator(); const g = ctx.createGain(); const t = ctx.currentTime;
    o.type = 'sine'; o.frequency.setValueAtTime(880, t); o.frequency.setValueAtTime(1175, t + 0.14);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.55); window.setTimeout(() => void ctx.close(), 800);
  } catch { /* sound is optional */ }
}

const itemsSummary = (o: RestaurantOrder) => (o.order_items || []).map(i => `${i.quantity} × ${i.item_name_snapshot}`).join(', ');
type Act = (key: string, fn: () => Promise<void>, after?: () => void) => Promise<void>;
const chefQuick = ['Your order is being prepared.', 'It will be ready in about 5 minutes.', 'Sorry, that item has run out. Can I suggest another?', 'Your order is ready and on its way.'];

function ItemsList({ order }: { order: RestaurantOrder }) {
  return <div className="k-items">{(order.order_items || []).map((i, n) => <div className="k-item" key={i.id || n}><div><strong>{i.quantity} × {i.item_name_snapshot}</strong><span>{i.special_instruction || 'No special instructions'}</span></div><b>{formatMoney(Number(i.unit_price_snapshot) * i.quantity)}</b></div>)}</div>;
}

function ChatModal({ order, staff, onClose, onSeen }: { order: RestaurantOrder; staff: StaffInfo; onClose: () => void; onSeen: () => void }) {
  const [messages, setMessages] = useState<OrderMessage[]>([]); const [error, setError] = useState('');
  const closed = isFinished(order); const chefHidden = staff.role === 'chef' && closed; // chefs lose the chat once the order is served
  const load = useCallback(async () => { try { setMessages(await fetchOrderMessages(order.id)); setError(''); } catch (e: any) { setError(e?.message || 'Could not load messages.'); } }, [order.id]);
  useEffect(() => { void load(); return subscribeKitchen(() => void load()); }, [load]);
  useEffect(() => { markSeen(order.id); onSeen(); }, [messages.length, order.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (chefHidden) onClose(); }, [chefHidden]); // eslint-disable-line react-hooks/exhaustive-deps
  if (chefHidden) return null;
  const canSend = !closed && (staff.role === 'admin' || staff.role === 'manager' || (staff.role === 'chef' && order.assigned_chef === staff.id));
  const send = async (text: string) => { await sendStaffMessage(order.id, text); await load(); };
  const offMsg = closed ? 'This chat is closed because the order was served. You are reading the saved conversation.'
    : staff.role === 'kitchen_staff' ? 'Kitchen staff can read the conversation. Only the chef or manager can reply.' : 'Only the chef on this order can reply.';
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal kx-chat-modal" role="dialog" aria-label={`Messages for ${order.order_number}`} onMouseDown={e => e.stopPropagation()}>
    <button type="button" className="modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button>
    <div className="kx-chat-head"><span className="ot-kicker">Table {tableOf(order) ?? '—'} · {order.order_number}</span>
      <h2>{order.customer_name}</h2>
      <div className="kx-chat-state">{closed ? <span className="closed"><Check size={13} /> {order.status === 'CANCELLED' ? 'Order cancelled' : 'Served'}{order.updated_at ? ` · ${clock(order.updated_at)}` : ''} · chat closed</span> : <span className="open"><i /> Chat open</span>}
        <span className="count">{messages.length} {messages.length === 1 ? 'message' : 'messages'}</span></div>
      <details className="kx-chat-items" open={closed}><summary>What was ordered</summary><ItemsList order={order} />{order.general_note && <p className="kx-chat-note"><Bell size={13} /> {order.general_note}</p>}</details>
    </div>
    {error && <div className="error">{error}</div>}
    <ChatThread messages={messages} viewer="staff" onSend={send} disabled={canSend ? undefined : offMsg} placeholder="Write to the guest…" quick={canSend ? chefQuick : []}
      empty={closed ? 'No messages were sent while this order was open.' : 'The guest has not written yet.'} />
  </div></div>;
}

/** Used by the admin Orders page: opens the same conversation window (read-only once the order is served). */
export function OrderConversationModal({ order, onClose }: { order: RestaurantOrder; onClose: () => void }) {
  const staff: StaffInfo = { id: 'admin', role: 'admin', name: 'Admin' };
  return <ChatModal order={order} staff={staff} onClose={onClose} onSeen={() => undefined} />;
}

/* =========================================================
   STAFF — chef board (take an order, cook it, talk to the guest)
   ========================================================= */
type ChefTab = 'waiting' | 'mine' | 'others' | 'done';
const stageChips = [{ v: 40, l: 'Prep' }, { v: 60, l: 'Cooking' }, { v: 80, l: 'Plating' }];

function ChefOrderCard({ order, staff, unread, msgCount, busy, act, openChat, onClaimed }: {
  order: RestaurantOrder; staff: StaffInfo; unread: boolean; msgCount: number; busy: string; act: Act; openChat: () => void; onClaimed: () => void;
}) {
  const mine = order.assigned_chef === staff.id; const admin = staff.role === 'admin'; const finished = isFinished(order);
  const canAct = (mine || admin) && !finished; const locked = Boolean(order.assigned_chef) && !mine && !finished;
  const pct = orderProgress(order); const k = (s: string) => `${order.id}:${s}`; const working = Boolean(busy);
  const stage = pct >= 80 ? 80 : pct >= 60 ? 60 : 40; const owner = orderChefName(order);
  return <article className={`k-card kx-card st-${order.status.toLowerCase()} ${locked ? 'locked' : ''} ${mine && !finished ? 'mine' : ''}`}>
    <div className="k-top"><div className="order-no">{order.order_number}</div><span className={`kx-stage st-${order.status.toLowerCase()}`}>{stageLabel[order.status]}</span></div>
    <div className="kx-tablerow"><div className="table-call">Table {tableOf(order) ?? '—'}</div><span className="elapsed"><Clock3 size={14} /> {ago(order.created_at)}</span></div>
    <div className="customer">{order.customer_name}{order.customer_phone && <small> · {order.customer_phone}</small>}</div>
    <ProgressBar order={order} />
    <div className="kx-ownline">
      <ChefTag order={order} meId={staff.id} />
      {locked && <span className="kx-lock">Taken {ago(order.claimed_at || order.updated_at)}</span>}
      {!locked && !order.assigned_chef && msgCount > 0 && <span className="kx-lock"><MessageCircle size={12} /> Guest wrote {msgCount}</span>}
    </div>
    <ItemsList order={order} />
    {order.general_note && <div className="k-note"><Bell size={15} /><b>Table note:</b> {order.general_note}</div>}
    {locked && !admin && <p className="kx-locked-note">{owner} is working on this order. You can see it here, but only they can change it.</p>}
    {finished && <div className="kx-done-row"><PayChip order={order} /><span>{order.status === 'CANCELLED' ? 'Cancelled' : 'Served'} {clock(order.updated_at)}</span></div>}

    {order.status === 'NEW' && !order.assigned_chef && !finished && <div className="k-actions"><button className="btn gold grow kx-take" disabled={working} onClick={() => void act(k('claim'), () => claimOrder(order.id), onClaimed)}>{busy === k('claim') ? 'TAKING…' : 'TAKE THIS ORDER'}</button></div>}

    {canAct && order.status === 'PREPARING' && <div className="kx-stages" role="group" aria-label="Cooking stage">{stageChips.map(c => <button key={c.v} type="button" className={stage === c.v ? 'on' : ''} disabled={working} onClick={() => void act(k(`p${c.v}`), () => setOrderStage(order.id, 'PREPARING', c.v))}>{c.l} <small>{c.v}%</small></button>)}</div>}

    {canAct && <div className="k-actions">
      {order.status === 'CONFIRMED' && <button className="btn dark grow" disabled={working} onClick={() => void act(k('prep'), () => setOrderStage(order.id, 'PREPARING', 40))}>{busy === k('prep') ? 'UPDATING…' : 'START PREPARING'}</button>}
      {order.status === 'PREPARING' && <button className="btn dark grow" disabled={working} onClick={() => void act(k('ready'), () => setOrderStage(order.id, 'READY'))}>{busy === k('ready') ? 'UPDATING…' : 'MARK READY'}</button>}
      {order.status === 'READY' && <button className="btn dark grow" disabled={working} onClick={() => void act(k('served'), () => setOrderStage(order.id, 'SERVED'))}>{busy === k('served') ? 'UPDATING…' : 'MARK SERVED'}</button>}
    </div>}
    {finished && admin && <div className="k-actions kx-secondary"><button className="btn light-btn grow kx-msg" onClick={openChat}><MessageCircle size={15} /> View conversation</button></div>}
    {!finished && (mine || admin) && <div className="k-actions kx-secondary">
      <button className="btn light-btn grow kx-msg" onClick={openChat}><MessageCircle size={15} /> Message guest{unread && <i className="kx-unread" aria-label="New message" />}</button>
      {canAct && ['CONFIRMED', 'PREPARING'].includes(order.status) && <button className="btn light-btn" disabled={working} title="Give the order back so another chef can take it" onClick={() => { if (window.confirm('Give this order back so another chef can take it?')) void act(k('release'), () => releaseOrder(order.id)); }}><RotateCcw size={15} /> Give back</button>}
      {canAct && ['NEW', 'CONFIRMED', 'PREPARING'].includes(order.status) && <button className="btn danger-btn" disabled={working} onClick={() => { if (window.confirm('Cancel this order? The guest will see it as cancelled.')) void act(k('cancel'), () => setOrderStage(order.id, 'CANCELLED')); }}><X size={15} /> Cancel</button>}
    </div>}
  </article>;
}

function ChefBoard({ staff }: { staff: StaffInfo }) {
  const { orders, stats, error: loadError, loading, reload } = useKitchenOrders(); useTick(30000);
  const [tab, setTab] = useState<ChefTab>('waiting'); const [busy, setBusy] = useState(''); const [error, setError] = useState(''); const [chatFor, setChatFor] = useState<string | null>(null); const [, setSeen] = useState(0);
  const [sound, setSound] = useState(() => { try { return localStorage.getItem('bitecraft:sound') !== 'off'; } catch { return true; } }); const [flash, setFlash] = useState('');
  const mineOrder = (o: RestaurantOrder) => o.assigned_chef === staff.id;
  const byOldest = (a: RestaurantOrder, b: RestaurantOrder) => a.created_at.localeCompare(b.created_at);
  const waiting = orders.filter(o => o.status === 'NEW' && !o.assigned_chef).sort(byOldest);
  const mine = orders.filter(o => !isFinished(o) && mineOrder(o)).sort(byOldest);
  const others = orders.filter(o => !isFinished(o) && !mineOrder(o) && (o.assigned_chef || o.status !== 'NEW')).sort(byOldest);
  const dayAgo = Date.now() - 24 * 3600 * 1000;
  const done = orders.filter(o => isFinished(o) && new Date(o.updated_at || o.created_at).getTime() > dayAgo);
  const lists: Record<ChefTab, RestaurantOrder[]> = { waiting, mine, others, done };

  const knownIds = useRef<Set<string> | null>(null); const flashTimer = useRef(0); const waitingKey = waiting.map(o => o.id).join(',');
  useEffect(() => {
    if (loading) return;
    if (knownIds.current) {
      const fresh = waiting.filter(o => !knownIds.current!.has(o.id));
      if (fresh.length) { setFlash(`New order · Table ${tableOf(fresh[0]) ?? '—'}${fresh.length > 1 ? ` (+${fresh.length - 1} more)` : ''}`); if (sound) playChime(); window.clearTimeout(flashTimer.current); flashTimer.current = window.setTimeout(() => setFlash(''), 8000); }
    }
    knownIds.current = new Set(waiting.map(o => o.id));
  }, [waitingKey, loading]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  const act: Act = async (key, fn, after) => {
    setBusy(key); setError('');
    try { await fn(); await reload(); after?.(); } catch (e: any) { setError(e?.message || 'That did not work. Please try again.'); await reload(); } finally { setBusy(''); }
  };
  const toggleSound = () => { const next = !sound; setSound(next); try { localStorage.setItem('bitecraft:sound', next ? 'on' : 'off'); } catch { /* optional */ } if (next) playChime(); };
  const chatOrder = chatFor ? orders.find(o => o.id === chatFor) || null : null;
  const tabs: { key: ChefTab; label: string }[] = [{ key: 'waiting', label: 'Waiting' }, { key: 'mine', label: 'My orders' }, { key: 'others', label: 'Other chefs' }, { key: 'done', label: 'Done' }];
  const emptyCopy: Record<ChefTab, [string, string]> = {
    waiting: ['No orders are waiting.', 'New orders appear here the moment a guest sends them.'], mine: ['You have no orders right now.', 'Take an order from the Waiting tab to start cooking.'],
    others: ['No orders with other chefs.', 'Orders that another chef has taken show up here so nobody cooks the same order twice.'], done: ['Nothing finished in the last 24 hours.', 'Served and cancelled orders show up here.']
  };
  const list = lists[tab];
  return <>
    {flash && <div className="kx-flash" role="status"><Bell size={16} /><b>{flash}</b><button type="button" onClick={() => { setTab('waiting'); setFlash(''); }}>Show</button></div>}
    <div className="kx-summary">
      <div><b>{waiting.length}</b><span>waiting for a chef</span></div><div><b>{mine.length}</b><span>on your station</span></div><div><b>{others.length}</b><span>with other chefs</span></div>
    </div>
    <div className="kitchen-toolbar">
      <div className="filter-tabs" role="tablist">{tabs.map(t => <button key={t.key} role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>{t.label} <span>{lists[t.key].length}</span></button>)}</div>
      <div className="kx-tools"><button type="button" className="btn light-btn" onClick={toggleSound} aria-pressed={sound}>{sound ? <Bell size={16} /> : <BellOff size={16} />} Sound {sound ? 'on' : 'off'}</button><button className="btn light-btn" onClick={() => void reload()}><Zap size={16} /> Refresh</button></div>
    </div>
    {(error || loadError) && <div className="error">{error || loadError}</div>}
    {loading ? <div className="loading-box"><div className="loader"><span /><span /><span /></div></div>
      : list.length ? <div className="kitchen-grid">{list.map(o => <ChefOrderCard key={o.id} order={o} staff={staff} busy={busy} act={act} unread={hasUnread(o.id, stats[o.id]?.lastCustomerAt)} msgCount={stats[o.id]?.total || 0} openChat={() => setChatFor(o.id)} onClaimed={() => setTab('mine')} />)}</div>
        : <div className="empty kitchen-empty"><ChefHat size={36} /><h2>{emptyCopy[tab][0]}</h2><p>{emptyCopy[tab][1]}</p></div>}
    {chatOrder && <ChatModal order={chatOrder} staff={staff} onClose={() => setChatFor(null)} onSeen={() => setSeen(x => x + 1)} />}
  </>;
}

/* =========================================================
   STAFF — kitchen floor board (read only): what is being cooked, by whom, where, served, paid
   ========================================================= */
type FloorFilter = 'active' | 'ready' | 'served' | 'unpaid' | 'all';
function FloorBoard({ staff }: { staff: StaffInfo }) {
  const { orders, stats, error: loadError, loading, reload } = useKitchenOrders(true); useTick(30000);
  const [filter, setFilter] = useState<FloorFilter>('active'); const [q, setQ] = useState(''); const [chatFor, setChatFor] = useState<string | null>(null); const [, setSeen] = useState(0);
  const [busy, setBusy] = useState(''); const [error, setError] = useState('');
  const act: Act = async (key, fn, after) => { setBusy(key); setError(''); try { await fn(); await reload(); after?.(); } catch (e: any) { setError(e?.message || 'That did not work. Please try again.'); await reload(); } finally { setBusy(''); } };
  const chatOrder = chatFor ? orders.find(o => o.id === chatFor) || null : null;
  const inProgress = (o: RestaurantOrder) => ['NEW', 'CONFIRMED', 'PREPARING', 'READY'].includes(o.status);
  const served = (o: RestaurantOrder) => ['SERVED', 'COMPLETED'].includes(o.status);
  const counts: Record<FloorFilter, number> = {
    active: orders.filter(inProgress).length, ready: orders.filter(o => o.status === 'READY').length, served: orders.filter(served).length,
    unpaid: orders.filter(o => o.status !== 'CANCELLED' && o.payment_status !== 'PAID').length, all: orders.length
  };
  const shown = orders.filter(o => {
    const s = q.trim().toLowerCase(); if (s && !`${o.order_number} ${o.customer_name} table ${tableOf(o) ?? ''} ${orderChefName(o) || ''}`.toLowerCase().includes(s)) return false;
    return filter === 'active' ? inProgress(o) : filter === 'ready' ? o.status === 'READY' : filter === 'served' ? served(o) : filter === 'unpaid' ? o.status !== 'CANCELLED' && o.payment_status !== 'PAID' : true;
  }).sort((a, b) => filter === 'active' || filter === 'ready' ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at));
  const tabs: { key: FloorFilter; label: string }[] = [{ key: 'active', label: 'In the kitchen' }, { key: 'ready', label: 'Ready' }, { key: 'served', label: 'Served' }, { key: 'unpaid', label: 'Not paid' }, { key: 'all', label: 'All' }];
  return <>
    <div className="kitchen-toolbar">
      <div className="filter-tabs" role="tablist">{tabs.map(t => <button key={t.key} role="tab" aria-selected={filter === t.key} className={filter === t.key ? 'active' : ''} onClick={() => setFilter(t.key)}>{t.label} <span>{counts[t.key]}</span></button>)}</div>
      <div className="kx-tools"><label className="kx-search"><Search size={15} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Table, order or chef" aria-label="Search orders" /></label><button className="btn light-btn" onClick={() => void reload()}><Zap size={16} /> Refresh</button></div>
    </div>
    {(error || loadError) && <div className="error">{error || loadError}</div>}
    {loading ? <div className="loading-box"><div className="loader"><span /><span /><span /></div></div>
      : shown.length ? <div className="kx-rows">{shown.map(o => {
        const isServed = served(o); const n = stats[o.id]?.total || 0;
        return <article key={o.id} className={`kx-row clickable st-${o.status.toLowerCase()}`} role="button" tabIndex={0} title="Click to see the order and its conversation"
          onClick={() => setChatFor(o.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setChatFor(o.id); } }}>
          <div className="kx-row-table"><small>Table</small><b>{tableOf(o) ?? '—'}</b></div>
          <div className="kx-row-main"><b>{o.order_number}</b><span>{o.customer_name} · {ago(o.created_at)}</span><p>{itemsSummary(o)}</p></div>
          <div className="kx-row-chef"><small>Chef</small><ChefTag order={o} meId={staff.id} /></div>
          <div className="kx-row-progress"><span className={`kx-stage st-${o.status.toLowerCase()}`}>{stageLabel[o.status]}</span><ProgressBar order={o} /></div>
          <div className="kx-row-flags">
            <span className={`flag ${isServed ? 'on' : ''} ${o.status === 'CANCELLED' ? 'void' : ''}`}>{isServed ? <Check size={12} /> : <Clock3 size={12} />}{o.status === 'CANCELLED' ? 'Cancelled' : isServed ? 'Served' : 'Not served'}</span>
            <span className="kx-row-pay" onClick={e => e.stopPropagation()}><PaymentControl order={o} act={act} busy={busy} /></span>
            <span className={`kx-msgchip ${n ? 'has' : ''}`}><MessageCircle size={12} /> {n ? `${n} ${n === 1 ? 'message' : 'messages'}` : 'Conversation'}</span>
          </div>
        </article>;
      })}</div>
        : <div className="empty kitchen-empty"><Table2 size={36} /><h2>No orders in this view.</h2><p>Orders show here as soon as guests place them.</p></div>}
    {chatOrder && <ChatModal order={chatOrder} staff={staff} onClose={() => setChatFor(null)} onSeen={() => setSeen(x => x + 1)} />}
  </>;
}

/* =========================================================
   STAFF — manager board: every order from placed to paid
   ========================================================= */
function ProcessTimeline({ order }: { order: RestaurantOrder }) {
  const hist = order.history && order.history.length ? order.history : [{ status: order.status, at: order.created_at, by: null as string | null | undefined }];
  const rows: { label: string; at: string; by?: string | null; kind: string }[] = hist.map((h, i) => ({
    label: h.status === 'NEW' ? (i === 0 ? 'Order placed' : 'Returned to the queue') : h.status === 'CONFIRMED' ? (h.by ? `Taken by ${h.by}` : 'Taken by a chef') : h.status === 'PREPARING' ? 'Started cooking'
      : h.status === 'READY' ? 'Marked ready' : h.status === 'SERVED' ? 'Served to the table' : h.status === 'CANCELLED' ? 'Cancelled' : 'Completed',
    at: h.at, by: h.status === 'CONFIRMED' ? null : h.by, kind: h.status.toLowerCase()
  }));
  if (order.payment_status === 'PAID' && order.paid_at) rows.push({ label: `Paid${order.payment_method ? ` (${methodLabel[order.payment_method] || order.payment_method})` : ''}`, at: order.paid_at, kind: 'paid' });
  return <ol className="kx-timeline">{rows.map((r, i) => <li key={i} className={r.kind}><span /><div><b>{r.label}</b><small>{clock(r.at)}{r.by ? ` · ${r.by}` : ''}</small></div></li>)}</ol>;
}

function PaymentControl({ order, act, busy }: { order: RestaurantOrder; act: Act; busy: string }) {
  const [pick, setPick] = useState(false); const k = `${order.id}:pay`;
  if (order.status === 'CANCELLED') return null;
  if (order.payment_status === 'PAID') return <div className="pay-done"><PayChip order={order} /><small>{order.paid_at ? `at ${clock(order.paid_at)}` : ''}</small>
    <button type="button" className="text-link" disabled={Boolean(busy)} onClick={() => { if (window.confirm('Mark this order as not paid?')) void act(k, () => setOrderPayment(order.id, false)); }}>Undo</button></div>;
  if (!pick) return <button type="button" className="btn dark small" onClick={() => setPick(true)}><Wallet size={15} /> Record payment</button>;
  const methods: { m: PaymentMethod; icon: React.ReactNode; label: string }[] = [{ m: 'CASH', icon: <Banknote size={15} />, label: 'Cash' }, { m: 'MOMO', icon: <Smartphone size={15} />, label: 'MoMo' }, { m: 'CARD', icon: <CreditCard size={15} />, label: 'Card' }];
  return <div className="pay-pick" role="group" aria-label="Payment method"><span>Paid by</span>
    {methods.map(x => <button key={x.m} type="button" className="btn light-btn small" disabled={Boolean(busy)} onClick={() => void act(k, () => setOrderPayment(order.id, true, x.m), () => setPick(false))}>{x.icon}{busy === k ? '…' : x.label}</button>)}
    <button type="button" className="text-link" onClick={() => setPick(false)}>Cancel</button></div>;
}

type MgrFilter = 'all' | 'progress' | 'ready' | 'served' | 'unpaid' | 'paid' | 'cancelled';
function ManagerBoard({ staff }: { staff: StaffInfo }) {
  const { orders, stats, error: loadError, loading, reload } = useKitchenOrders(true); useTick(30000);
  const [tables, setTables] = useState<Table[]>([]); useEffect(() => { void fetchTables().then(setTables).catch(() => undefined); }, []);
  const [filter, setFilter] = useState<MgrFilter>('all'); const [q, setQ] = useState(''); const [tableSel, setTableSel] = useState<number | null>(null); const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(''); const [error, setError] = useState(''); const [chatFor, setChatFor] = useState<string | null>(null); const [, setSeen] = useState(0);
  const act: Act = async (key, fn, after) => { setBusy(key); setError(''); try { await fn(); await reload(); after?.(); } catch (e: any) { setError(e?.message || 'That did not work. Please try again.'); await reload(); } finally { setBusy(''); } };

  const today = new Date().toDateString(); const isToday = (iso?: string | null) => Boolean(iso) && new Date(iso as string).toDateString() === today;
  const cooking = (o: RestaurantOrder) => ['NEW', 'CONFIRMED', 'PREPARING'].includes(o.status); const served = (o: RestaurantOrder) => ['SERVED', 'COMPLETED'].includes(o.status);
  const inProgress = orders.filter(cooking); const ready = orders.filter(o => o.status === 'READY');
  const servedToday = orders.filter(o => served(o) && isToday(o.updated_at || o.created_at));
  const paidToday = orders.filter(o => o.payment_status === 'PAID' && isToday(o.paid_at || o.updated_at));
  const owing = orders.filter(o => served(o) && o.payment_status !== 'PAID');
  const sum = (l: RestaurantOrder[]) => l.reduce((s, o) => s + Number(o.total || 0), 0);

  const tiles = useMemo(() => tables.map(t => {
    const mine = orders.filter(o => tableOf(o) === t.table_number).sort((a, b) => b.created_at.localeCompare(a.created_at));
    const active = mine.find(o => !isFinished(o)); const owes = mine.find(o => served(o) && o.payment_status !== 'PAID');
    return { t, active, owes };
  }), [tables, orders]);

  const shown = orders.filter(o => {
    if (tableSel !== null && tableOf(o) !== tableSel) return false;
    const s = q.trim().toLowerCase(); if (s && !`${o.order_number} ${o.customer_name} ${o.customer_phone || ''} table ${tableOf(o) ?? ''} ${orderChefName(o) || ''}`.toLowerCase().includes(s)) return false;
    switch (filter) {
      case 'progress': return cooking(o); case 'ready': return o.status === 'READY'; case 'served': return served(o);
      case 'unpaid': return o.status !== 'CANCELLED' && o.payment_status !== 'PAID'; case 'paid': return o.payment_status === 'PAID'; case 'cancelled': return o.status === 'CANCELLED'; default: return true;
    }
  });
  const tabs: { key: MgrFilter; label: string; n: number }[] = [
    { key: 'all', label: 'All', n: orders.length }, { key: 'progress', label: 'Cooking', n: inProgress.length }, { key: 'ready', label: 'Ready', n: ready.length }, { key: 'served', label: 'Served', n: orders.filter(served).length },
    { key: 'unpaid', label: 'Not paid', n: orders.filter(o => o.status !== 'CANCELLED' && o.payment_status !== 'PAID').length }, { key: 'paid', label: 'Paid', n: orders.filter(o => o.payment_status === 'PAID').length }, { key: 'cancelled', label: 'Cancelled', n: orders.filter(o => o.status === 'CANCELLED').length }
  ];
  const chatOrder = chatFor ? orders.find(o => o.id === chatFor) || null : null;

  return <>
    <div className="kx-stats">
      <div><span>Cooking now</span><b>{inProgress.length}</b><small>{ready.length} ready to serve</small></div>
      <div><span>Served today</span><b>{servedToday.length}</b><small>{formatMoney(sum(servedToday))} in orders</small></div>
      <div><span>Paid today</span><b>{formatMoney(sum(paidToday))}</b><small>{paidToday.length} {paidToday.length === 1 ? 'order' : 'orders'}</small></div>
      <div className={owing.length ? 'alert' : ''}><span>Served, not paid</span><b>{formatMoney(sum(owing))}</b><small>{owing.length} {owing.length === 1 ? 'order' : 'orders'} waiting for payment</small></div>
    </div>

    {tiles.length > 0 && <section className="kx-floor" aria-label="Tables">
      <div className="kx-floor-head"><h2>Tables</h2>{tableSel !== null && <button type="button" className="text-link" onClick={() => setTableSel(null)}>Show all tables</button>}</div>
      <div className="kx-tiles">{tiles.map(({ t, active, owes }) => <button type="button" key={t.id} onClick={() => { setTableSel(tableSel === t.table_number ? null : t.table_number); setFilter('all'); }}
        className={`kx-tile ${active ? `busy st-${active.status.toLowerCase()}` : owes ? 'owes' : 'free'} ${tableSel === t.table_number ? 'sel' : ''}`} aria-pressed={tableSel === t.table_number}>
        <b>{t.table_number}</b><span>{active ? `${stageLabel[active.status]} · ${orderProgress(active)}%` : owes ? 'Not paid' : 'Free'}</span>
      </button>)}</div>
    </section>}

    <div className="kitchen-toolbar">
      <div className="filter-tabs" role="tablist">{tabs.map(t => <button key={t.key} role="tab" aria-selected={filter === t.key} className={filter === t.key ? 'active' : ''} onClick={() => setFilter(t.key)}>{t.label} <span>{t.n}</span></button>)}</div>
      <div className="kx-tools"><label className="kx-search"><Search size={15} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Table, guest, order or chef" aria-label="Search orders" /></label><button className="btn light-btn" onClick={() => void reload()}><Zap size={16} /> Refresh</button></div>
    </div>
    {(error || loadError) && <div className="error">{error || loadError}</div>}
    {loading ? <div className="loading-box"><div className="loader"><span /><span /><span /></div></div>
      : shown.length ? <div className="kx-mlist">{shown.map(o => {
        const expanded = open === o.id; const toggle = () => setOpen(expanded ? null : o.id); const stat = stats[o.id];
        return <article key={o.id} className={`kx-mcard st-${o.status.toLowerCase()} ${expanded ? 'open' : ''}`}>
          <div className="kx-mcard-head" onClick={toggle}>
            <div className="kx-tbl"><small>Table</small><b>{tableOf(o) ?? '—'}</b></div>
            <div className="kx-mcard-title"><b>{o.order_number}</b><span>{o.customer_name}{o.customer_phone ? ` · ${o.customer_phone}` : ''} · {ago(o.created_at)}</span></div>
            <span className={`kx-stage st-${o.status.toLowerCase()}`}>{stageLabel[o.status]}</span>
            <div className="kx-mcard-progress"><ProgressBar order={o} /></div>
            <ChefTag order={o} meId={staff.id} /><PayChip order={o} />{stat?.total ? <span className="kx-msgchip has" title="Messages with the guest"><MessageCircle size={12} /> {stat.total}</span> : null}<strong>{formatMoney(Number(o.total))}</strong>
            <button type="button" className="kx-chev" aria-expanded={expanded} aria-label={expanded ? 'Hide details' : 'Show details'} onClick={e => { e.stopPropagation(); toggle(); }}>{expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>
          </div>
          {expanded && <div className="kx-mcard-body">
            <div><h3>Process</h3><ProcessTimeline order={o} /></div>
            <div><h3>Order</h3><ItemsList order={o} />{o.general_note && <div className="k-note"><Bell size={15} /><b>Table note:</b> {o.general_note}</div>}</div>
            <div className="kx-mactions">
              <PaymentControl order={o} act={act} busy={busy} />
              <button type="button" className="btn light-btn small" onClick={() => setChatFor(o.id)}><MessageCircle size={15} /> {isFinished(o) ? 'View conversation' : 'Messages'}{stat?.total ? ` (${stat.total})` : ''}{!isFinished(o) && hasUnread(o.id, stat?.lastCustomerAt) && <i className="kx-unread" aria-label="New message" />}</button>
              {['CONFIRMED', 'PREPARING'].includes(o.status) && <button type="button" className="btn light-btn small" disabled={Boolean(busy)} title="Take the order away from the chef and put it back in the queue"
                onClick={() => { if (window.confirm(`Take this order away from ${orderChefName(o) || 'the chef'} and put it back in the queue?`)) void act(`${o.id}:release`, () => releaseOrder(o.id)); }}><RotateCcw size={15} /> Free up order</button>}
            </div>
          </div>}
        </article>;
      })}</div>
        : <div className="empty kitchen-empty"><Table2 size={36} /><h2>No orders match.</h2><p>Try a different filter, or clear the search.</p></div>}
    {chatOrder && <ChatModal order={chatOrder} staff={staff} onClose={() => setChatFor(null)} onSeen={() => setSeen(x => x + 1)} />}
  </>;
}

/* =========================================================
   STAFF — shell + role router
   ========================================================= */
function StaffShell({ staff, logo, children }: { staff: StaffInfo; logo: React.ReactNode; children: React.ReactNode }) {
  const nav = useNavigate();
  const cfg = staff.role === 'manager' ? { label: 'MANAGER', kicker: 'Manager view', title: 'Every order, from kitchen to payment', page: 'Operations', icon: <Table2 size={17} /> }
    : staff.role === 'kitchen_staff' ? { label: 'KITCHEN STAFF', kicker: 'Kitchen floor', title: 'Who is cooking what, and for which table', page: 'Floor board', icon: <Table2 size={17} /> }
    : { label: 'CHEF', kicker: 'Kitchen control', title: 'Orders on the pass', page: 'Orders', icon: <ChefHat size={17} /> };
  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    ['bitecraft:role', 'bitecraft:demo-role', 'bitecraft:demo-name', 'bitecraft:demo-id'].forEach(x => sessionStorage.removeItem(x)); nav('/chef');
  };
  return <div className="portal kitchen-portal"><aside className="sidebar">{logo}<div className="side-label">{cfg.label}</div>
    <Link className="side-item active" to="/chef/dashboard">{cfg.icon} {cfg.page}</Link>
    {(staff.role === 'chef' || staff.role === 'admin') && <Link className="side-item" to="/menu"><MenuIcon size={17} /> Menu</Link>}
    {staff.role === 'admin' && <Link className="side-item" to="/admin/dashboard"><Zap size={17} /> Admin</Link>}
    <div className="side-spacer" /><div className="side-who"><span className="kx-avatar">{staff.name.slice(0, 1).toUpperCase()}</span><span>{staff.name}</span></div>
    <button className="side-item" onClick={() => void signOut()}><LogOut size={17} /> Sign out</button></aside>
    <main className="portal-main"><div className="portal-head"><div><span className="eyebrow">{cfg.kicker}</span><h1>{cfg.title}</h1></div>
      <div className="kx-head-right"><span className="live"><span /> Live updates</span><button type="button" className="btn light-btn small kx-signout" onClick={() => void signOut()}><LogOut size={14} /> Sign out</button></div></div>
      {children}</main></div>;
}

export function StaffDashboard({ logo }: { logo: React.ReactNode }) {
  const [staff, setStaff] = useState<StaffInfo | null>(null); const [error, setError] = useState('');
  useEffect(() => { void currentStaff().then(setStaff).catch(e => setError(e?.message || 'Could not load your account.')); }, []);
  if (error) return <div className="loading"><div className="error">{error}</div></div>;
  if (!staff) return <div className="loading"><div className="loader"><span /><span /><span /></div></div>;
  return <StaffShell staff={staff} logo={logo}>{staff.role === 'manager' ? <ManagerBoard staff={staff} /> : staff.role === 'kitchen_staff' ? <FloorBoard staff={staff} /> : <ChefBoard staff={staff} />}</StaffShell>;
}

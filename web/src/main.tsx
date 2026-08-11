import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

type Dashboard = { date: string; activeEmployees: number; punchedEmployees: number; unmappedPunches: number; activeDevices: number; recentTransactions: Array<{ id: string; occurredAtLocal: string; pin: string; employeeName: string; deviceSerialNumber: string }> };
const empty = (date: string): Dashboard => ({ date, activeEmployees: 0, punchedEmployees: 0, unmappedPunches: 0, activeDevices: 0, recentTransactions: [] });

function App() {
  const [authenticated, setAuthenticated] = useState(Boolean(sessionStorage.getItem('attendance_access_token')));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [date, setDate] = useState('2026-07-01');
  const [data, setData] = useState<Dashboard>(empty(date));
  const [loading, setLoading] = useState(false);
  const [activeNav, setActiveNav] = useState('Dashboard');
  useEffect(() => {
    const token = sessionStorage.getItem('attendance_access_token');
    if (!token) return;
    setLoading(true);
    fetch(`/api/dashboard?date=${date}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then(setData).catch(() => setData(empty(date))).finally(() => setLoading(false));
  }, [date]);
  const menu = ['Dashboard', 'Karyawan', 'Impor Data', 'Transaksi', 'Perangkat'];
  const metrics = [['Karyawan Aktif', data.activeEmployees], ['Sudah Absensi', data.punchedEmployees], ['Belum Dipetakan', data.unmappedPunches], ['Perangkat Aktif', data.activeDevices]];
  if (!authenticated) return <div className="login-page"><form className="login-card" onSubmit={(event) => { event.preventDefault(); setLoggingIn(true); setLoginError(''); fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }).then(async (response) => response.ok ? response.json() : Promise.reject()).then((result) => { sessionStorage.setItem('attendance_access_token', result.accessToken); setAuthenticated(true); }).catch(() => setLoginError('Email atau kata sandi tidak sesuai.')).finally(() => setLoggingIn(false)); }}><div className="login-brand">REKA <span>Absensi</span></div><h1>Masuk</h1><p>Akses panel administrasi absensi.</p><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Kata sandi<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{loginError && <div className="error">{loginError}</div>}<button type="submit" disabled={loggingIn}>{loggingIn ? 'Memeriksa…' : 'Masuk'}</button></form></div>;
  return <div className="shell">
    <aside><div className="brand">REKA <span>Absensi</span></div><nav>{menu.map((item) => <button className={activeNav === item ? 'selected' : ''} onClick={() => setActiveNav(item)} key={item}>{item}</button>)}</nav><div className="sidebar-note">WIB · GMT+7</div></aside>
    <main><header><h1>{activeNav}</h1><label>Tanggal <input aria-label="Tanggal dashboard" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label></header>
      <section className="metrics">{metrics.map(([label, value]) => <article key={String(label)}><p>{label}</p><strong>{loading ? '—' : value}</strong></article>)}</section>
      <section className="content"><div className="panel transactions"><div className="panel-title"><h2>Transaksi Terbaru</h2><a href={`/api/transactions/export?from=${date}&to=${date}`}>Ekspor CSV</a></div><table><thead><tr><th>Waktu</th><th>PIN</th><th>Karyawan</th><th>Perangkat</th></tr></thead><tbody>{data.recentTransactions.length ? data.recentTransactions.map((row) => <tr key={row.id}><td>{row.occurredAtLocal}</td><td>{row.pin}</td><td>{row.employeeName}</td><td>{row.deviceSerialNumber}</td></tr>) : <tr><td colSpan={4} className="empty">Belum ada transaksi pada tanggal ini.</td></tr>}</tbody></table></div>
      <div className="panel device"><h2>Status Perangkat</h2><div className="device-row"><span className="dot"/> Aktivitas perangkat dihitung dari koneksi ADMS terakhir.</div><p className="muted">Panel detail perangkat akan menampilkan serial, IP, firmware, jumlah pengguna, fingerprint, dan transaksi.</p></div></section>
    </main></div>;
}
createRoot(document.getElementById('app')!).render(<App />);

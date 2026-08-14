import { type PropsWithChildren, useEffect, useState } from 'react';
import { NAV_ITEMS, type PageName } from '../app/types';

type AppShellProps = PropsWithChildren<{
  activePage: PageName;
  onNavigate: (page: PageName) => void;
  onLogout: () => void;
  heading: React.ReactNode;
}>;

export function AppShell({ activePage, onNavigate, onLogout, heading, children }: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);
  const navigation = (mobile = false) => <nav className={mobile ? 'drawer-nav' : 'sidebar-nav'} aria-label="Navigasi utama">
    {NAV_ITEMS.map((item) => <button className={activePage === item ? 'is-selected' : ''} onClick={() => { onNavigate(item); setMenuOpen(false); }} key={item}>{item}</button>)}
  </nav>;
  return <div className="app-shell">
    <aside className="desktop-sidebar"><div className="brand">REKA<span>Absensi</span></div>{navigation()}<div className="sidebar-footer"><button className="logout-button" onClick={onLogout}>Keluar</button><div className="sidebar-note">WIB · GMT+7</div></div></aside>
    <div className="app-content">
      <header className="mobile-app-bar"><span>REKA Absensi</span><button type="button" aria-label="Buka menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><i /><i /><i /></button></header>
      {menuOpen && <div className="mobile-menu" role="dialog" aria-label="Navigasi"><button className="menu-backdrop" aria-label="Tutup menu" onClick={() => setMenuOpen(false)} /><div className="menu-sheet"><div className="menu-heading"><span>REKA Absensi</span><button aria-label="Tutup menu" onClick={() => setMenuOpen(false)}>×</button></div>{navigation(true)}<button className="logout-button" onClick={onLogout}>Keluar</button></div></div>}
      <main><div className="page-header">{heading}</div>{children}</main>
    </div>
  </div>;
}

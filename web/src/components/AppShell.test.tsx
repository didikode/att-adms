import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';

describe('AppShell', () => {
  it('opens the mobile menu and navigates after selecting Karyawan', async () => {
    const onNavigate = vi.fn();
    render(<AppShell activePage="Dashboard" onNavigate={onNavigate} onLogout={vi.fn()} heading={<h1>Dashboard</h1>}><p>content</p></AppShell>);

    await userEvent.click(screen.getByRole('button', { name: /buka menu/i }));
    await userEvent.click(within(screen.getByRole('dialog', { name: /navigasi/i })).getByRole('button', { name: 'Karyawan' }));

    expect(onNavigate).toHaveBeenCalledWith('Karyawan');
    expect(screen.queryByRole('dialog', { name: /navigasi/i })).not.toBeInTheDocument();
  });

  it('calls onLogout from the desktop navigation rail', async () => {
    const onLogout = vi.fn();
    render(<AppShell activePage="Dashboard" onNavigate={vi.fn()} onLogout={onLogout} heading={<h1>Dashboard</h1>}><p>content</p></AppShell>);

    await userEvent.click(within(screen.getByRole('complementary')).getByRole('button', { name: 'Keluar' }));

    expect(onLogout).toHaveBeenCalledOnce();
  });
});

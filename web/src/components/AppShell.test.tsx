import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';

describe('AppShell', () => {
  it('opens the mobile menu and navigates after selecting Karyawan', async () => {
    const onNavigate = vi.fn();
    render(<AppShell activePage="Dashboard" onNavigate={onNavigate} heading={<h1>Dashboard</h1>}><p>content</p></AppShell>);

    await userEvent.click(screen.getByRole('button', { name: /buka menu/i }));
    await userEvent.click(within(screen.getByRole('dialog', { name: /navigasi/i })).getByRole('button', { name: 'Karyawan' }));

    expect(onNavigate).toHaveBeenCalledWith('Karyawan');
    expect(screen.queryByRole('dialog', { name: /navigasi/i })).not.toBeInTheDocument();
  });
});

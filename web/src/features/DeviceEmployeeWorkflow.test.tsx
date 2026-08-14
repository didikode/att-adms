import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EmployeeCandidatesPage } from './DeviceEmployeeWorkflow';

describe('EmployeeCandidatesPage', () => {
  it('shows machine actions without employee mutation controls', () => {
    render(<EmployeeCandidatesPage token="token" onRefresh={vi.fn()} candidates={[{ id: 'candidate-1', deviceId: 'device-1', serialNumber: 'SN-1', pin: '0042', name: 'Nama Mesin', state: 'READY' }]} />);
    expect(screen.getByRole('button', { name: 'Simpan' })).toBeInTheDocument();
    expect(screen.queryByText('Tambah Karyawan')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /hapus|edit|nonaktifkan/i })).not.toBeInTheDocument();
  });
});

export const NAV_ITEMS = ['Dashboard', 'Karyawan', 'Transaksi', 'Perangkat', 'Jadwal Laporan'] as const;

export type PageName = (typeof NAV_ITEMS)[number];

export type EmployeeCandidateView = { id: string | null; deviceId: string; serialNumber: string; pin: string; name: string | null; state: 'DISCOVERED' | 'REQUESTED' | 'READY' | 'SAVED' };
export type DeviceView = { serialNumber: string; status: 'ONLINE' | 'OFFLINE'; lastActivityAt: string | null; configuredAllowed: boolean };

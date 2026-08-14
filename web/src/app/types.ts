export const NAV_ITEMS = ['Dashboard', 'Karyawan', 'Impor Data', 'Transaksi', 'Perangkat', 'Jadwal Laporan'] as const;

export type PageName = (typeof NAV_ITEMS)[number];

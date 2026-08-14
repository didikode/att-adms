# Responsive Reference UI Design

## Goal

Restyle the existing Vite/React administration frontend so its browser UI faithfully follows the supplied REKA Absensi desktop and mobile HTML references. The work is visual and responsive; existing authenticated API calls and workflows remain intact.

## Scope

The application retains the current routes/states for Masuk, Dashboard, Karyawan, Impor Data, Transaksi, Perangkat, and Jadwal Laporan. Each view uses the supplied Indonesian copy, maroon REKA Absensi palette, Roboto typography, white surfaces, cool gray background, fine blue-gray borders, and compact shadows.

## Responsive shell

- Desktop (901px and above): a 248px fixed-height maroon navigation rail, centered REKA/Absensi brand, selected menu treatment, WIB/GMT+7 footer, and a main content region with 38px horizontal padding.
- Mobile (900px and below): no persistent rail. The screen begins with the compact REKA Absensi app bar and a menu button. The button opens and closes an accessible navigation drawer; selecting a page closes it. Content uses 16px horizontal gutters.
- The authenticated pages use their own page heading and desktop header rule. Dashboard keeps the date control aligned to the right on desktop and stacks it naturally below the heading on narrow screens.
- The sign-in page uses the reference’s centered 400px desktop card and near-full-width 358px mobile card, without app navigation.

## Components and page layout

- Shared primitives: application shell, navigation, mobile menu control/drawer, page header, border-and-shadow panel, standard input/select/button, responsive table wrapper, metric card, and empty state.
- Dashboard: four equal desktop metric cards; a two-column lower area containing the transaction panel and device-status panel. On mobile, metric cards and both panels stack in reference order.
- Karyawan: employee creation and PIN mapping forms beside the master-employee table on desktop; forms then table on mobile. The table remains scrollable horizontally rather than clipping columns.
- Impor Data: a focused employee-import panel that preserves preview and commit states from the existing implementation.
- Jadwal Laporan: schedule form next to stored schedules on desktop, then stacked on mobile; table cells remain readable through a scroll container where necessary.
- Transaksi and Perangkat: retain their existing API-backed content while using the same shell, metrics, filters, tables, and device-status family as their supplied references.

## Interaction and data flow

Existing API endpoints, authentication storage, form submission, imports, report links, employee search, schedule management, dashboard date changes, and empty/error/loading states remain unchanged. New UI state is limited to the mobile navigation drawer. Buttons and navigation continue to be native controls with visible focus styles.

## Design tokens

- Background: `#f7f9fc`; sign-in canvas: `#eef3f9`; surface: `#ffffff`.
- Brand/sidebar: `#6f301b`; selected state and primary button: `#9e4727`; sidebar text: `#f4e7e1`.
- Heading: `#08060d`; body: `#14213d`; muted: `#68778d`; labels: `#56657b`.
- Borders: `#d8e0ea`, `#dbe2ea`, and input `#cdd7e4`; success: `#28a36a`.
- Roboto with system fallbacks; page title 56px/56px desktop and 36px/40px mobile; panel titles 24px/28px; UI controls 13–14px.
- Panels have 8px radius, 2px visual borders matching the reference, and subtle `0 1px 2px rgb(26 54 93 / 4%)` elevation. Login has 10px radius and `0 12px 35px rgb(16 43 85 / 10%)`.

## Verification

Build the Vite application, then verify the primary authenticated dashboard and sign-in screen at desktop and 390px-wide mobile viewports. Confirm navigation, drawer close-on-selection behavior, login submission, date change, employee search, import file selection, and schedule form controls remain interactive. Compare screenshots to the supplied reference HTML for palette, typography, shell, panels, table behavior, and mobile stacking.

## Exclusions

No change to ADMS `/iclock` behavior, no database migrations, no biometric data, no credentials in fixtures, and no remote device-control features.

# Responsive Reference UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Restyle the existing REKA Absensi React frontend to faithfully follow the supplied desktop and mobile references while preserving API-backed workflows.

**Architecture:** Split the current monolithic component into focused view modules and shared navigation/UI primitives. Existing fetch/session behavior remains in React; a mobile navigation drawer is the only new UI state. A shared stylesheet owns design tokens and desktop/mobile rules.

**Tech Stack:** React 19, TypeScript, Vite 8, native Fetch API, CSS, Vitest, Testing Library.

## Global Constraints

- Preserve existing authenticated API endpoints and all \`/iclock\` behavior.
- Never add biometric templates, credentials, public IP addresses, or production employee records to fixtures.
- Use supplied Indonesian copy, maroon REKA Absensi palette, and Roboto typography.
- Desktop layout begins at 901px; mobile is verified at 390px wide.
- Tables scroll horizontally on small screens instead of clipping columns.
- Do not add remote shell, firmware update, door-control, or biometric-management controls.

---

## File Structure

- \`web/src/main.tsx\`: composition root and authenticated page selection.
- \`web/src/app/types.ts\`: API response and UI types, including \`PageName\`.
- \`web/src/components/AppShell.tsx\`: desktop rail, mobile app bar/drawer, page header.
- \`web/src/components/ui.tsx\`: shared panels, metrics, table scroll wrapper.
- \`web/src/features/auth/LoginPage.tsx\`: API-backed sign-in.
- \`web/src/features/dashboard/DashboardPage.tsx\`: metrics and transaction/device panels.
- \`web/src/features/employees/EmployeesPage.tsx\`: employee and device/PIN mapping.
- \`web/src/features/imports/ImportPage.tsx\`: preview/commit workflow.
- \`web/src/features/schedules/SchedulesPage.tsx\`: report schedules.
- \`web/src/features/placeholder/ReferencePage.tsx\`: Transaksi and Perangkat view variants.
- \`web/src/style.css\`: design tokens and responsive styles.
- \`web/vitest.config.ts\`, \`web/src/test/setup.ts\`, and \`*.test.tsx\`: frontend test seam and focused tests.

### Task 1: Establish test seam, tokens, and responsive application shell

**Files:**
- Modify: \`web/package.json\`, \`web/package-lock.json\`, \`web/src/main.tsx\`, \`web/src/style.css\`
- Create: \`web/vitest.config.ts\`, \`web/src/test/setup.ts\`, \`web/src/app/types.ts\`, \`web/src/components/AppShell.tsx\`, \`web/src/components/AppShell.test.tsx\`

**Interfaces:**
- Produces \`type PageName\`, \`NAV_ITEMS\`, and \`AppShell({ activePage, onNavigate, children })\`.

- [ ] **Step 1: Write failing mobile-menu test**

\`\`\`tsx
it('opens the mobile menu and navigates after selecting Karyawan', async () => {
  const onNavigate = vi.fn();
  render(<AppShell activePage="Dashboard" onNavigate={onNavigate}><p>content</p></AppShell>);
  await userEvent.click(screen.getByRole('button', { name: /buka menu/i }));
  await userEvent.click(screen.getByRole('button', { name: 'Karyawan' }));
  expect(onNavigate).toHaveBeenCalledWith('Karyawan');
  expect(screen.queryByRole('dialog', { name: /navigasi/i })).not.toBeInTheDocument();
});
\`\`\`

- [ ] **Step 2: Run the test to verify it fails**

Run: \`npm run test -- --run web/src/components/AppShell.test.tsx\`

Expected: FAIL because Vitest and \`AppShell\` do not exist.

- [ ] **Step 3: Install/configure test dependencies and implement the shell**

\`\`\`ts
export const NAV_ITEMS = ['Dashboard', 'Karyawan', 'Impor Data', 'Transaksi', 'Perangkat', 'Jadwal Laporan'] as const;
export type PageName = (typeof NAV_ITEMS)[number];
\`\`\`

\`\`\`tsx
export function AppShell({ activePage, onNavigate, children }: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  return <div className="app-shell">{/* desktop sidebar, app bar, drawer, content */}{children}</div>;
}
\`\`\`

- [ ] **Step 4: Implement reference tokens and responsive shell styling**

\`\`\`css
:root { --brand: #6f301b; --brand-action: #9e4727; --page: #f7f9fc; --surface: #fff; --border: #d8e0ea; --heading: #08060d; --body: #14213d; --muted: #68778d; }
@media (max-width: 900px) { .desktop-sidebar { display: none; } .mobile-app-bar { display: flex; } }
\`\`\`

- [ ] **Step 5: Run the test and build**

Run: \`npm run test -- --run web/src/components/AppShell.test.tsx; npm run build\`

Expected: PASS and Vite emits \`web/dist\`.

- [ ] **Step 6: Commit**

\`\`\`bash
git add web/package.json web/package-lock.json web/vitest.config.ts web/src/test/setup.ts web/src/app/types.ts web/src/components/AppShell.tsx web/src/components/AppShell.test.tsx web/src/main.tsx web/src/style.css
git commit -m "feat: add responsive attendance application shell"
\`\`\`

### Task 2: Implement reference sign-in and dashboard

**Files:**
- Create: \`web/src/components/ui.tsx\`, \`web/src/features/auth/LoginPage.tsx\`, \`web/src/features/auth/LoginPage.test.tsx\`, \`web/src/features/dashboard/DashboardPage.tsx\`, \`web/src/features/dashboard/DashboardPage.test.tsx\`
- Modify: \`web/src/main.tsx\`, \`web/src/style.css\`

**Interfaces:**
- Consumes the existing login endpoint, dashboard endpoint, session key, and \`AppShell\`.
- Produces \`LoginPage({ onAuthenticated })\` and \`DashboardPage({ token, date, onDateChange })\`.

- [ ] **Step 1: Write failing view tests**

\`\`\`tsx
it('submits credentials to the login endpoint', async () => {
  global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ accessToken: 'token' }), { status: 200 }));
  render(<LoginPage onAuthenticated={vi.fn()} />);
  await userEvent.type(screen.getByLabelText('Email'), 'admin@example.test');
  await userEvent.type(screen.getByLabelText('Kata sandi'), 'secret');
  await userEvent.click(screen.getByRole('button', { name: 'Masuk' }));
  expect(fetch).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({ method: 'POST' }));
});
it('renders four metrics and the dashboard date input', () => {
  render(<DashboardPage token="token" date="2026-07-01" onDateChange={vi.fn()} />);
  expect(screen.getAllByTestId('metric-card')).toHaveLength(4);
  expect(screen.getByLabelText('Tanggal dashboard')).toHaveValue('2026-07-01');
});
\`\`\`

- [ ] **Step 2: Run tests to verify they fail**

Run: \`npm run test -- --run web/src/features/auth/LoginPage.test.tsx web/src/features/dashboard/DashboardPage.test.tsx\`

Expected: FAIL because focused view modules are absent.

- [ ] **Step 3: Extract exact API behavior and shared primitives**

\`\`\`tsx
export function Panel({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return <section className={\`panel \${className}\`}>{children}</section>;
}
export function MetricCard({ label, value }: { label: string; value: number | string }) {
  return <article className="metric-card" data-testid="metric-card"><p>{label}</p><strong>{value}</strong></article>;
}
\`\`\`

Retain existing request URLs, request bodies, session storage key, error copy, report URLs, date state, filters, and transaction rendering.

- [ ] **Step 4: Apply the supplied layout**

Implement desktop 400px and mobile 358px sign-in cards; 56px dashboard title; four equal desktop metric cards; two-column transaction/device lower area; and one-column mobile stacking. Use reference colors, borders, radii, shadows, and table headings.

- [ ] **Step 5: Run tests and build**

Run: \`npm run test -- --run web/src/features/auth/LoginPage.test.tsx web/src/features/dashboard/DashboardPage.test.tsx; npm run build\`

Expected: PASS without TypeScript errors.

- [ ] **Step 6: Commit**

\`\`\`bash
git add web/src/components/ui.tsx web/src/features/auth web/src/features/dashboard web/src/main.tsx web/src/style.css
git commit -m "feat: implement reference login and dashboard"
\`\`\`

### Task 3: Extract remaining reference pages without changing their workflows

**Files:**
- Create: \`web/src/features/employees/EmployeesPage.tsx\`, \`web/src/features/imports/ImportPage.tsx\`, \`web/src/features/schedules/SchedulesPage.tsx\`, \`web/src/features/placeholder/ReferencePage.tsx\`
- Create: \`web/src/features/employees/EmployeesPage.test.tsx\`, \`web/src/features/imports/ImportPage.test.tsx\`, \`web/src/features/schedules/SchedulesPage.test.tsx\`
- Modify: \`web/src/main.tsx\`, \`web/src/style.css\`

**Interfaces:**
- Consumes shared types/primitives and the present authorization-header implementation.
- Produces individually testable views for Karyawan, Impor Data, Jadwal Laporan, Transaksi, and Perangkat.

- [ ] **Step 1: Write failing feature tests**

\`\`\`tsx
it('keeps the employee table in a scrollable wrapper', () => {
  render(<EmployeesPage token="token" />);
  expect(screen.getByRole('table', { name: /master karyawan/i }).parentElement).toHaveClass('table-scroll');
});
it('enables import preview after selecting an Excel file', async () => {
  render(<ImportPage token="token" />);
  await userEvent.upload(screen.getByLabelText(/pilih file/i), new File(['data'], 'employees.xlsx'));
  expect(screen.getByRole('button', { name: /pratinjau/i })).toBeEnabled();
});
it('renders the stored-schedule table', () => {
  render(<SchedulesPage token="token" />);
  expect(screen.getByRole('table', { name: /jadwal tersimpan/i })).toBeInTheDocument();
});
\`\`\`

- [ ] **Step 2: Run tests to verify they fail**

Run: \`npm run test -- --run web/src/features/employees/EmployeesPage.test.tsx web/src/features/imports/ImportPage.test.tsx web/src/features/schedules/SchedulesPage.test.tsx\`

Expected: FAIL because modules and accessible table labels do not exist.

- [ ] **Step 3: Extract current feature logic verbatim**

Move existing employee CRUD/PIN mapping, import preview/commit, report schedules, transactions, and device display into focused modules. Preserve fetch URLs, HTTP methods, body formats, authorization headers, loading/error messages, and button behavior.

- [ ] **Step 4: Apply page-specific reference styles**

Use the 2-column desktop employee/schedule layouts, 18px gaps, 22px panels, and vertical mobile sequence. Ensure all multi-column tables use \`.table-scroll\`; never replace the supplied table layouts with cards.

- [ ] **Step 5: Run feature tests and build**

Run: \`npm run test -- --run web/src/features/employees/EmployeesPage.test.tsx web/src/features/imports/ImportPage.test.tsx web/src/features/schedules/SchedulesPage.test.tsx; npm run build\`

Expected: PASS and all active pages compile.

- [ ] **Step 6: Commit**

\`\`\`bash
git add web/src/features web/src/main.tsx web/src/style.css
git commit -m "feat: style remaining responsive admin pages"
\`\`\`

### Task 4: Visual and functional verification

**Files:**
- Modify: \`web/src/style.css\` and affected \`.tsx\` files only if comparison identifies a visible mismatch.
- Test: \`web/src/**/*.test.tsx\`

**Interfaces:**
- Consumes complete frontend from Tasks 1–3.
- Produces verified reference fidelity at desktop and mobile dimensions.

- [ ] **Step 1: Build and start Vite**

Run: \`npm run build; npm run dev -- --host 127.0.0.1\`

Expected: a local Vite URL with the built UI.

- [ ] **Step 2: Compare reference and implementation at exact viewports**

Inspect Masuk and Dashboard at 1440×1024, then Dashboard, Masuk, Karyawan, Impor Data, and Jadwal Laporan at 390px-wide viewport using browser screenshots.

- [ ] **Step 3: Check five fidelity points**

Confirm the 248px maroon rail, \`#9e4727\` selected/primary state, Roboto type scale, desktop four-card grid versus mobile one-card stack, 400px/358px login card behavior, and scroll-safe tables.

- [ ] **Step 4: Verify core interactions**

Navigate every page, open/close and select within the mobile drawer, submit sign-in, change dashboard date, search employees, choose an import file, and operate the schedule form.

- [ ] **Step 5: Run full tests and build**

Run: \`npm run test -- --run; npm run build\`

Expected: all frontend tests PASS and \`web/dist\` is generated.

- [ ] **Step 6: Commit visual corrections, if any**

\`\`\`bash
git add web/src/style.css web/src
git commit -m "fix: refine responsive reference fidelity"
\`\`\`

## Self-Review

- Spec coverage: Tasks 1–3 cover shell, sign-in, dashboard, Karyawan, Impor Data, Transaksi, Perangkat, Jadwal Laporan, reference tokens, and mobile behavior. Task 4 verifies comparison and interactions.
- Placeholder scan: there are no deferred requirements; all test commands, expected results, and code/interface names are concrete.
- Type consistency: \`PageName\`, \`AppShell\`, \`LoginPage\`, \`DashboardPage\`, and shared UI primitives are introduced before their consumers.


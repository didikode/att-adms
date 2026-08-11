# HR Attendance Dashboard Design

## Purpose

Build a browser-based HR/Admin application on top of the existing ADMS ingestion service. It manages employees and device identities, turns immutable punches into daily attendance, and exports or emails auditable WIB reports. Existing X105-ID ingestion, PostgreSQL persistence, device allowlisting, and the controlled command queue remain the foundation.

## Users and access

The first release has two roles:

- **Admin** manages accounts, devices, employees, imports, settings, and reports.
- **HR** manages employees, imports, attendance, and reports, but cannot manage accounts or device commands.

All dashboard routes require authentication. Passwords are hashed and sessions expire. Every mutation creates an audit entry with actor, action, target, time, and changed-field summary; passwords and biometric data are never logged.

## Dashboard menus

1. **Dashboard** — selected-date attendance summary, device status, import issues, and recent transactions.
2. **Karyawan** — search, employee detail, device mapping, create/edit/deactivate, and audit history.
3. **Impor Data** — upload, preview, validate, commit, and import history.
4. **Transaksi** — immutable punches with date, employee, department, device, and state filters plus CSV export.
5. **Laporan** — daily, weekly, monthly, and custom ranges; PDF download and scheduled email.
6. **Perangkat** — registered devices, last activity, clock difference, command history, and controlled time synchronization.
7. **Pengaturan** — work schedules, recipients, report schedules, and role-appropriate accounts.

The Indonesian-language desktop UI uses a left navigation rail, compact header, and open table/list surfaces. Mobile prioritizes dashboard and transaction review; imports and bulk editing target desktop browsers.

## Employee model

An **Employee** contains employee code/NIK (`EmployeeID`, unique text), first/last/display name, gender, division code/name, position, email, hire date, active date, status, and lifecycle timestamps.

A **Device Enrollment** maps an Employee to an Attendance Device and contains device ID, PIN/device user ID, registration-device information, enrollment status, and optional fingerprint count. PIN is text so leading zeros remain intact. The unique identity is device plus PIN. One Employee may use multiple devices. The application never imports or stores fingerprint templates.

Punches remain immutable and join to an Employee through device plus PIN. Employee deletion is normally soft deactivation. Hard deletion is allowed only when no punches, enrollments, report history, or audit dependencies exist.

## Import workflows

### HR workbook

The existing `LIST KARYAWAN.xlsx` columns are supported:

`EmployeeID, FirstName, LastName, Gender, DivisionID, Position, Active, HireDate, ActiveDate`

The application template adds optional `Pin, DepartmentName, Email, DeviceSerial`. When PIN and DeviceSerial are missing, the Employee is imported into a manual mapping queue. Names are never used as an automatic unique match.

### Device enrollment CSV

The supplied `employeeEnroll.csv` columns are supported:

`Pin, Emp Name, Department Number, Department Name, Sex, Birthday, Nationality, Title, Office Phone, Mobile, ID Card, Registration Device, FP Count, Left`

`Registration Device` is parsed into serial and IP when possible. `FP Count` is only an inventory number; biometric content is excluded.

### Import safety

Every import follows upload, preview, validate, and commit. Preview reports new, updated, unchanged, ambiguous, and invalid rows. Invalid rows include row number and actionable message. Commit is atomic. Import history stores filename, checksum, actor, counts, time, and error report; identical re-uploads are detected.

## Attendance transactions and CSV

Punches continue arriving automatically through `POST /iclock/cdata?table=ATTLOG` and are deduplicated by device, PIN, and local timestamp. The dashboard need not be open.

Transaction export reproduces the supplied order:

`Index, Pin, Ename, Time, State, Verification, Work Code, Reserved, Device`

- `Index` is a stable export sequence.
- `Pin` preserves leading zeros.
- `Ename` comes from the mapped Employee; unmapped punches are labelled for review.
- `Time` is `Asia/Jakarta` in `YYYY-MM-DD HH:mm:ss`.
- State, Verification, Work Code, and Reserved map from raw values without discarding them.
- Device is rendered as `serial (IP)` when IP is known.

CSV uses UTF-8 and preserves identifiers as text. UI filters also apply to exports.

## Attendance calculation

An **Attendance Day** is derived from Employee, punches, and an effective Work Schedule. Initial results include first check-in, last check-out, late minutes, early-leave minutes, work duration, and exception status. Raw punches are never altered.

Unmapped punches, single-punch days, out-of-window punches, and schedule gaps enter an HR exception queue. Manual corrections are separate records with reason, actor, and time.

## Reports and email

Reports support daily, weekly, monthly, and custom WIB ranges. The initial PDF follows the supplied report structure with employee sections and date-by-date rows. Every Report Run stores fixed filters, output filename, checksum, actor/schedule, recipient list, and delivery result.

PDFs can be downloaded immediately. Daily and weekly email schedules support retries and visible failure history. SMTP credentials remain in environment configuration, never source control or database records.

## WIB and device synchronization

`Asia/Jakarta` is the application timezone. Raw device-local punch text stays unchanged and is interpreted as WIB for calculations. Receipt timestamps remain absolute instants and convert to WIB for display.

The handshake continues to advertise `TimeZone=7`. The Perangkat page compares device-reported time with server WIB when available. Admin may enqueue a confirmed, audited timezone/time synchronization command through the persistent command queue. Automatic correction is initially disabled. Remote shell, clear-log, firmware, door-control, and biometric-management commands are prohibited.

## Architecture and boundaries

NestJS remains the system of record and exposes authenticated JSON endpoints under `/api`. PostgreSQL stores employees, enrollments, imports, audits, attendance calculations, report runs, and delivery history. A React dashboard uses the authenticated API and never connects directly to PostgreSQL or `/iclock`.

ADMS endpoints remain isolated under `/iclock`, independent of browser sessions and protected by the configured device serial allowlist.

## Error handling

- Validation responses identify fields or spreadsheet rows in Indonesian.
- Duplicate employee code or device/PIN returns a conflict without overwriting.
- Import, report, email, and safe device-command failures persist and can be retried.
- Dashboard metrics exclude invalid/unmapped punches from confirmed attendance.
- Logs exclude passwords, email credentials, biometrics, and full file contents.

## Public testing seams

- Authenticated `/api` endpoints for login, employee CRUD, imports, transactions, reports, and device settings.
- Existing `/iclock` endpoints for ingestion, command polling, and acknowledgment.
- Browser workflows for login, employee search/edit, import preview/commit, transaction filters/export, and report generation.
- Generated CSV/PDF artifacts checked for headers, range, employee grouping, and WIB timestamps.

Database setup may prepare isolated test state, but assertions use API responses, browser-visible behavior, or generated files. Fixtures exclude real employee names, credentials, biometric templates, and production punches.

## Delivery phases

### Phase 1 — Admin foundation

- Authentication and Admin/HR roles.
- Employee and Device Enrollment schema.
- Employee CRUD, soft deactivation, and audit history.
- Excel/CSV preview, validation, commit, and history.
- Dashboard shell, employee menu, basic metrics, and transaction browser.
- Reference-format CSV export.

### Phase 2 — Attendance calculation

- Work Schedule management.
- Employee/PIN mapping review queue.
- Attendance Day calculation and exceptions.
- Department and date summaries.

### Phase 3 — Reports

- Reference-aligned PDF.
- Daily, weekly, monthly, and custom ranges.
- Download, scheduled email, retries, and Report Run audit history.

### Phase 4 — Device administration

- Device health and clock-difference display.
- Controlled WIB synchronization.
- Command acknowledgment and operator-visible history.

## Phase 1 acceptance criteria

1. Admin can sign in; HR cannot access account or device-command administration.
2. Admin/HR can create, edit, search, and deactivate Employees.
3. Leading-zero PIN survives import, storage, display, and export.
4. Both supplied import formats preview errors and never silently commit ambiguous rows.
5. Device/PIN maps a punch to one Employee without modifying the punch.
6. Punches persist while no user is signed in and the dashboard is closed.
7. Filtered transaction export has the supplied column order and WIB timestamps.
8. Mutations create audit entries without secrets or biometric data.
9. Desktop workflows work at 1366×768; dashboard/transactions remain readable on a phone.

## Explicit exclusions from Phase 1

- Fingerprint template storage or transfer.
- Remote shell, clear-log, firmware, reboot, door control, or destructive device commands.
- Payroll calculation.
- Automatic hard deletion of employees or punches.
- Automatic clock correction before the controlled Phase 4 workflow.

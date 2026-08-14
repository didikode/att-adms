# Device-Sourced Employee Workflow Design

## Goal

Replace manual/imported employee administration with a device-sourced, operator-confirmed workflow. Attendance devices remain the source of employee identity, operators save one employee at a time, and conflicts never overwrite existing records.

## Scope

This change covers four connected areas:

1. Remove the Master Karyawan import feature from the UI and application API.
2. Make employee records read-only and populate them only from attendance-device USERINFO.
3. Add serial-number registration for attendance devices used for synchronization.
4. Add monthly report schedules sent on the first day of the next month.

The public ADMS contract under \`/iclock\` remains compatible. The system does not add remote shell, firmware, door-control, user update/delete, or biometric-management commands.

## Device registration

The Perangkat page provides one administrative input: device serial number. Saving creates a local Device record if it does not already exist. The page lists the registered serial, connection status, and latest activity.

Database registration does not weaken the existing ADMS allowlist. The same serial must still be present in \`ALLOWED_DEVICE_SERIALS\`; otherwise \`/iclock\` returns HTTP 403 as before. The UI identifies a saved serial that is not yet authorized by configuration.

Duplicate serial registration returns a conflict and does not modify the existing device.

## Employee candidate discovery

Candidate PINs come from immutable \`ATTLOG\` punches received from a registered device. A candidate is a device/PIN pair that does not have an active DeviceEnrollment.

The Karyawan page displays:

- device serial number;
- PIN observed in attendance transactions;
- most recent punch time;
- candidate retrieval state;
- employee name after USERINFO is received;
- one applicable action.

The operator selects one candidate and clicks **Ambil dari Mesin**. The server creates at most one pending device command with the exact form:

\`DATA QUERY USERINFO PIN=<pin>\`

The command uses the existing persistent command queue and is delivered through \`GET /iclock/getrequest\`. The UI shows a waiting state until the device uploads the corresponding metadata.

## USERINFO ingestion

The server accepts USERINFO only through \`POST /iclock/cdata?table=OPERLOG\` from an allowed serial. It parses \`USER PIN=<pin>\\tName=<name>...\` records and stores only candidate metadata needed for review:

- device identity;
- PIN;
- display name;
- request and receipt times;
- candidate status.

The candidate table does not store the raw USERINFO line or any additional USERINFO fields.

The application must not persist or log passwords, card numbers, fingerprint counts, fingerprint templates, face templates, privilege secrets, or biometric payloads. Other OPERLOG payloads are acknowledged without creating employee candidates.

Repeated USERINFO for the same device/PIN updates the temporary candidate view but never updates a saved Employee.

## Manual save and conflict policy

After USERINFO arrives, the operator reviews one candidate and clicks **Simpan**. One database transaction:

1. verifies that the candidate belongs to the selected device/PIN;
2. verifies a non-empty machine-provided name;
3. creates Employee with \`employeeCode = PIN\`, \`firstName = machine name\`, \`displayName = machine name\`, and \`active = true\`;
4. creates DeviceEnrollment for the selected device and PIN;
5. marks the temporary candidate as saved;
6. writes an audit event.

All employee identity fields originate from the device. The UI has no create, edit, deactivate, or delete controls.

The transaction rejects without partial writes when:

- Employee.employeeCode already equals the PIN;
- the device/PIN already has an enrollment;
- the employee/PIN is mapped to another device;
- the candidate changed or disappeared;
- the machine name is empty;
- the device is unknown.

Conflict responses use HTTP 409 and explain the conflicting PIN/device in Indonesian. Validation failures use HTTP 400.

## Import removal

Remove the Impor Data navigation item, page, frontend state, ImportsModule wiring, and public \`/api/imports\` routes. Existing ImportRun database records and schema remain untouched to avoid destructive data loss. No migration drops import tables.

Any old direct Employee create/update/deactivate endpoints are removed or made unavailable. Read endpoints required by reports and employee selection remain.

## Monthly report schedules

Add \`MONTHLY\` to ReportFrequency. A monthly schedule has no configurable day field: it is due on calendar day 1 at its configured WIB time.

The reporting period is the complete previous calendar month in \`Asia/Jakarta\`:

- run on 2026-08-01 → period 2026-07-01 through 2026-07-31;
- run on 2027-01-01 → period 2026-12-01 through 2026-12-31.

Daily and weekly behavior remains unchanged. Test delivery for a monthly schedule uses the previous complete calendar month as well. Delivery uniqueness remains schedule/period/kind so retries do not create duplicate scheduled deliveries.

The Jadwal Laporan UI adds **Bulanan** to the frequency selector and renders stored monthly schedules as “Bulanan · tanggal 1 · HH:mm”.

## API surface

Authenticated administrative endpoints:

- \`POST /api/devices\` with \`{ serialNumber }\` registers one device.
- \`GET /api/devices\` lists registered device status.
- \`GET /api/employee-candidates\` lists unmapped device/PIN candidates and USERINFO state.
- \`POST /api/employee-candidates/:deviceId/:pin/request\` queues USERINFO retrieval.
- \`POST /api/employee-candidates/:candidateId/save\` atomically saves the employee and enrollment.
- \`GET /api/employees\` remains read-only for reports and selection.
- \`POST /api/report-schedules\` accepts DAILY, WEEKLY, or MONTHLY.

Identifiers in paths are URL-encoded. Authentication and role guards continue to protect administrative routes.

## Error handling and observability

Device commands expose pending, delivered, and acknowledged/failure states already supported by the queue. Candidate screens show “Menunggu mesin”, “Siap disimpan”, “Tersimpan”, or a conflict/error.

Audit events record device registration, USERINFO request, and employee save using serial/PIN identifiers without sensitive metadata. Logs never include complete OPERLOG bodies or excluded fields.

## Testing

Follow test-driven development.

HTTP E2E tests must prove:

- device serial registration and duplicate conflict;
- an unknown/unauthorized serial is still rejected by \`/iclock\`;
- an unmapped ATTLOG PIN appears as an employee candidate;
- one request queues exactly one \`DATA QUERY USERINFO PIN=<pin>\` command;
- USERINFO OPERLOG creates/updates only a temporary candidate;
- passwords, cards, and biometric fields are not persisted;
- manual save creates Employee plus DeviceEnrollment atomically;
- existing Employee/PIN/mapping conflicts return 409 and leave data unchanged;
- employee mutation and import endpoints are unavailable;
- monthly schedules are valid and run only on day 1;
- January correctly reports the previous December.

Frontend tests must prove:

- Impor Data is absent from navigation;
- Karyawan has no create/edit/delete controls;
- candidate request/save actions render by state;
- Perangkat provides only serial registration;
- Bulanan is selectable and described correctly.

## Data migration

Add a temporary employee-candidate table keyed by device and PIN, with sanitized name/status timestamps. Add \`MONTHLY\` to the report-frequency enum. Do not delete ImportRun or production employee records. Existing manually/imported employees stay readable and participate in reports but cannot be edited through the application.

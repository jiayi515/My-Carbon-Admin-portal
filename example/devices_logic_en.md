# Logic — devices

How devices are listed, summarized, exported and inspected, and how firmware / apps,
monitoring and pre-warning are driven from the detail page.

## Operations

### listDevices
Realizes: `listDevices` (api-spec.yaml)
Authorize: any Admin · applies [Visible scope]
Rule: return devices matching the query, sorted by the active view preset's default order,
then paginated. Each row carries derived display fields (primary network type, IP, signal,
online status, etc.).
Edge cases:
- quick filters (`sn`, `merchant`, `store`) and advanced filters combine as AND; advanced
  filters take effect only after the user clicks Apply.
- `sn` and `imeiOrMac` accept multiple values (comma- or newline-separated).
- the `store` filter depends on `merchant` and is only available once a merchant is chosen.

### getDeviceSummary
Realizes: `getDeviceSummary` (api-spec.yaml)
Authorize: any Admin · applies [Visible scope]
Rule: within the visible scope, return the total device count, the count per state
(`active` / `pending` / `inactive`), and the count of security-flagged devices
(`rooted` / `devMode` / has warnings).

### exportDevices
Realizes: `exportDevices` (api-spec.yaml)
Authorize: any Admin · applies [Visible scope]
Rule: produce an export file scoped to the filters currently applied on the page; its columns
match the current list view.

### getDevice
Realizes: `getDevice` (api-spec.yaml)
Authorize: any Admin · applies [Visible scope]
Rule: return a device's full detail by `sn` — deployment, network, system and hardware basics —
with derived fields (vendor, part number, hardware ID, config code, last boot time, location)
and the count of related tickets.
Edge cases:
- show a hardware-integrity warning when the device is rooted, has developer mode on, or has
  security warnings.
- for pending or offline devices, location is shown as a placeholder.
Failures:
- device does not exist (or is out of scope) → `404` `NOT_FOUND`

### getDeviceAppsFirmware
Realizes: `getDeviceAppsFirmware` (api-spec.yaml)
Authorize: any Admin · applies [Visible scope]
Rule: return the device's current vs. target firmware (with the lag count), and app compliance
computed by comparing installed apps against the fleet template — required / installed /
missing / outdated, plus the missing and outdated lists.

### getPushHistory
Realizes: `getPushHistory` (api-spec.yaml)
Authorize: any Admin · applies [Visible scope]
Rule: return the device's push history (kind, target, queued time, status, completed time, operator).

### getDeviceMonitoring
Realizes: `getDeviceMonitoring` (api-spec.yaml)
Authorize: any Admin · applies [Visible scope]
Rule: return the device's latest telemetry — security & uptime, connectivity, location, SIM
traffic (only when SIM is enabled), system settings, system status and the event log.
Edge cases:
- mark the data stale when the collection time is older than the freshness threshold.

### recollectMonitoring
Realizes: `recollectMonitoring` (api-spec.yaml)
Authorize: any Admin · applies [Visible scope]
Rule: create a telemetry re-collection task and return its queued result (`202`).

### getDevicePrewarning
Realizes: `getDevicePrewarning` (api-spec.yaml)
Authorize: any Admin · applies [Visible scope]
Rule: return the device's pre-warning policy configuration (traffic, geofence, disk) and the
list of triggered pre-warning events.

### configurePrewarning
Realizes: `configurePrewarning` (api-spec.yaml — `PrewarningConfigRequest`)
Authorize: any Admin · applies [Visible scope]
Rule: save the enabled state and chosen policy for each category after validating the policy id.
Failures:
- an unknown `policyId` → `400` `VALIDATION`

## Shared rules
### Visible scope
Rule: a caller may only act on devices inside their permitted merchant / store scope. The store
filter is only usable after a merchant is chosen. A device outside the caller's scope is treated
as not found (`404` `NOT_FOUND`) rather than forbidden, so its existence isn't leaked.
Used by: every operation in this slug.

### List views
Rule: the list offers preset views (Overview, Network, Security, Hardware, Apps) plus a saved
Custom view. A custom view must keep at least 2 columns; the SN column is pinned far-left and
the Status column far-right, and neither can be hidden. With no custom sort, rows sort by last
seen; the Security view sorts by risk and the Hardware view by storage usage.

## Derived values
- primary network type, IP, signal strength and online status (from the device's network state).
- firmware lag = how many versions the current firmware is behind the target.
- app compliance = required / installed / missing / outdated, from installed apps vs. fleet template.
- monitoring staleness flag = collection time older than the freshness threshold.

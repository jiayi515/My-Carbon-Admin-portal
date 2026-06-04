# Scenarios — devices

Acceptance scenarios for managing the device fleet and operating on a single device.


## Scenario: Admin searches by multiple serial numbers
Exercises: `listDevices`
**Given** I am an Admin
**When** I search with two serial numbers separated by a newline
**Then** I see the devices matching either serial number

## Scenario: Advanced filters combine with AND
Exercises: `listDevices`
**Given** I am an Admin
**When** I set OS to ANDROID and state to active and click Apply
**Then** I see only active ANDROID devices

## Scenario: Store filter depends on merchant
Exercises: `listDevices`
**Given** I am an Admin and no merchant is selected
**When** I look at the store filter
**Then** the store filter is unavailable until I choose a merchant

## Scenario: Admin views the device summary
Exercises: `getDeviceSummary`
**Given** I am an Admin with devices in my scope
**When** I view the summary
**Then** I see the total, the count per state, and the count of security-flagged devices

## Scenario: Admin exports the filtered list
Exercises: `exportDevices`
**Given** I am an Admin and I have filtered the list by state pending
**When** I export the list
**Then** I receive a file containing only the pending devices
**And** its columns match the current view

## Scenario: Admin views device detail with an integrity warning
Exercises: `getDevice`
**Given** I am an Admin and a device is rooted
**When** I open its detail
**Then** I see the deployment, network, system and hardware information
**And** I see a hardware-integrity warning

## Scenario: Admin reviews apps and firmware compliance
Exercises: `getDeviceAppsFirmware`
**Given** I am an Admin and a device is behind the fleet template
**When** I open the Apps & Firmware tab
**Then** I see the current and target firmware with the lag count
**And** I see the missing and outdated apps

## Scenario: Monitoring data is flagged stale
Exercises: `getDeviceMonitoring`
**Given** I am an Admin and a device's last telemetry is older than the freshness threshold
**When** I open the Monitoring tab
**Then** I see the telemetry marked as stale

## Scenario: Admin re-collects monitoring data
Exercises: `recollectMonitoring`
**Given** I am an Admin viewing a device's monitoring
**When** I trigger a re-collection
**Then** a collection task is queued

## Scenario: Admin views pre-warning configuration
Exercises: `getDevicePrewarning`
**Given** I am an Admin viewing a device
**When** I open the Pre-warning tab
**Then** I see the traffic, geofence and disk policy configuration
**And** I see the list of triggered pre-warning events

## Scenario: Admin configures a pre-warning policy
Exercises: `configurePrewarning`
**Given** I am an Admin viewing a device's pre-warning
**When** I enable the geofence policy and choose a valid policy
**Then** the configuration is saved

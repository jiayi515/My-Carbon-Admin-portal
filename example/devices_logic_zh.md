# 逻辑 (Logic) — devices

设备如何被查询、汇总、导出和查看详情，以及如何从详情页驱动固件/应用、监控与预警。

## 操作 (Operations)

### listDevices
实现: `listDevices` (api-spec.yaml)
授权: 任何管理员 · 适用 [可见范围 (Visible scope)]
规则: 返回符合查询条件的设备，按当前视图预设的默认排序规则排序后分页。每一行携带派生展示字段
（主网络类型、IP、信号、在线状态等）。
边缘情况:
- 快捷条件（`sn`、`merchant`、`store`）与高级条件之间为「与」(AND) 关系；高级条件需点击「应用」后才生效。
- `sn` 与 `imeiOrMac` 支持多值（逗号或换行分隔）。
- `store`（门店）条件依赖于 `merchant`（商户），仅在选择商户后可用。

### getDeviceSummary
实现: `getDeviceSummary` (api-spec.yaml)
授权: 任何管理员 · 适用 [可见范围 (Visible scope)]
规则: 在可见范围内，返回设备总数、各状态（`active` / `pending` / `inactive`）的数量，
以及存在安全风险的设备数量（`rooted` / `devMode` / 存在告警）。

### exportDevices
实现: `exportDevices` (api-spec.yaml)
授权: 任何管理员 · 适用 [可见范围 (Visible scope)]
规则: 生成一个导出文件，范围限定为页面当前应用的查询条件；其列与当前列表视图一致。

### getDevice
实现: `getDevice` (api-spec.yaml)
授权: 任何管理员 · 适用 [可见范围 (Visible scope)]
规则: 按 `sn` 返回设备的完整详情 — 部署、网络、系统与硬件基础信息 — 并附带派生字段
（厂商、料号、硬件 ID、配置码、最近开机时间、定位坐标）以及关联工单数量。
边缘情况:
- 当设备已 Root、开启开发者模式或存在安全告警时，展示硬件完整性告警。
- 待激活或离线设备的定位信息以占位方式展示。
失败情况:
- 设备不存在（或超出可见范围）→ `404` `NOT_FOUND`

### getDeviceAppsFirmware
实现: `getDeviceAppsFirmware` (api-spec.yaml)
授权: 任何管理员 · 适用 [可见范围 (Visible scope)]
规则: 返回设备的当前固件与目标固件（含落后版本数），以及通过将已安装应用与车队模板比对计算出的
应用合规情况 — 要求 / 已安装 / 缺失 / 待更新，并附缺失清单与待更新清单。

### getPushHistory
实现: `getPushHistory` (api-spec.yaml)
授权: 任何管理员 · 适用 [可见范围 (Visible scope)]
规则: 返回设备的推送历史（类型、目标、排队时间、状态、完成时间、操作人）。

### pushFirmware
实现: `pushFirmware` (api-spec.yaml — `PushFirmwareRequest`)
授权: 任何管理员 · 适用 [可见范围 (Visible scope)]
规则: 为设备排队下发 `targetVersion` 固件推送；在推送历史中记录为 `pending`。

### pushApps
实现: `pushApps` (api-spec.yaml — `PushAppsRequest`)
授权: 任何管理员 · 适用 [可见范围 (Visible scope)]
规则: 为所列 `apps` 排队下发安装/更新（`kind`），可选 `silent`（静默）；逐项记录到推送历史。
对已安装的应用进行推送会覆盖安装。

### getDeviceMonitoring
实现: `getDeviceMonitoring` (api-spec.yaml)
授权: 任何管理员 · 适用 [可见范围 (Visible scope)]
规则: 返回设备最近一次采集的遥测 — 安全与运行时长、网络连通性、定位、SIM 流量（仅启用 SIM 时）、
系统设置、系统状态及事件日志。
边缘情况:
- 当采集时间超过新鲜度阈值时，标记数据过期。

### recollectMonitoring
实现: `recollectMonitoring` (api-spec.yaml)
授权: 任何管理员 · 适用 [可见范围 (Visible scope)]
规则: 创建一个遥测重新采集任务，并返回其排队结果（`202`）。

### getDevicePrewarning
实现: `getDevicePrewarning` (api-spec.yaml)
授权: 任何管理员 · 适用 [可见范围 (Visible scope)]
规则: 返回设备的预警策略配置（流量、地理围栏、磁盘空间）及已触发的预警事件列表。

### configurePrewarning
实现: `configurePrewarning` (api-spec.yaml — `PrewarningConfigRequest`)
授权: 任何管理员 · 适用 [可见范围 (Visible scope)]
规则: 在校验策略标识有效后，保存每个类别的启用状态与所选策略。
失败情况:
- 策略标识 `policyId` 无效 → `400` `VALIDATION`

## 共享规则 (Shared rules)
### 可见范围 (Visible scope)
规则: 调用者只能对其有权访问的商户/门店范围内的设备进行操作。门店条件仅在选择商户后可用。
超出调用者范围的设备将被视为不存在（返回 `404` `NOT_FOUND`），而不是禁止访问，以免泄露其存在。
被以下操作使用: 本特性标识符内的所有操作。

### 列表视图 (List views)
规则: 列表提供预设视图（概览、网络、安全、硬件、应用）以及一个可保存的自定义视图。自定义视图须至少保留
2 列；SN 号列固定于最左、状态列固定于最右，二者均不可隐藏。未配置自定义排序时，按最近在线时间排序；
安全视图按风险排序，硬件视图按存储使用率排序。

## 派生值 (Derived values)
- 主网络类型、IP、信号强度和在线状态（来自设备的网络状态）。
- 固件落后数 = 当前固件落后目标固件的版本数。
- 应用合规 = 要求 / 已安装 / 缺失 / 待更新，由已安装应用与车队模板比对得出。
- 监控过期标记 = 采集时间早于新鲜度阈值。

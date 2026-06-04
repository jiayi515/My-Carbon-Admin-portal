# 逻辑 (Logic) — device-models

设备型号如何被查询、汇总、导出、创建、查看、修改和删除。

## 操作 (Operations)

### listDeviceModels
实现: `listDeviceModels` (api-spec.yaml)
授权: 任何管理员
规则: 返回符合查询条件的型号。每一行携带操作系统、横竖屏、型号系列、描述信息、
主屏（尺寸 + 分辨率），以及副屏（如存在）。
筛选条件: `modelName`、`description`、`family`、`operatingSystem`（均为可选，以 AND 组合）。
边缘情况:
- 未上传 LOGO 的型号，返回时附带其 `os`（操作系统）对应的默认 LOGO。

### getDeviceModelSummary
实现: `getDeviceModelSummary` (api-spec.yaml)
授权: 任何管理员
规则: 返回按 `operatingSystem`（ANDROID / LINUX / RTOS）分组统计的型号数量。

### exportDeviceModels
实现: `exportDeviceModels` (api-spec.yaml)
授权: 任何管理员
规则: 生成一个导出文件，其列与列表视图一致，范围限定为页面当前应用的查询条件
（`modelName`、`description`、`family`、`operatingSystem`）。

### createDeviceModel
实现: `createDeviceModel` (api-spec.yaml)
授权: 任何管理员
规则: 创建一个 `DeviceModel`。必填：`modelName`、`operatingSystem`、`orientation`、
`family`，以及主屏（`mainScreenSize`、`mainResolution`）。选填：`description`、
副屏（`subScreenSize`、`subResolution`）和 `logoUrl`。
失败情况:
- `modelName`（型号名称）已存在 → `409` `RESOURCE_CONFLICT`
- 缺少必填字段 → `400` `VALIDATION`

### getDeviceModel
实现: `getDeviceModel` (api-spec.yaml)
授权: 任何管理员
规则: 按 `modelId` 返回单个型号的完整详情，包括主副两块屏幕和 LOGO。
失败情况:
- 型号不存在 → `404` `NOT_FOUND`

### updateDeviceModel
实现: `updateDeviceModel` (api-spec.yaml)
授权: 任何管理员
规则: 仅更新可编辑字段 — `description`、`orientation`、主屏、副屏 和 `logoUrl`。
边缘情况:
- `modelName`（型号名称）与 `modelCode`（型号编码）不可修改；任何修改尝试将被忽略/拒绝。
失败情况:
- 型号不存在 → `404` `NOT_FOUND`

### deleteDeviceModel
实现: `deleteDeviceModel` (api-spec.yaml)
授权: 任何管理员
规则: 仅当没有任何对象依赖该型号时才允许删除。
失败情况:
- 存在归属于该型号的设备 (Device) → `409` `RESOURCE_CONFLICT`
- 存在归属于该型号的固件 (Firmware) → `409` `RESOURCE_CONFLICT`
- 型号不存在 → `404` `NOT_FOUND`

## 派生值 (Derived values)
- `DeviceModel.logos` = 由上传的 140 × 140 主图派生出的四种尺寸（140 / 70 / 55 / 35 像素）。
  当未上传 LOGO 时，改为返回一个与 `operatingSystem`（操作系统）关联的默认 LOGO。

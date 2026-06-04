# 领域模型 (Domain) — device-models

设备型号目录的共享词汇表 + 领域级规则，由 device-models 特性标识符引用。

## 实体 (Entities)
| 实体 | 用户/业务关心的字段 |
| --- | --- |
| `DeviceModel` | `modelId`, `modelCode`, `vendorPartnerId`, `modelName`, `family`, `description`, `os`, `orientation`, `screens`, `logos` |
| `Screen` | `size`, `resolution`, `secondaryScreenFlag` |
| `Logo` | `size`, `url` |

## 关系 (Relationships)
- `VendorPartner` 1—* `DeviceModel`（一个厂家实体生产多个型号）
- `DeviceModel` 1—* `Screen`（一个型号有一块主屏和一块可选的副屏）
- `DeviceModel` 1—* `Logo`（一个型号有一张主图，渲染为 4 种尺寸）
- `DeviceModel` 1—* `Device`（设备机群中的设备归属于某个型号 — 阻止删除）
- `DeviceModel` 1—* `Firmware`（固件针对某个型号发布 — 阻止删除）

## 枚举 (Enums)
- `OS` = `ANDROID` (安卓) | `LINUX` | `RTOS` (实时操作系统)
- `Orientation` = `LANDSCAPE` (横屏) | `PORTRAIT` (竖屏)
- `LogoSize` = `140` | `70` | `55` | `35`（像素；140 为主图，70 / 55 / 35 由其派生）

## 角色 (Roles)
### 管理员 (Admin)
- 作用域 (Scope)：按组织 (per-org)，覆盖整个型号目录
- 授予方式 (Granted)：分配给平台管理员
- 能力摘要 (Capability summary)：查询、查看、导出、创建、修改和删除设备型号

## 业务不变量 (Invariants)
- `modelName`（型号名称）在全系统内唯一。
- `modelCode`（型号编码）和 `modelName`（型号名称）在型号创建后不可修改。
- 一个型号有且仅有一块主屏 `Screen`；副屏 `Screen` 为可选。
- 一个型号的 `logos` 包含四种尺寸（140 / 70 / 55 / 35 像素），均由一张背景为纯白或透明的
  140 × 140 主图派生而来。
- 当型号未上传 LOGO 时，根据其 `os`（操作系统）展示对应的默认 LOGO。
- 当存在任何归属于该型号的 `Device`（设备）或 `Firmware`（固件）时，`DeviceModel` 不可删除。

## 横切规则 (Cross-cutting rules)
- **操作审计 (Audited writes)** — 对型号的每次创建/修改/删除操作都会记录一条审计日志：操作人、操作内容、操作时间。

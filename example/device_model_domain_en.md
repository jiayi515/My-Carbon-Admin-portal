# Domain — device-models

Shared vocabulary + area-wide rules for the Device Models catalog that the device-models slug references.

## Entities
| Entity | Fields the user / business cares about |
| --- | --- |
| `DeviceModel` | `modelId`, `modelCode`, `vendorPartnerId`, `modelName`, `family`, `description`, `os`, `orientation`, `screens`, `logos` |
| `Screen` | `size`, `resolution`, `secondaryScreenFlag` |
| `Logo` | `size`, `url` |

## Relationships
- `VendorPartner` 1—* `DeviceModel` (a vendor partner manufactures many models)
- `DeviceModel` 1—* `Screen` (a model has one primary screen and an optional secondary screen)
- `DeviceModel` 1—* `Logo` (a model has one master logo rendered at 4 sizes)
- `DeviceModel` 1—* `Device` (devices in the fleet belong to a model — blocks deletion)
- `DeviceModel` 1—* `Firmware` (firmware is published against a model — blocks deletion)

## Enums
- `OS = ANDROID | LINUX | RTOS`
- `Orientation = LANDSCAPE | PORTRAIT`
- `LogoSize = 140 | 70 | 55 | 35` (px; the 140 master, 70 / 55 / 35 derived)

## Roles
### Admin
- Scope: per-org (the whole model catalog)
- Granted: assigned to platform administrators
- Capability summary: list, view, export, create, update and delete device models

## Invariants
- `modelName` is unique across the whole system.
- `modelCode` and `modelName` are immutable once a model is created.
- A model has exactly one primary `Screen`; a secondary `Screen` is optional.
- A model's `logos` are four sizes (140 / 70 / 55 / 35 px) all derived from a single
  140 × 140 master with a solid white or transparent background.
- When a model has no uploaded logo, a default logo is shown based on its `os`.
- A `DeviceModel` cannot be deleted while any `Device` or `Firmware` belongs to it.

## Cross-cutting rules
- **Audited writes** — every create / update / delete on a model records an audit entry: who, what, when.

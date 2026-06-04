# Logic — device-models

How device models are listed, summarized, exported, created, viewed, updated and deleted.

## Operations

### listDeviceModels
Realizes: `listDeviceModels` (api-spec.yaml)
Authorize: any Admin
Rule: return models matching the query. Each row carries OS, orientation, family, description,
primary screen (size + resolution) and secondary screen when present.
Filters: `modelName`, `description`, `family`, `operatingSystem` (all optional; combined as AND).
Edge cases:
- a model with no uploaded logo is returned with the default logo for its `os`.

### getDeviceModelSummary
Realizes: `getDeviceModelSummary` (api-spec.yaml)
Authorize: any Admin
Rule: return the count of models grouped by `operatingSystem` (ANDROID / LINUX / RTOS).

### exportDeviceModels
Realizes: `exportDeviceModels` (api-spec.yaml)
Authorize: any Admin
Rule: produce an export file whose columns match the list view, scoped to the query filters
(`modelName`, `description`, `family`, `operatingSystem`) currently applied on the page.

### createDeviceModel
Realizes: `createDeviceModel` (api-spec.yaml)
Authorize: any Admin
Rule: create a DeviceModel. Required: `modelName`, `operatingSystem`, `orientation`,
`family`, and the primary screen (`mainScreenSize`, `mainResolution`). Optional: `description`,
secondary screen (`subScreenSize`, `subResolution`) and `logoUrl`.
Failures:
- `modelName` already exists → `409` `RESOURCE_CONFLICT`
- a required field is missing → `400` `VALIDATION`

### getDeviceModel
Realizes: `getDeviceModel` (api-spec.yaml)
Authorize: any Admin
Rule: return the full detail of one model by `modelId`, including both screens and the logo.
Failures:
- model does not exist → `404` `NOT_FOUND`

### updateDeviceModel
Realizes: `updateDeviceModel` (api-spec.yaml)
Authorize: any Admin
Rule: update only the editable fields — `description`, `orientation`, primary screen,
secondary screen and `logoUrl`.
Edge cases:
- `modelName` (and `modelCode`) are immutable; any attempt to change them is ignored / rejected.
Failures:
- model does not exist → `404` `NOT_FOUND`

### deleteDeviceModel
Realizes: `deleteDeviceModel` (api-spec.yaml)
Authorize: any Admin
Rule: delete the model only when nothing depends on it.
Failures:
- a Device belongs to the model → `409` `RESOURCE_CONFLICT`
- a Firmware belongs to the model → `409` `RESOURCE_CONFLICT`
- model does not exist → `404` `NOT_FOUND`

## Derived values
- `DeviceModel.logos` = four sizes (140 / 70 / 55 / 35 px) derived from the uploaded
  140 × 140 master. When no logo is uploaded, a default logo keyed to `operatingSystem`
  is returned instead.

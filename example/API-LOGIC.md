# API\-LOGIC

# English Version

```Markdown
<!-- LOGIC — the non-trivial behavior behind this feature.
     Edit this worked example (leave-requests) in place, then strip the guidance comments.

     The file has one required section (## Operations) plus four OPTIONAL sections for logic
     that no single operation owns. Delete any optional section your feature doesn't use.
       ## Operations     — behavior keyed to an operationId from api-spec.yaml
       ## Shared rules   — a rule used by 2+ operations / jobs (referenced by name, not restated)
       ## Derived values — computed, non-stored fields returned in responses
       ## Scheduled jobs — logic triggered by time, not an API call (no operationId)
       ## Reactions      — side effects triggered by a state change / event

     Altitude: describe what & why, never control-flow mechanics. domain.md owns invariants
     and lifecycle states; logic.md owns the behavior (guards, effects, computations). -->

# Logic — leave-requests

How requests are submitted, decided, and maintained.
<!-- ^ one line: the non-trivial behavior behind this feature -->

## Operations
<!-- One subsection per operation with non-trivial behavior. Omit plain CRUD that
     api-spec.yaml already describes fully (e.g. listLeaveRequests has no subsection here —
     it is a plain list governed only by the [Visible scope] shared rule).
       Realizes  = the operationId join key (must exist in api-spec.yaml)
       Authorize = which Role / rule from domain.md may call this ("any authenticated" if open)
       Rule      = the business rule / computation, at altitude
       Sequence: = numbered steps; include ONLY when there is multi-step orchestration
       Failures  = condition → `status` `error code` from the spec; omit if only generic validation
       Edge cases: = rules the scenarios don't enumerate; omit if none -->

### createLeaveRequest
Realizes: `createLeaveRequest` (api-spec.yaml)
Authorize: any Employee; the request is created for the acting employee
Rule: create a LeaveRequest with `status = Submitted` and `workingDays` computed (see below).
Failures:
- `endDate` before `startDate` → `400` `VALIDATION`
- `Annual` request whose `workingDays` exceeds the employee's `leaveBalanceDays` → `422` `INSUFFICIENT_BALANCE`

### approveLeaveRequest
Realizes: `approveLeaveRequest` (api-spec.yaml)
Authorize: the acting Manager must manage the request's employee · applies [Visible scope]
Rule: transition `Submitted → Approved`, set `decidedBy` = acting user and `decidedAt` = now;
for `Annual` leave, deduct `workingDays` from the employee's `leaveBalanceDays`.
Failures:
- request is not `Submitted` → `409` `RESOURCE_CONFLICT`
- acting user is the request's employee → `403` `FORBIDDEN`

### rejectLeaveRequest
Realizes: `rejectLeaveRequest` (api-spec.yaml)
Authorize: the acting Manager must manage the request's employee · applies [Visible scope]
Rule: transition `Submitted → Rejected`, set `decidedBy` and `decidedAt`; no balance change.
Failures:
- request is not `Submitted` → `409` `RESOURCE_CONFLICT`
- acting user is the request's employee → `403` `FORBIDDEN`

### cancelLeaveRequest
Realizes: `cancelLeaveRequest` (api-spec.yaml)
Authorize: the request's own Employee · applies [Visible scope]
Rule: transition `Submitted → Cancelled`.
Failures:
- request is not `Submitted` → `409` `RESOURCE_CONFLICT`

## Shared rules
<!-- A rule used by 2+ operations (or jobs) WITHIN THIS SLUG. Reference it from those
     operations by name — `applies [<RuleName>]` — instead of restating it. Rules shared
     across the whole AREA live in the shared domain.md → Cross-cutting rules, not here.
     Omit the section if none. -->
### Visible scope
Rule: an Employee may act on only their own requests; a Manager may also act on their direct
reports' requests. A request outside the caller's scope is treated as not found
(`404` `NOT_FOUND`) rather than forbidden, so its existence isn't leaked.
Used by: `listLeaveRequests`, `approveLeaveRequest`, `rejectLeaveRequest`, `cancelLeaveRequest`

## Derived values
<!-- Computed, non-stored fields returned in responses. They appear in the api-spec.yaml
     schema (often readOnly) but are calculated, not persisted. Omit the section if none. -->
- `LeaveRequest.workingDays` = number of weekdays from `startDate` to `endDate` inclusive,
  excluding company holidays (returned on every LeaveRequest).

## Scheduled jobs
<!-- Logic triggered by time, not an API call — so there is no operationId. Identify it by
     name + a Trigger schedule. Omit the section if none.
       Trigger = when it runs (cron-like, plain language) -->
### Expire stale requests
Trigger: daily, 02:00 UTC
Rule: any request left `Submitted` for more than 14 days is transitioned to `Rejected` with
`decidedBy = system`.
Failures: best-effort; a failed run is retried on the next schedule.

## Reactions
<!-- Side effects triggered by a state change / event, not directly by the caller. Identify
     by name + a Trigger event. Omit the section if none.
       Trigger = the event that fires it (often "after <operationId> succeeds")
       Effect  = the observable side effect -->
### Notify on decision
Trigger: after `approveLeaveRequest` or `rejectLeaveRequest` succeeds
Effect: notify the requesting employee of the decision and the deciding manager.
Failures: best-effort; a failed notification does not roll back the decision.
```

# 中文版本

```Markdown
<!-- 逻辑 (LOGIC) — 此特性背后的非平凡（复杂）行为。
     请就地编辑此工作示例（leave-requests），然后删除这些指导性注释。

     该文件包含一个必需部分（## 操作）以及四个用于描述不属于任何单一操作的逻辑的可选部分。
     删除你的特性未使用的任何可选部分。
       ## 操作 (Operations)     — 绑定到 api-spec.yaml 中 operationId 的行为
       ## 共享规则 (Shared rules)   — 被 2 个或以上操作/任务使用的规则（通过名称引用，而非重复陈述）
       ## 派生值 (Derived values) — 在响应中返回的计算得出、未存储的字段
       ## 定时任务 (Scheduled jobs) — 由时间而非 API 调用触发的逻辑（无 operationId）
       ## 响应 (Reactions)      — 由状态变更/事件触发的副作用

     抽象层级：描述“做什么”和“为什么”，绝不涉及控制流机制。domain.md 负责不变量和生命周期状态；
     logic.md 负责行为（守卫条件、副作用、计算）。 -->

# 逻辑 (Logic) — leave-requests

申请如何被提交、审批和维护。
<!-- ^ 用一句话描述：此特性背后的非平凡（复杂）行为 -->

## 操作 (Operations)
<!-- 每个具有非平凡行为的操作包含一个子章节。省略 api-spec.yaml 已完全描述的普通 CRUD 
     （例如，listLeaveRequests 在此处没有子章节 — 它只是一个普通列表，仅受 [可见范围] 共享规则管辖）。
       实现 (Realizes)  = operationId 关联键（必须存在于 api-spec.yaml 中）
       授权 (Authorize) = domain.md 中允许调用此操作的 角色/规则（如果是开放的，则为“任何已认证用户”）
       规则 (Rule)      = 业务规则/计算，保持在较高的抽象层级
       顺序 (Sequence)  = 编号步骤；仅当存在多步编排时才包含
       失败情况 (Failures)  = 条件 → 规范中的 `status` 和 `error code`；如果只有通用验证则省略
       边缘情况 (Edge cases) = 场景 (scenarios) 未枚举的规则；如果没有则省略 -->

### createLeaveRequest
实现: `createLeaveRequest` (api-spec.yaml)
授权: 任何员工；该申请是为当前操作的员工创建的
规则: 创建一个 `LeaveRequest`，其 `status = Submitted`，并计算 `workingDays`（见下文）。
失败情况:
- `endDate` 早于 `startDate` → `400` `VALIDATION`
- `Annual` (年假) 申请的 `workingDays` 超过员工的 `leaveBalanceDays` → `422` `INSUFFICIENT_BALANCE`

### approveLeaveRequest
实现: `approveLeaveRequest` (api-spec.yaml)
授权: 当前操作的主管必须管理该申请的员工 · 适用 [可见范围 (Visible scope)]
规则: 状态流转 `Submitted → Approved`，设置 `decidedBy` = 当前操作用户 且 `decidedAt` = 当前时间；
对于 `Annual` (年假)，从员工的 `leaveBalanceDays` 中扣除 `workingDays`。
失败情况:
- 申请状态不是 `Submitted` → `409` `RESOURCE_CONFLICT`
- 当前操作用户是该申请的员工 → `403` `FORBIDDEN`

### rejectLeaveRequest
实现: `rejectLeaveRequest` (api-spec.yaml)
授权: 当前操作的主管必须管理该申请的员工 · 适用 [可见范围 (Visible scope)]
规则: 状态流转 `Submitted → Rejected`，设置 `decidedBy` 和 `decidedAt`；余额不变。
失败情况:
- 申请状态不是 `Submitted` → `409` `RESOURCE_CONFLICT`
- 当前操作用户是该申请的员工 → `403` `FORBIDDEN`

### cancelLeaveRequest
实现: `cancelLeaveRequest` (api-spec.yaml)
授权: 申请所属的员工本人 · 适用 [可见范围 (Visible scope)]
规则: 状态流转 `Submitted → Cancelled`。
失败情况:
- 申请状态不是 `Submitted` → `409` `RESOURCE_CONFLICT`

## 共享规则 (Shared rules)
<!-- 本特性标识符内 2 个或以上操作（或任务）使用的规则。通过名称引用它们 — `适用 [<RuleName>]` — 
     而不是重复陈述。整个领域 (AREA) 共享的规则位于共享的 domain.md → 横切规则 (Cross-cutting rules) 中，而非此处。
     如果没有，请省略此部分。 -->
### 可见范围 (Visible scope)
规则: 员工只能对自己的申请进行操作；主管也可以对其直属下属的申请进行操作。超出调用者范围的申请将被视为不存在（返回 `404` `NOT_FOUND`），而不是禁止访问，以免泄露其存在。
被以下操作使用: `listLeaveRequests`, `approveLeaveRequest`, `rejectLeaveRequest`, `cancelLeaveRequest`

## 派生值 (Derived values)
<!-- 在响应中返回的计算得出且未存储的字段。它们出现在 api-spec.yaml 模式中（通常为 readOnly），
     是计算得出的，而非持久化的。如果没有，请省略此部分。 -->
- `LeaveRequest.workingDays` = 从 `startDate` 到 `endDate`（含首尾）的工作日天数，排除公司节假日（在每个 `LeaveRequest` 中返回）。

## 定时任务 (Scheduled jobs)
<!-- 由时间而非 API 调用触发的逻辑 — 因此没有 operationId。通过名称 + 触发 (Trigger) 计划来标识它。
     如果没有，请省略此部分。
       触发条件 (Trigger) = 运行时间（类似 cron 的纯文本描述） -->
### 过期陈旧申请 (Expire stale requests)
触发条件: 每日 02:00 UTC
规则: 任何保持 `Submitted` 状态超过 14 天的申请，其状态将流转为 `Rejected`，且 `decidedBy = system`。
失败情况: 尽力而为 (best-effort)；失败的运行将在下一个调度周期重试。

## 响应 (Reactions)
<!-- 由状态变更/事件触发，而非由调用者直接触发的副作用。通过名称 + 触发 (Trigger) 事件来标识。
     如果没有，请省略此部分。
       触发条件 (Trigger) = 触发它的事件（通常是“在 <operationId> 成功后”）
       效果 (Effect)      = 可观察的副作用 -->
### 决策通知 (Notify on decision)
触发条件: 在 `approveLeaveRequest` 或 `rejectLeaveRequest` 成功后
效果: 通知申请员工该决策结果以及做出决策的主管。
失败情况: 尽力而为 (best-effort)；通知失败不会回滚该决策。
```


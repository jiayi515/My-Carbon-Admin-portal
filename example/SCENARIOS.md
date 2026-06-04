# SCENARIOS

# English Version

```Markdown
<!-- SCENARIOS — concrete acceptance examples.
     Edit this worked example (leave-requests) in place, then strip the guidance comments.
     Cover the happy paths and the key failures listed in api-logic.md. Assert outcomes the
     user can observe, not internal calls. -->

# Scenarios — leave-requests

Acceptance scenarios for submitting and deciding leave requests.
<!-- ^ one line: the acceptance scenarios for this feature -->

## Scenario: Employee submits a request
Exercises: `createLeaveRequest`
**Given** I am an Employee with 10 days of Annual balance
**When** I submit an Annual request for 3 working days
**Then** the request is created with status Submitted
**And** its workingDays is 3
<!-- Exercises = the operationId join key (omit only for cross-cutting scenarios)
     Given     = starting context, including the actor's role
     When      = the user action
     Then      = the user-observable outcome
     And       = further observable outcomes, one per line; omit if none -->

## Scenario: Request exceeding balance is refused
Exercises: `createLeaveRequest`
**Given** I am an Employee with 2 days of Annual balance
**When** I submit an Annual request for 5 working days
**Then** the request is refused for insufficient balance
**And** no request is created

## Scenario: Manager approves a report's request
Exercises: `approveLeaveRequest`
**Given** I am a Manager and a direct report has a Submitted request for 3 Annual days
**When** I approve the request
**Then** the request's status becomes Approved
**And** the report's Annual balance is reduced by 3 days
**And** the report is notified of the decision

## Scenario: Manager cannot approve their own request
Exercises: `approveLeaveRequest`
**Given** I am a Manager with my own Submitted request
**When** I try to approve it
**Then** the request is rejected as forbidden
**And** the request stays Submitted

## Scenario: Manager rejects a report's request
Exercises: `rejectLeaveRequest`
**Given** I am a Manager and a direct report has a Submitted request
**When** I reject the request with a reason
**Then** the request's status becomes Rejected
**And** the report is notified of the decision

## Scenario: Employee cancels their own request
Exercises: `cancelLeaveRequest`
**Given** I am an Employee with a Submitted request
**When** I cancel it
**Then** the request's status becomes Cancelled

## Scenario: Employee sees only their own requests
Exercises: `listLeaveRequests`
**Given** I am an Employee and another employee on a different team has a request
**When** I list leave requests
**Then** I see my own requests
**And** I do not see the other employee's request
```

# 中文版本

```Markdown
<!-- 场景 (SCENARIOS) — 具体的验收示例。
     请就地编辑此工作示例（leave-requests），然后删除这些指导性注释。
     覆盖 api-logic.md 中列出的正常路径和关键失败情况。断言用户可以观察到的结果，而不是内部调用。 -->

# 场景 (Scenarios) — leave-requests

提交和审批休假申请的验收场景。
<!-- ^ 用一句话描述：此特性的验收场景 -->

## 场景：员工提交申请
演练操作 (Exercises): `createLeaveRequest`
**假设 (Given)** 我是一名拥有 10 天年假余额的员工
**当 (When)** 我提交一个为期 3 个工作日的年假申请时
**那么 (Then)** 该申请被创建，且状态为“已提交 (Submitted)”
**并且 (And)** 其工作日天数 (workingDays) 为 3
<!-- 演练操作 (Exercises) = operationId 关联键（仅跨领域场景可省略）
     假设 (Given)     = 初始上下文，包括参与者的角色
     当 (When)      = 用户操作
     那么 (Then)      = 用户可观察到的结果
     并且 (And)       = 进一步的可观察结果，每行一个；如果没有则省略 -->

## 场景：超出余额的申请被拒绝
演练操作 (Exercises): `createLeaveRequest`
**假设 (Given)** 我是一名拥有 2 天年假余额的员工
**当 (When)** 我提交一个为期 5 个工作日的年假申请时
**那么 (Then)** 该申请因余额不足被拒绝
**并且 (And)** 没有创建任何申请

## 场景：主管批准下属的申请
演练操作 (Exercises): `approveLeaveRequest`
**假设 (Given)** 我是一名主管，且我的一名直属下属有一个为期 3 天的“已提交 (Submitted)”年假申请
**当 (When)** 我批准该申请时
**那么 (Then)** 该申请的状态变为“已批准 (Approved)”
**并且 (And)** 该下属的年假余额减少 3 天
**并且 (And)** 该下属会收到关于此决策的通知

## 场景：主管不能批准自己的申请
演练操作 (Exercises): `approveLeaveRequest`
**假设 (Given)** 我是一名主管，且我自己有一个“已提交 (Submitted)”的申请
**当 (When)** 我尝试批准它时
**那么 (Then)** 该申请因禁止访问 (FORBIDDEN) 被拒绝
**并且 (And)** 该申请保持“已提交 (Submitted)”状态

## 场景：主管拒绝下属的申请
演练操作 (Exercises): `rejectLeaveRequest`
**假设 (Given)** 我是一名主管，且我的一名直属下属有一个“已提交 (Submitted)”的申请
**当 (When)** 我附带理由拒绝该申请时
**那么 (Then)** 该申请的状态变为“已拒绝 (Rejected)”
**并且 (And)** 该下属会收到关于此决策的通知

## 场景：员工取消自己的申请
演练操作 (Exercises): `cancelLeaveRequest`
**假设 (Given)** 我是一名员工，且我有一个“已提交 (Submitted)”的申请
**当 (When)** 我取消该申请时
**那么 (Then)** 该申请的状态变为“已取消 (Cancelled)”

## 场景：员工只能看到自己的申请
演练操作 (Exercises): `listLeaveRequests`
**假设 (Given)** 我是一名员工，且另一个不同团队的员工有一个申请
**当 (When)** 我列出休假申请时
**那么 (Then)** 我只能看到自己的申请
**并且 (And)** 我看不到其他员工的申请
```


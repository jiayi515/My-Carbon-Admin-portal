# Carbon · 客户管理后台 — 产品规格说明（spec）

> 版本：v0.4（数据模型规范化版本；与 `data-tables.jsx` 9 表结构对齐）
> 范围：NPT 平台运营人员使用的 Carbon Admin 后台（非客户自助门户、非 ISV 发布门户、非 ISO 客户门户）。
> 唯一真源：本仓库内的 `.jsx` 设计稿 + 本 spec。`公共约束.md` 中与本稿冲突的内容以本稿为准。
> 设计系统：TOMS Design System。

> **v0.3 → v0.4 关键变更**：
> ① 客户 / NPT 统一为 `Entity` 表，Entity 无独立 status，状态完全由其 EntityContract 派生；
> ② Contract 升级为独立表 `EntityContract`，新增 `AUTHORIZING ENTITY ID`，区分 ADMIN 授权 / ISO 授权；
> ③ 新增 `EntityContractDelegation`（契约委托表）支持 ISO A 把 MERCHANT 运营权委托给 ISO B；
> ④ User / MFAInfo / EntityUserRelationship 三张表彻底拆开；
> ⑤ OperatorInvite 独立成表，token 默认 7 天有效；
> ⑥ 移除 `Acquirer` / `PayFac` 类型；保留 `ADMIN`。

---

## 0. 名词对齐

| 名词 | 含义 | 备注 |
|---|---|---|
| **NPT**（Newland Payment Technology） | 运营本后台的公司 | 在 `SEED_ENTITIES` 中是一条普通 Entity（`e-npt`），系统唯一持 `ADMIN` 契约 |
| **Carbon** | 平台产品名 | 本后台的对外品牌；面向 NPT 内部员工 |
| **TOMS** | 设计系统/UI Kit | 所有视觉元素遵循 `TOMS Design System` |
| **Entity（实体 / 公司）** | 系统内的所有公司主体 | NPT、ISO、ISV、Merchant 全部都是 Entity 表的一行，差别仅在持有哪种契约 |
| **Customer**（UI 称呼） | 通常指**非 NPT** 的 Entity | UI 列表里的 "Customer" 即 `SEED_ENTITIES` 排除 `e-npt` 的派生视图 |
| **Operator（操作员）** | 客户方雇员，登录 _客户门户_ 操作其自身业务 | 不在本后台登录；以 USER + EntityUserRelationship 形式存在 |
| **User（用户）** | 所有可登录人；含平台员工 + 客户操作员 | 一个 User 可通过多条 EntityUserRelationship 绑定到多个 Entity |
| **ISV / ISO / MERCHANT** | 三种客户契约类型 | 同一 Entity 可同时持有多种；状态独立 |
| **ADMIN** | 平台运营契约 | 系统**全局唯一**一份，由 NPT 自授权 |
| ~~Acquirer / PayFac~~ | **已移除** | v0.4 取消，不再保留 |

> seed 数据里 `signedBy` 写的是 `admin@carbon`，是历史遗留；线上员工邮箱域名等业务方未定（见 §7 Deferred）。

---

## 1. 背景与动机

### 1.1 业务背景
NPT 通过 Carbon 平台同时运营多种支付生态关系。签约对象（Customer）可以同时持有多种合同身份：

- **ISV** — 把 Carbon 能力集成进自己软件、转售支付服务的软件商。可在平台**发布 App**。
- **ISO** — 拉商户并赚取分润的销售组织。可**订阅 ISV 发布的 App**、向客户端对接支付，并通过客户门户向 NPT 升级 ticket。
- **Merchant** — 直签商户（直接和 NPT 签，没有中间 ISO/PayFac）。**注意：Merchant 没有独立的运营平台**，merchant 通常归属于 ISO；本后台只承认"直签 Merchant 合同"这种关系类型存在，但不为它提供面向 Merchant 的门户。

> Acquirer / PayFac 在数据模型里有定义，但当前**没有真实客户、没有角色定义、没有客户向导入口**。视为休眠类型，未来需要时再激活。

围绕这些客户，NPT 还要管：客户方操作员、样机订单与激活、ISV App 跨租户目录、ISO 升级上来的 ticket、平台员工自身的账号与角色、跨域审计与敏感字段访问。

### 1.2 当前问题
1. **运营面散落** — 客户档案、合同、操作员、订单、设备、ISV App、ISO ticket 分布多处。
2. **合同流程统一** — 已从客户端签署改为后台直接配置（见 §3.1）。
3. **权限模型分层不清** — 平台员工角色与客户操作员角色历史上混在一起；本设计稿**显式拆开**为 `System → Roles`（平台员工）与 `System → Customer Role Definitions`（客户操作员，按合同类型分桶）。
4. **敏感字段无管控** — 邮箱/电话/姓名需默认脱敏；reveal 必须写审计。
5. **设备激活链路无追踪**。
6. **ISO 现场问题升级无入口** — ISO 在客户门户报的 ticket 需要 NPT 工程接手并回传 ISO；本后台的 **Tickets** + **Workbench** 就是 NPT 这一侧。

### 1.3 目标
建立 NPT 平台内部运营后台，一站式完成：客户全生命周期、操作员邀请、样机订单全链路、ISV App 目录查看、ISO ticket 处理与设备级深度排障、平台员工账号管理、全局审计。

**不是给客户、ISV、ISO 用的。** 只服务 NPT 自己。

---

## 2. 用户与角色

### 2.1 使用本系统的人（NPT 雇员）

平台员工全部走 `ADMIN` 合同，在 `SEED_USERS` 里以 USER 记录存在，绑定到 `PLATFORM_ENTITY (NPT)`。

| 平台角色 | 来源 | 主要职责 |
|---|---|---|
| **Platform Administrator** | `r-admin-platform`（builtin） | 全控：管员工、改平台角色、API key、通知路由 |
| **Operations Admin** | `r-admin-ops` | 运营骨干：管员工 + 审计，不管 API key |
| **Platform Viewer** | `r-admin-viewer`（builtin） | 只读 |
| **NPT Support / Engineer**（业务身份） | 由 ADMIN 角色赋能 | 处理 ISO 升级的 ticket、跑 Workbench |
| （自定义 ADMIN 角色） | 由 Platform Administrator 创建 | 例如 `Compliance Reviewer` |

仓储/履约/计费/激活等是**外部系统**，以 `system` / `warehouse@carbon` 等 service account 写审计，不直接登录。

### 2.2 与本系统相关、但不在系统内的人

- **客户方操作员** — 在客户自助门户登录；本后台只发邀请、维护账号状态。
- **ISO 业务人员** — 在 ISO 客户门户登录、登 ticket、升级给 NPT；ticket 详情里以 `isoOwner` 显示，不登录 Carbon Admin。
- **ISV 开发者** — 在 ISV 发布门户操作 App；本后台只看跨租户聚合视图。
- **下游商户**（sub-merchant，归属于 ISO） — 不在本系统范围。

### 2.3 权限模型

**两套角色，互不混用：**

1. **System → Roles**（`admin-roles`） — NPT 员工角色。`contractDefineCode = 'ADMIN'`。
2. **System → Customer Role Definitions**（`customer-roles`） — 客户操作员角色。按合同类型分 Tab：
   - **Common** — `contractDefineCode = null`。这是 ISV/ISO 共有权限的抽象层（如 user 管理等通用功能）。
   - **ISV** — 仅分配给持 ISV 合同的客户操作员。
   - **ISO** — 仅分配给持 ISO 合同的客户操作员。
   - **Merchant** — 仅分配给持 Merchant 合同的客户操作员。
   - Acquirer / PayFac Tab **当前不开放**（无对应角色）。

**Common × 合同类型的合并规则**：一个客户操作员在某客户下的实际能力 = `Common 角色权限` ∪ `该客户合同类型对应角色的权限`。
例：客户仅持 ISV 合同，则其操作员可被赋 Common 角色 + ISV 角色，最终能力 = Common 权限 + ISV 权限。

**权限点（Permission）系统预置，不可在 UI 新增**。命名约定 `<域>.<对象>.<动作>`，全小写点分：

- 客户域：`cust.view` / `cust.edit` / `cust.create` / `cust.lock` / `cust.delete`
  - `cust.lock` ≡ 旧约束的 `cust.suspend`（语义等价，保留 `cust.lock` 这一命名）
- 合同：`ctr.view` / `ctr.add` / `ctr.sign` / `ctr.terminate`
- 操作员：`op.view` / `op.invite` / `op.role` / `op.lock` / `op.mfa` / `op.remove`
- 数据/审计：`data.reveal` / `data.export` / `audit.view`
- 系统/ADMIN 专属：`sys.users.*` / `sys.roles.*` / `sys.notify` / `sys.keys`
- ISV 专属：`isv.sandbox.access` / `isv.app.publish` / `isv.app.metrics`
- ISO 专属：见 `data.jsx` `iso.*` 命名空间

> **当前 mock 权限目录不完整**。例如 Sample Orders / Device Models / Devices / Tickets / Workbench / Apps 等菜单的对应权限点（应当在 `sys.*` 或自有命名空间下）尚未补齐。后续扩充原则：**每个菜单/功能都应在 System → Roles 的权限目录中有对应权限点**，由 Platform Administrator 在 ADMIN 角色里勾选。

---

## 3. 核心用户流程

> 路径名后括号内是 `app.jsx` 中的路由名。

### 3.1 客户全生命周期（Customers）

#### 3.1.1 新建客户向导（`new` → `detail`）
三步：
1. **Step 1 · Company** — 公司名、Country、Address、Phone（区号 + 本地号码）、Email、可选 License。前端校验邮箱与电话格式。
2. **Step 2 · Contracts** — 勾选合同类型；**当前 UI 仅暴露 ISV 与 ISO 两种**。Merchant 合同需要通过客户详情 Contracts tab → "Add contract" 后续追加。
3. **Step 3 · Done** — 显示新建结果，引导跳转客户详情的 Operators tab 邀请首位操作员。

新客户初始 `status = 'Onboarding'`。**当首位操作员接受邀请后**自动转 `Active`（详见 §3.2）。

#### 3.1.2 客户列表（`list`）
- 表格 + 搜索 + 两组筛选：**Contract Type**（多选）+ **Contract Status**（多选）。**没有总的 Active/Onboarding 单维状态筛选**。
- 每行：公司名、Country 旗、**契约状态 chip 集合**（每个契约一颗：`[ISO ●ACTIVE][ISV ◌PENDING][MERCHANT ⏸SUSPENDED]`），操作员数、注册时间。
- 派生 "Onboarding/Active/Locked" 视情况展示：
  - 派生 Locked = 所有 live 契约（非 TERMINATED）都为 SUSPENDED → 显示 LOCKED 标记
  - 派生 Onboarding = 所有 live 契约都 PENDING，或存在 ACTIVE 契约但还没有任何已激活操作员
  - 其余 → 派生 Active
- 状态点配色：`●ACTIVE` 绿、`◌PENDING` 灰、`⏸SUSPENDED` 琥珀、`✕TERMINATED` 浅灰删除线（默认列表不展示 TERMINATED，可通过筛选打开）。

#### 3.1.3 客户详情（`detail`）
顶部：
- 公司名右侧不再有单枚 "Active/Onboarding" pill；改为一排契约-状态 chip（同列表），由 EntityContract.status 派生。
- 编辑公司信息、Suspend all（批量 SUSPEND 所有 live 契约）等动作。

Tab 组织：
- **Overview** — 公司信息（可编辑：name / contactName / phoneCountryCode / phone / timezone / license / tags / remark），统计 tile（live 契约数 / 操作员数 / 最近活动）。
- **Contracts** — 契约卡片列表（每张卡按 EntityContract 渲染）：
  - 顶部：契约类型 + 当前 status + Authorizing Entity（NPT / 某 ISO 名）
  - 元数据：Authorized At、Effective From / To、Terminated By / At（若有）
  - **Entitlements 摘要**（按类型不同呈现：ISO/MERCHANT 显示 deviceModels chips + 增值功能开关 + 月费；ISV/ADMIN 不显示）
  - 行动：**Suspend / Resume / Terminate**（按当前 status 显示合法转换）
  - **"Add contract"** 按钮无审批流、无重新认证、点击即生效（写 `contract+` 审计事件）。终止合同需理由（写 `contract-` 审计事件 + 设置 `terminatedByEntityId` / `terminatedAt`）。
  - **"Delegate operations"**（仅 MERCHANT 类型契约可见）—— 触发 `ctr.delegate` 权限，写入一条 `EntityContractDelegation` 记录。
- **Operators** — 客户方操作员 + 未消费的邀请：
  - 顶部 "Pending invites (N)" 段：来自 `OperatorInvite WHERE entityId=X AND consumedAt IS NULL`，操作 Resend / Revoke / Copy link
  - 主表：来自 `EntityUserRelationship × User` join；动作：改角色（多选）、锁定 / 解锁、重置 MFA、删除
- **Orders** — 该 Entity 名下样机订单（反向引用）。
- **Events / Audit** — 审计流。

敏感字段（email / phone / 操作员姓名）默认按 §4.3 脱敏。点击 reveal 按钮**逐字段**解码、记 `reveal` 审计事件、并 toast 提示"已记入审计"。

#### 3.1.4 客户锁定 / 解锁 → **按契约逐份 Suspend / Resume**
- 不再有 "整客户级别" 的 `locked` 字段；锁定动作下沉到契约。
- 由有 `cust.lock` 权限的平台员工触发：选中某条 EntityContract → Suspend；EntityContract.status 转 `SUSPENDED`，写 `warn` 事件（`contract.suspend`）。
- 客户详情 Contracts Tab 顶部提供 **"Suspend all contracts"** 一键按钮，等价于对所有 ACTIVE 契约批量 SUSPEND。UI 派生 `locked = (所有 live 契约 == SUSPENDED)` 时显示原本的 LOCKED 红色 banner。
- **SUSPEND 的副作用**：
  - 该契约下的所有 EntityUserRelationship 立即被网关侧拒绝（由门户侧实现，本后台只产生状态变更）。
  - 该 Entity 名下、由该契约产生的未消费邀请链接立即失效（onboarding `invalid` 终态）。
  - **在途订单继续推进**（不冻结、不取消）。

---

### 3.2 操作员邀请 → 接受

#### 3.2.1 邀请（在客户详情 Operators tab）

支持两种邀请方式：

| 方式 | 受邀邮箱 | Operators 列表表现 |
|---|---|---|
| **Email invite** | 必填 | 立即新增一条记录：`email = <受邀邮箱>` / `pending = true` / `status = 'PENDING'` / `invitedAt` / `invitedBy` / `inviteExpiresAt` / `inviteToken`；同时通过通知中心发送含链接 + QR 的邮件 |
| **Copy link** | 留空 | 仍新增一条记录，但 `email = null`；其它字段同上。这条记录代表"邀请链接已生成，但发往谁未知"，便于审计与追踪 |

两种方式都会生成同一份 `inviteToken` + QR 二维码 + `inviteExpiresAt`（默认 7 天）。

邀请录入时同时选择角色（可多选，必须来自 §2.3 中适用的角色集合，即 Common + 该客户合同类型对应的角色）。`Operator.roleIds` 是 `string[]`，**支持多角色，权限合并**。

#### 3.2.2 受邀人点击链接 → Onboarding takeover（`onboard`）
全屏接管（顶栏仅保留 TOMS / Carbon · Admin 标识 + Exit demo）。状态机：

```
landing ┬─ 当前设备已有会话（currentUser）
        │      ├─ "用当前账号加入" → confirm → welcome
        │      └─ "用别的账号"     → signin → confirm → welcome
        └─ 当前设备未登录
               ├─ "登录已有账号"   → signin → confirm → welcome
               └─ "注册新账号"     → register（邮箱 → 密码 → 国家 → 显示名）→ confirm → welcome
```

`invalid` 终态触发条件（任一）：
- 邀请链接已失效（过期）
- token 不存在
- 邀请已被接受过（重复打开）
- **所属客户已被 `locked`**

接受后的字段写入：
- `status: 'ACTIVE'`，`pending: false`
- `loginName` / `displayName` / `country`
- `acceptedAt` / `acceptedVia: 'existing' | 'registered'`
- `lastLoginAt`（即时）
- 注册路径下还要写 `passwordUpdatedAt` / `passwordChangedTimestamp` / `passwordChangeTimes: 1`

**接受的第一封邀请会触发客户 `Onboarding → Active`**。

#### 3.2.3 操作员日常运维
- 锁定 / 解锁（写 `operator.locked` 通知）
- 重置 MFA（写 `operator.mfa_reset` 通知）
- 改角色（受 `op.role` 控制；可多选）
- 删除（受 `op.remove` 控制）

---

### 3.3 样机订单与设备激活（Devices section）

Sidebar 的 **Devices** 父菜单展开三个子页：

- **Sample Orders** — 订单 CRUD
- **Device Models** — 产品目录
- **Devices** — 全平台设备 fleet 视图，由外部模块嵌入

**"样机" 语义说明**：`Sample Orders` 中的设备是 **开发机**（dev sample），与生产机器是两套货流；不是正式销售订单的子集，也不是免费赠送。

#### 3.3.1 设备型号目录（`models`）
- 字段：`name` / `family` / `desc` / `unitPrice`（USD） / `types`（`Semi-integration` / `Stand-alone`） / `os`（`ANDROID` / `LINUX` / `RTOS`） / `orientation`（`Portrait` / `Landscape`） / `primary` 屏 / 可选 `secondary` 屏 / `image`。
- 列表页头部 KPI tile：All / Android / Linux / RTOS。
- 编辑权限点尚未在 mock 目录中铺齐，应由 Platform Administrator 在 ADMIN 角色权限中配置（参考 §2.3 注解）。

#### 3.3.2 新建样机订单（`order-new`）
向导：选客户 → 加行项（型号、数量、`type`） → **整单折扣（默认 0%，0–100% 可调）** + 收货信息 → 备注 → 确认。

- **折扣权限**：拥有 create order 能力的员工即可设折扣，无需独立审批，无额外审计（仅当 `discountPct = 100` 时多一条 `free` 事件）。
- 提交后 `status = 'Awaiting payment'`。`discountPct = 100` 跳过付款，直接 `'Awaiting shipment'` 并写 `free` 事件。

#### 3.3.3 订单状态机
合法状态枚举：

```
'Awaiting payment'  →  'Awaiting shipment'  →  'Shipped'  →  'Complete'
                                       │
                                       └→ 'Partially complete'  →  'Complete'
```

状态推进：
- `paid`（计费系统回调）或 `discountPct = 100` → `Awaiting shipment`
- 全部行项激活 + 全部行项发货 → `Shipped`
- 部分行项发货 → `Partially complete`
- `deliver`（履约回调）→ `Complete`

**当前不支持取消订单**（无 `Cancelled` 状态）。

#### 3.3.4 订单详情（`order`）
- 摘要、行项表（含每行设备 SN + 6 位激活码）、收货信息、事件流。
- 操作：发起发货 / 部分发货 / 补录设备 `(sn, code)`。
- **每发一行写一条独立的 `ship` 事件**（不合并），便于 timeline 颗粒度还原。

#### 3.3.5 设备激活码
- 每台设备开机展示**且仅展示一次** 6 位激活码，与 SN 一对一记录。
- **激活码默认有效期 5 分钟**；过期未激活则**自动重新生成**（旧码作废，新码继续 6 位）。
- 行项的设备数组可少于 `qty`（"待激活"占位）。

设备派生状态：
| 派生状态 | 条件 |
|---|---|
| `Pending activation` | `sn` 或 `code` 为空，或 `code.length !== 6` |
| `Activated · in warehouse` | 已激活但未发货 |
| `Deployed` | 已激活且（订单 ∈ `Shipped`/`Complete` 或 行项 `shipped = true`） |

#### 3.3.6 设备 Fleet 视图
跨订单的全平台设备列表 + 详情，由外部 Carbon Devices 模块提供，通过 `window.__navigate` 桥接本后台路由。

---

### 3.4 应用目录（Apps，跨 ISV 视图）

NPT 看 ISV 们发布的全部 App，**完全只读**。

- **不能**新建 / 上传 / 上下架 / 切换发布模式
- **不能**强制下架（无该能力）
- **没有** "New app" / "Force unpublish" 等动作按钮

列表（`apps`）：搜索 + KPI tile（总数 / Published / Unpublished / 发布商数） + 4 维筛选：
- Publisher（ISV 客户） — 动态选项
- Status — `published` / `unpublished`
- Mode — `public`（All ISOs） / `private`（Specified ISOs）
- Category — 来自 `APP_CATEGORIES`

详情 Tab：**Overview** / **Versions** / **Subscribers**（订阅该 App 的 **ISO 客户**列表 —— Merchant 不能订阅，因为不存在 Merchant 平台） / **Activity**。

Publisher 客户被 `locked = true` 时，列表行 Publisher 列附 `LOCKED` chip。

---

### 3.5 工单 · Tickets（Support 区）

Sidebar 顶级菜单 **Support → Tickets**（`tickets` / `ticket`） + 全屏 **Workbench**（`workbench`）。

**Tickets 菜单只处理来自 ISO 客户门户升级上来的工单。NPT 不在本系统主动新建工单 ——「New ticket」按钮不存在，所有 ticket 的 origin 均为 `iso-escalated`。**

> 设计稿中 `app.jsx` 有 `ticket-new` 路由与 `TicketNew` 组件，`tickets.jsx` seed 也有 `npt-internal` 工单数据，**均视为遗留**，在本规格中标记为应当移除。

#### 3.5.1 工单字段（来自 `SEED_TICKETS`，剔除 npt-internal 后）

| 字段 | 取值 |
|---|---|
| `id` | `T-YYYY-NNNN` |
| `origin` | 仅 `iso-escalated` |
| `source` | `auto`（云端自动 e.g. integrity check 失败）/ `manual`（ISO 手动登的） |
| `type` | `Payment Failure` / `Network Issue` / `Hardware` / `App Crash` / `Security Alert` / `Activation` / `Other` |
| `severity` | `low` / `med` / `high` / `critical` |
| `status` | `new` / `iso-working` / `npt-working` / `npt-resolved` / `closed` |
| `customerId` | 关联 ISO 客户，非空 |
| `deviceSn` / `deviceModel` | 可空（type 为非硬件相关时） |
| `isoOwner` | ISO 侧 case owner 姓名 |
| `nptHandler` | NPT 当前 handler 姓名 或 `'NPT queue'` |
| `grants` | ISO 授予 NPT 的访问范围：`{ snapshot, logs, liveProbe, remoteDesktop }` |
| `solution` | 已回 ISO 时存在：`{ rootCause, summary, steps, sentAt, sentBy }` |
| `timeline` | `[{ at, actor, kind, note }]`，kind ∈ `created` / `status` / `comment` / `escalation` / `resolution` / `workbench` |
| `comments` | `[{ at, actor, body }]`，actor 后缀 `(ISO)` 或 `(NPT)` |

#### 3.5.2 列表页（`tickets`）
- 顶部 tabs：**Mine**（`nptHandler === 当前 NPT 用户`） / **All**。
- 过滤器：搜索（ID / 标题 / 设备 SN / 客户） + Status（默认 "Open only"） + Type + Severity。
  - **不再有 Origin 过滤器**（origin 永远是 iso-escalated）。
- 表格列：ID · Source（Auto/Manual chip） · Title（含客户 + 设备 SN） · Type · Sev · Status · NPT handler · Updated · `›`。
- 排序：先按 `TKT_STATUS_ORDER`，再按 `updatedAt` desc。
- **页面右上无 "New ticket" 按钮**。

#### 3.5.3 详情页（`ticket`）
- 顶部：ID 大字 + chip 行（Source / Type / Severity / Status） + 标题 + meta（客户 / 设备 SN / created / updated）。
- **Stepper**：固定 4 步 — New → Working → Replied → Closed；`Working` 步上挂当前 ISO/NPT 角色徽章。
- 主体两列：
  - 左：**Description** / **Solution sent to ISO**（已 Reply 后出现，蓝色高亮） / **Comments**（ISO 与 NPT 用不同色 chip 区分）。
  - 右：**Context**（客户卡 + 设备卡） / **Handlers**（NPT / ISO / Reporter） / **NPT access grants** / **Activity**（timeline）。
- 顶部 action 按钮按状态动态显示：
  - `Open workbench`（有 `deviceSn` 时）
  - `Take from queue`（`nptHandler === 'NPT queue'` 时）
  - `Reassign`（已是 mine 时）— 弹窗可选 NPT 同事或 "Back to NPT queue"
  - `Reply to ISO`（mine + `npt-working`）— 弹窗收 `rootCause`（可选） + `summary`（必填） + `steps`（可选）
  - `Close ticket`（mine + 已 Reply 或 working 中）
  - `Reopen`（已 closed 时） — 回到 `npt-working`

> NPT 队列分配为 **先到先抢**（手动 Take from queue），无按 type/severity 自动路由。

#### 3.5.4 Workbench 全屏接管（`workbench`）

打开方式：ticket 详情右上 `Open workbench`（要求 ticket 关联具体 `deviceSn`）。接管整个 viewport（无 sidebar / topbar）。

布局：
```
┌── 顶部上下文条（设备 + 客户 + ticket 摘要） ──────────────┐
├── Tab 栏 ── Trouble | Monitoring ── [Sidebar 折叠按钮] ──┤
├─────────────────────────────────────┬───────────────────┤
│   Tab body                          │  Ticket context    │
│   • 顶部 action 按钮行              │  + records         │
│   • Tool slide-over drawer 覆盖     │  (可折叠)          │
└─────────────────────────────────────┴───────────────────┘
```

- **Trouble** Tab — Trouble log（罐头）+ Live log 子 tab；右侧搜索 + level 过滤。
- **Monitoring** Tab — 设备实时快照（runtime / network / security / system）+ **工具行**：
  - Pull logs — 拉云
  - File pull — 拉设备上的文件/目录
  - Hardware diag — 硬件自检
  - Remote desk — 实时远程桌面
  - Reboot device — 重启
  - Factory reset — 危险，破坏性
- 工具点击后是 slide-over 抽屉，不是新页面。
- **所有工具执行无须二次确认 / reason 输入**（含 Factory reset 与 Reboot），因 timeline 已留痕（`kind: 'workbench'`）。高危协调走线下沟通，本系统不强制双人审批。
- ISO 侧 `grants` 决定哪些工具可点（无 `remoteDesktop` 授权时 Remote desk 不可用，等等）。
- 关闭 Workbench 回到对应 ticket 详情。

---

### 3.6 系统配置（System）

| 子页 | 路由 | 用途 |
|---|---|---|
| **Roles** | `admin-roles` | 平台员工角色（ADMIN 合同） |
| **Users** | `admin-users` | 平台员工账号（USER 表） + 邀请 / 锁定 / 解锁 |
| **Customer Role Definitions** | `customer-roles` | 客户操作员角色（3 Tab：Common / ISV / ISO；Merchant Tab 视实际使用决定是否启用） |
| **Audit Logs** | `audit` | 跨 scope 审计聚合查询 |

平台员工状态：`ACTIVE` / `LOCKED` / `PENDING`。
- `LOCKED` 可来自连续登录失败（`passwordErrorLockExpiredTimestamp` 自动解锁时点）或人工锁定。
- `PENDING` 表示邀请未被接受。

---

### 3.7 全局横切

- **⌘K / Ctrl+K** — `CommandPalette`：快速搜客户 / 订单 / 跳路由。
- **⌘L / Ctrl+L** — `LockScreen`：锁屏遮罩。
- **Sidebar 底部用户卡** — Profile / 账号安全 / Workspaces / 我的活动 / 帮助 / 反馈 / 主题 / 语言 / Sign out。
- **Toast** — 全局右下。
- **Tweaks 面板** — 仅 demo 暴露，正式上线不出现。
- **路由桥 `window.__navigate`** — 给嵌入的 Devices 模块用。

---

## 4. 状态与数据

### 4.1 主要实体与关系（9 张表）

```
Entity    1─*  EntityContract         （每条契约独立 status；支持多类型同时持有）
Entity    1─*  EntityUserRelationship  （多对多 with User；authorizingType ∈ ADMIN/NORMAL）
Entity    1─*  Order                  （样机 / 开发机订单；customerId 字段指向 Entity）
EntityContract  1─*  EntityContractDelegation  （仅 MERCHANT 契约可被委托；禁止再委托）
EntityRoleBlocklist  ─→  Entity + ContractType + Role  （角色黑名单 unique）
User      1─*  EntityUserRelationship  （一名 User 可绑多个 Entity）
User      1─0..1  MFAInfo            （TOTP secret + 失败计数）
User      1─*  OperatorInvite (consumedAt 写回后)
Order     1─*  OrderItem 1─* Device   （行项可少录设备 → "待激活"占位）
OrderItem ─→  DeviceModel
App       ─→  Entity (publisherCustomerId)   — 发布商必须持 ISV 契约
App       1─* Entity (subscriberCustomerIds[]) — 订阅商只能是持 ISO 契约的 Entity
Role      1─*  EntityUserRelationship.roleIds  — 多角色权限合并
Ticket    ─→  Entity (ISO) / Device         — origin 恒为 iso-escalated
Ticket    1─*  TimelineEvent / Comment
*         1─*  AuditEvent     — scope ∈ entity | contract | delegation | role | user | order | system | ticket
```

### 4.2 关键状态机

| 实体 | 状态枚举 |
|---|---|
| **Entity** | **无独立 status 字段**；UI 派生 `Onboarding/Active/Locked` 时按 §3.1.2 规则计算 |
| **EntityContract.status** | `PENDING` → `ACTIVE` ↔ `SUSPENDED` → `TERMINATED`（终态）；每份契约独立 |
| **EntityContractDelegation.status** | `PENDING` / `ACTIVE` / `SUSPENDED` / `TERMINATED` |
| **EntityUserRelationship.status** | `ACTIVE` / `EXPIRED` / `LOCKED`（**无 PENDING**） |
| **User.status** | `ACTIVE` / `LOCKED`（**无 PENDING**：未消费邀请仅在 OperatorInvite 表里） |
| **MFAInfo.status** | `1` ENABLE / `0` DISABLE / `2` PENDING_ACTIVE |
| **OperatorInvite** | 派生：未到期 + `consumedAt = null` → outstanding；过期 / 已消费分别处理 |
| **Order.status** | `Awaiting payment` → `Awaiting shipment` → `Shipped` / `Partially complete` → `Complete`（**无 Cancelled**） |
| **Device** (派生) | `Pending activation` / `Activated · in warehouse` / `Deployed` |
| **App.status** | `published` / `unpublished` |
| **App.publishMode** | `public`（All ISOs）/ `private`（Specified ISOs） |
| **AppVersion.status** | `published` / `unpublished` |
| **AppVersion.scan** | `clean` / `cleanish` / `dirty` / `null` |
| **Ticket.status** | `new` / `iso-working` / `npt-working` / `npt-resolved` / `closed` |

### 4.3 敏感字段脱敏规则
- 默认对 **email / phone / 操作员姓名** 脱敏（前端 UI 层；跨系统传输仍明文）。
- 逐字段 reveal：
  - 触发 `data.reveal` 权限检查
  - 写一条 `kind: 'reveal'` 审计事件
  - 前端 toast 提示"已记入审计"
  - 触发 `data.revealed` 通知给含 `data.reveal` 或 `audit.view` 的角色（站内信）
- **Reveal 后不自动重新脱敏**；但**关页 / 刷新即重新脱敏**（reveal 状态只存内存，不持久化）。
- CSV 导出受 `data.export` 控制，**默认脱敏导出**。
- **不按客户 country 区分脱敏严格度**（欧盟客户与其它一视同仁）。

### 4.4 金额计算
- `subtotal = Σ unitPrice × qty`
- `total = round(subtotal × (1 - discountPct/100), 2)`
- 货币固定 USD，前端 `en-US` `Intl.NumberFormat`。

### 4.5 审计事件统一结构
`{ id, scope, scopeId, at, by, kind, text, meta? }`

已使用的 `kind` 取值：

| Scope | kind 取值 |
|---|---|
| customer | `created` / `contract+` / `contract✓` / `contract-` / `operator+` / `info` / `reveal` / `warn` |
| order | `created` / `invoice` / `paid` / `free` / `activate` / `ship`（每行一条） / `deliver` |
| ticket | `created` / `status` / `comment` / `escalation` / `resolution` / `workbench` |
| role / system | 由 `sys.*` 操作驱动 |

审计日志的保留期 / 冷存 / WORM 策略由数据库侧负责，前端只负责展示。

### 4.6 与外部系统的事件
- 本系统**只产生** `NotificationEvent`，**不派发**。具体 topic + payload + audience schema 参考 `公共约束.md` §3.1 + §4.4。
- 通知中心 / Webhook 鉴权 / IAM 同步策略当前**待定**（见 §7 Deferred）。
- 已知 inbound 回调：
  - 计费系统 → `paid`
  - 履约系统 → `ship` / `deliver` / `tracking`
  - 设备激活服务 → `(sn, code, activatedAt)`

---

## 5. 明确不做的事

为避免范围蔓延，下列内容**不在本项目范围内**：

1. **客户自助门户** — 客户方 Operator 自己看订单/合同/设备的界面，独立项目。
2. **ISO 客户门户** — ISO 自己登 ticket、看分润、找 NPT 升级的入口，独立项目。ticket `origin: iso-escalated` 就是从那里来的。
3. **ISV 发布门户** — App 创作 / 版本上传 / 上下架，独立项目。本后台只读。
4. **Merchant 自营门户** — 不存在。Merchant 是直签关系，无独立门户。
5. **通知中心 / 派发执行** — 本系统只 emit 事件，由独立通知中心订阅 webhook 实际派发。
6. **计费 / 发票生成** — 计费系统负责；本系统接 `invoice` / `paid` 回调。
7. **履约 / 仓储** — 履约系统负责；本系统接 `ship` / `deliver` / `tracking` 回调。
8. **设备激活服务本体** — 独立服务负责；本系统接 `(sn, code, activatedAt)` 回写。
9. **IAM / SSO** — 登录、MFA secret 存放、密码哈希、SSO 协商由 IAM 服务承担。
10. **合同模板的客户端签署** — 已废弃。所有合同后台直接配置。
11. **下游商户（sub-merchant）管理** — sub-merchant 归属于 ISO，不在本系统视野。
12. **NPT 在本系统创建 / 上下架 / 强制下架 App** — Apps 模块对本系统**完全只读**。
13. **取消订单** — 当前不支持，无 `Cancelled` 状态；如未来需要再补。
14. **NPT 主动新建 ticket** — Tickets 菜单**无 New ticket 按钮**，只处理 ISO 升级来的工单。
15. **Acquirer / PayFac 客户与角色** — 数据模型保留，UI 当前不开放。
16. **Workbench 操作的二次确认 / 双人审批** — 不实现；timeline 留痕即可，线下沟通处理。
17. **设折扣的独立审批** — 不实现，create order 权限即含折扣权限。
18. **客户 country 差异化合规策略**（EU vs. 其它） — 不区分。
19. **多币种** — v1 仅 USD。
20. **跨平台移动端** — v1 仅 Web 桌面端，最小布局宽 1280px。
21. **权限项动态新增** — Permission 集合系统预置且固定。

---

## 6. 验收标准

### 6.1 客户与契约
- [ ] 3 步向导可创建 Entity + 首份契约；提交后契约初始 `status = ACTIVE`（NPT 直接配置）或 `PENDING`（等待首位 Admin 接受）。
- [ ] 向导 Step 2 当前 UI 仅 ISV / ISO 两类契约；MERCHANT 通过详情 Contracts tab → "Add contract" 追加（且 authorizing entity 必须是持 ACTIVE ISO 契约的实体）。
- [ ] "Add contract" 入口无审批 / 无重新认证，点击即生效，写 `contract+` 审计事件。
- [ ] **客户列表与详情按契约渲染状态 chip**（不是单一 Active/Onboarding pill）。
- [ ] 派生 Locked（所有 live 契约都 SUSPENDED）时 UI 显示 LOCKED 红 banner。
- [ ] 某契约 SUSPEND 后：（a）该契约范围内的 Operator 无法操作；（b）该契约下未消费的邀请链接立即失效；（c）在途订单不受影响。
- [ ] 契约终止需理由，写 `contract-` 审计事件 + 设置 `terminatedByEntityId` / `terminatedAt`。
- [ ] 同一 Entity 可同时持有多类型契约，互不互斥；各自独立 status。
- [ ] **MERCHANT 契约**只允许由 ACTIVE ISO 实体授权（向导校验 + 后端约束）。
- [ ] **ADMIN 契约**全系统唯一（NPT 自授权），向导中不可创建。
- [ ] System → Roles 仅显示 ADMIN-contract 角色；Customer Role Definitions 仅显示客户操作员角色。

### 6.2 操作员邀请
- [ ] Email invite 与 Copy link 两种方式都立即在 Operators 列表新增一条记录；Copy link 路径下 `email` 字段为空。
- [ ] 邀请生成 `inviteToken` + QR + `inviteExpiresAt`（默认 7 天）。
- [ ] 邀请录入时可一次选多个角色，`Operator.roleIds` 是 `string[]`。
- [ ] 邀请链接打开后按"是否已有会话 × 是否已注册"四分支正确路由。
- [ ] 失效 / 不存在 / 已被接受 / 客户已锁定 → invalid 终态。
- [ ] 接受后字段写入正确（详见 §3.2.2）；首位 Operator 接受后客户 `Onboarding → Active`。

### 6.3 角色与权限
- [ ] Customer Role Definitions Tab 仅显示 Common / ISV / ISO / (Merchant，可选)；不显示 Acquirer / PayFac。
- [ ] Operator 实际权限 = Common 角色权限 ∪ 该客户合同对应角色权限（多角色合并）。
- [ ] 内置角色（`builtin: true`）不可删 / 不可改名。
- [ ] 权限点不可在 UI 新增（无 "+ New permission" 按钮）。

### 6.4 订单与设备
- [ ] 订单状态机严格按 §3.3.3 流转；非法跃迁拒绝。
- [ ] 折扣默认 0%，0–100% 可调；`discountPct = 100` 写 `free` 事件并跳过付款。
- [ ] 部分发货时**每发一行写一条 `ship` 事件**，不合并。
- [ ] 设备激活码恰好 6 位；**有效期 5 分钟**；过期未激活则**自动重新生成**新码，旧码作废。
- [ ] 行项支持部分发货（`item.shipped`），订单整体进 `Partially complete`，全部发货后转 `Shipped` → `Complete`。
- [ ] 设备派生状态符合 §3.3.5。
- [ ] Device Models KPI tile 可点击作为筛选，按 `os` 分组准确。

### 6.5 Apps（跨 ISV 视图）
- [ ] 列表跨 ISV 显示全部 App；4 维筛选（Publisher / Status / Mode / Category）均生效。
- [ ] 详情 4 Tab（Overview / Versions / Subscribers / Activity）齐全。
- [ ] Publisher 客户被 `locked = true` 时，列表行显示 LOCKED chip。
- [ ] NPT 在本系统**完全只读** — 无新建、无上传、无上下架、无强制下架按钮。
- [ ] Subscribers 列表仅显示 ISO 类客户。

### 6.6 Tickets / Workbench
- [ ] Tickets 列表页**无 "New ticket" 按钮**；侧边栏无 `ticket-new` 入口。
- [ ] 所有工单 `origin = iso-escalated`；Stepper 固定 4 步。
- [ ] `Working` 步上挂正确的 ISO/NPT 角色徽章。
- [ ] `Reply to ISO`：mine + `npt-working` 时可见；弹窗收 `rootCause` / `summary` / `steps`；提交后写 `resolution` timeline + 自动 echo NPT 注释 + `status → npt-resolved`。
- [ ] `Take from queue`：仅 `nptHandler === 'NPT queue'` 时出现，先到先抢，无自动路由。
- [ ] `Reassign` 弹窗包含 NPT 同事 + "Back to NPT queue"。
- [ ] `Close`：mine + 已 Reply 或 working 中 可关。
- [ ] `Reopen`：closed 工单退回 `npt-working`，可填可选 reason。
- [ ] Workbench 仅在 ticket 关联具体 `deviceSn` 时可开；接管整个 viewport。
- [ ] Workbench 工具执行写入 ticket timeline（`kind: 'workbench'`）。
- [ ] Workbench 所有工具（含 Factory reset / Reboot）执行**无二次确认 / reason 输入**。
- [ ] ISO `grants` 决定哪些工具可点（无对应 grant 时按钮禁用）。
- [ ] 关闭 Workbench 回到对应 ticket 详情。

### 6.7 敏感数据与审计
- [ ] email / phone / 操作员姓名默认脱敏显示；逐字段 reveal 切换。
- [ ] reveal 必写 `data.reveal` 审计事件并触发对应通知；toast "已记入审计"。
- [ ] reveal 不自动重新脱敏；**关页 / 刷新即重新脱敏**。
- [ ] Audit Logs 页支持按 scope / kind / actor / 时间筛选。
- [ ] CSV 导出受 `data.export` 控制；**默认脱敏导出**。
- [ ] 客户 country 不影响脱敏策略。

### 6.8 全局
- [ ] ⌘K 打开命令面板；可搜客户 / 订单 / 跳主路由。
- [ ] ⌘L 锁屏不退会话；解锁后回原路由。
- [ ] 主题 light / dark / system 与语言 en / zh 实时切换并持久化。
- [ ] 所有变更操作生成 audit event；所有审计事件 `at` 一律 ISO8601 + UTC。
- [ ] 主键命名空间：`c-` / `o-YYYY-NNNN` / `m-` / `r-` / `u-` / `li-` / `app-` / `T-YYYY-NNNN`。
- [ ] 桌面 ≥1280px 宽下布局不破。

---

## 7. 开放问题

### 7.1 仍待业务方确认（短期）

- **Q-A — Merchant Tab 去留**：Customer Role Definitions 当前有 Merchant Tab，但既然 Merchant 没有独立平台、每个 merchant 都归属于 ISO，那本后台是否还需要 Merchant 客户角色定义？或者只保留"直签 Merchant"这一种特殊关系类型？需要更明确的客户分类政策。
- **Q-B — 权限点目录补齐**：Sample Orders / Device Models / Devices Fleet / Tickets / Workbench / Apps 等菜单当前没有对应权限点。要不要按菜单逐个补齐 `sys.devicemodels.view/edit`、`sys.tickets.handle`、`sys.workbench.factoryreset` 等？还是按现有命名空间 `cust.*` / `op.*` 拓展？
- **Q-C — 邀请 Copy link 路径的安全性**：Copy link 邀请生成的 Operator 记录 `email` 为空，但 invitation 已生效；要不要在接受时强制让受邀者填入 email 并写回 Operator 记录？

### 7.2 已暂缓 / Deferred（业务方明确"暂时不处理"）

以下功能业务方答复**当前不处理、待后续推进**。本 v0.3 不实现也不写验收标准：

- 通知中心本体上线、Webhook 鉴权与重试策略（Q22 / Q23）
- IAM 边界、MFA secret 同步、User 锁定/解锁的双向同步（Q24）
- 多语言扩展（en / zh 之外）（Q25）
- 平台员工邮箱域名规范（`admin@toms` vs `admin@carbon` vs `@npt`）（Q29）
- 移动端 / 平板适配（Q30）
- Dark theme 是否对外承诺（Q31）
- 取消订单（`Cancelled` 状态）（Q10 — 业务方明确"如有需要后续自行补齐"）

> 这些条目不放回 v0.3 验收标准；待业务方启动相应项目时再单独立 spec。

---

_本 spec v0.3 由当前设计稿 + 业务方第一轮答复整理。所有 v0.2 中冲突或不明的规则已按答复落实。Deferred 段中的项目启动后将单独立子 spec，本主 spec 保持稳定直至 v1.0 终版。_
# Carbon Data Model V2

# 数据模型

## 主体 \& 用户

```Markdown
**# 数据模型**
**## PARTNER**
- PARTNER ID, PRIMARY
- PARTNER NAME, REQUIRE
- COUNTRY, REQUIRE
- ADDRESS
- CONTACT NAME
- EMAIL
- PHONE COUNTRY CODE（国家电话区位）
- PHONE
- TIMEZONE
- LICENSE
- STATUS, ENUM(ONBOARDING, ACTIVE)
- REMARK

**## PARTNER CONTRACT RELATIONSHIP**
- PARTNER** **CONTRACT ID, PRIMARY
- AUTHORIZED PARTNER ID
- AUTHORIZED CONTRACT TYPE, String, 契约类型, 在代码中写死, 可选范围如下：
    - ISO: 独立销售组织身份, 根据 AUTHORIZING PARTNER ID 来区分业务类型：ADMIN 授权 或 ISO授权
    - ISV: 独立软件供应商身份, 根据 AUTHORIZING PARTNER ID 来区分业务类型：ADMIN 授权 或 ISO授权
    - ISO-PILOT: 独立销售组织身份, 试用协议；试用的时候，所有服务均为免费使用
    - ISV-PILOT: 独立软件供应商身份, 试用协议；试用的时候，所有服务均为免费使用
    - ISO-PARTNER: ISO发展的合作伙伴，赋予他ISO的相关的权限，但有局限性
    - ISV-PARTNER: ISV发展的合作伙伴，赋予他ISV的相关的权限，但有局限性
    - MERCHANT: 商户身份
    - DISTRIBUTOR: 分销商
    - ADMIN: 平台管理员的契约，一套系统只能有一个主体拥有ADMIN契约
- AUTHORIZED TIMESTAMP
- AUTHORIZING PARTNER ID
- AUTHORIZING PARTNER CONTRACT TYPE, 冗余字段，授权者使用的契约类型，可用于快速识别谁来授权的。不同授权人获得到的功能可能会不一样。
- EFFECTIVE FROM 
- EFFECTIVE TO
- TERMINATED BY PARTNER ID, 由哪一方终止的
- TERMINATED AT
- STATUS, 契约状态：PILOT / ACTIVE / SUSPENDED / TERMINATED
- ENTITLEMENTS, JSONB, 契约中的条款
- EVENTS, JSONB(Array<{"statusFrom", "statusTo", "description"}>), description字段里，要把具体的操作员，操作时间描述完整。事件分类：绑定、挂起、恢复、终止
- LOGOS, JSONB
    - PLATFORM LOGO, JSON(Array<JSON>), 管理平台个性化使用
        - width,
        - height,
        - file size
        - URL
    - APP BOOT LOGO, JSON, 终端应用启动LOGO, 只有 CONTRACT TYPE = 'ISO' or 'ISO-PILOT' 时生效
        - width
        - height
        - file size
        - file md5
        - URL

**约束**
- 在 STATUS != TERMINATED 状态下，UNIQUE(AUTHORIZED PARTNER ID + AUTHORIZED CONTRACT TYPE + AUTHORIZING PARTNER ID)
- UNIQUE(AUTHORIZED CONTRACT TYPE = CONTACT), 只能有一个主体是ADMIN
- MERCHANT 身份目前只能由ISO来创建，AUTHORIZING PARTNER ID 只能属于拥有 ISO身份的主体
- ENTITLEMENTS JSONB 内容的载荷
    - 当 CONTRACT TYPE = 'ISO' 时
        - "deviceModels", Array<String>
        - "settlementCurrency", 结算用的货币
        - "deviceBasicService", 设备基础费用
            - PRICE: x per device per month
        - "FlyDesk", JSON
            - ENABLE, Boolean
            - PRICE: x per device per month. (Enable=true时不能为空， 0 代表免费)
        - "GeoLocation", JSON
            - ENABLE, Boolean
            - PRICE: x per device per month. (Enable=true时不能为空， 0 代表免费)
        - "GeoFencing", JSON
            - ENABLE, Boolean，如果没有开通GeoLocation，就无法开通GeoFencing
            - PRICE: x per device per month. (Enable=true时不能为空， 0 代表免费)
        - "Pre-warning", JSON
            - ENABLE, Boolean
            - PRICE: x per device per month. (Enable=true时不能为空， 0 代表免费)
    - 当 CONTRACT TYPE = 'ISO-PILOT' 时
        - "deviceModels", Array<String>
        - "settlementCurrency", 结算用的货币
        - "deviceBasicService", 设备基础费用，默认0
            - PRICE: x per device per month
        - "FlyDesk", JSON
            - ENABLE, Boolean
            - PRICE: x per device per month. (Enable=true时不能为空， 0 代表免费，默认直接填0)
        - "GeoLocation", JSON
            - ENABLE, Boolean
            - PRICE: x per device per month. (Enable=true时不能为空， 0 代表免费，默认直接填0)
        - "GeoFencing", JSON
            - ENABLE, Boolean，如果没有开通GeoLocation，就无法开通GeoFencing
            - PRICE: x per device per month. (Enable=true时不能为空， 0 代表免费，默认直接填0)
        - "Pre-warning", JSON
            - ENABLE, Boolean
            - PRICE: x per device per month. (Enable=true时不能为空， 0 代表免费，默认直接填0)
    - 当 CONTRACT TYPE = 'MERCHANT' 时
        - PAYMENT SERVICE, JSON
            - ENABLE, Boolean
            - APP ITEM, Array<JSON>
                - PKG NAME, OPTIONS("com.newland.payexplorer")
                - PRICE: x per device per month, (Enable=true时不能为空， 0 代表免费，默认直接填0)
        - E-RECEIPT SERVICE, JSON
            - ENABLE, Boolean
            - PRICE: x per month. (Enable=true时不能为空， 0 代表免费，默认直接填0)
            - OPTIONS, Array<String>, 可选服务， OPTIONS("EMAIL", "QR CODE")

**## PARTNER CONTRACT EVENT, 针对Contract的事件，用于Timeline**
- PARTNER CONTRACT ENENT ID, PRIMARY
- PARTNER CONTRACT ID,
- EVENTY TYPE, ENUM(创建PILOT， 创建ACTIVE， PILOT续期、挂起，恢复、终止合作、重新合作）
- EVENT INFO, JSONB, 根据每个业务的特点，描述过程
- EVENT TIMESTAMP
- OPERATOR USER ID

**约定**
- eventInfo 按类型的载荷
    - CREATE PILOT{ initialEffectiveTo, entitlementsSnapshot }
    - CREATE ACTIVE{ effectiveFrom, effectiveTo?, entitlementsSnapshot }
    - PILOT EXTEND{ fromEffectiveTo, toEffectiveTo, reason? }
    - PILOT CONVERT ACTIVE{ pilotStartedAt, pilotEntitlementsSnapshot, newEffectiveFrom, newEntitlementsSnapshot, derivedBillingStartsAt }
    - SUSPEND{ reason }
    - RESUME{ }
    - TERMINATE{ reason }
    - ENTITLEMENTS EDIT{ diff: { key: { from, to } }, contractStatusAtTheTime }
- 派生信息（不持久化，运行时算）
    - "是否曾经是试用" = events.any(e.eventType == 'CREATE PILOT')
    - "续期次数" = events.count(e.eventType == 'PILOT EXTEND')
    - "转正时间" = events.find(e.eventType == 'PILOT CONVERT ACTIVE')?.eventTimestamp

**## PARTNER CONTRACT DELEGATION, 委托表：商户委托给SUB ISO**
- DELEGATION ID, PRIMARY
- SOURCE CONTRACT ID, 被委托的原始契约 ID（指向 PARTNER CONTRACT RELATIONSHIP）
- DELEGATOR PARTNER ID, 委托方实体（即原始契约的 AUTHORIZING PARTNER，冗余字段，便于查询）
- DELEGATEE PARTNER ID, 被委托方实体（这里就是 ISO B）
- DELEGATION SCOPE, 委托范围：
    - VIEW ONLY: 仅查看商户信息和数据
    - OPERATE: 日常运营（Ticket处理、交易流水、商户资料、门店资料维护等，不含契约、PROCESSOR ACCOUNT操作）
- EFFECTIVE FROM, 委托生效时间
- EFFECTIVE TO, 委托到期时间，为空表示无限期
- TERMINATED AT, 实际终止时间
- STATUS, ACTIVE / SUSPENDED / TERMINATED
- CREATED BY USER ID, 发起委托的用户（必须是 DELEGATOR 实体下的用户）

**约束**
- SOURCE CONTRACT 必须是 STATUS = ACTIVE 的 MERCHANT 类型契约
- DELEGATEE PARTNER 必须拥有 ISO 身份的 ACTIVE 契约（即 B 自己得是合法 ISO）
- DELEGATEE PARTNER ID ≠ DELEGATOR PARTNER ID（不能委托给自己）
- 在 STATUS != TERMINATED 状态下，UNIQUE(SOURCE CONTRACT ID + DELEGATEE PARTNER ID)
  即同一商户契约对同一 ISO 只能有一条活跃委托
- 禁止再委托：B 不能把从 A 处获得的委托再委托给 C

**## ROLE**
- ROLE ID, PRIMARY
- ROLE NAME
- ROLE TYPE: GLOBAL / PRIVATE
- CONTRACT TYPE, 这个角色归属的契约类型，当这个PARTNER拥有这个契约后，这些角色就会可见
- PARTNER ID, GLOBAL 时为 NULL；PRIVATE 时必填，标识所属Company
- PERMISSION CODES, LIST<STRING>(JSON), 属于这个ROLE的权限集
- REMARK

****应用层约束****：
- TYPE = GLOBAL → PARTNER ID 必须为 NULL
- TYPE = PRIVATE → PARTNER ID 必须非空
- USER ROLE 引用 PRIVATE role 时，USER ROLE.PARTNER ID 必须等于 ROLE.PARTNER ID

**## PARTNER ROLE BLOCKLIST**
- PARTNER ROLE BLOCKLIST ID, PRIMARY
- PARTNER ID
- CONTRACT TYPE, 这个角色归属的契约类型
- ROLE ID

**约束**
- UNIQUE(PARTNER ID + CONTRACT TYPE + ROLE ID)

**## USER, 用户信息表**
- USER ID, PRIMARY
- USERNAME, REQUIRE
- PASSWORD HASH, REQUIRE,（含 salt 的哈希值）
- PASSWORD CHANGED TIMESTAMP
- PASSWORD ERROR TIMES, DEFAULT 0, REQUIRE
- PASSWORD ERROR LOCK EXPIRED TIMESTAMP
- NICK NAME, REQUIRE
- EMAIL, REQUIRE
- COUNTRY
- MFA ENABLE, BOOLEAN, DEFAULT FALSE, REQUIRE
- STATUS：ACTIVE / LOCKED
- LAST LOGIN AT
- PASSWORD HISTORY, JSONB(List<{"passwordHash"}>), 最多保留5次密码
- REMARK

**约束**
- Web端密码处理说明
    - 密码不能通过明文传输，同时为保证密码不会被重放，需要增加时间戳
        - 登陆前，先向服务端获取一个时间戳（S-timestamp)
        - 客户输入密码
        - 组装待加密数据包体：JSON
            - password: 明文密码
            - timestamp: 服务端时间戳
        - 使用指定的私钥进行加密，获得加密后的密码：password-encrypted
        - 将此密码作为Body中的数据上送到云端
- 登陆过程描述
    - 先通过USERNAME查找用户信息
    - 判断用户的STATUS是否正常，如果异常，则报错退出
    - 检查 PASSWORD ERROR LOCK EXPIRED TIMESTAMP 是否有值
        - 有值：判断是不大于当前时间
            - 大于：说明密码错误次数超限，稍后再试。报错，退出；
    - 使用指定私钥解开密钥，获取密钥明文
        - 解密失败，报错，退出
        - 判断时间戳与当前系统时间戳差距有没有超过300秒
            - 超过：报错，退出
    - 对密钥明文进行SHA256计算，获取 password-sha256
    - 使用数据库里的password的值匹配password-sha256
        - 匹配失败：
            - 更新数据库：PASSWORD ERROR TIMES +1
            - 判断更新后的 PASSWORD ERROR TIMES 次数是否超过 6 次 //环境变量
                - 超过：更新 PASSWORD ERROR LOCK EXPIRED = now() + 30min // 环境变量
            - 提示账号/密码校验失败
        - 匹配成功：
            - 更新 PASSWORD ERROR TIMES = 0
            - 更新 PASSWORD ERROR ERROR TIMES = null
    - 判断账号是否开通了MFA
        - 已开通
            - 创建临时登陆TOKEN，并将token返回给前端，告诉前端你需要进行MFA验证
        - 未开通
            - 直接完成登陆，完整缓存账号信息、权限信息，具体参考后面“缓存数据模型”
    - 结束
    

**## MFA INFO**
- MFA INFO ID, PRIMARY
- USER ID, REQUIRE
- MFA TYPE, REQUIRE, DEFAULT 'TOTP'
- SECRET ENCRYPTED, REQUIRE: 存储TOTP密钥，加密存储
- FAIL TIMES, 失败次数，超过10次将锁定60分钟
- LAST FAIL TIMESTAMP, 最后一次失败的时间
- STATUS, REQUIRE: 1-ENABLE; 2-PENDING ACTIVE

**## PARTNER USER RELATIONSHIP**
- PARTNER USER ID, PRIMARY
- PARTNER ID
- USER ID
**- ROLES, JSONB(List<{"roleId"}>)**
- AUTHORIZING TYPE：ADMIN（默认拥有所有权限） / NORMAL（按 ROLE 配置）
- AUTHORIZING TIMESTAMP
- AUTHORIZING USER ID
- AUTHORIZING USER NAME
- STATUS, ACTIVE | LOCKED
- AUTHORIZING FROM, 授权开始时间，如果为空，表示不限制
- AUTHORIZING TO, 授权结束时间，超过则自动失效；如果为空，表示无限制

**约束**
- 通过 AUTHORIZING TO < now() 来判断这个授权是否 Expired
- 如果 AUTHORIZING TYPE = ADMIN，则这个用户就会拥有这个Partner下所有模块的所有权限

**## OPERATOR INVITE, 操作员邀请，一般是某个主体的拥有者创建完主体后，要邀请第一个管理员入驻，完成主体激活**
- OPERATOR INVITE ID, PRIMARY
- INVITER USER ID, 邀请者 ID
- INVITE EMAIL, 邀请的EMAIL
- TOKEN, 邀请中核心的TOKEN，有效期7天
- EXPIRES AT, 超时时间
- CONSUMED AT, 使用时间
- RESEND COUNT, 重发次数，重新重发
```

## 设备

```Markdown
**# 厂家**
- 厂家也是通过实体 + 契约方式来实现的
- 设备处理的几种逻辑：
    - 设备激活：
        - 完成与PARTNER的绑定关系
        - 完成与门店的绑定关系
    - 设备划拨，因为销售/业务关系，可以将设备销售给另一个实体，这时就需要用到划拨。划拨完后设备的所有者关系就会发生变化
    - 设备委托，将设备委托给另一方进行运营，但所有者不发生变化，被委托方会拥有一定限度的管理权限

**## DEVICE**
- DEVICE ID, PRIMARY
- CERT CN, 设备上预装的支付证书的CN，由终端上送，以此来识别设备的真实归属。
- PARTNER ID，实际设备拥有者主体信息
- MODEL CODE
- DEVICE SN, UNIQUE
- DEVICE PN
- OS VERSION, 操作系统版本
- FIRMWARE VERSION, 固件版本
- HARDWARE ID: 内部用的，用来标识设备特性的，与MODE CODE结合，用来区分OTA版本树的
- HARDWARE CODE：硬件配置码
- RUN MODE: 运行模式，UNATTENDED | ATTENDED
- STATUS: 1-正常；0-锁定；9-待激活
- DEVELOP MODE(0-关闭，1-开启)
- ROOT MODE(0-关闭，1-开启)
- PCI VERSION, PIC版本: PCI6 | PCI7
- CREATION TYPE, String, ENUM("IMPORT", "OA SYNC")
- CREATION USER ID
- ACTIVE TIMESTAMP, 激活时间
- UPDATE TIMESTAMP, 更新时间
- CLIENT CERTIFICATE, JSONB
    - CN
    - PUBLICH KEY
    - SHA1
    - ISSUER CN
    - ISSUER PUBLICK KEY
    - ISSUER SHA1
- TRANSFER KEY, JSONB(Array<JSON>)
    - KEY TYPE, String, ENUM("AES")
    - KEY ENCRYPTED, String
    - PKEY INDEX, String
    - USAGE, String, ENUM("SENSITIVE DATA", "KEY PROTECTION")
    - KEY INDEX, String

**约束**
- 通用证书的设备，就全部归属于ADMIN，通过CERT CN识别
- 当 CREATION TYPE = OA SYNC 时，CREATION USER ID 设置为 0，代表系统自动完成

## **DEVICE** **DELEGATION, 设备委托关系表**
- DEVICE DELEGATION ID, PRIMARY
- DEVICE SN
- DELEGATEE PARTNER ID, 被委托方
- DELEGATOR PARTNER ID, 授权方，必须是设备的拥有者，如果不是，则该授权也会失败（如果出现这情况，就是有垃圾数据）
- DELEGATION AT
- STATUS, ACTIVE / TERMINATED
- TERMINATED AT
- REMARK, e.g.: "扫码激活"

**约束**
- DELEGATEE 类型记录理论上只能有一条，不能有多条， UNIQUE(DEVICE SN + DELEGATEE PARTNER ID + DELEGATOR PARTNER ID)
- 被委托的方式：
    - 按设备委托：设备应该处于未激活状态
    - 跟随商户委托：
        - 一个商户委托的时候，需要提醒会自动委托设备
        - 在一个被委托的商户里完成激活，会自动进入委托关系


**## DEVICE MODEL**
- DEVICE MODEL ID, PRIMARY
- VENDOR PARTNER ID (厂家实体ID）
- MODEL CODE, UNIQUE
- OS, ANDROID | LINUX | RTOS
- LOGO URL, Array<JSON>
    - size: 140 | 70 | 55 | 35
    - URL, String
- DESCRIPTION

**## DEVICE SECURITY**
- DEVICE SN
- CLIENT CERT, 客户端证书
- CLIENT CERT FP, 客户端证书指纹
- DEV TRANS KEY, 传输密钥（对称），加密存储
- AUTHORIZE TYPE, 公钥/证书创建类型（设备安全等级高低约束）
- KEY CHANGE TIMES, 公钥/证书变更次数 

**## DEVICE APPLICATION, 终端上送上来的应用信息**
- DEVICE APP ID
- DEVICE SN
- PKG NAME
- APP NAME
- VERSION NAME
- VERSION CODE
- INSTALLATION TIMESTAMP
- IS UNINSTALLABLE, 是否可卸载
- IS AUTO START ON BOOT, 是否开机自启
- IS KIOSK MODE, 是否霸屏模式
- IS APP LAUNCH DISABLED, 是否不可启动
- IS LAUNCHER ICON HIDDEN, 是否桌面不可见
 
**## DEVICE EVENT 设备事件**
- DEVICE EVENT ID
- DEVICE SN
- EVENT TYPE, 事件类型, ENUM(应用开始下载, 应用下载成功, 应用下载失败, 应用安装失败, 应用安装成功, 用户取消升级, 用户确定升级, 应用卸载)
- PKG NAME, 应用包名 或 OTA代表固件更新
- VERSION NAME
- EVENT TIME 事件发生时间
- EVENT DURATION 事件持续时间（秒）
- DESCRIPTION 事件描述
- TARGET1 (事件如果是应用，填写包名，固件填OTA)
- TARGET2 (TYPE为跟应用相关时，存储应用名)
- TARGET3 (TYPE为跟应用或固件相关时，存储版本号)
```

## 指令业务

```Markdown

```

## 样机 \& 应用配置

```Markdown
**# 样机类别及应用定义**
**## DEVICE CATEGORY**
- DEVICE CATEGORY ID, PRIMARY
- PARTNER ID
- DEVICE CATEGORY, ENUM(SEMI-INTEGRATION, STAND-ALONE)
- DEVICE MODE, DEVELOPER MODE ｜ USER MODE
- APPS, JSONB(List<{"pkgName", "versionName"}>), versionName 为空表示默认使用最新版本
```

## 商品 \& 定单（未完成）

```Markdown
**# 商品 & 订单**
- 将硬件设备当作一个商品（SKU）进行管理，然后在线上销售
- 还有提供一些配件，也要放在线上销售
- 配件复用 MODEL/SKU 结构，通过 CATEGORY 与 POS 设备区分
- 配件可挂靠在 POS 设备上作为，便于详情页加购

**## MODEL**
- MODEL ID, PRIMARY
- MODEL CODE, UNIQUE，业务编码，如 `S920`、`ACC-CHG-001`
- MODEL NAME，型号显示名
- BRAND, 默认 NPT
- CATEGORY, 手持POS / 桌面POS / 无人自助 / 配件-充电器 / 配件-纸卷 / ...
- MODEL TYPE, ENUM(DEVICE, ACCESSORY)，区分设备型号与配件型号
- STATUS, ENUM(DRAFT, ON_SALE, OFF_SALE)
- DEFAULT SKU ID，详情页默认选中的 SKU
- SORT WEIGHT，列表排序权重
- LOGO URL, Array<JSON>
    - size: 140 | 70 | 55 | 35
    - URL, String
- ATTRIBUTES, JSONB(Array<JSON>), 属性是根据每个型号配置决定的，不是固定的
    - OS, REQUIRED, JSONB(Array<JSON>)
    

**## MODEL SKU**
- MODEL SKU ID, PRIMARY
- MODEL CODE，所属型号
- SKU CODE, UNIQUE，业务 SKU 码，可由属性拼出，如 `S920-SI-2G-16G-DS`
- DEVICE CATEGORY, ENUM(SEMI_INTEGRATION, STAND_ALONE)，配件可为空
- MEMORY，内存大小，如：2G，配件可为空
- STORAGE，存储大小，如：16G，配件可为空
- HAS SECONDARY SCREEN，是否有副屏，1-有，0-没有，配件可为空
- STATUS, ENUM(ON SALE, OFF SALE, SOLD OUT)
- WEIGHT G，重量（克），物流计算用
- LENGTH MM / WIDTH MM / HEIGHT MM，三围（毫米）
- RECORD_HASH, UNIQUE, sha256(MODEL CODE + PREINSTALLED CATEGORY + MEMORY + STORAGE + HAS SECONDARY SCREEN)
- CREATED AT / UPDATED AT

**结束**
- 配件 SKU 的四个设备属性为空，仅靠 MODEL CODE 区分。RECORD_HASH 在配件场景下退化为 `sha256(MODEL CODE + nulls)`，仍然保持唯一性。


**## MODEL SKU RELATION**
- MODEL SKU RELATION ID, PRIMARY
- SOURCE SKU ID，主商品 SKU（通常是 POS 设备）
- TARGET SKU ID，关联商品 SKU（通常是配件）
- RELATION TYPE, ENUM(SUGGESTED, REQUIRED, BUNDLE)
  - SUGGESTED：建议搭配，详情页「常一起购买」
  - REQUIRED：必选配件，如必须搭配特定纸卷
  - BUNDLE：套餐捆绑销售
- SORT ORDER，同 SOURCE 下展示顺序
- CREATED AT


**## SKU PRICE**
- SKU PRICE ID, PRIMARY
- MODEL SKU ID
- CURRENCY，ISO 4217，如 CNY / USD
- LIST PRICE，标价 / 划线价
- SALE PRICE，售价
- CHANNEL，渠道，默认 DEFAULT
- EFFECTIVE FROM，生效起
- EFFECTIVE TO，失效止，NULL 表示长期
- CREATED AT

**## SKU INVENTORY**
- SKU ID, PRIMARY (复合)
- WAREHOUSE ID, PRIMARY (复合)
- ON HAND，实物在库
- RESERVED，已占用（下单未发货）
- SAFETY STOCK，安全库存阈值
- UPDATED AT

**约束**
- 可售量 = ON HAND - RESERVED
- 下单过程：RESERVED += qty；发货：ON HAND -= qty，RESERVED -= qty；取消：RESERVED -= qty

**## ORDER**
- ORDER NO, PRIMARY，订单号，UUID，可对外展示编号
- USER ID，下单人
- PARTNER ID， 归属哪个主体
- STATUS, ENUM(PENDING PAYMENT, PAID, SHIPPED, DELIVERED, CANCELLED, REFUNDED)
- TOTAL AMOUNT，实付金额
- CURRENCY
- SHIPPING ADDR JSONB({customerName, address, tracking, remark})，收货地址快照
- PAYMENT ID，支付流水号
- PLACED AT，下单时间
- PAID AT / SHIPPED AT / DELIVERED AT，各阶段时间戳
- CREATED AT / UPDATED AT

**## ORDER ITEM**
- ORDER ITEM ID, PRIMARY
- ORDER ID
- SKU ID
- QTY，数量
- UNIT PRICE，成交单价快照
- SKU SNAPSHOT JSON，下单时 SKU 完整信息快照
- CREATED AT

**约束**
- 关键设计 - 快照机制：
    - UNIT PRICE 必须快照，避免后续调价污染历史订单

```

## 门店信息

```Markdown
**# 商户 & 门店关系模型**
- 商户的定义统一在 PARTNER里面，通过判断是否有 MERCHANT 契约来识别这个PARTNER是否为商户

**## STORE 门店定义**
- STORE ID, PRIMARY
- MERCHANT PARTNER ID, 所属的商户
- NAME
- COUNTRY
- TIMEZONE
- ADDRESS
- PHONE COUNTRY CODE（国家电话区位）
- PHONE
- EMAIL
- STATUS：ACTIVE / DISABLED
- PROCESSORS, JSONB，会从商户那边同步过来，如果少了，可以再自己增加，但不能修改商户的
    - TSYS PROCESSOR, JSON
        - mid, String
        - keyIndex, int
        - username, String
        - password, String, 敏感信息，显示的时候需要隐藏，通过点击获取，输入密码后才能解密显示（与后台通讯）
        - fcsID, String
        - transactionKey, PASSWORD, 敏感信息，显示的时候需要隐藏，通过点击获取，输入密码后才能解密显示（与后台通讯）
        - EFFECTIVE FROM, 不允许为空
        - EFFECTIVE TO, 可以为空，表示不限时间
    - FISERV PROCESSOR, JSON
        - enable, boolean
        - mid, String
        - username, String
        - password, PASSWORD, 敏感信息，显示的时候需要隐藏，通过点击获取，输入密码后才能解密显示（与后台通讯）
        - fdsNumber, String
- REMARK
```

## 支付参数

```Markdown
# 支付参数配置
- PROCESSOR 的配置统一放在商户侧，也就是放在商户的契约中

## PROCESSOR KEYINDEX CONFIG, 主要用来配置PROCESSOR的密钥索引
- PROCESSOR KEYINDEX ID, PRIMARY
- PROCESSOR CODE, String
- PROCESSOR KEYS, JSONB(Array<JSON>)
    - keyID, String
    - keyIndex, int

**约束**    
- PROCESSOR CODE 代码里硬编码,目前可选的有: TSYS, FISERV

## PROCESSOR ACCOUNT，processor 账户（凭证唯一数据源）
- PROCESSOR ACCOUNT ID, PRIMARY
- MERCHANT PARTNER ID, REQUIRE —— 账户归属商户
- PROCESSOR CODE, String, REQUIRE, ENUM("TSYS", "FISERV")
- ACCOUNT LABEL, String, 给ISO看的别名，如 "TSYS-主账户"
- CONFIG, JSONB
- CONFIG MD5, String
- EFFECTIVE FROM, REQUIRE
- EFFECTIVE TO, 可空, 为空表示不限时间
- STATUS, ENUM("ACTIVE", "DISABLED")

**约束**
- 在创建时，根据Processor，列出可选的KeyIDs，由操作员选择后，再根据KeyID查询对应的KeyIndex. 创建时按 processorKeyID 快照,字典变动不回溯.
- CONFIG, 按 PROCESSOR CODE 不同载荷
    - TSYS
        - mid, String, required
        - processorKeyID, String, required
        - keyIndex, int, required
        - username, String, required
        - password, String, 敏感信息，显示的时候需要隐藏，通过点击获取，输入密码后才能解密显示（与后台通讯）, required
        - fcsID, String
        - transactionKey, PASSWORD, 敏感信息，显示的时候需要隐藏，通过点击获取，输入密码后才能解密显示（与后台通讯），必填
    - FISERV
        - mid, String, required
        - processorKeyID, String, required
        - keyIndex, int, required
        - username, String, required
        - password, PASSWORD, 敏感信息，显示的时候需要隐藏，通过点击获取，输入密码后才能解密显示（与后台通讯）, required
        - fdsNumber, String

## TERMINAL PAYMENT CONFIG, PROCESSOR + 虚拟终端 + 物理终端 + 应用包名 + 门店的配置
- TERMINAL PAYMENT CONFIG ID, PRIMARY
- PROCESSOR ACCOUNT ID, REQUIRE
- IDENTIFICATION ID, String, REQUIRE, 识别码，根据 PROCESSOR CODE 决定内容
- STORE ID, REQUIRE
- PKG NAME, String, REQUIRE, 应用包名，如 "com.newland.payexplorer"
- DEVICE SN, 一开始是空的，没有激活
- STATUS, String, ENUM("PENDING", "ACTIVE", "INACTIVE"), PENDING=等待激活(未绑定DEVICE SN), ACTIVE=已激活, INACTIVE=已失效
- ACTIVE TIMESTAMP, 激活时间
- DEVICE HISTORY, JSONB(Array<JSON>), 记录DEVICE SN 绑定、激活记录。原因：FISERV对于TID+设备只能激活一次，第二激活会报错（需要联系FISERV RESET）。平台需要根据这个记录判断并提醒操作员。
    - DEVICE SN
    - BIND TIMESTAMP
    - DEVICE ACTIVE TIME
    - DEVICE TIMEZONE
    - UNBIND TIMESTAMP
- UPGRADE STATUS, String, ENUM("PENDING", "READY PUSH", "PUSHING", "WAITING DOWNLOAD", "DOWNLOAD FAIL", "WAITING UPGRADE", "UPGRADE FAIL", "SUCCESS")
- UPGRADE FAILED REASON, String, 失败原因
- PARAMETER MD5

**约束**
- UNIQUE(PROCESSOR ACCOUNT ID + IDENTIFICATION ID + DEVICE SN + PKG NAME), 一机多应用策略+多PROCESSORS策略
- IDENTIFICATION ID 根据 PROCESSOR CODE 的值进行不同的载荷：
    - CASE("TSYS"), 这里填的是 DeviceID（DID）
    - CASE("FISERV"), 这里址的是 TID
- 绑定/激活 FISERV 终端前,用 IDENTIFICATION ID(TID)跨终端查 DEVICE HISTORY,若该 TID 曾在不同 DEVICE SN 上激活过,则阻断并提示"需联系 FISERV RESET"。
- PROCESSOR ACCOUNT ID对应记录的CONFIG or IDENTIFICATION ID or STORE ID or 对应的 TERMINAL APP PAYMENT CONFIG DETAIL 里的值发生变化时，执行以下步骤：
    - 重新刷新状态：
        - 重新计算 PARAMETER MD5 值，把上面提到的所有参数的值连在一起，计算MD5值
        - 重新刷新 STATUS = READY PUSH
    - 判断终端是否在线
        - 在线：立即发一个推送指令
        - 不在线：跳过推送

## TERMINAL APP PAYMENT CONFIG DETAIL, 针对终端的支付应用的支付配置详情
- TERMINAL PAYMENT CONFIG DETAIL ID, PRIMARY
- TERMINAL PAYMENT CONFIG ID, REQUIRE
- PAYMENT FUNCS, JSONB, 功能开关
    - paymentMethod, JSON
        - credit, boolean, 是否受理credit卡, default true
        - debit, boolean, 是否受理debit卡, default true
        - cash, boolean, 是否受理 cash 卡, default true
        - ebt, boolean, 是否受理 ebt 卡, default true
    - passwordProtection, JSONB, 标记以下交易是否需要Manager的密码授权
        - void, boolean, 撤销交易, default true
        - refund, boolean, 退货交易, default true
        - tipAdjustment, boolean, 小费调整交易, default false
        - ebt, boolean, ebt交易, default false
        - cash, boolean, 现金交易, default false
        - transactions, boolean, 查看流水, default false
        - batchClose, boolean, 批结算, default false
        - reports, boolean, 查看报表, default true
        - settings, boolean, 设置, default true
    - batchClose, JSONB,
        - closeMode, String, ENUM("Manual", "Auto")
        - TRIGGER TIME, 触发时间, 只到分钟, 24小时制，默认："02:00". 当closeMode=AUTO时生效
        - summaryReport, boolean, default true
        - detailedReport, boolean, default false
- SIGNATURE, JSONB
    - signatureMethod, String, ENUM({label: "Auto(CVM)", code: "AUTO-CVM"}, {label: "Force", code: "FORCE"})
    - eSignature, boolean, default false
- OPERATOR, JSONB, 终端的操作员
    - loginMode, String, ENUM("PIN Only", "Clerk without PIN", "Clerk with PIN")
    - accounts, Array<JSON>, 允许操作员增删改
        - username, String
        - password, String, 使用AES加密存储，显示时用掩码，点击后再打开详情
        - role, String, ENUM("ADMIN", "MANAGER", "CLERK")
- TAX FEE, JSONB
    - enable, boolean, default true
    - enableRemoveTax, boolean, default true
    - cashWithTax, boolean, default true
    - authWithTax, boolean, default true
    - taxes, Array<JSON>, 允许操作员增删改
        - enable, boolean
        - taxCode, String, 3位数字，从001开始自增
        - percent, double, 保留小数点后3位, 单位%
        - taxName, String
- FEES, JSONB
    - presentToCustomer, Boolean, 是否展示给客户
    - amountConfirmation, Boolean, 金额确认
    - surcharge, JSON
        - enabled, boolean
        - includeTax, boolean
        - includeTip, boolean
        - surchargeRate, double, 保留小数点后3位, 单位%
    - dualPricing, JSON
        - enabled, boolean
        - includeTax, boolean
        - includeTip, boolean
        - cashDiscountRate, double, 保留小数点后3位, 单位%
        - printSavingsLabel, String, 举例："You could have saved with Cash"
        - showDualPrompt, boolean
        - cardRate, double, 保留小数点后3位, 单位 %
        - dualPromptText, String, 举例："CASH DISCOUNT"
        - printDualPricing, boolean, 单位 $
        - entryPriceType, ENUM("CASH_PRICE", "CARD_PRICE")
    - cashDiscount, JSON
        - enabled, boolean
        - includeTax, boolean
        - includeTip, boolean
        - discountRate, double, 保留小数点后3位, 单位 %
- CUSTOM FEE, JSONB(Array<JSON>)
    - includeTax, boolean, default true
    - includeTip, boolean, default true
    - feeList, Array<JSON>, 允许操作员增删改
        - enable, boolean
        - feeName, String
        - feeRate, double, 保留小数点后3位, 单位 %
- TIP FEE, JSONB
    - enable, boolean
    - calculationMode, String, ENUM("Percentage", "FlatAmount")
    - tipAmtountOptions, Array<Double>, 操作员可以增删改，保留小数点后3位, 当 calculationMode = "FlatAmount" 时生效, 单位 $
    - tipPercentOptions, Array<Double>, 操作员可以增删改，保留小数点后3位，当 calculationMode = "Percentage" 时生效, 单位 %
        - 15.0
        - 18.0
        - 20.0 
        - 30.0
    - limits, JSON
        - maxAmountByPercentage, double, default 350.0, 单位 %
        - maxTipAmount, double, default 350.0, 单位 $
    - tipShowOpt, JSON
        - tipSuggestionOnReceipt, boolean ,default true
        - tipLineOnReceipt, boolean, default true
        - tipOnScreen, boolean, default true
- TERMINAL, JSONB
    - logo, JSON
        - enable, boolean, default true
        - content, String, "{BASE64(LOGO FILE)}"
- TRANSACTION, JSONB
    - maxAmountOfRefund,  最大退款金额，小数点后2位, DEFAULT 10000.0
    - fallbackEnable, boolean, default true
    - splitPayment, boolean, default true
    - inputOperatorEnable, boolean, 是否需要输入操作员, default true
    - pinBypass, String, ENUM("MANUAL", "AUTO", "DISABLE")
    - pinDebit, JSON
        - enable, boolean
        - cashbackEnabled, boolean, 反现开关
- RECEIPT, JSON
    - addStoreName, boolean, default true
    - addAddress, boolean, default true
    - addStorePhone, boolean, default true
    - header, Array<String>, 操作员可以增删改, default ["Line 1", "Line 2", "Line 3"]
    - footer, Array<String>, 操作员可以增删改, default ["Line 1", "Line 2", "Line 3"]
    - disclaimer, JSON
        - enable, boolean, default true
        - content, String, default "Cardholder acknowledges receipt of goods and obligations set forth by the cardholder's agreement with issuer"
- PRINT OPT, JSONB
    - enable, boolean, default true
    - receiptForTipAdjust, String, ENUM("Confirm before print", "Auto Print", "No Print"), default "Confirm before print"
    - merchantReceiptOptions, String, ENUM("Confirm before print", "Auto Print", "No Print"), default "Confirm before print"
    - customerReceiptOptions, String, ENUM("Confirm before print", "Auto Print", "No Print"), default "Confirm before print"
- TROUBLESHOOTING, JSONB
    - enable, boolean, default true
    - issueCategories, String, default "[\"Unable to transact\",\"Transaction failed\",\"Printing issue\",\"Network issue\",\"Surcharge issue\"]"
    - phone, String
    - merchantNote, String
    - email, String


**约束**
- 三选一启用：FEES.surcharge, FEES.dualPricing, FEES.cashDiscount 这三个对象里的 enable 只能有一个开启。
- OPERATOR.ACCOUNTS 初始数据: [
                {
                    "password": "{AES("9999")}",
                    "role": "ADMIN",
                    "username": "admin"
                },
                {
                    "password": "{AES("8888")}",
                    "role": "MANAGER",
                    "username": "manager"
                },
                {
                    "password": "{AES("1234")}",
                    "role": "CLERK",
                    "username": "clerk"
                }
            ]
- TAX.TAXES 初始数据：[
                {
                    "enabled": "true",
                    "taxCode": "001",
                    "percent": "4",
                    "taxName": "state"
                },
                {
                    "enabled": "true",
                    "taxCode": "002",
                    "percent": "3",
                    "taxName": "city"
                }
            ]
- CUSTOM FEE.feeList 初始数据：[
                {
                    "feeName": "custom fee",
                    "feeRate": "4",
                    "enabled": "false"
                },
                {
                    "feeName": "custom fee",
                    "feeRate": "4",
                    "enabled": "false"
                }
            ]

## PAYMENT CONFIG TEMPLATE,配置模板(仅用于新建时填充默认值)
- PAYMENT CONFIG TEMPLATE ID, PRIMARY
- PARTNER ID, String, 模板归属ISO/商户
- TEMPLATE NAME, String
- PKG NAME, String, REQUIRE, 模板针对哪个 APP
- PAYLOAD, JSONB —— 结构 = DETAIL 的行为配置部分(PAYMENT FUNCS / SIGNATURE / OPERATOR / TAX FEE / FEES / CUSTOM FEE / TIP FEE / TERMINAL / TRANSACTION / RECEIPT / PRINT OPT / TROUBLESHOOTING)

```

## 增值业务信息

```Markdown
**# 增值业务信息配置**

```

## 设备在门店激活

```Markdown
**# 设备在门店内激活**

// 一个设备可能属于多个STORE
**## DEVICE STORE RELATIONSHIP**
- DEVICE STORE ID, PRIMARY
- DEVICE SN
- STORE ID
- STORE NAME
- MERCHANT NAME
- STATUS
- CREATE TIMESTAMP
```

## ISV \& ISO 应用

```Markdown
**# 应用与应用池相关的数据模型**
**## APPLICATIONS**
- APP ID, PRIMARY
- PARTNER ID
- PKG NAME
- APP NAME
- LOGO URL
- SUPPORT OS: ANDROID, LINUX, RTOS
- CATEGORY: PAYMENT | RETAIL | Food & Beverage | Hospitality | Loyalty | ...
- DESCRIPTION, JSONB
    - DEFAULT LANG, 默认语言
    - en_US
    - zh_CN
    - ...
- COUNTRYS, Array<String>, 支持的国家，空代表所有国家    
- LATEST APP VERSION ID
- PUBLISH MODE: PUBLIC(所有ISO) | PRIVATE(指定ISO）
- DOWNLOAD COUNT, 下载次数
- STATUS: PUBLISHED | UNPUBLISHED(已安装的设备不影响使用，但不能再推送版本了) | ARCHIVE(代表开发者不继续更新、迭代、BUG修复了)

**约束**
- DOWNLOAD COUNT，只要获取一次下载地直就算，任何版本

**## APPLICATION VERSIONS**
- APP VERSION ID, PRIMARY
- PKG NAME
- APP NAME, 允许换应用名称，自动同步到APP
- UPLOAD USER ID
- LOGO URL
- VERSION CODE
- VERSION NAME
- PERMISSIONS, JSONB(Array<JSON>)，不需要检索能力
    - PERMISSION：权限
    - RISK LEVEL: 风险等级，ENUM("HIGH", "MEDIUM", "LOW")
    - DESCRIPTION: 权限说明
- SCAN INFO, JSONB，不需要检索能力
    - scan status: -1-失败 | 0-无 | 1-完成 | 2-进行中
    - scan start timestamp: 开始扫描时间
    - scan finished timestamp: 完成时间，也包括失败的时间
    - report, JSON
        - 根据实际情况帮我扩展一下
        - PATH, 报告存放位置
        - BUCKET ID
        - SECURE COUNT
        - INFO COUNT
        - MEDIUM COUNT, 警告数量
        - HIGH COUNT, 高危数量
        - SECURITY SCORE, 安全评分
- RELEASE, JSONB(Array<Object>)，不需要检索能力
    - DEFAULT LANG, JSONB
        - LOG, Markdown格式
        - SCREENSHOTS, Array<Object>
            - SCREEN TYPE: Landscape | Portrait
            - SCREENSHOT URL
    - en_US
        - LOG, Markdown格式
        - SCREENSHOTS, Array<Object>
            - SCREEN TYPE: Landscape | Portrait
            - SCREENSHOT URL
    - zh_CN
        - LOG, Markdown格式
        - SCREENSHOTS, Array<Object>
            - SCREEN TYPE: Landscape | Portrait
            - SCREENSHOT URL
    - ...
- ORIDINARY FILE INFO, JSONB<Object>，不需要检索能力
    - NAME
    - MD5
    - FILE SIZE, 文件大小单位Byte
    - GOOGLE CERT CN
    - PATH
- DOWNLOAD COUNT, 版本的下载次数    
- STATUS: PUBLISHED | UNPUBLISHED(已安装的设备不影响使用，但新设备不能再安装了) | BOLLBACK(非常严重的撤回，除自己外也要发送给订阅者，通知是否将已安装的应用都撤回，卸载掉。当然订阅者最终可以决定是否要卸载)

**约束**
- DOWNLOAD COUNT，只要获取一次下载地直就算，任何版本

**## PARTNER APPLICATION, 主体拥有的应用列表/订阅的应用列表**
- PARTNER APP ID, PRIMARY
- SUBSCRIBER PARTNER ID
- APP ID,
- PKG NAME, 冗余字段
- PAYMENT FLAG, 冗余字段
- LATEST VERSION ID, 冗余字段，字段变更机制：当ISO接收了某一个版本后，先判断它接受的版本是不是在他所有版本中最新的，如果是就会更新这个字段。
- SOURCE: UPLOAD | SUBSCRIPTION
- SUBSCRIBE USER ID
- SUBSCRIBE USER NAME
- SUBSCRIBE TIMESTAMP
- NOTIFICATIONS, JSONB(Array<OBJECT>), 如果
    - method: ARRAY<STRING>
        - in-app, 站内信
        - email
        - slack
    - target: ARRAY<String>, 通知对象，用户ID数组
- DOWNLOAD COUNT, 下载次数
- STATUS: ACTIVE | CANCEL SUBSCRIPTION

**约束**
- DOWNLOAD COUNT，只要获取一次下载地直就算，任何版本
- 当SOURCE = SUBSCRIPTION 时
    - NOTIFICATIONS 不能为空。
    - STATUS = ACTIVE 需要派生 SUBSCRIPTION，同时界面需要提供 UNSUBSCRIPTION 的入口
- 当SOURCE = UPLOAD时
    - STATUS 不存在 CANCEL SUBSCRIPTION 的情况
- 任何时候 STATUS 都需要通过 APP ID 找到原APP的STATUS，派生出 UNPUBLISHED 的状态

**## PARTNER APPLICATION VERSION**
- PARTNER APP VERSION ID, PRIMARY
- PARTNER APP ID
- PKG NAME, 冗余字段，主要是方便其他业务场景的识别
- APP VERSION ID，关联原始数据
- VERSION NAME, 冗余字段
- VERSION CODE, 冗余字段
- APPROVAL USER ID，如果是自己上传的，则为空
- APPROVAL USER NAME，如果是自己上传的，则为空
- APPROVAL TIMESTAMP，如果是自己上传的，则为空
- STATUS: SUBSCRIPTION | CANCEL SUBSCRIPTION | SKIP | ROLLBACK(如果发布者对一个应用或一个版本进行了ROLLBACK后，就要同步更新到这边来，这是不可逆的。因此，这个状态只有发布者才能触发)
- CREATION TIMESTAMP
- NPT SIGNATURE, JSONB(Array<OBJECT>)，不需要检索能力
    - CERT CN
    - MD5
    - PCI VERSION, 使用PCI6、7的版本进行签名的: PCI6/PCI7/PCI6+7
    - FILE SIZE, 文件大小单位Byte
    - PATH
- DOWNLOAD COUNT, 下载次数

**约束**
- DOWNLOAD COUNT，只要获取一次下载地直就算，这个版本
 
**## APP CATEGORY**
- APP CATEGORY ID, PRIMARY
- CATEGORY NAME


```

## 应用更新

```Markdown
**# 应用更新**
**## ****DEVICE APP UPGRADE STRATEGY**
- DEVICE APP UPGRADE STRATEGY ID, PRIMARY
- PARTNER ID
- APP VERSION ID
- PKG NAME, 冗余字段
- VERSION NAME, 冗余字段
- VERSION CODE, 冗余字段
- UPGRADE STRATEGY:
    - CASUAL, 有空升级（不急，在设备空闲的时候升级，不影响商户使用）
    - IMEEDIATE, 立即升级（紧急，需要立即升级设备）
    - CUSTOM
- NETWORK REQUEST: NO RESTRICTION / WiFi or Ethernet only / WiFi or Ethernet or Callular under cap
- UPGRADE TIME：IMMEDIATE / ON THE NEXT BOOT / NEXT BOOT OR AFTER 10 MIN IDLE / SC
- CALLULAR CAP, number
- INSTALL WINDOWS: Array<JSON>, 不允许跨24点    
    - START：02:00 
    - END：04:00

**## DEVICE APP EVENT**
- DEVICE APP EVENT ID, PRIMARY
- DEVICE SN
- PKG NAME
- APP VERSION NAME
- FILE MD5
-     

**~~## MERCHANT APP UPGRADE STRATEGY~~**
~~- MERCHANT APP UPGRADE STRATEGY ID, PRIMAY~~
~~- PARTNER ID, 商户实体的键~~
~~- OWNER PARTNER ID, 拥有这个商户的实体ID~~
~~- APP VERSION ID~~
~~- PKG NAME, 冗余字段~~
~~- VERSION NAME, 冗余字段~~
~~- VERSION CODE, 冗余字段~~
~~- UPGRADE STRATEGY:~~
~~    - CASUAL, 有空升级（不急，在设备空闲的时候升级，不影响商户使用）~~
~~    - IMEEDIATE, 立即升级（紧急，需要立即升级设备）~~
~~    - CUSTOM~~
~~- NETWORK REQUEST: NO RESTRICTION / WiFi or Ethernet only / WiFi or Ethernet or Callular under cap~~
~~- UPGRADE TIME：IMMEDIATE / ON THE NEXT BOOT / NEXT BOOT OR AFTER 10 MIN IDLE / SC~~
~~- CALLULAR CAP, number~~
~~- INSTALL WINDOWS: Array<JSON>, 不允许跨24点~~
~~     - START：02:00 ~~
~~     - END：04:00 ~~
```

## 客户证书 \& 在线签名

```Markdown
**# ISO证书关系**
 - 每个ISO都可能会拥有 1 ～ N本证书

**## PARTNER CONTRACT CERT, 在契约关系上赋与证书，实现一个关系可以有多本证书。**
- PARTNER CONTRACT CERT ID, PRIMARY
- PARTNER CONTRACT ID, 指向 PARTNER CONTRACT RELATIONSHIP
- PARTNER ID, 冗余字段，拥有者的主体ID
- CERT CN
- PUBLIC KEY, 公钥
- FLYSIGNER ENABLE, BOOLEAN
- FLYSIGNER HOST
- FLYSIGNER APPID
- FLYSIGNER KEY ENCRYPTED, 加密后的KEY
- USAGE, ENUM(**APP-SIGNATURE)**

**约束**
- UNIQUE(PARTNER CONTRACT ID + CERT CN)

**## ****APP SIGNATURE HISTORY**
- APP SIGNATURE HISTORY ID, PRIMARY
- APP VERSION ID
- ORIGINAL FILE MD5
- ORIGINAL FILE URL
- SIGNATURE CERT CN
- PUBLIC KEY, 公钥
- FLYSIGNER APPID
- SIGNED FILE MD5
- SIGNED FILE URL
- SIGNATURE TIMESTAMP
```

## 操作审计日志

```Markdown
## OPERATION LOG
- OPERATION LOG ID,           PRIMARY
- TRACE ID,         请求链路 ID，方便关联同一次请求的多条日志
- USER ID, 操作人用户 ID（可为 NULL，表示系统自动触发）
- OPERATOR NAME,    冗余存操作人姓名，防止用户改名后历史记录失真
- OPERATOR IP,      操作来源 IP
- PARTNER ID,        操作人所属主体 ID
- ACTION,           操作动作，枚举，根据不同的业务有不同的ACTION，可以考虑使用PERMISSION CODE
- TARGET TYPE,      被操作的对象类型，枚举：PARTNER / CONTRACT / USER / ROLE / DELEGATION
- TARGET ID,        被操作对象的主键
- RESULT,           ENUM: SUCCESS / FAILURE
- FAILURE REASON,   失败时的原因描述
- DETAIL,           JSONB，补充上下文，如邀请的 email、契约变更的具体条款等
- CREATED_AT,       记录时间（不叫 operated_at，日志写入即是操作时间）
```

## 设备授权码

```Markdown
**# 设备上用的授权码**
- 任何设备在任何时候都可以向服务端获取一个授权码
- 授权码有效期固定为2小时
- 如果终端一直停留在待激活界面，则需要2小时自动刷新
- 授权码在不同的场景时使用时代表不同的业务

**## DEVICE AUTH TOKEN 授权码表，如果记录不大，可考虑用REDIS代替，使用后再记录进来**
- DEVICE AUTH TOKEN UUID, PRIMARY
- DEVICE AUTH TOKEN, 6位数字
- DEVICE SN
- EXPIRED AT
- USAGE, 在被使用的时候记录下来，可选值：
    - INIT DEV DEVICE, 初始化设备，自动完成应用/固件更新，但不会激活设备，也会自动完成设备绑定。如果是使用者是ADMIN，则不会自动完成绑定
    - ACTIVE DEVICE, 样机/生产机激活，如果是生产机，则会自动绑定到门店里，如果是样机，则自动绑定到此ISV下
- STATUS, ENUM: PENDING, USED, EXPIRED

**约束**
- UNIQUE(STATUS<PENDING> + DEVICE AUTH TOKEN)
```

## 设备统计信息

```Markdown
**## DEVICE INFO
- DEVICE INFO ID
- DEVICE SN
- DEVICE MODEL, 索引
- PARTNER ID, 实际设备拥有者主体信息,索引：单列索引
- OS
- OS VERSION
- FIRMWARE VERSION
- BOOT TIMESTAMP, 开机时间戳
- CURRENT TIMESTAMP, 当前时间戳
- TIMEZONE
- LANG
- STORAGE Capacity, JSON, 存储信息
    - TOTAL
    - USED
    - BASE, 换算单位
- MEMORY INFO, JSON
    - TOTAL, 单位 byte
    - USED, 单位 byte
- PRINTER STATUS, 打印机状态（0：正常|2：缺纸|4：过热|8：打印机忙|112：电压异常|1024：温度低|2048：轴不在位或仓门未关闭）
- NETWORK TYPE, 当前网络类型（0:以太网|2:2G|3:3G|4:4G|5:5G|1:WiFi|99:其他），独立列
- TOTAL UP TIME, 历史累计开机时长
- CONTACT CARD READ COUNT, 刷卡次数
- CONTACTLESS CARD READ COUNT, 挥卡次数
- MAG STRIPE CARD READ COUNT, 插卡次数
- POWER CYCLE COUNT, 开关机次数
- POWER BUTTON PRESS COUNT, 开关机键按键次数
- USB PLUG COUNT, USB插拔次数
- FRONT CAMERA OPEN COUNT, 前置摄像头打开次数
- REAR CAMERA OPEN COUNT, 后置摄像头打开次数
- FLASH COUNT, 刷机次数
- TOTAL PRINT LENGTH,打印长度（毫米）
- LOCATION, JSONB
    - GPS SWITCH, 0|1
    - LOCATION PROVIDER, 高通|HERE|GOOGLE
    - GPS, JSONB
        - LATITUDE, NUMERIC(10, 7)
        - LONGITUDE, NUMERIC(10, 7)
    - NEARBY CELL LIST, Array<JSON>
        - CELL ID, 基站编号
        - LAC, 区域码
        - MCC, 移动国家代码
        - MNC, 移动网络号码
        - SIGNAL STRENGTH, 信号强度值
    - NEARBY WIFI, Array<JSON>
        - MAC
        - SIGNAL STRENGTH
- SAVED WIFI, Array<JSON>
    - NAME
    - SIGNAL STRENGTH
    - MAC
- SIM SLOTS, Array<JSON>, 双卡槽信息，GIN 索引支持 IMEI 精确查询
    - SLOT INDEX, 卡槽编号（0|1）
    - SLOT STATUS, 卡槽状态（EMPTY|ACTIVE|INACTIVE|LOCKED|ERROR|UNKNOWN）
    - ICCID, SIM卡唯一标识
    - IMEI, 设备IMEI，GIN 索引
    - IMSI, 运营商id
    - RSSI, 信号强度
    - IP ADDRESS, 蜂窝网络IP地址
****- STORAGE INFO, JSONB(Array<JSON>)
****    ****- MANU NAME, 厂家名称
****    ****- MANU ID, 厂家ID
****    ****- FW VERSION, 版本号
****    ****- LIFE TIME, 寿命
****    ****- CREATE TIMESTAMP****

## DEVICE EXTEND
- DEVICE EXTEND ID
- DEVICE SN
- LOCK STATUS, 终端锁定状态（ON|OFF），独立列，索引列
- DEVICE PN
- MANUFACTURER, 厂家
- HARDWARE ID, 硬件识别码
- HARDWARE CONFIG CODE, 硬件配置码
- SYSTEM SETTING, JSON, 系统配置（不含 SYSTEM CONFIGURATION）
    - SCREEN, JSON
        - SLEEP TIME, 屏幕长时间不操作休眠时间（毫秒）
        - SCREEN BRIGHTNESS, 主屏幕亮度
        - SECONDARY SCREEN BRIGHTNESS, 副屏亮度
    - MEDIA, JSON
        - MEDIA VOLUME, 当前媒体音量（默认值：10）
        - RING VOLUME, 当前铃声音量（默认值：6）
        - MAX MEDIA VOLUME, 媒体音量最大值（默认值：15）
        - MAX RING VOLUME, 铃声音量最大值（默认值：7）
    - TIME, JSON
        - AUTO TIME ZONE SWITCH, 自动时区开关（0：开启|1：关闭）
        - AUTO TIME SWITCH, 自动时间开关（0：开启|1：关闭）
    - SYSTEM CONFIGURATION, JSON, 系统配置，服务端下发时有值，否则为空
        - SYSTEM PROPERTY, Array<JSON>
            - KEY, 参数名
            - VALUE, 参数值
        - SYSTEM SETTINGS, Array<JSON>
            - KEY, 参数名
            - VALUE, 参数值
- SECURITY SETTING, JSON
    - MAG CARD SWITCH, 刷卡开关（0：禁用|1：启用）
    - IC CARD SWITCH, 插卡开关（0：禁用|1：启用）
    - RF CARD SWITCH, 挥卡开关（0：禁用|1：启用）
    - PRINT SWITCH, 打印机开关（0：禁用|1：启用）
- NETWORK, JSON
    - CURRENT NETWORK CHANNEL, 以太网，蜂窝网络+类型，WiFi，其他
    - WIFI, JSON
        - SWITCH, 0-关|1-开
        - CONNECTED WIFI SSID, 连接的Wi-Fi名称
        - LINK SPEED, 链路速率
        - IP ADDRESS
        - SECURITY TYPE, 加密类型
        - CAPABILITIES, 安全能力集合
    - CELLULAR, JSON
        - SWITCH
        - IP ADDRESS
    - BLUETOOTH, JSON
        - SWITCH
    - ETHERNET, JSON
        - SWITCH
        - IP ADDRESS
        - MASK
    - APN, JSON
        - NAME, 当前网络APN的name（无配置时，为空）
        - APN, 当前网络APN的apn（无配置时，为空）
        - MNC, 当前网络APN的mnc（无配置时，为空）
        - MCC, 当前网络APN的mcc（无配置时，为空）
        - TYPE, 当前网络APN的Type（无配置时，为空）
        - PROXY, 代理（无配置时，为空）
        - PORT, 端口（无配置时，为空）
        - USERNAME, 用户名（无配置时，为空）
        - PASSWORD, 密码（无配置时，为空）
        - SERVER, 服务器（无配置时，为空）
        - MMSC, 多媒体信息服务中心地址（无配置时，为空）
        - MMS PROXY, 彩信代理（无配置时，为空）
        - MMS PORT, 彩信代理端口（无配置时，为空）
        - AUTH TYPE, 身份验证类型（无配置时，为空）
        - PROTOCOL, apn协议（无配置时，为空）
        - ROAMING PROTOCOL, apn漫游协议（无配置时，为空）
        - BEARER, 承载系统（无配置时，为空）
        - MVNO TYPE, 虚拟运营商类型（无配置时，为空）
        - MVNO MATCH DATA, 虚拟运营商值（无配置时，为空）
- SYSTEM SECURITY, JSON, 系统安全
    - HARDWARE ATTACK COUNT, 硬件安全攻击次数
    - SOFTWARE ATTACK COUNT, 软件安全攻击次数
    - IS ROOTED, root状态（0:未ROOT|1:ROOT）
    - TAMPER STATUS, JSON, 安全触发状态
        - STATUS, 状态
        - REASON, Array<String>
- SYSTEM STATUS, JSON
    - STATUS BAR SWITCH, 当前状态栏是否可下拉（0：开启|1：关闭）
    - USB HOST SWITCH, USB HOST开关状态（0：开启|1：关闭）
    - HOTSPOT MENU SWITCH, 热点菜单开关状态（0：开启|1：关闭）
    - UNATTENDED MODE ENABLED, 是否启用无人值守模式（0：否|1：是）
    - IS DEVELOPMENT DEVICE, 是否开发机（0：用户机|1：开发机）
    - SYSTEM PARAMETERS, Array<JSON>, 服务端下发时有值，否则为空
        - KEY, 参数名
        - VALUE, 参数值
- BATTERY PROTECTION INFO, JSON
    - ENABLED, 是否打开电池保护（0：开启|1：关闭）
    - MAX, 充电最大上限，电量达到该值时停止充电（0~100）
    - MIN, 充电最低容量，电量低于该值时开始充电
    - GREEN MAX, 绿色电池状态充电最大上限
    - GREEN MIN, 绿色电池状态充电最低容量
    - RED MAX, 红色电池状态充电最大上限
    - RED MIN, 红色电池状态充电最低容量
    - YELLOW MAX, 黄色电池状态充电最大上限
    - YELLOW MIN, 黄色电池状态充电最低容量
- VERSION INFO,JSON
    - FIRMWARE ID, 固件识别码 
    - USER VERSION, 用户版本（固件版本分支） 
    - FINANCE APP, 金融模块的应用版本（安全模块） 
    - FINANCE FIRMWARE, 金融模块的固件版本 
    - FINANCE BOOT, 金融模块的BOOT版本 
    - SIGNATURE LIBRARY VERSION, 验签库版本号 
    - BSP VERSION, BSP版本号 
    - PAYMENT MODULE VERSION, 支付模块版本号 
    - BASEBAND VERSION, 基带版本号 
- CREATE TIMESTAMP
- UPDATE TIMESTAMP


****## DEVICE APPLICATION STATISTIC 终端应用使用信息****
- DEVICE APP STATISTIC ID
- DEVICE SN
- PARTNER ID，实际设备拥有者主体信息,索引：单列索引
- DEVICE MODEL
- COLLECTION DATE
- PKG NAME
- APP NAME
- WIFI RX BYTES, 下行流量
- WIFI TX BYTES, 上行流量
- WIFI TOTAL BYTES,总流量
- MOBILE RX BYTES,下行流量
- MOBILE TX BYTES,上行流量
- MOBILE TOTAL BYTES,总流量
- ETHERNET RX BYTES,下行流量
- ETHERNET TX BYTES,上行流量
- ETHERNET TOTAL BYTES,总流量
- FOREGROUND DURATION, 应用使用时长（秒）
- CREATE TIMESTAMP


## DEVICE STATISTIC 终端使用信息
- DEVICE STATISTIC ID
- DEVICE SN
- PARTNER ID，实际设备拥有者主体信息,索引：单列索引
- DEVICE MODEL
- OID
- COLLECTION DATE，采集日期
- CONTACT CARD READ COUNT, 插卡次数
- CONTACTLESS CARD READ COUNT, 挥卡次数
- MAG STRIPE CARD READ COUNT, 刷卡次数
- PRINTER LENGTH，打印长度（毫米）
- UP TIME,开机时长
- WIFI RX BYTES, 下行流量
- WIFI TX BYTES, 上行流量
- WIFI TOTAL BYTES,总流量
- MOBILE RX BYTES,下行流量
- MOBILE TX BYTES,上行流量
- MOBILE TOTAL BYTES,总流量
- ETHERNET RX BYTES,下行流量
- ETHERNET TX BYTES,上行流量
- ETHERNET TOTAL BYTES,总流量
- FOREGROUND DURATION, 应用使用时长（秒）
- CREATE TIMESTAMP
****- LOCATION, JSONB(Array<JSON>)****
     - SDK,类型（Qualcomm）
     - SUCCESS COUNT,成功次数
****     - FAIL COUNT, 失败次数**
```

# 关键数据流设计

## 用户登陆

### 缓存数据模型

```Markdown
第一层:
session:{token} → {
  userId: "u_1001",
  currentPARTNERId: "1",          // 当前正在操作的公司
  loginAt, expireAt, mfaPassed,
  currentPARTNERPermission: ["merchant.view", "ticket.process", ...] // 切换公司时从数据库重新读取
  entities: [
      {
        PARTNERId: "1",
        PARTNERName: "Acme Payments",
        authorizingType: "ADMIN",      // 在 A 是管理员
        status: "ACTIVE",
        authorizingFrom: "2024-01-01",
        authorizingTo: null
      },
      {
        PARTNERId: "2",
        PARTNERName: "Beta Merchant Co.",
        authorizingType: "NORMAL",     // 普通用户
        status: "ACTIVE"
      },
      {
        PARTNERId: "3",
        PARTNERName: "Gamma ISV",
        authorizingType: "NORMAL",
        status: "ACTIVE"
      }
    ]
}
TTL: 滑动 30min
```

## 客户注册



## 账号激活

# 基础数据维护

## 契约类型

|契约|说明|功能模块列表|
|---|---|---|
|ADMIN|平台运营者|CUSTOMER<br>MERCHANT<br>DEVICE\(Sample Orders, Device, Model\)<br>APP\(Published App, System App\)<br>TICKETS|
|ISO|独立销售组织|APP STORE<br>MERCHANT<br>DEVICE<br>TRANSACTION<br>E\-RECEIPT<br>FLYDESK<br>TICKET|
|ISV|独立软件供应商|APP PUBLISH<br>SAMPLE DEVICE<br>SAMPLE ORDER|
|MERCHANT|商户|STORE<br>DEVICE<br>TRANSACTION<br>OPERATORS|
|DISTRIBUTOR|分销商|DEVICE\(导入/激活/划拨\)<br>RKI<br>维修|

## 契约的可用条款

|契约|条款|说明|
|---|---|---|
|ISO|结算货币|平台计费用的货币，默认一种货币|
||授权型号|通过这个可以缩小客户能够看到的型号列表|
||设备服务费|每台 每月 的费用|
||FlyDesk|每台 每月 的费用|
||GeoLocation|每台 每月 的费用|
||GeoFencing|每台 每月 的费用|
||Prewarning|每台 每月 的费用|
||TransFlow|每商户 每月 给一个商户授权，就计费一个|
||PayExplorer|每台 每月 的费用，有安装的应用，就会计费一个|
|ISV|||
|MERCHANT|TransFlow|交易流水上送功能<br>每商户 每月|
||Portal|商户的门户，可以查看门店、设备列表，做一些简单的管理<br>如果开通了TransFlow，可以在线看流水|




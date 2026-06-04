# 场景 (Scenarios) — device-models

管理设备型号目录的验收场景。

## 场景：管理员查询型号列表
演练操作 (Exercises): `listDeviceModels`
**假设 (Given)** 我是一名管理员，且系统中存在若干型号
**当 (When)** 我打开型号列表时
**那么 (Then)** 我能看到每个型号的 LOGO、名称、系列、描述、操作系统、横竖屏及屏幕尺寸
**并且 (And)** 未上传 LOGO 的型号显示其操作系统对应的默认 LOGO

## 场景：管理员按操作系统筛选型号
演练操作 (Exercises): `listDeviceModels`
**假设 (Given)** 我是一名管理员，且存在 ANDROID、LINUX 和 RTOS 的型号
**当 (When)** 我按操作系统 ANDROID 筛选列表时
**那么 (Then)** 我只看到 ANDROID 型号

## 场景：管理员查看型号汇总信息
演练操作 (Exercises): `getDeviceModelSummary`
**假设 (Given)** 我是一名管理员，且存在多个操作系统的型号
**当 (When)** 我查看汇总信息时
**那么 (Then)** 我看到每个操作系统对应的型号数量

## 场景：管理员导出筛选后的列表
演练操作 (Exercises): `exportDeviceModels`
**假设 (Given)** 我是一名管理员，且已按操作系统 LINUX 筛选列表
**当 (When)** 我导出列表时
**那么 (Then)** 我得到一个仅包含 LINUX 型号的文件
**并且 (And)** 其列与列表视图一致

## 场景：管理员创建型号
演练操作 (Exercises): `createDeviceModel`
**假设 (Given)** 我是一名管理员
**当 (When)** 我使用唯一的名称、系列、操作系统、横竖屏和一块主屏创建型号时
**那么 (Then)** 该型号被创建并出现在列表中

## 场景：重复的型号名称被拒绝
演练操作 (Exercises): `createDeviceModel`
**假设 (Given)** 我是一名管理员，且已存在一个名为 "N950" 的型号
**当 (When)** 我尝试再创建一个名为 "N950" 的型号时
**那么 (Then)** 该创建因名称冲突被拒绝
**并且 (And)** 没有创建任何新型号

## 场景：管理员查看型号详情
演练操作 (Exercises): `getDeviceModel`
**假设 (Given)** 我是一名管理员，且存在一个型号
**当 (When)** 我打开其详情时
**那么 (Then)** 我看到其 LOGO、名称、描述、操作系统、横竖屏、主屏和副屏

## 场景：管理员修改型号
演练操作 (Exercises): `updateDeviceModel`
**假设 (Given)** 我是一名管理员，且存在一个型号
**当 (When)** 我修改其描述、横竖屏、屏幕和 LOGO 时
**那么 (Then)** 修改被保存
**并且 (And)** 型号名称保持不变

## 场景：管理员删除未被使用的型号
演练操作 (Exercises): `deleteDeviceModel`
**假设 (Given)** 我是一名管理员，且某型号下不存在设备和固件
**当 (When)** 我删除它时
**那么 (Then)** 该型号从目录中移除

## 场景：删除存在归属设备的型号被阻止
演练操作 (Exercises): `deleteDeviceModel`
**假设 (Given)** 我是一名管理员，且某型号下至少有一台归属设备
**当 (When)** 我尝试删除它时
**那么 (Then)** 删除被拒绝
**并且 (And)** 该型号仍保留在目录中

## 场景：删除存在归属固件的型号被阻止
演练操作 (Exercises): `deleteDeviceModel`
**假设 (Given)** 我是一名管理员，且某型号下至少有一个归属固件
**当 (When)** 我尝试删除它时
**那么 (Then)** 删除被拒绝
**并且 (And)** 该型号仍保留在目录中

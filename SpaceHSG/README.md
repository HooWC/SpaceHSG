# SpaceHSG Documentation to IT_Documents Word File

# SpaceHSG 部门权限系统说明

## 概述

此系统实现了基于部门的文件访问权限控制，类似OneDrive的权限管理。用户只能在自己部门的文件夹内进行创建、删除、上传等操作，但可以浏览和下载其他部门的文件。

## 部门列表

系统支持以下9个部门（与 `C:\...` 下的文件夹名称对应）：

1. **Admin** - 行政部
2. **Audit** - 审计部
3. **Finance** - 财务部
4. **IT** - IT部门
5. **Logistics** - 物流部
6. **Management** - 管理层
7. **Production** - 生产部
8. **Report User** - 报表用户
9. **Sales** - 销售部

## 权限规则

### 1. 根目录权限
- **所有用户**：只能浏览，不能创建、删除或上传

### 2. 自己部门文件夹权限
- **IT部门员工** 在 `IT` 文件夹内：
  - ✅ 创建新文件夹
  - ✅ 上传文件
  - ✅ 删除文件/文件夹
  - ✅ 下载文件
  - ✅ 浏览内容

### 3. 其他部门文件夹权限
- **IT部门员工** 在 `Finance` 文件夹内：
  - ❌ 创建新文件夹（按钮隐藏）
  - ❌ 上传文件（按钮隐藏）
  - ❌ 删除文件/文件夹（删除按钮隐藏）
  - ✅ 下载文件
  - ✅ 浏览内容

## 技术实现

### 后端（C#）

#### 1. AccountController.cs
- **ExtractDepartmentFromDN()**: 从Active Directory的Distinguished Name中提取部门信息
- **Login()**: 登录时获取并保存用户部门到Session
- **CheckSession()**: API端点，用于验证session是否有效

```csharp
// 登录成功返回的数据包含部门信息
return Json(new 
{ 
    success = true, 
    username = user.SamAccountName,
    displayName = user.DisplayName,
    department = department,  // 重要：部门信息
    role = role
});
```

#### 2. HomeController.cs
- **HasWritePermission()**: 检查用户是否对特定路径有写权限
- 在 `Upload()`, `CreateFolder()`, `Delete()` 方法中调用权限检查

```csharp
// 权限检查示例
if (!HasWritePermission(path))
{
    return Json(new { 
        success = false, 
        message = "Access denied. You can only operate in your department folder." 
    });
}
```

### 前端（JavaScript）

#### 1. Login页面 (`index.js`)
- 登录成功后，将用户信息保存到 `localStorage`:
```javascript
localStorage.setItem('spaceHSG_user', JSON.stringify({
    username: result.username,
    displayName: result.displayName,
    department: result.department,  // 关键：部门信息
    role: result.role,
    loginTime: new Date().toISOString()
}));
```

- 页面加载时检查localStorage，自动登录

#### 2. Index页面 (`site.js`)
- **hasWritePermission()**: 检查用户是否有写权限
- **checkAndUpdateButtonsVisibility()**: 根据权限显示/隐藏按钮

```javascript
// 权限检查逻辑
function hasWritePermission() {
    const userDepartment = window.userDepartment;  // 从ViewBag获取
    const currentPath = urlParams.get('path') || '';
    
    // 提取当前路径的部门文件夹
    const targetDepartment = currentPath.split(/[\\\/]/)[0];
    
    // 只有部门匹配才有权限
    return userDepartment.toLowerCase() === targetDepartment.toLowerCase();
}
```

#### 3. Logout逻辑
- Logout按钮点击时，清除localStorage:
```javascript
localStorage.removeItem('spaceHSG_user');
```

## 使用流程

### 1. 用户登录
1. 访问登录页面
2. 输入AD用户名和密码
3. 系统从AD获取用户部门信息
4. 登录信息保存到Session和localStorage

### 2. 自动登录
1. 下次访问时，系统检查localStorage
2. 如果有登录信息，验证server session
3. session有效则自动跳转到首页

### 3. 文件操作
1. 用户浏览到某个文件夹
2. 前端检查当前路径的部门 vs 用户部门
3. 根据权限显示/隐藏操作按钮
4. 后端在执行操作前再次验证权限

### 4. 登出
1. 点击Logout按钮
2. 清除localStorage
3. 清除server session
4. 跳转到登录页面

## 调试信息

### 后端Console输出
```
========== Permission Check ==========
User Department: IT
Relative Path: Finance\Reports
Target Department: Finance
Result: DENIED
=====================================
```

### 前端Console输出
```
=== Permission Check ===
User Department: IT
Current Path: Finance\Reports
Target Department: Finance
Result: NO
=== Updating Button Visibility ===
Has Write Permission: false
Buttons disabled (user has no write permission)
```

## 安全考虑

1. **双重验证**: 前端隐藏按钮 + 后端验证权限
2. **Session管理**: 用户信息存储在server-side session
3. **路径安全**: 防止路径遍历攻击
4. **AD集成**: 部门信息直接从Active Directory获取

## 配置AD部门映射

如果AD中的部门名称与文件夹名称不匹配，请修改 `AccountController.cs` 中的 `ExtractDepartmentFromDN()` 方法：

```csharp
// 示例：AD中是"Information Technology"，但文件夹是"IT"
if (dn.Contains("OU=Information Technology", StringComparison.OrdinalIgnoreCase))
{
    return "IT";
}
```

## 测试账户

系统提供了一个硬编码的测试账户（生产环境请删除）：
- **用户名**: admin
- **密码**: admin
- **部门**: IT
- **位置**: `AccountController.cs` Line 29-47

## 常见问题

### Q: 用户在自己部门文件夹内也看不到上传/删除按钮？
A: 检查：
1. ViewBag.UserDepartment 是否正确传递
2. 路径提取是否正确（`console.log` 查看）
3. 部门名称大小写是否一致

### Q: localStorage保存后，下次访问还是要登录？
A: 检查：
1. Session是否过期（默认20分钟）
2. CheckSession API是否正常工作
3. localStorage是否被清除

### Q: 后端权限检查失败，但前端按钮显示？
A: 这是正常的防御机制，后端始终会验证权限，即使前端绕过检查。

## 文件修改清单

### 后端
- ✅ `Controllers/AccountController.cs` - 获取部门信息、CheckSession API
- ✅ `Controllers/HomeController.cs` - 权限检查逻辑、ViewBag传递

### 前端
- ✅ `wwwroot/js/Login/index.js` - localStorage保存、自动登录
- ✅ `wwwroot/js/site.js` - 权限检查、按钮显示控制
- ✅ `Views/Home/Index.cshtml` - 用户信息传递、Logout清除localStorage

## 维护建议

1. **定期检查AD部门映射**：确保AD中的OU结构与代码一致
2. **Session超时设置**：根据需要调整 `Startup.cs` 中的session超时时间
3. **日志记录**：保留Console.WriteLine输出用于调试
4. **删除测试账户**：生产环境记得删除hardcoded的admin账户

---

**创建日期**: 2026-01-23
**版本**: 1.0
**作者**: IT开发团队

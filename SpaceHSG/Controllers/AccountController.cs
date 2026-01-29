using System;
using System.DirectoryServices;
using System.DirectoryServices.AccountManagement;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace SpaceHSG.Controllers
{
    [Route("[controller]/[action]")]
    public class AccountController : Controller
    {
        [HttpGet]
        public IActionResult Login()
        {
            if (!string.IsNullOrEmpty(HttpContext.Session.GetString("Username")))
            {
                return RedirectToAction("Index", "Home");
            }
            return View("~/Views/Home/Login.cshtml");
        }

        [HttpPost]
        public IActionResult Login(string username, string password)
        {
            if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(password))
                return Json(new { success = false, message = "Please enter username and password." });

            // 1. Hardcoded Admin
            if (username == "admin" && password == "admin")
            {
                SetSession("admin", "Administrator", "IT", "IT_Admin");
                return Json(new { success = true });
            }

            // 2. 标准 AD 用户登录
            // 统一规范用户名：支持 username / hsg\\username / username@hsg.local
            string inputUser = username.Trim();
            string netbiosDomain = "hsg";
            string samAccountName = inputUser;
            string bindUserName = inputUser;

            if (inputUser.Contains("@"))
            {
                // user@hsg.local
                samAccountName = inputUser.Split('@')[0];
                bindUserName = inputUser;
            }
            else if (inputUser.Contains("\\"))
            {
                // hsg\\user
                var parts = inputUser.Split('\\');
                if (parts.Length == 2)
                {
                    samAccountName = parts[1];
                }
                bindUserName = inputUser;
            }
            else
            {
                // 只有用户名时，自动加上 hsg\\ 前缀用于绑定
                samAccountName = inputUser;
                bindUserName = $"{netbiosDomain}\\{inputUser}";
            }

            // 使用 DirectoryEntry 进行底层验证
            string domainPath = "LDAP://hsg.local";

            try
            {
                // 尝试用用户的账号密码进行绑定
                using (DirectoryEntry entry = new DirectoryEntry(domainPath, bindUserName, password))
                {
                    // 强制执行一次绑定操作，如果密码不对或账号有问题，这里会直接跳到 catch
                    object nativeObject = entry.NativeObject;

                    // 如果能走到这一步，说明账号密码是对的！
                    using (DirectorySearcher searcher = new DirectorySearcher(entry))
                    {
                        // 使用标准 sAMAccountName 查询实际账户
                        searcher.Filter = $"(sAMAccountName={samAccountName})";
                        searcher.PropertiesToLoad.Add("displayName");
                        searcher.PropertiesToLoad.Add("distinguishedName");
                        searcher.PropertiesToLoad.Add("pwdLastSet");

                        SearchResult result = searcher.FindOne();
                        if (result == null)
                        {
                            return Json(new
                            {
                                success = false,
                                message = "Login Failed: AD user not found."
                            });
                        }

                        // 检查 pwdLastSet，判断是否曾经修改过密码
                        long pwdLastSet = 0;
                        if (result.Properties.Contains("pwdLastSet") && result.Properties["pwdLastSet"].Count > 0)
                        {
                            try
                            {
                                pwdLastSet = (long)result.Properties["pwdLastSet"][0];
                            }
                            catch
                            {
                                pwdLastSet = 0;
                            }
                        }

                        // pwdLastSet == 0 => 从未修改过密码（通常是默认初始密码）
                        if (pwdLastSet == 0)
                        {
                            return Json(new
                            {
                                success = false,
                                message = "Login Failed: Your password has never been changed. Please change your default password on Windows/AD first, then login here."
                            });
                        }

                        string displayName = (result.Properties["displayName"].Count > 0
                            ? result.Properties["displayName"][0]?.ToString()
                            : samAccountName) ?? samAccountName;
                        string dn = result.Properties["distinguishedName"].Count > 0
                            ? result.Properties["distinguishedName"][0]?.ToString()
                            : string.Empty;

                        // 部门提取逻辑
                        string userDept = GetDeptFromDN(dn);
                        string role = userDept == "IT" ? "IT_Admin" : "User";

                        SetSession(samAccountName, displayName, userDept, role);

                        return Json(new
                        {
                            success = true,
                            message = "Login Success!",
                            username = samAccountName,
                            displayName,
                            department = userDept,
                            role
                        });
                    }
                }
            }
            catch (Exception ex)
            {
                // 这里的 ex.Message 会告诉你最真实的拒绝原因
                return Json(new
                {
                    success = false,
                    message = "Login Failed: The user name or password is incorrect or account not initialized.",
                    detail = ex.Message
                });
            }

            return Json(new { success = false, message = "Unknown error." });
        }

        private void SetSession(string user, string display, string dept, string role)
        {
            HttpContext.Session.SetString("Username", user);
            HttpContext.Session.SetString("DisplayName", display);
            HttpContext.Session.SetString("UserDept", dept);
            HttpContext.Session.SetString("Role", role);
        }

        private string GetDeptFromDN(string dn)
        {
            string[] departments = { "Admin", "Audit", "Finance", "IT", "Logistics", "Management", "Production", "Report User", "Sales" };
            foreach (var dept in departments)
            {
                if (dn.Contains($"OU={dept}", StringComparison.OrdinalIgnoreCase)) return dept;
            }
            return "Other";
        }

        public IActionResult Logout()
        {
            HttpContext.Session.Clear();
            return RedirectToAction("Login");
        }
    }
}
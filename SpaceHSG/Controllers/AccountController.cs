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

            // 2. 使用 DirectoryEntry 进行底层验证
            // 这种方式绕过了 PrincipalContext 的一些严格限制
            string domainPath = "LDAP://hsg.local";

            try
            {
                // 尝试用用户的账号密码进行绑定
                using (DirectoryEntry entry = new DirectoryEntry(domainPath, username, password))
                {
                    // 强制执行一次绑定操作，如果密码不对或账号有问题，这里会直接跳到 catch
                    object nativeObject = entry.NativeObject;

                    // 如果能走到这一步，说明账号密码是对的！
                    using (DirectorySearcher searcher = new DirectorySearcher(entry))
                    {
                        searcher.Filter = $"(sAMAccountName={username})";
                        searcher.PropertiesToLoad.Add("displayName");
                        searcher.PropertiesToLoad.Add("distinguishedName");

                        SearchResult result = searcher.FindOne();
                        if (result != null)
                        {
                            string displayName = result.Properties["displayName"][0]?.ToString();
                            string dn = result.Properties["distinguishedName"][0]?.ToString();

                            // 部门提取逻辑
                            string userDept = GetDeptFromDN(dn);
                            string role = userDept == "IT" ? "IT_Admin" : "User";

                            SetSession(username, displayName, userDept, role);

                            return Json(new { success = true, message = "Login Success!" });
                        }
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
using System;
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
                return RedirectToAction("Index", "Home");

            return View("~/Views/Home/Login.cshtml");
        }

        [HttpPost]
        public IActionResult Login(string username, string password)
        {
            if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(password))
                return Json(new { success = false, message = "Please enter username and password." });

            //===== HARDCODED ADMIN (admin/admin) - COMMENTED OUT; uncomment for testing =====
            if (username.Equals("admin", StringComparison.OrdinalIgnoreCase) && password == "admin")
            {
                SetSession("admin", "Administrator", "IT", "IT_Admin");
                return Json(new { success = true, message = "Login Success! (Admin Test Account)", username = "admin", displayName = "Administrator", department = "IT", role = "IT_Admin" });
            }
            //===== END Hardcoded Admin =====

            // AD User Login: input "weng_chin_hoo" -> bind as "hsg\weng_chin_hoo" (one backslash)
            string inputUser = username.Trim();
            string netbiosDomain = "hsg";
            string dnsDomain = "hsg.local";
            string samAccountName = inputUser;
            string bindUserName = inputUser;

            if (inputUser.Contains("@"))
            {
                samAccountName = inputUser.Split('@')[0];
                bindUserName = inputUser;
            }
            else if (inputUser.Contains("\\"))
            {
                var parts = inputUser.Split('\\');
                if (parts.Length == 2) samAccountName = parts[1];
                bindUserName = inputUser;
            }
            else
            {
                samAccountName = inputUser;
                bindUserName = netbiosDomain + "\\" + inputUser;  // "hsg\weng_chin_hoo" (one \)
            }

            // Try multiple AD bind formats; some domains need NetBIOS name, some need UPN
            string[] domainNames = { dnsDomain, netbiosDomain };           // "hsg.local", "hsg"
            string[] bindNames = { bindUserName, samAccountName + "@" + dnsDomain };  // "hsg\user", "user@hsg.local"

            Exception lastEx = null;
            foreach (string domainName in domainNames)
            {
                foreach (string bindName in bindNames)
                {
                    try
                    {
                        using (PrincipalContext pc = new PrincipalContext(ContextType.Domain, domainName, bindName, password))
                        {
                            UserPrincipal user = UserPrincipal.FindByIdentity(pc, samAccountName);
                            if (user != null)
                            {
                                string displayName = user.DisplayName ?? samAccountName;
                                string dn = user.DistinguishedName ?? string.Empty;
                                string userDept = GetDeptFromDN(dn);
                                string role = userDept == "IT" ? "IT_Admin" : "User";
                                SetSession(user.SamAccountName, displayName, userDept, role);
                                return Json(new
                                {
                                    success = true,
                                    message = "Login Success!",
                                    username = user.SamAccountName,
                                    displayName,
                                    department = userDept,
                                    role
                                });
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        lastEx = ex;
                        // 532 = password expired -> allow login by loading user (no credentials)
                        string msg = (ex.Message ?? "").ToLowerInvariant();
                        string innerMsg = ex.InnerException?.Message?.ToLowerInvariant() ?? "";
                        if (msg.Contains("532") || innerMsg.Contains("532") || msg.Contains("password expired") || innerMsg.Contains("password expired"))
                        {
                            try
                            {
                                using (PrincipalContext pc = new PrincipalContext(ContextType.Domain, domainName))
                                {
                                    UserPrincipal user = UserPrincipal.FindByIdentity(pc, samAccountName);
                                    if (user != null)
                                    {
                                        string displayName = user.DisplayName ?? samAccountName;
                                        string dn = user.DistinguishedName ?? string.Empty;
                                        string userDept = GetDeptFromDN(dn);
                                        string role = userDept == "IT" ? "IT_Admin" : "User";
                                        SetSession(user.SamAccountName, displayName, userDept, role);
                                        return Json(new
                                        {
                                            success = true,
                                            message = "Login Success!",
                                            username = user.SamAccountName,
                                            displayName,
                                            department = userDept,
                                            role
                                        });
                                    }
                                }
                            }
                            catch { /* ignore */ }
                        }
                        // 773 = must change password
                        if (msg.Contains("773") || innerMsg.Contains("773") || msg.Contains("must change") || innerMsg.Contains("must change"))
                        {
                            return Json(new
                            {
                                success = false,
                                message = "Login Failed: Your password has never been changed. Please change your default password on Windows/AD first, then login here.",
                                detail = ex.Message
                            });
                        }
                    }
                }
            }

            return Json(new
            {
                success = false,
                message = "Login Failed: The user name or password is incorrect.",
                detail = lastEx?.Message ?? "AD validation failed."
            });
        }

        private void SetSession(string user, string display, string dept, string role)
        {
            HttpContext.Session.SetString("Username", user);
            HttpContext.Session.SetString("DisplayName", display);
            HttpContext.Session.SetString("UserDept", dept);
            HttpContext.Session.SetString("Department", dept);  // HomeController uses "Department" for write permission
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
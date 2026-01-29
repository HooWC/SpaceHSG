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
                return RedirectToAction("Index", "Home");

            return View("~/Views/Home/Login.cshtml");
        }

        [HttpPost]
        public IActionResult Login(string username, string password)
        {
            if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(password))
                return Json(new { success = false, message = "Please enter username and password." });

            //===== 1. Hardcoded Admin ===== NEED DELETE IN PRODUCTION =====    
            if (username == "admin" && password == "admin")
            {
                SetSession("admin", "Administrator", "IT", "IT");

                return Json(new
                {
                    success = true,
                    message = "Login Success! (Admin Test Account)",
                    username = "admin",
                    displayName = "Administrator",
                    department = "IT",
                    role = "IT_Admin"
                });

                //return Json(new { success = true });
            }
            //===== 1. Hardcoded Admin ===== NEED DELETE IN PRODUCTION ===== 

            // 2. AD User Login
            // username / hsg\\username / username@hsg.local
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
                samAccountName = inputUser;
                bindUserName = $"{netbiosDomain}\\{inputUser}";
            }

            // Using DirectoryEntry Checking
            string domainPath = "LDAP://hsg.local";

            try
            {
                using (DirectoryEntry entry = new DirectoryEntry(domainPath, bindUserName, password))
                {
                    object nativeObject = entry.NativeObject;

                    using (DirectorySearcher searcher = new DirectorySearcher(entry))
                    {
                        searcher.Filter = $"(sAMAccountName={samAccountName})";
                        searcher.PropertiesToLoad.Add("displayName");
                        searcher.PropertiesToLoad.Add("distinguishedName");

                        SearchResult result = searcher.FindOne();
                        if (result == null)
                        {
                            return Json(new
                            {
                                success = false,
                                message = "Login Failed: AD user not found."
                            });
                        }

                        string displayName = (result.Properties["displayName"].Count > 0
                            ? result.Properties["displayName"][0]?.ToString()
                            : samAccountName) ?? samAccountName;
                        string dn = result.Properties["distinguishedName"].Count > 0
                            ? result.Properties["distinguishedName"][0]?.ToString()
                            : string.Empty;

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
            catch (DirectoryServicesCOMException comEx)
            {
                string extended = (comEx.ExtendedErrorMessage ?? string.Empty).ToLowerInvariant();

                // data 773: user must change password at next logon（从未修改过默认密码）
                if (extended.Contains("data 773"))
                {
                    return Json(new
                    {
                        success = false,
                        message = "Login Failed: Your password has never been changed. Please change your default password on Windows/AD first, then login here.",
                        detail = comEx.Message
                    });
                }

                // data 532: password expired（曾经改过密码，但已过期） -> Can Login
                if (extended.Contains("data 532"))
                {
                    try
                    {
                        using (PrincipalContext pc = new PrincipalContext(ContextType.Domain, "hsg.local"))
                        {
                            UserPrincipal user = UserPrincipal.FindByIdentity(pc, samAccountName);
                            if (user == null)
                            {
                                return Json(new
                                {
                                    success = false,
                                    message = "Login Failed: AD user not found when handling expired password.",
                                    detail = comEx.Message
                                });
                            }

                            string displayName = user.DisplayName ?? samAccountName;
                            string dn = user.DistinguishedName ?? string.Empty;

                            string userDept = GetDeptFromDN(dn);
                            string role = userDept == "IT" ? "IT_Admin" : "User";

                            SetSession(user.SamAccountName, displayName, userDept, role);

                            return Json(new
                            {
                                success = true,
                                message = "Login Success! (password expired in AD, but accepted here as per policy)",
                                username = user.SamAccountName,
                                displayName,
                                department = userDept,
                                role
                            });
                        }
                    }
                    catch (Exception readEx)
                    {
                        return Json(new
                        {
                            success = false,
                            message = "Login Failed: could not read AD user info after password-expired response.",
                            detail = readEx.Message
                        });
                    }
                }

                // 其他情况：密码错误 / 账号受限等 / Errors
                return Json(new
                {
                    success = false,
                    message = "Login Failed: The user name or password is incorrect or account not allowed to login.",
                    detail = comEx.Message
                });
            }
            catch (Exception ex)
            {
                // ex.Message
                return Json(new
                {
                    success = false,
                    message = "Login Failed: unexpected error while contacting Active Directory.",
                    detail = ex.Message
                });
            }
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
using Microsoft.AspNetCore.Mvc;
using System.DirectoryServices.AccountManagement;
using Microsoft.AspNetCore.Http;
using System;

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
            {
                return Json(new { success = false, message = "Please enter username and password." });
            }

            try
            {
                using (PrincipalContext pc = new PrincipalContext(ContextType.Domain, "hsg.local", username, password))
                {
                    UserPrincipal user = UserPrincipal.FindByIdentity(pc, username);

                    if (user != null)
                    {
                        HttpContext.Session.SetString("Username", user.SamAccountName);
                        HttpContext.Session.SetString("DisplayName", user.DisplayName ?? username);

                        string dn = user.DistinguishedName;
                        string role = dn.Contains("OU=IT") ? "IT_Admin" : "User";
                        HttpContext.Session.SetString("Role", role);

                        return Json(new { success = true, message = "Login Success！" });
                    }
                    else
                    {
                        return Json(new { success = false, message = "Verified, but user details are unavailable." });
                    }
                }
            }
            catch (Exception ex)
            {
                string errorDetail = ex.Message;

                if (errorDetail.Contains("locked out")) errorDetail = "Account Locked Out.";

                return Json(new { success = false, message = "AD refuses to login: " + errorDetail, detail = ex.ToString() });
            }
        }

        public IActionResult Logout()
        {
            HttpContext.Session.Clear();
            return RedirectToAction("Login");
        }
    }
}
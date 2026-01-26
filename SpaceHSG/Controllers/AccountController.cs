using Microsoft.AspNetCore.Mvc;
using SpaceHSG.Services;

namespace SpaceHSG.Controllers
{
    public class AccountController : Controller
    {
        // GET: /Account/Login
        [HttpGet]
        public IActionResult Login()
        {
            // 指定完整路径到 Views/Home/Login.cshtml
            return View("~/Views/Home/Login.cshtml");
        }

        // POST: /Account/Login
        [HttpPost]
        public IActionResult Login(string username, string password)
        {
            // 验证用户名和密码
            if (HardcodedUserService.ValidateUser(username, password, out string role))
            {
                // 保存登录状态到 Session
                HttpContext.Session.SetString("Username", username);
                HttpContext.Session.SetString("Role", role);

                // 登录成功，跳转到 Home/Index
                return RedirectToAction("Index", "Home");
            }

            // 登录失败，显示错误信息
            ViewBag.Error = "Invalid username or password";

            // 返回同一个登录页面
            return View("~/Views/Home/Login.cshtml");
        }

        // Logout: 清除 Session 并跳回登录页
        public IActionResult Logout()
        {
            HttpContext.Session.Clear(); // 清空 Session
            return RedirectToAction("Login"); // 跳回 Login 页面
        }


    }
}

using System.Diagnostics;
using System.IO;  // Ensure this reference is included
using System.Linq;
using Microsoft.AspNetCore.Mvc;
using SpaceHSG.Models;

namespace SpaceHSG.Controllers
{
    public class HomeController : Controller
    {
        private string basePath = @"C:\Hoo_Note\sharehsg";

        public IActionResult Index()
        {
            try
            {
                // Get folder and file list
                var directories = System.IO.Directory.GetDirectories(basePath)
                    .Select(path => new {
                        Name = new System.IO.DirectoryInfo(path).Name,
                        Type = "Folder",
                        Size = 0L,  // Add Size property
                        Modified = System.IO.Directory.GetLastWriteTime(path),
                        Extension = ""
                    });

                var files = System.IO.Directory.GetFiles(basePath)
                    .Select(path => new {
                        Name = System.IO.Path.GetFileName(path),
                        Type = "File",
                        Size = new System.IO.FileInfo(path).Length,
                        Modified = System.IO.File.GetLastWriteTime(path),
                        Extension = System.IO.Path.GetExtension(path)
                    });

                // Merge display - now both anonymous types have the same structure
                ViewBag.Items = directories.Concat(files);
                ViewBag.BasePath = basePath;

                return View();
            }
            catch (Exception ex)
            {
                ViewBag.Error = ex.Message;
                return View();
            }
        }

        // Download file
        public IActionResult Download(string filename)
        {
            var filePath = Path.Combine(basePath, filename);
            if (!System.IO.File.Exists(filePath))
                return NotFound();

            var fileBytes = System.IO.File.ReadAllBytes(filePath);
            return File(fileBytes, "application/octet-stream", filename);
        }
    }
}
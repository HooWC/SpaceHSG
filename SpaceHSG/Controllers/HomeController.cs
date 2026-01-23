using System.Diagnostics;
using System.IO;
using System.Linq;
using Microsoft.AspNetCore.Mvc;
using SpaceHSG.Models;

namespace SpaceHSG.Controllers
{
    public class HomeController : Controller
    {
        private readonly string basePath = @"C:\Hoo_Note\sharehsg"; // Change to server
        private const string RootPath = ""; // Root path identifier

        public IActionResult Index(string path = "")
        {
            try
            {
                string currentPath;

                if (string.IsNullOrEmpty(path) || path == RootPath)
                {
                    currentPath = basePath;
                    path = RootPath;
                }
                else
                {
                    // Decode path and ensure safety
                    var decodedPath = Uri.UnescapeDataString(path);
                    currentPath = Path.Combine(basePath, decodedPath);

                    // Security check: ensure path is within basePath
                    if (!currentPath.StartsWith(basePath, StringComparison.OrdinalIgnoreCase))
                    {
                        ViewBag.Error = "Access denied: Path is outside the authorized directory.";
                        return View();
                    }
                }

                // Get current directory info
                var parentPath = GetParentPath(currentPath);

                // Get folder list
                var directories = System.IO.Directory.GetDirectories(currentPath)
                    .Select(dirPath => new {
                        Name = new DirectoryInfo(dirPath).Name,
                        Type = "Folder",
                        Size = 0L,
                        Modified = System.IO.Directory.GetLastWriteTime(dirPath),
                        Extension = "",
                        Path = GetRelativePath(dirPath, basePath)
                    });

                // Get file list
                var files = System.IO.Directory.GetFiles(currentPath)
                    .Select(filePath => new {
                        Name = System.IO.Path.GetFileName(filePath),
                        Type = "File",
                        Size = new System.IO.FileInfo(filePath).Length,
                        Modified = System.IO.File.GetLastWriteTime(filePath),  // 使用完整命名空间
                        Extension = System.IO.Path.GetExtension(filePath),
                        Path = GetRelativePath(filePath, basePath)
                    });

                // Merge and sort (folders first)
                var items = directories.Concat(files)
                    .OrderByDescending(x => x.Type)
                    .ThenBy(x => x.Name)
                    .ToList();

                // Breadcrumb navigation data
                var breadcrumbs = GetBreadcrumbs(path, currentPath);

                ViewBag.Items = items;
                ViewBag.BasePath = basePath;
                ViewBag.CurrentPath = currentPath;
                ViewBag.RelativePath = path;
                ViewBag.ParentPath = parentPath != basePath ?
                    GetRelativePath(parentPath, basePath) : RootPath;
                ViewBag.Breadcrumbs = breadcrumbs;
                ViewBag.IsRoot = string.IsNullOrEmpty(path) || path == RootPath;

                return View();
            }
            catch (Exception ex)
            {
                ViewBag.Error = ex.Message;
                return View();
            }
        }

        // Download file
        public IActionResult Download(string path)
        {
            try
            {
                if (string.IsNullOrEmpty(path) || path == RootPath)
                {
                    return BadRequest("Invalid file path.");
                }

                var decodedPath = Uri.UnescapeDataString(path);
                var fullPath = System.IO.Path.Combine(basePath, decodedPath);

                // Security check
                if (!fullPath.StartsWith(basePath, StringComparison.OrdinalIgnoreCase))
                    return Forbid();

                if (!System.IO.File.Exists(fullPath))
                    return NotFound();

                var fileBytes = System.IO.File.ReadAllBytes(fullPath);
                var fileName = System.IO.Path.GetFileName(fullPath);

                return File(fileBytes, "application/octet-stream", fileName);
            }
            catch (Exception ex)
            {
                return BadRequest($"Download error: {ex.Message}");
            }
        }

        // Upload files and folders
        [HttpPost]
        public async Task<IActionResult> Upload(string path = "", string folderPath = "")
        {
            try
            {
                var files = Request.Form.Files;
                if (files == null || files.Count == 0)
                {
                    return BadRequest(new { success = false, message = "No files uploaded." });
                }

                // Determine target directory
                string targetDirectory;
                if (string.IsNullOrEmpty(path) || path == RootPath)
                {
                    targetDirectory = basePath;
                }
                else
                {
                    var decodedPath = Uri.UnescapeDataString(path);
                    targetDirectory = System.IO.Path.Combine(basePath, decodedPath);

                    // Security check
                    if (!targetDirectory.StartsWith(basePath, StringComparison.OrdinalIgnoreCase))
                    {
                        return Forbid();
                    }
                }

                // Ensure directory exists
                if (!System.IO.Directory.Exists(targetDirectory))
                {
                    return BadRequest(new { success = false, message = "Target directory does not exist." });
                }

                var uploadedFiles = new List<string>();
                var failedFiles = new List<string>();
                var createdFolders = new HashSet<string>();

                foreach (var file in files)
                {
                    try
                    {
                        var fileName = file.FileName;
                        
                        // Handle folder structure from webkitdirectory
                        string filePath;
                        if (fileName.Contains("/") || fileName.Contains("\\"))
                        {
                            // File is part of a folder structure
                            var pathParts = fileName.Split(new[] { '/', '\\' }, StringSplitOptions.RemoveEmptyEntries);
                            
                            // Create nested folders
                            var currentPath = targetDirectory;
                            for (int i = 0; i < pathParts.Length - 1; i++)
                            {
                                currentPath = System.IO.Path.Combine(currentPath, pathParts[i]);
                                if (!System.IO.Directory.Exists(currentPath))
                                {
                                    System.IO.Directory.CreateDirectory(currentPath);
                                    createdFolders.Add(pathParts[i]);
                                }
                            }
                            
                            filePath = System.IO.Path.Combine(currentPath, pathParts[pathParts.Length - 1]);
                        }
                        else
                        {
                            filePath = System.IO.Path.Combine(targetDirectory, fileName);
                        }

                        // Check if file already exists and add number if needed
                        var finalPath = filePath;
                        var counter = 1;
                        while (System.IO.File.Exists(finalPath))
                        {
                            var fileNameOnly = System.IO.Path.GetFileName(fileName);
                            var fileNameWithoutExt = System.IO.Path.GetFileNameWithoutExtension(fileNameOnly);
                            var extension = System.IO.Path.GetExtension(fileNameOnly);
                            var directory = System.IO.Path.GetDirectoryName(finalPath);
                            finalPath = System.IO.Path.Combine(directory, $"{fileNameWithoutExt} ({counter}){extension}");
                            counter++;
                        }

                        // Create file (even if empty)
                        using (var stream = new FileStream(finalPath, FileMode.Create))
                        {
                            await file.CopyToAsync(stream);
                        }

                        uploadedFiles.Add(System.IO.Path.GetFileName(finalPath));
                    }
                    catch (Exception ex)
                    {
                        failedFiles.Add($"{file.FileName}: {ex.Message}");
                    }
                }

                if (uploadedFiles.Count > 0 || createdFolders.Count > 0)
                {
                    var message = "";
                    if (uploadedFiles.Count > 0) message += $"Uploaded {uploadedFiles.Count} file(s). ";
                    if (createdFolders.Count > 0) message += $"Created {createdFolders.Count} folder(s).";
                    
                    return Ok(new
                    {
                        success = true,
                        message = message.Trim(),
                        uploadedFiles = uploadedFiles,
                        createdFolders = createdFolders,
                        failedFiles = failedFiles
                    });
                }
                else
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = "Failed to upload files.",
                        failedFiles = failedFiles
                    });
                }
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = $"Upload error: {ex.Message}" });
            }
        }

        // Create new folder
        [HttpPost]
        public IActionResult CreateFolder(string path = "", string folderName = "")
        {
            try
            {
                if (string.IsNullOrWhiteSpace(folderName))
                {
                    return BadRequest(new { success = false, message = "Folder name cannot be empty." });
                }

                // Validate folder name (no invalid characters)
                if (folderName.IndexOfAny(System.IO.Path.GetInvalidFileNameChars()) >= 0)
                {
                    return BadRequest(new { success = false, message = "Folder name contains invalid characters." });
                }

                // Determine target directory
                string targetDirectory;
                if (string.IsNullOrEmpty(path) || path == RootPath)
                {
                    targetDirectory = basePath;
                }
                else
                {
                    var decodedPath = Uri.UnescapeDataString(path);
                    targetDirectory = System.IO.Path.Combine(basePath, decodedPath);

                    // Security check
                    if (!targetDirectory.StartsWith(basePath, StringComparison.OrdinalIgnoreCase))
                    {
                        return Forbid();
                    }
                }

                var newFolderPath = System.IO.Path.Combine(targetDirectory, folderName);

                // Check if folder already exists
                if (System.IO.Directory.Exists(newFolderPath))
                {
                    return BadRequest(new { success = false, message = "Folder already exists." });
                }

                // Create the folder
                System.IO.Directory.CreateDirectory(newFolderPath);

                return Ok(new { success = true, message = $"Folder '{folderName}' created successfully." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = $"Create folder error: {ex.Message}" });
            }
        }

        // Delete file or folder
        [HttpPost]
        public IActionResult Delete(string path = "")
        {
            try
            {
                if (string.IsNullOrEmpty(path) || path == RootPath)
                {
                    return BadRequest(new { success = false, message = "Cannot delete root directory." });
                }

                // Decode path - handle double encoding if needed
                var decodedPath = path;
                try
                {
                    decodedPath = Uri.UnescapeDataString(path);
                }
                catch
                {
                    // If decode fails, use original path
                }

                // Normalize path separators
                decodedPath = decodedPath.Replace('/', System.IO.Path.DirectorySeparatorChar);
                
                var fullPath = System.IO.Path.Combine(basePath, decodedPath);
                fullPath = System.IO.Path.GetFullPath(fullPath); // Normalize the path

                // Security check - ensure the path is within basePath
                var normalizedBasePath = System.IO.Path.GetFullPath(basePath);
                if (!fullPath.StartsWith(normalizedBasePath, StringComparison.OrdinalIgnoreCase))
                {
                    return Forbid();
                }

                // Check if it's a file or directory
                if (System.IO.File.Exists(fullPath))
                {
                    System.IO.File.Delete(fullPath);
                    return Ok(new { success = true, message = "File deleted successfully." });
                }
                else if (System.IO.Directory.Exists(fullPath))
                {
                    System.IO.Directory.Delete(fullPath, true); // true = recursive delete
                    return Ok(new { success = true, message = "Folder deleted successfully." });
                }
                else
                {
                    return NotFound(new { success = false, message = $"File or folder not found. Path: {decodedPath}" });
                }
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = $"Delete error: {ex.Message}" });
            }
        }

        // Helper method: Get relative path
        private string GetRelativePath(string fullPath, string basePath)
        {
            if (fullPath.StartsWith(basePath, StringComparison.OrdinalIgnoreCase))
            {
                var relative = fullPath.Substring(basePath.Length).TrimStart(System.IO.Path.DirectorySeparatorChar);
                return string.IsNullOrEmpty(relative) ? RootPath : relative;
            }
            return fullPath;
        }

        // Helper method: Get parent directory path
        private string GetParentPath(string currentPath)
        {
            if (currentPath == basePath)
                return basePath;

            var parent = System.IO.Directory.GetParent(currentPath);
            return parent?.FullName ?? basePath;
        }

        // Helper method: Generate breadcrumb navigation
        private List<Breadcrumb> GetBreadcrumbs(string relativePath, string currentPath)
        {
            var breadcrumbs = new List<Breadcrumb>();

            // Add root directory
            breadcrumbs.Add(new Breadcrumb
            {
                Name = "Home",
                Path = RootPath,
                IsActive = string.IsNullOrEmpty(relativePath)
            });

            if (!string.IsNullOrEmpty(relativePath) && relativePath != RootPath)
            {
                var segments = relativePath.Split(new[] { System.IO.Path.DirectorySeparatorChar }, StringSplitOptions.RemoveEmptyEntries);
                var accumulatedPath = "";

                for (int i = 0; i < segments.Length; i++)
                {
                    accumulatedPath = string.IsNullOrEmpty(accumulatedPath)
                        ? segments[i]
                        : System.IO.Path.Combine(accumulatedPath, segments[i]);

                    breadcrumbs.Add(new Breadcrumb
                    {
                        Name = segments[i],
                        Path = accumulatedPath,
                        IsActive = i == segments.Length - 1
                    });
                }
            }

            return breadcrumbs;
        }
    }

    // Breadcrumb model
    public class Breadcrumb
    {
        public string Name { get; set; }
        public string Path { get; set; }
        public bool IsActive { get; set; }
    }
}
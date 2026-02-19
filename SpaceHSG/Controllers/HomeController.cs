using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;

namespace SpaceHSG.Controllers
{
    public class HomeController : Controller
    {
        private readonly string basePath = @"C:\Hoo_Note\sharehsg"; // Change File Path to server
        private const string RootPath = ""; // Root path identifier
        
        // Department List
        private readonly string[] validDepartments = { "Admin", "Audit", "Finance", "IT", "Logistics", "Management", "Production", "Report User", "Sales" };

        public IActionResult Index(string path = "")
        {
            // ======  LOGIN CHECK  ======
            if (string.IsNullOrEmpty(HttpContext.Session.GetString("Username")))
                return RedirectToAction("Login", "Account");
            // ====== LOGIN CHECK END ======

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
                        Modified = System.IO.File.GetLastWriteTime(filePath),
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
                // Use forward slashes for client so path is not mangled in JavaScript (e.g. IT\test -> \t becomes tab)
                ViewBag.RelativePath = (path ?? "").Replace('\\', '/');
                ViewBag.ParentPath = parentPath != basePath ?
                    GetRelativePath(parentPath, basePath) : RootPath;
                ViewBag.Breadcrumbs = breadcrumbs;
                ViewBag.IsRoot = string.IsNullOrEmpty(path) || path == RootPath;
                
                // ========== 传递用户部门信息到前端 ==========
                ViewBag.UserDepartment = HttpContext.Session.GetString("Department") ?? "Unknown";
                ViewBag.UserDisplayName = HttpContext.Session.GetString("DisplayName") ?? "";
                ViewBag.UserRole = HttpContext.Session.GetString("Role") ?? "User";

                //Console.WriteLine($"ViewBag.RelativePath set to: '{path}'");
                //Console.WriteLine($"ViewBag.UserDepartment set to: '{ViewBag.UserDepartment}'");
                //Console.WriteLine($"=== END INDEX DEBUG ===");

                return View();
            }
            catch (Exception ex)
            {
                ViewBag.Error = ex.Message;
                return View();
            }
        }

        [HttpGet]
        public IActionResult SearchFiles(string path = "", string query = "", int page = 1, int pageSize = 10)
        {
            try
            {
                // ====== 基本路径验证 ======
                string currentPath;

                if (string.IsNullOrEmpty(path) || path == RootPath)
                {
                    currentPath = basePath;
                    path = RootPath;
                }
                else
                {
                    var decodedPath = Uri.UnescapeDataString(path);
                    currentPath = Path.Combine(basePath, decodedPath);

                    if (!currentPath.StartsWith(basePath, StringComparison.OrdinalIgnoreCase))
                    {
                        return Json(new
                        {
                            success = false,
                            message = "Access denied: Path is outside the authorized directory."
                        });
                    }
                }

                // ====== 部门权限检查（可选） ======
                var userDepartment = HttpContext.Session.GetString("Department");
                if (!string.IsNullOrEmpty(userDepartment) && !string.IsNullOrEmpty(path) && path != RootPath)
                {
                    var pathParts = path.Split(new[] { '/' }, StringSplitOptions.RemoveEmptyEntries);
                    if (pathParts.Length > 0)
                    {
                        var targetDepartment = pathParts[0];
                        if (!validDepartments.Contains(targetDepartment, StringComparer.OrdinalIgnoreCase))
                        {
                            return Json(new
                            {
                                success = false,
                                message = "Invalid department folder."
                            });
                        }

                        // 如果用户不是管理员，限制只能搜索自己部门
                        var userRole = HttpContext.Session.GetString("Role") ?? "User";
                        if (userRole != "Admin" && !userDepartment.Equals(targetDepartment, StringComparison.OrdinalIgnoreCase))
                        {
                            return Json(new
                            {
                                success = false,
                                message = $"Access denied. You can only search within your department folder ({userDepartment})."
                            });
                        }
                    }
                }

                // ====== 获取文件列表 ======
                var directories = Directory.GetDirectories(currentPath)
                    .Select(dirPath => new
                    {
                        Name = new DirectoryInfo(dirPath).Name,
                        Type = "Folder",
                        Size = 0L,
                        Modified = Directory.GetLastWriteTime(dirPath),
                        Extension = "",
                        Path = GetRelativePath(dirPath, basePath),
                        FullName = new DirectoryInfo(dirPath).FullName
                    });

                var files = Directory.GetFiles(currentPath)
                    .Select(filePath => new
                    {
                        Name = Path.GetFileName(filePath),
                        Type = "File",
                        Size = new FileInfo(filePath).Length,
                        Modified = System.IO.File.GetLastWriteTime(filePath),
                        Extension = Path.GetExtension(filePath),
                        Path = GetRelativePath(filePath, basePath),
                        FullName = filePath
                    });

                var allItems = directories.Concat(files)
                    .OrderByDescending(x => x.Type)
                    .ThenBy(x => x.Name)
                    .ToList();

                // ====== 应用搜索过滤 ======
                var filteredItems = allItems;
                if (!string.IsNullOrWhiteSpace(query))
                {
                    var searchTerms = query.ToLower().Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                    filteredItems = allItems
                        .Where(item => searchTerms.All(term =>
                            item.Name.ToLower().Contains(term)))
                        .ToList();
                }

                // ====== 应用分页 ======
                var totalItems = filteredItems.Count;
                var totalPages = (int)Math.Ceiling((double)totalItems / pageSize);
                var pagedItems = filteredItems
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .ToList();

                return Json(new
                {
                    success = true,
                    items = pagedItems,
                    totalItems = totalItems,
                    totalPages = totalPages,
                    currentPage = page,
                    pageSize = pageSize,
                    query = query,
                    path = path
                });
            }
            catch (UnauthorizedAccessException)
            {
                return Json(new
                {
                    success = false,
                    message = "Access denied. You don't have permission to access this folder."
                });
            }
            catch (DirectoryNotFoundException)
            {
                return Json(new
                {
                    success = false,
                    message = "Directory not found."
                });
            }
            catch (Exception ex)
            {
                return Json(new
                {
                    success = false,
                    message = $"Search error: {ex.Message}"
                });
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
        public async Task<IActionResult> Upload(string path = "")
        {
            try
            {
                // ========== Access Checking File Function ==========
                if (!HasWritePermission(path))
                {
                    var userDept = HttpContext.Session.GetString("Department");
                    return Json(new { 
                        success = false, 
                        message = $"Access denied. You can only upload files in your department folder ({userDept})." 
                    });
                }
                
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
                    System.IO.Directory.CreateDirectory(targetDirectory);
                }

                var uploadedFiles = new List<string>();
                var failedFiles = new List<string>();
                var createdFolders = new HashSet<string>();

                var preserveStructure = Request.Form["preserveStructure"] == "true";

                if (preserveStructure)
                {
                    for (int i = 0; ; i++)
                    {
                        var fileKey = $"files[{i}].file";
                        var pathKey = $"files[{i}].relativePath";

                        var file = Request.Form.Files.FirstOrDefault(f => f.Name == fileKey);
                        if (file == null)
                            break;

                        var relativePath = Request.Form[pathKey];

                        if (file != null && !string.IsNullOrEmpty(relativePath))
                        {
                            try
                            {
                                // 构建完整路径
                                var fullPath = System.IO.Path.Combine(targetDirectory, relativePath);

                                // 确保父目录存在
                                var parentDir = System.IO.Path.GetDirectoryName(fullPath);
                                if (!System.IO.Directory.Exists(parentDir))
                                {
                                    System.IO.Directory.CreateDirectory(parentDir);

                                    // 记录创建的文件夹
                                    if (parentDir != targetDirectory)
                                    {
                                        var folderName = System.IO.Path.GetFileName(parentDir);
                                        if (!string.IsNullOrEmpty(folderName))
                                            createdFolders.Add(folderName);
                                    }
                                }

                                // 检查文件是否已存在
                                var finalPath = fullPath;
                                var counter = 1;
                                while (System.IO.File.Exists(finalPath))
                                {
                                    var fileNameWithoutExt = System.IO.Path.GetFileNameWithoutExtension(relativePath);
                                    var extension = System.IO.Path.GetExtension(relativePath);
                                    var newFileName = $"{fileNameWithoutExt} ({counter}){extension}";
                                    finalPath = System.IO.Path.Combine(parentDir, newFileName);
                                    counter++;
                                }

                                // Save File
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
                    }
                }
                else
                {
                    // 处理传统的文件上传
                    foreach (var file in files.Where(f => f.Name == "files"))
                    {
                        try
                        {
                            var fileName = file.FileName;

                            // 检查是否有文件夹结构
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
                // ========== 权限检查 ==========
                if (!HasWritePermission(path))
                {
                    var userDept = HttpContext.Session.GetString("Department");
                    //Console.WriteLine($"ERROR: Permission denied for user department: {userDept}");
                    //Console.WriteLine($"===========================================");
                    return Json(new { 
                        success = false, 
                        message = $"Access denied. You can only create folders in your department folder ({userDept})." 
                    });
                }

                if (string.IsNullOrWhiteSpace(folderName))
                {
                    //Console.WriteLine($"ERROR: Folder name is empty or whitespace");
                    //Console.WriteLine($"===========================================");
                    return Json(new { success = false, message = "Folder name cannot be empty." });
                }

                // 清理文件夹名：移除控制字符和无效字符
                folderName = CleanFileName(folderName);
                //Console.WriteLine($"Cleaned folderName: '{folderName}'");

                if (string.IsNullOrWhiteSpace(folderName))
                {
                    //Console.WriteLine($"ERROR: Cleaned folder name is empty");
                    //Console.WriteLine($"===========================================");
                    return Json(new { success = false, message = "Folder name contains only invalid characters." });
                }

                // Validate folder name
                if (folderName.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0)
                {
                    //Console.WriteLine($"ERROR: Folder name contains invalid characters");
                    //Console.WriteLine($"===========================================");
                    return Json(new { success = false, message = "Folder name contains invalid characters." });
                }

                // 清理路径参数
                if (!string.IsNullOrEmpty(path))
                {
                    path = CleanPath(path);
                    //Console.WriteLine($"Cleaned path: '{path}'");
                }
                else
                {
                    //Console.WriteLine($"Path is null or empty, will use basePath");
                }

                string targetDirectory = ValidateAndNormalizePath(path);

                // 使用验证方法获取目标目录
                //Console.WriteLine($"-------------------------------------------");
                //Console.WriteLine($"Calling ValidateAndNormalizePath with: '{path}'");
                //Console.WriteLine($"Target directory returned: '{targetDirectory}'");
                //Console.WriteLine($"basePath for comparison: '{basePath}'");
                //Console.WriteLine($"Are they equal?: {targetDirectory == basePath}");
                //Console.WriteLine($"-------------------------------------------");

                var newFolderPath = Path.Combine(targetDirectory, folderName);
                //Console.WriteLine($"New folder will be created at: '{newFolderPath}'");

                // Check if folder already exists
                if (Directory.Exists(newFolderPath))
                {
                    //Console.WriteLine($"-------------------------------------------");
                    //Console.WriteLine($"ERROR: Folder already exists");
                    //Console.WriteLine($"  Existing folder: '{newFolderPath}'");
                    //Console.WriteLine($"===========================================");
                    return Json(new { success = false, message = "Folder already exists." });
                }

                // Create the folder
                //Console.WriteLine($"-------------------------------------------");
                //Console.WriteLine($"Creating directory...");
                Directory.CreateDirectory(newFolderPath);
                //Console.WriteLine($"SUCCESS: Folder created at: '{newFolderPath}'");

                var relativePath = GetRelativePath(newFolderPath, basePath);
                //Console.WriteLine($"Relative path for new folder: '{relativePath}'");
                //Console.WriteLine($"===========================================");
                //Console.WriteLine($"");

                return Ok(new
                {
                    success = true,
                    message = $"Folder '{folderName}' created successfully.",
                    newPath = relativePath
                });
            }
            catch (UnauthorizedAccessException ex)
            {
                //Console.WriteLine($"UnauthorizedAccessException: {ex.Message}");
                return Forbid();
            }
            catch (Exception ex)
            {
                //Console.WriteLine($"Exception in CreateFolder: {ex}");
                //Console.WriteLine($"Stack trace: {ex.StackTrace}");
                return Json(new { success = false, message = $"Create folder error: {ex.Message}" });
            }
        }

        // 添加新的辅助方法：清理文件名中的控制字符
        private string CleanFileName(string fileName)
        {
            if (string.IsNullOrEmpty(fileName)) return fileName;

            // 移除控制字符（ASCII 0-31，127）
            var cleaned = new StringBuilder();
            foreach (char c in fileName)
            {
                if (!char.IsControl(c) && c != 127) // 保留非控制字符
                {
                    cleaned.Append(c);
                }
                else
                {
                    //Console.WriteLine($"Removed control character: {(int)c} from filename");
                }
            }

            // 移除开头和结尾的空格
            return cleaned.ToString().Trim();
        }

        // 添加新的辅助方法：清理路径中的控制字符
        private string CleanPath(string path)
        {
            if (string.IsNullOrEmpty(path)) return path;

            // 解码URL编码
            var decoded = Uri.UnescapeDataString(path);

            // 移除控制字符
            var cleaned = new StringBuilder();
            foreach (char c in decoded)
            {
                if (!char.IsControl(c) && c != 127) // 保留非控制字符
                {
                    cleaned.Append(c);
                }
                else
                {
                    //Console.WriteLine($"Removed control character: {(int)c} from path");
                }
            }

            return cleaned.ToString();
        }

        // Delete file or folder
        [HttpPost]
        public IActionResult Delete(string path = "")
        {
            try
            {
                if (string.IsNullOrEmpty(path) || path == RootPath)
                {
                    return Json(new { success = false, message = "Cannot delete root directory." });
                }

                // ========== 权限检查 ==========
                if (!HasWritePermission(path))
                {
                    var userDept = HttpContext.Session.GetString("Department");
                    return Json(new { 
                        success = false, 
                        message = $"Access denied. You can only delete items in your department folder ({userDept})." 
                    });
                }

                // Direct path - no URL encoding/decoding needed since we're using POST body
                var decodedPath = path;

                // Normalize path separators to system separator
                decodedPath = decodedPath.Replace('/', System.IO.Path.DirectorySeparatorChar)
                                         .Replace('\\', System.IO.Path.DirectorySeparatorChar);

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
                    // Remove read-only attribute if set
                    var fileInfo = new System.IO.FileInfo(fullPath);
                    if (fileInfo.IsReadOnly)
                    {
                        fileInfo.IsReadOnly = false;
                    }

                    System.IO.File.Delete(fullPath);
                    return Ok(new { success = true, message = "File deleted successfully." });
                }
                else if (System.IO.Directory.Exists(fullPath))
                {
                    // Remove read-only attributes from all files in directory
                    RemoveReadOnlyAttributes(fullPath);

                    System.IO.Directory.Delete(fullPath, true); // true = recursive delete
                    return Ok(new { success = true, message = "Folder deleted successfully." });
                }
                else
                {
                    return NotFound(new { success = false, message = $"File or folder not found. Path: {fullPath}" });
                }
            }
            catch (UnauthorizedAccessException ex)
            {
                return Json(new { success = false, message = $"Access denied: {ex.Message}" });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = $"Delete error: {ex.Message}" });
            }
        }

        // Helper method to remove read-only attributes
        private void RemoveReadOnlyAttributes(string directoryPath)
        {
            try
            {
                var directory = new DirectoryInfo(directoryPath);

                // Remove read-only from directory itself
                if ((directory.Attributes & FileAttributes.ReadOnly) == FileAttributes.ReadOnly)
                {
                    directory.Attributes &= ~FileAttributes.ReadOnly;
                }

                // Remove read-only from all files
                foreach (var file in directory.GetFiles("*", SearchOption.AllDirectories))
                {
                    if (file.IsReadOnly)
                    {
                        file.IsReadOnly = false;
                    }
                }

                // Remove read-only from all subdirectories
                foreach (var subDir in directory.GetDirectories("*", SearchOption.AllDirectories))
                {
                    if ((subDir.Attributes & FileAttributes.ReadOnly) == FileAttributes.ReadOnly)
                    {
                        subDir.Attributes &= ~FileAttributes.ReadOnly;
                    }
                }
            }
            catch
            {
                // Ignore errors in attribute removal
            }
        }

        // Helper method: Get relative path
        private string GetRelativePath(string fullPath, string basePath)
        {
            //Console.WriteLine($"GetRelativePath called with:");
            //Console.WriteLine($"  fullPath: '{fullPath}'");
            //Console.WriteLine($"  basePath: '{basePath}'");

            if (fullPath.StartsWith(basePath, StringComparison.OrdinalIgnoreCase))
            {
                var relative = fullPath.Substring(basePath.Length).TrimStart(System.IO.Path.DirectorySeparatorChar);
                var result = string.IsNullOrEmpty(relative) ? RootPath : relative;

                //Console.WriteLine($"  Result: '{result}'");
                return result;
            }

            //Console.WriteLine($"  ERROR: fullPath does not start with basePath");
            //Console.WriteLine($"  Returning fullPath: '{fullPath}'");
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

        // 辅助方法：验证和规范化路径
        private string ValidateAndNormalizePath(string relativePath)
        {
            //Console.WriteLine($"ValidateAndNormalizePath called with: '{relativePath}'");

            if (string.IsNullOrEmpty(relativePath) || relativePath == RootPath)
            {
                //Console.WriteLine($"Returning basePath: '{basePath}'");
                return basePath;
            }

            var decodedPath = Uri.UnescapeDataString(relativePath);
            //Console.WriteLine($"After URL decoding: '{decodedPath}'");

            var fullPath = Path.Combine(basePath, decodedPath);
            //Console.WriteLine($"Combined path: '{fullPath}'");

            // 规范化路径
            fullPath = Path.GetFullPath(fullPath);
            //Console.WriteLine($"After GetFullPath: '{fullPath}'");

            // 安全检查：确保路径在basePath内
            if (!fullPath.StartsWith(basePath, StringComparison.OrdinalIgnoreCase))
            {
                //Console.WriteLine($"SECURITY VIOLATION: {fullPath} does not start with {basePath}");
                throw new UnauthorizedAccessException("Access denied: Path is outside the authorized directory.");
            }

            //Console.WriteLine($"Returning normalized path: '{fullPath}'");
            return fullPath;
        }

        // 添加这个方法到HomeController中 - 用于AJAX获取文件列表
        [HttpGet]
        public IActionResult GetFileList(string path = "")
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
                    var decodedPath = Uri.UnescapeDataString(path);
                    currentPath = Path.Combine(basePath, decodedPath);

                    // Security check
                    if (!currentPath.StartsWith(basePath, StringComparison.OrdinalIgnoreCase))
                    {
                        return Forbid();
                    }
                }

                // Get folder list
                var directories = Directory.GetDirectories(currentPath)
                    .Select(dirPath => new
                    {
                        Name = new DirectoryInfo(dirPath).Name,
                        Type = "Folder",
                        Size = 0L,
                        Modified = Directory.GetLastWriteTime(dirPath),
                        Extension = "",
                        Path = GetRelativePath(dirPath, basePath)
                    });

                // Get file list
                var files = Directory.GetFiles(currentPath)
                    .Select(filePath => new
                    {
                        Name = Path.GetFileName(filePath),
                        Type = "File",
                        Size = new FileInfo(filePath).Length,
                        Modified = System.IO.File.GetLastWriteTime(filePath),
                        Extension = Path.GetExtension(filePath),
                        Path = GetRelativePath(filePath, basePath)
                    });

                // Merge and sort
                var items = directories.Concat(files)
                    .OrderByDescending(x => x.Type)
                    .ThenBy(x => x.Name)
                    .ToList();

                return Json(new
                {
                    success = true,
                    items = items,
                    folderCount = items.Count(x => x.Type == "Folder"),
                    fileCount = items.Count(x => x.Type == "File"),
                    currentPath = path
                });
            }
            catch (Exception ex)
            {
                return Json(new
                {
                    success = false,
                    message = ex.Message
                });
            }
        }

        // ============== 修改：专门用于AJAX刷新文件列表的部分视图 ==============
        [HttpGet]
        public IActionResult GetFilesPartial(string path = "")
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
                    var decodedPath = Uri.UnescapeDataString(path);
                    currentPath = Path.Combine(basePath, decodedPath);

                    if (!currentPath.StartsWith(basePath, StringComparison.OrdinalIgnoreCase))
                    {
                        return Forbid();
                    }
                }

                // Get folder list
                var directories = Directory.GetDirectories(currentPath)
                    .Select(dirPath => new {
                        Name = new DirectoryInfo(dirPath).Name,
                        Type = "Folder",
                        Size = 0L,
                        Modified = Directory.GetLastWriteTime(dirPath),
                        Extension = "",
                        Path = GetRelativePath(dirPath, basePath)
                    });

                // Get file list
                var files = Directory.GetFiles(currentPath)
                    .Select(filePath => new {
                        Name = Path.GetFileName(filePath),
                        Type = "File",
                        Size = new FileInfo(filePath).Length,
                        Modified = System.IO.File.GetLastWriteTime(filePath),
                        Extension = Path.GetExtension(filePath),
                        Path = GetRelativePath(filePath, basePath)
                    });

                // Merge and sort
                var items = directories.Concat(files)
                    .OrderByDescending(x => x.Type)
                    .ThenBy(x => x.Name)
                    .ToList();

                // 传递到部分视图
                ViewBag.Items = items;
                ViewBag.CurrentPath = path;
                ViewBag.RelativePath = path;
                ViewBag.IsRoot = string.IsNullOrEmpty(path) || path == RootPath;

                // 🔥 重要：传递当前视图模式，让部分视图知道应该显示哪种视图
                ViewBag.CurrentViewMode = Request.Headers["X-View-Mode"].FirstOrDefault() ?? "grid";

                return PartialView("_FilesPartial");
            }
            catch (Exception ex)
            {
                return Content($"<div class='fm-error'>Error: {ex.Message}</div>", "text/html");
            }
        }

        // ============== 新增：获取文件列表HTML片段 ==============
        [HttpGet]
        public IActionResult GetFilesHtml(string path = "")
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
                    var decodedPath = Uri.UnescapeDataString(path);
                    currentPath = Path.Combine(basePath, decodedPath);

                    if (!currentPath.StartsWith(basePath, StringComparison.OrdinalIgnoreCase))
                    {
                        return Forbid();
                    }
                }

                // Get folder list
                var directories = Directory.GetDirectories(currentPath)
                    .Select(dirPath => new
                    {
                        Name = new DirectoryInfo(dirPath).Name,
                        Type = "Folder",
                        Size = 0L,
                        Modified = Directory.GetLastWriteTime(dirPath),
                        Extension = "",
                        Path = GetRelativePath(dirPath, basePath),
                        FullName = new DirectoryInfo(dirPath).FullName
                    });

                // Get file list
                var files = Directory.GetFiles(currentPath)
                    .Select(filePath => new
                    {
                        Name = Path.GetFileName(filePath),
                        Type = "File",
                        Size = new FileInfo(filePath).Length,
                        Modified = System.IO.File.GetLastWriteTime(filePath),
                        Extension = Path.GetExtension(filePath),
                        Path = GetRelativePath(filePath, basePath),
                        FullName = filePath
                    });

                // Merge and sort
                var items = directories.Concat(files)
                    .OrderByDescending(x => x.Type)
                    .ThenBy(x => x.Name)
                    .ToList();

                // 传递到部分视图 - 使用现有的逻辑
                ViewBag.Items = items;
                ViewBag.CurrentPath = path;
                ViewBag.RelativePath = path;
                ViewBag.IsRoot = string.IsNullOrEmpty(path) || path == RootPath;

                // 渲染部分视图而不是手动生成HTML
                return PartialView("_FilesHtmlPartial", items);
            }
            catch (Exception ex)
            {
                // 返回错误信息
                return Content($"<div class='fm-error'>Error: {ex.Message}</div>", "text/html");
            }
        }

        // 生成文件列表HTML的辅助方法
        private string GenerateFilesHtml(IEnumerable<dynamic> items, string currentPath)
        {
            var isListView = false; // 可以根据需要修改

            if (!items.Any())
            {
                return @"<div class='fm-empty'>
                    <div class='fm-empty-icon'>📂</div>
                    <div class='fm-empty-text'>This folder is empty</div>
                    <div class='fm-empty-hint'>Drag files here or click Upload to add files</div>
                </div>";
            }

            var html = new System.Text.StringBuilder();

            if (!isListView)
            {
                // 网格视图
                html.Append("<div class='fm-grid-view' id='gridView'>");
                foreach (var item in items)
                {
                    bool isFolder = item.Type == "Folder";
                    string icon = isFolder ? "📁" : GetFileIcon(item.Extension);
                    string url = isFolder ?
                        $"/Home/Index?path={Uri.EscapeDataString(item.Path)}" :
                        $"/Home/Download?path={Uri.EscapeDataString(item.Path)}";

                    html.Append($@"
                    <div class='fm-grid-item' onclick=""navigateToItem('{url}')"">
                        <button class='fm-delete-btn' onclick=""event.stopPropagation(); showDeleteModal('{item.Name}', '{item.Path}')"" title='Delete'>🗑️</button>
                        <div class='fm-grid-item-icon fm-icon-{(isFolder ? "folder" : item.Extension.Replace(".", ""))}'>
                            {icon}
                        </div>
                        <div class='fm-grid-item-name' title='{item.Name}'>{item.Name}</div>
                        <div class='fm-grid-item-info'>
                            {(isFolder ? "Folder" : FormatFileSize(item.Size))}
                        </div>
                    </div>");
                }
                html.Append("</div>");
            }
            else
            {
                // 列表视图
                html.Append("<div class='fm-list-view' id='listView' style='display: flex;'>");
                html.Append(@"
                <div class='fm-list-header'>
                    <div class='fm-list-checkbox-container' onclick='toggleSelectAll()'>
                        <div class='fm-list-checkbox' id='selectAllCheckbox'></div>
                    </div>
                    <div></div>
                    <div>Name</div>
                    <div>Type</div>
                    <div>Size</div>
                    <div>Modified</div>
                    <div>Actions</div>
                </div>");

                foreach (var item in items)
                {
                    bool isFolder = item.Type == "Folder";
                    string icon = isFolder ? "📁" : GetFileIcon(item.Extension);
                    string typeBadge = isFolder ?
                        "<span class='fm-badge fm-badge-folder'>Folder</span>" :
                        $"<span class='fm-badge fm-badge-file'>{item.Extension}</span>";
                    string size = isFolder ? "—" : FormatFileSize(item.Size);
                    string modified = ((DateTime)item.Modified).ToString("MMM dd, yyyy");

                    html.Append($@"
                    <div class='fm-list-item' data-path='{item.Path}' data-name='{item.Name}' data-type='{item.Type}'>
                        <div class='fm-list-checkbox-container' onclick='event.stopPropagation(); toggleItemSelection(this)'>
                            <div class='fm-list-checkbox'></div>
                        </div>
                        <div class='fm-list-icon fm-icon-{(isFolder ? "folder" : item.Extension.Replace(".", ""))}' onclick='navigateToItemByElement(this)'>
                            {icon}
                        </div>
                        <div class='fm-list-name' title='{item.Name}' onclick='navigateToItemByElement(this)'>{item.Name}</div>
                        <div class='fm-list-type' onclick='navigateToItemByElement(this)'>
                            {typeBadge}
                        </div>
                        <div class='fm-list-size' onclick='navigateToItemByElement(this)'>{size}</div>
                        <div class='fm-list-date' onclick='navigateToItemByElement(this)'>{modified}</div>
                        <div class='fm-list-actions' onclick='event.stopPropagation()'>
                            {(isFolder ?
                                $@"<button class='fm-action-btn open-icon-btn' title='Open' onclick=""window.location.href='/Home/Index?path={Uri.EscapeDataString(item.Path)}'"">
                                    <span class='fm-action-icon'>📂</span>
                                </button>" :
                                $@"<button class='fm-action-btn download-icon-btn' title='Download' onclick=""window.location.href='/Home/Download?path={Uri.EscapeDataString(item.Path)}'"">
                                    <span class='fm-action-icon'>📥</span>
                                </button>")}
                            <button class='fm-action-btn delete-icon-btn' title='Delete' onclick=""showDeleteModal('{item.Name}', '{item.Path}')"">
                                <span class='fm-action-icon' style='color: #e81123;'>🗑️</span>
                            </button>
                        </div>
                    </div>");
                }
                html.Append("</div>");
            }

            return html.ToString();
        }

        // 获取文件图标的辅助方法
        private string GetFileIcon(string extension)
        {
            return extension.ToLower() switch
            {
                ".doc" or ".docx" => "📄",
                ".xls" or ".xlsx" => "📊",
                ".ppt" or ".pptx" => "📽️",
                ".pdf" => "📕",
                ".txt" => "📝",
                ".zip" or ".rar" or ".7z" => "📦",
                ".jpg" or ".jpeg" or ".png" or ".gif" or ".bmp" => "🖼️",
                ".mp4" or ".avi" or ".mov" or ".wmv" => "🎬",
                ".mp3" or ".wav" or ".flac" => "🎵",
                ".exe" => "⚙️",
                ".html" or ".htm" => "🌐",
                ".css" => "🎨",
                ".js" => "📜",
                _ => "📄"
            };
        }

        // 格式化文件大小的辅助方法
        private string FormatFileSize(long bytes)
        {
            if (bytes == 0) return "0 B";
            const int scale = 1024;
            string[] orders = { "B", "KB", "MB", "GB", "TB" };
            int order = 0;
            while (bytes >= scale && order < orders.Length - 1)
            {
                order++;
                bytes = bytes / scale;
            }
            return $"{bytes:0.##} {orders[order]}";
        }

        // ========== 权限检查方法 ==========
        
        /// <summary>
        /// 检查用户是否有权限对指定路径进行写操作（创建、删除、上传）
        /// </summary>
        /// <param name="relativePath">相对于basePath的路径</param>
        /// <returns>true表示有权限，false表示无权限</returns>
        private bool HasWritePermission(string relativePath)
        {
            // 获取用户部门
            var userDepartment = HttpContext.Session.GetString("Department");
            
            if (string.IsNullOrEmpty(userDepartment))
                return false;

            // 规范化路径：统一为正斜杠并去除首尾空白
            relativePath = (relativePath ?? "").Trim().Replace('\\', '/');
            
            // 如果在根目录，不允许任何写操作
            if (string.IsNullOrEmpty(relativePath) || relativePath == RootPath || relativePath == "/")
                return false;

            // 提取路径中的第一级文件夹（部门文件夹）
            var pathParts = relativePath.Split(new[] { '/' }, StringSplitOptions.RemoveEmptyEntries);
            if (pathParts.Length == 0)
            {
                //Console.WriteLine("Result: DENIED (empty path)");
                //Console.WriteLine($"=====================================");
                return false;
            }

            var targetDepartment = pathParts[0];
            //Console.WriteLine($"Target Department: {targetDepartment}");

            // 检查目标部门是否是有效的部门
            if (!validDepartments.Contains(targetDepartment, StringComparer.OrdinalIgnoreCase))
            {
                //Console.WriteLine($"Result: DENIED (invalid department folder)");
                //Console.WriteLine($"=====================================");
                return false;
            }

            // 只有用户部门与目标部门匹配时才允许写操作
            bool hasPermission = userDepartment.Equals(targetDepartment, StringComparison.OrdinalIgnoreCase);
            
            //Console.WriteLine($"Result: {(hasPermission ? "ALLOWED" : "DENIED")}");
            //Console.WriteLine($"=====================================");
            
            return hasPermission;
        }

        /// <summary>
        /// 从完整路径提取部门名称
        /// </summary>
        private string ExtractDepartmentFromPath(string fullPath)
        {
            if (string.IsNullOrEmpty(fullPath) || !fullPath.StartsWith(basePath, StringComparison.OrdinalIgnoreCase))
            {
                return null;
            }

            var relativePath = fullPath.Substring(basePath.Length).TrimStart('\\', '/');
            if (string.IsNullOrEmpty(relativePath))
            {
                return null;
            }

            var pathParts = relativePath.Split(new[] { '\\', '/' }, StringSplitOptions.RemoveEmptyEntries);
            return pathParts.Length > 0 ? pathParts[0] : null;
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
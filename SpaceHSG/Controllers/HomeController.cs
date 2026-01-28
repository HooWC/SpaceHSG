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
        private readonly string basePath = @"C:\sharedrive"; // Change to server
        private const string RootPath = ""; // Root path identifier

        public IActionResult Index(string path = "")
        {
            if (string.IsNullOrEmpty(HttpContext.Session.GetString("Username")))
            {
                return RedirectToAction("Login", "Account");
            } // ====== LOGIN CHECK END ======

            Console.WriteLine($"=== INDEX DEBUG ===");
            Console.WriteLine($"Index called with path parameter: '{path}'");

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
                ViewBag.RelativePath = path;
                ViewBag.ParentPath = parentPath != basePath ?
                    GetRelativePath(parentPath, basePath) : RootPath;
                ViewBag.Breadcrumbs = breadcrumbs;
                ViewBag.IsRoot = string.IsNullOrEmpty(path) || path == RootPath;

                Console.WriteLine($"ViewBag.RelativePath set to: '{path}'");
                Console.WriteLine($"=== END INDEX DEBUG ===");

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

        // Upload files and folders - 修改为支持带结构的文件上传
        [HttpPost]
        public async Task<IActionResult> Upload(string path = "")
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
                    System.IO.Directory.CreateDirectory(targetDirectory);
                }

                var uploadedFiles = new List<string>();
                var failedFiles = new List<string>();
                var createdFolders = new HashSet<string>();

                // 检查是否是带结构的文件上传
                var preserveStructure = Request.Form["preserveStructure"] == "true";

                if (preserveStructure)
                {
                    // 处理带结构的文件上传
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

                                // 保存文件
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
        // Create new folder - 使用验证方法
        [HttpPost]
        public IActionResult CreateFolder(string path = "", string folderName = "")
        {
            try
            {
                Console.WriteLine($"=== CREATE FOLDER DEBUG ===");
                Console.WriteLine($"Received path parameter: '{path}'");
                Console.WriteLine($"Received folderName parameter: '{folderName}'");

                // 记录原始参数的十六进制值，以便查看特殊字符
                Console.WriteLine($"path bytes: {BitConverter.ToString(Encoding.UTF8.GetBytes(path ?? ""))}");
                Console.WriteLine($"folderName bytes: {BitConverter.ToString(Encoding.UTF8.GetBytes(folderName ?? ""))}");

                if (string.IsNullOrWhiteSpace(folderName))
                {
                    return BadRequest(new { success = false, message = "Folder name cannot be empty." });
                }

                // 清理文件夹名：移除控制字符和无效字符
                folderName = CleanFileName(folderName);
                Console.WriteLine($"Cleaned folderName: '{folderName}'");

                if (string.IsNullOrWhiteSpace(folderName))
                {
                    return BadRequest(new { success = false, message = "Folder name contains only invalid characters." });
                }

                // Validate folder name
                if (folderName.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0)
                {
                    return BadRequest(new { success = false, message = "Folder name contains invalid characters." });
                }

                // 清理路径参数
                if (!string.IsNullOrEmpty(path))
                {
                    path = CleanPath(path);
                    Console.WriteLine($"Cleaned path: '{path}'");
                }

                // 使用验证方法获取目标目录
                string targetDirectory = ValidateAndNormalizePath(path);
                Console.WriteLine($"Target directory after validation: '{targetDirectory}'");

                var newFolderPath = Path.Combine(targetDirectory, folderName);
                Console.WriteLine($"New folder path: '{newFolderPath}'");

                // Check if folder already exists
                if (Directory.Exists(newFolderPath))
                {
                    Console.WriteLine($"Folder already exists at: '{newFolderPath}'");
                    return BadRequest(new { success = false, message = "Folder already exists." });
                }

                // Create the folder
                Directory.CreateDirectory(newFolderPath);
                Console.WriteLine($"Folder created successfully at: '{newFolderPath}'");

                var relativePath = GetRelativePath(newFolderPath, basePath);
                Console.WriteLine($"Relative path for new folder: '{relativePath}'");
                Console.WriteLine($"=== END DEBUG ===");

                return Ok(new
                {
                    success = true,
                    message = $"Folder '{folderName}' created successfully.",
                    newPath = relativePath
                });
            }
            catch (UnauthorizedAccessException ex)
            {
                Console.WriteLine($"UnauthorizedAccessException: {ex.Message}");
                return Forbid();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Exception in CreateFolder: {ex}");
                Console.WriteLine($"Stack trace: {ex.StackTrace}");
                return BadRequest(new { success = false, message = $"Create folder error: {ex.Message}" });
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
                    Console.WriteLine($"Removed control character: {(int)c} from filename");
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
                    Console.WriteLine($"Removed control character: {(int)c} from path");
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
                    return BadRequest(new { success = false, message = "Cannot delete root directory." });
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
                return BadRequest(new { success = false, message = $"Access denied: {ex.Message}" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = $"Delete error: {ex.Message}" });
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
        // Helper method: Get relative path
        private string GetRelativePath(string fullPath, string basePath)
        {
            Console.WriteLine($"GetRelativePath called with:");
            Console.WriteLine($"  fullPath: '{fullPath}'");
            Console.WriteLine($"  basePath: '{basePath}'");

            if (fullPath.StartsWith(basePath, StringComparison.OrdinalIgnoreCase))
            {
                var relative = fullPath.Substring(basePath.Length).TrimStart(System.IO.Path.DirectorySeparatorChar);
                var result = string.IsNullOrEmpty(relative) ? RootPath : relative;

                Console.WriteLine($"  Result: '{result}'");
                return result;
            }

            Console.WriteLine($"  ERROR: fullPath does not start with basePath");
            Console.WriteLine($"  Returning fullPath: '{fullPath}'");
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
            Console.WriteLine($"ValidateAndNormalizePath called with: '{relativePath}'");

            if (string.IsNullOrEmpty(relativePath) || relativePath == RootPath)
            {
                Console.WriteLine($"Returning basePath: '{basePath}'");
                return basePath;
            }

            var decodedPath = Uri.UnescapeDataString(relativePath);
            Console.WriteLine($"After URL decoding: '{decodedPath}'");

            var fullPath = Path.Combine(basePath, decodedPath);
            Console.WriteLine($"Combined path: '{fullPath}'");

            // 规范化路径
            fullPath = Path.GetFullPath(fullPath);
            Console.WriteLine($"After GetFullPath: '{fullPath}'");

            // 安全检查：确保路径在basePath内
            if (!fullPath.StartsWith(basePath, StringComparison.OrdinalIgnoreCase))
            {
                Console.WriteLine($"SECURITY VIOLATION: {fullPath} does not start with {basePath}");
                throw new UnauthorizedAccessException("Access denied: Path is outside the authorized directory.");
            }

            Console.WriteLine($"Returning normalized path: '{fullPath}'");
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

        // ============== 新增：专门用于AJAX刷新文件列表的部分视图 ==============
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

                // 传递到部分视图
                ViewBag.Items = items;
                ViewBag.CurrentPath = path;
                ViewBag.RelativePath = path;
                ViewBag.IsRoot = string.IsNullOrEmpty(path) || path == RootPath;

                return PartialView("_FilesPartial");
            }
            catch (Exception ex)
            {
                // 返回错误信息
                return PartialView("_FilesPartial", new { error = ex.Message });
            }
        }

        // ============== 新增：获取文件列表HTML片段 ==============
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
    }

    // Breadcrumb model
    public class Breadcrumb
    {
        public string Name { get; set; }
        public string Path { get; set; }
        public bool IsActive { get; set; }
    }
}
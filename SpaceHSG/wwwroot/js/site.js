// wwwroot/js/site.js - 添加全选功能版本

// 全局变量 - 这些需要在页面中设置
let currentPath = '';
let uploadUrl = '';
let selectedItems = new Set(); // 存储选中的项目
let isRefreshing = false; // 防止重复刷新

// 辅助函数：构建正确的应用URL
function buildAppUrl(path) {
    const basePath = window.appBasePath || '/';
    // 移除开头的斜杠（如果有）
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    // 确保basePath以斜杠结尾
    const normalizedBase = basePath.endsWith('/') ? basePath : basePath + '/';
    return normalizedBase + cleanPath;
}

// 调试函数 - 在浏览器控制台输入 debugPath() 来检查当前路径
window.debugPath = function() {
    //console.log('===========================================');
    //console.log('DEBUG PATH INFO:');
    //console.log('  currentPath:', currentPath);
    //console.log('  currentPath type:', typeof currentPath);
    //console.log('  currentPath length:', currentPath ? currentPath.length : 'null/undefined');
    //console.log('  Is empty string?:', currentPath === '');
    //console.log('  window.location.href:', window.location.href);
    //console.log('  window.location.search:', window.location.search);
    //console.log('===========================================');
    return currentPath;
};

// 初始化函数，需要在页面加载后调用
function initializeFileManager(path, url) {
    //console.log('===========================================');
    //console.log('initializeFileManager called');
    //console.log('  Raw path parameter:', path);
    //console.log('  Raw path type:', typeof path);
    //console.log('  Raw path length:', path ? path.length : 'null/undefined');
    
    // 同时检查URL参数
    const urlParams = new URLSearchParams(window.location.search);
    const urlPath = urlParams.get('path');
    //console.log('  URL path parameter:', urlPath);
    //console.log('===========================================');
    
    // 确保 path 始终是字符串，优先使用传入的参数，如果为空则尝试从URL获取
    let finalPath = (path === null || path === undefined || path === 'null' || path === 'undefined' || path === '') ? '' : String(path);
    
    // 如果传入的path为空，但URL中有path参数，使用URL中的path
    if (finalPath === '' && urlPath) {
        finalPath = urlPath;
        //console.log('Using path from URL instead:', finalPath);
    }
    
    currentPath = finalPath;
    uploadUrl = url;
    
    //console.log('FINAL currentPath set to:', currentPath);
    //console.log('currentPath type:', typeof currentPath);
    //console.log('currentPath length:', currentPath.length);
    //console.log('Is empty?:', currentPath === '');
    //console.log('===========================================');

    initThemeSystem();

    // 恢复视图设置
    const savedView = localStorage.getItem('fileManagerView');
    if (savedView === 'list') {
        switchView('list');
    }
}

// Elements - 这些在DOM加载后获取
let dropOverlay, fileInput, uploadProgress, uploadProgressBar;

// 初始化DOM元素
function initDomElements() {
    dropOverlay = document.getElementById('dropOverlay');
    fileInput = document.getElementById('fileInput');
    uploadProgress = document.getElementById('uploadProgress');
    uploadProgressBar = document.getElementById('uploadProgressBar');
}

let dragCounter = 0;
let deleteItemPath = '';

// ============== 权限检查函数 ==============

/**
 * 检查用户是否对当前路径有写权限
 * @returns {boolean} true表示有权限，false表示无权限
 */
function hasWritePermission() {
    const userDepartment = window.userDepartment || '';
    const urlParams = new URLSearchParams(window.location.search);
    const currentPath = urlParams.get('path') || '';
    
    console.log('=== Permission Check ===');
    console.log('User Department:', userDepartment);
    console.log('Current Path:', currentPath);
    
    // 如果在根目录，不允许任何写操作
    if (!currentPath || currentPath === '') {
        console.log('Result: NO (root directory)');
        return false;
    }
    
    // 提取路径中的第一级文件夹（部门文件夹）
    const pathParts = currentPath.split(/[\\\/]/).filter(p => p);
    if (pathParts.length === 0) {
        console.log('Result: NO (empty path)');
        return false;
    }
    
    const targetDepartment = pathParts[0];
    console.log('Target Department:', targetDepartment);
    
    // 只有用户部门与目标部门匹配时才允许写操作
    const hasPermission = userDepartment.toLowerCase() === targetDepartment.toLowerCase();
    console.log('Result:', hasPermission ? 'YES' : 'NO');
    
    return hasPermission;
}

/**
 * 根据权限显示/隐藏按钮
 */
function checkAndUpdateButtonsVisibility() {
    const hasPermission = hasWritePermission();

    console.log('=== Updating Button Visibility ===');
    console.log('Has Write Permission:', hasPermission);

    // 获取所有需要权限的元素
    const uploadBtn = document.getElementById('uploadBtn');
    const newFolderBtn = document.getElementById('newFolderBtn');
    const deleteButtons = document.querySelectorAll('.fm-delete-btn, .delete-btn');
    const batchActionsArea = document.getElementById('batchActions');
    const selectAllContainer = document.querySelector('.fm-select-all-container');

    // 列表视图全选容器
    const listSelectAllContainer = document.getElementById('listSelectAllContainer');

    // 获取所有权限控制的容器（添加 .fm-write-permission-only 类）
    const allPermissionContainers = document.querySelectorAll('.fm-write-permission-only');

    if (hasPermission) {
        // 有权限：显示所有按钮和checkbox
        if (uploadBtn) uploadBtn.style.display = '';
        if (newFolderBtn) newFolderBtn.style.display = '';
        if (selectAllContainer) selectAllContainer.style.display = '';
        if (listSelectAllContainer) listSelectAllContainer.style.display = 'flex';
        if (batchActionsArea) batchActionsArea.style.display = 'none'; // 初始隐藏，有选择时显示

        allPermissionContainers.forEach(container => {
            container.style.display = '';
        });

        deleteButtons.forEach(btn => btn.style.display = '');
        console.log('Buttons enabled (user has write permission)');
    } else {
        // 无权限：隐藏所有写操作按钮和checkbox
        if (uploadBtn) uploadBtn.style.display = 'none';
        if (newFolderBtn) newFolderBtn.style.display = 'none';
        if (selectAllContainer) selectAllContainer.style.display = 'none';
        if (listSelectAllContainer) listSelectAllContainer.style.display = 'none';
        if (batchActionsArea) batchActionsArea.style.display = 'none';

        allPermissionContainers.forEach(container => {
            container.style.display = 'none';
        });

        deleteButtons.forEach(btn => btn.style.display = 'none');
        console.log('Buttons disabled (user has no write permission)');
    }
}

// 将函数导出到全局
window.hasWritePermission = hasWritePermission;
window.checkAndUpdateButtonsVisibility = checkAndUpdateButtonsVisibility;

// ============== 主题切换 ==============
window.toggleThemeNow = function () {
    try {
        const html = document.documentElement;
        let currentTheme = html.getAttribute('data-bs-theme') ||
            html.getAttribute('data-theme') ||
            localStorage.getItem('theme') ||
            'light';

        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        html.setAttribute('data-bs-theme', newTheme);
        html.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);

        const themeIcon = document.getElementById('themeIcon');
        if (themeIcon) {
            themeIcon.textContent = newTheme === 'light' ? '☀️' : '🌙';
        }

        return false;
    } catch (error) {
        console.error('Theme switch error:', error);
        return false;
    }
};

// 主题初始化
function initThemeSystem() {
    try {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-bs-theme', savedTheme);
        document.documentElement.setAttribute('data-theme', savedTheme);

        const themeIcon = document.getElementById('themeIcon');
        if (themeIcon) {
            themeIcon.textContent = savedTheme === 'light' ? '☀️' : '🌙';
        }
    } catch (error) {
        console.error('Theme init error:', error);
    }
}

// ============== 文件拖拽功能 ==============
function setupDragAndDrop() {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        document.addEventListener(eventName, preventDefaults, false);
    });

    document.addEventListener('dragenter', function (e) {
        if (e.dataTransfer.types && e.dataTransfer.types.includes('Files')) {
            dragCounter++;
            if (dragCounter === 1 && dropOverlay) {
                dropOverlay.classList.add('active');
            }
        }
    });

    document.addEventListener('dragleave', function (e) {
        dragCounter--;
        if (dragCounter === 0 && dropOverlay) {
            dropOverlay.classList.remove('active');
        }
    });

    // Handle file drop - 支持多文件与文件夹结构
    document.addEventListener('drop', async function (e) {
        dragCounter = 0;
        if (dropOverlay) dropOverlay.classList.remove('active');

        const items = e.dataTransfer.items;
        const files = e.dataTransfer.files;

        if (items && items.length > 0) {
            // 检查是否包含文件夹：若有则用带结构的逻辑，否则用多文件上传（保证多个文件都能上传）
            let hasDirectory = false;
            for (let i = 0; i < items.length; i++) {
                if (items[i].kind === 'file') {
                    const entry = items[i].webkitGetAsEntry ? items[i].webkitGetAsEntry() : null;
                    if (entry && entry.isDirectory) {
                        hasDirectory = true;
                        break;
                    }
                }
            }
            if (hasDirectory) {
                const filesWithStructure = await processItemsWithStructure(items);
                if (filesWithStructure.length > 0) {
                    handleFilesWithStructure(filesWithStructure);
                }
            } else if (files && files.length > 0) {
                // 纯多文件拖入：用 handleFiles 确保每个文件都上传
                handleFiles(files);
            }
        } else if (files && files.length > 0) {
            handleFiles(files);
        }
    });
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// ============== 文件夹结构处理 ==============
// 处理拖拽项目，保持文件夹结构
async function processItemsWithStructure(items) {
    const results = [];

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
            const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;

            if (entry) {
                // 处理文件夹或文件
                const itemResults = await processEntryWithStructure(entry, '');
                results.push(...itemResults);
            }
        }
    }

    return results;
}

// 处理单个条目（文件或文件夹）
async function processEntryWithStructure(entry, basePath) {
    const results = [];

    if (entry.isFile) {
        // 处理文件
        const file = await getFileFromEntry(entry);
        if (file) {
            results.push({
                file: file,
                relativePath: basePath ? `${basePath}/${entry.name}` : entry.name
            });
        }
    } else if (entry.isDirectory) {
        // 处理文件夹 - 递归处理
        const dirReader = entry.createReader();
        const entries = await readAllEntries(dirReader);

        // 处理文件夹中的每个条目
        const folderPath = basePath ? `${basePath}/${entry.name}` : entry.name;

        for (const subEntry of entries) {
            const subResults = await processEntryWithStructure(subEntry, folderPath);
            results.push(...subResults);
        }
    }

    return results;
}

// 读取目录中的所有条目
async function readAllEntries(dirReader) {
    const entries = [];

    return new Promise((resolve, reject) => {
        const readEntries = () => {
            dirReader.readEntries((batch) => {
                if (batch.length === 0) {
                    resolve(entries);
                    return;
                }

                entries.push(...batch);
                readEntries();
            }, reject);
        };

        readEntries();
    });
}

// 获取文件条目
function getFileFromEntry(fileEntry) {
    return new Promise((resolve, reject) => {
        fileEntry.file(resolve, reject);
    });
}

// ============== 文件操作函数 - 已修正为立即刷新 ==============

// Upload files with structure
function handleFilesWithStructure(filesWithStructure) {
    if (filesWithStructure.length === 0) return;

    const formData = new FormData();

    // 添加一个标记，表示这是带结构的文件上传
    formData.append('preserveStructure', 'true');

    for (let i = 0; i < filesWithStructure.length; i++) {
        const item = filesWithStructure[i];
        // 保持文件夹结构
        formData.append(`files[${i}].file`, item.file);
        formData.append(`files[${i}].relativePath`, item.relativePath);
    }

    if (uploadProgress) uploadProgress.classList.add('active');
    if (uploadProgressBar) uploadProgressBar.style.width = '0%';

    fetch(uploadUrl + '?path=' + encodeURIComponent(currentPath), {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (uploadProgress) uploadProgress.classList.remove('active');

            if (data.success) {
                // 上传成功，立即刷新页面
                window.location.reload();
            } else {
                showToast('Upload Failed', data.message, 'error');
            }
        })
        .catch(error => {
            if (uploadProgress) uploadProgress.classList.remove('active');
            console.error('Upload error:', error);
            showToast('Upload Error', 'Failed to upload files', 'error');
        });
}

// Upload files (传统方式)
function handleFiles(fileList) {
    if (fileList.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < fileList.length; i++) {
        formData.append('files', fileList[i]);
    }

    if (uploadProgress) uploadProgress.classList.add('active');
    if (uploadProgressBar) uploadProgressBar.style.width = '0%';

    fetch(uploadUrl + '?path=' + encodeURIComponent(currentPath), {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (uploadProgress) uploadProgress.classList.remove('active');

            if (data.success) {
                // 上传成功，立即刷新页面
                window.location.reload();
            } else {
                showToast('Upload Failed', data.message, 'error');
            }
        })
        .catch(error => {
            if (uploadProgress) uploadProgress.classList.remove('active');
            console.error('Upload error:', error);
            showToast('Upload Error', 'Failed to upload files', 'error');
        });
}

// Handle file input change
function setupFileInput() {
    if (!fileInput) return;

    fileInput.addEventListener('change', function (e) {
        if (this.files.length > 0) {
            handleFiles(this.files);
        }
        this.value = '';
    });
}

// Create folder
function createFolder() {
    console.log('===========================================');
    console.log('=== CREATE FOLDER DEBUG (CLIENT) ===');
    console.log('===========================================');

    const folderNameInput = document.getElementById('folderNameInput');
    if (!folderNameInput) {
        console.error('folderNameInput not found!');
        return;
    }

    let folderName = folderNameInput.value.trim();
    console.log('Original folder name:', folderName);

    // 清理文件夹名：移除控制字符
    folderName = folderName.replace(/[\x00-\x1F\x7F]/g, '');
    console.log('Cleaned folder name:', folderName);

    if (!folderName) {
        showToast('Invalid Input', 'Please enter a valid folder name', 'warning');
        return;
    }

    // ========== 关键修复：从URL重新读取当前路径 ==========
    const urlParams = new URLSearchParams(window.location.search);
    const urlPath = urlParams.get('path') || '';
    
    console.log('-------------------------------------------');
    console.log('PATH CHECK:');
    console.log('  Global currentPath:', currentPath);
    console.log('  URL path parameter:', urlPath);
    console.log('  Will use:', urlPath);
    console.log('  Folder to create:', folderName);
    console.log('-------------------------------------------');
    
    // 使用URL中的path参数，而不是全局的currentPath
    const pathToUse = urlPath;

    // 使用 URLSearchParams 确保正确编码
    const params = new URLSearchParams();
    params.append('path', pathToUse);
    params.append('folderName', folderName);

    const fullUrl = buildAppUrl('Home/CreateFolder') + '?' + params.toString();
    console.log('Request URL:', fullUrl);
    console.log('===========================================');

    fetch(fullUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    })
        .then(response => {
            console.log('Response status:', response.status);
            console.log('Response ok:', response.ok);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('===========================================');
            console.log('Server Response:', data);
            console.log('===========================================');
            
            if (data.success) {
                hideCreateFolderModal();
                // 立即刷新页面以显示新文件夹
                window.location.reload();
            } else {
                showToast('Error', data.message || 'Failed to create folder', 'error');
            }
        })
        .catch(error => {
            console.error('Create folder error:', error);
            console.error('Error details:', error.message, error.stack);
            showToast('Error', `Network error: ${error.message}`, 'error');
        });
}

// Confirm delete
function confirmDelete() {
    if (!deleteItemPath) return;

    const formData = new FormData();
    formData.append('path', deleteItemPath);

    fetch(buildAppUrl('Home/Delete'), {
        method: 'POST',
        body: formData
    })
        .then(response => {
            console.log('Delete response status:', response.status);
            console.log('Delete response ok:', response.ok);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Delete response data:', data);
            
            if (data.success) {
                hideDeleteModal();
                // 立即刷新页面以反映删除操作
                window.location.reload();
            } else {
                showToast('Error', data.message || 'Failed to delete', 'error');
            }
        })
        .catch(error => {
            console.error('Delete error:', error);
            console.error('Error details:', error.message, error.stack);
            showToast('Error', `Network error: ${error.message}`, 'error');
        });
}

// ============== 核心：简化的刷新函数 ==============

// 主要的刷新函数 - 直接重新加载页面
function refreshFileListAPI() {
    if (isRefreshing) {
        console.log('Already refreshing, skipping...');
        return;
    }

    console.log('Refreshing file list by reloading page...');
    isRefreshing = true;

    // 直接重新加载当前页面
    window.location.reload();
}

// 旧的方法 - 保留作为备用
function refreshFileListWithoutReload() {
    console.log('Using fallback: reload page...');
    window.location.reload();
}

// 更新文件数量显示
function updateFileCount() {
    const filesContainer = document.querySelector('.fm-files-container');
    if (!filesContainer) return;

    const folders = filesContainer.querySelectorAll('.fm-badge-folder, .fm-grid-item-icon.fm-icon-folder').length;
    const files = filesContainer.querySelectorAll('.fm-badge-file, .fm-grid-item-icon:not(.fm-icon-folder)').length;

    const countElement = filesContainer.querySelector('.fm-files-count');
    if (countElement) {
        countElement.textContent = `${folders} folders, ${files} files`;
    }
}

// 恢复选中状态
function restoreSelection(selectedPaths) {
    selectedItems.clear();

    selectedPaths.forEach(path => {
        const listItem = document.querySelector(`.fm-list-item[data-path="${escapeHtml(path)}"]`);
        if (listItem) {
            listItem.classList.add('selected');
            const checkbox = listItem.querySelector('.fm-list-checkbox');
            if (checkbox) checkbox.classList.add('checked');
            selectedItems.add(path);
        }
    });

    updateBatchActions();
}

// HTML转义函数
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============== 批量选择功能 ==============

// 切换项目选择状态
function toggleItemSelection(checkboxContainer) {
    const listItem = checkboxContainer.closest('.fm-list-item');
    const checkbox = checkboxContainer.querySelector('.fm-list-checkbox');
    const itemPath = listItem.dataset.path;

    if (listItem.classList.contains('selected')) {
        // 取消选择
        listItem.classList.remove('selected');
        checkbox.classList.remove('checked');
        selectedItems.delete(itemPath);
    } else {
        // 选择
        listItem.classList.add('selected');
        checkbox.classList.add('checked');
        selectedItems.add(itemPath);
    }

    // 更新批量操作按钮状态
    updateBatchActions();
}

// 更新批量操作按钮状态
function updateBatchActions() {
    const batchActions = document.getElementById('batchActions');
    const selectedNumber = document.getElementById('selectedNumber');
    const batchDeleteBtn = document.getElementById('batchDeleteBtn');
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    const selectAllHeader = document.getElementById('selectAllHeader');

    if (selectedItems.size > 0) {
        // 显示批量操作区域
        if (batchActions) batchActions.style.display = 'flex';

        // 更新选中数量
        if (selectedNumber) selectedNumber.textContent = selectedItems.size;

        // 更新批量删除按钮文本
        if (batchDeleteBtn) {
            batchDeleteBtn.title = `Delete ${selectedItems.size} selected item(s)`;
        }
    } else {
        // 隐藏批量操作区域
        if (batchActions) batchActions.style.display = 'none';
    }

    // 更新全选复选框状态（列表视图）
    if (selectAllCheckbox) {
        const listItems = document.querySelectorAll('.fm-list-item');
        const checkedItems = document.querySelectorAll('.fm-list-item.selected');

        if (listItems.length === checkedItems.length && listItems.length > 0) {
            selectAllCheckbox.classList.add('checked');
        } else {
            selectAllCheckbox.classList.remove('checked');
        }
    }

    // 更新全选头部的状态
    if (selectAllHeader) {
        const totalItems = getTotalItemsCount();
        const isAllSelected = selectedItems.size === totalItems && totalItems > 0;

        if (isAllSelected) {
            selectAllHeader.classList.add('checked');
        } else {
            selectAllHeader.classList.remove('checked');
        }
    }
}

// 获取总项目数量
function getTotalItemsCount() {
    const listItems = document.querySelectorAll('.fm-list-item').length;
    const gridItems = document.querySelectorAll('.fm-grid-item').length;
    return Math.max(listItems, gridItems);
}

// 全选/取消全选（适用于列表视图和网格视图）
function toggleSelectAll() {
    const selectAllHeader = document.getElementById('selectAllHeader');
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    const listItems = document.querySelectorAll('.fm-list-item');
    const gridItems = document.querySelectorAll('.fm-grid-item');

    // 确定当前是否是全选状态
    let isCurrentlyAllSelected = false;
    if (selectAllHeader) {
        isCurrentlyAllSelected = selectAllHeader.classList.contains('checked');
    } else if (selectAllCheckbox) {
        isCurrentlyAllSelected = selectAllCheckbox.classList.contains('checked');
    }

    if (isCurrentlyAllSelected) {
        // 取消全选
        clearSelection();
    } else {
        // 全选
        selectAllItems();
    }

    // 更新批量操作按钮
    updateBatchActions();
}

// 选择所有项目（列表视图和网格视图）
function selectAllItems() {
    selectedItems.clear();

    // 选择所有列表视图项目
    document.querySelectorAll('.fm-list-item').forEach(item => {
        const itemPath = item.dataset.path;
        item.classList.add('selected');
        const checkbox = item.querySelector('.fm-list-checkbox');
        if (checkbox) checkbox.classList.add('checked');
        if (itemPath) selectedItems.add(itemPath);
    });

    // 选择所有网格视图项目
    document.querySelectorAll('.fm-grid-item').forEach(gridItem => {
        gridItem.classList.add('selected');
        const checkbox = gridItem.querySelector('.fm-grid-checkbox');
        if (checkbox) checkbox.classList.add('checked');

        const itemPath = gridItem.dataset.path;
        if (itemPath) {
            selectedItems.add(itemPath);
        }
    });

    // 更新全选头部状态
    const selectAllHeader = document.getElementById('selectAllHeader');
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');

    if (selectAllHeader) {
        selectAllHeader.classList.add('checked');
    }
    if (selectAllCheckbox) {
        selectAllCheckbox.classList.add('checked');
    }
}

// 批量删除选中的项目
function batchDelete() {
    if (selectedItems.size === 0) {
        showToast('No Selection', 'Please select items to delete', 'warning');
        return;
    }

    showBatchDeleteModal();
}

// 显示批量删除确认模态框
// Delete Modal Functions
function showDeleteModal(name, path) {
    deleteItemPath = path;

    const modal = document.createElement('div');
    modal.className = 'fm-modal-overlay active';
    modal.id = 'deleteModal';

    modal.innerHTML = `
        <div class="fm-modal-box">
            <div class="fm-modal-icon-header danger">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
            </div>
            <div class="fm-modal-content">
                <h3>Confirm Delete</h3>
                <p>Are you sure you want to delete "<strong>${name}</strong>"?</p>
                <p style="color: var(--text-secondary); font-size: 14px; margin-top: 12px;">This action cannot be undone.</p>
            </div>
            <div class="fm-modal-actions">
                <button class="fm-btn-text" onclick="hideDeleteModal()">Cancel</button>
                <button class="fm-btn-danger" onclick="confirmDelete()">Delete</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

function hideDeleteModal() {
    const modal = document.getElementById('deleteModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
    deleteItemPath = '';
}

function showBatchDeleteModal() {
    const modal = document.getElementById('batchDeleteModal');
    const countElement = document.getElementById('batchDeleteCount');

    if (countElement) {
        countElement.textContent = selectedItems.size;
    }

    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => {
            modal.classList.add('active');
        }, 10);
    }
}

// 隐藏批量删除确认模态框
function hideBatchDeleteModal() {
    const modal = document.getElementById('batchDeleteModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
}

// 确认批量删除
function confirmBatchDelete() {
    const batchDeleteBtn = document.getElementById('batchDeleteBtn');
    const originalContent = batchDeleteBtn.innerHTML;
    batchDeleteBtn.innerHTML = '<span class="fm-btn-icon">⏳</span> Deleting...';
    batchDeleteBtn.disabled = true;

    // 创建删除请求数组
    const deletePromises = Array.from(selectedItems).map(itemPath => {
        const formData = new FormData();
        formData.append('path', itemPath);

        return fetch(buildAppUrl('Home/Delete'), {
            method: 'POST',
            body: formData
        })
            .then(response => response.json());
    });

    // 并行执行所有删除请求
    Promise.all(deletePromises)
        .then(results => {
            const successCount = results.filter(r => r.success).length;
            const failedCount = results.filter(r => !r.success).length;

            // 隐藏模态框
            hideBatchDeleteModal();

            // 清除选择
            clearSelection();

            if (successCount > 0) {
                showToast('Success', `Successfully deleted ${successCount} item(s)`, 'success');
                // 延迟刷新页面
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            }

            if (failedCount > 0) {
                showToast('Partial Error', `Failed to delete ${failedCount} item(s)`, 'error');
            }
        })
        .catch(error => {
            console.error('Batch delete error:', error);
            hideBatchDeleteModal();
            showToast('Error', 'Failed to delete items', 'error');
        })
        .finally(() => {
            // 恢复按钮状态
            if (batchDeleteBtn) {
                batchDeleteBtn.innerHTML = originalContent;
                batchDeleteBtn.disabled = false;
            }
        });
}

// 清除所有选择
function clearSelection() {
    selectedItems.clear();

    // 移除所有选中的样式（列表视图）
    document.querySelectorAll('.fm-list-item.selected').forEach(item => {
        item.classList.remove('selected');
    });

    // 移除所有选中的样式（网格视图）
    document.querySelectorAll('.fm-grid-item.selected').forEach(gridItem => {
        gridItem.classList.remove('selected');

        // 修复：清除网格视图的checkbox选中状态
        const checkbox = gridItem.querySelector('.fm-grid-checkbox');
        if (checkbox) {
            checkbox.classList.remove('checked');
        }
    });

    // 移除列表视图的checkbox选中状态
    document.querySelectorAll('.fm-list-checkbox.checked').forEach(checkbox => {
        checkbox.classList.remove('checked');
    });

    // 移除网格视图的checkbox选中状态（额外确保）
    document.querySelectorAll('.fm-grid-checkbox.checked').forEach(checkbox => {
        checkbox.classList.remove('checked');
    });

    // 更新全选复选框
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (selectAllCheckbox) {
        selectAllCheckbox.classList.remove('checked');
    }

    // 更新全选头部
    const selectAllHeader = document.getElementById('selectAllHeader');
    if (selectAllHeader) {
        selectAllHeader.classList.remove('checked');
    }

    // 隐藏批量操作区域
    const batchActions = document.getElementById('batchActions');
    if (batchActions) batchActions.style.display = 'none';

    // 重置选中数量
    const selectedNumber = document.getElementById('selectedNumber');
    if (selectedNumber) selectedNumber.textContent = '0';
}

// ============== 重新绑定事件监听器 ==============
function reattachEventListeners() {
    // 为网格视图的删除按钮重新绑定事件
    document.querySelectorAll('.fm-delete-btn').forEach(btn => {
        btn.onclick = function (e) {
            e.stopPropagation();
            const gridItem = this.closest('.fm-grid-item');
            const itemName = gridItem.querySelector('.fm-grid-item-name').textContent;
            const itemPath = gridItem.dataset?.path || '';

            if (itemPath) {
                showDeleteModal(itemName, decodeURIComponent(itemPath));
            } else {
                // 从onclick属性中提取路径
                const onClickAttr = gridItem.getAttribute('onclick');
                if (onClickAttr) {
                    const matches = onClickAttr.match(/'(.*?)'/g);
                    if (matches && matches[0]) {
                        const url = matches[0].replace(/'/g, '');
                        const isFolder = url.includes('Index');
                        const path = isFolder ?
                            url.split('path=')[1] :
                            url.split('path=')[1];

                        if (path) {
                            showDeleteModal(itemName, decodeURIComponent(path));
                        }
                    }
                }
            }
        };
    });

    // 为列表视图打开按钮重新绑定事件
    document.querySelectorAll('.fm-list-actions .open-icon-btn').forEach(btn => {
        btn.onclick = function (e) {
            e.stopPropagation();
            const listItem = this.closest('.fm-list-item');
            const itemPath = listItem.dataset.path;
            window.location.href = buildAppUrl('Home/Index') + '?path=' + encodeURIComponent(itemPath);
        };
    });

    // 为列表视图下载按钮重新绑定事件
    document.querySelectorAll('.fm-list-actions .download-icon-btn').forEach(btn => {
        btn.onclick = function (e) {
            e.stopPropagation();
            const listItem = this.closest('.fm-list-item');
            const itemPath = listItem.dataset.path;
            window.location.href = buildAppUrl('Home/Download') + '?path=' + encodeURIComponent(itemPath);
        };
    });

    // 为列表视图删除按钮重新绑定事件
    document.querySelectorAll('.fm-list-actions .delete-icon-btn').forEach(btn => {
        btn.onclick = function (e) {
            e.stopPropagation();
            const listItem = this.closest('.fm-list-item');
            const name = listItem.dataset.name;
            const path = listItem.dataset.path;
            showDeleteModal(name, path);
        };
    });

    // 为列表视图复选框重新绑定事件
    document.querySelectorAll('.fm-list-checkbox-container').forEach(container => {
        container.onclick = function (e) {
            e.stopPropagation();
            toggleItemSelection(this);
        };
    });

    const listSelectAllContainer = document.getElementById('listSelectAllContainer');
    if (listSelectAllContainer) {
        listSelectAllContainer.onclick = function (e) {
            e.stopPropagation();
            toggleSelectAll();
        };
    }

    // 为全选复选框绑定事件
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (selectAllCheckbox) {
        selectAllCheckbox.onclick = function (e) {
            e.stopPropagation();
            toggleSelectAll();
        };
    }

    // 为全选头部按钮绑定事件
    const selectAllHeader = document.getElementById('selectAllHeader');
    if (selectAllHeader) {
        selectAllHeader.onclick = function (e) {
            e.stopPropagation();
            toggleSelectAll();
        };
    }

    // 为批量删除按钮绑定事件
    const batchDeleteBtn = document.getElementById('batchDeleteBtn');
    if (batchDeleteBtn) {
        batchDeleteBtn.onclick = function (e) {
            e.stopPropagation();
            batchDelete();
        };
    }
}

reattachGridEvents();

// ============== 其他辅助函数 ==============
// 保持兼容性的旧函数
async function getAllFileEntries(dataTransferItemList) {
    // 回退到新函数
    return processItemsWithStructure(dataTransferItemList);
}

async function readAllDirectoryEntries(directoryReader) {
    // 回退到新函数
    return readAllEntries(directoryReader);
}

function readEntriesPromise(directoryReader) {
    return new Promise((resolve, reject) => {
        directoryReader.readEntries(resolve, reject);
    });
}

// Delete Modal Functions
function showDeleteModal(name, path) {
    deleteItemPath = path;
    const deleteItemName = document.getElementById('deleteItemName');
    if (deleteItemName) {
        deleteItemName.textContent = name;
    }
    const deleteModal = document.getElementById('deleteModal');
    if (deleteModal) {
        deleteModal.classList.add('active');
    }
}

function hideDeleteModal() {
    const deleteModal = document.getElementById('deleteModal');
    if (deleteModal) {
        deleteModal.classList.remove('active');
    }
    deleteItemPath = '';
}

// Create Folder Modal Functions
function showCreateFolderModal() {
    const modal = document.getElementById('createFolderModal');
    const input = document.getElementById('folderNameInput');

    if (modal) modal.classList.add('active');
    if (input) {
        input.value = '';
        input.focus();
    }
}

function hideCreateFolderModal() {
    const modal = document.getElementById('createFolderModal');
    if (modal) modal.classList.remove('active');
}

// View switching
function switchView(view) {
    const gridView = document.getElementById('gridView');
    const listView = document.getElementById('listView');
    const gridBtn = document.getElementById('viewGrid');
    const listBtn = document.getElementById('viewList');

    if (view === 'grid') {
        if (gridView) gridView.style.display = 'grid';
        if (listView) listView.style.display = 'none';
        if (gridBtn) gridBtn.classList.add('active');
        if (listBtn) listBtn.classList.remove('active');
        localStorage.setItem('fileManagerView', 'grid');

        // 切换到网格视图时清除选择
        clearSelection();

        // 初始化网格视图的分页和搜索
        setTimeout(() => {
            if (typeof window.initializePaginationAndSearch === 'function') {
                window.initializePaginationAndSearch();
            }
        }, 50);
    } else {
        if (gridView) gridView.style.display = 'none';
        if (listView) listView.style.display = 'flex';
        if (listBtn) listBtn.classList.add('active');
        if (gridBtn) gridBtn.classList.remove('active');
        localStorage.setItem('fileManagerView', 'list');

        // 初始化列表视图的分页和搜索
        setTimeout(() => {
            if (typeof window.initializeListViewFeatures === 'function') {
                window.initializeListViewFeatures();
            }
        }, 50);
    }
}

// Navigate to item
function navigateToItem(url) {
    // 从URL中提取路径以便调试
    const urlObj = new URL(url, window.location.origin);
    const pathParam = urlObj.searchParams.get('path');
    console.log('Navigating to:', url, 'Path:', pathParam);
    window.location.href = url;
}

// Navigate based on element's parent item
function navigateToItemByElement(element) {
    const listItem = element.closest('.fm-list-item');
    if (listItem && !listItem.classList.contains('selected')) {
        const itemType = listItem.dataset.type;
        const itemPath = listItem.dataset.path;

        if (itemType === 'Folder') {
            window.location.href = buildAppUrl('Home/Index') + '?path=' + encodeURIComponent(itemPath);
        } else {
            window.location.href = buildAppUrl('Home/Download') + '?path=' + encodeURIComponent(itemPath);
        }
    }
}

// 旧的函数（保持兼容性）
function toggleItemSelectionOld(checkboxContainer) {
    toggleItemSelection(checkboxContainer);
}

// Show delete modal from element
function showDeleteModalFromElement(button) {
    const listItem = button.closest('.fm-list-item');
    const name = listItem.dataset.name;
    const path = listItem.dataset.path;
    showDeleteModal(name, path);
}

// ============== 页面加载完成后初始化 ==============
document.addEventListener('DOMContentLoaded', function () {
    console.log('File Manager Initializing...');

    // 初始化DOM元素
    initDomElements();

    // 设置拖拽功能
    setupDragAndDrop();

    // 设置文件输入
    setupFileInput();

    // 设置其他事件监听器
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            hideCreateFolderModal();
            hideDeleteModal();
        }
    });

    const createFolderModal = document.getElementById('createFolderModal');
    if (createFolderModal) {
        createFolderModal.addEventListener('click', function (e) {
            if (e.target === this) hideCreateFolderModal();
        });
    }

    const deleteModal = document.getElementById('deleteModal');
    if (deleteModal) {
        deleteModal.addEventListener('click', function (e) {
            if (e.target === this) hideDeleteModal();
        });
    }

    const folderNameInput = document.getElementById('folderNameInput');
    if (folderNameInput) {
        folderNameInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                createFolder();
            }
        });
    }

    // 初始化批量选择功能
    reattachEventListeners();

    // 自动更新年份
    const yearElement = document.getElementById('year');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }

    console.log('File Manager Initialized Successfully');
});

function toggleGridItemSelection(gridItem, checkbox) {
    const itemPath = gridItem.dataset.path;
    const itemName = gridItem.dataset.name;
    const itemType = gridItem.dataset.type;

    if (gridItem.classList.contains('selected')) {
        // 取消选择
        gridItem.classList.remove('selected');
        if (checkbox) checkbox.classList.remove('checked');
        selectedItems.delete(itemPath);
    } else {
        // 选择
        gridItem.classList.add('selected');
        if (checkbox) checkbox.classList.add('checked');
        selectedItems.add(itemPath);
    }

    // 更新批量操作按钮状态
    updateBatchActions();
}

function reattachGridEvents() {
    // 为网格视图的checkbox容器绑定事件
    document.querySelectorAll('.fm-grid-checkbox-container').forEach(container => {
        container.onclick = function (e) {
            e.stopPropagation();
            const gridItem = this.closest('.fm-grid-item');
            const checkbox = this.querySelector('.fm-grid-checkbox');
            toggleGridItemSelection(gridItem, checkbox);
        };
    });

    // 为网格项目的其他部分绑定点击事件（整行点击）
    document.querySelectorAll('.fm-grid-item').forEach(gridItem => {
        // 保存原始的onclick处理
        const originalOnClick = gridItem.onclick;

        // 覆盖onclick事件
        gridItem.onclick = function (e) {
            // 如果点击的是checkbox容器，不要处理（因为已经有单独的事件）
            if (e.target.closest('.fm-grid-checkbox-container')) {
                return;
            }

            // 如果有checkbox，触发选中/取消选中
            const checkboxContainer = gridItem.querySelector('.fm-grid-checkbox-container');
            if (checkboxContainer) {
                const checkbox = checkboxContainer.querySelector('.fm-grid-checkbox');
                toggleGridItemSelection(gridItem, checkbox);
            }

            // 执行原始的处理（导航）
            if (originalOnClick) {
                originalOnClick.call(this, e);
            }
        };
    });
}

// ============== 全局导出 ==============
// 将所有必要的函数导出到全局作用域
window.refreshFileList = refreshFileListAPI;
window.refreshFileListWithoutReload = refreshFileListWithoutReload;
window.showToast = showToast;
window.createFolder = createFolder;
window.confirmDelete = confirmDelete;
window.showCreateFolderModal = showCreateFolderModal;
window.hideCreateFolderModal = hideCreateFolderModal;
window.showDeleteModal = showDeleteModal;
window.hideDeleteModal = hideDeleteModal;
window.batchDelete = batchDelete;
window.showBatchDeleteModal = showBatchDeleteModal;
window.hideBatchDeleteModal = hideBatchDeleteModal;
window.confirmBatchDelete = confirmBatchDelete;
window.showLogoutModal = showLogoutModal;
window.hideLogoutModal = hideLogoutModal;
window.confirmLogout = confirmLogout;
window.clearSelection = clearSelection;
window.switchView = switchView;
window.navigateToItem = navigateToItem;
window.navigateToItemByElement = navigateToItemByElement;
window.toggleSelectAll = toggleSelectAll;
window.selectAllItems = selectAllItems;
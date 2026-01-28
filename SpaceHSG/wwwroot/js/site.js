// wwwroot/js/site.js - 添加全选功能版本

// 全局变量 - 这些需要在页面中设置
let currentPath = '';
let uploadUrl = '';
let selectedItems = new Set(); // 存储选中的项目
let isRefreshing = false; // 防止重复刷新

// 初始化函数，需要在页面加载后调用
function initializeFileManager(path, url) {
    console.log('Initializing File Manager with path:', path, 'upload URL:', url);
    currentPath = path;
    uploadUrl = url;

    initThemeSystem();

    // 恢复视图设置
    const savedView = localStorage.getItem('fileManagerView');
    if (savedView === 'list') {
        switchView('list');
    }

    // 调试信息
    console.log('Current path set to:', currentPath);
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

    // Handle file drop - 修改为支持文件夹结构
    document.addEventListener('drop', async function (e) {
        dragCounter = 0;
        if (dropOverlay) dropOverlay.classList.remove('active');

        const items = e.dataTransfer.items;

        if (items && items.length > 0) {
            // 使用新的函数来处理文件和文件夹
            const filesWithStructure = await processItemsWithStructure(items);
            if (filesWithStructure.length > 0) {
                handleFilesWithStructure(filesWithStructure);
            }
        } else {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleFiles(files);
            }
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
                showToast('Upload Successful', data.message, 'success');
                // 延迟一点时间然后刷新，确保服务器处理完成
                setTimeout(() => {
                    refreshFileListAPI();
                }, 500);
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
                showToast('Upload Successful', data.message, 'success');
                // 延迟一点时间然后刷新，确保服务器处理完成
                setTimeout(() => {
                    refreshFileListAPI();
                }, 500);
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
    console.log('=== CREATE FOLDER DEBUG (CLIENT) ===');

    const folderNameInput = document.getElementById('folderNameInput');
    if (!folderNameInput) return;

    let folderName = folderNameInput.value.trim();
    console.log('Original folder name:', folderName);

    // 记录原始字符串的字符代码
    console.log('Folder name character codes:');
    for (let i = 0; i < folderName.length; i++) {
        console.log(`  [${i}]: '${folderName[i]}' = ${folderName.charCodeAt(i)}`);
    }

    // 清理文件夹名：移除控制字符
    folderName = folderName.replace(/[\x00-\x1F\x7F]/g, '');
    console.log('Cleaned folder name:', folderName);

    if (!folderName) {
        showToast('Invalid Input', 'Please enter a valid folder name', 'warning');
        return;
    }

    console.log('Current path:', currentPath);
    console.log('Sending request with params:');
    console.log('  path:', currentPath);
    console.log('  folderName:', folderName);

    // 使用 URLSearchParams 确保正确编码
    const params = new URLSearchParams();
    params.append('path', currentPath || '');
    params.append('folderName', folderName);

    fetch('/Home/CreateFolder?' + params.toString(), {
        method: 'POST'
    })
        .then(response => response.json())
        .then(data => {
            console.log('Create folder response:', data);
            if (data.success) {
                showToast('Success', data.message, 'success');
                hideCreateFolderModal();
                // 立即刷新文件列表
                setTimeout(() => {
                    refreshFileListAPI();
                }, 300);
            } else {
                showToast('Error', data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Create folder error:', error);
            showToast('Error', 'Network error occurred', 'error');
        })
        .finally(() => {
            console.log('=== END CREATE FOLDER DEBUG ===');
        });
}

// Confirm delete
function confirmDelete() {
    if (!deleteItemPath) return;

    const formData = new FormData();
    formData.append('path', deleteItemPath);

    fetch('/Home/Delete', {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showToast('Success', data.message, 'success');
                hideDeleteModal();
                // 立即刷新文件列表
                setTimeout(() => {
                    refreshFileListAPI();
                }, 300);
            } else {
                showToast('Error', data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Delete error:', error);
            showToast('Error', 'Network error occurred', 'error');
        });
}

// ============== 核心：修复的刷新函数 ==============

// 主要的刷新函数 - 使用API获取文件列表
function refreshFileListAPI() {
    if (isRefreshing) {
        console.log('Already refreshing, skipping...');
        return;
    }

    console.log('Refreshing file list via API...');
    isRefreshing = true;

    const filesContainer = document.querySelector('.fm-files-container');
    if (!filesContainer) {
        console.error('File container not found');
        isRefreshing = false;
        return;
    }

    // 保存当前选中状态
    const selectedPaths = Array.from(selectedItems);

    // 显示加载状态
    const originalContent = filesContainer.innerHTML;
    filesContainer.innerHTML = `
        <div class="fm-files-header">
            <div class="fm-header-left">
                <div class="fm-select-all-container">
                    <button class="fm-select-all-btn" id="selectAllHeader" title="Select all items">
                        <span class="fm-select-all-icon"></span>
                        All
                    </button>
                </div>
                <div class="fm-files-count">Refreshing...</div>
            </div>
        </div>
        <div class="fm-empty" style="padding: 40px 20px;">
            <div class="fm-spinner" style="margin: 0 auto 20px;"></div>
            <div class="fm-empty-text">Updating file list...</div>
        </div>
    `;

    // 使用专门的API端点获取文件列表
    fetch(`/Home/GetFilesHtml?path=${encodeURIComponent(currentPath)}&t=${new Date().getTime()}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.text();
        })
        .then(html => {
            // 检查返回的HTML是否有效
            if (!html || html.includes('fm-error') || html.includes('Error:')) {
                throw new Error('Invalid response from server');
            }

            // 更新整个文件容器内容
            filesContainer.innerHTML = `
                <div class="fm-files-header">
                    <div class="fm-header-left">
                        <div class="fm-select-all-container">
                            <button class="fm-select-all-btn" id="selectAllHeader" title="Select all items">
                                <span class="fm-select-all-icon"></span>
                                All
                            </button>
                        </div>
                        <div class="fm-files-count"></div>
                    </div>
                    <div class="fm-batch-actions" id="batchActions" style="display: none;">
                        <div class="fm-selected-count" id="selectedCount">
                            <span id="selectedNumber">0</span> selected
                        </div>
                        <button class="fm-btn fm-btn-danger" id="batchDeleteBtn" title="Delete selected items">
                            <span class="fm-btn-icon">🗑️</span>
                            Delete Selected
                        </button>
                    </div>
                </div>
                ${html}
            `;

            // 重新绑定事件
            reattachEventListeners();

            // 恢复视图设置
            const savedView = localStorage.getItem('fileManagerView');
            if (savedView === 'list') {
                switchView('list');
            }

            // 恢复选中状态
            if (selectedPaths.length > 0) {
                restoreSelection(selectedPaths);
            }

            // 更新文件数量显示
            updateFileCount();

            console.log('File list refreshed successfully via API');

            // 只在需要时显示成功提示
            if (!selectedPaths.length) {
                showToast('Updated', 'File list refreshed', 'success');
            }
        })
        .catch(error => {
            console.error('Error refreshing file list via API:', error);

            // 恢复原始内容
            filesContainer.innerHTML = originalContent;

            // 显示错误提示
            showToast('Refresh Error', 'Failed to refresh file list. Please try again.', 'error');
        })
        .finally(() => {
            isRefreshing = false;
        });
}
// 旧的方法作为后备方案
function refreshFileListWithoutReload() {
    console.log('Refreshing file list without reload...');

    const filesContainer = document.querySelector('.fm-files-container');
    if (!filesContainer) return;

    const originalContent = filesContainer.innerHTML;

    filesContainer.innerHTML = `
        <div class="fm-files-header">
            <div class="fm-files-count">Refreshing...</div>
        </div>
        <div class="fm-empty" style="padding: 40px 20px;">
            <div class="fm-spinner" style="margin: 0 auto 20px;"></div>
            <div class="fm-empty-text">Updating file list...</div>
        </div>
    `;

    setTimeout(() => {
        const pathParam = currentPath === '' ? '' : `?path=${encodeURIComponent(currentPath)}`;
        fetch(window.location.pathname + pathParam + '&t=' + new Date().getTime())
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.text();
            })
            .then(html => {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const newFilesContainer = doc.querySelector('.fm-files-container');

                if (newFilesContainer) {
                    filesContainer.innerHTML = newFilesContainer.innerHTML;
                    reattachEventListeners();

                    const savedView = localStorage.getItem('fileManagerView');
                    if (savedView === 'list') {
                        switchView('list');
                    }

                    showToast('Updated', 'File list refreshed', 'success');
                    console.log('File list refreshed successfully');
                } else {
                    throw new Error('Could not find file container');
                }
            })
            .catch(error => {
                console.error('Error refreshing file list:', error);
                showToast('Refreshing', 'Reloading page...', 'info');
                setTimeout(() => {
                    window.location.reload();
                }, 800);
            });
    }, 500);
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
        selectedItems.add(itemPath);
    });

    // 选择所有网格视图项目
    document.querySelectorAll('.fm-grid-item').forEach(item => {
        // 为网格项目添加选中状态
        item.classList.add('selected');

        // 尝试从data-path属性或onclick属性获取路径
        let itemPath = item.dataset?.path || '';
        if (!itemPath) {
            const onClickAttr = item.getAttribute('onclick');
            if (onClickAttr) {
                const matches = onClickAttr.match(/path=(.*?)(&|'|")/);
                if (matches && matches[1]) {
                    itemPath = decodeURIComponent(matches[1]);
                    // 添加到数据集以便后续使用
                    item.dataset.path = itemPath;
                }
            }
        }

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

    // 确认删除
    const confirmed = confirm(`Are you sure you want to delete ${selectedItems.size} selected item(s)?\nThis action cannot be undone.`);

    if (!confirmed) return;

    // 显示加载状态
    const batchDeleteBtn = document.getElementById('batchDeleteBtn');
    const originalContent = batchDeleteBtn.innerHTML;
    batchDeleteBtn.innerHTML = '<span class="fm-btn-icon">⏳</span> Deleting...';
    batchDeleteBtn.disabled = true;

    // 创建删除请求数组
    const deletePromises = Array.from(selectedItems).map(itemPath => {
        const formData = new FormData();
        formData.append('path', itemPath);

        return fetch('/Home/Delete', {
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

            // 显示结果
            if (failedCount === 0) {
                showToast('Success', `Successfully deleted ${successCount} item(s)`, 'success');
            } else {
                showToast('Partial Success',
                    `Deleted ${successCount} item(s), failed to delete ${failedCount} item(s)`,
                    'warning');
            }

            // 清除选择并刷新列表
            clearSelection();

            // 立即刷新文件列表
            setTimeout(() => {
                refreshFileListAPI();
            }, 500);
        })
        .catch(error => {
            console.error('Batch delete error:', error);
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
    document.querySelectorAll('.fm-grid-item.selected').forEach(item => {
        item.classList.remove('selected');
    });

    document.querySelectorAll('.fm-list-checkbox.checked').forEach(checkbox => {
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
            window.location.href = '/Home/Index?path=' + encodeURIComponent(itemPath);
        };
    });

    // 为列表视图下载按钮重新绑定事件
    document.querySelectorAll('.fm-list-actions .download-icon-btn').forEach(btn => {
        btn.onclick = function (e) {
            e.stopPropagation();
            const listItem = this.closest('.fm-list-item');
            const itemPath = listItem.dataset.path;
            window.location.href = '/Home/Download?path=' + encodeURIComponent(itemPath);
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
    } else {
        if (gridView) gridView.style.display = 'none';
        if (listView) listView.style.display = 'flex';
        if (listBtn) listBtn.classList.add('active');
        if (gridBtn) gridBtn.classList.remove('active');
        localStorage.setItem('fileManagerView', 'list');
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
            window.location.href = '/Home/Index?path=' + encodeURIComponent(itemPath);
        } else {
            window.location.href = '/Home/Download?path=' + encodeURIComponent(itemPath);
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
window.clearSelection = clearSelection;
window.switchView = switchView;
window.navigateToItem = navigateToItem;
window.navigateToItemByElement = navigateToItemByElement;
window.toggleSelectAll = toggleSelectAll;
window.selectAllItems = selectAllItems;
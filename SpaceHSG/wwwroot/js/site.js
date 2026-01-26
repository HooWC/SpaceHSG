// wwwroot/js/site.js

// 全局变量 - 这些需要在页面中设置
let currentPath = '';
let uploadUrl = '';

// 初始化函数，需要在页面加载后调用
function initializeFileManager(path, url) {
    currentPath = path;
    uploadUrl = url;

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

// Toast Notification System
function showToast(title, message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `fm-toast ${type}`;

    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    toast.innerHTML = `
        <div class="fm-toast-icon">${icons[type]}</div>
        <div class="fm-toast-content">
            <div class="fm-toast-title">${title}</div>
            <div class="fm-toast-message">${message}</div>
        </div>
        <button class="fm-toast-close" onclick="this.parentElement.remove()">×</button>
    `;

    container.appendChild(toast);

    // Auto remove after 5 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

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
            if (dragCounter === 1) {
                dropOverlay.classList.add('active');
            }
        }
    });

    document.addEventListener('dragleave', function (e) {
        dragCounter--;
        if (dragCounter === 0) {
            dropOverlay.classList.remove('active');
        }
    });

    // Handle file drop
    document.addEventListener('drop', async function (e) {
        dragCounter = 0;
        dropOverlay.classList.remove('active');

        const items = e.dataTransfer.items;

        if (items) {
            const files = await getAllFileEntries(items);
            if (files.length > 0) {
                handleFiles(files);
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

// ============== 文件操作函数 ==============
// Upload files
function handleFiles(fileList) {
    if (fileList.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < fileList.length; i++) {
        formData.append('files', fileList[i]);
    }

    uploadProgress.classList.add('active');
    uploadProgressBar.style.width = '0%';

    fetch(uploadUrl + '?path=' + encodeURIComponent(currentPath), {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            uploadProgress.classList.remove('active');

            if (data.success) {
                showToast('Upload Successful', data.message, 'success');
                refreshFileListWithoutReload();
            } else {
                showToast('Upload Failed', data.message, 'error');
            }
        })
        .catch(error => {
            uploadProgress.classList.remove('active');
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
    const folderName = document.getElementById('folderNameInput').value.trim();

    if (!folderName) {
        showToast('Invalid Input', 'Please enter a folder name', 'warning');
        return;
    }

    // 注意：这里需要使用完整URL，所以在页面中定义这个URL
    fetch('/Home/CreateFolder?path=' + encodeURIComponent(currentPath) + '&folderName=' + encodeURIComponent(folderName), {
        method: 'POST'
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showToast('Success', data.message, 'success');
                hideCreateFolderModal();
                refreshFileListWithoutReload();
            } else {
                showToast('Error', data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Create folder error:', error);
            showToast('Error', 'Network error occurred', 'error');
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
                refreshFileListWithoutReload();
            } else {
                showToast('Error', data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Delete error:', error);
            showToast('Error', 'Network error occurred', 'error');
        });
}

// ============== 核心：无刷新更新文件列表 ==============
function refreshFileListWithoutReload() {
    console.log('Refreshing file list without reload...');

    // 1. 获取当前文件容器
    const filesContainer = document.querySelector('.fm-files-container');
    if (!filesContainer) return;

    // 2. 保存原始内容作为备份
    const originalContent = filesContainer.innerHTML;

    // 3. 显示加载状态
    filesContainer.innerHTML = `
        <div class="fm-files-header">
            <div class="fm-files-count">Refreshing...</div>
        </div>
        <div class="fm-empty" style="padding: 40px 20px;">
            <div class="fm-spinner" style="margin: 0 auto 20px;"></div>
            <div class="fm-empty-text">Updating file list...</div>
        </div>
    `;

    // 4. 延迟执行，确保服务器有足够时间处理
    setTimeout(() => {
        // 5. 使用fetch重新获取页面内容
        const pathParam = currentPath === '' ? '' : `?path=${encodeURIComponent(currentPath)}`;
        fetch(window.location.pathname + pathParam + '&t=' + new Date().getTime())
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.text();
            })
            .then(html => {
                // 6. 解析HTML，提取文件列表部分
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const newFilesContainer = doc.querySelector('.fm-files-container');

                if (newFilesContainer) {
                    // 7. 替换当前文件容器内容
                    filesContainer.innerHTML = newFilesContainer.innerHTML;

                    // 8. 重新绑定事件
                    reattachEventListeners();

                    // 9. 恢复视图设置
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

                // 失败时回退到页面重载
                showToast('Refreshing', 'Reloading page...', 'info');
                setTimeout(() => {
                    window.location.reload();
                }, 800);
            });
    }, 500);
}

// 重新绑定事件监听器
function reattachEventListeners() {
    // 为删除按钮重新绑定事件
    document.querySelectorAll('.fm-delete-btn').forEach(btn => {
        btn.onclick = function (e) {
            e.stopPropagation();
            const gridItem = this.closest('.fm-grid-item');
            const itemName = gridItem.querySelector('.fm-grid-item-name').textContent;

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
        };
    });

    // 为列表视图删除按钮重新绑定事件
    document.querySelectorAll('.fm-list-actions .delete-btn').forEach(btn => {
        btn.onclick = function (e) {
            e.stopPropagation();
            const listItem = this.closest('.fm-list-item');
            const name = listItem.dataset.name;
            const path = listItem.dataset.path;
            showDeleteModal(name, path);
        };
    });
}

// ============== 其他辅助函数 ==============
// 递归获取目录条目
async function getAllFileEntries(dataTransferItemList) {
    let fileEntries = [];
    let queue = [];

    for (let i = 0; i < dataTransferItemList.length; i++) {
        const item = dataTransferItemList[i];
        if (item.kind === 'file') {
            const entry = item.webkitGetAsEntry();
            if (entry) queue.push(entry);
        }
    }

    while (queue.length > 0) {
        let entry = queue.shift();
        if (entry.isFile) {
            const file = await getFileFromEntry(entry);
            fileEntries.push(file);
        } else if (entry.isDirectory) {
            const entries = await readAllDirectoryEntries(entry.createReader());
            queue.push(...entries);
        }
    }

    return fileEntries;
}

async function readAllDirectoryEntries(directoryReader) {
    let entries = [];
    let readEntries = await readEntriesPromise(directoryReader);
    while (readEntries.length > 0) {
        entries.push(...readEntries);
        readEntries = await readEntriesPromise(directoryReader);
    }
    return entries;
}

function readEntriesPromise(directoryReader) {
    return new Promise((resolve, reject) => {
        directoryReader.readEntries(resolve, reject);
    });
}

function getFileFromEntry(fileEntry) {
    return new Promise((resolve, reject) => {
        fileEntry.file(resolve, reject);
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

// Toggle item selection with checkbox
function toggleItemSelection(checkboxContainer) {
    const listItem = checkboxContainer.closest('.fm-list-item');
    const checkbox = checkboxContainer.querySelector('.fm-list-checkbox');

    if (listItem) listItem.classList.toggle('selected');
    if (checkbox) checkbox.classList.toggle('checked');
}

// Show delete modal from element
function showDeleteModalFromElement(button) {
    const listItem = button.closest('.fm-list-item');
    const name = listItem.dataset.name;
    const path = listItem.dataset.path;
    showDeleteModal(name, path);
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function () {
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

    // 自动更新年份
    document.addEventListener('DOMContentLoaded', function () {
        const yearElement = document.getElementById('year');
        if (yearElement) {
            yearElement.textContent = new Date().getFullYear();
        }
    });
});
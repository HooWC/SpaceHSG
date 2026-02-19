(function() {
    var _cfg = window.SpaceHSGPageConfig || {};
    // ================= 全局变量 =================
    const ITEMS_PER_PAGE = 10;
    let currentPage = 1;
    let currentSearchTerm = '';
    let allItems = [];
    let filteredItems = [];
    let currentViewMode = 'grid';

    // ================= List View 专用全局变量 =================
    window.listViewItems = [];
    window.listViewFilteredItems = [];
    window.listViewCurrentPage = 1;
    window.listViewSearchTerm = '';

    // ================= 跨视图选中状态（按 path 同步 Grid / List）=================
    if (typeof window.selectedItemPaths === 'undefined') {
        window.selectedItemPaths = new Set();
    }

    // ================= 页面加载初始化 =================
    document.addEventListener('DOMContentLoaded', function() {
        window.userDepartment = _cfg.userDepartment || 'Unknown';
        window.userDisplayName = _cfg.userDisplayName || '';
        window.userRole = _cfg.userRole || 'User';
        const relativePath = _cfg.relativePath || '';
        const uploadActionUrl = _cfg.uploadActionUrl || '';

        if (typeof initializeFileManager === 'function') {
            initializeFileManager(relativePath, uploadActionUrl);
        } else {
            showToast('Error', 'InitializeFileManager function not found!', 'error');
        }
        if (typeof initDomElements === 'function') initDomElements();
        if (typeof setupFileInput === 'function') setupFileInput();
        restoreViewMode();
        setTimeout(function() {
            if (typeof checkAndUpdateButtonsVisibility === 'function') checkAndUpdateButtonsVisibility();
        }, 100);
        var logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                showLogoutModal();
            };
        }
        if (_cfg.errorMessage) {
            setTimeout(function() { showToast('Error', _cfg.errorMessage, 'error'); }, 1000);
        }
        setTimeout(function() {
            if (typeof reattachGridEvents === 'function') reattachGridEvents();
            bindListViewEvents();
        }, 200);
        setupMobileSearchSync();
        initListSelection();
    });

    // ================= 列表视图初始化=================
    window.initializeListViewFeatures = function() {

        const listItems = document.querySelectorAll('#listView .fm-list-item');
        
        if (listItems.length === 0) {
            return;
        }

        window.listViewItems = [];
        listItems.forEach((item, index) => {
            item.classList.remove('fm-hidden');
            item.classList.add('fm-page-hidden');
            item.classList.remove('fm-page-visible');

            window.listViewItems.push({
                element: item,
                name: item.dataset.name || '',
                type: item.dataset.type || '',
                path: item.dataset.path || '',
                index: index
            });
        });

        window.listViewFilteredItems = [...window.listViewItems];

        // 恢复状态
        const savedSearch = localStorage.getItem('spaceHSG_listView_search');
        const savedPage = localStorage.getItem('spaceHSG_listView_page');

        window.listViewSearchTerm = savedSearch || '';
        window.listViewCurrentPage = savedPage ? parseInt(savedPage) : 1;

        if (window.listViewSearchTerm) {
            const searchInput = document.getElementById('searchInput');
            const mobileSearchInput = document.getElementById('mobileSearchInput');
            if (searchInput) searchInput.value = window.listViewSearchTerm;
            if (mobileSearchInput) mobileSearchInput.value = window.listViewSearchTerm;
            performListViewSearch(window.listViewSearchTerm);
        } else {
            applyListViewPagination();
        }

        bindListViewCheckboxes(); 
        bindListViewSearch();
        if (typeof window.applySelectionToCurrentView === 'function') {
            window.applySelectionToCurrentView('list');
        }
        updateSelectAllCheckbox();
    };

    // ================= 绑定列表视图checkbox事件 =================
    function bindListViewCheckboxes() {
        
        // 绑定所有列表项的checkbox
        const checkboxes = document.querySelectorAll('#listView .fm-list-checkbox');
        
        checkboxes.forEach((checkbox, index) => {
            // 移除旧的事件监听器
            const newCheckbox = checkbox.cloneNode(true);
            checkbox.parentNode.replaceChild(newCheckbox, checkbox);
            
            // 添加新的点击事件
            newCheckbox.addEventListener('click', function(e) {
                e.stopPropagation();
                window.toggleListItemSelection(this);
            });
        });
    }


    // ================= 完全重写：列表视图搜索 =================
    function performListViewSearch(searchTerm) {

        if (!searchTerm || searchTerm.trim() === '') {
            clearListViewSearch();
            return;
        }

        searchTerm = searchTerm.trim().toLowerCase();
        window.listViewSearchTerm = searchTerm;

        // 保存搜索词
        localStorage.setItem('spaceHSG_listView_search', searchTerm);

        // 过滤项目 - 只保留名称包含搜索词的项目
        window.listViewFilteredItems = window.listViewItems.filter(item => {
            const matches = item.name.toLowerCase().includes(searchTerm);
            return matches;
        });

        document.querySelectorAll('#listView .fm-list-item').forEach(item => {
            item.classList.add('fm-page-hidden');
            item.classList.remove('fm-page-visible');
        });

        // 如果没有匹配的项目
        if (window.listViewFilteredItems.length === 0) {
            // 隐藏分页
            document.getElementById('paginationWrapper')?.style.setProperty('display', 'none', 'important');
            // 显示空状态
            showListViewEmptyState(searchTerm);
            // 显示搜索结果信息（0个结果）
            showListViewSearchResults(searchTerm, 0);
            return;
        }

        // 隐藏空状态
        const emptyState = document.getElementById('emptySearchState');
        if (emptyState) emptyState.style.display = 'none';

        // 重置到第一页
        window.listViewCurrentPage = 1;
        localStorage.setItem('spaceHSG_listView_page', 1);

        // 高亮搜索结果
        highlightListViewSearch(searchTerm);

        // 显示搜索结果信息
        showListViewSearchResults(searchTerm, window.listViewFilteredItems.length);

        applyListViewPagination();
    }

    function clearListViewSearch() {
        window.listViewSearchTerm = '';
        window.listViewFilteredItems = [...window.listViewItems];

        // 清除保存的搜索词
        localStorage.removeItem('spaceHSG_listView_search');

        // 重置到第一页
        window.listViewCurrentPage = 1;
        localStorage.setItem('spaceHSG_listView_page', 1);

        // 隐藏空状态消息
        const emptyState = document.getElementById('emptySearchState');
        if (emptyState) {
            emptyState.style.display = 'none';
        }

        // 应用分页
        applyListViewPagination();

        // 移除高亮
        removeAllHighlights();

        // 移除搜索结果信息
        document.getElementById('listViewSearchResults')?.remove();

        // 清空搜索框
        const searchInput = document.getElementById('searchInput');
        const mobileSearchInput = document.getElementById('mobileSearchInput');
        if (searchInput) searchInput.value = '';
        if (mobileSearchInput) mobileSearchInput.value = '';

        document.getElementById('searchClear')?.style.setProperty('display', 'none', 'important');
        document.getElementById('mobileSearchClear')?.style.setProperty('display', 'none', 'important');
    }

    // 移除所有高亮
    function removeAllHighlights() {
        document.querySelectorAll('.fm-list-name .fm-highlight, .fm-grid-item-name .fm-highlight').forEach(el => {
            const parent = el.parentNode;
            parent.replaceChild(document.createTextNode(el.textContent), el);
            parent.normalize();
        });
    }

    // ================= 列表视图分页 =================
    function applyListViewPagination() {
        
        if (!window.listViewFilteredItems || window.listViewFilteredItems.length === 0) {
            document.querySelectorAll('#listView .fm-list-item').forEach(item => {
                item.classList.add('fm-page-hidden');
                item.classList.remove('fm-page-visible');
            });
            document.getElementById('paginationWrapper')?.style.setProperty('display', 'none', 'important');
            return;
        }

        const totalItems = window.listViewFilteredItems.length;
        const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

        if (window.listViewCurrentPage < 1) window.listViewCurrentPage = 1;
        if (window.listViewCurrentPage > totalPages) window.listViewCurrentPage = totalPages || 1;

        document.querySelectorAll('#listView .fm-list-item').forEach((item, idx) => {
            item.classList.add('fm-page-hidden');
            item.classList.remove('fm-page-visible');
        });

        // 显示当前页
        const startIndex = (window.listViewCurrentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems);

        for (let i = startIndex; i < endIndex; i++) {
            if (window.listViewFilteredItems[i]?.element) {
                const elem = window.listViewFilteredItems[i].element;
                // 使用CSS类控制显示
                elem.classList.remove('fm-page-hidden');
                elem.classList.add('fm-page-visible');
            }
        }

        // 更新分页控件
        updateListViewPaginationControls(totalItems, totalPages);
    }

    // ================= 更新列表视图分页控件 =================
    function updateListViewPaginationControls(totalItems, totalPages) {
        const wrapper = document.getElementById('paginationWrapper');
        const info = document.getElementById('paginationInfo');
        const pagination = document.getElementById('pagination');

        if (!wrapper || !info || !pagination) {
            return;
        }

        if (totalItems <= ITEMS_PER_PAGE) {
            wrapper.style.display = 'none';
            return;
        }

        wrapper.style.display = 'flex';

        const start = (window.listViewCurrentPage - 1) * ITEMS_PER_PAGE + 1;
        const end = Math.min(window.listViewCurrentPage * ITEMS_PER_PAGE, totalItems);
        info.textContent = `Showing ${start}-${end} of ${totalItems} items`;

        pagination.innerHTML = '';

        // 上一页
        const prevBtn = createPaginationButton('prev', window.listViewCurrentPage === 1);
        if (window.listViewCurrentPage > 1) {
            // 使用 addEventListener，支持触摸事件
            prevBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                window.listViewCurrentPage--;
                localStorage.setItem('spaceHSG_listView_page', window.listViewCurrentPage);
                applyListViewPagination();
            });
            prevBtn.addEventListener('touchend', function(e) {
                e.preventDefault();
                e.stopPropagation();
                window.listViewCurrentPage--;
                localStorage.setItem('spaceHSG_listView_page', window.listViewCurrentPage);
                applyListViewPagination();
            });
        }
        pagination.appendChild(prevBtn);

        // 第一页
        if (window.listViewCurrentPage > 2) {
            pagination.appendChild(createPageButton(1));
        }

        // 省略号
        if (window.listViewCurrentPage > 3) {
            pagination.appendChild(createEllipsisButton());
        }

        // 当前页前一页
        if (window.listViewCurrentPage > 1) {
            pagination.appendChild(createPageButton(window.listViewCurrentPage - 1));
        }

        // 当前页
        pagination.appendChild(createPageButton(window.listViewCurrentPage, true));

        // 当前页后一页
        if (window.listViewCurrentPage < totalPages) {
            pagination.appendChild(createPageButton(window.listViewCurrentPage + 1));
        }

        // 省略号
        if (window.listViewCurrentPage < totalPages - 2) {
            pagination.appendChild(createEllipsisButton());
        }

        // 最后一页
        if (window.listViewCurrentPage < totalPages - 1) {
            pagination.appendChild(createPageButton(totalPages));
        }

        // 下一页
        const nextBtn = createPaginationButton('next', window.listViewCurrentPage === totalPages);
        if (window.listViewCurrentPage < totalPages) {
            //  使用 addEventListener，支持触摸事件
            nextBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                window.listViewCurrentPage++;
                localStorage.setItem('spaceHSG_listView_page', window.listViewCurrentPage);
                applyListViewPagination();
            });
            nextBtn.addEventListener('touchend', function(e) {
                e.preventDefault();
                e.stopPropagation();
                window.listViewCurrentPage++;
                localStorage.setItem('spaceHSG_listView_page', window.listViewCurrentPage);
                applyListViewPagination();
            });
        }
        pagination.appendChild(nextBtn);
    }

    // ================= 辅助函数区域（用于分页按钮）=================
    function createPageButton(pageNum, isActive = false) {
        const btn = document.createElement('li');
        btn.className = `fm-page-item ${isActive ? 'active' : ''}`;
        btn.innerHTML = `<a class="fm-page-link" href="#">${pageNum}</a>`;
        
        //  使用 addEventListener 代替 onclick，更可靠
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            window.listViewCurrentPage = pageNum;
            localStorage.setItem('spaceHSG_listView_page', pageNum);
            applyListViewPagination();
        });
        
        //  添加触摸事件支持（手机端）
        btn.addEventListener('touchend', function(e) {
            e.preventDefault();
            e.stopPropagation();
            window.listViewCurrentPage = pageNum;
            localStorage.setItem('spaceHSG_listView_page', pageNum);
            applyListViewPagination();
        });
        
        return btn;
    }

    // 辅助函数：创建省略号
    function createEllipsisButton() {
        const ellipsis = document.createElement('li');
        ellipsis.className = 'fm-page-item disabled';
        ellipsis.innerHTML = `<span class="fm-page-link">...</span>`;
        return ellipsis;
    }

    // 辅助函数：创建上一页/下一页按钮
    function createPaginationButton(type, isDisabled) {
        const button = document.createElement('li');
        button.className = `fm-page-item ${isDisabled ? 'disabled' : ''}`;

        if (type === 'prev') {
            button.innerHTML = `<a class="fm-page-link" href="#" aria-label="Previous"><i class="fas fa-chevron-left"></i></a>`;
        } else {
            button.innerHTML = `<a class="fm-page-link" href="#" aria-label="Next"><i class="fas fa-chevron-right"></i></a>`;
        }

        return button;
    }

    // ================= 显示列表视图分页控件 =================
    function showListViewPagination() {
        const paginationWrapper = document.getElementById('paginationWrapper');
        const paginationInfo = document.getElementById('paginationInfo');
        const pagination = document.getElementById('pagination');

        if (!paginationWrapper || !paginationInfo || !pagination) return;

        const totalItems = window.listViewFilteredItems ? window.listViewFilteredItems.length : 0;
        const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

        if (totalItems <= ITEMS_PER_PAGE) {
            paginationWrapper.style.display = 'none';
            return;
        }

        paginationWrapper.style.display = 'flex';

        const start = (window.listViewCurrentPage - 1) * ITEMS_PER_PAGE + 1;
        const end = Math.min(window.listViewCurrentPage * ITEMS_PER_PAGE, totalItems);
        paginationInfo.textContent = `Showing ${start}-${end} of ${totalItems} items`;

        // 生成分页按钮
        pagination.innerHTML = '';

        // 上一页
        const prevButton = document.createElement('li');
        prevButton.className = `fm-page-item ${window.listViewCurrentPage === 1 ? 'disabled' : ''}`;
        prevButton.innerHTML = `<a class="fm-page-link" href="#" aria-label="Previous"><i class="fas fa-chevron-left"></i></a>`;
        prevButton.onclick = (e) => {
            e.preventDefault();
            if (window.listViewCurrentPage > 1) {
                window.listViewCurrentPage--;
                showListViewPage(window.listViewCurrentPage);
                showListViewPagination();
                localStorage.setItem('spaceHSG_listView_page', window.listViewCurrentPage);
            }
        };
        pagination.appendChild(prevButton);

        // 页码按钮
        const maxVisiblePages = 5;
        let startPage = Math.max(1, window.listViewCurrentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        if (startPage > 1) {
            const firstPageButton = document.createElement('li');
            firstPageButton.className = 'fm-page-item';
            firstPageButton.innerHTML = `<a class="fm-page-link" href="#">1</a>`;
            firstPageButton.onclick = (e) => {
                e.preventDefault();
                window.listViewCurrentPage = 1;
                showListViewPage(1);
                showListViewPagination();
                localStorage.setItem('spaceHSG_listView_page', 1);
            };
            pagination.appendChild(firstPageButton);

            if (startPage > 2) {
                const ellipsis = document.createElement('li');
                ellipsis.className = 'fm-page-item disabled';
                ellipsis.innerHTML = `<span class="fm-page-link">...</span>`;
                pagination.appendChild(ellipsis);
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            const pageButton = document.createElement('li');
            pageButton.className = `fm-page-item ${i === window.listViewCurrentPage ? 'active' : ''}`;
            pageButton.innerHTML = `<a class="fm-page-link" href="#">${i}</a>`;
            pageButton.onclick = (e) => {
                e.preventDefault();
                window.listViewCurrentPage = i;
                showListViewPage(i);
                showListViewPagination();
                localStorage.setItem('spaceHSG_listView_page', i);
            };
            pagination.appendChild(pageButton);
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                const ellipsis = document.createElement('li');
                ellipsis.className = 'fm-page-item disabled';
                ellipsis.innerHTML = `<span class="fm-page-link">...</span>`;
                pagination.appendChild(ellipsis);
            }

            const lastPageButton = document.createElement('li');
            lastPageButton.className = 'fm-page-item';
            lastPageButton.innerHTML = `<a class="fm-page-link" href="#">${totalPages}</a>`;
            lastPageButton.onclick = (e) => {
                e.preventDefault();
                window.listViewCurrentPage = totalPages;
                showListViewPage(totalPages);
                showListViewPagination();
                localStorage.setItem('spaceHSG_listView_page', totalPages);
            };
            pagination.appendChild(lastPageButton);
        }

        // 下一页
        const nextButton = document.createElement('li');
        nextButton.className = `fm-page-item ${window.listViewCurrentPage === totalPages ? 'disabled' : ''}`;
        nextButton.innerHTML = `<a class="fm-page-link" href="#" aria-label="Next"><i class="fas fa-chevron-right"></i></a>`;
        nextButton.onclick = (e) => {
            e.preventDefault();
            if (window.listViewCurrentPage < totalPages) {
                window.listViewCurrentPage++;
                showListViewPage(window.listViewCurrentPage);
                showListViewPagination();
                localStorage.setItem('spaceHSG_listView_page', window.listViewCurrentPage);
            }
        };
        pagination.appendChild(nextButton);
    }




    // ================= 列表视图搜索高亮 =================
    function highlightListViewSearch(searchTerm) {
        if (!searchTerm) return;

        // 移除已有的高亮
        document.querySelectorAll('.fm-list-name .fm-highlight').forEach(el => {
            const parent = el.parentNode;
            parent.replaceChild(document.createTextNode(el.textContent), el);
            parent.normalize();
        });

        // 为匹配的项目添加高亮
        window.listViewFilteredItems.forEach(item => {
            if (item.element) {
                const nameElement = item.element.querySelector('.fm-list-name');
                if (nameElement) {
                    const originalText = nameElement.textContent || nameElement.innerText;
                    const regex = new RegExp(`(${escapeRegExp(searchTerm)})`, 'gi');
                    if (regex.test(originalText)) {
                        const highlightedText = originalText.replace(regex, '<span class="fm-highlight">$1</span>');
                        nameElement.innerHTML = highlightedText;
                    }
                }
            }
        });
    }

    // ================= 显示列表视图搜索结果信息 =================
    function showListViewSearchResults(searchTerm, resultCount) {
        const oldInfo = document.getElementById('listViewSearchResults');
        if (oldInfo) oldInfo.remove();

        if (!searchTerm) return;

        const infoElement = document.createElement('div');
        infoElement.id = 'listViewSearchResults';
        infoElement.className = 'fm-search-results-info';
        infoElement.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; padding: 8px 16px; background: var(--bg-gray); border-radius: 6px; margin: 10px 0;">
                <i class="fas fa-search" style="color: var(--text-secondary);"></i>
                <span style="color: var(--text-primary); font-weight: 500;">Search results for "${searchTerm}"</span>
                <span style="color: var(--text-secondary); margin-left: auto;">${resultCount} items found</span>
                <button onclick="clearListViewSearch()" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                    Clear <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        const filesContainer = document.querySelector('.fm-files-container');
        if (filesContainer) {
            filesContainer.parentNode.insertBefore(infoElement, filesContainer);
        }
    }

    // ================= 绑定列表视图搜索事件 =================
    function bindListViewSearch() {
        const searchInput = document.getElementById('searchInput');
        const searchClear = document.getElementById('searchClear');

        if (searchInput) {
            searchInput.removeAttribute('onkeyup');
            
            // 移除所有旧的事件监听器（通过克隆节点）
            const newSearchInput = searchInput.cloneNode(true);
            searchInput.parentNode.replaceChild(newSearchInput, searchInput);

            // 确保克隆后也没有 onkeyup 属性
            newSearchInput.removeAttribute('onkeyup');
            newSearchInput.id = 'searchInput';
            
            // 添加新的事件监听器
            newSearchInput.addEventListener('input', function() {
                
                const searchClear = document.getElementById('searchClear');
                if (searchClear) {
                    searchClear.style.display = this.value ? 'block' : 'none';
                }

                if (this.value.trim() === '') {
                    clearListViewSearch();
                } else {
                    performListViewSearch(this.value.trim());
                }
            });

            newSearchInput.addEventListener('keyup', function(e) {
                if (e.key === 'Enter') {
                    if (this.value.trim() === '') {
                        clearListViewSearch();
                    } else {
                        performListViewSearch(this.value.trim());
                    }
                }
            });

            // 恢复搜索词
            if (window.listViewSearchTerm) {
                newSearchInput.value = window.listViewSearchTerm;
            }
        }

        // 修复搜索清除按钮
        if (searchClear) {
            searchClear.onclick = function() {
                const searchInput = document.getElementById('searchInput');
                if (searchInput) searchInput.value = '';
                this.style.display = 'none';

                if (isCurrentViewList()) {
                    clearListViewSearch();
                } else {
                    window.clearSearch();
                }
            };
        }
    }

    // ================= 初始化列表视图选择功能 =================
    function initListSelection() {
        // 为列表视图头部的全选容器添加点击事件
        const listSelectAllContainer = document.getElementById('listSelectAllContainer');
        if (listSelectAllContainer) {
            listSelectAllContainer.onclick = function(e) {
                e.stopPropagation();
                toggleSelectAll();
            };
        }

        // 为所有列表项复选框添加点击事件
        document.querySelectorAll('#listView .fm-list-checkbox-container').forEach(container => {
            const checkbox = container.querySelector('.fm-list-checkbox');
            if (checkbox) {
                checkbox.onclick = function(e) {
                    e.stopPropagation();
                    toggleListItemSelection(this);
                };
            }
        });
    }

    // ================= 绑定列表视图事件 =================
    function bindListViewEvents() {
        // 绑定列表项点击事件（导航）
        document.querySelectorAll('#listView .fm-list-item').forEach(item => {
            // 移除原有的事件监听器，避免重复
            item.removeEventListener('click', handleListItemClick);
            item.addEventListener('click', function(e) {
                // 如果点击的是复选框、操作按钮或它们的父元素，不触发导航
                if (e.target.closest('.fm-list-checkbox-container') ||
                    e.target.closest('.fm-list-actions') ||
                    e.target.closest('.fm-action-btn')) {
                    return;
                }
                handleListItemClick.call(this, e);
            });
        });

        // 绑定列表视图中的导航元素
        document.querySelectorAll('#listView .fm-list-icon, #listView .fm-list-name, #listView .fm-list-type, #listView .fm-list-size, #listView .fm-list-date').forEach(el => {
            el.removeEventListener('click', navigateToItemByElement);
            el.addEventListener('click', navigateToItemByElement);
        });

        // 绑定操作按钮
        bindListActionButtons();
    }

    // ================= 绑定列表视图操作按钮 =================
    function bindListActionButtons() {
        // 下载按钮
        document.querySelectorAll('#listView .download-icon-btn').forEach(btn => {
            btn.onclick = function(e) {
                e.stopPropagation();
                const listItem = this.closest('.fm-list-item');
                if (listItem) {
                    const path = listItem.dataset.path;
                    if (path) {
                        window.location.href = (_cfg.downloadUrl || '') + '?path=' + encodeURIComponent(path);
                    }
                }
            };
        });

        // 打开文件夹按钮
        document.querySelectorAll('#listView .open-icon-btn').forEach(btn => {
            btn.onclick = function(e) {
                e.stopPropagation();
                const listItem = this.closest('.fm-list-item');
                if (listItem) {
                    const path = listItem.dataset.path;
                    if (path) {
                        window.location.href = (_cfg.indexUrl || '') + '?path=' + encodeURIComponent(path);
                    }
                }
            };
        });

        // 删除按钮（如果有）
        document.querySelectorAll('#listView .delete-icon-btn').forEach(btn => {
            btn.onclick = function(e) {
                e.stopPropagation();
                const listItem = this.closest('.fm-list-item');
                if (listItem) {
                    const name = listItem.dataset.name;
                    const path = listItem.dataset.path;
                    if (name && path && typeof showDeleteModal === 'function') {
                        showDeleteModal(name, path);
                    }
                }
            };
        });
    }

    // ================= 处理列表项点击 =================
    function handleListItemClick(e) {
        const listItem = this.closest('.fm-list-item');
        if (!listItem) return;

        const path = listItem.dataset.path;
        const type = listItem.dataset.type;

        if (path && type) {
            if (type === 'Folder') {
                window.location.href = (_cfg.indexUrl || '') + '?path=' + encodeURIComponent(path);
            } else {
                window.location.href = (_cfg.downloadUrl || '') + '?path=' + encodeURIComponent(path);
            }
        }
    }

    // 路径规范化，便于 Grid/List 一致比较（在 toggle 里也使用）
    function normPath(p) {
        if (!p) return '';
        return String(p).replace(/\//g, '\\').trim();
    }

    // ================= 切换列表项选择（同步到 selectedItemPaths）=================
    window.toggleListItemSelection = function(checkboxElement) {
        if (!checkboxElement) return;
        const listItem = checkboxElement.closest('.fm-list-item');
        if (!listItem || !listItem.dataset.path) return;

        const path = normPath(listItem.dataset.path);
        if (!window.selectedItemPaths) window.selectedItemPaths = new Set();

        checkboxElement.classList.toggle('selected');
        if (checkboxElement.classList.contains('selected')) {
            listItem.classList.add('selected');
            window.selectedItemPaths.add(path);
        } else {
            listItem.classList.remove('selected');
            window.selectedItemPaths.delete(path);
        }

        updateBatchActionsVisibility();
        updateSelectAllCheckbox();
    };

    // ================= 切换网格项选择（同步到 selectedItemPaths）=================
    window.toggleGridItemSelection = function(checkboxElement) {
        if (!checkboxElement) return;
        const gridItem = checkboxElement.closest('.fm-grid-item');
        if (!gridItem || !gridItem.dataset.path) return;

        const path = normPath(gridItem.dataset.path);
        if (!window.selectedItemPaths) window.selectedItemPaths = new Set();

        checkboxElement.classList.toggle('selected');
        if (checkboxElement.classList.contains('selected')) {
            gridItem.classList.add('selected');
            window.selectedItemPaths.add(path);
        } else {
            gridItem.classList.remove('selected');
            window.selectedItemPaths.delete(path);
        }

        updateBatchActionsVisibility();
        updateSelectAllCheckbox();
    };

    // 判断 path 是否在选中集合中（兼容多种格式）
    function pathMatchesSelection(itemPath, selectionSet) {
        if (!itemPath) return false;
        var n = normPath(itemPath);
        var raw = String(itemPath).trim();
        return selectionSet.has(n) || selectionSet.has(raw) || selectionSet.has(itemPath);
    }

    // ================= 切换视图后按 path 恢复选中状态 =================
    // forceView: 可选 'list' | 'grid'，指定时不再依赖 isCurrentViewList()，避免 Grid→List 切换时误判
    window.applySelectionToCurrentView = function(forceView) {
        if (typeof window.selectedItemPaths === 'undefined') {
            window.selectedItemPaths = new Set();
        }
        window.selectedItemPaths.delete('');
        window.selectedItemPaths.delete(null);
        window.selectedItemPaths.delete(undefined);

        var selectionSet = new Set();
        window.selectedItemPaths.forEach(function(p) {
            if (p == null || (typeof p === 'string' && !p.trim())) return;
            var s = String(p).trim();
            var n = normPath(p);
            if (n) selectionSet.add(n);
            if (s) selectionSet.add(s);
        });

        var isList = (forceView === 'list' || forceView === 'grid') ? (forceView === 'list') : isCurrentViewList();
        if (isList) {
            document.querySelectorAll('#listView .fm-list-item').forEach(function(item) {
                var path = item.dataset.path;
                var cb = item.querySelector('.fm-list-checkbox');
                if (!cb) return;
                var isSelected = selectionSet.size > 0 && pathMatchesSelection(path, selectionSet);
                if (isSelected) {
                    cb.classList.add('selected');
                    item.classList.add('selected');
                } else {
                    cb.classList.remove('selected');
                    item.classList.remove('selected');
                }
            });
        } else {
            document.querySelectorAll('#gridView .fm-grid-item').forEach(function(item) {
                var path = item.dataset.path;
                var cb = item.querySelector('.fm-grid-checkbox');
                if (!cb) return;
                var isSelected = selectionSet.size > 0 && pathMatchesSelection(path, selectionSet);
                if (isSelected) {
                    cb.classList.add('selected');
                    item.classList.add('selected');
                } else {
                    cb.classList.remove('selected');
                    item.classList.remove('selected');
                }
            });
        }
        updateBatchActionsVisibility();
        updateSelectAllCheckbox();
    };

    // ================= 切换全选（同步 selectedItemPaths）=================
    window.toggleSelectAll = function() {
        const isListView = isCurrentViewList();
        let allCheckboxes;
        let allSelected = false;

        if (isListView) {
            allCheckboxes = document.querySelectorAll('#listView .fm-list-checkbox');
        } else {
            allCheckboxes = document.querySelectorAll('#gridView .fm-grid-checkbox');
        }

        allSelected = Array.from(allCheckboxes).every(cb => cb.classList.contains('selected'));
        if (!window.selectedItemPaths) window.selectedItemPaths = new Set();

        if (allSelected) {
            allCheckboxes.forEach(checkbox => {
                checkbox.classList.remove('selected');
                const item = checkbox.closest(isListView ? '.fm-list-item' : '.fm-grid-item');
                if (item) {
                    item.classList.remove('selected');
                    if (item.dataset.path) window.selectedItemPaths.delete(item.dataset.path);
                }
            });
        } else {
            allCheckboxes.forEach(checkbox => {
                checkbox.classList.add('selected');
                const item = checkbox.closest(isListView ? '.fm-list-item' : '.fm-grid-item');
                if (item) {
                    item.classList.add('selected');
                    if (item.dataset.path) window.selectedItemPaths.add(item.dataset.path);
                }
            });
        }

        const selectAllHeader = document.getElementById('selectAllHeader');
        if (selectAllHeader) {
            if (!allSelected) selectAllHeader.classList.add('selected');
            else selectAllHeader.classList.remove('selected');
        }

        updateBatchActionsVisibility();
    };

    // ================= 更新全选复选框状态 =================
    function updateSelectAllCheckbox() {
        const isListView = isCurrentViewList();
        let allCheckboxes;
        let selectedCheckboxes;

        if (isListView) {
            allCheckboxes = document.querySelectorAll('#listView .fm-list-checkbox');
            selectedCheckboxes = document.querySelectorAll('#listView .fm-list-checkbox.selected');
        } else {
            allCheckboxes = document.querySelectorAll('#gridView .fm-grid-checkbox');
            selectedCheckboxes = document.querySelectorAll('#gridView .fm-grid-checkbox.selected');
        }

        const selectAllHeader = document.getElementById('selectAllHeader');
        if (selectAllHeader) {
            if (allCheckboxes.length > 0 && selectedCheckboxes.length === allCheckboxes.length) {
                selectAllHeader.classList.add('selected');
            } else {
                selectAllHeader.classList.remove('selected');
            }
        }

        // 更新列表视图头部的全选容器状态
        if (isListView) {
            const listSelectAllContainer = document.getElementById('listSelectAllContainer');
            if (listSelectAllContainer) {
                const selectAllCheckbox = listSelectAllContainer.querySelector('.fm-list-checkbox');
                if (selectAllCheckbox) {
                    if (allCheckboxes.length > 0 && selectedCheckboxes.length === allCheckboxes.length) {
                        selectAllCheckbox.classList.add('selected');
                    } else {
                        selectAllCheckbox.classList.remove('selected');
                    }
                }
            }
        }
    }

    // ================= 更新批量操作按钮可见性 =================
    function updateBatchActionsVisibility() {
        const isListView = isCurrentViewList();
        let selectedCount = 0;

        if (isListView) {
            const checkboxes = document.querySelectorAll('#listView .fm-list-checkbox.selected');
            selectedCount = checkboxes.length;
            checkboxes.forEach((cb, i) => {
                const item = cb.closest('.fm-list-item');
            });
        } else {
            const checkboxes = document.querySelectorAll('#gridView .fm-grid-checkbox.selected');
            selectedCount = checkboxes.length;
        }

        const batchActions = document.getElementById('batchActions');
        const selectedNumber = document.getElementById('selectedNumber');
        const batchDeleteBtn = document.getElementById('batchDeleteBtn');

        if (selectedCount > 0) {
            if (batchActions) batchActions.style.display = 'flex';
            if (selectedNumber) selectedNumber.textContent = selectedCount;
        } else {
            if (batchActions) batchActions.style.display = 'none';
        }

        // 绑定批量删除按钮事件
        if (batchDeleteBtn) {
            batchDeleteBtn.onclick = function() {
                const currentIsListView = isCurrentViewList();
                let currentSelectedCount = 0;
                
                if (currentIsListView) {
                    currentSelectedCount = document.querySelectorAll('#listView .fm-list-checkbox.selected').length;
                } else {
                    currentSelectedCount = document.querySelectorAll('#gridView .fm-grid-checkbox.selected').length;
                }
                
                if (currentSelectedCount > 0 && typeof showBatchDeleteModal === 'function') {
                    showBatchDeleteModal(currentSelectedCount);
                } else {
                    showToast('Warning', 'Please select items to delete', 'warning');
                }
            };
        }
    }

    window.updateBatchActionsVisibility = updateBatchActionsVisibility;

    // ================= 判断当前是否为列表视图 =================
    function isCurrentViewList() {
        const savedView = localStorage.getItem('spaceHSG_viewMode');
        if (savedView) {
            return savedView === 'list';
        }

        const listView = document.getElementById('listView');
        if (listView) {
            const display = window.getComputedStyle(listView).display;
            return display !== 'none';
        }
        return false;
    }

        // ================= 恢复视图模式和分页状态 =================
    function restoreViewMode() {
        let savedView = localStorage.getItem('spaceHSG_viewMode');
        
        // 如果新键名没有值，尝试读取旧键名
        if (!savedView) {
            const oldView = localStorage.getItem('fileManagerView');
            if (oldView) {
                savedView = oldView;
                // 迁移到新键名
                localStorage.setItem('spaceHSG_viewMode', oldView);
                localStorage.removeItem('fileManagerView');
            }
        }

        // 强制从 localStorage 读取，如果没有则默认为 grid
        currentViewMode = savedView === 'list' ? 'list' : 'grid';

        const gridView = document.getElementById('gridView');
        const listView = document.getElementById('listView');
        const viewGridBtn = document.getElementById('viewGrid');
        const viewListBtn = document.getElementById('viewList');

        if (!gridView || !listView) {
            return;
        }

        // 根据保存的视图模式显示/隐藏
        if (currentViewMode === 'list') {
            gridView.style.display = 'none';
            listView.style.display = 'flex';
            viewGridBtn?.classList.remove('active');
            viewListBtn?.classList.add('active');
            
            // 初始化 List View
            setTimeout(() => {
                if (typeof window.initializeListViewFeatures === 'function') {
                    window.initializeListViewFeatures();
                }
            }, 100);
        } else {
            gridView.style.display = 'grid';
            listView.style.display = 'none';
            viewGridBtn?.classList.add('active');
            viewListBtn?.classList.remove('active');
            
            // 初始化 Grid View
            setTimeout(() => {
                if (typeof window.initializePaginationAndSearch === 'function') {
                    window.initializePaginationAndSearch();
                }
            }, 100);
        }

        // 确保 localStorage 中的值正确
        localStorage.setItem('spaceHSG_viewMode', currentViewMode);
    }

        // ================= 视图切换函数（无刷新）=================
    window.switchView = function(viewType) {
        // 如果已经是当前视图，不执行任何操作
        if (currentViewMode === viewType) return;

        // 更新当前视图模式
        currentViewMode = viewType;

        // 保存到 localStorage
        localStorage.setItem('spaceHSG_viewMode', viewType);

        const gridView = document.getElementById('gridView');
        const listView = document.getElementById('listView');
        const viewGridBtn = document.getElementById('viewGrid');
        const viewListBtn = document.getElementById('viewList');

        // 切换视图显示
        if (viewType === 'list') {
            gridView.style.display = 'none';
            listView.style.display = 'flex';
            viewGridBtn?.classList.remove('active');
            viewListBtn?.classList.add('active');

            // 初始化列表视图
            setTimeout(() => {
                window.initializeListViewFeatures();
            }, 50);
        } else {
            gridView.style.display = 'grid';
            listView.style.display = 'none';
            viewGridBtn?.classList.add('active');
            viewListBtn?.classList.remove('active');

            // 初始化网格视图
            setTimeout(() => {
                window.initializePaginationAndSearch();
            }, 50);
        }

        showToast('View Switched', `Switched to ${viewType} view`, 'success');
    };

        // ================= 刷新文件列表（保留当前视图）=================
    window.refreshFileListWithoutReload = function() {
        showToast('Refreshing', 'Updating file list...', 'info');

        // 保存当前视图和状态
        const currentView = localStorage.getItem('spaceHSG_viewMode') || 'grid';
        const currentPageToSave = currentView === 'list'
            ? (window.listViewCurrentPage || 1)
            : (currentPage || 1);
        const searchTermToSave = currentView === 'list'
            ? (window.listViewSearchTerm || '')
            : (currentSearchTerm || '');

        const currentPath = window.location.pathname;
        const searchParams = new URLSearchParams(window.location.search);
        const path = searchParams.get('path') || '';

        fetch(`${currentPath}?path=${encodeURIComponent(path)}&ajax=true`, {
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        })
        .then(response => response.text())
        .then(html => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            const oldFilesContainer = document.querySelector('.fm-files-container');
            const newFilesContainer = doc.querySelector('.fm-files-container');

            if (oldFilesContainer && newFilesContainer) {
                oldFilesContainer.innerHTML = newFilesContainer.innerHTML;
            }

            // 强制恢复视图模式
            setTimeout(() => {
                // 恢复视图
                if (currentView === 'list') {
                    document.getElementById('gridView')?.style.setProperty('display', 'none', 'important');
                    document.getElementById('listView')?.style.setProperty('display', 'flex', 'important');
                    document.getElementById('viewGrid')?.classList.remove('active');
                    document.getElementById('viewList')?.classList.add('active');

                    // 重新初始化列表视图
                    window.initializeListViewFeatures();

                    // 恢复搜索和页码
                    if (searchTermToSave) {
                        const searchInput = document.getElementById('searchInput');
                        if (searchInput) {
                            searchInput.value = searchTermToSave;
                            performListViewSearch(searchTermToSave);
                        }
                    } else {
                        window.listViewCurrentPage = currentPageToSave;
                        applyListViewPagination();
                    }
                } else {
                    document.getElementById('gridView')?.style.setProperty('display', 'grid', 'important');
                    document.getElementById('listView')?.style.setProperty('display', 'none', 'important');
                    document.getElementById('viewGrid')?.classList.add('active');
                    document.getElementById('viewList')?.classList.remove('active');

                    // 重新初始化网格视图
                    window.initializePaginationAndSearch();

                    // 恢复搜索和页码
                    if (searchTermToSave) {
                        const searchInput = document.getElementById('searchInput');
                        if (searchInput) {
                            searchInput.value = searchTermToSave;
                            performSearch(searchTermToSave);
                        }
                    } else {
                        currentPage = currentPageToSave;
                        showPage(currentPage);
                    }
                }

                // 重新绑定事件
                reattachGridEvents();
                bindListViewEvents();
                initListSelection();

                showToast('Success', 'File list updated', 'success');
            }, 100);
        })
        .catch(function() {
            showToast('Error', 'Failed to refresh file list', 'error');
        });
    };

    // ================= 刷新后重新初始化 =================
    function reinitializeAfterRefresh() {
        if (typeof reattachGridEvents === 'function') {
            reattachGridEvents();
        }

        reinitializeCheckboxes();
        refreshItemsData();

        // 重新初始化列表视图功能
        initListSelection();
        bindListViewEvents();

        setupMobileSearchSync();

        setTimeout(() => {
            if (isCurrentViewList()) {
                // initializeListViewFeatures() 会在 refreshFileListWithoutReload 中调用
            } else {
                window.initializePaginationAndSearch();
            }
        }, 100);
    }

    // ================= 重新初始化复选框 =================
    function reinitializeCheckboxes() {
        // 网格视图复选框：必须用 window.toggleGridItemSelection(checkbox)，避免 site.js 的 toggleGridItemSelection(gridItem, checkbox) 被误调导致 path 为空
        document.querySelectorAll('.fm-grid-checkbox-container').forEach(container => {
            const checkbox = container.querySelector('.fm-grid-checkbox');
            if (checkbox) {
                checkbox.onclick = function(e) {
                    e.stopPropagation();
                    if (typeof window.toggleGridItemSelection === 'function') {
                        window.toggleGridItemSelection(this);
                    }
                };
            }
        });

        // 列表视图复选框
        document.querySelectorAll('.fm-list-checkbox-container').forEach(container => {
            const checkbox = container.querySelector('.fm-list-checkbox');
            if (checkbox) {
                checkbox.onclick = function(e) {
                    e.stopPropagation();
                    if (typeof window.toggleListItemSelection === 'function') {
                        window.toggleListItemSelection(this);
                    }
                };
            }
        });
    }

    // ================= 刷新项目数据 =================
    function refreshItemsData() {
        allItems = [];
        filteredItems = [];
        allItems = getAllItems();
        filteredItems = [...allItems];
    }

    // ================= 获取所有项目数据 =================
    function getAllItems() {
        const items = [];
        const isListView = isCurrentViewList();

        let activeItems = [];
        if (isListView) {
            activeItems = document.querySelectorAll('#listView .fm-list-item');
        } else {
            activeItems = document.querySelectorAll('#gridView .fm-grid-item');
        }

        // 转换为对象数组
        activeItems.forEach(item => {
            items.push({
                element: item,
                name: item.dataset.name || '',
                type: item.dataset.type || '',
                path: item.dataset.path || '',
                isVisible: !item.classList.contains('fm-hidden') && item.style.display !== 'none'
            });
        });

        return items;
    }

    // ================= 统一分页功能（仅供网格视图使用）=================
    function updatePagination() {
        if (isCurrentViewList()) {
            return;
        }
        
        const paginationWrapper = document.getElementById('paginationWrapper');
        const pagination = document.getElementById('pagination');
        const paginationInfo = document.getElementById('paginationInfo');

        // 不调用 refreshItemsData，因为 filteredItems 已经在 performSearch 中设置好了
        // refreshItemsData();

        if (!filteredItems || filteredItems.length === 0) {
            if (paginationWrapper) paginationWrapper.style.display = 'none';
            
            // 确保隐藏所有网格项
            document.querySelectorAll('#gridView .fm-grid-item').forEach(item => {
                item.style.display = 'none';
            });
            return;
        }

        const totalItems = filteredItems.length;
        const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

        if (totalPages <= 1) {
            if (paginationWrapper) paginationWrapper.style.display = 'none';
            // 不需要在这里显示项目，调用者会处理
            return;
        }

        // 调用 updatePaginationControls 来更新分页UI
        updatePaginationControls();
    }

    // ================= 显示页码内容（仅供网格视图使用）=================
    function showPage(page) {
        // 如果是列表视图，不执行网格视图的分页逻辑
        if (isCurrentViewList()) {
            return;
        }

        currentPage = page;

        // 不调用 refreshItemsData，保持当前的 filteredItems
        // refreshItemsData();

        if (!filteredItems || filteredItems.length === 0) {
            filteredItems = [...allItems];
        }

        if (filteredItems.length === 0) {
            return;
        }

        const startIndex = (page - 1) * ITEMS_PER_PAGE;
        const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filteredItems.length);

        // 1. 先隐藏所有网格项目
        document.querySelectorAll('#gridView .fm-grid-item').forEach(item => {
            item.style.display = 'none';
        });

        // 2. 显示当前页的项目
        for (let i = startIndex; i < endIndex; i++) {
            if (filteredItems[i] && filteredItems[i].element) {
                filteredItems[i].element.style.display = '';
            }
        }

        // 3. 更新分页控件（不会递归调用 showPage）
        updatePaginationControls();
        
        // 4. 重新绑定当前页的checkbox
        bindGridViewCheckboxes();
    }
    
    // ================= 只更新分页控件UI，不改变显示 =================
    function updatePaginationControls() {
        const paginationWrapper = document.getElementById('paginationWrapper');
        const pagination = document.getElementById('pagination');
        const paginationInfo = document.getElementById('paginationInfo');

        if (!paginationWrapper || !pagination || !paginationInfo) return;
        
        if (!filteredItems || filteredItems.length === 0) {
            paginationWrapper.style.display = 'none';
            return;
        }

        const totalItems = filteredItems.length;
        const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

        if (totalPages <= 1) {
            paginationWrapper.style.display = 'none';
            return;
        }

        paginationWrapper.style.display = 'flex';

        const start = (currentPage - 1) * ITEMS_PER_PAGE + 1;
        const end = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);
        paginationInfo.textContent = `Showing ${start}-${end} of ${totalItems} items`;

        // 生成分页按钮
        pagination.innerHTML = '';

        // 上一页
        const prevButton = document.createElement('li');
        prevButton.className = `fm-page-item ${currentPage === 1 ? 'disabled' : ''}`;
        prevButton.innerHTML = `<a class="fm-page-link" href="#" aria-label="Previous"><i class="fas fa-chevron-left"></i></a>`;
        prevButton.onclick = (e) => {
            e.preventDefault();
            if (currentPage > 1) {
                showPage(currentPage - 1);
            }
        };
        pagination.appendChild(prevButton);

        // 页码按钮
        const maxVisiblePages = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        if (startPage > 1) {
            const firstPageButton = document.createElement('li');
            firstPageButton.className = 'fm-page-item';
            firstPageButton.innerHTML = `<a class="fm-page-link" href="#">1</a>`;
            firstPageButton.onclick = (e) => {
                e.preventDefault();
                showPage(1);
            };
            pagination.appendChild(firstPageButton);

            if (startPage > 2) {
                const ellipsis = document.createElement('li');
                ellipsis.className = 'fm-page-item disabled';
                ellipsis.innerHTML = `<span class="fm-page-link">...</span>`;
                pagination.appendChild(ellipsis);
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            const pageButton = document.createElement('li');
            pageButton.className = `fm-page-item ${i === currentPage ? 'active' : ''}`;
            pageButton.innerHTML = `<a class="fm-page-link" href="#">${i}</a>`;
            pageButton.onclick = (e) => {
                e.preventDefault();
                showPage(i);
            };
            pagination.appendChild(pageButton);
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                const ellipsis = document.createElement('li');
                ellipsis.className = 'fm-page-item disabled';
                ellipsis.innerHTML = `<span class="fm-page-link">...</span>`;
                pagination.appendChild(ellipsis);
            }

            const lastPageButton = document.createElement('li');
            lastPageButton.className = 'fm-page-item';
            lastPageButton.innerHTML = `<a class="fm-page-link" href="#">${totalPages}</a>`;
            lastPageButton.onclick = (e) => {
                e.preventDefault();
                showPage(totalPages);
            };
            pagination.appendChild(lastPageButton);
        }

        // 下一页
        const nextButton = document.createElement('li');
        nextButton.className = `fm-page-item ${currentPage === totalPages ? 'disabled' : ''}`;
        nextButton.innerHTML = `<a class="fm-page-link" href="#" aria-label="Next"><i class="fas fa-chevron-right"></i></a>`;
        nextButton.onclick = (e) => {
            e.preventDefault();
            if (currentPage < totalPages) {
                showPage(currentPage + 1);
            }
        };
        pagination.appendChild(nextButton);
    }

    // ================= 初始化分页和搜索（仅供网格视图使用）=================
    window.initializePaginationAndSearch = function() {
        if (isCurrentViewList()) {
            return;
        }

        refreshItemsData();

        if (allItems.length === 0) {
            const paginationWrapper = document.getElementById('paginationWrapper');
            if (paginationWrapper) paginationWrapper.style.display = 'none';
            return;
        }

        const isListView = isCurrentViewList();

        // 重置过滤后的项目
        if (filteredItems.length === 0) {
            filteredItems = [...allItems];
        }

        // 根据项目数量决定是否显示分页
        if (allItems.length > ITEMS_PER_PAGE) {
            const paginationWrapper = document.getElementById('paginationWrapper');
            if (paginationWrapper) paginationWrapper.style.display = 'flex';

            // 初始化页码
            if (!currentPage || currentPage < 1) currentPage = 1;
            const maxPage = Math.ceil(allItems.length / ITEMS_PER_PAGE);
            if (currentPage > maxPage) currentPage = 1;

            // 显示当前页
            showPage(currentPage);
        } else {
            const paginationWrapper = document.getElementById('paginationWrapper');
            if (paginationWrapper) paginationWrapper.style.display = 'none';

            // 显示所有项目
            allItems.forEach(item => {
                if (item.element) {
                    if (isListView) {
                        item.element.classList.remove('fm-hidden');
                    } else {
                        item.element.style.display = '';
                    }
                }
            });
        }

        // 绑定搜索事件
        bindSearchEvents();
        
        // 绑定Grid View checkbox事件
        bindGridViewCheckboxes();
    };

    // ================= 绑定网格视图checkbox事件 =================
    function bindGridViewCheckboxes() {
        
        // 绑定所有网格项的checkbox
        const checkboxes = document.querySelectorAll('#gridView .fm-grid-checkbox');
        
        checkboxes.forEach((checkbox, index) => {
            // 移除旧的事件监听器
            const newCheckbox = checkbox.cloneNode(true);
            checkbox.parentNode.replaceChild(newCheckbox, checkbox);
            
            // 添加新的点击事件
            newCheckbox.addEventListener('click', function(e) {
                e.stopPropagation();
                window.toggleGridItemSelection(this);
            });
        });
    }

    // ================= 搜索功能（仅供网格视图使用）=================
    window.handleSearch = function(event) {
        if (isCurrentViewList()) {
            return;
        }

        if (event.key === 'Enter' || event.type === 'keyup' || event.type === 'input') {
            const searchInput = document.getElementById('searchInput');
            if (!searchInput) return;

            const searchTerm = searchInput.value.trim().toLowerCase();
            currentSearchTerm = searchTerm;

            if (searchTerm === '') {
                clearSearch();
                return;
            }

            performSearch(searchTerm);
        }
    };

    function performSearch(searchTerm) {
        
        if (!searchTerm) {
            clearSearch();
            return;
        }

        refreshItemsData();

        // 只过滤，不直接操作显示
        filteredItems = allItems.filter(item => {
            const itemName = item.name.toLowerCase();
            const shouldShow = itemName.includes(searchTerm);
            item.isVisible = shouldShow;
            return shouldShow;
        });

        // 先隐藏所有项目
        allItems.forEach(item => {
            if (item.element) {
                item.element.style.display = 'none';
            }
        });

        // 如果没有匹配结果
        if (filteredItems.length === 0) {
            const paginationWrapper = document.getElementById('paginationWrapper');
            if (paginationWrapper) paginationWrapper.style.display = 'none';
            
            // 显示空状态消息
            const emptyState = document.getElementById('emptySearchState');
            if (emptyState) emptyState.style.display = 'flex';
            
            showSearchResultsInfo(searchTerm, 0);
            return;
        }

        // 隐藏空状态
        const emptyState = document.getElementById('emptySearchState');
        if (emptyState) emptyState.style.display = 'none';

        // 高亮搜索结果
        highlightSearchMatches(searchTerm);

        // 重置到第一页
        currentPage = 1;

        // 更新分页（这会显示当前页的项目）
        updatePagination();

        // 如果结果不超过一页，显示所有匹配项
        if (filteredItems.length <= ITEMS_PER_PAGE) {
            filteredItems.forEach(item => {
                if (item.element) {
                    item.element.style.display = '';
                }
            });
        } else {
            // 否则只显示第一页
            showPage(1);
        }

        showSearchResultsInfo(searchTerm, filteredItems.length);
    }

    function highlightSearchMatches(searchTerm) {
        if (!searchTerm) return;

        // 移除已有的高亮
        document.querySelectorAll('.fm-highlight').forEach(el => {
            const parent = el.parentNode;
            parent.replaceChild(document.createTextNode(el.textContent), el);
            parent.normalize();
        });

        // 为匹配的项目添加高亮
        filteredItems.forEach(item => {
            if (item.element) {
                const nameElement = item.element.querySelector('.fm-grid-item-name, .fm-list-name');
                if (nameElement) {
                    const originalText = nameElement.textContent || nameElement.innerText;
                    const highlightedText = originalText.replace(
                        new RegExp(`(${escapeRegExp(searchTerm)})`, 'gi'),
                        '<span class="fm-highlight">$1</span>'
                    );
                    nameElement.innerHTML = highlightedText;
                }
            }
        });
    }

    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    window.clearSearch = function() {
        if (isCurrentViewList()) {
            return;
        }

        const searchInput = document.getElementById('searchInput');
        const searchClear = document.getElementById('searchClear');
        const mobileSearchInput = document.getElementById('mobileSearchInput');
        const mobileSearchClear = document.getElementById('mobileSearchClear');

        if (searchInput) searchInput.value = '';
        if (searchClear) searchClear.style.display = 'none';
        if (mobileSearchInput) mobileSearchInput.value = '';
        if (mobileSearchClear) mobileSearchClear.style.display = 'none';

        currentSearchTerm = '';

        // 隐藏空状态消息
        const emptyState = document.getElementById('emptySearchState');
        if (emptyState) {
            emptyState.style.display = 'none';
        }

        refreshItemsData();

        const isListView = isCurrentViewList();

        // 显示所有项目
        allItems.forEach(item => {
            if (item.element) {
                if (isListView) {
                    item.element.classList.remove('fm-hidden');
                } else {
                    item.element.style.display = '';
                }
                item.isVisible = true;
            }
        });

        // 移除高亮
        document.querySelectorAll('.fm-highlight').forEach(el => {
            const parent = el.parentNode;
            parent.replaceChild(document.createTextNode(el.textContent), el);
            parent.normalize();
        });

        filteredItems = [...allItems];
        currentPage = 1;

        window.initializePaginationAndSearch();

        document.getElementById('searchResultsInfo')?.remove();
    };

    function showSearchResultsInfo(searchTerm, resultCount) {
        const oldInfo = document.getElementById('searchResultsInfo');
        if (oldInfo) oldInfo.remove();

        if (!searchTerm) return;

        const infoElement = document.createElement('div');
        infoElement.id = 'searchResultsInfo';
        infoElement.className = 'fm-search-results-info';
        infoElement.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; padding: 8px 16px; background: var(--bg-gray); border-radius: 6px; margin: 10px 0;">
                <i class="fas fa-search" style="color: var(--text-secondary);"></i>
                <span style="color: var(--text-primary); font-weight: 500;">Search results for "${searchTerm}"</span>
                <span style="color: var(--text-secondary); margin-left: auto;">${resultCount} items found</span>
                <button onclick="clearSearch()" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                    Clear <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        const filesContainer = document.querySelector('.fm-files-container');
        if (filesContainer) {
            filesContainer.parentNode.insertBefore(infoElement, filesContainer);
        }
    }

    // ================= 绑定搜索事件 =================
    function bindSearchEvents() {
        // 如果是列表视图，不绑定网格视图的搜索事件
        if (isCurrentViewList()) {
            return;
        }

        const searchInput = document.getElementById('searchInput');
        const searchClear = document.getElementById('searchClear');

        if (searchInput) {
            // 移除旧的事件监听器
            const newSearchInput = searchInput.cloneNode(true);
            searchInput.parentNode.replaceChild(newSearchInput, searchInput);
            
            // 移除 onkeyup 属性，使用 addEventListener
            newSearchInput.removeAttribute('onkeyup');
            newSearchInput.id = 'searchInput';
            
            // 绑定 input 事件
            newSearchInput.addEventListener('input', function() {
                
                const searchClear = document.getElementById('searchClear');
                if (searchClear) {
                    searchClear.style.display = this.value ? 'block' : 'none';
                }

                if (this.value.trim() === '') {
                    clearSearch();
                } else {
                    const searchTerm = this.value.trim().toLowerCase();
                    if (searchTerm !== currentSearchTerm) {
                        performSearch(searchTerm);
                    }
                }
            });
            
            // 绑定 keyup 事件（处理 Enter 键）
            newSearchInput.addEventListener('keyup', function(e) {
                if (e.key === 'Enter') {
                    const searchTerm = this.value.trim().toLowerCase();
                    if (searchTerm) {
                        performSearch(searchTerm);
                    } else {
                        clearSearch();
                    }
                }
            });

            if (searchClear) {
                searchClear.style.display = newSearchInput.value ? 'block' : 'none';
                searchClear.onclick = clearSearch;
            }
        }
    }

    // ================= 移动端搜索函数 =================
    function setupMobileSearchSync() {
        const mobileInput = document.getElementById('mobileSearchInput');
        const desktopInput = document.getElementById('searchInput');

        if (mobileInput) {
            mobileInput.removeAttribute('onkeyup');
            
            // 移除旧的事件监听器（通过克隆）
            const newMobileInput = mobileInput.cloneNode(true);
            mobileInput.parentNode.replaceChild(newMobileInput, mobileInput);
            newMobileInput.removeAttribute('onkeyup');
            newMobileInput.id = 'mobileSearchInput';
            
            // 绑定input事件
            newMobileInput.addEventListener('input', function(e) {
                const searchValue = this.value;
                
                const desktopInput = document.getElementById('searchInput');
                if (desktopInput) {
                    desktopInput.value = searchValue;
                }

                const mobileClear = document.getElementById('mobileSearchClear');
                if (mobileClear) {
                    mobileClear.style.display = searchValue ? 'block' : 'none';
                }

                if (searchValue.trim() === '') {
                    if (isCurrentViewList()) {
                        clearListViewSearch();
                    } else {
                        clearSearch();
                    }
                } else {
                    const searchTerm = searchValue.trim().toLowerCase();
                    if (isCurrentViewList()) {
                        performListViewSearch(searchTerm);
                    } else {
                        performSearch(searchTerm);
                    }
                }
            });
            
            // 绑定keyup事件（处理Enter键）
            newMobileInput.addEventListener('keyup', function(e) {
                if (e.key === 'Enter') {
                    const searchTerm = this.value.trim().toLowerCase();
                    
                    if (searchTerm === '') {
                        if (isCurrentViewList()) {
                            clearListViewSearch();
                        } else {
                            clearSearch();
                        }
                    } else {
                        if (isCurrentViewList()) {
                            performListViewSearch(searchTerm);
                        } else {
                            performSearch(searchTerm);
                        }
                    }
                }
            });
            
        }

        const mobileClear = document.getElementById('mobileSearchClear');
        if (mobileClear) {
            mobileClear.onclick = clearMobileSearch;
        }
    }


    window.clearMobileSearch = function() {
        const mobileInput = document.getElementById('mobileSearchInput');
        const desktopInput = document.getElementById('searchInput');

        if (mobileInput) mobileInput.value = '';
        if (desktopInput) desktopInput.value = '';

        const mobileClear = document.getElementById('mobileSearchClear');
        if (mobileClear) mobileClear.style.display = 'none';

        if (isCurrentViewList()) {
            clearListViewSearch();
        } else {
            clearSearch();
        }
    };

    // ================= 全局Toast函数 =================
    window.showToast = function(title, message, type = 'info') {
        const toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) return;

        const toast = document.createElement('div');
        toast.className = `fm-toast ${type}`;

        const icons = {
            'success': '✅',
            'error': '❌',
            'warning': '⚠️',
            'info': 'ℹ️'
        };

        toast.innerHTML = `
            <div class="fm-toast-icon">${icons[type] || icons.info}</div>
            <div class="fm-toast-content">
                <div class="fm-toast-title">${title}</div>
                <div class="fm-toast-message">${message}</div>
            </div>
            <button class="fm-toast-close" onclick="this.parentElement.remove()">×</button>
        `;

        toastContainer.appendChild(toast);

        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 5000);
    };

    // ================= 文件夹模态框函数 =================
    window.showCreateFolderModal = function() {
        const modal = document.getElementById('createFolderModal');
        const input = document.getElementById('folderNameInput');

        if (modal) modal.classList.add('active');
        if (input) {
            input.value = '';
            setTimeout(() => input.focus(), 100);
        }
    };

    window.hideCreateFolderModal = function() {
        const modal = document.getElementById('createFolderModal');
        if (modal) modal.classList.remove('active');
    };

    // ================= 全局登出函数 =================
    window.showLogoutModal = function() {
        const modal = document.createElement('div');
        modal.className = 'fm-modal-overlay active';
        modal.id = 'logoutModal';

        modal.innerHTML = `
            <div class="fm-modal-box">
                <div class="fm-modal-icon-header warning">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                    </svg>
                </div>
                <div class="fm-modal-content">
                    <h3>Confirm Logout</h3>
                    <p>Are you sure you want to logout?</p>
                    <p style="color: var(--text-secondary); font-size: 14px; margin-top: 12px;">You will need to login again to access your files.</p>
                </div>
                <div class="fm-modal-actions">
                    <button class="fm-btn-text" onclick="hideLogoutModal()">Cancel</button>
                    <button class="fm-btn-danger" onclick="confirmLogout()">Logout</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    };

    window.hideLogoutModal = function() {
        const modal = document.getElementById('logoutModal');
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => {
                modal.remove();
            }, 300);
        }
    };

    window.confirmLogout = function() {
        localStorage.removeItem('spaceHSG_user');
        localStorage.removeItem('spaceHSG_viewMode');
        localStorage.removeItem('spaceHSG_currentPage');
        localStorage.removeItem('spaceHSG_searchTerm');
        localStorage.removeItem('spaceHSG_listView_page');
        localStorage.removeItem('spaceHSG_listView_search');
        window.location.href = _cfg.logoutUrl || '';
    };

    // ================= 批量删除模态框 =================
    window.showBatchDeleteModal = function(count) {
        const modal = document.getElementById('batchDeleteModal');
        const countSpan = document.getElementById('batchDeleteCount');
        if (countSpan) {
            countSpan.textContent = count;
        }
        if (modal) {
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('active'), 10);
        }
    };

    window.hideBatchDeleteModal = function() {
        const modal = document.getElementById('batchDeleteModal');
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
        }
    };

    window.confirmBatchDelete = async function() {
        
        hideBatchDeleteModal();
        
        const isListView = isCurrentViewList();
        
        let selectedCheckboxes;
        
        if (isListView) {
            selectedCheckboxes = document.querySelectorAll('#listView .fm-list-checkbox.selected');
        } else {
            selectedCheckboxes = document.querySelectorAll('#gridView .fm-grid-checkbox.selected');
        }
        
        if (selectedCheckboxes.length === 0) {
            showToast('Error', 'No items selected', 'error');
            return;
        }
        
        const itemsToDelete = [];
        selectedCheckboxes.forEach((checkbox, idx) => {
            const item = checkbox.closest(isListView ? '.fm-list-item' : '.fm-grid-item');
            
            if (item && item.dataset.path) {
                const deleteItem = {
                    path: item.dataset.path,
                    name: item.dataset.name,
                    element: item
                };
                itemsToDelete.push(deleteItem);
            }
        });
        
        if (itemsToDelete.length === 0) {
            showToast('Error', 'No valid items to delete', 'error');
            return;
        }
        
        // 显示加载提示
        showToast('Deleting', `Deleting ${itemsToDelete.length} item(s)...`, 'info');
        
        let successCount = 0;
        let failCount = 0;
        
        for (const item of itemsToDelete) {
            try {
                // 直接使用 item.path，不拼接 currentPath
                // item.path 已经是完整的相对路径（例如 "IT\New folder\file.xlsx"）
                const url = buildAppUrl('Home/Delete') + '?path=' + encodeURIComponent(item.path);
                
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    const result = await response.json();
                    
                    if (result.success) {
                        successCount++;
                        // 从DOM中移除
                        if (item.element) {
                            item.element.remove();
                        }
                    } else {
                        failCount++;
                    }
                } else {
                    failCount++;
                    const errorText = await response.text();
                }
            } catch (error) {
                failCount++;
            }
        }
        
        // 显示结果
        if (successCount > 0 && failCount === 0) {
            showToast('Success', `Successfully deleted ${successCount} item(s)`, 'success');
        } else if (successCount > 0 && failCount > 0) {
            showToast('Partial Success', `Deleted ${successCount} item(s), ${failCount} failed`, 'warning');
        } else {
            showToast('Error', `Failed to delete ${failCount} item(s)`, 'error');
        }
        
        // 清除选择并刷新
        clearSelection();
        
        // 刷新页面
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    };

    // ================= 导航函数 =================
    window.navigateToItem = function(url) {
        if (url) {
            window.location.href = url;
        }
    };

    window.navigateToItemByElement = function(element) {
        const listItem = element.closest('.fm-list-item');
        if (listItem) {
            const path = listItem.dataset.path;
            const type = listItem.dataset.type;

            if (path && type) {
                if (type === 'Folder') {
                    window.location.href = (_cfg.indexUrl || '') + '?path=' + encodeURIComponent(path);
                } else {
                    window.location.href = (_cfg.downloadUrl || '') + '?path=' + encodeURIComponent(path);
                }
            }
        }
    };

        // ================= 列表视图空搜索结果 =================
    function showListViewEmptyState(searchTerm) {
        const emptyState = document.getElementById('emptySearchState');
        if (emptyState) {
            emptyState.style.display = 'flex';
        }
    }
})();

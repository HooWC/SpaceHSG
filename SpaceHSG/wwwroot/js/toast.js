// Toast Notification System

// ========== Toast 显示函数 ==========
function showToast(title, message, type = 'info') {
    // 1. 确保容器存在，如果不存在则创建
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'fm-toast-container';
        container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 99999; display: flex; flex-direction: column; gap: 12px; max-width: 400px;';
        document.body.appendChild(container);
    }

    // 2. 创建 Toast 元素
    const toast = document.createElement('div');
    toast.className = `fm-toast ${type}`;
    
    // 3. 图标和边框颜色
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    const borderColors = {
        success: '#107c10',
        error: '#e81123',
        warning: '#ffb900',
        info: '#0078d4'
    };

    // 4. 设置完整的内联样式
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark' || 
                   document.documentElement.getAttribute('data-bs-theme') === 'dark';
    
    const bgColor = isDark ? '#2d2d2d' : 'white';
    const titleColor = isDark ? '#e8e8e8' : '#201f1e';
    const messageColor = isDark ? '#a0a0a0' : '#605e5c';
    const closeColor = isDark ? '#a0a0a0' : '#605e5c';

    toast.style.cssText = `
        background: ${bgColor};
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.25);
        padding: 16px 20px;
        display: flex;
        align-items: flex-start;
        gap: 12px;
        border-left: 4px solid ${borderColors[type]};
        min-width: 300px;
        max-width: 400px;
        transform: translateX(400px);
        opacity: 0;
        transition: all 0.3s ease;
    `;

    // 5. 设置内容
    toast.innerHTML = `
        <div style="font-size: 24px; flex-shrink: 0;">${icons[type] || icons.info}</div>
        <div style="flex: 1;">
            <div style="font-weight: 600; margin-bottom: 4px; color: ${titleColor}; font-size: 14px;">${title}</div>
            <div style="font-size: 13px; color: ${messageColor}; line-height: 1.4;">${message}</div>
        </div>
        <button onclick="this.parentElement.remove()" 
                style="background: none; border: none; color: ${closeColor}; cursor: pointer; font-size: 20px; padding: 0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 4px; transition: all 0.2s ease;">
            ×
        </button>
    `;

    // 6. 添加到容器
    container.appendChild(toast);

    // 7. 立即触发滑入动画
    setTimeout(() => {
        toast.style.transform = 'translateX(0)';
        toast.style.opacity = '1';
    }, 10);

    // 8. ========== 设置显示时间 ==========
    const displayTime = type === 'error' ? 5000 : 5000;
    
    // 9. 自动隐藏
    const hideTimer = setTimeout(() => {
        toast.style.transform = 'translateX(400px)';
        toast.style.opacity = '0';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 300);
    }, displayTime);

    // 10. 保存计时器引用，以便手动关闭时可以取消
    toast.hideTimer = hideTimer;

    return toast;
}

// ========== 手动关闭 Toast ==========
function closeToast(toastElement) {
    if (toastElement && toastElement.hideTimer) {
        clearTimeout(toastElement.hideTimer);
    }
    if (toastElement) {
        toastElement.style.transform = 'translateX(400px)';
        toastElement.style.opacity = '0';
        setTimeout(() => {
            if (toastElement.parentNode) {
                toastElement.remove();
            }
        }, 300);
    }
}

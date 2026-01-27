// ========== Login Logic ==========
document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('loginBtn');

    const loginConfig = window.loginConfig || {};
    const loginUrl = loginConfig.loginUrl || '/Account/Login';
    const homeUrl = loginConfig.homeUrl || '/Home/Index';

    // 点击登录按钮
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const user = document.getElementById('username').value;
            const pass = document.getElementById('password').value;

            if (!user || !pass) {
                if (typeof showToast === 'function') {
                    showToast('Login Error', 'Please enter username and password.', 'error');
                } else {
                    alert('Please enter username and password.');
                }
                return;
            }

            try {
                const response = await fetch(loginUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: `username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`
                });

                if (response.ok) {
                    const result = await response.json();

                    if (result.success) {
                        if (typeof showToast === 'function') {
                            showToast('Success', 'Login successful! Redirecting...', 'success');
                            setTimeout(() => {
                                window.location.href = homeUrl;
                            }, 1000);
                        } else {
                            window.location.href = homeUrl;
                        }
                    } else {
                        if (typeof showToast === 'function') {
                            showToast('Login Failed', result.message || 'Invalid credentials', 'error');
                        } else {
                            alert(result.message || 'Invalid credentials');
                        }
                    }
                } else {
                    console.error('HTTP Error:', response.status);
                    if (typeof showToast === 'function') {
                        showToast('Server Error', `Server returned error: ${response.status}`, 'error');
                    } else {
                        alert(`Server Error: ${response.status}`);
                    }
                }
            } catch (err) {
                console.error('AJAX Failed Request:', err);
                if (typeof showToast === 'function') {
                    showToast('Network Error', 'Network request failed. Please check your connection.', 'error');
                } else {
                    alert('Network request failed. Please check your connection.');
                }
            }
        });
    }

    // 主题切换代码 (保持不变)
    const themeSwitch = document.getElementById('themeSwitch');
    const toggleText = document.getElementById('toggleText');
    const savedTheme = localStorage.getItem('theme') || 'light';

    if (themeSwitch) {
        themeSwitch.checked = savedTheme === 'dark';
        if (toggleText) toggleText.innerText = savedTheme === 'dark' ? 'Dark Mode' : 'Light Mode';

        themeSwitch.addEventListener('change', () => {
            const nextTheme = themeSwitch.checked ? 'dark' : 'light';
            document.documentElement.setAttribute('data-bs-theme', nextTheme);
            localStorage.setItem('theme', nextTheme);
            if (toggleText) toggleText.innerText = nextTheme === 'dark' ? 'Dark Mode' : 'Light Mode';
        });
    }
});
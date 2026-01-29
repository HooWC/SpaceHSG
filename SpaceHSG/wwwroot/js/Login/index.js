// ========== Login Logic ==========
document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('loginBtn');

    const loginConfig = window.loginConfig || {};
    const loginUrl = loginConfig.loginUrl || '/Account/Login';
    const homeUrl = loginConfig.homeUrl || '/Home/Index';
    const checkSessionUrl = loginConfig.checkSessionUrl || '/Account/CheckSession';

    // ========== checking login localStorage ==========
    const checkAutoLogin = async () => {
        const userInfo = localStorage.getItem('spaceHSG_user');
        
        if (userInfo) {
            try {
                const user = JSON.parse(userInfo);
                console.log('Found user info in localStorage:', user);
                
                // checking session
                const response = await fetch(checkSessionUrl);
                const result = await response.json();
                
                if (result.isLoggedIn) {
                    console.log('Session is valid, redirecting to home...');
                    window.location.href = homeUrl;
                } else {
                    console.log('Session expired, clearing localStorage');
                    localStorage.removeItem('spaceHSG_user');
                }
            } catch (error) {
                console.error('Auto-login check failed:', error);
                localStorage.removeItem('spaceHSG_user');
            }
        }
    };
    
    checkAutoLogin();

    // login btn click event
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
                        // ========== Save user information to localStorage ==========
                        const userInfo = {
                            username: result.username || user,
                            displayName: result.displayName || user,
                            department: result.department || 'Unknown',
                            role: result.role || 'User',
                            loginTime: new Date().toISOString()
                        };
                        
                        localStorage.setItem('spaceHSG_user', JSON.stringify(userInfo));
                        console.log('User info saved to localStorage:', userInfo);
                        
                        if (typeof showToast === 'function') {
                            showToast('Success', `Welcome, ${userInfo.displayName}! (${userInfo.department})`, 'success');
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
                    }
                }
            } catch (err) {
                console.error('AJAX Failed Request:', err);
                if (typeof showToast === 'function') {
                    showToast('Network Error', 'Network request failed. Please check your connection.', 'error');
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
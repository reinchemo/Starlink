// script.js – With Login System, Auto-calculating Totals, Save Button, and Supabase Cloud Sync
// FIX APPLIED: handleChangePassword() no longer crashes when opened before login
// FIX APPLIED: Amount display now uses .amount-display class with visible styling
// FIX APPLIED: Duplicate column headers removed on mobile
// FIX APPLIED: Editable column names for ALL columns (default + custom)
// FIX APPLIED: Mobile expenditure cells with .expenditure-cell class
// FIX APPLIED: Mobile column totals with .column-total-cell class
// FIX APPLIED: M-Pesa message parsing - extracts amount, date, time, and transaction cost
// FIX APPLIED: Transaction fees tracking with separate display
// FIX APPLIED: Delete confirmation with cloud warning
// FIX APPLIED: Transaction fees calculated from ALL records in cloud
// FIX APPLIED: Transaction fee captured and added when Save is clicked
// FIX APPLIED: Improved M-Pesa parsing for "Transaction cost, Ksh57.00" format
// FIX APPLIED: Fixed fee multiplication issue
// FIX APPLIED: Fixed fee removal on row deletion
// FIX APPLIED: Added fee rebuild on load to eliminate phantom fees
// FIX APPLIED: Fixed session persistence on page refresh
// FIX APPLIED: Removed column delete button only - kept row and date delete
// FIX APPLIED: Transaction Reference hover tooltip shows full message
// FIX APPLIED: Empty Transaction Reference clears Amount field
// FIX APPLIED: Search bar for finding transaction codes

(function() {
        "use strict";

        // ========================================
        // 🔥 SUPABASE CONFIG
        // ========================================
        const SUPABASE_URL = 'https://ujhasodlnduoozlmxdbv.supabase.co';
        const SUPABASE_KEY = 'sb_publishable_DK0i6IuTFcE6_g1P6gG_-A_IkwguvIL';

        let supabaseClient = null;
        const SYNC_ENABLED = true;

        // ========================================
        // INITIALIZE SUPABASE
        // ========================================
        function initSupabase() {
            try {
                if (typeof supabase !== 'undefined') {
                    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
                    console.log('✅ Supabase initialized');
                    return true;
                } else {
                    console.log('⏳ Loading Supabase library...');
                    setTimeout(() => {
                        if (typeof supabase !== 'undefined') {
                            supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
                            console.log('✅ Supabase initialized');
                        }
                    }, 1000);
                    return false;
                }
            } catch (e) {
                console.error('❌ Supabase error:', e);
                return false;
            }
        }

        // ========================================
        // TOAST NOTIFICATIONS
        // ========================================
        function showToast(message, type = 'info') {
            const existing = document.querySelector('.toast-message');
            if (existing) existing.remove();

            const toast = document.createElement('div');
            toast.className = 'toast-message';
            toast.textContent = message;
            toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 12px 24px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 0.85rem;
            z-index: 9999;
            background: ${type === 'success' ? 'rgba(111, 203, 147, 0.15)' : type === 'error' ? 'rgba(226, 104, 91, 0.15)' : 'rgba(79, 182, 168, 0.15)'};
            color: ${type === 'success' ? 'var(--accent-green)' : type === 'error' ? 'var(--accent-red)' : 'var(--accent-teal)'};
            border: 1px solid ${type === 'success' ? 'rgba(111, 203, 147, 0.2)' : type === 'error' ? 'rgba(226, 104, 91, 0.2)' : 'rgba(79, 182, 168, 0.2)'};
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px var(--shadow);
            max-width: 90%;
            text-align: center;
        `;
            document.body.appendChild(toast);

            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transition = 'opacity 0.3s ease';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }

        // ========================================
        // SUPABASE SYNC FUNCTIONS
        // ========================================
        async function syncToCloud(showToastMsg = true) {
            if (!SYNC_ENABLED || !supabaseClient) {
                if (showToastMsg) showToast('⚠️ Supabase not connected', 'info');
                return;
            }

            try {
                data = sortDataByDate(data);

                const store = {
                    data: data,
                    nextDateId: nextDateId,
                    nextRowId: nextRowId,
                    nextColId: nextColId,
                    customColumns: customColumns,
                    savedCustomColumns: savedCustomColumns,
                    savedDates: savedDates,
                    editModes: editModes,
                    columnNameEdits: columnNameEdits,
                    transactionFees: transactionFees,
                    totalTransactionFees: totalTransactionFees,
                    lastUpdated: new Date().toISOString()
                };

                const { error } = await supabaseClient
                    .from('expenditure_data')
                    .upsert({
                        id: 1,
                        data: store,
                        updated_by: currentUser ? currentUser.username : 'anonymous',
                        last_updated: new Date().toISOString()
                    }, { onConflict: 'id' });

                if (error) {
                    console.error('❌ Sync error:', error);
                    if (showToastMsg) showToast('❌ Sync failed: ' + error.message, 'error');
                } else {
                    console.log('✅ Synced to cloud');
                    if (showToastMsg) showToast('✅ Data synced to cloud', 'success');
                }
            } catch (e) {
                console.error('❌ Sync error:', e);
                if (showToastMsg) showToast('❌ Sync error: ' + e.message, 'error');
            }
        }

        async function syncFromCloud(showToastMsg = true) {
            if (!SYNC_ENABLED || !supabaseClient) {
                if (showToastMsg) showToast('⚠️ Supabase not connected', 'info');
                return false;
            }

            try {
                console.log('📥 Pulling from cloud...');

                const { data: result, error } = await supabaseClient
                    .from('expenditure_data')
                    .select('data, updated_by, last_updated')
                    .eq('id', 1)
                    .single();

                if (error) {
                    if (error.code === 'PGRST116') {
                        if (showToastMsg) showToast('ℹ️ No cloud data yet. Add data and it will sync.', 'info');
                    } else {
                        if (showToastMsg) showToast('⚠️ Pull error: ' + error.message, 'error');
                    }
                    return false;
                }

                if (result && result.data) {
                    const cloudData = result.data;

                    data = cloudData.data || data;
                    nextDateId = cloudData.nextDateId || nextDateId;
                    nextRowId = cloudData.nextRowId || nextRowId;
                    nextColId = cloudData.nextColId || nextColId;
                    customColumns = cloudData.customColumns || customColumns;
                    savedCustomColumns = cloudData.savedCustomColumns || savedCustomColumns;
                    savedDates = cloudData.savedDates || savedDates;
                    editModes = cloudData.editModes || editModes;
                    if (cloudData.columnNameEdits) {
                        columnNameEdits = cloudData.columnNameEdits;
                        saveColumnNameEdits();
                    }
                    if (cloudData.transactionFees) {
                        transactionFees = cloudData.transactionFees || {};
                        totalTransactionFees = cloudData.totalTransactionFees || 0;
                    }

                    rebuildFeesFromData();

                    data = sortDataByDate(data);
                    saveToStorage();

                    console.log('✅ Pulled from cloud');
                    console.log('📊 Total Transaction Fees:', totalTransactionFees);

                    render();
                    setTimeout(() => {
                        updateTotalsOnly();
                        updateTransactionFeesDisplay();
                        console.log('✅ Totals updated after cloud sync');
                        console.log('💳 Transaction Fees Displayed:', totalTransactionFees);
                    }, 100);

                    if (showToastMsg) showToast('✅ Data loaded from cloud', 'success');
                    return true;
                }
            } catch (e) {
                console.error('❌ Pull error:', e);
                if (showToastMsg) showToast('❌ Pull error: ' + e.message, 'error');
            }
            return false;
        }

        // ========================================
        // REBUILD FEES FROM DATA
        // ========================================
        function rebuildFeesFromData() {
            console.log('🔄 Rebuilding fees from data...');
            transactionFees = {};
            totalTransactionFees = 0;

            const allCols = getAllColumns();

            data.forEach(group => {
                group.rows.forEach(row => {
                    let rowFee = null;
                    allCols.forEach(col => {
                        const transKey = col.key + '_transaction';
                        const transVal = row[transKey];
                        if (transVal && transVal.trim() !== '') {
                            const parsed = parseMpesaMessage(transVal);
                            if (parsed && parsed.transactionCost !== null && parsed.transactionCost > 0) {
                                rowFee = parsed.transactionCost;
                            }
                        }
                    });
                    if (rowFee !== null && rowFee > 0) {
                        const key = group.id + '_' + row.id;
                        transactionFees[key] = rowFee;
                        console.log(`✅ Fee found: KSh ${rowFee} for row ${row.id}`);
                    }
                });
            });

            recalculateTotalFees();
            console.log('📊 Total Transaction Fees after rebuild:', totalTransactionFees);
            updateTransactionFeesDisplay();
            saveToStorage();
            return totalTransactionFees;
        }

        // ========================================
        // CHECK FOR DUPLICATE TRANSACTION MESSAGES
        // ========================================
        function checkForDuplicateTransactions(dateId) {
            const group = data.find(d => d.id === dateId);
            if (!group) return null;

            const allCols = getAllColumns();
            const transactionCodes = [];

            group.rows.forEach(row => {
                allCols.forEach(col => {
                    const transKey = col.key + '_transaction';
                    const transVal = row[transKey];
                    if (transVal && transVal.trim() !== '') {
                        const parsed = parseMpesaMessage(transVal);
                        if (parsed && parsed.transactionCode) {
                            transactionCodes.push({
                                rowId: row.id,
                                code: parsed.transactionCode
                            });
                        }
                    }
                });
            });

            const codeMap = {};
            for (let item of transactionCodes) {
                if (codeMap[item.code]) {
                    return item.code;
                }
                codeMap[item.code] = item.rowId;
            }
            return null;
        }

        // ========================================
        // SORT DATA BY DATE (LATEST FIRST)
        // ========================================
        function sortDataByDate(dataArray) {
            if (!dataArray || dataArray.length === 0) return dataArray;
            return [...dataArray].sort((a, b) => {
                const dateA = new Date(a.date);
                const dateB = new Date(b.date);
                return dateB - dateA;
            });
        }

        // ========================================
        // USER MANAGEMENT
        // ========================================
        const USERS_KEY = 'starlink_users';

        const DEFAULT_USERS = [
            { id: 1, username: 'admin', password: 'admin123', role: 'admin' },
            { id: 2, username: 'grace', password: 'grace123', role: 'user' }
        ];

        function getUsers() {
            const stored = localStorage.getItem(USERS_KEY);
            if (stored) {
                try {
                    const users = JSON.parse(stored);
                    if (users && users.length > 0) {
                        return users;
                    }
                } catch (e) {
                    console.warn('⚠️ Failed to parse users from localStorage:', e);
                }
            }
            localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
            return DEFAULT_USERS;
        }

        function saveUsers(users) {
            localStorage.setItem(USERS_KEY, JSON.stringify(users));
            console.log('✅ Users saved to localStorage:', users.length, 'users');
            return true;
        }

        function findUser(username) {
            const users = getUsers();
            return users.find(u => u.username.toLowerCase() === username.toLowerCase());
        }

        function authenticateUser(username, password) {
            const users = getUsers();
            console.log('🔍 Authenticating user:', username);

            const user = users.find(u =>
                u.username.toLowerCase() === username.toLowerCase() &&
                u.password === password
            );

            if (user) {
                console.log('✅ User authenticated:', user.username);
            } else {
                console.log('❌ Authentication failed for:', username);
            }
            return user || null;
        }

        function updateUserPassword(userId, newPassword) {
            console.log('🔍 Looking for user with ID:', userId);

            const users = getUsers();
            const index = users.findIndex(u => u.id === userId);
            if (index === -1) {
                console.error('❌ User not found with ID:', userId);
                return false;
            }

            console.log('✅ User found:', users[index].username);
            users[index].password = newPassword;
            saveUsers(users);
            console.log('✅ Password updated for user:', users[index].username);
            return true;
        }

        function addUser(username, password, role = 'user') {
            const users = getUsers();
            if (findUser(username)) {
                console.warn('⚠️ Username already exists:', username);
                return false;
            }
            const maxId = users.reduce((max, u) => Math.max(max, u.id), 0);
            const newUser = { id: maxId + 1, username, password, role };
            users.push(newUser);
            saveUsers(users);
            console.log('✅ User added:', username, 'Role:', role);
            return true;
        }

        function updateUser(id, username, password, role) {
            const users = getUsers();
            const index = users.findIndex(u => u.id === id);
            if (index === -1) {
                console.error('❌ User not found with ID:', id);
                return false;
            }
            const existing = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.id !== id);
            if (existing) {
                console.warn('⚠️ Username already exists:', username);
                return false;
            }
            users[index] = {...users[index], username, password, role };
            saveUsers(users);
            console.log('✅ User updated:', username);
            return true;
        }

        function deleteUser(id) {
            const users = getUsers();
            const filtered = users.filter(u => u.id !== id);
            if (filtered.length === users.length) {
                console.warn('⚠️ User not found with ID:', id);
                return false;
            }
            saveUsers(filtered);
            console.log('✅ User deleted with ID:', id);
            return true;
        }

        // ========================================
        // DOM REFS - LOGIN
        // ========================================
        const loginScreen = document.getElementById('loginScreen');
        const forgotScreen = document.getElementById('forgotScreen');
        const changePasswordScreen = document.getElementById('changePasswordScreen');
        const mainApp = document.getElementById('mainApp');
        const usernameInput = document.getElementById('usernameInput');
        const passwordInput = document.getElementById('passwordInput');
        const loginBtn = document.getElementById('loginBtn');
        const loginError = document.getElementById('loginError');
        const loginSuccess = document.getElementById('loginSuccess');
        const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
        const backToLoginBtn = document.getElementById('backToLoginBtn');
        const changePasswordBtn = document.getElementById('changePasswordBtn');
        const changePasswordBackBtn = document.getElementById('changePasswordBackBtn');
        const changePasswordSaveBtn = document.getElementById('changePasswordSaveBtn');
        const changePasswordOld = document.getElementById('changePasswordOld');
        const changePasswordNew = document.getElementById('changePasswordNew');
        const changePasswordConfirm = document.getElementById('changePasswordConfirm');
        const changePasswordError = document.getElementById('changePasswordError');
        const changePasswordSuccess = document.getElementById('changePasswordSuccess');
        const logoutBtn = document.getElementById('logoutBtn');
        const userDisplay = document.getElementById('userDisplay');

        const adminPanelBtn = document.getElementById('adminPanelBtn');
        const adminPanel = document.getElementById('adminPanel');
        const adminPanelClose = document.getElementById('adminPanelClose');
        const adminPanelCloseBtn = document.getElementById('adminPanelCloseBtn');
        const userList = document.getElementById('userList');
        const addUserBtn = document.getElementById('addUserBtn');

        const userModal = document.getElementById('userModal');
        const userModalTitle = document.getElementById('userModalTitle');
        const userModalUsername = document.getElementById('userModalUsername');
        const userModalPassword = document.getElementById('userModalPassword');
        const userModalRole = document.getElementById('userModalRole');
        const userModalError = document.getElementById('userModalError');
        const userModalSave = document.getElementById('userModalSave');
        const userModalCancel = document.getElementById('userModalCancel');
        const userModalClose = document.getElementById('userModalClose');

        const syncNowBtn = document.getElementById('syncNowBtn');

        let editingUserId = null;
        let currentUser = null;

        // ========================================
        // LOGIN FUNCTIONS
        // ========================================
        function checkLogin() {
            const savedUser = sessionStorage.getItem('starlink_user');
            if (savedUser) {
                try {
                    currentUser = JSON.parse(savedUser);
                    const users = getUsers();
                    const exists = users.find(u => u.id === currentUser.id);
                    if (exists) {
                        console.log('✅ Session restored for user:', currentUser.username);
                        showMainApp();
                        return true;
                    } else {
                        sessionStorage.removeItem('starlink_user');
                        currentUser = null;
                    }
                } catch (e) {
                    console.warn('⚠️ Invalid session data:', e);
                    sessionStorage.removeItem('starlink_user');
                    currentUser = null;
                }
            }
            return false;
        }

        function attemptLogin() {
            const username = usernameInput.value.trim();
            const password = passwordInput.value.trim();

            if (!username || !password) {
                loginError.textContent = '❌ Please enter both username and password.';
                loginError.style.display = 'block';
                loginSuccess.style.display = 'none';
                return;
            }

            const user = authenticateUser(username, password);
            if (user) {
                loginError.style.display = 'none';
                loginSuccess.textContent = '✅ Login successful! Redirecting...';
                loginSuccess.style.display = 'block';
                currentUser = user;
                sessionStorage.setItem('starlink_user', JSON.stringify(user));
                console.log('✅ User logged in:', user.username, 'Role:', user.role);
                console.log('✅ Session saved to sessionStorage');
                setTimeout(() => {
                    showMainApp();
                }, 600);
            } else {
                loginSuccess.style.display = 'none';
                loginError.textContent = '❌ Invalid username or password.';
                loginError.style.display = 'block';
                passwordInput.value = '';
                passwordInput.focus();
                setTimeout(() => {
                    loginError.style.display = 'none';
                }, 3000);
            }
        }

        function showMainApp() {
            loginScreen.style.display = 'none';
            forgotScreen.style.display = 'none';
            changePasswordScreen.style.display = 'none';
            mainApp.style.display = 'block';
            if (userDisplay) {
                userDisplay.textContent = '👤 ' + currentUser.username;
            }
            if (adminPanelBtn) {
                adminPanelBtn.style.display = currentUser.role === 'admin' ? 'inline-flex' : 'none';
            }
            // Make sure currentUser is saved in session
            if (currentUser) {
                sessionStorage.setItem('starlink_user', JSON.stringify(currentUser));
            }
            if (typeof initMainApp === 'function') {
                initMainApp();
            }
        }

        function logout() {
            sessionStorage.removeItem('starlink_user');
            currentUser = null;
            mainApp.style.display = 'none';
            loginScreen.style.display = 'flex';
            forgotScreen.style.display = 'none';
            changePasswordScreen.style.display = 'none';
            usernameInput.value = '';
            passwordInput.value = '';
            loginError.style.display = 'none';
            loginSuccess.style.display = 'none';
            usernameInput.focus();
            console.log('🚪 User logged out');
        }

        function showForgotScreen() {
            loginScreen.style.display = 'none';
            forgotScreen.style.display = 'flex';
            changePasswordScreen.style.display = 'none';
            const forgotUsername = document.getElementById('forgotUsername');
            if (forgotUsername) forgotUsername.focus();
        }

        function showChangePasswordScreen() {
            loginScreen.style.display = 'none';
            forgotScreen.style.display = 'none';
            changePasswordScreen.style.display = 'flex';
            changePasswordOld.value = '';
            changePasswordNew.value = '';
            changePasswordConfirm.value = '';
            changePasswordError.style.display = 'none';
            changePasswordSuccess.style.display = 'none';
            changePasswordOld.focus();
        }

        function showLoginScreen() {
            forgotScreen.style.display = 'none';
            changePasswordScreen.style.display = 'none';
            loginScreen.style.display = 'flex';
            usernameInput.focus();
        }

        // ========================================
        // FIXED: HANDLE CHANGE PASSWORD
        // ========================================
        function handleChangePassword() {
            console.log('🔑 Change password button clicked');

            try {
                const oldPassword = changePasswordOld.value.trim();
                const newPassword = changePasswordNew.value.trim();
                const confirmPassword = changePasswordConfirm.value.trim();

                changePasswordError.style.display = 'none';
                changePasswordSuccess.style.display = 'none';

                if (!oldPassword || !newPassword || !confirmPassword) {
                    changePasswordError.textContent = '❌ Please fill in all fields.';
                    changePasswordError.style.display = 'block';
                    console.log('❌ Empty fields detected');
                    return;
                }

                let targetUser = currentUser;
                if (!targetUser) {
                    const typedUsername = (usernameInput && usernameInput.value.trim()) || '';
                    if (!typedUsername) {
                        changePasswordError.textContent = '❌ Enter your username on the login screen first, then click "Change Password".';
                        changePasswordError.style.display = 'block';
                        console.log('❌ No username available to resolve target user');
                        return;
                    }
                    targetUser = findUser(typedUsername);
                    if (!targetUser) {
                        changePasswordError.textContent = '❌ Username not found.';
                        changePasswordError.style.display = 'block';
                        console.log('❌ Username not found:', typedUsername);
                        return;
                    }
                } else {
                    const freshUser = findUser(currentUser.username);
                    if (freshUser) targetUser = freshUser;
                }

                if (oldPassword !== targetUser.password) {
                    changePasswordError.textContent = '❌ Old password is incorrect.';
                    changePasswordError.style.display = 'block';
                    changePasswordOld.value = '';
                    changePasswordOld.focus();
                    console.log('❌ Old password incorrect');
                    return;
                }

                if (newPassword !== confirmPassword) {
                    changePasswordError.textContent = '❌ New passwords do not match.';
                    changePasswordError.style.display = 'block';
                    changePasswordNew.value = '';
                    changePasswordConfirm.value = '';
                    changePasswordNew.focus();
                    console.log('❌ New passwords do not match');
                    return;
                }

                if (newPassword.length < 4) {
                    changePasswordError.textContent = '❌ New password must be at least 4 characters.';
                    changePasswordError.style.display = 'block';
                    console.log('❌ Password too short');
                    return;
                }

                console.log('🔄 Attempting to update password for user ID:', targetUser.id);
                const success = updateUserPassword(targetUser.id, newPassword);

                if (success) {
                    if (currentUser && currentUser.id === targetUser.id) {
                        currentUser.password = newPassword;
                        sessionStorage.setItem('starlink_user', JSON.stringify(currentUser));
                    }

                    changePasswordSuccess.textContent = '✅ Password changed successfully!';
                    changePasswordSuccess.style.display = 'block';
                    console.log('✅ Password changed for user:', targetUser.username);

                    changePasswordOld.value = '';
                    changePasswordNew.value = '';
                    changePasswordConfirm.value = '';

                    setTimeout(() => {
                        showToast('✅ Password changed successfully!', 'success');
                        showLoginScreen();
                    }, 1500);
                } else {
                    changePasswordError.textContent = '❌ Failed to update password. Please try again.';
                    changePasswordError.style.display = 'block';
                    console.error('❌ Failed to update password for user:', targetUser.username);
                }
            } catch (err) {
                console.error('❌ Unexpected error in handleChangePassword:', err);
                changePasswordError.textContent = '❌ Something went wrong. Please try again.';
                changePasswordError.style.display = 'block';
            }
        }

        function handleForgotPassword() {
            const forgotUsername = document.getElementById('forgotUsername');
            const forgotError = document.getElementById('forgotError');
            const forgotSuccess = document.getElementById('forgotSuccess');

            if (!forgotUsername) return;

            const username = forgotUsername.value.trim();
            forgotError.style.display = 'none';
            forgotSuccess.style.display = 'none';

            if (!username) {
                forgotError.textContent = '❌ Please enter your username.';
                forgotError.style.display = 'block';
                return;
            }

            const user = findUser(username);
            if (user) {
                if (currentUser && currentUser.role === 'admin') {
                    forgotSuccess.innerHTML = '✅ As admin, you can change passwords in the Admin Panel.';
                } else {
                    forgotSuccess.innerHTML = '✅ Password reset link sent to admin. Please contact your administrator.';
                }
                forgotSuccess.style.display = 'block';
                setTimeout(() => {
                    showLoginScreen();
                }, 3000);
            } else {
                forgotError.textContent = '❌ Username not found.';
                forgotError.style.display = 'block';
                setTimeout(() => {
                    forgotError.style.display = 'none';
                }, 3000);
            }
        }

        // ========================================
        // ADMIN PANEL
        // ========================================
        function renderUserList() {
            const users = getUsers();
            if (!userList) return;

            if (users.length === 0) {
                userList.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-dim);">No users found.</div>';
                return;
            }

            let html = '';
            users.forEach(user => {
                        const isCurrent = currentUser && currentUser.id === user.id;
                        const isAdmin = currentUser && currentUser.role === 'admin';
                        html += `
                <div class="user-item ${isCurrent ? 'current-user' : ''}">
                    <div class="user-info">
                        <span class="user-icon">${user.role === 'admin' ? '👑' : '👤'}</span>
                        <div class="user-details">
                            <span class="username">${user.username}</span>
                            <span class="user-role">${user.role} ${isCurrent ? '• <span class="current-badge">(you)</span>' : ''}</span>
                        </div>
                    </div>
                    <div class="user-actions">
                        ${isAdmin && !isCurrent ? `
                            <button class="btn-edit-user" data-id="${user.id}">✏️ Edit</button>
                            <button class="btn-delete-user" data-id="${user.id}">🗑️ Delete</button>
                        ` : isCurrent ? `
                            <span style="font-size:0.7rem; color:var(--text-dim);">Current user</span>
                        ` : `
                            <span style="font-size:0.7rem; color:var(--text-dim);">View only</span>
                        `}
                    </div>
                </div>
            `;
        });

        userList.innerHTML = html;

        if (currentUser && currentUser.role === 'admin') {
            document.querySelectorAll('.btn-edit-user').forEach(btn => {
                btn.addEventListener('click', function() {
                    const id = parseInt(this.dataset.id);
                    openUserModal(id);
                });
            });

            document.querySelectorAll('.btn-delete-user').forEach(btn => {
                btn.addEventListener('click', function() {
                    const id = parseInt(this.dataset.id);
                    if (confirm('Delete this user?')) {
                        if (deleteUser(id)) {
                            renderUserList();
                            if (currentUser && currentUser.id === id) {
                                logout();
                            }
                            showToast('✅ User deleted successfully', 'success');
                        }
                    }
                });
            });
        }
    }

    function openAdminPanel() {
        adminPanel.style.display = 'flex';
        renderUserList();
    }

    function closeAdminPanel() {
        adminPanel.style.display = 'none';
    }

    function openUserModal(userId = null) {
        userModalError.style.display = 'none';
        editingUserId = userId;

        if (userId) {
            const users = getUsers();
            const user = users.find(u => u.id === userId);
            if (user) {
                userModalTitle.textContent = '✏️ Edit User';
                userModalUsername.value = user.username;
                userModalPassword.value = user.password;
                userModalRole.value = user.role;
            }
        } else {
            userModalTitle.textContent = '➕ Add User';
            userModalUsername.value = '';
            userModalPassword.value = '';
            userModalRole.value = 'user';
        }

        userModal.style.display = 'flex';
        userModalUsername.focus();
    }

    function closeUserModal() {
        userModal.style.display = 'none';
        editingUserId = null;
        userModalError.style.display = 'none';
    }

    function saveUser() {
        const username = userModalUsername.value.trim();
        const password = userModalPassword.value.trim();
        const role = userModalRole.value;

        if (!username || !password) {
            userModalError.textContent = '❌ Please fill in all fields.';
            userModalError.style.display = 'block';
            return;
        }

        if (password.length < 4) {
            userModalError.textContent = '❌ Password must be at least 4 characters.';
            userModalError.style.display = 'block';
            return;
        }

        if (editingUserId) {
            const users = getUsers();
            const existing = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.id !== editingUserId);
            if (existing) {
                userModalError.textContent = '❌ Username already exists.';
                userModalError.style.display = 'block';
                return;
            }
            if (updateUser(editingUserId, username, password, role)) {
                if (currentUser && currentUser.id === editingUserId) {
                    currentUser = { ...currentUser, username, password, role };
                    sessionStorage.setItem('starlink_user', JSON.stringify(currentUser));
                    if (userDisplay) {
                        userDisplay.textContent = '👤 ' + currentUser.username;
                    }
                }
                closeUserModal();
                renderUserList();
                showToast('✅ User updated successfully', 'success');
            } else {
                userModalError.textContent = '❌ Failed to update user.';
                userModalError.style.display = 'block';
            }
        } else {
            if (addUser(username, password, role)) {
                closeUserModal();
                renderUserList();
                showToast('✅ User added successfully', 'success');
            } else {
                userModalError.textContent = '❌ Username already exists.';
                userModalError.style.display = 'block';
            }
        }
    }

    // ========================================
    // CHECK IF USER CAN EDIT
    // ========================================
    function userCanEdit() {
        return currentUser && currentUser.role === 'admin';
    }

    // ========================================
    // EDITABLE COLUMN NAMES - ALL COLUMNS
    // ========================================
    let columnNameEdits = {};

    function loadColumnNameEdits() {
        try {
            const saved = localStorage.getItem('starlink_column_names');
            if (saved) {
                columnNameEdits = JSON.parse(saved);
                console.log('✅ Column name edits loaded:', columnNameEdits);
            }
        } catch (e) {
            console.warn('⚠️ Failed to load column name edits:', e);
        }
    }

    function saveColumnNameEdits() {
        try {
            localStorage.setItem('starlink_column_names', JSON.stringify(columnNameEdits));
            console.log('✅ Column name edits saved:', columnNameEdits);
        } catch (e) {
            console.warn('⚠️ Failed to save column name edits:', e);
        }
    }

    function getColumnLabel(col) {
        if (columnNameEdits[col.key]) {
            return columnNameEdits[col.key];
        }
        return col.label;
    }

    function editColumnName(colKey) {
        const allCols = getAllColumns();
        const col = allCols.find(c => c.key === colKey);
        if (!col) {
            showToast('❌ Column not found', 'error');
            return;
        }

        const currentName = columnNameEdits[colKey] || col.label;
        const newName = prompt('Enter new column name:', currentName);
        if (newName === null) return;
        if (!newName.trim()) {
            showToast('❌ Column name cannot be empty', 'error');
            return;
        }

        columnNameEdits[colKey] = newName.trim().toUpperCase();
        saveColumnNameEdits();

        col.label = newName.trim().toUpperCase();

        render();
        showToast('✅ Column name updated to: ' + newName.trim().toUpperCase(), 'success');
        scheduleCloudSync();
    }

    // ========================================
    // M-PESA MESSAGE PARSING
    // ========================================
    function parseMpesaMessage(message) {
        if (!message || message.trim() === '') return null;

        const result = {
            amount: null,
            date: null,
            time: null,
            transactionCost: null,
            fullMessage: message,
            transactionCode: null
        };

        const codeMatch = message.match(/^([A-Z0-9]+)/);
        if (codeMatch) {
            result.transactionCode = codeMatch[1];
            console.log('🔑 Transaction code extracted:', result.transactionCode);
        }

        const amountMatch = message.match(/(?:KSh|KES|Ksh|ksh)\s*([\d,]+\.?\d*)\s*(?:sent|received|to|from)?/i);
        if (amountMatch) {
            result.amount = parseFloat(amountMatch[1].replace(/,/g, ''));
            console.log('💰 Amount extracted:', result.amount);
        }

        const feeMatch = message.match(/Transaction\s+cost[,:]\s*(?:KSh|KES|Ksh|ksh)?\s*([\d,]+\.?\d*)/i);
        if (feeMatch) {
            result.transactionCost = parseFloat(feeMatch[1].replace(/,/g, ''));
            console.log('💳 Transaction fee extracted:', result.transactionCost);
        }

        if (result.transactionCost === null) {
            const altFeeMatch = message.match(/(?:Fee|Charge|Cost)[,:]\s*(?:KSh|KES|Ksh|ksh)?\s*([\d,]+\.?\d*)/i);
            if (altFeeMatch) {
                result.transactionCost = parseFloat(altFeeMatch[1].replace(/,/g, ''));
                console.log('💳 Transaction fee extracted (alt):', result.transactionCost);
            }
        }

        const dateMatch = message.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
        if (dateMatch) {
            result.date = dateMatch[1];
            console.log('📅 Date extracted:', result.date);
        }

        const timeMatch = message.match(/(\d{1,2}:\d{2})\s*(?:AM|PM)?/i);
        if (timeMatch) {
            result.time = timeMatch[1];
            console.log('🕐 Time extracted:', result.time);
        }

        return result;
    }

    // ========================================
    // TRANSACTION FEES TRACKING
    // ========================================
    let transactionFees = {};
    let totalTransactionFees = 0;

    function updateTransactionFeesDisplay() {
        const feesTotalEl = document.getElementById('transactionFeesTotal');
        if (feesTotalEl) {
            feesTotalEl.textContent = totalTransactionFees.toFixed(2);
            console.log('💳 Transaction Fees Display Updated:', totalTransactionFees.toFixed(2));
        }
    }

    function addTransactionFee(dateId, rowId, feeAmount) {
        if (!feeAmount || feeAmount <= 0) {
            const key = dateId + '_' + rowId;
            if (transactionFees[key]) {
                delete transactionFees[key];
                console.log('🗑️ Fee removed for row:', key);
            }
            recalculateTotalFees();
            updateTransactionFeesDisplay();
            saveToStorage();
            return;
        }
        const key = dateId + '_' + rowId;
        transactionFees[key] = feeAmount;
        recalculateTotalFees();
        updateTransactionFeesDisplay();
        saveToStorage();
        scheduleCloudSync();
        console.log('💳 Transaction fee added: KSh', feeAmount, 'Total:', totalTransactionFees);
    }

    function recalculateTotalFees() {
        totalTransactionFees = 0;
        for (let key in transactionFees) {
            totalTransactionFees += transactionFees[key];
        }
        console.log('📊 Total Transaction Fees Recalculated:', totalTransactionFees);
        return totalTransactionFees;
    }

    function getTransactionFee(dateId, rowId) {
        const key = dateId + '_' + rowId;
        return transactionFees[key] || 0;
    }

    // ========================================
    // MAIN APP
    // ========================================
    const STORAGE_KEY = 'starlinkExpenditureData_v27';

    const DEFAULT_COLUMNS = [
        { key: 'starlinkGeneral', label: 'STARLINK GENERAL', isCustom: false },
        { key: 'commonInvestment', label: 'COMMON INVESTMENT', isCustom: false },
        { key: 'commonExpenditure', label: 'COMMON EXPENDITURE', isCustom: false },
        { key: 'tokens', label: 'TOKENS', isCustom: false },
        { key: 'fuelBike', label: 'FUEL/BIKE', isCustom: false },
        { key: 'routers', label: 'ROUTERS', isCustom: false }
    ];

    const NUMERIC_KEYS = ['starlinkGeneral', 'commonInvestment', 'commonExpenditure', 'tokens', 'fuelBike', 'routers'];

    let customColumns = [];
    let data = [];
    let nextDateId = 1;
    let nextRowId = 1;
    let nextColId = 1;
    let savedDates = {};
    let editModes = {};
    let savedCustomColumns = [];

    let dateFrom = '';
    let dateTo = '';

    const wrapper = document.getElementById('tableWrapper');
    const dateFromInput = document.getElementById('dateFrom');
    const dateToInput = document.getElementById('dateTo');
    const applyFilterBtn = document.getElementById('applyFilterBtn');
    const clearFilterBtn = document.getElementById('clearFilterBtn');
    const printBtn = document.getElementById('printPdfBtn');
    const addDateBtn = document.getElementById('addDateBtn');
    const addRowBtn = document.getElementById('addRowBtn');
    const grandTotalEl = document.getElementById('grandTotal');

    const modal = document.getElementById('readMoreModal');
    const modalBody = document.getElementById('modalBody');
    const modalCloseBtn = document.getElementById('modalCloseBtn');

    const themeToggle = document.getElementById('themeToggle');

    loadColumnNameEdits();

    // ========================================
    // THEME TOGGLE
    // ========================================
    function getStoredTheme() {
        return localStorage.getItem('starlink_theme') || 'dark';
    }

    function setStoredTheme(theme) {
        localStorage.setItem('starlink_theme', theme);
    }

    function applyTheme(theme) {
        if (theme === 'light') {
            document.body.classList.add('light-mode');
            themeToggle.textContent = '🌙 Dark';
        } else {
            document.body.classList.remove('light-mode');
            themeToggle.textContent = '☀️ Light';
        }
        setStoredTheme(theme);
    }

    function toggleTheme() {
        const currentTheme = getStoredTheme();
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(newTheme);
    }

    // ========================================
    // MAIN APP FUNCTIONS
    // ========================================
    
    function getAllColumns() {
        const cols = [...DEFAULT_COLUMNS, ...customColumns, ...savedCustomColumns];
        return cols.map(col => {
            if (columnNameEdits[col.key]) {
                return { ...col, label: columnNameEdits[col.key] };
            }
            return col;
        });
    }

    function isNumericColumn(colKey) {
        if (NUMERIC_KEYS.includes(colKey)) return true;
        if (customColumns.some(c => c.key === colKey)) return true;
        if (savedCustomColumns.some(c => c.key === colKey)) return true;
        return false;
    }

    function formatNumber(v) {
        let num = parseFloat(v);
        if (isNaN(num)) return 0;
        return Math.round(num * 100) / 100;
    }

    function getColumnAmount(row, columnKey) {
        const amountKey = columnKey + '_amount';
        const value = row[amountKey];
        if (value === undefined || value === null || value === '') return 0;
        return formatNumber(value);
    }

    function getRowTotal(row) {
        let sum = 0;
        const allCols = getAllColumns();
        allCols.forEach(col => {
            if (isNumericColumn(col.key)) {
                sum += getColumnAmount(row, col.key);
            }
        });
        return sum;
    }

    function getDateGroupTotal(group) {
        let sum = 0;
        if (!group.rows || group.rows.length === 0) return 0;
        group.rows.forEach(row => {
            sum += getRowTotal(row);
        });
        return sum;
    }

    function getFilteredData() {
        let filtered = data;
        if (dateFrom && dateTo) {
            filtered = filtered.filter(d => {
                if (!d.date) return false;
                return d.date >= dateFrom && d.date <= dateTo;
            });
        } else if (dateFrom) {
            filtered = filtered.filter(d => {
                if (!d.date) return false;
                return d.date >= dateFrom;
            });
        } else if (dateTo) {
            filtered = filtered.filter(d => {
                if (!d.date) return false;
                return d.date <= dateTo;
            });
        }
        return sortDataByDate(filtered);
    }

    function computeColumnTotals(filteredData) {
        const totals = {};
        const allCols = getAllColumns();
        allCols.forEach(col => {
            if (isNumericColumn(col.key)) {
                totals[col.key] = 0;
            }
        });
        filteredData.forEach(group => {
            group.rows.forEach(row => {
                allCols.forEach(col => {
                    if (isNumericColumn(col.key)) {
                        totals[col.key] += getColumnAmount(row, col.key);
                    }
                });
            });
        });
        return totals;
    }

    function computeGrandTotal(filteredData) {
        let sum = 0;
        filteredData.forEach(group => {
            sum += getDateGroupTotal(group);
        });
        return sum;
    }

    function truncateText(text, wordLimit = 3) {
        if (!text) return { short: text, full: text, needsReadMore: false };
        const words = text.trim().split(/\s+/);
        if (words.length <= wordLimit) {
            return { short: text, full: text, needsReadMore: false };
        }
        const shortText = words.slice(0, wordLimit).join(' ') + '...';
        return { short: shortText, full: text, needsReadMore: true };
    }

    function createEmptyRow() {
        const row = { id: nextRowId++ };
        getAllColumns().forEach(col => {
            row[col.key + '_desc'] = '';
            row[col.key + '_transaction'] = '';
            row[col.key + '_amount'] = '';
        });
        return row;
    }

    function addCustomColumn() {
        const colName = prompt('Enter the name of the new expenditure column:', 'New Expenditure');
        if (!colName || colName.trim() === '') return;

        const key = 'temp_' + nextColId++ + '_' + colName.replace(/\s+/g, '_').toLowerCase();
        const newCol = {
            key: key,
            label: colName.trim().toUpperCase(),
            isCustom: true,
            isTemp: true
        };

        customColumns.push(newCol);

        data.forEach(group => {
            group.rows.forEach(row => {
                row[newCol.key + '_desc'] = '';
                row[newCol.key + '_transaction'] = '';
                row[newCol.key + '_amount'] = '';
            });
        });

        render();
    }

    function saveCustomColumn(colKey) {
        const colIndex = customColumns.findIndex(c => c.key === colKey);
        if (colIndex === -1) return;

        const colToSave = customColumns[colIndex];
        const savedCol = {
            key: 'saved_' + nextColId++ + '_' + colToSave.label.replace(/\s+/g, '_').toLowerCase(),
            label: colToSave.label,
            isCustom: true,
            isSaved: true
        };

        data.forEach(group => {
            group.rows.forEach(row => {
                row[savedCol.key + '_desc'] = row[colToSave.key + '_desc'] || '';
                row[savedCol.key + '_transaction'] = row[colToSave.key + '_transaction'] || '';
                row[savedCol.key + '_amount'] = row[colToSave.key + '_amount'] || '';
            });
        });

        savedCustomColumns.push(savedCol);
        customColumns.splice(colIndex, 1);

        data.forEach(group => {
            group.rows.forEach(row => {
                delete row[colToSave.key + '_desc'];
                delete row[colToSave.key + '_transaction'];
                delete row[colToSave.key + '_amount'];
            });
        });

        render();
    }

    function removeCustomColumn(colKey) {
        const savedIndex = savedCustomColumns.findIndex(c => c.key === colKey);
        if (savedIndex !== -1) {
            if (!confirm('Delete this saved column? All data in this column will be lost.')) return;
            savedCustomColumns.splice(savedIndex, 1);
            data.forEach(group => {
                group.rows.forEach(row => {
                    delete row[colKey + '_desc'];
                    delete row[colKey + '_transaction'];
                    delete row[colKey + '_amount'];
                });
            });
            render();
            return;
        }

        const tempIndex = customColumns.findIndex(c => c.key === colKey);
        if (tempIndex !== -1) {
            if (!confirm('Delete this temporary column? Data will be lost if not saved.')) return;
            customColumns.splice(tempIndex, 1);
            data.forEach(group => {
                group.rows.forEach(row => {
                    delete row[colKey + '_desc'];
                    delete row[colKey + '_transaction'];
                    delete row[colKey + '_amount'];
                });
            });
            render();
        }
    }

    // ========================================
    // SAVE DATE ENTRY - WITH DUPLICATE CHECK
    // ========================================
    function saveDateEntry(dateId) {
        const group = data.find(d => d.id === dateId);
        if (!group) return;

        // Check for duplicate transactions
        const duplicateCode = checkForDuplicateTransactions(dateId);
        if (duplicateCode) {
            showToast(`❌ Save error: Duplicate transaction message found! Transaction code: ${duplicateCode}`, 'error');
            console.log('❌ Duplicate transaction detected:', duplicateCode);
            return;
        }

        const saveBtn = document.querySelector(`.save-btn[data-date-id="${dateId}"]`);
        if (saveBtn) {
            saveBtn.textContent = '✓ Saved';
            saveBtn.classList.add('saved');
            setTimeout(() => {
                saveBtn.textContent = '💾 Save';
                saveBtn.classList.remove('saved');
            }, 2000);
        }

        let feesCapturedCount = 0;
        let feesCapturedTotal = 0;
        const allCols = getAllColumns();

        const keysToRemove = [];
        for (let key in transactionFees) {
            if (key.startsWith(dateId + '_')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => {
            delete transactionFees[key];
        });
        console.log('🗑️ Cleared existing fees for date:', dateId);

        group.rows.forEach(row => {
            let rowFee = null;
            allCols.forEach(col => {
                const transKey = col.key + '_transaction';
                const transVal = row[transKey];
                if (transVal && transVal.trim() !== '') {
                    console.log('🔍 Processing transaction:', transVal.substring(0, 80) + '...');
                    const parsed = parseMpesaMessage(transVal);
                    if (parsed && parsed.transactionCost !== null && parsed.transactionCost > 0) {
                        rowFee = parsed.transactionCost;
                        console.log('✅ Fee found: KSh', rowFee);
                    }
                }
            });
            
            if (rowFee !== null && rowFee > 0) {
                const key = dateId + '_' + row.id;
                transactionFees[key] = rowFee;
                feesCapturedCount++;
                feesCapturedTotal += rowFee;
                console.log('✅ Fee captured for row', row.id, ':', rowFee);
            }
            delete row._pendingFee;
        });

        recalculateTotalFees();
        updateTransactionFeesDisplay();

        savedDates[dateId] = true;
        editModes[dateId] = false;

        render();
        saveToStorage();
        scheduleCloudSync();

        if (feesCapturedCount > 0) {
            showToast(`✅ Date saved! ${feesCapturedCount} fee(s) captured: KSh ${feesCapturedTotal.toFixed(2)}`, 'success');
        } else {
            showToast('✅ Date saved successfully!', 'success');
        }
    }

    function editDateEntry(dateId) {
        if (!userCanEdit()) {
            showToast('⚠️ Only admin can edit records', 'error');
            return;
        }
        editModes[dateId] = !editModes[dateId];
        if (editModes[dateId]) {
            savedDates[dateId] = false;
        }
        render();
    }

    function openReadMoreModal(text) {
        if (!modal) return;
        modalBody.innerHTML = `<p class="modal-text">${text}</p>`;
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    function closeReadMoreModal() {
        if (!modal) return;
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }

    function addTransactionRow(dateId) {
        if (!userCanEdit()) {
            showToast('⚠️ Only admin can add rows', 'error');
            return;
        }
        const group = data.find(d => d.id === dateId);
        if (!group) {
            alert('Date entry not found');
            return;
        }

        const newRow = createEmptyRow();
        group.rows.push(newRow);
        render();
        scheduleCloudSync();
    }

    // ========================================
    // DEBOUNCED SAVE
    // ========================================
    let saveTimeout = null;

    function debouncedSave() {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            saveToStorage();
        }, 500);
    }

    // ========================================
    // HANDLE INPUT CHANGE - FIXED: Empty transaction clears amount
    // ========================================
    function handleInputChange(e) {
        if (!userCanEdit()) {
            showToast('⚠️ Only admin can edit records', 'error');
            return;
        }
        
        const input = e.target;
        const dateId = parseInt(input.dataset.dateId);
        const rowId = parseInt(input.dataset.rowId);
        const key = input.dataset.key;
        const value = input.value;

        const group = data.find(d => d.id === dateId);
        if (!group) return;
        const row = group.rows.find(r => r.id === rowId);
        if (!row) return;

        row[key] = value;

        // Keep tooltip in sync for transaction references
        if (key.endsWith('_transaction')) {
            input.title = value;
        }
        
        // 🔥 FIX: If transaction reference field changes
        if (key.endsWith('_transaction')) {
            const amountKey = key.replace('_transaction', '_amount');
            
            // If transaction reference is empty, clear the amount
            if (!value || value.trim() === '') {
                row[amountKey] = '';
                row._pendingFee = null;
                console.log('🗑️ Transaction reference cleared - amount cleared');
            } else if (value.length > 5) {
                console.log('📨 Transaction message detected:', value.substring(0, 80) + '...');
                const parsed = parseMpesaMessage(value);
                if (parsed) {
                    if (parsed.amount !== null && parsed.amount > 0) {
                        row[amountKey] = parsed.amount.toString();
                        console.log('💰 Amount auto-filled:', parsed.amount);
                        showToast('💰 Amount extracted: KSh ' + parsed.amount.toFixed(2), 'success');
                    } else {
                        row[amountKey] = '';
                    }
                    if (parsed.transactionCost !== null && parsed.transactionCost > 0) {
                        row._pendingFee = parsed.transactionCost;
                        console.log('💳 Transaction fee detected (will be added on Save):', parsed.transactionCost);
                        showToast('💳 Transaction fee detected: KSh ' + parsed.transactionCost.toFixed(2) + ' (click Save to capture)', 'info');
                    } else {
                        row._pendingFee = null;
                    }
                } else {
                    row[amountKey] = '';
                    row._pendingFee = null;
                }
            } else {
                // Short text - not a valid message, clear amount
                row[amountKey] = '';
                row._pendingFee = null;
            }
        }
        
        updateTotalsOnly();
        debouncedSave();
        
        if (key.includes('_amount')) {
            scheduleCloudSync();
        }
    }

    // ========================================
    // UPDATE TOTALS ONLY
    // ========================================
    function updateTotalsOnly() {
        const filtered = getFilteredData();
        const allColumns = getAllColumns();
        
        const grandTotal = computeGrandTotal(filtered);
        if (grandTotalEl) {
            grandTotalEl.textContent = grandTotal.toFixed(2);
        }

        const rowTotalCells = document.querySelectorAll('.row-total-col');
        let rowIndex = 0;
        filtered.forEach(group => {
            group.rows.forEach(row => {
                if (rowTotalCells[rowIndex]) {
                    rowTotalCells[rowIndex].textContent = getRowTotal(row).toFixed(2);
                }
                rowIndex++;
            });
        });

        const dateTotalCells = document.querySelectorAll('.date-total-amount');
        filtered.forEach((group, idx) => {
            if (dateTotalCells[idx]) {
                dateTotalCells[idx].textContent = getDateGroupTotal(group).toFixed(2);
            }
        });

        const colTotals = computeColumnTotals(filtered);
        const colTotalCells = document.querySelectorAll('.col-total-row td[data-label]');
        
        if (colTotalCells.length > 0) {
            let colIndex = 0;
            allColumns.forEach(col => {
                if (isNumericColumn(col.key)) {
                    const cellIndex = colIndex + 1;
                    if (colTotalCells[cellIndex]) {
                        colTotalCells[cellIndex].textContent = (colTotals[col.key] || 0).toFixed(2);
                    }
                    colIndex++;
                }
            });
            
            const totalColSum = Object.values(colTotals).reduce((a, b) => a + b, 0);
            const lastCell = colTotalCells[colTotalCells.length - 1];
            if (lastCell) {
                lastCell.textContent = totalColSum.toFixed(2);
            }
        }
        
        recalculateTotalFees();
        updateTransactionFeesDisplay();
        console.log('💳 Fees updated in totals:', totalTransactionFees);
    }

    // ========================================
    // CLOUD SYNC DEBOUNCER
    // ========================================
    let cloudSyncTimer = null;

    function scheduleCloudSync() {
        if (!SYNC_ENABLED || !supabaseClient) return;
        clearTimeout(cloudSyncTimer);
        cloudSyncTimer = setTimeout(() => {
            syncToCloud(false);
        }, 1200);
    }

    // ========================================
    // SETUP COLUMN NAME EDIT LISTENERS
    // ========================================
    function setupColumnNameEditListeners() {
        document.querySelectorAll('.edit-name-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const colKey = this.dataset.colKey;
                editColumnName(colKey);
            });
        });
    }

    // ========================================
    // SETUP SEARCH FUNCTIONALITY
    // ========================================
    function setupSearchFunctionality() {
        const searchInput = document.getElementById('searchInput');
        const clearSearchBtn = document.getElementById('clearSearchBtn');
        const searchResultInfo = document.getElementById('searchResultInfo');

        if (!searchInput) {
            console.warn('⚠️ Search input not found in DOM');
            return;
        }

        if (searchInput._searchInitialized) return;
        searchInput._searchInitialized = true;

        let searchTimer = null;

        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                performSearch(this.value.trim());
            }, 250);
        });

        searchInput.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                this.value = '';
                performSearch('');
            }
        });

        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', function() {
                searchInput.value = '';
                performSearch('');
                searchInput.focus();
            });
        }
    }

    // ========================================
    // PERFORM SEARCH
    // ========================================
    function performSearch(query) {
        const clearSearchBtn = document.getElementById('clearSearchBtn');
        const searchResultInfo = document.getElementById('searchResultInfo');

        // Clear previous highlights
        document.querySelectorAll('tr.row-highlight').forEach(el => el.classList.remove('row-highlight'));
        document.querySelectorAll('td.cell-highlight').forEach(el => el.classList.remove('cell-highlight'));

        if (clearSearchBtn) {
            clearSearchBtn.style.display = query ? 'inline-block' : 'none';
        }

        if (!query) {
            if (searchResultInfo) {
                searchResultInfo.style.display = 'none';
                searchResultInfo.textContent = '';
            }
            return;
        }

        const upperQuery = query.toUpperCase();
        let matchCount = 0;
        let firstMatch = null;

        // Search through all transaction inputs and displays
        const transElements = document.querySelectorAll('.trans-input, .desc-display[data-type="transaction"], .desc-display[data-full-text]');

        transElements.forEach(el => {
            const text = (el.value || el.textContent || el.dataset.fullText || '').toUpperCase();
            if (text.includes(upperQuery)) {
                matchCount++;

                // Highlight the row
                const row = el.closest('tr');
                if (row && !row.classList.contains('row-highlight')) {
                    row.classList.add('row-highlight');
                    if (!firstMatch) firstMatch = row;
                }

                // Highlight the cell
                const cell = el.closest('td');
                if (cell) cell.classList.add('cell-highlight');
            }
        });

        if (searchResultInfo) {
            if (matchCount > 0) {
                searchResultInfo.textContent = `Found ${matchCount} match${matchCount > 1 ? 'es' : ''}`;
                searchResultInfo.classList.remove('no-result');
                searchResultInfo.style.display = 'inline-block';
            } else {
                searchResultInfo.textContent = 'No matches found';
                searchResultInfo.classList.add('no-result');
                searchResultInfo.style.display = 'inline-block';
            }
        }

        // Scroll to first match
        if (firstMatch) {
            firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    // ========================================
    // RENDER - REMOVED COLUMN DELETE BUTTON ONLY
    // ========================================
    function render() {
        const filtered = getFilteredData();
        const allColumns = getAllColumns();
        const canEdit = userCanEdit();

        let html = '<table>';

        html += '<tbody>';

        if (filtered.length === 0) {
            html += `<tr><td colspan="${allColumns.length + 3}" class="empty-state">
                <span class="icon">📭</span>
                <div style="color:var(--text-primary);">No records found</div>
                <div style="font-size:0.85rem; margin-top:8px; color:var(--text-dim);">Adjust your date filter or add new entries</div>
            </td></tr>`;
        } else {
            filtered.forEach((group) => {
                const isSaved = savedDates[group.id] || false;
                const isEditing = editModes[group.id] || false;
                const showEditMode = isEditing || !isSaved;

                html += `<tr class="date-header-row">`;
                html += `<td colspan="${allColumns.length + 3}" style="padding:8px 16px;">`;
                html += `<div class="date-label">
                    <span class="date-badge">📅 ${group.date || 'No date'}</span>
                    ${canEdit ? `<button class="add-col-btn-header" title="Add a new custom expenditure column">➕ Add Expenditure</button>` : ''}
                </div>`;
                html += `</td>`;
                html += `</tr>`;

                html += `<tr class="date-column-header">`;
                html += `<td style="min-width:80px; font-weight:700; color:var(--accent-brass); text-align:center; font-size:0.7rem; text-transform:uppercase; letter-spacing:0.5px; background:var(--table-header);"></td>`;
                allColumns.forEach(col => {
                    const isCustom = col.isCustom || false;
                    const isSavedCol = col.isSaved || false;
                    const colKey = col.key;
                    const colLabel = getColumnLabel(col);

                    html += `<td style="min-width:120px; text-align:center; background:var(--table-header); ${isCustom ? 'background: rgba(200,154,91,0.05);' : ''}" data-col-key="${colKey}">
                        <div class="col-header-with-edit">
                            <span class="col-label" data-col-key="${colKey}" data-label="${colLabel}">${colLabel}</span>
                            ${isCustom ? `<span style="font-weight:400; font-size:0.55rem; color:#c89a5b;">${isSavedCol ? '(saved)' : '(temp)'}</span>` : ''}
                            ${canEdit ? `<div class="col-edit-actions">
                                <button class="edit-name-btn" data-col-key="${colKey}" title="Edit column name">✏️</button>
                            </div>` : ''}
                        </div>
                    </td>`;
                });
                html += `<td style="min-width:70px; text-align:center; font-weight:700; color:var(--accent-brass); background:var(--table-header);">TOTAL</td>`;
                html += `<td style="min-width:40px; background:var(--table-header);"></td>`;
                html += `</tr>`;

                if (group.rows.length === 0) {
                    html += `<tr><td colspan="${allColumns.length + 3}" style="text-align:center; padding:16px; color:var(--text-dim); background:var(--bg-card);">
                        No transactions — click "Add Row" to add
                    </td></tr>`;
                } else {
                    group.rows.forEach((row, index) => {
                        if (index > 0) {
                            html += `<tr class="transaction-separator"><td colspan="${allColumns.length + 3}" style="padding:0;"></td></tr>`;
                        }

                        html += `<tr>`;
                        html += `<td style="background:var(--bg-card); text-align:center; color:var(--text-dim); font-size:0.7rem;" data-label="">▸</td>`;

                        allColumns.forEach(col => {
                            const isCustom = col.isCustom || false;
                            const isSavedCol = col.isSaved || false;
                            const descKey = col.key + '_desc';
                            const transKey = col.key + '_transaction';
                            const amountKey = col.key + '_amount';
                            const colLabel = getColumnLabel(col);

                            const descVal = row[descKey] || '';
                            const transVal = row[transKey] || '';
                            const amountVal = row[amountKey] || '';

                            let descDisplay = '';
                            if (showEditMode && canEdit) {
                                descDisplay = `
                                    <textarea class="desc-input" data-date-id="${group.id}" data-row-id="${row.id}" data-key="${descKey}" placeholder="Description" rows="1">${descVal}</textarea>
                                `;
                            } else {
                                const truncated = truncateText(descVal, 3);
                                if (truncated.needsReadMore) {
                                    descDisplay = `
                                        <div class="desc-display" data-full-text="${descVal.replace(/"/g, '&quot;')}">
                                            <span class="short-text">${truncated.short}</span>
                                            <button class="read-more-btn" data-full-text="${descVal.replace(/"/g, '&quot;')}">readmore</button>
                                        </div>
                                    `;
                                } else {
                                    descDisplay = `
                                        <div class="desc-display" data-full-text="${descVal.replace(/"/g, '&quot;')}">
                                            ${descVal || '-'}
                                        </div>
                                    `;
                                }
                            }

                            html += `<td class="expenditure-cell" style="padding:2px 3px; ${isCustom ? 'background: rgba(79,182,168,0.05);' : ''}" data-label="${colLabel}">
                                <div class="column-group ${isCustom ? 'custom-column' : ''}">
                                    <span class="field-header">Description</span>
                                    ${descDisplay}
                                    <span class="field-header">Transaction Reference</span>
                                    ${showEditMode && canEdit ? 
                                        `<textarea class="trans-input" data-date-id="${group.id}" data-row-id="${row.id}" data-key="${transKey}" placeholder="Transaction Reference" rows="1" title="${transVal.replace(/"/g, '&quot;')}">${transVal}</textarea>` : 
                                        `<div class="desc-display" data-full-text="${transVal.replace(/"/g, '&quot;')}" data-type="transaction" title="${transVal.replace(/"/g, '&quot;')}">${transVal || '-'}</div>`}
                                    <span class="field-header">Amount</span>
                                    ${showEditMode && canEdit ? 
                                        `<input type="text" class="amount-input" data-date-id="${group.id}" data-row-id="${row.id}" data-key="${amountKey}" value="${amountVal}" placeholder="0">` : 
                                        `<div class="amount-display">${formatNumber(amountVal).toFixed(2)}</div>`}
                                    ${isCustom && canEdit ? 
                                        `<div style="display:flex; gap:4px; margin-top:4px; flex-wrap:wrap;">
                                            ${!isSavedCol ? `<button class="save-col-btn" data-col-key="${col.key}" title="Save this column permanently">💾 Save</button>` : ''}
                                        </div>` : ''}
                                </div>
                            </td>`;
                        });

                        html += `<td class="row-total-col" data-label="Total">${getRowTotal(row).toFixed(2)}</td>`;
                        html += `<td>${canEdit ? `<button class="delete-row-btn" data-date-id="${group.id}" data-row-id="${row.id}" title="Delete this transaction">🗑️ Delete</button>` : ''}</td>`;
                        html += `</tr>`;
                    });
                }

                const dateTotal = getDateGroupTotal(group);
                html += `<tr class="date-total-row">`;
                html += `<td colspan="${allColumns.length + 2}" style="padding:8px 16px;" data-label="">`;
                html += `<div class="date-total-content">
                    <div class="date-total-actions">
                        ${canEdit ? `
                            <button class="action-btn save-btn ${isSaved ? 'saved' : ''}" data-date-id="${group.id}">💾 Save</button>
                            <button class="action-btn edit-btn" data-date-id="${group.id}">✏️ Edit</button>
                            <button class="action-btn delete-date-btn" data-date-id="${group.id}">🗑️ Delete</button>
                        ` : ''}
                    </div>
                    <div class="date-total-right">
                        <span class="date-total-label">Date Total Amount:</span>
                        <span class="date-total-amount">${dateTotal.toFixed(2)}</span>
                        ${canEdit ? `
                            <div class="date-total-add-row">
                                <button class="add-row-inline-btn" data-date-id="${group.id}">➕ Add Row</button>
                            </div>
                        ` : ''}
                    </div>
                </div>`;
                html += `</td>`;
                html += `<td></td>`;
                html += `</tr>`;
            });
        }

        const colTotals = computeColumnTotals(filtered);
        html += '<tfoot>';
        html += `<tr class="col-total-row">`;
        html += `<td data-label="COLUMN TOTALS"><span class="col-total-label">COLUMN TOTALS</span></td>`;
        allColumns.forEach(col => {
            const colLabel = getColumnLabel(col);
            if (isNumericColumn(col.key)) {
                const val = colTotals[col.key] || 0;
                html += `<td class="column-total-cell" data-label="${colLabel}" style="color:var(--text-primary);">${val.toFixed(2)}</td>`;
            } else {
                html += `<td class="column-total-cell" data-label="${colLabel}" style="color:var(--text-primary);">0.00</td>`;
            }
        });
        const totalColSum = Object.values(colTotals).reduce((a, b) => a + b, 0);
        html += `<td class="column-total-cell grand-column-total" data-label="Total" style="font-weight:700; color:var(--accent-teal);">${totalColSum.toFixed(2)}</td>`;
        html += `<td></td>`;
        html += `</tr>`;

        html += '</tfoot>';
        html += '</tbody>';
        html += '</table>';

        wrapper.innerHTML = html;

        const grandTotal = computeGrandTotal(filtered);
        grandTotalEl.textContent = grandTotal.toFixed(2);

        document.querySelectorAll('.desc-input, .trans-input, .amount-input').forEach(input => {
            input.addEventListener('input', handleInputChange);
        });

        document.querySelectorAll('.desc-input, .trans-input').forEach(textarea => {
            textarea.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = this.scrollHeight + 'px';
                // Keep tooltip in sync for transaction references
                if (this.classList.contains('trans-input')) {
                    this.title = this.value;
                }
            });
            setTimeout(() => {
                textarea.style.height = 'auto';
                textarea.style.height = textarea.scrollHeight + 'px';
            }, 10);
        });

        document.querySelectorAll('.read-more-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const fullText = this.dataset.fullText || '';
                if (fullText) {
                    openReadMoreModal(fullText);
                }
            });
        });

        document.querySelectorAll('.desc-display').forEach(el => {
            el.addEventListener('click', function() {
                const fullText = this.dataset.fullText || '';
                if (fullText && fullText !== '-') {
                    openReadMoreModal(fullText);
                }
            });
        });

        document.querySelectorAll('.delete-row-btn').forEach(btn => {
            btn.addEventListener('click', handleDeleteRow);
        });

        document.querySelectorAll('.date-total-row .save-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const dateId = parseInt(e.target.dataset.dateId);
                saveDateEntry(dateId);
            });
        });

        document.querySelectorAll('.date-total-row .edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const dateId = parseInt(e.target.dataset.dateId);
                editDateEntry(dateId);
            });
        });

        document.querySelectorAll('.date-total-row .delete-date-btn').forEach(btn => {
            btn.addEventListener('click', handleDeleteDate);
        });

        document.querySelectorAll('.date-total-row .add-row-inline-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const dateId = parseInt(e.target.dataset.dateId);
                addTransactionRow(dateId);
            });
        });

        document.querySelectorAll('.add-col-btn-header').forEach(btn => {
            btn.addEventListener('click', addCustomColumn);
        });

        document.querySelectorAll('.save-col-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const colKey = e.target.dataset.colKey;
                saveCustomColumn(colKey);
            });
        });

        setupColumnNameEditListeners();

        saveToStorage();
        
        setTimeout(() => {
            updateTotalsOnly();
        }, 50);

        // Re-apply search highlight after render
        const searchInput = document.getElementById('searchInput');
        if (searchInput && searchInput.value.trim()) {
            setTimeout(() => {
                performSearch(searchInput.value.trim());
            }, 60);
        }
    }

    // ========================================
    // HANDLE DELETE ROW
    // ========================================
    function handleDeleteRow(e) {
        if (!userCanEdit()) {
            showToast('⚠️ Only admin can delete rows', 'error');
            return;
        }
        const dateId = parseInt(e.target.dataset.dateId);
        const rowId = parseInt(e.target.dataset.rowId);
        
        if (confirm('⚠️ Are you sure you want to delete this transaction?\n\nThis data will be permanently deleted from the cloud and cannot be recovered.')) {
            const group = data.find(d => d.id === dateId);
            if (group) {
                const key = dateId + '_' + rowId;
                if (transactionFees[key]) {
                    delete transactionFees[key];
                    console.log('🗑️ Fee removed for deleted row:', key);
                }
                recalculateTotalFees();
                updateTransactionFeesDisplay();
                
                group.rows = group.rows.filter(r => r.id !== rowId);
                render();
                saveToStorage();
                scheduleCloudSync();
                showToast('✅ Transaction deleted successfully', 'success');
            }
        }
    }

    // ========================================
    // HANDLE DELETE DATE
    // ========================================
    function handleDeleteDate(e) {
        if (!userCanEdit()) {
            showToast('⚠️ Only admin can delete dates', 'error');
            return;
        }
        const dateId = parseInt(e.target.dataset.dateId);
        
        if (confirm('⚠️ Are you sure you want to delete this entire date entry and all its transactions?\n\nThis data will be permanently deleted from the cloud and cannot be recovered.')) {
            const keysToRemove = [];
            for (let key in transactionFees) {
                if (key.startsWith(dateId + '_')) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => {
                delete transactionFees[key];
                console.log('🗑️ Fee removed for deleted date:', key);
            });
            
            data = data.filter(d => d.id !== dateId);
            delete savedDates[dateId];
            delete editModes[dateId];
            
            recalculateTotalFees();
            updateTransactionFeesDisplay();
            
            render();
            saveToStorage();
            scheduleCloudSync();
            showToast('✅ Date entry deleted successfully', 'success');
        }
    }

    // ========================================
    // ADD DATE ENTRY
    // ========================================
    function addDateEntry() {
        if (!userCanEdit()) {
            showToast('⚠️ Only admin can add dates', 'error');
            return;
        }
        
        const dateInput = prompt('Enter date (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
        if (!dateInput) return;

        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
            alert('Please use YYYY-MM-DD format');
            return;
        }

        const dateExists = data.some(d => d.date === dateInput);
        if (dateExists) {
            alert('❌ This date already exists! Please enter a different date.');
            return;
        }

        const newGroup = {
            id: nextDateId++,
            date: dateInput,
            rows: []
        };

        const newRow = createEmptyRow();
        newGroup.rows.push(newRow);

        data.push(newGroup);
        data = sortDataByDate(data);
        render();
        scheduleCloudSync();
        showToast('✅ Date added successfully!', 'success');
    }

    function applyDateFilter() {
        dateFrom = dateFromInput.value || '';
        dateTo = dateToInput.value || '';
        render();
    }

    function clearDateFilter() {
        dateFromInput.value = '';
        dateToInput.value = '';
        dateFrom = '';
        dateTo = '';
        render();
    }

    function exportPdf() {
        const filtered = getFilteredData();
        const allColumns = getAllColumns();

        let filterInfo = '';
        if (dateFrom && dateTo) {
            filterInfo = ` (${dateFrom} to ${dateTo})`;
        } else if (dateFrom) {
            filterInfo = ` (from ${dateFrom})`;
        } else if (dateTo) {
            filterInfo = ` (up to ${dateTo})`;
        }

        let printHtml = `
        <html>
        <head><meta charset="UTF-8"><title>Starlink Expenditure Report</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Inter', sans-serif; padding: 20px 30px; background: #ffffff; color: #1a1a1d; }
            h1 { color: #0a2a44; border-bottom: 3px solid #c89a5b; padding-bottom: 10px; text-align: center; font-size: 24px; }
            .subtitle { color: #4a5a7a; margin: 10px 0 20px; text-align: center; font-size: 14px; }
            .filter-info { color: #6b6860; margin-bottom: 20px; font-size: 13px; text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11px; }
            th { background: #e8e0d4; padding: 10px 8px; border: 1px solid #b8b0a4; text-align: center; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
            td { padding: 6px 8px; border: 1px solid #c8c0b4; text-align: center; vertical-align: middle; }
            .date-header { background: #f0ece4; font-weight: 700; }
            .date-header td { padding: 10px 16px; text-align: left; font-size: 13px; }
            .desc-row td { background: #f8f6f0; }
            .desc-row td:first-child { background: #f8f6f0; font-weight: 700; font-size: 10px; color: #0a2a44; text-align: right; padding-right: 15px; }
            .desc-row .desc-text { font-size: 0.85rem; color: #1a1a1d; text-align: left; }
            .trans-row td { background: #f5f3ec; }
            .trans-row td:first-child { background: #f5f3ec; font-weight: 700; font-size: 10px; color: #0a2a44; text-align: right; padding-right: 15px; }
            .trans-row .trans-text { font-size: 0.85rem; color: #1a1a1d; text-align: left; }
            .amount-row td { background: #efece4; }
            .amount-row td:first-child { background: #efece4; font-weight: 700; font-size: 10px; color: #0a2a44; text-align: right; padding-right: 15px; }
            .amount-row .amount-text { font-weight: 700; color: #0a2a44; font-size: 0.9rem; text-align: right; }
            .col-total { background: #e8e0d4; font-weight: 700; }
            .col-total td { padding: 10px 8px; }
            .grand-total { background: #0a2a44; color: #ffffff; font-weight: 800; }
            .grand-total td { padding: 12px 8px; font-size: 14px; }
            .separator td { border-bottom: 2px dashed #c8c0b4; }
            .footer { margin-top: 30px; color: #6b6860; font-size: 12px; text-align: center; border-top: 1px solid #e0d8cc; padding-top: 15px; }
        </style>
        </head>
        <body>
        <h1>📡 STARLINK · GENERAL CONNECTION EXPENDITURE</h1>
        <div class="subtitle">Expenditure Report</div>
        <div class="filter-info"><strong>Date Range:</strong> ${filterInfo || 'All records'}</div>
        `;

        if (filtered.length === 0) {
            printHtml += `<div style="text-align:center; padding:40px; color:#6b6860; font-size:16px;">📭 No expenditure records found for the selected date range.</div>`;
        } else {
            printHtml += `<table>`;
            printHtml += `<tr><th>DATE</th>`;
            allColumns.forEach(col => {
                const colLabel = getColumnLabel(col);
                printHtml += `<th>${colLabel}</th>`;
            });
            printHtml += `<th>TOTAL</th></tr>`;

            filtered.forEach(group => {
                printHtml += `<tr class="date-header"><td colspan="${allColumns.length + 2}">📅 ${group.date}</td></tr>`;

                if (group.rows.length === 0) {
                    printHtml += `<tr><td colspan="${allColumns.length + 2}" style="text-align:center; color:#6b6860;">No transactions</td></tr>`;
                } else {
                    group.rows.forEach((row, index) => {
                        if (index > 0) {
                            printHtml += `<tr class="separator"><td colspan="${allColumns.length + 2}"></td></tr>`;
                        }

                        printHtml += `<tr class="desc-row">`;
                        printHtml += `<td style="font-weight:700; font-size:10px; color:#0a2a44; text-align:right; padding-right:15px;">DESCRIPTION</td>`;
                        allColumns.forEach(col => {
                            const descVal = row[col.key + '_desc'] || '';
                            printHtml += `<td class="desc-text" style="text-align:left; font-size:0.85rem;">${descVal || '-'}</td>`;
                        });
                        printHtml += `<td style="font-weight:700; color:#0a2a44;">${getRowTotal(row).toFixed(2)}</td>`;
                        printHtml += `</tr>`;

                        printHtml += `<tr class="trans-row">`;
                        printHtml += `<td style="font-weight:700; font-size:10px; color:#0a2a44; text-align:right; padding-right:15px;">TRANSACTION REFERENCE</td>`;
                        allColumns.forEach(col => {
                            const transVal = row[col.key + '_transaction'] || '';
                            printHtml += `<td class="trans-text" style="text-align:left; font-size:0.85rem;">${transVal || '-'}</td>`;
                        });
                        printHtml += `<td></td>`;
                        printHtml += `</tr>`;

                        printHtml += `<tr class="amount-row">`;
                        printHtml += `<td style="font-weight:700; font-size:10px; color:#0a2a44; text-align:right; padding-right:15px;">AMOUNT</td>`;
                        allColumns.forEach(col => {
                            const amountVal = row[col.key + '_amount'] || 0;
                            printHtml += `<td class="amount-text" style="text-align:right; font-weight:700; color:#0a2a44;">${formatNumber(amountVal).toFixed(2)}</td>`;
                        });
                        printHtml += `<td style="font-weight:700; color:#0a2a44;">${getRowTotal(row).toFixed(2)}</td>`;
                        printHtml += `</tr>`;
                    });
                }

                const dateTotal = getDateGroupTotal(group);
                printHtml += `<tr style="background:#f0ece4; font-weight:700;">`;
                printHtml += `<td colspan="${allColumns.length + 1}" style="text-align:right; padding-right:20px;">Date Total Amount:</td>`;
                printHtml += `<td style="font-weight:700; color:#0a2a44;">${dateTotal.toFixed(2)}</td>`;
                printHtml += `</tr>`;
            });

            const colTotals = computeColumnTotals(filtered);
            printHtml += `<tr class="col-total">`;
            printHtml += `<td style="font-weight:700;">COLUMN TOTALS</td>`;
            allColumns.forEach(col => {
                if (isNumericColumn(col.key)) {
                    printHtml += `<td style="font-weight:700;">${(colTotals[col.key] || 0).toFixed(2)}</td>`;
                } else {
                    printHtml += `<td>0.00</td>`;
                }
            });
            const totalColSum = Object.values(colTotals).reduce((a, b) => a + b, 0);
            printHtml += `<td style="font-weight:700; color:#0a2a44;">${totalColSum.toFixed(2)}</td>`;
            printHtml += `</tr>`;

            const grandTotal = computeGrandTotal(filtered);
            printHtml += `<tr class="grand-total">`;
            printHtml += `<td colspan="${allColumns.length + 1}" style="text-align:right; padding-right:20px;">GRAND TOTAL</td>`;
            printHtml += `<td>${grandTotal.toFixed(2)}</td>`;
            printHtml += `</tr>`;
            printHtml += `</table>`;
        }

        printHtml += `
        <div style="margin-top: 30px; border-top: 2px solid #c89a5b; padding-top: 20px;">
            <h2 style="color: #0a2a44; font-size: 18px;">💳 TRANSACTION FEES</h2>
            <p style="font-size: 14px; font-weight: 700; color: #0a2a44;">Total Transaction Fees: KSh ${totalTransactionFees.toFixed(2)}</p>
        </div>
        `;

        printHtml += `<div class="footer">Generated: ${new Date().toLocaleString()} | Starlink Expenditure System</div>`;
        printHtml += `</body></html>`;

        const win = window.open('', '_blank');
        if (win) {
            win.document.write(printHtml);
            win.document.close();
            win.focus();
            win.print();
        } else {
            alert('Please allow pop-ups to export PDF.');
        }
    }

    // ========================================
    // SAVE TO STORAGE
    // ========================================
    function saveToStorage() {
        try {
            data = sortDataByDate(data);
            const store = {
                data,
                nextDateId,
                nextRowId,
                nextColId,
                customColumns,
                savedCustomColumns,
                savedDates,
                editModes,
                dateFrom,
                dateTo,
                columnNameEdits,
                transactionFees,
                totalTransactionFees
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
        } catch (e) {}
    }

    // ========================================
    // LOAD FROM STORAGE
    // ========================================
    function loadFromStorage() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return false;
            const store = JSON.parse(raw);
            if (store.data && Array.isArray(store.data)) {
                data = sortDataByDate(store.data);
                nextDateId = store.nextDateId || 1;
                nextRowId = store.nextRowId || 1;
                nextColId = store.nextColId || 1;
                customColumns = store.customColumns || [];
                savedCustomColumns = store.savedCustomColumns || [];
                savedDates = store.savedDates || {};
                editModes = store.editModes || {};
                dateFrom = store.dateFrom || '';
                dateTo = store.dateTo || '';
                if (store.columnNameEdits) {
                    columnNameEdits = store.columnNameEdits;
                    saveColumnNameEdits();
                }
                if (store.transactionFees) {
                    transactionFees = store.transactionFees || {};
                    totalTransactionFees = store.totalTransactionFees || 0;
                }
                if (dateFrom) dateFromInput.value = dateFrom;
                if (dateTo) dateToInput.value = dateTo;
                return true;
            }
        } catch (e) {}
        return false;
    }

    // ========================================
    // CREATE TRANSACTION FEES DISPLAY
    // ========================================
    function createTransactionFeesDisplay() {
        let feesEl = document.getElementById('transactionFeesDisplay');
        if (feesEl) {
            updateTransactionFeesDisplay();
            return;
        }

        const totalsGrid = document.querySelector('.totals-grid');
        if (!totalsGrid) return;

        const feesCard = document.createElement('div');
        feesCard.className = 'total-card';
        feesCard.id = 'transactionFeesDisplay';
        feesCard.style.cssText = `
            background: linear-gradient(135deg, rgba(200, 154, 91, 0.12) 0%, rgba(226, 104, 91, 0.08) 100%);
            border: 1px solid rgba(200, 154, 91, 0.15);
            padding: 8px 18px 8px 16px;
            border-radius: 60px;
            display: flex;
            align-items: center;
            gap: 12px;
            box-shadow: 0 2px 10px var(--shadow-light);
        `;
        
        feesCard.innerHTML = `
            <span style="font-weight: 600; color: var(--text-muted); font-size: 0.7rem;">💳 TRANSACTION FEES</span>
            <span style="font-weight: 800; font-size: 1.2rem; color: var(--accent-brass);" id="transactionFeesTotal">${totalTransactionFees.toFixed(2)}</span>
        `;

        const grandTotalCard = document.getElementById('grandTotalCard');
        if (grandTotalCard) {
            grandTotalCard.after(feesCard);
        } else {
            totalsGrid.appendChild(feesCard);
        }

        updateTransactionFeesDisplay();
    }

    // ========================================
    // INIT MAIN APP
    // ========================================
    function initMainApp() {
        initSupabase();

        const savedTheme = getStoredTheme();
        applyTheme(savedTheme);
        themeToggle.addEventListener('click', toggleTheme);

        const loaded = loadFromStorage();

        if (!loaded) {
            customColumns = [];
            savedCustomColumns = [];
            savedDates = {};
            editModes = {};
            dateFrom = '';
            dateTo = '';
            transactionFees = {};
            totalTransactionFees = 0;
            const sampleGroup = {
                id: nextDateId++,
                date: new Date().toISOString().split('T')[0],
                rows: [createEmptyRow()]
            };
            data = [sampleGroup];
        }

        rebuildFeesFromData();

        data = sortDataByDate(data);
        render();

        createTransactionFeesDisplay();
        setupSearchFunctionality();

        if (SYNC_ENABLED) {
            setTimeout(() => {
                syncFromCloud(true).then(() => {
                    setTimeout(() => {
                        updateTotalsOnly();
                        console.log('✅ Totals refreshed after cloud sync');
                        console.log('💳 Total Transaction Fees:', totalTransactionFees);
                    }, 200);
                });
            }, 1000);
        }

        if (modalCloseBtn) {
            modalCloseBtn.addEventListener('click', closeReadMoreModal);
        }
        if (modal) {
            modal.addEventListener('click', function(e) {
                if (e.target === modal) {
                    closeReadMoreModal();
                }
            });
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') {
                    closeReadMoreModal();
                }
            });
        }

        applyFilterBtn.addEventListener('click', applyDateFilter);
        clearFilterBtn.addEventListener('click', clearDateFilter);
        printBtn.addEventListener('click', exportPdf);
        addDateBtn.addEventListener('click', addDateEntry);

        if (syncNowBtn) {
            syncNowBtn.addEventListener('click', function() {
                syncToCloud(true);
            });
        }

        addRowBtn.addEventListener('click', () => {
            if (data.length === 0) {
                alert('Please add a date entry first (click "Add New Date Entry")');
                return;
            }
            const lastGroup = data[data.length - 1];
            addTransactionRow(lastGroup.id);
        });
    }

    // ========================================
    // INIT
    // ========================================
    function init() {
        console.log('🚀 Initializing app...');
        
        // Check for existing session FIRST
        const savedUser = sessionStorage.getItem('starlink_user');
        if (savedUser) {
            try {
                const user = JSON.parse(savedUser);
                const users = getUsers();
                const exists = users.find(u => u.id === user.id);
                if (exists) {
                    console.log('✅ Session found for user:', user.username);
                    currentUser = user;
                    // Show main app immediately
                    showMainApp();
                    return;
                } else {
                    sessionStorage.removeItem('starlink_user');
                    currentUser = null;
                }
            } catch (e) {
                console.warn('⚠️ Invalid session data:', e);
                sessionStorage.removeItem('starlink_user');
                currentUser = null;
            }
        }
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                console.log('📄 DOM loaded, initializing...');
                initializeApp();
            });
        } else {
            console.log('📄 DOM already loaded, initializing...');
            initializeApp();
        }
    }

    function initializeApp() {
        try {
            const requiredElements = [
                'loginScreen', 'forgotScreen', 'changePasswordScreen', 'mainApp',
                'usernameInput', 'passwordInput', 'loginBtn', 'forgotPasswordBtn',
                'backToLoginBtn', 'changePasswordBtn', 'changePasswordBackBtn',
                'changePasswordSaveBtn', 'logoutBtn', 'adminPanelBtn'
            ];
            
            let allElementsExist = true;
            requiredElements.forEach(id => {
                const el = document.getElementById(id);
                if (!el) {
                    console.warn(`⚠️ Element #${id} not found`);
                    allElementsExist = false;
                }
            });
            
            if (!allElementsExist) {
                console.error('❌ Required elements missing! Check your HTML IDs.');
                return;
            }
            
            // Check if user is already logged in
            const savedUser = sessionStorage.getItem('starlink_user');
            let loggedIn = false;
            
            if (savedUser) {
                try {
                    currentUser = JSON.parse(savedUser);
                    const users = getUsers();
                    const exists = users.find(u => u.id === currentUser.id);
                    if (exists) {
                        console.log('✅ User logged in from session:', currentUser.username);
                        showMainApp();
                        loggedIn = true;
                    } else {
                        sessionStorage.removeItem('starlink_user');
                        currentUser = null;
                    }
                } catch (e) {
                    console.warn('⚠️ Invalid session data:', e);
                    sessionStorage.removeItem('starlink_user');
                    currentUser = null;
                }
            }
            
            if (!loggedIn) {
                console.log('🔐 No user logged in, showing login screen');
                const loginScreenEl = document.getElementById('loginScreen');
                const mainAppEl = document.getElementById('mainApp');
                const forgotScreenEl = document.getElementById('forgotScreen');
                const changePasswordScreenEl = document.getElementById('changePasswordScreen');
                
                if (loginScreenEl) loginScreenEl.style.display = 'flex';
                if (mainAppEl) mainAppEl.style.display = 'none';
                if (forgotScreenEl) forgotScreenEl.style.display = 'none';
                if (changePasswordScreenEl) changePasswordScreenEl.style.display = 'none';
                
                if (usernameInput) usernameInput.focus();
            }
            
            // ========================================
            // EVENT LISTENERS
            // ========================================
            
            if (loginBtn) {
                loginBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    attemptLogin();
                });
            }
            
            if (usernameInput) {
                usernameInput.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        if (passwordInput) passwordInput.focus();
                    }
                });
            }
            
            if (passwordInput) {
                passwordInput.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        attemptLogin();
                    }
                });
            }
            
            if (forgotPasswordBtn) {
                forgotPasswordBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    showForgotScreen();
                });
            }
            
            if (backToLoginBtn) {
                backToLoginBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    showLoginScreen();
                });
            }
            
            const forgotSubmitBtn = document.getElementById('forgotSubmitBtn');
            if (forgotSubmitBtn) {
                forgotSubmitBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    handleForgotPassword();
                });
            }
            
            const forgotUsername = document.getElementById('forgotUsername');
            if (forgotUsername) {
                forgotUsername.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        handleForgotPassword();
                    }
                });
            }
            
            if (changePasswordBtn) {
                changePasswordBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    showChangePasswordScreen();
                });
            }
            
            if (changePasswordBackBtn) {
                changePasswordBackBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    showLoginScreen();
                });
            }
            
            if (changePasswordSaveBtn) {
                changePasswordSaveBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    console.log('🔑 Change Password button clicked from event listener');
                    handleChangePassword();
                });
            }
            
            if (changePasswordOld) {
                changePasswordOld.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        if (changePasswordNew) changePasswordNew.focus();
                    }
                });
            }
            
            if (changePasswordNew) {
                changePasswordNew.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        if (changePasswordConfirm) changePasswordConfirm.focus();
                    }
                });
            }
            
            if (changePasswordConfirm) {
                changePasswordConfirm.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        handleChangePassword();
                    }
                });
            }
            
            if (logoutBtn) {
                logoutBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    logout();
                });
            }
            
            if (adminPanelBtn) {
                adminPanelBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    openAdminPanel();
                });
            }
            
            if (adminPanelClose) {
                adminPanelClose.addEventListener('click', function(e) {
                    e.preventDefault();
                    closeAdminPanel();
                });
            }
            
            if (adminPanelCloseBtn) {
                adminPanelCloseBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    closeAdminPanel();
                });
            }
            
            if (addUserBtn) {
                addUserBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    openUserModal(null);
                });
            }
            
            if (userModalSave) {
                userModalSave.addEventListener('click', function(e) {
                    e.preventDefault();
                    saveUser();
                });
            }
            
            if (userModalCancel) {
                userModalCancel.addEventListener('click', function(e) {
                    e.preventDefault();
                    closeUserModal();
                });
            }
            
            if (userModalClose) {
                userModalClose.addEventListener('click', function(e) {
                    e.preventDefault();
                    closeUserModal();
                });
            }
            
            if (userModalUsername) {
                userModalUsername.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        if (userModalPassword) userModalPassword.focus();
                    }
                });
            }
            
            if (userModalPassword) {
                userModalPassword.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        saveUser();
                    }
                });
            }
            
            document.querySelectorAll('.modal').forEach(modal => {
                modal.addEventListener('click', function(e) {
                    if (e.target === this) {
                        if (this.id === 'userModal') {
                            closeUserModal();
                        } else if (this.id === 'adminPanel') {
                            closeAdminPanel();
                        }
                    }
                });
            });
            
            console.log('✅ App initialized successfully');
            
        } catch (error) {
            console.error('❌ Error initializing app:', error);
            const loginErrorEl = document.getElementById('loginError');
            if (loginErrorEl) {
                loginErrorEl.textContent = '⚠️ App initialization error. Please refresh.';
                loginErrorEl.style.display = 'block';
            }
        }
    }

    // ========================================
    // START APP
    // ========================================
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(init, 100);
    } else {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(init, 100);
        });
    }

})();

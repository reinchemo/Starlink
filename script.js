// script.js – Login, Auto-calculating Totals, Supabase Cloud Sync, Realtime, Summary Export
// 6 default columns + 3 expected saved custom columns.
// All columns count toward the grand total.
//
// PHASE 2 — Cinematic UI (cursor glow, particles, magnetic buttons, ripple, confetti)
// PER-DATE FEES — Every date footer displays its own total transaction fees.
//   ▸ Fees SUM across every transaction column per row (no overwrite)
//   ▸ AUTO-HEAL: frozen fee map is always rebuilt from live transaction codes on load
// GLOBAL DUPLICATE PROTECTION — Same transaction code cannot exist on two dates.

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
        // STORAGE KEYS
        // ========================================
        const KEY_USER_SESSION = 'starlink_user';
        const KEY_USERS = 'starlink_users';
        const KEY_THEME = 'starlink_theme';
        const KEY_COLUMN_NAMES = 'starlink_column_names';
        const STORAGE_KEY = 'starlinkExpenditureData_v32';

        // ========================================
        // SUPABASE INIT
        // ========================================
        function initSupabase() {
            try {
                if (typeof supabase !== 'undefined') {
                    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
                    console.log('✅ Supabase initialized');
                    return true;
                }
                console.log('⏳ Loading Supabase library...');
                setTimeout(() => {
                    if (typeof supabase !== 'undefined') {
                        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
                        console.log('✅ Supabase initialized');
                    }
                }, 1000);
                return false;
            } catch (e) {
                console.error('❌ Supabase error:', e);
                return false;
            }
        }

        // ========================================
        // UTILITIES
        // ========================================
        function escapeHtml(str) {
            if (str === null || str === undefined) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function safeNum(v) {
            if (v === '' || v === null || v === undefined) return 0;
            const n = typeof v === 'number' ? v : parseFloat(v);
            return isNaN(n) ? 0 : n;
        }

        function round2(n) {
            return Math.round((n || 0) * 100) / 100;
        }

        function showToast(message, type = 'info') {
            const existing = document.querySelector('.toast-message');
            if (existing) existing.remove();

            const toast = document.createElement('div');
            toast.className = 'toast-message';
            toast.textContent = message;
            toast.style.cssText = `
            position: fixed;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%);
            padding: 14px 28px;
            border-radius: 100px;
            font-weight: 700;
            font-size: 0.86rem;
            font-family: 'Outfit', sans-serif;
            letter-spacing: 0.02em;
            z-index: 99999;
            background: ${type === 'success' ? 'rgba(52, 211, 153, 0.18)' : type === 'error' ? 'rgba(248, 113, 113, 0.18)' : 'rgba(56, 189, 248, 0.18)'};
            color: ${type === 'success' ? '#34d399' : type === 'error' ? '#f87171' : '#38bdf8'};
            border: 1px solid ${type === 'success' ? 'rgba(52, 211, 153, 0.35)' : type === 'error' ? 'rgba(248, 113, 113, 0.35)' : 'rgba(56, 189, 248, 0.35)'};
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px ${type === 'success' ? 'rgba(52, 211, 153, 0.2)' : type === 'error' ? 'rgba(248, 113, 113, 0.2)' : 'rgba(56, 189, 248, 0.2)'};
            max-width: 90%;
            text-align: center;
        `;
            document.body.appendChild(toast);

            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
                toast.style.transform = 'translateX(-50%) translateY(12px) scale(0.95)';
                setTimeout(() => toast.remove(), 350);
            }, 3000);
        }

        // ========================================
        // BUILD SUMMARY
        // ========================================
        function buildSummary() {
            const allCols = getAllColumns();

            function findColumnKey(keyword) {
                const upperKeyword = keyword.toUpperCase();
                if (allCols.some(c => c.key === keyword)) return keyword;

                const savedMatch = allCols.find(c =>
                    c.isSaved && c.label && c.label.toUpperCase().includes(upperKeyword)
                );
                if (savedMatch) return savedMatch.key;

                const tempMatch = allCols.find(c =>
                    c.isTemp && c.label && c.label.toUpperCase().includes(upperKeyword)
                );
                if (tempMatch) return tempMatch.key;

                return null;
            }

            function sumColumn(colKey) {
                if (!colKey) return 0;
                let total = 0;
                data.forEach(group => {
                    (group.rows || []).forEach(row => {
                        total += getColumnAmount(row, colKey);
                    });
                });
                return round2(total);
            }

            const commonExpenditureKey = findColumnKey('COMMON EXPENDITURE');
            const routersKey = findColumnKey('ROUTERS');
            const kairoRoutersKey = findColumnKey('KAIRO ROUTERS');
            const starlinkInvestmentKey = findColumnKey('STARLINK INVESTMENT');

            const commonExpenditureTotal = sumColumn(commonExpenditureKey);
            const routersTotal = sumColumn(routersKey);
            const kairoRoutersTotal = sumColumn(kairoRoutersKey);
            const starlinkInvestmentTotal = sumColumn(starlinkInvestmentKey);

            const starlinkVirtualInvestment = round2(
                (5 / 6) * commonExpenditureTotal +
                (routersTotal - kairoRoutersTotal)
            );

            const summary = {
                commonExpenditureTotal,
                routersTotal,
                kairoRoutersTotal,
                starlinkInvestmentTotal,
                starlinkVirtualInvestment,
                totalTransactionFees: round2(totalTransactionFees),
                lastUpdated: new Date().toISOString()
            };

            console.log('📊 Summary computed:', summary);
            return summary;
        }

        // ========================================
        // SUPABASE SYNC
        // ========================================
        async function syncToCloud(showToastMsg = true) {
            if (!SYNC_ENABLED || !supabaseClient) {
                if (showToastMsg) showToast('⚠️ Supabase not connected', 'info');
                return;
            }

            if (!data || data.length === 0) {
                console.warn('⚠️ syncToCloud skipped — no data loaded yet');
                if (showToastMsg) showToast('⚠️ Nothing to sync yet', 'info');
                return;
            }

            try {
                data = sortDataByDate(data);
                const summary = buildSummary();

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
                    summary: summary,
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
                    console.log('✅ Synced to cloud', summary);
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
                        if (showToastMsg) showToast('ℹ️ No cloud data yet.', 'info');
                    } else {
                        if (showToastMsg) showToast('⚠️ Pull error: ' + error.message, 'error');
                    }
                    return false;
                }

                if (result && result.data) {
                    const cloudData = result.data;

                    if (Array.isArray(cloudData.data) && cloudData.data.length > 0) {
                        data = cloudData.data;
                    }
                    if (cloudData.nextDateId) nextDateId = cloudData.nextDateId;
                    if (cloudData.nextRowId) nextRowId = cloudData.nextRowId;
                    if (cloudData.nextColId) nextColId = cloudData.nextColId;
                    if (Array.isArray(cloudData.customColumns)) customColumns = cloudData.customColumns;
                    if (Array.isArray(cloudData.savedCustomColumns)) savedCustomColumns = cloudData.savedCustomColumns;
                    if (cloudData.savedDates) savedDates = cloudData.savedDates;
                    if (cloudData.editModes) editModes = cloudData.editModes;

                    if (cloudData.columnNameEdits) {
                        columnNameEdits = cloudData.columnNameEdits;
                        saveColumnNameEdits();
                    }

                    // ⚠️ IMPORTANT: DO NOT trust cloudData.transactionFees —
                    // We rebuild it fresh from live transaction codes below.

                    rebuildFeesFromData();
                    data = sortDataByDate(data);
                    saveToStorage();

                    render();
                    setTimeout(() => {
                        updateTotalsOnly();
                        updateTransactionFeesDisplay();
                        updateSummaryDisplay();
                        updateDateFeesDisplays();
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
        // FEES REBUILD (AUTO-HEAL)
        // Always recomputes fees from live transaction codes.
        // Ignores any stale frozen values.
        // ========================================
        function rebuildFeesFromData() {
            const oldTotal = round2(totalTransactionFees);
            transactionFees = {};
            totalTransactionFees = 0;
            const allCols = getAllColumns();

            data.forEach(group => {
                group.rows.forEach(row => {
                    let rowFee = 0;
                    allCols.forEach(col => {
                        const transKey = col.key + '_transaction';
                        const transVal = row[transKey];
                        if (transVal && transVal.trim() !== '') {
                            const parsed = parseMpesaMessage(transVal);
                            if (parsed && parsed.transactionCost !== null && parsed.transactionCost > 0) {
                                rowFee += parsed.transactionCost;
                            }
                        }
                    });
                    if (rowFee > 0) {
                        rowFee = round2(rowFee);
                        transactionFees[group.id + '_' + row.id] = rowFee;
                    }
                });
            });

            recalculateTotalFees();
            updateTransactionFeesDisplay();
            updateDateFeesDisplays();

            const newTotal = round2(totalTransactionFees);
            if (oldTotal !== newTotal) {
                console.log(`🔄 Auto-healed fees: ${oldTotal.toFixed(2)} → ${newTotal.toFixed(2)}`);
            } else {
                console.log(`✅ Fees rebuilt from live data: ${newTotal.toFixed(2)}`);
            }
            return totalTransactionFees;
        }

        // ========================================
        // DUPLICATE DETECTION — GLOBAL (across ALL dates)
        // ========================================
        function checkForDuplicateTransactions(dateId) {
            const group = data.find(d => d.id === dateId);
            if (!group) return null;

            const allCols = getAllColumns();
            const targetCodes = [];

            group.rows.forEach(row => {
                allCols.forEach(col => {
                    const transKey = col.key + '_transaction';
                    const transVal = row[transKey];
                    if (transVal && transVal.trim() !== '') {
                        const parsed = parseMpesaMessage(transVal);
                        if (parsed && parsed.transactionCode) {
                            targetCodes.push({
                                code: parsed.transactionCode.toUpperCase(),
                                rowId: row.id,
                                scope: null,
                                conflictDate: null
                            });
                        }
                    }
                });
            });

            if (targetCodes.length === 0) return null;

            // Within same date
            const seen = {};
            for (const item of targetCodes) {
                if (seen[item.code]) {
                    return {
                        code: item.code,
                        conflictDate: group.date,
                        scope: 'same-date'
                    };
                }
                seen[item.code] = item.rowId;
            }

            // Across other dates
            for (const otherGroup of data) {
                if (otherGroup.id === dateId) continue;

                for (const row of otherGroup.rows) {
                    for (const col of allCols) {
                        const transKey = col.key + '_transaction';
                        const transVal = row[transKey];
                        if (!transVal || transVal.trim() === '') continue;

                        const parsed = parseMpesaMessage(transVal);
                        if (!parsed || !parsed.transactionCode) continue;

                        const otherCode = parsed.transactionCode.toUpperCase();
                        const match = targetCodes.find(t => t.code === otherCode);
                        if (match) {
                            return {
                                code: otherCode,
                                conflictDate: otherGroup.date,
                                scope: 'cross-date'
                            };
                        }
                    }
                }
            }

            return null;
        }

        // ========================================
        // LIVE CHECK — is this code used on ANY other date?
        // ========================================
        function isCodeUsedElsewhere(code, currentDateId) {
            if (!code || code.trim() === '') return null;
            const q = code.toUpperCase().trim();
            const allCols = getAllColumns();

            for (const group of data) {
                if (group.id === currentDateId) continue;
                for (const row of group.rows) {
                    for (const col of allCols) {
                        const transKey = col.key + '_transaction';
                        const transVal = row[transKey];
                        if (!transVal || transVal.trim() === '') continue;

                        const parsed = parseMpesaMessage(transVal);
                        if (parsed && parsed.transactionCode &&
                            parsed.transactionCode.toUpperCase() === q) {
                            return group.date;
                        }
                    }
                }
            }
            return null;
        }

        // ========================================
        // HIGHLIGHT DUPLICATE
        // ========================================
        function highlightDuplicateRows(code) {
            if (!code) return;
            const q = code.toUpperCase();

            document.querySelectorAll('tr.duplicate-warning').forEach(el => el.classList.remove('duplicate-warning'));
            document.querySelectorAll('td.duplicate-cell').forEach(el => el.classList.remove('duplicate-cell'));

            document.querySelectorAll('.trans-input, .desc-display[data-type="transaction"]').forEach(el => {
                const text = (el.value || el.textContent || el.dataset.fullText || '').toUpperCase();
                if (text.includes(q)) {
                    const row = el.closest('tr');
                    if (row) row.classList.add('duplicate-warning');
                    const cell = el.closest('td');
                    if (cell) cell.classList.add('duplicate-cell');
                }
            });

            const firstRow = document.querySelector('tr.duplicate-warning');
            if (firstRow) firstRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        function sortDataByDate(dataArray) {
            if (!dataArray || dataArray.length === 0) return dataArray;
            return [...dataArray].sort((a, b) => {
                const a1 = new Date(a.date),
                    b1 = new Date(b.date);
                return b1 - a1;
            });
        }

        // ========================================
        // USERS
        // ========================================
        const DEFAULT_USERS = [
            { id: 1, username: 'admin', password: 'admin123', role: 'admin' },
            { id: 2, username: 'grace', password: 'grace123', role: 'user' }
        ];

        function getUsers() {
            const stored = localStorage.getItem(KEY_USERS);
            if (stored) {
                try {
                    const users = JSON.parse(stored);
                    if (users && users.length > 0) return users;
                } catch (e) {}
            }
            localStorage.setItem(KEY_USERS, JSON.stringify(DEFAULT_USERS));
            return DEFAULT_USERS;
        }

        function saveUsers(users) {
            localStorage.setItem(KEY_USERS, JSON.stringify(users));
            return true;
        }

        function findUser(username) {
            return getUsers().find(u => u.username.toLowerCase() === username.toLowerCase());
        }

        function authenticateUser(username, password) {
            return getUsers().find(u =>
                u.username.toLowerCase() === username.toLowerCase() &&
                u.password === password
            ) || null;
        }

        function updateUserPassword(userId, newPassword) {
            const users = getUsers();
            const i = users.findIndex(u => u.id === userId);
            if (i === -1) return false;
            users[i].password = newPassword;
            saveUsers(users);
            return true;
        }

        function addUser(username, password, role = 'user') {
            const users = getUsers();
            if (findUser(username)) return false;
            const maxId = users.reduce((m, u) => Math.max(m, u.id), 0);
            users.push({ id: maxId + 1, username, password, role });
            saveUsers(users);
            return true;
        }

        function updateUser(id, username, password, role) {
            const users = getUsers();
            const i = users.findIndex(u => u.id === id);
            if (i === -1) return false;
            const exists = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.id !== id);
            if (exists) return false;
            users[i] = {...users[i], username, password, role };
            saveUsers(users);
            return true;
        }

        function deleteUser(id) {
            const users = getUsers();
            const filtered = users.filter(u => u.id !== id);
            if (filtered.length === users.length) return false;
            saveUsers(filtered);
            return true;
        }

        // ========================================
        // DOM REFS
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
        // LOGIN
        // ========================================
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
                sessionStorage.setItem(KEY_USER_SESSION, JSON.stringify(user));
                setTimeout(showMainApp, 600);
            } else {
                loginSuccess.style.display = 'none';
                loginError.textContent = '❌ Invalid username or password.';
                loginError.style.display = 'block';
                passwordInput.value = '';
                passwordInput.focus();
                setTimeout(() => { loginError.style.display = 'none'; }, 3000);
            }
        }

        function showMainApp() {
            loginScreen.style.display = 'none';
            forgotScreen.style.display = 'none';
            changePasswordScreen.style.display = 'none';
            mainApp.style.display = 'block';
            if (userDisplay) userDisplay.textContent = '👤 ' + currentUser.username;
            if (adminPanelBtn) {
                adminPanelBtn.style.display = currentUser.role === 'admin' ? 'inline-flex' : 'none';
            }
            sessionStorage.setItem(KEY_USER_SESSION, JSON.stringify(currentUser));
            initMainApp();
        }

        function logout() {
            sessionStorage.removeItem(KEY_USER_SESSION);
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
        }

        function showForgotScreen() {
            loginScreen.style.display = 'none';
            forgotScreen.style.display = 'flex';
            changePasswordScreen.style.display = 'none';
            const el = document.getElementById('forgotUsername');
            if (el) el.focus();
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

        function handleChangePassword() {
            try {
                const oldP = changePasswordOld.value.trim();
                const newP = changePasswordNew.value.trim();
                const confP = changePasswordConfirm.value.trim();

                changePasswordError.style.display = 'none';
                changePasswordSuccess.style.display = 'none';

                if (!oldP || !newP || !confP) {
                    changePasswordError.textContent = '❌ Please fill in all fields.';
                    changePasswordError.style.display = 'block';
                    return;
                }

                let targetUser = currentUser;
                if (!targetUser) {
                    const typed = (usernameInput && usernameInput.value.trim()) || '';
                    if (!typed) {
                        changePasswordError.textContent = '❌ Enter your username on the login screen first.';
                        changePasswordError.style.display = 'block';
                        return;
                    }
                    targetUser = findUser(typed);
                    if (!targetUser) {
                        changePasswordError.textContent = '❌ Username not found.';
                        changePasswordError.style.display = 'block';
                        return;
                    }
                } else {
                    const fresh = findUser(currentUser.username);
                    if (fresh) targetUser = fresh;
                }

                if (oldP !== targetUser.password) {
                    changePasswordError.textContent = '❌ Old password is incorrect.';
                    changePasswordError.style.display = 'block';
                    return;
                }

                if (newP !== confP) {
                    changePasswordError.textContent = '❌ New passwords do not match.';
                    changePasswordError.style.display = 'block';
                    return;
                }

                if (newP.length < 4) {
                    changePasswordError.textContent = '❌ New password must be at least 4 characters.';
                    changePasswordError.style.display = 'block';
                    return;
                }

                if (updateUserPassword(targetUser.id, newP)) {
                    if (currentUser && currentUser.id === targetUser.id) {
                        currentUser.password = newP;
                        sessionStorage.setItem(KEY_USER_SESSION, JSON.stringify(currentUser));
                    }
                    changePasswordSuccess.textContent = '✅ Password changed successfully!';
                    changePasswordSuccess.style.display = 'block';
                    setTimeout(() => {
                        showToast('✅ Password changed successfully!', 'success');
                        showLoginScreen();
                    }, 1500);
                } else {
                    changePasswordError.textContent = '❌ Failed to update password.';
                    changePasswordError.style.display = 'block';
                }
            } catch (err) {
                changePasswordError.textContent = '❌ Something went wrong.';
                changePasswordError.style.display = 'block';
            }
        }

        function handleForgotPassword() {
            const el = document.getElementById('forgotUsername');
            const err = document.getElementById('forgotError');
            const ok = document.getElementById('forgotSuccess');
            if (!el) return;

            const username = el.value.trim();
            err.style.display = 'none';
            ok.style.display = 'none';

            if (!username) {
                err.textContent = '❌ Please enter your username.';
                err.style.display = 'block';
                return;
            }

            if (findUser(username)) {
                ok.textContent = '✅ Password reset link sent to admin. Please contact your administrator.';
                ok.style.display = 'block';
                setTimeout(showLoginScreen, 3000);
            } else {
                err.textContent = '❌ Username not found.';
                err.style.display = 'block';
                setTimeout(() => { err.style.display = 'none'; }, 3000);
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
                            <span class="username">${escapeHtml(user.username)}</span>
                            <span class="user-role">${escapeHtml(user.role)} ${isCurrent ? '• <span class="current-badge">(you)</span>' : ''}</span>
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
                    openUserModal(parseInt(this.dataset.id));
                });
            });
            document.querySelectorAll('.btn-delete-user').forEach(btn => {
                btn.addEventListener('click', function() {
                    const id = parseInt(this.dataset.id);
                    if (confirm('Delete this user?')) {
                        if (deleteUser(id)) {
                            renderUserList();
                            if (currentUser && currentUser.id === id) logout();
                            showToast('✅ User deleted successfully', 'success');
                        }
                    }
                });
            });
        }
    }

    function openAdminPanel() {
        if (adminPanel) adminPanel.style.display = 'flex';
        renderUserList();
    }

    function closeAdminPanel() {
        if (adminPanel) adminPanel.style.display = 'none';
    }

    function openUserModal(userId = null) {
        userModalError.style.display = 'none';
        editingUserId = userId;

        if (userId) {
            const user = getUsers().find(u => u.id === userId);
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
        const role     = userModalRole.value;

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
            const exists = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.id !== editingUserId);
            if (exists) {
                userModalError.textContent = '❌ Username already exists.';
                userModalError.style.display = 'block';
                return;
            }
            if (updateUser(editingUserId, username, password, role)) {
                if (currentUser && currentUser.id === editingUserId) {
                    currentUser = { ...currentUser, username, password, role };
                    sessionStorage.setItem(KEY_USER_SESSION, JSON.stringify(currentUser));
                    if (userDisplay) userDisplay.textContent = '👤 ' + currentUser.username;
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

    function userCanEdit() {
        return currentUser && currentUser.role === 'admin';
    }

    // ========================================
    // COLUMN NAME EDITS
    // ========================================
    let columnNameEdits = {};

    function loadColumnNameEdits() {
        try {
            const s = localStorage.getItem(KEY_COLUMN_NAMES);
            if (s) columnNameEdits = JSON.parse(s);
        } catch (e) {}
    }

    function saveColumnNameEdits() {
        try {
            localStorage.setItem(KEY_COLUMN_NAMES, JSON.stringify(columnNameEdits));
        } catch (e) {}
    }

    function getColumnLabel(col) {
        return columnNameEdits[col.key] || col.label;
    }

    function editColumnName(colKey) {
        const allCols = getAllColumns();
        const col = allCols.find(c => c.key === colKey);
        if (!col) { showToast('❌ Column not found', 'error'); return; }

        const current = columnNameEdits[colKey] || col.label;
        const newName = prompt('Enter new column name:', current);
        if (newName === null) return;
        if (!newName.trim()) { showToast('❌ Column name cannot be empty', 'error'); return; }

        columnNameEdits[colKey] = newName.trim().toUpperCase();
        saveColumnNameEdits();
        render();
        showToast('✅ Column renamed to: ' + newName.trim().toUpperCase(), 'success');
        scheduleCloudSync();
    }

    // ========================================
    // M-PESA PARSING
    // Handles: Transaction cost, Fee, Charge, Cost, and the word "Transactions"
    // Strict code detection (8-15 uppercase alphanumerics, not the word "Transaction")
    // ========================================
// ========================================
// M-PESA / BANK MESSAGE PARSER
// Handles:
//   • "UI21P5B6OV Confirmed. Ksh1,500.00 ... Transaction cost, Ksh15.00"
//   • "41800.00 KES was sent to Mary ... MPesa Ref. UI21P5B6OV ... Charges 76.25 KES"
//   • Fee / Charge / Charges / Cost / Transaction cost — with or without comma/colon
//   • Currency before OR after amount (Ksh 15 / 15 KES / KSh15.00 / 15.00 KES)
// ========================================
function parseMpesaMessage(message) {
    if (!message || message.trim() === '') return null;

    const r = {
        amount: null,
        date: null,
        time: null,
        transactionCost: null,
        fullMessage: message,
        transactionCode: null
    };

    // ---------- 1. TRANSACTION CODE ----------
    // a) M-Pesa style: code at the very start
    const startCode = message.match(/^([A-Z0-9]{8,15})\b/);
    if (startCode && !/^TRANSACTION/i.test(startCode[1])) {
        r.transactionCode = startCode[1];
    }
    // b) Bank style: "MPesa Ref. UI21P5B6OV" or "Ref. UI21P5B6OV"
    if (!r.transactionCode) {
        const refMatch = message.match(/(?:MPesa\s+Ref\.?|Ref\.?)\s+([A-Z0-9]{8,15})\b/i);
        if (refMatch) r.transactionCode = refMatch[1].toUpperCase();
    }
    // c) Fallback — any standalone 10-char uppercase alphanumeric
    if (!r.transactionCode) {
        const looseMatch = message.match(/\b([A-Z0-9]{10})\b/);
        if (looseMatch && !/^[A-Z]{4,}$/.test(looseMatch[1])) {
            r.transactionCode = looseMatch[1];
        }
    }

    // ---------- 2. AMOUNT ----------
    // a) "Ksh1,500.00 sent" / "Ksh1,500.00"
    const amountKshFirst = message.match(/(?:KSh|KES|Ksh|ksh)\s*([\d,]+\.?\d*)\s*(?:sent|received|to|from|was|paid)?/i);
    if (amountKshFirst) {
        r.amount = parseFloat(amountKshFirst[1].replace(/,/g, ''));
    }
    // b) "41800.00 KES was sent"  → amount BEFORE currency
    if (r.amount === null) {
        const amountKshLast = message.match(/([\d,]+\.?\d*)\s*(?:KSh|KES|Ksh|ksh)\s*(?:was|sent|received|to|from|paid)/i);
        if (amountKshLast) r.amount = parseFloat(amountKshLast[1].replace(/,/g, ''));
    }

    // ---------- 3. TRANSACTION FEE / CHARGE ----------
    // Support every variant we've seen plus a few defensive ones
    const feePatterns = [
        // M-Pesa standard: "Transaction cost, Ksh15.00" (comma optional)
        /Transaction\s+cost\s*[,:]?\s*(?:KSh|KES|Ksh|ksh)?\s*([\d,]+\.?\d*)/i,
        // Bank style: "Charges 76.25 KES" (currency AFTER amount, no comma)
        /Charges?\s*[,:]?\s*([\d,]+\.?\d*)\s*(?:KSh|KES|Ksh|ksh)/i,
        // "Charge: 53" or "Fee, Ksh 10"
        /(?:Fee|Charge|Charges|Cost)\s*[,:]?\s*(?:KSh|KES|Ksh|ksh)?\s*([\d,]+\.?\d*)/i,
        // "Cost Ksh 10.50"
        /Cost\s*[,:]?\s*(?:KSh|KES|Ksh|ksh)?\s*([\d,]+\.?\d*)/i
    ];
    for (const pat of feePatterns) {
        const m = message.match(pat);
        if (m) {
            const val = parseFloat(m[1].replace(/,/g, ''));
            if (!isNaN(val)) {
                r.transactionCost = val;
                break;
            }
        }
    }

    // ---------- 4. DATE ----------
    const d = message.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
    if (d) r.date = d[1];

    // ---------- 5. TIME ----------
    const t = message.match(/(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:AM|PM|EAT)?/i);
    if (t) r.time = t[1];

    return r;
}

    // ========================================
    // TRANSACTION FEES
    // ========================================
    let transactionFees = {};
    let totalTransactionFees = 0;

    function updateTransactionFeesDisplay() {
        const el = document.getElementById('transactionFeesTotal');
        if (el) el.textContent = totalTransactionFees.toFixed(2);
    }

    function recalculateTotalFees() {
        totalTransactionFees = 0;
        for (let k in transactionFees) totalTransactionFees += transactionFees[k];
        totalTransactionFees = round2(totalTransactionFees);
        return totalTransactionFees;
    }

    // ========================================
    // PER-DATE TRANSACTION FEES
    // ========================================
    function getDateFeesTotal(group) {
        if (!group || !group.rows) return 0;
        let total = 0;
        const allCols = getAllColumns();

        group.rows.forEach(row => {
            let rowFee = 0;
            allCols.forEach(col => {
                const transKey = col.key + '_transaction';
                const transVal = row[transKey];
                if (transVal && transVal.trim() !== '') {
                    const parsed = parseMpesaMessage(transVal);
                    if (parsed && parsed.transactionCost !== null && parsed.transactionCost > 0) {
                        rowFee += parsed.transactionCost;
                    }
                }
            });
            total += rowFee;
        });

        return round2(total);
    }

    function updateDateFeesDisplays() {
        const filtered = getFilteredData();
        filtered.forEach(group => {
            const el = document.querySelector(`[data-date-fees-id="${group.id}"]`);
            if (!el) return;
            const total = getDateFeesTotal(group);
            el.textContent = total.toFixed(2);
        });
    }

    // ========================================
    // SUMMARY CARDS
    // ========================================
    function updateSummaryDisplay() {
        const summary = buildSummary();
        const v = document.getElementById('starlinkVirtualTotal');
        if (v) v.textContent = summary.starlinkVirtualInvestment.toFixed(2);
        const i = document.getElementById('starlinkInvestmentTotal');
        if (i) i.textContent = summary.starlinkInvestmentTotal.toFixed(2);
    }

    function createSummaryDisplay() {
        if (document.getElementById('summaryDisplayRow')) {
            updateSummaryDisplay();
            return;
        }
        const grid = document.querySelector('.totals-grid');
        if (!grid) return;

        const row = document.createElement('div');
        row.id = 'summaryDisplayRow';
        row.style.cssText = 'display:flex; flex-wrap:wrap; gap:14px; margin-top:14px;';

        row.innerHTML = `
            <div class="total-card" id="starlinkVirtualCard" style="
                background: linear-gradient(135deg, rgba(251, 191, 36, 0.14), rgba(245, 158, 11, 0.08));
                border: 1px solid rgba(251, 191, 36, 0.3);
            ">
                <span class="total-label">🏛️ STARLINK VIRTUAL</span>
                <span class="total-value" id="starlinkVirtualTotal" style="color: var(--accent-gold);">0.00</span>
            </div>
            <div class="total-card" id="starlinkInvestmentCard" style="
                background: linear-gradient(135deg, rgba(56, 189, 248, 0.14), rgba(167, 139, 250, 0.08));
                border: 1px solid rgba(56, 189, 248, 0.3);
            ">
                <span class="total-label">📈 STARLINK INVESTMENT</span>
                <span class="total-value" id="starlinkInvestmentTotal" style="color: var(--accent-primary);">0.00</span>
            </div>
        `;

        const card = document.getElementById('grandTotalCard');
        if (card) card.after(row);
        else grid.appendChild(row);

        updateSummaryDisplay();
    }

    function createTransactionFeesDisplay() {
        if (document.getElementById('transactionFeesDisplay')) {
            updateTransactionFeesDisplay();
            return;
        }
        const grid = document.querySelector('.totals-grid');
        if (!grid) return;

        const feesCard = document.createElement('div');
        feesCard.className = 'total-card';
        feesCard.id = 'transactionFeesDisplay';
        feesCard.innerHTML = `
            <span class="total-label">💳 TRANSACTION FEES</span>
            <span class="total-value" id="transactionFeesTotal" style="color: var(--accent-gold);">${totalTransactionFees.toFixed(2)}</span>
        `;

        const card = document.getElementById('grandTotalCard');
        if (card) card.after(feesCard);
        else grid.appendChild(feesCard);

        updateTransactionFeesDisplay();
    }

    // ========================================
    // MAIN APP CONSTANTS
    // ========================================
    const DEFAULT_COLUMNS = [
        { key: 'starlinkGeneral',   label: 'STARLINK GENERAL',   isCustom: false },
        { key: 'commonInvestment',  label: 'COMMON INVESTMENT',  isCustom: false },
        { key: 'commonExpenditure', label: 'COMMON EXPENDITURE', isCustom: false },
        { key: 'tokens',            label: 'TOKENS',             isCustom: false },
        { key: 'fuelBike',          label: 'FUEL/BIKE',          isCustom: false },
        { key: 'routers',           label: 'ROUTERS',            isCustom: false }
    ];

    const NUMERIC_KEYS = DEFAULT_COLUMNS.map(c => c.key);

    let customColumns = [];
    let data = [];
    let nextDateId = 1;
    let nextRowId  = 1;
    let nextColId  = 1;
    let savedDates = {};
    let editModes  = {};
    let savedCustomColumns = [];

    let dateFrom = '';
    let dateTo   = '';

    const wrapper        = document.getElementById('tableWrapper');
    const dateFromInput  = document.getElementById('dateFrom');
    const dateToInput    = document.getElementById('dateTo');
    const applyFilterBtn = document.getElementById('applyFilterBtn');
    const clearFilterBtn = document.getElementById('clearFilterBtn');
    const printBtn       = document.getElementById('printPdfBtn');
    const addDateBtn     = document.getElementById('addDateBtn');
    const addRowBtn      = document.getElementById('addRowBtn');
    const grandTotalEl   = document.getElementById('grandTotal');

    const modal         = document.getElementById('readMoreModal');
    const modalBody     = document.getElementById('modalBody');
    const modalCloseBtn = document.getElementById('modalCloseBtn');

    const themeToggle   = document.getElementById('themeToggle');

    loadColumnNameEdits();

    // ========================================
    // THEME
    // ========================================
    function getStoredTheme() {
        return localStorage.getItem(KEY_THEME) || 'dark';
    }
    function setStoredTheme(theme) {
        localStorage.setItem(KEY_THEME, theme);
    }
    function applyTheme(theme) {
        if (theme === 'light') {
            document.body.classList.add('light-mode');
            if (themeToggle) themeToggle.innerHTML = '<i class="bi bi-moon-stars"></i> <span>Dark</span>';
        } else {
            document.body.classList.remove('light-mode');
            if (themeToggle) themeToggle.innerHTML = '<i class="bi bi-sun-fill"></i> <span>Light</span>';
        }
        setStoredTheme(theme);
    }
    function toggleTheme() {
        applyTheme(getStoredTheme() === 'dark' ? 'light' : 'dark');
    }

    // ========================================
    // COLUMN HELPERS
    // ========================================
    function getAllColumns() {
        const cols = [...DEFAULT_COLUMNS, ...customColumns, ...savedCustomColumns];
        return cols.map(col => {
            if (columnNameEdits[col.key]) return { ...col, label: columnNameEdits[col.key] };
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
        return safeNum(v);
    }

    function getColumnAmount(row, columnKey) {
        if (!columnKey) return 0;
        const amountKey = columnKey + '_amount';
        return safeNum(row[amountKey]);
    }

    function getRowTotal(row) {
        let sum = 0;
        getAllColumns().forEach(col => {
            if (isNumericColumn(col.key)) sum += getColumnAmount(row, col.key);
        });
        return sum;
    }

    function getDateGroupTotal(group) {
        if (!group || !group.rows) return 0;
        let sum = 0;
        group.rows.forEach(row => { sum += getRowTotal(row); });
        return sum;
    }

    function getFilteredData() {
        let filtered = data;
        if (dateFrom && dateTo) {
            filtered = filtered.filter(d => d.date && d.date >= dateFrom && d.date <= dateTo);
        } else if (dateFrom) {
            filtered = filtered.filter(d => d.date && d.date >= dateFrom);
        } else if (dateTo) {
            filtered = filtered.filter(d => d.date && d.date <= dateTo);
        }
        return sortDataByDate(filtered);
    }

    function computeColumnTotals(filteredData) {
        const totals = {};
        const allCols = getAllColumns();
        allCols.forEach(col => {
            if (isNumericColumn(col.key)) totals[col.key] = 0;
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
        filteredData.forEach(g => { sum += getDateGroupTotal(g); });
        return sum;
    }

    function truncateText(text, wordLimit = 3) {
        if (!text) return { short: text, full: text, needsReadMore: false };
        const words = text.trim().split(/\s+/);
        if (words.length <= wordLimit) return { short: text, full: text, needsReadMore: false };
        return {
            short: words.slice(0, wordLimit).join(' ') + '...',
            full: text,
            needsReadMore: true
        };
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

    // ========================================
    // CUSTOM COLUMNS
    // ========================================
    function addCustomColumn() {
        if (!userCanEdit()) {
            showToast('⚠️ Only admin can add columns', 'error');
            return;
        }
        const colName = prompt('Enter the name of the new expenditure column:', 'New Expenditure');
        if (!colName || colName.trim() === '') return;

        const key = 'temp_' + nextColId++ + '_' + colName.replace(/\s+/g, '_').toLowerCase();
        customColumns.push({
            key: key,
            label: colName.trim().toUpperCase(),
            isCustom: true,
            isTemp: true
        });

        data.forEach(group => {
            group.rows.forEach(row => {
                row[key + '_desc'] = '';
                row[key + '_transaction'] = '';
                row[key + '_amount'] = '';
            });
        });

        render();
        scheduleCloudSync();
        showToast('✅ Column added: ' + colName.trim().toUpperCase(), 'success');
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
                row[savedCol.key + '_desc']        = row[colToSave.key + '_desc'] || '';
                row[savedCol.key + '_transaction'] = row[colToSave.key + '_transaction'] || '';
                row[savedCol.key + '_amount']      = row[colToSave.key + '_amount'] || '';
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
        scheduleCloudSync();
        showToast('✅ Column saved permanently', 'success');
    }

    function removeCustomColumn(colKey) {
        if (!userCanEdit()) {
            showToast('⚠️ Only admin can delete columns', 'error');
            return;
        }

        const savedIndex = savedCustomColumns.findIndex(c => c.key === colKey);
        if (savedIndex !== -1) {
            if (!confirm('Delete this saved column and all its data?')) return;
            savedCustomColumns.splice(savedIndex, 1);
            data.forEach(group => {
                group.rows.forEach(row => {
                    delete row[colKey + '_desc'];
                    delete row[colKey + '_transaction'];
                    delete row[colKey + '_amount'];
                });
            });
            render();
            scheduleCloudSync();
            showToast('✅ Column deleted', 'success');
            return;
        }

        const tempIndex = customColumns.findIndex(c => c.key === colKey);
        if (tempIndex !== -1) {
            if (!confirm('Delete this temporary column and all its data?')) return;
            customColumns.splice(tempIndex, 1);
            data.forEach(group => {
                group.rows.forEach(row => {
                    delete row[colKey + '_desc'];
                    delete row[colKey + '_transaction'];
                    delete row[colKey + '_amount'];
                });
            });
            render();
            scheduleCloudSync();
            showToast('✅ Column deleted', 'success');
        }
    }

    // ========================================
    // DATE / ROW OPERATIONS
    // ========================================
    function saveDateEntry(dateId) {
        if (!userCanEdit()) {
            showToast('⚠️ Only admin can save', 'error');
            return;
        }
        const group = data.find(d => d.id === dateId);
        if (!group) return;

        const dup = checkForDuplicateTransactions(dateId);
        if (dup) {
            if (dup.scope === 'cross-date') {
                showToast(`❌ ${dup.code} already exists on ${dup.conflictDate}`, 'error');
            } else {
                showToast(`❌ Duplicate ${dup.code} in this date`, 'error');
            }
            highlightDuplicateRows(dup.code);
            return;
        }

        const btn = document.querySelector(`.save-btn[data-date-id="${dateId}"]`);
        if (btn) {
            btn.textContent = '✓ Saved';
            btn.classList.add('saved');
            setTimeout(() => {
                btn.textContent = '💾 Save';
                btn.classList.remove('saved');
            }, 2000);
        }

        let feesCount = 0, feesTotal = 0;
        const allCols = getAllColumns();

        const keysToRemove = [];
        for (let key in transactionFees) {
            if (key.startsWith(dateId + '_')) keysToRemove.push(key);
        }
        keysToRemove.forEach(k => delete transactionFees[k]);

        group.rows.forEach(row => {
            let rowFee = 0;
            allCols.forEach(col => {
                const transKey = col.key + '_transaction';
                const transVal = row[transKey];
                if (transVal && transVal.trim() !== '') {
                    const parsed = parseMpesaMessage(transVal);
                    if (parsed && parsed.transactionCost !== null && parsed.transactionCost > 0) {
                        rowFee += parsed.transactionCost;
                    }
                }
            });
            if (rowFee > 0) {
                rowFee = round2(rowFee);
                transactionFees[dateId + '_' + row.id] = rowFee;
                feesCount++;
                feesTotal += rowFee;
            }
            delete row._pendingFee;
        });

        recalculateTotalFees();
        updateTransactionFeesDisplay();
        updateSummaryDisplay();
        updateDateFeesDisplays();

        savedDates[dateId] = true;
        editModes[dateId] = false;

        render();
        saveToStorage();
        scheduleCloudSync();

        if (feesCount > 0) {
            showToast(`✅ Saved! ${feesCount} fee(s): KSh ${feesTotal.toFixed(2)}`, 'success');
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
        if (editModes[dateId]) savedDates[dateId] = false;
        render();
    }

    function addTransactionRow(dateId) {
        if (!userCanEdit()) {
            showToast('⚠️ Only admin can add rows', 'error');
            return;
        }
        const group = data.find(d => d.id === dateId);
        if (!group) { showToast('❌ Date entry not found', 'error'); return; }
        group.rows.push(createEmptyRow());
        render();
        scheduleCloudSync();
    }

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

        if (data.some(d => d.date === dateInput)) {
            alert('❌ This date already exists!');
            return;
        }

        const newGroup = {
            id: nextDateId++,
            date: dateInput,
            rows: [createEmptyRow()]
        };

        data.push(newGroup);
        data = sortDataByDate(data);
        render();
        scheduleCloudSync();
        showToast('✅ Date added successfully!', 'success');
    }

    function handleDeleteRow(e) {
        if (!userCanEdit()) {
            showToast('⚠️ Only admin can delete rows', 'error');
            return;
        }
        const dateId = parseInt(e.currentTarget.dataset.dateId);
        const rowId  = parseInt(e.currentTarget.dataset.rowId);

        if (!confirm('⚠️ Delete this transaction? This will also delete it from the cloud.')) return;

        const group = data.find(d => d.id === dateId);
        if (!group) return;

        const key = dateId + '_' + rowId;
        if (transactionFees[key]) delete transactionFees[key];
        recalculateTotalFees();
        updateTransactionFeesDisplay();
        updateDateFeesDisplays();

        group.rows = group.rows.filter(r => r.id !== rowId);
        render();
        saveToStorage();
        scheduleCloudSync();
        showToast('✅ Transaction deleted', 'success');
    }

    function handleDeleteDate(e) {
        if (!userCanEdit()) {
            showToast('⚠️ Only admin can delete dates', 'error');
            return;
        }
        const dateId = parseInt(e.currentTarget.dataset.dateId);

        if (!confirm('⚠️ Delete this entire date entry and all its transactions?')) return;

        const keysToRemove = [];
        for (let key in transactionFees) {
            if (key.startsWith(dateId + '_')) keysToRemove.push(key);
        }
        keysToRemove.forEach(k => delete transactionFees[k]);

        data = data.filter(d => d.id !== dateId);
        delete savedDates[dateId];
        delete editModes[dateId];

        recalculateTotalFees();
        updateTransactionFeesDisplay();

        render();
        saveToStorage();
        scheduleCloudSync();
        showToast('✅ Date entry deleted', 'success');
    }

    // ========================================
    // INPUT HANDLING
    // ========================================
    let saveTimeout = null;
    function debouncedSave() {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(saveToStorage, 500);
    }

    function handleInputChange(e) {
        if (!userCanEdit()) {
            showToast('⚠️ Only admin can edit records', 'error');
            return;
        }

        const input  = e.target;
        const dateId = parseInt(input.dataset.dateId);
        const rowId  = parseInt(input.dataset.rowId);
        const key    = input.dataset.key;
        const value  = input.value;

        const group = data.find(d => d.id === dateId);
        if (!group) return;
        const row = group.rows.find(r => r.id === rowId);
        if (!row) return;

        row[key] = value;

        if (key.endsWith('_transaction')) {
            input.title = value;

            // LIVE CROSS-DATE DUPLICATE WARNING
            const codeMatch = value.trim().match(/^([A-Z0-9]{8,15})\b/);
            if (codeMatch && !/^TRANSACTION/i.test(codeMatch[1])) {
                const conflictDate = isCodeUsedElsewhere(codeMatch[1], dateId);
                if (conflictDate) {
                    input.classList.add('duplicate-input-warning');
                    input.title = `⚠️ This code already exists on ${conflictDate}`;
                    if (!input._dupWarned) {
                        input._dupWarned = true;
                        showToast(`⚠️ ${codeMatch[1]} already used on ${conflictDate}`, 'error');
                        setTimeout(() => { input._dupWarned = false; }, 4000);
                    }
                } else {
                    input.classList.remove('duplicate-input-warning');
                }
            } else {
                input.classList.remove('duplicate-input-warning');
            }

            const amountKey = key.replace('_transaction', '_amount');
            if (!value || value.trim() === '') {
                row[amountKey] = '';
                row._pendingFee = null;
            } else if (value.length > 5) {
                const parsed = parseMpesaMessage(value);
                if (parsed) {
                    if (parsed.amount !== null && parsed.amount > 0) {
                        row[amountKey] = parsed.amount.toString();
                        showToast('💰 Amount extracted: KSh ' + parsed.amount.toFixed(2), 'success');
                    } else {
                        row[amountKey] = '';
                    }
                    // Sum all fees in this row across all columns
                    let combinedFee = 0;
                    getAllColumns().forEach(c => {
                        const tv = row[c.key + '_transaction'];
                        if (tv && tv.trim() !== '') {
                            const p = parseMpesaMessage(tv);
                            if (p && p.transactionCost !== null && p.transactionCost > 0) {
                                combinedFee += p.transactionCost;
                            }
                        }
                    });
                    if (combinedFee > 0) {
                        row._pendingFee = round2(combinedFee);
                        showToast('💳 Row fee: KSh ' + row._pendingFee.toFixed(2), 'info');
                    } else {
                        row._pendingFee = null;
                    }
                } else {
                    row[amountKey] = '';
                    row._pendingFee = null;
                }
            } else {
                row[amountKey] = '';
                row._pendingFee = null;
            }
        }

        updateTotalsOnly();
        updateSummaryDisplay();
        updateDateFeesDisplays();
        debouncedSave();

        if (key.includes('_amount')) scheduleCloudSync();
    }

    function updateTotalsOnly() {
        const filtered   = getFilteredData();
        const allColumns = getAllColumns();

        const grandTotal = computeGrandTotal(filtered);
        if (grandTotalEl) grandTotalEl.textContent = grandTotal.toFixed(2);

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
                    const cellIdx = colIndex + 1;
                    if (colTotalCells[cellIdx]) {
                        colTotalCells[cellIdx].textContent = (colTotals[col.key] || 0).toFixed(2);
                    }
                    colIndex++;
                }
            });
            const totalColSum = Object.values(colTotals).reduce((a, b) => a + b, 0);
            const lastCell = colTotalCells[colTotalCells.length - 1];
            if (lastCell) lastCell.textContent = totalColSum.toFixed(2);
        }

        recalculateTotalFees();
        updateTransactionFeesDisplay();
        updateDateFeesDisplays();
    }

    // ========================================
    // CLOUD SYNC SCHEDULER
    // ========================================
    let cloudSyncTimer = null;
    function scheduleCloudSync() {
        if (!SYNC_ENABLED || !supabaseClient) return;
        clearTimeout(cloudSyncTimer);
        cloudSyncTimer = setTimeout(() => {
            data = sortDataByDate(data);
            syncToCloud(false);
        }, 1200);
    }

    // ========================================
    // SEARCH
    // ========================================
    function setupSearchFunctionality() {
        const searchInput = document.getElementById('searchInput');
        const clearSearchBtn = document.getElementById('clearSearchBtn');
        if (!searchInput || searchInput._searchInitialized) return;
        searchInput._searchInitialized = true;

        let timer = null;
        searchInput.addEventListener('input', function() {
            clearTimeout(timer);
            timer = setTimeout(() => performSearch(this.value.trim()), 250);
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

    function performSearch(query) {
        const clearSearchBtn = document.getElementById('clearSearchBtn');
        const info = document.getElementById('searchResultInfo');

        document.querySelectorAll('tr.row-highlight').forEach(el => el.classList.remove('row-highlight'));
        document.querySelectorAll('td.cell-highlight').forEach(el => el.classList.remove('cell-highlight'));

        if (clearSearchBtn) clearSearchBtn.style.display = query ? 'inline-block' : 'none';

        if (!query) {
            if (info) { info.style.display = 'none'; info.textContent = ''; }
            return;
        }

        const q = query.toUpperCase();
        let matchCount = 0;
        let firstMatch = null;

        document.querySelectorAll('.trans-input, .desc-display[data-type="transaction"]').forEach(el => {
            const text = (el.value || el.textContent || el.dataset.fullText || '').toUpperCase();
            if (text.includes(q)) {
                matchCount++;
                const row = el.closest('tr');
                if (row && !row.classList.contains('row-highlight')) {
                    row.classList.add('row-highlight');
                    if (!firstMatch) firstMatch = row;
                }
                const cell = el.closest('td');
                if (cell) cell.classList.add('cell-highlight');
            }
        });

        if (info) {
            if (matchCount > 0) {
                info.textContent = `Found ${matchCount} match${matchCount > 1 ? 'es' : ''}`;
                info.classList.remove('no-result');
                info.style.display = 'inline-block';
            } else {
                info.textContent = 'No matches found';
                info.classList.add('no-result');
                info.style.display = 'inline-block';
            }
        }

        if (firstMatch) firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // ========================================
    // READ MORE MODAL
    // ========================================
    function openReadMoreModal(text) {
        if (!modal || !modalBody) return;
        modalBody.innerHTML = `<p class="modal-text">${escapeHtml(text)}</p>`;
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    function closeReadMoreModal() {
        if (!modal) return;
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }

    // ========================================
    // RENDER
    // ========================================
    function render() {
        const filtered   = getFilteredData();
        const allColumns = getAllColumns();
        const canEdit    = userCanEdit();

        let html = '<table><tbody>';

        if (filtered.length === 0) {
            html += `<tr><td colspan="${allColumns.length + 3}" class="empty-state">
                <span class="icon">📭</span>
                <div style="color:var(--text-primary);">No records found</div>
                <div style="font-size:0.85rem; margin-top:8px; color:var(--text-dim);">Adjust your date filter or add new entries</div>
            </td></tr>`;
        } else {
            filtered.forEach(group => {
                const isSaved   = savedDates[group.id] || false;
                const isEditing = editModes[group.id] || false;
                const showEditMode = isEditing || !isSaved;

                html += `<tr class="date-header-row"><td colspan="${allColumns.length + 3}" style="padding:8px 16px;">`;
                html += `<div class="date-label">
                    <span class="date-badge">📅 ${escapeHtml(group.date || 'No date')}</span>
                    ${canEdit ? `<button class="add-col-btn-header" title="Add a new custom expenditure column">➕ Add Expenditure</button>` : ''}
                </div>`;
                html += `</td></tr>`;

                html += `<tr class="date-column-header">`;
                html += `<td style="min-width:80px; font-weight:700; color:var(--accent-gold); text-align:center; font-size:0.7rem; text-transform:uppercase; letter-spacing:0.5px; background:var(--bg-elev-2);"></td>`;
                allColumns.forEach(col => {
                    const isCustom   = col.isCustom || false;
                    const isSavedCol = col.isSaved || false;
                    const colLabel   = getColumnLabel(col);

                    html += `<td style="min-width:120px; text-align:center; background:var(--bg-elev-2); ${isCustom ? 'background: rgba(167,139,250,0.05);' : ''}" data-col-key="${col.key}">
                        <div class="col-header-with-edit">
                            <span class="col-label" data-col-key="${col.key}" data-label="${escapeHtml(colLabel)}">${escapeHtml(colLabel)}</span>
                            ${isCustom ? `<span style="font-weight:400; font-size:0.55rem; color:#a78bfa;">${isSavedCol ? '(saved)' : '(temp)'}</span>` : ''}
                            ${canEdit ? `<div class="col-edit-actions">
                                <button class="edit-name-btn" data-col-key="${col.key}" title="Edit column name">✏️</button>
                                ${isCustom ? `<button class="remove-col-btn" data-col-key="${col.key}" title="Delete this column">🗑️</button>` : ''}
                            </div>` : ''}
                        </div>
                    </td>`;
                });
                html += `<td style="min-width:70px; text-align:center; font-weight:700; color:var(--accent-gold); background:var(--bg-elev-2);">TOTAL</td>`;
                html += `<td style="min-width:40px; background:var(--bg-elev-2);"></td>`;
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
                            const isCustom   = col.isCustom || false;
                            const isSavedCol = col.isSaved || false;
                            const descKey    = col.key + '_desc';
                            const transKey   = col.key + '_transaction';
                            const amountKey  = col.key + '_amount';
                            const colLabel   = getColumnLabel(col);

                            const descVal    = row[descKey]   || '';
                            const transVal   = row[transKey]  || '';
                            const amountVal  = row[amountKey] || '';

                            let descDisplay = '';
                            if (showEditMode && canEdit) {
                                descDisplay = `<textarea class="desc-input" data-date-id="${group.id}" data-row-id="${row.id}" data-key="${descKey}" placeholder="Description" rows="1">${escapeHtml(descVal)}</textarea>`;
                            } else {
                                const truncated = truncateText(descVal, 3);
                                if (truncated.needsReadMore) {
                                    descDisplay = `<div class="desc-display" data-full-text="${escapeHtml(descVal)}">
                                        <span class="short-text">${escapeHtml(truncated.short)}</span>
                                        <button class="read-more-btn" data-full-text="${escapeHtml(descVal)}">readmore</button>
                                    </div>`;
                                } else {
                                    descDisplay = `<div class="desc-display" data-full-text="${escapeHtml(descVal)}">${escapeHtml(descVal) || '-'}</div>`;
                                }
                            }

                            html += `<td class="expenditure-cell" style="padding:2px 3px; ${isCustom ? 'background: rgba(167,139,250,0.05);' : ''}" data-label="${escapeHtml(colLabel)}">
                                <div class="column-group ${isCustom ? 'custom-column' : ''}">
                                    <span class="field-header">Description</span>
                                    ${descDisplay}
                                    <span class="field-header">Transaction Reference</span>
                                    ${showEditMode && canEdit
                                        ? `<textarea class="trans-input" data-date-id="${group.id}" data-row-id="${row.id}" data-key="${transKey}" placeholder="Transaction Reference" rows="1" title="${escapeHtml(transVal)}">${escapeHtml(transVal)}</textarea>`
                                        : `<div class="desc-display" data-full-text="${escapeHtml(transVal)}" data-type="transaction" title="${escapeHtml(transVal)}">${escapeHtml(transVal) || '-'}</div>`}
                                    <span class="field-header">Amount</span>
                                    ${showEditMode && canEdit
                                        ? `<input type="text" class="amount-input" data-date-id="${group.id}" data-row-id="${row.id}" data-key="${amountKey}" value="${escapeHtml(amountVal)}" placeholder="0">`
                                        : `<div class="amount-display">${formatNumber(amountVal).toFixed(2)}</div>`}
                                    ${isCustom && canEdit && !isSavedCol
                                        ? `<div style="display:flex; gap:4px; margin-top:4px; flex-wrap:wrap;">
                                            <button class="save-col-btn" data-col-key="${col.key}" title="Save this column permanently">💾 Save</button>
                                        </div>`
                                        : ''}
                                </div>
                            </td>`;
                        });

                        html += `<td class="row-total-col" data-label="Total">${getRowTotal(row).toFixed(2)}</td>`;
                        html += `<td>${canEdit ? `<button class="delete-row-btn" data-date-id="${group.id}" data-row-id="${row.id}" title="Delete this transaction">🗑️ Delete</button>` : ''}</td>`;
                        html += `</tr>`;
                    });
                }

                const dateTotal = getDateGroupTotal(group);
                const dateFeesTotal = getDateFeesTotal(group);
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
                        <div class="date-total-fees-block">
                            <span class="date-total-label"><i class="bi bi-credit-card-2-front"></i> Date Fees:</span>
                            <span class="date-total-fees-amount" data-date-fees-id="${group.id}">${dateFeesTotal.toFixed(2)}</span>
                        </div>
                        <div class="date-total-amount-block">
                            <span class="date-total-label">Date Total Amount:</span>
                            <span class="date-total-amount">${dateTotal.toFixed(2)}</span>
                        </div>
                        ${canEdit ? `<div class="date-total-add-row">
                            <button class="add-row-inline-btn" data-date-id="${group.id}">➕ Add Row</button>
                        </div>` : ''}
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
                html += `<td class="column-total-cell" data-label="${escapeHtml(colLabel)}" style="color:var(--text-primary);">${(colTotals[col.key] || 0).toFixed(2)}</td>`;
            } else {
                html += `<td class="column-total-cell" data-label="${escapeHtml(colLabel)}" style="color:var(--text-primary);">0.00</td>`;
            }
        });
        const totalColSum = Object.values(colTotals).reduce((a, b) => a + b, 0);
        html += `<td class="column-total-cell grand-column-total" data-label="Total" style="font-weight:700; color:var(--accent-primary);">${totalColSum.toFixed(2)}</td>`;
        html += `<td></td>`;
        html += `</tr>`;
        html += '</tfoot></tbody></table>';

        wrapper.innerHTML = html;

        if (grandTotalEl) {
            grandTotalEl.textContent = computeGrandTotal(filtered).toFixed(2);
        }

        document.querySelectorAll('.desc-input, .trans-input, .amount-input').forEach(input => {
            input.addEventListener('input', handleInputChange);
        });

        document.querySelectorAll('.desc-input, .trans-input').forEach(textarea => {
            textarea.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = this.scrollHeight + 'px';
                if (this.classList.contains('trans-input')) this.title = this.value;
            });
            setTimeout(() => {
                textarea.style.height = 'auto';
                textarea.style.height = textarea.scrollHeight + 'px';
            }, 10);
        });

        document.querySelectorAll('.read-more-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                openReadMoreModal(this.dataset.fullText || '');
            });
        });

        document.querySelectorAll('.desc-display').forEach(el => {
            el.addEventListener('click', function() {
                const t = this.dataset.fullText || '';
                if (t && t !== '-') openReadMoreModal(t);
            });
        });

        document.querySelectorAll('.delete-row-btn').forEach(btn => {
            btn.addEventListener('click', handleDeleteRow);
        });

        document.querySelectorAll('.date-total-row .save-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                saveDateEntry(parseInt(e.currentTarget.dataset.dateId));
            });
        });

        document.querySelectorAll('.date-total-row .edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                editDateEntry(parseInt(e.currentTarget.dataset.dateId));
            });
        });

        document.querySelectorAll('.date-total-row .delete-date-btn').forEach(btn => {
            btn.addEventListener('click', handleDeleteDate);
        });

        document.querySelectorAll('.date-total-row .add-row-inline-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                addTransactionRow(parseInt(e.currentTarget.dataset.dateId));
            });
        });

        document.querySelectorAll('.add-col-btn-header').forEach(btn => {
            btn.addEventListener('click', addCustomColumn);
        });

        document.querySelectorAll('.save-col-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                saveCustomColumn(e.currentTarget.dataset.colKey);
            });
        });

        document.querySelectorAll('.remove-col-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeCustomColumn(e.currentTarget.dataset.colKey);
            });
        });

        setupColumnNameEditListeners();

        setTimeout(() => {
            updateTotalsOnly();
            updateSummaryDisplay();
            updateDateFeesDisplays();
        }, 50);

        const searchInput = document.getElementById('searchInput');
        if (searchInput && searchInput.value.trim()) {
            setTimeout(() => performSearch(searchInput.value.trim()), 60);
        }
    }

    function setupColumnNameEditListeners() {
        document.querySelectorAll('.edit-name-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                editColumnName(this.dataset.colKey);
            });
        });
    }

    // ========================================
    // FILTERS
    // ========================================
    function applyDateFilter() {
        dateFrom = dateFromInput.value || '';
        dateTo   = dateToInput.value || '';
        render();
    }

    function clearDateFilter() {
        dateFromInput.value = '';
        dateToInput.value = '';
        dateFrom = '';
        dateTo = '';
        render();
    }

    // ========================================
    // PRINT / PDF EXPORT
    // ========================================
    function exportPdf() {
        const filtered   = getFilteredData();
        const allColumns = getAllColumns();
        const summary    = buildSummary();

        let filterInfo = '';
        if (dateFrom && dateTo) filterInfo = ` (${dateFrom} to ${dateTo})`;
        else if (dateFrom) filterInfo = ` (from ${dateFrom})`;
        else if (dateTo) filterInfo = ` (up to ${dateTo})`;

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
            th { background: #e8e0d4; padding: 10px 8px; border: 1px solid #b8b0a4; text-align: center; font-weight: 700; font-size: 10px; text-transform: uppercase; }
            td { padding: 6px 8px; border: 1px solid #c8c0b4; text-align: center; vertical-align: middle; }
            .date-header { background: #f0ece4; font-weight: 700; }
            .date-header td { padding: 10px 16px; text-align: left; font-size: 13px; }
            .desc-row td { background: #f8f6f0; }
            .desc-row td:first-child { font-weight: 700; font-size: 10px; color: #0a2a44; text-align: right; padding-right: 15px; }
            .trans-row td { background: #f5f3ec; }
            .trans-row td:first-child { font-weight: 700; font-size: 10px; color: #0a2a44; text-align: right; padding-right: 15px; }
            .amount-row td { background: #efece4; }
            .amount-row td:first-child { font-weight: 700; font-size: 10px; color: #0a2a44; text-align: right; padding-right: 15px; }
            .col-total { background: #e8e0d4; font-weight: 700; }
            .grand-total { background: #0a2a44; color: #ffffff; font-weight: 800; }
            .grand-total td { padding: 12px 8px; font-size: 14px; }
            .separator td { border-bottom: 2px dashed #c8c0b4; }
            .footer { margin-top: 30px; color: #6b6860; font-size: 12px; text-align: center; border-top: 1px solid #e0d8cc; padding-top: 15px; }
        </style>
        </head>
        <body>
        <h1>📡 STARLINK · GENERAL CONNECTION EXPENDITURE</h1>
        <div class="subtitle">Expenditure Report</div>
        <div class="filter-info"><strong>Date Range:</strong> ${escapeHtml(filterInfo || 'All records')}</div>
        `;

        if (filtered.length === 0) {
            printHtml += `<div style="text-align:center; padding:40px; color:#6b6860;">📭 No expenditure records found.</div>`;
        } else {
            printHtml += `<table>`;
            printHtml += `<tr><th>DATE</th>`;
            allColumns.forEach(col => printHtml += `<th>${escapeHtml(getColumnLabel(col))}</th>`);
            printHtml += `<th>TOTAL</th></tr>`;

            filtered.forEach(group => {
                printHtml += `<tr class="date-header"><td colspan="${allColumns.length + 2}">📅 ${escapeHtml(group.date)}</td></tr>`;

                if (group.rows.length === 0) {
                    printHtml += `<tr><td colspan="${allColumns.length + 2}" style="text-align:center;">No transactions</td></tr>`;
                } else {
                    group.rows.forEach((row, index) => {
                        if (index > 0) printHtml += `<tr class="separator"><td colspan="${allColumns.length + 2}"></td></tr>`;

                        printHtml += `<tr class="desc-row"><td>DESCRIPTION</td>`;
                        allColumns.forEach(col => printHtml += `<td style="text-align:left;">${escapeHtml(row[col.key + '_desc'] || '-')}</td>`);
                        printHtml += `<td style="font-weight:700;">${getRowTotal(row).toFixed(2)}</td></tr>`;

                        printHtml += `<tr class="trans-row"><td>TRANSACTION</td>`;
                        allColumns.forEach(col => printHtml += `<td style="text-align:left;">${escapeHtml(row[col.key + '_transaction'] || '-')}</td>`);
                        printHtml += `<td></td></tr>`;

                        printHtml += `<tr class="amount-row"><td>AMOUNT</td>`;
                        allColumns.forEach(col => printHtml += `<td style="text-align:right; font-weight:700;">${formatNumber(row[col.key + '_amount']).toFixed(2)}</td>`);
                        printHtml += `<td style="font-weight:700;">${getRowTotal(row).toFixed(2)}</td></tr>`;
                    });
                }

                const dateTotal = getDateGroupTotal(group);
                const dateFees = getDateFeesTotal(group);
                printHtml += `<tr style="background:#f0ece4; font-weight:700;">
                    <td colspan="${allColumns.length}" style="text-align:right; padding-right:20px;">Date Total:</td>
                    <td style="text-align:right; color:#b45309;">Fees: ${dateFees.toFixed(2)}</td>
                    <td>${dateTotal.toFixed(2)}</td>
                </tr>`;
            });

            const colTotals = computeColumnTotals(filtered);
            printHtml += `<tr class="col-total"><td>COLUMN TOTALS</td>`;
            allColumns.forEach(col => {
                if (isNumericColumn(col.key)) {
                    printHtml += `<td>${(colTotals[col.key] || 0).toFixed(2)}</td>`;
                } else {
                    printHtml += `<td>0.00</td>`;
                }
            });
            const totalColSum = Object.values(colTotals).reduce((a, b) => a + b, 0);
            printHtml += `<td style="font-weight:700;">${totalColSum.toFixed(2)}</td></tr>`;

            const grandTotal = computeGrandTotal(filtered);
            printHtml += `<tr class="grand-total"><td colspan="${allColumns.length + 1}" style="text-align:right; padding-right:20px;">GRAND TOTAL</td><td>${grandTotal.toFixed(2)}</td></tr>`;
            printHtml += `</table>`;
        }

        printHtml += `
        <div style="margin-top: 30px; border-top: 2px solid #c89a5b; padding-top: 20px;">
            <h2 style="color: #0a2a44; font-size: 18px;">📊 INVESTMENT SUMMARY</h2>
            <table style="width: 100%; font-size: 13px;">
                <tr><td style="text-align:left;">STARLINK VIRTUAL INVESTMENT</td><td style="text-align:right; font-weight:700;">KSh ${summary.starlinkVirtualInvestment.toFixed(2)}</td></tr>
                <tr><td style="text-align:left;">STARLINK INVESTMENT TOTAL</td><td style="text-align:right; font-weight:700;">KSh ${summary.starlinkInvestmentTotal.toFixed(2)}</td></tr>
                <tr><td style="text-align:left;">COMMON EXPENDITURE TOTAL</td><td style="text-align:right; font-weight:700;">KSh ${summary.commonExpenditureTotal.toFixed(2)}</td></tr>
                <tr><td style="text-align:left;">ROUTERS TOTAL</td><td style="text-align:right; font-weight:700;">KSh ${summary.routersTotal.toFixed(2)}</td></tr>
                <tr><td style="text-align:left;">KAIRO ROUTERS TOTAL</td><td style="text-align:right; font-weight:700;">KSh ${summary.kairoRoutersTotal.toFixed(2)}</td></tr>
                <tr><td style="text-align:left;">TRANSACTION FEES</td><td style="text-align:right; font-weight:700;">KSh ${summary.totalTransactionFees.toFixed(2)}</td></tr>
            </table>
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
    // STORAGE
    // ========================================
    function saveToStorage() {
        try {
            data = sortDataByDate(data);
            const store = {
                data, nextDateId, nextRowId, nextColId,
                customColumns, savedCustomColumns, savedDates, editModes,
                dateFrom, dateTo,
                columnNameEdits, transactionFees, totalTransactionFees
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
        } catch (e) {}
    }

    function loadFromStorage() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return false;
            const store = JSON.parse(raw);
            if (store.data && Array.isArray(store.data)) {
                data = sortDataByDate(store.data);
                nextDateId = store.nextDateId || 1;
                nextRowId  = store.nextRowId  || 1;
                nextColId  = store.nextColId  || 1;
                customColumns      = store.customColumns      || [];
                savedCustomColumns = store.savedCustomColumns || [];
                savedDates = store.savedDates || {};
                editModes  = store.editModes  || {};
                dateFrom   = store.dateFrom || '';
                dateTo     = store.dateTo   || '';

                if (store.columnNameEdits) {
                    columnNameEdits = store.columnNameEdits;
                    saveColumnNameEdits();
                }
                // NOTE: We intentionally ignore store.transactionFees —
                // rebuildFeesFromData() will recompute it fresh from live transaction codes.
                if (dateFrom && dateFromInput) dateFromInput.value = dateFrom;
                if (dateTo && dateToInput)     dateToInput.value   = dateTo;
                return true;
            }
        } catch (e) {}
        return false;
    }

    // ========================================
    // MAIN APP INIT (guarded)
    // ========================================
    let mainAppInitialized = false;

    function initMainApp() {
        if (mainAppInitialized) {
            // Auto-heal fees every time we come back
            rebuildFeesFromData();
            render();
            updateSummaryDisplay();
            updateTransactionFeesDisplay();
            updateDateFeesDisplays();
            return;
        }
        mainAppInitialized = true;

        initSupabase();

        applyTheme(getStoredTheme());
        if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

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
            data = [{
                id: nextDateId++,
                date: new Date().toISOString().split('T')[0],
                rows: [createEmptyRow()]
            }];
        }

        // 🔄 AUTO-HEAL: Always rebuild fees from live transaction codes on load
        rebuildFeesFromData();
        data = sortDataByDate(data);
        render();

        createTransactionFeesDisplay();
        createSummaryDisplay();
        setupSearchFunctionality();

        if (SYNC_ENABLED) {
            setTimeout(() => {
                syncFromCloud(true).then(() => {
                    // After pulling from cloud, rebuild fees again (auto-heal)
                    rebuildFeesFromData();
                    render();
                    setTimeout(() => {
                        updateTotalsOnly();
                        updateSummaryDisplay();
                        updateDateFeesDisplays();
                    }, 200);
                });
            }, 1000);
        }

        if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeReadMoreModal);
        if (modal) {
            modal.addEventListener('click', function(e) {
                if (e.target === modal) closeReadMoreModal();
            });
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') closeReadMoreModal();
            });
        }

        if (applyFilterBtn) applyFilterBtn.addEventListener('click', applyDateFilter);
        if (clearFilterBtn) clearFilterBtn.addEventListener('click', clearDateFilter);
        if (printBtn)       printBtn.addEventListener('click', exportPdf);
        if (addDateBtn)     addDateBtn.addEventListener('click', addDateEntry);

        if (syncNowBtn) {
            syncNowBtn.addEventListener('click', function() {
                // Auto-heal before pushing
                rebuildFeesFromData();
                syncToCloud(true);
            });
        }

        if (addRowBtn) {
            addRowBtn.addEventListener('click', () => {
                if (data.length === 0) {
                    alert('Please add a date entry first');
                    return;
                }
                addTransactionRow(data[data.length - 1].id);
            });
        }

        window.addEventListener('beforeunload', function() {
            clearTimeout(saveTimeout);
            clearTimeout(cloudSyncTimer);
            saveToStorage();
        });
    }

    // ========================================
    // BOOTSTRAP
    // ========================================
    function initializeApp() {
        try {
            const savedUser = sessionStorage.getItem(KEY_USER_SESSION);
            let loggedIn = false;

            if (savedUser) {
                try {
                    currentUser = JSON.parse(savedUser);
                    const users = getUsers();
                    const exists = users.find(u => u.id === currentUser.id);
                    if (exists) {
                        showMainApp();
                        loggedIn = true;
                    }
                } catch (e) {}
            }

            if (!loggedIn) {
                loginScreen.style.display = 'flex';
                mainApp.style.display = 'none';
                if (usernameInput) usernameInput.focus();
            }

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

            if (forgotPasswordBtn) forgotPasswordBtn.addEventListener('click', (e) => { e.preventDefault(); showForgotScreen(); });
            if (backToLoginBtn)    backToLoginBtn.addEventListener('click', (e) => { e.preventDefault(); showLoginScreen(); });

            const forgotSubmitBtn = document.getElementById('forgotSubmitBtn');
            if (forgotSubmitBtn) forgotSubmitBtn.addEventListener('click', (e) => { e.preventDefault(); handleForgotPassword(); });

            const forgotUsername = document.getElementById('forgotUsername');
            if (forgotUsername) {
                forgotUsername.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        handleForgotPassword();
                    }
                });
            }

            if (changePasswordBtn)     changePasswordBtn.addEventListener('click', (e) => { e.preventDefault(); showChangePasswordScreen(); });
            if (changePasswordBackBtn) changePasswordBackBtn.addEventListener('click', (e) => { e.preventDefault(); showLoginScreen(); });
            if (changePasswordSaveBtn) changePasswordSaveBtn.addEventListener('click', (e) => { e.preventDefault(); handleChangePassword(); });

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

            if (logoutBtn)          logoutBtn.addEventListener('click', (e) => { e.preventDefault(); logout(); });
            if (adminPanelBtn)      adminPanelBtn.addEventListener('click', (e) => { e.preventDefault(); openAdminPanel(); });
            if (adminPanelClose)    adminPanelClose.addEventListener('click', (e) => { e.preventDefault(); closeAdminPanel(); });
            if (adminPanelCloseBtn) adminPanelCloseBtn.addEventListener('click', (e) => { e.preventDefault(); closeAdminPanel(); });
            if (addUserBtn)         addUserBtn.addEventListener('click', (e) => { e.preventDefault(); openUserModal(null); });
            if (userModalSave)      userModalSave.addEventListener('click', (e) => { e.preventDefault(); saveUser(); });
            if (userModalCancel)    userModalCancel.addEventListener('click', (e) => { e.preventDefault(); closeUserModal(); });
            if (userModalClose)     userModalClose.addEventListener('click', (e) => { e.preventDefault(); closeUserModal(); });

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

            document.querySelectorAll('.modal').forEach(m => {
                m.addEventListener('click', function(e) {
                    if (e.target === this) {
                        if (this.id === 'userModal') closeUserModal();
                        else if (this.id === 'adminPanel') closeAdminPanel();
                    }
                });
            });

        } catch (error) {
            console.error('❌ Init error:', error);
        }
    }

    function init() {
        const savedUser = sessionStorage.getItem(KEY_USER_SESSION);
        if (savedUser) {
            try {
                const user = JSON.parse(savedUser);
                const users = getUsers();
                const exists = users.find(u => u.id === user.id);
                if (exists) {
                    currentUser = user;
                    showMainApp();
                    return;
                }
            } catch (e) {}
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeApp);
        } else {
            initializeApp();
        }
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(init, 100);
    } else {
        document.addEventListener('DOMContentLoaded', () => setTimeout(init, 100));
    }

})();


/* ================================================================
   PHASE 2 — CINEMATIC ANIMATION ENHANCERS
   Number roll-up removed. Cursor glow, particles, magnetic buttons,
   ripple, tilt card, confetti, marquee preserved.
   ================================================================ */
(function phase2Animations() {
    'use strict';

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isTouchDevice = window.matchMedia('(hover: none)').matches || window.innerWidth <= 768;

    /* ---------- 1. CURSOR GLOW ---------- */
    const cursorGlow = document.getElementById('cursorGlow');
    if (cursorGlow && !isTouchDevice && !prefersReducedMotion) {
        let mx = 0, my = 0, cx = 0, cy = 0;
        document.addEventListener('mousemove', (e) => {
            mx = e.clientX;
            my = e.clientY;
            cursorGlow.classList.add('active');
        });
        document.addEventListener('mouseleave', () => cursorGlow.classList.remove('active'));

        function animateCursor() {
            cx += (mx - cx) * 0.12;
            cy += (my - cy) * 0.12;
            cursorGlow.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
            requestAnimationFrame(animateCursor);
        }
        animateCursor();
    }

    /* ---------- 2. PARTICLE FIELD ---------- */
    const particleCanvas = document.getElementById('particleCanvas');
    if (particleCanvas && !prefersReducedMotion) {
        const ctx = particleCanvas.getContext('2d');
        let particles = [];
        const PARTICLE_COUNT = isTouchDevice ? 25 : 55;

        function resizeParticleCanvas() {
            particleCanvas.width = window.innerWidth;
            particleCanvas.height = window.innerHeight;
        }
        resizeParticleCanvas();
        window.addEventListener('resize', resizeParticleCanvas);

        const COLORS = ['56, 189, 248', '167, 139, 250', '244, 114, 182', '251, 191, 36'];

        class Particle {
            constructor() { this.reset(true); }
            reset(initial) {
                this.x = Math.random() * particleCanvas.width;
                this.y = initial ? Math.random() * particleCanvas.height : particleCanvas.height + 10;
                this.size = Math.random() * 1.8 + 0.4;
                this.speedY = -(Math.random() * 0.35 + 0.1);
                this.speedX = (Math.random() - 0.5) * 0.25;
                this.opacity = Math.random() * 0.5 + 0.15;
                this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
                this.pulseSpeed = Math.random() * 0.02 + 0.005;
                this.pulsePhase = Math.random() * Math.PI * 2;
            }
            update() {
                this.y += this.speedY;
                this.x += this.speedX;
                this.pulsePhase += this.pulseSpeed;
                if (this.y < -10 || this.x < -10 || this.x > particleCanvas.width + 10) {
                    this.reset(false);
                }
            }
            draw() {
                const pulse = (Math.sin(this.pulsePhase) + 1) * 0.5;
                const alpha = this.opacity * (0.6 + pulse * 0.4);
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${this.color}, ${alpha})`;
                ctx.shadowBlur = 12;
                ctx.shadowColor = `rgba(${this.color}, 0.6)`;
                ctx.fill();
            }
        }

        for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(new Particle());

        function animateParticles() {
            ctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
            particles.forEach(p => { p.update(); p.draw(); });
            requestAnimationFrame(animateParticles);
        }
        animateParticles();
    }

    /* ---------- 3. MAGNETIC BUTTONS ---------- */
    function attachMagnetic(btn) {
        if (!btn || btn._magneticAttached || isTouchDevice || prefersReducedMotion) return;
        if (btn.id === 'loginBtn' || btn.id === 'forgotSubmitBtn' || btn.id === 'changePasswordSaveBtn') return;
        btn._magneticAttached = true;

        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const cx = rect.width / 2;
            const cy = rect.height / 2;
            const dx = (x - cx) / cx;
            const dy = (y - cy) / cy;
            const strength = 6;

            btn.style.setProperty('--x', `${(x / rect.width) * 100}%`);
            btn.style.setProperty('--y', `${(y / rect.height) * 100}%`);
            btn.style.transform = `translate(${dx * strength}px, ${dy * strength - 2}px)`;
        });

        btn.addEventListener('mouseleave', () => {
            btn.style.transform = '';
        });
    }

    function attachMagneticToAll() {
        document.querySelectorAll('.magnetic-btn, .btn').forEach(attachMagnetic);
    }

    /* ---------- 4. BUTTON RIPPLE ---------- */
    function attachRipple(btn) {
        if (!btn || btn._rippleAttached) return;
        btn._rippleAttached = true;

        btn.addEventListener('click', function (e) {
            const ripple = this.querySelector('.btn-ripple');
            if (!ripple) return;
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            ripple.style.width = ripple.style.height = `${size}px`;
            ripple.style.left = `${x}px`;
            ripple.style.top = `${y}px`;
            this.classList.remove('rippling');
            void this.offsetWidth;
            this.classList.add('rippling');
            setTimeout(() => this.classList.remove('rippling'), 900);
        });
    }

    function attachRippleToAll() {
        document.querySelectorAll('.btn-add, .btn-filter, .btn-pdf, .btn-sync, .btn-admin, .btn-logout, .btn-theme, .btn-add-secondary').forEach(attachRipple);
    }

    /* ---------- 5. TILT CARD ---------- */
    function attachTilt(card) {
        if (!card || card._tiltAttached || isTouchDevice || prefersReducedMotion) return;
        card._tiltAttached = true;

        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width - 0.5;
            const y = (e.clientY - rect.top) / rect.height - 0.5;
            const maxTilt = 3;
            card.style.transform = `perspective(1400px) rotateY(${x * maxTilt}deg) rotateX(${-y * maxTilt}deg)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
        });
    }

    function attachTiltToAll() {
        document.querySelectorAll('.tilt-card').forEach(attachTilt);
    }

    /* ---------- 6. CONFETTI ---------- */
    const confettiCanvas = document.getElementById('confettiCanvas');
    let confettiCtx = null;
    let confettiParticles = [];
    let confettiAnimationId = null;

    function initConfetti() {
        if (!confettiCanvas || prefersReducedMotion) return;
        confettiCanvas.width = window.innerWidth;
        confettiCanvas.height = window.innerHeight;
        confettiCtx = confettiCanvas.getContext('2d');
    }
    initConfetti();
    window.addEventListener('resize', () => {
        if (confettiCanvas) {
            confettiCanvas.width = window.innerWidth;
            confettiCanvas.height = window.innerHeight;
        }
    });

    function fireConfetti(x, y) {
        if (!confettiCanvas || !confettiCtx || prefersReducedMotion) return;
        confettiCanvas.classList.add('active');
        const COLORS = ['#38bdf8', '#a78bfa', '#f472b6', '#fbbf24', '#34d399', '#f87171'];
        const originX = x || window.innerWidth / 2;
        const originY = y || window.innerHeight / 2;

        for (let i = 0; i < 90; i++) {
            const angle = (Math.random() * Math.PI * 2);
            const speed = Math.random() * 8 + 3;
            confettiParticles.push({
                x: originX, y: originY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 4,
                size: Math.random() * 6 + 3,
                color: COLORS[Math.floor(Math.random() * COLORS.length)],
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.3,
                life: 1,
                decay: Math.random() * 0.012 + 0.008,
                shape: Math.random() > 0.5 ? 'circle' : 'rect'
            });
        }
        if (!confettiAnimationId) animateConfetti();
    }

    function animateConfetti() {
        confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        confettiParticles = confettiParticles.filter(p => p.life > 0);
        confettiParticles.forEach(p => {
            p.x += p.vx; p.y += p.vy; p.vy += 0.22; p.vx *= 0.99;
            p.rotation += p.rotationSpeed; p.life -= p.decay;
            confettiCtx.save();
            confettiCtx.globalAlpha = p.life;
            confettiCtx.translate(p.x, p.y);
            confettiCtx.rotate(p.rotation);
            confettiCtx.fillStyle = p.color;
            if (p.shape === 'circle') {
                confettiCtx.beginPath();
                confettiCtx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                confettiCtx.fill();
            } else {
                confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
            }
            confettiCtx.restore();
        });
        if (confettiParticles.length > 0) {
            confettiAnimationId = requestAnimationFrame(animateConfetti);
        } else {
            confettiAnimationId = null;
            confettiCanvas.classList.remove('active');
        }
    }

    document.addEventListener('click', (e) => {
        const target = e.target.closest('.save-btn, .save-col-btn, #userModalSave');
        if (target) {
            const rect = target.getBoundingClientRect();
            fireConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
        }
    });

    /* ---------- 7. MARQUEE VISIBILITY ---------- */
    const marqueeTicker = document.getElementById('marqueeTicker');
    function toggleMarquee() {
        if (!marqueeTicker) return;
        const mainApp = document.getElementById('mainApp');
        const isMainVisible = mainApp && mainApp.style.display !== 'none';
        if (isMainVisible) marqueeTicker.classList.add('visible');
        else marqueeTicker.classList.remove('visible');
    }
    const mainAppEl = document.getElementById('mainApp');
    if (mainAppEl) {
        new MutationObserver(toggleMarquee).observe(mainAppEl, { attributes: true, attributeFilter: ['style'] });
    }

    /* ---------- 8. REATTACH ON DYNAMIC DOM CHANGES ---------- */
    const tableWrapper = document.getElementById('tableWrapper');
    if (tableWrapper) {
        new MutationObserver(() => {
            attachMagneticToAll();
            attachRippleToAll();
        }).observe(tableWrapper, { childList: true, subtree: true });
    }

    /* ---------- 9. INITIAL ATTACH ---------- */
    function initPhase2() {
        attachMagneticToAll();
        attachRippleToAll();
        attachTiltToAll();
        toggleMarquee();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(initPhase2, 300));
    } else {
        setTimeout(initPhase2, 300);
    }
})();

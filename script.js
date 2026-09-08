<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.5, user-scalable=yes">
    <title>Starlink · General Connection Expenditure</title>
    <link rel="stylesheet" href="style.css?v=20260908">
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2">
    </script>
</head>

<body>
    <!-- ======================================== -->
    <!-- LOGIN SCREEN -->
    <!-- ======================================== -->
    <div id="loginScreen" class="login-screen">
        <div class="login-container">
            <div class="login-header">
                <div class="login-icon">📡</div>
                <h1>STARLINK</h1>
                <p>General Connection Expenditure</p>
            </div>
            <div class="login-body">
                <div id="loginError" class="login-error" style="display:none;"></div>
                <div id="loginSuccess" class="login-success" style="display:none;">✅ Login successful!</div>

                <div class="login-input-group">
                    <label>Username</label>
                    <input type="text" id="usernameInput" class="login-input" placeholder="Enter your username" autocomplete="username">
                </div>

                <div class="login-input-group">
                    <label>Password</label>
                    <input type="password" id="passwordInput" class="login-input" placeholder="Enter your password" autocomplete="current-password">
                </div>

                <button id="loginBtn" class="login-btn">Login</button>

                <div class="login-links">
                    <button id="forgotPasswordBtn" class="forgot-link">Forgot Password?</button>
                    <span>|</span>
                    <button id="changePasswordBtn" class="forgot-link">Change Password</button>
                </div>
            </div>
            <div class="login-footer">
                <span>© 2026 Starlink Expenditure System</span>
            </div>
        </div>
    </div>

    <!-- ======================================== -->
    <!-- FORGOT PASSWORD SCREEN -->
    <!-- ======================================== -->
    <div id="forgotScreen" class="login-screen" style="display:none;">
        <div class="login-container">
            <div class="login-header">
                <div class="login-icon">🔐</div>
                <h1>STARLINK</h1>
                <p>Reset Password</p>
            </div>
            <div class="login-body">
                <div id="forgotError" class="login-error" style="display:none;"></div>
                <div id="forgotSuccess" class="login-success" style="display:none;"></div>

                <div class="login-input-group">
                    <label>Username</label>
                    <input type="text" id="forgotUsername" class="login-input" placeholder="Enter your username">
                </div>

                <button id="forgotSubmitBtn" class="login-btn">Reset Password</button>

                <div class="login-links">
                    <button id="backToLoginBtn" class="forgot-link">← Back to Login</button>
                </div>
            </div>
            <div class="login-footer">
                <span>© 2026 Starlink Expenditure System</span>
            </div>
        </div>
    </div>

    <!-- ======================================== -->
    <!-- CHANGE PASSWORD SCREEN -->
    <!-- ======================================== -->
    <div id="changePasswordScreen" class="login-screen" style="display:none;">
        <div class="login-container">
            <div class="login-header">
                <div class="login-icon">🔑</div>
                <h1>STARLINK</h1>
                <p>Change Password</p>
            </div>
            <div class="login-body">
                <div id="changePasswordError" class="login-error" style="display:none;"></div>
                <div id="changePasswordSuccess" class="login-success" style="display:none;"></div>

                <div class="login-input-group">
                    <label>Current Password</label>
                    <input type="password" id="changePasswordOld" class="login-input" placeholder="Enter current password">
                </div>

                <div class="login-input-group">
                    <label>New Password</label>
                    <input type="password" id="changePasswordNew" class="login-input" placeholder="Enter new password">
                </div>

                <div class="login-input-group">
                    <label>Confirm New Password</label>
                    <input type="password" id="changePasswordConfirm" class="login-input" placeholder="Confirm new password">
                </div>

                <button id="changePasswordSaveBtn" class="login-btn">Update Password</button>

                <div class="login-links">
                    <button id="changePasswordBackBtn" class="forgot-link">← Back to Login</button>
                </div>
            </div>
            <div class="login-footer">
                <span>© 2026 Starlink Expenditure System</span>
            </div>
        </div>
    </div>

    <!-- ======================================== -->
    <!-- MAIN APP -->
    <!-- ======================================== -->
    <div id="mainApp" class="app-wrapper" style="display:none;">
        <header class="app-header">
            <div class="header-left">
                <h1>📡 STARLINK</h1>
                <span class="subtitle">GENERAL CONNECTION EXPENDITURE</span>
                <button id="themeToggle" class="btn btn-theme">🌙 Dark</button>
                <span id="userDisplay" class="user-badge"></span>
                <button id="logoutBtn" class="btn btn-logout">🚪 Logout</button>
                <button id="adminPanelBtn" class="btn btn-admin" style="display:none;">👑 Admin</button>
            </div>
            <div class="filter-panel">
                <label>📅 From</label>
                <input type="date" id="dateFrom" class="date-input">
                <label>To</label>
                <input type="date" id="dateTo" class="date-input">
                <button id="applyFilterBtn" class="btn btn-filter">🔍 Apply</button>
                <button id="clearFilterBtn" class="btn btn-filter">✕ Clear</button>
                <button id="printPdfBtn" class="btn btn-pdf">📄 PDF</button>
                <button id="syncNowBtn" class="btn btn-sync">☁️ Sync</button>
            </div>
        </header>

        <main>
            <div class="table-container">
                <div id="tableWrapper" class="table-responsive"></div>
            </div>

            <div class="action-row">
                <button id="addDateBtn" class="btn btn-add">➕ Add New Date Entry</button>
                <button id="addRowBtn" class="btn btn-add-secondary">➕ Add Transaction Row</button>
            </div>

            <!-- Totals Grid with Transaction Fees -->
            <div class="totals-grid">
                <div class="total-card" id="grandTotalCard">
                    <span class="total-label">💰 GRAND TOTAL</span>
                    <span class="total-value" id="grandTotal">0.00</span>
                </div>
                <!-- Transaction Fees Card -->
                <div class="total-card" id="transactionFeesDisplay" style="background: linear-gradient(135deg, rgba(200, 154, 91, 0.12) 0%, rgba(226, 104, 91, 0.08) 100%); border: 1px solid rgba(200, 154, 91, 0.15);">
                    <span class="total-label" style="font-weight: 600; color: var(--text-muted); font-size: 0.7rem;">💳 TRANSACTION FEES</span>
                    <span class="total-value" id="transactionFeesTotal" style="font-weight: 800; font-size: 1.2rem; color: var(--accent-brass);">0.00</span>
                </div>
            </div>
            <p class="hint">* Enter amounts in any field — totals update automatically. <br>💡 Paste M-Pesa message in Transaction Reference to auto-fill amount & capture fees.</p>
        </main>
    </div>

    <!-- ======================================== -->
    <!-- READ MORE MODAL -->
    <!-- ======================================== -->
    <div id="readMoreModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h3>📄 Full Description</h3>
                <button class="modal-close-btn" id="modalCloseBtn">&times;</button>
            </div>
            <div class="modal-body" id="modalBody"></div>
        </div>
    </div>

    <!-- ======================================== -->
    <!-- ADMIN PANEL -->
    <!-- ======================================== -->
    <div id="adminPanel" class="modal" style="display:none;">
        <div class="modal-content" style="max-width:700px;">
            <div class="modal-header">
                <h3>👑 Admin Panel - User Management</h3>
                <button class="modal-close-btn" id="adminPanelClose">&times;</button>
            </div>
            <div class="modal-body">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:10px;">
                    <h4 style="color:var(--text-primary);">Users</h4>
                    <button id="addUserBtn" class="btn btn-add" style="padding:6px 16px; font-size:0.8rem;">➕ Add User</button>
                </div>
                <div id="userList"></div>
                <button id="adminPanelCloseBtn" class="btn btn-filter" style="margin-top:16px; width:100%;">Close</button>
            </div>
        </div>
    </div>

    <!-- ======================================== -->
    <!-- USER MODAL -->
    <!-- ======================================== -->
    <div id="userModal" class="modal" style="display:none;">
        <div class="modal-content" style="max-width:450px;">
            <div class="modal-header">
                <h3 id="userModalTitle">Add User</h3>
                <button class="modal-close-btn" id="userModalClose">&times;</button>
            </div>
            <div class="modal-body">
                <div id="userModalError" class="login-error" style="display:none;"></div>
                <input type="text" id="userModalUsername" placeholder="Username" class="login-input">
                <input type="text" id="userModalPassword" placeholder="Password" class="login-input">
                <select id="userModalRole" class="login-input">
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                </select>
                <div style="display:flex; gap:10px; margin-top:16px;">
                    <button id="userModalSave" class="btn btn-add" style="flex:1;">Save</button>
                    <button id="userModalCancel" class="btn btn-filter" style="flex:1;">Cancel</button>
                </div>
            </div>
        </div>
    </div>

    <script src="script.js"></script>
</body>

</html>

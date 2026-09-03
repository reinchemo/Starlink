// script.js – With Save Column functionality and Theme Toggle

(function() {
        "use strict";

        const STORAGE_KEY = 'starlinkExpenditureData_v27';

        const DEFAULT_COLUMNS = [
            { key: 'starlinkGeneral', label: 'STARLINK GENERAL EXPENDITURE', isCustom: false },
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

        // ========================================
        // THEME TOGGLE
        // ========================================
        const themeToggle = document.getElementById('themeToggle');

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

        // Initialize theme
        const savedTheme = getStoredTheme();
        applyTheme(savedTheme);
        themeToggle.addEventListener('click', toggleTheme);

        // ========================================
        // MAIN APP FUNCTIONS
        // ========================================
        function isNumericColumn(colKey) {
            return NUMERIC_KEYS.includes(colKey) || customColumns.some(c => c.key === colKey) || savedCustomColumns.some(c => c.key === colKey);
        }

        function getAllColumns() {
            return [...DEFAULT_COLUMNS, ...customColumns, ...savedCustomColumns];
        }

        function formatNumber(v) {
            let num = parseFloat(v);
            if (isNaN(num)) return 0;
            return Math.round(num * 100) / 100;
        }

        function getColumnAmount(row, columnKey) {
            const amountKey = columnKey + '_amount';
            return formatNumber(row[amountKey] || 0);
        }

        function getRowTotal(row) {
            let sum = 0;
            getAllColumns().forEach(col => {
                if (isNumericColumn(col.key)) {
                    sum += getColumnAmount(row, col.key);
                }
            });
            return sum;
        }

        function getDateGroupTotal(group) {
            let sum = 0;
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
            return filtered;
        }

        function computeColumnTotals(filteredData) {
            const totals = {};
            getAllColumns().forEach(col => {
                if (isNumericColumn(col.key)) {
                    totals[col.key] = 0;
                }
            });
            filteredData.forEach(group => {
                group.rows.forEach(row => {
                    getAllColumns().forEach(col => {
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
                row[col.key + '_ref'] = '';
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
                    row[newCol.key + '_ref'] = '';
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
                    row[savedCol.key + '_ref'] = row[colToSave.key + '_ref'] || '';
                    row[savedCol.key + '_amount'] = row[colToSave.key + '_amount'] || '';
                });
            });

            savedCustomColumns.push(savedCol);
            customColumns.splice(colIndex, 1);

            data.forEach(group => {
                group.rows.forEach(row => {
                    delete row[colToSave.key + '_desc'];
                    delete row[colToSave.key + '_transaction'];
                    delete row[colToSave.key + '_ref'];
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
                        delete row[colKey + '_ref'];
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
                        delete row[colKey + '_ref'];
                        delete row[colKey + '_amount'];
                    });
                });
                render();
            }
        }

        function saveDateEntry(dateId) {
            const group = data.find(d => d.id === dateId);
            if (!group) return;

            savedDates[dateId] = true;
            editModes[dateId] = false;
            render();

            const saveBtn = document.querySelector(`.save-btn[data-date-id="${dateId}"]`);
            if (saveBtn) {
                saveBtn.textContent = '✓ Saved';
                saveBtn.classList.add('saved');
                setTimeout(() => {
                    saveBtn.textContent = '💾 Save';
                    saveBtn.classList.remove('saved');
                }, 2000);
            }
        }

        function resetDateEntry(dateId) {
            if (!confirm('Reset all transactions for this date? This will clear all data.')) return;

            const group = data.find(d => d.id === dateId);
            if (!group) return;

            group.rows = [];
            const newRow = createEmptyRow();
            group.rows.push(newRow);

            savedDates[dateId] = false;
            editModes[dateId] = false;
            render();
        }

        function editDateEntry(dateId) {
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
            const group = data.find(d => d.id === dateId);
            if (!group) {
                alert('Date entry not found');
                return;
            }

            const newRow = createEmptyRow();
            group.rows.push(newRow);
            render();
        }

        function render() {
            const filtered = getFilteredData();
            const allColumns = getAllColumns();

            let html = '<table>';

            html += '<thead><tr>';
            html += '<th style="min-width:80px;">DATE</th>';
            allColumns.forEach(col => {
                        const isCustom = col.isCustom || false;
                        const isSaved = col.isSaved || false;
                        html += `<th style="min-width:120px; ${isCustom ? 'background: rgba(200,154,91,0.05);' : ''}">
                ${col.label}
                ${isCustom ? `<br><span style="font-weight:400; font-size:0.55rem; color:#c89a5b;">${isSaved ? '(saved)' : '(temp)'}</span>` : ''}
            </th>`;
        });
        html += '<th style="min-width:70px;">TOTAL</th>';
        html += '<th style="min-width:40px;"></th>';
        html += '</tr></thead>';

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
                    <button class="add-col-btn-header" title="Add a new custom expenditure column">
                        ➕ Add Expenditure
                    </button>
                </div>`;
                html += `</td>`;
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
                            const refKey = col.key + '_ref';
                            const amountKey = col.key + '_amount';

                            const descVal = row[descKey] || '';
                            const transVal = row[transKey] || '';
                            const refVal = row[refKey] || '';
                            const amountVal = row[amountKey] || '';

                            let descDisplay = '';
                            if (showEditMode) {
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

                            html += `<td style="padding:2px 3px; ${isCustom ? 'background: rgba(79,182,168,0.05);' : ''}" data-label="${col.label}">
                                <div class="column-group ${isCustom ? 'custom-column' : ''}">
                                    <span class="field-header">Description</span>
                                    ${descDisplay}
                                    <span class="field-header">Transaction</span>
                                    ${showEditMode ? 
                                        `<textarea class="trans-input" data-date-id="${group.id}" data-row-id="${row.id}" data-key="${transKey}" placeholder="Transaction" rows="1">${transVal}</textarea>` : 
                                        `<div class="desc-display">${transVal || '-'}</div>`}
                                    <span class="field-header">Reference</span>
                                    ${showEditMode ? 
                                        `<textarea class="ref-input" data-date-id="${group.id}" data-row-id="${row.id}" data-key="${refKey}" placeholder="Reference" rows="1">${refVal}</textarea>` : 
                                        `<div class="desc-display">${refVal || '-'}</div>`}
                                    <span class="field-header">Amount</span>
                                    ${showEditMode ? 
                                        `<input type="text" class="amount-input" data-date-id="${group.id}" data-row-id="${row.id}" data-key="${amountKey}" value="${amountVal}" placeholder="0">` : 
                                        `<div class="desc-display" style="font-weight:700; text-align:right; color:var(--accent-teal);">${formatNumber(amountVal).toFixed(2)}</div>`}
                                    ${isCustom ? 
                                        `<div style="display:flex; gap:4px; margin-top:4px; flex-wrap:wrap;">
                                            ${!isSavedCol ? `<button class="save-col-btn" data-col-key="${col.key}" title="Save this column permanently">💾 Save</button>` : ''}
                                            <button class="delete-col-btn" data-col-key="${col.key}" title="Remove this column">✕ Remove</button>
                                        </div>` : ''}
                                </div>
                            </td>`;
                        });

                        html += `<td class="row-total-col" data-label="Total">${getRowTotal(row).toFixed(2)}</td>`;
                        html += `<td><button class="delete-row-btn" data-date-id="${group.id}" data-row-id="${row.id}" title="Delete this transaction">🗑️ Delete</button></td>`;
                        html += `</tr>`;
                    });
                }

                const dateTotal = getDateGroupTotal(group);
                html += `<tr class="date-total-row">`;
                html += `<td colspan="${allColumns.length + 2}" style="padding:8px 16px;" data-label="">`;
                html += `<div class="date-total-content">
                    <div class="date-total-actions">
                        <button class="action-btn save-btn ${isSaved ? 'saved' : ''}" data-date-id="${group.id}">💾 Save</button>
                        <button class="action-btn edit-btn" data-date-id="${group.id}">✏️ Edit</button>
                        <button class="action-btn reset-btn" data-date-id="${group.id}">🔄 Reset</button>
                        <button class="action-btn delete-date-btn" data-date-id="${group.id}">🗑️ Delete</button>
                    </div>
                    <div class="date-total-right">
                        <span class="date-total-label">Date Total Amount:</span>
                        <span class="date-total-amount">${dateTotal.toFixed(2)}</span>
                        <div class="date-total-add-row">
                        </div>
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
            if (isNumericColumn(col.key)) {
                const val = colTotals[col.key] || 0;
                html += `<td data-label="${col.label}" style="color:var(--text-primary);">${val.toFixed(2)}</td>`;
            } else {
                html += `<td data-label="${col.label}" style="color:var(--text-primary);">0.00</td>`;
            }
        });
        const totalColSum = Object.values(colTotals).reduce((a, b) => a + b, 0);
        html += `<td data-label="Total" style="font-weight:700; color:var(--accent-teal);">${totalColSum.toFixed(2)}</td>`;
        html += `<td></td>`;
        html += `</tr>`;

        html += '</tfoot>';
        html += '</table>';

        wrapper.innerHTML = html;

        const grandTotal = computeGrandTotal(filtered);
        grandTotalEl.textContent = grandTotal.toFixed(2);

        document.querySelectorAll('.desc-input, .trans-input, .ref-input, .amount-input').forEach(input => {
            input.addEventListener('input', handleInputChange);
        });

        document.querySelectorAll('.desc-input, .trans-input, .ref-input').forEach(textarea => {
            textarea.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = this.scrollHeight + 'px';
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

        document.querySelectorAll('.date-total-row .reset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const dateId = parseInt(e.target.dataset.dateId);
                resetDateEntry(dateId);
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

        document.querySelectorAll('.delete-col-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const colKey = e.target.dataset.colKey;
                removeCustomColumn(colKey);
            });
        });

        saveToStorage();
    }

    function handleInputChange(e) {
        const input = e.target;
        const dateId = parseInt(input.dataset.dateId);
        const rowId = parseInt(input.dataset.rowId);
        const key = input.dataset.key;
        let value = input.value;

        if (key.includes('_amount')) {
            value = value === '' ? '' : value;
        }

        const group = data.find(d => d.id === dateId);
        if (group) {
            const row = group.rows.find(r => r.id === rowId);
            if (row) {
                row[key] = value;
                if (!key.includes('_amount')) {
                    updateTotalsOnly();
                } else {
                    render();
                }
            }
        }
    }

    function updateTotalsOnly() {
        const filtered = getFilteredData();

        const grandTotal = computeGrandTotal(filtered);
        grandTotalEl.textContent = grandTotal.toFixed(2);

        const filteredGroups = getFilteredData();
        const rowTotalCells = document.querySelectorAll('.row-total-col');
        const dateTotalCells = document.querySelectorAll('.date-total-amount');

        let rowIndex = 0;
        filteredGroups.forEach(group => {
            group.rows.forEach(row => {
                if (rowTotalCells[rowIndex]) {
                    rowTotalCells[rowIndex].textContent = getRowTotal(row).toFixed(2);
                }
                rowIndex++;
            });
        });

        filteredGroups.forEach((group, idx) => {
            if (dateTotalCells[idx]) {
                dateTotalCells[idx].textContent = getDateGroupTotal(group).toFixed(2);
            }
        });
    }

    function handleDeleteRow(e) {
        const dateId = parseInt(e.target.dataset.dateId);
        const rowId = parseInt(e.target.dataset.rowId);
        if (confirm('Delete this transaction?')) {
            const group = data.find(d => d.id === dateId);
            if (group) {
                group.rows = group.rows.filter(r => r.id !== rowId);
                render();
            }
        }
    }

    function handleDeleteDate(e) {
        const dateId = parseInt(e.target.dataset.dateId);
        if (confirm('Delete this entire date entry and all its transactions?')) {
            data = data.filter(d => d.id !== dateId);
            delete savedDates[dateId];
            delete editModes[dateId];
            render();
        }
    }

    function addDateEntry() {
        const dateInput = prompt('Enter date (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
        if (!dateInput) return;

        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
            alert('Please use YYYY-MM-DD format');
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
        render();
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
            
            .ref-row td { background: #f2f0e8; }
            .ref-row td:first-child { background: #f2f0e8; font-weight: 700; font-size: 10px; color: #0a2a44; text-align: right; padding-right: 15px; }
            .ref-row .ref-text { font-size: 0.85rem; color: #1a1a1d; text-align: left; }
            
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
                printHtml += `<th>${col.label}</th>`;
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

                        // DESCRIPTION ROW
                        printHtml += `<tr class="desc-row">`;
                        printHtml += `<td style="font-weight:700; font-size:10px; color:#0a2a44; text-align:right; padding-right:15px;">DESCRIPTION</td>`;
                        allColumns.forEach(col => {
                            const descVal = row[col.key + '_desc'] || '';
                            printHtml += `<td class="desc-text" style="text-align:left; font-size:0.85rem;">${descVal || '-'}</td>`;
                        });
                        printHtml += `<td style="font-weight:700; color:#0a2a44;">${getRowTotal(row).toFixed(2)}</td>`;
                        printHtml += `</tr>`;

                        // TRANSACTION ROW
                        printHtml += `<tr class="trans-row">`;
                        printHtml += `<td style="font-weight:700; font-size:10px; color:#0a2a44; text-align:right; padding-right:15px;">TRANSACTION</td>`;
                        allColumns.forEach(col => {
                            const transVal = row[col.key + '_transaction'] || '';
                            printHtml += `<td class="trans-text" style="text-align:left; font-size:0.85rem;">${transVal || '-'}</td>`;
                        });
                        printHtml += `<td></td>`;
                        printHtml += `</tr>`;

                        // REFERENCE ROW
                        printHtml += `<tr class="ref-row">`;
                        printHtml += `<td style="font-weight:700; font-size:10px; color:#0a2a44; text-align:right; padding-right:15px;">REFERENCE</td>`;
                        allColumns.forEach(col => {
                            const refVal = row[col.key + '_ref'] || '';
                            printHtml += `<td class="ref-text" style="text-align:left; font-size:0.85rem;">${refVal || '-'}</td>`;
                        });
                        printHtml += `<td></td>`;
                        printHtml += `</tr>`;

                        // AMOUNT ROW
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

    function saveToStorage() {
        try {
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
                dateTo
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
                data = store.data;
                nextDateId = store.nextDateId || 1;
                nextRowId = store.nextRowId || 1;
                nextColId = store.nextColId || 1;
                customColumns = store.customColumns || [];
                savedCustomColumns = store.savedCustomColumns || [];
                savedDates = store.savedDates || {};
                editModes = store.editModes || {};
                dateFrom = store.dateFrom || '';
                dateTo = store.dateTo || '';
                if (dateFrom) dateFromInput.value = dateFrom;
                if (dateTo) dateToInput.value = dateTo;
                return true;
            }
        } catch (e) {}
        return false;
    }

    function init() {
        const loaded = loadFromStorage();

        if (!loaded) {
            customColumns = [];
            savedCustomColumns = [];
            savedDates = {};
            editModes = {};
            dateFrom = '';
            dateTo = '';
            const sampleGroup = {
                id: nextDateId++,
                date: new Date().toISOString().split('T')[0],
                rows: [createEmptyRow()]
            };
            data = [sampleGroup];
        }

        render();

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

        addRowBtn.addEventListener('click', () => {
            if (data.length === 0) {
                alert('Please add a date entry first (click "Add New Date Entry")');
                return;
            }
            const lastGroup = data[data.length - 1];
            addTransactionRow(lastGroup.id);
        });
    }

    init();
})();

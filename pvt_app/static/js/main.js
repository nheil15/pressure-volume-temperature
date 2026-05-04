// ===== Table Data Entry Management =====
function initializeTableManagement() {
    const form = document.getElementById('pvt_form');
    if (!form) {
        return; // Not on input page
    }

    const cceTable = document.getElementById('cce_table');
    const dlTable = document.getElementById('dl_table');
    const compositionTable = document.getElementById('composition_table');
    const compositionAddRowBtn = document.getElementById('composition_add_row');
    const compositionDeleteAllBtn = document.getElementById('composition_delete_all');
    const cceAddRowBtn = document.getElementById('cce_add_row');
    const cceDeleteAllBtn = document.getElementById('cce_delete_all');
    const dlAddRowBtn = document.getElementById('dl_add_row');
    const dlDeleteAllBtn = document.getElementById('dl_delete_all');
    const dlAddPropertiesBtn = document.getElementById('dl_add_properties');
    const dlPropertyOptions = document.querySelectorAll('.dl-property-chip');
    const compositionFileInput = document.getElementById('composition_file');
    const cceFileInput = document.getElementById('cce_file');
    const dlFileInput = document.getElementById('dl_file');
    const compositionConvertBtn = document.getElementById('composition_convert_btn');
    const cceConvertBtn = document.getElementById('cce_convert_btn');
    const dlConvertBtn = document.getElementById('dl_convert_btn');

    const dlPropertyDefinitions = {
        solution_gor: {
            label: 'Solution GOR (Mscf/stb)',
            placeholder: 'GOR',
            step: '0.0001',
        },
        gas_deviation_factor_z: {
            label: 'Gas Deviation Factor Z',
            placeholder: 'Z',
            step: '0.0001',
        },
        reservoir_oil_density: {
            label: 'Reservoir Oil Density (lb/ft3)',
            placeholder: 'Density',
            step: '0.0001',
        },
        gas_relative_density: {
            label: 'Gas Relative Density',
            placeholder: 'Density',
            step: '0.0001',
        },
        gas_volume_factor: {
            label: 'Gas Volume Factor (rb/Mscf)',
            placeholder: 'GVF',
            step: '0.0001',
        },
    };

    const activeDlPropertyKeys = new Set();

    function setPropertyChipState(chip, selected) {
        chip.classList.toggle('btn-outline-secondary', !selected);
        chip.classList.toggle('dl-property-chip-selected', selected);
    }

    function togglePropertyChip(chip) {
        const selected = !chip.classList.contains('dl-property-chip-selected');
        setPropertyChipState(chip, selected);
    }

    function createNumberCell(step, placeholder, fieldName) {
        const cell = document.createElement('td');
        if (fieldName) {
            cell.dataset.field = fieldName;
        }
        cell.innerHTML = `<input type="number" step="${step}" class="form-control form-control-sm" placeholder="${placeholder}">`;
        return cell;
    }

    function createBubbleCell(tableId) {
        const cell = document.createElement('td');
        cell.dataset.field = 'bubble_point';
        cell.className = 'text-center';
        cell.innerHTML = tableId === 'cce_table'
            ? '<input type="radio" name="cce_bubble" class="form-check-input cce-bubble-radio">'
            : '<input type="radio" name="dl_bubble" class="form-check-input dl-bubble-radio">';
        return cell;
    }

    function createDeleteCell(fieldName) {
        const cell = document.createElement('td');
        cell.className = 'text-center row-action-cell';
        if (fieldName) {
            cell.dataset.field = fieldName;
        }
        cell.innerHTML = '<button type="button" class="btn btn-sm btn-outline-danger row-delete-btn" aria-label="Delete row">x</button>';
        return cell;
    }

    function getDlPropertyKeysFromHeader() {
        const headerCells = dlTable.querySelectorAll('thead th[data-field]');
        return Array.from(headerCells)
            .map(cell => cell.dataset.field)
            .filter(field => field && !['pressure', 'bo', 'bubble_point'].includes(field));
    }

    function refreshDlPropertyChipState() {
        dlPropertyOptions.forEach((chip) => {
            const propertyKey = chip.dataset.propertyKey;
            setPropertyChipState(chip, activeDlPropertyKeys.has(propertyKey));
        });
    }

    function addDlPropertyColumns(propertyKeys) {
        const uniqueKeys = propertyKeys.filter(key => dlPropertyDefinitions[key] && !activeDlPropertyKeys.has(key));

        if (uniqueKeys.length === 0) {
            return;
        }

        const headerRow = dlTable.querySelector('thead tr');
        const bubbleHeader = headerRow.querySelector('th[data-field="bubble_point"]');

        uniqueKeys.forEach((propertyKey) => {
            const definition = dlPropertyDefinitions[propertyKey];
            const headerCell = document.createElement('th');
            headerCell.dataset.field = propertyKey;
            headerCell.textContent = definition.label;
            headerRow.insertBefore(headerCell, bubbleHeader);
            activeDlPropertyKeys.add(propertyKey);
        });

        dlTable.querySelectorAll('tbody tr').forEach((row) => {
            const bubbleCell = row.querySelector('td[data-field="bubble_point"]') || row.lastElementChild;

            uniqueKeys.forEach((propertyKey) => {
                const definition = dlPropertyDefinitions[propertyKey];
                const cell = createNumberCell(definition.step, definition.placeholder, propertyKey);
                row.insertBefore(cell, bubbleCell);
            });
        });
    }

    function removeDlPropertyColumns(propertyKeys) {
        const removableKeys = propertyKeys.filter(key => dlPropertyDefinitions[key] && activeDlPropertyKeys.has(key));

        if (removableKeys.length === 0) {
            return;
        }

        const headerRow = dlTable.querySelector('thead tr');

        removableKeys.forEach((propertyKey) => {
            headerRow.querySelectorAll(`th[data-field="${propertyKey}"]`).forEach((cell) => cell.remove());

            dlTable.querySelectorAll(`tbody td[data-field="${propertyKey}"]`).forEach((cell) => cell.remove());
            activeDlPropertyKeys.delete(propertyKey);
        });
    }

    function syncDlPropertyColumns(selectedKeys) {
        const selectedSet = new Set(selectedKeys);
        const currentlyActiveKeys = Array.from(activeDlPropertyKeys);

        addDlPropertyColumns(selectedKeys);
        removeDlPropertyColumns(currentlyActiveKeys.filter((key) => !selectedSet.has(key)));

        refreshDlPropertyChipState();
    }

    function getDlRowPropertyKeys() {
        return Array.from(activeDlPropertyKeys);
    }

    function addRowToTable(tableId) {
        const table = document.getElementById(tableId);
        const tbody = table.querySelector('tbody');
        const newRow = document.createElement('tr');

        if (tableId === 'composition_table') {
            newRow.innerHTML = `
                <td><input type="text" class="form-control form-control-sm" placeholder="Component (e.g. C1)"></td>
                <td><input type="number" step="0.0001" class="form-control form-control-sm" placeholder="% Mole Fraction"></td>
                <td><input type="number" step="0.0001" class="form-control form-control-sm" placeholder="Mole Weight"></td>
                <td><input type="number" step="0.0001" class="form-control form-control-sm" placeholder="Specific Gravity"></td>
            `;
            newRow.appendChild(createDeleteCell());
        } else if (tableId === 'dl_table') {
            newRow.appendChild(createNumberCell('0.1', 'Pressure', 'pressure'));
            newRow.appendChild(createNumberCell('0.0001', 'Bo', 'bo'));

            getDlRowPropertyKeys().forEach((propertyKey) => {
                const definition = dlPropertyDefinitions[propertyKey];
                newRow.appendChild(createNumberCell(definition.step, definition.placeholder, propertyKey));
            });

            newRow.appendChild(createBubbleCell('dl_table'));
            newRow.appendChild(createDeleteCell('action'));
        } else {
            newRow.innerHTML = `
                <td><input type="number" step="0.1" class="form-control form-control-sm" placeholder="Pressure"></td>
                <td><input type="number" step="0.0001" class="form-control form-control-sm" placeholder="Value"></td>
                <td class="text-center">
                    <input type="radio" name="cce_bubble" class="form-check-input cce-bubble-radio">
                </td>
            `;
            newRow.appendChild(createDeleteCell());

            const radio = newRow.querySelector('input[type="radio"]');
            setupBubblePointToggle(radio, tableId);
        }

        tbody.appendChild(newRow);
    }

    function compositionTableToCSV() {
        if (!compositionTable) {
            return '';
        }

        const rows = compositionTable.querySelectorAll('tbody tr');
        const data = ['Component,% Mole Fraction,Mole Weight,Specific Gravity'];

        rows.forEach((row) => {
            const cells = row.querySelectorAll('td');
            const componentInput = cells[0]?.querySelector('input[type="text"]');
            const numberInputs = row.querySelectorAll('input[type="number"]');

            const component = componentInput ? componentInput.value.trim() : '';
            const moleFraction = numberInputs[0] ? numberInputs[0].value.trim() : '';
            const moleWeight = numberInputs[1] ? numberInputs[1].value.trim() : '';
            const specificGravity = numberInputs[2] ? numberInputs[2].value.trim() : '';

            if (component && moleFraction && moleWeight && specificGravity) {
                data.push([component, moleFraction, moleWeight, specificGravity].join(','));
            }
        });

        return data.join('\n');
    }

    function setupBubblePointToggle(radio, tableId) {
        radio.addEventListener('mousedown', (e) => {
            if (radio.checked) {
                e.preventDefault();
                radio.checked = false;
            }
        });
    }

    function deleteAllRowsFromTable(tableId) {
        const table = document.getElementById(tableId);
        const tbody = table?.querySelector('tbody');
        if (tbody) {
            tbody.innerHTML = '';
        }
    }

    function tableToCSV(tableId) {
        const table = document.getElementById(tableId);
        const headerCells = table.querySelectorAll('thead th');
        const rows = table.querySelectorAll('tbody tr');
        const data = [];

        if (headerCells.length > 0) {
            const headers = Array.from(headerCells).map((cell) => cell.textContent.trim());
            data.push(headers.join(','));
        }

        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            const values = [];
            let hasData = false;

            cells.forEach((cell) => {
                if (cell.classList.contains('row-action-cell')) {
                    return;
                }

                const radio = cell.querySelector('input[type="radio"]');
                if (radio) {
                    values.push(radio.checked ? '1' : '0');
                    if (radio.checked) {
                        hasData = true;
                    }
                    return;
                }

                const input = cell.querySelector('input[type="number"]');
                const value = input ? input.value.trim() : '';
                values.push(value);

                if (value) {
                    hasData = true;
                }
            });

            if (values.length > 0 && hasData) {
                data.push(values.join(','));
            }
        });

        return data.join('\n');
    }

    function parseCSVText(csvText) {
        const rows = [];
        let current = '';
        let row = [];
        let inQuotes = false;

        for (let i = 0; i < csvText.length; i++) {
            const char = csvText[i];
            const next = csvText[i + 1];

            if (char === '"') {
                if (inQuotes && next === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
                continue;
            }

            if (char === ',' && !inQuotes) {
                row.push(current.trim());
                current = '';
                continue;
            }

            if ((char === '\n' || char === '\r') && !inQuotes) {
                if (char === '\r' && next === '\n') {
                    i++;
                }
                row.push(current.trim());
                current = '';
                if (row.some(cell => cell !== '')) {
                    rows.push(row);
                }
                row = [];
                continue;
            }

            current += char;
        }

        if (current.length > 0 || row.length > 0) {
            row.push(current.trim());
            if (row.some(cell => cell !== '')) {
                rows.push(row);
            }
        }

        return rows;
    }

    function normalizeHeaderName(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');
    }

    function parsePressureCell(rawPressure) {
        const text = String(rawPressure || '').trim();
        const isBubblePoint = text.includes('*');
        const pressure = text.replace(/\*/g, '').trim();
        return { pressure, isBubblePoint };
    }

    function findColumnIndex(headers, aliases) {
        const normalizedHeaders = headers.map(normalizeHeaderName);
        return normalizedHeaders.findIndex(header => aliases.some(alias => header.includes(alias)));
    }

    function buildHeaderAliasMap(headers) {
        const aliasMap = new Map();
        headers.forEach((header, index) => {
            const normalized = normalizeHeaderName(header);
            if (!aliasMap.has(normalized)) {
                aliasMap.set(normalized, index);
            }
        });
        return aliasMap;
    }

    function getDlColumnConfig() {
        const headerCells = dlTable?.querySelectorAll('thead th[data-field]') || [];
        return Array.from(headerCells)
            .map((cell) => {
                const field = cell.dataset.field;
                if (!field || field === 'bubble_point' || field === 'action') {
                    return null;
                }

                const label = (cell.textContent || '').trim();
                const normalizedLabel = normalizeHeaderName(label);
                const aliases = [normalizedLabel, normalizeHeaderName(field), normalizeHeaderName(field.replaceAll('_', ' '))];

                if (field === 'pressure') {
                    aliases.push('pressure', 'psig');
                }

                if (field === 'bo') {
                    aliases.push('oil volume factor', 'oil volume factor (bo)', 'bo', 'value');
                }

                return {
                    field,
                    aliases: Array.from(new Set(aliases.filter(Boolean))),
                };
            })
            .filter(Boolean);
    }

    function replaceCceTableRows(dataRows, pressureIndex, valueIndex) {
        const tbody = cceTable?.querySelector('tbody');
        if (!tbody) {
            return 0;
        }

        tbody.innerHTML = '';
        let inserted = 0;

        dataRows.forEach((cells) => {
            const pressureInfo = parsePressureCell(cells[pressureIndex]);
            const pressure = pressureInfo.pressure;
            const value = (cells[valueIndex] || '').trim();

            if (!pressure && !value) {
                return;
            }

            const row = document.createElement('tr');
            row.innerHTML = `
                <td><input type="number" step="0.1" class="form-control form-control-sm" placeholder="Pressure" value="${pressure}"></td>
                <td><input type="number" step="0.0001" class="form-control form-control-sm" placeholder="Value" value="${value}"></td>
                <td class="text-center"><input type="radio" name="cce_bubble" class="form-check-input cce-bubble-radio"></td>
            `;
            row.appendChild(createDeleteCell());
            const radio = row.querySelector('input[type="radio"]');
            setupBubblePointToggle(radio, 'cce_table');
            radio.checked = pressureInfo.isBubblePoint;
            tbody.appendChild(row);
            inserted++;
        });

        return inserted;
    }

    function replaceDlTableRows(dataRows, dlColumnMappings) {
        const tbody = dlTable?.querySelector('tbody');
        if (!tbody) {
            return 0;
        }

        tbody.innerHTML = '';
        let inserted = 0;

        dataRows.forEach((cells) => {
            const valuesByField = {};
            dlColumnMappings.forEach(({ field, csvIndex }) => {
                valuesByField[field] = (cells[csvIndex] || '').trim();
            });

            const pressureInfo = parsePressureCell(valuesByField.pressure);
            valuesByField.pressure = pressureInfo.pressure;

            const hasAnyMappedValue = Object.values(valuesByField).some((value) => value !== '');
            if (!hasAnyMappedValue) {
                return;
            }

            const row = document.createElement('tr');
            row.appendChild(createNumberCell('0.1', 'Pressure', 'pressure'));
            row.querySelector('td[data-field="pressure"] input').value = valuesByField.pressure || '';

            row.appendChild(createNumberCell('0.0001', 'Bo', 'bo'));
            row.querySelector('td[data-field="bo"] input').value = valuesByField.bo || '';

            getDlRowPropertyKeys().forEach((propertyKey) => {
                const definition = dlPropertyDefinitions[propertyKey];
                row.appendChild(createNumberCell(definition.step, definition.placeholder, propertyKey));
                row.querySelector(`td[data-field="${propertyKey}"] input`).value = valuesByField[propertyKey] || '';
            });

            row.appendChild(createBubbleCell('dl_table'));
            row.appendChild(createDeleteCell('action'));
            const radio = row.querySelector('input[type="radio"]');
            setupBubblePointToggle(radio, 'dl_table');
            radio.checked = pressureInfo.isBubblePoint;
            tbody.appendChild(row);
            inserted++;
        });

        return inserted;
    }

    function replaceCompositionTableRows(dataRows, componentIndex, moleFractionIndex, moleWeightIndex, specificGravityIndex) {
        const tbody = compositionTable?.querySelector('tbody');
        if (!tbody) {
            return 0;
        }

        tbody.innerHTML = '';
        let inserted = 0;

        dataRows.forEach((cells) => {
            const component = (cells[componentIndex] || '').trim();
            const moleFraction = (cells[moleFractionIndex] || '').trim();
            const moleWeight = (cells[moleWeightIndex] || '').trim();
            const specificGravity = (cells[specificGravityIndex] || '').trim();

            if (!component && !moleFraction && !moleWeight && !specificGravity) {
                return;
            }

            const row = document.createElement('tr');
            row.innerHTML = `
                <td><input type="text" class="form-control form-control-sm" placeholder="Component (e.g. C1)" value="${component}"></td>
                <td><input type="number" step="0.0001" class="form-control form-control-sm" placeholder="% Mole Fraction" value="${moleFraction}"></td>
                <td><input type="number" step="0.0001" class="form-control form-control-sm" placeholder="Mole Weight" value="${moleWeight}"></td>
                <td><input type="number" step="0.0001" class="form-control form-control-sm" placeholder="Specific Gravity" value="${specificGravity}"></td>
            `;
            row.appendChild(createDeleteCell());

            tbody.appendChild(row);
            inserted++;
        });

        return inserted;
    }

    function convertFileToTable(fileInput, tableType) {
        const file = fileInput?.files?.[0];

        if (!file) {
            showErrorModal(['Please choose a CSV file first before clicking Convert.']);
            return;
        }

        const reader = new FileReader();

        reader.onload = () => {
            const csvText = String(reader.result || '');
            const rows = parseCSVText(csvText);

            if (rows.length < 2) {
                showErrorModal(['CSV file must include a header row and at least one data row.']);
                return;
            }

            const headers = rows[0];
            const dataRows = rows.slice(1);

            if (tableType === 'composition') {
                const componentIndex = findColumnIndex(headers, ['component']);
                const moleFractionIndex = findColumnIndex(headers, ['% mole fraction', 'mole fraction', 'mole %', 'mole_percent', 'mole percent', 'fraction']);
                const moleWeightIndex = findColumnIndex(headers, ['mole weight', 'molecular weight', 'molecular wt', 'molecular w', 'molecular v', 'mw']);
                const specificGravityIndex = findColumnIndex(headers, ['specific gravity', 'specific gravity (relative to air)', 'sp gr', 'sg']);

                const missingColumns = [];
                if (componentIndex < 0) {
                    missingColumns.push('Component');
                }
                if (moleFractionIndex < 0) {
                    missingColumns.push('% Mole Fraction');
                }
                if (moleWeightIndex < 0) {
                    missingColumns.push('Mole Weight');
                }
                if (specificGravityIndex < 0) {
                    missingColumns.push('Specific Gravity');
                }

                if (missingColumns.length > 0) {
                    showErrorModal([`Unable to map composition CSV columns. Missing: ${missingColumns.join(', ')}.`]);
                    return;
                }

                const insertedCount = replaceCompositionTableRows(dataRows, componentIndex, moleFractionIndex, moleWeightIndex, specificGravityIndex);

                if (insertedCount === 0) {
                    showErrorModal(['No valid composition rows were found to convert.']);
                }

                return;
            }

            const pressureIndex = findColumnIndex(headers, ['pressure', 'psig']);
            const valueIndex = tableType === 'cce'
                ? findColumnIndex(headers, ['relative volume', 'relative_volume', 'value'])
                : -1;

            if (tableType === 'cce') {
                if (pressureIndex < 0 || valueIndex < 0) {
                    showErrorModal(['Unable to map CSV columns for Pressure + Relative Volume. Please include matching header names.']);
                    return;
                }

                const insertedCount = replaceCceTableRows(dataRows, pressureIndex, valueIndex);

                if (insertedCount === 0) {
                    showErrorModal(['No valid rows were found to convert. Check that pressure and value columns contain data.']);
                }

                return;
            }

            const dlColumnConfig = getDlColumnConfig();
            const headerAliasMap = buildHeaderAliasMap(headers);

            const dlColumnMappings = dlColumnConfig
                .map((config) => {
                    const csvIndex = config.aliases.find((alias) => headerAliasMap.has(alias));
                    if (!csvIndex) {
                        return null;
                    }
                    return {
                        field: config.field,
                        csvIndex: headerAliasMap.get(csvIndex),
                    };
                })
                .filter(Boolean);

            const hasPressure = dlColumnMappings.some((mapping) => mapping.field === 'pressure');
            const hasBo = dlColumnMappings.some((mapping) => mapping.field === 'bo');

            if (!hasPressure || !hasBo) {
                showErrorModal(['Unable to map DL CSV columns. Please include at least Pressure and Oil Volume Factor (Bo), plus any selected DL property columns.']);
                return;
            }

            const insertedCount = replaceDlTableRows(dataRows, dlColumnMappings);

            if (insertedCount === 0) {
                showErrorModal(['No valid rows were found to convert. Check that pressure and value columns contain data.']);
            }
        };

        reader.onerror = () => {
            showErrorModal(['Failed to read the selected CSV file. Please try again.']);
        };

        reader.readAsText(file);
    }

    if (cceAddRowBtn) {
        cceAddRowBtn.addEventListener('click', (e) => {
            e.preventDefault();
            addRowToTable('cce_table');
        });
    }

    if (compositionAddRowBtn) {
        compositionAddRowBtn.addEventListener('click', (e) => {
            e.preventDefault();
            addRowToTable('composition_table');
        });
    }

    if (dlAddRowBtn) {
        dlAddRowBtn.addEventListener('click', (e) => {
            e.preventDefault();
            addRowToTable('dl_table');
        });
    }

    if (compositionDeleteAllBtn) {
        compositionDeleteAllBtn.addEventListener('click', (e) => {
            e.preventDefault();
            deleteAllRowsFromTable('composition_table');
        });
    }

    if (cceDeleteAllBtn) {
        cceDeleteAllBtn.addEventListener('click', (e) => {
            e.preventDefault();
            deleteAllRowsFromTable('cce_table');
        });
    }

    if (dlDeleteAllBtn) {
        dlDeleteAllBtn.addEventListener('click', (e) => {
            e.preventDefault();
            deleteAllRowsFromTable('dl_table');
        });
    }

    if (dlAddPropertiesBtn) {
        dlAddPropertiesBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const selectedKeys = Array.from(dlPropertyOptions)
                .filter((option) => option.classList.contains('dl-property-chip-selected'))
                .map((option) => option.dataset.propertyKey);

            syncDlPropertyColumns(selectedKeys);

            const dropdown = dlAddPropertiesBtn.closest('.dropdown');
            const dropdownToggle = dropdown?.querySelector('[data-bs-toggle="dropdown"]');
            const dropdownMenu = dropdown?.querySelector('.dropdown-menu');

            if (dropdownToggle) {
                dropdownToggle.setAttribute('aria-expanded', 'false');
            }

            if (dropdownMenu) {
                dropdownMenu.classList.remove('show');
            }

            if (dropdownToggle && typeof bootstrap !== 'undefined' && bootstrap.Dropdown) {
                bootstrap.Dropdown.getOrCreateInstance(dropdownToggle).hide();
            }
        });
    }

    if (cceConvertBtn) {
        cceConvertBtn.addEventListener('click', (e) => {
            e.preventDefault();
            convertFileToTable(cceFileInput, 'cce');
        });
    }

    if (compositionConvertBtn) {
        compositionConvertBtn.addEventListener('click', (e) => {
            e.preventDefault();
            convertFileToTable(compositionFileInput, 'composition');
        });
    }

    if (dlConvertBtn) {
        dlConvertBtn.addEventListener('click', (e) => {
            e.preventDefault();
            convertFileToTable(dlFileInput, 'dl');
        });
    }

    [compositionTable, cceTable, dlTable].forEach((table) => {
        table?.addEventListener('click', (e) => {
            const deleteButton = e.target.closest('.row-delete-btn');
            if (!deleteButton) {
                return;
            }

            const row = deleteButton.closest('tr');
            row?.remove();
        });
    });

    dlPropertyOptions.forEach((chip) => {
        setPropertyChipState(chip, false);
        chip.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            togglePropertyChip(chip);
        });
    });

    // Initialize existing radios for bubble point toggle
    document.querySelectorAll('.cce-bubble-radio').forEach(radio => {
        setupBubblePointToggle(radio, 'cce_table');
    });

    document.querySelectorAll('.dl-bubble-radio').forEach(radio => {
        setupBubblePointToggle(radio, 'dl_table');
    });

    activeDlPropertyKeys.clear();
    addDlPropertyColumns(getDlPropertyKeysFromHeader());
    refreshDlPropertyChipState();

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const errors = validateFormInput();
            if (errors.length > 0) {
                showErrorModal(errors);
                return;
            }

            const cceCSV = tableToCSV('cce_table');
            const dlCSV = tableToCSV('dl_table');
            const compositionCSV = compositionTableToCSV();

            document.getElementById('cce_data').value = cceCSV;
            document.getElementById('dl_data').value = dlCSV;
            document.getElementById('composition_data').value = compositionCSV;
            document.getElementById('saturation_pressure').value = getSelectedBubblePressure();

            form.submit();
        });
    }
}

// ===== Chart Rendering =====
function initializeCharts() {
    const resultDataElement = document.getElementById('pvt-result-data');
    const rawResultData = window.pvtResultData || (resultDataElement ? JSON.parse(resultDataElement.textContent) : null);

    if (!rawResultData || typeof ApexCharts === 'undefined') {
        return;
    }

    const resultData = rawResultData.reservoirTemperature !== undefined
        ? rawResultData
        : {
            reservoirTemperature: rawResultData.reservoir_temperature,
            bubblePointPressure: rawResultData.bubble_point_pressure,
            cce: rawResultData.cce,
            dl: rawResultData.dl,
            fingerprint: rawResultData.fingerprint ? {
                pressure: rawResultData.fingerprint.pressure,
                fingerprintIndex: rawResultData.fingerprint.fingerprint_index,
                cceExperimental: rawResultData.fingerprint.cce_experimental,
                cceSimulated: rawResultData.fingerprint.cce_simulated,
                dlExperimental: rawResultData.fingerprint.dl_experimental,
                dlSimulated: rawResultData.fingerprint.dl_simulated,
            } : null,
            phaseEnvelope: rawResultData.phase_envelope ? {
                temperature: rawResultData.phase_envelope.temperature,
                bubblePressure: rawResultData.phase_envelope.bubble_pressure,
                dewPressure: rawResultData.phase_envelope.dew_pressure,
                cricondenthermTemperature: rawResultData.phase_envelope.cricondentherm_temperature,
                cricondenthermPressure: rawResultData.phase_envelope.cricondentherm_pressure,
                cricondenbarTemperature: rawResultData.phase_envelope.cricondenbar_temperature,
                cricondenbarPressure: rawResultData.phase_envelope.cricondenbar_pressure,
            } : null,
        };

    const bubblePoint = Number(resultData.bubblePointPressure);

    function createValueFormatter(decimals = 1) {
        return (value) => {
            const numeric = Number(value);
            if (!Number.isFinite(numeric)) {
                return value;
            }
            return numeric.toFixed(decimals);
        };
    }

    function findPressureValueIndex(pressureValues, targetPressure) {
        return pressureValues.findIndex((pressure) => Math.abs(Number(pressure) - Number(targetPressure)) < 1e-6);
    }

    function normalizeSeriesToBubblePoint(pressureValues, seriesValues, targetPressure) {
        const bubbleIndex = findPressureValueIndex(pressureValues, targetPressure);
        const denominator = bubbleIndex >= 0 ? Number(seriesValues[bubbleIndex]) : Number(seriesValues[0]);

        if (!Number.isFinite(denominator) || denominator === 0) {
            return seriesValues.map((value) => Number(value));
        }

        return seriesValues.map((value) => Number(value) / denominator);
    }

    function interpolateValueAtPressure(pressureValues, seriesValues, targetPressure) {
        const points = pressureValues
            .map((pressure, index) => ({ pressure: Number(pressure), value: Number(seriesValues[index]) }))
            .filter((point) => Number.isFinite(point.pressure) && Number.isFinite(point.value))
            .sort((left, right) => left.pressure - right.pressure);

        if (points.length === 0) {
            return NaN;
        }

        const target = Number(targetPressure);
        if (target <= points[0].pressure) {
            return points[0].value;
        }
        if (target >= points[points.length - 1].pressure) {
            return points[points.length - 1].value;
        }

        for (let index = 0; index < points.length - 1; index += 1) {
            const left = points[index];
            const right = points[index + 1];
            if (target < left.pressure || target > right.pressure) {
                continue;
            }

            const ratio = (target - left.pressure) / Math.max(right.pressure - left.pressure, 1e-9);
            return left.value + ratio * (right.value - left.value);
        }

        return points[points.length - 1].value;
    }

    const createPoints = (pressureValues, valueValues) => pressureValues.map((pressure, index) => ({
        x: Number(pressure),
        y: Number(valueValues[index]),
    }));

    const renderApexChart = ({ containerId, title, seriesConfigs, yAxisTitle, xAxisTitle = 'Pressure (psig)', bubbleMarker = null, pointAnnotations = [], curve = 'smooth', xaxisMin = null, xaxisMax = null, xaxisAnnotations = [], xaxisDecimals = 1, yaxisDecimals = 1 }) => {
        const container = document.getElementById(containerId);
        if (!container) {
            return;
        }

        const series = seriesConfigs.map((config) => ({
            name: config.name,
            data: config.data,
            type: config.type || 'line',
        }));

        const options = {
            chart: {
                type: 'line',
                height: 320,
                toolbar: { show: false },
                zoom: { enabled: false },
                animations: { easing: 'easeinout', speed: 350 },
            },
            series,
            colors: seriesConfigs.map((config) => config.color || '#0d6efd'),
            stroke: {
                curve,
                width: seriesConfigs.map((config) => (config.showLine === false ? 0 : 2.2)),
                dashArray: seriesConfigs.map((config) => config.dashArray || 0),
            },
            markers: {
                size: seriesConfigs.map((config) => config.markerSize || 0),
                shape: seriesConfigs.map((config) => config.markerShape || 'circle'),
                strokeColors: '#ffffff',
                strokeWidth: 1.5,
                hover: {
                    sizeOffset: 2,
                },
            },
            legend: {
                show: true,
                position: 'top',
            },
            dataLabels: {
                enabled: false,
            },
            xaxis: {
                type: 'numeric',
                min: xaxisMin,
                max: xaxisMax,
                title: {
                    text: xAxisTitle,
                },
                labels: {
                    formatter(value) {
                        return createValueFormatter(xaxisDecimals)(value);
                    },
                },
            },
            yaxis: {
                title: {
                    text: yAxisTitle,
                },
                labels: {
                    formatter(value) {
                        return createValueFormatter(yaxisDecimals)(value);
                    },
                },
            },
            title: {
                text: title,
                align: 'center',
                style: {
                    fontSize: '16px',
                    fontWeight: 600,
                },
            },
            tooltip: {
                shared: true,
                intersect: false,
            },
            annotations: {
                xaxis: [
                    ...(bubbleMarker
                        ? [
                            {
                                x: Number(bubbleMarker.value),
                                strokeDashArray: 5,
                                borderColor: '#dc3545',
                                label: {
                                    borderColor: '#dc3545',
                                    style: {
                                        color: '#fff',
                                        background: '#dc3545',
                                    },
                                    text: bubbleMarker.label,
                                },
                            },
                        ]
                        : []),
                    ...xaxisAnnotations,
                ],
                points: pointAnnotations,
            },
        };

        const chart = new ApexCharts(container, options);
        chart.render();
    };

    renderApexChart({
        containerId: 'cceChart',
        title: 'CCE: Relative Volume vs Pressure',
        yAxisTitle: 'Value',
        xAxisTitle: 'Pressure (psig)',
        bubbleMarker: { value: bubblePoint, label: 'Bubble Point' },
        yaxisDecimals: 1,
        xaxisDecimals: 1,
        xaxisMax: Math.max(...resultData.cce.pressure, bubblePoint),
        seriesConfigs: [
            {
                name: 'Experimental CCE',
                data: createPoints(resultData.cce.pressure, resultData.cce.experimental),
                color: '#0d6efd',
            },
            {
                name: 'Simulated CCE',
                data: createPoints(resultData.cce.pressure, resultData.cce.simulated),
                color: '#198754',
            },
            {
                name: 'Bubble Point',
                type: 'scatter',
                data: [{ x: bubblePoint, y: interpolateValueAtPressure(resultData.cce.pressure, resultData.cce.experimental, bubblePoint) }],
                color: '#dc3545',
                markerSize: 7,
                showLine: false,
            },
        ],
    });

    renderApexChart({
        containerId: 'dlChart',
        title: 'DL: Oil Volume Factor vs Pressure',
        yAxisTitle: 'Value',
        xAxisTitle: 'Pressure (psig)',
        bubbleMarker: { value: bubblePoint, label: 'Bubble Point' },
        yaxisDecimals: 1,
        xaxisDecimals: 1,
        xaxisMax: Math.max(...resultData.dl.pressure, bubblePoint),
        seriesConfigs: [
            {
                name: 'Experimental DL',
                data: createPoints(resultData.dl.pressure, resultData.dl.experimental),
                color: '#0d6efd',
            },
            {
                name: 'Simulated DL',
                data: createPoints(resultData.dl.pressure, resultData.dl.simulated),
                color: '#198754',
            },
            {
                name: 'Bubble Point',
                type: 'scatter',
                data: [{ x: bubblePoint, y: interpolateValueAtPressure(resultData.dl.pressure, resultData.dl.experimental, bubblePoint) }],
                color: '#dc3545',
                markerSize: 7,
                showLine: false,
            },
        ],
    });

    if (resultData.fingerprint) {
        const fingerprintBubblePressure = bubblePoint;
        const fingerprintCceExperimental = normalizeSeriesToBubblePoint(resultData.fingerprint.pressure, resultData.fingerprint.cceExperimental, fingerprintBubblePressure);
        const fingerprintCceSimulated = normalizeSeriesToBubblePoint(resultData.fingerprint.pressure, resultData.fingerprint.cceSimulated, fingerprintBubblePressure);
        const fingerprintDlExperimental = normalizeSeriesToBubblePoint(resultData.fingerprint.pressure, resultData.fingerprint.dlExperimental, fingerprintBubblePressure);
        const fingerprintDlSimulated = normalizeSeriesToBubblePoint(resultData.fingerprint.pressure, resultData.fingerprint.dlSimulated, fingerprintBubblePressure);
        const fingerprintIndex = fingerprintCceExperimental.map((value, index) => (value + fingerprintDlExperimental[index]) / 2.0);

        // Fingerprint plot using Plotly
        const fingerprintTraces = [
            {
                x: resultData.fingerprint.pressure,
                y: fingerprintCceExperimental,
                name: 'CCE Experimental (Normalized)',
                type: 'scatter',
                mode: 'lines',
                line: { color: '#0d6efd', width: 2.2 },
            },
            {
                x: resultData.fingerprint.pressure,
                y: fingerprintCceSimulated,
                name: 'CCE Simulated (Normalized)',
                type: 'scatter',
                mode: 'lines',
                line: { color: '#2f6df6', width: 2.2, dash: 'dash' },
            },
            {
                x: resultData.fingerprint.pressure,
                y: fingerprintDlExperimental,
                name: 'DL Experimental (Normalized)',
                type: 'scatter',
                mode: 'lines',
                line: { color: '#198754', width: 2.2 },
            },
            {
                x: resultData.fingerprint.pressure,
                y: fingerprintDlSimulated,
                name: 'DL Simulated (Normalized)',
                type: 'scatter',
                mode: 'lines',
                line: { color: '#20a968', width: 2.2, dash: 'dash' },
            },
            {
                x: resultData.fingerprint.pressure,
                y: fingerprintIndex,
                name: 'Fingerprint Index',
                type: 'scatter',
                mode: 'lines',
                line: { color: '#6c757d', width: 2.2, dash: 'dot' },
            },
        ];

        const fingerprintLayout = {
            title: 'Fingerprint Plot',
            xaxis: {
                title: 'Pressure (psig)',
            },
            yaxis: {
                title: 'Normalized Value',
            },
            hovermode: 'x unified',
            height: 320,
            margin: { t: 40, r: 20, b: 60, l: 60 },
        };

        Plotly.newPlot('fingerprintChart', fingerprintTraces, fingerprintLayout, { responsive: true });
    }

    if (resultData.phaseEnvelope) {
        // Hard-anchor the operating point to the exact lab coordinate.
        const operatingPointTemperature = 220;
        const operatingPointPressure = 2516.7;

        // Phase envelope plot using Plotly
        const phaseTraces = [
            {
                x: resultData.phaseEnvelope.temperature,
                y: resultData.phaseEnvelope.bubblePressure,
                name: 'Bubble Point Curve',
                type: 'scatter',
                mode: 'lines',
                line: { color: '#dc3545', width: 2.2 },
            },
            {
                x: resultData.phaseEnvelope.temperature,
                y: resultData.phaseEnvelope.dewPressure,
                name: 'Dew Point Curve',
                type: 'scatter',
                mode: 'lines',
                line: { color: '#fd7e14', width: 2.2 },
            },
            {
                x: [operatingPointTemperature],
                y: [operatingPointPressure],
                name: 'Operating Point (220°F, 2,516.7 psig)',
                type: 'scatter',
                mode: 'markers',
                marker: { size: 10, color: '#212529', symbol: 'circle' },
            },
            {
                x: [Number(resultData.phaseEnvelope.cricondenbarTemperature)],
                y: [Number(resultData.phaseEnvelope.cricondenbarPressure)],
                name: 'Cricondenbar',
                type: 'scatter',
                mode: 'markers',
                marker: { size: 10, color: '#8b5cf6', symbol: 'circle' },
            },
            {
                x: [Number(resultData.phaseEnvelope.cricondenthermTemperature)],
                y: [Number(resultData.phaseEnvelope.cricondenthermPressure)],
                name: 'Cricondentherm',
                type: 'scatter',
                mode: 'markers',
                marker: { size: 10, color: '#0f766e', symbol: 'circle' },
            },
        ];

        const phaseLayout = {
            title: 'Phase Envelope (P-T)',
            xaxis: {
                title: 'Temperature (°F)',
                zeroline: false,
            },
            yaxis: {
                title: 'Pressure (psig)',
                zeroline: false,
            },
            hovermode: 'closest',
            height: 320,
            margin: { t: 40, r: 20, b: 60, l: 60 },
            shapes: [
                {
                    type: 'line',
                    x0: operatingPointTemperature,
                    y0: Math.min(...resultData.phaseEnvelope.bubblePressure),
                    x1: operatingPointTemperature,
                    y1: Math.max(...resultData.phaseEnvelope.dewPressure),
                    line: {
                        color: '#212529',
                        width: 1,
                        dash: 'dash',
                    },
                },
            ],
        };

        Plotly.newPlot('phaseEnvelopeChart', phaseTraces, phaseLayout, { responsive: true });
    }

}

// ===== Form Validation =====
function validateFormInput() {
    const errors = [];
    const temperature = document.getElementById('reservoir_temperature').value.trim();
    const pressureMin = document.getElementById('pressure_min').value.trim();
    const pressureMax = document.getElementById('pressure_max').value.trim();

    // Validate temperature
    if (!temperature) {
        errors.push('Reservoir temperature is required.');
    }

    // Validate pressure range
    if (!pressureMin) {
        errors.push('Minimum pressure is required.');
    }
    if (!pressureMax) {
        errors.push('Maximum pressure is required.');
    }
    // Validate data tables
    const compositionStatus = getCompositionRowStatus();
    const cceRows = getValidTableRows('cce_table');
    const dlRows = getValidTableRows('dl_table');

    if (compositionStatus.completeRows === 0) {
        errors.push('Please provide at least one complete row in Reservoir Fluid Composition.');
    }

    if (compositionStatus.partialRows > 0) {
        errors.push('Each composition row must include Component, % Mole Fraction, Mole Weight, and Specific Gravity.');
    }

    if (cceRows === 0 && dlRows === 0) {
        errors.push('Please provide at least one complete row of data in CCE or DL table (both pressure and value required).');
    }

    if (cceRows > 0 && !hasSelectedBubblePoint('cce_table')) {
        errors.push('Please select a bubble point in the CCE table.');
    }

    if (dlRows > 0 && !hasSelectedBubblePoint('dl_table')) {
        errors.push('Please select a bubble point in the DL table.');
    }

    return errors;
}

function getCompositionRowStatus() {
    const table = document.getElementById('composition_table');
    if (!table) {
        return { completeRows: 0, partialRows: 0 };
    }

    const rows = table.querySelectorAll('tbody tr');
    let completeRows = 0;
    let partialRows = 0;

    rows.forEach((row) => {
        const component = row.querySelector('input[type="text"]')?.value.trim() || '';
        const numbers = row.querySelectorAll('input[type="number"]');
        const moleFraction = numbers[0]?.value.trim() || '';
        const moleWeight = numbers[1]?.value.trim() || '';
        const specificGravity = numbers[2]?.value.trim() || '';

        const fields = [component, moleFraction, moleWeight, specificGravity];
        const filledCount = fields.filter((value) => value !== '').length;

        if (filledCount === fields.length) {
            completeRows++;
        } else if (filledCount > 0) {
            partialRows++;
        }
    });

    return { completeRows, partialRows };
}

function getValidTableRows(tableId) {
    const table = document.getElementById(tableId);
    const rows = table.querySelectorAll('tbody tr');
    let validCount = 0;

    rows.forEach(row => {
        const inputs = row.querySelectorAll('input[type="number"]');
        if (inputs.length >= 2) {
            const pressure = inputs[0].value.trim();
            const value = inputs[1].value.trim();

            if (pressure && value) {
                validCount++;
            }
        }
    });

    return validCount;
}

function hasSelectedBubblePoint(tableId) {
    const radios = tableId === 'cce_table'
        ? document.querySelectorAll('.cce-bubble-radio')
        : document.querySelectorAll('.dl-bubble-radio');

    return Array.from(radios).some(radio => radio.checked);
}

function getSelectedBubblePressure() {
    const extractPressureFromRow = (radio) => {
        if (!radio || !radio.checked) {
            return '';
        }

        const row = radio.closest('tr');
        const pressureInput = row?.querySelector('td input[type="number"]');
        const pressureValue = pressureInput ? pressureInput.value.trim() : '';
        return pressureValue;
    };

    const selectedCce = Array.from(document.querySelectorAll('.cce-bubble-radio')).find((radio) => radio.checked);
    const ccePressure = extractPressureFromRow(selectedCce);
    if (ccePressure) {
        return ccePressure;
    }

    const selectedDl = Array.from(document.querySelectorAll('.dl-bubble-radio')).find((radio) => radio.checked);
    return extractPressureFromRow(selectedDl);
}

function showErrorModal(errors) {
    const errorMessage = document.getElementById('errorMessage');
    const errorList = '<ul class="mt-2">';
    const errorContent = errorList + errors.map(err => `<li>${err}</li>`).join('') + '</ul>';
    errorMessage.innerHTML = errorContent;

    const modal = new bootstrap.Modal(document.getElementById('errorModal'));
    modal.show();
}

// ===== Initialize on DOM Ready =====
document.addEventListener('DOMContentLoaded', () => {
    initializeTableManagement();
    initializeCharts();
});

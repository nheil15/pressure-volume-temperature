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
    const detectedPressureRange = document.getElementById('detected_pressure_range');

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

    function createPsatRadioCell() {
        const cell = document.createElement('td');
        cell.dataset.field = 'psat';
        cell.className = 'text-center';
        cell.innerHTML = '<input type="radio" name="dl_psat" class="form-check-input dl-psat-radio">';
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
            .filter(field => field && !['pressure', 'bo', 'bubble_point', 'psat', 'action'].includes(field));
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

    function getDetectedCcePressureRange() {
        if (!cceTable) {
            return null;
        }

        const pressures = Array.from(cceTable.querySelectorAll('tbody tr')).map((row) => {
            const input = row.querySelector('td:first-child input[type="number"]');
            return input ? Number.parseFloat(input.value) : Number.NaN;
        }).filter((value) => Number.isFinite(value));

        if (pressures.length === 0) {
            return null;
        }

        return {
            minimum: Math.min(...pressures),
            maximum: Math.max(...pressures),
        };
    }

    function updateDetectedPressureRangeDisplay() {
        if (!detectedPressureRange) {
            return;
        }

        const range = getDetectedCcePressureRange();
        detectedPressureRange.textContent = range
            ? `${range.minimum.toFixed(1)} - ${range.maximum.toFixed(1)} psig`
            : '--';
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
            const bubbleRadio = newRow.querySelector('.dl-bubble-radio');
            setupBubblePointToggle(bubbleRadio, 'dl_table');

            const psatCell = createPsatRadioCell();
            newRow.appendChild(psatCell);
            const psatRadio = psatCell.querySelector('.dl-psat-radio');
            setupBubblePointToggle(psatRadio, 'dl_table');

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

        if (tableId === 'cce_table') {
            updateDetectedPressureRangeDisplay();
        }
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

        if (tableId === 'cce_table') {
            updateDetectedPressureRangeDisplay();
        }
    }

    function tableToCSV(tableId) {
        const table = document.getElementById(tableId);
        const headerCells = table.querySelectorAll('thead th');
        const rows = table.querySelectorAll('tbody tr');
        const data = [];
        const isDlTable = tableId === 'dl_table';

        if (headerCells.length > 0) {
            const headers = Array.from(headerCells)
                .filter((cell) => !cell.dataset.field || cell.dataset.field !== 'psat')
                .map((cell) => cell.textContent.trim());
            data.push(headers.join(','));
        }

        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            const values = [];
            let hasData = false;
            let psatChecked = false;

            if (isDlTable) {
                const psatRadio = row.querySelector('.dl-psat-radio');
                psatChecked = psatRadio ? psatRadio.checked : false;
            }

            cells.forEach((cell) => {
                if (cell.classList.contains('row-action-cell')) {
                    return;
                }

                // Skip the psat radio cell — it's encoded in the pressure value instead
                if (isDlTable && cell.dataset.field === 'psat') {
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
                let value = input ? input.value.trim() : '';

                // Append ** to pressure value if this row's psat radio is checked
                if (isDlTable && cell.dataset.field === 'pressure' && psatChecked && value) {
                    value = value + ' **';
                }

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
        const isPsat = text.includes('**');
        const isBubblePoint = !isPsat && text.includes('*');
        const pressure = text.replace(/\*/g, '').trim();
        return { pressure, isBubblePoint, isPsat };
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
                if (!field || field === 'bubble_point' || field === 'psat' || field === 'action') {
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

        updateDetectedPressureRangeDisplay();

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
            const bubbleRadio = row.querySelector('.dl-bubble-radio');
            setupBubblePointToggle(bubbleRadio, 'dl_table');
            bubbleRadio.checked = pressureInfo.isBubblePoint;

            const psatCell = createPsatRadioCell();
            row.appendChild(psatCell);
            const psatRadio = psatCell.querySelector('.dl-psat-radio');
            setupBubblePointToggle(psatRadio, 'dl_table');
            psatRadio.checked = pressureInfo.isPsat;

            row.appendChild(createDeleteCell('action'));
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
            const normalizedHeaders = headers.map(normalizeHeaderName);

            const dlColumnMappings = dlColumnConfig
                .map((config) => {
                    const csvIndex = normalizedHeaders.findIndex((header) =>
                        config.aliases.some((alias) => header.includes(alias))
                    );
                    if (csvIndex < 0) {
                        return null;
                    }
                    return {
                        field: config.field,
                        csvIndex,
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

            if (table.id === 'cce_table') {
                updateDetectedPressureRangeDisplay();
            }
        });
    });

    cceTable?.addEventListener('input', updateDetectedPressureRangeDisplay);
    cceTable?.addEventListener('change', updateDetectedPressureRangeDisplay);

    if (cceTable && typeof MutationObserver !== 'undefined') {
        const observer = new MutationObserver(() => updateDetectedPressureRangeDisplay());
        observer.observe(cceTable.querySelector('tbody') || cceTable, { childList: true, subtree: true });
    }

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

    document.querySelectorAll('.dl-psat-radio').forEach(radio => {
        setupBubblePointToggle(radio, 'dl_table');
    });

    updateDetectedPressureRangeDisplay();

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
            document.getElementById('psat_pressure').value = getSelectedPsatPressure();

            form.submit();
        });
    }
}

// ===== Chart Rendering =====
function initializeCharts() {
    const resultDataElement = document.getElementById('pvt-result-data');
    const rawResultData = window.pvtResultData || (resultDataElement ? JSON.parse(resultDataElement.textContent) : null);

    if (!rawResultData) {
        console.error('No PVT result data found');
        return;
    }

    if (typeof ApexCharts === 'undefined') {
        console.error('ApexCharts library not loaded');
        // Try again in a moment if ApexCharts is loading
        setTimeout(() => initializeCharts(), 1000);
        return;
    }

    const resultData = rawResultData.reservoirTemperature !== undefined
        ? rawResultData
        : {
            reservoirTemperature: rawResultData.reservoir_temperature,
            bubblePointPressure: rawResultData.bubble_point_pressure,
            submitted_inputs: rawResultData.submitted_inputs || {},
            cce: rawResultData.cce,
            dl: rawResultData.dl,
            ternaryPlots: rawResultData.ternary_plots || [],
            dl1PropertyPlots: rawResultData.dl1_property_plots || {},
            fingerprint: rawResultData.fingerprint ? {
                component: rawResultData.fingerprint.component,
                molarWeight: rawResultData.fingerprint.molar_weight,
                molePercent: rawResultData.fingerprint.mole_percent,
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
                criticalTemperature: rawResultData.phase_envelope.critical_temperature,
                criticalPressure: rawResultData.phase_envelope.critical_pressure,
                closureTemperature: rawResultData.phase_envelope.closure_temperature,
                closurePressure: rawResultData.phase_envelope.closure_pressure,
                cricondenthermTemperature: rawResultData.phase_envelope.cricondentherm_temperature,
                cricondenthermPressure: rawResultData.phase_envelope.cricondentherm_pressure,
                cricondenbarTemperature: rawResultData.phase_envelope.cricondenbar_temperature,
                cricondenbarPressure: rawResultData.phase_envelope.cricondenbar_pressure,
            } : null,
            ternaryPlots: rawResultData.ternary_plots || [],
            dl1PropertyPlots: rawResultData.dl1_property_plots || {},
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
            console.warn(`Chart container "${containerId}" not found`);
            return;
        }

        // Ensure container has proper dimensions
        if (!container.style.height) {
            container.style.height = '320px';
        }
        if (!container.style.width) {
            container.style.width = '100%';
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

        try {
            const chart = new ApexCharts(container, options);
            chart.render();
        } catch (error) {
            console.error(`Error rendering chart "${containerId}":`, error);
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #dc3545;">Error rendering chart</div>';
        }
    };

    // Add validation for chart data
    if (!resultData.cce || !resultData.cce.pressure || !resultData.cce.experimental || !resultData.cce.simulated) {
        console.warn('CCE data is incomplete or missing');
    } else {
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
    }

    // Add validation for DL data
    if (!resultData.dl || !resultData.dl.pressure || !resultData.dl.experimental || !resultData.dl.simulated) {
        console.warn('DL data is incomplete or missing');
    } else {
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
    }

    if (resultData.fingerprint && resultData.fingerprint.molarWeight && resultData.fingerprint.molarWeight.length > 0) {
        const fingerprintTraces = [
            {
                x: resultData.fingerprint.molarWeight,
                y: resultData.fingerprint.molePercent,
                text: resultData.fingerprint.component || [],
                name: 'Composition Signature',
                type: 'scatter',
                mode: 'lines+markers+text',
                textposition: 'top center',
                line: { color: '#0d6efd', width: 2.2 },
                marker: { size: 7, color: '#0d6efd' },
                hovertemplate: 'Component: %{text}<br>MW: %{x:.3f}<br>Mole %: %{y:.6f}<extra></extra>',
            },
        ];

        const fingerprintLayout = {
            title: 'Fingerprint Plot',
            xaxis: {
                title: 'Molar Weight',
            },
            yaxis: {
                title: 'Mole Percent (%)',
                type: 'log',
                autorange: true,
            },
            hovermode: 'closest',
            height: 320,
            margin: { t: 40, r: 20, b: 60, l: 70 },
        };

        Plotly.newPlot('fingerprintChart', fingerprintTraces, fingerprintLayout, { responsive: true });
    }

    if (resultData.phaseEnvelope && resultData.phaseEnvelope.temperature) {
        // Use actual reservoir temperature and bubble point from user input; no hardcoded fallbacks
        const operatingPointTemperature = resultData.submitted_inputs?.reservoir_temperature ?? resultData.reservoir_temperature ?? null;
        const operatingPointPressure = resultData.bubble_point_pressure
            ?? resultData.bubblePointPressure
            ?? resultData.submitted_inputs?.pressure_max
            ?? resultData.pressure_range?.maximum
            ?? null;

        // Bubble point graph using Plotly
        const bubblePointTraces = [
            {
                x: resultData.phaseEnvelope.temperature,
                y: resultData.phaseEnvelope.bubblePressure,
                name: 'Bubble Point',
                type: 'scatter',
                mode: 'lines+markers',
                line: { color: '#dc3545', width: 3 },
                marker: { size: 6 },
                fill: 'tozeroy',
                fillcolor: 'rgba(220, 53, 69, 0.1)',
            },
        ];

        const bubblePointLayout = {
            title: 'Bubble Point Pressure vs Temperature',
            xaxis: {
                title: 'Temperature (°F)',
                zeroline: false,
            },
            yaxis: {
                title: 'Bubble Point Pressure (psig)',
                zeroline: false,
            },
            hovermode: 'closest',
            height: 320,
            margin: { t: 40, r: 20, b: 60, l: 60 },
        };

        Plotly.newPlot('bubblePointChart', bubblePointTraces, bubblePointLayout, { responsive: true });

        // Phase envelope plot using Plotly
        const phaseLoopTemperature = [...resultData.phaseEnvelope.temperature, ...[...resultData.phaseEnvelope.temperature].slice().reverse()];
        const phaseLoopPressure = [...resultData.phaseEnvelope.bubblePressure, ...[...resultData.phaseEnvelope.dewPressure].slice().reverse()];

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
                x: phaseLoopTemperature,
                y: phaseLoopPressure,
                name: 'Closed Phase Envelope',
                type: 'scatter',
                mode: 'lines',
                line: { color: 'rgba(13, 110, 253, 0.25)', width: 1.5 },
                fill: 'toself',
                fillcolor: 'rgba(13, 110, 253, 0.08)',
                hoverinfo: 'skip',
                showlegend: false,
            },
        ];

        // Add operating point marker only when both temperature and pressure are provided
        const opTempNum = Number(operatingPointTemperature);
        const opPresNum = Number(operatingPointPressure);
        if (!Number.isNaN(opTempNum) && !Number.isNaN(opPresNum)) {
            phaseTraces.push({
                x: [opTempNum],
                y: [opPresNum],
                name: `Bubble Point (${opTempNum.toFixed(1)}°F, ${opPresNum.toFixed(1)} psig)`,
                type: 'scatter',
                mode: 'markers',
                marker: { size: 10, color: '#212529', symbol: 'circle' },
            });
        }

        const criticalTemp = Number(resultData.phaseEnvelope.criticalTemperature ?? resultData.phaseEnvelope.cricondenthermTemperature);
        const criticalPressure = Number(resultData.phaseEnvelope.criticalPressure ?? resultData.phaseEnvelope.cricondenthermPressure);
        if (Number.isFinite(criticalTemp) && Number.isFinite(criticalPressure)) {
            phaseTraces.push({
                x: [criticalTemp],
                y: [criticalPressure],
                name: 'Critical Point',
                type: 'scatter',
                mode: 'markers',
                marker: { size: 12, color: '#111827', symbol: 'diamond' },
            });
        }

        // Add markers for cricondenbar and cricondentherm if present
        const cdbTemp = Number(resultData.phaseEnvelope.cricondenbarTemperature);
        const cdbPres = Number(resultData.phaseEnvelope.cricondenbarPressure);
        if (Number.isFinite(cdbTemp) && Number.isFinite(cdbPres)) {
            phaseTraces.push({
                x: [cdbTemp],
                y: [cdbPres],
                name: 'Cricondenbar',
                type: 'scatter',
                mode: 'markers',
                marker: { size: 10, color: '#8b5cf6', symbol: 'circle' },
            });
        }

        const cdtTemp = Number(resultData.phaseEnvelope.cricondenthermTemperature);
        const cdtPres = Number(resultData.phaseEnvelope.cricondenthermPressure);
        if (Number.isFinite(cdtTemp) && Number.isFinite(cdtPres)) {
            phaseTraces.push({
                x: [cdtTemp],
                y: [cdtPres],
                name: 'Cricondentherm',
                type: 'scatter',
                mode: 'markers',
                marker: { size: 10, color: '#0f766e', symbol: 'circle' },
            });
        }

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
            shapes: (() => {
                // Only add a vertical operating-point line if a valid temperature is provided
                const shapes = [];
                if (!Number.isNaN(opTempNum)) {
                    shapes.push({
                        type: 'line',
                        x0: opTempNum,
                        y0: Math.min(...resultData.phaseEnvelope.bubblePressure),
                        x1: opTempNum,
                        y1: Math.max(...resultData.phaseEnvelope.dewPressure),
                        line: {
                            color: '#212529',
                            width: 1,
                            dash: 'dash',
                        },
                    });
                }
                return shapes;
            })(),
        };

        Plotly.newPlot('phaseEnvelopeChart', phaseTraces, phaseLayout, { responsive: true });
    }

    // ===== TERNARY PLOTS (Figures 3-5) ===== (skipped when data is empty)
    if (resultData.ternaryPlots && resultData.ternaryPlots.length >= 3) {
        const ternaryChartIds = ['ternaryChart1', 'ternaryChart2', 'ternaryChart3'];
        const ternarySubtitleIds = ['ternarySubtitle1', 'ternarySubtitle2', 'ternarySubtitle3'];
        const ternarySaveIds = ['ternarySave1', 'ternarySave2', 'ternarySave3'];

        function normalizeTernaryPoint(a, b, c) {
            const values = [Math.max(a || 0, 0), Math.max(b || 0, 0), Math.max(c || 0, 0)];
            const total = values[0] + values[1] + values[2] || 1;
            return values.map((value) => (value / total) * 100);
        }
        
        for (let i = 0; i < 3; i++) {
            try {
                const ternaryData = resultData.ternaryPlots[i];
                if (!ternaryData) continue;
                
                const ternaryPressure = Number(ternaryData.pressure) || 0;
                const ternaryTemperature = Number(ternaryData.temperature) || 0;
                const aValue = (Number(ternaryData.c1) || 0) * 100;
                const bValue = (Number(ternaryData.c2_c6) || 0) * 100;
                const cValue = (Number(ternaryData.c7_plus) || 0) * 100;

                const subtitleNode = document.getElementById(ternarySubtitleIds[i]);
                if (subtitleNode) {
                    subtitleNode.textContent = Number.isFinite(ternaryPressure) && ternaryPressure !== 0
                        ? `Ternary Plot at ${ternaryPressure.toFixed(1)} psi`
                        : 'Ternary Plot';
                }

                const saveButton = document.getElementById(ternarySaveIds[i]);
                if (saveButton && Number.isFinite(ternaryPressure) && ternaryPressure !== 0) {
                    saveButton.setAttribute('onclick', `savePNG('${ternaryChartIds[i]}', 'Ternary_${ternaryPressure.toFixed(0)}psi')`);
                }

                const shadedVertices = [
                    normalizeTernaryPoint(aValue + 7, bValue - 3.5, cValue - 3.5),
                    normalizeTernaryPoint(aValue - 3.5, bValue + 7, cValue - 3.5),
                    normalizeTernaryPoint(aValue - 3.5, bValue - 3.5, cValue + 7),
                ];

                const shadedTrace = {
                    a: [shadedVertices[0][0], shadedVertices[1][0], shadedVertices[2][0], shadedVertices[0][0]],
                    b: [shadedVertices[0][1], shadedVertices[1][1], shadedVertices[2][1], shadedVertices[0][1]],
                    c: [shadedVertices[0][2], shadedVertices[1][2], shadedVertices[2][2], shadedVertices[0][2]],
                    type: 'scatterternary',
                    mode: 'lines',
                    line: {
                        color: 'rgba(13, 110, 253, 0.55)',
                        width: 1.25,
                    },
                    fill: 'toself',
                    fillcolor: 'rgba(13, 110, 253, 0.16)',
                    hoverinfo: 'skip',
                    showlegend: false,
                    name: 'Shaded zone'
                };
                
                // Create Plotly ternary diagram
                const ternaryTrace = {
                    a: [aValue],
                    b: [bValue],
                    c: [cValue],
                    type: 'scatterternary',
                    mode: 'markers',
                    marker: {
                        size: 12,
                        color: '#0d6efd',
                        symbol: 'circle',
                        line: { color: '#0856ca', width: 2 }
                    },
                    text: [`C1: ${((Number(ternaryData.c1) || 0) * 100).toFixed(2)}%<br>C2-C6: ${((Number(ternaryData.c2_c6) || 0) * 100).toFixed(2)}%<br>C7+: ${((Number(ternaryData.c7_plus) || 0) * 100).toFixed(2)}%`],
                    hovertemplate: '%{text}<extra></extra>',
                    name: 'Composition'
                };

                const focusPoints = [...shadedVertices, [aValue, bValue, cValue]];
                const padding = 5;
                const minA = Math.max(0, Math.min(...focusPoints.map((point) => point[0])) - padding);
                const minB = Math.max(0, Math.min(...focusPoints.map((point) => point[1])) - padding);
                const minC = Math.max(0, Math.min(...focusPoints.map((point) => point[2])) - padding);
                
                const ternaryLayout = {
                    title: `Ternary Plot (T=${Number.isFinite(ternaryTemperature) ? ternaryTemperature.toFixed(1) : 'N/A'}°F, P=${Number.isFinite(ternaryPressure) ? ternaryPressure.toFixed(1) : 'N/A'} psi)`,
                    ternary: {
                        sum: 100,
                        aaxis: {
                            title: 'C1 (%)',
                            min: minA,
                            tickfont: { size: 12 },
                            showline: true,
                            showgrid: true,
                        },
                        baxis: {
                            title: 'C2-C6 (%)',
                            min: minB,
                            tickfont: { size: 12 },
                            showline: true,
                            showgrid: true,
                        },
                        caxis: {
                            title: 'C7+ (%)',
                            min: minC,
                            tickfont: { size: 12 },
                            showline: true,
                            showgrid: true,
                        }
                    },
                    height: 500,
                    margin: { t: 60, r: 60, b: 60, l: 60 },
                    font: { size: 11 },
                    showlegend: false
                };
                
                Plotly.newPlot(ternaryChartIds[i], [shadedTrace, ternaryTrace], ternaryLayout, { responsive: true });
            } catch (error) {
                console.error(`Error rendering ternary plot ${i}:`, error);
            }
        }
    }

    // ===== DL1 PROPERTY PLOTS (Figures 6-12) ===== (skipped when data is empty)
    if (resultData.dl1PropertyPlots && resultData.dl1PropertyPlots.pressure && resultData.dl1PropertyPlots.pressure.length > 0) {
        const props = resultData.dl1PropertyPlots;
        
        // Define bubble point early so it's available for all DL charts
        const bubblePoint = (resultData && resultData.bubble_point_pressure) ? Number(resultData.bubble_point_pressure) : null;
        
        const buildSortedPairs = (pressureValues, seriesValues) => pressureValues
            .map((value, index) => ({ pressure: Number(value), value: Number(seriesValues[index]) }))
            .filter((row) => Number.isFinite(row.pressure) && Number.isFinite(row.value))
            .sort((left, right) => left.pressure - right.pressure);

        const zCalcPairs = buildSortedPairs(props.pressure || [], props.z_factor_calculated || props.z_factor || []);
        const zObsPairs = buildSortedPairs(props.z_factor_observed_pressure || [], props.z_factor_observed || []);
        const densityCalcPairs = buildSortedPairs(props.liquid_density_calculated_pressure || [], props.liquid_density_calculated || []);
        const densityObsPairs = buildSortedPairs(props.liquid_density_observed_pressure || [], props.liquid_density_observed || []);
        const oilRelVolPairs = buildSortedPairs(props.pressure || [], props.oil_relative_volume || []);
        const gorCalcPairs = buildSortedPairs(props.gor_calculated_pressure || [], props.gor_calculated || []);
        const gorObsPairs = buildSortedPairs(props.gor_observed_pressure || [], props.gor_observed || []);
        const gasFvfCalcPairs = buildSortedPairs(props.gas_fvf_calculated_pressure || [], props.gas_fvf_calculated || []);
        const gasFvfObsPairs = buildSortedPairs(props.gas_fvf_observed_pressure || [], props.gas_fvf_observed || []);
        const gasGravityCalcPairs = buildSortedPairs(props.gas_gravity_calculated_pressure || [], props.gas_gravity_calculated || []);
        const gasGravityObsPairs = buildSortedPairs(props.gas_gravity_observed_pressure || [], props.gas_gravity_observed || []);

        const pressurePairs = buildSortedPairs(props.pressure, props.z_factor_calculated || props.z_factor || []);
        const orderedPressure = pressurePairs.map((row) => row.pressure);
        
        // Figure 6: CCE Relative Volume (using existing cceChart)
        // Already rendered above
        
        // Figure 7: DL Vapor Z-Factor
        const zFactorTraces = [{
            x: zCalcPairs.map((row) => row.pressure),
            y: zCalcPairs.map((row) => row.value),
            name: 'Calculated',
            type: 'scatter',
            mode: 'lines+markers',
            line: { color: '#0d6efd', width: 2 },
            marker: { size: 6 },
        }];

        if (zObsPairs.length > 0) {
            zFactorTraces.push({
                x: zObsPairs.map((row) => row.pressure),
                y: zObsPairs.map((row) => row.value),
                name: 'Observed',
                type: 'scatter',
                mode: 'lines+markers',
                line: { color: '#dc3545', width: 2 },
                marker: { size: 6 },
            });
        }

        // Auto-scale Z-Factor y-axis to show both calculated and observed
        const zCombinedY = [].concat(zCalcPairs.map(r => r.value), zObsPairs.map(r => r.value)).filter(Number.isFinite);
        let zRange = undefined;
        if (zCombinedY.length > 0) {
            const zMin = Math.min(...zCombinedY);
            const zMax = Math.max(...zCombinedY);
            const zPad = Math.max((zMax - zMin) * 0.1, 0.01);
            zRange = [Math.max(0, zMin - zPad), zMax + zPad];
        }
        const zFactorLayout = {
            title: 'DL Vapor Z-Factor vs Pressure',
            xaxis: { title: 'Pressure (psig)', range: bubblePoint ? [0, bubblePoint] : undefined },
            yaxis: { title: 'Z-Factor', range: zRange },
            height: 320,
            margin: { t: 40, r: 20, b: 60, l: 60 },
        };
        Plotly.newPlot('dlZFactorChart', zFactorTraces, zFactorLayout, { responsive: true });

        // Figure 8: DL Liquid Density (separate calculated and observed series)
        const densityTraces = [];
        if (densityCalcPairs.length > 0) {
            densityTraces.push({
                x: densityCalcPairs.map((row) => row.pressure),
                y: densityCalcPairs.map((row) => row.value),
                name: 'Calculated',
                type: 'scatter',
                mode: 'lines+markers',
                line: { color: '#0d6efd', width: 2 },
                marker: { size: 6 },
            });
        }
        if (densityObsPairs.length > 0) {
            densityTraces.push({
                x: densityObsPairs.map((row) => row.pressure),
                y: densityObsPairs.map((row) => row.value),
                name: 'Observed',
                type: 'scatter',
                mode: 'lines+markers',
                line: { color: '#dc3545', width: 2 },
                marker: { size: 6 },
            });
        }
        // Compute axis ranges dynamically: x-axis from 0 to bubble point if available,
        // y-axis auto-scaled to combined min/max of both series with small padding.
        const combinedY = [].concat(densityCalcPairs.map(r => r.value), densityObsPairs.map(r => r.value)).filter(Number.isFinite);
        let yRange = undefined;
        if (combinedY.length > 0) {
            const yMin = Math.min(...combinedY);
            const yMax = Math.max(...combinedY);
            const pad = Math.max((yMax - yMin) * 0.1, 0.5);
            yRange = [yMin - pad, yMax + pad];
        }
        const densityLayout = {
            title: 'DL Liquid Density vs Pressure',
            xaxis: { title: 'Pressure (psig)', range: bubblePoint ? [0, bubblePoint] : undefined },
            yaxis: { title: 'Density (lb/ft³)', range: yRange },
            height: 320,
            margin: { t: 40, r: 20, b: 60, l: 60 },
        };
        Plotly.newPlot('dlDensityChart', densityTraces, densityLayout, { responsive: true });

        // Figure 9: DL Gas-Oil Ratio
        const gorTraces = [];
        if (gorCalcPairs.length > 0) {
            gorTraces.push({
                x: gorCalcPairs.map((row) => row.pressure),
                y: gorCalcPairs.map((row) => row.value),
                name: 'Calculated',
                type: 'scatter',
                mode: 'lines+markers',
                line: { color: '#0d6efd', width: 2 },
                marker: { size: 6 },
            });
        }
        if (gorObsPairs.length > 0) {
            gorTraces.push({
                x: gorObsPairs.map((row) => row.pressure),
                y: gorObsPairs.map((row) => row.value),
                name: 'Observed',
                type: 'scatter',
                mode: 'lines+markers',
                line: { color: '#dc3545', width: 2 },
                marker: { size: 6 },
            });
        }
        // Auto-scale GOR y-axis to show both calculated and observed
        const gorCombinedY = [].concat(gorCalcPairs.map(r => r.value), gorObsPairs.map(r => r.value)).filter(Number.isFinite);
        let gorRange = undefined;
        if (gorCombinedY.length > 0) {
            const gorMin = Math.min(...gorCombinedY);
            const gorMax = Math.max(...gorCombinedY);
            const gorPad = Math.max((gorMax - gorMin) * 0.1, 0.05);
            gorRange = [Math.max(0, gorMin - gorPad), gorMax + gorPad];
        }
        const gorLayout = {
            title: 'DL Gas-Oil Ratio vs Pressure',
            xaxis: { title: 'Pressure (psig)', range: bubblePoint ? [0, bubblePoint] : undefined },
            yaxis: { title: 'GOR (Mscf/stb)', range: gorRange },
            height: 320,
            margin: { t: 40, r: 20, b: 60, l: 60 },
        };
        Plotly.newPlot('dlGORChart', gorTraces, gorLayout, { responsive: true });

        // Figure 10: DL Oil Relative Volume
        const oilRelVolTraces = [{
            x: oilRelVolPairs.map((row) => row.pressure),
            y: oilRelVolPairs.map((row) => row.value),
            name: 'Oil Rel Vol',
            type: 'scatter',
            mode: 'lines+markers',
            line: { color: '#0d6efd', width: 2 },
            marker: { size: 6 },
            fill: 'tozeroy',
            fillcolor: 'rgba(13, 110, 253, 0.1)',
        }];
        const oilRelVolLayout = {
            title: 'DL Oil Relative Volume vs Pressure',
            xaxis: { title: 'Pressure (psig)' },
            yaxis: { title: 'Oil Relative Volume' },
            height: 320,
            margin: { t: 40, r: 20, b: 60, l: 60 },
        };
        Plotly.newPlot('dlOilRelVolChart', oilRelVolTraces, oilRelVolLayout, { responsive: true });

        // Figure 11: DL Gas FVF
        const gasFvfTraces = [];
        if (gasFvfCalcPairs.length > 0) {
            gasFvfTraces.push({
                x: gasFvfCalcPairs.map((row) => row.pressure),
                y: gasFvfCalcPairs.map((row) => row.value),
                name: 'Calculated',
                type: 'scatter',
                mode: 'lines+markers',
                line: { color: '#0d6efd', width: 2 },
                marker: { size: 6 },
            });
        }
        if (gasFvfObsPairs.length > 0) {
            gasFvfTraces.push({
                x: gasFvfObsPairs.map((row) => row.pressure),
                y: gasFvfObsPairs.map((row) => row.value),
                name: 'Observed',
                type: 'scatter',
                mode: 'lines+markers',
                line: { color: '#dc3545', width: 2 },
                marker: { size: 6 },
            });
        }
        // Auto-scale Gas FVF y-axis to show both calculated and observed
        const gasFvfCombinedY = [].concat(gasFvfCalcPairs.map(r => r.value), gasFvfObsPairs.map(r => r.value)).filter(Number.isFinite);
        let gasFvfRange = undefined;
        if (gasFvfCombinedY.length > 0) {
            const gasFvfMin = Math.min(...gasFvfCombinedY);
            const gasFvfMax = Math.max(...gasFvfCombinedY);
            const gasFvfPad = Math.max((gasFvfMax - gasFvfMin) * 0.1, 5);
            gasFvfRange = [Math.max(0, gasFvfMin - gasFvfPad), gasFvfMax + gasFvfPad];
        }
        const gasFvfLayout = {
            title: 'DL Gas Formation Volume Factor vs Pressure',
            xaxis: { title: 'Pressure (psig)', range: bubblePoint ? [0, bubblePoint] : undefined },
            yaxis: { title: 'Gas FVF (rb/Mscf)', range: gasFvfRange },
            height: 320,
            margin: { t: 40, r: 20, b: 60, l: 60 },
        };
        Plotly.newPlot('dlGasFVFChart', gasFvfTraces, gasFvfLayout, { responsive: true });

        // Figure 12: DL Gas Gravity
        const gasGravityTraces = [];
        if (gasGravityCalcPairs.length > 0) {
            gasGravityTraces.push({
                x: gasGravityCalcPairs.map((row) => row.pressure),
                y: gasGravityCalcPairs.map((row) => row.value),
                name: 'Calculated',
                type: 'scatter',
                mode: 'lines+markers',
                line: { color: '#0d6efd', width: 2 },
                marker: { size: 6 },
            });
        }

        if (gasGravityObsPairs.length > 0) {
            gasGravityTraces.push({
                x: gasGravityObsPairs.map((row) => row.pressure),
                y: gasGravityObsPairs.map((row) => row.value),
                name: 'Observed',
                type: 'scatter',
                mode: 'lines+markers',
                line: { color: '#dc3545', width: 2 },
                marker: { size: 6 },
            });
        }

        const gasGravityLayout = {
            title: 'DL Gas Gravity vs Pressure',
            xaxis: { title: 'Pressure (psig)', range: bubblePoint ? [0, bubblePoint] : undefined },
            yaxis: (() => {
                const combinedValues = [
                    ...gasGravityCalcPairs.map((row) => row.value),
                    ...gasGravityObsPairs.map((row) => row.value),
                ];
                const values = combinedValues.filter((value) => Number.isFinite(Number(value)));
                const minValue = values.length ? Math.min(...values) : 0;
                const maxValue = values.length ? Math.max(...values) : 1;
                const span = Math.max(maxValue - minValue, 0.05);
                const padding = span * 0.2;
                return {
                    title: 'Gas Gravity (relative to air)',
                    range: [Math.max(0, minValue - padding), maxValue + padding],
                    fixedrange: false,
                };
            })(),
            height: 320,
            margin: { t: 40, r: 20, b: 60, l: 60 },
        };
        Plotly.newPlot('dlGasGravityChart', gasGravityTraces, gasGravityLayout, { responsive: true });

        // Figure 6: CCE Relative Volume
        const cceRelVolTraces = [{
            x: resultData.cce.pressure,
            y: resultData.cce.simulated,
            name: 'CCE Relative Volume',
            type: 'scatter',
            mode: 'lines+markers',
            line: { color: '#198754', width: 2 },
            marker: { size: 6 },
            fill: 'tozeroy',
            fillcolor: 'rgba(25, 135, 84, 0.1)',
        }];
        const cceRelVolLayout = {
            title: 'CCE Relative Volume vs Pressure',
            xaxis: { title: 'Pressure (psig)' },
            yaxis: { title: 'Relative Volume' },
            height: 320,
            margin: { t: 40, r: 20, b: 60, l: 60 },
        };
        Plotly.newPlot('cceRelVolChart', cceRelVolTraces, cceRelVolLayout, { responsive: true });
    }

}

// ===== Form Validation =====
function validateFormInput() {
    const errors = [];
    const temperature = document.getElementById('reservoir_temperature').value.trim();

    // Validate temperature
    if (!temperature) {
        errors.push('Reservoir temperature is required.');
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

    if (cceRows === 0) {
        errors.push('Please provide at least one complete row of data in the CCE table (both pressure and value required).');
    }

    if (dlRows === 0) {
        errors.push('Please provide at least one complete row of data in the DL table (both pressure and value required).');
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

function getSelectedPsatPressure() {
    const selectedPsat = Array.from(document.querySelectorAll('.dl-psat-radio')).find((radio) => radio.checked);
    if (!selectedPsat) {
        return '';
    }
    const row = selectedPsat.closest('tr');
    const pressureInput = row?.querySelector('td[data-field="pressure"] input');
    return pressureInput ? pressureInput.value.trim() : '';
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
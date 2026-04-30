// ===== Table Data Entry Management =====
function initializeTableManagement() {
    const form = document.getElementById('pvt_form');
    if (!form) {
        return; // Not on input page
    }

    const cceTable = document.getElementById('cce_table');
    const dlTable = document.getElementById('dl_table');
    const cceAddRowBtn = document.getElementById('cce_add_row');
    const dlAddRowBtn = document.getElementById('dl_add_row');
    const dlAddPropertiesBtn = document.getElementById('dl_add_properties');
    const dlPropertyOptions = document.querySelectorAll('.dl-property-chip');

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

        if (tableId === 'dl_table') {
            newRow.appendChild(createNumberCell('0.1', 'Pressure', 'pressure'));
            newRow.appendChild(createNumberCell('0.0001', 'Bo', 'bo'));

            getDlRowPropertyKeys().forEach((propertyKey) => {
                const definition = dlPropertyDefinitions[propertyKey];
                newRow.appendChild(createNumberCell(definition.step, definition.placeholder, propertyKey));
            });

            newRow.appendChild(createBubbleCell('dl_table'));
        } else {
            newRow.innerHTML = `
                <td><input type="number" step="0.1" class="form-control form-control-sm" placeholder="Pressure"></td>
                <td><input type="number" step="0.0001" class="form-control form-control-sm" placeholder="Value"></td>
                <td class="text-center">
                    <input type="radio" name="cce_bubble" class="form-check-input cce-bubble-radio">
                </td>
            `;

            const radio = newRow.querySelector('input[type="radio"]');
            setupBubblePointToggle(radio, tableId);
        }

        tbody.appendChild(newRow);
    }

    function setupBubblePointToggle(radio, tableId) {
        radio.addEventListener('mousedown', (e) => {
            if (radio.checked) {
                e.preventDefault();
                radio.checked = false;
            }
        });
    }

    function deleteRowFromTable(button) {
        const row = button.closest('tr');
        row.remove();
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

    if (cceAddRowBtn) {
        cceAddRowBtn.addEventListener('click', (e) => {
            e.preventDefault();
            addRowToTable('cce_table');
        });
    }

    if (dlAddRowBtn) {
        dlAddRowBtn.addEventListener('click', (e) => {
            e.preventDefault();
            addRowToTable('dl_table');
        });
    }

    if (dlAddPropertiesBtn) {
        dlAddPropertiesBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const selectedKeys = Array.from(dlPropertyOptions)
                .filter((option) => option.classList.contains('dl-property-chip-selected'))
                .map((option) => option.dataset.propertyKey);

            syncDlPropertyColumns(selectedKeys);
        });
    }

    dlPropertyOptions.forEach((chip) => {
        setPropertyChipState(chip, false);
        chip.addEventListener('click', () => {
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

            document.getElementById('cce_data').value = cceCSV;
            document.getElementById('dl_data').value = dlCSV;

            form.submit();
        });
    }
}

// ===== Chart Rendering =====
function initializeCharts() {
    const resultData = window.pvtResultData;

    if (!resultData || typeof Chart === 'undefined') {
        return;
    }

    const bubblePoint = Number(resultData.bubblePointPressure);

    const createPoints = (pressureValues, valueValues) => pressureValues.map((pressure, index) => ({
        x: Number(pressure),
        y: Number(valueValues[index]),
    }));

    const bubbleLinePlugin = {
        id: 'bubbleLinePlugin',
        afterDraw(chart, args, options) {
            const bubbleValue = options?.bubblePoint;

            if (!bubbleValue || !chart.scales.x) {
                return;
            }

            const x = chart.scales.x.getPixelForValue(bubbleValue);
            const { top, bottom } = chart.chartArea;
            const context = chart.ctx;

            context.save();
            context.beginPath();
            context.moveTo(x, top);
            context.lineTo(x, bottom);
            context.lineWidth = 1;
            context.setLineDash([6, 4]);
            context.strokeStyle = 'rgba(220, 53, 69, 0.9)';
            context.stroke();
            context.restore();
        },
    };

    const buildChart = (canvasId, title, experimentalLabel, simulatedLabel, data) => {
        const canvas = document.getElementById(canvasId);

        if (!canvas) {
            return;
        }

        new Chart(canvas, {
            type: 'line',
            data: {
                datasets: [
                    {
                        label: experimentalLabel,
                        data: createPoints(data.pressure, data.experimental),
                        borderColor: '#0d6efd',
                        backgroundColor: 'rgba(13, 110, 253, 0.15)',
                        tension: 0.25,
                        fill: false,
                    },
                    {
                        label: simulatedLabel,
                        data: createPoints(data.pressure, data.simulated),
                        borderColor: '#198754',
                        backgroundColor: 'rgba(25, 135, 84, 0.12)',
                        tension: 0.25,
                        fill: false,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                    },
                    title: {
                        display: true,
                        text: title,
                    },
                    bubbleLinePlugin: {
                        bubblePoint,
                    },
                },
                scales: {
                    x: {
                        type: 'linear',
                        title: {
                            display: true,
                            text: 'Pressure (psig)',
                        },
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Value',
                        },
                    },
                },
            },
            plugins: [bubbleLinePlugin],
        });
    };

    buildChart('cceChart', 'CCE: Relative Volume vs Pressure', 'Experimental CCE', 'Simulated CCE', resultData.cce);
    buildChart('dlChart', 'DL: Oil Volume Factor vs Pressure', 'Experimental DL', 'Simulated DL', resultData.dl);
}

// ===== Form Validation =====
function validateFormInput() {
    const errors = [];
    const temperature = document.getElementById('reservoir_temperature').value.trim();
    const pressureMin = document.getElementById('pressure_min').value.trim();
    const pressureMax = document.getElementById('pressure_max').value.trim();
    const pressureStep = document.getElementById('pressure_step').value.trim();

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
    if (!pressureStep) {
        errors.push('Pressure step is required.');
    }

    // Validate data tables
    const cceRows = getValidTableRows('cce_table');
    const dlRows = getValidTableRows('dl_table');

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

function showErrorModal(errors) {
    const errorMessage = document.getElementById('errorMessage');
    const errorList = '<strong>Please fix the following issues:</strong><ul class="mt-2">';
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

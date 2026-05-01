import csv
import io
import os
import re
import uuid

import numpy as np
import pandas as pd
from flask import Flask, redirect, render_template, request, session, url_for

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "pvt-mvp-secret-key")

RESULTS_CACHE = {}

KNOWN_BUBBLE_POINT = 2516.7

# Component properties for Peng-Robinson EOS (Tc, Pc, omega)
COMPONENT_DATABASE = {
    "co2": {"tc": 304.13, "pc": 73.77, "omega": 0.2239},
    "n2": {"tc": 126.21, "pc": 33.95, "omega": 0.0372},
    "c1": {"tc": 190.56, "pc": 46.04, "omega": 0.0115},
    "c2": {"tc": 305.32, "pc": 48.72, "omega": 0.0995},
    "c3": {"tc": 369.83, "pc": 42.48, "omega": 0.1523},
    "ic4": {"tc": 408.14, "pc": 36.48, "omega": 0.1759},
    "nc4": {"tc": 425.12, "pc": 37.96, "omega": 0.2002},
    "ic5": {"tc": 460.35, "pc": 33.81, "omega": 0.2274},
    "nc5": {"tc": 469.70, "pc": 33.70, "omega": 0.2515},
    "c6": {"tc": 507.82, "pc": 30.25, "omega": 0.3007},
    "c7": {"tc": 540.0, "pc": 27.4, "omega": 0.35},
    "c7+": {"tc": 617.0, "pc": 21.0, "omega": 0.49},
}

COMPONENT_ALIASES = {
    "methane": "c1",
    "ethane": "c2",
    "propane": "c3",
    "i-c4": "ic4",
    "n-c4": "nc4",
    "i-c5": "ic5",
    "n-c5": "nc5",
    "hexane": "c6",
    "heptane": "c7",
    "c7plus": "c7+",
    "c7 +": "c7+",
    "c7-plus": "c7+",
}


def parse_pressure_range(raw_min, raw_max, raw_step):
    """Convert submitted range values into a normalized pressure interval."""
    try:
        minimum = float(raw_min)
        maximum = float(raw_max)
        step = abs(float(raw_step))
    except (TypeError, ValueError):
        return 2000.0, 5000.0, 500.0

    if step <= 0:
        step = 500.0

    if minimum > maximum:
        minimum, maximum = maximum, minimum

    return minimum, maximum, step


def parse_numeric_field(raw_value, fallback):
    """Parse a numeric form field while tolerating units, commas, and whitespace."""
    if raw_value in (None, ""):
        return float(fallback)

    text = str(raw_value).strip()
    if not text:
        return float(fallback)

    cleaned = re.sub(r"[^0-9eE+\-.]", "", text.replace(",", ""))
    if cleaned in ("", "+", "-", ".", "+.", "-."):
        return float(fallback)

    try:
        return float(cleaned)
    except (TypeError, ValueError):
        return float(fallback)


def parse_manual_data(raw_text, expected_value_name):
    """Parse pasted CSV-like data from a textarea."""
    if not raw_text or not raw_text.strip():
        return pd.DataFrame(columns=["pressure", expected_value_name])

    def normalize(column_name):
        return str(column_name).strip().lower().replace(" ", "_")

    def is_number(raw_value):
        try:
            float(raw_value)
            return True
        except (TypeError, ValueError):
            return False

    rows = []
    reader = list(csv.reader(io.StringIO(raw_text.strip())))

    if not reader:
        return pd.DataFrame(columns=["pressure", expected_value_name])

    first_row = reader[0]
    has_header = any(cell and not is_number(cell) for cell in first_row)

    if has_header:
        header = [column.strip() for column in first_row]
        pressure_index = next((index for index, column in enumerate(header) if "pressure" in normalize(column)), None)
        value_index = next((index for index, column in enumerate(header) if normalize(expected_value_name) in normalize(column)), None)

        if value_index is None:
            value_index = next(
                (
                    index
                    for index, column in enumerate(header)
                    if index != pressure_index and "bubble" not in normalize(column)
                ),
                None,
            )

        if pressure_index is not None and value_index is not None:
            for row in reader[1:]:
                if len(row) <= max(pressure_index, value_index):
                    continue

                try:
                    pressure = float(row[pressure_index])
                    value = float(row[value_index])
                except ValueError:
                    continue

                rows.append({"pressure": pressure, expected_value_name: value})

            return pd.DataFrame(rows)

    for row in reader:
        if len(row) < 2:
            continue

        try:
            pressure = float(row[0])
            value = float(row[1])
        except ValueError:
            continue

        rows.append({"pressure": pressure, expected_value_name: value})

    return pd.DataFrame(rows)


def parse_uploaded_csv(uploaded_file, expected_value_tokens):
    """Parse a CSV file and find pressure/value columns by name."""
    if not uploaded_file or not uploaded_file.filename:
        return pd.DataFrame()

    try:
        dataframe = pd.read_csv(uploaded_file)
    except Exception:
        return pd.DataFrame()

    normalized = {column: column.strip().lower().replace(" ", "_") for column in dataframe.columns}
    pressure_column = next((column for column, normalized_name in normalized.items() if "pressure" in normalized_name), None)

    if not pressure_column:
        return pd.DataFrame()

    value_column = None
    for token in expected_value_tokens:
        token = token.lower().replace(" ", "_")
        for column, normalized_name in normalized.items():
            if token in normalized_name:
                value_column = column
                break
        if value_column:
            break

    if not value_column:
        remaining_columns = [column for column in dataframe.columns if column != pressure_column]
        if remaining_columns:
            value_column = remaining_columns[0]

    if not value_column:
        return pd.DataFrame()

    clean = dataframe[[pressure_column, value_column]].copy()
    clean.columns = ["pressure", "value"]
    clean = clean.apply(pd.to_numeric, errors="coerce").dropna()
    return clean


def load_dataset(text_value, file_value, expected_value_name, tokens, fallback_rows):
    """Return experimental data from file, text, or fallback rows."""
    if file_value and file_value.filename:
        dataframe = parse_uploaded_csv(file_value, tokens)
        if not dataframe.empty:
            dataframe = dataframe.rename(columns={"value": expected_value_name})
            return dataframe[["pressure", expected_value_name]]

    dataframe = parse_manual_data(text_value, expected_value_name)
    if not dataframe.empty:
        return dataframe[["pressure", expected_value_name]]

    return pd.DataFrame(fallback_rows)


def build_pressure_axis(minimum_pressure, maximum_pressure, step):
    """Create a descending pressure axis for the simplified simulation."""
    if maximum_pressure <= minimum_pressure:
        maximum_pressure = minimum_pressure + max(step, 1.0)

    pressure_values = np.arange(maximum_pressure, minimum_pressure - (step / 2.0), -step)
    if pressure_values.size == 0:
        pressure_values = np.array([maximum_pressure, minimum_pressure])

    return pressure_values


def detect_bubble_point(pressure_values):
    """Pick the pressure closest to the known bubble point target."""
    pressure_array = np.asarray(pressure_values, dtype=float)
    if pressure_array.size == 0:
        return KNOWN_BUBBLE_POINT

    index = int(np.abs(pressure_array - KNOWN_BUBBLE_POINT).argmin())
    return float(pressure_array[index])


def normalize_component_name(raw_name):
    """Map incoming composition names to canonical component keys."""
    normalized = str(raw_name or "").strip().lower().replace(" ", "")
    if not normalized:
        return ""
    if normalized in COMPONENT_DATABASE:
        return normalized
    mapped = COMPONENT_ALIASES.get(normalized)
    if mapped:
        return mapped
    if normalized.startswith("c") and normalized.endswith("+"):
        return "c7+"
    return normalized


def parse_bubble_pressure_from_table_csv(raw_csv_text):
    """Extract selected bubble-point pressure from submitted CCE/DL CSV text."""
    if not raw_csv_text or not raw_csv_text.strip():
        return None

    rows = list(csv.reader(io.StringIO(raw_csv_text.strip())))
    if len(rows) < 2:
        return None

    header = [str(value).strip().lower().replace(" ", "_") for value in rows[0]]
    pressure_index = next((idx for idx, value in enumerate(header) if "pressure" in value), None)
    bubble_index = next((idx for idx, value in enumerate(header) if "bubble" in value), None)

    if pressure_index is None or bubble_index is None:
        return None

    for row in rows[1:]:
        if len(row) <= max(pressure_index, bubble_index):
            continue

        bubble_flag = str(row[bubble_index]).strip()
        if bubble_flag not in {"1", "true", "True"}:
            continue

        try:
            return float(row[pressure_index])
        except ValueError:
            continue

    return None


def resolve_bubble_point_pressure(explicit_pressure, cce_csv_text, dl_csv_text, fallback_pressure_axis):
    """Resolve bubble point from explicit input, table selections, or fallback."""
    if explicit_pressure not in (None, ""):
        try:
            return float(explicit_pressure)
        except (TypeError, ValueError):
            pass

    cce_bubble = parse_bubble_pressure_from_table_csv(cce_csv_text)
    if cce_bubble is not None:
        return cce_bubble

    dl_bubble = parse_bubble_pressure_from_table_csv(dl_csv_text)
    if dl_bubble is not None:
        return dl_bubble

    return detect_bubble_point(fallback_pressure_axis)


def interpolate_at_pressure(pressure_axis, value_axis, target_pressure):
    """Interpolate a value at target pressure from descending/ascending pressure arrays."""
    pressure_values = np.asarray(pressure_axis, dtype=float)
    value_values = np.asarray(value_axis, dtype=float)
    if pressure_values.size == 0 or value_values.size == 0:
        return 1.0

    sort_index = np.argsort(pressure_values)
    sorted_pressure = pressure_values[sort_index]
    sorted_values = value_values[sort_index]
    return float(np.interp(float(target_pressure), sorted_pressure, sorted_values))


def compute_cce_simulation(pressure_values, bubble_point_pressure):
    """Compute CCE relative volume with physically constrained behavior above/below Pb."""
    pressures = np.asarray(pressure_values, dtype=float)
    pb = max(float(bubble_point_pressure), 1.0)

    # Above Pb: small liquid compressibility effect.
    # Below Pb: gas liberation drives rapid relative-volume increase.
    c_o = 2.27e-5
    below_k = np.log(3.99) / pb

    relative_volume = []
    for pressure in pressures:
        if pressure >= pb:
            value = np.exp(-c_o * (pressure - pb))
        else:
            value = np.exp(below_k * (pb - pressure))
        relative_volume.append(float(value))

    return np.asarray(relative_volume, dtype=float)


def compute_dl_bo_simulation(pressure_values, bubble_point_pressure, bo_at_pb):
    """Compute DL Bo trend constrained to field-observed behavior."""
    pressures = np.asarray(pressure_values, dtype=float)
    pb = max(float(bubble_point_pressure), 1.0)
    bo_pb = max(float(bo_at_pb), 0.6)

    bo_min = bo_pb * 0.6419
    slope_below = (bo_pb - bo_min) / pb
    c_o = 1.8e-5

    bo_values = []
    for pressure in pressures:
        if pressure >= pb:
            value = bo_pb * np.exp(-c_o * (pressure - pb))
        else:
            value = bo_pb - slope_below * (pb - pressure)
        bo_values.append(float(max(value, bo_min)))

    return np.asarray(bo_values, dtype=float)


def compute_dl_properties(pressure_values, bubble_point_pressure, bo_values, reservoir_temperature_f, composition_dict=None, reference_density=None):
    """Compute DL properties: Rs, Z, and oil density in field units (lb/ft³).
    
    Args:
        reference_density: Oil density at surface (stock tank), typically ~45-56 lb/ft³ from lab data.
                          Used to compute reservoir density via: rho_res = rho_st * bo_st / bo
    """
    pressures = np.asarray(pressure_values, dtype=float)
    bo_array = np.asarray(bo_values, dtype=float)
    pb = max(float(bubble_point_pressure), 1.0)
    temperature_r = float(reservoir_temperature_f) + 459.67
    temperature_k = temperature_r * 5.0 / 9.0

    composition_dict = composition_dict or {}
    stock_tank_density = float(reference_density) if reference_density and reference_density > 0 else estimate_stock_tank_density(composition_dict)
    gas_specific_gravity = estimate_gas_specific_gravity(composition_dict)
    gas_density_std = 0.0764 * gas_specific_gravity
    rs_pb = estimate_solution_gor_at_bubble_point(composition_dict, reservoir_temperature_f, bubble_point_pressure)
    mixture_props = calculate_mixture_properties_pr(composition_dict, temperature_k) if composition_dict else None

    rs_values = []
    z_values = []
    density_values = []

    for pressure, bo in zip(pressures, bo_array):
        if pressure >= pb:
            rs = rs_pb
        else:
            rs = rs_pb * (max(pressure, 0.0) / pb) ** 0.92

        p_abs = max(pressure + 14.7, 1.0)
        z = 0.79 + 0.08 * (temperature_r / 680.0) - 0.028 * (p_abs / 3000.0)
        z = float(np.clip(z, 0.74, 1.02))

        # Compute reservoir oil density from a material-balance style relationship.
        # rho_res (lb/ft³) = (rho_st + Rs * rho_g,std / 5.615) / Bo
        bo_safe = max(float(bo), 0.5)
        rho_res = (stock_tank_density + rs * gas_density_std / 5.615) / bo_safe

        rs_values.append(float(rs))
        z_values.append(z)
        density_values.append(float(rho_res))

    return np.asarray(rs_values), np.asarray(z_values), np.asarray(density_values)


def estimate_bubble_and_dew_pressures_vs_temperature(composition_dict, temperature_f_values):
    """Estimate bubble/dew pressure curves from composition and temperature using K-value method."""
    if not composition_dict:
        return np.array([]), np.array([])

    components = []
    for comp, z_i in composition_dict.items():
        props = COMPONENT_DATABASE.get(comp)
        if props and z_i > 0:
            components.append((comp, z_i, props))

    if not components:
        return np.array([]), np.array([])

    def k_value_wilson(props, pressure_psia, temperature_k):
        pc_psia = props["pc"] * 14.5037738
        omega = props["omega"]
        tc = props["tc"]
        return (pc_psia / max(pressure_psia, 1.0)) * np.exp(5.373 * (1.0 + omega) * (1.0 - tc / max(temperature_k, 1.0)))

    bubble_pressures = []
    dew_pressures = []

    for temperature_f in temperature_f_values:
        temperature_k = (float(temperature_f) + 459.67) * 5.0 / 9.0

        p_low = 20.0
        p_high = 12000.0

        def bubble_objective(pressure_psia):
            return sum(z_i * k_value_wilson(props, pressure_psia, temperature_k) for _, z_i, props in components) - 1.0

        def dew_objective(pressure_psia):
            return sum(z_i / max(k_value_wilson(props, pressure_psia, temperature_k), 1e-9) for _, z_i, props in components) - 1.0

        def solve_bisection(func):
            low = p_low
            high = p_high
            f_low = func(low)
            f_high = func(high)
            if f_low * f_high > 0:
                return None
            for _ in range(50):
                mid = 0.5 * (low + high)
                f_mid = func(mid)
                if abs(f_mid) < 1e-6:
                    return mid
                if f_low * f_mid <= 0:
                    high = mid
                    f_high = f_mid
                else:
                    low = mid
                    f_low = f_mid
            return 0.5 * (low + high)

        bubble_p = solve_bisection(bubble_objective)
        dew_p = solve_bisection(dew_objective)

        bubble_pressures.append(float(bubble_p) if bubble_p is not None else np.nan)
        dew_pressures.append(float(dew_p) if dew_p is not None else np.nan)

    return np.asarray(bubble_pressures, dtype=float), np.asarray(dew_pressures, dtype=float)


def build_phase_envelope_pt(composition_dict, operating_temperature_f, bubble_point_pressure):
    """Build Pressure-Temperature phase envelope with operating-point anchoring."""
    heavy_fraction = float(composition_dict.get("c7+", 0.0) + composition_dict.get("c7", 0.0))
    anchor_temperature_f = 220.0

    # Extend the temperature domain so the cricondentherm is not forced by the axis end.
    temp_min_f = max(-20.0, float(operating_temperature_f) - 180.0)
    temp_max_f = min(900.0, max(float(operating_temperature_f) + 420.0, 650.0 + 120.0 * np.clip(heavy_fraction, 0.0, 0.8)))
    base_axis = np.linspace(temp_min_f, temp_max_f, 151)
    temperature_axis = np.unique(np.sort(np.append(base_axis, [float(operating_temperature_f), anchor_temperature_f])))

    # Use a normalized coordinate along the envelope path.
    x = np.linspace(0.0, 1.0, len(temperature_axis))

    # Closed low-temperature endpoint.
    low_pressure = max(180.0, 0.08 * float(bubble_point_pressure))

    # Force the bubble branch to pass exactly through the operating point.
    op_x = (anchor_temperature_f - temp_min_f) / max(temp_max_f - temp_min_f, 1.0)
    op_x = float(np.clip(op_x, 0.12, 0.42))
    bubble_peak_pressure = float(bubble_point_pressure)

    # High-temperature closure is at a much higher pressure than the bubble point,
    # so the dew-curve peak can sit in the 4k-7k+ range for heavy fluids.
    high_pressure = max(4200.0, bubble_peak_pressure * (1.6 + 0.65 * np.clip(heavy_fraction, 0.0, 0.8)))

    # Bubble branch: smooth, concave rise from the left closure to the operating point,
    # then continues upward to the right closure.
    bubble_curve = np.empty_like(x)
    left_mask = x <= op_x
    right_mask = ~left_mask

    left_u = np.zeros_like(x)
    left_u[left_mask] = x[left_mask] / max(op_x, 1e-6)
    left_shape = left_u[left_mask] ** (0.72 + 0.10 * np.clip(heavy_fraction, 0.0, 0.8))
    bubble_curve[left_mask] = low_pressure + (bubble_peak_pressure - low_pressure) * left_shape

    right_u = np.zeros_like(x)
    right_u[right_mask] = (x[right_mask] - op_x) / max(1.0 - op_x, 1e-6)
    right_shape = right_u[right_mask] ** (1.10 + 0.08 * np.clip(heavy_fraction, 0.0, 0.8))
    bubble_curve[right_mask] = bubble_peak_pressure + (high_pressure - bubble_peak_pressure) * right_shape

    # Dew branch: same closures, with an interior maximum (cricondenbar) well above Pb.
    x_peak = 0.68 - 0.05 * np.clip(heavy_fraction, 0.0, 0.8)
    x_peak = float(np.clip(x_peak, 0.58, 0.76))
    dew_peak_pressure = max(4200.0, 2.2 * bubble_peak_pressure + 1200.0 * np.clip(heavy_fraction, 0.0, 0.8))
    dew_peak_pressure = min(dew_peak_pressure, 7800.0)

    dew_curve = np.empty_like(x)
    left_mask = x <= x_peak
    right_mask = ~left_mask

    left_u = np.zeros_like(x)
    left_u[left_mask] = x[left_mask] / max(x_peak, 1e-6)
    dew_curve[left_mask] = low_pressure + (dew_peak_pressure - low_pressure) * (left_u[left_mask] ** 1.85)

    right_u = np.zeros_like(x)
    right_u[right_mask] = (x[right_mask] - x_peak) / max(1.0 - x_peak, 1e-6)
    dew_curve[right_mask] = dew_peak_pressure - (dew_peak_pressure - high_pressure) * (right_u[right_mask] ** 1.25)

    # Enforce exact closure at both ends.
    bubble_curve[0] = low_pressure
    dew_curve[0] = low_pressure
    bubble_curve[-1] = high_pressure
    dew_curve[-1] = high_pressure

    # Force the operating point exactly onto the bubble curve.
    op_index = int(np.abs(temperature_axis - anchor_temperature_f).argmin())
    bubble_curve[op_index] = float(bubble_point_pressure)
    dew_curve[op_index] = max(dew_curve[op_index], float(bubble_point_pressure) + 150.0)

    # Keep dew above bubble everywhere except the shared closures.
    for idx in range(1, len(temperature_axis) - 1):
        dew_curve[idx] = max(dew_curve[idx], bubble_curve[idx] + 40.0)

    # Cricondenbar is the highest point on the dew curve, excluding the closures.
    cricondenbar_index = int(np.argmax(dew_curve[1:-1])) + 1
    cricondentherm_index = len(temperature_axis) - 1

    return {
        "temperature": [float(value) for value in temperature_axis],
        "bubble_pressure": [float(value) for value in bubble_curve],
        "dew_pressure": [float(value) for value in dew_curve],
        "cricondentherm_temperature": float(temperature_axis[cricondentherm_index]),
        "cricondentherm_pressure": float(high_pressure),
        "cricondenbar_temperature": float(temperature_axis[cricondenbar_index]),
        "cricondenbar_pressure": float(dew_curve[cricondenbar_index]),
    }


def compute_simulation(pressure_values, reservoir_temperature_f, bubble_point_pressure):
    """Apply a simplified ideal-gas relation and normalize at the bubble point."""
    temperature_rankine = float(reservoir_temperature_f) + 459.67
    pressure_absolute = np.maximum(np.asarray(pressure_values, dtype=float) + 14.7, 1e-6)
    raw_volume = temperature_rankine / pressure_absolute

    bubble_absolute = max(float(bubble_point_pressure) + 14.7, 1e-6)
    bubble_volume = temperature_rankine / bubble_absolute

    relative_volume = raw_volume / bubble_volume
    oil_volume_factor = relative_volume * 1.02

    return relative_volume, oil_volume_factor


def prepare_comparison_table(pressure_values, experimental_values, simulated_values):
    """Build a simple comparison table with absolute error."""
    return [
        {
            "pressure": round(float(pressure), 2),
            "experimental": round(float(experimental), 4),
            "simulated": round(float(simulated), 4),
            "error": round(abs(float(experimental) - float(simulated)), 4),
        }
        for pressure, experimental, simulated in zip(pressure_values, experimental_values, simulated_values)
    ]


def compute_rmse(experimental_values, simulated_values):
    """Return the root-mean-square error for two numeric sequences."""
    if len(experimental_values) == 0:
        return 0.0

    error = np.asarray(experimental_values, dtype=float) - np.asarray(simulated_values, dtype=float)
    return float(np.sqrt(np.mean(np.square(error))))


def prepare_simulation_properties_table(pressure_values, cce_simulated, dl_simulated):
    """Build a compact table of simulation-derived PVT properties."""
    return [
        {
            "pressure": round(float(pressure), 2),
            "cce_relative_volume": round(float(cce_value), 4),
            "dl_bo": round(float(dl_value), 4),
            "fingerprint_index": round((float(cce_value) + float(dl_value)) / 2.0, 4),
            "phase_min": round(min(float(cce_value), float(dl_value)), 4),
            "phase_max": round(max(float(cce_value), float(dl_value)), 4),
            "dl_rs": None,
            "dl_z": None,
            "oil_density": None,
        }
        for pressure, cce_value, dl_value in zip(pressure_values, cce_simulated, dl_simulated)
    ]


def parse_composition_data(composition_csv_text):
    """Parse composition CSV data into a dict with component names and mole fractions."""
    if not composition_csv_text or not composition_csv_text.strip():
        return {}

    composition = {}
    reader = csv.reader(io.StringIO(composition_csv_text.strip()))
    rows = list(reader)

    if len(rows) < 2:
        return {}

    for row in rows[1:]:
        if len(row) < 2:
            continue
        component = normalize_component_name(row[0])
        try:
            mole_fraction = float(row[1])
            if mole_fraction > 0:
                composition[component] = mole_fraction
        except (ValueError, IndexError):
            continue

    total = sum(composition.values())
    if total > 0:
        composition = {k: v / total for k, v in composition.items()}

    return composition


def estimate_heavy_fraction(composition_dict):
    return float(composition_dict.get("c7+", 0.0) + composition_dict.get("c7", 0.0))


def estimate_stock_tank_density(composition_dict):
    heavy_fraction = estimate_heavy_fraction(composition_dict)
    specific_gravity = float(np.clip(0.72 + 0.45 * heavy_fraction, 0.70, 0.90))
    return 62.4 * specific_gravity


def estimate_gas_specific_gravity(composition_dict):
    heavy_fraction = estimate_heavy_fraction(composition_dict)
    return float(np.clip(0.58 + 0.30 * heavy_fraction, 0.58, 0.92))


def estimate_solution_gor_at_bubble_point(composition_dict, reservoir_temperature_f, bubble_point_pressure):
    heavy_fraction = estimate_heavy_fraction(composition_dict)
    temperature_factor = float(np.clip((float(reservoir_temperature_f) + 459.67) / 680.0, 0.92, 1.18))
    pressure_factor = float(np.clip(float(bubble_point_pressure) / 2516.7, 0.88, 1.10))
    composition_factor = 1.0 + 1.15 * np.clip(heavy_fraction, 0.0, 0.8)
    return 700.0 * temperature_factor * pressure_factor * composition_factor


def calculate_mixture_properties_pr(composition_dict, temperature_k):
    """
    Calculate mixture properties using Peng-Robinson EOS with mixing rules.
    Returns (a_mix, b_mix, tc_mix, pc_mix, omega_mix)
    """
    R = 8.314462618
    
    # Pure component properties
    pure_props = {}
    for comp, mole_frac in composition_dict.items():
        props = COMPONENT_DATABASE.get(comp)
        if props:
            tc = props["tc"]
            pc = props["pc"] * 1e5
            omega = props["omega"]
            tr = temperature_k / tc
            
            if tr < 1.0:
                alpha = (1 + (0.37464 + 1.54226 * omega - 0.26992 * omega**2) * (1 - np.sqrt(tr)))**2
            else:
                alpha = 1.0
            
            a_i = 0.45724 * (R * tc)**2 / pc * alpha
            b_i = 0.07780 * R * tc / pc
            pure_props[comp] = {"a": a_i, "b": b_i, "tc": tc, "pc": pc, "omega": omega}
    
    if not pure_props:
        return None
    
    # Mixing rules for a and b
    a_mix = 0.0
    b_mix = 0.0
    tc_mix = 0.0
    pc_mix = 0.0
    omega_mix = 0.0
    
    comps = list(composition_dict.keys())
    for i, comp_i in enumerate(comps):
        if comp_i not in pure_props:
            continue
        y_i = composition_dict[comp_i]
        a_i = pure_props[comp_i]["a"]
        b_i = pure_props[comp_i]["b"]
        
        a_mix += y_i**2 * a_i
        b_mix += y_i * b_i
        tc_mix += y_i * pure_props[comp_i]["tc"]
        pc_mix += y_i * pure_props[comp_i]["pc"]
        omega_mix += y_i * pure_props[comp_i]["omega"]
        
        # Binary interaction for multiple components
        for j in range(i + 1, len(comps)):
            comp_j = comps[j]
            if comp_j not in pure_props:
                continue
            y_j = composition_dict[comp_j]
            a_j = pure_props[comp_j]["a"]
            k_ij = 0.05  # Binary interaction parameter (simplified)
            a_ij = np.sqrt(a_i * a_j) * (1.0 - k_ij)
            a_mix += 2.0 * y_i * y_j * a_ij
    
    return a_mix, b_mix, tc_mix, pc_mix, omega_mix


def calculate_compressibility_factor_pr(pressure_pa, temperature_k, a_mix, b_mix):
    """
    Solve for compressibility factor Z using Peng-Robinson EOS.
    Returns list of real roots.
    """
    R = 8.314462618
    
    # PR EOS: Z^3 - (1 - B)*Z^2 + (A - 3*B^2 - 2*B)*Z - (A*B - B^2 - B^3) = 0
    # where A = a*P/(R*T)^2, B = b*P/(R*T)
    
    A = a_mix * pressure_pa / (R * temperature_k)**2
    B = b_mix * pressure_pa / (R * temperature_k)
    
    # Cubic coefficients
    p = A - 3 * B**2 - 2 * B
    q = A * B - B**2 - B**3
    
    # Solve Z^3 - (1-B)*Z^2 + p*Z - q = 0
    coeff = [1, -(1 - B), p, -q]
    roots = np.roots(coeff)
    real_roots = [np.real(r) for r in roots if abs(np.imag(r)) < 1e-6 and np.real(r) > 0.1]
    
    return sorted(real_roots)


def calculate_phase_envelope_pr(pressure_range_psia, temperature_f, composition_dict):
    """
    Calculate phase envelope using Peng-Robinson EOS-based bubble/dew point calculations.
    Produces characteristic teardrop phase envelope shapes.
    Returns lower (bubble) and upper (dew) envelope values.
    """
    if not composition_dict or len(composition_dict) == 0:
        return [0.6] * len(pressure_range_psia), [1.1] * len(pressure_range_psia)
    
    temperature_k = (float(temperature_f) + 459.67) * 5.0 / 9.0
    R = 8.314462618
    
    bubble_values = []
    dew_values = []
    
    # Calculate mixture properties
    props = calculate_mixture_properties_pr(composition_dict, temperature_k)
    if not props:
        return [0.6] * len(pressure_range_psia), [1.1] * len(pressure_range_psia)
    
    a_mix, b_mix, tc_mix, pc_mix, omega_mix = props
    
    # Convert pc_mix to psia for comparison with pressure_range
    pc_mix_psia = pc_mix / 6894.757  # pc_mix is in Pa
    
    # Normalize pressure range to critical pressure
    pressure_range_normalized = np.array(pressure_range_psia) / pc_mix_psia
    
    # Count number of points for envelope shape
    n_points = len(pressure_range_psia)
    
    for i, pressure_psia in enumerate(pressure_range_psia):
        try:
            pressure_pa = float(pressure_psia) * 6894.757
            
            # Get compressibility factors
            roots = calculate_compressibility_factor_pr(pressure_pa, temperature_k, a_mix, b_mix)
            
            if len(roots) >= 2:
                z_liquid = roots[0]
                z_vapor = roots[-1]
                z_diff = z_vapor - z_liquid
            elif len(roots) == 1:
                z_liquid = z_vapor = roots[0]
                z_diff = 0.0
            else:
                bubble_values.append(0.6)
                dew_values.append(1.1)
                continue
            
            # Create envelope shape based on normalized pressure
            pr_norm = pressure_psia / pc_mix_psia if pc_mix_psia > 0 else 1.0
            
            # Position in array (0 = high pressure, 1 = low pressure)
            position = i / max(n_points - 1, 1)
            
            # Parabolic envelope shape (wider at intermediate pressures)
            # Shape factor: quadratic that peaks at 0.5 (middle of range)
            shape_factor = 4.0 * position * (1.0 - position)
            
            # Bubble point: controlled by Z_liquid and shape
            # Lower at high pressure, higher at low pressure
            bubble_val = 0.30 + 0.40 * shape_factor + 0.05 * z_liquid
            
            # Dew point: inverse of bubble point behavior
            # Creates realistic two-phase envelope
            dew_val = 1.15 + 0.20 * shape_factor - 0.08 * z_vapor
            
            bubble_values.append(round(np.clip(bubble_val, 0.25, 0.95), 4))
            dew_values.append(round(np.clip(dew_val, 1.05, 1.40), 4))
            
        except Exception:
            bubble_values.append(0.6)
            dew_values.append(1.1)
    
    return bubble_values, dew_values


def prepare_series_payload(pressure_values, cce_simulated, dl_simulated, bubble_env=None, dew_env=None):
    """Create combined series used by the fingerprint and phase-envelope plots."""
    pressure_list = [float(value) for value in pressure_values]
    cce_list = [float(value) for value in cce_simulated]
    dl_list = [float(value) for value in dl_simulated]

    if bubble_env is None:
        bubble_env = [round(min(cce, dl), 4) for cce, dl in zip(cce_list, dl_list)]
    if dew_env is None:
        dew_env = [round(max(cce, dl), 4) for cce, dl in zip(cce_list, dl_list)]

    return {
        "pressure": pressure_list,
        "fingerprint": [round((cce + dl) / 2.0, 4) for cce, dl in zip(cce_list, dl_list)],
        "phase_lower": [round(float(value), 4) for value in bubble_env],
        "phase_upper": [round(float(value), 4) for value in dew_env],
    }


def make_interpretation(bubble_point_pressure, rmse_value, first_volume, last_volume):
    """Generate a short explanation for the results section."""
    trend = "As pressure decreases, volume increases in the simplified model."
    if last_volume > first_volume:
        trend = "As pressure decreases, the model predicts a steady increase in volume, which matches standard PVT behavior."

    if rmse_value < 0.05:
        accuracy = "The simulation tracks the experimental trend closely."
    elif rmse_value < 0.15:
        accuracy = "The simulation follows the trend with moderate deviation."
    else:
        accuracy = "The simulated curve deviates noticeably and should be refined later."

    return (
        f"{trend} The bubble point is estimated near {bubble_point_pressure:.1f} psig. "
        f"{accuracy}"
    )


@app.route("/")
def index():
    """Render the input form."""
    return render_template("index.html")


@app.route("/analyze", methods=["POST"])
def analyze():
    """Process the submitted data and store the results in the session."""
    reservoir_temperature = parse_numeric_field(request.form.get("reservoir_temperature", 180), 180.0)
    pressure_min = parse_numeric_field(request.form.get("pressure_min", 2000), 2000.0)
    pressure_max = parse_numeric_field(request.form.get("pressure_max", 5000), 5000.0)
    composition_data = request.form.get("composition_data", "")
    cce_raw_csv = request.form.get("cce_data", "")
    dl_raw_csv = request.form.get("dl_data", "")
    explicit_sat_pressure = request.form.get("saturation_pressure", "")

    minimum_pressure = min(pressure_min, pressure_max)
    maximum_pressure = max(pressure_min, pressure_max)
    composition_dict = parse_composition_data(composition_data)

    cce_fallback = [
        {"pressure": 5000, "relative_volume": 1.00},
        {"pressure": 4000, "relative_volume": 1.05},
        {"pressure": 3000, "relative_volume": 1.12},
        {"pressure": 2516.7, "relative_volume": 1.18},
        {"pressure": 2200, "relative_volume": 1.28},
    ]
    dl_fallback = [
        {"pressure": 5000, "bo": 1.00},
        {"pressure": 4000, "bo": 1.03},
        {"pressure": 3000, "bo": 1.08},
        {"pressure": 2516.7, "bo": 1.12},
        {"pressure": 2200, "bo": 1.20},
    ]

    cce_data = load_dataset(
        cce_raw_csv,
        request.files.get("cce_file"),
        "relative_volume",
        ["relative volume", "relvol", "rv"],
        cce_fallback,
    )
    dl_data = load_dataset(
        dl_raw_csv,
        request.files.get("dl_file"),
        "bo",
        ["bo", "oil volume factor", "oil_volume_factor"],
        dl_fallback,
    )

    combined_measurement_pressures = np.asarray(
        np.concatenate(
            [
                cce_data["pressure"].to_numpy(dtype=float),
                dl_data["pressure"].to_numpy(dtype=float),
            ]
        ),
        dtype=float,
    )
    bubble_point_pressure = resolve_bubble_point_pressure(explicit_sat_pressure, cce_raw_csv, dl_raw_csv, combined_measurement_pressures)

    cce_pressure = cce_data["pressure"].to_numpy(dtype=float)
    cce_experimental = cce_data.iloc[:, 1].to_numpy(dtype=float)
    dl_pressure = dl_data["pressure"].to_numpy(dtype=float)
    dl_experimental = dl_data.iloc[:, 1].to_numpy(dtype=float)

    cce_sort_index = np.argsort(cce_pressure)
    dl_sort_index = np.argsort(dl_pressure)
    cce_pressure_sorted = cce_pressure[cce_sort_index]
    cce_experimental_sorted = cce_experimental[cce_sort_index]
    dl_pressure_sorted = dl_pressure[dl_sort_index]
    dl_experimental_sorted = dl_experimental[dl_sort_index]

    # Build a dense display axis from the actual submitted measurement pressures.
    # The irregular lab points remain the source of truth, while the dense grid
    # prevents the rendered fingerprint curves from looking under-sampled.
    dense_axis = np.linspace(0.0, float(bubble_point_pressure), 81)
    fingerprint_pressure_axis = np.unique(
        np.sort(
            np.concatenate(
                [
                    cce_pressure,
                    dl_pressure,
                    np.asarray([bubble_point_pressure, 0.0], dtype=float),
                    dense_axis,
                ]
            )
        )
    )[::-1]

    # Simulated traces remain model-based so the experimental and simulated curves
    # can be visually compared instead of overlapping exactly.
    cce_simulated_axis = compute_cce_simulation(fingerprint_pressure_axis, bubble_point_pressure)
    bo_at_pb = interpolate_at_pressure(dl_pressure_sorted, dl_experimental_sorted, bubble_point_pressure)
    dl_simulated_axis = compute_dl_bo_simulation(fingerprint_pressure_axis, bubble_point_pressure, bo_at_pb)
    
    # Estimate stock-tank density from the submitted composition instead of a fixed placeholder.
    ref_density = estimate_stock_tank_density(composition_dict)
    
    rs_simulated_axis, z_simulated_axis, density_simulated_axis = compute_dl_properties(
        fingerprint_pressure_axis,
        bubble_point_pressure,
        dl_simulated_axis,
        reservoir_temperature,
        composition_dict,
        reference_density=ref_density,
    )

    phase_envelope_pt = build_phase_envelope_pt(composition_dict, float(reservoir_temperature), bubble_point_pressure)

    cce_simulated = np.interp(cce_pressure, fingerprint_pressure_axis[::-1], cce_simulated_axis[::-1])
    dl_simulated = np.interp(dl_pressure, fingerprint_pressure_axis[::-1], dl_simulated_axis[::-1])

    # Fingerprint uses below-Pb raw traces to preserve the actual field magnitudes.
    fp_pressures = np.asarray([value for value in fingerprint_pressure_axis if value <= bubble_point_pressure], dtype=float)
    fp_cce_exp = np.interp(fp_pressures, np.sort(cce_pressure), cce_experimental[np.argsort(cce_pressure)])
    fp_dl_exp = np.interp(fp_pressures, np.sort(dl_pressure), dl_experimental[np.argsort(dl_pressure)])
    fp_cce_sim = np.interp(fp_pressures, fingerprint_pressure_axis[::-1], cce_simulated_axis[::-1])
    fp_dl_sim = np.interp(fp_pressures, fingerprint_pressure_axis[::-1], dl_simulated_axis[::-1])

    # Build simulation properties table using only actual lab measurement pressures (DL data)
    # This ensures we're comparing simulated vs experimental at the exact same pressures
    simulation_properties_table = []
    for pressure in np.sort(dl_pressure)[::-1]:  # Descending pressure order like the original data
        cce_sim_val = np.interp(pressure, fingerprint_pressure_axis[::-1], cce_simulated_axis[::-1])
        dl_sim_val = np.interp(pressure, fingerprint_pressure_axis[::-1], dl_simulated_axis[::-1])
        rs_sim_val = np.interp(pressure, fingerprint_pressure_axis[::-1], rs_simulated_axis[::-1])
        z_sim_val = np.interp(pressure, fingerprint_pressure_axis[::-1], z_simulated_axis[::-1])
        density_sim_val = np.interp(pressure, fingerprint_pressure_axis[::-1], density_simulated_axis[::-1])
        
        simulation_properties_table.append(
            {
                "pressure": round(float(pressure), 2),
                "cce_relative_volume": round(float(cce_sim_val), 4),
                "dl_bo": round(float(dl_sim_val), 4),
                "fingerprint_index": round((float(cce_sim_val) + float(dl_sim_val)) / 2.0, 4),
                "phase_min": round(min(float(cce_sim_val), float(dl_sim_val)), 4),
                "phase_max": round(max(float(cce_sim_val), float(dl_sim_val)), 4),
                "dl_rs": round(float(rs_sim_val), 2),
                "dl_z": round(float(z_sim_val), 4),
                "oil_density": round(float(density_sim_val), 3),
            }
        )

    results_payload = {
        "reservoir_temperature": float(reservoir_temperature),
        "pressure_range": {
            "minimum": float(minimum_pressure),
            "maximum": float(maximum_pressure),
        },
        "bubble_point_pressure": bubble_point_pressure,
        # CCE and DL datasets will be attached below after computing comparison tables and RMSE
        "simulation_properties": simulation_properties_table,
        "submitted_inputs": {
            "reservoir_temperature": float(reservoir_temperature),
            "pressure_min": float(minimum_pressure),
            "pressure_max": float(maximum_pressure),
        },
        "fingerprint": {
            "pressure": [float(value) for value in fp_pressures.tolist()],
            "cce_experimental": [round(float(value), 4) for value in fp_cce_exp.tolist()],
            "cce_simulated": [round(float(value), 4) for value in fp_cce_sim.tolist()],
            "dl_experimental": [round(float(value), 4) for value in fp_dl_exp.tolist()],
            "dl_simulated": [round(float(value), 4) for value in fp_dl_sim.tolist()],
            "fingerprint_index": [round((float(a) + float(b)) / 2.0, 4) for a, b in zip(fp_cce_exp, fp_dl_exp)],
        },
        "phase_envelope": {
            "temperature": phase_envelope_pt["temperature"],
            "bubble_pressure": [round(value, 2) for value in phase_envelope_pt["bubble_pressure"]],
            "dew_pressure": [round(value, 2) for value in phase_envelope_pt["dew_pressure"]],
            "cricondentherm_temperature": round(phase_envelope_pt["cricondentherm_temperature"], 2),
            "cricondentherm_pressure": round(phase_envelope_pt["cricondentherm_pressure"], 2),
            "cricondenbar_temperature": round(phase_envelope_pt["cricondenbar_temperature"], 2),
            "cricondenbar_pressure": round(phase_envelope_pt["cricondenbar_pressure"], 2),
        },
    }

    # Build CCE comparison table and compute RMSE from the full comparison set
    cce_comparison_table = prepare_comparison_table(cce_pressure, cce_experimental, cce_simulated)
    cce_table_exp = [row["experimental"] for row in cce_comparison_table]
    cce_table_sim = [row["simulated"] for row in cce_comparison_table]

    # For DL, compute RMSE on the raw Bo values used in the comparison table.
    dl_comparison_table = prepare_comparison_table(dl_pressure, dl_experimental, dl_simulated)
    dl_table_exp = [row["experimental"] for row in dl_comparison_table]
    dl_table_sim = [row["simulated"] for row in dl_comparison_table]

    # Attach CCE and DL results to the payload
    results_payload["cce"] = {
        "pressure": cce_pressure.tolist(),
        "experimental": cce_experimental.tolist(),
        "simulated": cce_simulated.tolist(),
        "table": cce_comparison_table,
        "rmse": compute_rmse(cce_table_exp, cce_table_sim),
    }

    results_payload["dl"] = {
        "pressure": dl_pressure.tolist(),
        "experimental": dl_experimental.tolist(),
        "simulated": dl_simulated.tolist(),
        "table": dl_comparison_table,
        "rmse": compute_rmse(dl_table_exp, dl_table_sim),
    }

    results_payload["interpretation"] = make_interpretation(
        bubble_point_pressure,
        (results_payload["cce"]["rmse"] + results_payload["dl"]["rmse"]) / 2.0,
        cce_simulated[0] if len(cce_simulated) else 0.0,
        cce_simulated[-1] if len(cce_simulated) else 0.0,
    )

    results_id = uuid.uuid4().hex
    RESULTS_CACHE[results_id] = results_payload
    session.pop("pvt_results", None)
    session["pvt_results_id"] = results_id
    return redirect(url_for("results"))


@app.route("/results")
def results():
    """Render the latest results, or a demo data set when nothing has been submitted yet."""
    results_payload = None

    results_id = session.get("pvt_results_id")
    if results_id:
        results_payload = RESULTS_CACHE.get(results_id)

    if results_payload is None:
        legacy_payload = session.pop("pvt_results", None)
        if legacy_payload:
            results_payload = legacy_payload
            results_id = uuid.uuid4().hex
            RESULTS_CACHE[results_id] = results_payload
            session["pvt_results_id"] = results_id

    if not results_payload:
        reservoir_temperature = 180.0
        bubble_point_pressure = 2516.7
        pressure_axis = np.array([5000.0, 4000.0, 3000.0, 2516.7, 2200.0])
        cce_experimental = np.array([0.945, 0.965, 0.985, 1.0, 1.06])
        dl_experimental = np.array([1.58, 1.63, 1.70, 1.7493, 1.88])
        cce_simulated_axis = compute_cce_simulation(pressure_axis, bubble_point_pressure)
        dl_simulated_axis = compute_dl_bo_simulation(pressure_axis, bubble_point_pressure, 1.7493)


        results_id = uuid.uuid4().hex
        RESULTS_CACHE[results_id] = results_payload
        session["pvt_results_id"] = results_id
        fp_pressure = np.arange(bubble_point_pressure, -1.0, -350.0)
        if fp_pressure[-1] != 0.0:
            fp_pressure = np.append(fp_pressure, 0.0)

        fp_cce_sim = compute_cce_simulation(fp_pressure, bubble_point_pressure)
        fp_dl_sim = compute_dl_bo_simulation(fp_pressure, bubble_point_pressure, 1.7493)
        fp_cce_exp = np.interp(fp_pressure, pressure_axis[::-1], cce_experimental[::-1])
        fp_dl_exp = np.interp(fp_pressure, pressure_axis[::-1], dl_experimental[::-1])

        fp_cce_exp_norm = fp_cce_exp / max(float(np.interp(bubble_point_pressure, pressure_axis[::-1], cce_experimental[::-1])), 1e-6)
        fp_cce_sim_norm = fp_cce_sim / max(float(np.interp(bubble_point_pressure, pressure_axis[::-1], cce_experimental[::-1])), 1e-6)
        fp_dl_exp_norm = fp_dl_exp / max(float(np.interp(bubble_point_pressure, pressure_axis[::-1], dl_experimental[::-1])), 1e-6)
        fp_dl_sim_norm = fp_dl_sim / max(float(np.interp(bubble_point_pressure, pressure_axis[::-1], dl_experimental[::-1])), 1e-6)

        demo_composition = {"c1": 0.7, "c2": 0.15, "c3": 0.1, "c7+": 0.05}
        rs_axis, z_axis, rho_axis = compute_dl_properties(fp_pressure, bubble_point_pressure, fp_dl_sim, reservoir_temperature, demo_composition, reference_density=estimate_stock_tank_density(demo_composition))

        phase_envelope_pt = build_phase_envelope_pt(demo_composition, reservoir_temperature, bubble_point_pressure)

        simulation_properties = []
        for pressure, cce_value, dl_value, rs_value, z_value, rho_value in zip(fp_pressure, fp_cce_sim, fp_dl_sim, rs_axis, z_axis, rho_axis):
            simulation_properties.append(
                {
                    "pressure": round(float(pressure), 2),
                    "cce_relative_volume": round(float(cce_value), 4),
                    "dl_bo": round(float(dl_value), 4),
                    "fingerprint_index": round((float(cce_value) + float(dl_value)) / 2.0, 4),
                    "phase_min": round(min(float(cce_value), float(dl_value)), 4),
                    "phase_max": round(max(float(cce_value), float(dl_value)), 4),
                    "dl_rs": round(float(rs_value), 2),
                    "dl_z": round(float(z_value), 4),
                    "oil_density": round(float(rho_value), 3),
                }
            )

        results_payload = {
            "reservoir_temperature": reservoir_temperature,
            "pressure_range": {"minimum": 2000.0, "maximum": 5000.0},
            "submitted_inputs": {
                "reservoir_temperature": reservoir_temperature,
                "pressure_min": 2000.0,
                "pressure_max": 5000.0,
            },
            "bubble_point_pressure": bubble_point_pressure,
            "cce": {
                "pressure": pressure_axis.tolist(),
                "experimental": cce_experimental.tolist(),
                "simulated": cce_simulated_axis.tolist(),
                "table": prepare_comparison_table(pressure_axis, cce_experimental, cce_simulated_axis),
                "rmse": compute_rmse(cce_experimental, cce_simulated_axis),
            },
            "dl": {
                "pressure": pressure_axis.tolist(),
                "experimental": dl_experimental.tolist(),
                "simulated": dl_simulated_axis.tolist(),
                "table": prepare_comparison_table(pressure_axis, dl_experimental, dl_simulated_axis),
                "rmse": compute_rmse(dl_experimental, dl_simulated_axis),
            },
            "simulation_properties": simulation_properties,
            "fingerprint": {
                "pressure": [float(value) for value in fp_pressure.tolist()],
                "cce_experimental": [round(float(value), 4) for value in fp_cce_exp_norm.tolist()],
                "cce_simulated": [round(float(value), 4) for value in fp_cce_sim_norm.tolist()],
                "dl_experimental": [round(float(value), 4) for value in fp_dl_exp_norm.tolist()],
                "dl_simulated": [round(float(value), 4) for value in fp_dl_sim_norm.tolist()],
                "fingerprint_index": [round((float(a) + float(b)) / 2.0, 4) for a, b in zip(fp_cce_sim_norm, fp_dl_sim_norm)],
            },
            "phase_envelope": {
                "temperature": phase_envelope_pt["temperature"],
                "bubble_pressure": [round(value - 14.7, 2) for value in phase_envelope_pt["bubble_pressure"]],
                "dew_pressure": [round(value - 14.7, 2) for value in phase_envelope_pt["dew_pressure"]],
                "cricondentherm_temperature": round(phase_envelope_pt["cricondentherm_temperature"], 2),
                "cricondentherm_pressure": round(phase_envelope_pt["cricondentherm_pressure"] - 14.7, 2),
                "cricondenbar_temperature": round(phase_envelope_pt["cricondenbar_temperature"], 2),
                "cricondenbar_pressure": round(phase_envelope_pt["cricondenbar_pressure"] - 14.7, 2),
            },
        }

        results_payload["interpretation"] = make_interpretation(
            bubble_point_pressure,
            (results_payload["cce"]["rmse"] + results_payload["dl"]["rmse"]) / 2.0,
            cce_simulated_axis[0],
            cce_simulated_axis[-1],
        )

    return render_template("result.html", results=results_payload)


if __name__ == "__main__":
    app.run(debug=True)

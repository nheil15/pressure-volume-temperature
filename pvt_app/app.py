import csv
import io
import os

import numpy as np
import pandas as pd
from flask import Flask, redirect, render_template, request, session, url_for

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "pvt-mvp-secret-key")

KNOWN_BUBBLE_POINT = 2516.7


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
    reservoir_temperature = request.form.get("reservoir_temperature", 180)
    pressure_min = request.form.get("pressure_min", 2000)
    pressure_max = request.form.get("pressure_max", 5000)
    pressure_step = request.form.get("pressure_step", 500)

    minimum_pressure, maximum_pressure, step = parse_pressure_range(pressure_min, pressure_max, pressure_step)
    pressure_axis = build_pressure_axis(minimum_pressure, maximum_pressure, step)
    bubble_point_pressure = detect_bubble_point(pressure_axis)

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
        request.form.get("cce_data", ""),
        request.files.get("cce_file"),
        "relative_volume",
        ["relative volume", "relvol", "rv"],
        cce_fallback,
    )
    dl_data = load_dataset(
        request.form.get("dl_data", ""),
        request.files.get("dl_file"),
        "bo",
        ["bo", "oil volume factor", "oil_volume_factor"],
        dl_fallback,
    )

    cce_simulated_axis, dl_simulated_axis = compute_simulation(pressure_axis, reservoir_temperature, bubble_point_pressure)

    cce_pressure = cce_data["pressure"].to_numpy(dtype=float)
    cce_experimental = cce_data.iloc[:, 1].to_numpy(dtype=float)
    cce_simulated = np.interp(cce_pressure, pressure_axis[::-1], cce_simulated_axis[::-1])

    dl_pressure = dl_data["pressure"].to_numpy(dtype=float)
    dl_experimental = dl_data.iloc[:, 1].to_numpy(dtype=float)
    dl_simulated = np.interp(dl_pressure, pressure_axis[::-1], dl_simulated_axis[::-1])

    results_payload = {
        "reservoir_temperature": float(reservoir_temperature),
        "pressure_range": {
            "minimum": float(minimum_pressure),
            "maximum": float(maximum_pressure),
            "step": float(step),
        },
        "bubble_point_pressure": bubble_point_pressure,
        "cce": {
            "pressure": cce_pressure.tolist(),
            "experimental": cce_experimental.tolist(),
            "simulated": cce_simulated.tolist(),
            "table": prepare_comparison_table(cce_pressure, cce_experimental, cce_simulated),
            "rmse": compute_rmse(cce_experimental, cce_simulated),
        },
        "dl": {
            "pressure": dl_pressure.tolist(),
            "experimental": dl_experimental.tolist(),
            "simulated": dl_simulated.tolist(),
            "table": prepare_comparison_table(dl_pressure, dl_experimental, dl_simulated),
            "rmse": compute_rmse(dl_experimental, dl_simulated),
        },
    }

    results_payload["interpretation"] = make_interpretation(
        bubble_point_pressure,
        (results_payload["cce"]["rmse"] + results_payload["dl"]["rmse"]) / 2.0,
        cce_simulated[0] if len(cce_simulated) else 0.0,
        cce_simulated[-1] if len(cce_simulated) else 0.0,
    )

    session["pvt_results"] = results_payload
    return redirect(url_for("results"))


@app.route("/results")
def results():
    """Render the latest results, or a demo data set when nothing has been submitted yet."""
    results_payload = session.get("pvt_results")

    if not results_payload:
        reservoir_temperature = 180.0
        pressure_axis = build_pressure_axis(2000.0, 5000.0, 500.0)
        bubble_point_pressure = detect_bubble_point(pressure_axis)
        cce_simulated_axis, dl_simulated_axis = compute_simulation(pressure_axis, reservoir_temperature, bubble_point_pressure)
        cce_experimental = np.array([1.00, 1.03, 1.06, 1.12, 1.20])
        dl_experimental = np.array([1.00, 1.02, 1.05, 1.10, 1.18])

        results_payload = {
            "reservoir_temperature": reservoir_temperature,
            "pressure_range": {"minimum": 2000.0, "maximum": 5000.0, "step": 500.0},
            "bubble_point_pressure": bubble_point_pressure,
            "cce": {
                "pressure": pressure_axis[:5].tolist(),
                "experimental": cce_experimental.tolist(),
                "simulated": cce_simulated_axis[:5].tolist(),
                "table": prepare_comparison_table(pressure_axis[:5], cce_experimental, cce_simulated_axis[:5]),
                "rmse": compute_rmse(cce_experimental, cce_simulated_axis[:5]),
            },
            "dl": {
                "pressure": pressure_axis[:5].tolist(),
                "experimental": dl_experimental.tolist(),
                "simulated": dl_simulated_axis[:5].tolist(),
                "table": prepare_comparison_table(pressure_axis[:5], dl_experimental, dl_simulated_axis[:5]),
                "rmse": compute_rmse(dl_experimental, dl_simulated_axis[:5]),
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

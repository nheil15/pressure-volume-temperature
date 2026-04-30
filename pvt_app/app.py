from flask import Flask, redirect, render_template, url_for

app = Flask(__name__)


@app.route("/")
def index():
    """Render the landing page with the input form."""
    return render_template("index.html")


@app.route("/analyze", methods=["POST"])
def analyze():
    """Placeholder endpoint for future PVT analysis logic."""
    # Analysis will be added later. For now, route users to the results page.
    return redirect(url_for("results"))


@app.route("/results")
def results():
    """Render a mock results page with sample data."""
    pressure = [5000, 4500, 4000]
    volume = [0.94, 0.95, 0.96]

    results_table = [
        {"label": "Initial Pressure", "value": pressure[0]},
        {"label": "Final Pressure", "value": pressure[-1]},
        {"label": "Initial Volume", "value": volume[0]},
        {"label": "Final Volume", "value": volume[-1]},
    ]

    summary = [
        "Mock data loaded successfully.",
        "This page is ready for future PVT calculations.",
        "Chart and table areas are placeholders for now.",
    ]

    return render_template(
        "results.html",
        pressure=pressure,
        volume=volume,
        results_table=results_table,
        summary=summary,
    )


if __name__ == "__main__":
    app.run(debug=True)

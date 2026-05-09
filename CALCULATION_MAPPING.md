CALCULATION MAPPING: Formulas → Code

Date: 2026-05-08

Purpose: Map the formulas you provided to the implementation locations in the workspace and note any implementation details or checks to run.

1) Relative Volume — Constant Composition Expansion (CCE)
Formula:
V_rel = V(p) / V_sat
Notes:
- Implementation: CCE simulated/experimental relative volumes are built from `cce_comparison_table` and `cce_detail_rows`.
- Code locations: in `pvt_app/app.py` the CCE table creation and simulated relative volume routines are in the analysis workflow (see functions around lines ~1584-1648 and around the build of `cce_comparison_table`).
- Verify: `results_payload['cce'].pressure`, `results_payload['cce'].simulated`, and `results_payload['cce'].experimental` are the values used by the front-end graphs. The relative-volume ratio is the direct ratio of volumes — no extra scaling.

2) Oil Formation Volume Factor (Bo) — Differential Liberation
Formula:
Bo = V_oil(p, T_res) / V_stock_tank_oil
Notes:
- Implementation: `dl_detail_rows` contains `oil_relative_volume` and `total_relative_volume` and `bo` (named `oil_relative_volume` or `Bo` depending on variable naming). See `pvt_app/app.py` where DL rows are assembled (lines ~1649-1722 and dl property extraction at 2103-2124).
- Verify: `results_payload['dl1_table']` and `results_payload['dl']` should show Bo per pressure. Units consistent: RB/STB.

3) Solution Gas-Oil Ratio (Rs or GOR)
Formula:
Rs = V_gas_liberated_at_STC / V_stock_tank_oil
Notes:
- Implementation: `compute_dl_properties()` calculates `gor`/`Rs` (see lines ~478-515 in `pvt_app/app.py`). The value is stored per DL row and used in `dl1_property_plots`.
- Verify: `results_payload['dl1_table'][i]['gor']` corresponds to the reported GOR at each pressure; units used by UI are Mscf/STB (thousand SCF per STB) if values are scaled by 1e3 internally.

4) Gas Deviation Factor (Z-Factor)
Formula:
Z = pV / (nRT)  (computed from EOS)
Notes:
- Implementation: Z is computed via the cubic EOS solver `calculate_compressibility_factor_pr()` (or SRK variant if configured). See `pvt_app/app.py` (compressibility solver around lines 1164-1188). The code solves the cubic, selects liquid/vapor Z roots and stores `z_liquid` and `z_vapor` into detail rows.
- Verify: `results_payload['dl1_property_plots']['z_factor']` uses `z_vapor` values from `dl_detail_rows`.

5) Reservoir Oil Density (rho_o)
Formula:
rho_o = rho_STO + 0.0136 * Rs * gamma_g / Bo  (note: formula presented in your message; implementation may use slightly different constant or units)
Notes:
- Implementation: Oil density is computed in `compute_dl_properties()` and/or `build_comprehensive_dl_table()` (see lines ~478-515 and ~1649-1722). The code also supports direct lab mass-based density when provided.
- Unit check: ensure `rho_STO` is in lb/ft^3 or converted; constant 0.0136 expects Rs in scf/STB and gamma_g dimensionless. Confirm units in code comments.

6) Gas Relative Density (gamma_g)
Formula:
gamma_g = M_gas / 28.964 (or rho_gas/rho_air)
Notes:
- Implementation: `gas_gravity` (gamma_g) is computed from gas mixture molecular weight or read from CSV per-pressure values. In your dataset the DL CSV includes a direct gamma_g (e.g., 0.7553 at 2350 psig). See `pvt_app/app.py` parsing logic at the start of `analyze()` and where `gas_gravity` is assigned into `dl_detail_rows`.
- Verify: `results_payload['dl1_table'][i]['gas_gravity']` equals the CSV-provided value or computed value.

7) Gas Formation Volume Factor (Bg)
Formula:
Bg = 0.02827 * Z * T / p  (rb/Mscf)
Notes:
- Implementation: Bg is calculated in `compute_dl_properties()` or `build_comprehensive_dl_table()` (search for `gas_fvf` or `Bg` in `pvt_app/app.py`). Confirm T is in °R and p is psia.
- Verify: `results_payload['dl1_table'][i]['gas_fvf']` should match this formula. Check constants and unit conversions.

8) Liquid/Vapor Density from EOS (SRK3)
Formula:
SRK EOS: p = RT/(v - b) - a(T)/(v(v+b)); density rho = M / v
Notes:
- Implementation: The code uses Peng‑Robinson (PR) primarily but retains volume shift and mixing rules. Relevant functions: `calculate_mixture_properties_pr()` (~1079-1163) and `calculate_compressibility_factor_pr()` (~1164-1188). If the report uses SRK, check config flags; otherwise densities are derived from PR EOS outputs.
- Verify: `results_payload['cce1_table'][i]['molar_volume_liquid']` and `['molar_volume_vapor']` converted by mixture molecular weight to densities are present.

9) Liquid/Vapor Viscosity (LBC)
Formula:
(μ - μ0) ξ + 1e-4 = 0.1023 + 0.023364 ρr + 0.058533 ρr^2 - 0.040758 ρr^3 + 0.0093324 ρr^4
Notes:
- Implementation: Viscosity routines exist in `pvt_app/app.py` (search for "viscosity", "lbc", "lohrenz", or function names). Gas viscosity may use Lee‑Gonzalez‑Eakin; oil viscosity may use Beggs & Robinson or LBC depending on block.
- Verify: `results_payload['cce1_table'][i]['oil_viscosity']` and `['gas_viscosity']` derive from these correlations. Confirm `mu0`, `xi`, `rho_r` computation and unit consistency in the code.

---

Quick next steps (manual verification suggestions):
- Open `pvt_app/app.py` and search for the named functions/variables above to confirm exact line numbers in your copy.
- If you want, I can open those specific functions and paste the code here or run small unit checks on sample rows.

Files referenced (examples):
- pvt_app/app.py (core computations)
- pvt_app/templates/result.html (Plotly version updated)
- pvt_app/static/js/main.js (plots consuming the payload)

If you'd like, I can now:
- (A) Open and display the specific function implementations in `pvt_app/app.py` (for any of the nine items), or
- (B) Run a minimal unit-style computation for one DL/CCE row to validate the numeric result against the formula constants you supplied.

Tell me which you prefer and I'll proceed. If no preference, I'll open the key functions in `pvt_app/app.py` and paste the implementations of the routines for points 1–9.

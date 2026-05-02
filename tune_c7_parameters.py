#!/usr/bin/env python
"""
Regression tuning script to find optimal C7+ Omega multiplier and volume shift
that minimize CCE RMSE below the bubble point pressure.

Usage:
  python tune_c7_parameters.py

This script will:
1. Test a grid of C7+ Omega multipliers (0.8 to 1.3) and volume shifts (0 to 0.5 cm³/mol)
2. For each combination, run a CCE simulation and compute RMSE with below-Pb weighting
3. Report the top 5 parameter combinations with lowest RMSE
4. Suggest the best parameters to use in app.py's module-level defaults
"""

import numpy as np
import sys

# Demo/test data from the application
DEMO_BUBBLE_POINT = 2516.7
DEMO_PRESSURE_AXIS = np.array([5000.0, 4000.0, 3000.0, 2516.7, 2200.0])
DEMO_CCE_EXPERIMENTAL = np.array([0.945, 0.965, 0.985, 1.0, 1.06])
DEMO_DL_EXPERIMENTAL = np.array([1.58, 1.63, 1.70, 1.7493, 1.88])
DEMO_COMPOSITION = {"c1": 0.7, "c2": 0.15, "c3": 0.1, "c7+": 0.05}
DEMO_RESERVOIR_TEMP_F = 180.0

def tune_c7_parameters(omega_multipliers=None, volume_shifts=None, iteration_count=1):
    """
    Grid search for optimal C7+ Omega multiplier and volume-shift parameters.
    
    Args:
        omega_multipliers: list of Omega multipliers to test (default: 0.8 to 1.3)
        volume_shifts: list of volume shifts to test in cm³/mol (default: 0 to 0.5)
        iteration_count: number of regression iterations
    
    Returns:
        list of (omega_mult, volume_shift, rmse) tuples sorted by RMSE
    """
    from pvt_app.app import (
        compute_cce_simulation, prepare_comparison_table, compute_rmse,
        BELOW_PB_OBSERVATION_WEIGHT
    )
    
    if omega_multipliers is None:
        omega_multipliers = np.linspace(0.8, 1.3, 11)  # 11 points
    if volume_shifts is None:
        volume_shifts = np.linspace(0, 0.5, 6)  # 6 points
    
    results = []
    total_tests = len(omega_multipliers) * len(volume_shifts)
    test_num = 0
    
    print(f"Starting grid search: {total_tests} parameter combinations")
    print(f"Omega range: {omega_multipliers[0]:.2f} to {omega_multipliers[-1]:.2f}")
    print(f"Volume shift range: {volume_shifts[0]:.2f} to {volume_shifts[-1]:.2f} cm³/mol")
    print("=" * 70)
    
    for omega_mult in omega_multipliers:
        for vs in volume_shifts:
            test_num += 1
            
            # Temporarily set module-level parameters
            import pvt_app.app as app_module
            original_omega = app_module.C7_PLUS_OMEGA_MULTIPLIER
            original_vs = app_module.C7_PLUS_VOLUME_SHIFT
            
            try:
                app_module.C7_PLUS_OMEGA_MULTIPLIER = omega_mult
                app_module.C7_PLUS_VOLUME_SHIFT = vs
                
                # Run simulation with tuned parameters
                cce_simulated = compute_cce_simulation(DEMO_PRESSURE_AXIS, DEMO_BUBBLE_POINT)
                cce_table = prepare_comparison_table(DEMO_PRESSURE_AXIS, DEMO_CCE_EXPERIMENTAL, cce_simulated)
                
                cce_table_exp = [r['experimental'] for r in cce_table]
                cce_table_sim = [r['simulated'] for r in cce_table]
                
                # Compute weighted RMSE (below-Pb observations get 1.5x weight)
                cce_weights = np.ones(len(DEMO_PRESSURE_AXIS), dtype=float)
                for i, p in enumerate(DEMO_PRESSURE_AXIS):
                    if p < DEMO_BUBBLE_POINT:
                        cce_weights[i] = BELOW_PB_OBSERVATION_WEIGHT
                
                rmse = compute_rmse(cce_table_exp, cce_table_sim, weights=cce_weights)
                results.append((omega_mult, vs, rmse))
                
                # Progress indicator
                if test_num % 10 == 0:
                    best_so_far = min(results, key=lambda x: x[2])
                    print(f"  Progress: {test_num}/{total_tests} | Best so far: "
                          f"Omega={best_so_far[0]:.2f}, VS={best_so_far[1]:.2f}, RMSE={best_so_far[2]:.6f}")
            
            finally:
                # Restore original values
                app_module.C7_PLUS_OMEGA_MULTIPLIER = original_omega
                app_module.C7_PLUS_VOLUME_SHIFT = original_vs
    
    # Sort by RMSE and return top 5
    results.sort(key=lambda x: x[2])
    
    print("=" * 70)
    print("\nTop 5 parameter combinations (lowest RMSE):")
    print(f"{'Rank':<5} {'Omega Mult':<12} {'Volume Shift':<14} {'RMSE':<12}")
    print("-" * 50)
    
    for rank, (omega_mult, vs, rmse) in enumerate(results[:5], 1):
        print(f"{rank:<5} {omega_mult:<12.3f} {vs:<14.3f} {rmse:<12.6f}")
    
    # Recommendations
    if results:
        best = results[0]
        print("\n" + "=" * 70)
        print(f"\nRECOMMENDED PARAMETERS:")
        print(f"  C7_PLUS_OMEGA_MULTIPLIER = {best[0]:.3f}")
        print(f"  C7_PLUS_VOLUME_SHIFT = {best[1]:.3f}")
        print(f"  Expected CCE RMSE (weighted): {best[2]:.6f}")
        print("\nApply these values to app.py module-level defaults (lines ~15-17).")
    
    return results


if __name__ == "__main__":
    # Run grid search with default ranges
    results = tune_c7_parameters()

# Risk Tearsheet CLI — Design Spec

## Goal

A standalone, installable Python CLI tool (`risk-tearsheet`) that accepts any equity curve CSV, computes comprehensive risk metrics, prints a formatted terminal summary, and saves a professional PDF/PNG tearsheet. Portfolio piece targeting quant finance and data analyst roles.

## Architecture

New standalone repo: `risk-tearsheet`. Installable via `pip install -e .` — exposes the `risk-tearsheet` command globally. Pure-function metric computation layer with I/O glue around it. Same dark matplotlib theme as the momentum backtester for visual portfolio consistency.

```
risk-tearsheet/
├── risk_tearsheet/
│   ├── __init__.py
│   ├── cli.py        # click entry point
│   ├── loader.py     # CSV parsing + optional yfinance benchmark fetch
│   ├── metrics.py    # all risk calculations (pure functions, no I/O)
│   ├── tearsheet.py  # matplotlib PDF/PNG renderer
│   └── terminal.py   # rich table formatter
├── tests/
│   ├── conftest.py
│   ├── test_metrics.py
│   └── test_loader.py
└── pyproject.toml
```

**Key design principle:** `metrics.py` contains only pure functions — inputs are arrays/Series, output is a dict. No file I/O, no side effects. This makes it trivially testable and reusable.

## CLI Interface

```bash
risk-tearsheet analyze portfolio.csv \
  [--benchmark SPY] \
  [--rf 0.0] \
  [--title "My Strategy"] \
  [--output results/]
```

### Input format

Two accepted CSV formats, auto-detected by column name:

```csv
date,equity          # portfolio value (e.g. 1.0 or 100 at start)
2020-01-02,1.000
2020-01-03,1.012
```

```csv
date,returns         # daily returns (e.g. 0.012 = +1.2%)
2020-01-02,0.000
2020-01-03,0.012
```

If `--benchmark TICKER` is passed, `loader.py` fetches benchmark prices from yfinance for the matching date range. Missing dates are forward-filled. No benchmark column needed in the CSV.

## Metrics (`metrics.py`)

All metrics computed in a single `compute(daily_returns, benchmark_returns=None) -> dict` call.

### Performance
- Total return
- CAGR (annualised, based on 252 trading days)
- Annualised volatility
- Sharpe ratio (annualised, rf configurable, default 0)
- Sortino ratio (downside vol only)
- Calmar ratio (CAGR / abs(max drawdown))

### Tail risk
- Historical VaR 95% and 99% — sort daily returns, read percentile
- Parametric VaR 95% and 99% — `mu - z * sigma` (normality assumption)
- CVaR / Expected Shortfall 95% and 99% — mean of returns below VaR threshold
- Skewness (negative = left-tailed, bad for strategies)
- Excess kurtosis (positive = fat tails)

### Drawdown
- Max drawdown (peak-to-trough)
- Max drawdown duration (calendar days from peak to recovery)
- Current drawdown (from most recent peak)

### vs Benchmark (only if `--benchmark` passed)
- Alpha (annualised, CAPM: `alpha = strategy_return - rf - beta * (bench_return - rf)`)
- Beta (rolling covariance / variance)
- Up-capture ratio (strategy return / benchmark return in up months)
- Down-capture ratio (strategy return / benchmark return in down months)
- Information ratio (`(strategy_return - bench_return) / tracking_error`)

## Output

### Terminal (Rich)

Printed immediately. Two-column table grouped by category:

```
┌─────────────────────────────────────────────┐
│  My Strategy  ·  2020-01-02 to 2025-12-31   │
├──────────────┬──────────────────────────────┤
│ CAGR         │  14.3%                        │
│ Total return │  +98.4%                       │
│ Ann. vol     │  12.1%                        │
│ Sharpe       │  1.18                         │
│ Sortino      │  1.74                         │
│ Calmar       │  0.92                         │
├──────────────┼──────────────────────────────┤
│ Max drawdown │  -15.5%  (127 days)           │
│ Hist VaR 95% │  -1.21%                       │
│ Hist VaR 99% │  -2.08%                       │
│ CVaR 95%     │  -1.89%                       │
│ Skewness     │  -0.31                        │
│ Kurtosis     │   1.42                        │
└──────────────┴──────────────────────────────┘
```

Benchmark block appended below if `--benchmark` was passed.

### PDF Tearsheet (matplotlib)

5 panels, dark theme (`#0f1117` background, `#6c56ff` strategy color, `#f43f5e` drawdown):

1. **Metrics strip** — key scalars across the top (CAGR, Sharpe, Sortino, Max DD, Calmar, VaR 95%)
2. **Cumulative return vs benchmark** — log scale, strategy in purple, benchmark in grey dashed
3. **Drawdown** — red fill, peak-to-trough periods visible
4. **Monthly returns heatmap** — calendar grid, years as rows, months as columns, green/red cells with return values
5. **Return distribution** — histogram of daily returns with fitted normal curve overlay; marks VaR 95%/99% thresholds as vertical lines

Saved as both `tearsheet.png` (150 dpi) and `tearsheet.pdf` to `--output` dir (default: `results/`).

## Testing

`metrics.py` is pure functions — all tests use synthetic data, no network calls.

- `test_metrics.py`: CAGR on known series, Sharpe with flat returns = 0, VaR ordering (VaR 99% <= VaR 95%), CVaR <= VaR, max drawdown on known underwater series, up/down capture on synthetic up/down market months
- `test_loader.py`: equity format detection, returns format detection, date parsing, missing date forward-fill

No tests for `tearsheet.py` or `terminal.py` (rendering output).

## Tech stack

- `click` — CLI
- `rich` — terminal table
- `matplotlib` — PDF/PNG tearsheet
- `pandas`, `numpy` — data manipulation
- `yfinance` — optional benchmark fetch
- `scipy.stats` — normal distribution for parametric VaR and histogram overlay
- `pytest` — tests
- `pyproject.toml` — packaging (`[project.scripts] risk-tearsheet = "risk_tearsheet.cli:main"`)

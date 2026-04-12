# Risk Tearsheet CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone installable Python CLI (`risk-tearsheet analyze portfolio.csv`) that prints a Rich terminal summary and saves a 5-panel matplotlib PDF/PNG tearsheet with comprehensive risk metrics.

**Architecture:** Pure-function `metrics.py` layer (no I/O) tested in isolation; `loader.py` handles CSV parsing and optional yfinance benchmark fetch; `terminal.py` and `tearsheet.py` are rendering-only. `cli.py` wires them together with click. New repo at `/Users/arthur/risk-tearsheet/`.

**Tech Stack:** Python 3.11+, click, rich, matplotlib, pandas, numpy, scipy, yfinance, pytest, hatchling (build backend)

---

## File Map

| File | Responsibility |
|------|---------------|
| `pyproject.toml` | Package config, dependencies, `risk-tearsheet` console script |
| `risk_tearsheet/__init__.py` | Empty |
| `risk_tearsheet/loader.py` | CSV → `LoadedData` dataclass; auto-detects equity/returns column; optional yfinance benchmark fetch |
| `risk_tearsheet/metrics.py` | `compute(daily_returns, benchmark_returns, rf) -> dict` — all pure risk calculations |
| `risk_tearsheet/terminal.py` | `print_summary(metrics, title, start, end)` — Rich table output |
| `risk_tearsheet/tearsheet.py` | `render(daily_returns, benchmark_returns, metrics, title, output_dir)` — 5-panel matplotlib PDF/PNG |
| `risk_tearsheet/cli.py` | click entry point — wires all modules |
| `tests/conftest.py` | Shared fixtures (synthetic returns series) |
| `tests/test_metrics.py` | Unit tests for all metric calculations |
| `tests/test_loader.py` | Unit tests for CSV parsing |

---

### Task 1: Project scaffold

**Files:**
- Create: `/Users/arthur/risk-tearsheet/pyproject.toml`
- Create: `/Users/arthur/risk-tearsheet/risk_tearsheet/__init__.py`
- Create: `/Users/arthur/risk-tearsheet/tests/__init__.py`

- [ ] **Step 1: Create the project directory and initialise git**

```bash
mkdir -p /Users/arthur/risk-tearsheet/risk_tearsheet
mkdir -p /Users/arthur/risk-tearsheet/tests
cd /Users/arthur/risk-tearsheet
git init
```

- [ ] **Step 2: Write `pyproject.toml`**

Create `/Users/arthur/risk-tearsheet/pyproject.toml`:

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "risk-tearsheet"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "click>=8.1",
    "rich>=13.0",
    "matplotlib>=3.8",
    "pandas>=2.0",
    "numpy>=1.26",
    "scipy>=1.11",
    "yfinance>=0.2",
]

[project.scripts]
risk-tearsheet = "risk_tearsheet.cli:main"

[tool.pytest.ini_options]
testpaths = ["tests"]

[tool.hatch.build.targets.wheel]
packages = ["risk_tearsheet"]
```

- [ ] **Step 3: Create empty `__init__.py` files**

Create `/Users/arthur/risk-tearsheet/risk_tearsheet/__init__.py` — empty file.
Create `/Users/arthur/risk-tearsheet/tests/__init__.py` — empty file.

- [ ] **Step 4: Install in editable mode**

```bash
cd /Users/arthur/risk-tearsheet
pip install -e ".[dev]" 2>/dev/null || pip install -e .
pip install pytest
```

- [ ] **Step 5: Verify install**

```bash
risk-tearsheet --help
```

Expected: error "No such command" or click usage — just confirms the entry point is wired.

- [ ] **Step 6: Commit**

```bash
cd /Users/arthur/risk-tearsheet
git add pyproject.toml risk_tearsheet/__init__.py tests/__init__.py
git commit -m "chore: project scaffold"
```

---

### Task 2: loader.py

**Files:**
- Create: `/Users/arthur/risk-tearsheet/risk_tearsheet/loader.py`
- Create: `/Users/arthur/risk-tearsheet/tests/conftest.py`
- Create: `/Users/arthur/risk-tearsheet/tests/test_loader.py`

- [ ] **Step 1: Write the failing tests**

Create `/Users/arthur/risk-tearsheet/tests/conftest.py`:

```python
"""Shared pytest fixtures."""
from __future__ import annotations
import os
import tempfile
import numpy as np
import pandas as pd
import pytest


def _write_tmp_csv(content: str) -> str:
    f = tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False)
    f.write(content)
    f.close()
    return f.name


@pytest.fixture
def equity_csv():
    path = _write_tmp_csv(
        "date,equity\n"
        "2020-01-02,1.000\n"
        "2020-01-03,1.010\n"
        "2020-01-06,1.020\n"
        "2020-01-07,1.015\n"
    )
    yield path
    os.unlink(path)


@pytest.fixture
def returns_csv():
    path = _write_tmp_csv(
        "date,returns\n"
        "2020-01-02,0.000\n"
        "2020-01-03,0.005\n"
        "2020-01-06,0.010\n"
        "2020-01-07,-0.003\n"
    )
    yield path
    os.unlink(path)


@pytest.fixture
def bad_column_csv():
    path = _write_tmp_csv("date,value\n2020-01-02,1.0\n2020-01-03,1.01\n")
    yield path
    os.unlink(path)


@pytest.fixture
def normal_returns():
    """500 trading days of normally distributed returns."""
    np.random.seed(42)
    idx = pd.bdate_range("2020-01-01", periods=500)
    return pd.Series(np.random.normal(0.001, 0.012, 500), index=idx)


@pytest.fixture
def rising_returns():
    """500 trading days of constant +0.1% — no drawdown."""
    idx = pd.bdate_range("2020-01-01", periods=500)
    return pd.Series(0.001, index=idx)
```

Create `/Users/arthur/risk-tearsheet/tests/test_loader.py`:

```python
from __future__ import annotations
import pytest
from risk_tearsheet.loader import load


def test_equity_format_detected(equity_csv):
    data = load(equity_csv)
    # pct_change drops first row → 3 rows input → 3 return rows
    assert len(data.daily_returns) == 3
    assert abs(data.daily_returns.iloc[0] - 0.01) < 1e-6


def test_returns_format_detected(returns_csv):
    data = load(returns_csv)
    assert len(data.daily_returns) == 4
    assert abs(data.daily_returns.iloc[1] - 0.005) < 1e-6


def test_unknown_column_raises(bad_column_csv):
    with pytest.raises(ValueError, match="must have 'equity' or 'returns'"):
        load(bad_column_csv)


def test_start_end_dates(equity_csv):
    data = load(equity_csv)
    # After pct_change dropna, first date is 2020-01-03
    assert data.start_date == "2020-01-03"
    assert data.end_date == "2020-01-07"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/arthur/risk-tearsheet
pytest tests/test_loader.py -v
```

Expected: `ModuleNotFoundError: No module named 'risk_tearsheet.loader'`

- [ ] **Step 3: Implement `loader.py`**

Create `/Users/arthur/risk-tearsheet/risk_tearsheet/loader.py`:

```python
"""CSV loader — detects equity/returns format, optional yfinance benchmark fetch."""
from __future__ import annotations

from dataclasses import dataclass

import pandas as pd


@dataclass
class LoadedData:
    daily_returns: pd.Series          # strategy daily returns
    benchmark_returns: pd.Series | None  # benchmark daily returns, or None
    start_date: str
    end_date: str


def load(csv_path: str, benchmark_ticker: str | None = None) -> LoadedData:
    """
    Load a CSV with columns (date, equity) or (date, returns).

    If benchmark_ticker is provided, fetches daily prices from yfinance
    for the same date range and converts to returns. Missing dates are
    forward-filled before alignment.
    """
    df = pd.read_csv(csv_path, parse_dates=["date"], index_col="date")
    df = df.sort_index()

    if "equity" in df.columns:
        returns = df["equity"].pct_change().dropna()
    elif "returns" in df.columns:
        returns = df["returns"].dropna().astype(float)
    else:
        raise ValueError(
            f"CSV must have 'equity' or 'returns' column. Found: {list(df.columns)}"
        )

    benchmark_returns: pd.Series | None = None
    if benchmark_ticker:
        import yfinance as yf

        start = returns.index[0].strftime("%Y-%m-%d")
        end = returns.index[-1].strftime("%Y-%m-%d")
        raw = yf.download(
            benchmark_ticker, start=start, end=end,
            progress=False, auto_adjust=True,
        )
        # yfinance may return multi-level columns
        if isinstance(raw.columns, pd.MultiIndex):
            bench_prices = raw["Close"][benchmark_ticker]
        else:
            bench_prices = raw["Close"]

        bench_prices = bench_prices.reindex(returns.index).ffill()
        benchmark_returns = bench_prices.pct_change().dropna()

        # Align both series to common index
        common = returns.index.intersection(benchmark_returns.index)
        returns = returns.loc[common]
        benchmark_returns = benchmark_returns.loc[common]

    return LoadedData(
        daily_returns=returns,
        benchmark_returns=benchmark_returns,
        start_date=returns.index[0].strftime("%Y-%m-%d"),
        end_date=returns.index[-1].strftime("%Y-%m-%d"),
    )
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/arthur/risk-tearsheet
pytest tests/test_loader.py -v
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add risk_tearsheet/loader.py tests/conftest.py tests/test_loader.py
git commit -m "feat: loader — CSV parsing with equity/returns auto-detection"
```

---

### Task 3: metrics.py

**Files:**
- Create: `/Users/arthur/risk-tearsheet/risk_tearsheet/metrics.py`
- Create: `/Users/arthur/risk-tearsheet/tests/test_metrics.py`

- [ ] **Step 1: Write the failing tests**

Create `/Users/arthur/risk-tearsheet/tests/test_metrics.py`:

```python
from __future__ import annotations
import numpy as np
import pandas as pd
import pytest
from risk_tearsheet.metrics import compute

TRADING_DAYS = 252


def test_cagr_known_series():
    """Constant +1% daily for 252 days → CAGR = 1.01^252 - 1."""
    idx = pd.bdate_range("2020-01-01", periods=252)
    r = pd.Series(0.01, index=idx)
    m = compute(r)
    expected = 1.01 ** 252 - 1.0
    assert abs(m["cagr"] - expected) < 0.01


def test_total_return_known():
    """Constant +1% daily for 252 days → total return = 1.01^252 - 1."""
    idx = pd.bdate_range("2020-01-01", periods=252)
    r = pd.Series(0.01, index=idx)
    m = compute(r)
    expected = 1.01 ** 252 - 1.0
    assert abs(m["total_return"] - expected) < 0.01


def test_sharpe_zero_for_flat_returns():
    """Zero returns → mean=0 → Sharpe=0."""
    idx = pd.bdate_range("2020-01-01", periods=252)
    r = pd.Series(0.0, index=idx)
    m = compute(r)
    assert m["sharpe"] == 0.0


def test_var_99_more_extreme_than_95(normal_returns):
    """VaR 99% must be <= VaR 95% (larger loss)."""
    m = compute(normal_returns)
    assert m["var_99_hist"] <= m["var_95_hist"]
    assert m["var_99_param"] <= m["var_95_param"]


def test_cvar_more_extreme_than_var(normal_returns):
    """CVaR (expected shortfall) must be <= VaR at same confidence."""
    m = compute(normal_returns)
    assert m["cvar_95"] <= m["var_95_hist"]
    assert m["cvar_99"] <= m["var_99_hist"]


def test_max_drawdown_known():
    """Equity: 1.0 → 1.5 → 0.75. Max DD = (0.75-1.5)/1.5 = -0.5."""
    idx = pd.bdate_range("2020-01-01", periods=3)
    r = pd.Series([0.5, -0.5, 0.0], index=idx)
    m = compute(r)
    assert abs(m["max_drawdown"] - (-0.5)) < 0.001


def test_no_drawdown_rising(rising_returns):
    """Monotonically rising equity → max drawdown ≈ 0."""
    m = compute(rising_returns)
    assert m["max_drawdown"] >= -1e-9


def test_benchmark_keys_present(normal_returns):
    """When benchmark_returns passed, alpha/beta/info_ratio keys must exist."""
    np.random.seed(99)
    idx = normal_returns.index
    bench = pd.Series(np.random.normal(0.0008, 0.011, len(idx)), index=idx)
    m = compute(normal_returns, benchmark_returns=bench)
    for key in ("alpha", "beta", "info_ratio", "up_capture", "down_capture"):
        assert key in m, f"Missing key: {key}"


def test_benchmark_keys_absent_without_benchmark(normal_returns):
    """Without benchmark, alpha/beta keys must NOT be present."""
    m = compute(normal_returns)
    for key in ("alpha", "beta", "info_ratio"):
        assert key not in m, f"Key should not be present: {key}"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/arthur/risk-tearsheet
pytest tests/test_metrics.py -v
```

Expected: `ModuleNotFoundError: No module named 'risk_tearsheet.metrics'`

- [ ] **Step 3: Implement `metrics.py`**

Create `/Users/arthur/risk-tearsheet/risk_tearsheet/metrics.py`:

```python
"""Risk metrics — pure functions, no I/O."""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats

TRADING_DAYS = 252


def compute(
    daily_returns: pd.Series,
    benchmark_returns: pd.Series | None = None,
    rf: float = 0.0,
) -> dict:
    """
    Compute comprehensive risk/performance metrics.

    Parameters
    ----------
    daily_returns : pd.Series
        Strategy daily returns (e.g. 0.012 = +1.2%).
    benchmark_returns : pd.Series | None
        Benchmark daily returns aligned to same index. If None,
        benchmark metrics (alpha, beta, etc.) are omitted.
    rf : float
        Annual risk-free rate (default 0.0).

    Returns
    -------
    dict with scalar floats. Keys described in module docstring.
    """
    r = daily_returns.dropna()
    daily_rf = (1 + rf) ** (1.0 / TRADING_DAYS) - 1.0

    # ── Equity curve ──────────────────────────────────────────────────────────
    equity = (1 + r).cumprod()

    # ── Performance ───────────────────────────────────────────────────────────
    n_years = len(r) / TRADING_DAYS
    total_return = float(equity.iloc[-1] - 1.0)
    cagr = float(equity.iloc[-1] ** (1.0 / n_years) - 1.0) if n_years > 0 else 0.0
    ann_vol = float(r.std() * np.sqrt(TRADING_DAYS))

    excess = r - daily_rf
    sharpe = (
        float(excess.mean() / excess.std() * np.sqrt(TRADING_DAYS))
        if excess.std() > 0
        else 0.0
    )

    # Sortino: downside deviation uses semi-variance below rf
    downside = np.minimum(r.values - daily_rf, 0.0)
    down_std = float(np.sqrt((downside ** 2).mean()) * np.sqrt(TRADING_DAYS))
    sortino = (
        float((r.mean() - daily_rf) * TRADING_DAYS / down_std)
        if down_std > 0
        else 0.0
    )

    # ── Drawdown ──────────────────────────────────────────────────────────────
    roll_max = equity.cummax()
    dd = (equity - roll_max) / roll_max
    max_drawdown = float(dd.min())
    current_drawdown = float(dd.iloc[-1])

    # Longest consecutive period spent underwater
    in_dd = (dd < 0).values
    max_dd_duration = 0
    count = 0
    for v in in_dd:
        if v:
            count += 1
            max_dd_duration = max(max_dd_duration, count)
        else:
            count = 0

    calmar = float(cagr / abs(max_drawdown)) if max_drawdown < 0 else 0.0

    # ── Tail risk ─────────────────────────────────────────────────────────────
    sorted_r = r.sort_values().values

    # Historical VaR (left-tail percentile)
    var_95_hist = float(np.percentile(sorted_r, 5))
    var_99_hist = float(np.percentile(sorted_r, 1))

    # CVaR / Expected Shortfall
    cvar_95 = float(sorted_r[sorted_r <= var_95_hist].mean())
    cvar_99 = float(sorted_r[sorted_r <= var_99_hist].mean())

    # Parametric VaR (normal distribution)
    mu, sigma = float(r.mean()), float(r.std())
    var_95_param = float(stats.norm.ppf(0.05, mu, sigma))
    var_99_param = float(stats.norm.ppf(0.01, mu, sigma))

    skewness = float(r.skew())
    kurtosis = float(r.kurtosis())  # excess kurtosis

    result = {
        "total_return": total_return,
        "cagr": cagr,
        "ann_vol": ann_vol,
        "sharpe": sharpe,
        "sortino": sortino,
        "calmar": calmar,
        "max_drawdown": max_drawdown,
        "max_drawdown_duration": max_dd_duration,
        "current_drawdown": current_drawdown,
        "var_95_hist": var_95_hist,
        "var_99_hist": var_99_hist,
        "var_95_param": var_95_param,
        "var_99_param": var_99_param,
        "cvar_95": cvar_95,
        "cvar_99": cvar_99,
        "skewness": skewness,
        "kurtosis": kurtosis,
    }

    # ── vs Benchmark ──────────────────────────────────────────────────────────
    if benchmark_returns is not None:
        bench = benchmark_returns.reindex(r.index).dropna()
        strat = r.reindex(bench.index).dropna()
        common = strat.index.intersection(bench.index)
        strat = strat.loc[common]
        bench = bench.loc[common]

        bench_var = float(bench.var())
        beta = float(strat.cov(bench) / bench_var) if bench_var > 0 else 0.0

        bench_ann = float((1 + bench.mean()) ** TRADING_DAYS - 1.0)
        strat_ann = float((1 + strat.mean()) ** TRADING_DAYS - 1.0)
        alpha = strat_ann - rf - beta * (bench_ann - rf)

        active = strat - bench
        te = float(active.std() * np.sqrt(TRADING_DAYS))
        info_ratio = float(active.mean() * TRADING_DAYS / te) if te > 0 else 0.0

        # Up/Down capture: geometric monthly returns
        bench_m = (1 + bench).resample("ME").prod() - 1
        strat_m = (1 + strat).resample("ME").prod() - 1
        idx_m = bench_m.index.intersection(strat_m.index)
        bench_m = bench_m.loc[idx_m]
        strat_m = strat_m.loc[idx_m]

        up = bench_m > 0
        dn = bench_m < 0
        up_capture = (
            float((1 + strat_m[up]).prod() ** (1 / up.sum()) /
                  (1 + bench_m[up]).prod() ** (1 / up.sum()))
            if up.any() else None
        )
        down_capture = (
            float((1 + strat_m[dn]).prod() ** (1 / dn.sum()) /
                  (1 + bench_m[dn]).prod() ** (1 / dn.sum()))
            if dn.any() else None
        )

        result.update({
            "alpha": alpha,
            "beta": beta,
            "info_ratio": info_ratio,
            "up_capture": up_capture,
            "down_capture": down_capture,
        })

    return result
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/arthur/risk-tearsheet
pytest tests/test_metrics.py -v
```

Expected: 9 passed.

- [ ] **Step 5: Commit**

```bash
git add risk_tearsheet/metrics.py tests/test_metrics.py
git commit -m "feat: metrics — VaR, CVaR, drawdown, Sharpe, Sortino, benchmark stats"
```

---

### Task 4: terminal.py

**Files:**
- Create: `/Users/arthur/risk-tearsheet/risk_tearsheet/terminal.py`

No unit tests for rendering output — visual correctness verified by running the CLI in Task 6.

- [ ] **Step 1: Implement `terminal.py`**

Create `/Users/arthur/risk-tearsheet/risk_tearsheet/terminal.py`:

```python
"""Rich terminal summary table."""
from __future__ import annotations

from rich.console import Console
from rich.table import Table
from rich import box

console = Console()


def _pct(v: float | None, decimals: int = 1) -> str:
    if v is None:
        return "n/a"
    return f"{v * 100:+.{decimals}f}%"


def _f(v: float | None, decimals: int = 2) -> str:
    if v is None:
        return "n/a"
    return f"{v:.{decimals}f}"


def print_summary(metrics: dict, title: str, start: str, end: str) -> None:
    """Print a two-column Rich table of risk metrics."""
    table = Table(
        box=box.SIMPLE_HEAD,
        show_header=True,
        header_style="bold #6c56ff",
        border_style="#2a2d3a",
        title=f"[bold white]{title}[/]  [dim]{start} to {end}[/]",
        title_justify="left",
        expand=False,
        min_width=52,
    )
    table.add_column("Metric", style="#a0aab8", no_wrap=True, min_width=22)
    table.add_column("Value", style="bold white", justify="right", min_width=16)

    rows = [
        ("CAGR",              _pct(metrics.get("cagr"))),
        ("Total return",      _pct(metrics.get("total_return"))),
        ("Ann. volatility",   _pct(metrics.get("ann_vol"))),
        ("Sharpe ratio",      _f(metrics.get("sharpe"))),
        ("Sortino ratio",     _f(metrics.get("sortino"))),
        ("Calmar ratio",      _f(metrics.get("calmar"))),
        None,  # separator
        ("Max drawdown",
            f"{_pct(metrics.get('max_drawdown'))}  "
            f"[dim]({metrics.get('max_drawdown_duration', 0)}d)[/]"),
        ("Current drawdown",  _pct(metrics.get("current_drawdown"))),
        None,
        ("Hist VaR  95%",     _pct(metrics.get("var_95_hist"), 2)),
        ("Hist VaR  99%",     _pct(metrics.get("var_99_hist"), 2)),
        ("Param VaR 95%",     _pct(metrics.get("var_95_param"), 2)),
        ("Param VaR 99%",     _pct(metrics.get("var_99_param"), 2)),
        ("CVaR 95%",          _pct(metrics.get("cvar_95"), 2)),
        ("CVaR 99%",          _pct(metrics.get("cvar_99"), 2)),
        None,
        ("Skewness",          _f(metrics.get("skewness"))),
        ("Excess kurtosis",   _f(metrics.get("kurtosis"))),
    ]

    if "alpha" in metrics:
        rows += [
            None,
            ("Alpha (ann.)",   _pct(metrics.get("alpha"))),
            ("Beta",           _f(metrics.get("beta"))),
            ("Info ratio",     _f(metrics.get("info_ratio"))),
            ("Up capture",     _pct(metrics.get("up_capture"))),
            ("Down capture",   _pct(metrics.get("down_capture"))),
        ]

    for row in rows:
        if row is None:
            table.add_section()
        else:
            table.add_row(*row)

    console.print(table)
```

- [ ] **Step 2: Commit**

```bash
cd /Users/arthur/risk-tearsheet
git add risk_tearsheet/terminal.py
git commit -m "feat: terminal — Rich summary table"
```

---

### Task 5: tearsheet.py

**Files:**
- Create: `/Users/arthur/risk-tearsheet/risk_tearsheet/tearsheet.py`

- [ ] **Step 1: Implement `tearsheet.py`**

Create `/Users/arthur/risk-tearsheet/risk_tearsheet/tearsheet.py`:

```python
"""5-panel matplotlib tearsheet — PDF + PNG output."""
from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
import matplotlib.colors as mcolors
import numpy as np
import pandas as pd
from scipy import stats

# ── Dark theme (matches momentum-backtester) ──────────────────────────────────
BG           = "#0f1117"
PANEL_BG     = "#13151c"
STRATEGY_CLR = "#6c56ff"
BENCH_CLR    = "#4a5068"
DD_CLR       = "#f43f5e"
TEXT_CLR     = "#edf0f8"
MUTED_CLR    = "#7d8799"
GRID_CLR     = "#2a2d3a"


def render(
    daily_returns: pd.Series,
    benchmark_returns: pd.Series | None,
    metrics: dict,
    title: str,
    output_dir: Path = Path("results"),
) -> None:
    """
    Render a 5-panel tearsheet and save as PNG (150 dpi) and PDF.

    Panels:
      0 — Metrics strip
      1 — Cumulative return vs benchmark (log scale)
      2 — Drawdown (red fill)
      3 — Monthly returns heatmap
      4 — Return distribution with normal overlay
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    equity = (1 + daily_returns).cumprod()

    fig = plt.figure(figsize=(14, 13), facecolor=BG)
    gs = gridspec.GridSpec(
        6, 1,
        height_ratios=[0.5, 2.2, 1.0, 1.6, 1.4, 0.0],
        hspace=0.10,
        top=0.95, bottom=0.05, left=0.08, right=0.97,
    )

    # ── Panel 0: Metrics strip ────────────────────────────────────────────────
    ax0 = fig.add_subplot(gs[0])
    ax0.set_facecolor(PANEL_BG)
    ax0.axis("off")

    strip_items = [
        ("CAGR",        f"{metrics['cagr']*100:.1f}%"),
        ("Sharpe",      f"{metrics['sharpe']:.2f}"),
        ("Sortino",     f"{metrics['sortino']:.2f}"),
        ("Max DD",      f"{metrics['max_drawdown']*100:.1f}%"),
        ("VaR 95%",     f"{metrics['var_95_hist']*100:.2f}%"),
        ("CVaR 95%",    f"{metrics['cvar_95']*100:.2f}%"),
        ("Calmar",      f"{metrics['calmar']:.2f}"),
    ]
    for i, (label, value) in enumerate(strip_items):
        x = 0.01 + i * 0.138
        color = DD_CLR if label in ("Max DD", "VaR 95%", "CVaR 95%") else STRATEGY_CLR
        ax0.text(x, 0.75, label, transform=ax0.transAxes,
                 fontsize=8, color=MUTED_CLR, fontfamily="monospace")
        ax0.text(x, 0.10, value, transform=ax0.transAxes,
                 fontsize=13, color=color, fontweight="bold", fontfamily="monospace")
    ax0.set_title(title, color=TEXT_CLR, fontsize=10, loc="right", pad=4)

    # ── Panel 1: Cumulative return ────────────────────────────────────────────
    ax1 = fig.add_subplot(gs[1])
    ax1.set_facecolor(PANEL_BG)
    ax1.plot(equity.index, equity.values, color=STRATEGY_CLR,
             linewidth=1.5, label="Strategy")
    ax1.fill_between(equity.index, equity.values, alpha=0.07, color=STRATEGY_CLR)

    if benchmark_returns is not None:
        bench_equity = (1 + benchmark_returns.reindex(daily_returns.index).ffill()).cumprod()
        ax1.plot(bench_equity.index, bench_equity.values, color=BENCH_CLR,
                 linewidth=1.0, linestyle="--", label="Benchmark")

    ax1.set_yscale("log")
    ax1.set_ylabel("Cumulative Return (log)", color=MUTED_CLR, fontsize=8)
    ax1.tick_params(colors=MUTED_CLR, labelsize=7, labelbottom=False)
    ax1.spines[:].set_color(GRID_CLR)
    ax1.legend(fontsize=8, facecolor=PANEL_BG, labelcolor=TEXT_CLR,
               framealpha=0.8, loc="upper left")

    # ── Panel 2: Drawdown ─────────────────────────────────────────────────────
    ax2 = fig.add_subplot(gs[2], sharex=ax1)
    ax2.set_facecolor(PANEL_BG)
    roll_max = equity.cummax()
    drawdown = (equity - roll_max) / roll_max
    ax2.fill_between(drawdown.index, drawdown.values, 0, color=DD_CLR, alpha=0.6)
    ax2.plot(drawdown.index, drawdown.values, color=DD_CLR, linewidth=0.8)
    ax2.set_ylabel("Drawdown", color=MUTED_CLR, fontsize=8)
    ax2.tick_params(colors=MUTED_CLR, labelsize=7, labelbottom=False)
    ax2.spines[:].set_color(GRID_CLR)

    # ── Panel 3: Monthly returns heatmap ──────────────────────────────────────
    ax3 = fig.add_subplot(gs[3])
    ax3.set_facecolor(PANEL_BG)

    monthly = (1 + daily_returns).resample("ME").prod() - 1
    df_m = pd.DataFrame({
        "year":  monthly.index.year,
        "month": monthly.index.month,
        "ret":   monthly.values,
    })
    heatmap = df_m.pivot(index="year", columns="month", values="ret")
    heatmap = heatmap.sort_index(ascending=False)

    vmax = max(abs(monthly.min()), abs(monthly.max()), 0.01)
    cmap = plt.get_cmap("RdYlGn")

    month_labels = ["Jan","Feb","Mar","Apr","May","Jun",
                    "Jul","Aug","Sep","Oct","Nov","Dec"]

    for row_i, year in enumerate(heatmap.index):
        for col_i in range(1, 13):
            val = heatmap.loc[year, col_i] if col_i in heatmap.columns else np.nan
            norm_val = 0.5 if np.isnan(val) else (val / vmax / 2 + 0.5)
            color = cmap(np.clip(norm_val, 0, 1))
            ax3.add_patch(plt.Rectangle(
                (col_i - 1, row_i), 1, 1,
                facecolor=color, edgecolor=PANEL_BG, linewidth=0.5,
            ))
            if not np.isnan(val):
                text_color = "black" if 0.3 < norm_val < 0.7 else "white"
                ax3.text(col_i - 0.5, row_i + 0.5, f"{val*100:.1f}",
                         ha="center", va="center", fontsize=6.5,
                         color=text_color, fontfamily="monospace")

    ax3.set_xlim(0, 12)
    ax3.set_ylim(0, len(heatmap))
    ax3.set_xticks([i + 0.5 for i in range(12)])
    ax3.set_xticklabels(month_labels, fontsize=7, color=MUTED_CLR)
    ax3.set_yticks([i + 0.5 for i in range(len(heatmap))])
    ax3.set_yticklabels(heatmap.index.tolist(), fontsize=7, color=MUTED_CLR)
    ax3.tick_params(length=0)
    ax3.set_ylabel("Monthly Returns (%)", color=MUTED_CLR, fontsize=8)
    ax3.spines[:].set_color(GRID_CLR)

    # ── Panel 4: Return distribution ──────────────────────────────────────────
    ax4 = fig.add_subplot(gs[4])
    ax4.set_facecolor(PANEL_BG)

    r_vals = daily_returns.dropna().values
    ax4.hist(r_vals, bins=60, color=STRATEGY_CLR, alpha=0.5,
             density=True, label="Daily returns")

    mu, sigma = r_vals.mean(), r_vals.std()
    x = np.linspace(r_vals.min(), r_vals.max(), 300)
    ax4.plot(x, stats.norm.pdf(x, mu, sigma), color=TEXT_CLR,
             linewidth=1.2, linestyle="--", label="Normal fit")

    for var, color, lbl in [
        (metrics["var_95_hist"], "#F59E0B", "VaR 95%"),
        (metrics["var_99_hist"], DD_CLR,    "VaR 99%"),
    ]:
        ax4.axvline(var, color=color, linewidth=1.0, linestyle=":", label=lbl)

    ax4.set_ylabel("Density", color=MUTED_CLR, fontsize=8)
    ax4.set_xlabel("Daily return", color=MUTED_CLR, fontsize=8)
    ax4.tick_params(colors=MUTED_CLR, labelsize=7)
    ax4.spines[:].set_color(GRID_CLR)
    ax4.legend(fontsize=7, facecolor=PANEL_BG, labelcolor=TEXT_CLR, framealpha=0.8)

    # ── Footer ────────────────────────────────────────────────────────────────
    fig.text(0.08, 0.01, "Arthur Gagniare · github.com/AGagniare/risk-tearsheet",
             color=MUTED_CLR, fontsize=7, ha="left")
    fig.text(0.97, 0.01, "Statistical analysis only — not financial advice.",
             color=MUTED_CLR, fontsize=7, ha="right")

    out_png = output_dir / "tearsheet.png"
    out_pdf = output_dir / "tearsheet.pdf"
    plt.savefig(out_png, dpi=150, bbox_inches="tight", facecolor=BG)
    plt.savefig(out_pdf, bbox_inches="tight", facecolor=BG)
    plt.close(fig)
    print(f"Tearsheet saved → {out_png}")
```

- [ ] **Step 2: Commit**

```bash
cd /Users/arthur/risk-tearsheet
git add risk_tearsheet/tearsheet.py
git commit -m "feat: tearsheet — 5-panel matplotlib PDF/PNG with monthly heatmap"
```

---

### Task 6: cli.py

**Files:**
- Create: `/Users/arthur/risk-tearsheet/risk_tearsheet/cli.py`

- [ ] **Step 1: Implement `cli.py`**

Create `/Users/arthur/risk-tearsheet/risk_tearsheet/cli.py`:

```python
"""CLI entry point."""
from __future__ import annotations

from pathlib import Path

import click

from risk_tearsheet.loader import load
from risk_tearsheet.metrics import compute
from risk_tearsheet.tearsheet import render
from risk_tearsheet.terminal import print_summary


@click.group()
def main() -> None:
    """risk-tearsheet — portfolio risk analytics CLI."""


@main.command()
@click.argument("csv_path", type=click.Path(exists=True))
@click.option("--benchmark", "-b", default=None,
              help="Benchmark ticker to fetch from yfinance (e.g. SPY).")
@click.option("--rf", default=0.0, show_default=True,
              help="Annual risk-free rate (e.g. 0.045 for 4.5%).")
@click.option("--title", "-t", default="Strategy",
              help="Strategy name shown in tearsheet and terminal.")
@click.option("--output", "-o", default="results",
              show_default=True,
              help="Output directory for tearsheet files.")
@click.option("--no-tearsheet", is_flag=True, default=False,
              help="Print terminal summary only, skip PDF/PNG rendering.")
def analyze(
    csv_path: str,
    benchmark: str | None,
    rf: float,
    title: str,
    output: str,
    no_tearsheet: bool,
) -> None:
    """Analyse CSV_PATH and produce a risk summary + tearsheet."""
    click.echo(f"Loading {csv_path}…")
    data = load(csv_path, benchmark_ticker=benchmark)

    click.echo("Computing metrics…")
    metrics = compute(data.daily_returns, data.benchmark_returns, rf=rf)

    print_summary(metrics, title=title, start=data.start_date, end=data.end_date)

    if not no_tearsheet:
        click.echo("Rendering tearsheet…")
        render(
            daily_returns=data.daily_returns,
            benchmark_returns=data.benchmark_returns,
            metrics=metrics,
            title=title,
            output_dir=Path(output),
        )
```

- [ ] **Step 2: Verify CLI is wired up**

```bash
cd /Users/arthur/risk-tearsheet
risk-tearsheet --help
```

Expected output:
```
Usage: risk-tearsheet [OPTIONS] COMMAND [ARGS]...

  risk-tearsheet — portfolio risk analytics CLI.

Options:
  --help  Show this message and exit.

Commands:
  analyze  Analyse CSV_PATH and produce a risk summary + tearsheet.
```

- [ ] **Step 3: Commit**

```bash
git add risk_tearsheet/cli.py
git commit -m "feat: cli — click entry point wiring loader, metrics, terminal, tearsheet"
```

---

### Task 7: Smoke test with sample data

**Files:**
- Create: `/Users/arthur/risk-tearsheet/sample/portfolio.csv`

- [ ] **Step 1: Generate a sample CSV**

Create `/Users/arthur/risk-tearsheet/sample/portfolio.csv`:

```csv
date,equity
2020-01-02,1.0000
```

Then run this Python snippet to generate 5 years of synthetic data and overwrite the file:

```bash
cd /Users/arthur/risk-tearsheet
python - <<'EOF'
import pandas as pd
import numpy as np

np.random.seed(42)
idx = pd.bdate_range("2020-01-02", "2024-12-31")
r = np.random.normal(0.0006, 0.012, len(idx))
equity = pd.Series(np.cumprod(1 + r), index=idx)
df = pd.DataFrame({"date": idx.strftime("%Y-%m-%d"), "equity": equity.values})
df.to_csv("sample/portfolio.csv", index=False)
print(f"Written {len(df)} rows")
EOF
```

Expected: `Written 1258 rows` (approx)

- [ ] **Step 2: Run the CLI — terminal summary only**

```bash
cd /Users/arthur/risk-tearsheet
risk-tearsheet analyze sample/portfolio.csv --title "Synthetic Strategy" --no-tearsheet
```

Expected: Rich table printed with CAGR, Sharpe, VaR etc. No errors.

- [ ] **Step 3: Run the CLI — full tearsheet with benchmark**

```bash
cd /Users/arthur/risk-tearsheet
risk-tearsheet analyze sample/portfolio.csv --title "Synthetic Strategy" --benchmark SPY --output results/
```

Expected:
```
Loading sample/portfolio.csv…
Computing metrics…
[rich table printed]
Rendering tearsheet…
Tearsheet saved → results/tearsheet.png
```

- [ ] **Step 4: Verify output files exist**

```bash
ls -lh results/
```

Expected: `tearsheet.png` (~200–400 KB) and `tearsheet.pdf`.

- [ ] **Step 5: Run the full test suite**

```bash
cd /Users/arthur/risk-tearsheet
pytest -v
```

Expected: 13 tests passed (4 loader + 9 metrics).

- [ ] **Step 6: Commit**

```bash
git add sample/portfolio.csv results/.gitkeep 2>/dev/null || true
git add sample/
echo "results/" >> .gitignore
echo "__pycache__/" >> .gitignore
echo "*.egg-info/" >> .gitignore
git add .gitignore
git commit -m "feat: sample data + smoke test passing"
```

- [ ] **Step 7: Push to GitHub**

Create a new repo `risk-tearsheet` on GitHub at github.com/AGagniare, then:

```bash
cd /Users/arthur/risk-tearsheet
git remote add origin https://github.com/AGagniare/risk-tearsheet.git
git push -u origin main
```

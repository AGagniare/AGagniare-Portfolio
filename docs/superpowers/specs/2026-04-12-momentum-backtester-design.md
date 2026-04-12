# Cross-Sectional Momentum Backtester — Design Spec

**Date:** 2026-04-12  
**Author:** Arthur Gagniare  
**Target roles:** Quant research / systematic trading (Japan market focus)  
**Stack:** Python · pandas · NumPy · matplotlib · yfinance

---

## 1. Goal

Build a professional-grade Python backtesting engine for cross-sectional equity momentum strategies on S&P 500 constituents. The engine produces a publication-quality tearsheet and a JSON metrics file. It lives in its own GitHub repository and is linked from the portfolio.

The primary audience is quant interviewers — the code quality, methodology rigour, and awareness of real-world issues (survivorship bias, transaction costs, short-term reversal) matter as much as the results.

---

## 2. Repository

New standalone repo: `AGagniare/momentum-backtester`  
Not inside the existing Next.js portfolio repo.

```
momentum-backtester/
├── run_backtest.py          # CLI entry point
├── src/
│   ├── __init__.py
│   ├── universe.py          # point-in-time S&P 500 membership
│   ├── data.py              # yfinance fetch + parquet cache
│   ├── signals.py           # momentum signal computation
│   ├── portfolio.py         # vol-weighted top-N selection
│   ├── engine.py            # monthly rebalancing loop
│   ├── analytics.py         # performance metrics
│   └── tearsheet.py         # matplotlib tearsheet renderer
├── data/
│   ├── sp500_history.csv    # historical constituents (committed)
│   └── prices.parquet       # generated on first run, gitignored
├── results/                 # gitignored, created on run
│   ├── tearsheet.png
│   └── metrics.json
├── notebooks/
│   └── analysis.ipynb       # EDA + results walkthrough
├── requirements.txt
└── README.md
```

---

## 3. Architecture

A linear pipeline of 6 modules. Each module has a single responsibility and communicates through well-defined inputs/outputs.

```
constituents.csv + yfinance
        ↓
  universe.py  ←→  data.py
        ↓
  signals.py
        ↓
  portfolio.py
        ↓
  engine.py  (BacktestResult)
        ↓
  analytics.py  +  tearsheet.py
        ↓
  results/tearsheet.png + metrics.json
```

---

## 4. Configuration

All parameters are exposed as CLI flags via `argparse` with sensible defaults. Internally passed as a dataclass:

```python
@dataclass
class BacktestConfig:
    lookback_months: int = 12    # momentum lookback window
    skip_months: int = 1         # months skipped before lookback (reversal filter)
    top_n: int = 20              # portfolio size
    costs_bps: float = 10.0      # round-trip transaction cost in basis points
    start: str = "2010-01-01"    # backtest start date
    end: str | None = None       # backtest end date (None = today)
```

CLI usage:
```bash
python run_backtest.py --lookback 12 --skip 1 --top-n 20 --costs-bps 10 --start 2010-01-01
```

---

## 5. Module Specifications

### 5.1 `universe.py`

**Purpose:** Return the set of S&P 500 constituents valid on a given date.

**Data source:** `data/sp500_history.csv` — sourced from the public `datashane/s&p500-historical-components` dataset, committed to the repo. Contains membership change events with effective dates.

**Interface:**
```python
def get_constituents(date: pd.Timestamp) -> list[str]:
    """Return tickers that were S&P 500 members on `date`."""

def get_all_tickers() -> list[str]:
    """Return union of all tickers ever in the index (for bulk price download)."""
```

**Survivorship bias note:** Point-in-time membership ensures the backtest only uses information available at each decision point. This is explicitly documented in the README and available as a talking point in interviews.

---

### 5.2 `data.py`

**Purpose:** Fetch and cache adjusted close prices for all universe tickers plus SPY.

**Behaviour:**
- On first run: downloads all tickers via `yfinance.download()` (bulk call), saves to `data/prices.parquet`
- Subsequent runs: loads from parquet cache — no API calls
- Returns a `pd.DataFrame` with dates as index, tickers as columns (adjusted close)
- SPY is always included for benchmark calculations

**Interface:**
```python
def load_prices(tickers: list[str], start: str, end: str | None = None) -> pd.DataFrame:
    """Load adjusted close prices. Downloads and caches on first call."""
```

**Design notes:**
- Parquet chosen over CSV: faster I/O, smaller file size, handles wide DataFrames efficiently
- Adjusted close accounts for splits and dividends — correct for total return momentum
- Missing tickers (delistings, mergers) are silently dropped with a warning; this is expected behaviour for historical constituents

---

### 5.3 `signals.py`

**Purpose:** Compute cross-sectional momentum scores for eligible stocks at a rebalance date.

**Momentum definition:** Jegadeesh & Titman (1993) standard — total return over `[t - skip - lookback, t - skip]` months.

With defaults: 12-month return ending 1 month ago. Skipping the most recent month avoids contamination from short-term price reversal.

**Interface:**
```python
def compute_momentum(
    prices: pd.DataFrame,
    date: pd.Timestamp,
    eligible: list[str],
    lookback_months: int = 12,
    skip_months: int = 1,
) -> pd.Series:
    """Return momentum scores for eligible tickers, sorted descending (rank 1 = highest momentum)."""
```

**Edge cases:**
- Tickers with insufficient price history at `date` are excluded
- Scores are raw total returns, not z-scored (ranking is sufficient for selection)

---

### 5.4 `portfolio.py`

**Purpose:** Select top-N stocks by momentum, compute volatility-based weights, and measure turnover.

**Weighting:** Inverse-volatility weighting using trailing 21-day realized volatility. Weights are normalized to sum to 1.

```
w_i = (1 / σ_i) / Σ(1 / σ_j)   for i in top-N
```

**Turnover:** Sum of absolute weight changes vs. previous period's weights. Used by the engine to apply transaction costs.

**Constituent changes:** If a current holding is no longer in the eligible universe at rebalance (dropped from S&P 500), it is liquidated and proceeds redistributed among the new portfolio.

**Interface:**
```python
def construct_portfolio(
    scores: pd.Series,
    prices: pd.DataFrame,
    date: pd.Timestamp,
    prev_weights: pd.Series | None,
    top_n: int = 20,
) -> tuple[pd.Series, float]:
    """Return (weights, turnover). weights is a Series indexed by ticker."""
```

---

### 5.5 `engine.py`

**Purpose:** Run the monthly rebalancing loop and produce the backtest results.

**Loop logic (monthly, month-end dates):**
1. Get eligible universe for this date
2. Compute momentum signals
3. Construct vol-weighted portfolio (top N)
4. Compute turnover vs. previous weights
5. Apply cost: `net_return -= turnover × costs_bps / 10_000`
6. Record weights, gross return, net return, turnover

Between rebalances the portfolio drifts with market returns (no intra-month rebalancing).

**Return type:**
```python
@dataclass
class BacktestResult:
    equity_curve: pd.Series          # daily, indexed by date, starts at 1.0
    benchmark_curve: pd.Series       # SPY daily, same index
    monthly_weights: pd.DataFrame    # tickers × rebalance dates
    monthly_turnover: pd.Series      # per rebalance date
    config: BacktestConfig
```

**Interface:**
```python
def run(prices: pd.DataFrame, config: BacktestConfig) -> BacktestResult:
    """Execute the backtest. Returns a BacktestResult."""
```

---

### 5.6 `analytics.py`

**Purpose:** Compute all performance metrics from a `BacktestResult`.

**Metrics computed:**

| Metric | Definition |
|--------|-----------|
| CAGR | Annualized compound return |
| Sharpe ratio | Annualized return / annualized vol (risk-free = 0) |
| Sortino ratio | Annualized return / annualized downside vol |
| Max drawdown | Maximum peak-to-trough decline |
| Calmar ratio | CAGR / max drawdown |
| Rolling 12-month Sharpe | Computed monthly, annualized |
| Rolling 36-month beta | OLS regression of strategy vs SPY monthly returns |
| Average monthly turnover | Mean of `monthly_turnover` |

**Interface:**
```python
def compute_metrics(result: BacktestResult) -> dict:
    """Return all metrics as a flat dict. Saved to results/metrics.json."""
```

---

### 5.7 `tearsheet.py`

**Purpose:** Render a multi-panel matplotlib figure and save to `results/tearsheet.png` (and optionally `results/tearsheet.pdf`).

**Layout (4 panels + metrics strip):**
1. **Metrics strip** (top): CAGR, Sharpe, Sortino, Max DD, Avg Turnover, Avg Beta — 6 numbers at a glance
2. **Panel 1** (tall): Cumulative return — strategy vs SPY on log scale
3. **Panel 2**: Drawdown (red fill)
4. **Panel 3**: Rolling 12-month Sharpe
5. **Panel 4**: Rolling 36-month beta vs SPY

**Style:** Dark theme consistent with the credit-risk-model palette (`#0f1117` background, `#6c56ff` strategy, `#f43f5e` drawdown, `#7d8799` benchmark). Footer with author name, GitHub link, and data attribution.

**Interface:**
```python
def render(result: BacktestResult, metrics: dict, output_dir: Path = Path("results")) -> None:
    """Save tearsheet.png and tearsheet.pdf to output_dir."""
```

---

## 6. Data Flow Summary

```
run_backtest.py (CLI args → BacktestConfig)
    → data.py: load_prices()          # fetch/cache all prices
    → engine.run(prices, config)
        → universe.get_constituents(date)
        → signals.compute_momentum(...)
        → portfolio.construct_portfolio(...)
        → [loop monthly]
    → analytics.compute_metrics(result)
    → tearsheet.render(result, metrics)
    → results/tearsheet.png + results/metrics.json
```

---

## 7. README Structure

The README is a first-class deliverable for quant interviewers. Sections:

1. **Project summary** (2-3 sentences)
2. **Live tearsheet image** (embedded PNG)
3. **Results table** (key metrics)
4. **Methodology** — momentum definition, universe construction, vol-weighting, cost model
5. **Limitations & known biases** — data limitations (yfinance adjusted close quality), cost model simplifications, no slippage model
6. **Running locally** — one-command setup
7. **Stack**

The Limitations section is intentional and important: it signals intellectual honesty, which quant interviewers value highly.

---

## 8. Out of Scope

- Short-selling / long-short portfolio (noted as natural extension in README)
- Intraday execution or market impact modelling
- Walk-forward optimization of parameters
- Streamlit dashboard (pure engine + tearsheet is the right format for this audience)
- Japanese equities universe (noted as potential extension)

---

## 9. Interview Talking Points

Key things to be ready to discuss:

- **Survivorship bias**: "I used a point-in-time constituent list — stocks are only eligible if they were actually in the index on that date."
- **Short-term reversal**: "I skip the most recent month before the lookback window, following Jegadeesh & Titman (1993)."
- **Transaction costs**: "I used 10bps round-trip, which is conservative for large-cap US equities. The engine is parameterized so you can stress-test at 20 or 50bps."
- **Vol-weighting**: "Equal-weight concentrates risk in high-vol stocks. Inverse-vol weighting equalizes the risk contribution of each position."
- **Parquet cache**: "yfinance has rate limits and isn't suitable for repeated downloads in production. I cache to parquet on first run."

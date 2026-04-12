# Cross-Sectional Momentum Backtester — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a professional Python backtesting engine for cross-sectional equity momentum on S&P 500 constituents, producing a publication-quality tearsheet and JSON metrics file.

**Architecture:** Linear pipeline — `universe → data → signals → portfolio → engine → analytics → tearsheet`. Each stage is a focused module in `src/`. Entry point is `run_backtest.py` (argparse CLI). All parameters are configurable with sensible defaults.

**Tech Stack:** Python 3.11+, pandas 2.x, NumPy, matplotlib, yfinance, pyarrow (parquet), pytest

---

> ⚠️ **All implementation work happens in a NEW repo at `/Users/arthur/momentum-backtester`** — NOT inside the portfolio repo. This plan document lives in the portfolio repo at `docs/superpowers/plans/`.

---

## File Map

| File | Responsibility |
|------|---------------|
| `run_backtest.py` | CLI entry point (argparse) |
| `src/__init__.py` | Package marker |
| `src/universe.py` | Point-in-time S&P 500 constituent lookup |
| `src/data.py` | yfinance fetch + parquet cache |
| `src/signals.py` | Cross-sectional momentum scores |
| `src/portfolio.py` | Inverse-vol top-N selection + turnover |
| `src/engine.py` | Monthly loop + `BacktestConfig` + `BacktestResult` |
| `src/analytics.py` | Sharpe, Sortino, drawdown, rolling beta |
| `src/tearsheet.py` | matplotlib tearsheet renderer |
| `scripts/fetch_sp500_history.py` | One-time script to generate `data/sp500_history.csv` |
| `data/sp500_history.csv` | Historical S&P 500 membership events (committed) |
| `data/prices.parquet` | Price cache (gitignored, generated on first run) |
| `results/tearsheet.png` | Tearsheet output (gitignored, except sample committed at end) |
| `results/metrics.json` | Metrics output (gitignored) |
| `tests/conftest.py` | Shared pytest fixtures (synthetic prices + CSV) |
| `tests/test_universe.py` | Universe tests |
| `tests/test_signals.py` | Signal tests |
| `tests/test_portfolio.py` | Portfolio construction tests |
| `tests/test_engine.py` | Engine loop tests |
| `tests/test_analytics.py` | Metrics computation tests |
| `tests/test_tearsheet.py` | Tearsheet smoke test |

---

## Task 1: Repository Scaffolding

**Files:**
- Create: `/Users/arthur/momentum-backtester/` (entire directory structure)
- Create: `requirements.txt`
- Create: `.gitignore`
- Create: `tests/conftest.py`

- [ ] **Step 1: Create the repo directory and initialize git**

```bash
mkdir -p /Users/arthur/momentum-backtester
cd /Users/arthur/momentum-backtester
git init
mkdir -p src data results notebooks scripts tests
touch src/__init__.py tests/__init__.py
```

- [ ] **Step 2: Write `requirements.txt`**

```
pandas>=2.0
numpy>=1.24
matplotlib>=3.7
yfinance>=0.2.36
pyarrow>=12.0
scipy>=1.11
pytest>=7.4
pytest-mock>=3.11
```

- [ ] **Step 3: Write `.gitignore`**

```
data/prices.parquet
results/
__pycache__/
*.pyc
.venv/
*.egg-info/
.DS_Store
```

- [ ] **Step 4: Create virtual environment and install dependencies**

```bash
cd /Users/arthur/momentum-backtester
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Expected: all packages install without error.

- [ ] **Step 5: Write `tests/conftest.py`**

```python
"""Shared pytest fixtures for the momentum backtester test suite."""

import pytest
import pandas as pd
import numpy as np


@pytest.fixture
def prices():
    """Synthetic daily adjusted close prices for 6 stocks + SPY over 3 years."""
    dates = pd.bdate_range("2019-01-01", "2022-01-01")
    np.random.seed(42)
    tickers = ["AAPL", "MSFT", "GOOG", "AMZN", "META", "NVDA", "SPY"]
    data = {}
    for ticker in tickers:
        r = np.random.normal(0.0005, 0.015, len(dates))
        data[ticker] = 100.0 * np.cumprod(1 + r)
    return pd.DataFrame(data, index=dates)


@pytest.fixture
def constituents_csv(tmp_path):
    """Write a minimal sp500_history.csv to tmp_path and return its path."""
    content = (
        "date,ticker,action\n"
        "2019-01-01,AAPL,added\n"
        "2019-01-01,MSFT,added\n"
        "2019-01-01,GOOG,added\n"
        "2019-01-01,AMZN,added\n"
        "2019-01-01,META,added\n"
        "2019-01-01,NVDA,added\n"
        "2021-06-01,GOOG,removed\n"
    )
    p = tmp_path / "sp500_history.csv"
    p.write_text(content)
    return p
```

- [ ] **Step 6: Verify pytest discovers the fixtures**

```bash
cd /Users/arthur/momentum-backtester
pytest tests/ --collect-only
```

Expected: `0 tests collected` (no test files yet), no errors.

- [ ] **Step 7: Initial commit**

```bash
cd /Users/arthur/momentum-backtester
git add .
git commit -m "chore: initial repo scaffolding"
```

---

## Task 2: S&P 500 History Data

**Files:**
- Create: `scripts/fetch_sp500_history.py`
- Create: `data/sp500_history.csv` (generated by running the script)

- [ ] **Step 1: Write `scripts/fetch_sp500_history.py`**

```python
"""
Fetch S&P 500 historical constituent change events from Wikipedia.

Produces data/sp500_history.csv with columns: date, ticker, action
where action is 'added' or 'removed'.

Run once: python scripts/fetch_sp500_history.py
"""

import pandas as pd
from pathlib import Path


OUT_PATH = Path(__file__).parent.parent / "data" / "sp500_history.csv"


def fetch() -> pd.DataFrame:
    tables = pd.read_html(
        "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies",
        attrs={"id": "constituents"},
    )
    current = tables[0][["Symbol", "Date added"]].copy()
    current.columns = ["ticker", "date"]
    current["ticker"] = current["ticker"].str.replace(".", "-", regex=False)
    current["action"] = "added"
    current["date"] = pd.to_datetime(current["date"], errors="coerce")

    # Fill missing add dates with a far-back date so they're included from 2010
    current["date"] = current["date"].fillna(pd.Timestamp("2000-01-01"))

    # Historical changes table (second table on the Wikipedia page)
    try:
        changes_tables = pd.read_html(
            "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies",
            attrs={"id": "changes"},
        )
        changes = changes_tables[0].copy()
        changes.columns = ["_".join(c).strip() for c in changes.columns]

        # The changes table has added/removed columns — flatten to events
        events = []
        for _, row in changes.iterrows():
            date = pd.to_datetime(row.get("Date_Date", None), errors="coerce")
            if pd.isna(date):
                continue
            added = str(row.get("Added_Ticker", "")).strip()
            removed = str(row.get("Removed_Ticker", "")).strip()
            if added and added != "nan":
                events.append({"date": date, "ticker": added.replace(".", "-"), "action": "added"})
            if removed and removed != "nan":
                events.append({"date": date, "ticker": removed.replace(".", "-"), "action": "removed"})

        history = pd.DataFrame(events)
    except Exception:
        # Fallback: just use current constituents with their add dates
        history = pd.DataFrame(columns=["date", "ticker", "action"])

    combined = pd.concat([current[["date", "ticker", "action"]], history], ignore_index=True)
    combined = combined.dropna(subset=["date", "ticker"])
    combined = combined.sort_values("date").reset_index(drop=True)
    return combined


if __name__ == "__main__":
    OUT_PATH.parent.mkdir(exist_ok=True)
    df = fetch()
    df.to_csv(OUT_PATH, index=False)
    print(f"Saved {len(df)} events to {OUT_PATH}")
    print(df.tail())
```

- [ ] **Step 2: Run the script to generate `data/sp500_history.csv`**

```bash
cd /Users/arthur/momentum-backtester
source .venv/bin/activate
python scripts/fetch_sp500_history.py
```

Expected output (approximate):
```
Saved ~600 events to data/sp500_history.csv
         date ticker   action
...
```

- [ ] **Step 3: Inspect the CSV**

```bash
head -5 data/sp500_history.csv
wc -l data/sp500_history.csv
```

Expected: CSV has `date,ticker,action` header and several hundred rows.

- [ ] **Step 4: Commit**

```bash
cd /Users/arthur/momentum-backtester
git add data/sp500_history.csv scripts/fetch_sp500_history.py
git commit -m "data: add S&P 500 historical constituent events"
```

---

## Task 3: `src/universe.py`

**Files:**
- Create: `src/universe.py`
- Create: `tests/test_universe.py`

- [ ] **Step 1: Write failing tests in `tests/test_universe.py`**

```python
"""Tests for universe.py — point-in-time S&P 500 constituent lookup."""

import pandas as pd
import pytest
from unittest.mock import patch
from src.universe import get_constituents, get_all_tickers


def test_get_constituents_returns_tickers_added_before_date(constituents_csv):
    with patch("src.universe.HISTORY_PATH", constituents_csv):
        # Patch the lru_cache'd loader so it reads our test CSV
        import src.universe as u
        u._load_events.cache_clear()
        result = get_constituents(pd.Timestamp("2020-01-01"))

    assert "AAPL" in result
    assert "MSFT" in result
    assert "GOOG" in result


def test_get_constituents_excludes_removed_tickers(constituents_csv):
    with patch("src.universe.HISTORY_PATH", constituents_csv):
        import src.universe as u
        u._load_events.cache_clear()
        # GOOG was removed on 2021-06-01
        result_before = get_constituents(pd.Timestamp("2021-05-31"))
        result_after = get_constituents(pd.Timestamp("2021-07-01"))

    assert "GOOG" in result_before
    assert "GOOG" not in result_after


def test_get_constituents_returns_sorted_list(constituents_csv):
    with patch("src.universe.HISTORY_PATH", constituents_csv):
        import src.universe as u
        u._load_events.cache_clear()
        result = get_constituents(pd.Timestamp("2020-01-01"))

    assert result == sorted(result)


def test_get_all_tickers_includes_removed_tickers(constituents_csv):
    with patch("src.universe.HISTORY_PATH", constituents_csv):
        import src.universe as u
        u._load_events.cache_clear()
        result = get_all_tickers()

    # GOOG was removed but should still appear in the all-tickers list
    assert "GOOG" in result
    assert "AAPL" in result
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/arthur/momentum-backtester
pytest tests/test_universe.py -v
```

Expected: `ImportError` or `ModuleNotFoundError` — `src.universe` does not exist yet.

- [ ] **Step 3: Implement `src/universe.py`**

```python
"""Point-in-time S&P 500 constituent lookup."""

from functools import lru_cache
from pathlib import Path

import pandas as pd


HISTORY_PATH = Path(__file__).parent.parent / "data" / "sp500_history.csv"


@lru_cache(maxsize=1)
def _load_events() -> pd.DataFrame:
    """Load and cache the constituent change events CSV."""
    df = pd.read_csv(HISTORY_PATH, parse_dates=["date"])
    return df.sort_values("date").reset_index(drop=True)


def get_constituents(date: pd.Timestamp) -> list[str]:
    """Return tickers that were S&P 500 members on `date`."""
    events = _load_events()
    past = events[events["date"] <= date]
    members: set[str] = set()
    for _, row in past.iterrows():
        if row["action"] == "added":
            members.add(row["ticker"])
        elif row["action"] == "removed":
            members.discard(row["ticker"])
    return sorted(members)


def get_all_tickers() -> list[str]:
    """Return the union of all tickers ever in the index."""
    return sorted(_load_events()["ticker"].unique().tolist())
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pytest tests/test_universe.py -v
```

Expected: `4 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/universe.py tests/test_universe.py
git commit -m "feat: add universe module with point-in-time constituent lookup"
```

---

## Task 4: `src/data.py`

**Files:**
- Create: `src/data.py`
- Create: `tests/test_data.py`

- [ ] **Step 1: Write failing tests in `tests/test_data.py`**

```python
"""Tests for data.py — price fetching and parquet cache."""

import pandas as pd
import numpy as np
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock
from src.data import load_prices


def _make_fake_download(tickers, start, end):
    """Return a fake yfinance bulk download result."""
    dates = pd.bdate_range(start, end or "2022-01-01")
    np.random.seed(0)
    data = {t: 100 * np.cumprod(1 + np.random.normal(0, 0.01, len(dates))) for t in tickers}
    return pd.DataFrame(data, index=dates)


def test_load_prices_returns_dataframe_with_correct_columns(tmp_path):
    tickers = ["AAPL", "SPY"]
    with patch("src.data.CACHE_PATH", tmp_path / "prices.parquet"), \
         patch("src.data._download", side_effect=_make_fake_download):
        result = load_prices(tickers, "2021-01-01", "2021-06-30")

    assert isinstance(result, pd.DataFrame)
    assert "AAPL" in result.columns
    assert "SPY" in result.columns


def test_load_prices_caches_to_parquet(tmp_path):
    tickers = ["AAPL", "SPY"]
    cache = tmp_path / "prices.parquet"
    with patch("src.data.CACHE_PATH", cache), \
         patch("src.data._download", side_effect=_make_fake_download) as mock_dl:
        load_prices(tickers, "2021-01-01", "2021-06-30")
        assert cache.exists()
        # Second call should NOT trigger download
        load_prices(tickers, "2021-01-01", "2021-06-30")
        assert mock_dl.call_count == 1


def test_load_prices_index_is_datetime(tmp_path):
    tickers = ["AAPL", "SPY"]
    with patch("src.data.CACHE_PATH", tmp_path / "prices.parquet"), \
         patch("src.data._download", side_effect=_make_fake_download):
        result = load_prices(tickers, "2021-01-01", "2021-06-30")

    assert isinstance(result.index, pd.DatetimeIndex)
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pytest tests/test_data.py -v
```

Expected: `ImportError` — `src.data` does not exist yet.

- [ ] **Step 3: Implement `src/data.py`**

```python
"""Fetch and cache adjusted close prices via yfinance."""

import warnings
from pathlib import Path

import pandas as pd
import yfinance as yf


CACHE_PATH = Path(__file__).parent.parent / "data" / "prices.parquet"


def _download(tickers: list[str], start: str, end: str | None) -> pd.DataFrame:
    """Download adjusted close prices from yfinance (bulk call)."""
    print(f"Downloading {len(tickers)} tickers from yfinance...")
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        raw = yf.download(
            tickers,
            start=start,
            end=end,
            auto_adjust=True,
            progress=False,
            threads=True,
        )
    # yfinance returns MultiIndex columns when multiple tickers
    if isinstance(raw.columns, pd.MultiIndex):
        close = raw["Close"]
    else:
        close = raw[["Close"]].rename(columns={"Close": tickers[0]})
    return close.dropna(how="all")


def load_prices(
    tickers: list[str],
    start: str,
    end: str | None = None,
) -> pd.DataFrame:
    """
    Return adjusted close prices as a DataFrame (dates × tickers).

    Downloads from yfinance on first call and saves to parquet.
    Subsequent calls load from the parquet cache — no API calls.
    Missing tickers (delistings) are silently dropped.
    """
    if CACHE_PATH.exists():
        cached = pd.read_parquet(CACHE_PATH)
        return cached

    df = _download(tickers, start, end)
    CACHE_PATH.parent.mkdir(exist_ok=True)
    df.to_parquet(CACHE_PATH)
    print(f"Cached prices to {CACHE_PATH}")
    return df
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pytest tests/test_data.py -v
```

Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/data.py tests/test_data.py
git commit -m "feat: add data module with yfinance fetch and parquet cache"
```

---

## Task 5: `src/signals.py`

**Files:**
- Create: `src/signals.py`
- Create: `tests/test_signals.py`

- [ ] **Step 1: Write failing tests in `tests/test_signals.py`**

```python
"""Tests for signals.py — cross-sectional momentum computation."""

import pandas as pd
import numpy as np
import pytest
from src.signals import compute_momentum


def test_compute_momentum_returns_series(prices):
    eligible = ["AAPL", "MSFT", "GOOG"]
    date = pd.Timestamp("2021-01-29")
    result = compute_momentum(prices, date, eligible)

    assert isinstance(result, pd.Series)
    assert set(result.index).issubset(set(eligible))


def test_compute_momentum_sorted_descending(prices):
    eligible = ["AAPL", "MSFT", "GOOG", "AMZN"]
    date = pd.Timestamp("2021-01-29")
    result = compute_momentum(prices, date, eligible)

    assert list(result.values) == sorted(result.values, reverse=True)


def test_compute_momentum_skips_missing_tickers(prices):
    eligible = ["AAPL", "NONEXISTENT"]
    date = pd.Timestamp("2021-01-29")
    result = compute_momentum(prices, date, eligible)

    assert "NONEXISTENT" not in result.index
    assert "AAPL" in result.index


def test_compute_momentum_uses_skip_month(prices):
    """
    With skip_months=1, the signal window ends 1 month before `date`.
    Verify by checking that the score is based on prices ending ~1 month ago.
    """
    eligible = ["AAPL"]
    date = pd.Timestamp("2021-01-29")

    score_skip1 = compute_momentum(prices, date, eligible, lookback_months=6, skip_months=1)
    score_skip0 = compute_momentum(prices, date, eligible, lookback_months=6, skip_months=0)

    # Scores should differ because the window endpoint differs
    assert score_skip1["AAPL"] != score_skip0["AAPL"]


def test_compute_momentum_excludes_insufficient_history(prices):
    """Tickers with less than lookback+skip months of history are excluded."""
    # prices fixture starts at 2019-01-01; requesting lookback from 2019-03-01
    # with 12-month lookback + 1-month skip means we need data from 2018-02-01
    eligible = ["AAPL"]
    date = pd.Timestamp("2019-06-01")  # only ~5 months into the price series

    result = compute_momentum(prices, date, eligible, lookback_months=12, skip_months=1)
    # AAPL should be excluded because there's not enough history
    assert "AAPL" not in result.index
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pytest tests/test_signals.py -v
```

Expected: `ImportError` — `src.signals` does not exist yet.

- [ ] **Step 3: Implement `src/signals.py`**

```python
"""Cross-sectional momentum signal computation."""

import pandas as pd


def compute_momentum(
    prices: pd.DataFrame,
    date: pd.Timestamp,
    eligible: list[str],
    lookback_months: int = 12,
    skip_months: int = 1,
) -> pd.Series:
    """
    Compute momentum scores for eligible tickers at `date`.

    Momentum = total return over [date - skip - lookback, date - skip].
    Follows Jegadeesh & Titman (1993): skip_months=1 avoids short-term reversal.

    Returns a Series sorted descending (highest momentum first).
    Tickers with insufficient history are excluded.
    """
    skip_date = date - pd.DateOffset(months=skip_months)
    start_date = skip_date - pd.DateOffset(months=lookback_months)

    scores: dict[str, float] = {}
    for ticker in eligible:
        if ticker not in prices.columns:
            continue

        series = prices[ticker].dropna()

        end_candidates = series.index[series.index <= skip_date]
        start_candidates = series.index[series.index <= start_date]

        if len(end_candidates) == 0 or len(start_candidates) == 0:
            continue

        end_price = series[end_candidates[-1]]
        start_price = series[start_candidates[-1]]

        if start_price <= 0:
            continue

        scores[ticker] = end_price / start_price - 1.0

    return pd.Series(scores).sort_values(ascending=False)
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pytest tests/test_signals.py -v
```

Expected: `5 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/signals.py tests/test_signals.py
git commit -m "feat: add signals module with configurable 12-1 momentum"
```

---

## Task 6: `src/portfolio.py`

**Files:**
- Create: `src/portfolio.py`
- Create: `tests/test_portfolio.py`

- [ ] **Step 1: Write failing tests in `tests/test_portfolio.py`**

```python
"""Tests for portfolio.py — inverse-vol top-N construction."""

import pandas as pd
import numpy as np
import pytest
from src.portfolio import construct_portfolio


def _make_scores(tickers):
    """Return a fake momentum scores Series."""
    return pd.Series(
        {t: float(i) for i, t in enumerate(reversed(tickers))},
    ).sort_values(ascending=False)


def test_construct_portfolio_returns_correct_types(prices):
    tickers = ["AAPL", "MSFT", "GOOG", "AMZN"]
    scores = _make_scores(tickers)
    date = pd.Timestamp("2021-01-29")
    weights, turnover = construct_portfolio(scores, prices, date, None, top_n=3)

    assert isinstance(weights, pd.Series)
    assert isinstance(turnover, float)


def test_construct_portfolio_selects_top_n(prices):
    tickers = ["AAPL", "MSFT", "GOOG", "AMZN", "META"]
    scores = _make_scores(tickers)
    date = pd.Timestamp("2021-01-29")
    weights, _ = construct_portfolio(scores, prices, date, None, top_n=3)

    assert len(weights) == 3
    # Top 3 by score should be selected
    assert set(weights.index) == set(scores.head(3).index)


def test_construct_portfolio_weights_sum_to_one(prices):
    tickers = ["AAPL", "MSFT", "GOOG", "AMZN"]
    scores = _make_scores(tickers)
    date = pd.Timestamp("2021-01-29")
    weights, _ = construct_portfolio(scores, prices, date, None, top_n=4)

    assert abs(weights.sum() - 1.0) < 1e-9


def test_construct_portfolio_weights_all_positive(prices):
    tickers = ["AAPL", "MSFT", "GOOG"]
    scores = _make_scores(tickers)
    date = pd.Timestamp("2021-01-29")
    weights, _ = construct_portfolio(scores, prices, date, None, top_n=3)

    assert (weights > 0).all()


def test_construct_portfolio_turnover_is_one_on_first_call(prices):
    """First rebalance: prev_weights=None means full portfolio construction."""
    tickers = ["AAPL", "MSFT", "GOOG"]
    scores = _make_scores(tickers)
    date = pd.Timestamp("2021-01-29")
    _, turnover = construct_portfolio(scores, prices, date, None, top_n=3)

    assert abs(turnover - 1.0) < 1e-9


def test_construct_portfolio_turnover_zero_when_unchanged(prices):
    """If weights don't change, turnover should be 0."""
    tickers = ["AAPL", "MSFT", "GOOG"]
    scores = _make_scores(tickers)
    date = pd.Timestamp("2021-01-29")
    weights, _ = construct_portfolio(scores, prices, date, None, top_n=3)
    # Second call with same scores and prev_weights = current weights
    _, turnover = construct_portfolio(scores, prices, date, weights, top_n=3)

    assert turnover < 1e-6
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pytest tests/test_portfolio.py -v
```

Expected: `ImportError` — `src.portfolio` does not exist yet.

- [ ] **Step 3: Implement `src/portfolio.py`**

```python
"""Inverse-volatility top-N portfolio construction."""

import numpy as np
import pandas as pd


def construct_portfolio(
    scores: pd.Series,
    prices: pd.DataFrame,
    date: pd.Timestamp,
    prev_weights: pd.Series | None,
    top_n: int = 20,
) -> tuple[pd.Series, float]:
    """
    Select top-N stocks by momentum score, weight by inverse volatility.

    Volatility is trailing 21-day realized vol from daily price returns.
    Returns (weights, one_way_turnover).

    One-way turnover = sum of absolute weight increases / 2, so that
    full portfolio construction from scratch gives turnover = 1.0.
    """
    selected = scores.head(top_n).index.tolist()

    # Trailing 21-day vol window ending at date
    end_loc = prices.index.get_indexer([date], method="ffill")[0]
    start_loc = max(0, end_loc - 21)
    window = prices.iloc[start_loc : end_loc + 1][selected]

    daily_ret = window.pct_change().dropna()
    vol = daily_ret.std()

    # Guard against zero vol
    vol = vol.where(vol > 0, other=vol[vol > 0].mean())

    inv_vol = 1.0 / vol
    weights = inv_vol / inv_vol.sum()

    # One-way turnover
    if prev_weights is None:
        turnover = 1.0
    else:
        all_tickers = weights.index.union(prev_weights.index)
        w_new = weights.reindex(all_tickers, fill_value=0.0)
        w_old = prev_weights.reindex(all_tickers, fill_value=0.0)
        turnover = (w_new - w_old).abs().sum() / 2.0

    return weights, float(turnover)
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pytest tests/test_portfolio.py -v
```

Expected: `6 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/portfolio.py tests/test_portfolio.py
git commit -m "feat: add portfolio module with inverse-vol weighting"
```

---

## Task 7: `src/engine.py`

**Files:**
- Create: `src/engine.py`
- Create: `tests/test_engine.py`

- [ ] **Step 1: Write failing tests in `tests/test_engine.py`**

```python
"""Tests for engine.py — monthly rebalancing loop."""

import pandas as pd
import numpy as np
import pytest
from unittest.mock import patch
from src.engine import BacktestConfig, BacktestResult, run


@pytest.fixture
def config():
    return BacktestConfig(
        lookback_months=6,
        skip_months=1,
        top_n=3,
        costs_bps=10.0,
        start="2020-01-01",
        end="2021-01-01",
    )


def test_run_returns_backtest_result(prices, constituents_csv, config):
    with patch("src.universe.HISTORY_PATH", constituents_csv):
        import src.universe as u; u._load_events.cache_clear()
        result = run(prices, config)

    assert isinstance(result, BacktestResult)


def test_equity_curve_starts_at_one(prices, constituents_csv, config):
    with patch("src.universe.HISTORY_PATH", constituents_csv):
        import src.universe as u; u._load_events.cache_clear()
        result = run(prices, config)

    assert abs(result.equity_curve.iloc[0] - 1.0) < 1e-9


def test_equity_curve_length_matches_price_index(prices, constituents_csv, config):
    with patch("src.universe.HISTORY_PATH", constituents_csv):
        import src.universe as u; u._load_events.cache_clear()
        result = run(prices, config)

    expected_dates = prices.loc[config.start : config.end].index
    assert len(result.equity_curve) == len(expected_dates)


def test_benchmark_curve_starts_at_one(prices, constituents_csv, config):
    with patch("src.universe.HISTORY_PATH", constituents_csv):
        import src.universe as u; u._load_events.cache_clear()
        result = run(prices, config)

    assert abs(result.benchmark_curve.iloc[0] - 1.0) < 1e-9


def test_monthly_turnover_entries_between_zero_and_one(prices, constituents_csv, config):
    with patch("src.universe.HISTORY_PATH", constituents_csv):
        import src.universe as u; u._load_events.cache_clear()
        result = run(prices, config)

    assert (result.monthly_turnover >= 0).all()
    assert (result.monthly_turnover <= 1.0 + 1e-9).all()


def test_monthly_weights_sum_to_one(prices, constituents_csv, config):
    with patch("src.universe.HISTORY_PATH", constituents_csv):
        import src.universe as u; u._load_events.cache_clear()
        result = run(prices, config)

    for date, row in result.monthly_weights.iterrows():
        w = row.dropna()
        if len(w) > 0:
            assert abs(w.sum() - 1.0) < 1e-6
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pytest tests/test_engine.py -v
```

Expected: `ImportError` — `src.engine` does not exist yet.

- [ ] **Step 3: Implement `src/engine.py`**

```python
"""Monthly rebalancing engine — core backtest loop."""

from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd

from src.portfolio import construct_portfolio
from src.signals import compute_momentum
from src.universe import get_constituents


@dataclass
class BacktestConfig:
    lookback_months: int = 12
    skip_months: int = 1
    top_n: int = 20
    costs_bps: float = 10.0
    start: str = "2010-01-01"
    end: str | None = None


@dataclass
class BacktestResult:
    equity_curve: pd.Series
    benchmark_curve: pd.Series
    monthly_weights: pd.DataFrame
    monthly_turnover: pd.Series
    config: BacktestConfig


def run(prices: pd.DataFrame, config: BacktestConfig) -> BacktestResult:
    """
    Execute the cross-sectional momentum backtest.

    Monthly rebalancing on business-month-end dates.
    Between rebalances the portfolio drifts with market returns
    (buy-and-hold intra-month, no daily rebalancing).
    Transaction costs are applied at each rebalance as:
        cost = one_way_turnover × costs_bps / 10_000
    """
    start = pd.Timestamp(config.start)
    end = pd.Timestamp(config.end) if config.end else prices.index[-1]

    daily = prices.loc[start:end].copy()
    all_dates = daily.index

    # Monthly rebalance dates (business month end)
    rebalance_dates = set(
        pd.date_range(start, end, freq=pd.offsets.BMonthEnd())
    )

    # Benchmark: SPY normalised to 1.0
    spy = daily["SPY"]
    benchmark_curve = spy / spy.iloc[0]

    equity_values = pd.Series(index=all_dates, dtype=float)
    equity_values.iloc[0] = 1.0

    weights_history: dict[pd.Timestamp, pd.Series] = {}
    turnover_history: dict[pd.Timestamp, float] = {}

    current_weights: pd.Series | None = None
    prev_weights: pd.Series | None = None
    portfolio_value = 1.0

    for i in range(1, len(all_dates)):
        date = all_dates[i]
        prev_date = all_dates[i - 1]

        # Rebalance
        if date in rebalance_dates:
            eligible = get_constituents(date)
            scores = compute_momentum(
                prices, date, eligible,
                config.lookback_months, config.skip_months,
            )
            if len(scores) >= config.top_n:
                new_weights, turnover = construct_portfolio(
                    scores, prices, date, prev_weights, config.top_n
                )
                cost = turnover * config.costs_bps / 10_000.0
                portfolio_value *= (1.0 - cost)
                current_weights = new_weights
                prev_weights = new_weights
                weights_history[date] = new_weights
                turnover_history[date] = turnover

        # Daily return (buy-and-hold intra-month)
        if current_weights is not None:
            day_ret = daily.loc[date] / daily.loc[prev_date] - 1.0
            aligned = day_ret.reindex(current_weights.index, fill_value=0.0)
            port_ret = (current_weights * aligned).sum()

            # Drift weights with market
            new_values = current_weights * (1.0 + aligned)
            if new_values.sum() > 0:
                current_weights = new_values / new_values.sum()

            portfolio_value *= (1.0 + port_ret)

        equity_values.iloc[i] = portfolio_value

    # Before first rebalance, equity = 1.0
    equity_values = equity_values.ffill().fillna(1.0)

    monthly_weights = pd.DataFrame(weights_history).T
    monthly_turnover = pd.Series(turnover_history, name="turnover")

    return BacktestResult(
        equity_curve=equity_values,
        benchmark_curve=benchmark_curve,
        monthly_weights=monthly_weights,
        monthly_turnover=monthly_turnover,
        config=config,
    )
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pytest tests/test_engine.py -v
```

Expected: `6 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/engine.py tests/test_engine.py
git commit -m "feat: add engine module with monthly rebalancing loop"
```

---

## Task 8: `src/analytics.py`

**Files:**
- Create: `src/analytics.py`
- Create: `tests/test_analytics.py`

- [ ] **Step 1: Write failing tests in `tests/test_analytics.py`**

```python
"""Tests for analytics.py — performance metrics."""

import pandas as pd
import numpy as np
import pytest
from src.analytics import compute_metrics
from src.engine import BacktestConfig, BacktestResult


def _make_result(seed: int = 0) -> BacktestResult:
    """Construct a minimal BacktestResult with synthetic equity curves."""
    np.random.seed(seed)
    dates = pd.bdate_range("2020-01-01", "2022-01-01")
    strat_ret = np.random.normal(0.0008, 0.012, len(dates))
    bench_ret = np.random.normal(0.0004, 0.010, len(dates))
    equity = pd.Series(np.cumprod(1 + strat_ret), index=dates)
    benchmark = pd.Series(np.cumprod(1 + bench_ret), index=dates)
    return BacktestResult(
        equity_curve=equity,
        benchmark_curve=benchmark,
        monthly_weights=pd.DataFrame(),
        monthly_turnover=pd.Series([0.4, 0.3, 0.5] * 8),
        config=BacktestConfig(),
    )


def test_compute_metrics_returns_dict():
    result = _make_result()
    metrics = compute_metrics(result)
    assert isinstance(metrics, dict)


def test_compute_metrics_has_required_keys():
    result = _make_result()
    metrics = compute_metrics(result)
    required = {"cagr", "sharpe", "sortino", "max_drawdown", "calmar",
                 "avg_turnover", "rolling_sharpe", "rolling_beta"}
    assert required.issubset(metrics.keys())


def test_compute_metrics_cagr_is_reasonable():
    result = _make_result()
    metrics = compute_metrics(result)
    # CAGR should be between -50% and +100% for synthetic data
    assert -0.5 < metrics["cagr"] < 1.0


def test_compute_metrics_max_drawdown_is_negative():
    result = _make_result()
    metrics = compute_metrics(result)
    assert metrics["max_drawdown"] <= 0


def test_compute_metrics_sharpe_is_float():
    result = _make_result()
    metrics = compute_metrics(result)
    assert isinstance(metrics["sharpe"], float)


def test_compute_metrics_rolling_sharpe_is_series():
    result = _make_result()
    metrics = compute_metrics(result)
    assert isinstance(metrics["rolling_sharpe"], pd.Series)


def test_compute_metrics_rolling_beta_is_series():
    result = _make_result()
    metrics = compute_metrics(result)
    assert isinstance(metrics["rolling_beta"], pd.Series)
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pytest tests/test_analytics.py -v
```

Expected: `ImportError` — `src.analytics` does not exist yet.

- [ ] **Step 3: Implement `src/analytics.py`**

```python
"""Performance analytics — Sharpe, Sortino, drawdown, rolling beta."""

from __future__ import annotations

import numpy as np
import pandas as pd

from src.engine import BacktestResult

TRADING_DAYS = 252


def compute_metrics(result: BacktestResult) -> dict:
    """
    Compute full performance attribution from a BacktestResult.

    Returns a flat dict. Scalars are Python floats; rolling series
    are pd.Series objects. The dict is JSON-serialisable after
    converting the series to lists.
    """
    equity = result.equity_curve
    benchmark = result.benchmark_curve

    daily_ret = equity.pct_change().dropna()
    bench_ret = benchmark.pct_change().dropna()

    # CAGR
    n_years = len(daily_ret) / TRADING_DAYS
    cagr = float(equity.iloc[-1] ** (1.0 / n_years) - 1.0) if n_years > 0 else 0.0

    # Sharpe (risk-free = 0)
    mean_ret = daily_ret.mean()
    std_ret = daily_ret.std()
    sharpe = float(mean_ret / std_ret * np.sqrt(TRADING_DAYS)) if std_ret > 0 else 0.0

    # Sortino (downside vol only)
    downside = daily_ret[daily_ret < 0]
    down_std = downside.std()
    sortino = float(mean_ret / down_std * np.sqrt(TRADING_DAYS)) if down_std > 0 else 0.0

    # Max drawdown
    roll_max = equity.cummax()
    drawdown = (equity - roll_max) / roll_max
    max_drawdown = float(drawdown.min())

    # Calmar
    calmar = float(cagr / abs(max_drawdown)) if max_drawdown < 0 else 0.0

    # Average monthly turnover
    avg_turnover = float(result.monthly_turnover.mean()) if len(result.monthly_turnover) > 0 else 0.0

    # Rolling 12-month Sharpe (annualised, monthly)
    monthly_ret = equity.resample("BME").last().pct_change().dropna()
    window = 12
    roll_mean = monthly_ret.rolling(window).mean()
    roll_std = monthly_ret.rolling(window).std()
    rolling_sharpe = (roll_mean / roll_std * np.sqrt(12)).dropna()

    # Rolling 36-month beta vs benchmark (monthly)
    bench_monthly = benchmark.resample("BME").last().pct_change().dropna()
    aligned_strat = monthly_ret.reindex(bench_monthly.index).dropna()
    aligned_bench = bench_monthly.reindex(aligned_strat.index).dropna()

    beta_window = 36
    rolling_cov = aligned_strat.rolling(beta_window).cov(aligned_bench)
    rolling_var = aligned_bench.rolling(beta_window).var()
    rolling_beta = (rolling_cov / rolling_var).dropna()

    return {
        "cagr": cagr,
        "sharpe": sharpe,
        "sortino": sortino,
        "max_drawdown": max_drawdown,
        "calmar": calmar,
        "avg_turnover": avg_turnover,
        "rolling_sharpe": rolling_sharpe,
        "rolling_beta": rolling_beta,
    }
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pytest tests/test_analytics.py -v
```

Expected: `7 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/analytics.py tests/test_analytics.py
git commit -m "feat: add analytics module with Sharpe, Sortino, drawdown, rolling beta"
```

---

## Task 9: `src/tearsheet.py`

**Files:**
- Create: `src/tearsheet.py`
- Create: `tests/test_tearsheet.py`

- [ ] **Step 1: Write smoke test in `tests/test_tearsheet.py`**

```python
"""Smoke test for tearsheet.py — verifies the PNG is written without error."""

import pandas as pd
import numpy as np
import pytest
import matplotlib
matplotlib.use("Agg")  # non-interactive backend for tests

from src.tearsheet import render
from src.engine import BacktestConfig, BacktestResult
from src.analytics import compute_metrics


def _make_result() -> BacktestResult:
    np.random.seed(7)
    dates = pd.bdate_range("2020-01-01", "2022-01-01")
    strat_ret = np.random.normal(0.0008, 0.012, len(dates))
    bench_ret = np.random.normal(0.0004, 0.010, len(dates))
    equity = pd.Series(np.cumprod(1 + strat_ret), index=dates)
    benchmark = pd.Series(np.cumprod(1 + bench_ret), index=dates)
    return BacktestResult(
        equity_curve=equity,
        benchmark_curve=benchmark,
        monthly_weights=pd.DataFrame(),
        monthly_turnover=pd.Series([0.4, 0.3, 0.5] * 8),
        config=BacktestConfig(),
    )


def test_render_creates_png(tmp_path):
    result = _make_result()
    metrics = compute_metrics(result)
    render(result, metrics, output_dir=tmp_path)

    assert (tmp_path / "tearsheet.png").exists()
    assert (tmp_path / "tearsheet.png").stat().st_size > 10_000  # non-trivial file


def test_render_creates_pdf(tmp_path):
    result = _make_result()
    metrics = compute_metrics(result)
    render(result, metrics, output_dir=tmp_path)

    assert (tmp_path / "tearsheet.pdf").exists()
```

- [ ] **Step 2: Run smoke test to confirm it fails**

```bash
pytest tests/test_tearsheet.py -v
```

Expected: `ImportError` — `src.tearsheet` does not exist yet.

- [ ] **Step 3: Implement `src/tearsheet.py`**

```python
"""Multi-panel matplotlib tearsheet renderer."""

from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
import numpy as np
import pandas as pd

from src.engine import BacktestResult


# Dark theme palette (matches credit-risk-model)
BG = "#0f1117"
PANEL_BG = "#13151c"
STRATEGY_COLOR = "#6c56ff"
BENCHMARK_COLOR = "#4a5068"
DRAWDOWN_COLOR = "#f43f5e"
TEXT_COLOR = "#edf0f8"
MUTED_COLOR = "#7d8799"


def render(
    result: BacktestResult,
    metrics: dict,
    output_dir: Path = Path("results"),
) -> None:
    """
    Render a 4-panel tearsheet and save as PNG and PDF.

    Layout:
      - Metrics strip (top bar)
      - Panel 1: Cumulative return vs SPY (log scale)
      - Panel 2: Drawdown
      - Panel 3: Rolling 12-month Sharpe
      - Panel 4: Rolling 36-month Beta vs SPY
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    fig = plt.figure(figsize=(14, 10), facecolor=BG)
    gs = gridspec.GridSpec(
        5, 1,
        height_ratios=[0.6, 2.5, 1.2, 1.2, 1.2],
        hspace=0.08,
        top=0.95, bottom=0.07, left=0.08, right=0.97,
    )

    cfg = result.config

    # ── Metrics strip ──────────────────────────────────────────────────────────
    ax_metrics = fig.add_subplot(gs[0])
    ax_metrics.set_facecolor(PANEL_BG)
    ax_metrics.axis("off")

    metric_items = [
        ("CAGR", f"{metrics['cagr']*100:.1f}%"),
        ("Sharpe", f"{metrics['sharpe']:.2f}"),
        ("Sortino", f"{metrics['sortino']:.2f}"),
        ("Max DD", f"{metrics['max_drawdown']*100:.1f}%"),
        ("Avg Turnover", f"{metrics['avg_turnover']*100:.1f}%"),
        ("Calmar", f"{metrics['calmar']:.2f}"),
    ]
    for i, (label, value) in enumerate(metric_items):
        x = 0.01 + i * 0.165
        color = DRAWDOWN_COLOR if label == "Max DD" else STRATEGY_COLOR
        ax_metrics.text(x, 0.72, label, transform=ax_metrics.transAxes,
                        fontsize=8, color=MUTED_COLOR, fontfamily="monospace")
        ax_metrics.text(x, 0.15, value, transform=ax_metrics.transAxes,
                        fontsize=14, color=color, fontweight="bold", fontfamily="monospace")

    title = (
        f"S&P 500 Cross-Sectional Momentum  ·  "
        f"lookback={cfg.lookback_months}m  skip={cfg.skip_months}m  "
        f"top-N={cfg.top_n}  costs={cfg.costs_bps:.0f}bps  "
        f"{cfg.start[:4]}–{result.equity_curve.index[-1].year}"
    )
    ax_metrics.set_title(title, color=TEXT_COLOR, fontsize=10, loc="right", pad=4)

    # ── Panel 1: Cumulative return (log scale) ─────────────────────────────────
    ax1 = fig.add_subplot(gs[1])
    ax1.set_facecolor(PANEL_BG)
    ax1.plot(result.equity_curve.index, result.equity_curve.values,
             color=STRATEGY_COLOR, linewidth=1.5, label="Strategy")
    ax1.plot(result.benchmark_curve.index, result.benchmark_curve.values,
             color=BENCHMARK_COLOR, linewidth=1.0, linestyle="--", label="SPY")
    ax1.fill_between(result.equity_curve.index, result.equity_curve.values,
                     alpha=0.07, color=STRATEGY_COLOR)
    ax1.set_yscale("log")
    ax1.set_ylabel("Cumulative Return (log)", color=MUTED_COLOR, fontsize=8)
    ax1.tick_params(colors=MUTED_COLOR, labelsize=7)
    ax1.spines[:].set_color("#2a2d3a")
    ax1.legend(fontsize=8, facecolor=PANEL_BG, labelcolor=TEXT_COLOR,
               framealpha=0.8, loc="upper left")
    ax1.tick_params(labelbottom=False)

    # ── Panel 2: Drawdown ──────────────────────────────────────────────────────
    ax2 = fig.add_subplot(gs[2], sharex=ax1)
    ax2.set_facecolor(PANEL_BG)
    roll_max = result.equity_curve.cummax()
    drawdown = (result.equity_curve - roll_max) / roll_max
    ax2.fill_between(drawdown.index, drawdown.values, 0,
                     color=DRAWDOWN_COLOR, alpha=0.6)
    ax2.plot(drawdown.index, drawdown.values, color=DRAWDOWN_COLOR, linewidth=0.8)
    ax2.set_ylabel("Drawdown", color=MUTED_COLOR, fontsize=8)
    ax2.tick_params(colors=MUTED_COLOR, labelsize=7)
    ax2.spines[:].set_color("#2a2d3a")
    ax2.tick_params(labelbottom=False)

    # ── Panel 3: Rolling 12-month Sharpe ──────────────────────────────────────
    ax3 = fig.add_subplot(gs[3], sharex=ax1)
    ax3.set_facecolor(PANEL_BG)
    rs = metrics["rolling_sharpe"]
    if len(rs) > 0:
        ax3.plot(rs.index, rs.values, color=STRATEGY_COLOR, linewidth=1.0)
        ax3.axhline(0, color="#2a2d3a", linewidth=0.8, linestyle="--")
        ax3.axhline(1, color=MUTED_COLOR, linewidth=0.5, linestyle=":")
    ax3.set_ylabel("Rolling Sharpe\n(12m)", color=MUTED_COLOR, fontsize=8)
    ax3.tick_params(colors=MUTED_COLOR, labelsize=7)
    ax3.spines[:].set_color("#2a2d3a")
    ax3.tick_params(labelbottom=False)

    # ── Panel 4: Rolling beta vs SPY ──────────────────────────────────────────
    ax4 = fig.add_subplot(gs[4], sharex=ax1)
    ax4.set_facecolor(PANEL_BG)
    rb = metrics["rolling_beta"]
    if len(rb) > 0:
        ax4.plot(rb.index, rb.values, color=TEXT_COLOR, linewidth=1.0)
        ax4.axhline(1, color=MUTED_COLOR, linewidth=0.5, linestyle="--")
    ax4.set_ylabel("Rolling Beta\nvs SPY (36m)", color=MUTED_COLOR, fontsize=8)
    ax4.tick_params(colors=MUTED_COLOR, labelsize=7)
    ax4.spines[:].set_color("#2a2d3a")

    # ── Footer ─────────────────────────────────────────────────────────────────
    fig.text(
        0.08, 0.01,
        "Arthur Gagniare · github.com/AGagniare/momentum-backtester",
        color=MUTED_COLOR, fontsize=7, ha="left",
    )
    fig.text(
        0.97, 0.01,
        "Data: yfinance · Universe: S&P 500 historical constituents (survivorship-bias-free)",
        color=MUTED_COLOR, fontsize=7, ha="right",
    )

    plt.savefig(output_dir / "tearsheet.png", dpi=150, bbox_inches="tight", facecolor=BG)
    plt.savefig(output_dir / "tearsheet.pdf", bbox_inches="tight", facecolor=BG)
    plt.close(fig)
    print(f"Tearsheet saved to {output_dir}/tearsheet.png")
```

- [ ] **Step 4: Run smoke test to confirm it passes**

```bash
pytest tests/test_tearsheet.py -v
```

Expected: `2 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/tearsheet.py tests/test_tearsheet.py
git commit -m "feat: add tearsheet renderer (dark theme, 4-panel matplotlib)"
```

---

## Task 10: `run_backtest.py` (CLI Entry Point)

**Files:**
- Create: `run_backtest.py`

- [ ] **Step 1: Implement `run_backtest.py`**

```python
"""
CLI entry point for the cross-sectional momentum backtester.

Usage:
    python run_backtest.py
    python run_backtest.py --lookback 6 --top-n 30 --costs-bps 20
    python run_backtest.py --start 2015-01-01 --end 2023-12-31
"""

import argparse
import json
from pathlib import Path

import pandas as pd

from src.data import load_prices
from src.engine import BacktestConfig, run
from src.analytics import compute_metrics
from src.tearsheet import render
from src.universe import get_all_tickers


def parse_args() -> BacktestConfig:
    parser = argparse.ArgumentParser(
        description="Cross-Sectional Momentum Backtester — S&P 500"
    )
    parser.add_argument("--lookback", type=int, default=12,
                        help="Momentum lookback window in months (default: 12)")
    parser.add_argument("--skip", type=int, default=1,
                        help="Months to skip before lookback window (default: 1)")
    parser.add_argument("--top-n", type=int, default=20,
                        help="Number of stocks in portfolio (default: 20)")
    parser.add_argument("--costs-bps", type=float, default=10.0,
                        help="Round-trip transaction cost in basis points (default: 10)")
    parser.add_argument("--start", type=str, default="2010-01-01",
                        help="Backtest start date YYYY-MM-DD (default: 2010-01-01)")
    parser.add_argument("--end", type=str, default=None,
                        help="Backtest end date YYYY-MM-DD (default: today)")
    args = parser.parse_args()
    return BacktestConfig(
        lookback_months=args.lookback,
        skip_months=args.skip,
        top_n=args.top_n,
        costs_bps=args.costs_bps,
        start=args.start,
        end=args.end,
    )


def main() -> None:
    config = parse_args()

    print(f"Config: {config}")
    print("Loading prices...")
    tickers = get_all_tickers() + ["SPY"]

    # Fetch prices far enough back for the first momentum calculation.
    # Momentum needs prices starting (lookback + skip + 2) months before config.start.
    price_start = (
        pd.Timestamp(config.start)
        - pd.DateOffset(months=config.lookback_months + config.skip_months + 2)
    ).strftime("%Y-%m-%d")
    prices = load_prices(tickers, start=price_start, end=config.end)

    print("Running backtest...")
    result = run(prices, config)

    print("Computing metrics...")
    metrics = compute_metrics(result)

    # Print summary
    print("\n── Results ──────────────────────────────")
    print(f"  CAGR:        {metrics['cagr']*100:.2f}%")
    print(f"  Sharpe:      {metrics['sharpe']:.3f}")
    print(f"  Sortino:     {metrics['sortino']:.3f}")
    print(f"  Max DD:      {metrics['max_drawdown']*100:.2f}%")
    print(f"  Calmar:      {metrics['calmar']:.3f}")
    print(f"  Avg Turnover:{metrics['avg_turnover']*100:.1f}% / month")
    print("─────────────────────────────────────────\n")

    # Save metrics JSON (strip non-serialisable series)
    out_dir = Path("results")
    out_dir.mkdir(exist_ok=True)
    scalar_metrics = {k: v for k, v in metrics.items()
                      if not hasattr(v, "__iter__") or isinstance(v, str)}
    (out_dir / "metrics.json").write_text(json.dumps(scalar_metrics, indent=2))

    print("Rendering tearsheet...")
    render(result, metrics, output_dir=out_dir)
    print("Done. See results/tearsheet.png")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run a dry-run with `--help` to verify CLI works**

```bash
cd /Users/arthur/momentum-backtester
source .venv/bin/activate
python run_backtest.py --help
```

Expected output:
```
usage: run_backtest.py [-h] [--lookback LOOKBACK] [--skip SKIP] ...
Cross-Sectional Momentum Backtester — S&P 500
...
```

- [ ] **Step 3: Run the full test suite to confirm nothing is broken**

```bash
pytest tests/ -v
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add run_backtest.py
git commit -m "feat: add CLI entry point with argparse"
```

---

## Task 11: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# Cross-Sectional Momentum Backtester

A Python backtesting engine for cross-sectional equity momentum strategies on
S&P 500 constituents. Implements monthly rebalancing, inverse-volatility
portfolio construction, transaction cost modelling, and full performance
attribution — with a publication-quality tearsheet.

## Live Tearsheet

![Tearsheet](results/tearsheet.png)

## Results (default parameters)

| Metric | Value |
|--------|-------|
| CAGR | — |
| Sharpe | — |
| Sortino | — |
| Max Drawdown | — |
| Avg Monthly Turnover | — |
| Backtest period | 2010–2025 |
| Universe | S&P 500 (survivorship-bias-free) |

> Fill in with actual values after running the backtest.

## Methodology

### Momentum Signal — Jegadeesh & Titman (1993)

At each monthly rebalance date *t*, the momentum score for stock *i* is:

```
score_i = P(t − 1) / P(t − 13) − 1
```

where *P(t − k)* is the adjusted close price *k* months before *t*.

**Why skip the most recent month?** Short-term price reversals (bid-ask bounce,
microstructure noise) contaminate the signal over horizons shorter than 1 month.
Skipping the most recent month — the standard in academic momentum literature —
removes this contamination and isolates the intermediate-horizon momentum effect.

### Universe Construction

The eligible universe at each rebalance date is the set of tickers that were
**actually S&P 500 members on that date**, loaded from a historical constituent
change log (`data/sp500_history.csv`). This avoids **survivorship bias** — the
error of only backtesting on stocks that survived to today, which inflates returns
by excluding companies that were delisted, went bankrupt, or were acquired.

### Portfolio Construction

The top 20 stocks by momentum score are selected. Weights are assigned by
**inverse-volatility**:

```
w_i = (1 / σ_i) / Σ_j (1 / σ_j)
```

where σ_i is the trailing 21-day realized volatility of stock *i*. This
equalises each stock's risk contribution — unlike equal-weighting, which
concentrates risk in high-volatility names.

### Transaction Cost Model

At each monthly rebalance, a round-trip cost of **10 basis points** per unit of
one-way turnover is applied:

```
net_return -= one_way_turnover × 10bps
```

10bps is conservative for large-cap US equities. The parameter is configurable
(`--costs-bps`), so you can stress-test the strategy at 20 or 50bps.

### Performance Attribution

| Metric | Definition |
|--------|-----------|
| CAGR | Annualised compound return |
| Sharpe | Annualised return / vol (risk-free = 0) |
| Sortino | Annualised return / downside vol |
| Max Drawdown | Maximum peak-to-trough decline |
| Calmar | CAGR / \|Max Drawdown\| |
| Rolling Sharpe | 12-month window, monthly, annualised |
| Rolling Beta | 36-month OLS vs SPY, monthly |

## Limitations

- **Price data quality**: yfinance adjusted-close prices can have errors for
  corporate actions (mergers, spin-offs). A production system would use a
  validated data vendor (Bloomberg, Refinitiv).
- **Transaction cost model**: The flat bps model ignores market impact and
  bid-ask spread variation. For large AUM, market impact dominates costs.
- **No shorting**: Long-only strategy. A long-short momentum factor would require
  margin assumptions and borrow cost modelling.
- **US equities only**: The universe is limited to S&P 500 (large-cap US). A
  natural extension is to apply the same engine to Japanese equities (TOPIX 500).

## Running Locally

```bash
git clone https://github.com/AGagniare/momentum-backtester.git
cd momentum-backtester
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python run_backtest.py
# Results saved to results/tearsheet.png and results/metrics.json
```

Custom parameters:
```bash
python run_backtest.py --lookback 6 --top-n 30 --costs-bps 20 --start 2015-01-01
```

## Stack

`Python` · `pandas` · `NumPy` · `matplotlib` · `yfinance` · `pyarrow`

## Dataset

Historical S&P 500 constituent change events sourced from
[Wikipedia — List of S&P 500 companies](https://en.wikipedia.org/wiki/List_of_S%26P_500_companies).
Price data via [yfinance](https://github.com/ranaroussi/yfinance) (adjusted close).

## Author

**Arthur Gagniare** — [Portfolio](https://agagniare.github.io/AGagniare-Portfolio) ·
[LinkedIn](https://linkedin.com/in/arthur-gagniare) ·
[credit-risk-model](https://github.com/AGagniare/credit-risk-model)
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with methodology, limitations, and running instructions"
```

---

## Task 11b: `notebooks/analysis.ipynb`

**Files:**
- Create: `notebooks/analysis.ipynb`

- [ ] **Step 1: Create the notebook with a narrative structure**

Open Jupyter and create `notebooks/analysis.ipynb` with the following cells in order:

**Cell 1 — Markdown header:**
```markdown
# Cross-Sectional Momentum — Analysis Walkthrough

End-to-end walkthrough: data loading → signal construction → backtest → tearsheet.
```

**Cell 2 — Imports:**
```python
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use("inline")

from src.universe import get_all_tickers, get_constituents
from src.data import load_prices
from src.signals import compute_momentum
from src.portfolio import construct_portfolio
from src.engine import BacktestConfig, run
from src.analytics import compute_metrics
from src.tearsheet import render
```

**Cell 3 — Markdown: Universe**
```markdown
## 1. Universe
Point-in-time S&P 500 constituents — no survivorship bias.
```

**Cell 4 — Universe exploration:**
```python
sample_date = pd.Timestamp("2020-06-30")
constituents = get_constituents(sample_date)
print(f"{len(constituents)} members on {sample_date.date()}")
print(constituents[:10])
```

**Cell 5 — Markdown: Prices**
```markdown
## 2. Price Data
Adjusted close prices fetched from yfinance and cached locally as parquet.
```

**Cell 6 — Price loading:**
```python
tickers = get_all_tickers() + ["SPY"]
prices = load_prices(tickers, start="2008-01-01")
print(f"Price matrix: {prices.shape[0]} days × {prices.shape[1]} tickers")
prices[["AAPL", "MSFT", "SPY"]].tail()
```

**Cell 7 — Markdown: Signals**
```markdown
## 3. Momentum Signal
12-1 momentum: 12-month return ending 1 month ago (Jegadeesh & Titman, 1993).
```

**Cell 8 — Signal inspection:**
```python
date = pd.Timestamp("2020-06-30")
eligible = get_constituents(date)
scores = compute_momentum(prices, date, eligible, lookback_months=12, skip_months=1)
print("Top 10 momentum stocks:")
print(scores.head(10))
print("\nBottom 10 (potential short candidates):")
print(scores.tail(10))
```

**Cell 9 — Markdown: Backtest**
```markdown
## 4. Backtest
Monthly rebalancing, inverse-vol top-20, 10bps round-trip costs.
```

**Cell 10 — Run backtest:**
```python
config = BacktestConfig(
    lookback_months=12, skip_months=1, top_n=20,
    costs_bps=10.0, start="2010-01-01"
)
result = run(prices, config)
metrics = compute_metrics(result)

print(f"CAGR:     {metrics['cagr']*100:.2f}%")
print(f"Sharpe:   {metrics['sharpe']:.3f}")
print(f"Sortino:  {metrics['sortino']:.3f}")
print(f"Max DD:   {metrics['max_drawdown']*100:.2f}%")
```

**Cell 11 — Quick equity curve plot:**
```python
fig, ax = plt.subplots(figsize=(12, 4), facecolor="#0f1117")
ax.set_facecolor("#13151c")
ax.plot(result.equity_curve, color="#6c56ff", label="Strategy")
ax.plot(result.benchmark_curve, color="#7d8799", linestyle="--", label="SPY")
ax.set_yscale("log")
ax.legend()
plt.tight_layout()
plt.show()
```

**Cell 12 — Render full tearsheet:**
```python
render(result, metrics)
from IPython.display import Image
Image("results/tearsheet.png")
```

- [ ] **Step 2: Run all cells top-to-bottom and verify no errors**

`Kernel → Restart & Run All` — all cells should execute without errors. The tearsheet image should display inline in the last cell.

- [ ] **Step 3: Commit**

```bash
git add notebooks/analysis.ipynb
git commit -m "docs: add analysis notebook with end-to-end walkthrough"
```

---

## Task 12: End-to-End Run + Commit Sample Tearsheet

- [ ] **Step 1: Run the full backtest**

```bash
cd /Users/arthur/momentum-backtester
source .venv/bin/activate
python run_backtest.py
```

Expected: runs without error, prints metrics summary, saves `results/tearsheet.png` and `results/metrics.json`.

- [ ] **Step 2: Inspect the tearsheet**

```bash
open results/tearsheet.png
```

Verify visually: 4 panels visible, dark theme, both strategy and SPY lines in the equity curve panel.

- [ ] **Step 3: Fill in README results table with actual metrics**

Open `README.md` and replace the `—` placeholders in the results table with the printed values from step 1.

- [ ] **Step 4: Update `.gitignore` to allow committing the sample tearsheet**

Add an exception to `.gitignore` so the sample tearsheet is committed:

```
# Outputs are gitignored by default
results/
# ...except the sample tearsheet for the README
!results/tearsheet.png
```

- [ ] **Step 5: Final commit**

```bash
git add results/tearsheet.png README.md .gitignore
git commit -m "docs: add sample tearsheet and real metrics to README"
```

- [ ] **Step 6: Create GitHub repository and push**

On GitHub, create a new public repository named `momentum-backtester` under your account, then:

```bash
git remote add origin https://github.com/AGagniare/momentum-backtester.git
git push -u origin main
```

- [ ] **Step 7: Run full test suite one last time**

```bash
pytest tests/ -v
```

Expected: all tests pass, 0 failures.
```

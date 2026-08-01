# 📈 Did I Win The Trade? (didiwinthetrade.com)

> A gamified financial charting and trading practice platform where users can test trading strategies, execute simulated positions, and analyze performance across multi-timeframe candle streams.

![Status](https://img.shields.io/badge/status-WIP-orange?style=flat-square)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)

---

## Overview

didiwinthetrade.com is a web-based trading sandbox designed to bridge the gap between technical theory and practical execution. Built around high-performance financial charting and smooth candle playback, the platform gives users the ability to simulate live market actions, manage risk parameters dynamically, and utilize persistent technical drawing tools across multiple timeframes.

---

## Core Features

* **Candle Simulation:** Replay modes allow users to watch historical price action unfold tick-by-tick to evaluate market setups.
* **Multi-Timeframe Switching:** Instant toggling between 1m, 5m, and 15m timeframes with automated candle aggregation and responsive layout scaling.
* **Risk Management:** Drag-and-drop Take Profit (TP) and Stop Loss (SL) price lines positioned directly on the active price scale.
* **Cross-Timeframe Drawing Tools:** Freehand trendlines and chart markings. Drawn elements stay accurately locked and projected through zoom, pan, and timeframe switching actions.
* **Mobile Optimization:** Custom pointer capture routines and touch controls ensure fluid interactions across iOS Safari, Android, and desktop browsers.

---

## Tech Stack & Architecture

* **Frontend Framework:** React (Vite)
* **Charting Engine:** TradingView Lightweight Charts
* **Styling & UI:** Tailwind CSS and Lucide Icons

---

## Project Roadmap

* **Advanced Drawing Interactions:** Selection, editing, and deletion capabilities for individual trendlines, alongside endpoint adjustments.
* **Extended Technical Tooling:** Integration for horizontal support/resistance rays and custom Fibonacci retracement overlays.
* **Performance Enhancements:** Vector rendering optimizations for high-density streaming candle environments.

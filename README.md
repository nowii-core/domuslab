# DomusLab Game

<p align="center">
  <b>A Sophisticated Web-Based Interactive Application Built with a Modular Architecture, Custom Gameplay Mechanics, Dynamic Rendering Pipelines, and Procedural Generation Tools</b>
</p>

<p align="center">
  <a href="https://github.com/nowii-core/domuslab/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-007ec6?style=for-the-badge" alt="License">
  </a>
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/JavaScript-ES6%2B-f7df1e?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/Architecture-Modular-000000?style=for-the-badge" alt="Modular Architecture">
</p>

<p align="center">
  <a href="#-overview">Overview</a> •
  <a href="#-key-features">Features</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-project-architecture">Architecture</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-development-and-tooling">Tooling</a> •
  <a href="#-contact">Contact</a>
</p>

---

</div>

## Overview

**DomusLab Game** combines a clean separation of concerns with an optimized client-side execution loop. Built natively with modern web technologies, it ensures high responsiveness, fluid animations, and extensible code patterns suitable for both casual execution and future feature expansions.

---

## Preview

<p align="center">
  <img src="screenshot.png" alt="DomusLab Game Preview" width="100%">
</p>

> **Live Demo:** [nowii-core.github.io/domuslab/](https://nowii-core.github.io/domuslab/)

---

## Key Features

- **Modular Component Design:** Clear boundaries between core logic, UI rendering, level editors, and data management.
- **Procedural Level Generation:** Integrated scripting tools to automate map creation and layout structuring.
- **Integrity Verification:** Automated validation protocols to ensure level consistency and prevent runtime execution anomalies.
- **Customization Framework:** Extensible themes and skin management modules allowing extensive visual styling.
- **Optimized Distribution:** Minified or bundled distribution assets ready for high-performance production deployment.

---

## Tech Stack

### Frontend
- **HTML5:** Semantic structure for the application entry point.
- **CSS3:** Core styling, layout definitions, and dynamic theming.
- **JavaScript (ES6+):** Main execution loop, state management, graphical rendering, and game orchestration.

### Development & Tooling
- **Node.js:** Required to run procedural generation, verification suites, and build scripts.

---

## Project Architecture

The application relies on a decoupled architecture where rendering, game state management, input handling, and configuration data operate independently.

```text
domuslab/
├── css/
│   └── style.css           # Core styling and layout definitions
├── dist/
│   └── domuslab.html       # Production-ready compiled distribution package
├── js/
│   ├── data.js             # Static game data and configuration parameters
│   ├── editor.js           # Level editor interface and logic
│   ├── engine.js           # Main execution loop and state management
│   ├── game.js             # Primary game orchestration logic
│   ├── levels.js           # Level parsing and progression handling
│   ├── render.js           # Graphical rendering and view updates
│   ├── skins.js            # Visual skin definitions and assets manager
│   └── themes.js           # Dynamic theming logic
├── tools/
│   ├── build-single.js     # Build script for single-file deployment
│   ├── generate-levels.js  # Procedural level generation utility
│   └── verify-levels.js    # Map integrity and rule verification script
├── index.html              # Main application entry point
├── package.json            # Project dependencies and build scripts
├── screenshot.png          # Application preview image
└── LICENSE                 # Software licensing details
```

---

## Quick Start

### Prerequisites
- A modern web browser with HTML5 and ES6+ JavaScript support (Chrome, Firefox, Edge, or Safari).
- **Node.js** (version 16.x or higher) if you intend to run development tools or build scripts.

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/nowii-core/domuslab.git
   cd domuslab
   ```

2. **Install project dependencies (optional, for tooling):**
   ```bash
   npm install
   ```

3. **Run the application:**
   Launch the application locally by opening `index.html` directly in your browser, or by using a local static file server.

---

## Development and Tooling

The repository includes utility scripts located in the `tools/` directory to support maintenance and level design:

- **Level Generation:** Programmatically build new map structures:
  ```bash
  node tools/generate-levels.js
  ```
- **Level Verification:** Execute the verification suite to ensure all map configurations are error-free:
  ```bash
  node tools/verify-levels.js
  ```
- **Single-File Compilation:** Bundle the application into a standalone distribution artifact:
  ```bash
  node tools/build-single.js
  ```

---

## License

This project is distributed under the **MIT** license. See the [`LICENSE`](./LICENSE) file for more information.

---

## Contact & Support

- **Maintainer:** [@nowii-core](https://github.com/nowii-core)
- **Repository:** [domuslab](https://github.com/nowii-core/domuslab)
- **Bug Reports & Feature Requests:** If you encounter an issue or would like to suggest an improvement, open an [Issue](https://github.com/nowii-core/domuslab/issues) or submit a [Pull Request](https://github.com/nowii-core/domuslab/pulls).

---

<div align="center">
  <sub>Developed by <b>nowii-core</b></sub>
</div>

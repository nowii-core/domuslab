# DomusLab Game

![License: MIT](https://img.shields.io/badge/License-MIT-00b4d8.svg)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)

DomusLab Game is a sophisticated web-based interactive application designed with a modular architecture, featuring custom gameplay mechanics, dynamic rendering pipelines, and dedicated procedural generation and verification tools.

---

## Preview

<p align="center">
  <img src="screenshot.png" alt="DomusLab Game Preview" width="100%">
</p>

---

## Table of Contents

- [Overview](#overview)
- [Project Architecture](#project-architecture)
- [Key Features](#key-features)
- [Directory Structure](#directory-structure)
- [Prerequisites](#prerequisites)
- [Installation and Setup](#installation-and-setup)
- [Development and Tooling](#development-and-tooling)
- [Versioning and Distribution](#versioning-and-distribution)
- [License](#license)
- [Contacts](#contacts)

---

## Overview

DomusLab Game combines clean separation of concerns with an optimized client-side execution loop. Built natively with modern web technologies, it ensures high responsiveness, fluid animations, and extensible code patterns suitable for both casual execution and future feature expansions.

---

## Project Architecture

The application relies on a decoupled architecture where rendering, game state management, input handling, and configuration data operate independently:

- **Engine Core**: Manages the main game loop, delta time calculations, state transitions, and collision detection frameworks.
- **Rendering Pipeline**: Handles canvas or DOM-based rendering operations, optimizing draw calls and graphical updates.
- **Data & Configuration**: Centralizes level parameters, skin definitions, themes, and static asset mapping.

---

## Key Features

- **Modular Component Design**: Clear boundaries between core logic, UI rendering, level editors, and data management.
- **Procedural Level Generation**: Integrated scripting tools to automate map creation and layout structuring.
- **Integrity Verification**: Automated validation protocols to ensure level consistency and prevent runtime execution anomalies.
- **Customization Framework**: Extensible themes and skin management modules allowing extensive visual styling.
- **Optimized Distribution**: Minified or bundled distribution assets ready for high-performance production deployment.

---

## Directory Structure

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

## Prerequisites

Before setting up the environment locally, ensure you have the following installed:
- A modern web browser with HTML5 and ES6+ JavaScript support (Google Chrome, Mozilla Firefox, Microsoft Edge, or Safari).
- Node.js (version 16.x or higher recommended) if you intend to run development tools, build scripts, or level generators.

---

## Installation and Setup

1. Clone the repository to your local machine:
   ```bash
   git clone https://github.com/nowii-core/domuslab.git
   ```

2. Navigate into the project root directory:
   ```bash
   cd domuslab
   ```

3. Install project dependencies (if utilizing build tools):
   ```bash
   npm install
   ```

4. Launch the application locally by opening `index.html` directly in your browser or by deploying a local static file server.

---

## Development and Tooling

The repository includes utility scripts located in the `tools/` directory to support maintenance and level design:

- **Level Generation**: Run the generator script to programmatically build new map structures:
  ```bash
  node tools/generate-levels.js
  ```
- **Level Verification**: Execute the verification suite to ensure all map configurations are error-free:
  ```bash
  node tools/verify-levels.js
  ```
- **Single-File Compilation**: Bundle the application into a standalone distribution artifact:
  ```bash
  node tools/build-single.js
  ```

---

## Versioning and Distribution

Releases and packaged builds are managed directly through GitHub Releases. To deploy a new version:
1. Tag the appropriate commit using semantic versioning (e.g., `v1.0.0`).
2. Attach compiled distribution files or compressed archives from the `dist/` directory to the release payload.

---

## License

This project is open-source and distributed under the terms of the MIT License. See the [LICENSE](LICENSE) file for comprehensive legal information and usage permissions.

---

## Contacts

<p align="left">
  <a href="https://github.com/nowii-core">
    <img src="https://img.shields.io/badge/GitHub-@nowii--core-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub Profile">
  </a>
</p>

- **Maintainer**: nowii
- **GitHub Profile**: [@nowii-core](https://github.com/nowii-core)
- **Repository**: [domuslab](https://github.com/nowii-core/domuslab)

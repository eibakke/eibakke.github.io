# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a personal GitHub Pages website hosted at eibakke.github.io. It contains a portfolio site with three interactive web applications.

## Architecture

The repository has a simple static site structure:
- **Root**: Main landing page (index.html) with navigation to projects
- **KommunerBeenMap/**: Interactive SVG map of Norwegian municipalities using jQuery
- **glint_app/**: React-based wave height lookup application that fetches data from an external API
- **boat_selector/**: Boat purchase calculator with internal financing management for group purchases

## Technologies Used

- **KommunerBeenMap**: jQuery, SVG manipulation, vanilla JavaScript
- **glint_app**: React (loaded via CDN), no build process
- **boat_selector**: jQuery, Tailwind CSS (via CDN), vanilla JavaScript
- All projects use vanilla JavaScript without any build tooling or package management

## Development

This is a static GitHub Pages site with no build process. All changes are made directly to the HTML, CSS, and JavaScript files. The site is automatically deployed when changes are pushed to the main branch.

### Testing Changes Locally
Open the HTML files directly in a browser, or use a simple HTTP server:
```bash
python3 -m http.server 8000
# or
npx http-server
```

## Key Implementation Notes

- The KommunerBeenMap uses jQuery for DOM manipulation and event handling
- The glint_app uses React loaded from CDN without JSX (uses React.createElement)
- The boat_selector app features:
  - **Budget Calculator**: Calculates maximum boat price based on annual budget and number of people
  - **Internal Financing**: Manages loans between group members with different upfront contributions
  - **Recurring Costs**: Handles annual operating costs distribution during and after loan periods
  - Generates Finn.no search URLs with appropriate filters for different boat types
- No build process, transpilation, or bundling - all code runs directly in the browser
- External API endpoint for wave data (glint_app): `https://europe-west1-freesolarcalc.cloudfunctions.net/wave_max/`
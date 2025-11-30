
# Specicare — Frontend (React)

Frontend for the Specicare application. Built with Create React App (React 18).

## Summary

This repo contains the single-page React frontend. The README below explains how to install dependencies, run the app in development, build for production, run tests, and configure environment variables (including PowerShell notes for Windows).

## Prerequisites

- Node.js (LTS recommended). Use Node 16.x or 18.x for best compatibility. Verify with:

```powershell
node --version
npm --version
```

- (Optional) `yarn` if you prefer Yarn: `npm install -g yarn`
- Git to clone the repository

## Quick start (development)

1. Clone the repository and change into it:

```powershell
git clone https://github.com/umumararungu/specicare-frontend.git
cd specicare-frontend
```

2. Install dependencies (choose one):

```powershell
npm install
# or, for CI reproducible installs
npm ci
# or with yarn
yarn install
```

3. Start the development server:

```powershell
npm start
# or
yarn start
```

Open http://localhost:3000 in your browser. The dev server supports hot reload.

## Environment variables

This project uses Create React App conventions: variables must be prefixed with `REACT_APP_`.

- Create a `.env` file in the project root to set local variables. Example `.env`:

```text
REACT_APP_API_URL=https://api.example.com
REACT_APP_SOCKET_URL=wss://sockets.example.com
```

- PowerShell temporary variable (only for that terminal session):

```powershell
#$env:REACT_APP_API_URL = "https://api.example.com"
$env:REACT_APP_API_URL = "http://localhost:5000"
npm start
```

- To set a persistent environment variable on Windows for the current user (PowerShell):

```powershell
setx REACT_APP_API_URL "https://api.example.com"
# then open a new shell for it to take effect
```

Keep secrets out of source control. For production, configure environment variables in your hosting provider (Vercel, Netlify, Azure Static Web Apps, etc.).

## NPM scripts

Scripts defined in `package.json`:

- `start` — `react-scripts start` (run dev server)
- `build` — `react-scripts build` (create optimized production build in `build/`)
- `test` — `react-scripts test` (run tests)
- `eject` — `react-scripts eject` (one-way operation; only if you need full control)

Use `npm run <script>` or `yarn <script>`.

## Build & preview (production)

Create a production build:

```powershell
npm run build
```

Preview the build locally using a static server (recommended):

```powershell
npx serve -s build -l 5000
# or
npx http-server ./build -p 5000
```

Open http://localhost:5000 to preview the production bundle.

## Tests

Run tests with:

```powershell
npm test
```

By default Create React App runs tests in watch mode. For a single run (CI), use the appropriate environment flags (for example `CI=true npm test -- --watchAll=false`).

## Key dependencies

- React 18
- react-scripts (Create React App)
- axios (HTTP client)
- socket.io-client (websockets)
- date-fns (date utilities)

See `package.json` for exact versions.

## Project structure (important files)

- `public/` — static index.html and manifest
- `src/` — application source
  - `App.js` — main app component
  - `index.js` — React entry point
  - `components/` — grouped UI components:
    - `admin/` — admin modals and pages
    - `common/` — shared components (Header, Footer, Notification, etc.)
    - `sections/` — page sections (Home, Dashboard, Login, Admin)
  - `context/` — `AppContext.js` (React Context)
  - `hooks/` — `useSocket.js` (custom hooks)
  - `utils/` — `locations.js`, `safe.js` (helpers)

## Connecting to the backend

This frontend expects API and (optionally) socket servers. Configure `REACT_APP_API_URL` and `REACT_APP_SOCKET_URL` accordingly. Search `src/` for `axios` and `socket.io-client` usages to find the connection code.

## Troubleshooting

- Blank page in production: confirm API base URL, CORS settings, and that the build was deployed to the correct directory. Check browser console for errors.
- Port conflict on :3000: specify a different port: `PORT=3001 npm start` (Unix) or in PowerShell: `$env:PORT=3001; npm start`.
- Corrupted node_modules/build issues: remove `node_modules` and reinstall:

```powershell
rm -r node_modules package-lock.json
npm install
```

- If caching causes problems: `npm cache clean --force` then reinstall.

## Deployment notes

- `build/` is a static bundle; deploy to static hosting providers (Netlify, Vercel, S3 + CloudFront, Azure Static Web Apps).
- Configure your host to rewrite unknown routes to `index.html` for client-side routing.
- Provide runtime environment variables at the host (Netlify/Vercel UI, Azure App Settings).

## Contributing

- Fork the repo, create a feature branch, add tests, and open a pull request with a clear description of changes.
- Keep changes small and focused. Add or update documentation where appropriate.

## Maintainers / Contact

Repository owner: `umumararungu` (GitHub)

If you need help or want me to add CI, linting, or deployment scripts, tell me which provider (Netlify/Vercel/Azure/Railway) and I can add a basic config.





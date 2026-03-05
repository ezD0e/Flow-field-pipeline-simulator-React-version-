# How to Run the Pipe Network Simulator Locally

This guide will help you set up and run the React app on your computer.

## Prerequisites

You need to have Node.js installed on your computer.

### Check if Node.js is installed:
```bash
node --version
npm --version
```

If you see version numbers, you're good to go! If not, download and install from: https://nodejs.org/ (choose LTS version)

## Method 1: Using Vite (Recommended - Fastest)

### Step 1: Create a new Vite project
```bash
npm create vite@latest pipe-network-simulator -- --template react-ts
```

### Step 2: Navigate to the project folder
```bash
cd pipe-network-simulator
```

### Step 3: Install dependencies
```bash
npm install
```

### Step 4: Install additional required packages
```bash
npm install lucide-react
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### Step 5: Configure Tailwind CSS
Replace the content of `tailwind.config.js` with:
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

### Step 6: Update src/index.css
Replace the content with:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Step 7: Replace src/App.tsx
Copy the content from `improved-pipe-network-app.tsx` into `src/App.tsx`

### Step 8: Run the development server
```bash
npm run dev
```

The app will open at `http://localhost:5173`

---

## Method 2: Using Create React App

### Step 1: Create a new React app
```bash
npx create-react-app pipe-network-simulator --template typescript
```

### Step 2: Navigate to the project folder
```bash
cd pipe-network-simulator
```

### Step 3: Install dependencies
```bash
npm install lucide-react
npm install -D tailwindcss
npx tailwindcss init
```

### Step 4: Configure Tailwind (same as Method 1, Step 5)

### Step 5: Update src/index.css (same as Method 1, Step 6)

### Step 6: Replace src/App.tsx
Copy the content from `improved-pipe-network-app.tsx` into `src/App.tsx`

### Step 7: Run the app
```bash
npm start
```

The app will open at `http://localhost:3000`

---

## Quick Troubleshooting

### Error: "Cannot find module 'lucide-react'"
```bash
npm install lucide-react
```

### Error: Tailwind styles not working
Make sure:
1. `tailwind.config.js` has the correct content paths
2. `src/index.css` has the @tailwind directives
3. You've restarted the dev server after changes

### Port already in use
- Vite: Change port with `npm run dev -- --port 3001`
- CRA: Set PORT environment variable: `PORT=3001 npm start`

---

## Project Structure

```
pipe-network-simulator/
├── node_modules/
├── public/
├── src/
│   ├── App.tsx          ← Your main component
│   ├── index.css        ← Tailwind imports
│   ├── main.tsx         ← Entry point (Vite)
│   └── index.tsx        ← Entry point (CRA)
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

---

## Development Tips

1. **Hot Reload**: Changes auto-refresh the browser
2. **Console**: Press F12 to open browser DevTools for debugging
3. **VS Code Extensions** (recommended):
   - ES7+ React/Redux/React-Native snippets
   - Tailwind CSS IntelliSense
   - TypeScript Vue Plugin (Volar)

---

## Building for Production

### Vite:
```bash
npm run build
```
Output: `dist/` folder

### Create React App:
```bash
npm run build
```
Output: `build/` folder

Deploy the output folder to any static hosting service (Netlify, Vercel, GitHub Pages, etc.)

---

## Need Help?

- **Node.js issues**: https://nodejs.org/
- **Vite docs**: https://vitejs.dev/
- **React docs**: https://react.dev/
- **Tailwind docs**: https://tailwindcss.com/

# Step-by-Step Visual Guide

## Complete Setup Tutorial (5-10 minutes)

### 📦 Step 1: Install Node.js (if not already installed)

1. Go to https://nodejs.org/
2. Download the **LTS version** (recommended)
3. Run the installer
4. Click "Next" through all steps (default settings are fine)
5. Restart your terminal/command prompt

**Verify installation:**
```bash
node --version
npm --version
```
You should see version numbers like `v20.x.x` and `10.x.x`

---

### 🚀 Step 2: Create Your Project

#### **Option A: Using the Quick Setup Script (Easiest)**

**Windows:**
1. Double-click `quick-setup-windows.bat`
2. Wait for installation to complete
3. Follow the on-screen instructions

**Mac/Linux:**
1. Open Terminal
2. Make the script executable: `chmod +x quick-setup-mac-linux.sh`
3. Run: `./quick-setup-mac-linux.sh`

#### **Option B: Manual Setup**

Open your terminal/command prompt and run:

```bash
# Create project
npm create vite@latest pipe-network-simulator -- --template react-ts

# Enter folder
cd pipe-network-simulator

# Install dependencies
npm install

# Install extra packages
npm install lucide-react
npm install -D tailwindcss postcss autoprefixer

# Initialize Tailwind
npx tailwindcss init -p
```

---

### ⚙️ Step 3: Configure Files

You need to update 3 files:

#### **File 1: `tailwind.config.js`**
- Location: Root of your project folder
- Replace entire content with the provided `tailwind.config.js` file

#### **File 2: `src/index.css`**
- Location: `src/` folder
- Replace entire content with the provided `index.css` file

#### **File 3: `src/App.tsx`**
- Location: `src/` folder  
- Replace entire content with `improved-pipe-network-app.tsx`

---

### 🎯 Step 4: Run the App

In your terminal, make sure you're in the project folder:

```bash
cd pipe-network-simulator
npm run dev
```

You should see output like:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

**Open your browser** and go to: `http://localhost:5173`

---

### 🎨 Step 5: Start Using the App!

The app should now be running! You can:

1. **Draw Pipes**: Click "绘制" (Draw) button, then drag on the canvas
2. **Set Pressure**: Click "压力" (Pressure) button, then click grid points
3. **Select & Edit**: Click "选择" (Select) button to modify pipes and pressure points

---

## 📁 Your Project Structure

After setup, your folder should look like:

```
pipe-network-simulator/
├── node_modules/           (installed packages - ignore this)
├── public/                 (static files)
├── src/
│   ├── App.tsx            ← YOUR MAIN APP CODE
│   ├── index.css          ← Tailwind CSS imports
│   ├── main.tsx           ← Entry point
│   └── vite-env.d.ts
├── index.html
├── package.json
├── tailwind.config.js     ← Tailwind configuration
├── tsconfig.json
└── vite.config.ts
```

---

## 🔧 Common Issues & Solutions

### ❌ Issue: "Command not found: npm"
**Solution**: Node.js is not installed or not in PATH. Reinstall Node.js and restart terminal.

### ❌ Issue: Port 5173 already in use
**Solution**: Run with different port:
```bash
npm run dev -- --port 3001
```

### ❌ Issue: Styles not showing (plain white page)
**Solution**: 
1. Check that `src/index.css` has the `@tailwind` directives
2. Check that `tailwind.config.js` has correct content paths
3. Restart the dev server (Ctrl+C, then `npm run dev` again)

### ❌ Issue: "Cannot find module 'lucide-react'"
**Solution**:
```bash
npm install lucide-react
```

### ❌ Issue: Changes not reflecting
**Solution**: 
1. Save all files (Ctrl+S)
2. Check terminal for errors
3. Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)

---

## 🎓 Development Tips

### Making Changes
1. Edit `src/App.tsx` in VS Code
2. Save the file (Ctrl+S)
3. Browser automatically refreshes!

### Stopping the Server
- Press `Ctrl+C` in the terminal

### Restarting the Server
```bash
npm run dev
```

### Opening DevTools
- Press `F12` in your browser
- Check Console tab for errors

---

## 🚢 Building for Production

When ready to deploy:

```bash
npm run build
```

This creates a `dist/` folder with optimized files ready to deploy to any static hosting service (Netlify, Vercel, GitHub Pages, etc.)

---

## 📚 Learn More

- **React**: https://react.dev/learn
- **TypeScript**: https://www.typescriptlang.org/docs/
- **Vite**: https://vitejs.dev/guide/
- **Tailwind CSS**: https://tailwindcss.com/docs

---

## ✅ Checklist

- [ ] Node.js installed (v18 or higher)
- [ ] Project created with Vite
- [ ] Dependencies installed (`npm install`)
- [ ] `tailwind.config.js` updated
- [ ] `src/index.css` updated  
- [ ] `src/App.tsx` replaced with app code
- [ ] Dev server running (`npm run dev`)
- [ ] Browser opened to localhost:5173
- [ ] App loads and works correctly

**If all checked - Congratulations! You're running the app locally! 🎉**

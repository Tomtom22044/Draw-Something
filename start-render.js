import { execSync } from 'child_process';

if (process.env.RENDER || process.env.NODE_ENV === 'production') {
    console.log("[Auto-Fix] Render environment detected using 'dev' default command! Automatically forcing production build...");
    execSync('npm run build', { stdio: 'inherit' });
    execSync('node server.js', { stdio: 'inherit' });
} else {
    console.log("Running local development environment...");
    execSync('npm run dev:local', { stdio: 'inherit' });
}

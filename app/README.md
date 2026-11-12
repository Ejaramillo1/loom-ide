# Open Loom on your computer

Open a terminal in the project folder (the folder containing `package.json`). Paste this command and press Enter:

```sh
bash app/open-local.sh
```

Your browser opens Loom at http://localhost:1420. Keep the terminal open while using Loom; press Ctrl+C there when you want to stop it. If the browser does not open automatically, type that address into your browser.

You need Node.js and npm installed. The launcher installs the project's dependencies on its first run. If it says port 1420 is already in use, try opening http://localhost:1420 first: Loom may already be running.

To open the desktop window instead, run `npm run tauri dev` from the project folder. This also requires Rust and the Tauri system dependencies described in the main README.

The interface works without a Loom server using labeled demonstration data. To use live chat, start your configured Loom server separately with `looms serve --http-port 5006`.

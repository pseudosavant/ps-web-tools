# ps-web-tools

My static HTML/CSS/JS tools, authored in-browser with VS Code and auto-deployed to GitHub Pages.

## Features

* **Zero setup**: Edit files right on GitHub with the `.` shortcut (opens github.dev).
* **Instant deploy**: Push to `main` and GitHub Pages handles the rest—live in \~1 minute.
* **Static-first**: Plain HTML, CSS, and JS. No build step required (but easy to add via Actions).
* **Custom domain support**: Just add a `CNAME` file or configure in Settings → Pages.

## Getting Started

1. **Fork or clone** this repo:

   ```bash
   git clone https://github.com/<your-username>/ps-web-tools.git
   cd ps-web-tools
   ```

2. **Edit in-browser**:

   * Open the repo on GitHub and press `.` → edits commit automatically to `main`.

3. **Push changes**:

   ```bash
   git add .
   git commit -m "Update page"
   git push origin main
   ```

   Changes go live at `https://<your-username>.github.io/ps-web-tools/` within a minute.

4. **Serve locally (optional)**:

   ```bash
   npx serve .
   # or any static server of your choice
   ```

## Advanced

* **Add a build step**: Drop a workflow in `.github/workflows/deploy.yml` using `peaceiris/actions-gh-pages`.
* **Branch setup**: Want to serve from a `gh-pages` branch? Create it and point Settings → Pages at `gh-pages`.

## Contributing

1. Open an issue with your idea or bug.
2. Send a pull request—small, focused commits are best.

## License

MIT © John Paul Ellis

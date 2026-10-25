// Runs before paint. Keeping theme selection in the browser allows the page
// shell to be prerendered and cached without embedding user-specific data.
export const THEME_INIT_SCRIPT = `(() => {
    let theme;
    try { theme = localStorage.getItem('aiecotrack-theme'); } catch {}
    if (theme !== 'light' && theme !== 'dark') {
        const match = document.cookie.match(/(?:^|;\\s*)aiecotrack-theme=(light|dark)(?:;|$)/);
        theme = match ? match[1] : 'dark';
    }
    document.documentElement.dataset.theme = theme;
})();`;

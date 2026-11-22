interface InstallPrompt extends Event {
  prompt(): Promise<unknown>;
}

export function setupInstall(button: HTMLButtonElement, dialog: HTMLDialogElement) {
  const standalone = window.matchMedia('(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)');
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(navigator.userAgent);
  let installed = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  let prompt: InstallPrompt | undefined;

  function updateButton() {
    button.hidden = installed || standalone.matches || !(ios || android);
    if (button.hidden && dialog.open) dialog.close();
  }
  updateButton();
  standalone.addEventListener('change', updateButton);
  window.addEventListener('appinstalled', () => {
    prompt = undefined;
    installed = true;
    updateButton();
  });
  window.addEventListener('beforeinstallprompt', event => {
    if (button.hidden) return;
    event.preventDefault();
    prompt = event as InstallPrompt;
  });
  button.addEventListener('click', async () => {
    if (prompt) {
      // The browser's install prompt is single-use, including on dismissal.
      const current = prompt;
      prompt = undefined;
      try { await current.prompt(); return; } catch { /* Show browser menu steps below. */ }
    }
    dialog.querySelector('p')!.textContent = ios
      ? 'In Safari, tap Share, then Add to Home Screen. Turn on Open as Web App if shown, then tap Add.'
      : 'In Chrome, open the browser menu and choose Install app or Add to Home screen. On some versions, Install is under Install and create shortcut.';
    dialog.showModal();
  });

  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    const register = () => {
      // Private browsing or storage restrictions can prevent offline installation.
      void navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(() => {});
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }
}

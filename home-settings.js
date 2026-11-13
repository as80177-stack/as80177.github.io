(() => {
  const dialog = document.getElementById('appSettings');
  const open = document.getElementById('openSettings');
  const close = document.getElementById('closeSettings');
  open.addEventListener('click', () => {
    if (dialog.open) return;
    dialog.showModal();
    open.setAttribute('aria-expanded', 'true');
  });
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => open.setAttribute('aria-expanded', 'false'));
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
})();

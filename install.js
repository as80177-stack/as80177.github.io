(() => {
  const button = document.getElementById('installApp');
  const status = document.getElementById('installStatus');
  const input = document.getElementById('installLink');
  input.value = new URL('install.html', location.href).href;
  let prompt;
  function installed() {
    return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  }
  function showInstalled() {
    button.hidden = true;
    status.textContent = installed() ? '你正在 App 中，可直接開啟首頁，不需要重複安裝。' : '已完成安裝，請從手機主畫面的圖示開啟。';
  }
  if (installed()) showInstalled();
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    prompt = event;
    if (!installed()) status.textContent = '此瀏覽器支援安裝，請點「安裝 App」。';
  });
  window.addEventListener('appinstalled', () => { prompt = null; showInstalled(); });
  button.addEventListener('click', async () => {
    if (!prompt) {
      status.textContent = '請依照下方手機安裝方式操作。若已安裝，可直接從手機主畫面開啟。';
      document.getElementById('manualInstall').scrollIntoView({behavior:'smooth',block:'center'});
      return;
    }
    button.disabled = true;
    try {
      const current = prompt;
      prompt = null;
      await current.prompt();
      const choice = await current.userChoice;
      status.textContent = choice.outcome === 'accepted' ? '已接受安裝，請等待瀏覽器完成，之後從主畫面開啟。' : '已取消安裝，仍可直接使用網站，或依下方說明稍後安裝。';
    } catch (_) { status.textContent = '目前無法顯示安裝提示，請依下方說明從瀏覽器選單安裝。'; }
    finally { button.disabled = false; }
  });
  document.getElementById('copyInstallLink').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(input.value);
      document.getElementById('copyStatus').textContent = '已複製安裝連結，可以貼到訊息中分享。';
    } catch (_) {
      input.focus(); input.select();
      document.getElementById('copyStatus').textContent = '請長按上方已選取的網址，選「複製」。';
    }
  });
})();

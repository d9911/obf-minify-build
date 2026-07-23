/* global window, self, top, document */

// Проверяем, не находимся ли мы в режиме разработки (например, на localhost)
const isDevMode = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
// Анти-фрейм
if (self !== top) {
  top.location = self.location.href;
}
(function () {
  if (isDevMode) {
    console.log('Защита отключена в режиме разработки.');
    return;
  }

  // Блокировка контекстного меню
  document.addEventListener('contextmenu', e => e.preventDefault());

  // Блокировка копирования, вырезания, вставки
  ['copy', 'cut', 'paste'].forEach(ev => document.addEventListener(ev, e => e.preventDefault()));

  // Блокировка клавиш (F12, Ctrl+Shift+I/J, Ctrl+U/C)
  document.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(k)) || (e.ctrlKey && k === 'u')) {
      e.preventDefault();
    }
  });

  // Более мягкий детектор DevTools
  const devtoolsDetector = () => {
    const t0 = performance.now();
    // debugger; // Это легко обойти, используем другой трюк
    console.log(new Error()); // Вызов console.log с объектом Error работает иначе, когда открыты DevTools
    const dt = performance.now() - t0;

    if (dt > 100) {
      // Порог может потребовать подстройки
      // Вместо стирания контента - показываем оверлей или перенаправляем
      document.body.innerHTML =
        '<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:black;color:white;display:flex;align-items:center;justify-content:center;font-family:sans-serif;font-size:2rem;text-align:center;z-index:9999;">Отладка запрещена.<br>DevTools inspection is not allowed.</div>';
      // Или перенаправление:
      // window.location.href = 'https://google.com';
    }
  };

  // Убрали агрессивное поведение на blur/visibilitychange. Оно мешает пользователям.
  // Если всё же нужно, можно вернуть, но с более мягкой логикой,
  // Protección contra cambios de visibilidad y desenfoque
  ['visibilitychange', 'blur'].forEach(ev => {
    document.addEventListener(ev, () => {
      if (document.hidden) document.body.innerHTML = '';
    });
  });
  // например, просто ставить видео на паузу.

  // Запускаем детектор периодически
  setInterval(devtoolsDetector, 2000);
})();

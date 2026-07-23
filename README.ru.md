# obf-minify-build

<p align="center">
  Кроссплатформенная сборка без runtime-зависимостей: TypeScript,
  консервативная минификация, встраивание ресурсов и хеширование файлов.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/obf-minify-build"><img alt="Версия npm" src="https://img.shields.io/npm/v/obf-minify-build"></a>
  <a href="./LICENSE"><img alt="Лицензия GPL-3.0-only" src="https://img.shields.io/badge/license-GPL--3.0--only-blue"></a>
  <img alt="Node.js 18 или новее" src="https://img.shields.io/badge/node-%3E%3D18-339933">
</p>

<p align="center">
  <a href="./README.md">English</a> · <strong>Русский</strong>
</p>

> **Статус разработки:** кроссплатформенная версия проверяется в выпусках
> `0.0.4-rc.N`. Первым стабильным выпуском с этой архитектурой станет `0.0.5`.
> Текущую опубликованную npm-версию показывает значок выше.

## Для чего нужен пакет?

`obf-minify-build` превращает каталог со статическими HTML, CSS, JavaScript,
изображениями и другими ресурсами в готовую к размещению сборку:

- один Node.js-движок для CLI и JavaScript API;
- работа в Windows, macOS и Linux без обязательных системных утилит;
- отсутствие сторонних runtime-зависимостей;
- консервативная минификация HTML и CSS;
- собственная минификация и безопасная базовая обфускация JavaScript;
- необязательная компиляция TypeScript с приоритетом `.ts`;
- необязательное встраивание локальных CSS и JavaScript;
- content hash в именах CSS, JavaScript и изображений;
- автоматическое обновление локальных ссылок в HTML;
- необязательный Makefile, вызывающий тот же Node.js-движок.

## Установка

Стабильный канал:

```bash
npm install --save-dev obf-minify-build
```

Канал тестовых версий:

```bash
npm install --save-dev obf-minify-build@rc
```

До публикации нового RC разработчик может проверить текущий checkout:

```bash
npm pack
npm install --save-dev ./obf-minify-build-0.0.4-rc.4.tgz
```

## Быстрый старт

Подготовьте структуру:

```text
src/
├── index.html
├── css/
│   └── app.css
├── js/
│   └── app.js
└── assets/
    └── logo.svg
```

Запустите сборку:

```bash
npx obf-minify-build --src src --out dist
```

Результат появится в `dist/`. Обработанные CSS, JavaScript и поддерживаемые
изображения получат восьмизначный content hash, а соответствующие ссылки в HTML
будут обновлены.

### Необязательный TypeScript

Для проекта с `.ts` установите TypeScript:

```bash
npm install --save-dev typescript
```

`js/app.ts` компилируется в `js/app.js`. Если существуют оба файла, выбирается
`.ts`. Для JavaScript-проекта TypeScript не нужен. В этой версии не
поддерживается `.tsx`, не создаются `.d.ts`, а полную проверку типов следует
выполнять отдельно командой `tsc --noEmit`.

## CLI

```text
Использование: obf-minify-build [параметры]

Параметры:
  --src <dir>                    Исходный каталог (по умолчанию: src)
  --out <dir>                    Каталог сборки (по умолчанию: build)
  --inline-css                   Встроить локальные CSS в HTML
  --inline-js                    Встроить локальные JavaScript в HTML
  --inline-all                   Встроить локальные CSS и JavaScript
  --generate-index               Создать index.html при отсутствии HTML
  --skip-obfuscation             Устаревший параметр без эффекта
  --skip-obfuscation-for <list>  Устаревший параметр без эффекта
  --no-make                      Устаревший совместимый параметр без эффекта
  --version, -v                  Показать версию
  --help, -h                     Показать справку
```

Примеры:

```bash
# Стандартная сборка src/ → build/
npx obf-minify-build

# Собственные каталоги
npx obf-minify-build --src website --out public

# Встроить локальные CSS и JavaScript в HTML
npx obf-minify-build --inline-all

```

Неизвестные параметры, отсутствующие значения, неверные пути и ошибки сборки
возвращают ненулевой код завершения и понятное сообщение в standard error.

## JavaScript API

Пакет использует ESM:

```js
import { build } from 'obf-minify-build';

try {
  const result = await build({
    src: 'src',
    out: 'dist',
  });

  console.log(result.outputDir);
  console.log(result.files);
  console.log(result.manifest);
  console.log(result.warnings);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
```

`build()` возвращает promise со следующим результатом:

```js
{
  sourceDir: '/absolute/path/to/src',
  outputDir: '/absolute/path/to/dist',
  files: {
    html: 1,
    css: 1,
    js: 1,
    assets: 1,
    copied: 0
  },
  manifest: {
    'css/app.css': 'css/app.a1b2c3d4.css',
    'js/app.js': 'js/app.e5f6a7b8.js'
  },
  warnings: []
}
```

## Политика зависимостей

У опубликованного пакета нет production `dependencies`. TypeScript объявлен
необязательной peer-зависимостью и загружается только при наличии выбранных
`.ts`-файлов. Инструменты разработки не устанавливаются пользователям пакета.

## Настройка собственного движка

Движок написан в рамках проекта с нуля: исходники удалённых сторонних
обработчиков не копируются и не встраиваются. Для изменения стандартных
настроек создайте `obfuscator.json` в рабочем каталоге:

```json
{
  "compact": true,
  "removeComments": true,
  "encodeStrings": true,
  "renameLocals": true
}
```

Поддерживаются только эти boolean-параметры. Движок может кодировать строки и
переименовывать только доказанно локальные имена. Глобальные имена, свойства,
модули и директивы сохраняются. При неоднозначном синтаксисе исходный файл
попадает в сборку без изменений, а причина записывается в `warnings`.

## Необязательный Makefile

Make для работы пакета не нужен. Если он уже используется в проекте:

```bash
make all
make all SRC_DIR=website BUILD_DIR=public
make clean
```

Makefile вызывает тот же Node.js CLI и не содержит отдельной реализации сборки.

## Проверка в настоящем браузере

Браузерный E2E-тест устанавливает именно архив `npm pack` в изолированный
consumer-проект. Затем он собирает многомодульное Vanilla TypeScript SPA и
открывает результат в Chromium:

```bash
# Один раз установите браузер для локальной разработки
npx playwright install chromium

# Упакуйте, установите, соберите, запустите и проверьте SPA
npm run test:e2e
```

Тест проверяет статические и динамические ES-module imports, CSS `@import` и
`url()`, хешированные изображения, загрузку JSON, DOM-события, `localStorage`,
HTTP-ответы, необработанные ошибки страницы и ошибки browser console.
Playwright используется только при разработке и не является
runtime-зависимостью опубликованного пакета.

## Требования и проверенная поддержка

- Заявленная цель — Node.js 18 или новее.
- Node.js-реализация рассчитана на Windows, macOS и Linux.
- Make необязателен.

Точная матрица версий, проверенная для выпуска, записана в
[руководстве по тестированию](./docs/TESTING.md). Платформа или версия Node.js не
считается подтверждённой, пока на ней не пройдут автоматические тесты.

## Границы защиты

JavaScript получает консервативную минификацию и базовую обфускацию, но не
сильную защиту. Минификация, компиляция TypeScript и хеширование имён не являются
границей безопасности. Пользователь браузера
может исследовать любой переданный ему код или данные. Никогда не помещайте
секреты во frontend-код.

Content hash прежде всего нужен для управления кешем. Он не обеспечивает контроль
доступа или защиту от подмены.

## Решение проблем

- **`Source directory does not exist`** — проверьте `--src` относительно текущего
  рабочего каталога.
- **Не найден локальный inline-ресурс** — сборка завершится, а ссылка попадёт в
  `warnings`.
- **Не установлен TypeScript peer** — выполните
  `npm install --save-dev typescript`.
- **Не работает `require()`** — пакет использует ESM; применяйте `import` и
  `await`.

Дополнительные решения находятся в
[руководстве по диагностике](./docs/TROUBLESHOOTING.md).

## Документация

- [API и конфигурация](./docs/README.md)
- [Примеры](./docs/EXAMPLES.md)
- [Тестирование и проверка выпуска](./docs/TESTING.md)
- [Решение проблем](./docs/TROUBLESHOOTING.md)
- [История изменений](./CHANGELOG.md)
- [Лицензия](./LICENSE)
- [Пакет npm](https://www.npmjs.com/package/obf-minify-build)
- [Сообщить о проблеме](https://github.com/denis991/obf-minify-build/issues)

## Лицензия

Проект распространяется по лицензии [GNU GPL 3.0](./LICENSE).

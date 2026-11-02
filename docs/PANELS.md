# Общий интерфейс панелей

Demo, Owner и Admin используют `app/components/PanelTable.tsx` и `app/panel-tables.css`.
Название записи — прямая ссылка в редактор. Справа находится настоящее меню «⋯»
с текстовыми действиями. Опасные действия выделяются красным и требуют подтверждения.
Меню содержит только операции, которые поддерживает соответствующий раздел/API.

В каждой таблице есть выбор строки, выбор всех отображаемых строк, частичное
состояние общего чекбокса, счётчик и сброс выбора. Выбор относится к текущей странице
списка и сбрасывается при изменении набора строк. Разные таблицы выбираются независимо.
Колонка действий закреплена справа при горизонтальной прокрутке. Для меню доступны
стрелки, Home/End, Escape и Tab; меню не обрезается границами таблицы.

## Маршруты

Переходы используют обычные `<a href>` и загружают документ. URL — источник состояния
раздела и редактора. Панели не вызывают `history.pushState`/`replaceState` и не
перехватывают `popstate`. После успешного сохранения выполняется переход к списку.
JavaScript остаётся для форм, запросов API, фильтров и локальных инструментов редактора.

| Панель | Список | Редактор | Создание |
| --- | --- | --- | --- |
| Demo | `?edition=content&section=pages` | `?edition=content&section=pages&record=3` | `?edition=content&section=pages&editor=new` |
| Owner | `?section=clients` | `?section=clients&editor=client&record=1` | `?section=clients&editor=client` |
| Admin | `?section=content` | `?section=content&page=1` | `?section=content&editor=new-page` |
| Концепции Admin | `?section=concepts` | `?section=concepts&concept=1` | `?section=concepts&concept=new` |

У модулей Admin используется `?section=modules&module=seo`. У подключаемых модулей
Demo — `?edition=business&section=faq&entry=1` и `entry=new`. Сохранённая запись Demo
просматривается отдельным документом с `preview=<ID>`. Для SEO редактора используется
дополнительный параметр `tab=seo`.

Ссылки строятся общей функцией `panelHref`: она сохраняет текущий путь. Поэтому Demo
одинаково работает на `demo.bypcms.ru/` и `bypcms.ru/demo/`, а Owner/Admin остаются
в `/owner/` и `/admin/`. Кнопки браузера «Назад» и «Вперёд» обрабатывает браузер.

## Проверки

`node --test tests/panels.test.mjs` проверяет построение ссылок, разметку таблиц,
пустые списки и отсутствие старой синхронизации истории. В ограниченном Windows
окружении можно добавить `--test-isolation=none`, чтобы не запускать дочерний процесс.
Production-экспорт проверяется командой `build:ftp` из `package.json`.

# Манифест модуля BYPCMS

Каждый модуль поставляется отдельным пакетом и содержит файл
`bypcms.module.json`. Манифест сообщает ядру, где модуль должен появиться.
Править файлы ядра для установки модуля запрещено.

```json
{
  "schema": "bypcms.module/v1",
  "key": "reviews",
  "name": "Отзывы и рейтинг",
  "version": "1.0.3",
  "core": ">=2.1 <3",
  "editions": ["commerce"],
  "description": "Отзывы покупателей и рейтинг товаров.",
  "placements": [
    {
      "slot": "menu.main",
      "component": "ReviewsList",
      "order": 430,
      "menu": {
        "id": "reviews",
        "label": "Отзывы",
        "icon": "star",
        "group": "Маркетинг"
      }
    },
    {
      "slot": "editor.tab",
      "component": "ProductReviewsTab",
      "entityKinds": ["products"],
      "order": 60
    },
    {
      "slot": "dashboard.widget",
      "component": "ReviewsModerationWidget",
      "order": 220
    }
  ],
  "permissions": [
    "reviews.read",
    "reviews.write",
    "products.read"
  ],
  "settings": [
    {
      "key": "moderation",
      "type": "boolean",
      "label": "Проверять отзывы перед публикацией",
      "default": true
    }
  ],
  "lifecycle": {
    "install": "migrations/install.sql",
    "update": "migrations/update.php",
    "uninstall": "migrations/uninstall.sql"
  }
}
```

Поддерживаемые точки встраивания:

Массив `placements` не ограничен одной точкой. Один модуль может одновременно
зарегистрироваться в нескольких меню, редакторах, боковых панелях, виджетах и
настройках. Для повторяемых зон создаются несколько записей с одинаковым `slot`,
но разными `component`, `entityKinds` и `order`. Например, FAQ может добавить
самостоятельный раздел, виджет на обзор, вкладку у страниц и статей, а также
блок вопросов в карточках товаров и услуг.

- `menu.main` — самостоятельный раздел или подменю;
- `menu.marketing` — раздел маркетинга;
- `dashboard.widget` — виджет обзорной страницы;
- `editor.tab` — вкладка редактора указанной сущности;
- `editor.sidebar` — блок в боковой панели редактора;
- `settings.section` — собственный раздел настроек.

Ядро сначала валидирует схему, версию Core, редакцию и разрешения. После этого
оно регистрирует компоненты в слотах. При отключении модуля регистрации
удаляются, а ядро продолжает работать без изменений.

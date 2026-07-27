export const publicModules = [
  {slug:"content",name:"Контент",price:0,category:"Базовый",lead:"Страницы и структура сайта без зависимости от разработчика.",features:["Страницы и вложенная структура","Блочный редактор","Меню и навигация","Медиатека","Черновики и публикация","История изменений"]},
  {slug:"seo",name:"SEO Pro",price:5900,category:"Маркетинг",lead:"Полный контроль поисковой оптимизации и технического состояния.",features:["Title и description","Open Graph","Sitemap.xml","Canonical URL","Редиректы","SEO-аудит страниц"]},
  {slug:"forms",name:"Формы и CRM",price:9900,category:"Продажи",lead:"Сбор и обработка обращений внутри панели управления.",features:["Конструктор форм","Защита от спама","Статусы обращений","Ответственные","Email-уведомления","Экспорт и интеграции"]},
  {slug:"commerce",name:"Commerce",price:14900,category:"Интернет-магазин",lead:"Товарный каталог, корзина и полный цикл обработки заказа.",features:["Категории и товары","Варианты и остатки","Корзина","Заказы и статусы","Промокоды","Доставка"]},
  {slug:"payments",name:"Платежи",price:7900,category:"Интернет-магазин",lead:"Безопасная онлайн-оплата и контроль финансовых операций.",features:["ЮKassa","СБП","Онлайн-чеки","Возвраты","Статусы платежей","Журнал операций"]},
  {slug:"analytics",name:"Аналитика",price:5900,category:"Маркетинг",lead:"События, цели и отчёты для решений на основе данных.",features:["События","Цели","Воронки","Источники трафика","Отчёты","Экспорт данных"]},
] as const;

export const publicEditions = [
  {name:"Business",annual:9900,lifetime:24900,note:"Компания, услуги и корпоративный сайт",modules:["content","forms","seo"]},
  {name:"Commerce",annual:19900,lifetime:49900,note:"Каталог, заказы, оплата и доставка",modules:["content","forms","seo","commerce","payments"]},
  {name:"Content",annual:7900,lifetime:19900,note:"Блог, медиа и база знаний",modules:["content","seo"]},
] as const;

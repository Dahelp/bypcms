export type EditionKey = "content" | "business" | "commerce";
export type EntityKind =
  | "pages" | "articles" | "categories" | "authors"
  | "services" | "projects" | "team" | "leads" | "forms"
  | "orders" | "products" | "brands" | "customers" | "promos" | "payments";

export type DemoEntity = {
  id: number;
  kind: EntityKind;
  title: string;
  slug: string;
  status: string;
  updated: string;
  image: number;
  excerpt: string;
  body: string;
  seoTitle: string;
  seoDescription: string;
  category?: string;
  author?: string;
  price?: number;
  oldPrice?: number;
  stock?: number;
  sku?: string;
  brand?: string;
  featured?: boolean;
  email?: string;
  phone?: string;
  value?: number;
  date?: string;
  extra?: string;
};

export type MenuItem = { id: string; label: string; icon: string; kind?: EntityKind; group?: string; badge?: string; moduleKey?: string };
export type ModuleSlot = "menu.main" | "menu.marketing" | "editor.tab" | "editor.sidebar" | "dashboard.widget" | "settings.section";
export type DemoModule = {
  key: string;
  name: string;
  description: string;
  version: string;
  price: number;
  editions: EditionKey[];
  slots: ModuleSlot[];
  menu?: MenuItem;
  editorKinds?: EntityKind[];
  color: string;
};

export const editions: Record<EditionKey, { name: string; project: string; note: string; accent: string; menu: MenuItem[] }> = {
  content: {
    name: "Content",
    project: "Atlas Journal",
    note: "Редакционная платформа",
    accent: "#7057e8",
    menu: [
      { id: "overview", label: "Обзор", icon: "⌂" },
      { id: "articles", label: "Материалы", icon: "▤", kind: "articles", group: "Контент" },
      { id: "pages", label: "Страницы", icon: "□", kind: "pages", group: "Контент" },
      { id: "categories", label: "Рубрики", icon: "⌘", kind: "categories", group: "Контент" },
      { id: "authors", label: "Авторы", icon: "♙", kind: "authors", group: "Контент" },
      { id: "media", label: "Медиатека", icon: "▧", group: "Система" },
      { id: "seo", label: "SEO", icon: "↗", group: "Продвижение", badge: "Pro", moduleKey: "seo" },
      { id: "analytics", label: "Аналитика", icon: "∿", group: "Продвижение", moduleKey: "analytics" },
      { id: "design", label: "Дизайн", icon: "◫", group: "Система" },
      { id: "extensions", label: "Модули", icon: "⬡", group: "Система" },
      { id: "settings", label: "Настройки", icon: "⚙", group: "Система" },
    ],
  },
  business: {
    name: "Business",
    project: "Northline Studio",
    note: "Сайт компании и продажи",
    accent: "#557a25",
    menu: [
      { id: "overview", label: "Обзор", icon: "⌂" },
      { id: "pages", label: "Страницы", icon: "□", kind: "pages", group: "Сайт" },
      { id: "services", label: "Услуги", icon: "◆", kind: "services", group: "Сайт" },
      { id: "projects", label: "Проекты", icon: "▦", kind: "projects", group: "Сайт" },
      { id: "team", label: "Команда", icon: "♙", kind: "team", group: "Сайт" },
      { id: "leads", label: "Заявки", icon: "◎", kind: "leads", group: "Продажи", badge: "3" },
      { id: "forms", label: "Формы", icon: "☷", kind: "forms", group: "Продажи", moduleKey: "forms" },
      { id: "media", label: "Медиатека", icon: "▧", group: "Система" },
      { id: "seo", label: "SEO", icon: "↗", group: "Продвижение", badge: "Pro", moduleKey: "seo" },
      { id: "analytics", label: "Аналитика", icon: "∿", group: "Продвижение", moduleKey: "analytics" },
      { id: "design", label: "Дизайн", icon: "◫", group: "Система" },
      { id: "extensions", label: "Модули", icon: "⬡", group: "Система" },
      { id: "settings", label: "Настройки", icon: "⚙", group: "Система" },
    ],
  },
  commerce: {
    name: "Commerce",
    project: "Forma Store",
    note: "Интернет-магазин",
    accent: "#c65b2d",
    menu: [
      { id: "overview", label: "Обзор", icon: "⌂" },
      { id: "orders", label: "Заказы", icon: "▣", kind: "orders", group: "Продажи", badge: "4" },
      { id: "products", label: "Товары", icon: "◇", kind: "products", group: "Каталог" },
      { id: "categories", label: "Категории", icon: "⌘", kind: "categories", group: "Каталог" },
      { id: "brands", label: "Производители", icon: "◉", kind: "brands", group: "Каталог" },
      { id: "customers", label: "Покупатели", icon: "♙", kind: "customers", group: "Продажи" },
      { id: "promos", label: "Промокоды", icon: "%", kind: "promos", group: "Маркетинг" },
      { id: "payments", label: "Платежи", icon: "₽", kind: "payments", group: "Продажи", moduleKey: "payments" },
      { id: "pages", label: "Страницы", icon: "□", kind: "pages", group: "Сайт" },
      { id: "media", label: "Медиатека", icon: "▧", group: "Система" },
      { id: "seo", label: "SEO", icon: "↗", group: "Маркетинг", badge: "Pro", moduleKey: "seo" },
      { id: "analytics", label: "Аналитика", icon: "∿", group: "Маркетинг", moduleKey: "analytics" },
      { id: "design", label: "Дизайн", icon: "◫", group: "Система" },
      { id: "extensions", label: "Модули", icon: "⬡", group: "Система" },
      { id: "settings", label: "Настройки", icon: "⚙", group: "Система" },
    ],
  },
};

export const moduleRegistry: DemoModule[] = [
  { key: "seo", name: "SEO Pro", description: "Метаданные, Open Graph, аудит, sitemap и редиректы.", version: "1.8.2", price: 5900, editions: ["content", "business", "commerce"], slots: ["menu.marketing", "editor.tab", "dashboard.widget"], editorKinds: ["pages", "articles", "services", "projects", "products", "categories", "brands"], color: "#7057e8" },
  { key: "analytics", name: "Аналитика", description: "События, цели, воронки и отчёты по контенту и продажам.", version: "1.2.4", price: 5900, editions: ["content", "business", "commerce"], slots: ["menu.marketing", "dashboard.widget"], color: "#286a8a" },
  { key: "forms", name: "Формы и CRM", description: "Конструктор форм, заявки, статусы и ответственные.", version: "1.4.0", price: 9900, editions: ["business", "commerce"], slots: ["menu.main", "editor.sidebar", "dashboard.widget", "settings.section"], editorKinds: ["pages", "services", "products"], color: "#557a25" },
  { key: "payments", name: "Платежи", description: "ЮKassa, СБП, чеки, статусы операций и возвраты.", version: "1.3.0", price: 7900, editions: ["commerce"], slots: ["menu.main", "editor.tab", "settings.section"], editorKinds: ["orders"], color: "#c65b2d" },
  { key: "reviews", name: "Отзывы и рейтинг", description: "Отзывы покупателей, модерация и рейтинг товаров.", version: "1.0.3", price: 4900, editions: ["commerce"], slots: ["menu.main", "editor.tab", "dashboard.widget"], menu: { id: "reviews", label: "Отзывы", icon: "★", group: "Маркетинг", moduleKey: "reviews" }, editorKinds: ["products"], color: "#a56a18" },
  { key: "delivery", name: "Доставка", description: "Зоны, тарифы, службы доставки и трекинг заказов.", version: "1.1.0", price: 6900, editions: ["commerce"], slots: ["editor.tab", "settings.section"], editorKinds: ["orders", "products"], color: "#3d6c9c" },
  { key: "bookings", name: "Онлайн-запись", description: "Расписание, специалисты, услуги и бронирования клиентов.", version: "1.0.8", price: 8900, editions: ["business"], slots: ["menu.main", "editor.sidebar", "dashboard.widget"], menu: { id: "bookings", label: "Онлайн-запись", icon: "◷", group: "Продажи", moduleKey: "bookings" }, editorKinds: ["services", "team"], color: "#925b87" },
  { key: "knowledge", name: "База знаний", description: "Документация, вложенные разделы, поиск и версии статей.", version: "1.3.1", price: 6900, editions: ["content", "business"], slots: ["menu.main", "editor.sidebar"], menu: { id: "knowledge", label: "База знаний", icon: "▥", group: "Контент", moduleKey: "knowledge" }, editorKinds: ["articles", "pages"], color: "#4f7568" },
];

export const defaultInstalledModules: Record<EditionKey, string[]> = {
  content: ["seo", "analytics"],
  business: ["seo", "analytics", "forms"],
  commerce: ["seo", "analytics", "forms", "payments"],
};

const entity = (id: number, kind: EntityKind, title: string, slug: string, image: number, patch: Partial<DemoEntity> = {}): DemoEntity => ({
  id, kind, title, slug, image,
  status: "Опубликовано",
  updated: "Сегодня, 10:24",
  excerpt: "Краткое описание материала, которое используется в карточках и поисковой выдаче.",
  body: "Здесь находится основной текст. Редактор поддерживает заголовки, абзацы, списки, изображения, цитаты и кнопки.",
  seoTitle: title,
  seoDescription: `Официальная страница «${title}». Подробная информация, характеристики и условия.`,
  ...patch,
});

export const seedEntities: DemoEntity[] = [
  entity(1, "pages", "Главная", "/", 0, { excerpt: "Главная страница проекта", featured: true }),
  entity(2, "pages", "О компании", "/about", 3),
  entity(3, "pages", "Контакты", "/contacts", 4),
  entity(10, "articles", "Пространство для новых идей", "/journal/new-space", 0, { category: "Архитектура", author: "Анна Левина", featured: true }),
  entity(11, "articles", "Как предметы формируют интерьер", "/journal/objects", 1, { category: "Дизайн", author: "Илья Морозов" }),
  entity(12, "articles", "Свет и геометрия", "/journal/light", 4, { category: "Архитектура", author: "Анна Левина", status: "Черновик" }),
  entity(20, "categories", "Архитектура", "/category/architecture", 4, { extra: "12 материалов" }),
  entity(21, "categories", "Дизайн", "/category/design", 1, { extra: "8 материалов" }),
  entity(22, "categories", "Мебель", "/catalog/furniture", 2, { extra: "24 товара" }),
  entity(23, "categories", "Освещение", "/catalog/light", 5, { extra: "16 товаров" }),
  entity(30, "authors", "Анна Левина", "/authors/anna", 3, { extra: "Главный редактор", email: "anna@atlas.demo" }),
  entity(31, "authors", "Илья Морозов", "/authors/ilya", 0, { extra: "Автор", email: "ilya@atlas.demo" }),
  entity(40, "services", "UX/UI-дизайн", "/services/ux-ui", 1, { price: 65000, extra: "от 20 рабочих дней" }),
  entity(41, "services", "Разработка сайта", "/services/development", 0, { price: 85000, extra: "от 30 рабочих дней" }),
  entity(42, "services", "Аудит продукта", "/services/audit", 4, { price: 35000, extra: "10 рабочих дней" }),
  entity(50, "projects", "Цифровая платформа Meridian", "/projects/meridian", 0, { category: "Разработка", featured: true }),
  entity(51, "projects", "Айдентика Forma", "/projects/forma", 1, { category: "Дизайн" }),
  entity(60, "team", "Мария Белова", "/team/maria", 3, { extra: "Арт-директор", email: "maria@northline.demo" }),
  entity(61, "team", "Алексей Ветров", "/team/alexey", 0, { extra: "Технический директор", email: "alexey@northline.demo" }),
  entity(70, "leads", "Анна Смирнова", "lead-1048", 3, { status: "Новая", value: 149000, phone: "+7 999 123-45-67", email: "anna@example.ru", extra: "Расчёт проекта" }),
  entity(71, "leads", "ООО «Вектор»", "lead-1047", 0, { status: "В работе", value: 280000, phone: "+7 495 100-20-30", email: "office@vector.ru", extra: "Форма услуги" }),
  entity(72, "leads", "Илья Орлов", "lead-1046", 1, { status: "Согласовано", value: 65000, phone: "+7 921 555-40-20", email: "orlov@example.ru", extra: "Обратный звонок" }),
  entity(80, "forms", "Обсудить проект", "project-request", 1, { extra: "6 полей · 32 отправки" }),
  entity(81, "forms", "Обратный звонок", "callback", 0, { extra: "3 поля · 18 отправок" }),
  entity(100, "products", "Кресло Forma 01", "/catalog/forma-01", 2, { price: 42900, oldPrice: 46900, stock: 12, sku: "FRM-001", brand: "Forma", category: "Мебель", featured: true }),
  entity(101, "products", "Стол Line 140", "/catalog/line-140", 5, { price: 36500, stock: 7, sku: "LIN-140", brand: "Nord", category: "Мебель" }),
  entity(102, "products", "Светильник Arc", "/catalog/arc", 5, { price: 12900, stock: 0, sku: "ARC-220", brand: "Lumo", category: "Освещение", status: "Скрыт" }),
  entity(110, "brands", "Forma", "/brands/forma", 2, { extra: "12 товаров · Италия" }),
  entity(111, "brands", "Nord", "/brands/nord", 5, { extra: "8 товаров · Россия" }),
  entity(112, "brands", "Lumo", "/brands/lumo", 4, { extra: "16 товаров · Дания" }),
  entity(120, "orders", "Заказ #1051", "1051", 2, { status: "Новый", value: 55800, extra: "Мария К. · 2 товара", date: "Сегодня, 10:24" }),
  entity(121, "orders", "Заказ #1050", "1050", 5, { status: "Комплектуется", value: 92400, extra: "Studio 17 · 3 товара", date: "Сегодня, 09:15" }),
  entity(122, "orders", "Заказ #1049", "1049", 2, { status: "Доставляется", value: 42900, extra: "Дмитрий П. · 1 товар", date: "Вчера, 18:40" }),
  entity(130, "customers", "Мария Кузнецова", "customer-88", 3, { email: "maria@example.ru", phone: "+7 999 100-20-30", value: 148200, extra: "4 заказа" }),
  entity(131, "customers", "Studio 17", "customer-87", 0, { email: "buy@studio17.ru", phone: "+7 495 222-14-10", value: 92400, extra: "1 заказ" }),
  entity(140, "promos", "WELCOME10", "WELCOME10", 1, { status: "Активен", value: 10, extra: "10% · 24 применения" }),
  entity(141, "promos", "DELIVERY", "DELIVERY", 5, { status: "Запланирован", value: 0, extra: "Бесплатная доставка" }),
  entity(150, "payments", "Платёж #PAY-3018", "PAY-3018", 2, { status: "Оплачен", value: 55800, extra: "ЮKassa · Заказ #1051" }),
  entity(151, "payments", "Платёж #PAY-3017", "PAY-3017", 5, { status: "Оплачен", value: 92400, extra: "СБП · Заказ #1050" }),
];

export const mediaItems = [
  { id: 0, name: "studio-interior.jpg", alt: "Современная студия" },
  { id: 1, name: "editorial-book.jpg", alt: "Журнал о дизайне" },
  { id: 2, name: "forma-chair.jpg", alt: "Кресло Forma" },
  { id: 3, name: "creative-team.jpg", alt: "Команда студии" },
  { id: 4, name: "architecture-light.jpg", alt: "Архитектурная композиция" },
  { id: 5, name: "oak-table-lamp.jpg", alt: "Стол и светильник" },
];

export const entityTitles: Record<EntityKind, { title: string; singular: string; description: string }> = {
  pages: { title: "Страницы", singular: "страницу", description: "Структура и статические страницы сайта" },
  articles: { title: "Материалы", singular: "материал", description: "Публикации, новости и статьи редакции" },
  categories: { title: "Категории", singular: "категорию", description: "Разделы, рубрики и вложенная структура" },
  authors: { title: "Авторы", singular: "автора", description: "Профили авторов и редакторов" },
  services: { title: "Услуги", singular: "услугу", description: "Предложения компании, цены и этапы" },
  projects: { title: "Проекты", singular: "проект", description: "Кейсы и выполненные работы" },
  team: { title: "Команда", singular: "сотрудника", description: "Сотрудники, роли и страницы специалистов" },
  leads: { title: "Заявки", singular: "заявку", description: "Обращения клиентов и воронка продаж" },
  forms: { title: "Формы", singular: "форму", description: "Конструктор форм и сценарии отправки" },
  orders: { title: "Заказы", singular: "заказ", description: "Полный цикл обработки заказов" },
  products: { title: "Товары", singular: "товар", description: "Карточки, варианты, цены и остатки" },
  brands: { title: "Производители", singular: "производителя", description: "Бренды, описания и каталоги товаров" },
  customers: { title: "Покупатели", singular: "покупателя", description: "Профили, заказы и сегменты покупателей" },
  promos: { title: "Промокоды", singular: "промокод", description: "Скидки, сроки и условия применения" },
  payments: { title: "Платежи", singular: "платёж", description: "Операции, чеки и возвраты" },
};

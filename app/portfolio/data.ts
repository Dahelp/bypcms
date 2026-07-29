export type PortfolioProject = {
  slug: string;
  title: string;
  category: string;
  edition: "Business" | "Commerce" | "Content";
  year: string;
  lead: string;
  description: string;
  result: string;
  image: string;
  accent: string;
  features: string[];
  modules: string[];
  services: string[];
};

export const portfolioProjects: PortfolioProject[] = [
  {
    slug: "bypcms-platform",
    title: "BYPCMS Platform",
    category: "Продуктовая платформа",
    edition: "Business",
    year: "2026",
    lead: "Единая экосистема для сборки, лицензирования и развития сайтов.",
    description: "Архитектура CMS, публичный продуктовый сайт, центр владельца, конструктор сборок и полноценные демонстрационные панели.",
    result: "Одна система связывает продажу лицензии, выбор модулей, сборку проекта и дальнейшее сопровождение.",
    image: "/og.png",
    accent: "#caff3d",
    features: ["Конструктор редакций", "Управление лицензиями", "Owner Center", "Демонстрационные панели"],
    modules: ["Контент", "SEO Pro", "Формы и CRM", "Аналитика"],
    services: ["UX/UI-дизайн", "Frontend-разработка", "Архитектура CMS", "Запуск и настройка"],
  },
  {
    slug: "commerce-demo",
    title: "Commerce Experience",
    category: "Интернет-магазин",
    edition: "Commerce",
    year: "2026",
    lead: "Витрина и управление продажами с понятным сценарием покупателя.",
    description: "Демонстрационный магазин показывает каталог, товары, бренды, заказы, оплаты и маркетинговые инструменты в едином интерфейсе.",
    result: "Покупатель заранее видит структуру будущего магазина и рабочее место команды.",
    image: "/demo/cms-media-board.png",
    accent: "#725ee0",
    features: ["Каталог и категории", "Карточки товаров", "Заказы и клиенты", "Управление дизайном"],
    modules: ["Commerce", "Платежи", "SEO Pro", "Аналитика"],
    services: ["Прототипирование", "UI-дизайн", "Frontend", "Настройка сценариев"],
  },
  {
    slug: "business-demo",
    title: "Business Workspace",
    category: "Корпоративный сайт",
    edition: "Business",
    year: "2026",
    lead: "Сайт компании, услуги, команда, проекты и обращения в одной панели.",
    description: "Полная структура корпоративного сайта с управлением услугами, кейсами, сотрудниками, формами и поисковым продвижением.",
    result: "Контент и обращения управляются без вмешательства разработчика, а модули расширяют систему без изменения ядра.",
    image: "/og.png",
    accent: "#cfe6ff",
    features: ["Услуги компании", "Команда", "Проекты", "Обращения"],
    modules: ["Контент", "Формы и CRM", "SEO Pro"],
    services: ["Исследование", "Индивидуальный дизайн", "Адаптивная разработка", "Обучение"],
  },
];

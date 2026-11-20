import {clientProjects} from "./client-projects";
import {caseStudies,type CaseStudy} from "./case-studies";
export type PortfolioProject = {
  study?: CaseStudy;
  gallery?: string[];
  slug: string;
  title: string;
  category: string;
  edition?: "Business" | "Commerce" | "Content";
  kind?: "client" | "platform" | "demo";
  year: string;
  lead: string;
  description: string;
  result: string;
  image: string;
  accent: string;
  features: string[];
  modules: string[];
  services: string[];
  featured?: boolean;
  demoUrl?: string;
  languages?: string[];
  en?: Partial<Pick<PortfolioProject,"title"|"category"|"lead"|"description"|"result"|"features"|"services">>;
};

const projects: PortfolioProject[] = [
  ...clientProjects,
  {
    slug:"ekkatire",title:"EKKA Tire",kind:"client",featured:true,category:"Шины и комплектующие для спецтехники",year:"",
    lead:"Полная разработка сайта: от структуры каталога до технических карточек и запроса предложения.",
    description:"Сайт поставщика промышленных шин, шин для ATV, дисков, фильтров и камер. Английский интерфейс объединяет ассортимент, технические характеристики и информацию о компании.",
    result:"Действующий сайт ekkatire.com. Объём работы — полная разработка сайта.",
    image:"/showcase/ekkatire-catalog.jpg",accent:"#073b9d",demoUrl:"https://ekkatire.com/",languages:["EN"],
    features:["Категории продукции","Модели и размеры","Технические карточки","Запрос предложения"],modules:[],services:["Полная разработка сайта"],
    en:{category:"Tires & components for specialist equipment",lead:"Full website development, from catalog structure to technical product pages and quote requests.",description:"A website for a supplier of industrial and ATV tires, rims, filters and tubes. Its English interface connects the product range, specifications and company information.",result:"The live ekkatire.com website. Our scope was full website development.",features:["Product categories","Patterns and sizes","Technical product pages","Quote requests"],services:["Full website development"]},
  },
  {
    slug:"business-demo",title:"Atelier",category:"Архитектура и интерьеры",edition:"Business",year:"2026",featured:false,
    lead:"Выразительная типографика, крупные проекты и понятный путь к обращению.",
    description:"Демонстрационный сайт архитектурной студии: проекты с подробными страницами, услуги, команда, поиск и форма обращения. Иллюстративные проекты показывают возможности темы, а не результаты клиентской работы.",
    result:"Можно пройти путь от первого знакомства до выбора услуги и отправки демонстрационного обращения, а затем изучить управление контентом в демо CMS.",
    image:"/showcase/atelier-clean.jpg",accent:"#caff3d",demoUrl:"https://demo.bypcms.ru/atelier/",languages:["RU"],
    features:["Портфолио проектов","Услуги и команда","Поиск по сайту","Форма обращения"],modules:["Контент","Формы и CRM","SEO Pro"],services:["Дизайн демонстрационной темы","Адаптивная разработка","Интеграция с CMS"],
    en:{category:"Architecture & interiors",lead:"Expressive typography, spacious project stories and a clear path to an inquiry.",description:"An architecture studio demo: detailed project pages, services, team, search and an inquiry form. Illustrative projects demonstrate the theme's capabilities, rather than customer results.",result:"Explore the journey from discovery to choosing a service and submitting a demo inquiry, then try content management in the CMS demo.",features:["Project portfolio","Services and team","Website search","Inquiry form"],services:["Demo theme design","Responsive development","CMS integration"]},
  },
  {
    slug:"commerce-demo",title:"Gallery",category:"Мебель и предметы интерьера",edition:"Commerce",year:"2026",featured:false,
    lead:"Каталог, варианты товаров и оформление заказа в спокойном, продуманном интерфейсе.",
    description:"Демонстрационный магазин мебели и предметов интерьера. Категории, поиск, фильтры, варианты товара, корзина и статусы заказов составляют полный сценарий покупки. Все товары, цены и заказы — иллюстративные.",
    result:"До покупки сборки можно проверить витрину и путь покупателя. Демонстрационные заказы не списывают реальные деньги.",image:"/showcase/gallery-clean.jpg",accent:"#caff3d",demoUrl:"https://demo.bypcms.ru/gallery/",languages:["RU"],
    features:["Каталог и фильтры","Варианты товаров","Корзина и заказы","Кабинет покупателя"],modules:["Контент","Commerce","Платежи","SEO Pro"],services:["Дизайн демонстрационной темы","Адаптивная разработка","Настройка сценариев"],
    en:{category:"Furniture & home objects",lead:"A thoughtful shopping experience, from the catalog and product variants to checkout.",description:"A demo store for furniture and home objects. Categories, search, filters, product variants, cart and order states form a complete shopping journey. Products, prices and orders are illustrative.",result:"Explore the storefront and shopping journey before choosing your build. Demo orders do not charge real money.",features:["Catalog and filters","Product variants","Cart and orders","Customer account"],services:["Demo theme design","Responsive development","Journey setup"]},
  },
  {
    slug:"chronicle",title:"Chronicle",category:"Современное электронное издание",edition:"Content",year:"2026",featured:false,
    lead:"Редакционная подача, содержательные материалы и внимание к чтению.",
    description:"Демонстрационное издание о городе, культуре и идеях. Рубрики, страницы авторов, архив и поиск помогают находить материалы, а адаптивная вёрстка сохраняет удобство чтения на разных экранах.",
    result:"Полноценный пример контентного проекта: от главной полосы и рубрик до статьи и RSS. Материалы используются для демонстрации.",image:"/showcase/chronicle-clean.jpg",accent:"#4da3ff",demoUrl:"https://demo.bypcms.ru/chronicle/",languages:["RU"],
    features:["Рубрики и авторы","Архив публикаций","Поиск по материалам","RSS"],modules:["Контент","SEO Pro"],services:["Дизайн демонстрационной темы","Адаптивная разработка","Типографика"],
    en:{category:"Contemporary digital publication",lead:"Editorial structure, thoughtful stories and a considered reading experience.",description:"A demo publication about cities, culture and ideas. Categories, author pages, archives and search help readers discover stories; a responsive layout supports reading across screens.",result:"A complete content project example, from the front page and categories to articles and RSS. Content is illustrative.",features:["Categories and authors","Publication archive","Article search","RSS"],services:["Demo theme design","Responsive development","Typography"]},
  },
  {
    slug: "bypcms-platform",
    title: "BYPCMS Platform",
    category: "Продуктовая платформа",
    edition: "Business",
    year: "2026",
    lead: "Единая экосистема для сборки, лицензирования и развития сайтов.",
    description: "Архитектура CMS, публичный продуктовый сайт, центр владельца, конструктор сборок и полноценные демонстрационные панели.",
    result: "Одна система связывает продажу лицензии, выбор модулей, сборку проекта и дальнейшее сопровождение.",
    image: "/showcase/platform.jpg",
    accent: "#caff3d",
    features: ["Конструктор редакций", "Управление лицензиями", "Owner Center", "Демонстрационные панели"],
    modules: ["Контент", "SEO Pro", "Формы и CRM"],
    services: ["UX/UI-дизайн", "Frontend-разработка", "Архитектура CMS", "Запуск и настройка"],
    languages:["RU","EN"],demoUrl:"/",en:{category:"Multilingual product platform",lead:"A connected platform for choosing, licensing and developing websites.",description:"The BYPCMS product website connects edition selection, build configuration, checkout and the customer account. Its public sales journey is available in Russian and English.",result:"Language switching preserves the current page and build configuration. Editions, showcase projects and ordering are connected in one journey.",features:["Build configurator","License management","Russian and English","Demo control panels"],services:["UX/UI design","Frontend development","CMS architecture","Launch and setup"]},
  },
];

export const portfolioProjects: PortfolioProject[] = projects.map(project=>({...project,kind:project.kind||(project.slug==="bypcms-platform"?"platform":"demo"),study:project.study||caseStudies[project.slug],...(project.slug==="bypcms-platform"?{image:"/showcase/platform-ru.jpg"}:{})}));

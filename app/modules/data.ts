import readiness from "../../server/_core/module-readiness.json";

export const publicModules = readiness.modules;
export const moduleAvailable = (key:string, edition:string) => publicModules.some(m=>m.slug===key&&m.readiness!=="planned"&&m.editions.includes(edition.toLowerCase()));

export const publicEditions = [
  {name:"Business",annual:9900,lifetime:24900,note:"Компания, услуги и корпоративный сайт",modules:["content","forms","seo"]},
  {name:"Commerce",annual:19900,lifetime:49900,note:"Каталог, заказы, оплата и доставка",modules:["content","seo","commerce","payments"]},
  {name:"Content",annual:7900,lifetime:19900,note:"Блог, медиа и база знаний",modules:["content","seo"]},
] as const;

export const publicServices = [
  {slug:"ux-ui",name:"UX/UI-дизайн",price:65000,unit:"проект",lead:"Исследование, прототип, дизайн-система и макеты ключевых экранов."},
  {slug:"frontend",name:"Frontend-разработка",price:85000,unit:"проект",lead:"Адаптивная реализация утверждённого дизайна и интеграция с BYPCMS."},
  {slug:"launch",name:"Запуск и настройка",price:25000,unit:"проект",lead:"Развёртывание, подключение сервисов, проверка и обучение команды."},
  {slug:"migration",name:"Перенос данных",price:18000,unit:"проект",lead:"Импорт страниц, товаров, изображений и метаданных из прежней системы."},
  {slug:"support",name:"Сопровождение",price:12000,unit:"месяц",lead:"Мониторинг, резервное копирование, консультации и развитие проекта."},
] as const;

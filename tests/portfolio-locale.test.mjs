import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {localizePortfolioProject} from '../lib/portfolio-locale.ts';

const catalog=JSON.parse(await readFile(new URL('../lib/public-en.json',import.meta.url),'utf8'));
const translate=text=>catalog[text]??text;
const source={slug:'itscenter',title:'Магазин шин для спецтехники',category:'Интернет-магазин',edition:'Commerce',year:'2023',lead:'Полноценный магазин по продаже шин, дисков, камер и фильтров для спецтехники.\n',description:'Личный кабинет покупателя.\nПродажи товаров по cross-номерам (самогенерируемые страницы по каждому. каталажному номеру).\nРаздел подбора товаров по типу техники.',result:'Выполнена админ панель с возможность управления всеми разделами.\nВнедрение модулей под задачи проекта.\nНастройка SEO на всех страницах (ручной SEO -> плагин INSEO -> Feedback).\nКаталог товаров с возможностью отбора по выбранным фильтрам.',image:'/uploads/portfolio/store.png',accent:'#caff3d',features:['Подбор товаров по технике','Поиск по cross номерам и аналогам','Управление контентом','Настройка SEO шаблонов'],modules:['IndexNow','InSEO','Баннеры на сайт','Комплекты из товаров','Кросс-номера','Промокоды'],services:['UX/UI-дизайн','Frontend-разработка','Архитектура CMS','Запуск и настройка','Сопровождение'],demoUrl:'https://its-center.ru'};

test('CMS project copy is fully English while its links and edition remain unchanged',()=>{
 const project=localizePortfolioProject(source,'en',translate);
 for(const field of ['title','category','lead','description','result','features','modules','services'])assert.doesNotMatch(JSON.stringify(project[field]),/[А-Яа-яЁё]/,field);
 assert.equal(project.title,'Specialist equipment tire store');
 assert.equal(project.slug,source.slug);assert.equal(project.image,source.image);assert.equal(project.demoUrl,source.demoUrl);assert.equal(project.edition,source.edition);
 assert.ok(project.description.includes('\n'));assert.equal(source.lead.endsWith('\n'),true);
});

test('Russian CMS content is preserved and explicit English copy takes priority',()=>{
 assert.equal(localizePortfolioProject(source,'ru',translate),source);
 assert.equal(localizePortfolioProject({...source,en:{title:'ITS Center'}},'en',translate).title,'ITS Center');
 const tiger=localizePortfolioProject({...source,title:'Скелет тигра: Модель бизнес',category:'Бизнес',lead:'',description:'',result:'',features:[],modules:[],services:[]},'en',translate);
 assert.equal(tiger.title,'Tiger Frame: Business Model');assert.equal(tiger.category,'Business');assert.equal(tiger.lead,'');
});

test('3V Consulting describes two service areas and three languages in both locales',async()=>{
 const raw=await readFile(new URL('../app/portfolio/client-projects.ts',import.meta.url),'utf8');
 const projects=JSON.parse(raw.slice(raw.indexOf('= ')+2).trim().replace(/;$/,''));
 const project=projects.find(p=>p.slug==='3vconsulting');
 assert.deepEqual(project.languages,['RU','EN','DE']);
 assert.ok(project.features.includes('Наследство в России'));assert.ok(project.features.includes('Наследство за рубежом'));
 assert.ok(project.en.features.includes('Inheritance in Russia'));assert.ok(project.en.features.includes('Inheritance abroad'));
 assert.doesNotMatch(JSON.stringify(project),/Три сценария|Три направления|Three inquiry paths|Three homepage paths/);
 assert.match(project.study.outcome.ru,/двумя направлениями/);assert.match(project.study.outcome.en,/two inheritance service areas/);
});

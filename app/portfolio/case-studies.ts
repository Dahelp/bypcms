export type CaseText={ru:string;en:string};
export type CaseScreen={src:string;width:number;height:number;title:CaseText;description:CaseText;mobile?:boolean;url?:string};
export type CaseStudy={task:CaseText;decisions:{title:CaseText;body:CaseText}[];outcome:CaseText;screens:CaseScreen[];versions?:{ru:CaseScreen;en:CaseScreen};versionsIntro?:CaseText;versionFacts?:CaseText[]};
const text=(ru:string,en:string):CaseText=>({ru,en});
const desktop=(src:string,title:CaseText,description:CaseText):CaseScreen=>({src,width:1251,height:712,title,description});
const mobile=(src:string,description:CaseText):CaseScreen=>({src,width:365,height:812,mobile:true,title:text("Мобильная версия","Mobile view"),description});
export const caseStudies:Record<string,CaseStudy>={
 "business-demo":{
  task:text("Показать, как архитектурной студии представить проекты и услуги, а посетителю — перейти от знакомства с работами к обсуждению своей задачи.","Show how an architecture studio can present its projects and services, helping visitors move from discovering the work to discussing their own brief."),
  decisions:[
   {title:text("Работы на первом плане","Let the work lead"),body:text("Крупные фотографии и сдержанная навигация оставляют внимание проектам. Категории помогают отличить жилые интерьеры, архитектуру и пространства для бизнеса.","Large photographs and restrained navigation keep the focus on projects. Categories distinguish residential interiors, architecture and commercial spaces.")},
   {title:text("У каждого проекта — своя история","A story for each project"),body:text("Страница объединяет тип объекта, направление, контекст, задачу и решение. Из кейса можно перейти к обсуждению похожего проекта.","Each project brings together its type, service, context, brief and solution. A contextual link leads to an inquiry about a similar project.")},
   {title:text("Путь к обращению","A path to an inquiry"),body:text("Услуги, информация о студии и форма обращения связаны с проектами. Посетитель может уточнить подход команды до отправки запроса.","Services, studio information and the inquiry form connect to the portfolio. Visitors can understand the studio's approach before sending a request.")},
  ],
  outcome:text("Рабочая демонстрация сайта студии: главная, каталог проектов, подробный кейс, услуги и обращение. Архитектурные объекты и их описания иллюстративные.","A working studio website demo with a homepage, project index, detailed case, services and inquiry journey. Architectural projects and their descriptions are illustrative."),
  screens:[desktop("/showcase/atelier-project.jpg",text("Подробная страница проекта","A detailed project page"),text("Название, контекст и параметры объекта собраны перед фотографией; далее раскрываются задача и решение.","The title, context and project facts introduce the photograph, followed by the brief and solution.")),mobile("/showcase/atelier-mobile.jpg",text("Главная сохраняет выразительную типографику и крупное изображение на узком экране.","The homepage keeps expressive typography and a prominent photograph on a narrow screen."))],
 },
 "commerce-demo":{
  task:text("Представить ассортимент мебели и предметов интерьера, помочь выбрать исполнение товара и пройти понятный путь к оформлению заказа.","Present furniture and home objects, help customers choose a product variant and provide a clear path to checkout."),
  decisions:[
   {title:text("Каталог по задачам покупателя","A customer-oriented catalog"),body:text("Категории, поиск и фильтры ведут к нужному предмету. В карточках списка сразу видны цена, наличие и доступность вариантов.","Categories, search and filters lead to relevant products. Listing cards show pricing, availability and product variants.")},
   {title:text("Детали до покупки","Details before purchase"),body:text("На странице товара собраны фотография, варианты исполнения, количество, наличие и характеристики. Недоступное исполнение обозначено до добавления в корзину.","Product pages bring together photography, variants, quantity, stock and specifications. Unavailable variants are marked before adding an item to the cart.")},
   {title:text("Продолжение после выбора","Beyond product selection"),body:text("Корзина, условия получения и кабинет заказов связаны с каталогом. Демонстрация позволяет изучить сценарий без реального списания денег.","The catalog connects to the cart, delivery information and order account. The demo lets visitors explore the journey without a real charge.")},
  ],
  outcome:text("Рабочая витрина с категориями, карточками товаров, вариантами и заказами. Товары, цены и покупки в этой теме демонстрационные.","A working storefront with categories, product pages, variants and orders. Products, prices and purchases in this theme are illustrative."),
  screens:[desktop("/showcase/gallery-product.jpg",text("Выбор исполнения товара","Choosing a product variant"),text("Фотография и параметры покупки находятся рядом. Характеристики и условия получения доступны на этой же странице.","Photography sits alongside purchasing options. Specifications and delivery information remain on the same page.")),mobile("/showcase/gallery-mobile.jpg",text("Мобильная карточка последовательно показывает изображение, название, цену и варианты товара.","The mobile product page presents the image, name, price and variants in a single reading order."))],
 },
 "chronicle":{
  task:text("Организовать электронное издание так, чтобы читатель находил важные материалы на главной, исследовал рубрики и удобно читал статью.","Organize a digital publication so readers can discover important stories on the front page, explore categories and comfortably read an article."),
  decisions:[
   {title:text("Редакционная иерархия","Editorial hierarchy"),body:text("Главный материал, лента и редакционный выбор имеют разный масштаб. Читатель различает приоритеты без одинаковых карточек для всех публикаций.","The lead story, latest feed and editorial picks use different scales, making priorities visible across the publication.")},
   {title:text("Навигация по содержанию","Navigation through content"),body:text("Рубрики, авторы, архив, поиск и RSS предлагают разные способы вернуться к материалам и продолжить чтение.","Categories, authors, archives, search and RSS provide several ways to return to stories and continue reading.")},
   {title:text("Статья как отдельный опыт","A considered article page"),body:text("Заголовок, описание, автор и дата предваряют текст. На мобильном экране сохраняется последовательный порядок чтения.","The headline, standfirst, author and date introduce the text. The mobile layout keeps a clear reading order.")},
  ],
  outcome:text("Пример полноценного контентного проекта с главной полосой, рубриками и страницей статьи. Издание и материалы используются для демонстрации темы.","A complete content project example with a front page, categories and article pages. The publication and stories demonstrate the theme."),
  screens:[desktop("/showcase/chronicle-article.jpg",text("Первый экран статьи","The article opening"),text("Заголовок, вводный текст и данные публикации выстроены перед основным материалом.","The headline, introduction and publication details establish context before the main story.")),mobile("/showcase/chronicle-mobile.jpg",text("На телефоне статья сохраняет иерархию заголовка, вводного текста и иллюстрации.","On a phone, the article retains the hierarchy of headline, introduction and illustration."))],
 },
 "bypcms-platform":{
  task:text("Связать знакомство с платформой, выбор редакции, расчёт сборки и оформление заказа в один путь. Сделать этот путь доступным на русском и английском.","Connect product discovery, edition selection, build estimates and ordering in one journey, available in both Russian and English."),
  decisions:[
   {title:text("От демонстрации к выбору","From demonstration to selection"),body:text("Примеры сайтов раскрывают возможности редакций. Из кейса можно перейти к конфигуратору с подходящей основой.","Website examples explain the editions. Each case leads to the configurator with a relevant starting point.")},
   {title:text("Стоимость без повторов","One clear cost summary"),body:text("Лицензия, разовые услуги и первый месяц сопровождения образуют предварительный расчёт. Состав сохраняется при переходе к заказу.","The license, one-time services and first month of support form an initial estimate. The selection is preserved when continuing to checkout.")},
   {title:text("Два языка, один сценарий","Two languages, one journey"),body:text("Переключение языка сохраняет страницу и параметры сборки. Локализованы публичные разделы, оформление, документы и кабинет покупателя.","Language switching preserves the page and build parameters. Public pages, checkout, legal documents and the buyer account are localized.")},
  ],
  outcome:text("Русская и английская версии объединяют портфолио, редакции, расчёт и заказ. Перевод административных панелей и клиентских демонстрационных тем в этот кейс не входит.","Russian and English versions connect the showcase, editions, estimates and ordering. Admin panels and customer demo themes are outside this case's localization scope."),
  screens:[],
  versions:{ru:desktop("/showcase/platform-ru.jpg",text("Русская версия","Russian version"),text("Публичный сайт BYPCMS на русском языке.","The Russian BYPCMS public website.")),en:desktop("/showcase/platform-en.jpg",text("Английская версия","English version"),text("Тот же продуктовый сценарий на английском языке.","The same product journey in English."))},
 },
 "ekkatire":{
  task:text("Представить поставщика шин, дисков и фильтров для специальной техники и связать знакомство с ассортиментом с запросом предложения по конкретному товару.","Present a supplier of tires, rims and filters for specialist equipment, connecting product discovery with a request for a specific product quote."),
  decisions:[
   {title:text("Структура ассортимента","A structured product range"),body:text("Каталог разделён на промышленные шины, шины для ATV, диски, фильтры и камеры. От категории посетитель переходит к моделям и размерам.","The catalog separates industrial tires, ATV tires, rims, filters and tubes. Categories lead visitors to patterns and sizes.")},
   {title:text("Техническая карточка товара","Technical product pages"),body:text("Модель и размер дополнены таблицей характеристик: габариты, глубина протектора, нагрузка и параметры обода. Рядом доступны лист продукта и запрос предложения.","Pattern and size are supported by specifications including dimensions, tread depth, load and rim details. A product leaflet and quote request are available alongside them.")},
   {title:text("Английский интерфейс","An English-language interface"),body:text("Навигация, каталог, технические описания и информация о компании представлены на английском языке.","Navigation, catalog, technical descriptions and company information are presented in English.")},
  ],
  outcome:text("Разработан сайт ekkatire.com с каталогом продукции, техническими карточками, информацией о компании, блогом и контактами. Объём участия — полная разработка сайта.","Developed ekkatire.com with a product catalog, technical product pages, company information, a blog and contacts. Our scope was full website development."),
  screens:[desktop("/showcase/ekkatire-product.jpg",text("Техническая карточка товара","A technical product page"),text("Размер, модель, технические параметры и переход к запросу предложения на одном экране.","Size, pattern, technical data and a quote-request link on one screen."))],
 },
};

"use client";
import { LocaleLink as Link, usePublicText } from "../components/PublicLocale";
import { BackToTop, Breadcrumbs, PublicFooter, PublicHeader } from "../components/PublicChrome";
import "./contacts.css";

export default function ContactsPage() {
 const t=usePublicText();
  return <main className="contactsPage">
    <PublicHeader />
    <Breadcrumbs items={[{ label: t("Главная"), href: "/" }, { label: t("Контакты и реквизиты") }]} />
    <div className="contactsContent publicContainer">
      <header className="contactsIntro">
        <p className="sectionLabel">BYPCMS</p>
        <h1>{t("Контакты и реквизиты")}</h1>
        <p>{t("Свяжитесь с нами по вопросам лицензий, разработки, заказов и оплаты.")}</p>
      </header>
      <div className="contactsGrid">
        <section className="contactsCard" aria-labelledby="seller-title">
          <h2 id="seller-title">{t("Сведения об исполнителе")}</h2>
          <dl>
            <div><dt>{t("ФИО")}</dt><dd>{t("Бабачков Юрий Петрович")}</dd></div>
            <div><dt>{t("Статус")}</dt><dd>{t("Самозанятый, плательщик НПД, без статуса ИП")}</dd></div><div><dt>{t("Телефон")}</dt><dd><a href="tel:+79296252500">+7 929 625-25-00</a></dd></div><div><dt>{t("ИНН")}</dt><dd className="contactsInn">550519989590</dd></div>
            <div><dt>{t("Электронная почта")}</dt><dd><a href="mailto:hello@bypcms.ru">hello@bypcms.ru</a></dd></div>
            <div><dt>{t("Сайт")}</dt><dd><a href="https://bypcms.ru/">bypcms.ru</a></dd></div>
          </dl>
          <a className="contactsAction" href="mailto:hello@bypcms.ru">{t("Написать в BYPCMS")}{" "}<span aria-hidden="true">↗</span></a>
        </section>
        <section className="contactsCard" aria-labelledby="delivery-title">
          <h2 id="delivery-title">{t("Как получить покупку")}</h2>
          <ol>
            <li>{t("Выберите редакцию, срок лицензии и дополнительные модули на")}{" "}<Link href="/order/">{t("странице оформления")}</Link>.</li>
            <li>{t("Войдите или зарегистрируйтесь в")}{" "}<Link href="/account/">{t("личном кабинете")}</Link> {" "}{t("и создайте заказ. Итоговая сумма показана до оплаты.")}</li>
            <li>{t("Основной способ — банковский перевод по счёту из заказа. Для услуг сначала примите точный состав, сумму и сроки. Дополнительно продавец может предложить ссылку на выставленный счёт ЮKassa.")}</li>
            <li>{t("После проверки фактического поступления оплаты продавцом в заказе появится ссылка на покупку: архив CMS, ключ лицензии и инструкция по установке. Физическая доставка не требуется.")}</li>
          </ol>
          <p>{t("Ключ и архив доступны в личном кабинете. После установки активируйте лицензию на домене, указанном в заказе. При продлении результат и новая дата окончания отображаются в заказе.")}</p>
        </section>
        <section className="contactsCard" aria-labelledby="services-title">
          <h2 id="services-title">{t("Индивидуальные работы")}</h2>
          <p>{t("Дизайн, разработка, перенос данных и сопровождение оформляются как заявки. Объём, окончательная стоимость, сроки и условия передачи результата согласовываются до оплаты.")}</p>
          <p>{t("Цены «от» на")}{" "}<Link href="/services/">{t("странице услуг")}</Link> {" "}{t("служат ориентиром. Заявка с индивидуальными работами не списывает деньги автоматически.")}</p>
        </section>
        <section className="contactsCard" aria-labelledby="support-title">
          <h2 id="support-title">{t("Вопросы по оплате и возвратам")}</h2>
          <p>{t("Для обращения по заказу или запроса возврата напишите на")}{" "}<a href="mailto:hello@bypcms.ru">hello@bypcms.ru</a>{t(". Укажите номер заказа и опишите вопрос.")}</p>
          <p>{t("Если оплата прошла, а покупка ещё не выдана, откройте заказ в")}{" "}<Link href="/account/">{t("кабинете")}</Link> {" "}{t("и нажмите «Проверить статус». Ошибка уведомления по почте не отменяет оплаченную покупку.")}</p>
          <p><Link href="/legal/offer/">{t("Условия покупки")}</Link> · <Link href="/legal/refunds/">{t("Порядок возврата")}</Link> · <Link href="/legal/privacy/">{t("Политика обработки данных")}</Link></p><p>{t("Сохраните номер заказа и документы, подтверждающие оплату: они помогут при обращении.")}</p>
        </section>
      </div>
    </div>
    <PublicFooter /><BackToTop />
  </main>;
}

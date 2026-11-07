import type { Metadata } from "next";
import Link from "next/link";
import { BackToTop, Breadcrumbs, PublicFooter, PublicHeader } from "../components/PublicChrome";
import "./contacts.css";

export const metadata: Metadata = {
  title: "Контакты и реквизиты — BYPCMS",
  description: "Контактная информация и реквизиты исполнителя BYPCMS. Порядок оформления заказа, получения цифровой покупки и обращения по оплате.",
};

export default function ContactsPage() {
  return <main className="contactsPage">
    <PublicHeader />
    <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Контакты и реквизиты" }]} />
    <div className="contactsContent publicContainer">
      <header className="contactsIntro">
        <p className="sectionLabel">BYPCMS</p>
        <h1>Контакты и реквизиты</h1>
        <p>Свяжитесь с нами по вопросам лицензий, разработки, заказов и оплаты.</p>
      </header>
      <div className="contactsGrid">
        <section className="contactsCard" aria-labelledby="seller-title">
          <h2 id="seller-title">Сведения об исполнителе</h2>
          <dl>
            <div><dt>ФИО</dt><dd>Бабачков Юрий Петрович</dd></div>
            <div><dt>Статус</dt><dd>Самозанятый, плательщик НПД, без статуса ИП</dd></div><div><dt>Телефон</dt><dd><a href="tel:+79296252500">+7 929 625-25-00</a></dd></div><div><dt>ИНН</dt><dd className="contactsInn">550519989590</dd></div>
            <div><dt>Электронная почта</dt><dd><a href="mailto:hello@bypcms.ru">hello@bypcms.ru</a></dd></div>
            <div><dt>Сайт</dt><dd><a href="https://bypcms.ru/">bypcms.ru</a></dd></div>
          </dl>
          <a className="contactsAction" href="mailto:hello@bypcms.ru">Написать в BYPCMS <span aria-hidden="true">↗</span></a>
        </section>
        <section className="contactsCard" aria-labelledby="delivery-title">
          <h2 id="delivery-title">Как получить покупку</h2>
          <ol>
            <li>Выберите редакцию, срок лицензии и дополнительные модули на <Link href="/order/">странице оформления</Link>.</li>
            <li>Войдите или зарегистрируйтесь в <a href="/account/">личном кабинете</a> и создайте заказ. Итоговая сумма показана до оплаты.</li>
            <li>Если онлайн-оплата доступна, перейдите из заказа на защищённую платёжную страницу ЮKassa. Доступность оплаты указана при оформлении.</li>
            <li>После подтверждения оплаты в заказе появится ссылка на покупку: архив CMS, ключ лицензии и инструкция по установке. Физическая доставка не требуется.</li>
          </ol>
          <p>Ключ и архив доступны в личном кабинете. После установки активируйте лицензию на домене, указанном в заказе. При продлении результат и новая дата окончания отображаются в заказе.</p>
        </section>
        <section className="contactsCard" aria-labelledby="services-title">
          <h2 id="services-title">Индивидуальные работы</h2>
          <p>Дизайн, разработка, перенос данных и сопровождение оформляются как заявки. Объём, окончательная стоимость, сроки и условия передачи результата согласовываются до оплаты.</p>
          <p>Цены «от» на <Link href="/services/">странице услуг</Link> служат ориентиром. Заявка с индивидуальными работами не списывает деньги автоматически.</p>
        </section>
        <section className="contactsCard" aria-labelledby="support-title">
          <h2 id="support-title">Вопросы по оплате и возвратам</h2>
          <p>Для обращения по заказу или запроса возврата напишите на <a href="mailto:hello@bypcms.ru">hello@bypcms.ru</a>. Укажите номер заказа и опишите вопрос.</p>
          <p>Если оплата прошла, а покупка ещё не выдана, откройте заказ в <a href="/account/">кабинете</a> и нажмите «Проверить статус». Ошибка уведомления по почте не отменяет оплаченную покупку.</p>
          <p><Link href="/legal/offer/">Условия покупки</Link> · <Link href="/legal/refunds/">Порядок возврата</Link> · <Link href="/legal/privacy/">Политика обработки данных</Link></p><p>Сохраните номер заказа и документы, подтверждающие оплату: они помогут при обращении.</p>
        </section>
      </div>
    </div>
    <PublicFooter /><BackToTop />
  </main>;
}

"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import "./order.css";

export default function OrderPage(){
  const[summary,setSummary]=useState({edition:"Business",term:"annual",modules:""});
  useEffect(()=>{const query=new URLSearchParams(window.location.search);setSummary({edition:query.get("edition")||"Business",term:query.get("term")||"annual",modules:query.get("modules")||""})},[]);
  const submit=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();const data=new FormData(event.currentTarget);const subject=encodeURIComponent(`Заказ BYPCMS ${summary.edition}`);const body=encodeURIComponent(`Имя: ${data.get("name")}\nКомпания: ${data.get("company")}\nEmail: ${data.get("email")}\nТелефон: ${data.get("phone")}\nРедакция: ${summary.edition}\nЛицензия: ${summary.term==="lifetime"?"пожизненная":"1 год"}\nМодули: ${summary.modules||"только включённые"}\nКомментарий: ${data.get("comment")}`);window.location.href=`mailto:hello@bypcms.ru?subject=${subject}&body=${body}`};
  return <main className="orderPage"><nav><Link href="/"><b>B</b> BYPCMS</Link><Link href="/#builder">← Вернуться к расчёту</Link></nav><div className="orderLayout"><section><small>ОФОРМЛЕНИЕ СБОРКИ</small><h1>Заявка на BYPCMS</h1><p>До подключения интернет-эквайринга заказ фиксируется владельцем, после чего клиент получает договор и счёт. Следующий этап — личный кабинет с оплатой, лицензиями, загрузками и продлениями.</p><div><span>Редакция<strong>{summary.edition}</strong></span><span>Лицензия<strong>{summary.term==="lifetime"?"Пожизненная":"На 1 год"}</strong></span><span>Модули<strong>{summary.modules||"Включённые"}</strong></span></div></section><form onSubmit={submit}><h2>Контактные данные</h2><label>Имя<input name="name" required/></label><label>Компания<input name="company"/></label><div><label>Email<input name="email" type="email" required/></label><label>Телефон<input name="phone" required/></label></div><label>Комментарий<textarea name="comment" rows={5}/></label><button>Отправить заявку →</button><small>Откроется письмо с уже заполненным составом заказа.</small></form></div></main>
}

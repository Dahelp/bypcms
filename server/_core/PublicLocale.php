<?php
declare(strict_types=1);

/** Locale applies to public buyer pages only, never to identifiers or stored data. */
function public_lang(): string {
    $requested = $_GET['lang'] ?? $_POST['lang'] ?? $_COOKIE['bypcms_lang'] ?? 'ru';
    return is_string($requested) && $requested === 'en' ? 'en' : 'ru';
}
function public_dictionary(): array {
    static $dictionary;
    return $dictionary ??= json_decode(file_get_contents(__DIR__.'/public-en.json'), true, 512, JSON_THROW_ON_ERROR);
}
function public_t(string $text): string {
    return public_lang() === 'en' ? (public_dictionary()[$text] ?? $text) : $text;
}
function public_text(string $text): string {return htmlspecialchars(public_t($text), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');}
function public_href(string $href): string {
    if (public_lang() !== 'en') return $href;
    if (preg_match('~^/(?:order|portfolio|services|modules|contacts|concept-example|legal)(?:/|\?|$)~', $href) || $href === '/') return '/en'.$href;
    return $href;
}
function public_language_switch(): string {
    $uri = (string)($_SERVER['REQUEST_URI'] ?? '/account/');
    $parts = parse_url($uri);$query=[];parse_str($parts['query']??'', $query);
    $links=[];
    foreach (['ru'=>'RU','en'=>'EN'] as $language=>$label) {
        $query['lang']=$language;
        if(is_string($query['next']??null)&&preg_match('~^/(?:en/)?order/?(?:\?|$)~',$query['next']))$query['next']=($language==='en'?'/en':'').preg_replace('~^/en(?=/)~','',$query['next']);
        $url=($parts['path']??'/account/').'?'.http_build_query($query);
        $links[]='<a lang="'.$language.'" href="'.htmlspecialchars($url,ENT_QUOTES,'UTF-8').'"'.(public_lang()===$language?' aria-current="true"':'').'>'.$label.'</a>';
    }
    return '<nav class="accountLanguages" aria-label="Language">'.implode(' / ', $links).'</nav>';
}
if (!headers_sent() && (isset($_GET['lang']) || isset($_POST['lang']))) {
    setcookie('bypcms_lang', public_lang(), ['expires'=>time()+31536000,'path'=>'/','samesite'=>'Lax','secure'=>!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off']);
}

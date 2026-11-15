<?php
declare(strict_types=1);
// Loopback PHP built-in server only; never deployed as an application endpoint.
if(PHP_SAPI!=='cli-server'){http_response_code(404);exit;}
$root=dirname(__DIR__).'/server';$path=rawurldecode((string)parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH));
if(str_contains($path,'..')||preg_match('#^/(?:_core|_storage|_private)(?:/|$)#',$path)){http_response_code(403);return true;}
if(is_file($root.$path))return false;
if(preg_match('#^/(gallery|market|luxe)(?:/|$)#',$path,$match)){require $root.'/'.$match[1].'/index.php';return true;}
http_response_code(404);echo 'Not found';

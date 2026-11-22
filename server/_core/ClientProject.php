<?php
declare(strict_types=1);
namespace BYPCMS\Core;

/** Developer-owned project integration; never accepts executable code from a request. */
interface ClientProject {
    public function manifest():array;
    public function owns(array $record):bool;
    public function record(array $record):array;
    public function prepare(array $input,?array $previous):array;
    public function settings(string $section):array;
    public function saveSettings(string $section,array $input):void;
    public function saved(array $record):void;
    public function url(array $record):string;
}

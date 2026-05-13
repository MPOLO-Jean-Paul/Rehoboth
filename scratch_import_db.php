<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

$sqlFile = __DIR__ . '/BDD_cleaned.sql';

if (!File::exists($sqlFile)) {
    die("File not found: $sqlFile\n");
}

echo "Importing data from $sqlFile...\n";

try {
    // Disable foreign key checks for the import
    DB::statement('SET FOREIGN_KEY_CHECKS=0;');
    
    $sql = File::get($sqlFile);
    
    // Some dumps have multiple statements, unprepared handles it better in some cases
    // but sometimes it fails with large blocks. We'll try it.
    DB::unprepared($sql);
    
    DB::statement('SET FOREIGN_KEY_CHECKS=1;');
    echo "Import successful!\n";
} catch (\Exception $e) {
    echo "Error during import: " . $e->getMessage() . "\n";
}

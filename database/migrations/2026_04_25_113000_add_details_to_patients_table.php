<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            if (!Schema::hasColumn('patients', 'birth_year')) {
                $table->integer('birth_year')->nullable()->after('last_name');
            }
            if (!Schema::hasColumn('patients', 'pathology')) {
                $table->string('pathology')->nullable()->after('birth_year');
            }
        });
    }

    public function down(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            $table->dropColumn(['birth_year', 'pathology']);
        });
    }
};

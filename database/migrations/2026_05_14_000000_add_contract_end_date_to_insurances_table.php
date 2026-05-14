<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('insurances', function (Blueprint $table) {
            $table->date('contract_end_date')->nullable()->after('contract_date');
        });
    }

    public function down(): void
    {
        Schema::table('insurances', function (Blueprint $table) {
            $table->dropColumn('contract_end_date');
        });
    }
};

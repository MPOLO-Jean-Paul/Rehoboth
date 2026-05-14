<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('visits', function (Blueprint $table) {
            $table->timestamp('discharge_date')->nullable();
            $table->string('discharge_type')->nullable(); // guerison, refere, evasion, deces
            $table->text('discharge_summary')->nullable();
            $table->date('follow_up_date')->nullable();
        });
    }
    public function down(): void {
        Schema::table('visits', function (Blueprint $table) {
            $table->dropColumn(['discharge_date', 'discharge_type', 'discharge_summary', 'follow_up_date']);
        });
    }
};

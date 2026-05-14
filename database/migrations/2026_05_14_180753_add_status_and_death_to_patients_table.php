<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('patients', function (Blueprint $blueprint) {
            $blueprint->string('status')->default('active')->index(); // active, discharged, deceased
            $blueprint->date('death_date')->nullable();
            $blueprint->string('discharge_type')->nullable(); // guéri, référé, etc.
            $blueprint->text('medical_history_summary')->nullable(); // Résumé global du dossier
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('patients', function (Blueprint $blueprint) {
            $blueprint->dropColumn(['status', 'death_date', 'discharge_type', 'medical_history_summary']);
        });
    }
};

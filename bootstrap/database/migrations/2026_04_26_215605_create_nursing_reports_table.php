<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('nursing_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('nurse_id')->constrained('users')->onDelete('cascade');
            $table->string('shift_type')->default('matin'); // matin, apres-midi, nuit
            $table->date('report_date');
            $table->integer('patients_seen')->default(0);
            $table->integer('transfers_done')->default(0);
            $table->integer('emergencies_handled')->default(0);
            $table->text('summary');                         // Résumé narratif de la garde
            $table->json('patients_to_watch')->nullable();   // Liste de patients à surveiller
            $table->json('incidents')->nullable();           // Incidents survenus
            $table->text('handover_notes')->nullable();      // Notes de relève
            $table->string('status')->default('draft');      // draft, submitted
            $table->timestamps();
        });

        // Ajouter colonne last_checked_at à hospitalizations pour les alertes
        Schema::table('hospitalizations', function (Blueprint $table) {
            $table->timestamp('last_checked_at')->nullable()->after('last_billed_at');
            $table->boolean('alert_active')->default(false)->after('last_checked_at');
            $table->string('alert_reason')->nullable()->after('alert_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('nursing_reports');
        Schema::table('hospitalizations', function (Blueprint $table) {
            $table->dropColumn(['last_checked_at', 'alert_active', 'alert_reason']);
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hospitalizations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained()->onDelete('cascade');
            $table->foreignId('visit_id')->nullable()->constrained()->onDelete('set null');
            $table->string('room_number')->nullable();       // Numéro de chambre
            $table->string('bed_number')->nullable();        // Numéro de lit
            $table->string('ward')->nullable();              // Service/Salle (ex: Maternité, Chirurgie...)
            $table->string('status')->default('active');     // active, discharged, transferred
            $table->date('admission_date');
            $table->date('discharge_date')->nullable();
            $table->decimal('daily_rate', 10, 2)->default(0); // Tarif journalier
            $table->text('diagnosis')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('attending_doctor_id')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamp('last_billed_at')->nullable(); // Dernière facturation journalière
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hospitalizations');
    }
};

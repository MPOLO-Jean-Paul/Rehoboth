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
        Schema::create('visits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained()->onDelete('cascade');
            
            // Pour le transfert vers un médecin spécifique
            $table->foreignId('doctor_id')->nullable()->constrained('users')->onDelete('set null');
            
            $table->string('current_service')->default('reception');
            $table->string('status')->default('pending');
            
            // Notes de la réception et des soins
            $table->text('complaints_notes')->nullable();
            $table->text('nursing_notes')->nullable(); 

            // Signes vitaux (envoyés par SoinsScreen.js)
            $table->string('temperature')->nullable();
            $table->string('blood_pressure')->nullable();
            $table->string('weight')->nullable();
            $table->string('height')->nullable();
            $table->string('pulse')->nullable();
            $table->string('respiratory_rate')->nullable();
            $table->string('oxygen_saturation')->nullable();
            
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('visits');
    }
};
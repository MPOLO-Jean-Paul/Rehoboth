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
        Schema::create('prescriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('visit_id')->constrained()->onDelete('cascade');
            $table->foreignId('patient_id')->constrained()->onDelete('cascade');
            $table->foreignId('doctor_id')->constrained('users')->onDelete('cascade');
            $table->text('notes')->nullable();
            $table->enum('status', ['pending', 'dispensed', 'cancelled'])->default('pending');
            $table->timestamps();
        });

        Schema::create('prescription_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('prescription_id')->constrained()->onDelete('cascade');
            $table->foreignId('medicine_id')->nullable()->constrained()->onDelete('set null');
            $table->string('medicine_name'); // Snapshot for historical record
            $table->string('dosage')->nullable();
            $table->integer('quantity_prescribed');
            $table->integer('quantity_dispensed')->default(0);
            $table->string('instructions')->nullable();
            $table->enum('status', ['pending', 'dispensed', 'out_of_stock'])->default('pending');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('prescription_items');
        Schema::dropIfExists('prescriptions');
    }
};

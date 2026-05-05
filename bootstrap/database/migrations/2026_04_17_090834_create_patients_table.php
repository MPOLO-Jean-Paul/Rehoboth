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
        Schema::create('patients', function (Blueprint $table) {
            $table->id();
            $table->string('first_name');
            $table->string('last_name');
            $table->integer('birth_year')->nullable();
            $table->string('pathology')->nullable();
            $table->boolean('is_insured')->default(false);
            $table->string('insurance_company')->nullable();
            $table->string('insurance_code')->nullable();
            $table->string('contact_info')->nullable();
            $table->text('complaints')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('patients');
    }
};

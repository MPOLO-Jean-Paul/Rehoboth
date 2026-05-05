<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('insured_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('insurance_id')->constrained()->onDelete('cascade');
            $table->string('member_name');
            $table->string('membership_code')->index();
            $table->boolean('is_active')->default(true);
            $table->unique(['insurance_id', 'membership_code']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('insured_members');
    }
};

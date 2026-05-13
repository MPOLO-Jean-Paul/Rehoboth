<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('maternity_cases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained()->onDelete('cascade');
            $table->foreignId('visit_id')->nullable()->constrained()->nullOnDelete();
            $table->string('status')->default('active');
            $table->string('pregnancy_status')->default('prenatal');
            $table->unsignedTinyInteger('gravida')->nullable();
            $table->unsignedTinyInteger('parity')->nullable();
            $table->unsignedTinyInteger('gestational_age_weeks')->nullable();
            $table->date('last_menstrual_period')->nullable();
            $table->date('expected_delivery_date')->nullable();
            $table->timestamp('admission_date')->nullable();
            $table->timestamp('delivery_date')->nullable();
            $table->timestamp('discharge_date')->nullable();
            $table->string('risk_level')->default('low');
            $table->text('risk_notes')->nullable();
            $table->string('delivery_type')->nullable();
            $table->string('baby_gender')->nullable();
            $table->decimal('baby_weight', 8, 2)->nullable();
            $table->string('baby_apgar')->nullable();
            $table->unsignedSmallInteger('fetal_heart_rate')->nullable();
            $table->string('maternal_bp')->nullable();
            $table->decimal('temperature', 4, 1)->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('midwife_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('doctor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('last_checked_at')->nullable();
            $table->boolean('alert_active')->default(false);
            $table->string('alert_reason')->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at'], 'maternity_cases_status_created_idx');
            $table->index(['pregnancy_status', 'status'], 'maternity_cases_pregnancy_status_idx');
            $table->index(['risk_level', 'status'], 'maternity_cases_risk_status_idx');
            $table->index(['patient_id', 'status'], 'maternity_cases_patient_status_idx');
            $table->index(['visit_id', 'status'], 'maternity_cases_visit_status_idx');
        });

        Schema::create('maternity_follow_ups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('maternity_case_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type')->default('prenatal_check');
            $table->string('maternal_bp')->nullable();
            $table->unsignedSmallInteger('fetal_heart_rate')->nullable();
            $table->decimal('cervical_dilation', 4, 1)->nullable();
            $table->string('contractions')->nullable();
            $table->decimal('baby_weight', 8, 2)->nullable();
            $table->decimal('temperature', 4, 1)->nullable();
            $table->text('notes')->nullable();
            $table->string('next_action')->nullable();
            $table->timestamp('next_check_at')->nullable();
            $table->timestamps();

            $table->index(['maternity_case_id', 'created_at'], 'maternity_follow_case_created_idx');
            $table->index(['type', 'created_at'], 'maternity_follow_type_created_idx');
            $table->index(['next_check_at'], 'maternity_follow_next_check_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('maternity_follow_ups');
        Schema::dropIfExists('maternity_cases');
    }
};
